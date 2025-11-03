# estoque/admin.py

from django.contrib import admin
from django.utils.html import format_html
from django.db.models import Sum, F
from django.urls import path # Importação necessária para o Resumo
from django.shortcuts import redirect # Importação necessária para o Resumo
from decimal import Decimal

# Importa todos os modelos
from .models import (
    Produto, MovimentoEstoque, ItemMovimentoEstoque,
    RequisicaoEstoque, AuditoriaInventario, AuditoriaPrePronto, ContagemDiariaFLV
)
# Importa a view de resumo
from .views import estoque_resumo 

# Constante de precisão para formatação (3 casas para Qtd, 4 casas para CMP)
TRES_CASAS = Decimal('0.000')
QUATRO_CASAS = Decimal('0.0000')

# --- ADMIN SITE OVERRIDE (CONECTA O DASHBOARD) ---

class EstoqueAdminSite(admin.AdminSite):
    """
    Subclasse do AdminSite para adicionar a página de resumo.
    """
    def get_urls(self):
        urls = super().get_urls()
        # Adiciona a URL do resumo antes das URLs padrões
        custom_urls = [
            path('resumo/', self.admin_view(estoque_resumo), name='estoque_resumo_dashboard'),
        ]
        return custom_urls + urls

    def index(self, request, extra_context=None):
        """
        Redireciona a página principal do app 'estoque' para o resumo.
        """
        # Verifica se o request veio para a página inicial do app 'estoque'
        if request.resolver_match.namespace == 'admin:estoque':
            return redirect('admin:estoque_resumo_dashboard')
        
        # Caso contrário, retorna a view padrão
        return super().index(request, extra_context)

# ATENÇÃO: Se estiver usando o admin padrão, este bloco deve ser ignorado.
# Como estamos focando apenas na refatoração do app, a maneira mais limpa é 
# garantir que a view de resumo seja a primeira página do app 'estoque'.
# No ambiente Django, você precisaria configurar isso na URL principal do projeto.
# Por enquanto, vou manter o código anterior e apenas adicionar um método para
# a página de Resumo ser acessível.

# --- ADMIN DE PRODUTO (REPETIDO) ---
# ... [Código ProdutoAdmin, MovimentoEstoqueAdmin e Inlines] ...


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
    fields = ('produto', 'quantidade_movimentada', 'preco_unitario') 
    autocomplete_fields = ['produto'] # Depende apenas de ProdutoAdmin (já registrado)
    # O preço unitário (CMP ou custo de entrada) é preenchido via signal/views
    readonly_fields = ('preco_unitario',) 

# --- ADMIN DE PRODUTO ---

@admin.register(Produto)
class ProdutoAdmin(EstoqueBaseAdmin): # Herda de EstoqueBaseAdmin
    list_display = (
        'nome', 
        'unidade_medida', 
        'preco_custo_formatado', # Custo Padrão
        'custo_medio_ponderado_formatado', # CMP real
        'preco_venda',
        'estoque_minimo',
        'quantidade_atual_formatada', # Saldo real
        'is_pre_pronto',
        'is_vendavel',
    )
    
    list_filter = ('categoria', 'is_pre_pronto', 'unidade_medida', 'ativo')
    search_fields = ('nome', 'descricao')
    
    # CORREÇÃO TEMPORÁRIA (mantida): Categoria pertence ao app core.
    # autocomplete_fields = ['categoria', 'unidade_medida']
    autocomplete_fields = ['unidade_medida'] 
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('nome', 'descricao', 'unidade_medida', 'categoria', 'is_vendavel', 'is_pre_pronto', 'ativo')
        }),
        ('Controle de Estoque e Custos', {
            'fields': ('estoque_minimo', 'preco_venda', 'preco_custo', ('quantidade_atual', 'custo_medio_ponderado'))
        }),
    )
    
    # Torna campos calculados somente leitura
    readonly_fields = ('quantidade_atual', 'custo_medio_ponderado', 'preco_custo_formatado', 'custo_medio_ponderado_formatado', 'quantidade_atual_formatada')

    # Métodos de formatação para exibição (Não alterados)
    def quantidade_atual_formatada(self, obj):
        # Garante a exibição com 3 casas decimais
        return f"{obj.quantidade_atual.quantize(TRES_CASAS):,} {obj.unidade_medida.sigla}"
    quantidade_atual_formatada.short_description = "Saldo Atual"
    quantidade_atual_formatada.admin_order_field = 'quantidade_atual'

    def custo_medio_ponderado_formatado(self, obj):
        # Garante a exibição com 4 casas decimais e como R$
        return f"R$ {obj.custo_medio_ponderado.quantize(QUATRO_CASAS):,}"
    custo_medio_ponderado_formatado.short_description = "Custo Médio (CMP)"
    custo_medio_ponderado_formatado.admin_order_field = 'custo_medio_ponderado'

    def preco_custo_formatado(self, obj):
        return f"R$ {obj.preco_custo:,}"
    preco_custo_formatado.short_description = "Preço Custo Padrão"


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
    search_fields = ('observacoes', 'responsavel__nome', 'fornecedor__nome_fantasia', 'cliente__nome')
    date_hierarchy = 'data_movimento'
    readonly_fields = ('origem_documento',)
    
    # CORREÇÃO TEMPORÁRIA (mantida)
    # autocomplete_fields = ['responsavel', 'fornecedor', 'cliente', 'venda', 'pedido_compra']
    autocomplete_fields = ['responsavel', 'fornecedor', 'cliente']
    
    inlines = [ItemMovimentoEstoqueInline]

    def origem_documento(self, obj):
        """
        Exibe o link para o documento de origem (Requisição, Auditoria, Contagem).
        """
        if hasattr(obj, 'requisicao_origem'):
            req = obj.requisicao_origem
            # A URL deve ser ajustada para o admin correto
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

# 3. Requisição de Estoque (Documento de Saída para Produção)
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
    search_fields = ('produto__nome', 'solicitante__nome', 'responsavel_atendimento__nome')
    autocomplete_fields = ['produto', 'solicitante', 'responsavel_atendimento'] 
    readonly_fields = ('movimento_saida',)
    date_hierarchy = 'data_requisicao'


# 4. Auditoria de Inventário (Insumos)
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
    search_fields = ('produto__nome', 'responsavel__nome')
    autocomplete_fields = ['produto', 'responsavel'] 
    readonly_fields = ('movimento_ajuste', 'quantidade_sistema')
    date_hierarchy = 'data_auditoria'


# 5. Auditoria de Pré-Prontos
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
    search_fields = ('produto__nome', 'responsavel__nome')
    autocomplete_fields = ['produto', 'responsavel'] 
    readonly_fields = ('movimento_ajuste', 'quantidade_sistema')
    date_hierarchy = 'data_auditoria'


# 6. Contagem Diária FLV
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
    search_fields = ('produto__nome', 'responsavel__nome')
    autocomplete_fields = ['produto', 'responsavel'] 
    readonly_fields = ('movimento_ajuste', 'quantidade_sistema')
    date_hierarchy = 'data_contagem'
