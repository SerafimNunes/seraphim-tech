# ARQUIVO: financeiro/apps.py (ADICIONE)
from django.apps import AppConfig


class FinanceiroConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'financeiro'

    def ready(self):
        # GARANTE QUE OS HANDLERS DE SINAIS SEJAM REGISTRADOS
        import financeiro.signals # <--- ADICIONE ESTA LINHA