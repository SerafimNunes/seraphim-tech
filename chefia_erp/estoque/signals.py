# ==============================================================================
# ARQUIVO: chefia_erp/estoque/signals.py (CORRIGIDO R1 e R7)
# ==============================================================================
from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from django.db import transaction
from django.db.models import F
from decimal import Decimal
import logging
from datetime import datetime

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
            instance.__original_is_estornado = original.is_estornado
        except ItemMovimentoEstoque.DoesNotExist:
            instance.__original_is_estornado = False
    else:
        instance.__original_is_estornado = False


# ==============================================================================
# 1. ATUALIZAÇÃO DO ESTOQUE E CUSTO (post_save) - Criação e Estorno (Soft-Delete)
# ==============================================================================
@receiver(post_save, sender=ItemMovimentoEstoque)
def processar_movimento_estoque(sender, instance, created, **kwargs):
    """
    Processa a lógica de estoque/CMP na criação e no estorno (soft-delete).
    """
    item = instance
    produto_pk = item.produto.pk
    movimento_tipo = item.movimento.tipo_movimento

    # --- 1. LÓGICA DE CRIAÇÃO (Novo Item) ---
    if created:
        if movimento_tipo.startswith('ENTRADA'):
            # ENTRADA (Compra/Produção/Ajuste): Aciona o recálculo completo (CMP e Saldo)
            try:
                EstoqueService.recalcular_cmp_e_saldo(produto_pk)
                logger.info(f"CMP e Saldo recalculados na criação de ENTRADA para Produto {produto_pk}.")
            except Exception as e:
                logger.error(f"ERRO CRÍTICO: Falha ao calcular CMP na CRIAÇÃO de Item {item.pk}: {e}")
            
        elif movimento_tipo.startswith('SAIDA'):
            # SAÍDA (Venda/Produção/Ajuste): Apenas subtrai a quantidade
            with transaction.atomic():
                try:
                    # R7 CORREÇÃO: Atualiza o saldo no CustoProduto
                    CustoProduto.objects.filter(produto__pk=produto_pk).update(
                        quantidade_atual=F('quantidade_atual') - item.quantidade_movimentada
                    )
                    logger.debug(
                        f"SAÍDA registrada. Produto {produto_pk}: Qtd -{item.quantidade_movimentada}. CMP não alterado."
                    )
                except Exception as e:
                    logger.error(f"Erro crítico ao atualizar saldo (SAÍDA) para Produto {produto_pk}: {e}")
        else:
            logger.warning(
                f"Movimento {movimento_tipo} não reconhecido para Produto {produto_pk} na CRIAÇÃO. Nenhuma ação executada."
            )

    # --- 2. LÓGICA DE ATUALIZAÇÃO (Estorno por Soft-Delete) ---
    original_is_estornado = getattr(instance, '__original_is_estornado', False)
    
    # Condição R1: O campo is_estornado mudou de False para True
    if not created and not original_is_estornado and instance.is_estornado:
        logger.warning(f"Estorno de ItemMovimentoEstoque ID {item.pk} detectado (soft-delete).")
        
        if movimento_tipo.startswith('ENTRADA'):
            # SOLUÇÃO R1: Recalcula o CMP a partir de todos os itens *não estornados*
            try:
                EstoqueService.recalcular_cmp_e_saldo(produto_pk=produto_pk)
                logger.info(f"R1 CONCLUÍDA: Estorno de ENTRADA para Produto {produto_pk} via soft-delete. CMP e Saldo RECALCULADOS.")
            except Exception as e:
                logger.error(f"ERRO CRÍTICO R1: Falha ao recalcular CMP após estorno (soft-delete) para Produto {produto_pk}: {e}")

        elif movimento_tipo.startswith('SAIDA'):
            # Reversão de SAÍDA: A quantidade deve ser revertida (somada de volta)
            with transaction.atomic():
                try:
                    # R7 CORREÇÃO: Atualiza o saldo no CustoProduto
                    CustoProduto.objects.filter(produto__pk=produto_pk).update(
                        quantidade_atual=F('quantidade_atual') + item.quantidade_movimentada
                    )
                    logger.info(f"Estorno de SAÍDA para Produto {produto_pk}. Qtd revertida com sucesso (soft-delete).")
                except Exception as e:
                    logger.error(f"Erro ao estornar estoque para Produto {produto_pk} (SAÍDA): {e}")


