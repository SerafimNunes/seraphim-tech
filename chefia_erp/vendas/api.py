# ARQUIVO: vendas/api.py (COMPLETO E CORRIGIDO)
from django.shortcuts import get_object_or_404
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

# Importações corrigidas: Venda.Status agora existe em .models
from .models import Venda, ItemVenda, Comanda 
# Assumindo a existência dos serializers
from .serializers import VendaSerializer, VendaReadSerializer, ItemVendaSerializer 

# =========================================================================
# VIEWSETS
# =========================================================================

class VendaViewSet(viewsets.ReadOnlyModelViewSet):
    """API para visualização e gerenciamento das Vendas (Faturas)."""
    queryset = Venda.objects.all() 
    serializer_class = VendaReadSerializer
    filterset_fields = ['status', 'data_venda']


class ComandaViewSet(viewsets.ModelViewSet):
    """API para Comandas (Pedidos Abertos/Rascunho) - O coração do PDV."""
    # Queryset filtrado por Venda.Status.ABERTA (CORRIGIDO)
    queryset = Venda.objects.filter(status=Venda.Status.ABERTA).select_related('cliente', 'mesa').prefetch_related('itens_venda')
    serializer_class = VendaSerializer
    
    # Ação customizada para FECHAR a Comanda (Pagamento/Faturamento)
    @action(detail=True, methods=['post'])
    def fechar(self, request, pk=None):
        """Altera o status da Comanda para FATURADA (Pagamento/Faturamento)."""
        venda = self.get_object()
        
        if venda.status != Venda.Status.ABERTA:
            return Response({"detail": "Esta comanda não está em estado para ser fechada."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # CORREÇÃO: Usando FATURADA, o status correto
            venda.status = Venda.Status.FATURADA 
            venda.data_faturamento = timezone.now()
            venda.save()

            read_serializer = VendaReadSerializer(venda)
            return Response(read_serializer.data, status=status.HTTP_200_OK)

    # Ação customizada para REABRIR a Comanda (para ajustes)
    @action(detail=True, methods=['post'])
    def reabrir(self, request, pk=None):
        """Altera o status da Comanda para ABERTA, permitindo novos lançamentos."""
        venda = get_object_or_404(Venda, pk=pk) 
        
        # O uso de Venda.Status.ABERTA AGORA FUNCIONA
        if venda.status == Venda.Status.ABERTA:
            return Response({"detail": "Esta comanda já está aberta."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            venda.status = Venda.Status.ABERTA
            venda.data_faturamento = None
            venda.data_cancelamento = None
            venda.save()
            
            read_serializer = VendaReadSerializer(venda)
            return Response(read_serializer.data, status=status.HTTP_200_OK)


class ItemVendaViewSet(viewsets.ModelViewSet):
    """API para manipulação dos Itens da Comanda."""
    queryset = ItemVenda.objects.all()
    serializer_class = ItemVendaSerializer

    def perform_create(self, serializer):
        # Lógica de validação do status da Venda (deve estar ABERTA)
        if serializer.validated_data['venda'].status != Venda.Status.ABERTA:
            raise ValidationError("Não é possível adicionar itens a uma venda que não está ABERTA.")
        serializer.save()
