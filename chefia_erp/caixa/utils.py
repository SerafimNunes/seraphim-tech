# caixa/utils.py
from .models import SessaoCaixa
from django.db.models import Q
from django.utils.translation import gettext_lazy as _

def get_sessao_caixa_ativa(caixa=None, usuario=None):
    """
    Busca a SessaoCaixa ativa.
    
    Prioridade de busca:
    1. Se caixa E usuário são fornecidos: busca a sessão aberta para esse caixa e usuário.
    2. Se apenas usuário é fornecido: busca a sessão aberta pelo usuário em QUALQUER caixa.
    3. Se apenas caixa é fornecido: busca a sessão aberta para QUALQUER usuário nesse caixa.
    
    Retorna o objeto SessaoCaixa ou None.
    """
    
    filtro = Q(status='ABERTO')
    
    if caixa and usuario:
        # Busca sessão aberta pelo usuário no caixa específico
        filtro &= Q(caixa=caixa, usuario_abertura=usuario)
    elif usuario:
        # Busca sessão aberta por qualquer usuário (mais comum, mas menos estrito)
        # Atenção: Se um usuário pode abrir mais de um caixa, isso pode ser ambíguo.
        # Estamos assumindo que o usuário só deve ter 1 sessão ativa.
        filtro &= Q(usuario_abertura=usuario)
    elif caixa:
        # Busca sessão aberta no caixa (pode ser útil para checagens)
        filtro &= Q(caixa=caixa)
    else:
        # Nenhum parâmetro, retorna None
        return None

    try:
        # Assume que só pode haver uma sessão ativa por filtro (ou no máximo uma por usuário)
        sessao = SessaoCaixa.objects.get(filtro)
        return sessao
    except SessaoCaixa.DoesNotExist:
        return None
    except SessaoCaixa.MultipleObjectsReturned:
        # Tratar o caso onde há múltiplas sessões abertas (erro de lógica de negócio)
        print(_("ERRO: Múltiplas sessões de caixa ativas encontradas!"))
        # Retorna a mais recente, mas um alerta deveria ser disparado na lógica de negócio.
        return SessaoCaixa.objects.filter(filtro).order_by('-data_abertura').first()
    
    return None
