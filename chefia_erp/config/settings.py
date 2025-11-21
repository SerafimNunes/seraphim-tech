#config/settings.py
"""
Django settings for config project.
"""

import os
import sys
from pathlib import Path
from decouple import config

# Definição do diretório base do projeto (corrigido e descomentado).
# Assumimos que settings.py está em 'config/' e queremos o diretório pai.
BASE_DIR = Path(__file__).resolve().parent.parent

# ==============================================================================
# 1. VARIÁVEIS DE AMBIENTE E SEGURANÇA (LIDANDO COM O .ENV)
# ==============================================================================
SECRET_KEY = config('SECRET_KEY', default='django-insecure-muda-essa-chave-na-producao')
DEBUG = config('DEBUG', default=True, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='127.0.0.1,localhost,testserver,192.168.1.4,0.0.0.0').split(',')
CSRF_TRUSTED_ORIGINS = ['http://localhost', 'http://127.0.0.1', 'http://192.168.1.4:8000']

# ==============================================================================
# 2. CONFIGURAÇÃO DE APLICATIVOS (APPS)
# ==============================================================================

# Apps padrão do Django
DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

# Apps de terceiros (jazzmin deve vir primeiro)
THIRD_PARTY_APPS = [
    'jazzmin',
    'simple_history', # <-- Manter para Auditoria
    'rest_framework', # <-- NOVO: Adicionado o Django REST Framework para APIs
    'django_extensions', # <-- adicionado
    'crispy_forms',
    'crispy_bootstrap5',
    
    # --- R3: ADIÇÃO CELERY ---
    'django_celery_results', # Necessário para armazenar o status das tasks no DB (Usado pelo CELERY_RESULT_BACKEND)
    # --- FIM R3: ADIÇÃO CELERY ---
]

# Nossos Apps customizados (Todos ativados e ordenados)
LOCAL_APPS = [
    # 1. Base e Configurações
    'core.apps.CoreConfig',

    # 2. ERP Apps
    'menu.apps.MenuConfig',
    'estoque.apps.EstoqueConfig',
    'vendas.apps.VendasConfig',
    'compras.apps.ComprasConfig',
    'producao.apps.ProducaoConfig',
    'caixa.apps.CaixaConfig',
    'financeiro.apps.FinanceiroConfig',

    # Próximos Apps (Já inclusos para evitar erros futuros)
    'contabil.apps.ContabilConfig',
]

# Configuração para Django Crispy Forms
# Define o template pack que será usado para renderizar os formulários
CRISPY_ALLOWED_TEMPLATE_PACKS = "bootstrap5"
CRISPY_TEMPLATE_PACK = "bootstrap5"
# ORDEM CRÍTICA: jazzmin deve vir antes de django.contrib.admin
INSTALLED_APPS = THIRD_PARTY_APPS + DJANGO_APPS + LOCAL_APPS

# ==============================================================================
# 3. MIDDLEWARE E URLs
# ==============================================================================

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',

    # Adicionado: Middleware necessário para registrar o usuário na Auditoria
    'simple_history.middleware.HistoryRequestMiddleware',
]

# CORRIGIDO: Referências para a pasta 'config'
ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'

# ==============================================================================
# 4. BANCO DE DADOS (POSTGRESQL - Uso de decouple e placeholder de senha)
# ==============================================================================

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME', default='chefia_db'),
        'USER': config('DB_USER', default='serafim_user'),
        'PASSWORD': config('DB_PASSWORD', default='2327512-0'), # Removido valor real (mude no .env)
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),
    }
}

# ==============================================================================
# 5. TEMPLATES
# ==============================================================================

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'templates')], # Adicionado diretório global de templates
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# ==============================================================================
# 6. VALIDADORES DE SENHA E LOCALIZAÇÃO
# ==============================================================================

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',},
]

LANGUAGE_CODE = 'pt-br'
TIME_ZONE = 'America/Sao_Paulo'
USE_I18N = True
USE_TZ = True # Crucial para o Celery usar o timezone correto

# ==============================================================================
# 7. ARQUIVOS ESTÁTICOS
# ==============================================================================

STATIC_URL = 'static/'
STATICFILES_DIRS = [
    BASE_DIR / 'static',
]
STATIC_ROOT = BASE_DIR / 'staticfiles'

# ==============================================================================
# 8. CONFIGURAÇÕES DE EMAIL (Placeholder)
# ==============================================================================

EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# ==============================================================================
# 9. PRIMARY KEY FIELD TYPE
# ==============================================================================

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ==============================================================================
# 10. CONFIGURAÇÕES JAZZMIN
# ==============================================================================
JAZZMIN_SETTINGS = {
    "site_title": "Chefia ERP",
    "site_header": "Chefia ERP",
    "site_brand": "ChefIA",
    "welcome_sign": "Bem-vindo ao Chefia ERP.",
    "site_url": "/",
    "copyright": "Chefia ERP - Todos os direitos reservados",
    # ORDEM CORRIGIDA: Garante que os apps apareçam na ordem correta
    "order_with_respect_to": ["auth", "core", "menu", "estoque", "vendas", "compras", "producao", "comercial", "financeiro"],
    
    # Outros estilos e configurações do Jazzmin podem ser adicionados aqui
    "usermenu_links": [
        {"name": "Suporte Chefia", "url": "https://example.com", "new_window": True},
        {"model": "auth.User"},
    ],

    # Estilos de UI
    "custom_css": None,
    "custom_js": None,
    "show_sidebar": True,
    "navigation_expanded": True,
    "hide_apps": [],
    "hide_models": [],
    "topmenu_links": [
        {"name": "Home", "url": "admin:index", "permissions": ["auth.view_user"]},
        {"app": "vendas"},
        {"app": "estoque"},
        {"model": "auth.User"},
    ],
}

# ==============================================================================
# 11. CONFIGURAÇÕES DRF (DJANGO REST FRAMEWORK)
# ==============================================================================
REST_FRAMEWORK = {
    # Usamos SessionAuthentication para integração com o Front-end baseado em Template
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework.authentication.SessionAuthentication',
    ),
    # Permissão padrão: Apenas usuários autenticados (IsAuthenticated)
    # Garante que apenas funcionários logados (via /admin ou tela de login) acessem as APIs operacionais.
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    # Configuração de paginação padrão para listas longas
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.LimitOffsetPagination',
    'PAGE_SIZE': 100, # Valor alto para APIs de Cardápio/listas operacionais.
    
    # Renderers: O BrowsableAPIRenderer é útil para debugar e visualizar as APIs no navegador.
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ],
}
# 12. AUTHENTICATION (Usuário Customizado)
# ==============================================================================
AUTH_USER_MODEL = 'core.Usuario'

# ==============================================================================
# 13. CELERY CONFIGURATION (ASSINCRONISMO R3)
# ==============================================================================

# 🚨 CONFIGURAÇÃO CELERY PARA FATURAMENTO ASSÍNCRONO (R3)
# --------------------------------------------------------------------------
# Configuração do Broker (RabbitMQ ou Redis)
# RECOMENDAÇÃO: Use Redis
CELERY_BROKER_URL = 'redis://localhost:6379/0'  # Altere se o Redis estiver em outro host/porta
CELERY_RESULT_BACKEND = 'redis://localhost:6379/0'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE # Reutiliza o TIME_ZONE ('America/Sao_Paulo') definido acima
# Mantido como False para rastrear o status de processamento da Venda
CELERY_TASK_IGNORE_RESULT = False 

# ==============================================================================
# 14. OUTRAS CONFIGURAÇÕES (Placeholder)
# ==============================================================================

# ... (Qualquer outra configuração específica que você tenha)