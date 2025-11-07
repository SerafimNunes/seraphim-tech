# ==============================================================================
# ARQUIVO: compras/tests.py (CORRIGIDO - Criação do Plano de Contas)
# ==============================================================================
from django.test import TestCase
from datetime import date
from decimal import Decimal
from django.contrib.auth import get_user_model
from unittest.mock import patch

# Modelos do app 'compras'
from .models import PedidoCompra, ItemPedidoCompra, StatusPedidoCompra
# Modelos de dependência
from core.models import Fornecedor
from core.models import UnidadeMedida, Categoria 
from estoque.models import Produto, MovimentoEstoque, ItemMovimentoEstoque 
from financeiro.models import ContasAPagar, StatusContasAPagar 
# Importação do modelo de Contabilidade e Serviço
from contabil.models import PlanoConta # <--- NOVO: Importa PlanoConta
from contabil.services import criar_lancamento_contabil as criar_lancamento_contabil_partida_dobrada

User = get_user_model()

# Constantes de Contas (devem ser as mesmas usadas em compras/signals.py)
CONTA_ESTOQUE = '1.1.0.2.0.1'           
CONTA_FORNECEDORES = '2.1.0.1.0.1'      


class PedidoCompraSignalR6Test(TestCase):
    """Testa a lógica de signals pós-save do PedidoCompra (Implementação R6)."""

    def setUp(self):
        # 0. Configuração Mínima do Plano de Contas para que o signal de compra não falhe
        PlanoConta.objects.create(codigo=CONTA_ESTOQUE, nome='Estoque de Materiais', tipo='A') # Ativo (Debito)
        PlanoConta.objects.create(codigo=CONTA_FORNECEDORES, nome='Fornecedores a Pagar', tipo='P') # Passivo (Credito)
        
        # O usuário criado é o 'responsavel' que estava faltando no MovimentoEstoque
        self.user = User.objects.create_user(username='tester_compra', password='password')
        self.fornecedor = Fornecedor.objects.create(nome='Fornecedor Teste', cnpj='00000000000000')
        
        # Criação de dependências de FK para Produto
        self.unidade_medida = UnidadeMedida.objects.create(sigla='UN', nome='Unidade')
        self.categoria = Categoria.objects.create(nome='Materia-Prima') 
        
        self.produto = Produto.objects.create(
            nome='Produto CMP',
            unidade_medida=self.unidade_medida, 
            categoria=self.categoria, 
        )
        
        # Cria um pedido inicial no status AGUARDANDO
        self.pedido = PedidoCompra.objects.create(
            fornecedor=self.fornecedor,
            responsavel=self.user, 
            total_liquido=Decimal('0.00'),
            data_prevista_recebimento=date.today(),
            status=StatusPedidoCompra.AGUARDANDO,
            movimento_criado=False
        )
        
        # Adiciona item
        ItemPedidoCompra.objects.create(
            pedido_compra=self.pedido,
            produto=self.produto,
            quantidade_pedida=Decimal('5.00'),
            preco_unitario_negociado=Decimal('12.00'),
            quantidade_recebida=Decimal('5.00') 
        )
        
        # Recalcula o total (Total = R$ 60.00)
        self.pedido.calcular_total() 

    # Patching no caminho correto (compras.signals)
    @patch('compras.signals.criar_lancamento_contabil_partida_dobrada', side_effect=lambda *args, **kwargs: None)
    def test_r6_contas_a_pagar_creation_on_finalizado(self, mock_contabil):
        """
        Garante que o status FINALIZADO cria ContasAPagar, MovimentoEstoque e Contabiliza.
        """
        # --- AÇÃO: Mudar o status para FINALIZADO (DISPARA O SIGNAL) ---
        self.pedido.status = StatusPedidoCompra.FINALIZADO
        self.pedido.save()

        # 1. VERIFICAÇÃO R6: Conta a Pagar Criada no app 'financeiro'
        conta_apagar = ContasAPagar.objects.get(pedido_compra=self.pedido)
        self.assertIsNotNone(conta_apagar)
        self.assertEqual(conta_apagar.valor_original, Decimal('60.00'))
        
        # 2. VERIFICAÇÃO ESTOQUE: Movimento de Estoque Criado
        movimento_estoque = MovimentoEstoque.objects.get(pedido_compra=self.pedido)
        self.assertIsNotNone(movimento_estoque)
        
        # 4. VERIFICAÇÃO CONTABILIDADE: Serviço de Contabilidade Chamado
        mock_contabil.assert_called_once()
        
        # 5. VERIFICAÇÃO FLUXO: Flag de segurança ativada
        self.pedido.refresh_from_db()
        self.assertTrue(self.pedido.movimento_criado)


    @patch('compras.signals.criar_lancamento_contabil_partida_dobrada', side_effect=lambda *args, **kwargs: None)
    def test_r6_no_action_on_aguardando(self, mock_contabil):
        """Testa se o signal NÃO dispara em status não-recebido (AGUARDANDO)."""
        
        self.pedido.observacoes = "Apenas uma observação"
        self.pedido.save()
        
        self.assertEqual(ContasAPagar.objects.count(), 0)
        self.assertEqual(MovimentoEstoque.objects.count(), 0)
        mock_contabil.assert_not_called()
        self.pedido.refresh_from_db()
        self.assertFalse(self.pedido.movimento_criado)


    def test_r6_no_duplicate_creation(self):
        """Garante que o ContasAPagar não é criado duas vezes (usando a flag de segurança)."""
        
        # Primeiro SAVE (dispara a lógica)
        self.pedido.status = StatusPedidoCompra.FINALIZADO
        self.pedido.save()
        
        self.assertEqual(ContasAPagar.objects.count(), 1)
        
        # Segundo SAVE (Não deve disparar novamente)
        self.pedido.observacoes = "Pedido Finalizado e Testado"
        self.pedido.save()
        
        # Contagem deve permanecer em 1, graças à flag `movimento_criado`
        self.assertEqual(ContasAPagar.objects.count(), 1)