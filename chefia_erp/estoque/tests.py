# estoque/tests.py
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.db import transaction
from decimal import Decimal
import json
from unittest.mock import patch, MagicMock

# Importa modelos e views
from core.models import UnidadeMedida
from .models import (
    Produto, MovimentoEstoque, ItemMovimentoEstoque,
    RequisicaoEstoque, AuditoriaInventario, ContagemDiariaFLV
)
from .views import (
    create_requisicao_estoque_api,
    create_contagem_flv_api
)

User = get_user_model()

# ==============================================================================
# CLASSES BASE DE SETUP
# ==============================================================================

class BaseEstoqueTestCase(TestCase):
    """Setup base para criar produtos, usuário e unidades de medida."""
    def setUp(self):
        # 1. Setup de Usuário e Unidade
        self.user = User.objects.create_user(username='tester', password='password')
        self.unidade_kg = UnidadeMedida.objects.create(nome='Kilograma', sigla='KG', is_fracionavel=True)
        self.unidade_un = UnidadeMedida.objects.create(nome='Unidade', sigla='UN', is_fracionavel=False)

        # 2. Setup de Produtos
        # Produto A (Insumo - Matéria Prima)
        self.produto_a = Produto.objects.create(
            nome='Tomate Longa Vida',
            unidade_medida=self.unidade_kg,
            estoque_minimo=Decimal('10.000'),
            is_pre_pronto=False,
            # Inicialmente com CMP 0 e Saldo 0
            quantidade_atual=Decimal('0.000'),
            custo_medio_ponderado=Decimal('0.0000')
        )

        # Produto B (Pré-Pronto)
        self.produto_b = Produto.objects.create(
            nome='Carne Desfiada Cozida',
            unidade_medida=self.unidade_kg,
            estoque_minimo=Decimal('5.000'),
            is_pre_pronto=True,
            quantidade_atual=Decimal('20.000'),
            custo_medio_ponderado=Decimal('15.0000') # CMP de exemplo para teste
        )

        # 3. Criar Movimento Inicial de Entrada (para fins de CMP)
        MovimentoEstoque.objects.create(
            tipo_movimento='ENTRADA_COMPRA',
            observacoes='Compra Inicial para Testes'
        )
        # O Movimento acima não cria itens. Vamos criar um ItemMovimento para testar o CMP.
        self.movimento_entrada_inicial = MovimentoEstoque.objects.create(
            tipo_movimento='ENTRADA_COMPRA',
            observacoes='Entrada de Compra (Produto A)'
        )
        ItemMovimentoEstoque.objects.create(
            movimento=self.movimento_entrada_inicial,
            produto=self.produto_a,
            quantidade_movimentada=Decimal('100.000'),
            preco_unitario=Decimal('5.0000')
        )
        # Recarrega o produto A após o signal de CMP
        self.produto_a.refresh_from_db()
        self.assertEqual(self.produto_a.quantidade_atual, Decimal('100.000'))
        self.assertEqual(self.produto_a.custo_medio_ponderado, Decimal('5.0000'))
        self.assertEqual(self.produto_a.preco_custo, Decimal('5.00')) # Preço custo arredondado


# ==============================================================================
# TESTES DE LÓGICA DE MOVIMENTAÇÃO (Signals)
# ==============================================================================

