# ==============================================================================
# ARQUIVO: financeiro/tests.py (COMPLETO E CORRIGIDO)
# ==============================================================================
from django.test import TestCase
from django.db import IntegrityError 
from datetime import date, timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from unittest.mock import patch

# Modelos do novo app
from .models import ContasAPagar, StatusContasAPagar
# Modelos de dependência
from compras.models import PedidoCompra, StatusPedidoCompra
from core.models import Fornecedor 

User = get_user_model()


class ContasAPagarModelTest(TestCase):
    """Testa o modelo ContasAPagar e seus métodos."""

    def setUp(self):
        self.user = User.objects.create_user(username='tester', password='password')
        self.fornecedor = Fornecedor.objects.create(
            nome='Fornecedor Teste', 
            cnpj='00000000000000'
        )
        self.pedido = PedidoCompra.objects.create(
            fornecedor=self.fornecedor,
            responsavel=self.user,
            total_liquido=Decimal('500.00'),
            data_prevista_recebimento=date.today() + timedelta(days=30),
            status=StatusPedidoCompra.AGUARDANDO
        )

    def test_contas_a_pagar_creation(self):
        """Testa se a criação da Conta a Pagar funciona corretamente."""
        data_vencimento = date.today() + timedelta(days=15)
        ContasAPagar.objects.create(
            pedido_compra=self.pedido,
            fornecedor=self.fornecedor,
            valor_original=Decimal('500.00'),
            data_vencimento=data_vencimento,
            usuario_criacao=self.user,
            status=StatusContasAPagar.A_PAGAR
        )
        
        # Teste de unicidade OneToOne
        with self.assertRaises(IntegrityError): 
            ContasAPagar.objects.create(
                pedido_compra=self.pedido, 
                fornecedor=self.fornecedor,
                valor_original=Decimal('10.00'),
                data_vencimento=date.today(),
                status=StatusContasAPagar.A_PAGAR
            )


    def test_valor_a_pagar_property(self):
        """Testa a propriedade do valor restante a pagar."""
        conta = ContasAPagar.objects.create(
            pedido_compra=self.pedido,
            fornecedor=self.fornecedor,
            valor_original=Decimal('100.00'),
            data_vencimento=date.today(),
            status=StatusContasAPagar.A_PAGAR
        )

        self.assertEqual(conta.valor_a_pagar, Decimal('100.00')) 
        
        # Pagamento Parcial
        conta.valor_pago = Decimal('40.00')
        conta.save()
        self.assertEqual(conta.valor_a_pagar, Decimal('60.00'))


class ContasAPagarSignalTest(TestCase):
    """Testa a contabilização de pagamento do ContasAPagar (Signal 2 - Módulo Financeiro)."""
    
    @patch('financeiro.signals.criar_lancamento_contabil_partida_dobrada', side_effect=lambda *args, **kwargs: None)
    def setUp(self, mock_contabil):
        self.user = User.objects.create_user(username='tester_fin', password='password')
        self.fornecedor = Fornecedor.objects.create(nome='Fornecedor Pago', cnpj='11111111111111')
        self.pedido = PedidoCompra.objects.create(
            fornecedor=self.fornecedor,
            responsavel=self.user,
            total_liquido=Decimal('100.00'),
            data_prevista_recebimento=date.today(),
            status=StatusPedidoCompra.FINALIZADO 
        )
        self.conta = ContasAPagar.objects.create(
            pedido_compra=self.pedido,
            fornecedor=self.fornecedor,
            valor_original=Decimal('100.00'),
            data_vencimento=date.today(),
            usuario_criacao=self.user,
            status=StatusContasAPagar.A_PAGAR,
            contabilizado_pagamento=False
        )

    # Patching no teste para garantir isolamento
    @patch('financeiro.signals.criar_lancamento_contabil_partida_dobrada', side_effect=lambda *args, **kwargs: None)
    def test_signal_contabiliza_pagamento_total(self, mock_contabil):
        """Garante que o pagamento total é contabilizado."""
        
        self.conta.status = StatusContasAPagar.PAGO_TOTAL
        self.conta.valor_pago = Decimal('100.00')
        self.conta.save()
        
        mock_contabil.assert_called_once()
        self.conta.refresh_from_db()
        self.assertTrue(self.conta.contabilizado_pagamento)

    @patch('financeiro.signals.criar_lancamento_contabil_partida_dobrada', side_effect=lambda *args, **kwargs: None)
    def test_signal_not_on_partial_payment(self, mock_contabil):
        """Garante que pagamento parcial NÃO dispara a contabilização total."""
        
        self.conta.status = StatusContasAPagar.PAGO_PARCIAL
        self.conta.valor_pago = Decimal('50.00')
        self.conta.save()
        
        mock_contabil.assert_not_called()
        self.conta.refresh_from_db()
        self.assertFalse(self.conta.contabilizado_pagamento)