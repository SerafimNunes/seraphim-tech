# producao/admin.py
from django.contrib import admin
from django.utils.html import format_html # Importação necessária para formatar
from .models import (
    FichaTecnica, 
    ItemFichaTecnica,
    EtapaProcesso, 
    OrdemProducao,
    RequisicaoInsumo,
    ItemRequisicao
)
from decimal import Decimal # Necessário para cálculos e defaults

# =========================================================
# FICHA TÉCNICA
# =========================================================

class ItemFichaTecnicaInline(admin.TabularInline):
    """Inline para os itens (insumos) que compõem a Ficha Técnica."""
    model = ItemFichaTecnica
    # ATUALIZADO: custo_insumo continua como readonly, calculado via signal
    fields = ('insumo', 'quantidade_necessaria', 'custo_insumo_display') 
    raw_id_fields = ('insumo',)
    readonly_fields = ('custo_insumo_display',) 
    extra = 1

    def custo_insumo_display(self, obj):
        """Exibe o custo com 4 casas decimais e formatação de moeda."""
        custo = obj.custo_insumo if obj.custo_insumo is not None else Decimal('0.0000')
        return format_html('<span style="white-space: nowrap;">R$ {:,.4f}</span>', custo)
    custo_insumo_display.short_description = 'Custo Parcial (R$)'

class EtapaProcessoInline(admin.TabularInline):
    """Inline para as etapas (Passos Chave) do Processo de Produção."""
    model = EtapaProcesso
    extra = 1
    fields = ('numero_etapa', 'tarefa', 'tempo_estimado', 'observacoes_qualidade')
    ordering = ('numero_etapa',)


@admin.register(FichaTecnica)
class FichaTecnicaAdmin(admin.ModelAdmin):
    # ATUALIZADO: Usando métodos customizados para exibir custos com 4 casas decimais
    list_display = (
        'produto_produzido', 
        'rendimento_base', 
        'custo_total_display', 
        'custo_unitario_display', 
        'data_criacao'
    )
    list_filter = ('data_criacao',)
    search_fields = ('produto_produzido__nome',)
    raw_id_fields = ('produto_produzido',)
    
    fieldsets = (
        ('Geral', {
            'fields': ('produto_produzido', 'rendimento_base', 'data_criacao'),
        }),
        ('Custos Calculados (R$/UN)', {
            # Mantemos o nome original do campo para uso interno no ModelAdmin
            'fields': ('custo_total_detail', 'custo_unitario_detail'), 
            'description': 'Valores calculados automaticamente pelos insumos e rendimento base. Atualizam o Preço de Custo do Produto final.'
        }),
    )
    
    # Adiciona os métodos de detalhe na lista de campos somente leitura
    readonly_fields = ('custo_total_detail', 'custo_unitario_detail', 'data_criacao') 
    
    inlines = [
        ItemFichaTecnicaInline, 
        EtapaProcessoInline
    ]

    # MÉTODOS CUSTOMIZADOS PARA EXIBIÇÃO FORMATADA NA LISTAGEM
    def custo_total_display(self, obj):
        return f"R$ {obj.custo_total:,.4f}"
    custo_total_display.short_description = 'Custo Total'
    
    def custo_unitario_display(self, obj):
        return f"R$ {obj.custo_unitario:,.4f}"
    custo_unitario_display.short_description = 'Custo Unitário'
    
    # MÉTODOS CUSTOMIZADOS PARA EXIBIÇÃO FORMATADA NO FORMULÁRIO (DETALHE)
    def custo_total_detail(self, obj):
        return format_html('<span style="font-weight: bold; white-space: nowrap;">R$ {:,.4f}</span>', obj.custo_total or Decimal('0.0000'))
    custo_total_detail.short_description = 'Custo Total da Receita'
    
    def custo_unitario_detail(self, obj):
        return format_html('<span style="font-weight: bold; white-space: nowrap;">R$ {:,.4f}</span>', obj.custo_unitario or Decimal('0.0000'))
    custo_unitario_detail.short_description = 'Custo Unitário do Produto'

