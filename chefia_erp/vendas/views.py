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
# Importação da integração de PDV
from caixa.models import SessaoCaixa
from caixa.utils import get_sessao_caixa_ativa
# Importação do Service Layer (CRÍTICO para R9)
from .services import VendaService 

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
        # O usuário logado (PDV) é vinculado como responsável (Mapeado no Serializer para 'atendente')
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
                
                # CAPTURA DO NOVO CAMPO 'nome_cliente_mesa'
                nome_cliente_mesa = item_data.get('nome_cliente_mesa', '')

                # 1. Busca o preço de venda atual do Produto
                preco_unitario = produto.preco_venda
                
                # 2. Cria o ItemVenda e vincula à Venda
                ItemVenda.objects.create(
                    venda=venda,
                    produto=produto,
                    quantidade=quantidade,
                    preco_unitario=preco_unitario, # Preço fixado no momento da venda
                    # NOVO: Persistindo o nome do cliente/mesa no item
                    nome_cliente_mesa=nome_cliente_mesa,
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
        # Busca a venda sem o filtro de 'ABERTA' do queryset base 
        venda = get_object_or_404(Venda, pk=pk) 
        
        if venda.status == Venda.Status.ABERTA:
            return Response({"detail": "Esta comanda já está aberta."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            venda.status = Venda.Status.ABERTA
            venda.save()

            read_serializer = VendaReadSerializer(venda)
            return Response(read_serializer.data, status=status.HTTP_200_OK)

    # =====================================================================
    # AÇÃO CRÍTICA: FATURAMENTO E PAGAMENTO FINAL (CORRIGIDA)
    # =====================================================================
    @action(detail=True, methods=['post'])
    def faturar(self, request, pk=None):
        """
        R8: Processa o pagamento final, e chama o VendaService para criar a Venda final
        e disparar a baixa de estoque (R9), garantindo atomicidade.
        """
        venda_rascunho = get_object_or_404(Venda, pk=pk) 
        usuario = request.user
        
        # 1. Re-validação de Status
        if venda_rascunho.status != Venda.Status.ABERTA:
            return Response({"detail": "A venda deve estar em estado ABERTA para ser faturada."}, 
                            status=status.HTTP_400_BAD_REQUEST)

        # 2. Checagem de Sessão de Caixa Ativa
        sessao_ativa = get_sessao_caixa_ativa(usuario=usuario)
        if not sessao_ativa:
            return Response({'detail': 'Nenhuma sessão de caixa ativa encontrada para o usuário. Abra uma sessão para faturar.'}, 
                            status=status.HTTP_400_BAD_REQUEST)
                            
        pagamentos_data = request.data.get('pagamentos', [])
        if not pagamentos_data:
            return Response({"detail": "É necessário fornecer métodos de pagamento."}, 
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            # 3. Transação Atômica (R8) - Garante que Pagamentos + Faturamento (Service) sejam revertidos em falha
            with transaction.atomic():
                
                # CRÍTICO: Recálculo para pegar o valor_total_liquido atualizado ANTES da validação
                if hasattr(venda_rascunho, 'recalcular_totais'):
                    venda_rascunho.recalcular_totais()
                    venda_rascunho.refresh_from_db()
                
                # Limpa pagamentos existentes para evitar duplicidade em tentativas
                venda_rascunho.pagamentos.all().delete()
                
                total_pago = Decimal('0.00')
                
                # 4. Cria Pagamentos (Síncrono/R8)
                for pagamento_data in pagamentos_data:
                    try:
                        valor_pago = Decimal(str(pagamento_data.get('valor_pago', '0.00')))
                        valor_recebido = Decimal(str(pagamento_data.get('valor_recebido', valor_pago)))
                    except (TypeError, ValueError):
                        raise Exception("Valor de pagamento inválido.")
                        
                    if valor_pago <= Decimal('0.00'): continue

                    total_pago += valor_pago
                    
                    MetodoPagamento.objects.create(
                        venda=venda_rascunho,
                        sessao_caixa=sessao_ativa,
                        tipo_pagamento=pagamento_data['tipo_pagamento'], 
                        valor_pago=valor_pago,
                        valor_recebido=valor_recebido
                    )

                # 5. Validação de Pagamento
                if total_pago < venda_rascunho.valor_total_liquido:
                    raise Exception(f"Valor pago R$ {total_pago:.2f} é menor que o total da venda R$ {venda_rascunho.valor_total_liquido:.2f}.")

                # 6. CHAMA O SERVICE LAYER (R9)
                # O Service Layer é responsável por: a) Criar Venda Final, b) Disparar Task (Estoque/Contabilidade)
                venda_faturada = VendaService.finalizar_venda_comanda(venda_rascunho.pk, usuario)
                
                logger.info(f"Venda {venda_faturada.pk} síncrona concluída. Task R9 disparada.")
                
                # 7. Retorno
                read_serializer = VendaReadSerializer(venda_faturada)
                return Response(read_serializer.data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Erro ao faturar venda {pk}: {e}")
            # R8: Se o Service Layer lançar uma exceção (ex: Estoque Insuficiente), 
            # o transaction.atomic() garante o rollback de TUDO (incluindo pagamentos).
            # Retorna uma mensagem clara ao usuário.
            return Response({"detail": f"Falha na transação. A venda foi revertida (ROLLBACK). Erro: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)