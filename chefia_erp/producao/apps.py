# producao/apps.py

from django.apps import AppConfig

class ProducaoConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'producao'

    # ADICIONE ISTO para carregar os signals
    def ready(self):
        import producao.signals # noqa
