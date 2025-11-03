# estoque/views.py

from django.shortcuts import render, get_object_or_404
from django.db.models import Sum, F
from django.contrib.admin.views.decorators import staff_member_required
from django.db import transaction
from django.http import JsonResponse
from decimal import Decimal

from .models import Produto, ContagemDiariaFLV, RequisicaoEstoque
# Importar Usuario, Fornecedor, Cliente para FKs, assumindo que estão no 'core'
# from core.models import Usuario, Fornecedor, Cliente 

# Helpers para resposta JSON (Assumindo que estão definidos em algum lugar, ou simplificamos aqui)
def json_success(message, data=None):
    return JsonResponse({'status': 'success', 'message': message, 'data': data or {}})

def json_error(message, status=400):
    return JsonResponse({'status': 'error', 'message': message}, status=status)


# ----------------------------------------------------------------------
# VIEWS DE INTEGRAÇÃO (APIs)
# ----------------------------------------------------------------------

# TO-DO: Implementar validação de responsável/usuário autenticado
@staff_member_required
def requisitar_estoque_api(request):
    if request.method != 'POST':
        return json_error("Método não permitido.", 405)
    
    try:
        # Simplificação: assume que dados são passados via POST (JSON)
        data = request.POST # Ou json.loads(request.body) se for um app externo
        
        produto_id = data.get('produto_id')
        quantidade_requisitada = data.get('quantidade')
        # responsavel_id = data.get('responsavel_id') # ID do usuário que faz a requisição
        
        # Converte para Decimal
        quantidade = Decimal(str(quantidade_requisitada)).quantize(Decimal('0.000'))
        
        # Buscar Produto e Responsável
        produto = get_object_or_404(Produto, pk=produto_id)
        # responsavel = get_object_or_404(Usuario, pk=responsavel_id)
        
    except Produto.DoesNotExist:
        return json_error(f"Produto ID {produto_id} não encontrado.", 404)
    except Exception as e:
        return json_error(f"Erro na conversão de dados ou busca de FK: {str(e)}")

    # A criação dispara o signal post_save que cuidará da Movimentação (SAÍDA_PRODUCAO)
    try:
        with transaction.atomic():
            # A RequisicaoEstoque deve ser criada com o responsável (solicitante)
            # Para simplificar agora, criaremos sem o responsavel_atendimento
            requisicao = RequisicaoEstoque.objects.create(
                produto=produto,
                quantidade_requisitada=quantidade,
                status='ATENDIDA', # Simula atendimento imediato para disparar o signal
                # solicitante=responsavel, # Assumindo que o solicitante é o usuário logado ou passado na requisição
                # responsavel_atendimento é nulo inicialmente ou é preenchido na view de atendimento
            )
            
            # O signal gerou o MovimentoEstoque (SAÍDA_PRODUCAO)
            return json_success(
                f"Requisição de Estoque #{requisicao.pk} registrada e movimento de saída gerado.",
                data={'requisicao_id': requisicao.pk}
            )
            
    except Exception as e:
        print(f"Erro ao criar requisição de estoque: {e}")
        return json_error(f"Erro interno ao salvar a requisição: {str(e)}")


