# config/__init__.py (ADICIONE ISSO)

# Garante que o app Celery seja importado quando o Django iniciar.
from .celery import app as celery_app

__all__ = ('celery_app',)