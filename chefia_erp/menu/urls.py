# menu/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Cria um roteador para ViewSets
router = DefaultRouter()
router.register(r'categorias', views.CategoriaCardapioViewSet, basename='categoria')
router.register(r'itens', views.ItemCardapioViewSet, basename='item')

app_name = 'menu'

urlpatterns = [
    # Rotas para o módulo Admin/Views tradicionais (se houver)
    # ...
    
    # APIs do DRF
    path('api/', include(router.urls)), # Ex: /menu/api/categorias/
]