class MovimentacaoLogicTests(BaseEstoqueTestCase):
    """Testes focados na criação de MovimentoEstoque via Signals dos documentos."""

    def test_01_requisicao_cria_saida_e_baixa_estoque(self):
        """Testa se a criação da RequisicaoEstoque gera SAÍDA e atualiza o saldo."""
        
        # Saldo inicial do Produto A: 100.000
        initial_qty = self.produto_a.quantidade_atual
        qty_requested = Decimal('20.000')

        # 1. Cria a Requisição (Status PENDENTE)
        requisicao = RequisicaoEstoque.objects.create(
            produto=self.produto_a,
            quantidade_requisitada=qty_requested,
            responsavel=self.user, # Usaremos este campo em breve
            observacoes="Requisição para molho"
        )
        
        # 2. Conclui a Requisição (simula o atendimento e o signal)
        # O campo quantidade_entregue dispara o signal
        requisicao.quantidade_entregue = qty_requested
        requisicao.status = 'ATENDIDA'
        requisicao.save()

        # 3. Verifica o MovimentoEstoque gerado
        movimento = requisicao.movimento_saida
        self.assertIsNotNone(movimento)
        self.assertEqual(movimento.tipo_movimento, 'SAIDA_PRODUCAO')
        
        # 4. Verifica o ItemMovimentoEstoque gerado
        item_mov = ItemMovimentoEstoque.objects.get(movimento=movimento, produto=self.produto_a)
        self.assertEqual(item_mov.quantidade_movimentada, qty_requested)
        # Saída deve ser valorizada pelo CMP atual (R$ 5.0000)
        self.assertEqual(item_mov.preco_unitario.quantize(Decimal('0.0000')), self.produto_a.custo_medio_ponderado)

        # 5. Verifica o Saldo Final (100 - 20 = 80)
        self.produto_a.refresh_from_db()
        expected_qty = initial_qty - qty_requested
        self.assertEqual(self.produto_a.quantidade_atual, expected_qty)
        # CMP não deve mudar em SAÍDAS
        self.assertEqual(self.produto_a.custo_medio_ponderado, Decimal('5.0000'))
        
        print("\nTeste 01 (Requisição SAÍDA) PASSOU.")

    def test_02_contagem_flv_ajuste_entrada(self):
        """Testa se a Contagem FLV gera um AJUSTE DE ENTRADA e recalcula o CMP."""

        # Produto B: Saldo 20.000, CMP R$ 15.0000
        initial_qty = self.produto_b.quantidade_atual
        initial_cmp = self.produto_b.custo_medio_ponderado
        
        # Contagem Cega: Contamos 5 unidades a mais (25.000)
        qty_counted = Decimal('25.000')
        diff = qty_counted - initial_qty # Diferença: +5.000

        # 1. Cria a Contagem (Status PENDENTE)
        contagem = ContagemDiariaFLV.objects.create(
            produto=self.produto_b,
            quantidade_sistema=initial_qty,
            quantidade_contada=qty_counted,
            responsavel=self.user
        )
        
        # 2. Conclui a Contagem (Status CONCLUIDA)
        contagem.status = 'CONCLUIDA'
        contagem.save()
        
        # 3. Verifica o MovimentoEstoque (AJUSTE DE ENTRADA)
        movimento = contagem.movimento_ajuste
        self.assertIsNotNone(movimento)
        self.assertEqual(movimento.tipo_movimento, 'ENTRADA_AJUSTE')
        
        # 4. Verifica o ItemMovimentoEstoque gerado
        item_mov = ItemMovimentoEstoque.objects.get(movimento=movimento, produto=self.produto_b)
        self.assertEqual(item_mov.quantidade_movimentada, diff)
        # Ajuste de entrada deve ser valorizado pelo CMP atual (R$ 15.0000)
        self.assertEqual(item_mov.preco_unitario.quantize(Decimal('0.0000')), initial_cmp)
        
        # 5. Verifica o Saldo Final (20 + 5 = 25)
        self.produto_b.refresh_from_db()
        expected_qty = initial_qty + diff
        self.assertEqual(self.produto_b.quantidade_atual, expected_qty)
        
        # 6. Verifica o Recálculo do CMP (ENTRADA_AJUSTE RECALCULA CMP)
        # Valor Antigo: 20 * 15.00 = 300.00
        # Valor Ajuste: 5 * 15.00 = 75.00 (Entrada Ajuste é valorizada pelo CMP de saída)
        # Valor Novo: 300.00 + 75.00 = 375.00
        # Nova Qtd: 25.000
        # Novo CMP: 375.00 / 25.000 = 15.0000 (Neste caso, o CMP permanece o mesmo)
        self.assertEqual(self.produto_b.custo_medio_ponderado, Decimal('15.0000'))

        print("Teste 02 (Contagem AJUSTE ENTRADA) PASSOU.")

    def test_03_auditoria_inventario_ajuste_saida(self):
        """Testa se a Auditoria de Inventário gera um AJUSTE DE SAÍDA."""

        # Produto A: Saldo 80.000 (após teste 01), CMP R$ 5.0000
        self.produto_a.quantidade_atual = Decimal('80.000')
        self.produto_a.save()
        initial_qty = self.produto_a.quantidade_atual
        
        # Contagem Cega: Contamos 10 unidades a menos (70.000)
        qty_counted = Decimal('70.000')
        diff = initial_qty - qty_counted # Diferença: +10.000 (em Saída)

        # 1. Cria a Auditoria (Status PENDENTE)
        auditoria = AuditoriaInventario.objects.create(
            produto=self.produto_a,
            quantidade_sistema=initial_qty,
            quantidade_contada=qty_counted,
            responsavel=self.user
        )
        
        # 2. Conclui a Auditoria (Status CONCLUIDA)
        auditoria.status = 'CONCLUIDA'
        auditoria.save()
        
        # 3. Verifica o MovimentoEstoque (AJUSTE DE SAÍDA)
        movimento = auditoria.movimento_ajuste
        self.assertIsNotNone(movimento)
        self.assertEqual(movimento.tipo_movimento, 'SAIDA_AJUSTE')
        
        # 4. Verifica o ItemMovimentoEstoque gerado
        item_mov = ItemMovimentoEstoque.objects.get(movimento=movimento, produto=self.produto_a)
        self.assertEqual(item_mov.quantidade_movimentada, diff)
        # Ajuste de saída deve ser valorizado pelo CMP atual (R$ 5.0000)
        self.assertEqual(item_mov.preco_unitario.quantize(Decimal('0.0000')), self.produto_a.custo_medio_ponderado)

        # 5. Verifica o Saldo Final (80 - 10 = 70)
        self.produto_a.refresh_from_db()
        expected_qty = initial_qty - diff
        self.assertEqual(self.produto_a.quantidade_atual, expected_qty)
        # CMP não deve mudar em SAÍDAS (nem SAIDA_PRODUCAO, nem SAIDA_AJUSTE)
        self.assertEqual(self.produto_a.custo_medio_ponderado, Decimal('5.0000'))

        print("Teste 03 (Auditoria AJUSTE SAÍDA) PASSOU.")


