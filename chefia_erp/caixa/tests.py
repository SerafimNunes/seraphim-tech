# ARQUIVO: caixa/tests.py (COMPLETO E CORRIGIDO)

from django.test import TestCase
from django.contrib.auth import get_user_model
from django.db.models import Sum
from django.utils import timezone
from decimal import Decimal
import datetime

# =========================================================================
# 1. IMPORTAÇÃO DOS MODELOS REAIS
# =========================================================================
from .models import Caixa, SessaoCaixa, MovimentoCaixa
from core.models import UnidadeMedida 

# =========================================================================
# 2. IMPORTAÇÃO DOS MODELOS MOCKS (Centralizado para evitar Conflicting Models)
# =========================================================================
from .test_mocks import Cliente, Mesa, Produto, Venda, MetodoPagamento 

User = get_user_model()

# =========================================================================
# 3. TEST CASE PRINCIPAL
# =========================================================================

class CaixaModelsTestCase(TestCase):
    
    @classmethod
    def setUpTestData(cls):
        """Setup inicial de dados para todos os testes da classe."""
        cls.user = User.objects.create_user(username='caixa_user', password='password123')
        cls.caixa = Caixa.objects.create(nome='Caixa Central', descricao='PDV Principal')
        
        # Mocks para Venda 
        cls.unidade_un, _ = UnidadeMedida.objects.get_or_create(sigla='UN', nome='Unidade')
        cls.cliente_teste, _ = Cliente.objects.get_or_create(pk=1, nome="Cliente Teste Caixa")
        cls.mesa_teste, _ = Mesa.objects.get_or_create(pk=1, numero='C99', status='LIVRE')
        cls.produto, _ = Produto.objects.get_or_create(
            pk=999, 
            nome='Produto Teste', 
            preco_venda=Decimal('100.00'), 
            unidade_medida=cls.unidade_un
        )
        # Venda base faturada (para simular pagamentos que geram movimento)
        cls.venda_faturada = Venda.objects.create(
            pk=1,
            atendente=cls.user,
            cliente=cls.cliente_teste,
            mesa=cls.mesa_teste,
            valor_total_liquido=Decimal('150.00'),
            status=Venda.Status.FATURADA
        )
        cls.venda_aberta = Venda.objects.create(
            pk=2,
            atendente=cls.user,
            cliente=cls.cliente_teste,
            mesa=cls.mesa_teste,
            valor_total_liquido=Decimal('50.00'),
            status=Venda.Status.ABERTA
        )


    # ---------------------------------------------------------------------
    # LÓGICA DE CÁLCULO DE SALDO (Método auxiliar para testes)
    # ---------------------------------------------------------------------
    def _recalcular_saldo(self, sessao):
        """Implementa a lógica de cálculo de saldo, atualizando valor_final no modelo."""
        
        # Movimentos são acessados via related_name='movimentos_avulsos'
        movimentos = sessao.movimentos_avulsos.all()
        
        entradas = movimentos.filter(tipo__in=['SUPRIMENTO', 'VENDA']).aggregate(
            total=Sum('valor')
        )['total'] or Decimal('0.00')
        
        saidas = movimentos.filter(tipo='SANGRIA').aggregate(
            total=Sum('valor')
        )['total'] or Decimal('0.00')

        saldo_final_calculado = sessao.valor_inicial + entradas - saidas
        
        sessao.valor_final = saldo_final_calculado
        sessao.save(update_fields=['valor_final'])
        
        return saldo_final_calculado

    # ---------------------------------------------------------------------
    # LÓGICA DE SINAL SIMULADA (caixa/signals.py)
    # ---------------------------------------------------------------------
    def _simular_signal_metodo_pagamento(self, pagamento_instance, sessao_ativa):
        """Simula a lógica do signal MetodoPagamento post_save."""
        if pagamento_instance.venda.status != Venda.Status.FATURADA:
            return
            
        if pagamento_instance.tipo_pagamento.upper() == 'DINHEIRO':
            MovimentoCaixa.objects.create(
                sessao=sessao_ativa,
                usuario=self.user,
                tipo='VENDA', 
                valor=pagamento_instance.valor_pago,
                descricao=f"Pagamento Venda #{pagamento_instance.venda.pk} via {pagamento_instance.tipo_pagamento}",
                venda=pagamento_instance.venda,
                pagamento=pagamento_instance
            )

    # =========================================================================
    # TESTES DE FUNCIONALIDADE
    # =========================================================================

    def test_01_sessao_abertura_e_fechamento_basico(self):
        saldo_inicial = Decimal('75.00')
        sessao = SessaoCaixa.objects.create(caixa=self.caixa, usuario_abertura=self.user, valor_inicial=saldo_inicial)
        
        self.assertEqual(sessao.status, 'ABERTO')
        self.assertIsNone(sessao.valor_final) 

        sessao.status = 'FECHADO'
        sessao.usuario_fechamento = self.user
        sessao.data_fechamento = timezone.now()
        sessao.valor_final = saldo_inicial 
        sessao.save()
        
        self.assertEqual(sessao.status, 'FECHADO')
        self.assertEqual(sessao.valor_final, Decimal('75.00'))


    def test_02_recalculo_com_movimentos_manuais(self):
        saldo_inicial = Decimal('100.00')
        reforco = Decimal('250.00')
        sangria = Decimal('50.00')
        sessao = SessaoCaixa.objects.create(caixa=self.caixa, usuario_abertura=self.user, valor_inicial=saldo_inicial)

        MovimentoCaixa.objects.create(sessao=sessao, usuario=self.user, tipo='SUPRIMENTO', valor=reforco)
        MovimentoCaixa.objects.create(sessao=sessao, usuario=self.user, tipo='SANGRIA', valor=sangria)
        
        saldo_calculado = self._recalcular_saldo(sessao)

        self.assertEqual(saldo_calculado, Decimal('300.00'))
        self.assertEqual(sessao.movimentos_avulsos.count(), 2)


    def test_03_integracao_venda_com_pagamento_dinheiro(self):
        sessao_ativa = SessaoCaixa.objects.create(caixa=self.caixa, usuario_abertura=self.user, valor_inicial=Decimal('10.00'))
        valor_pagamento = Decimal('50.00') 

        pagamento_dinheiro = MetodoPagamento.objects.create(
            venda=self.venda_faturada, tipo_pagamento='DINHEIRO', valor_pago=valor_pagamento
        )
        self._simular_signal_metodo_pagamento(pagamento_dinheiro, sessao_ativa)
        
        saldo_calculado = self._recalcular_saldo(sessao_ativa)

        self.assertEqual(saldo_calculado, Decimal('60.00'))
        movimento = MovimentoCaixa.objects.get(pagamento=pagamento_dinheiro)
        self.assertEqual(movimento.tipo, 'VENDA')


    def test_04_integracao_venda_nao_contabiliza_cartao(self):
        sessao_ativa = SessaoCaixa.objects.create(caixa=self.caixa, usuario_abertura=self.user, valor_inicial=Decimal('100.00'))
        
        pagamento_cartao = MetodoPagamento.objects.create(
            venda=self.venda_faturada, tipo_pagamento='CARTAO_CREDITO', valor_pago=Decimal('75.00')
        )
        self._simular_signal_metodo_pagamento(pagamento_cartao, sessao_ativa)
        
        saldo_calculado = self._recalcular_saldo(sessao_ativa)

        self.assertEqual(saldo_calculado, Decimal('100.00'))
        self.assertEqual(MovimentoCaixa.objects.count(), 0)


    def test_05_integracao_venda_nao_contabiliza_se_nao_faturada(self):
        sessao_ativa = SessaoCaixa.objects.create(caixa=self.caixa, usuario_abertura=self.user, valor_inicial=Decimal('100.00'))
        
        pagamento_ignorado = MetodoPagamento.objects.create(
            venda=self.venda_aberta, tipo_pagamento='DINHEIRO', valor_pago=Decimal('50.00')
        )
        
        self._simular_signal_metodo_pagamento(pagamento_ignorado, sessao_ativa)
        
        saldo_calculado = self._recalcular_saldo(sessao_ativa)

        self.assertEqual(saldo_calculado, Decimal('100.00'))
        self.assertEqual(MovimentoCaixa.objects.count(), 0)


    def test_06_recalculo_com_multiplos_tipos(self):
        saldo_inicial = Decimal('100.00')
        sessao = SessaoCaixa.objects.create(caixa=self.caixa, usuario_abertura=self.user, valor_inicial=saldo_inicial)
        
        MovimentoCaixa.objects.create(sessao=sessao, usuario=self.user, tipo='SUPRIMENTO', valor=Decimal('50.00'))
        MovimentoCaixa.objects.create(sessao=sessao, usuario=self.user, tipo='SANGRIA', valor=Decimal('10.00'))
        
        pagamento_venda = MetodoPagamento.objects.create(
            venda=self.venda_faturada, tipo_pagamento='DINHEIRO', valor_pago=Decimal('20.00')
        )
        self._simular_signal_metodo_pagamento(pagamento_venda, sessao)

        saldo_calculado = self._recalcular_saldo(sessao)

        # 100.00 + 50.00 + 20.00 - 10.00 = 160.00
        self.assertEqual(saldo_calculado, Decimal('160.00'))
        self.assertEqual(sessao.movimentos_avulsos.count(), 3)
