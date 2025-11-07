# ====================================================================
# ARQUIVO: chefia_erp/estoque/admin.py (COMPLETO E LIMPO)
# Removido o registro de Categoria, que agora está em core/admin.py
# ====================================================================

from django.contrib import admin
from django.utils.html import format_html
from django.db.models import Sum, F
from django.urls import path 
from django.shortcuts import redirect 
from decimal import Decimal

# Importa todos os modelos do app 'estoque'
from .models import (
    Produto, MovimentoEstoque, ItemMovimentoEstoque, CustoProduto,
    RequisicaoEstoque, AuditoriaInventario, AuditoriaPrePronto, ContagemDiariaFLV,
    LocalEstocagem
)

# 🚨 IMPORTANTE: Categoria NÃO é mais importada nem registrada aqui.
# from core.models import Categoria <- Esta linha foi removida
# O registro dela agora está em 'core/admin.py'.

# Importa a view de resumo
from .views import estoque_resumo 

# Constante de precisão para formatação (3 casas para Qtd, 4 casas para CMP)
TRES_CASAS = Decimal('0.000')
QUATRO_CASAS = Decimal('0.0000')

# --- ADMIN BASE (Adiciona a URL customizada) ---

class EstoqueBaseAdmin(admin.ModelAdmin):
    """
    Classe base para adicionar a URL de Resumo no App Hook do Admin.
    """
    def get_urls(self):
        # A view de resumo deve ser adicionada ao nível do app
        info = self.model._meta.app_label, self.model._meta.model_name
        urls = super().get_urls()
        
        # Adiciona a URL de resumo
        extra_urls = [
            path('resumo/', self.admin_site.admin_view(estoque_resumo), name='%s_%s_resumo' % info),
        ]
        # Esta é uma forma padrão de adicionar URLs customizadas no Admin de um app
        return extra_urls + urls


# --- INLINES GERAIS ---

# 1. Inline para exibir os itens dentro do cabeçalho do Movimento de Estoque
class ItemMovimentoEstoqueInline(admin.TabularInline):
    model = ItemMovimentoEstoque
    extra = 0
    # is_estornado é o campo R1 crítico (apenas leitura)
    fields = ('produto', 'quantidade_movimentada', 'preco_unitario', 'is_estornado') 
    autocomplete_fields = ['produto'] # Depende apenas de ProdutoAdmin (já registrado)
    # O preço unitário (CMP ou custo de entrada) é preenchido via signal/views
    readonly_fields = ('preco_unitario', 'is_estornado') 

# 2. Inline para CustoProduto (R7) - A ser exibido dentro de Produto
class CustoProdutoInline(admin.StackedInline):
    """
    Exibe o saldo e custo do produto diretamente no formulário do Produto.
    """
    model = CustoProduto
    can_delete = False
    max_num = 1
    # Os campos de custo devem ser somente leitura para serem alterados apenas pelos Signals (R1)
    fields = (
        'quantidade_atual', 
        'custo_medio_ponderado', 
        'preco_custo',
        'data_ultima_atualizacao'
    )
    readonly_fields = fields
    verbose_name_plural = 'Controle de Saldo e Custo'
    verbose_name = 'Custo e Saldo'


# --- ADMINS DE REFERÊNCIA DO APP ESTOQUE ---

@admin.register(LocalEstocagem)
class LocalEstocagemAdmin(admin.ModelAdmin):
    list_display = ('nome', 'ativa')
    list_filter = ('ativa',)
    search_fields = ('nome',)


# --- ADMIN DE PRODUTO ---

