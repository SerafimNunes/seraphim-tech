# vendas/views.py (CORRIGIDO)
import logging
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone 
from decimal import Decimal

# Importações de Módulos Locais
from .models import Venda, ItemVenda, MetodoPagamento 
from .serializers import VendaReadSerializer, VendaWriteSerializer, ItemVendaWriteSerializer
from estoque.models import Produto 
# >> CORREÇÃO CRÍTICA: Importação do módulo CAIXA para integração de PDV
from caixa.models import SessaoCaixa 
from caixa.utils import get_sessao_caixa_ativa 

# Configuração de logger
logger = logging.getLogger(__name__)

# ViewSet para a Comanda (Venda)
class ComandaViewSet(viewsets.ModelViewSet):
    """
    Endpoint para Comandas/Mesas (Vendas).
    """
    # Queryset base: Apenas Comandas ABERTAS para listagem no PDV.
    queryset = Venda.objects.filter(status=Venda.Status.ABERTA).prefetch_related('itens__produto')
    
    # Define o serializer de Leitura para listagem e detalhes, e de Escrita para criação
    def get_serializer_class(self):
        # faturar usa o ReadSerializer para o retorno
        if self.action in ['list', 'retrieve', 'adicionar_itens', 'fechar', 'reabrir', 'faturar']: 
            return VendaReadSerializer
        # Usa o WriteSerializer para a criação/atualização do cabeçalho
        return VendaWriteSerializer 

    # Sobrescreve o método create (POST) para criar uma nova comanda
    def perform_create(self, serializer):
        # O usuário logado (PDV) é vinculado como responsável
        serializer.save(usuario_responsavel=self.request.user if self.request.user.is_authenticated else None)

    # Ação customizada para ADICIONAR ITENS (Lançar Pedido)
    @action(detail=True, methods=['post'], serializer_class=ItemVendaWriteSerializer)
    def adicionar_itens(self, request, pk=None):
        """Adiciona uma lista de itens à Comanda (ID: pk)."""
        venda = self.get_object() # Busca a venda pelo PK e aplica o filtro 'ABERTA'
        itens_data = request.data 
        
        # Adaptação para aceitar payload como lista ou como objeto aninhado {'itens': [...]}
        if isinstance(itens_data, dict) and 'itens' in itens_data:
            itens_data = itens_data['itens']
        elif not isinstance(itens_data, list):
            itens_data = [itens_data]

        item_serializer = ItemVendaWriteSerializer(data=itens_data, many=True)
        item_serializer.is_valid(raise_exception=True)
        
        # A transação garante que, se um item falhar, todos os itens (e o recálculo) sejam desfeitos
        with transaction.atomic():
            for item_data in item_serializer.validated_data:
                produto = item_data['produto']
                quantidade = item_data['quantidade']
                
                # 1. Busca o preço de venda atual do Produto
                preco_unitario = produto.preco_venda
                
                # 2. Cria o ItemVenda e vincula à Venda
                ItemVenda.objects.create(
                    venda=venda,
                    produto=produto,
                    quantidade=quantidade,
                    preco_unitario=preco_unitario, # Preço fixado no momento da venda
                )
            
            # 3. Recálculo dos totais da Venda (deve ser implementado no model/signals)
            if hasattr(venda, 'recalcular_totais'):
                venda.recalcular_totais()
                
            # 4. Retorna a venda completa e atualizada em modo leitura
            venda_atualizada = Venda.objects.prefetch_related('itens__produto').get(pk=venda.pk) 
            read_serializer = VendaReadSerializer(venda_atualizada)
            
            return Response(read_serializer.data, status=status.HTTP_201_CREATED)

    # Ação customizada para FECHAR a Comanda
    @action(detail=True, methods=['post'])
    def fechar(self, request, pk=None):
        """Altera o status da Comanda para FECHADA (Se existir no seu Model)."""
        venda = self.get_object()
        
        if venda.status != Venda.Status.ABERTA:
            return Response({"detail": "Esta comanda não está em estado para ser fechada."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # NOTE: Se Venda.Status.FECHADA não existir, isso pode falhar.
            venda.status = Venda.Status.FECHADA 
            venda.save()

            read_serializer = VendaReadSerializer(venda)
            return Response(read_serializer.data, status=status.HTTP_200_OK)

    # Ação customizada para REABRIR a Comanda (para ajustes)
    @action(detail=True, methods=['post'])
    def reabrir(self, request, pk=None):
        """Altera o status da Comanda para ABERTA, permitindo novos lançamentos."""
        # Busca a venda sem o filtro de 'ABERTA' do queryset base (USO CORRETO DE get_object_or_404)
        venda = get_object_or_404(Venda, pk=pk) 
        
        if venda.status == Venda.Status.ABERTA:
            return Response({"detail": "Esta comanda já está aberta."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            venda.status = Venda.Status.ABERTA
            venda.save()

            read_serializer = VendaReadSerializer(venda)
            return Response(read_serializer.data, status=status.HTTP_200_OK)

    # =====================================================================
    # >>> AÇÃO CRÍTICA: FATURAMENTO E PAGAMENTO FINAL (CORRIGIDA) <<<
    # =====================================================================
    @action(detail=True, methods=['post'])
    def faturar(self, request, pk=None):
        """
        Processa o pagamento final, verifica a sessão de caixa e fatura a venda.
        Dispara os signals de baixa de estoque e contabilização (via signals).
        """
        # CRÍTICO: Usamos get_object_or_404 na classe base para ignorar o filtro de status do queryset
        venda = get_object_or_404(Venda, pk=pk) 

        # 1. Re-validação de Status
        if venda.status != Venda.Status.ABERTA:
            return Response({"detail": "A venda deve estar em estado ABERTA para ser faturada."}, 
                            status=status.HTTP_400_BAD_REQUEST)

        # >> 2. CORREÇÃO CRÍTICA: Checagem de Sessão de Caixa Ativa (Integração PDV)
        sessao_ativa = get_sessao_caixa_ativa(usuario=request.user)
        if not sessao_ativa:
            return Response({'detail': 'Nenhuma sessão de caixa ativa encontrada para o usuário. Abra uma sessão para faturar.'}, 
                            status=status.HTTP_400_BAD_REQUEST)
                            
        pagamentos_data = request.data.get('pagamentos', [])
        if not pagamentos_data:
            return Response({"detail": "É necessário fornecer métodos de pagamento."}, 
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                
                # >> 3. CORREÇÃO CRÍTICA: Limpa pagamentos existentes para evitar duplicidade em tentativas
                venda.pagamentos.all().delete()
                
                # 4. Cria Pagamentos (e calcula o total pago)
                total_pago = Decimal('0.00')
                for pagamento_data in pagamentos_data:
                    # Garantir que o valor seja Decimal
                    try:
                        valor_pago = Decimal(str(pagamento_data.get('valor_pago', '0.00')))
                        # >> CORREÇÃO: Captura valor_recebido para cálculo de troco/registro
                        valor_recebido = Decimal(str(pagamento_data.get('valor_recebido', valor_pago)))
                    except (TypeError, ValueError):
                        raise Exception("Valor de pagamento inválido.")
                        
                    if valor_pago <= Decimal('0.00'): continue # Pula valores zero ou negativos

                    total_pago += valor_pago
                    
                    MetodoPagamento.objects.create(
                        venda=venda,
                        sessao_caixa=sessao_ativa, # >> CORREÇÃO: Linka à sessão ativa do caixa
                        tipo_pagamento=pagamento_data['tipo_pagamento'], 
                        valor_pago=valor_pago,
                        valor_recebido=valor_recebido # Armazena o valor recebido
                    )

                # 5. Valida o Pagamento
                if hasattr(venda, 'recalcular_totais'):
                    venda.recalcular_totais() 
                    venda.refresh_from_db() # Puxa o total líquido atualizado

                if total_pago < venda.valor_total_liquido:
                    raise Exception(f"Valor pago R$ {total_pago:.2f} é menor que o total da venda R$ {venda.valor_total_liquido:.2f}.")

                # 6. Altera o status para FATURADA
                venda.status = Venda.Status.FATURADA
                venda.data_faturamento = timezone.now()
                venda.save() 
                
                logger.info(f"Venda {venda.pk} faturada com sucesso.")
                
                # 7. Retorno
                venda_faturada = Venda.objects.prefetch_related('itens__produto').get(pk=venda.pk)
                read_serializer = VendaReadSerializer(venda_faturada)
                return Response(read_serializer.data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Erro ao faturar venda {pk}: {e}")
            return Response({"detail": f"Erro de faturamento: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
