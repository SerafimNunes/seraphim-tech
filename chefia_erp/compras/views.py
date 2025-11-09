# ==============================================================================
# ARQUIVO: compras/views.py (REFATORADO)
# R6: Utiliza o Service Layer para o recebimento
# ==============================================================================
from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.db import transaction
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import permission_required 
import json
from decimal import Decimal
from django.core.exceptions import ValidationError

from .models import PedidoCompra
from .services import ComprasService # Importa o novo Service Layer

# Helpers para resposta JSON
def json_success(message, data=None):
    return JsonResponse({'status': 'success', 'message': message, 'data': data or {}})

def json_error(message, status=400):
    return JsonResponse({'status': 'error', 'message': message}, status=status)

# R6: View/API de Recebimento de Mercadorias 
@require_http_methods(["POST"])
@permission_required('compras.change_pedidocompra', raise_exception=True)
def receber_compra_api(request, pedido_pk):
    """
    Endpoint dedicado para o recebimento de mercadorias.
    Responsável por atualizar as quantidades recebidas e acionar o Service Layer.
    """
    try:
        pedido = get_object_or_404(PedidoCompra, pk=pedido_pk)
        data = json.loads(request.body)
        itens_recebidos = data.get('itens', [])
        status_final = data.get('status_final') 

        if not itens_recebidos:
             return json_error("Nenhum item de recebimento enviado.", 400)
             
        # O Service Layer gerencia o transaction.atomic()
        
        # 1. Atualiza as quantidades recebidas no modelo
        for item_data in itens_recebidos:
            item_pk = item_data.get('item_pk')
            # Garante que o input JSON seja um Decimal
            quantidade_recebida_nova = Decimal(str(item_data.get('quantidade_recebida', '0.000')))

            item_pedido = pedido.itens.get(pk=item_pk)
            
            # Atualização da quantidade total recebida e validação R5
            item_pedido.quantidade_recebida = quantidade_recebida_nova
            item_pedido.clean() # Dispara a validação R5 (quantidade recebida <= pedida)
            item_pedido.save()
        
        # 2. Atualiza o status e salva
        if status_final and status_final in [PedidoCompra.StatusPedidoCompra.RECEBIDO_PARCIAL, PedidoCompra.StatusPedidoCompra.FINALIZADO]:
            pedido.status = status_final
        
        # O save dispara o signal, que chama ComprasService.processar_recebimento_compra()
        # A lógica R1 (Delta) será implementada no Service, que precisa calcular 
        # a diferença entre o que foi salvo anteriormente e o que está sendo salvo agora.
        pedido.save() 

        return json_success(f"Recebimento do Pedido {pedido_pk} processado com sucesso.", {'status': pedido.status})

    except PedidoCompra.DoesNotExist:
        return json_error(f"Pedido de Compra {pedido_pk} não encontrado.", 404)
    except ValidationError as e:
        return json_error(f"Erro de Validação: {e.message}", 400)
    except Exception as e:
        # Erro interno - Qualquer falha no Service ou Signal causará um rollback aqui.
        return json_error(f"Erro Crítico ao finalizar recebimento (Rollback acionado): {str(e)}", 500)