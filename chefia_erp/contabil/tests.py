# ./contabil/tests.py (Versão FINAL E CORRIGIDA)

from django.test import TestCase
from django.contrib.auth import get_user_model
from django.db import transaction
from decimal import Decimal
from django.utils import timezone

# -------------------------------------------------------------------------
# 1. IMPORTAÇÕES E SETUP DE CLASSES MOCKS E LÓGICA
# -------------------------------------------------------------------------

# Importa modelos do app contabil
from contabil.models import PlanoConta, CentroCusto, LancamentoContabil 
from contabil.services import criar_lancamento_contabil
from contabil.signals import contabilizar_movimento_estoque, ContasEssenciais 

# Importa os modelos REAIS de Venda, Cliente e Mesa para satisfazer a Chave Estrangeira
from vendas.models import Venda, Cliente, Mesa 

User = get_user_model()

# --- Classes Mocks ---
class Produto:
    """Mock do Produto (usado no MovimentoEstoque)."""
    def __init__(self, pk, nome, preco_custo, preco_venda):
        self.pk = pk
        self.nome = nome
        self.preco_custo = Decimal(str(preco_custo))
        self.preco_venda = Decimal(str(preco_venda))

class ItemMovimentoEstoque:
    """Mock do ItemMovimentoEstoque."""
    def __init__(self, produto, quantidade_movimentada, preco_unitario):
        self.produto = produto
        self.quantidade_movimentada = Decimal(str(quantidade_movimentada))
        self.preco_unitario = Decimal(str(preco_unitario))
        
class MovimentoEstoque:
    """Mock do MovimentoEstoque - O disparador do signal de Estoque."""
    class TipoMovimento:
        ENTRADA_PRODUCAO = 'ENTRADA_PRODUCAO'
        SAIDA_PRODUCAO = 'SAIDA_PRODUCAO'
    def __init__(self, pk, tipo_movimento, usuario):
        self.pk = pk
        self.tipo_movimento = tipo_movimento
        self.usuario = usuario
        self.data_movimento = timezone.now()
        self.itens_movimento = []
        
# Funções Auxiliares
def get_valor_total_movimento(movimento):
    """Calcula o valor total do MovimentoEstoque (Custo)."""
    return sum(item.preco_unitario * item.quantidade_movimentada for item in movimento.itens_movimento)


# -------------------------------------------------------------------------
# 2. TEST CASE PRINCIPAL
# -------------------------------------------------------------------------

