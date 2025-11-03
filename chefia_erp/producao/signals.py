# producao/signals.py

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db.models import Sum, F, DecimalField 
from django.db import transaction
from django.core.exceptions import ValidationError
from decimal import Decimal
from django.utils import timezone

# Importa modelos do próprio app 'producao'
from .models import (
    FichaTecnica, ItemFichaTecnica, OrdemProducao, 
    RequisicaoInsumo, ItemRequisicao
)

# Importa modelos do app 'estoque' para movimentação e custo
from estoque.models import Produto, MovimentoEstoque, ItemMovimentoEstoque

# IMPORTA MODELOS DO APP 'COMPRAS' PARA A LÓGICA 5 (Sugestão de Compras)
# Assume-se que 'fornecedor_principal' é um campo ForeignKey no modelo Produto, como inferido na Lógica 5
from compras.models import PedidoCompra, ItemPedidoCompra 


# =========================================================
# LÓGICA 1: CÁLCULO DE CUSTO NA FICHA TÉCNICA
# =========================================================

# Função de Recálculo Centralizada
def recalcular_custo_ficha_tecnica_mestre(ficha_tecnica):
    """Função centralizada para calcular e atualizar o custo total e unitário da FT."""
    
    # Recalcula o custo total da Ficha Técnica Mestre somando o custo parcial de cada item
    custo_total_calculado = ficha_tecnica.itens.aggregate( 
        total=Sum(F('custo_insumo'), output_field=DecimalField(decimal_places=4)) 
    )['total'] or Decimal('0.0000') 

    # Calcula o custo unitário
    rendimento = ficha_tecnica.rendimento_base
    if rendimento > Decimal('0.00'):
        custo_unitario_calculado = custo_total_calculado / rendimento
    else:
        custo_unitario_calculado = Decimal('0.0000')

    # Salva os resultados no modelo FichaTecnica
    # É CRÍTICO SALVAR O CUSTO UNITÁRIO PARA ATUALIZAR O PREÇO DE CUSTO DO PRODUTO (LÓGICA 4)
    if ficha_tecnica.custo_total != custo_total_calculado or ficha_tecnica.custo_unitario != custo_unitario_calculado:
        FichaTecnica.objects.filter(pk=ficha_tecnica.pk).update(
            custo_total=custo_total_calculado,
            custo_unitario=custo_unitario_calculado # Novo campo atualizado
        )


@receiver(post_save, sender=ItemFichaTecnica)
def calcular_custo_item_e_mestre(sender, instance, created, **kwargs):
    """
    1. Calcula o CUSTO PARCIAL (quantidade * preco_custo) e salva no ItemFichaTecnica.
    2. Recalcula o custo total da Ficha Técnica mestre.
    """
    # Proteção de transação para garantir que a consulta ao Produto seja estável
    with transaction.atomic():
        try:
            # Busca o insumo para obter o preco_custo mais atual (CMP)
            insumo = Produto.objects.select_for_update().only('preco_custo').get(pk=instance.insumo.pk)
        except Produto.DoesNotExist:
            return

        # 1. CÁLCULO DO CUSTO PARCIAL (com 4 casas decimais)
        preco_unitario_custo = insumo.preco_custo if insumo.preco_custo is not None else Decimal('0.0000')
        custo_parcial_calculado = instance.quantidade_necessaria * preco_unitario_custo
        
        # Verifica se o custo parcial mudou (ou se é a criação)
        if created or instance.custo_insumo != custo_parcial_calculado:
            
            # Salva o CUSTO PARCIAL no item, evitando disparar este signal (update é seguro)
            ItemFichaTecnica.objects.filter(pk=instance.pk).update(
                custo_insumo=custo_parcial_calculado
            )
            
            # Chama a função de recálculo do Mestre
            # O get() é seguro pois o update acima foi no mesmo atomic block.
            recalcular_custo_ficha_tecnica_mestre(FichaTecnica.objects.get(pk=instance.ficha_tecnica.pk))
        
    
@receiver(post_delete, sender=ItemFichaTecnica)
def recalcular_custo_apos_delete(sender, instance, **kwargs):
    """Garante que o custo total seja recalculado após a exclusão de um item."""
    if FichaTecnica.objects.filter(pk=instance.ficha_tecnica.pk).exists():
        recalcular_custo_ficha_tecnica_mestre(instance.ficha_tecnica)


# =========================================================
# LÓGICA 2 & 4: AUTOMATIZAÇÕES DA ORDEM DE PRODUÇÃO (OP)
# =========================================================

