# menu/models.py
from django.db import models
from estoque.models import Produto # Importamos o Produto, a base de tudo!
from decimal import Decimal

# 1. Modelo para as Categorias Visíveis no Cardápio (Ex: Hambúrgueres, Bebidas)
class CategoriaCardapio(models.Model):
    nome = models.CharField(max_length=100, unique=True, verbose_name="Nome da Categoria")
    descricao = models.TextField(blank=True, verbose_name="Descrição (Opcional)")
    ativa = models.BooleanField(default=True, verbose_name="Ativa no Cardápio")
    ordem = models.IntegerField(default=0, verbose_name="Ordem de Exibição")

    class Meta:
        verbose_name = "Categoria de Cardápio"
        verbose_name_plural = "Categorias de Cardápio"
        ordering = ['ordem', 'nome']

    def __str__(self):
        return self.nome

# 2. Modelo para o Item Individual do Cardápio
class ItemCardapio(models.Model):
    # Relacionamento OneToOne com Produto: Um item do estoque só pode ser listado uma vez no cardápio
    produto = models.OneToOneField(
        Produto, 
        on_delete=models.PROTECT, # Protege a exclusão se o produto estiver no cardápio
        verbose_name="Produto de Estoque",
        limit_choices_to={'is_vendavel': True} # VAMOS ADICIONAR ESTE CAMPO NO PRÓXIMO REFINAMENTO
    )
    categoria = models.ForeignKey(
        CategoriaCardapio, 
        on_delete=models.PROTECT, 
        related_name='itens', 
        verbose_name="Categoria do Cardápio"
    )
    # Descrição para marketing (diferente da descrição técnica do Produto)
    descricao_curta = models.CharField(max_length=255, blank=True, verbose_name="Descrição para Cardápio")
    disponivel = models.BooleanField(default=True, verbose_name="Disponível para Venda")

    class Meta:
        verbose_name = "Item de Cardápio"
        verbose_name_plural = "Itens de Cardápio"

    def __str__(self):
        return f"{self.produto.nome} ({self.categoria.nome})"
    
    # Propriedade para buscar o preço base de venda
    @property
    def preco_base(self):
        return self.produto.preco_venda if self.produto.preco_venda else Decimal('0.00')
