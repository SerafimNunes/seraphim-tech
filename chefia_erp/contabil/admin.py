# contabil/admin.py
from django.contrib import admin
from .models import PlanoConta, CentroCusto, LancamentoContabil
from django.utils.html import format_html
from decimal import Decimal # Importado para formatação

# -------------------------------------------------------------
# 1. PLANO DE CONTAS
# -------------------------------------------------------------
@admin.register(PlanoConta)
class PlanoContaAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'nome', 'tipo', 'conta_pai', 'ativo')
    list_filter = ('tipo', 'ativo')
    search_fields = ('nome', 'codigo')
    list_editable = ('ativo',)
    raw_id_fields = ('conta_pai',) 

# -------------------------------------------------------------
# 2. CENTRO DE CUSTO
# -------------------------------------------------------------
@admin.register(CentroCusto)
class CentroCustoAdmin(admin.ModelAdmin):
    list_display = ('nome', 'ativo')
    search_fields = ('nome',)
    list_editable = ('ativo',)

# -------------------------------------------------------------
# 3. LANÇAMENTO CONTÁBIL
# -------------------------------------------------------------
@admin.register(LancamentoContabil)
class LancamentoContabilAdmin(admin.ModelAdmin):
    list_display = ('data_lancamento', 'valor_formatado', 'tipo_movimento', 'get_plano_conta_nome', 'get_centro_custo_nome', 'venda', 'pedido_compra')
    list_filter = ('tipo_movimento', 'plano_conta', 'centro_custo', 'data_lancamento')
    search_fields = ('descricao', 'venda__pk', 'pedido_compra__pk', 'plano_conta__nome')
    
    # Campos de origem e metadados devem ser somente leitura
    readonly_fields = ('venda', 'pedido_compra', 'usuario_criacao', 'data_lancamento')
    
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
        # Formatação do Decimal com substituição de separadores para padrão brasileiro
        return format_html('<span style="white-space: nowrap;">R$ {:,.2f}</span>', valor)
