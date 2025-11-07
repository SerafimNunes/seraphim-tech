'''producao/services.py'''
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

# Importa modelos de apps externos
from estoque.models import Produto, MovimentoEstoque, ItemMovimentoEstoque, CustoProduto
from compras.models import PedidoCompra, ItemPedidoCompra


# =========================================================
# LÓGICA 1: CÁLCULO DE CUSTO NA FICHA TÉCNICA
# =========================================================

def recalcular_custo_ficha_tecnica(ficha_tecnica: FichaTecnica):
    """Calcula e atualiza o custo total e unitário da FT Mestre."""
    
    # 1. Recalcula o custo total da Ficha Técnica Mestre somando o custo parcial de cada item
    custo_total_calculado = ficha_tecnica.itens.aggregate(
        total=Sum(F('custo_insumo'), output_field=DecimalField(decimal_places=4))
    )['total'] or Decimal('0.0000')

    # 2. Calcula o custo unitário
    rendimento = ficha_tecnica.rendimento_base
    if rendimento > Decimal('0.00'):
        custo_unitario_calculado = custo_total_calculado / rendimento
    else:
        custo_unitario_calculado = Decimal('0.0000')

    # 3. Salva os resultados no modelo FichaTecnica (apenas se houver mudança)
    if ficha_tecnica.custo_total != custo_total_calculado or ficha_tecnica.custo_unitario != custo_unitario_calculado:
        FichaTecnica.objects.filter(pk=ficha_tecnica.pk).update(
            custo_total=custo_total_calculado,
            custo_unitario=custo_unitario_calculado
        )


def calcular_e_atualizar_custo_item_ft(item_ficha: ItemFichaTecnica, ficha_tecnica: FichaTecnica):
    """
    1. Calcula o CUSTO PARCIAL e salva no ItemFichaTecnica.
    2. Dispara o recálculo do Mestre.
    """
    with transaction.atomic():
        try:
            # 🚨 R7: Acesso ao CMP via CustoProduto
            custo_produto = CustoProduto.objects.select_for_update().get(produto_id=item_ficha.insumo.pk)
            preco_unitario_custo = custo_produto.custo_medio_ponderado
        except CustoProduto.DoesNotExist:
            preco_unitario_custo = Decimal('0.0000')
        
        # 1. CÁLCULO DO CUSTO PARCIAL
        custo_parcial_calculado = item_ficha.quantidade_necessaria * preco_unitario_custo

        # 2. Salva o CUSTO PARCIAL (update é seguro contra recursão)
        if item_ficha.custo_insumo != custo_parcial_calculado:
            ItemFichaTecnica.objects.filter(pk=item_ficha.pk).update(
                custo_insumo=custo_parcial_calculado
            )

            # 3. Chama o recálculo do Mestre
            recalcular_custo_ficha_tecnica(ficha_tecnica)


# =========================================================
# LÓGICA 2 & 5: GERAÇÃO DE REQUISIÇÃO E SUGESTÃO DE COMPRA
# =========================================================

def criar_requisicao_e_sugestao_compra(ordem_producao: OrdemProducao):
    """
    Cria a Requisição de Insumos para a OP e dispara a sugestão de compra
    com base na necessidade e no saldo atual.
    """
    if ordem_producao.status != 'ABERTA':
        return # Executa apenas se a OP estiver recém-criada

    with transaction.atomic():
        # 1. Cria o cabeçalho da Requisição de Insumo
        requisicao = RequisicaoInsumo.objects.create(
            ordem_producao=ordem_producao,
            status='PENDENTE',
            responsavel=ordem_producao.responsavel
        )

        itens_ficha = ordem_producao.ficha_tecnica.itens.all()

        try:
            rendimento = ordem_producao.ficha_tecnica.rendimento_base
            if rendimento <= Decimal('0.000'):
                return
            fator = ordem_producao.quantidade_a_produzir / rendimento
        except (ZeroDivisionError, TypeError):
            return

        # 2. Cria os Itens da Requisição
        itens_requisicao_a_criar = []
        for item_ft in itens_ficha:
            quantidade_solicitada = item_ft.quantidade_necessaria * fator
            if quantidade_solicitada > Decimal('0.000'):
                itens_requisicao_a_criar.append(
                    ItemRequisicao(
                        requisicao=requisicao,
                        insumo=item_ft.insumo,
                        quantidade_solicitada=quantidade_solicitada,
                        quantidade_atendida=Decimal('0.000'),
                    )
                )
        
        ItemRequisicao.objects.bulk_create(itens_requisicao_a_criar)

        # 3. Atualiza o status da Ordem de Produção
        OrdemProducao.objects.filter(pk=ordem_producao.pk).update(status='REQUISITANDO')

        # 4. Dispara a Sugestão de Compras (LÓGICA 5)
        gerar_sugestao_compra_apos_op(ordem_producao, requisicao)
    
    return requisicao


