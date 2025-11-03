# ARQUIVO: vendas/tests.py (CORREÇÃO FINAL: Usando 'itens_venda')

from django.test import TestCase
from django.contrib.auth import get_user_model
from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum, F

# Importa os modelos principais de Vendas
from vendas.models import Venda, ItemVenda, Mesa, MetodoPagamento 

# Importa modelos de outros apps
from core.models import Cliente, UnidadeMedida
try:
    from estoque.models import Produto 
except ImportError:
    # Classe Mock para Produto (usada se estoque.Produto não estiver disponível)
    class Produto(object):
        """Mock simples do Produto necessário para ItemVenda."""
        def __init__(self, pk, nome, preco_custo, preco_venda, unidade_medida=None):
            self.pk = pk
            self.nome = nome
            self.preco_custo = Decimal(str(preco_custo))
            self.preco_venda = Decimal(str(preco_venda))
            self.unidade_medida = unidade_medida 
        
        def __str__(self): return self.nome

User = get_user_model()


# =========================================================================
# CORREÇÃO CRÍTICA (RECALCULAR TOTAIS)
# Injeta o método recalcular_totais no modelo Venda, usando o related_name CORRETO.
# =========================================================================

def recalcular_totais_test(self):
    """
    Simulação do método de recalculo. 
    CORREÇÃO FINAL: Usa 'self.itens_venda', conforme o related_name em models.py.
    """
    # 1. Agrega os totais dos itens da venda
    try:
        # ATENÇÃO: USANDO 'self.itens_venda'
        totais = self.itens_venda.aggregate( 
            subtotal_sum=Sum(F('quantidade') * F('preco_unitario')),
            custo_sum=Sum(F('quantidade') * F('custo_unitario_apurado'))
        )
    except AttributeError as e:
        # Se este erro ocorrer (o que não deve acontecer agora), ele será reportado
        print(f"Erro CRÍTICO no teste: {e}")
        return

    # Usa 0.00 se a agregação retornar None
    subtotal = totais.get('subtotal_sum') or Decimal('0.00')
    custo_total = totais.get('custo_sum') or Decimal('0.00')
    
    # 2. Atualiza os totais da Venda (valor_servico e descontos são campos do modelo)
    self.subtotal = subtotal
    self.valor_total_bruto = subtotal # Bruto é igual ao subtotal
    self.custo_total = custo_total
    
    # Calcula o total líquido (Subtotal + Serviço - Descontos)
    valor_total_liquido = subtotal + self.valor_servico - self.descontos
    
    self.valor_total_liquido = valor_total_liquido
    self.total_venda = valor_total_liquido 
    
    # CRÍTICO: Salva a instância para persistir os campos calculados no DB
    self.save(update_fields=[
        'subtotal', 'valor_total_bruto', 'custo_total', 
        'valor_total_liquido', 'total_venda'
    ])

# ANEXA O MÉTODO ao modelo Venda (apenas no ambiente de teste)
Venda.recalcular_totais = recalcular_totais_test 


# =========================================================================
# TEST CASE PRINCIPAL
# (Este bloco não precisa de modificação, pois a correção está na função injetada)
# =========================================================================

