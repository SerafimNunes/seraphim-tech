# estoque/apps.py (CORRIGIDO)
from django.apps import AppConfig

class EstoqueConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'estoque'

    def ready(self):
        # Conecta os sinais ao carregar o aplicativo
        import estoque.signals
