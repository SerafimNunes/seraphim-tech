# caixa/models.py
from django.db import models
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _

# Obtém o modelo de usuário ativo
User = get_user_model()

# ====================================================================
# 1. Cadastro de Caixas (PDVs)
# ====================================================================

class Caixa(models.Model):
    """
    Representa um ponto de venda (PDV) ou caixa físico/lógico.
    """
    nome = models.CharField(_("Nome do Caixa"), max_length=100, unique=True)
    descricao = models.TextField(_("Descrição"), blank=True, null=True)
    ativo = models.BooleanField(_("Ativo"), default=True)

    class Meta:
        verbose_name = _("Caixa (PDV)")
        verbose_name_plural = _("Caixas (PDVs)")
        ordering = ['nome']

    def __str__(self):
        return self.nome

# ====================================================================
# 2. Sessão de Caixa (Abertura/Fechamento)
# ====================================================================

class SessaoCaixa(models.Model):
    """
    Representa a abertura e o fechamento de um caixa por um usuário (turno).
    """
    STATUS_CHOICES = (
        ('ABERTO', _('Aberto')),
        ('FECHADO', _('Fechado')),
    )

    caixa = models.ForeignKey(
        Caixa,
        on_delete=models.PROTECT,
        verbose_name=_("Caixa"),
        related_name='sessoes'
    )
    usuario_abertura = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        verbose_name=_("Usuário de Abertura"),
        related_name='sessoes_abertas'
    )
    usuario_fechamento = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        verbose_name=_("Usuário de Fechamento"),
        related_name='sessoes_fechadas',
        blank=True,
        null=True
    )

    data_abertura = models.DateTimeField(_("Data/Hora de Abertura"), auto_now_add=True)
    data_fechamento = models.DateTimeField(_("Data/Hora de Fechamento"), blank=True, null=True)

    valor_inicial = models.DecimalField(_("Valor Inicial (Sangria)"), max_digits=10, decimal_places=2, default=0.00)
    valor_final = models.DecimalField(_("Valor Final (Fechamento)"), max_digits=10, decimal_places=2, blank=True, null=True)

    status = models.CharField(_("Status"), max_length=10, choices=STATUS_CHOICES, default='ABERTO')
    observacoes = models.TextField(_("Observações do Fechamento"), blank=True, null=True)

    class Meta:
        verbose_name = _("Sessão de Caixa")
        verbose_name_plural = _("Sessões de Caixa")
        ordering = ['-data_abertura']

    def __str__(self):
        return f"{self.caixa.nome} - {self.data_abertura.strftime('%d/%m/%Y %H:%M')}"

# ====================================================================
# 3. Movimentações Avulsas (Entradas/Saídas Manuais)
# ====================================================================

class MovimentoCaixa(models.Model):
    """
    Registra entradas e saídas avulsas de dinheiro (sangrias e suprimentos).
    As vendas e pagamentos de vendas serão registradas separadamente ou via signal.
    """
    TIPO_CHOICES = (
        ('SUPRIMENTO', _('Suprimento (Entrada)')),
        ('SANGRIA', _('Sangria (Saída)')),
        ('VENDA', _('Venda (Entrada Automática)')),
    )
    
    # Este campo é o link crucial para o registro da transação
    # Ele será preenchido automaticamente por um signal quando uma venda for paga.
    # O on_delete de SET_NULL garante que se a venda for apagada, o registro de caixa se mantém (apenas para auditoria).
    venda = models.ForeignKey(
        'vendas.Venda', # Referência ao modelo de Venda (assumindo app 'vendas')
        on_delete=models.SET_NULL,
        verbose_name=_("Venda Relacionada"),
        related_name='movimentos_caixa',
        blank=True,
        null=True
    )
    
    # Campo opcional para ligar a pagamentos (se for um pagamento ou estorno)
    pagamento = models.ForeignKey(
        'vendas.MetodoPagamento', # Referência corrigida para o modelo MetodoPagamento na app 'vendas'
        on_delete=models.SET_NULL,
        verbose_name=_("Pagamento de Venda"),
        related_name='movimentos_caixa',
        blank=True,
        null=True
    )

    sessao = models.ForeignKey(
        SessaoCaixa,
        on_delete=models.PROTECT,
        verbose_name=_("Sessão de Caixa"),
        related_name='movimentos_avulsos'
    )
    tipo = models.CharField(_("Tipo de Movimento"), max_length=20, choices=TIPO_CHOICES)
    valor = models.DecimalField(_("Valor"), max_digits=10, decimal_places=2)
    descricao = models.CharField(_("Descrição"), max_length=255, blank=True, null=True)
    
    # Campo para auditoria (quem fez o movimento avulso/abriu a sessão na hora da venda)
    usuario = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        verbose_name=_("Usuário Responsável"),
        related_name='movimentos_caixa_registrados'
    )

    data_movimento = models.DateTimeField(_("Data/Hora do Movimento"), auto_now_add=True)

    class Meta:
        verbose_name = _("Movimento de Caixa")
        verbose_name_plural = _("Movimentos de Caixa")
        ordering = ['data_movimento']

    def __str__(self):
        return f"{self.get_tipo_display()} R$ {self.valor} em {self.sessao.caixa.nome}"
