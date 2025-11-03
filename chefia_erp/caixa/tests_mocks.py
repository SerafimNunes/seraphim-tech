# ARQUIVO: caixa/test_mocks.py (NOVO ARQUIVO)

from django.db import models
from django.contrib.auth import get_user_model
from decimal import Decimal
# Importar UnidadeMedida real
from core.models import UnidadeMedida 

User = get_user_model()

# =========================================================================
# MODELOS EXTERNOS SIMULADOS (Mocks CONCRETOS de teste)
# O app_label='caixa' e o db_table explícito garantem a criação e unicidade 
# das tabelas no banco de dados de teste.
# =========================================================================

class Cliente(models.Model): 
    nome = models.CharField(max_length=100)
    class Meta: 
        app_label = 'caixa' 
        db_table = 'caixa_test_mock_cliente' 
        verbose_name = 'Mock Cliente'
        
class Mesa(models.Model): 
    numero = models.CharField(max_length=10)
    status = models.CharField(max_length=10)
    class Meta: 
        app_label = 'caixa'
        db_table = 'caixa_test_mock_mesa'
        verbose_name = 'Mock Mesa'

class Produto(models.Model): # Mock para estoque.Produto
    nome = models.CharField(max_length=100)
    # related_name: Único para evitar a colisão inicial
    unidade_medida = models.ForeignKey(UnidadeMedida, on_delete=models.PROTECT, related_name='caixa_mock_produto_set') 
    preco_venda = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    class Meta: 
         app_label = 'caixa'
         db_table = 'caixa_test_mock_produto'
         verbose_name = 'Mock Produto'

class Venda(models.Model): # Mock para vendas.Venda
    class Status(models.TextChoices):
        ABERTA = 'ABERTA', 'Aberta'
        FATURADA = 'FATURADA', 'Faturada'
        CANCELADA = 'CANCELADA', 'Cancelada'
        
    # related_name: Únicos para evitar colisões
    atendente = models.ForeignKey(User, on_delete=models.PROTECT, related_name='caixa_mock_venda_atendente_set')
    cliente = models.ForeignKey(Cliente, on_delete=models.PROTECT, related_name='caixa_mock_venda_cliente_set')
    mesa = models.ForeignKey(Mesa, on_delete=models.PROTECT, related_name='caixa_mock_venda_mesa_set')
    valor_total_liquido = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ABERTA)
    class Meta: 
        app_label = 'caixa'
        db_table = 'caixa_test_mock_venda'
        verbose_name = 'Mock Venda'

class MetodoPagamento(models.Model): # Mock para vendas.MetodoPagamento
    # related_name: Único para evitar colisões
    venda = models.ForeignKey(Venda, on_delete=models.PROTECT, related_name='caixa_mock_pagamentos_set')
    tipo_pagamento = models.CharField(max_length=50) 
    valor_pago = models.DecimalField(max_digits=10, decimal_places=2)
    class Meta: 
        app_label = 'caixa'
        db_table = 'caixa_test_mock_metodopagamento'
        verbose_name = 'Mock MetodoPagamento'
