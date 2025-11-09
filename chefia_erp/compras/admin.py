# ==============================================================================
# ARQUIVO: compras/admin.py (COMPLETO E CORRIGIDO)
# R3: save_model removido. Confia na propriedade do modelo para o cálculo do total.
# ==============================================================================
from django.contrib import admin
from django.utils.html import format_html 
from .models import PedidoCompra, ItemPedidoCompra
from decimal import Decimal

# Helper para formatação
QUATRO_CASAS = Decimal('0.0000')

# =========================================================
# ITENS DO PEDIDO (INLINE)
# =========================================================

class ItemPedidoCompraInline(admin.TabularInline):
    model = ItemPedidoCompra
    extra = 1 
    
    # Campo readonly que exibe o total (calculado no modelo)
    readonly_fields = ('valor_total_item_formatado',) 
    
    fields = (
        'produto', 
        'quantidade_pedida', 
        'quantidade_recebida', # Incluído para facilitar o recebimento
        'preco_unitario_negociado',
        'valor_total_item_formatado'
    )
    
    def valor_total_item_formatado(self, obj):
        """Formata a propriedade valor_total_item do modelo como moeda com 4 casas."""
        # Usa a propriedade que definimos no ItemPedidoCompra (R3)
        total = obj.valor_total_item if obj.valor_total_item is not None else Decimal('0.0000')
        return format_html('<span style="white-space: nowrap;">R$ {:,.4f}</span>', total.quantize(QUATRO_CASAS))
    
    valor_total_item_formatado.short_description = 'Valor Total Item'

# =========================================================
# PEDIDO DE COMPRA (ADMIN)
# =========================================================

@admin.register(PedidoCompra)
class PedidoCompraAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'fornecedor', 'data_emissao', 'valor_total_formatado_list', 'status', 'responsavel')
    list_filter = ('status', 'data_emissao', 'fornecedor')
    search_fields = ('fornecedor__nome', 'pk')
    
    # NOVOS: Inclui campos de rastreamento (R1)
    readonly_fields = ('data_emissao', 'valor_total_formatado_detail', 'movimento_criado') 
    
    fieldsets = (
        (None, {
            'fields': ('fornecedor', 'status', 'responsavel', 'observacoes')
        }),
        ('Datas e Valores', {
            'fields': ('data_emissao', 'data_entrega_prevista', 'valor_total_formatado_detail')
        }),
        ('Rastreamento', {
            'fields': ('movimento_criado',),
            'classes': ('collapse',)
        })
    )
    
    inlines = [ItemPedidoCompraInline]
    
    # Método para formatar o valor total para exibição na listagem (list_display)
    # Formatação de 2 casas é mantida SÓ para exibição
    def valor_total_formatado_list(self, obj):
        """Formata a propriedade valor_total do modelo como moeda para a listagem."""
        total = obj.valor_total if obj.valor_total is not None else Decimal('0.00')
        return format_html('R$ {:,.2f}', total)
    
    valor_total_formatado_list.short_description = 'Valor Total'

    # Método para formatar o valor total para exibição no formulário (readonly_fields)
    # Formatação de 2 casas é mantida SÓ para exibição
    def valor_total_formatado_detail(self, obj):
        """Formata a propriedade valor_total do modelo como moeda para o detalhe."""
        total = obj.valor_total if obj.valor_total is not None else Decimal('0.00')
        return format_html('<span style="font-weight: bold; font-size: 1.2em; white-space: nowrap;">R$ {:,.2f}</span>', total)
    
    valor_total_formatado_detail.short_description = 'Valor Total'
    
    # 🚨 CORREÇÃO R3: O save_model foi removido. 
    # O cálculo agora está no método save() do modelo (models.py)
    # Isso garante que APIs e outras chamadas também tenham o valor_total atualizado.
    
# Não há mais necessidade de registrar Fornecedor, assumindo que já está em 'core/admin.py'
# @admin.register(Fornecedor) <- Linha removida