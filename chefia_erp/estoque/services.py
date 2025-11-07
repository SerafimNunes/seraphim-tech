# ==============================================================================
# ARQUIVO: chefia_erp/estoque/services.py (CRÍTICO PARA R1 e R7)
# ==============================================================================
from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from django.db.models import Sum
from django.core.exceptions import ObjectDoesNotExist
import logging

# Importa os modelos atualizados (R7)
from .models import Produto, ItemMovimentoEstoque, CustoProduto 

logger = logging.getLogger(__name__)

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
    def recalcular_cmp_e_saldo(produto_pk: int):
        """
        Calcula o CMP e o Saldo do Produto a partir de TODAS as entradas válidas (R1).
        O recálculo opera no modelo CustoProduto (R7).
        """
        QUATRO_CASAS = Decimal('0.0000')
        TRES_CASAS = Decimal('0.001')

        try:
            # 1. Bloqueia o CustoProduto e Produto para garantir atomicidade
            with transaction.atomic():
                # Bloqueia o produto e recupera (ou cria) o CustoProduto
                produto = Produto.objects.select_for_update().get(pk=produto_pk)
                custo_produto = EstoqueService._get_or_create_custo_produto(produto_pk)
                
                # 2. Busca todas as entradas VÁLIDAS (não estornadas) para o produto
                #    O filtro crucial para a R1 está aqui: is_estornado=False
                entradas_validas = ItemMovimentoEstoque.objects.filter(
                    produto=produto,
                    movimento__tipo_movimento__startswith='ENTRADA',
                    is_estornado=False  
                ).select_related('movimento')

                # 3. Calcula a soma das Quantidades e do Valor Total das ENTRADAS VÁLIDAS
                total_quantidade_entrada = Decimal('0.000')
                total_valor_entrada = Decimal('0.0000')
                
                for item in entradas_validas:
                    quantidade = item.quantidade_movimentada.quantize(TRES_CASAS)
                    # O custo é sempre o preço de entrada (preco_unitario do item)
                    preco = item.preco_unitario.quantize(QUATRO_CASAS) 
                    
                    total_quantidade_entrada += quantidade
                    total_valor_entrada += quantidade * preco

                # 4. Determina o novo CMP 
                if total_quantidade_entrada > Decimal('0.000'):
                    # CMP = Valor Total de Entradas Válidas / Quantidade Total de Entradas Válidas
                    novo_cmp = (total_valor_entrada / total_quantidade_entrada).quantize(QUATRO_CASAS, rounding=ROUND_HALF_UP)
                else:
                    novo_cmp = Decimal('0.0000')
                    
                # 5. Calcula o Saldo FINAL (Entradas Válidas - Saídas Válidas)
                saidas_validas = ItemMovimentoEstoque.objects.filter(
                    produto=produto,
                    movimento__tipo_movimento__startswith='SAIDA',
                    is_estornado=False
                ).aggregate(total_saida=Sum('quantidade_movimentada'))
                
                total_saida = saidas_validas.get('total_saida') or Decimal('0.000')
                
                # Saldo Final = Qtd Total Entrada - Qtd Total Saída
                novo_saldo_estoque = (total_quantidade_entrada - total_saida).quantize(TRES_CASAS, rounding=ROUND_HALF_UP)
                
                # 6. Atualiza o CustoProduto (R7)
                custo_produto.custo_medio_ponderado = novo_cmp
                custo_produto.quantidade_atual = novo_saldo_estoque
                # O preço de custo para exibição é o CMP arredondado para 2 casas
                custo_produto.preco_custo = novo_cmp.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                custo_produto.save(update_fields=['custo_medio_ponderado', 'quantidade_atual', 'preco_custo', 'data_ultima_atualizacao'])
                
                logger.info(
                    f"R1/R7: CMP e Saldo recalculados para Produto {produto_pk}. Novo CMP: {novo_cmp}, Novo Saldo: {novo_saldo_estoque}"
                )
                
        except ObjectDoesNotExist:
            logger.error(f"Produto {produto_pk} não encontrado durante o recálculo do CMP.")
        except Exception as e:
            logger.critical(f"Falha CRÍTICA ao executar EstoqueService.recalcular_cmp_e_saldo para Produto {produto_pk}: {e}")

# Arquivo: chefia_erp/estoque/services.py

# ... (código existente da classe EstoqueService)

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
            
            # Recálculo necessário após a baixa de estoque simulada.
            EstoqueService.recalcular_cmp_e_saldo(produto_pk)
            
        return True # Retorno de sucesso simulado            