# caixa/views.py
from django.shortcuts import render, redirect
from django.urls import reverse
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils.translation import gettext_lazy as _
from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.db import models # Importado para o models.Sum
from django.utils import timezone 
import json # Usado para processar dados JSON em requisições AJAX

# Assumimos que os modelos e forms estão definidos no app 'caixa'
from .models import Caixa, SessaoCaixa, MovimentoCaixa
from .forms import AbrirSessaoCaixaForm, FecharSessaoCaixaForm, MovimentoCaixaForm
from .utils import get_sessao_caixa_ativa

# ====================================================================
# Decorator personalizado para verificar Sessão Ativa
# ====================================================================

def sessao_caixa_required(view_func):
    """Verifica se o usuário tem uma SessaoCaixa ativa."""
    def wrapper(request, *args, **kwargs):
        sessao_ativa = get_sessao_caixa_ativa(usuario=request.user)
        if not sessao_ativa:
            messages.warning(request, _("Você precisa abrir uma sessão de caixa para acessar o PDV."))
            # O nome da rota deve ser 'caixa:pdv_home'
            return redirect(reverse('caixa:pdv_home')) 
            
        # Passa a sessão ativa como um argumento nomeado para a view
        kwargs['sessao_ativa'] = sessao_ativa
        return view_func(request, *args, **kwargs)
    
    # Necessário para que o decorator funcione corretamente no Django
    wrapper.__doc__ = view_func.__doc__
    wrapper.__name__ = view_func.__name__
    return wrapper

# ====================================================================
# 1. View Home do PDV / Controle de Fluxo
# ====================================================================

@login_required
def pdv_home_view(request):
    """
    Ponto de entrada do PDV. Verifica se há uma sessão ativa e decide o que mostrar.
    Se ativa: exibe o PDV. Se não ativa: exibe formulário para abrir.
    """
    
    sessao_ativa = get_sessao_caixa_ativa(usuario=request.user)
    
    if sessao_ativa:
        # Se a sessão estiver ativa, exibe o PDV (tela de operação)
        context = {
            'sessao': sessao_ativa,
            'caixa': sessao_ativa.caixa,
            'is_pdv_active': True,
            # URLs de API necessárias para o frontend do PDV
            'url_api_categorias': reverse('menu:categoria-list'), 
            'url_api_itens': reverse('menu:item-list'), # Corrigido para 'item-list' conforme router padrão
            # URL para registrar a venda (API no app 'vendas')
            'url_api_vendas_registrar': reverse('vendas:api_registrar_venda'), 
            # URL para fechar a sessão 
            'url_fechar_sessao': reverse('caixa:fechar_sessao'),
            # URL para movimentos avulsos 
            'url_movimento_avulso': reverse('caixa:registrar_movimento_avulso'),
        }
        return render(request, 'caixa/pdv_operacao.html', context)
    else:
        # Se não há sessão ativa, exibe a tela de abertura
        return abrir_sessao_caixa_view(request)

# ====================================================================
# 2. Abertura de Sessão de Caixa
# ====================================================================

@login_required
def abrir_sessao_caixa_view(request):
    """Permite ao usuário abrir uma nova SessaoCaixa."""
    
    if get_sessao_caixa_ativa(usuario=request.user):
        messages.info(request, _("Você já tem uma sessão de caixa ativa."))
        return redirect(reverse('caixa:pdv_home'))

    if request.method == 'POST':
        form = AbrirSessaoCaixaForm(request.POST)
        if form.is_valid():
            caixa = form.cleaned_data['caixa']
            valor_inicial = form.cleaned_data['valor_inicial']
            
            # LÓGICA DE NEGÓCIOS CRÍTICA: Checa se o caixa selecionado já está aberto
            if get_sessao_caixa_ativa(caixa=caixa):
                messages.error(request, _("O caixa selecionado já está em uso por outro operador."))
                context = {
                    'form': form, 
                    'caixas_ativos': Caixa.objects.filter(ativo=True)
                }
                return render(request, 'caixa/abrir_sessao.html', context)

            with transaction.atomic():
                SessaoCaixa.objects.create(
                    caixa=caixa,
                    usuario_abertura=request.user,
                    valor_inicial=valor_inicial,
                    status='ABERTO'
                )
            messages.success(request, _("Sessão de caixa aberta com sucesso! Bom trabalho!"))
            return redirect(reverse('caixa:pdv_home'))
    else:
        form = AbrirSessaoCaixaForm()

    context = {
        'form': form, 
        'caixas_ativos': Caixa.objects.filter(ativo=True)
    }
    return render(request, 'caixa/abrir_sessao.html', context)

