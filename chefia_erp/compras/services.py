# ==============================================================================
# ARQUIVO: compras/services.py (NOVO)
# R1: Lógica de Movimento/Contabilização movida para Service Layer
# ==============================================================================
import logging
from django.db import transaction
from django.db.models import F
from django.core.exceptions import ValidationError
from decimal import Decimal
from datetime import date 
from django.db.models import Sum

# Importações dos modelos locais
from .models import PedidoCompra, ItemPedidoCompra
from financeiro.models import ContasAPagar, StatusContasAPagar 
from estoque.models import MovimentoEstoque, ItemMovimentoEstoque
from contabil.services import criar_lancamento_contabil as criar_lancamento_contabil_partida_dobrada

logger = logging.getLogger(__name__)

# =========================================================================
# CONSTANTES DE CONTAS (Mantidas para a lógica, mas Risco 7 de hardcode ainda existe)
# =========================================================================
CONTA_ESTOQUE = '1.1.0.2.0.1'            
CONTA_FORNECEDORES = '2.1.0.1.0.1'       
# =========================================================================

class ComprasService:
    """
    Service Layer para as Regras de Negócio do Módulo de Compras.
    A lógica de Delta (R1) deve ser implementada aqui.
    """

    @staticmethod
    @transaction.atomic # A transação atômica garante o TUDO OU NADA (R2)
    def processar_recebimento_compra(pedido: PedidoCompra):
        """
        Processa a entrada em Estoque, Contas a Pagar e Lançamento Contábil 
        para o Pedido de Compra.

        NOTA R1: No futuro, este método será refatorado para receber o DELTA 
        (a diferença entre o que foi recebido agora e o que foi recebido antes) 
        para cada item, ao invés de processar o Pedido inteiro.
        """
        logger.info(f"Processando recebimento (Service) para Pedido N° {pedido.pk}.")

        # 1. Cria Movimento de Estoque Mestre (um por Pedido/Recebimento)
        movimento_estoque = MovimentoEstoque.objects.create(
            tipo_movimento='ENTRADA_COMPRA',
            responsavel=pedido.responsavel,
            observacoes=f"Entrada de Compra Pedido N° {pedido.pk}. Fornecedor: {pedido.fornecedor.nome}",
            pedido_compra=pedido # Liga a FK
        )

        total_compra = Decimal('0.0000')
        itens_movimento_a_criar = []
        
        # 2. Processa os Itens do Pedido (Entrada no Estoque)
        for item in pedido.itens.all():
            # A quantidade que realmente entrou em estoque é o que foi RECEBIDO
            # A validação R5 garante que quantidade_recebida <= quantidade_pedida
            quantidade_entrada = item.quantidade_recebida
            
            if quantidade_entrada > Decimal('0.000'):
                
                # O custo do item no estoque é o PREÇO NEGOCIADO (CMP inicial)
                custo_unitario = item.preco_unitario_negociado 
                
                itens_movimento_a_criar.append(
                    ItemMovimentoEstoque(
                        movimento=movimento_estoque,
                        produto=item.produto,
                        quantidade_movimentada=quantidade_entrada,
                        preco_unitario=custo_unitario # O custo inicial do produto
                    )
                )
                # Soma o valor total da compra/entrada para o ContasAPagar
                total_compra += quantidade_entrada * custo_unitario

        # Cria todos os itens de uma vez (otimização)
        if itens_movimento_a_criar:
            ItemMovimentoEstoque.objects.bulk_create(itens_movimento_a_criar)

        # O valor do contas a pagar deve ser o valor total dos itens recebidos.
        if total_compra > Decimal('0.0000'):
            
            # 3. Cria o Contas a Pagar (Passivo)
            ContasAPagar.objects.create(
                fornecedor=pedido.fornecedor,
                pedido_compra=pedido,
                # Arredonda para 2 casas SOMENTE para o ContasAPagar (moeda)
                valor_original=total_compra.quantize(Decimal('0.01')), 
                data_vencimento=pedido.data_entrega_prevista if pedido.data_entrega_prevista else date.today(),
                status=StatusContasAPagar.PENDENTE,
                descricao=f"Pedido de Compra N° {pedido.pk} - Fornecedor {pedido.fornecedor.nome}",
                data_emissao=pedido.data_emissao
            )
            
            # 4. Cria Lançamento Contábil (Débito: Estoque / Crédito: Fornecedores)
            criar_lancamento_contabil_partida_dobrada(
                codigo_debito=CONTA_ESTOQUE,
                codigo_credito=CONTA_FORNECEDORES,
                valor=total_compra,
                descricao_lancamento=f"Entrada de Estoque/Criação de Contas a Pagar ref. Pedido N° {pedido.pk}",
                historico_transacao=f"Registro da entrada de estoque e criação do passivo no Pedido {pedido.pk}.",
                usuario_criacao=pedido.responsavel, 
                pedido_compra=pedido # Rastreabilidade
            )
            logger.info(f"SUCESSO CONTÁBIL: Lançamento de Compra N° {pedido.pk} registrado. Valor: R$ {total_compra:.2f}")

        # 5. Finaliza a transação: Marca a flag de segurança
        # A flag é mantida para rastreamento (R1)
        pedido.movimento_criado = True
        pedido.save(update_fields=['movimento_criado']) 
        
        logger.info(f"Processamento de recebimento para Pedido N° {pedido.pk} concluído com sucesso.")