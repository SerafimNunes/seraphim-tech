# ==============================================================================
# ARQUIVO: compras/signals.py (REFATORADO)
# R1: Lógica principal delegada a ComprasService
# R2: Bloco try/except com raise e (rollback) mantido para garantir a atomicidade
# ==============================================================================
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from django.db.utils import IntegrityError
from decimal import Decimal

# Importações dos modelos locais
from .models import PedidoCompra, StatusPedidoCompra 

# Importa o NOVO Service Layer
from .services import ComprasService 

logger = logging.getLogger(__name__)


# --- SIGNAL 1: Entrada de Estoque, Criação de Contas a Pagar e Contabilização ---
@receiver(post_save, sender=PedidoCompra)
def criar_movimento_estoque_e_contabilizar_compra(sender, instance, created, **kwargs):
    """
    Aciona o processamento do recebimento via Service Layer.
    Age como um gatilho para o status de recebimento.
    """
    
    # 0. Verifica o status disparador
    is_receiving_status = instance.status in [StatusPedidoCompra.RECEBIDO_PARCIAL, StatusPedidoCompra.FINALIZADO]
    
    if not is_receiving_status:
        return

    # O Service Layer agora gerencia o `transaction.atomic()`
    try:
        # 1. Chama o Service Layer para executar toda a lógica de negócio
        ComprasService.processar_recebimento_compra(pedido=instance)
        
    except IntegrityError as e:
        # Tratamento mais específico de erro de integridade
        logger.error(f"ERRO CRÍTICO R2: Falha de Integridade (DB) durante processamento do Pedido N° {instance.pk}. Rollback acionado. Erro: {e}")
        raise e
    except Exception as e:
        logger.error(f"ERRO CRÍTICO R2: Falha na integração do Pedido de Compra N° {instance.pk} com Estoque/Financeiro. Rollback acionado. Erro: {e}")
        # 🚨 CORREÇÃO CRÍTICA R2: RE-LANÇA A EXCEÇÃO para forçar o ROLLBACK atômico
        raise e