# compras/models.py
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.contrib.auth import get_user_model
from decimal import Decimal
from datetime import date
from core.models import Fornecedor # Assumindo que Fornecedor está em 'core'
from estoque.models import Produto 

# Obtém o modelo de usuário ativo
User = get_user_model()


# ====================================================================
# 1. PEDIDO DE COMPRA (Cabeçalho)
# ====================================================================

class PedidoCompra(models.Model):
    STATUS_AGUARDANDO = 'AGUARDANDO'
    STATUS_ENVIADO = 'ENVIADO'
    STATUS_RECEBIDO = 'RECEBIDO' # Status que dispara a entrada de estoque
    STATUS_CANCELADO = 'CANCELADO'

    STATUS_CHOICES = [
        (STATUS_AGUARDANDO, _('Aguardando Envio')),
        (STATUS_ENVIADO, _('Enviado ao Fornecedor')),
        (STATUS_RECEBIDO, _('Recebido e Concluído')),
        (STATUS_CANCELADO, _('Cancelado')),
    ]

    fornecedor = models.ForeignKey(
        Fornecedor,
        on_delete=models.PROTECT,
        verbose_name=_("Fornecedor"),
        related_name='pedidos_compra'
    )
    data_pedido = models.DateField(_("Data do Pedido"), default=date.today)
    data_prevista_recebimento = models.DateField(_("Previsão de Recebimento"), null=True, blank=True)
    
    total_liquido = models.DecimalField(_("Total Líquido"), max_digits=10, decimal_places=2, default=Decimal('0.00'))
    observacoes = models.TextField(_("Observações"), blank=True, null=True)

    status = models.CharField(_("Status"), max_length=20, choices=STATUS_CHOICES, default=STATUS_AGUARDANDO)
    
    # Flag de segurança para o signal de estoque/contabilidade
    movimento_criado = models.BooleanField(_("Movimento de Estoque Criado?"), default=False)

    usuario_criacao = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='pedidos_compra_criados',
        verbose_name=_("Usuário de Criação")
    )
    data_criacao = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("Pedido de Compra")
        verbose_name_plural = _("Pedidos de Compra")
        ordering = ['-data_pedido', '-data_criacao']

    def __str__(self):
        return f"Compra #{self.pk} - {self.fornecedor.nome}"

    # Método para calcular o total
    def calcular_total(self):
        total = self.itens.aggregate(sum_total=models.Sum(models.F('quantidade_pedida') * models.F('preco_unitario_negociado')))['sum_total']
        self.total_liquido = total if total is not None else Decimal('0.00')
        self.save(update_fields=['total_liquido'])

# ====================================================================
# 2. ITENS DO PEDIDO DE COMPRA
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
    quantidade_pedida = models.DecimalField(_("Quantidade Pedida"), max_digits=10, decimal_places=2)
    preco_unitario_negociado = models.DecimalField(_("Preço Unitário Negociado"), max_digits=10, decimal_places=2)
    
    # Campo para registrar o que foi realmente recebido (para recebimento parcial)
    quantidade_recebida = models.DecimalField(_("Quantidade Recebida"), max_digits=10, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        verbose_name = _("Item do Pedido de Compra")
        verbose_name_plural = _("Itens dos Pedidos de Compra")
        unique_together = ('pedido_compra', 'produto')
        ordering = ['id']

    def __str__(self):
        return f"{self.produto.nome} ({self.quantidade_pedida}x)"


# ====================================================================
# 3. CONTAS A PAGAR (Gerado a partir do PedidoCompra)
# Este é o modelo que estava faltando e causava o erro!
# ====================================================================

class ContasAPagar(models.Model):
    STATUS_A_PAGAR = 'A_PAGAR'
    STATUS_PAGO = 'PAGO'
    STATUS_CANCELADO = 'CANCELADO'

    STATUS_CHOICES = [
        (STATUS_A_PAGAR, _('A Pagar')),
        (STATUS_PAGO, _('Pago/Liquidado')),
        (STATUS_CANCELADO, _('Cancelado')),
    ]
    
    fornecedor = models.ForeignKey(
        Fornecedor,
        on_delete=models.PROTECT,
        verbose_name=_("Fornecedor"),
        related_name='contas_a_pagar'
    )
    pedido_compra = models.ForeignKey(
        PedidoCompra,
        on_delete=models.SET_NULL, # Se o pedido for apagado, a conta a pagar se mantém para auditoria
        null=True, blank=True,
        verbose_name=_("Pedido de Compra de Origem"),
        related_name='contas_a_pagar'
    )
    
    valor_original = models.DecimalField(_("Valor Original"), max_digits=10, decimal_places=2)
    valor_pago = models.DecimalField(_("Valor Pago"), max_digits=10, decimal_places=2, default=Decimal('0.00'))
    
    data_vencimento = models.DateField(_("Data de Vencimento"))
    data_pagamento = models.DateField(_("Data de Pagamento"), null=True, blank=True)
    
    status = models.CharField(_("Status"), max_length=20, choices=STATUS_CHOICES, default=STATUS_A_PAGAR)
    observacoes = models.TextField(_("Observações"), blank=True, null=True)

    # Flag de segurança para o signal de contabilização de pagamento
    contabilizado_pagamento = models.BooleanField(_("Pagamento Contabilizado?"), default=False) 

    usuario_criacao = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='contas_a_pagar_criadas',
        verbose_name=_("Usuário de Criação")
    )
    data_criacao = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = _("Conta a Pagar")
        verbose_name_plural = _("Contas a Pagar")
        ordering = ['data_vencimento']

    def __str__(self):
        return f"Pagar R$ {self.valor_original} a {self.fornecedor.nome} ({self.status})"
