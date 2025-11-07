# ==============================================================================
# ARQUIVO: chefia_erp/estoque/apps.py (Garantia de Carregamento)
# ==============================================================================
from django.apps import AppConfig


class EstoqueConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'estoque'
    
    def ready(self):
        # O Django só registra os signals se você os importar aqui.
        # Esta linha garante que estoque/signals.py seja lido ao iniciar o app.
        import estoque.signals # noqa