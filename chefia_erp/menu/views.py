# menu/views.py
from rest_framework import viewsets
from .models import ItemCardapio, CategoriaCardapio
from .serializers import ItemCardapioSerializer, CategoriaCardapioSerializer
from rest_framework.permissions import IsAuthenticatedOrReadOnly

# ViewSet para o Cardápio (Somente Leitura - essencial para o PDV)
class CategoriaCardapioViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CategoriaCardapio.objects.all().prefetch_related('itemcardapio_set')
    serializer_class = CategoriaCardapioSerializer
    # Permite leitura por qualquer um (IsAuthenticatedOrReadOnly)
    # se o cardápio for público, mas IsAuthenticated é mais seguro em um ERP
    permission_classes = [IsAuthenticatedOrReadOnly]

class ItemCardapioViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ItemCardapio.objects.filter(disponivel=True)
    serializer_class = ItemCardapioSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
