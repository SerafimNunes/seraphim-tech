# ==============================================================================
# ARQUIVO: chefia_erp/estoque/services.py (CRÍTICO PARA R1 e R3)
# ==============================================================================
from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from django.db.models import Sum, F
from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.utils import timezone
import logging

# Importa os modelos atualizados (R7)
from .models import (
    Produto, ItemMovimentoEstoque, CustoProduto, RequisicaoEstoque,
    ItemRequisicaoEstoque, MovimentoEstoque, TIPOS_MOVIMENTO
)
from core.models import Usuario # Assumindo que o modelo Usuario está no core

logger = logging.getLogger(__name__)

TRES_CASAS = Decimal('0.001') # Precisão de quantidade

class EstoqueService:
    """
    Serviços de Regra de Negócio para Estoque, focado na Integridade Financeira.
    Contém a lógica de Recálculo do Custo Médio Ponderado (R1 e R7).
    """

    @staticmethod
    def _get_or_create_custo_produto(produto_pk: int) -> CustoProduto:
        """Helper para obter ou criar a instância CustoProduto para um Produto."""
        try:
            return CustoProduto.objects.get(produto__pk=produto_pk)
        except CustoProduto.DoesNotExist:
            # Cria a instância se não existir (garantindo o 1:1)
            produto = Produto.objects.get(pk=produto_pk)
            return CustoProduto.objects.create(produto=produto)


    @staticmethod
    @transaction.atomic
    def recalcular_cmp_e_saldo(produto_pk: int):
        """
        Calcula o CMP e o Saldo atualizado de um produto a partir de seus
        ItemMovimentoEstoque, ignorando itens estornados (is_estornado=True).
        
        🚨 CRÍTICO R1: Implementa Bloqueio Pessimista.
        """
        try: # Bloco TRY principal
            # 🚨 CORREÇÃO CRÍTICA R1: Implementação de Bloqueio Pessimista
            # Garante exclusividade na leitura/escrita do CustoProduto
            try:
                custo_produto = CustoProduto.objects.select_for_update().get(produto__pk=produto_pk)
            except CustoProduto.DoesNotExist:
                # Se não existir, cria o registro (sem lock, pois é criação atômica)
                try: # CORRIGIDO: Este bloco estava desalinhado (IndentationError)
                    produto = Produto.objects.get(pk=produto_pk)
                    custo_produto = CustoProduto.objects.create(produto=produto)
                except Produto.DoesNotExist:
                    logger.error(f"Produto {produto_pk} não encontrado durante o recálculo do CMP.")
                    return

            # Filtra SÓ por itens NÃO estornados (is_estornado=False)
            # e exclui movimentos reversos, se necessário, mas o is_estornado já deve ser suficiente.
            # A lógica correta de CMP soma o valor de ENTRADA e subtrai o valor de SAÍDA (usando CMP no valor)
            
            # 1. Agrega o SALDO QUANTITATIVO
            movimentos_positivos = ItemMovimentoEstoque.objects.filter(
                produto__pk=produto_pk,
                movimento__tipo_movimento__startswith='ENTRADA',
                is_estornado=False
            ).aggregate(saldo_positivo=Sum('quantidade_movimentada'))['saldo_positivo'] or Decimal('0.000')

            movimentos_negativos = ItemMovimentoEstoque.objects.filter(
                produto__pk=produto_pk,
                movimento__tipo_movimento__startswith='SAIDA',
                is_estornado=False
            ).aggregate(saldo_negativo=Sum('quantidade_movimentada'))['saldo_negativo'] or Decimal('0.000')
            
            novo_saldo_estoque = movimentos_positivos - movimentos_negativos
            
            # 2. Agrega o VALOR TOTAL (CMP)
            # O valor é a SOMA dos valores das ENTRADAS (Preco Unitario * Qtd)
            # e a SUBTRAÇÃO dos valores das SAÍDAS (CMP daquele momento * Qtd)
            
            # Valorização das entradas (Soma de: Qtd * Preço Unitário de Entrada)
            valor_total_entradas = ItemMovimentoEstoque.objects.filter(
                produto__pk=produto_pk,
                movimento__tipo_movimento__startswith='ENTRADA',
                is_estornado=False
            ).aggregate(
                total_valor=Sum(F('quantidade_movimentada') * F('preco_unitario'), output_field=Decimal)
            )['total_valor'] or Decimal('0.0000')
            
            # Valorização das saídas (Soma de: Qtd * Preço Unitário de Saída (CMP))
            valor_total_saidas = ItemMovimentoEstoque.objects.filter(
                produto__pk=produto_pk,
                movimento__tipo_movimento__startswith='SAIDA',
                is_estornado=False
            ).aggregate(
                total_valor=Sum(F('quantidade_movimentada') * F('preco_unitario'), output_field=Decimal)
            )['total_valor'] or Decimal('0.0000')

            novo_valor_total = valor_total_entradas - valor_total_saidas
            
            # 3. Calcula o Novo CMP
            if novo_saldo_estoque > TRES_CASAS:
                novo_cmp = (novo_valor_total / novo_saldo_estoque).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
            else:
                # Se o saldo é zero ou negativo, o CMP deve ser zero.
                novo_cmp = Decimal('0.0000')
                novo_saldo_estoque = Decimal('0.000') # Garante que saldo negativo seja ajustado para 0 (em teoria, CMP não deve ser negativo)

            # 4. Atualiza o CustoProduto
            custo_produto.quantidade_atual = novo_saldo_estoque.quantize(TRES_CASAS)
            custo_produto.custo_medio_ponderado = novo_cmp
            custo_produto.valor_total_estoque = novo_valor_total.quantize(Decimal('0.0001'))
            custo_produto.save()
            
            # Atualiza o custo de última compra no Produto (espelho)
            Produto.objects.filter(pk=produto_pk).update(preco_custo=novo_cmp)
            
            logger.info(
                f"CMP Recalculado para Produto {produto_pk}. Novo CMP: {novo_cmp}, Novo Saldo: {novo_saldo_estoque}"
            )
            
        except ObjectDoesNotExist: # Alinhado com o TRY principal
            logger.error(f"Produto {produto_pk} não encontrado durante o recálculo do CMP.")
        except Exception as e: # Alinhado com o TRY principal
            logger.critical(f"Falha CRÍTICA ao executar EstoqueService.recalcular_cmp_e_saldo para Produto {produto_pk}: {e}")


