from django.contrib import admin
from django.utils.html import format_html
from django.db.models import Sum, F
from django.urls import path 
from django.shortcuts import redirect 
from decimal import Decimal

# Importa todos os modelos do app 'estoque'
from .models import (
    Produto, MovimentoEstoque, ItemMovimentoEstoque, CustoProduto,
    RequisicaoEstoque, ItemRequisicaoEstoque, # ItemRequisicaoEstoque deve ser importado
    AuditoriaInventario, AuditoriaPrePronto, ContagemDiariaFLV,
    LocalEstocagem
)

# Importa a view de resumo
from .views import estoque_resumo 

# Constante de precisão para formatação (3 casas para Qtd, 4 casas para CMP)
TRES_CASAS = Decimal('0.000')
QUATRO_CASAS = Decimal('0.0000')

# --------------------------------------------------------------------
# --- ADMIN BASE (Adiciona a URL customizada) ---
# --------------------------------------------------------------------

class EstoqueBaseAdmin(admin.ModelAdmin):
    """
    Classe base para adicionar a URL de Resumo no App Hook do Admin.
    """
    def get_urls(self):
        # A view de resumo deve ser adicionada ao nível do app
        info = self.model._meta.app_label, self.model._meta.model_name
        urls = super().get_urls()
        custom_urls = [
            path('resumo/', self.admin_site.admin_view(estoque_resumo), name='%s_%s_resumo' % info),
        ]
        return custom_urls + urls

# --------------------------------------------------------------------
# 1. LOCAL DE ESTOCAGEM
# --------------------------------------------------------------------

@admin.register(LocalEstocagem)
class LocalEstocagemAdmin(EstoqueBaseAdmin):
    # 🚨 CORRIGIDO (E108, E127): 'data_criacao' foi removido
    list_display = ('nome',)
    search_fields = ('nome',)
    list_filter = () 
    # date_hierarchy removido pois não há campo de data disponível
    # date_hierarchy = 'data_criacao' # REMOVIDO

# --------------------------------------------------------------------
# 2. REQUISIÇÃO DE ESTOQUE
# --------------------------------------------------------------------

class ItemRequisicaoEstoqueInline(admin.TabularInline):
    """Inline para os itens solicitados em uma Requisição de Estoque."""
    model = ItemRequisicaoEstoque
    fields = ('produto', 'quantidade_solicitada', 'quantidade_atendida')
    raw_id_fields = ('produto',)
    extra = 1

@admin.register(RequisicaoEstoque)
class RequisicaoEstoqueAdmin(EstoqueBaseAdmin):
    list_display = ('__str__', 'status', 'responsavel', 'movimento_saida_estoque', 'data_requisicao')
    list_filter = ('status',)
    search_fields = ('responsavel__username',)
    date_hierarchy = 'data_requisicao'
    
    autocomplete_fields = ['responsavel', 'movimento_saida_estoque'] 

    # 'movimento_saida_estoque' e 'data_requisicao' devem ser somente leitura
    readonly_fields = ('data_requisicao', 'movimento_saida_estoque')

    inlines = [ItemRequisicaoEstoqueInline]

# --------------------------------------------------------------------
# 3. PRODUTOS, CUSTOS E MOVIMENTOS (Formatação)
# --------------------------------------------------------------------

@admin.register(CustoProduto)
class CustoProdutoAdmin(EstoqueBaseAdmin):
    """Admin para o modelo CustoProduto (apenas leitura e debug)."""
    list_display = (
        'produto', 
        'quantidade_atual_formatada', 
        'custo_medio_ponderado_formatado', 
        'valor_total_estoque_formatado'
    )
    search_fields = ('produto__nome',)
    # 🚨 CORRIGIDO (E035): 'preco_custo' e 'data_ultima_atualizacao' foram removidos
    readonly_fields = [
        'produto', 
        'quantidade_atual', 
        'custo_medio_ponderado', 
    ]

    def quantidade_atual_formatada(self, obj):
        qtd = obj.quantidade_atual or TRES_CASAS
        return format_html('{} <small>{}</small>', f"{qtd.quantize(TRES_CASAS):,}", obj.produto.unidade_medida.sigla)
    quantidade_atual_formatada.short_description = 'Qtd Atual'

    def custo_medio_ponderado_formatado(self, obj):
        cmp = obj.custo_medio_ponderado or QUATRO_CASAS
        return format_html('<span style="white-space: nowrap;">R$ {:,.4f}</span>', cmp)
    custo_medio_ponderado_formatado.short_description = 'CMP'

    def valor_total_estoque_formatado(self, obj):
        if obj.quantidade_atual is None or obj.custo_medio_ponderado is None:
            total = Decimal('0.00')
        else:
            total = obj.quantidade_atual * obj.custo_medio_ponderado
        return format_html('<span style="font-weight: bold; white-space: nowrap;">R$ {:,.2f}</span>', total)
    valor_total_estoque_formatado.short_description = 'Valor Total'


