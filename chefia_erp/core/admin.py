# core/admin.py (VERSÃO FINAL PARA A TAREFA #4)

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin 
from django.contrib.auth.models import User      

# Importa todos os modelos do core, incluindo o NOVO ConfiguracaoGeral
from .models import UnidadeMedida, Usuario, Fornecedor, Cliente, ConfiguracaoGeral

# --------------------------------------------------------------------
# 1. DESREGISTRAR O USUÁRIO PADRÃO
# --------------------------------------------------------------------
# Isso deve ser feito para evitar conflito com o AUTH_USER_MODEL
try:
    admin.site.unregister(User)
except admin.sites.NotRegistered:
    pass 

# --------------------------------------------------------------------
# 2. USUÁRIO CUSTOMIZADO 
# --------------------------------------------------------------------

@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        (('Informações do ERP'), {'fields': ('telefone', 'cpf', 'sessao_caixa_ativa')}),
    )
    list_display = UserAdmin.list_display + ('cpf', 'telefone', 'sessao_caixa_ativa',)
    search_fields = UserAdmin.search_fields + ('cpf', 'telefone',)
    
# --------------------------------------------------------------------
# 3. UNIDADE DE MEDIDA 
# --------------------------------------------------------------------

@admin.register(UnidadeMedida)
class UnidadeMedidaAdmin(admin.ModelAdmin):
    list_display = ('nome', 'sigla', 'id')
    search_fields = ('nome', 'sigla')
    ordering = ('nome',)

# --------------------------------------------------------------------
# 4. MODELOS BASE (Fornecedor e Cliente)
# --------------------------------------------------------------------

'''@admin.register(Fornecedor)
class FornecedorAdmin(admin.ModelAdmin):
    list_display = ('nome', 'cnpj', 'telefone', 'email', 'ativo')
    search_fields = ('nome', 'cnpj')
    list_filter = ('ativo',)
   ''' 
'''@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ('nome', 'cpf_cnpj', 'telefone', 'data_cadastro')
    search_fields = ('nome', 'cpf_cnpj')
    list_filter = ('data_cadastro',)
'''
# --------------------------------------------------------------------
# 5. CONFIGURAÇÃO GERAL (SINGLETON - TAREFA #4)
# --------------------------------------------------------------------

@admin.register(ConfiguracaoGeral)
class ConfiguracaoGeralAdmin(admin.ModelAdmin):
    
    # Sobrescreve a permissão de ADICIONAR
    def has_add_permission(self, request):
        # Permite adicionar apenas se nenhuma instância existir
        return ConfiguracaoGeral.objects.count() == 0

    # Sobrescreve a permissão de DELETAR
    def has_delete_permission(self, request, obj=None):
        return False
        
    # Organização dos campos no formulário
    fieldsets = (
        (None, {
            'fields': ('nome_restaurante', 'cnpj', 'endereco_completo', 'telefone'),
            'description': "Informações de identificação da empresa, usadas em relatórios e notas."
        }),
        ('Configurações de Vendas e PDV', {
            'fields': ('imprime_cupom_fiscal', 'mensagem_cupom_fiscal'),
        }),
    )

    list_display = ('nome_restaurante', 'cnpj', 'data_ultima_edicao')
    readonly_fields = ('data_ultima_edicao',)
