# ==============================================================================
# ARQUIVO: chefia_erp/estoque/signals.py (CORRIGIDO R1 e R4)
# ==============================================================================
from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from django.db import transaction
from django.db.models import F
from decimal import Decimal
import logging
from datetime import datetime
from django.core.exceptions import ObjectDoesNotExist

# Importa a classe de serviço para o recálculo do CMP
from .services import EstoqueService

# Importa os modelos atualizados (R7)
from .models import (
    ItemMovimentoEstoque, Produto, MovimentoEstoque, CustoProduto,
    # Importando os modelos completos que agora existem em estoque/models.py
    RequisicaoEstoque, AuditoriaInventario, AuditoriaPrePronto, ContagemDiariaFLV
)

logger = logging.getLogger(__name__)

# Garantir que a precisão decimal seja mantida
TRES_CASAS = Decimal('0.001')


# ==============================================================================
# 0. RASTREAMENTO (pre_save) - CRÍTICO PARA R1 (Soft-Delete)
# ==============================================================================
@receiver(pre_save, sender=ItemMovimentoEstoque)
def capture_original_estorno_status(sender, instance, **kwargs):
    """Armazena o estado original de is_estornado antes de salvar (soft-delete)."""
    if instance.pk:
        # Recupera o valor do DB e armazena em um atributo temporário da instância
        try:
            original = ItemMovimentoEstoque.objects.only('is_estornado').get(pk=instance.pk)
            instance._original_is_estornado = original.is_estornado
        except ItemMovimentoEstoque.DoesNotExist:
            instance._original_is_estornado = None
    else:
        instance._original_is_estornado = None


@receiver(post_save, sender=ItemMovimentoEstoque)
@transaction.atomic # Garante que todo o processo seja atômico
def handle_cmp_recalculate_on_save(sender, instance, created, **kwargs):
    """
    Dispara o recálculo do CMP e do Saldo após a criação/modificação de um item de movimento.
    O recálculo deve ser acionado se:
    1. O item for novo (created=True).
    2. O status de is_estornado mudar.
    """
    
    # Condição para recálculo
    is_new = created
    estorno_changed = (
        hasattr(instance, '_original_is_estornado') and 
        instance._original_is_estornado is not None and 
        instance.is_estornado != instance._original_is_estornado
    )
    
    if is_new or estorno_changed:
        # AQUI O RISCO CRÍTICO R1 É MITIGADO PELO select_for_update no Service
        EstoqueService.recalcular_cmp_e_saldo(instance.produto.pk)

# ==============================================================================
# 1. PROCESSAMENTO GERAL DE MOVIMENTOS DE AJUSTE (AUDITORIA/INVENTÁRIO)
# ==============================================================================

