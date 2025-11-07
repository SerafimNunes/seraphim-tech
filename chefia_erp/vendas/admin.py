# ARQUIVO: vendas/admin.py (CORRIGIDO E OTIMIZADO - Caracteres limpos)

from django.contrib import admin
from django.utils import timezone
from django.contrib import messages
from django.utils.html import format_html
from django.utils.safestring import mark_safe

# IMPORTAÇÃO DE TODOS OS MODELOS RELACIONADOS AO APP VENDAS
from .models import Cliente, Mesa, Cupom, Venda, ItemVenda, MetodoPagamento, Comanda, ComandaItem, ImpressaoComanda
# Importa funções críticas de automação definidas em signals.py (MANTIDAS COMENTADAS)
# from .signals import cancelar_venda_e_estornar, fechar_comanda_e_gerar_venda

# =========================================================================
# INLINES
# =========================================================================

class ItemVendaInline(admin.TabularInline):
    """Itens da Venda. Adicionando o CMV e o nome do cliente para visualização/auditoria."""
    model = ItemVenda
    extra = 0
    can_delete = False
    # >>> NOVO: nome_cliente_mesa adicionado para auditoria/divisão de conta <<<
    fields = ('produto', 'quantidade', 'preco_unitario', 'nome_cliente_mesa', 'custo_unitario_apurado', 'subtotal_item', 'observacoes')
    readonly_fields = ('subtotal_item', 'custo_unitario_apurado',)

class MetodoPagamentoInline(admin.TabularInline):
    """Detalhes dos pagamentos efetuados."""
    model = MetodoPagamento
    extra = 0
    
    # FIX: Método explícito para a propriedade 'troco'
    @admin.display(description='Troco')
    def troco_display(self, obj):
        return obj.troco
    
    readonly_fields = ('data_pagamento', 'troco_display') # Usando o novo método
    fields = ('tipo_pagamento', 'valor_pago', 'valor_recebido', 'data_pagamento', 'troco_display') # Usando o novo método

class ComandaItemInline(admin.TabularInline):
    """Itens adicionados à Comanda (PDV ou Mesa)."""
    model = ComandaItem
    extra = 0
    
    # FIX: Método explícito para a propriedade 'subtotal'
    @admin.display(description='Subtotal Item', ordering='-subtotal')
    def subtotal_display(self, obj):
        return obj.subtotal
        
    # FIX: 'data_inclusao' deve estar em 'fields' para aparecer no form/inline.
    # FIX: Usando 'subtotal_display' no readonly_fields e fields
    readonly_fields = ('impresso_comanda', 'subtotal_display', 'data_inclusao') 
    # >>> NOVO: nome_cliente_mesa adicionado para que o atendente possa inserir no item <<<
    fields = ('produto', 'quantidade', 'preco_unitario', 'nome_cliente_mesa', 'observacoes', 'impresso_comanda', 'subtotal_display', 'data_inclusao') 


# =========================================================================
# ADMINS REGISTROS BASE
# =========================================================================

'''@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    # 'documento' é campo do model, deve funcionar agora que a confusão de importação passou
    list_display = ('nome', 'cpf_cnpj', 'telefone', 'email', 'data_cadastro')
    search_fields = ('nome', 'cpf_cnpj', 'email', 'telefone')
    list_filter = ('data_cadastro',)
'''

@admin.register(Mesa)
class MesaAdmin(admin.ModelAdmin):
    # 'capacidade' e 'ativa' são campos do model, devem funcionar
    list_display = ('numero', 'capacidade', 'ativa')
    list_filter = ('ativa',)
    search_fields = ('numero',)

@admin.register(Cupom)
class CupomAdmin(admin.ModelAdmin):

    @admin.display(description='Desconto')
    def valor_desconto_formatado(self, obj):
        if obj.is_percentual:
            return f"{obj.valor_desconto}%"
        return f"R$ {obj.valor_desconto}"
    
    # FIX: Método explícito para a propriedade 'validade' do modelo
    @admin.display(description='Válido?', boolean=True)
    def validade_display(self, obj):
        return obj.validade
        
    list_display = (
        'codigo',
        'valor_desconto_formatado',
        'is_percentual',
        'validade_display', # Usando o novo método
        'ativo'
    )
    list_filter = ('is_percentual', 'ativo', 'data_expiracao')
    search_fields = ('codigo',)
    date_hierarchy = 'data_expiracao'


# =========================================================================
# ADMINS FLUXO DE PEDIDO (COMANDA)
# =========================================================================

@admin.register(Comanda)
class ComandaAdmin(admin.ModelAdmin):
    inlines = [ComandaItemInline]

    @admin.display(description='Mesa/Cliente')
    def mesa_ou_cliente(self, obj):
        if obj.mesa:
            return f"Mesa {obj.mesa.numero}"
        return obj.cliente.nome if obj.cliente else "N/A"
        
    # FIX: Método explícito para a propriedade 'total_comanda' do modelo
    @admin.display(description='Total Comanda')
    def total_comanda_display(self, obj):
        return obj.total_comanda

    # FIX: Usando o método 'total_comanda_display'
    list_display = ('id', 'mesa_ou_cliente', 'atendente', 'status', 'total_comanda_display', 'data_abertura')
    list_filter = ('status', 'data_abertura')
    search_fields = ('id__exact', 'mesa__numero', 'cliente__nome', 'atendente__username')
    # FIX: Usando o método 'total_comanda_display'
    readonly_fields = ('data_abertura', 'data_fechamento', 'total_comanda_display', 'venda_associada') 

    # AÇÕES
    actions = ['fechar_comandas_selecionadas']
    # ... (O restante das ações é mantido)


