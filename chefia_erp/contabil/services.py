# contabil/services.py
from django.db import transaction
from django.utils import timezone
from .models import PlanoConta, LancamentoContabil
from decimal import Decimal

# Função utilitária para buscar o usuário (pode ser ajustada)
def get_current_user_or_system(user=None):
    """Retorna o usuário se estiver logado, ou um usuário 'SYSTEM' se for um sinal/operação interna."""
    # Aqui você deve implementar a lógica para buscar um usuário padrão
    # (ex: User.objects.get(username='system')) ou retornar o usuário logado.
    # Por agora, retornaremos None, mas o campo usuario_criacao aceita null.
    return user


@transaction.atomic
def criar_lancamento_contabil(
    historico_transacao: str, 
    valor: Decimal, 
    codigo_debito: str, 
    codigo_credito: str, 
    centro_custo=None, 
    usuario=None, 
    **kwargs
):
    """
    Cria um par de lançamentos (Débito e Crédito) para garantir a partida dobrada.

    Argumentos necessários:
    - historico_transacao (str): Descrição do evento (Ex: Venda #123).
    - valor (Decimal): O valor monetário do lançamento.
    - codigo_debito (str): Código do PlanoConta a ser debitado.
    - codigo_credito (str): Código do PlanoConta a ser creditado.

    Kwargs Opcionais (para rastreabilidade):
    - venda (vendas.Venda): Instância da Venda.
    - pedido_compra (compras.PedidoCompra): Instância do PedidoCompra.
    - *Adicionar outros FKs de rastreabilidade aqui.*
    """
    if valor <= Decimal('0'):
        # Evita lançamentos de valor zero ou negativo, que podem causar inconsistência
        raise ValueError("O valor do lançamento contábil deve ser positivo.")
        
    try:
        # 1. Busca as contas (falha se não existirem no PlanoContas)
        conta_debito = PlanoConta.objects.get(codigo=codigo_debito)
        conta_credito = PlanoConta.objects.get(codigo=codigo_credito)
        
    except PlanoConta.DoesNotExist as e:
        # Erro Crítico: A conta contábil obrigatória não foi cadastrada.
        raise PlanoConta.DoesNotExist(
            f"ERRO DE INTEGRIDADE: Código contábil {codigo_debito} ou {codigo_credito} não existe no Plano de Contas. Detalhes: {e}"
        )

    # 2. Define o usuário de criação
    usuario_origem = get_current_user_or_system(usuario)
    
    # 3. Cria o Débito (Entrada na conta DEVEDORA)
    LancamentoContabil.objects.create(
        data_lancamento=timezone.now(),
        valor=valor,
        tipo_movimento=LancamentoContabil.TipoMovimento.DEBITO,
        plano_conta=conta_debito,
        centro_custo=centro_custo,
        descricao=f"D: {historico_transacao}",
        usuario_criacao=usuario_origem,
        **kwargs # Passa Venda, PedidoCompra, etc.
    )

    # 4. Cria o Crédito (Entrada na conta CREDORA)
    LancamentoContabil.objects.create(
        data_lancamento=timezone.now(),
        valor=valor,
        tipo_movimento=LancamentoContabil.TipoMovimento.CREDITO,
        plano_conta=conta_credito,
        centro_custo=centro_custo,
        descricao=f"C: {historico_transacao}",
        usuario_criacao=usuario_origem,
        **kwargs # Passa Venda, PedidoCompra, etc.
    )
    
    # O retorno pode ser ajustado, mas True indica sucesso
    return True
