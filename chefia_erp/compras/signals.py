# ==============================================================================
# ARQUIVO: compras/signals.py (Refatorado R7 - CORRIGIDO)
# ==============================================================================
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from django.db import transaction
from decimal import Decimal
from datetime import date 

# Importações dos modelos locais (Permanece apenas o que é nativo de 'compras')
from .models import (
    PedidoCompra, 
    ItemPedidoCompra, 
    StatusPedidoCompra, 
)

# Importação dos modelos financeiros do módulo 'financeiro' (R6)
from financeiro.models import ContasAPagar, StatusContasAPagar 

# Importações dos modelos de outros apps
from estoque.models import MovimentoEstoque, ItemMovimentoEstoque
# Importação do serviço contábil (renomeado para clareza)
from contabil.services import criar_lancamento_contabil as criar_lancamento_contabil_partida_dobrada

# Configuração do Logger
logger = logging.getLogger(__name__)

# =========================================================================
# CONSTANTES DE CONTAS
# =========================================================================
CONTA_ESTOQUE = '1.1.0.2.0.1'            
CONTA_FORNECEDORES = '2.1.0.1.0.1'       
CONTA_CAIXA_GERAL = '1.1.0.1.0.1'         
# =========================================================================


# --- SIGNAL 1: Entrada de Estoque, Criação do Passivo (R6) e Contabilização (R7) ---

@receiver(post_save, sender=PedidoCompra)
def criar_movimento_estoque_e_contabilizar_compra(sender, instance, created, **kwargs):
    """
    Cria MovimentoEstoque, registra ContasAPagar (R6) e lança contabilidade (R7).
    """
    if kwargs.get('raw'):
        return

    # Critério de execução: Status de recebimento e movimento não criado (flag de segurança)
    is_received = instance.status in [StatusPedidoCompra.FINALIZADO, StatusPedidoCompra.RECEBIDO_PARCIAL]
    
    if not created and is_received and not instance.movimento_criado:
        
        try:
            with transaction.atomic():
                
                # 1.1. Geração do ContasAPagar
                try:
                    conta_apagar = instance.contas_a_pagar  
                    if conta_apagar.valor_original != instance.total_liquido:
                        conta_apagar.valor_original = instance.total_liquido
                        conta_apagar.save(update_fields=['valor_original'])
                except ContasAPagar.DoesNotExist:
                    ContasAPagar.objects.create(
                        pedido_compra=instance,
                        fornecedor=instance.fornecedor,
                        valor_original=instance.total_liquido,
                        data_vencimento=instance.data_prevista_recebimento or date.today(), 
                        usuario_criacao=instance.responsavel,
                        status=StatusContasAPagar.A_PAGAR 
                    )

                
                total_compra = Decimal('0.00')  
                
                # 2. Cria o cabeçalho do Movimento de Estoque 
                movimento = MovimentoEstoque.objects.create(
                    tipo_movimento='ENTRADA_COMPRA', 
                    observacoes=f"Entrada por Pedido de Compra #{instance.id} - {instance.fornecedor.nome}",
                    data_movimento=timezone.now(),
                    pedido_compra=instance, 
                    responsavel=instance.responsavel, 
                )

                # 3. Processa cada ItemPedidoCompra
                for item_pedido in instance.itens.all():
                    produto = item_pedido.produto
                    quantidade = item_pedido.quantidade_recebida if item_pedido.quantidade_recebida > Decimal('0.00') else item_pedido.quantidade_pedida
                    preco_unitario = item_pedido.preco_unitario_negociado

                    # 3.1 Cria o ItemMovimentoEstoque (dispara o signal de estoque/CMP)
                    ItemMovimentoEstoque.objects.create(
                        movimento=movimento,
                        produto=produto,
                        quantidade_movimentada=quantidade,
                        preco_unitario=preco_unitario
                    )
                    
                    valor_compra = quantidade * preco_unitario
                    total_compra += valor_compra 
                    
                # 4. Lançamento Contábil de Partida Dobrada (CORREÇÃO R7)
                if total_compra > Decimal('0.00'):
                    criar_lancamento_contabil_partida_dobrada(
                        codigo_debito=CONTA_ESTOQUE,
                        codigo_credito=CONTA_FORNECEDORES,
                        valor=total_compra,
                        # NOVO NOME DO ARGUMENTO (R7)
                        descricao_lancamento=f"Entrada de Estoque/Criação de Contas a Pagar ref. Pedido N° {instance.pk}",
                        # HISTÓRICO PARA O LOTE (R7)
                        historico_transacao=f"Registro da entrada de estoque e criação do passivo no Pedido {instance.pk}.",
                        # NOVO CAMPO OBRIGATÓRIO PARA O LOTE (R7)
                        usuario_criacao=instance.responsavel, 
                        pedido_compra=instance 
                    )
                    logger.info(f"SUCESSO CONTÁBIL: Lançamento de Compra N° {instance.pk} registrado. Valor: R$ {total_compra:.2f}")

                # 5. Finaliza a transação: Marca a flag de segurança
                instance.movimento_criado = True
                post_save.disconnect(criar_movimento_estoque_e_contabilizar_compra, sender=PedidoCompra)
                instance.save(update_fields=['movimento_criado']) 
                post_save.connect(criar_movimento_estoque_e_contabilizar_compra, sender=PedidoCompra)
                logger.info(f"Pedido de Compra N° {instance.pk} recebido e estoque/contabilidade atualizados.")

        except Exception as e:
            logger.error(f"ERRO CRÍTICO no signal de Compra {instance.pk}: {e}")
            raise