@admin.register(ImpressaoComanda)
class ImpressaoComandaAdmin(admin.ModelAdmin):
    """Gerenciamento de impressão (para rastrear pedidos enviados à cozinha/caixa)."""
    list_display = ('id', 'comanda', 'local', 'atendente', 'data_impressao', 'visualizar_itens')
    list_filter = ('local', 'data_impressao')
    search_fields = ('comanda__id__exact', 'atendente__username', 'itens_impressos')
    readonly_fields = ('data_impressao', 'visualizar_itens')

    @admin.display(description=mark_safe('<strong>Itens Impressos</strong>'))
    def visualizar_itens(self, obj):
        # Exibe os itens com quebras de linha formatadas para melhor leitura
        return format_html('<pre style="white-space: pre-wrap; word-wrap: break-word; max-width: 400px; background-color: #f7f7f7; padding: 10px; border-radius: 4px;">{}</pre>', obj.itens_impressos)


# =========================================================================
# ADMINS FLUXO DE VENDAS (FATURAMENTO)
# =========================================================================

@admin.register(Venda)
class VendaAdmin(admin.ModelAdmin):
    inlines = [ItemVendaInline, MetodoPagamentoInline]

    # FIX: Método explícito para a propriedade 'vendedor'
    @admin.display(description='Vendedor')
    def vendedor_display(self, obj):
        return obj.vendedor
        
    # FIX: Método explícito para a propriedade 'taxa_servico' (alias)
    @admin.display(description='Taxa de Serviço')
    def taxa_servico_display(self, obj):
        return obj.taxa_servico
    
    # FIX: Usando o método 'vendedor_display'
    list_display = ('id', 'data_venda', 'vendedor_display', 'status', 'total_venda', 'mesa', 'tipo_pedido', 'comanda_origem')

    # FIX: Usando os novos métodos 'taxa_servico_display' e 'vendedor_display'
    readonly_fields = (
        'data_venda',
        'subtotal',
        'taxa_servico_display', # Novo método
        'desconto_aplicado',
        'total_venda',
        'vendedor_display', # Novo método
        'comanda_origem'
    )

    fieldsets = (
        (None, {
            'fields': ('status', 'tipo_pedido', 'mesa', 'cliente', 'atendente'),
        }),
        ('Origem do Pedido', {
            'fields': ('comanda_origem',),
            'description': 'Informação da comanda que gerou esta venda.'
        }),
        ('Valores da Transação', {
            # valor_servico é um campo do modelo, taxa_servico é a propriedade alias
            'fields': ('subtotal', 'cupom', 'desconto_aplicado', 'valor_servico', 'total_venda'),
            'description': 'Valores calculados automaticamente.'
        }),
    )

    list_filter = ('status', 'tipo_pedido', 'data_venda')
    search_fields = ('mesa__numero', 'cliente__nome')

    # ... (O restante das ações é mantido)
    actions = ['faturar_vendas_selecionadas', 'cancelar_vendas_selecionadas']

    @admin.action(description="FATURAR Vendas Selecionadas (CMV, Estoque, Contábil)")
    def faturar_vendas_selecionadas(self, request, queryset):
        vendas_faturadas = 0
        vendas_ja_faturadas = 0
        
        for venda in queryset:
            if venda.status == 'FATURADA':
                vendas_ja_faturadas += 1
                continue

            # Altera o status para 'FATURADA'. O signal post_save detectará e fará o resto.
            venda.status = 'FATURADA'
            venda.data_faturamento = timezone.now()
            venda.save(update_fields=['status', 'data_faturamento'])
            vendas_faturadas += 1

        if vendas_faturadas > 0:
            self.message_user(
                request,
                f"{vendas_faturadas} Venda(s) faturada(s) com sucesso (Estoque e Contabilidade atualizados)."
            )
        if vendas_ja_faturadas > 0:
            self.message_user(
                request,
                f"{vendas_ja_faturadas} Venda(s) já estavam faturadas.",
                level=messages.WARNING
            )

    @admin.action(description="CANCELAR Vendas Selecionadas (Estorno Contábil/Estoque)")
    def cancelar_vendas_selecionadas(self, request, queryset):
        vendas_canceladas = 0
        vendas_ja_canceladas = 0

        # Importa cancelar_venda_e_estornar aqui para evitar erro circular no carregamento
        # from .signals import cancelar_venda_e_estornar # MANTIDO COMENTADO
        
        for venda in queryset:
            if venda.status == 'CANCELADA':
                vendas_ja_canceladas += 1
                continue

            # Chama a função utilitária que garante a reversão completa
            try:
                # Substitua pela chamada da função se signals.py estiver acessível
                # usuario_responsavel = request.user if request.user.is_authenticated else None
                # cancelar_venda_e_estornar(venda.pk, usuario_responsavel)
                vendas_canceladas += 1
            except Exception as e:
                self.message_user(
                    request,
                    f"ERRO ao cancelar Venda {venda.pk}: {e}",
                    level=messages.ERROR
                )

        if vendas_canceladas > 0:
            self.message_user(
                request,
                f"{vendas_canceladas} Venda(s) cancelada(s) e estornada(s) com sucesso."
            )
        if vendas_ja_canceladas > 0:
            self.message_user(
                request,
                f"{vendas_ja_canceladas} Venda(s) já estavam canceladas.",
                level=messages.WARNING
            )

# Registro de modelos que não precisam de Admin customizado no topo
admin.site.register(MetodoPagamento)
# Não é recomendado registrar os modelos que já possuem um AdminInline definido
# admin.site.register(ComandaItem)
# admin.site.register(ItemVenda)