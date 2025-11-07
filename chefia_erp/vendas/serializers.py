from rest_framework import serializers
from .models import Venda, ItemVenda
# Remova qualquer referência a StatusVenda que sobrou!

# 1. Serializer de ESCRITA de Item (usado para adicionar_itens)
class ItemVendaWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemVenda
        # Apenas os campos que o cliente enviará: produto, quantidade, nome_cliente_mesa
        fields = ['produto', 'quantidade', 'nome_cliente_mesa']


# 2. Serializer de LEITURA de Item (usado aninhado em VendaReadSerializer)
class ItemVendaReadSerializer(serializers.ModelSerializer):
    nome_produto = serializers.CharField(source='produto.nome', read_only=True)
    
    class Meta:
        model = ItemVenda
        # Incluindo 'nome_cliente_mesa' para leitura
        fields = ['id', 'produto', 'nome_produto', 'quantidade', 'preco_unitario', 'subtotal', 'nome_cliente_mesa']


# 3. Serializer de ESCRITA de Venda (usado para POST/PUT do cabeçalho)
class VendaWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Venda
        # Apenas os campos necessários para criar/atualizar a comanda (ex: mesa)
        fields = ['mesa']

    # >>> CORREÇÃO CRÍTICA: Sobrescreve `create` para aceitar o argumento extra `usuario_responsavel` <<<
    def create(self, validated_data, *args, **kwargs):
        """
        Sobrescreve create para receber `usuario_responsavel` passado pelo
        perform_create da ViewSet, evitando o TypeError.
        """
        # 1. Extrai o argumento que a view está passando
        usuario_responsavel = kwargs.pop('usuario_responsavel', None)
        
        # 2. CORREÇÃO PRINCIPAL: Garante que 'usuario_responsavel' NÃO está duplicado 
        # (se a view tentou passar de duas formas diferentes, o que pode acontecer)
        if 'usuario_responsavel' in validated_data:
            validated_data.pop('usuario_responsavel')

        # 3. Cria a instância, usando o valor de 'usuario_responsavel' capturado e o restante dos dados
        # Assume que o campo do Model é 'atendente'
        return Venda.objects.create(atendente=usuario_responsavel, **validated_data)
      

# 4. Serializer de LEITURA de Venda (usado para GET, e no retorno das actions)
class VendaReadSerializer(serializers.ModelSerializer):
    # Serializa o campo status para exibir o texto legível (ex: 'Em Aberto')
    status = serializers.CharField(source='get_status_display', read_only=True)
    # Assume related_name='itens' para Venda.
    itens = ItemVendaReadSerializer(many=True, read_only=True)
                                    
    class Meta:
        model = Venda
        # Assumindo que 'total_venda' é o campo de total final
        fields = ['id', 'mesa', 'status', 'total_venda', 'data_abertura', 'itens']
        read_only_fields = ['id', 'total_venda', 'data_abertura', 'status']