# ====================================================================
# 3. Fechamento de Sessão de Caixa
# ====================================================================

@login_required
@sessao_caixa_required
def fechar_sessao_caixa_view(request, sessao_ativa):
    """Permite ao usuário fechar a SessaoCaixa ativa."""
    
    # O objeto sessao_ativa é fornecido pelo decorator
    
    # 1. Calcular o saldo teórico (GET e POST)
    saldo_inicial = sessao_ativa.valor_inicial
    
    # Assumindo que MovimentoCaixa tem um related_name 'movimentocaixa_set' ou similar 
    # na SessaoCaixa (ou 'movimentos' para simplificar o código abaixo)
    movimentos_sessao = sessao_ativa.movimento_caixa_set.all() 
    
    # Entradas (Vendas + Suprimentos). O tipo 'VENDA' é criado pelo signal do app 'vendas'.
    entradas = movimentos_sessao.filter(
        tipo__in=[MovimentoCaixa.Tipo.SUPRIMENTO, MovimentoCaixa.Tipo.VENDA]
    ).aggregate(total=models.Sum('valor'))['total'] or 0
    
    # Saídas (Sangrias)
    saidas = movimentos_sessao.filter(
        tipo=MovimentoCaixa.Tipo.SANGRIA
    ).aggregate(total=models.Sum('valor'))['total'] or 0
    
    saldo_teorico = saldo_inicial + entradas - saidas
    
    if request.method == 'POST':
        # O valor final (contado) vem do POST
        form = FecharSessaoCaixaForm(request.POST, instance=sessao_ativa)
        
        if form.is_valid():
            sessao = form.save(commit=False)
            
            # Auditoria: Garante que a sessão está sendo fechada pelo usuário correto
            if sessao.usuario_abertura != request.user:
                 messages.error(request, _("Você só pode fechar a sessão que você abriu."))
                 return redirect(reverse('caixa:pdv_home'))
                    
            sessao.status = SessaoCaixa.Status.FECHADO
            sessao.usuario_fechamento = request.user
            sessao.data_fechamento = timezone.now()
            
            with transaction.atomic():
                sessao.save()
            
            messages.success(request, _("Sessão de caixa fechada com sucesso!"))
            return redirect(reverse('core:home')) # Retorna à tela inicial
    else:
        # Prepara o formulário para conferência.
        # Adicionamos o saldo teórico como 'initial' para exibição no template.
        form = FecharSessaoCaixaForm(
            instance=sessao_ativa, 
            initial={'valor_teorico': saldo_teorico}
        )
    
    context = {
        'form': form, 
        'sessao': sessao_ativa,
        'saldo_teorico': saldo_teorico
    }
    return render(request, 'caixa/fechar_sessao.html', context)

# ====================================================================
# 4. Registrar Movimento Avulso (Sangria/Suprimento) - AJAX
# ====================================================================

@login_required
@require_POST
@sessao_caixa_required
def registrar_movimento_avulso_view(request, sessao_ativa):
    """Permite o registro rápido de Sangrias ou Suprimentos via AJAX/API."""
    
    # 1. Tenta obter dados via JSON (esperado para chamadas PDV/AJAX)
    data = {}
    try:
        data = json.loads(request.body.decode('utf-8'))
    except json.JSONDecodeError:
        # Se não for JSON (ex: formulário tradicional), usa request.POST
        data = request.POST

    form = MovimentoCaixaForm(data)

    if form.is_valid():
        movimento = form.save(commit=False)
        movimento.sessao = sessao_ativa
        movimento.usuario = request.user
        
        with transaction.atomic():
            movimento.save()
        
        # Retorna uma resposta JSON de sucesso
        return JsonResponse({
            'success': True, 
            'message': _("Movimento de %(tipo)s registrado com sucesso!") % {'tipo': movimento.get_tipo_display()},
            'valor': movimento.valor
        })
    else:
        # Retorna erros do formulário
        return JsonResponse({'success': False, 'errors': form.errors}, status=400)
