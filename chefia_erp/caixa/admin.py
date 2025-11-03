# caixa/admin.py
from django.contrib import admin
from .models import Caixa, SessaoCaixa, MovimentoCaixa # Modelos criados na Fase 1
from django.utils.translation import gettext_lazy as _

# ====================================================================
# 1. Configuração de Cadastro de Caixas (PDVs)
# ====================================================================

@admin.register(Caixa)
class CaixaAdmin(admin.ModelAdmin):
    list_display = ('nome', 'descricao', 'ativo', 'get_status_ultima_sessao')
    list_filter = ('ativo',)
    search_fields = ('nome',)
    
    @admin.display(description=_('Último Status'))
    def get_status_ultima_sessao(self, obj):
        """Exibe o status da última sessão aberta/fechada para este caixa."""
        ultima_sessao = obj.sessoes.order_by('-data_abertura').first()
        if ultima_sessao:
            if ultima_sessao.status == 'ABERTO':
                return ultima_sessao.get_status_display()
            else:
                return _("Fechado")
        return _("Nunca Aberto")
    
    get_status_ultima_sessao.short_description = _("Status Atual")


# ====================================================================
# 2. Configuração de Sessão de Caixa (Abertura/Fechamento)
# ====================================================================

@admin.register(SessaoCaixa)
class SessaoCaixaAdmin(admin.ModelAdmin):
    list_display = (
        'caixa', 
        'usuario_abertura', 
        'data_abertura', 
        'get_data_fechamento_formatada',
        'status', 
        'valor_inicial', 
        'valor_final'
    )
    list_filter = ('status', 'caixa', 'data_abertura', 'usuario_abertura')
    search_fields = ('caixa__nome', 'usuario_abertura__username')
    
    # Campos que não podem ser alterados após a criação
    readonly_fields = ('data_abertura', 'data_fechamento', 'usuario_abertura', 'status')

    @admin.display(description=_('Data Fechamento'))
    def get_data_fechamento_formatada(self, obj):
        """Formata a data de fechamento, caso exista."""
        if obj.data_fechamento:
            return obj.data_fechamento.strftime('%d/%m/%Y %H:%M')
        return _("Em Aberto")


# ====================================================================
# 3. Configuração de Movimentações Avulsas
# ====================================================================

@admin.register(MovimentoCaixa)
class MovimentoCaixaAdmin(admin.ModelAdmin):
    list_display = ('sessao', 'get_caixa_nome', 'tipo', 'valor', 'descricao', 'data_movimento', 'usuario')
    list_filter = ('tipo', 'sessao__caixa', 'data_movimento', 'usuario')
    search_fields = ('descricao', 'sessao__caixa__nome', 'usuario__username')
    
    @admin.display(description=_('Caixa'))
    def get_caixa_nome(self, obj):
        """Exibe o nome do caixa da sessão."""
        return obj.sessao.caixa.nome
