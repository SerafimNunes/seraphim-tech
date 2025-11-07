# =======================================================================
# ARQUIVO: contabil/models.py (Refatorado R7)
# =======================================================================
from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model
from decimal import Decimal
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
    
    history = HistoricalRecords()

    class Meta:
        verbose_name = "Centro de Custo"
        verbose_name_plural = "Centros de Custo"
        ordering = ['nome']

    def __str__(self):
        return self.nome

# =======================================================================
# 3. LOTE CONTÁBIL (HEADER/CABEÇALHO) <--- NOVO MODELO R7
# =======================================================================

class LoteContabil(models.Model):
    """
    Agrupa os Lançamentos Contábeis (Débito e Crédito) para garantir a Partida Dobrada.
    Serve como o cabeçalho da transação, centralizando rastreabilidade e histórico.
    """
    data_registro = models.DateTimeField(default=timezone.now, verbose_name="Data/Hora do Registro")
    
    # Histórico da Transação Completa
    historico_transacao = models.CharField(max_length=255, verbose_name="Histórico da Transação")
    
    # Valor total da transação (Débito e Crédito devem somar este valor)
    valor_total = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Valor Total do Lote")

    # Referências de Origem (Centralizando a rastreabilidade aqui)
    venda = models.ForeignKey(
        'vendas.Venda', 
        on_delete=models.SET_NULL, 
        null=True, blank=True, 
        related_name='lotes_contabeis',
        verbose_name="Venda de Origem"
    )
    pedido_compra = models.ForeignKey(
        'compras.PedidoCompra', 
        on_delete=models.SET_NULL, 
        null=True, blank=True, 
        related_name='lotes_contabeis',
        verbose_name="Pedido de Compra de Origem"
    )
    movimento_caixa = models.ForeignKey(
        'caixa.MovimentoCaixa',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='lotes_contabeis',
        verbose_name="Movimento de Caixa de Origem"
    )
    
    usuario_criacao = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, blank=True, 
        related_name='lotes_contabeis_criados',
        verbose_name="Usuário de Criação"
    )
    
    history = HistoricalRecords()

    class Meta:
        verbose_name = "Lote Contábil (Transação)"
        verbose_name_plural = "Lotes Contábeis (Transações)"
        ordering = ['-data_registro']
    
    def __str__(self):
        return f"Lote N° {self.pk} - R${self.valor_total} - {self.historico_transacao[:50]}"


# =======================================================================
# 4. LANÇAMENTO CONTÁBIL (LINHA/Fato) <--- REFATORADO R7
# =======================================================================

class LancamentoContabil(models.Model):
    """
    Representa o registro da transação contábil (Débito ou Crédito) - Linha de Detalhe.
    """
    class TipoMovimento(models.TextChoices):
        DEBITO = 'DEBITO', 'Débito (Saída/Despesa/Aumento do Passivo)'
        CREDITO = 'CREDITO', 'Crédito (Entrada/Receita/Diminuição do Ativo)'

    # FK para o cabeçalho (Lote) <--- NOVO LINK R7
    lote_contabil = models.ForeignKey(
        LoteContabil,
        on_delete=models.CASCADE, # Se o lote for apagado, as linhas vão junto
        related_name='lancamentos',
        verbose_name="Lote Contábil"
    )

    data_lancamento = models.DateTimeField(default=timezone.now, verbose_name="Data do Lançamento")
    
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

    # CAMPOS DE RASTREABILIDADE REMOVIDOS E MOVIDOS PARA LoteContabil
    # venda, pedido_compra, movimento_caixa, usuario_criacao

    history = HistoricalRecords()

    class Meta:
        verbose_name = "Lançamento Contábil"
        verbose_name_plural = "Lançamentos Contábeis"
        ordering = ['-data_lancamento']
        
    def __str__(self):
        return f"{self.lote_contabil.pk} - {self.tipo_movimento}: R${self.valor} ({self.plano_conta.codigo})"