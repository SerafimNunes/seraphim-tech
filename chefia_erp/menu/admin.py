# menu/admin.py (VERSÃO FINAL E CORRIGIDA)
from django.contrib import admin
from django.utils.html import format_html
from .models import CategoriaCardapio, ItemCardapio
from estoque.models import Produto 
from decimal import Decimal # Necessário para garantir que o tipo Decimal seja tratado

# ... CategoriaCardapioAdmin (Mantenha igual) ...
@admin.register(CategoriaCardapio)
class CategoriaCardapioAdmin(admin.ModelAdmin):
    list_display = ('nome', 'ordem', 'ativa', 'descricao')
    list_editable = ('ordem', 'ativa')
    list_filter = ('ativa',)
    search_fields = ('nome',)
    fields = ('nome', 'descricao', 'ordem', 'ativa')

# ---
@admin.register(ItemCardapio)
class ItemCardapioAdmin(admin.ModelAdmin):
    # preco_base_display agora é um método.
    list_display = ('produto_nome', 'categoria', 'preco_base_display', 'disponivel')
    list_filter = ('categoria', 'disponivel')
    search_fields = ('produto__nome', 'categoria__nome')
    raw_id_fields = ('produto',) 
    
    # 1. readonly_fields deve conter o nome do método que queremos exibir como somente leitura.
    readonly_fields = ('preco_base_display',)
    
    # 2. fieldsets deve incluir o campo de somente leitura.
    # NOTA: O campo precisa ser incluído em `fieldsets` para aparecer, e em `readonly_fields`
    # para não tentar ser salvo no banco.
    fieldsets = (
        (None, {
            'fields': ('produto', 'categoria', 'disponivel')
        }),
        ('Preço (Definido no Estoque)', {
            # Inclui o campo de SOMENTE LEITURA
            'fields': ('preco_base_display',) 
        }),
        ('Informações de Exibição', {
            'fields': ('descricao_curta',)
        }),
    )
    
    # ... LÓGICA DE FILTRAGEM (Mantenha igual) ...
    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "produto":
            kwargs["queryset"] = Produto.objects.filter(is_vendavel=True)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)
        
    def produto_nome(self, obj):
        return obj.produto.nome if obj.produto else 'N/A'
    produto_nome.short_description = 'Produto'
        
    # 3. CORRIGIDO: Método para exibir o preço base de venda.
    # Não usamos format_html em torno do f-string, usamos apenas a formatação de string 
    # segura (f-string) para evitar o conflito de SafeString.
    def preco_base_display(self, obj):
        # A @property preco_base já garante que teremos um Decimal.
        # Formatamos o Decimal como uma string de moeda e usamos format_html para 
        # marcá-la como HTML seguro para exibição.
        valor_decimal = obj.preco_base 
        preco_formatado = f'R$ {valor_decimal:.2f}'
        return format_html(preco_formatado) # format_html precisa ser usado no final se for para retornar um HTML.

    preco_base_display.short_description = 'Preço de Venda (Estoque)'
