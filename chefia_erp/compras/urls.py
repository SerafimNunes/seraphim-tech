# ==============================================================================
# ARQUIVO: compras/urls.py (COMPLETO E CORRIGIDO)
# R6: Adiciona URL para API de Recebimento
# ==============================================================================
from django.urls import path
from .views import receber_compra_api # Importa a nova view (R6)

app_name = 'compras'

urlpatterns = [
    # API para recebimento de pedidos de compra (Para o fluxo de R1)
    path('api/recebimento/<int:pedido_pk>/', receber_compra_api, name='api_receber_compra'),
    
    # URLs do módulo de Compras (outras)
]