@admin.register(Produto)
class ProdutoAdmin(EstoqueBaseAdmin): # Herda de EstoqueBaseAdmin
    list_display = (
        'nome', 
        'unidade_medida', 
        'categoria', # Categoria de Estoque
        'local_estocagem', 
        'preco_custo_formatado', # Custo Padrão
        'custo_medio_ponderado_formatado', # CMP real
        'preco_venda',
        'estoque_minimo',
        'quantidade_atual_formatada', # Saldo real
        'is_pre_pronto',
        'is_vendavel',
    )
    
    list_filter = ('categoria', 'is_pre_pronto', 'unidade_medida', 'ativo', 'local_estocagem')
    search_fields = ('nome', 'descricao')
    
    # O autocomplete_fields funciona agora porque CategoriaAdmin e UnidadeMedidaAdmin
    # estão registrados em core/admin.py
    autocomplete_fields = ['unidade_medida', 'categoria', 'local_estocagem'] 
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('nome', 'descricao', 'unidade_medida', 'categoria', 'local_estocagem', 'is_vendavel', 'is_pre_pronto', 'ativo')
        }),
        ('Controle de Venda', {
            # Manter apenas os campos de Venda/Limite
            'fields': ('estoque_minimo', 'preco_venda') 
        }),
    )
    
    # Adiciona o novo Inline (R7)
    inlines = [CustoProdutoInline]
    
    # Torna campos calculados (virtuais) somente leitura, garantindo que não sejam editáveis
    readonly_fields = ('preco_custo_formatado', 'custo_medio_ponderado_formatado', 'quantidade_atual_formatada')

    # Métodos de formatação para exibição (Não alterados, apenas lendo as @properties)
    def quantidade_atual_formatada(self, obj):
        # A @property obj.quantidade_atual lê do CustoProduto
        try:
            return f"{obj.quantidade_atual.quantize(TRES_CASAS):,} {obj.unidade_medida.sigla}"
        except AttributeError:
            return f"{Decimal('0.000').quantize(TRES_CASAS):,} {obj.unidade_medida.sigla}"
            
    quantidade_atual_formatada.short_description = "Saldo Atual"
    quantidade_atual_formatada.admin_order_field = 'custo_produto__quantidade_atual' # Ordena pelo campo real

    def custo_medio_ponderado_formatado(self, obj):
        # A @property obj.custo_medio_ponderado lê do CustoProduto
        try:
            return f"R$ {obj.custo_medio_ponderado.quantize(QUATRO_CASAS):,}"
        except AttributeError:
            return "R$ 0,0000"
            
    custo_medio_ponderado_formatado.short_description = "Custo Médio (CMP)"
    custo_medio_ponderado_formatado.admin_order_field = 'custo_produto__custo_medio_ponderado' # Ordena pelo campo real

    def preco_custo_formatado(self, obj):
        # A @property obj.preco_custo lê do CustoProduto
        try:
            return f"R$ {obj.preco_custo:,}"
        except AttributeError:
            return "R$ 0,00"
            
    preco_custo_formatado.short_description = "Preço Custo Padrão"


# --- ADMIN DE CUSTOPRODUTO (Opcional, para debug) ---

@admin.register(CustoProduto)
class CustoProdutoAdmin(EstoqueBaseAdmin):
    list_display = ('produto', 'quantidade_atual', 'custo_medio_ponderado', 'preco_custo', 'data_ultima_atualizacao')
    search_fields = ('produto__nome',)
    # O Custo deve ser gerenciado apenas pelo sistema
    readonly_fields = ('produto', 'quantidade_atual', 'custo_medio_ponderado', 'preco_custo', 'data_ultima_atualizacao')


# --- ADMIN DE MOVIMENTO DE ESTOQUE ---