# ==============================================================================
# TESTES DE LÓGICA DE CUSTO MÉDIO PONDERADO (CMP)
# ==============================================================================

class CMPCalculationTests(BaseEstoqueTestCase):
    """Testes focados na precisão e reversão do CMP."""

    def test_04_cmp_recalc_after_second_entrada(self):
        """Verifica o recálculo do CMP após uma segunda entrada com preço diferente."""

        # Produto A: Saldo 100.000 @ R$ 5.0000 (Valor Total: R$ 500.00)
        self.produto_a.refresh_from_db()

        # 1. Segunda Entrada: 50.000 unidades @ R$ 6.0000
        movimento_entrada_2 = MovimentoEstoque.objects.create(
            tipo_movimento='ENTRADA_COMPRA',
            observacoes='Segunda Entrada para CMP'
        )
        ItemMovimentoEstoque.objects.create(
            movimento=movimento_entrada_2,
            produto=self.produto_a,
            quantidade_movimentada=Decimal('50.000'),
            preco_unitario=Decimal('6.0000')
        )
        
        # 2. Recálculo Manual (CMP)
        # Valor Total Antigo: 100 * 5.0000 = 500.00
        # Valor Total Novo: 50 * 6.0000 = 300.00
        # Novo Valor Global: 500.00 + 300.00 = 800.00
        # Nova Qtd Global: 100.000 + 50.000 = 150.000
        # Novo CMP: 800.00 / 150.000 = 5.333333...

        # 3. Verifica o resultado do Signal
        self.produto_a.refresh_from_db()
        expected_cmp = Decimal('5.3333') # Precisão de 4 casas
        
        self.assertEqual(self.produto_a.quantidade_atual, Decimal('150.000'))
        self.assertEqual(self.produto_a.custo_medio_ponderado, expected_cmp)
        self.assertEqual(self.produto_a.preco_custo, Decimal('5.33')) # Preço custo arredondado para 2 casas
        
        print("Teste 04 (CMP Recálculo) PASSOU.")

    def test_05_cmp_reversion_on_entrada_delete(self):
        """
        Testa a reversão da quantidade após a deleção de um item de ENTRADA.
        NOTA: O CMP não é recalculado para trás, mas o saldo sim.
        """
        # Produto B: Saldo 20.000, CMP R$ 15.0000
        self.produto_b.refresh_from_db()
        initial_qty = self.produto_b.quantidade_atual
        initial_cmp = self.produto_b.custo_medio_ponderado

        # 1. Entrada de 10.000 unidades @ R$ 20.0000 (para mudar o CMP)
        movimento_entrada_extra = MovimentoEstoque.objects.create(
            tipo_movimento='ENTRADA_COMPRA',
            observacoes='Entrada para Teste de Deleção'
        )
        item_mov = ItemMovimentoEstoque.objects.create(
            movimento=movimento_entrada_extra,
            produto=self.produto_b,
            quantidade_movimentada=Decimal('10.000'),
            preco_unitario=Decimal('20.0000')
        )
        
        # Verifica o CMP intermediário (20*15 + 10*20) / 30 = 500 / 30 = 16.6666
        self.produto_b.refresh_from_db()
        cmp_before_delete = Decimal('16.6667')
        self.assertEqual(self.produto_b.quantidade_atual, Decimal('30.000'))
        self.assertEqual(self.produto_b.custo_medio_ponderado, cmp_before_delete)
        
        # 2. Exclui o item de movimento (Signal post_delete)
        item_mov.delete()
        
        # 3. Verifica o resultado: Qtd revertida (30-10=20), CMP não revertido
        self.produto_b.refresh_from_db()
        self.assertEqual(self.produto_b.quantidade_atual, initial_qty)
        # O CMP não é revertido atomicamente por questões contábeis/complexidade
        self.assertEqual(self.produto_b.custo_medio_ponderado, cmp_before_delete) 

        print("Teste 05 (CMP Deleção Entrada) PASSOU.")