@staff_member_required
def finalizar_contagem_flv_api(request):
    if request.method != 'POST':
        return json_error("Método não permitido.", 405)
    
    try:
        data = request.POST
        produto_id = data.get('produto_id')
        quantidade_contada = data.get('quantidade_contada')
        # responsavel_id = data.get('responsavel_id') # ID do usuário que fez a contagem
        
        produto = get_object_or_404(Produto, pk=produto_id)
        # Verifica se o produto é apropriado para Contagem FLV (Exemplo: produtos is_flv=True)
        # Apenas para simplificar, usaremos todos os Produtos.
        
        quantidade = Decimal(str(quantidade_contada)).quantize(Decimal('0.000'))
        
    except Produto.DoesNotExist:
        return json_error(f"Produto ID {produto_id} não encontrado.", 404)
    except Exception:
        return json_error("Erro na conversão de dados ou busca de FK.")

    # A criação dispara o signal post_save que cuidará da Movimentação (AJUSTE)
    try:
        with transaction.atomic():
            # Pegamos a quantidade atual do produto ANTES de criar a contagem
            quantidade_sistema = produto.quantidade_atual
            
            contagem = ContagemDiariaFLV.objects.create(
                produto=produto,
                quantidade_contada=quantidade,
                quantidade_sistema=quantidade_sistema, # Preenche a quantidade do sistema no momento da contagem
                status='CONCLUIDA', # Simula finalização imediata para disparar o signal
                # responsavel_id=responsavel_id
            )
            
            # O signal gerou o MovimentoEstoque (AJUSTE) se a quantidade_contada for diferente da quantidade_atual
            return json_success(
                f"Contagem Diária FLV #{contagem.pk} registrada e movimento de ajuste gerado (se necessário).",
                data={'contagem_id': contagem.pk}
            )
            
    except Exception as e:
        print(f"Erro ao criar contagem FLV: {e}")
        return json_error(f"Erro interno ao salvar a contagem: {str(e)}")

# TO-DO: Adicionar views para AuditoriaInventario e AuditoriaPrePronto, se necessário


# ----------------------------------------------------------------------
# VIEW DE DASHBOARD/RESUMO ADMIN
# ----------------------------------------------------------------------

@staff_member_required
def estoque_resumo(request):
    """
    Calcula e exibe um resumo analítico do estoque.
    """
    TRES_CASAS = Decimal('0.000')
    
    # 1. VALOR TOTAL DO ESTOQUE
    # Calcula o valor do estoque como a soma (quantidade_atual * custo_medio_ponderado)
    valor_total_estoque = Produto.objects.filter(ativo=True).aggregate(
        total=Sum(F('quantidade_atual') * F('custo_medio_ponderado'))
    )['total'] or Decimal('0.00')

    # 2. PRODUTOS EM ESTOQUE MÍNIMO OU ABAIXO
    produtos_em_alerta = Produto.objects.filter(
        quantidade_atual__lte=F('estoque_minimo'),
        ativo=True
    ).order_by('quantidade_atual')[:10] # Limita a 10 para o dashboard

    # 3. VALOR TOTAL DE PRODUTOS VENDÁVEIS (Valor de Venda Potencial)
    valor_venda_potencial = Produto.objects.filter(
        ativo=True,
        is_vendavel=True
    ).aggregate(
        total=Sum(F('quantidade_atual') * F('preco_venda'))
    )['total'] or Decimal('0.00')
    
    # 4. ITENS COM MAIS VALOR
    itens_mais_caros = Produto.objects.filter(ativo=True).annotate(
        valor_total=F('quantidade_atual') * F('custo_medio_ponderado')
    ).order_by('-valor_total')[:5]

    context = {
        'title': 'Resumo Analítico do Estoque',
        'valor_total_estoque': f"R$ {valor_total_estoque:,.2f}",
        'valor_venda_potencial': f"R$ {valor_venda_potencial:,.2f}",
        'num_produtos_alerta': produtos_em_alerta.count(),
        'produtos_em_alerta': [{
            'nome': p.nome,
            'quantidade_atual': f"{p.quantidade_atual.quantize(TRES_CASAS):,}",
            'estoque_minimo': f"{p.estoque_minimo.quantize(TRES_CASAS):,}",
            'unidade': p.unidade_medida.sigla
        } for p in produtos_em_alerta],
        'itens_mais_caros': [{
            'nome': p.nome,
            'valor_total': f"R$ {p.valor_total:,.2f}",
            'unidade': p.unidade_medida.sigla,
            'custo_medio': f"R$ {p.custo_medio_ponderado:,.4f}"
        } for p in itens_mais_caros],
    }

    # TO-DO: Criar o template estoque/admin/estoque_resumo.html
    return render(request, 'admin/estoque/estoque_resumo.html', context)
