# ARQUIVO: vendas/utils.py
# Arquivo utilitário para funções auxiliares complexas de Vendas.

from django.db.models import Sum, F, DecimalField # Importamos DecimalField para garantir precisão
from decimal import Decimal

def recalcular_totais_venda(venda):
    """
    Recalcula o subtotal, total_venda, custo_total e outros campos de resumo da Venda.
    (Lógica centralizada para uso em models, signals e views).
    """
    
    # 1. Recalcula Subtotal (Soma dos itens sem descontos) e Custo Total (CMV)
    # Assumindo que o related_name de ItemVenda para Venda é 'itens_venda'
    
    totais = venda.itens_venda.aggregate(
        # Calcula o subtotal dos itens (Preço * Qtd)
        subtotal_itens=Sum(F('quantidade') * F('preco_unitario'), output_field=DecimalField()),
        # Calcula o CMV total (Custo * Qtd)
        custo_total_cmv=Sum(F('quantidade') * F('custo_unitario_apurado'), output_field=DecimalField())
    )

    subtotal = totais.get('subtotal_itens') or Decimal('0.00')
    custo_total = totais.get('custo_total_cmv') or Decimal('0.00')
    
    # 2. Cálculo dos totais
    valor_servico = venda.valor_servico or Decimal('0.00')
    desconto_aplicado = venda.desconto_aplicado or Decimal('0.00')

    total_venda = subtotal - desconto_aplicado + valor_servico
    
    # 3. Atualiza os atributos da instância Venda
    venda.subtotal = subtotal
    venda.custo_total = custo_total
    venda.total_venda = total_venda 
    
    # A função chamadora (o método Venda.recalcular_totais) é responsável por salvar a instância.
    
    return venda
