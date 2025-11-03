# config/urls.py (Versão 4 - Inclusão do módulo Caixa)
from django.contrib import admin
# Importamos 'include' para carregar as URLs de cada app
from django.urls import path, include
from django.conf import settings
# Método padrão e recomendado para servir estáticos em desenvolvimento
from django.conf.urls.static import static

urlpatterns = [
    # URLs do Django Admin (Onde o Jazzmin será aplicado)
    path('admin/', admin.site.urls),
    
    # URLs dos Nossos Apps
    path('', include('core.urls')), # URLs da base (Ex: login, logout, home)
    path('menu/', include('menu.urls')),
    path('estoque/', include('estoque.urls')),
    path('vendas/', include('vendas.urls')),
    path('compras/', include('compras.urls')),
    path('producao/', include('producao.urls')),
       # >>> NOVO MÓDULO CAIXA (PDV) <<<
    path('caixa/', include('caixa.urls')),
    
    # Futuro App Financeiro
    #path('financeiro/', include('financeiro.urls')),
]

# BLOCO PADRÃO: Serve arquivos estáticos APENAS em desenvolvimento (DEBUG=True)
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    # Adicionalmente, servimos arquivos de mídia, se aplicável (assumindo MEDIA_URL e MEDIA_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
