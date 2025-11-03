# estoque/signals.py (CÓDIGO CENTRAL DE ATUALIZAÇÃO DE SALDO E CMP)
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db import transaction
from django.db.models import F
from decimal import Decimal
import logging

# Importa os modelos do próprio app (Atualizado com novos modelos)
from .models import (
    ItemMovimentoEstoque, Produto, MovimentoEstoque,
    RequisicaoEstoque, AuditoriaInventario, AuditoriaPrePronto, ContagemDiariaFLV
)

# Configuração do Logger
logger = logging.getLogger(__name__)
# Garantir que a precisão decimal seja mantida
QUATRO_CASAS = Decimal('0.0000')
TRES_CASAS = Decimal('0.000')

# ==============================================================================
# 1. ATUALIZAÇÃO DO ESTOQUE E CUSTO (post_save) - Centraliza a lógica de Entrada/Saída
# [Lógica existente de CMP mantida intacta]
# ==============================================================================
@receiver(post_save, sender=ItemMovimentoEstoque)
def atualizar_estoque_e_custo_apos_movimento(sender, instance, created, **kwargs):
    """
    Roda APENAS na criação de um ItemMovimentoEstoque.
    1. Ajusta o saldo do Produto (quantidade_atual).
    2. Recalcula o Custo Médio Ponderado (CMP) se for ENTRADA.
    """
    # Garante que a lógica só rode para novas criações
    if not created:
        return

    item = instance
    produto_pk = item.produto.pk
    quantidade_movimentada = item.quantidade_movimentada
    movimento_tipo = item.movimento.tipo_movimento
    
    with transaction.atomic():
        try:
            # 1. Busca e BLOQUEIA o Produto para evitar condições de corrida (CMP)
            produto = Produto.objects.select_for_update().get(pk=produto_pk)
            
            campos_para_atualizar = ['quantidade_atual']
            
            # 2. Determina a direção do movimento e recalcula o CMP se for ENTRADA
            if movimento_tipo.startswith('ENTRADA'):
                # --- LÓGICA CRÍTICA DE CUSTO MÉDIO PONDERADO (CMP) ---
                custo_entrada = item.preco_unitario or Decimal('0.0000')
                quantidade_atual_antiga = produto.quantidade_atual or Decimal('0') # Utiliza o campo de alta precisão
                custo_medio_antigo = produto.custo_medio_ponderado or Decimal('0.0000')
                
                novo_estoque = quantidade_atual_antiga + quantidade_movimentada
                
                if novo_estoque > 0:
                    valor_total_antigo = quantidade_atual_antiga * custo_medio_antigo
                    valor_total_entrada = quantidade_movimentada * custo_entrada
                    
                    # Fórmula do CMP
                    novo_cmp = (valor_total_antigo + valor_total_entrada) / novo_estoque
                    
                    # 🚨 ATUALIZAÇÃO: Salva o valor em ambos os campos
                    novo_cmp_precisao = novo_cmp.quantize(QUATRO_CASAS)
                    
                    # 1. Valor de alta precisão (para cálculos futuros)
                    produto.custo_medio_ponderado = novo_cmp_precisao
                    campos_para_atualizar.append('custo_medio_ponderado')
                    
                    # 2. Valor arredondado (para exibição e campos de custo com 2 casas)
                    produto.preco_custo = novo_cmp_precisao.quantize(Decimal('0.00'))
                    campos_para_atualizar.append('preco_custo')
                    
                    logger.info(
                        f"CMP ATUALIZADO (Entrada) p/ Produto {produto_pk}: Novo CMP {produto.custo_medio_ponderado}, Preço Custo R$ {produto.preco_custo}"
                    )

                # Atualiza a quantidade
                produto.quantidade_atual += quantidade_movimentada
                
            elif movimento_tipo.startswith('SAIDA'):
                # --- LÓGICA DE SAÍDA (Apenas Baixa Quantidade, Mantém o CMP) ---
                produto.quantidade_atual -= quantidade_movimentada
                
                logger.debug(
                    f"SAÍDA registrada. Produto {produto_pk}: Qtd -{quantidade_movimentada}. CMP não alterado."
                )
            else:
                logger.warning(
                    f"Movimento {movimento_tipo} não reconhecido para Produto {produto_pk}. Nenhuma ação executada."
                )
                return

            # 3. Salva a instância (UPDATE) com os campos atualizados dentro da transação
            produto.save(update_fields=campos_para_atualizar)
            
        except Produto.DoesNotExist:
            logger.error(f"Erro: Produto ID {produto_pk} não existe no banco de dados.")
        except Exception as e:
            logger.error(f"Erro crítico ao atualizar estoque/custo para Produto {produto_pk}: {e}")
            raise # Re-lança para forçar o rollback da transação