# ==============================================================================
# 2. ESTORNO/REVERSÃO DO ESTOQUE (post_delete) - Hard-Delete
# ==============================================================================
@receiver(post_delete, sender=ItemMovimentoEstoque)
def estornar_estoque_apos_delecao(sender, instance, **kwargs):
    """
    Roda quando um ItemMovimentoEstoque é DELETADO (Hard-Delete).
    """
    
    produto_pk = instance.produto.pk
    quantidade_movimentada = instance.quantidade_movimentada
    movimento_tipo = instance.movimento.tipo_movimento
    
    if movimento_tipo.startswith('ENTRADA'):
        # RESOLUÇÃO R1: Hard-Delete. Recalcula o CMP e Saldo do zero.
        try:
            EstoqueService.recalcular_cmp_e_saldo(produto_pk=produto_pk)
            logger.info(
                f"R1 CONCLUÍDA: Estorno de ENTRADA para Produto {produto_pk} via hard-delete. CMP e Saldo RECALCULADOS."
            )
        except Exception as e:
            logger.error(f"ERRO CRÍTICO R1: Falha ao recalcular CMP para o Produto {produto_pk} após estorno (hard-delete): {e}")
            
    elif movimento_tipo.startswith('SAIDA'):
        # Hard-Delete de SAÍDA: Soma a quantidade de volta.
        operacao_quantidade = F('quantidade_atual') + quantidade_movimentada
        with transaction.atomic():
            try:
                # R7 CORREÇÃO: Atualiza o saldo no CustoProduto
                CustoProduto.objects.filter(produto__pk=produto_pk).update(quantidade_atual=operacao_quantidade)
            
                logger.info(
                    f"Estorno de SAÍDA para Produto {produto_pk}. Qtd revertida com sucesso (hard-delete)."
                )
            except Exception as e:
                logger.error(f"Erro ao estornar estoque para Produto {produto_pk}: {e}")


# ==============================================================================
# 3. SINAIS DE FLUXO (GATILHOS DE CRIAÇÃO DE MOVIMENTO)
# ==============================================================================

@receiver(post_save, sender=RequisicaoEstoque)
def criar_movimento_saida_por_requisicao(sender, instance, created, **kwargs):
    """
    Gera ou atualiza um MovimentoEstoque (SAIDA_PRODUCAO) quando a requisição é atendida.
    """
    # Apenas processa se o status for ATENDIDA/PARCIAL e houver quantidade para movimentar
    if instance.status in ['ATENDIDA', 'PARCIAL'] and instance.quantidade_entregue > Decimal('0.000'):
        
        with transaction.atomic():
            # R7 CORREÇÃO: Pega o CMP do CustoProduto
            custo_produto = EstoqueService._get_or_create_custo_produto(instance.produto.pk)
            
            # 1. Cria ou recupera o Movimento de Estoque (Cabeçalho)
            if instance.movimento_saida:
                movimento = instance.movimento_saida
                movimento.tipo_movimento = 'SAIDA_PRODUCAO' 
                movimento.observacoes = f"Atualização de Saída (Requis. ID {instance.pk}) para Produção."
                # Define o usuário responsável (se a instância tiver o campo)
                movimento.responsavel = instance.responsavel_atendimento if instance.responsavel_atendimento else instance.solicitante 
                movimento.save()
            else:
                movimento = MovimentoEstoque.objects.create(
                    tipo_movimento='SAIDA_PRODUCAO',
                    observacoes=f"Saída de Estoque gerada pela Requisição ID {instance.pk}.",
                    responsavel=instance.responsavel_atendimento if instance.responsavel_atendimento else instance.solicitante
                )
                instance.movimento_saida = movimento
                # Não salva aqui, para evitar loop, salva no final do bloco.
            
            # O custo unitário da saída deve ser sempre o CMP atual
            custo_saida = custo_produto.custo_medio_ponderado.quantize(Decimal('0.0000'))
            quantidade_saida = instance.quantidade_entregue.quantize(TRES_CASAS)


            # 2. Cria ou atualiza o ItemMovimentoEstoque (Detalhe)
            item_movimento, item_created = ItemMovimentoEstoque.objects.update_or_create(
                movimento=movimento,
                produto=instance.produto,
                defaults={
                    'quantidade_movimentada': quantidade_saida,
                    'preco_unitario': custo_saida,
                    'is_estornado': False, # Garante que se um item foi re-atendido, ele não está estornado
                }
            )
            
            # Se a requisição não tinha MovimentoEstoque (created=True), salve agora
            if not hasattr(instance, 'movimento_saida') or instance.movimento_saida is None:
                instance.movimento_saida = movimento
                instance.save(update_fields=['movimento_saida'])
            
            logger.info(
                f"Movimento de SAÍDA (Requisição {instance.pk}) {'criado' if item_created else 'atualizado'}. Qtd: {quantidade_saida}, Custo: {custo_saida}"
            )