@receiver(post_save, sender=OrdemProducao)
def automatizacao_ordem_producao(sender, instance, created, **kwargs):
    """
    Gerencia: 
    - Geração da Requisição (na criação).
    - Entrada de Produto Acabado (na conclusão).
    - Geração de Sugestão de Compra (na criação).
    """
    
    # --- LÓGICA 2 & 5: Geração da Requisição e Sugestão de Compra (APENAS NA CRIAÇÃO) ---
    if created and instance.status == 'ABERTA':
        
        with transaction.atomic():
            # 2. Cria o cabeçalho da Requisição de Insumo
            requisicao = RequisicaoInsumo.objects.create(
                ordem_producao=instance,
                status='PENDENTE',
                responsavel=instance.responsavel
            )

            itens_ficha = instance.ficha_tecnica.itens.all()
            
            try:
                rendimento = instance.ficha_tecnica.rendimento_base
                if rendimento <= Decimal('0.000'):
                    # Não faz nada se o rendimento for zero
                    return 
                fator = instance.quantidade_a_produzir / rendimento
            except (ZeroDivisionError, TypeError):
                return 
                
            itens_requisicao_a_criar = []
            for item_ft in itens_ficha:
                quantidade_solicitada = item_ft.quantidade_necessaria * fator
                
                if quantidade_solicitada > Decimal('0.000'):
                    itens_requisicao_a_criar.append(
                        ItemRequisicao(
                            requisicao=requisicao,
                            insumo=item_ft.insumo,
                            quantidade_solicitada=quantidade_solicitada,
                            # Inicializa com 0.000 para ser preenchida na Lógica de Usabilidade (abaixo)
                            quantidade_atendida=Decimal('0.000'), 
                        )
                    )

            ItemRequisicao.objects.bulk_create(itens_requisicao_a_criar)
            
            # Atualiza o status da Ordem de Produção (para 'REQUISITANDO')
            OrdemProducao.objects.filter(pk=instance.pk).update(status='REQUISITANDO')
            
            # --- LÓGICA 5: Dispara a Sugestão de Compras ---
            gerar_sugestao_compra_apos_op(instance, requisicao)
        
    # --- LÓGICA 4: REGISTRO DA PRODUÇÃO CONCLUÍDA (APENAS NA CONCLUSÃO) ---
    elif not created and instance.status == 'CONCLUIDA':
        
        # Prevenção de duplicação: verifica se já existe um Movimento de Estoque para esta OP
        if instance.movimento_entrada_estoque is not None:
              return
        
        with transaction.atomic():
            
            ficha_tecnica = instance.ficha_tecnica
            produto_acabado = ficha_tecnica.produto_produzido
            quantidade_produzida = instance.quantidade_a_produzir
            
            # O custo_unitario já foi calculado e salvo na FT pela Lógica 1
            custo_unitario_real = ficha_tecnica.custo_unitario 

            if quantidade_produzida <= Decimal('0.000') or custo_unitario_real <= Decimal('0.0000'):
                 # Se o custo for zero ou a quantidade, não faz a entrada
                 return

            # 1. Cria o Movimento de Estoque (Entrada)
            movimento_estoque = MovimentoEstoque.objects.create(
                tipo_movimento='ENTRADA_PRODUCAO', 
                responsavel=instance.responsavel,
                observacoes=f"Entrada de produto final (Lote OP: {instance.pk}) - {produto_acabado.nome}",
                data_movimento=timezone.now(),
            )

            # 2. Cria o Item do Movimento de Estoque
            # ESTA CRIAÇÃO DISPARA O SIGNAL EM estoque/signals.py, que cuidará do saldo e CMP
            ItemMovimentoEstoque.objects.create(
                movimento=movimento_estoque,
                produto=produto_acabado,
                quantidade_movimentada=quantidade_produzida, 
                preco_unitario=custo_unitario_real # Passa o custo real da produção
            )
            
            # 3. Liga o Movimento de Entrada à Ordem de Produção
            OrdemProducao.objects.filter(pk=instance.pk).update(
                movimento_entrada_estoque=movimento_estoque
            )


# =========================================================
# LÓGICA 5 (1.6.1 e 1.6.5): AUTOMAÇÃO DE COMPRAS PÓS-OP
# =========================================================

