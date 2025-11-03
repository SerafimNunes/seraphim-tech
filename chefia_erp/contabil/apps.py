# contabil/apps.py

from django.apps import AppConfig

class ContabilConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'contabil'
    verbose_name = 'Módulo Contábil e Financeiro'

    # ADICIONE ISTO para carregar os signals
    def ready(self):
        # Importa os signals para garantir que sejam carregados apenas uma vez
        import contabil.signals # noqa
