# ARQUIVO: vendas/signals.py (REFATORADO E CORRIGIDO)
# Implementa Lógica Financeira (CMV, Lançamentos), Baixa de Estoque, Comanda Eletrônica e Fluxo de Recebimento

import logging
from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from django.db import transaction, models
from django.db.models import F
from decimal import Decimal
from django.utils import timezone
from django.core.exceptions import ValidationError

# Configuração do Logger
logger = logging.getLogger(__name__)

# Importação dos Modelos
from vendas.models import ItemVenda, Venda, Comanda, ComandaItem, ImpressaoComanda, MetodoPagamento, Cupom 
# Modelos de outros Apps
from estoque.models import ItemMovimentoEstoque, MovimentoEstoque, Produto
from producao.models import OrdemProducao, FichaTecnica
# Importação Contábil
from contabil.models import PlanoConta
from contabil.services import criar_lancamento_contabil as criar_lancamento_contabil_partida_dobrada

# =========================================================================
# CONSTANTES DE CONTAS (USANDO CONSTANTES DO SEU BACKUP)
# =========================================================================
CONTA_RECEITA = '4.1.0.1.0.1' 
CONTA_CMV = '5.1.0.1.0.0'
CONTA_ESTOQUE = '1.1.0.2.0.1'
CONTA_ESTORNO_DEDUCAO = '4.1.0.2.0.1' 
CONTA_CLIENTES = '1.1.0.3.0.0' 
CONTA_CAIXA_GERAL = '1.1.0.1.0.1'
# -------------------------------------------------------------------------

# =========================================================================
# LÓGICA 1: APURAÇÃO DO CUSTO UNITÁRIO DE VENDA (CMV) - pre_save
# =========================================================================

@receiver(pre_save, sender=ItemVenda)
def apurar_custo_na_venda(sender, instance, **kwargs):
    """
    Define o custo_unitario_apurado do ItemVenda usando o Custo Médio Ponderado (CMP)
    APENAS se for um novo item ou se o custo ainda for 0.
    """
    # Verifica se o custo já foi apurado
    if instance.custo_unitario_apurado == Decimal('0.0000'):
        if instance.produto:
            try:
                # Assumindo o campo custo_medio_ponderado existe em estoque.Produto
                # O custo_medio_ponderado é a fonte de CMV
                produto = Produto.objects.only('custo_medio_ponderado').get(pk=instance.produto.pk)
                cmv_unitario = produto.custo_medio_ponderado or Decimal('0.0000') 
                instance.custo_unitario_apurado = cmv_unitario

            except Produto.DoesNotExist:
                instance.custo_unitario_apurado = Decimal('0.0000')
                logger.warning(f"CMV: Produto ID {instance.produto.pk} não encontrado. CMV definido como 0.0000.")


# =========================================================================
# LÓGICA 2: FLUXO BÁSICO: RECALCULA TOTAIS DA VENDA - post_save/post_delete
# =========================================================================

@receiver([post_save, post_delete], sender=ItemVenda)
def recalcular_totais_venda(sender, instance, **kwargs):
    """
    Sinaliza para a Venda recalcular seus totais após a alteração de um item.
    """
    # Chama o método que recalcula e salva os campos de resumo da Venda (definido em models.py)
    try:
        instance.venda.recalcular_totais()
    except Exception as e:
        logger.error(f"Erro ao recalcular totais da Venda {instance.venda.pk}: {e}")

# =========================================================================
# LÓGICA 3: FLUXO CRÍTICO: FATURAMENTO E CONTABILIDADE - post_save
# =========================================================================

@receiver(post_save, sender=Venda)
def automatizar_faturamento_e_contabilidade(sender, instance, created, **kwargs):
    """
    Dispara a baixa de estoque, registra o movimento e gera os lançamentos contábeis
    quando o status muda para FATURADA.
    """
    
    # 1. Condições de Disparo
    if created: return 

    try:
        old_instance = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        return

    is_faturada = (old_instance.status != Venda.Status.FATURADA and instance.status == Venda.Status.FATURADA)
    
    # Executa APENAS se faturou E não tiver gerado movimento de estoque ainda
    if is_faturada and not instance.movimento_estoque_criado:
        
        logger.info(f"Iniciando faturamento e contabilidade para Venda {instance.pk}.")
        
        with transaction.atomic():
            
            # A. Baixa de Estoque e Geração de ItemMovimentoEstoque
            movimento_mestre = None
            total_cmv_apurado = Decimal('0.00')

            for item_venda in instance.itens_venda.all(): # Usando related_name 'itens_venda'
                
                # 1. Acumula CMV
                cmv_item = item_venda.custo_total_cmv
                total_cmv_apurado += cmv_item

                if not movimento_mestre:
                    # 2. Cria o Movimento Mestre (SAIDA_VENDA)
                    movimento_mestre = MovimentoEstoque.objects.create(
                        tipo_movimento='SAIDA_VENDA',
                        venda=instance, 
                        responsavel=instance.atendente,
                    )

                # 3. Cria o ItemMovimentoEstoque (SAÍDA)
                ItemMovimentoEstoque.objects.create(
                    movimento=movimento_mestre,
                    produto=item_venda.produto,
                    quantidade_movimentada=item_venda.quantidade,
                    preco_unitario=item_venda.custo_unitario_apurado 
                )
                
            # B. Geração dos Lançamentos Contábeis
            # O código de contabilidade é extenso, mas vamos garantir que ele use o novo status
            if total_cmv_apurado > 0:
                # 1. D: CMV | C: Estoque
                criar_lancamento_contabil_partida_dobrada(
                    conta_debito_codigo=CONTA_CMV,
                    conta_credito_codigo=CONTA_ESTOQUE,
                    valor=total_cmv_apurado,
                    historico=f"CMV e Baixa de Estoque ref. Venda N° {instance.pk}",
                    content_object=instance
                )
            
            # 2. D: Clientes/Caixa | C: Receita de Vendas (Simplificação)
            criar_lancamento_contabil_partida_dobrada(
                conta_debito_codigo=CONTA_CLIENTES, # ou CONTA_CAIXA_GERAL
                conta_credito_codigo=CONTA_RECEITA,
                valor=instance.total_venda,
                historico=f"Receita Líquida ref. Venda N° {instance.pk}",
                content_object=instance
            )
            
            # C. Marca como criado para evitar reprocessamento
            instance.movimento_estoque_criado = True
            instance.data_faturamento = timezone.now()
            # Usa save(update_fields) para evitar recursão
            instance.save(update_fields=['movimento_estoque_criado', 'data_faturamento']) 
            logger.info(f"Venda {instance.pk} FATURADA e Contabilidade registrada.")


