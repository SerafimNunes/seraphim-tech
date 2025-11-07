# ====================================================================
# ARQUIVO: chefia_erp/core/admin.py (COMPLETO E CORRIGIDO)
# Todos os modelos base de lookup/apoio são registrados aqui.
# ====================================================================

from django.contrib import admin
# Importamos o Admin padrão e o modelo Group para customização da UX
from django.contrib.auth.admin import UserAdmin, GroupAdmin as DefaultGroupAdmin 
from django.contrib.auth.models import User, Group
# Importa todos os modelos do core, incluindo Categoria (AGORA INCLUÍDA)
from .models import (
    UnidadeMedida, Usuario, Fornecedor, Cliente, ConfiguracaoGeral,
    Categoria  # 🚨 ADICIONADO: Necessário para o autocomplete em outros apps
) 

# --------------------------------------------------------------------
# 1. DESREGISTRAR MODELOS PADRÃO (USER E GROUP)
# --------------------------------------------------------------------
# Isso deve ser feito para evitar conflito com o AUTH_USER_MODEL
try:
    admin.site.unregister(User)
except admin.sites.NotRegistered:
    pass

# --------------------------------------------------------------------
# 1.1. CORREÇÃO UX: GRUPOS (RESOLVENDO O PROBLEMA DO FILTRO REPETITIVO)
# --------------------------------------------------------------------

class CustomGroupAdmin(DefaultGroupAdmin):
    """
    Melhora a UX na edição de grupos, usando filter_horizontal para permissões.
    Isso corrige o problema das opções se repetindo, tornando a lista mais amigável.
    """
    # Esta linha é o fix: usa uma interface de caixas duplas
    filter_horizontal = ('permissions',)

# Desregistra o Admin padrão do Django para o modelo Group
try:
    admin.site.unregister(Group)
except admin.sites.NotRegistered:
    pass

# Registra a versão customizada do Group Admin
admin.site.register(Group, CustomGroupAdmin)
    
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
# 3. MODELOS DE APOIO (Categoria e Unidade de Medida)
# --------------------------------------------------------------------

# 🚨 NOVO ADMIN: Essencial para que ProdutoAdmin (em estoque) possa usar 'categoria' em autocomplete_fields
@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ('nome', 'ativo')
    search_fields = ('nome',)
    list_filter = ('ativo',)
    ordering = ('nome',)


@admin.register(UnidadeMedida)
class UnidadeMedidaAdmin(admin.ModelAdmin):
    list_display = ('nome', 'sigla', 'id')
    search_fields = ('nome', 'sigla')
    ordering = ('nome',)

# --------------------------------------------------------------------
# 4. MODELOS BASE (Fornecedor e Cliente - AGORA REGISTRADOS)
# --------------------------------------------------------------------

@admin.register(Fornecedor)
class FornecedorAdmin(admin.ModelAdmin):
    # Descomentado e registrado
    list_display = ('nome', 'cnpj', 'telefone', 'email', 'ativo')
    search_fields = ('nome', 'cnpj')
    list_filter = ('ativo',)
    
@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    # Descomentado e registrado
    list_display = ('nome', 'cpf_cnpj', 'telefone', 'data_cadastro')
    search_fields = ('nome', 'cpf_cnpj')
    list_filter = ('data_cadastro',)

# --------------------------------------------------------------------
# 5. CONFIGURAÇÃO GERAL (SINGLETON)
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