@admin.register(Produto)
class ProdutoAdmin(EstoqueBaseAdmin):
    # 🚨 CORRIGIDO (E108): 'sku' foi removido
    list_display = (
        'nome', 'unidade_medida', 'categoria', 
        'is_vendavel', 'ativo', 'estoque_minimo_formatado', 
        'quantidade_atual_formatada', 'cmp_formatado'
    )
    list_filter = ('is_vendavel', 'ativo', 'categoria', 'unidade_medida')
    search_fields = ('nome',)
    autocomplete_fields = ['unidade_medida', 'categoria']
    fieldsets = (
        ('Informações Básicas', {
            # 🚨 CORRIGIDO: 'sku' foi removido
            'fields': ('nome', 'unidade_medida', 'categoria', 'ativo', 'is_vendavel')
        }),
        ('Estoque e Custos', {
            'fields': ('local_estocagem', 'estoque_minimo', 'quantidade_atual_formatada_detail', 'cmp_formatado_detail'),
        }),
        ('Preços', {
            'fields': ('preco_venda', 'custo_medio_ponderado_detail'),
            'description': 'O preço de custo é informativo e é o CMP.'
        }),
    )
    readonly_fields = ('quantidade_atual_formatada_detail', 'cmp_formatado_detail', 'custo_medio_ponderado_detail')

    # Métodos de Formatação (Reuso dos métodos de CustoProdutoAdmin)
    def quantidade_atual_formatada(self, obj):
        # Tenta buscar a quantidade do modelo CustoProduto (se existir)
        try:
            return CustoProdutoAdmin.quantidade_atual_formatada(self, obj.custoproduto)
        except CustoProduto.DoesNotExist:
            return format_html('<span style="color: red;">N/A</span>')
    quantidade_atual_formatada.short_description = 'Qtd'

    def cmp_formatado(self, obj):
        try:
            return CustoProdutoAdmin.custo_medio_ponderado_formatado(self, obj.custoproduto)
        except CustoProduto.DoesNotExist:
            return format_html('<span style="color: red;">R$ 0,0000</span>')
    cmp_formatado.short_description = 'CMP'
    
    # Detalhe do Produto
    def quantidade_atual_formatada_detail(self, obj):
        try:
            return CustoProdutoAdmin.quantidade_atual_formatada(self, obj.custoproduto)
        except CustoProduto.DoesNotExist:
            return format_html('<span style="color: red; font-weight: bold;">0,000</span>')
    quantidade_atual_formatada_detail.short_description = 'Quantidade Atual em Estoque'

    def cmp_formatado_detail(self, obj):
        try:
            return CustoProdutoAdmin.custo_medio_ponderado_formatado(self, obj.custoproduto)
        except CustoProduto.DoesNotExist:
            return format_html('<span style="color: red;">R$ 0,0000</span>')
    cmp_formatado_detail.short_description = 'Custo Médio Ponderado'
    
    # Apenas o valor do CMP para ser usado no fieldset de "Preços"
    def custo_medio_ponderado_detail(self, obj):
        try:
            cmp = obj.custoproduto.custo_medio_ponderado or QUATRO_CASAS
            return format_html('<span style="white-space: nowrap;">R$ {:,.4f}</span>', cmp)
        except CustoProduto.DoesNotExist:
            return format_html('<span style="color: red;">R$ 0,0000</span>')
    custo_medio_ponderado_detail.short_description = 'Custo Atual (CMP)'

    # Formata o estoque mínimo
    def estoque_minimo_formatado(self, obj):
        if obj.estoque_minimo is None:
            return '-'
        return format_html('<span style="white-space: nowrap;">{:,.3f}</span>', obj.estoque_minimo.quantize(TRES_CASAS))
    estoque_minimo_formatado.short_description = 'Estoque Min'
    
    
