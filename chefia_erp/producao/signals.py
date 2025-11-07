from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from decimal import Decimal

# Importa os modelos NECESSÁRIOS para os decoradores @receiver (sender=Modelo)
from .models import (
    FichaTecnica, 
    ItemFichaTecnica, 
    OrdemProducao, 
    RequisicaoInsumo,
    # 🚨 CORREÇÃO DO ERRO: ItemRequisicao precisa ser importado
    ItemRequisicao 
)

# 🚨 Importa os serviços
from .services import (
    calcular_e_atualizar_custo_item_ft,
    recalcular_custo_ficha_tecnica,
    criar_requisicao_e_sugestao_compra,
    registrar_entrada_producao_concluida,
    processar_atendimento_e_saida_estoque
)


# =========================================================
# LÓGICA 1: CÁLCULO DE CUSTO NA FICHA TÉCNICA
# (Delegado para Services)
# =========================================================

@receiver(post_save, sender=ItemFichaTecnica)
def handle_custo_item_e_mestre(sender, instance, created, **kwargs):
    """
    Acionado ao salvar ItemFichaTecnica. Calcula o custo parcial e
    dispara o recálculo do mestre via Service.
    """
    # Garante que a FichaTecnica Mestre esteja sempre atualizada
    ficha_tecnica = FichaTecnica.objects.get(pk=instance.ficha_tecnica.pk)
    calcular_e_atualizar_custo_item_ft(instance, ficha_tecnica)


@receiver(post_delete, sender=ItemFichaTecnica)
def handle_recalcular_custo_apos_delete(sender, instance, **kwargs):
    """Garante que o custo total seja recalculado após a exclusão de um item."""
    if FichaTecnica.objects.filter(pk=instance.ficha_tecnica.pk).exists():
        recalcular_custo_ficha_tecnica(instance.ficha_tecnica)


# =========================================================
# LÓGICA 2 & 4: AUTOMATIZAÇÕES DA ORDEM DE PRODUÇÃO (OP)
# (Delegado para Services)
# =========================================================

@receiver(post_save, sender=OrdemProducao)
def handle_automatizacao_ordem_producao(sender, instance, created, **kwargs):
    """
    Gerencia a criação de Requisição (Lógica 2/5) e a Entrada de Estoque (Lógica 4),
    delegando a complexidade para os Services.
    """
    # --- Geração da Requisição e Sugestão de Compra (LÓGICA 2 & 5) ---
    if created and instance.status == 'ABERTA':
        criar_requisicao_e_sugestao_compra(instance)

    # --- Registro da Produção Concluída (LÓGICA 4) ---
    elif not created and instance.status == 'CONCLUIDA':
        registrar_entrada_producao_concluida(instance)


# =========================================================
# LÓGICA DE USABILIDADE: AUTO-PREENCHIMENTO
# =========================================================

@receiver(post_save, sender=ItemRequisicao)
def ajustar_quantidade_atendida_default(sender, instance, created, **kwargs):
    """
    Se Quantidade Atendida for deixada em zero ou nula (default),
    preenche automaticamente com a Quantidade Solicitada.
    """
    # É CRÍTICO desconectar e reconectar o signal para evitar loop de save
    post_save.disconnect(ajustar_quantidade_atendida_default, sender=ItemRequisicao)

    item_atual = instance # O item já vem do banco ou está sendo criado/salvo

    if (item_atual.quantidade_atendida is None or item_atual.quantidade_atendida <= Decimal('0.000')) \
       and item_atual.quantidade_solicitada > Decimal('0.000'):

        # Atualiza o campo com a quantidade solicitada
        ItemRequisicao.objects.filter(pk=item_atual.pk).update(
            quantidade_atendida=item_atual.quantidade_solicitada
        )

    post_save.connect(ajustar_quantidade_atendida_default, sender=ItemRequisicao)


# =========================================================
# LÓGICA 3: ATENDIMENTO DA REQUISIÇÃO (BAIXA DE ESTOQUE - SAÍDA)
# (Delegado para Service)
# =========================================================

@receiver(post_save, sender=RequisicaoInsumo)
def handle_atender_requisicao_e_baixar_estoque(sender, instance, created, **kwargs):
    """
    Quando uma Requisição de Insumo muda para o status de ATENDIDA,
    dispara o Service para criar o MovimentoEstoque de SAÍDA e atualizar a OP.
    """
    if not created and instance.status == 'ATENDIDA':
        processar_atendimento_e_saida_estoque(instance)