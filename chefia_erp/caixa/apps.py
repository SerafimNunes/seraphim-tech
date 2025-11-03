# caixa/apps.py
from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _

class CaixaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'caixa'
    verbose_name = _("3. Controle de Caixa (PDV)")

    def ready(self):
        """
        Garante que os signals de integração (post_save de PagamentoVenda)
        sejam registrados no startup do Django.
        """
        try:
            # Importa o módulo signals para registrar as funções @receiver
            import caixa.signals
        except ImportError:
            # Evita falha se o arquivo signals for excluído ou renomeado
            pass
