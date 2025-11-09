from django.shortcuts import render, get_object_or_404
from django.db.models import Sum, F
from django.contrib.admin.views.decorators import staff_member_required
from django.db import transaction
from django.http import JsonResponse
from decimal import Decimal

# 🚨 CORREÇÃO 1: ADICIONADO CustoProduto (Necessário para estoque_resumo)
from .models import Produto, ContagemDiariaFLV, RequisicaoEstoque, CustoProduto
from .services import EstoqueService 
from django.core.exceptions import ValidationError 

# Importar Usuario, Fornecedor, Cliente para FKs, assumindo que estão no 'core'
# from core.models import Usuario, Fornecedor, Cliente 

# Helpers para resposta JSON
def json_success(message, data=None):
    return JsonResponse({'status': 'success', 'message': message, 'data': data or {}})

def json_error(message, status=400):
    return JsonResponse({'status': 'error', 'message': message}, status=status)


# Constante de precisão
TRES_CASAS = Decimal('0.001')


# ----------------------------------------------------------------------
# VIEWS DE INTEGRAÇÃO (APIs)
# ----------------------------------------------------------------------

@staff_member_required
def requisitar_estoque_api(request):
    """
    API para criação de Requisições de Estoque (usada por Produção ou PDV).
    R3: Delega a lógica de negócio para o Service Layer.
    """
    if request.method != 'POST':
        return json_error("Método não permitido.", 405)
    
    try:
        # Simplificação: assume que dados são passados via POST (JSON)
        data = request.POST # Ou json.loads(request.body) se for um app externo
        
        # O Service espera uma lista de itens. Aqui, vamos simular a lista 
        # a partir de uma requisição simples (um item por vez)
        produto_id = data.get('produto_id')
        quantidade_requisitada = data.get('quantidade_requisitada')
        
        if not produto_id or not quantidade_requisitada:
            raise ValidationError("Os campos 'produto_id' e 'quantidade_requisitada' são obrigatórios.")
            
        itens_data = [{
            'produto_id': int(produto_id),
            'quantidade_requisitada': Decimal(quantidade_requisitada)
        }]
        
        # 🚨 CORREÇÃO R3: Delega a regra de negócio para o Service Layer
        requisicao = EstoqueService.criar_requisicao_estoque(
            itens_data=itens_data,
            responsavel_id=request.user.pk,
            # Tipo de requisição pode ser passado via POST, ou assumimos 'PRODUCAO'
            tipo_requisicao='PRODUCAO' 
        )
        
        return json_success("Requisição de estoque criada com sucesso e pendente de atendimento.", {'requisicao_id': requisicao.pk, 'status': requisicao.status})
        
    except ValidationError as e:
        return json_error(f"Erro de validação de Negócio: {e.message}")
    except Exception as e:
        return json_error(f"Erro interno ao processar requisição: {str(e)}", 500)


@staff_member_required
@transaction.atomic
def finalizar_contagem_flv_api(request):
    # ... (código existente da view)
    pass


# ----------------------------------------------------------------------
# VIEWS ADMINISTRATIVAS E DASHBOARD
# ----------------------------------------------------------------------

@staff_member_required
def estoque_resumo(request):
    """
    Dashboard de Resumo de Estoque (Para uso do Admin).
    """
    TRES_CASAS = Decimal('0.001') # Para formatação de quantidade
    
    # 1. VALOR TOTAL DE ESTOQUE (CUSTO)
    # Busca o valor total diretamente da tabela CustoProduto para otimizar
    valor_total_estoque = CustoProduto.objects.aggregate(
        total=Sum('valor_total_estoque')
    )['total'] or Decimal('0.0000')
    
    # 2. PRODUTOS EM ALERTA (Estoque Mínimo)
    produtos_em_alerta = Produto.objects.filter(
        ativo=True,
        custo_info__quantidade_atual__lt=F('estoque_minimo') 
    ).order_by('custo_info__quantidade_atual')[:10] 

    # 3. VALOR TOTAL DE PRODUTOS VENDÁVEIS (Valor de Venda Potencial)
    valor_venda_potencial = Produto.objects.filter(
        ativo=True,
        is_vendavel=True
    ).aggregate(
        total=Sum(F('custo_info__quantidade_atual') * F('preco_venda'))
    )['total'] or Decimal('0.00')
    
    # 4. ITENS COM MAIS VALOR
    itens_mais_caros = CustoProduto.objects.select_related('produto').order_by('-valor_total_estoque')[:5]

    # 🚨 PONTO CRÍTICO CORRIGIDO: Dicionário 'context' com sintaxe limpa
    context = {
        'title': 'Resumo Analítico do Estoque',
        'valor_total_estoque': f"R$ {valor_total_estoque:,.2f}",
        'valor_venda_potencial': f"R$ {valor_venda_potencial:,.2f}",
        'num_produtos_alerta': produtos_em_alerta.count(),
        'produtos_em_alerta': [{
            'nome': p.nome,
            # Linha 124 CORRIGIDA: Garanta que esta linha esteja completa e em uma única linha lógica
            'quantidade_atual': f"{p.custo_info.quantidade_atual.quantize(TRES_CASAS):,}",
            'estoque_minimo': f"{p.estoque_minimo.quantize(TRES_CASAS):,}",
            'unidade': p.unidade_medida.sigla
        } for p in produtos_em_alerta],
        'itens_mais_caros': [{
            'nome': item.produto.nome,
            'valor_total_estoque': f"R$ {item.valor_total_estoque:,.2f}"
        } for item in itens_mais_caros],
    }

    return render(request, 'admin/estoque/estoque_resumo.html', context)