# ==============================================================================
# ARQUIVO: financeiro/signals.py (NOVO - CRIAÇÃO NECESSÁRIA)
# Handler para Contabilização do Pagamento de Contas a Pagar (R6)
# ==============================================================================
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import ContasAPagar, StatusContasAPagar
from contabil.services import criar_lancamento_contabil as criar_lancamento_contabil_partida_dobrada # Serviço do app 'contabil'


@receiver(post_save, sender=ContasAPagar)
def contabilizar_pagamento_conta_a_pagar(sender, instance, created, **kwargs):
    """
    Dispara a contabilização quando uma Conta a Pagar atinge o status PAGO_TOTAL 
    e ainda não foi contabilizada.
    """
    
    # 1. Deve ser uma atualização (não a criação inicial)
    if created:
        return 

    # 2. Deve ter alcançado o status de pagamento total E não ter sido contabilizada ainda
    if instance.status == StatusContasAPagar.PAGO_TOTAL and not instance.contabilizado_pagamento:
        
        # Simula o lançamento contábil (Serviço de Terceiros/Integrado)
        criar_lancamento_contabil_partida_dobrada(
            referencia=f"Pagamento CP #{instance.pk}",
            valor=instance.valor_pago,
            conta_debito='Caixa/Banco',
            conta_credito='Contas a Pagar',
            origem=instance
        )
        
        # Marca a conta como contabilizada para evitar duplicação (Flag de Segurança)
        instance.contabilizado_pagamento = True
        # Desliga os signals temporariamente para salvar o flag sem loop infinito
        post_save.disconnect(contabilizar_pagamento_conta_a_pagar, sender=ContasAPagar)
        instance.save()
        post_save.connect(contabilizar_pagamento_conta_a_pagar, sender=ContasAPagar)