# =========================================================
# FLUXO DE PRODUÇÃO (ORDEM E REQUISIÇÃO)
# =========================================================

class ItemRequisicaoInline(admin.TabularInline):
    """Inline para os itens solicitados em uma Requisição de Insumo."""
    model = ItemRequisicao
    # NOVO CAMPO: Adiciona preco_custo_unitario, crucial para o CMV
    fields = ('insumo', 'quantidade_solicitada', 'quantidade_atendida', 'preco_custo_unitario_display')
    raw_id_fields = ('insumo',)
    
    # Os campos solicitados e o custo unitário são somente leitura. O usuário só altera 'quantidade_atendida'.
    readonly_fields = ('insumo', 'quantidade_solicitada', 'preco_custo_unitario_display')
    extra = 0 
    can_delete = False
    
    def preco_custo_unitario_display(self, obj):
        """Exibe o custo de baixa do insumo com 4 casas decimais."""
        custo = obj.preco_custo_unitario if obj.preco_custo_unitario is not None else Decimal('0.0000')
        return f"R$ {custo:,.4f}"
    preco_custo_unitario_display.short_description = 'Custo (Baixa)'

    def get_queryset(self, request):
        # Garante que inlines não tentem obter o QS se o objeto mestre não tiver um PK (nova requisição)
        qs = super().get_queryset(request)
        return qs

    def has_add_permission(self, request, obj):
        # Itens de requisição são gerados pela OP, não podem ser adicionados manualmente.
        return False
    
@admin.register(OrdemProducao)
class OrdemProducaoAdmin(admin.ModelAdmin):
    # ATUALIZADO: Usando produto_final para melhor visualização
    list_display = (
        'pk',
        'produto_final',
        'status', 
        'quantidade_a_produzir', 
        'data_emissao', 
        'data_conclusao',
        'responsavel'
    )
    list_filter = ('status',)
    search_fields = ('ficha_tecnica__produto_produzido__nome',)
    
    # NOVO: movimento_entrada_estoque deve ser somente leitura
    readonly_fields = ('data_emissao', 'movimento_entrada_estoque') 
    
    # NOVO: Inclui movimento_entrada_estoque nos campos
    fields = (
        'ficha_tecnica', 'quantidade_a_produzir', 'status', 
        'responsavel', 'data_conclusao', 'movimento_entrada_estoque'
    )
    raw_id_fields = ('ficha_tecnica', 'responsavel')

    # AÇÃO CRÍTICA: Removida a action customizada 'gerar_requisicao_insumo'
    # O signal post_save já lida com isso automaticamente ao salvar/mudar status para ABERTA/REQUISITANDO.
    
    def produto_final(self, obj):
        return obj.ficha_tecnica.produto_produzido.nome
    produto_final.short_description = 'Produto'


@admin.register(RequisicaoInsumo)
class RequisicaoInsumoAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'ordem_producao', 'status', 'data_requisicao', 'responsavel')
    list_filter = ('status',)
    search_fields = ('ordem_producao__ficha_tecnica__produto_produzido__nome',)
    
    # NOVO: movimento_saida_estoque deve ser somente leitura
    readonly_fields = ('data_requisicao', 'ordem_producao', 'movimento_saida_estoque')
    
    # NOVO: Inclui movimento_saida_estoque nos campos
    fields = ('ordem_producao', 'status', 'responsavel', 'data_requisicao', 'movimento_saida_estoque')
    raw_id_fields = ('ordem_producao', 'responsavel')
    inlines = [ItemRequisicaoInline]
    
    # A action de "Atender" não é mais necessária, pois o signal em producao/signals.py
    # dispara o MovimentoEstoque quando o status é alterado para ATENDIDA.
    
    def get_readonly_fields(self, request, obj=None):
        readonly = list(self.readonly_fields)
        # Se a requisição já foi atendida ou cancelada, todos os campos do cabeçalho são lidos
        if obj and obj.status in ('ATENDIDA', 'CANCELADA'):
            readonly.extend(['status', 'responsavel'])
        return readonly
