from django.test import TestCase
from django.db import IntegrityError
from django.utils.translation import gettext_lazy as _
from decimal import Decimal, ROUND_HALF_UP
import logging

# ======================================================================
# CORREÇÃO: Importando Modelos Reais de core.models
# ======================================================================
from core.models import UnidadeMedida, Categoria, Usuario 

# Importa os modelos e serviços atualizados
from .models import (
    Produto, LocalEstocagem, CustoProduto,
    MovimentoEstoque, ItemMovimentoEstoque,
    TIPOS_MOVIMENTO
)
from .services import EstoqueService


# Configuração de Precisão Decimal
# Garante 4 casas para cálculos de custo e 3 para quantidade.
QUATRO_CASAS = Decimal('0.0000')
TRES_CASAS = Decimal('0.001')


class CMPIntegrityTestCase(TestCase):
    """
    Testes de Integridade Crítica (R1 e R7) do Custo Médio Ponderado (CMP)
    e do modelo CustoProduto.
    """

    @classmethod
    def setUpTestData(cls):
        # 1. SETUP DE PRÉ-REQUISITOS (OBJETOS REAIS)
        
        # Cria Local de Estocagem
        cls.local_estoque = LocalEstocagem.objects.create(nome='Estoque Seco')

        # CRIAÇÃO DE INSTÂNCIAS REAIS DE MODELOS
        
        # Cria Categoria real
        cls.categoria = Categoria.objects.create(
            nome='Insumos'
        )
        
        # Cria UnidadeMedida real
        cls.unidade = UnidadeMedida.objects.create(
            sigla='KG'
        )
        
        # Cria Usuário real (responsável)
        cls.usuario = Usuario.objects.create(
            username='admin_teste',
            is_active=True,
        )


    def _create_produto(self, nome, is_vendavel=False):
        """Helper para criar um produto base."""
        return Produto.objects.create(
            nome=nome,
            categoria=self.categoria,
            unidade_medida=self.unidade,
            local_estocagem=self.local_estoque,
            preco_venda=Decimal('10.00'),
            is_vendavel=is_vendavel
        )

    def _create_movimento_item(self, produto, tipo, quantidade, custo_unitario, responsavel):
        """Helper para criar um MovimentoEstoque e um ItemMovimentoEstoque."""
        movimento = MovimentoEstoque.objects.create(
            tipo_movimento=tipo,
            responsavel=responsavel
        )
        return ItemMovimentoEstoque.objects.create(
            movimento=movimento,
            produto=produto,
            quantidade_movimentada=quantidade.quantize(TRES_CASAS),
            preco_unitario=custo_unitario.quantize(QUATRO_CASAS),
            is_estornado=False
        )

    def test_r7_custoproduto_creation_and_properties(self):
        """
        Garante que CustoProduto é criado e as propriedades de Produto funcionam.
        """
        # CRIAÇÃO
        produto = self._create_produto("Café em Grão")
        
        # CMP deve ser zero inicialmente
        self.assertEqual(produto.custo_medio_ponderado, Decimal('0.0000'))
        self.assertEqual(produto.quantidade_atual, Decimal('0.000'))
        self.assertEqual(produto.preco_custo, Decimal('0.00'))
        
        # Garante que o CustoProduto existe (será criado pelo EstoqueService na primeira entrada)
        with self.assertRaises(CustoProduto.DoesNotExist):
            CustoProduto.objects.get(produto=produto)
        
        # Primeira ENTRADA (M1)
        # 10 KG @ R$ 5,00/KG
        self._create_movimento_item(
            produto=produto, 
            tipo='ENTRADA_COMPRA', 
            quantidade=Decimal('10.000'), 
            custo_unitario=Decimal('5.0000'),
            responsavel=self.usuario
        )

        # CORREÇÃO CRÍTICA (Stale Object): Recarrega a instância de produto
        produto.refresh_from_db() 

        # Após a entrada, CustoProduto deve existir e ser populado
        custo_produto = CustoProduto.objects.get(produto=produto)
        
        # Teste R7: CMP e Saldo atualizados após ENTRADA
        self.assertEqual(custo_produto.quantidade_atual, Decimal('10.000'))
        self.assertEqual(custo_produto.custo_medio_ponderado, Decimal('5.0000'))
        self.assertEqual(custo_produto.preco_custo, Decimal('5.00')) 
        
        # Teste R7: Propriedades do Produto refletem o CustoProduto
        self.assertEqual(produto.quantidade_atual, Decimal('10.000'))
        self.assertEqual(produto.custo_medio_ponderado, Decimal('5.0000'))


    def test_r1_full_lifecycle_and_integrity(self):
        """
        TESTE CRÍTICO: Valida o CMP, Ponderação e o Recálculo de Estorno (R1).
        Cenário: Entrada 1 -> Entrada 2 (pondera CMP) -> Saída -> Estorno da Entrada 1 (reverte CMP).
        """
        produto = self._create_produto("Farinha de Trigo", is_vendavel=False)
        
        # --- 1. PRIMEIRA ENTRADA (M1) ---
        # 10 KG @ R$ 5,00/KG. Total Valor: R$ 50,00
        item_m1 = self._create_movimento_item(
            produto=produto, 
            tipo='ENTRADA_COMPRA', 
            quantidade=Decimal('10.000'), 
            custo_unitario=Decimal('5.0000'),
            responsavel=self.usuario
        )
        
        # CORREÇÃO CRÍTICA (Stale Object)
        produto.refresh_from_db() 

        custo_produto = CustoProduto.objects.get(produto=produto)
        
        # VERIFICAÇÃO 1: CMP
        self.assertEqual(custo_produto.quantidade_atual, Decimal('10.000'))
        self.assertEqual(custo_produto.custo_medio_ponderado, Decimal('5.0000'))
        
        # --- 2. SEGUNDA ENTRADA (M2) ---
        # 5 KG @ R$ 8,00/KG. Total Valor: R$ 40,00
        item_m2 = self._create_movimento_item(
            produto=produto, 
            tipo='ENTRADA_COMPRA', 
            quantidade=Decimal('5.000'), 
            custo_unitario=Decimal('8.0000'),
            responsavel=self.usuario
        )
        custo_produto.refresh_from_db()

        # CÁLCULO ESPERADO DO CMP PONDERADO: 6.0000
        self.assertEqual(custo_produto.quantidade_atual, Decimal('15.000'))
        self.assertEqual(custo_produto.custo_medio_ponderado, Decimal('6.0000'))
        
        # --- 3. SAÍDA (M3) ---
        # Saída de 3 KG (Venda)
        item_m3 = self._create_movimento_item(
            produto=produto, 
            tipo='SAIDA_VENDA', 
            quantidade=Decimal('3.000'), 
            custo_unitario=Decimal('6.0000'), # CMP atual na saída
            responsavel=self.usuario
        )
        custo_produto.refresh_from_db()
        
        # VERIFICAÇÃO 3: Saldo diminui, CMP não muda (R7 Correção)
        self.assertEqual(custo_produto.quantidade_atual, Decimal('12.000'))
        self.assertEqual(custo_produto.custo_medio_ponderado, Decimal('6.0000')) 

        # --- 4. TESTE CRÍTICO R1: ESTORNO DA PRIMEIRA ENTRADA (M1) ---
        # AQUI VOCÊ TESTA SEU ESTOQUESERVICE RECALCULA CORRETAMENTE
        item_m1.is_estornado = True
        item_m1.save() # O signal/service deve disparar EstoqueService.recalcular_cmp_e_saldo
        
        custo_produto.refresh_from_db()

        # NOVO CÁLCULO ESPERADO (CMP Recalculado: 8.0000 / Saldo: 2.000)
        self.assertEqual(custo_produto.custo_medio_ponderado, Decimal('8.0000'))
        self.assertEqual(custo_produto.quantidade_atual, Decimal('2.000'))
        self.assertEqual(custo_produto.preco_custo, Decimal('8.00')) 
        
        # Confirmação do estorno do item M1 no DB
        item_m1_reloaded = ItemMovimentoEstoque.objects.get(pk=item_m1.pk)
        self.assertTrue(item_m1_reloaded.is_estornado)
        
        # --- 5. SAÍDA ADICIONAL (CMV Baseado no Novo CMP) ---
        item_m4 = self._create_movimento_item(
            produto=produto, 
            tipo='SAIDA_VENDA', 
            quantidade=Decimal('1.000'), 
            custo_unitario=Decimal('8.0000'), # Deve ser 8.0000, o novo CMP
            responsavel=self.usuario
        )
        custo_produto.refresh_from_db()
        
        # VERIFICAÇÃO 5: Nova Saída usa o CMP corrigido
        self.assertEqual(custo_produto.quantidade_atual, Decimal('1.000'))
        self.assertEqual(item_m4.preco_unitario, Decimal('8.0000'))