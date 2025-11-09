# caixa/signals.py
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from decimal import Decimal

# Importações dos modelos
from .models import MovimentoCaixa
# Importação do Serviço Contábil
from contabil.services import criar_lancamento_contabil as criar_lancamento_contabil_partida_dobrada
# Configuração do Logger
logger = logging.getLogger(__name__)

# =========================================================================
# CONSTANTES DE CONTAS
# =========================================================================
# CONTAS DE FLUXO DE CAIXA
CONTA_CAIXA_GERAL = '1.1.0.1.0.1'        # Caixa Geral / Bancos (Ativo)
# Contrapartida para Suprimentos e Sangrias Avulsas
CONTA_AJUSTE_CAIXA = '4.1.0.3.0.1'       # Receitas/Ajustes Diversos (Receita)
CONTA_AJUSTE_DESPESA = '3.1.0.3.0.1'     # Despesas/Ajustes Diversos (Despesa)
# =========================================================================


# --- SIGNAL: Contabilização de Movimentos Avulsos de Caixa ---

@receiver(post_save, sender=MovimentoCaixa)
def contabilizar_movimento_caixa(sender, instance, created, **kwargs):
    """
    Cria o lançamento contábil para movimentos de caixa avulsos (Suprimento e Sangria).
    Vendas ('VENDA') são excluídas, pois são contabilizadas pelo signal de vendas/pagamentos
    para incluir CMV e Receita.
    """
    # Só processa se for criação (para evitar loops) E for um movimento AVULSO
    if created and instance.tipo in ['SUPRIMENTO', 'SANGRIA']:
        
        with transaction.atomic():
            valor = instance.valor
            historico = f"Movimento de Caixa Avulso - {instance.get_tipo_display()} N° {instance.pk} na Sessão {instance.sessao.pk}"
            
            # 1. Checagem de valor
            if valor <= Decimal('0.00'):
                logger.warning(f"Movimento de Caixa N° {instance.pk} ignorado: valor zero ou negativo.")
                return

            try:
                # 2. Movimento de SUPRIMENTO (ENTRADA no caixa)
                if instance.tipo == 'SUPRIMENTO':
                    # D: Caixa/Banco (Aumenta Ativo) | C: Ajuste/Receita Diversa (Aumenta Receita)
                    codigo_debito = CONTA_CAIXA_GERAL
                    codigo_credito = CONTA_AJUSTE_CAIXA
                    
                # 3. Movimento de SANGRIA (SAÍDA do caixa)
                elif instance.tipo == 'SANGRIA':
                    # D: Ajuste/Despesa Diversa (Aumenta Despesa) | C: Caixa/Banco (Diminui Ativo)
                    codigo_debito = CONTA_AJUSTE_DESPESA
                    codigo_credito = CONTA_CAIXA_GERAL
                
                else:
                    return # Não deve ser alcançado

                # 4. Executa o Lançamento Contábil
                criar_lancamento_contabil_partida_dobrada(
                    historico_transacao=historico,
                    valor=valor,
                    codigo_debito=codigo_debito,
                    codigo_credito=codigo_credito,
                    movimento_caixa=instance # Chave de rastreabilidade
                )
                
                logger.info(f"Movimento de Caixa N° {instance.pk} ({instance.get_tipo_display()}) contabilizado.")

            except Exception as e:
                logger.error(f"ERRO CRÍTICO ao contabilizar Movimento de Caixa {instance.pk}: {e}")
                # Rollback automático devido ao transaction.atomic
