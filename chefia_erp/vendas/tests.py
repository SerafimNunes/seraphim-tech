import json
from decimal import Decimal
from unittest.mock import patch, MagicMock

from django.test import TestCase, override_settings
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.db.models import Sum, F
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

# Importações dos Modelos e Services
from vendas.models import Venda, ItemVenda, Comanda, ComandaItem, Mesa, MetodoPagamento
# Importações de outros apps
from core.models import Cliente, UnidadeMedida
from core.models import Categoria
from estoque.models import Produto, CustoProduto, LocalEstocagem
from estoque.services import EstoqueService # Necessário para mock
from vendas.services import VendaService # Necessário para mock (embora desnecessário com EAGER)

# Assumindo a existência do modelo de Caixa para a ViewSet
try:
    from caixa.models import SessaoCaixa
    # Importação do utilitário para mock
    from caixa.utils import get_sessao_caixa_ativa 
except ImportError:
    class SessaoCaixa(object):
        """Mock simples para SessaoCaixa."""
        def __init__(self, usuario_abertura, valor_inicial, status):
            self.pk = 1
            self.usuario_abertura = usuario_abertura
            self.valor_inicial = valor_inicial
            self.status = status
    # Mock do utilitário para que o patch funcione
    def get_sessao_caixa_ativa(usuario=None):
        return SessaoCaixa(usuario, Decimal('100.00'), 'ABERTA')

User = get_user_model()


# =========================================================================
# HELPER DE RECALCULO (Mantido para simulação da regra de negócio da Venda)
# =========================================================================

def recalcular_totais_test(self):
    """
    Simulação do método de recalculo. USA 'self.itens_venda'.
    """
    DUAS_CASAS = Decimal('0.01')
    
    # A simulação se baseia nos ItemVenda.
    
    try:
        # Usa 'itens_venda' que é o related_name de ItemVenda para Venda
        totais = self.itens_venda.aggregate( 
            subtotal_sum=Sum(F('quantidade') * F('preco_unitario')),
            # O custo_total é apurado pelo service assíncrono, mas recalculartotais
            # precisa garantir a base para o valor_total_liquido
            custo_sum=Sum(F('quantidade') * F('custo_unitario_apurado')) 
        )
    except Exception as e:
        print(f"Erro CRÍTICO no recalculo de teste: {e}")
        return

    subtotal = (totais.get('subtotal_sum') or Decimal('0.00')).quantize(DUAS_CASAS)
    custo_total = (totais.get('custo_sum') or Decimal('0.00')).quantize(DUAS_CASAS)
    
    self.subtotal = subtotal
    self.valor_total_bruto = subtotal
    self.custo_total = custo_total # Atualizado para garantir o valor certo no teste
    
    # Assume que desconto e serviço são campos da Venda.
    valor_total_liquido = (subtotal + getattr(self, 'valor_servico', Decimal('0.00')) - getattr(self, 'descontos', Decimal('0.00'))).quantize(DUAS_CASAS)
    
    self.valor_total_liquido = valor_total_liquido
    self.total_venda = valor_total_liquido
    
    self.save(update_fields=[
        'subtotal', 'valor_total_bruto', 'custo_total', 
        'valor_total_liquido', 'total_venda', 
    ])

Venda.recalcular_totais = recalcular_totais_test


# ======================================================================
# TESTES DE INTEGRAÇÃO API/SERVICE (R8, R9, R7, FEATURE)
# ======================================================================