def processar_movimento_ajuste(instance, origem_nome, fk_field):
    """
    Função helper para criar ou atualizar MovimentoEstoque (AJUSTE)
    para modelos de Auditoria e Contagem.
    """
    with transaction.atomic():
        try:
            produto = Produto.objects.select_for_update().get(pk=instance.produto.pk)
            # R7 CORREÇÃO: Obtém o objeto CustoProduto
            custo_produto = EstoqueService._get_or_create_custo_produto(produto.pk) 
        except Produto.DoesNotExist:
            logger.error(f"Produto {instance.produto.pk} não encontrado durante o ajuste.")
            return

        # 1. Calcula a diferença e o tipo de movimento
        quantidade_contada = instance.quantidade_contada.quantize(TRES_CASAS)
        quantidade_sistema = custo_produto.quantidade_atual.quantize(TRES_CASAS)
        diferenca = quantidade_contada - quantidade_sistema
        
        # Só processa se houver diferença e o status for CONCLUIDA
        if diferenca == Decimal('0.000') or instance.status != 'CONCLUIDA':
            return
            
        if diferenca > Decimal('0.000'):
            tipo_movimento = 'ENTRADA_AJUSTE'
            quantidade_movimentada = diferenca
        else:
            tipo_movimento = 'SAIDA_AJUSTE'
            # A quantidade movimentada é o valor absoluto da diferença negativa
            quantidade_movimentada = abs(diferenca)
            
        # 2. Cria ou recupera o Movimento de Estoque (Cabeçalho)
        movimento_atual = getattr(instance, fk_field, None)
        
        if movimento_atual:
            movimento = movimento_atual
            movimento.tipo_movimento = tipo_movimento
            movimento.observacoes = f"Atualização de Ajuste ({origem_nome} ID {instance.pk}). Diferença: {diferenca}"
            movimento.responsavel = instance.responsavel 
            movimento.save()
        else:
            movimento = MovimentoEstoque.objects.create(
                tipo_movimento=tipo_movimento,
                observacoes=f"Ajuste de Estoque gerado por {origem_nome} ID {instance.pk}. Diferença: {diferenca}",
                responsavel=instance.responsavel
            )
            # Vincula o movimento à instância de origem
            setattr(instance, fk_field, movimento)
            instance.data_conclusao = datetime.now()
            instance.quantidade_sistema = quantidade_sistema # Captura o saldo do sistema no momento da conclusão
            instance.save(update_fields=[fk_field, 'data_conclusao', 'quantidade_sistema'])
        
        # 3. Determina o custo unitário do movimento
        # Custo de Ajuste = CMP atual do produto
        custo_unitario = custo_produto.custo_medio_ponderado.quantize(Decimal('0.0000')) 

        # 4. Cria ou atualiza o ItemMovimentoEstoque (Detalhe)
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
def criar_movimento_ajuste_flv(sender, instance, **kwargs):
    """
    Gera MovimentoEstoque (ENTRADA_AJUSTE/SAIDA_AJUSTE) quando ContagemDiariaFLV é CONCLUIDA.
    """
    if instance.status == 'CONCLUIDA':
        processar_movimento_ajuste(instance, 'Contagem Diária FLV', 'movimento_ajuste')