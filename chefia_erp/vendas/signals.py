# ARQUIVO: vendas/signals.py (COMPLETO E CORRIGIDO R8/R9)

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

# --- IMPORTAÇÃO DE TASK (MANTIDA PARA LÓGICA R9 FUTURA, MAS NÃO USADA AQUI) ---
# A task processar_faturamento_venda não será mais chamada neste signal.
# from .tasks import processar_faturamento_venda 
# --- FIM NOVO IMPORT ---

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
# (MANTIDA como camada de integridade/fallback)
# =========================================================================

@receiver(pre_save, sender=ItemVenda)
def apurar_custo_na_venda(sender, instance, **kwargs):
    """
    Define o custo_unitario_apurado do ItemVenda usando o Custo Médio Ponderado (CMP).
    O VendaService já faz isso, mas mantemos para garantir a integridade.
    """
    # Se o custo já foi apurado pelo Service, ou se não há produto, ignorar.
    if instance.custo_unitario_apurado == Decimal('0.0000') and instance.produto:
        try:
            # Assumindo o campo custo_medio_ponderado existe em estoque.Produto (ou proxy)
            produto = Produto.objects.only('custo_medio_ponderado').get(pk=instance.produto.pk)
            cmv_unitario = produto.custo_medio_ponderado or Decimal('0.0000') 
            instance.custo_unitario_apurado = cmv_unitario

        except Produto.DoesNotExist:
            instance.custo_unitario_apurado = Decimal('0.0000')
            logger.warning(f"CMV: Produto ID {instance.produto.pk} não encontrado. CMV definido como 0.0000.")


# =========================================================================
# LÓGICA 2: RECALCULA TOTAIS DA VENDA - post_save/post_delete
# (REMOVIDA: A lógica foi movida para o VendaService para melhor performance/atomicidade)
# =========================================================================
# A chamada a instance.venda.recalcular_totais() deve ser feita AGORA no VendaService
# APÓS todos os ItemVenda serem criados.


# =========================================================================
# LÓGICA 3: FLUXO CRÍTICO: FATURAMENTO E CONTABILIDADE
# (REMOVIDA: O disparo da task assíncrona foi movido para o VendaService)
# =========================================================================
# O VendaService agora é responsável por:
# 1. Criar a Venda e os Itens de forma ATÔMICA (R8).
# 2. DISPARAR a task processar_faturamento_venda.delay(instance.pk) para R9.


# =========================================================================
# LÓGICA 4: CANCELAMENTO E ESTORNO - post_save
# (MANTIDA: Reação limpa à mudança de status - usa atomicidade corretamente)
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
                # O VendaService garante que a Venda tenha MovimentoEstoque associado
                movimento_mestre = MovimentoEstoque.objects.get(venda=instance, tipo_movimento='SAIDA_VENDA')
                
                # Deleta o movimento MESTRE. O signal de post_delete em MovimentoEstoque 
                # garante o estorno do saldo (Lógica R1)
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
# (MANTIDA: Reação limpa à criação de pagamento - usa atomicidade corretamente)
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