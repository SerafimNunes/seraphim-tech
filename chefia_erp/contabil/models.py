# contabil/models.py
from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model
from decimal import Decimal
# 🚨 NOVO: Importar simple_history para auditoria
from simple_history.models import HistoricalRecords 

# Padrões de referência de usuário
User = get_user_model()

# =======================================================================
# 1. PLANO DE CONTAS (Estrutura Contábil)
# =======================================================================

class PlanoConta(models.Model):
    """
    Representa o Plano de Contas (Ativo, Passivo, Receita, Despesa, Patrimônio Líquido).
    """
    class TipoConta(models.TextChoices):
        ATIVO = 'ATIVO', 'Ativo' # 1.x.x.x
        PASSIVO = 'PASSIVO', 'Passivo' # 2.x.x.x
        PATRIMONIO = 'PATRIMONIO', 'Patrimônio Líquido' # 3.x.x.x
        RECEITA = 'RECEITA', 'Receita' # 4.x.x.x
        DESPESA = 'DESPESA', 'Despesa' # 5.x.x.x

    nome = models.CharField(max_length=150, unique=True, verbose_name="Nome da Conta")
    
    # Código hierárquico, ex: 1.1.001
    codigo = models.CharField(max_length=20, unique=True, verbose_name="Código Contábil")
    
    tipo = models.CharField(max_length=20, choices=TipoConta.choices, verbose_name="Tipo de Conta")
    
    # FK auto-referenciada para criar a hierarquia
    conta_pai = models.ForeignKey(
        'self', 
        on_delete=models.SET_NULL, 
        null=True, blank=True, 
        related_name='contas_filhas',
        verbose_name="Conta Pai"
    )
    
    ativo = models.BooleanField(default=True, verbose_name="Ativo")
    
    # Rastreabilidade de quem criou a conta
    usuario_criacao = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, blank=True, 
        related_name='plano_contas_criados', 
        verbose_name="Usuário de Criação"
    )

    # Rastreamento de histórico (Auditoria)
    history = HistoricalRecords()

    class Meta:
        verbose_name = "Plano de Conta"
        verbose_name_plural = "Plano de Contas"
        ordering = ['codigo']

    def __str__(self):
        return f"{self.codigo} - {self.nome}"


# =======================================================================
# 2. CENTRO DE CUSTO
# =======================================================================

class CentroCusto(models.Model):
    """
    Entidade para alocar despesas e receitas a departamentos ou projetos.
    """
    nome = models.CharField(max_length=100, unique=True, verbose_name="Nome do Centro de Custo")
    ativo = models.BooleanField(default=True)
    
    # Rastreamento de histórico (Auditoria)
    history = HistoricalRecords()

    class Meta:
        verbose_name = "Centro de Custo"
        verbose_name_plural = "Centros de Custo"
        ordering = ['nome']

    def __str__(self):
        return self.nome

# =======================================================================
# 3. LANÇAMENTO CONTÁBIL (Fato / Transação)
# =======================================================================

class LancamentoContabil(models.Model):
    """
    Representa o registro da transação contábil (Débito ou Crédito).
    """
    class TipoMovimento(models.TextChoices):
        DEBITO = 'DEBITO', 'Débito (Saída/Despesa/Aumento do Passivo)'
        CREDITO = 'CREDITO', 'Crédito (Entrada/Receita/Diminuição do Ativo)'

    data_lancamento = models.DateTimeField(default=timezone.now, verbose_name="Data do Lançamento")
    
    # DecimalField é crucial para valores monetários
    valor = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Valor")
    
    tipo_movimento = models.CharField(max_length=10, choices=TipoMovimento.choices, verbose_name="Tipo de Movimento")
    
    plano_conta = models.ForeignKey(PlanoConta, on_delete=models.PROTECT, related_name='lancamentos', verbose_name="Conta Contábil")
    
    centro_custo = models.ForeignKey(
        CentroCusto, 
        on_delete=models.PROTECT, 
        null=True, blank=True, 
        related_name='lancamentos', 
        verbose_name="Centro de Custo"
    )
    
    descricao = models.TextField(verbose_name="Descrição do Lançamento")

    # RASTREABILIDADE (Chaves estrangeiras para os apps de origem)
    # CRÍTICO: Usar string 'app.Model' para evitar circular dependency
    venda = models.ForeignKey(
        'vendas.Venda', 
        on_delete=models.SET_NULL, 
        null=True, blank=True, 
        related_name='lancamentos_contabeis', 
        verbose_name="Venda de Origem"
    )
    pedido_compra = models.ForeignKey(
        'compras.PedidoCompra', 
        on_delete=models.SET_NULL, 
        null=True, blank=True, 
        related_name='lancamentos_contabeis', 
        verbose_name="Pedido de Compra de Origem"
    )
    
    # 🚨 NOVO CAMPO PARA O FLUXO DE CAIXA (TAREFA 2.3)
    movimento_caixa = models.ForeignKey(
        'caixa.MovimentoCaixa',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='lancamentos_contabeis',
        verbose_name="Movimento de Caixa de Origem"
    )
    
    # Metadados
    usuario_criacao = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, blank=True, 
        related_name='lancamentos_contabeis_criados', 
        verbose_name="Usuário de Criação"
    )

    # 🚨 NOVO: Rastreamento de histórico (Auditoria)
    history = HistoricalRecords()

    class Meta:
        verbose_name = "Lançamento Contábil"
        verbose_name_plural = "Lançamentos Contábeis"
        ordering = ['-data_lancamento']
        
    def __str__(self):
        return f"{self.data_lancamento.strftime('%Y-%m-%d')} - {self.tipo_movimento}: R${self.valor}"