# ==============================================================================
# 2. ESTORNO/REVERSÃO DO ESTOQUE (post_delete)
# [Lógica existente de Estorno mantida intacta]
# ==============================================================================
@receiver(post_delete, sender=ItemMovimentoEstoque)
def estornar_estoque_apos_delecao(sender, instance, **kwargs):
    """
    Roda quando um ItemMovimentoEstoque é deletado.
    Apenas reverte a quantidade. O CMP não é recalculado em estornos por complexidade financeira.
    """
    
    produto_pk = instance.produto.pk
    quantidade_movimentada = instance.quantidade_movimentada
    movimento_tipo = instance.movimento.tipo_movimento
    
    operacao_quantidade = None
    
    # Inverte a direção do movimento original (usa F() para atomicidade no UPDATE)
    if movimento_tipo.startswith('ENTRADA'):
        # Era ENTRADA (somou), a exclusão deve subtrair
        operacao_quantidade = F('quantidade_atual') - quantidade_movimentada
        logger.warning(
            f"Estorno de ENTRADA para Produto {produto_pk}. Qtd revertida. ATENÇÃO: CMP Fica distorcido."
        )
    elif movimento_tipo.startswith('SAIDA'):
        # Era SAÍDA (subtraiu), a exclusão deve somar
        operacao_quantidade = F('quantidade_atual') + quantidade_movimentada
        logger.info(
            f"Estorno de SAÍDA para Produto {produto_pk}. Qtd revertida com sucesso."
        )

    if operacao_quantidade is None:
        return

    # Atualização atômica da quantidade
    with transaction.atomic():
        try:
            Produto.objects.filter(pk=produto_pk).update(quantidade_atual=operacao_quantidade)
        except Exception as e:
            logger.error(f"Erro ao estornar estoque para Produto {produto_pk}: {e}")
            
# ==============================================================================
# 3. SINAIS DE FLUXO (GATILHOS DE CRIAÇÃO DE MOVIMENTO) - FASE 2.3 - IMPLEMENTAÇÃO
# ==============================================================================

@receiver(post_save, sender=RequisicaoEstoque)
def criar_movimento_saida_por_requisicao(sender, instance, created, **kwargs):
    """
    Gera ou atualiza um MovimentoEstoque (SAIDA_PRODUCAO) quando a requisição é atendida.
    """
    # Apenas processa se o status for ATENDIDA (ou PARCIAL) e houver quantidade para movimentar
    if instance.status in ['ATENDIDA', 'PARCIAL'] and instance.quantidade_entregue > Decimal('0.000'):
        
        with transaction.atomic():
            produto = Produto.objects.select_for_update().get(pk=instance.produto.pk)
            
            # Determina a quantidade a ser movimentada (Saída)
            quantidade_saida = instance.quantidade_entregue.quantize(TRES_CASAS)
            
            # 1. Cria ou recupera o Movimento de Estoque (Cabeçalho)
            if instance.movimento_saida:
                movimento = instance.movimento_saida
                movimento.tipo_movimento = 'SAIDA_PRODUCAO' # Garante a consistência
                movimento.observacoes = f"Atualização de Saída (Requis. ID {instance.pk}) para Produção."
                movimento.save()
            else:
                movimento = MovimentoEstoque.objects.create(
                    tipo_movimento='SAIDA_PRODUCAO',
                    observacoes=f"Saída de Estoque gerada pela Requisição ID {instance.pk}.",
                )
                instance.movimento_saida = movimento
                instance.save(update_fields=['movimento_saida'])
            
            # O custo da saída deve ser sempre o CMP atual do produto
            custo_saida = produto.custo_medio_ponderado.quantize(QUATRO_CASAS)

            # 2. Cria ou atualiza o ItemMovimentoEstoque (Detalhe)
            item_movimento, item_created = ItemMovimentoEstoque.objects.update_or_create(
                movimento=movimento,
                produto=produto,
                defaults={
                    'quantidade_movimentada': quantidade_saida,
                    'preco_unitario': custo_saida,
                }
            )
            
            logger.info(
                f"Movimento de SAÍDA (Requisição {instance.pk}) {'criado' if item_created else 'atualizado'}. Qtd: {quantidade_saida}, Custo: {custo_saida}"
            )


