# vendas/services.py (Versão R9 - Assíncrona - CORRIGIDA)
from django.db import transaction, IntegrityError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from decimal import Decimal
import logging

# Importações de Modelos
from .models import Venda, ItemVenda, Comanda, ComandaItem
from estoque.models import Produto, CustoProduto
# CORREÇÃO CRÍTICA DO NOME DO MÓDULO (contabilidade -> contabil)
from contabil.services import criar_lancamento_contabil_partida_dobrada 
# NECESSÁRIO para a lógica assíncrona
from estoque.services import EstoqueService 


logger = logging.getLogger(__name__)

# Mantemos a exceção para rastreabilidade de erros no Service
class EstoqueInsuficienteError(Exception):
    """Exceção customizada para falta de estoque."""
    pass

class VendaService:
    
    @staticmethod
    def finalizar_venda_comanda(venda_rascunho_pk: int, usuario_atendente):
        """
        R9: Recebe a Venda RASCUNHO (Comanda), finaliza a fase síncrona
        e DISPARA a task Celery para a baixa de estoque (Performance/UX).
        """
        # CRÍTICO: Buscar como Venda, pois a ComandaViewSet lida com Venda
        venda_rascunho = get_object_or_404(Venda, pk=venda_rascunho_pk)
        
        # O status 'FECHADA' é usado na View, mas aqui usamos a constante do Model
        if venda_rascunho.status != Venda.Status.ABERTA:
            # Propaga exceção para o views.py acionar o rollback
            raise Exception(f"Venda {venda_rascunho_pk} não está aberta e não pode ser faturada.")

        # ====================================================================
        # R8 CRÍTICA: GARANTIA DE ATOMICIDADE (Finalização e Disparo)
        # ====================================================================
        try:
            with transaction.atomic():
                
                # ... (restante da lógica de criação da Venda Principal/Itens) ...
                
                # 1. Criação da Venda Principal (Cabeçalho)
                # ASSUMINDO que comanda = Venda RASCUNHO e venda = Venda FINAL
                venda = Venda.objects.create(
                    comanda_origem=venda_rascunho,
                    atendente=usuario_atendente,
                    data_faturamento=timezone.now(),
                    tipo_pedido=venda_rascunho.tipo_pedido, # Usando campo da Venda rascunho
                    status=Venda.Status.FATURADA, # Status FATURADA indica que está PRONTA
                    subtotal=Decimal('0.00'), 
                    valor_total_bruto=Decimal('0.00'),
                    valor_servico=Decimal('0.00'),
                )
                
                subtotal_venda_bruto = Decimal('0.00')
                
                # 2. Criação dos Itens da Venda
                comanda_itens = ComandaItem.objects.filter(comanda=venda_rascunho.pk) 
                
                for comanda_item in comanda_itens:
                    produto = comanda_item.produto
                    
                    # Busca do CMP 
                    try:
                        custo_produto = CustoProduto.objects.get(produto=produto)
                        cmp_atual = custo_produto.custo_medio_ponderado
                    except CustoProduto.DoesNotExist:
                        cmp_atual = Decimal('0.0000')

                    # Criação do ItemVenda
                    ItemVenda.objects.create(
                        venda=venda,
                        produto=produto,
                        quantidade=comanda_item.quantidade,
                        preco_unitario=comanda_item.preco_unitario,
                        subtotal_item=comanda_item.subtotal_item,
                        nome_cliente_mesa=comanda_item.nome_cliente_mesa, 
                        custo_unitario_apurado=cmp_atual 
                    )
                    
                    subtotal_venda_bruto += comanda_item.subtotal_item.quantize(Decimal('0.01'))

                # 3. Recálculo e Atualização Final dos Totais
                venda.valor_total_bruto = subtotal_venda_bruto
                venda.recalcular_totais() 
                
                # 4. Finalização da Comanda Rascunho 
                venda_rascunho.status = Venda.Status.FECHADA 
                venda_rascunho.data_faturamento = timezone.now()
                venda_rascunho.save()

            # SEGUNDA FASE (APÓS COMMIT): DISPARO DA TASK ASSÍNCRONA (R9)
            logger.info(f"Venda {venda.pk} criada com sucesso. Disparando task de baixa de estoque.")
            
            # CORREÇÃO DA IMPORTAÇÃO CIRCULAR: Importa a task aqui
            from .tasks import processar_faturamento_venda 
            
            # Chamada correta da task
            processar_faturamento_venda.delay(venda.pk) 
            
            return venda

        except Exception as e:
            logger.error(f"Falha CRÍTICA na transação de Venda {venda_rascunho_pk}. ROLLBACK efetuado: {e}")
            raise 

    
    @staticmethod
    def processar_faturamento_async(venda_pk: int):
        # ... (restante da lógica assíncrona) ...
        
        logger.info(f"Service Layer: Iniciando processamento ASSÍNCRONO para Venda {venda_pk}.")

        # 1. Busca e Bloqueio CRÍTICO
        try:
            venda = Venda.objects.select_for_update().get(pk=venda_pk)
        except Venda.DoesNotExist:
            logger.error(f"Service Layer: Venda {venda_pk} não encontrada.")
            return

        # Condição de segurança
        if venda.movimento_estoque_criado:
            logger.warning(f"Service Layer: Venda {venda_pk} já processada. Abortando.")
            return

        # 2. Inicia a transação atômica para toda a lógica assíncrona (R8)
        try:
            with transaction.atomic():
                
                total_cmv_apurado = Decimal('0.00')

                # A. Baixa de Estoque (USANDO SERVICE R1)
                for item_venda in venda.itens_venda.all():
                    
                    if not item_venda.produto:
                        continue 

                    cmv_item = item_venda.custo_unitario_apurado * item_venda.quantidade
                    total_cmv_apurado += cmv_item

                    # CHAMA O SERVICE (ALVO DO MOCK NO TESTE)
                    EstoqueService.registrar_saida(
                        produto=item_venda.produto,
                        quantidade=item_venda.quantidade,
                        tipo_movimento='SAIDA_VENDA',
                        responsavel=venda.atendente,
                        custo_unitario_cmp=item_venda.custo_unitario_apurado,
                        venda=venda # Rastreabilidade
                    )

                # B. Geração dos Lançamentos Contábeis
                CONTA_CLIENTES = '1.1.0.3.0.0'
                CONTA_RECEITA = '4.1.0.1.0.1'  
                CONTA_CMV = '5.1.0.1.0.0'
                CONTA_ESTOQUE = '1.1.0.2.0.1'

                # 1. Lançamento de Receita
                criar_lancamento_contabil_partida_dobrada(
                    conta_debito_codigo=CONTA_CLIENTES,  
                    conta_credito_codigo=CONTA_RECEITA,
                    valor=venda.valor_total_liquido, 
                    historico=f"Receita Líquida ref. Venda N° {venda_pk} (Assíncrono)",
                    content_object=venda
                )
                
                # 2. Lançamento do Custo da Mercadoria Vendida
                if total_cmv_apurado > Decimal('0.00'):
                    criar_lancamento_contabil_partida_dobrada(
                        conta_debito_codigo=CONTA_CMV,
                        conta_credito_codigo=CONTA_ESTOQUE,
                        valor=total_cmv_apurado.quantize(Decimal('0.01')),
                        historico=f"CMV e Baixa de Estoque ref. Venda N° {venda_pk}.",
                        content_object=venda
                    )
                    
                # C. Marca como Processado
                venda.movimento_estoque_criado = True
                venda.custo_total = total_cmv_apurado.quantize(Decimal('0.01'))
                venda.save(update_fields=['movimento_estoque_criado', 'custo_total'])
                
                logger.info(f"Service Layer: Venda {venda_pk} processada e marcada como FATURADA com sucesso.")
                return f"Venda {venda_pk} processada com sucesso."

        except Exception as e:
            raise e