def gerar_sugestao_compra_apos_op(ordem_producao: OrdemProducao, requisicao: RequisicaoInsumo):
    """
    Analisa os insumos da requisição, verifica o estoque e gera uma sugestão
    de Pedido de Compra (em status de rascunho) se o saldo for insuficiente.
    """
    necessidades_por_fornecedor = {}

    for item_requisicao in requisicao.itens_requisicao.all():
        insumo = item_requisicao.insumo
        quantidade_solicitada = item_requisicao.quantidade_solicitada

        # 🚨 R7: Acesso ao Saldo e CMP via CustoProduto
        try:
            custo_data = CustoProduto.objects.get(produto_id=insumo.pk)
            estoque_atual = custo_data.quantidade_atual
            preco_custo_sugerido = custo_data.custo_medio_ponderado
        except CustoProduto.DoesNotExist:
            estoque_atual = Decimal('0.000')
            preco_custo_sugerido = Decimal('0.0000')

        if estoque_atual < quantidade_solicitada:
            quantidade_a_comprar = quantidade_solicitada - estoque_atual
            fornecedor_principal = getattr(insumo, 'fornecedor_principal', None)

            if fornecedor_principal:
                if fornecedor_principal not in necessidades_por_fornecedor:
                    necessidades_por_fornecedor[fornecedor_principal] = []

                necessidades_por_fornecedor[fornecedor_principal].append({
                    'insumo': insumo,
                    'quantidade': quantidade_a_comprar,
                    'preco_sugerido': preco_custo_sugerido
                })

    if not necessidades_por_fornecedor:
        return

    with transaction.atomic():
        for fornecedor, itens_a_comprar in necessidades_por_fornecedor.items():
            pedido_compra = PedidoCompra.objects.create(
                fornecedor=fornecedor,
                status='AGUARDANDO',
                usuario_criacao=ordem_producao.responsavel,
                observacoes=f"SUGESTÃO AUTOMÁTICA (OP {ordem_producao.pk}): Reposição de insumos para produção do produto '{ordem_producao.ficha_tecnica.produto_produzido.nome}'.",
            )

            itens_pedido_a_criar = [
                ItemPedidoCompra(
                    pedido_compra=pedido_compra,
                    produto=item['insumo'],
                    quantidade_pedida=item['quantidade'],
                    preco_unitario_negociado=item['preco_sugerido'],
                )
                for item in itens_a_comprar
            ]
            ItemPedidoCompra.objects.bulk_create(itens_pedido_a_criar)


# =========================================================
# LÓGICA 4: REGISTRO DA PRODUÇÃO CONCLUÍDA (ENTRADA DE ESTOQUE)
# =========================================================

