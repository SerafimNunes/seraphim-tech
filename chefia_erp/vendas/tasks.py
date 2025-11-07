# vendas/tasks.py (TASK LIMPA PARA R9)

from celery import shared_task
from django.db import transaction
from vendas.models import Venda
from vendas.services import VendaService # IMPORTA O SERVICE LAYER
import logging

logger = logging.getLogger(__name__)

# Exceção customizada para interrupção de negócio (Pode ser removida se não usada, mas mantemos para segurança)
class EstoqueInsuficienteError(Exception):
    pass


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def processar_faturamento_venda(self, venda_pk):
    """
    R9: ORQUESTRADOR. Apenas chama a lógica no Service Layer e gerencia retentativas.
    """
    logger.info(f"Task Celery: Iniciando orquestração de faturamento para Venda {venda_pk}.")

    try:
        # CHAMA O SERVICE LAYER ONDE A LÓGICA DE NEGÓCIO ESTÁ
        resultado = VendaService.processar_faturamento_async(venda_pk)
        return resultado

    except EstoqueInsuficienteError as exc:
        # A lógica de Estoque Insuficiente é tratada pelo Service e o status revertido.
        # Não precisa de retentativa do Celery.
        logger.error(f"Erro de Estoque: Venda {venda_pk} falhou por falta de saldo. Task abortada.")
        return f"Venda {venda_pk} falhou: Estoque Insuficiente. Status revertido para Aberta."
        
    except Exception as exc:
        # Outros erros de sistema (conexão, DB, etc.)
        logger.error(f"Erro de Sistema: Falha ao processar Venda {venda_pk}. Retentando: {exc}")
        # Se for um erro do Service, Celery tenta novamente
        raise self.retry(exc=exc)