# =======================================================================
# ARQUIVO: contabil/tests.py (NOVO - Testes de Integridade R7)
# =======================================================================
from django.test import TestCase
from django.contrib.auth import get_user_model
from decimal import Decimal
from django.db.utils import IntegrityError
from django.db import transaction

# Modelos
from .models import PlanoConta, LancamentoContabil, LoteContabil
# Serviços
from .services import criar_lancamento_contabil

User = get_user_model()

# Constantes de Contas (As mesmas usadas em compras/signals.py)
CONTA_ESTOQUE = '1.1.0.2.0.1'           # Ativo (Débito)
CONTA_FORNECEDORES = '2.1.0.1.0.1'      # Passivo (Crédito)
CONTA_RECEITA = '4.1.0.1.0.1'           # Receita (Crédito)
CONTA_DESPESA = '5.1.0.1.0.1'           # Despesa (Débito)


class ContabilidadeBaseTestCase(TestCase):
    """Configura o ambiente com contas contábeis básicas e um usuário."""

    @classmethod
    def setUpTestData(cls):
        # 1. Criação do Usuário (Obrigatório para rastreabilidade)
        cls.user = User.objects.create_user(username='tester', email='test@test.com', password='password')

        # 2. Criação das Contas Contábeis (Simulando a base de dados)
        # Contas Pai necessárias para as contas analíticas (R7)
        ativo_pai = PlanoConta.objects.create(nome='Ativo', codigo='1', tipo=PlanoConta.TipoConta.ATIVO)
        passivo_pai = PlanoConta.objects.create(nome='Passivo', codigo='2', tipo=PlanoConta.TipoConta.PASSIVO)
        receita_pai = PlanoConta.objects.create(nome='Receita', codigo='4', tipo=PlanoConta.TipoConta.RECEITA)
        despesa_pai = PlanoConta.objects.create(nome='Despesa', codigo='5', tipo=PlanoConta.TipoConta.DESPESA)

        # Contas para Teste de Compra/Estoque (R6)
        cls.conta_estoque = PlanoConta.objects.create(
            nome='Estoque (Ativo Circulante)', codigo=CONTA_ESTOQUE, 
            tipo=PlanoConta.TipoConta.ATIVO, conta_pai=ativo_pai
        )
        cls.conta_fornecedores = PlanoConta.objects.create(
            nome='Fornecedores a Pagar', codigo=CONTA_FORNECEDORES, 
            tipo=PlanoConta.TipoConta.PASSIVO, conta_pai=passivo_pai
        )
        
        # Contas para Teste de Venda/Receita
        cls.conta_caixa = PlanoConta.objects.create(
            nome='Caixa Geral', codigo='1.1.0.1.0.1', 
            tipo=PlanoConta.TipoConta.ATIVO, conta_pai=ativo_pai
        )
        cls.conta_receita = PlanoConta.objects.create(
            nome='Receita de Vendas', codigo=CONTA_RECEITA, 
            tipo=PlanoConta.TipoConta.RECEITA, conta_pai=receita_pai
        )
        
        # Conta para Teste de Despesa
        cls.conta_despesa = PlanoConta.objects.create(
            nome='Despesas Administrativas', codigo=CONTA_DESPESA, 
            tipo=PlanoConta.TipoConta.DESPESA, conta_pai=despesa_pai
        )