def registrar_entrada_producao_concluida(ordem_producao: OrdemProducao):
    """
    Registra o produto final no estoque após a conclusão da OP, usando
    o custo real da produção (CMP da FT).
    """
    if ordem_producao.movimento_entrada_estoque is not None:
        return # Já processado

    with transaction.atomic():
        ficha_tecnica = ordem_producao.ficha_tecnica
        produto_acabado = ficha_tecnica.produto_produzido
        quantidade_produzida = ordem_producao.quantidade_a_produzir
        custo_unitario_real = ficha_tecnica.custo_unitario

        if quantidade_produzida <= Decimal('0.000') or custo_unitario_real <= Decimal('0.0000'):
            return

        # 1. Cria o Movimento de Estoque (Entrada)
        movimento_estoque = MovimentoEstoque.objects.create(
            tipo_movimento='ENTRADA_PRODUCAO',
            responsavel=ordem_producao.responsavel,
            observacoes=f"Entrada de produto final (Lote OP: {ordem_producao.pk}) - {produto_acabado.nome}",
            data_movimento=timezone.now(),
        )

        # 2. Cria o Item do Movimento de Estoque (dispara signal em estoque/signals.py)
        ItemMovimentoEstoque.objects.create(
            movimento=movimento_estoque,
            produto=produto_acabado,
            quantidade_movimentada=quantidade_produzida,
            preco_unitario=custo_unitario_real # Custo da produção
        )

        # 3. Liga o Movimento de Entrada à Ordem de Produção
        OrdemProducao.objects.filter(pk=ordem_producao.pk).update(
            movimento_entrada_estoque=movimento_estoque
        )


# =========================================================
# LÓGICA 3: ATENDIMENTO DA REQUISIÇÃO (BAIXA DE ESTOQUE - SAÍDA)
# =========================================================

def processar_atendimento_e_saida_estoque(requisicao: RequisicaoInsumo):
    """
    Cria um MovimentoEstoque de SAÍDA para os insumos e atualiza o status da OP,
    após a requisição mudar para o status 'ATENDIDA'.
    """
    if requisicao.movimento_saida_estoque is not None:
        return # Já processado

    try:
        with transaction.atomic():
            # 1. Cria o cabeçalho do Movimento de Estoque (Saída)
            movimento_estoque = MovimentoEstoque.objects.create(
                tipo_movimento='SAIDA_PRODUCAO',
                responsavel=requisicao.responsavel,
                observacoes=f"Saída para atender Requisição #{requisicao.pk} (OP: {requisicao.ordem_producao})",
                data_movimento=timezone.now(),
            )

            itens_movimento_a_criar = []

            for item_requisicao in requisicao.itens_requisicao.all():
                insumo = item_requisicao.insumo
                quantidade_a_baixar = item_requisicao.quantidade_atendida

                if quantidade_a_baixar is None or quantidade_a_baixar <= Decimal('0.000'):
                    continue

                # 🚨 R7: Bloqueia o CustoProduto e busca CMP/Saldo
                try:
                    custo_data = CustoProduto.objects.select_for_update().get(produto_id=insumo.pk)
                except CustoProduto.DoesNotExist:
                    raise ValidationError(f"Dados de Custo/Estoque não encontrados para o insumo '{insumo.nome}'.")

                # 2. Verifica se há estoque suficiente
                if custo_data.quantidade_atual < quantidade_a_baixar:
                    raise ValidationError(
                        f"Estoque insuficiente para o insumo '{insumo.nome}'. Necessário: {quantidade_a_baixar:.3f}, Atual: {custo_data.quantidade_atual:.3f}"
                    )

                # 3. Cria o Item do Movimento de Estoque (Log)
                itens_movimento_a_criar.append(
                    ItemMovimentoEstoque(
                        movimento=movimento_estoque,
                        produto=insumo,
                        quantidade_movimentada=quantidade_a_baixar,
                        preco_unitario=custo_data.custo_medio_ponderado
                    )
                )

            ItemMovimentoEstoque.objects.bulk_create(itens_movimento_a_criar)

            # 4. Atualiza o status da Ordem de Produção (para EM_PRODUCAO)
            OrdemProducao.objects.filter(pk=requisicao.ordem_producao.pk).update(status='EM_PRODUCAO')

            # 5. Liga o Movimento de Saída à Requisição de Insumo
            RequisicaoInsumo.objects.filter(pk=requisicao.pk).update(
                movimento_saida_estoque=movimento_estoque
            )

    except ValidationError as e:
        raise e
    except Exception as e:
        raise ValidationError(f"Erro inesperado ao atender requisição: {e}")