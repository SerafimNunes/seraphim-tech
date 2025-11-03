# core/urls.py
from django.urls import path
from django.contrib.auth import views as auth_views 
from . import views

# O namespace é importante para referenciar as URLs como 'core:home'
app_name = 'core'

urlpatterns = [
    # 1. URL da página inicial (Dashboard/Home)
    # Usa a função 'home' definida no core/views.py
    path('', views.home, name='home'),
    
    # 2. URLs de Autenticação (Vistas prontas do Django)
    path(
        'login/',
        # Assumindo o template padrão de login
        auth_views.LoginView.as_view(template_name='registration/login.html'),
        name='login'
    ),
    path(
        'logout/',
        # Redireciona para a URL raiz ('/') após o logout, que forçará o login novamente.
        auth_views.LogoutView.as_view(next_page='/'), 
        name='logout'
    ),
    
    # 3. URL do Endpoint da API ChefIA (Assistente LLM)
    # Mapeia a função 'api_chefia' definida no core/views.py
    path('api/chefia/', views.api_chefia, name='api_chefia'),
]
