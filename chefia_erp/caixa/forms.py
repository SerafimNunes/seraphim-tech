# caixa/forms.py
from django import forms
from .models import Caixa, SessaoCaixa, MovimentoCaixa
from django.utils.translation import gettext_lazy as _

# ====================================================================
# 1. Abrir Sessão
# ====================================================================

class AbrirSessaoCaixaForm(forms.ModelForm):
    """Formulário para iniciar uma SessaoCaixa."""
    
    # Campo 'caixa' é necessário e deve mostrar apenas caixas ativos
    caixa = forms.ModelChoiceField(
        queryset=Caixa.objects.filter(ativo=True),
        label=_("Caixa a Operar"),
        empty_label=_("Selecione um Caixa")
    )
    
    class Meta:
        model = SessaoCaixa
        fields = ['caixa', 'valor_inicial']
        widgets = {
            'valor_inicial': forms.NumberInput(attrs={'step': '0.01', 'min': '0', 'placeholder': _('Ex: 100.00')}),
        }

# ====================================================================
# 2. Fechar Sessão
# ====================================================================

class FecharSessaoCaixaForm(forms.ModelForm):
    """Formulário para fechar uma SessaoCaixa (auditado)."""
    
    # Campo extra para mostrar o valor teórico calculado pela view
    valor_teorico = forms.DecimalField(
        label=_("Saldo Teórico (Sistema)"),
        max_digits=10, 
        decimal_places=2, 
        required=False, 
        widget=forms.NumberInput(attrs={'readonly': 'readonly', 'class': 'bg-gray-100'})
    )
    
    class Meta:
        model = SessaoCaixa
        fields = ['valor_final', 'observacoes']
        widgets = {
            'valor_final': forms.NumberInput(attrs={'step': '0.01', 'min': '0', 'placeholder': _('Valor contado fisicamente')}),
            'observacoes': forms.Textarea(attrs={'rows': 3}),
        }
        labels = {
            'valor_final': _("Valor Contado no Fechamento"),
            'observacoes': _("Observações (Diferença de Caixa, etc.)"),
        }

# ====================================================================
# 3. Movimento Avulso (Sangria/Suprimento)
# ====================================================================

class MovimentoCaixaForm(forms.ModelForm):
    """Formulário para registrar Suprimentos ou Sangrias."""
    
    # Excluímos 'VENDA' das opções visíveis, pois é automático via signal
    tipo = forms.ChoiceField(
        choices=[('SUPRIMENTO', _('Suprimento (Entrada)')), ('SANGRIA', _('Sangria (Saída)'))],
        label=_("Tipo de Movimento")
    )

    class Meta:
        model = MovimentoCaixa
        # 'sessao' e 'usuario' serão preenchidos pela view
        fields = ['tipo', 'valor', 'descricao']
        widgets = {
            'valor': forms.NumberInput(attrs={'step': '0.01', 'min': '0', 'placeholder': _('Valor')}),
            'descricao': forms.TextInput(attrs={'placeholder': _('Motivo do movimento')}),
        }
