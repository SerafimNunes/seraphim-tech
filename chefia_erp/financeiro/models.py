# ==============================================================================
# ARQUIVO: financeiro/models.py (CORRIGIDO)
# ==============================================================================
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator
from decimal import Decimal
from datetime import date

# Importações de outros módulos (necessárias para as Foreign Keys PROTECT)
from compras.models import PedidoCompra 
from core.models import Fornecedor      

# Obtém o modelo de usuário customizado
User = get_user_model()


# ====================================================================
# 1. ESCOLHAS DE STATUS
# ====================================================================

class StatusContasAPagar(models.TextChoices):
    A_PAGAR = 'A_PAGAR', ('A Pagar') 
    PAGO_PARCIAL = 'PAGO_PARCIAL', ('Pago Parcialmente') 
    PAGO_TOTAL = 'PAGO_TOTAL', ('Pago Totalmente/Liquidado') 
    CANCELADO = 'CANCELADO', ('Cancelado')


# ====================================================================
# 2. CONTAS A PAGAR
# ====================================================================

class ContasAPagar(models.Model):
    
    pedido_compra = models.OneToOneField(
        PedidoCompra,
        on_delete=models.PROTECT, 
        verbose_name=_("Pedido de Compra de Origem"),
        related_name='contas_a_pagar'
    )
    
    fornecedor = models.ForeignKey(
        Fornecedor,
        on_delete=models.PROTECT,
        verbose_name=_("Fornecedor"),
        related_name='contas_a_pagar_fornecedor'
    )
    
    valor_original = models.DecimalField(_("Valor Original"), max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    valor_pago = models.DecimalField(_("Valor Pago"), max_digits=10, decimal_places=2, default=Decimal('0.00'))
    
    data_vencimento = models.DateField(_("Data de Vencimento"))
    data_pagamento = models.DateField(_("Data de Pagamento"), null=True, blank=True)
    
    status = models.CharField(
        _("Status"), 
        max_length=20, 
        choices=StatusContasAPagar.choices, 
        default=StatusContasAPagar.A_PAGAR
    )
    observacoes = models.TextField(_("Observações"), blank=True, null=True)

    contabilizado_pagamento = models.BooleanField(_("Pagamento Contabilizado?"), default=False) 

    usuario_criacao = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='contas_a_pagar_criadas',
        verbose_name=_("Usuário de Criação")
    )
    data_criacao = models.DateTimeField(auto_now_add=True)
    
    @property # <--- ADICIONADO: Corrige o AttributeError
    def valor_a_pagar(self):
        """Calcula o valor restante a pagar (valor original - valor pago)."""
        return self.valor_original - self.valor_pago
    
    class Meta:
        verbose_name = _("Conta a Pagar")
        verbose_name_plural = _("Contas a Pagar")
        ordering = ['data_vencimento']

    def __str__(self):
        return f"Pagar R$ {self.valor_original} a {self.fornecedor.nome} ({self.get_status_display()})"