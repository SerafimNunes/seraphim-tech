# =======================================================================
# ARQUIVO: contabil/admin.py (CORRIGIDO R7)
# =======================================================================
from django.contrib import admin
from .models import PlanoConta, CentroCusto, LoteContabil, LancamentoContabil # Importando LoteContabil (NOVO)
from django.utils.html import format_html
from decimal import Decimal 

# -------------------------------------------------------------
# 1. PLANO DE CONTAS
# -------------------------------------------------------------
@admin.register(PlanoConta)
class PlanoContaAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'nome', 'tipo', 'conta_pai', 'ativo')
    list_filter = ('tipo', 'ativo')
    search_fields = ('nome', 'codigo')
    list_editable = ('ativo',)
    raw_id_fields = ('conta_pai', 'usuario_criacao') 

# -------------------------------------------------------------
# 2. CENTRO DE CUSTO
# -------------------------------------------------------------
@admin.register(CentroCusto)
class CentroCustoAdmin(admin.ModelAdmin):
    list_display = ('nome', 'ativo')
    search_fields = ('nome',)
    list_editable = ('ativo',)

# -------------------------------------------------------------
# 3. LANÇAMENTO CONTÁBIL INLINE (Para o Lote)
# -------------------------------------------------------------
class LancamentoContabilInline(admin.TabularInline):
    """Permite a edição das linhas de débito/crédito dentro do formulário do Lote."""
    model = LancamentoContabil
    extra = 0
    # Campos que fazem sentido na linha de detalhe
    fields = ('tipo_movimento', 'valor', 'plano_conta', 'centro_custo', 'descricao')
    # O valor é geralmente setado pelo código, mantido readonly para evitar inconsistências manuais
    readonly_fields = ('tipo_movimento', 'valor', 'plano_conta', 'centro_custo') 


# -------------------------------------------------------------
# 4. LOTE CONTÁBIL (NOVO ADMIN R7 - CABEÇALHO)
# -------------------------------------------------------------
@admin.register(LoteContabil)
class LoteContabilAdmin(admin.ModelAdmin):
    """
    Administração do Cabeçalho da Transação (Lote Contábil),
    que agrupa os Débitos e Créditos e centraliza a rastreabilidade.
    """
    # Exibe informações do cabeçalho e a origem da transação
    list_display = ('id', 'data_registro', 'valor_total', 'historico_transacao', 'get_origem')
    list_filter = ('data_registro',)
    search_fields = ('historico_transacao', 'id')
    raw_id_fields = ('usuario_criacao', 'venda', 'pedido_compra', 'movimento_caixa') # Rastreabilidade via FK
    inlines = [LancamentoContabilInline]
    
    # Custom method para exibir a origem (Venda, Compra, Caixa)
    @admin.display(description='Origem')
    def get_origem(self, obj):
        if obj.venda:
            return format_html(f"Venda: <b>{obj.venda.pk}</b>")
        if obj.pedido_compra:
            return format_html(f"Compra: <b>{obj.pedido_compra.pk}</b>")
        if obj.movimento_caixa:
            return format_html(f"Caixa: <b>{obj.movimento_caixa.pk}</b>")
        return "N/A"


# -------------------------------------------------------------
# 5. LANÇAMENTO CONTÁBIL (REFATORADO R7)
# -------------------------------------------------------------
@admin.register(LancamentoContabil)
class LancamentoContabilAdmin(admin.ModelAdmin):
    """
    Visualização direta dos Lançamentos Contábeis (linhas de débito/crédito).
    """
    # list_display ajustado: removido venda/pedido_compra, adicionado lote_contabil
    list_display = ('data_lancamento', 'valor_formatado', 'tipo_movimento', 'get_plano_conta_nome', 'get_centro_custo_nome', 'lote_contabil')
    # list_filter mantido
    list_filter = ('tipo_movimento', 'plano_conta', 'centro_custo', 'data_lancamento')
    # search_fields ajustado para buscar no LoteContabil
    search_fields = ('descricao', 'lote_contabil__historico_transacao', 'plano_conta__nome')
    
    # readonly_fields ajustado: removidos venda, pedido_compra e usuario_criacao
    readonly_fields = ('data_lancamento', 'lote_contabil') 
    
    raw_id_fields = ('plano_conta', 'centro_custo', 'lote_contabil')


    @admin.display(description='Conta Contábil')
    def get_plano_conta_nome(self, obj):
        return obj.plano_conta.nome if obj.plano_conta else 'N/A'
    
    @admin.display(description='Centro de Custo')
    def get_centro_custo_nome(self, obj):
        return obj.centro_custo.nome if obj.centro_custo else 'N/A'
        
    @admin.display(description='Valor')
    def valor_formatado(self, obj):
        """Formata o valor para exibição em moeda (R$ X.XXX,XX)"""
        valor = obj.valor if obj.valor is not None else Decimal('0.00')
        return format_html('<span style="white-space: nowrap;">R$ {:,.2f}</span>', valor)