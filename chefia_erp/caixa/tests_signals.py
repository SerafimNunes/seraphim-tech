# ARQUIVO: caixa/tests_signals.py (COMPLETO E CORRIGIDO)

from django.test import TestCase
from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from decimal import Decimal
from unittest import mock
import logging

# Importa modelos reais e o signal
from .models import Caixa, SessaoCaixa, MovimentoCaixa
from .signals import contabilizar_movimento_caixa, CONTA_CAIXA_GERAL, CONTA_AJUSTE_CAIXA, CONTA_AJUSTE_DESPESA
from core.models import UnidadeMedida 

# =========================================================================
# 2. IMPORTAÇÃO DOS MODELOS MOCKS (Centralizado para evitar Conflicting Models)
# =========================================================================
from .test_mocks import Cliente, Mesa, Produto, Venda, MetodoPagamento 

User = get_user_model()

# Mock do logger
class MockLogger:
    def __init__(self):
        self.warnings = []
        self.errors = []
        self.infos = []
    def warning(self, msg): self.warnings.append(msg)
    def error(self, msg): self.errors.append(msg)
    def info(self, msg): self.infos.append(msg)
    def reset(self):
        self.warnings = []
        self.errors = []
        self.infos = []

mock_logger = MockLogger()


# Decorator para mockar a função externa (Contabil) e o logger
@mock.patch('caixa.signals.criar_lancamento_contabil_partida_dobrada')
@mock.patch('caixa.signals.logger', mock_logger)
class CaixaSignalTestCase(TestCase):
    
    @classmethod
    def setUpTestData(cls):
        """Setup inicial de dados para todos os testes da classe."""
        cls.user = User.objects.create_user(username='caixa_user_signal', password='password123')
        cls.caixa = Caixa.objects.create(nome='Caixa Signal Teste', descricao='PDV Teste')
        cls.sessao = SessaoCaixa.objects.create(
            caixa=cls.caixa,
            usuario_abertura=cls.user,
            valor_inicial=Decimal('100.00')
        )
        
        # Configuração de Mocks Concretos
        cls.unidade_un, _ = UnidadeMedida.objects.get_or_create(sigla='UN', nome='UNidade Signal')
        cls.cliente_teste, _ = Cliente.objects.get_or_create(pk=10, nome="Cliente Teste Signal")
        cls.mesa_teste, _ = Mesa.objects.get_or_create(pk=10, numero='C10', status='LIVRE')
        cls.produto, _ = Produto.objects.get_or_create(
            pk=1000, 
            nome='Produto Teste Signal', 
            preco_venda=Decimal('100.00'), 
            unidade_medida=cls.unidade_un
        )
        # Venda base faturada
        cls.venda_faturada = Venda.objects.create(
            pk=10,
            atendente=cls.user,
            cliente=cls.cliente_teste,
            mesa=cls.mesa_teste,
            valor_total_liquido=Decimal('150.00'),
            status=Venda.Status.FATURADA
        )
        cls.venda_aberta = Venda.objects.create(
            pk=20,
            atendente=cls.user,
            cliente=cls.cliente_teste,
            mesa=cls.mesa_teste,
            valor_total_liquido=Decimal('50.00'),
            status=Venda.Status.ABERTA
        )
        
    def setUp(self):
        mock_logger.reset()
        # Conecta o signal
        post_save.connect(contabilizar_movimento_caixa, sender=MovimentoCaixa)
        # Garante que o signal será desconectado no tearDown do teste.
        self.addCleanup(post_save.disconnect, contabilizar_movimento_caixa, sender=MovimentoCaixa)


    # =========================================================================
    # TESTES DE FUNCIONALIDADE
    # =========================================================================

    def test_01_suprimento_contabilizado_corretamente(self, mock_contabil_service):
        valor_suprimento = Decimal('150.00')

        movimento = MovimentoCaixa.objects.create(
            sessao=self.sessao,
            usuario=self.user,
            tipo='SUPRIMENTO',
            valor=valor_suprimento,
            descricao='Teste Suprimento'
        )

        mock_contabil_service.assert_called_once()
        mock_contabil_service.assert_called_with(
            historico_transacao=mock.ANY,
            valor=valor_suprimento,
            codigo_debito=CONTA_CAIXA_GERAL, 
            codigo_credito=CONTA_AJUSTE_CAIXA, 
            movimento_caixa=movimento
        )

    def test_02_sangria_contabilizada_corretamente(self, mock_contabil_service):
        valor_sangria = Decimal('50.00')

        movimento = MovimentoCaixa.objects.create(
            sessao=self.sessao,
            usuario=self.user,
            tipo='SANGRIA',
            valor=valor_sangria,
            descricao='Teste Sangria'
        )

        mock_contabil_service.assert_called_once()
        mock_contabil_service.assert_called_with(
            historico_transacao=mock.ANY,
            valor=valor_sangria,
            codigo_debito=CONTA_AJUSTE_DESPESA, 
            codigo_credito=CONTA_CAIXA_GERAL, 
            movimento_caixa=movimento
        )


    def test_03_movimento_venda_e_ignorado(self, mock_contabil_service):
        movimento = MovimentoCaixa.objects.create(
            sessao=self.sessao,
            usuario=self.user,
            tipo='VENDA',
            valor=Decimal('300.00')
        )

        mock_contabil_service.assert_not_called()
        
        
    def test_04_movimento_zero_ou_negativo_e_ignorado(self, mock_contabil_service):
        # Desconecta o signal para testar a função isoladamente
        post_save.disconnect(contabilizar_movimento_caixa, sender=MovimentoCaixa)
        
        movimento_zero = MovimentoCaixa(
            sessao=self.sessao, usuario=self.user, tipo='SUPRIMENTO', valor=Decimal('0.00')
        )
        # Chama a função do signal diretamente (simulando a lógica)
        contabilizar_movimento_caixa(sender=MovimentoCaixa, instance=movimento_zero, created=True)
        
        movimento_negativo = MovimentoCaixa(
            sessao=self.sessao, usuario=self.user, tipo='SANGRIA', valor=Decimal('-10.00')
        )
        contabilizar_movimento_caixa(sender=MovimentoCaixa, instance=movimento_negativo, created=True)
        
        mock_contabil_service.assert_not_called()
        self.assertEqual(len(mock_logger.warnings), 2)


    def test_05_tratamento_de_erro_critico(self, mock_contabil_service):
        mock_contabil_service.side_effect = Exception("Erro forçado de contabilidade.")
        valor_suprimento = Decimal('10.00')

        # Espera que a exceção forçada pelo mock service seja levantada (disparando o rollback)
        with self.assertRaises(Exception): 
            MovimentoCaixa.objects.create(
                sessao=self.sessao,
                usuario=self.user,
                tipo='SUPRIMENTO',
                valor=valor_suprimento,
            )
            
        mock_contabil_service.assert_called_once()
        self.assertEqual(len(mock_logger.errors), 1)


    def test_06_nao_contabiliza_em_update(self, mock_contabil_service):
        movimento = MovimentoCaixa.objects.create(
            sessao=self.sessao,
            usuario=self.user,
            tipo='SUPRIMENTO',
            valor=Decimal('5.00')
        )
        # Limpa o histórico do mock após a chamada inicial (created=True)
        mock_contabil_service.reset_mock() 

        # Realiza uma atualização (disparando save com created=False)
        movimento.descricao = "Descrição Atualizada"
        movimento.save() 

        # Verifica se o serviço contábil NÃO foi chamado novamente
        mock_contabil_service.assert_not_called()