@admin.register(MovimentoEstoque)
class MovimentoEstoqueAdmin(EstoqueBaseAdmin): # Herda de EstoqueBaseAdmin
    list_display = (
        'data_movimento', 
        'tipo_movimento', 
        'responsavel', # Campo de rastreabilidade (FK Usuario)
        'fornecedor', 
        'cliente', 
        'origem_documento', # Método customizado
    )
    
    list_filter = ('tipo_movimento', 'data_movimento')
    search_fields = ('observacoes', 'responsavel__username', 'fornecedor__nome_fantasia', 'cliente__nome')
    date_hierarchy = 'data_movimento'
    readonly_fields = ('origem_documento',)
    
    autocomplete_fields = ['responsavel', 'fornecedor', 'cliente'] # Mantido conforme seu código
    
    inlines = [ItemMovimentoEstoqueInline]

    def origem_documento(self, obj):
        """
        Exibe o link para o documento de origem (Requisição, Auditoria, Contagem).
        """
        if hasattr(obj, 'requisicao_origem'):
            req = obj.requisicao_origem
            return format_html(f'<a href="../requisicaoestoque/{req.pk}/change/">Requisição #{req.pk}</a>')
        elif hasattr(obj, 'auditoria_inventario_origem'):
            audit = obj.auditoria_inventario_origem
            return format_html(f'<a href="../auditoriainventario/{audit.pk}/change/">Audit Inv. #{audit.pk}</a>')
        elif hasattr(obj, 'auditoria_pre_pronto_origem'):
            audit_pp = obj.auditoria_pre_pronto_origem
            return format_html(f'<a href="../auditoriaprepronto/{audit_pp.pk}/change/">Audit PP #{audit_pp.pk}</a>')
        elif hasattr(obj, 'contagem_flv_origem'):
            flv = obj.contagem_flv_origem
            return format_html(f'<a href="../contagemdiariaflv/{flv.pk}/change/">Contagem FLV #{flv.pk}</a>')
        elif obj.venda:
            return format_html(f'Venda #{obj.venda.pk}')
        elif obj.pedido_compra:
            return format_html(f'Compra #{obj.pedido_compra.pk}')
        return "N/A"
    origem_documento.short_description = "Documento de Origem"


# --- ADMINS DOS NOVOS DOCUMENTOS OPERACIONAIS ---

@admin.register(RequisicaoEstoque)
class RequisicaoEstoqueAdmin(EstoqueBaseAdmin): # Herda de EstoqueBaseAdmin
    list_display = (
        'data_requisicao', 
        'produto', 
        'quantidade_requisitada', 
        'quantidade_entregue', 
        'status', 
        'solicitante', 
        'responsavel_atendimento',
    )
    list_filter = ('status', 'data_requisicao')
    search_fields = ('produto__nome', 'solicitante__username', 'responsavel_atendimento__username')
    autocomplete_fields = ['produto', 'solicitante', 'responsavel_atendimento'] 
    readonly_fields = ('movimento_saida',)
    date_hierarchy = 'data_requisicao'


@admin.register(AuditoriaInventario)
class AuditoriaInventarioAdmin(EstoqueBaseAdmin): # Herda de EstoqueBaseAdmin
    list_display = (
        'data_auditoria', 
        'produto', 
        'quantidade_contada', 
        'quantidade_sistema',
        'status', 
        'responsavel', 
        'data_conclusao',
    )
    list_filter = ('status', 'data_auditoria')
    search_fields = ('produto__nome', 'responsavel__username')
    autocomplete_fields = ['produto', 'responsavel'] 
    readonly_fields = ('movimento_ajuste', 'quantidade_sistema')
    date_hierarchy = 'data_auditoria'


@admin.register(AuditoriaPrePronto)
class AuditoriaPreProntoAdmin(EstoqueBaseAdmin): # Herda de EstoqueBaseAdmin
    list_display = (
        'data_auditoria', 
        'produto', 
        'quantidade_contada', 
        'quantidade_sistema',
        'status', 
        'responsavel', 
        'data_conclusao',
    )
    list_filter = ('status', 'data_auditoria')
    search_fields = ('produto__nome', 'responsavel__username')
    autocomplete_fields = ['produto', 'responsavel'] 
    readonly_fields = ('movimento_ajuste', 'quantidade_sistema')
    date_hierarchy = 'data_auditoria'


@admin.register(ContagemDiariaFLV)
class ContagemDiariaFLVAdmin(EstoqueBaseAdmin): # Herda de EstoqueBaseAdmin
    list_display = (
        'data_contagem', 
        'produto', 
        'quantidade_contada', 
        'quantidade_sistema',
        'status', 
        'responsavel', 
        'data_conclusao',
    )
    list_filter = ('status', 'data_contagem')
    search_fields = ('produto__nome', 'responsavel__username')
    autocomplete_fields = ['produto', 'responsavel'] 
    readonly_fields = ('movimento_ajuste', 'quantidade_sistema')
    date_hierarchy = 'data_contagem'