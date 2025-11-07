# config/celery.py (NECESSÁRIO PARA INICIAR O WORKER)

from __future__ import absolute_import, unicode_literals
import os
from celery import Celery

# Define o módulo de configurações do Django
# 'config' é o nome do seu projeto principal
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('config')

# Usa a configuração do Django settings
# O prefixo CELERY_ significa que Celery encontrará suas variáveis
# automaticamente (CELERY_BROKER_URL, CELERY_RESULT_BACKEND, etc.)
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-descobre tasks em todos os apps instalados (incluindo vendas/tasks.py)
app.autodiscover_tasks()

# Exemplo de task de depuração (opcional, mas útil)
@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')