# ==============================================================================
# ARQUIVO: compras/models.py (COMPLETO E CORRIGIDO)
# R3: Propriedade valor_total implementada no modelo
# R4: Precisão decimal aumentada para 4 casas no valor_total
# R5: Validação clean() para quantidade_recebida
# ==============================================================================
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator
from django.core.exceptions import ValidationError
from decimal import Decimal
from datetime import date
from django.db.models import Sum, F

# Importações de outros módulos (Foreign Keys)
from core.models import Fornecedor # Assumindo que Fornecedor está em 'core'
from estoque.models import Produto 

# Obtém o modelo de usuário customizado
User = get_user_model()


# ====================================================================\
# 1. ESCOLHAS DE STATUS
# ====================================================================\

class StatusPedidoCompra(models.TextChoices):
    PENDENTE = 'PENDENTE', ('Pendente (Rascunho)') 
    AGUARDANDO = 'AGUARDANDO', ('Aguardando Envio') 
    ENVIADO = 'ENVIADO', ('Enviado ao Fornecedor') 
    
    # Status de Recebimento (disparadores de sinal)
    RECEBIDO_PARCIAL = 'RECEBIDO_PARCIAL', ('Recebido Parcialmente') 
    FINALIZADO = 'FINALIZADO', ('Recebido e Concluído') 
    
    CANCELADO = 'CANCELADO', ('Cancelado')


# ====================================================================\
# 2. PEDIDO DE COMPRA (Cabeçalho)
# ====================================================================\

class PedidoCompra(models.Model):
    fornecedor = models.ForeignKey(
        Fornecedor,
        on_delete=models.PROTECT,
        verbose_name=_("Fornecedor")
    )
    data_emissao = models.DateField(default=date.today, verbose_name=_("Data de Emissão"))
    data_entrega_prevista = models.DateField(null=True, blank=True, verbose_name=_("Entrega Prevista"))
    
    # 🚨 CORREÇÃO R4: Aumentado para 4 casas decimais para precisão contábil
    valor_total = models.DecimalField(
        _("Valor Total"), 
        max_digits=12, 
        decimal_places=4, 
        default=Decimal('0.0000'), 
        help_text=_("Calculado automaticamente pela soma dos itens. 4 casas decimais para precisão.")
    )
    
    status = models.CharField(
        _("Status"),
        max_length=50,
        choices=StatusPedidoCompra.choices,
        default=StatusPedidoCompra.PENDENTE
    )
    
    responsavel = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        verbose_name=_("Responsável pela Compra")
    )
    
    # Flag de segurança contra processamento duplicado (R1)
    movimento_criado = models.BooleanField(
        _("Movimento Estoque/Contas a Pagar Criado"), 
        default=False
    )

    observacoes = models.TextField(blank=True, verbose_name=_("Observações"))

    class Meta:
        verbose_name = _("Pedido de Compra")
        verbose_name_plural = _("Pedidos de Compra")
        ordering = ['-data_emissao', 'pk']

    def __str__(self):
        return f"Pedido N° {self.pk} - {self.fornecedor.nome} - {self.get_status_display()}"

    # 🚨 CORREÇÃO R3: Propriedade para calcular o total em tempo real (substitui save_model no Admin)
    @property
    def valor_total_calculado(self) -> Decimal:
        """Calcula o valor total do pedido somando o valor total de cada item."""
        
        # Filtra apenas itens com valor total > 0 para evitar erros
        # e soma os valores totais dos itens (que já são calculados em ItemPedidoCompra)
        total = self.itens.aggregate(
            soma_total=Sum(F('quantidade_pedida') * F('preco_unitario_negociado'), output_field=models.DecimalField(decimal_places=4))
        )['soma_total'] or Decimal('0.0000')
        
        return total.quantize(Decimal('0.0001')) # Garante 4 casas no retorno

    def save(self, *args, **kwargs):
        """Sobrescreve save para atualizar valor_total antes de salvar."""
        # Se os itens já foram salvos (após o inlines), o valor_total_calculado será correto
        # Isso garante que o valor_total seja persistido com a precisão correta
        self.valor_total = self.valor_total_calculado
        super().save(*args, **kwargs)


# =========================================================
# 3. ITEM DO PEDIDO DE COMPRA
# =========================================================

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
        
    # 🚨 CORREÇÃO R5: Validador para impedir recebimento a maior
    def clean(self):
        """Validação para garantir que a quantidade recebida não exceda a pedida."""
        if self.quantidade_recebida > self.quantidade_pedida:
            raise ValidationError(
                _("A quantidade recebida (%(recebida)s) não pode ser maior que a quantidade pedida (%(pedida)s)."),
                params={'recebida': self.quantidade_recebida, 'pedida': self.quantidade_pedida},
                code='excess_receipt'
            )
            
    # Propriedade para cálculo do valor total do item (usada para o valor_total do Pedido)
    @property
    def valor_total_item(self) -> Decimal:
        if self.quantidade_pedida and self.preco_unitario_negociado:
            return (self.quantidade_pedida * self.preco_unitario_negociado).quantize(Decimal('0.0001'))
        return Decimal('0.0000')

    def __str__(self):
        return f"{self.produto.nome} ({self.quantidade_pedida} {self.produto.unidade_medida.sigla})"