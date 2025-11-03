# estoque/urls.py
from django.urls import path
from .views import estoque_resumo, requisitar_estoque_api, finalizar_contagem_flv_api

app_name = 'estoque'

urlpatterns = [
    # API Views (Integração com outros módulos)
    path('api/requisitar/', requisitar_estoque_api, name='api_requisitar_estoque'),
    path('api/finalizar_contagem_flv/', finalizar_contagem_flv_api, name='api_finalizar_contagem_flv'),
    
    # Custom Admin View (Resumo/Dashboard)
    path('resumo/', estoque_resumo, name='estoque_resumo'),
]
