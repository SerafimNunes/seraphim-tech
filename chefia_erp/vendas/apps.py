# ARQUIVO: vendas/apps.py (CORRIGIDO)
from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _

class VendasConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'vendas'
    verbose_name = _("4. Módulo de Vendas e PDV")
    
    def ready(self):
        """Método de inicialização do app. Importa os sinais para que sejam carregados pelo Django."""
        import vendas.signals # <<< ESSENCIAL PARA O FUNCIONAMENTO DOS SIGNALS
