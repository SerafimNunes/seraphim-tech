from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'
    # O verbose_name define como o App aparecerá no Django Admin (Jazzmin)
    verbose_name = '1. Base e Configurações'
