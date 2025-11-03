from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Cria um roteador para ViewSets do DRF
router = DefaultRouter()
# Define a rota principal para as Comandas (Vendas/Mesas)
router.register(r'comandas', views.ComandaViewSet, basename='comanda')

app_name = 'vendas'

urlpatterns = [
    # Todas as APIs de vendas (comandas e ações) serão prefixadas por /vendas/api/
    path('api/', include(router.urls)),
]