class LoteContabilServiceTest(ContabilidadeBaseTestCase):
    """Testa a funcionalidade principal de criação de Lotes Contábeis (R7)."""

    def test_r7_partida_dobrada_success(self):
        """Garante que a função cria 1 Lote e 2 Lançamentos (D=C)."""
        valor_teste = Decimal('100.00')
        historico = "Teste de Partida Dobrada: Compra de Estoque."
        
        # 1. Executa o serviço
        lote = criar_lancamento_contabil(
            codigo_debito=CONTA_ESTOQUE,
            codigo_credito=CONTA_FORNECEDORES,
            valor=valor_teste,
            historico_transacao=historico,
            descricao_lancamento="Lançamento para testar R7",
            usuario_criacao=self.user
        )

        # 2. Assertions sobre o LOTE (Cabeçalho)
        self.assertIsInstance(lote, LoteContabil)
        self.assertEqual(LoteContabil.objects.count(), 1)
        self.assertEqual(lote.valor_total, valor_teste)
        self.assertEqual(lote.historico_transacao, historico)
        self.assertEqual(lote.usuario_criacao, self.user)
        
        # 3. Assertions sobre os LANÇAMENTOS (Linhas)
        lancamentos = LancamentoContabil.objects.filter(lote_contabil=lote)
        self.assertEqual(lancamentos.count(), 2, "A partida dobrada deve criar 2 lançamentos.")
        
        # 4. Valida Débito e Crédito
        debito = lancamentos.get(tipo_movimento=LancamentoContabil.TipoMovimento.DEBITO)
        credito = lancamentos.get(tipo_movimento=LancamentoContabil.TipoMovimento.CREDITO)
        
        # Débito (Ativo/Estoque)
        self.assertEqual(debito.valor, valor_teste)
        self.assertEqual(debito.plano_conta, self.conta_estoque)
        
        # Crédito (Passivo/Fornecedores)
        self.assertEqual(credito.valor, valor_teste)
        self.assertEqual(credito.plano_conta, self.conta_fornecedores)

    def test_r7_partida_dobrada_caixa_receita(self):
        """Testa uma transação Receita -> Caixa."""
        valor_teste = Decimal('500.00')
        
        # 1. Executa o serviço
        lote = criar_lancamento_contabil(
            codigo_debito='1.1.0.1.0.1', # Caixa Geral
            codigo_credito=CONTA_RECEITA,
            valor=valor_teste,
            historico_transacao="Teste de Receita",
            descricao_lancamento="Venda de produto",
            usuario_criacao=self.user
        )
        
        # 2. Valida o Lançamento de Débito (Aumento do Ativo: Caixa)
        debito = LancamentoContabil.objects.get(
            lote_contabil=lote, 
            tipo_movimento=LancamentoContabil.TipoMovimento.DEBITO
        )
        self.assertEqual(debito.plano_conta, self.conta_caixa)
        
        # 3. Valida o Lançamento de Crédito (Aumento da Receita)
        credito = LancamentoContabil.objects.get(
            lote_contabil=lote, 
            tipo_movimento=LancamentoContabil.TipoMovimento.CREDITO
        )
        self.assertEqual(credito.plano_conta, self.conta_receita)

    def test_r7_invalid_account_failure(self):
        """Garante que a transação falha se uma conta não existir e faz rollback."""
        
        # Antes da execução, o banco está limpo
        initial_lote_count = LoteContabil.objects.count()
        initial_lancamento_count = LancamentoContabil.objects.count()

        # O código '9.9.9.9.9.9' não existe
        with self.assertRaises(PlanoConta.DoesNotExist):
            criar_lancamento_contabil(
                codigo_debito=CONTA_ESTOQUE,
                codigo_credito='9.9.9.9.9.9', 
                valor=Decimal('10.00'),
                historico_transacao="Erro de conta",
                descricao_lancamento="Teste de falha",
                usuario_criacao=self.user
            )

        # Após o erro, NENHUM registro deve ter sido criado (Rollback Atômico)
        self.assertEqual(LoteContabil.objects.count(), initial_lote_count, "O Lote não deve ter sido criado.")
        self.assertEqual(LancamentoContabil.objects.count(), initial_lancamento_count, "O Lançamento não deve ter sido criado.")

    def test_r7_zero_value_failure(self):
        """Garante que a transação falha se o valor for zero ou negativo."""
        
        with self.assertRaises(ValueError):
            criar_lancamento_contabil(
                codigo_debito=CONTA_ESTOQUE,
                codigo_credito=CONTA_FORNECEDORES,
                valor=Decimal('0.00'),
                historico_transacao="Valor zero",
                descricao_lancamento="Teste de valor zero",
                usuario_criacao=self.user
            )

        with self.assertRaises(ValueError):
            criar_lancamento_contabil(
                codigo_debito=CONTA_ESTOQUE,
                codigo_credito=CONTA_FORNECEDORES,
                valor=Decimal('-1.00'),
                historico_transacao="Valor negativo",
                descricao_lancamento="Teste de valor negativo",
                usuario_criacao=self.user
            )