def gerar_sugestao_compra_apos_op(ordem_producao, requisicao):
    """
    Analisa os insumos requisitados pela OP, verifica o estoque, e gera 
    uma sugestão de Pedido de Compra (em status de rascunho) se o saldo
    de insumos for insuficiente para atender a requisição.
    """
    
    # Dicionário para agrupar as necessidades por Fornecedor Principal
    necessidades_por_fornecedor = {}
    
    # 1. Processa todos os itens da Requisição gerada pela OP
    for item_requisicao in requisicao.itens_requisicao.all():
        insumo = item_requisicao.insumo
        quantidade_solicitada = item_requisicao.quantidade_solicitada
        
        # Evita consultas múltiplas ao DB
        insumo.refresh_from_db()
        estoque_atual = insumo.quantidade_atual
        
        # 2. Verifica a Necessidade de Compra
        if estoque_atual < quantidade_solicitada:
            quantidade_a_comprar = quantidade_solicitada - estoque_atual
            
            # 3. Encontra o Fornecedor Principal (assumindo que existe um campo FK 'fornecedor_principal' no Produto)
            # O Fornecedor deve estar importado (compras.models.Fornecedor)
            fornecedor_principal = getattr(insumo, 'fornecedor_principal', None) 

            if not fornecedor_principal:
                # Loga o alerta no console, não deve travar o fluxo
                print(f"ALERTA COMPRAS: Insumo '{insumo.nome}' precisa de {quantidade_a_comprar:.4f}, mas não tem Fornecedor Principal. Ignorado.")
                continue

            # 4. Agrupa as necessidades por Fornecedor
            if fornecedor_principal not in necessidades_por_fornecedor:
                necessidades_por_fornecedor[fornecedor_principal] = []
            
            necessidades_por_fornecedor[fornecedor_principal].append({
                'insumo': insumo,
                'quantidade': quantidade_a_comprar,
                'preco_sugerido': insumo.preco_custo # Sugere o último preço de custo/CMP
            })

    if not necessidades_por_fornecedor:
        return # Nenhuma compra necessária

    # 5. Cria os Pedidos de Compra (um por fornecedor)
    with transaction.atomic():
        for fornecedor, itens_a_comprar in necessidades_por_fornecedor.items():
            
            # Cria o cabeçalho do Pedido de Compra em status de RASCUNHO/SUGESTÃO
            # CORREÇÃO: Necessário garantir que o campo 'status' existe no PedidoCompra
            pedido_compra = PedidoCompra.objects.create(
                fornecedor=fornecedor,
                # STATUS_AGUARDANDO é o status inicial padrão (RASCUNHO_SUGESTAO não existe)
                status='AGUARDANDO', 
                # Assumindo que 'usuario_criacao' é o campo no PedidoCompra
                usuario_criacao=ordem_producao.responsavel,
                observacoes=f"SUGESTÃO AUTOMÁTICA (OP {ordem_producao.pk}): Reposição de insumos para produção do produto '{ordem_producao.ficha_tecnica.produto_produzido.nome}'.",
            )
            
            itens_pedido_a_criar = []
            for item in itens_a_comprar:
                # Cria os itens do Pedido de Compra
                itens_pedido_a_criar.append(
                    ItemPedidoCompra(
                        pedido_compra=pedido_compra,
                        produto=item['insumo'],
                        # CORREÇÃO: campo quantidade_pedida (no PedidoCompra)
                        quantidade_pedida=item['quantidade'],
                        # CORREÇÃO: campo preco_unitario_negociado (no ItemPedidoCompra)
                        preco_unitario_negociado=item['preco_sugerido'],
                    )
                )
            
            ItemPedidoCompra.objects.bulk_create(itens_pedido_a_criar)
            print(f"SUCESSO COMPRAS: Pedido de Compra Rascunho {pedido_compra.pk} gerado para {fornecedor.nome}.")
            
            
# =========================================================
# LÓGICA DE USABILIDADE: AUTO-PREENCHIMENTO
# =========================================================