class ContabilSignalsTestCase(TestCase):
    """
    Testes de integração para garantir que os Movimentos de Estoque e Vendas
    disparem a criação de Lançamentos Contábeis (Partidas Dobradas).
    """
    
    # Códigos contábeis para o teste
    CONTA_CAIXA_COD = '1.1.1'
    CONTA_RECEITA_COD = '3.1.1'
    CONTA_CMV_COD = '4.1.1'
    
    # Obtém os códigos críticos do signals.py
    CONTA_ESTOQUE_ACABADO_COD = ContasEssenciais.ESTOQUE_PRODUTO_ACABADO_COD
    CONTA_CUSTO_PROD_COD = ContasEssenciais.CUSTO_PRODUCAO_ANDAMENTO_COD
    
    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(username='test_user', password='password123')
        self.centro_custo, _ = CentroCusto.objects.get_or_create(nome='Produção/Vendas', ativo=True)

        # Setup de Contas Mínimas para o Teste
        PlanoConta.objects.get_or_create(codigo=self.CONTA_CAIXA_COD, nome='Caixa/Bancos', tipo='ATIVO', ativo=True)
        PlanoConta.objects.get_or_create(codigo=self.CONTA_RECEITA_COD, nome='Receita de Vendas', tipo='RECEITA', ativo=True)
        PlanoConta.objects.get_or_create(codigo=self.CONTA_CMV_COD, nome='Custo da Mercadoria Vendida (CMV)', tipo='DESPESA', ativo=True)
        PlanoConta.objects.get_or_create(codigo=self.CONTA_ESTOQUE_ACABADO_COD, nome='Estoque de Produto Acabado', tipo='ATIVO', ativo=True)
        PlanoConta.objects.get_or_create(codigo=self.CONTA_CUSTO_PROD_COD, nome='Custo de Produção em Andamento', tipo='DESPESA', ativo=True)
        
        # Conta essencial faltante (necessária para o signal)
        PlanoConta.objects.get_or_create(
            codigo=ContasEssenciais.ESTOQUE_INSUMOS_COD, 
            nome='Estoque de Insumos/Matéria-Prima', 
            tipo='ATIVO', 
            ativo=True
        )

        # Cria instâncias reais para satisfazer as Chaves Estrangeiras de Venda.
        self.cliente_teste, _ = Cliente.objects.get_or_create(
            pk=1, nome="Cliente Teste Contabil",
            # Adicione aqui outros campos obrigatórios de Cliente, se houver
        )
        self.mesa_teste, _ = Mesa.objects.get_or_create(
            pk=1, numero=99, status='LIVRE',
            # Adicione aqui outros campos obrigatórios de Mesa, se houver
        )

        # Mock do Produto
        self.produto_A = Produto(
            pk=1, nome='Hambúrguer X', preco_custo=5.00, preco_venda=15.00
        )
        
    def test_01_contabilizacao_movimento_estoque_entrada_producao(self):
        """
        Verifica o lançamento contábil para ENTRADA de produto acabado via Produção.
        Lançamento esperado: D-Estoque (Ativo), C-Custo_Produção (Despesa/Contrapartida).
        """
        # Arrange
        self.assertEqual(LancamentoContabil.objects.count(), 0)
        
        item_mov = ItemMovimentoEstoque(
            produto=self.produto_A, quantidade_movimentada=10, preco_unitario=self.produto_A.preco_custo 
        )
        
        movimento_estoque_mock = MovimentoEstoque(
            pk=100, tipo_movimento=MovimentoEstoque.TipoMovimento.ENTRADA_PRODUCAO, usuario=self.user
        )
        movimento_estoque_mock.itens_movimento.append(item_mov) 
        
        valor_total_movimento = get_valor_total_movimento(movimento_estoque_mock)
        self.assertEqual(valor_total_movimento, Decimal('50.00'))

        # Act: Simula a chamada da função de signal
        with transaction.atomic():
            contabilizar_movimento_estoque(
                movimento_estoque_mock, 
                valor_total_movimento, 
                self.user
            )

        # Assert: Verifica se o lançamento de PARTIDA DOBRADA foi criado corretamente (2 registros)
        self.assertEqual(LancamentoContabil.objects.count(), 2)
        
        # D-Estoque (Aumento de Ativo)
        lancamento_debito = LancamentoContabil.objects.get(
            tipo_movimento=LancamentoContabil.TipoMovimento.DEBITO
        )
        self.assertEqual(lancamento_debito.plano_conta.codigo, self.CONTA_ESTOQUE_ACABADO_COD)
        self.assertEqual(lancamento_debito.valor, Decimal('50.00'))
        
        # C-Custo de Produção (Redução de Custo/Contrapartida)
        lancamento_credito = LancamentoContabil.objects.get(
            tipo_movimento=LancamentoContabil.TipoMovimento.CREDITO
        )
        self.assertEqual(lancamento_credito.plano_conta.codigo, self.CONTA_CUSTO_PROD_COD)
        self.assertEqual(lancamento_credito.valor, Decimal('50.00'))

    def test_02_contabilizacao_venda_faturada_cmv_e_receita(self):
        """
        Verifica os dois pares de lançamentos contábeis após o FATURAMENTO de uma Venda:
        1. Receita: D-Caixa, C-Receita.
        2. CMV: D-CMV, C-Estoque.
        """
        # Arrange
        self.assertEqual(LancamentoContabil.objects.count(), 0)
        
        cmv_total_esperado = Decimal('25.00')
        receita_liquida_esperada = Decimal('75.00')
        venda_mock_pk = 200 

        # 🎯 CORREÇÃO FINAL: Usando o nome de campo CORRETO: 'atendente'
        Venda.objects.create(
            pk=venda_mock_pk, 
            status='FATURADA',
            atendente=self.user, # NOME DE CAMPO CORRIGIDO
            valor_total_liquido=receita_liquida_esperada,
            cliente=self.cliente_teste,
            mesa=self.mesa_teste,
        )
        
        # Act 1: Lançamento da Receita (D-Caixa, C-Receita)
        with transaction.atomic():
            criar_lancamento_contabil(
                historico_transacao=f"Receita Venda #{venda_mock_pk}",
                valor=receita_liquida_esperada, 
                codigo_debito=self.CONTA_CAIXA_COD,
                codigo_credito=self.CONTA_RECEITA_COD,
                centro_custo=self.centro_custo, 
                usuario=self.user,
                venda_id=venda_mock_pk
            )
            
        # Act 2: Lançamento do CMV (D-CMV, C-Estoque Acabado)
        with transaction.atomic():
            criar_lancamento_contabil(
                historico_transacao=f"Baixa Estoque (CMV) Venda #{venda_mock_pk}",
                valor=cmv_total_esperado, 
                codigo_debito=self.CONTA_CMV_COD,
                codigo_credito=self.CONTA_ESTOQUE_ACABADO_COD,
                centro_custo=self.centro_custo,
                usuario=self.user,
                venda_id=venda_mock_pk
            )
        
        # Assert: Quatro lançamentos criados (2 pares)
        self.assertEqual(LancamentoContabil.objects.count(), 4)
        
        # 1. Receita - Débito (Caixa)
        lancamento_caixa = LancamentoContabil.objects.get(
            plano_conta__codigo=self.CONTA_CAIXA_COD, tipo_movimento='DEBITO'
        )
        self.assertEqual(lancamento_caixa.valor, receita_liquida_esperada)

        # 4. CMV - Crédito (Estoque)
        lancamento_estoque_cmv = LancamentoContabil.objects.get(
            plano_conta__codigo=self.CONTA_ESTOQUE_ACABADO_COD, tipo_movimento='CREDITO'
        )
        self.assertEqual(lancamento_estoque_cmv.valor, cmv_total_esperado)