def processar_movimento_ajuste(instance, tipo_ajuste):
    """
    Função helper para criar ou atualizar MovimentoEstoque (AJUSTE)
    para modelos de Auditoria e Contagem.
    """
    with transaction.atomic():
        produto = Produto.objects.select_for_update().get(pk=instance.produto.pk)
        
        # 1. Calcula a diferença e o tipo de movimento
        quantidade_contada = instance.quantidade_contada.quantize(TRES_CASAS)
        quantidade_atual = produto.quantidade_atual.quantize(TRES_CASAS)
        diferenca = quantidade_contada - quantidade_atual
        
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
            
        # 2. Determina o campo FK OneToOne para vincular o Movimento
        if isinstance(instance, AuditoriaInventario):
            fk_field = 'auditoria_inventario_origem'
            origem_nome = 'Auditoria Inventário'
        elif isinstance(instance, AuditoriaPrePronto):
            fk_field = 'auditoria_pre_pronto_origem'
            origem_nome = 'Auditoria Pré-Pronto'
        elif isinstance(instance, ContagemDiariaFLV):
            fk_field = 'contagem_flv_origem'
            origem_nome = 'Contagem Diária FLV'
        else:
            logger.error(f"Tipo de instância não suportado para ajuste: {type(instance)}")
            return

        # 3. Cria ou recupera o Movimento de Estoque (Cabeçalho)
        movimento_atual = getattr(instance, fk_field)
        
        if movimento_atual:
            movimento = movimento_atual
            movimento.tipo_movimento = tipo_movimento
            movimento.observacoes = f"Atualização de Ajuste ({origem_nome} ID {instance.pk}). Diferença: {diferenca}"
            movimento.save()
        else:
            movimento = MovimentoEstoque.objects.create(
                tipo_movimento=tipo_movimento,
                observacoes=f"Ajuste de Estoque gerado por {origem_nome} ID {instance.pk}. Diferença: {diferenca}",
            )
            # Vincula o movimento à instância de origem
            setattr(instance, fk_field, movimento)
            instance.save(update_fields=[fk_field])
        
        # 4. Determina o custo unitário do movimento
        if tipo_movimento.startswith('ENTRADA'):
            # Para ENTRADA_AJUSTE, o custo é zero (ajuste puramente quantitativo) ou o custo de compra se conhecido.
            # Por padrão em inventário cego, mantemos o CMP atual ou usamos 0.0000 para forçar o recálculo do CMP.
            # Usaremos o CMP atual como custo para valorizar a entrada, e o signal 1 recalcula.
            custo_unitario = produto.custo_medio_ponderado.quantize(QUATRO_CASAS)
        else:
            # Para SAIDA_AJUSTE, o custo é o CMP atual do produto (saída valorizada)
            custo_unitario = produto.custo_medio_ponderado.quantize(QUATRO_CASAS)

        # 5. Cria ou atualiza o ItemMovimentoEstoque (Detalhe)
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
        processar_movimento_ajuste(instance, 'AuditoriaInventario')


@receiver(post_save, sender=AuditoriaPrePronto)
def criar_movimento_ajuste_pre_pronto(sender, instance, **kwargs):
    """
    Gera MovimentoEstoque (ENTRADA_AJUSTE/SAIDA_AJUSTE) quando AuditoriaPrePronto é CONCLUIDA.
    """
    if instance.status == 'CONCLUIDA':
        processar_movimento_ajuste(instance, 'AuditoriaPrePronto')


@receiver(post_save, sender=ContagemDiariaFLV)
def criar_movimento_ajuste_flv(sender, instance, **kwargs):
    """
    Gera MovimentoEstoque (ENTRADA_AJUSTE/SAIDA_AJUSTE) quando ContagemDiariaFLV é CONCLUIDA.
    """
    if instance.status == 'CONCLUIDA':
        processar_movimento_ajuste(instance, 'ContagemDiariaFLV')