@transaction.atomic # Transação atômica para garantir a integridade do ajuste
def processar_movimento_ajuste(instance, origem_nome: str, fk_field_name: str):
    """
    Função helper para criar ou atualizar MovimentoEstoque e ItensMovimentoEstoque
    a partir de um objeto de Auditoria/Contagem (que já está CONCLUIDA).
    """
    produto = instance.produto
    
    # 1. Calcula a diferença (Contado - Sistema)
    diferenca = instance.quantidade_contada - instance.quantidade_sistema
    
    # Se a diferença for zero, não há movimento a ser gerado
    if diferenca == Decimal('0.000'):
        return

    # 2. Determina o tipo de movimento e custo unitário
    custo_unitario = Decimal('0.0000') # Default

    if diferenca > Decimal('0.000'):
        # Entrada: Ajuste Positivo (Inventário)
        tipo_movimento = 'ENTRADA_AJUSTE'
        quantidade_movimentada = diferenca
        
        # 🚨 CORREÇÃO CRÍTICA R4: Forçar Custo no Ajuste de Entrada
        # Se é uma ENTRADA_AJUSTE, o custo unitário deve ser o CMP atual (para não distorcer)
        try:
            custo_produto = CustoProduto.objects.get(produto=produto)
            # Usa o CMP atual para manter a valorização do estoque existente
            custo_unitario = custo_produto.custo_medio_ponderado 
        except CustoProduto.DoesNotExist:
            # Se não tem CMP, o custo é zero
            custo_unitario = Decimal('0.0000')


    elif diferenca < Decimal('0.000'):
        # Saída: Ajuste Negativo (Perda/Quebra)
        tipo_movimento = 'SAIDA_AJUSTE'
        quantidade_movimentada = abs(diferenca)
        
        # Para SAÍDA, o preço é o CMP atual (CMV) - R4 continua
        try:
            custo_produto = CustoProduto.objects.get(produto=produto)
            # Para SAÍDA, o preço unitário é o CMP atual (Custo da Mercadoria Vendida/Baixada)
            custo_unitario = custo_produto.custo_medio_ponderado
        except CustoProduto.DoesNotExist:
            custo_unitario = Decimal('0.0000')
    else:
        return # Já tratado acima, mas para segurança

    # 3. Cria ou Atualiza o MovimentoEstoque Mestre
    movimento, movimento_created = MovimentoEstoque.objects.update_or_create(
        # Busca pelo movimento já criado no registro de auditoria/contagem (via FK)
        # Usa getattr para acessar o campo dinâmico
        pk=getattr(instance, fk_field_name).pk if getattr(instance, fk_field_name) else None,
        defaults={
            'tipo_movimento': tipo_movimento,
            'responsavel': instance.responsavel,
            'observacoes': f"Ajuste de estoque automático via {origem_nome} #{instance.pk}"
        }
    )
    
    # Associa o Movimento de Estoque à instância de Auditoria/Contagem
    setattr(instance, fk_field_name, movimento)
    instance.save(update_fields=[fk_field_name]) # Salva o FK no modelo de Auditoria
    
    # 4. Cria ou Atualiza o ItemMovimentoEstoque
    item_movimento, item_created = ItemMovimentoEstoque.objects.update_or_create(
        movimento=movimento,
        produto=produto,
        defaults={
            'quantidade_movimentada': quantidade_movimentada,
            'preco_unitario': custo_unitario,
        }
    )
    
    logger.info(
        f"Movimento de AJUSTE ({tipo_movimento}) de {origem_nome} {instance.pk} {'criado' if item_created else 'atualizado'}. Diferença: {diferenca}"
    )


@receiver(post_save, sender=AuditoriaInventario)
def criar_movimento_ajuste_inventario(sender, instance, **kwargs):
    """
    Gera MovimentoEstoque (ENTRADA_AJUSTE/SAIDA_AJUSTE) quando AuditoriaInventario é CONCLUIDA.
    """
    if instance.status == 'CONCLUIDA':
        processar_movimento_ajuste(instance, 'Auditoria Inventário', 'movimento_ajuste')


@receiver(post_save, sender=AuditoriaPrePronto)
def criar_movimento_ajuste_pre_pronto(sender, instance, **kwargs):
    """
    Gera MovimentoEstoque (ENTRADA_AJUSTE/SAIDA_AJUSTE) quando AuditoriaPrePronto é CONCLUIDA.
    """
    if instance.status == 'CONCLUIDA':
        processar_movimento_ajuste(instance, 'Auditoria Pré-Pronto', 'movimento_ajuste')


@receiver(post_save, sender=ContagemDiariaFLV)
def criar_movimento_ajuste_contagem_flv(sender, instance, **kwargs):
    """
    Gera MovimentoEstoque (ENTRADA_AJUSTE/SAIDA_AJUSTE) quando ContagemDiariaFLV é CONCLUIDA.
    """
    if instance.status == 'CONCLUIDA':
        processar_movimento_ajuste(instance, 'Contagem Diária FLV', 'movimento_ajuste')