# ==============================================================================
# ARQUIVO: compras/models.py (CORRIGIDO R6)
# ==============================================================================
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator
from decimal import Decimal
from datetime import date

# Importações de outros módulos (Foreign Keys)
from core.models import Fornecedor # Assumindo que Fornecedor está em 'core'
from estoque.models import Produto 

# Obtém o modelo de usuário customizado
User = get_user_model()


# ====================================================================
# 1. ESCOLHAS DE STATUS
# ====================================================================

# PERMANECE: Status do Pedido de Compra
class StatusPedidoCompra(models.TextChoices):
    PENDENTE = 'PENDENTE', ('Pendente (Rascunho)') 
    AGUARDANDO = 'AGUARDANDO', ('Aguardando Envio') 
    ENVIADO = 'ENVIADO', ('Enviado ao Fornecedor') 
    
    # Status de Recebimento (disparadores de sinal)
    RECEBIDO_PARCIAL = 'RECEBIDO_PARCIAL', ('Recebido Parcialmente') 
    FINALIZADO = 'FINALIZADO', ('Recebido e Concluído') 
    
    CANCELADO = 'CANCELADO', ('Cancelado')

# REMOVIDO: StatusContasAPagar (Movido para financeiro/models.py)


# ====================================================================
# 2. PEDIDO DE COMPRA (Cabeçalho)
# ====================================================================

class PedidoCompra(models.Model):
    fornecedor = models.ForeignKey(
        Fornecedor,
        on_delete=models.PROTECT,
        verbose_name=("Fornecedor"),
        related_name='pedidos_compra'
    )
    data_pedido = models.DateField(("Data do Pedido"), default=date.today)
    data_prevista_recebimento = models.DateField(("Previsão de Recebimento"), null=True, blank=True)
    
    total_liquido = models.DecimalField(
        ("Total Líquido"), 
        max_digits=10, 
        decimal_places=2, 
        default=Decimal('0.00'),
        editable=False # Calculado automaticamente
    )
    observacoes = models.TextField(("Observações"), blank=True, null=True)

    # Usa o StatusPedidoCompra
    status = models.CharField(
        ("Status"), 
        max_length=20, 
        choices=StatusPedidoCompra.choices, 
        default=StatusPedidoCompra.AGUARDANDO
    )
    
    # Flag de segurança
    movimento_criado = models.BooleanField(("Movimento de Estoque Criado?"), default=False)

    responsavel = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='pedidos_compra_criados',
        verbose_name=("Responsável pela Criação")
    )
    data_criacao = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = ("Pedido de Compra")
        verbose_name_plural = ("Pedidos de Compra")
        ordering = ['-data_pedido', '-data_criacao']

    def __str__(self):
        return f"Compra #{self.pk} - {self.fornecedor.nome}"

    def calcular_total(self):
        total = self.itens.aggregate(sum_total=models.Sum(models.F('quantidade_pedida') * models.F('preco_unitario_negociado')))['sum_total']
        self.total_liquido = total if total is not None else Decimal('0.00')
        self.save(update_fields=['total_liquido'], force_update=True)


# ====================================================================
# 3. ITENS DO PEDIDO DE COMPRA
# ====================================================================

class ItemPedidoCompra(models.Model):
    pedido_compra = models.ForeignKey(
        PedidoCompra,
        on_delete=models.CASCADE,
        verbose_name=_("Pedido de Compra"),
        related_name='itens'
    )
    produto = models.ForeignKey(
        Produto,
        on_delete=models.PROTECT,
        verbose_name=_("Produto")
    )
    
    # NOVO: Adiciona validator para garantir que a quantidade seja positiva
    quantidade_pedida = models.DecimalField(
        _("Quantidade Pedida"), 
        max_digits=10, 
        decimal_places=3, # Aumentei para 3 casas (padrão ERP)
        validators=[MinValueValidator(Decimal('0.001'))] 
    ) 
    
    # NOVO: Adiciona validator e precisão maior (4) para preço
    preco_unitario_negociado = models.DecimalField(
        _("Preço Unitário Negociado"), 
        max_digits=10, 
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0.0001'))]
    )
    
    quantidade_recebida = models.DecimalField(_("Quantidade Recebida"), max_digits=10, decimal_places=3, default=Decimal('0.000')) # 3 casas decimais

    class Meta:
        verbose_name = _("Item do Pedido de Compra")
        verbose_name_plural = _("Itens dos Pedidos de Compra")
        unique_together = ('pedido_compra', 'produto')
        ordering = ['id']

    def __str__(self):
        return f"{self.produto.nome} ({self.quantidade_pedida}x)"


# REMOVIDO: ContasAPagar (Movido para financeiro/models.py)