# =========================================================
# R3: SERVICE LAYER PARA REQUISIÇÕES DE ESTOQUE (INTEGRIDADE)
# =========================================================

    @staticmethod
    @transaction.atomic
    def criar_requisicao_estoque(
        itens_data: list, 
        responsavel_id: int, 
        tipo_requisicao: str = 'PRODUCAO' # Ex: 'PRODUCAO', 'VENDA'
    ) -> RequisicaoEstoque:
        """
        Cria uma Requisição de Estoque com validação de regras de negócio.
        R3: Centraliza a criação para garantir integridade.
        """
        if not itens_data:
            raise ValidationError("A requisição deve conter pelo menos um item.")
        
        try:
            responsavel = Usuario.objects.get(pk=responsavel_id)
        except Usuario.DoesNotExist:
            raise ValidationError("Usuário responsável não encontrado.")

        # 1. Cria o cabeçalho da Requisição
        requisicao = RequisicaoEstoque.objects.create(
            responsavel=responsavel,
            tipo_requisicao=tipo_requisicao,
            status='PENDENTE', # Status inicial é sempre pendente
        )

        itens_a_criar = []
        for item in itens_data:
            produto_id = item.get('produto_id')
            quantidade = item.get('quantidade_requisitada', Decimal('0.000'))

            if not produto_id or quantidade <= Decimal('0.000'):
                raise ValidationError("Todos os itens devem ter um produto_id e quantidade > 0.")
            
            try: # CORRIGIDO: Este bloco estava desalinhado e fora do loop (IndentationError)
                produto = Produto.objects.get(pk=produto_id)
            except Produto.DoesNotExist:
                raise ValidationError(f"Produto ID {produto_id} não encontrado.")

            # Regra de Validação de Negócio (Ex: Não requisitar produto não insumo)
            if tipo_requisicao == 'PRODUCAO' and not produto.is_insumo:
                raise ValidationError(f"O produto '{produto.nome}' não está classificado como insumo para requisição de produção.")

            itens_a_criar.append(
                ItemRequisicaoEstoque(
                    requisicao=requisicao,
                    produto=produto,
                    quantidade_solicitada=Decimal(quantidade).quantize(TRES_CASAS),
                )
            )

        # 2. Cria os Itens da Requisição em massa
        ItemRequisicaoEstoque.objects.bulk_create(itens_a_criar)

        return requisicao


    @staticmethod
    def registrar_saida(itens_venda_data: list, venda_id: int, user_id: int):
        """
        R9: Implementação do Service para registrar a SAÍDA no estoque (Task).
        Dispara a baixa de estoque e o recálculo do CMP para os produtos afetados.
        """
        logger.info(f"R9: Registrando saída de estoque para Venda {venda_id}.")
        
        # AQUI VOCÊ ADICIONARÁ a lógica real de criar MovimentoEstoque e ItensMovimentoEstoque (Tipo: SAIDA_VENDA)
        
        # Para fins de TESTE, simulamos que o recálculo do CMP foi chamado
        for item in itens_venda_data:
            # Assumimos que o item enviado pela View tem 'produto_id'
            produto_pk = item['produto_id'] if 'produto_id' in item else item['produto']

# Arquivo: chefia_erp/estoque/services.py