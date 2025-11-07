# =======================================================================
# ARQUIVO: contabil/services.py (COMPLETO E CORRIGIDO R7)
# =======================================================================
import logging
from django.db import transaction
from django.utils import timezone
from decimal import Decimal
from django.contrib.auth import get_user_model
from typing import Optional

# Importações dos modelos contábeis (incluindo o novo LoteContabil)
from .models import PlanoConta, LoteContabil, LancamentoContabil, CentroCusto 

User = get_user_model()
logger = logging.getLogger(__name__)

# Função utilitária para buscar o usuário
def get_current_user_or_system(user: Optional[User]) -> Optional[User]:
    """Retorna o usuário se fornecido, ou None se for um signal/operação interna."""
    return user


@transaction.atomic
def criar_lancamento_contabil(
    codigo_debito: str, 
    codigo_credito: str, 
    valor: Decimal, 
    descricao_lancamento: str, # NOVO: Detalhe da linha (Débito/Crédito)
    historico_transacao: str, # NOVO: Descrição do LOTE (Cabeçalho)
    usuario_criacao: Optional[User] = None, # OBRIGATÓRIO (para o LoteContabil)
    centro_custo: Optional[CentroCusto] = None, 
    **kwargs # Para rastreabilidade (pedido_compra, venda, movimento_caixa)
):
    """
    Cria uma transação de Partida Dobrada (Débito + Crédito) dentro de um Lote Contábil.
    """
    
    if valor <= Decimal('0'):
        raise ValueError("O valor do lançamento contábil deve ser positivo.")
        
    try:
        # 1. Busca das Contas
        conta_debito = PlanoConta.objects.get(codigo=codigo_debito)
        conta_credito = PlanoConta.objects.get(codigo=codigo_credito)
        usuario_origem = get_current_user_or_system(usuario_criacao) # Usa o novo argumento
        
    except PlanoConta.DoesNotExist as e:
        logger.error(f"ERRO DE INTEGRIDADE: Código contábil {codigo_debito} ou {codigo_credito} não existe no Plano de Contas. Detalhes: {e}")
        raise PlanoConta.DoesNotExist(
            f"ERRO DE INTEGRIDADE: Código contábil {codigo_debito} ou {codigo_credito} não existe no Plano de Contas. Detalhes: {e}"
        ) from e
        
    # 2. Criação do LOTE (Cabeçalho da Transação)
    # Todos os campos de rastreabilidade (pedido_compra, venda, etc.) são passados via **kwargs
    lote = LoteContabil.objects.create(
        historico_transacao=historico_transacao,
        valor_total=valor,
        usuario_criacao=usuario_origem,
        **kwargs # Passa pedido_compra, venda, movimento_caixa, etc.
    )

    # 3. Criação do Lançamento de DÉBITO (Linha 1)
    LancamentoContabil.objects.create(
        lote_contabil=lote, # Link para o Lote (Cabeçalho)
        data_lancamento=timezone.now(),
        valor=valor,
        tipo_movimento=LancamentoContabil.TipoMovimento.DEBITO,
        plano_conta=conta_debito,
        centro_custo=centro_custo,
        descricao=descricao_lancamento, # Usa o novo campo 'descricao'
    )

    # 4. Criação do Lançamento de CRÉDITO (Linha 2)
    LancamentoContabil.objects.create(
        lote_contabil=lote, # Link para o Lote (Cabeçalho)
        data_lancamento=timezone.now(),
        valor=valor,
        tipo_movimento=LancamentoContabil.TipoMovimento.CREDITO,
        plano_conta=conta_credito,
        centro_custo=centro_custo,
        descricao=descricao_lancamento, # Usa o novo campo 'descricao'
    )

    return lote