class ItemMovimentoEstoqueInline(admin.TabularInline):
    """Inline para os itens que compõem um Movimento de Estoque."""
    model = ItemMovimentoEstoque
    # Adicionado 'is_estornado' para visualização do soft-delete (R1)
    list_display = ('produto', 'quantidade_movimentada', 'preco_unitario', 'is_estornado')
    fields = ('produto', 'quantidade_movimentada', 'preco_unitario', 'is_estornado')
    readonly_fields = ('preco_unitario',) # Preço unitário é preenchido pelo signal/service
    raw_id_fields = ('produto',)
    extra = 0
    

@admin.register(MovimentoEstoque)
class MovimentoEstoqueAdmin(EstoqueBaseAdmin):
    """Admin para o cabeçalho do Movimento de Estoque (Entradas/Saídas)."""
    list_display = ('__str__', 'tipo_movimento', 'data_movimento', 'responsavel', 'movimento_estornado')
    list_filter = ('tipo_movimento', 'data_movimento', 'responsavel')
    search_fields = ('responsavel__username', 'observacoes')
    date_hierarchy = 'data_movimento'
    
    fieldsets = (
        ('Informações Básicas', {
            # Mantido 'movimento_estornado'
            'fields': ('tipo_movimento', 'responsavel', 'data_movimento', 'observacoes', 'movimento_estornado')
        }),
        ('Rastreabilidade (Preenchido Automaticamente)', {
            # 🚨 CORRIGIDO (E012, E035): 'venda', 'requisicao_estoque' e 'movimento_estornado' duplicado foram removidos
            'fields': ('pedido_compra', 'ordem_producao'),
            'classes': ('collapse',),
            'description': 'Campos que indicam a origem do movimento (preenchidos por signals/services).'
        }),
    )
    
    # 🚨 CORRIGIDO (E035): 'venda' e 'requisicao_estoque' foram removidos
    readonly_fields = ('tipo_movimento', 'data_movimento', 'pedido_compra', 'ordem_producao', 'movimento_estornado')
    
    inlines = [ItemMovimentoEstoqueInline]

    def movimento_estornado(self, obj):
        return obj.is_estornado
    movimento_estornado.boolean = True
    movimento_estornado.short_description = 'Estornado'


# --------------------------------------------------------------------
# 4. AUDITORIAS E CONTAGENS
# --------------------------------------------------------------------

@admin.register(AuditoriaInventario)
class AuditoriaInventarioAdmin(EstoqueBaseAdmin):
    list_display = (
        'data_auditoria', 
        'produto', 
        'quantidade_contada', 
        'quantidade_sistema',
        'status', 
        'responsavel', 
    )
    list_filter = ('status', 'data_auditoria')
    search_fields = ('produto__nome', 'responsavel__username')
    autocomplete_fields = ['produto', 'responsavel'] 
    readonly_fields = ('movimento_ajuste', 'quantidade_sistema')
    date_hierarchy = 'data_auditoria'


@admin.register(AuditoriaPrePronto)
class AuditoriaPreProntoAdmin(EstoqueBaseAdmin):
    list_display = (
        'data_auditoria', 
        'produto', 
        'quantidade_contada', 
        'quantidade_sistema',
        'status', 
        'responsavel', 
    )
    list_filter = ('status', 'data_auditoria')
    search_fields = ('produto__nome', 'responsavel__username')
    autocomplete_fields = ['produto', 'responsavel'] 
    readonly_fields = ('movimento_ajuste', 'quantidade_sistema')
    date_hierarchy = 'data_auditoria'


@admin.register(ContagemDiariaFLV)
class ContagemDiariaFLVAdmin(EstoqueBaseAdmin):
    list_display = (
        'data_contagem', 
        'produto', 
        'quantidade_contada', 
        'quantidade_sistema',
        'status', 
        'responsavel', 
    )
    list_filter = ('status', 'data_contagem')
    search_fields = ('produto__nome', 'responsavel__username')
    autocomplete_fields = ['produto', 'responsavel'] 
    readonly_fields = ('movimento_ajuste', 'quantidade_sistema')
    date_hierarchy = 'data_contagem'