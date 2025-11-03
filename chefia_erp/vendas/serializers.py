#vendas/serializer.py
# ARQUIVO: vendas/serializers.py (Conteúdo ATUALIZADO)

from rest_framework import serializers
from .models import Venda, ItemVenda
# Remova qualquer referência a StatusVenda que sobrou!

# 1. Serializer de ESCRITA de Item (usado para adicionar_itens)
class ItemVendaWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemVenda
        # Apenas os campos que o cliente enviará: produto e quantidade
        fields = ['produto', 'quantidade']


# 2. Serializer de LEITURA de Item (usado aninhado em VendaReadSerializer)
class ItemVendaReadSerializer(serializers.ModelSerializer):
    nome_produto = serializers.CharField(source='produto.nome', read_only=True)
    
    class Meta:
        model = ItemVenda
        fields = ['id', 'produto', 'nome_produto', 'quantidade', 'preco_unitario', 'subtotal']


# 3. Serializer de ESCRITA de Venda (usado para POST/PUT do cabeçalho)
class VendaWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Venda
        # Apenas os campos necessários para criar/atualizar a comanda (ex: mesa)
        fields = ['mesa_comanda'] 


# 4. Serializer de LEITURA de Venda (usado para GET, e no retorno das actions)
class VendaReadSerializer(serializers.ModelSerializer):
    # Serializa o campo status para exibir o texto legível (ex: 'Em Aberto')
    status = serializers.CharField(source='get_status_display', read_only=True) 
    # Usa o Serializer de Leitura do Item
    itens = ItemVendaReadSerializer(many=True, read_only=True) 
                                                                    
    class Meta:
        model = Venda
        fields = ['id', 'mesa_comanda', 'status', 'total', 'data_abertura', 'itens'] 
        read_only_fields = ['id', 'total', 'data_abertura', 'status']
