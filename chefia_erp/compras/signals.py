# compras/models.py
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator # Importação para garantir valores positivos
from decimal import Decimal
from datetime import date

# Importações de outros módulos (Foreign Keys)
from core.models import Fornecedor # Fornecedor está em 'core'
from estoque.models import Produto # Produto está em 'estoque'

# Obtém o modelo de usuário customizado
User = get_user_model()


# ====================================================================
# 1. ESCOLHAS DE STATUS (Refatorado para melhor granularidade)
# ====================================================================

class StatusPedidoCompra(models.TextChoices):
    PENDENTE = 'PENDENTE', _('Pendente (Rascunho)')
    APROVADO = 'APROVADO', _('Aprovado Internamente')
    RECEBIDO_PARCIAL = 'RECEBIDO_PARCIAL', _('Recebido Parcialmente') # Gatilho Parcial para Estoque
    FINALIZADO = 'FINALIZADO', _('Finalizado (Entrega Total)') # Gatilho Total para Estoque e ContasAPagar
    CANCELADO = 'CANCELADO', _('Cancelado')


class StatusContasAPagar(models.TextChoices):
    A_PAGAR = 'A_PAGAR', _('A Pagar')
    PAGO_PARCIAL = 'PAGO_PARCIAL', _('Pago Parcialmente') # Novo status para rastreamento financeiro
    PAGO_TOTAL = 'PAGO_TOTAL', _('Pago Totalmente/Liquidado')
    CANCELADO = 'CANCELADO', _('Cancelado')


# ====================================================================
# 2. PEDIDO DE COMPRA (Cabeçalho)
# ====================================================================

class PedidoCompra(models.Model):
    # Rastreabilidade
    fornecedor = models.ForeignKey(
        Fornecedor,
        on_delete=models.PROTECT,
        verbose_name=_("Fornecedor"),
        related_name='pedidos_compra'
    )
    responsavel = models.ForeignKey( # Renomeado para 'responsavel' (padrão estoque)
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='pedidos_compra_criados',
        verbose_name=_("Responsável pela Compra")
    )

    # Informações do Pedido
    data_pedido = models.DateField(_("Data do Pedido"), default=date.today)
    data_prevista_recebimento = models.DateField(_("Previsão de Recebimento"), null=True, blank=True)
    
    numero_nota_fiscal = models.CharField( # Adicionado conforme plano
        _("Número da Nota Fiscal (NF)"),
        max_length=50,
        blank=True,
        null=True,
        unique=True,
        help_text=_("Obrigatório para pedidos FINALIZADOS.")
    )
    
    total_liquido = models.DecimalField(
        _("Valor Total Líquido (R$)"), 
        max_digits=10, 
        decimal_places=2, 
        default=Decimal('0.00'), 
        editable=False # Calculado
    )
    observacoes = models.TextField(_("Observações"), blank=True, null=True)

    status = models.CharField(
        _("Status"), 
        max_length=20, 
        choices=StatusPedidoCompra.choices, 
        default=StatusPedidoCompra.PENDENTE
    )
    
    # Flag de segurança para o signal de estoque/contabilidade
    movimento_criado = models.BooleanField(_("Movimento de Estoque Contabilizado?"), default=False)

    data_criacao = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("Pedido de Compra")
        verbose_name_plural = _("Pedidos de Compra")
        ordering = ['-data_pedido', '-data_criacao']

    def __str__(self):
        return f"Compra #{self.pk} - {self.fornecedor.nome} ({self.get_status_display()})"

    def calcular_total(self):
        """
        Recalcula o total do pedido somando o valor de todos os itens.
        Usado em ItemPedidoCompra post_save/post_delete.
        """
        total = self.itens.aggregate(
            sum_total=models.Sum(models.F('quantidade_pedida') * models.F('preco_unitario_negociado'))
        )['sum_total']
        self.total_liquido = total if total is not None else Decimal('0.00')
        # Salva o campo sem disparar o signal post_save principal para evitar recursão
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
        verbose_name=_("Produto / Insumo")
    )
    
    # Precisão ajustada para CMP (3 casas decimais)
    quantidade_pedida = models.DecimalField(
        _("Quantidade Pedida"), 
        max_digits=10, 
        decimal_places=3, 
        validators=[MinValueValidator(Decimal('0.001'))]
    )
    
    # Precisão ajustada para CMP (4 casas decimais)
    preco_unitario_negociado = models.DecimalField(
        _("Preço Unitário Negociado (R$)"), 
        max_digits=10, 
        decimal_places=4,
        validators=[MinValueValidator(Decimal('0.0001'))]
    )
    
    # Precisão ajustada para CMP (3 casas decimais)
    quantidade_recebida = models.DecimalField(
        _("Quantidade Recebida"), 
        max_digits=10, 
        decimal_places=3, 
        default=Decimal('0.000')
    )

    class Meta:
        verbose_name = _("Item do Pedido de Compra")
        verbose_name_plural = _("Itens dos Pedidos de Compra")
        unique_together = ('pedido_compra', 'produto')
        ordering = ['id']

    def __str__(self):
        return f"{self.produto.nome} ({self.quantidade_pedida}x)"

    @property
    def valor_total_item(self):
        """Calcula o valor total do item (Quantidade * Preço Negociado)"""
        try:
            return self.quantidade_pedida * self.preco_unitario_negociado
        except TypeError:
            return Decimal('0.00')


# ====================================================================
# 4. CONTAS A PAGAR (Gerado a partir do PedidoCompra)
# ====================================================================

class ContasAPagar(models.Model):
    
    # Rastreamento da Origem (CRÍTICO: OneToOneField para garantir 1 débito por pedido)
    pedido_compra = models.OneToOneField( 
        PedidoCompra,
        on_delete=models.PROTECT, # Protege o registro do débito (regra de auditoria financeira)
        verbose_name=_("Pedido de Compra de Origem"),
        related_name='contas_a_pagar'
    )
    
    fornecedor = models.ForeignKey(
        Fornecedor,
        on_delete=models.PROTECT,
        verbose_name=_("Fornecedor"),
        related_name='contas_a_pagar_fornecedor' # Renomeado para evitar conflito de related_name com a FK do fornecedor no pedido_compra
    )
    
    valor_original = models.DecimalField(_("Valor Original"), max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    valor_pago = models.DecimalField(_("Valor Pago"), max_digits=10, decimal_places=2, default=Decimal('0.00'))
    
    data_vencimento = models.DateField(_("Data de Vencimento"))
    data_pagamento = models.DateField(_("Data de Pagamento"), null=True, blank=True)
    
    status = models.CharField(_("Status"), max_length=20, choices=StatusContasAPagar.choices, default=StatusContasAPagar.A_PAGAR)
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
        return f"Pagar R$ {self.valor_original} a {self.fornecedor.nome} ({self.get_status_display()})"
    
    @property
    def saldo_devedor(self):
        return self.valor_original - self.valor_pago