# =========================================================================
# LÓGICA 4: CANCELAMENTO E ESTORNO - post_save
# =========================================================================

@receiver(post_save, sender=Venda)
def automatizar_cancelamento_e_estorno(sender, instance, created, **kwargs):
    """
    Dispara o estorno de estoque e contabilidade quando o status muda para CANCELADA.
    """
    if created: return 

    try:
        old_instance = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        return

    is_canceled = (old_instance.status != Venda.Status.CANCELADA and instance.status == Venda.Status.CANCELADA)
    
    # Executa APENAS se cancelou E se o movimento de estoque já foi criado (era FATURADA)
    if is_canceled and instance.movimento_estoque_criado:
        
        with transaction.atomic():
            
            # 1. Localiza o MovimentoEstoque de SAIDA_VENDA associado
            try:
                movimento_mestre = MovimentoEstoque.objects.get(venda=instance, tipo_movimento='SAIDA_VENDA')
                
                # Deleta o movimento MESTRE. O signal de post_delete em MovimentoEstoque (no app estoque)
                # DEVE garantir o estorno do saldo dos itens de volta ao estoque.
                movimento_mestre.delete()
                
                instance.movimento_estoque_criado = False # Remove o marcador
                
                # 2. Estorno Contábil (Inverte CMV e Receita)
                total_cmv_apurado = instance.custo_total 
                
                if total_cmv_apurado > 0:
                    # Estorno do Custo: D: Estoque | C: CMV
                    criar_lancamento_contabil_partida_dobrada(
                        conta_debito_codigo=CONTA_ESTOQUE, 
                        conta_credito_codigo=CONTA_CMV, 
                        valor=total_cmv_apurado, 
                        historico=f"Estorno do CMV da Venda Cancelada N° {instance.pk}",
                        content_object=instance
                    )

                # Estorno da Receita: D: Estorno/Dedução | C: Contas a Receber
                criar_lancamento_contabil_partida_dobrada(
                    conta_debito_codigo=CONTA_ESTORNO_DEDUCAO,
                    conta_credito_codigo=CONTA_CLIENTES, 
                    valor=instance.total_venda,
                    historico=f"Estorno total da Venda Cancelada N° {instance.pk}",
                    content_object=instance
                )

                instance.save(update_fields=['movimento_estoque_criado', 'data_cancelamento'])
                logger.info(f"Venda {instance.pk} CANCELADA e estornada com sucesso.")

            except MovimentoEstoque.DoesNotExist:
                logger.warning(f"Venda {instance.pk} CANCELADA. Não havia movimento de estoque para estornar.")

# =========================================================================
# LÓGICA 5: CONTABILIZAÇÃO DE PAGAMENTO - post_save
# =========================================================================

@receiver(post_save, sender=MetodoPagamento)
def contabilizar_recebimento_por_metodo(sender, instance, created, **kwargs):
    """
    Contabiliza o recebimento de cada pagamento efetuado.
    Faz a baixa do valor da Venda (Contas a Receber) e debita no Caixa/Banco.
    """
    if created:
        venda = instance.venda
        
        # O recebimento só deve ser contabilizado se a venda estiver FATURADA
        if venda.status != Venda.Status.FATURADA:
             logger.warning(f"Pagamento de Venda {venda.pk} ignorado: Venda não faturada.")
             return
        
        # Lógica de mapeamento de contas (simplificada)
        conta_debito_destino = CONTA_CAIXA_GERAL # Assumido como padrão para Débito (Entrada)
        
        with transaction.atomic():
            # D: Conta de Destino (Caixa/Banco/Cartões - Ativo - Aumenta)
            # C: Clientes (Contas a Receber Geral - Ativo - Diminui)
            criar_lancamento_contabil_partida_dobrada(
                conta_debito_codigo=conta_debito_destino,
                conta_credito_codigo=CONTA_CLIENTES, 
                valor=instance.valor_pago,
                historico=f"Recebimento ({instance.get_tipo_pagamento_display()}) Venda N° {venda.pk}.",
                content_object=venda 
            )