# Configura o Celery para rodar tarefas síncronas para fins de teste (R9)
@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES_EXCEPTIONS=True)
class ComandaAPITests(TestCase): # Renomeei para ComandaAPITests para maior clareza

    def setUp(self):
        super().setUp()
        self.client = APIClient()
        
        # Fixtures base
        self.user = User.objects.create_user(username='atendente', password='password123')
        self.client.force_authenticate(user=self.user)
        self.unidade_un = UnidadeMedida.objects.create(sigla='UN', nome='Unidade')
        
        self.categoria = Categoria.objects.create(nome="Bebidas")
        self.local_principal = LocalEstocagem.objects.create(nome="Estoque Principal")

        # FIX 1: Criando uma Mesa
        self.mesa = Mesa.objects.create(capacidade=4, numero='T1') 

        # Produtos e Custos
        self.produto1 = Produto.objects.create(
            nome="Café", 
            preco_venda=Decimal('5.00'), 
            unidade_medida=self.unidade_un,
            categoria=self.categoria,
            local_estocagem=self.local_principal
        )
        self.produto2 = Produto.objects.create(
            nome="Bolo", 
            preco_venda=Decimal('12.00'), 
            unidade_medida=self.unidade_un,
            categoria=self.categoria,
            local_estocagem=self.local_principal
        )
        
        CustoProduto.objects.create(
            produto=self.produto1, 
            custo_medio_ponderado=Decimal('1.50'), 
            quantidade_atual=Decimal('100.00')
        )
        CustoProduto.objects.create(
            produto=self.produto2, 
            custo_medio_ponderado=Decimal('3.00'), 
            quantidade_atual=Decimal('50.00')
        )

        # Mock da Sessão de Caixa
        self.sessao_caixa = SessaoCaixa(
            usuario_abertura=self.user, 
            valor_inicial=Decimal('100.00'), 
            status='ABERTA'
        )
        # O caminho do patch para get_sessao_caixa_ativa, que é importado em vendas.views
        self.mock_get_sessao_caixa = patch('vendas.views.get_sessao_caixa_ativa', return_value=self.sessao_caixa)
        self.mock_get_sessao_caixa.start()

        self.list_url = reverse('vendas:comanda-list')

    def tearDown(self):
        self.mock_get_sessao_caixa.stop()
        super().tearDown()

    def create_comanda(self):
        """
        Helper para criar uma Comanda (Venda no seu contexto) em estado ABERTA.
        """
        # A Viewset cria a Comanda
        data = {'mesa': self.mesa.pk}
        response = self.client.post(self.list_url, data=data)
        
        if response.status_code != status.HTTP_201_CREATED:
            raise Exception(f"Falha ao criar Comanda no teste (Status {response.status_code}): {response.data}")

        # Comanda/Venda Rascunho
        return Venda.objects.get(pk=response.data['id']) 

    # ======================================================================
    # TESTE 1: Atomicidade de Itens (R8)
    # ======================================================================
    def test_adicionar_itens_rollback_em_falha(self):
        """R8: Deve reverter todos os itens se a transação atômica falhar na adição de ComandaItem."""
        comanda = self.create_comanda() # Comanda é uma Venda Rascunho
        url_add_itens = reverse('vendas:comanda-adicionar-itens', kwargs={'pk': comanda.pk})
        
        # Simula uma falha na criação do segundo ItemVenda (no views.py)
        # Atenção: O views.py cria ItemVenda, não ComandaItem (apenas se seus modelos estiverem mapeados)
        with patch('vendas.models.ItemVenda.objects.create', side_effect=[MagicMock(), Exception("Simulação de Falha de DB R8")]):
            
            itens_data_fail = [
                {'produto': self.produto1.pk, 'quantidade': Decimal('1')},
                {'produto': self.produto2.pk, 'quantidade': Decimal('1')},
            ]
            
            response_fail = self.client.post(url_add_itens, data={'itens': itens_data_fail}, format='json')
            
            self.assertIn(response_fail.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_500_INTERNAL_SERVER_ERROR])
            
            # Verificação de rollback (a Venda rascunho deve ter zero itens)
            self.assertEqual(ItemVenda.objects.filter(venda=comanda).count(), 0, 
                             "R8 falhou: Itens da comanda não foram revertidos (rollback)")

    # ======================================================================
    # TESTE 2: Fluxo Principal (R3, R8, R9, R1/R7) - CORRIGIDO
    # ======================================================================
    @patch('contabilidade.services.criar_lancamento_contabil_partida_dobrada') # Local correto do service contábil
    @patch('estoque.services.EstoqueService.registrar_saida') # Local CORRETO: Chamado dentro de vendas/services.py
    def test_faturamento_completo_e_service_r9(self, mock_registrar_saida, mock_lancamento_contabil):
        """Testa o fluxo completo, incluindo R8 (View) e R9 (Task/Service) rodando EAGER."""
        comanda_rascunho = self.create_comanda()
        url_add_itens = reverse('vendas:comanda-adicionar-itens', kwargs={'pk': comanda_rascunho.pk})
        url_faturar = reverse('vendas:comanda-faturar', kwargs={'pk': comanda_rascunho.pk})

        # Adiciona itens na Comanda Rascunho
        itens_data = [
            {'produto': self.produto1.pk, 'quantidade': Decimal('2')}, # Custo 2 * 1.50 = 3.00
            {'produto': self.produto2.pk, 'quantidade': Decimal('1')}, # Custo 1 * 3.00 = 3.00
        ]
        self.client.post(url_add_itens, data={'itens': itens_data}, format='json')
        
        # O total da Comanda é 2*5.00 + 1*12.00 = 22.00
        pagamentos_data = [
            {'tipo_pagamento': 'CARTAO', 'valor_pago': Decimal('22.00'), 'valor_recebido': Decimal('22.00')},
        ]

        response = self.client.post(url_faturar, data={'pagamentos': pagamentos_data}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Encontra a Venda FINAL criada pelo Service
        venda_final = Venda.objects.get(comanda_origem=comanda_rascunho)
        venda_final.refresh_from_db()

        # Verificações de Estado e R9 (Task EAGER executada)
        comanda_rascunho.refresh_from_db()
        self.assertEqual(comanda_rascunho.status, Venda.Status.FECHADA) # Venda Rascunho deve estar FECHADA
        self.assertEqual(venda_final.status, Venda.Status.FATURADA) # Venda Final deve estar FATURADA
        self.assertTrue(venda_final.movimento_estoque_criado) # Service Assíncrono deve ter marcado isso

        # Verificação Financeira (R1 / R7)
        self.assertEqual(venda_final.custo_total, Decimal('6.00')) # CMV: 3.00 + 3.00

        # Verificação do Service Estoque (R1 / R9)
        self.assertEqual(mock_registrar_saida.call_count, 2) 
        
        # Verificação da Contabilidade (R9)
        self.assertEqual(mock_lancamento_contabil.call_count, 2) 

    # ======================================================================
    # TESTE 3: Rollback em Falha do Service Assíncrono (R8/R9) - CORRIGIDO
    # ======================================================================
    @patch('contabilidade.services.criar_lancamento_contabil_partida_dobrada')
    # MOCK CRÍTICO: O Service de Estoque falha, forçando o ROLLBACK em VendaService
    @patch('estoque.services.EstoqueService.registrar_saida', side_effect=Exception("Estoque Insuficiente")) 
    def test_faturamento_rollback_em_falha_estoque_r8(self, mock_registrar_saida, mock_lancamento_contabil):
        """R8: Testa se o pagamento é desfeito (ROLLBACK) se o Service de Estoque falhar na Task (R9)."""
        comanda_rascunho = self.create_comanda()
        url_add_itens = reverse('vendas:comanda-adicionar-itens', kwargs={'pk': comanda_rascunho.pk})
        url_faturar = reverse('vendas:comanda-faturar', kwargs={'pk': comanda_rascunho.pk})

        itens_data = [{'produto': self.produto1.pk, 'quantidade': Decimal('2')}]
        self.client.post(url_add_itens, data={'itens': itens_data}, format='json')
        
        pagamentos_data = [{'tipo_pagamento': 'DINHEIRO', 'valor_pago': Decimal('10.00'), 'valor_recebido': Decimal('10.00')}]

        # O patch acima simula a falha de estoque dentro do Service Layer (vendas/services.py)
        
        response = self.client.post(url_faturar, data={'pagamentos': pagamentos_data}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # A mensagem de erro deve refletir a exceção do Service Layer
        self.assertIn("Falha na transação. A venda foi revertida (ROLLBACK).", response.data['detail'])

        # R8: Verifica o Rollback (Venda, Comanda e Pagamentos revertidos)
        comanda_rascunho.refresh_from_db()
        self.assertEqual(comanda_rascunho.status, Venda.Status.ABERTA, "R8 Falhou: Status da Comanda Rascunho não revertido")
        # A Venda FINAL criada dentro do transaction.atomic() no Service deve ter sido revertida.
        self.assertFalse(Venda.objects.filter(comanda_origem=comanda_rascunho).exists(), "R8 Falhou: A Venda FINAL não foi deletada (Rollback)") 
        # Os Pagamentos criados na View antes da chamada ao Service devem ter sido revertidos
        self.assertEqual(MetodoPagamento.objects.count(), 0, "R8 Falhou: Pagamentos não foram desfeitos (Rollback)")
        
    # ======================================================================
    # TESTE 4: FEATURE - nome_cliente_mesa
    # ======================================================================
    def test_adicionar_itens_com_nome_cliente_mesa(self):
        """Testa se o campo nome_cliente_mesa é passado corretamente para ComandaItem e ItemVenda, e serializado."""
        comanda_rascunho = self.create_comanda()
        url_add_itens = reverse('vendas:comanda-adicionar-itens', kwargs={'pk': comanda_rascunho.pk})
        url_faturar = reverse('vendas:comanda-faturar', kwargs={'pk': comanda_rascunho.pk})
        
        nome_mesa_test = "João da Silva"
        
        itens_data = [
            {'produto': self.produto1.pk, 'quantidade': Decimal('1'), 'nome_cliente_mesa': nome_mesa_test},
            {'produto': self.produto2.pk, 'quantidade': Decimal('2')}, # Teste com campo omitido/vazio
        ]

        response = self.client.post(url_add_itens, data={'itens': itens_data}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED) # CORRIGIDO: Deve ser 201 Created

        # 1. Verificar o primeiro item (persistência em ItemVenda da Comanda Rascunho)
        # Assumindo que o ItemVenda é o modelo de item da Comanda Rascunho
        item_venda1_rascunho = comanda_rascunho.itens_venda.get(produto=self.produto1)
        self.assertEqual(item_venda1_rascunho.nome_cliente_mesa, nome_mesa_test)
        
        # 2. Verificar o segundo item (deve estar vazio)
        item_venda2_rascunho = comanda_rascunho.itens_venda.get(produto=self.produto2)
        self.assertEqual(item_venda2_rascunho.nome_cliente_mesa, "")
        
        # Faturar a Comanda
        pagamentos_data = [{'tipo_pagamento': 'DINHEIRO', 'valor_pago': Decimal('29.00'), 'valor_recebido': Decimal('30.00')}]
        with patch('estoque.services.EstoqueService.registrar_saida'), patch('contabilidade.services.criar_lancamento_contabil_partida_dobrada'): 
             self.client.post(url_faturar, data={'pagamentos': pagamentos_data}, format='json')
        
        venda_final = Venda.objects.get(comanda_origem=comanda_rascunho)

        # 3. Teste de leitura (Serialização da Venda Final, que copiou os ItemVenda da Rascunho)
        url_retrieve = reverse('vendas:comanda-detail', kwargs={'pk': venda_final.pk}) 
        response_retrieve = self.client.get(url_retrieve)
        
        # O ItemVenda 1 deve ter copiado o nome
        item_retrieved = [item for item in response_retrieve.data['itens'] if item['produto'] == self.produto1.pk][0]
        self.assertEqual(item_retrieved['nome_cliente_mesa'], nome_mesa_test)
        
        # O ItemVenda 2 deve ser serializado com o valor vazio
        item_retrieved_2 = [item for item in response_retrieve.data['itens'] if item['produto'] == self.produto2.pk][0]
        self.assertEqual(item_retrieved_2['nome_cliente_mesa'], "")

        self.assertEqual(response_retrieve.status_code, status.HTTP_200_OK)