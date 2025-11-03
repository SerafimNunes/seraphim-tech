# contabil/signals.py
# LÓGICA 6: CONTABILIZAÇÃO AUTOMÁTICA DE MOVIMENTOS DE ESTOQUE
# Garante que todo movimento de estoque gerado pela produção (e por outras fontes)
# tenha um espelho contábil usando o modelo LancamentoContabil (Partidas Dobradas).

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from django.db.models import Sum, F
from decimal import Decimal
from django.utils import timezone
from django.contrib.auth import get_user_model

# Importa modelos de Estoque
from estoque.models import MovimentoEstoque, ItemMovimentoEstoque, Produto

# IMPORTAÇÃO DE MODELOS CONTÁBEIS REAIS
from .models import PlanoConta, LancamentoContabil, CentroCusto

User = get_user_model()

# --- DEFINIÇÃO DE CONTAS ESSENCIAIS (Mapeamento de Código) ---
# ATENÇÃO: Estes códigos DEVEM existir no seu banco de dados (PlanoConta)
class ContasEssenciais:
    # Códigos sugeridos:
    ESTOQUE_PRODUTO_ACABADO_COD = '1.1.01.001'
    ESTOQUE_INSUMOS_COD = '1.1.01.002'
    CUSTO_PRODUCAO_ANDAMENTO_COD = '5.1.01.001'

    @staticmethod
    def get_conta_by_codigo(codigo):
        """Busca a instância de PlanoConta pelo código."""
        try:
            # Isto falhará se a conta não estiver cadastrada, forçando o rollback
            return PlanoConta.objects.get(codigo=codigo)
        except PlanoConta.DoesNotExist:
            raise ValueError(f"Conta Contábil essencial não encontrada: Código {codigo}")


def get_valor_total_movimento(movimento_estoque):
    """Calcula o valor total de um Movimento de Estoque."""
    
    # Agrega a soma do (quantidade_movimentada * preco_unitario) para todos os itens
    total = movimento_estoque.itens_movimento.aggregate(
        valor_total=Sum(F('quantidade_movimentada') * F('preco_unitario'), output_field=Decimal)
    )['valor_total'] or Decimal('0.00')
    
    return total

def contabilizar_movimento_estoque(movimento_estoque, valor_total, usuario_criacao):
    """
    Cria os dois lançamentos contábeis (Débito e Crédito) para um Movimento de Estoque, 
    garantindo Partidas Dobradas.
    """
    
    tipo_movimento = movimento_estoque.tipo_movimento
    
    # Tenta obter as contas essenciais
    try:
        conta_estoque_acabado = ContasEssenciais.get_conta_by_codigo(ContasEssenciais.ESTOQUE_PRODUTO_ACABADO_COD)
        conta_insumos = ContasEssenciais.get_conta_by_codigo(ContasEssenciais.ESTOQUE_INSUMOS_COD)
        conta_custo_andamento = ContasEssenciais.get_conta_by_codigo(ContasEssenciais.CUSTO_PRODUCAO_ANDAMENTO_COD)
    except ValueError as e:
        # Re-raise para forçar rollback se alguma conta essencial estiver faltando
        raise e

    if tipo_movimento == 'ENTRADA_PRODUCAO':
        # Entrada de Produto Acabado (Lógica 4)
        # Débito: Ativo (Estoque Produto Acabado) - Aumento de Ativo
        # Crédito: Custos (Custos de Produção em Andamento) - Transferência/Redução de Custos
        
        # 1. Lançamento de DÉBITO (Aumenta o Ativo - Estoque)
        LancamentoContabil.objects.create(
            data_lancamento=timezone.now(),
            valor=valor_total,
            tipo_movimento=LancamentoContabil.TipoMovimento.DEBITO,
            plano_conta=conta_estoque_acabado,
            descricao=f"DÉBITO: Entrada de Produto Acabado. Ref: ME-{movimento_estoque.pk}",
            usuario_criacao=usuario_criacao,
        )
        
        # 2. Lançamento de CRÉDITO (Reduz a conta de Custo em Andamento)
        LancamentoContabil.objects.create(
            data_lancamento=timezone.now(),
            valor=valor_total,
            tipo_movimento=LancamentoContabil.TipoMovimento.CREDITO,
            plano_conta=conta_custo_andamento,
            descricao=f"CRÉDITO: Custo de Produção (Transferência). Ref: ME-{movimento_estoque.pk}",
            usuario_criacao=usuario_criacao,
        )
        
    elif tipo_movimento == 'SAIDA_PRODUCAO':
        # Saída de Insumos (Lógica 3)
        # Débito: Custos (Custos de Produção em Andamento - Consumo) - Aumento de Custo
        # Crédito: Ativo (Estoque Insumos/Matéria Prima) - Redução de Ativo

        # 1. Lançamento de DÉBITO (Aumenta a conta de Custo em Andamento)
        LancamentoContabil.objects.create(
            data_lancamento=timezone.now(),
            valor=valor_total,
            tipo_movimento=LancamentoContabil.TipoMovimento.DEBITO,
            plano_conta=conta_custo_andamento,
            descricao=f"DÉBITO: Consumo de Insumos (Custo). Ref: ME-{movimento_estoque.pk}",
            usuario_criacao=usuario_criacao,
        )
        
        # 2. Lançamento de CRÉDITO (Reduz o Ativo - Estoque de Insumos)
        LancamentoContabil.objects.create(
            data_lancamento=timezone.now(),
            valor=valor_total,
            tipo_movimento=LancamentoContabil.TipoMovimento.CREDITO,
            plano_conta=conta_insumos,
            descricao=f"CRÉDITO: Baixa de Estoque de Insumos. Ref: ME-{movimento_estoque.pk}",
            usuario_criacao=usuario_criacao,
        )
        
    else:
        # Ignora outros tipos de movimento de estoque não relacionados à produção
        return

    print(f"Lançamentos contábeis (D/C) criados para Movimento Estoque #{movimento_estoque.pk}")


@receiver(post_save, sender=MovimentoEstoque)
def lancar_movimento_no_razao(sender, instance, created, **kwargs):
    """
    Dispara a contabilização do MovimentoEstoque (Lógica 6).
    """
    # Condição: O movimento foi criado E é um tipo de movimento de Produção
    
    if created and instance.tipo_movimento in ['ENTRADA_PRODUCAO', 'SAIDA_PRODUCAO']:
        
        # Obtém o usuário (assumindo que MovimentoEstoque.usuario é preenchido)
        usuario_criacao = instance.usuario if hasattr(instance, 'usuario') else User.objects.first()
        
        # O cálculo e a criação do Lançamento Contábil DEVE ocorrer dentro da transação atômica
        try:
            with transaction.atomic():
                # Calcula o valor monetário total da movimentação
                valor_total = get_valor_total_movimento(instance)
                
                if valor_total > Decimal('0.00'):
                    contabilizar_movimento_estoque(instance, valor_total, usuario_criacao)
                
        except (ValueError, Exception) as e:
            # Captura exceções (como conta não encontrada) e garante o Rollback.
            print(f"ERRO CRÍTICO (ROLLBACK FORÇADO): Falha ao contabilizar MovimentoEstoque #{instance.pk}: {e}")
            raise # Re-raise para garantir o rollback
