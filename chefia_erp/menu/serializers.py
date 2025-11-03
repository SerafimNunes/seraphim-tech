#menu/serializer.py
from rest_framework import serializers
from .models import ItemCardapio, CategoriaCardapio

class ItemCardapioSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemCardapio
        fields = ['id', 'nome', 'descricao', 'preco_venda', 'disponivel']
        read_only_fields = fields # A API do PDV só lê produtos

class CategoriaCardapioSerializer(serializers.ModelSerializer):
    # Relacionamento: Exibe todos os itens de cada categoria
    itens = ItemCardapioSerializer(many=True, read_only=True, source='itemcardapio_set')

    class Meta:
        model = CategoriaCardapio
        fields = ['id', 'nome', 'itens']
        read_only_fields = fields # A API do PDV só lê categorias e itens