@receiver(post_save, sender=ItemRequisicao)
def ajustar_quantidade_atendida_default(sender, instance, created, **kwargs):
    """
    Se Quantidade Atendida for deixada em zero ou nula (default),
    preenche automaticamente com a Quantidade Solicitada (100% atendimento).
    """
    # Usamos o update direto no QuerySet para garantir que não haja recursão.
    
    # É CRÍTICO desconectar e reconectar o signal para evitar loop de save
    post_save.disconnect(ajustar_quantidade_atendida_default, sender=ItemRequisicao)
    
    # 1. Busca o estado mais recente do item para garantir que a atualização não foi feita por outra operação.
    # O get é importante, pois 'instance' pode ter valores antigos.
    item_atual = ItemRequisicao.objects.get(pk=instance.pk)

    # 2. Verifica se a quantidade atendida está zero/nula E se a solicitada é maior que zero.
    if (item_atual.quantidade_atendida is None or item_atual.quantidade_atendida <= Decimal('0.000')) \
       and item_atual.quantidade_solicitada > Decimal('0.000'):
        
        # 3. Atualiza o campo com a quantidade solicitada
        ItemRequisicao.objects.filter(pk=item_atual.pk).update(
            quantidade_atendida=item_atual.quantidade_solicitada
        )
    
    post_save.connect(ajustar_quantidade_atendida_default, sender=ItemRequisicao)


# =========================================================
# LÓGICA 3: ATENDIMENTO DA REQUISIÇÃO (BAIXA DE ESTOQUE - SAÍDA)
# =========================================================

@receiver(post_save, sender=RequisicaoInsumo)
def atender_requisicao_e_baixar_estoque(sender, instance, created, **kwargs):
    """
    Quando uma Requisição de Insumo muda para o status de ATENDIDA,
    cria um MovimentoEstoque de SAÍDA e atualiza o estoque dos Produtos.
    """
    
    # Condição: Não é a criação E o status é 'ATENDIDA' E ainda não foi baixado (rastreamento)
    if not created and instance.status == 'ATENDIDA' and instance.movimento_saida_estoque is None: 
        
        try:
            with transaction.atomic():
                
                # 1. Cria o cabeçalho do Movimento de Estoque (Saída)
                movimento_estoque = MovimentoEstoque.objects.create(
                    tipo_movimento='SAIDA_PRODUCAO', 
                    responsavel=instance.responsavel,
                    observacoes=f"Saída para atender Requisição #{instance.pk} (OP: {instance.ordem_producao})",
                    data_movimento=timezone.now(),
                )

                itens_movimento_a_criar = []
                
                # 2. Processa cada Item da Requisição
                for item_requisicao in instance.itens_requisicao.all():
                    insumo = item_requisicao.insumo
                    quantidade_a_baixar = item_requisicao.quantidade_atendida
                    
                    if quantidade_a_baixar is None or quantidade_a_baixar <= Decimal('0.000'):
                        continue 

                    # 3. Bloqueia o objeto para concorrência segura e busca o preço de custo atual
                    # CRÍTICO: Usar select_for_update, mas apenas para buscar o preço de custo.
                    # O saldo será atualizado pelo signal do estoque.
                    insumo_atualizado = Produto.objects.select_for_update().get(pk=insumo.pk)

                    # 4. Verifica se há estoque suficiente
                    if insumo_atualizado.quantidade_atual < quantidade_a_baixar:
                        raise ValidationError(
                            f"Estoque insuficiente para o insumo '{insumo.nome}'. Necessário: {quantidade_a_baixar:.3f}, Atual: {insumo_atualizado.quantidade_atual:.3f}"
                        )
                    
                    # 5. Cria o Item do Movimento de Estoque (Log)
                    # ESTA CRIAÇÃO DISPARA O SIGNAL EM estoque/signals.py, que cuidará da baixa e do CMP.
                    itens_movimento_a_criar.append(
                        ItemMovimentoEstoque(
                            movimento=movimento_estoque,
                            produto=insumo,
                            quantidade_movimentada=quantidade_a_baixar, 
                            preco_unitario=insumo_atualizado.preco_custo # Usa o preço de custo atual (CMP)
                        )
                    )

                ItemMovimentoEstoque.objects.bulk_create(itens_movimento_a_criar)
                
                # 6. Atualiza o status da Ordem de Produção (para EM_PRODUCAO)
                ordem_producao = instance.ordem_producao
                OrdemProducao.objects.filter(pk=ordem_producao.pk).update(status='EM_PRODUCAO')
                
                # 7. Liga o Movimento de Saída à Requisição de Insumo
                RequisicaoInsumo.objects.filter(pk=instance.pk).update(
                    movimento_saida_estoque=movimento_estoque
                )
        
        except ValidationError as e:
            # Re-lança o ValidationError para que o Django Admin o capture e exiba.
            raise e
        except Exception as e:
            # Caso ocorra outro erro inesperado
            raise ValidationError(f"Erro inesperado ao atender requisição: {e}")