# ==============================================================================
# TESTES DE INTEGRAÇÃO DE API (Views)
# ==============================================================================

class EstoqueAPITests(BaseEstoqueTestCase):
    """Testes focados nas views de API (Requisição e Contagem FLV)."""

    def test_06_create_requisicao_estoque_api_success(self):
        """Testa o endpoint de criação de requisição (SAÍDA)."""
        self.client.force_login(self.user)
        
        url = reverse('estoque_api:create_requisicao_estoque_api')
        data = {
            'produto_id': self.produto_a.pk,
            'quantidade_requisitada': '15.500',
            'responsavel_id': self.user.pk,
            'observacoes': 'API Teste de Saída'
        }
        
        initial_qty = self.produto_a.quantidade_atual # 150.000 (após teste 04)

        with transaction.atomic(): # Necessário para testar a lógica dos signals na view
            response = self.client.post(url, json.dumps(data), content_type='application/json')
        
        # 1. Verifica a resposta da API
        self.assertEqual(response.status_code, 201)
        response_json = response.json()
        self.assertTrue(response_json['success'])
        self.assertEqual(response_json['status'], 'ATENDIDA')
        
        # 2. Verifica se a Requisição foi criada
        requisicao = RequisicaoEstoque.objects.get(pk=response_json['id'])
        self.assertEqual(requisicao.quantidade_requisitada, Decimal('15.500'))
        
        # 3. Verifica se o Movimento foi gerado (Signal)
        self.produto_a.refresh_from_db()
        expected_qty = initial_qty - Decimal('15.500')
        self.assertEqual(self.produto_a.quantidade_atual, expected_qty)

        print("Teste 06 (API Requisição) PASSOU.")


    def test_07_create_contagem_flv_api_ajuste_success(self):
        """Testa o endpoint de criação de contagem FLV (AJUSTE)."""
        self.client.force_login(self.user)
        
        url = reverse('estoque_api:create_contagem_flv_api')
        
        # Saldo Sistema Atualizado: 150.000 - 15.500 = 134.500
        self.produto_a.refresh_from_db()
        initial_qty = self.produto_a.quantidade_atual
        
        data = {
            'produto_id': self.produto_a.pk,
            'quantidade_contada': '138.500', # Contamos 4.000 a mais
            'responsavel_id': self.user.pk
        }

        with transaction.atomic():
            response = self.client.post(url, json.dumps(data), content_type='application/json')
            
        # 1. Verifica a resposta da API
        self.assertEqual(response.status_code, 201)
        response_json = response.json()
        self.assertTrue(response_json['success'])
        self.assertEqual(response_json['status'], 'CONCLUIDA')
        
        # 2. Verifica se o Saldo foi ajustado
        self.produto_a.refresh_from_db()
        # 134.500 + 4.000 = 138.500
        self.assertEqual(self.produto_a.quantidade_atual, Decimal('138.500'))

        # 3. Verifica se o Movimento de AJUSTE foi gerado
        contagem = ContagemDiariaFLV.objects.get(pk=response_json['id'])
        self.assertEqual(contagem.movimento_ajuste.tipo_movimento, 'ENTRADA_AJUSTE')
        
        print("Teste 07 (API Contagem FLV) PASSOU.")
