# compras/apps.py

from django.apps import AppConfig

class ComprasConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'compras'
    verbose_name = 'Módulo de Compras'

    # IMPORTANTE: Adicionar este método para carregar os signals
    def ready(self):
        import compras.signals
