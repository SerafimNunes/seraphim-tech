# compras/admin.py
from django.contrib import admin
from django.utils.html import format_html # Importação necessária para formatar moeda
from .models import Fornecedor, PedidoCompra, ItemPedidoCompra
from decimal import Decimal # Necessário para garantir a precisão no display

'''@admin.register(Fornecedor)
class FornecedorAdmin(admin.ModelAdmin):
    list_display = ('nome', 'cnpj', 'telefone', 'email')
    search_fields = ('nome', 'cnpj')
'''

class ItemPedidoCompraInline(admin.TabularInline):
    model = ItemPedidoCompra
    extra = 1 # Quantidade de linhas extras para adicionar

    # O campo 'valor_total_item' é a propriedade do modelo. 
    # Usaremos um método customizado para formatá-lo como moeda.
    readonly_fields = ('valor_total_item_formatado',) 
    
    fields = (
        'produto', 
        'quantidade_pedida', 
        'preco_unitario_negociado',
        'valor_total_item_formatado'
    )
    
    def valor_total_item_formatado(self, obj):
        """Busca a propriedade valor_total_item do modelo e formata como moeda."""
        # Usa a propriedade que definimos no ItemPedidoCompra
        total = obj.valor_total_item if obj.valor_total_item is not None else Decimal('0.00')
        return format_html('<span style="white-space: nowrap;">R$ {:,.2f}</span>', total)
    
    valor_total_item_formatado.short_description = 'Valor Total do Item'
    


@admin.register(PedidoCompra)
class PedidoCompraAdmin(admin.ModelAdmin):
    # CRÍTICO: Substitui 'total_pedido' pelo método formatado
    list_display = ('id', 'fornecedor', 'data_pedido', 'valor_total_formatado_list', 'status')
    list_filter = ('status', 'fornecedor')
    date_hierarchy = 'data_pedido'
    inlines = [ItemPedidoCompraInline]
    
    # Campo para ser exibido no formulário (detalhe)
    fieldsets = (
        (None, {
            'fields': ('fornecedor', 'status', 'data_recebimento_previsto', 'movimento_criado')
        }),
        ('Informações de Valor', {
            # CRÍTICO: Novo nome do método para o formulário de detalhe
            'fields': ('valor_total_formatado_detail',), 
            'description': 'O valor total é calculado automaticamente a partir dos itens.'
        }),
    )

    # CRÍTICO: Adiciona o campo de cálculo e o campo de controle do signal
    readonly_fields = ('valor_total_formatado_detail', 'movimento_criado')

    # Método para formatar o valor total para exibição na listagem (list_display)
    def valor_total_formatado_list(self, obj):
        """Formata a propriedade valor_total do modelo como moeda para a listagem."""
        total = obj.valor_total if obj.valor_total is not None else Decimal('0.00')
        return format_html('R$ {:,.2f}', total)
    
    valor_total_formatado_list.short_description = 'Valor Total'

    # Método para formatar o valor total para exibição no formulário (readonly_fields)
    def valor_total_formatado_detail(self, obj):
        """Formata a propriedade valor_total do modelo como moeda para o detalhe."""
        total = obj.valor_total if obj.valor_total is not None else Decimal('0.00')
        return format_html('<span style="font-weight: bold; font-size: 1.2em; white-space: nowrap;">R$ {:,.2f}</span>', total)
    
    valor_total_formatado_detail.short_description = 'Valor Total'


    def save_model(self, request, obj, form, change):
        """
        Sobrescreve save_model para garantir que o total seja recalculado
        APÓS os inlines terem sido salvos pelo Admin.
        """
        # 1. Salva o modelo principal (permite que o Admin salve os inlines)
        super().save_model(request, obj, form, change)
        
        # 2. Força a re-execução do obj.save(), que pode conter lógicas importantes
        # (como a chamada do signal de estoque, se o status tiver mudado).
        obj.save()