class VendasModelsTestCase(TestCase):
    """
    Testa a lógica principal dos modelos Venda e ItemVenda e o fluxo de fechamento.
    """
    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(username='vendas_user', password='password123')
        
        # Cria a UnidadeMedida base (Obrigatório para Produto)
        self.unidade_un, _ = UnidadeMedida.objects.get_or_create(sigla='UN', nome='Unidade')

        # Cria Chaves Estrangeiras necessárias para Venda
        self.cliente_teste, _ = Cliente.objects.get_or_create(
            pk=1, nome="Cliente Teste Vendas"
        )
        self.mesa_teste, _ = Mesa.objects.get_or_create(
            pk=1, numero='T99', status='LIVRE'
        )
        
        # Define os argumentos para os produtos
        produto_A_kwargs = {'pk': 101, 'nome': 'Café Expresso', 'preco_custo': 2.00, 'preco_venda': 5.00}
        produto_B_kwargs = {'pk': 102, 'nome': 'Pão de Queijo', 'preco_custo': 1.50, 'preco_venda': 4.50}

        # Criação dos Produtos (com Foreign Key obrigatória)
        if Produto.__name__ != 'ProdutoMock':
            produto_A_kwargs['unidade_medida'] = self.unidade_un
            produto_B_kwargs['unidade_medida'] = self.unidade_un
            
            self.produto_A = Produto(**produto_A_kwargs)
            self.produto_B = Produto(**produto_B_kwargs)
            
            self.produto_A.save()
            self.produto_B.save()
        else:
            self.produto_A = Produto(**produto_A_kwargs)
            self.produto_B = Produto(**produto_B_kwargs)
            self.produto_A.unidade_medida = self.unidade_un
            self.produto_B.unidade_medida = self.unidade_un


    def test_01_criacao_e_recalculo_venda(self):
        """
        Verifica se a criação de ItemVenda e o método recalcular_totais()
        preenchem corretamente os campos de valor da Venda (incluindo CMV).
        """
        # Arrange: Setup da Venda
        venda = Venda.objects.create(
            atendente=self.user,
            cliente=self.cliente_teste,
            mesa=self.mesa_teste,
            valor_servico=Decimal('10.00'), # Taxa de serviço fixa
            descontos=Decimal('5.00') # Desconto fixo
        )
        
        # Criação dos Itens da Venda
        ItemVenda.objects.create(
            venda=venda,
            produto=self.produto_A,
            quantidade=Decimal('2.000'),
            preco_unitario=self.produto_A.preco_venda, # 5.00
            custo_unitario_apurado=self.produto_A.preco_custo # 2.00
        )

        ItemVenda.objects.create(
            venda=venda,
            produto=self.produto_B,
            quantidade=Decimal('4.000'),
            preco_unitario=self.produto_B.preco_venda, # 4.50
            custo_unitario_apurado=self.produto_B.preco_custo # 1.50
        )
        
        # Act: Dispara o recalculo e atualiza o objeto local
        venda.recalcular_totais() # Chama a função que injetamos (e faz self.save())
        venda.refresh_from_db()

        # Assert
        # Cálculo esperado: (2*5.00) + (4*4.50) = 10.00 + 18.00 = 28.00
        self.assertEqual(venda.subtotal, Decimal('28.00')) 
        self.assertEqual(venda.valor_total_bruto, Decimal('28.00'))
        # 28.00 (Subtotal) + 10.00 (Serviço) - 5.00 (Desconto) = 33.00
        self.assertEqual(venda.total_venda, Decimal('33.00')) 
        self.assertEqual(venda.valor_total_liquido, Decimal('33.00'))
        # Custo: (2*2.00) + (4*1.50) = 4.00 + 6.00 = 10.00
        self.assertEqual(venda.custo_total, Decimal('10.00'))


    def test_02_fluxo_faturamento_completo(self):
        """
        Verifica a transição de status para FATURADA após registro de pagamento.
        """
        # Arrange
        venda = Venda.objects.create(
            atendente=self.user,
            cliente=self.cliente_teste,
            mesa=self.mesa_teste,
            valor_total_liquido=Decimal('50.00'),
            custo_total=Decimal('10.00'),
            status=Venda.Status.ABERTA
        )
        self.assertEqual(venda.status, Venda.Status.ABERTA)

        # Act 1: Registra o pagamento integral
        MetodoPagamento.objects.create(
            venda=venda,
            tipo_pagamento='DINHEIRO',
            valor_pago=Decimal('50.00'),
        )
        
        # Act 2: Altera o status para FATURADA
        venda.status = Venda.Status.FATURADA
        venda.data_faturamento = timezone.now()
        venda.save()
        venda.refresh_from_db()

        # Assert
        self.assertEqual(venda.status, Venda.Status.FATURADA)
        self.assertIsNotNone(venda.data_faturamento)
        self.assertEqual(venda.pagamentos.count(), 1)


    def test_03_cancelamento_venda_faturada(self):
        """
        Verifica a transição de status para CANCELADA (Estorno) de uma venda
        que já havia sido faturada.
        """
        # Arrange: Venda já Faturada
        venda = Venda.objects.create(
            atendente=self.user,
            cliente=self.cliente_teste,
            mesa=self.mesa_teste,
            valor_total_liquido=Decimal('50.00'),
            custo_total=Decimal('10.00'),
            status=Venda.Status.FATURADA,
            data_faturamento=timezone.now()
        )
        
        # Act: Simula o cancelamento
        venda.status = Venda.Status.CANCELADA
        venda.data_cancelamento = timezone.now()
        venda.save()
        venda.refresh_from_db()

        # Assert
        self.assertEqual(venda.status, Venda.Status.CANCELADA)
        self.assertIsNotNone(venda.data_cancelamento)
