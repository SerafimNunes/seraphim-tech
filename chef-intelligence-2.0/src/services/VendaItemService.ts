// src/services/VendaItemService.ts
import { Transaction, Op } from 'sequelize';
import { connection } from '../config/sequelize';
import VendaComanda from '../models/VendaComanda';
import VendaItem, { VendaItemModel } from '../models/VendaItem';
import ItemEstoque, { ItemEstoqueModel } from '../models/ItemEstoque';
import { EstoqueService } from './EstoqueService';
import { FichaTecnicaService } from './FichaTecnicaService';
import DecimalCtor from 'decimal.js';
import { TipoMovimentoEstoque } from '../models/EstoqueRegistroMovimento';

// Erros de domínio
class VendaFechadaError extends Error {
  constructor(m: string) {
    super(m);
    this.name = 'VendaFechadaError';
  }
}
class ProdutoInvalidoError extends Error {
  constructor(m: string) {
    super(m);
    this.name = 'ProdutoInvalidoError';
  }
}
class EstoqueInsuficienteError extends Error {
  constructor(m: string) {
    super(m);
    this.name = 'EstoqueInsuficienteError';
  }
}
class VendaItemNaoEncontradoError extends Error {
  constructor(m: string) {
    super(m);
    this.name = 'VendaItemNaoEncontradoError';
  }
}

export {
  VendaFechadaError,
  ProdutoInvalidoError,
  EstoqueInsuficienteError,
  VendaItemNaoEncontradoError,
};

export interface AdicionarItemPayload {
  id_venda: number;
  id_produto: number;
  quantidade: number;
  colaborador_id: number;
}
export interface RemoverItemPayload {
  id_venda_item: number;
  colaborador_id: number;
}

export default class VendaItemService {
  private estoqueService: EstoqueService;
  private fichaTecnicaService: FichaTecnicaService;

  constructor() {
    this.estoqueService = new EstoqueService();
    this.fichaTecnicaService = new FichaTecnicaService();
  }

  private async realizarBaixaEstoque(
    idProdutoVendido: number,
    quantidadeVenda: number,
    idVenda: number,
    colaboradorId: number,
    unidadeId: number,
    transaction: Transaction,
  ): Promise<number> {
    const composicao = await this.fichaTecnicaService.findFichaTecnica(
      idProdutoVendido,
      unidadeId,
      transaction,
    );
    let custoTotalVenda = new DecimalCtor(0);

    if (!composicao || composicao.length === 0) {
      const produto = (await ItemEstoque.findOne({
        where: { id_item: idProdutoVendido, unidade_id: unidadeId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      })) as ItemEstoqueModel | null;
      if (!produto || !produto.is_vendavel)
        throw new ProdutoInvalidoError(
          `Produto ID ${idProdutoVendido} não encontrado ou não é vendável.`,
        );
      try {
        const { custo_saida } = await this.estoqueService.saidaEstoque(
          produto,
          quantidadeVenda,
          unidadeId,
          'SAIDA_VENDA' as TipoMovimentoEstoque,
          `Saída para Venda #${idVenda} (Produto sem FT)`,
          `VENDA#${idVenda}`,
          colaboradorId,
          transaction,
        );
        custoTotalVenda = custoTotalVenda.plus(custo_saida);
      } catch (err) {
        if ((err as Error).message.includes('Estoque insuficiente'))
          throw new EstoqueInsuficienteError((err as Error).message);
        throw err;
      }
    } else {
      for (const itemFT of composicao) {
        const qtd_a_abater = new DecimalCtor(quantidadeVenda)
          .times(itemFT.quantidade_necessaria)
          .toNumber();
        const id_materia_prima = itemFT.id_produto_filho;
        const insumo = (await ItemEstoque.findOne({
          where: { id_item: id_materia_prima, unidade_id: unidadeId },
          transaction,
          lock: transaction.LOCK.UPDATE,
        })) as ItemEstoqueModel | null;
        if (!insumo)
          throw new ProdutoInvalidoError(
            `Insumo ID ${id_materia_prima} da Ficha Técnica não encontrado.`,
          );
        try {
          const { custo_saida } = await this.estoqueService.saidaEstoque(
            insumo,
            qtd_a_abater,
            unidadeId,
            'CONSUMO_VENDA' as TipoMovimentoEstoque,
            `Consumo para Venda #${idVenda} (Insumo: ${insumo.nome})`,
            `VENDA#${idVenda}`,
            colaboradorId,
            transaction,
          );
          custoTotalVenda = custoTotalVenda.plus(custo_saida);
        } catch (err) {
          if ((err as Error).message.includes('Estoque insuficiente'))
            throw new EstoqueInsuficienteError(
              `Estoque insuficiente para o insumo ${insumo.nome} (ID: ${id_materia_prima}).`,
            );
          throw err;
        }
      }
    }

    return custoTotalVenda.toNumber();
  }

  private async reverterBaixaEstoque(
    itemParaRemover: VendaItemModel,
    idVenda: number,
    colaboradorId: number,
    unidadeId: number,
    transaction: Transaction,
  ): Promise<number> {
    const idProdutoRemovido = itemParaRemover.id_produto;
    const quantidadeRemovida = itemParaRemover.quantidade;
    const custoRemovidoTotal = new DecimalCtor(itemParaRemover.custo_total);
    const custoUnitarioReversao = custoRemovidoTotal
      .div(quantidadeRemovida)
      .toNumber();

    const composicao = await this.fichaTecnicaService.findFichaTecnica(
      idProdutoRemovido,
      unidadeId,
      transaction,
    );
    let custoTotalRevertido = new DecimalCtor(0);

    if (!composicao || composicao.length === 0) {
      const produto = (await ItemEstoque.findOne({
        where: { id_item: idProdutoRemovido, unidade_id: unidadeId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      })) as ItemEstoqueModel | null;
      if (!produto)
        throw new ProdutoInvalidoError(
          `Produto ID ${idProdutoRemovido} não encontrado.`,
        );
      await this.estoqueService.entradaEstoque(
        produto,
        quantidadeRemovida,
        custoUnitarioReversao,
        unidadeId,
        'AJUSTE_ENTRADA' as TipoMovimentoEstoque,
        `Devolução p/ remoção Item Venda #${itemParaRemover.id_item_venda}`,
        `DEV_VENDA_ITEM#${itemParaRemover.id_item_venda}`,
        colaboradorId,
        transaction,
      );
      custoTotalRevertido = custoTotalRevertido.plus(
        itemParaRemover.custo_total,
      );
    } else {
      for (const itemFT of composicao) {
        const qtd_a_reverter = new DecimalCtor(quantidadeRemovida)
          .times(itemFT.quantidade_necessaria)
          .toNumber();
        const id_materia_prima = itemFT.id_produto_filho;
        const insumo = (await ItemEstoque.findOne({
          where: { id_item: id_materia_prima, unidade_id: unidadeId },
          transaction,
          lock: transaction.LOCK.UPDATE,
        })) as ItemEstoqueModel | null;
        if (!insumo)
          throw new ProdutoInvalidoError(
            `Insumo ID ${id_materia_prima} da Ficha Técnica não encontrado.`,
          );
        const custoUnitarioInsumoAtual = new DecimalCtor(
          insumo.preco_custo_unitario,
        ).toNumber();
        await this.estoqueService.entradaEstoque(
          insumo,
          qtd_a_reverter,
          custoUnitarioInsumoAtual,
          unidadeId,
          'AJUSTE_ENTRADA' as TipoMovimentoEstoque,
          `Devolução consumo remoção Item Venda #${itemParaRemover.id_item_venda}`,
          `DEV_VENDA_ITEM#${itemParaRemover.id_item_venda}`,
          colaboradorId,
          transaction,
        );
        custoTotalRevertido = custoTotalRevertido.plus(custoRemovidoTotal);
        break;
      }
    }
    return custoTotalRevertido.toNumber();
  }

  public async adicionarItem(
    payload: AdicionarItemPayload,
  ): Promise<VendaItemModel> {
    const transaction: Transaction = await connection.transaction();
    try {
      const { id_venda, id_produto, quantidade, colaborador_id } = payload;
      const venda = await VendaComanda.findOne({
        where: { id_venda },
        transaction,
      });
      if (!venda || venda.status_venda !== 'ABERTA')
        throw new VendaFechadaError(
          `Venda com ID ${id_venda} não encontrada ou não está aberta.`,
        );
      const unidade_id = (venda as any).unidade_id;
      const produtoVendido = (await ItemEstoque.findOne({
        where: { id_item: id_produto, unidade_id },
        transaction,
      })) as ItemEstoqueModel | null;
      if (!produtoVendido || !produtoVendido.is_vendavel)
        throw new ProdutoInvalidoError(
          `Produto com ID ${id_produto} não encontrado ou não é vendável.`,
        );
      const custo_saida = await this.realizarBaixaEstoque(
        id_produto,
        quantidade,
        id_venda,
        colaborador_id,
        unidade_id,
        transaction,
      );
      const precoVenda = new DecimalCtor(produtoVendido.preco_venda);
      const precoTotalItem = precoVenda.times(quantidade);
      const novoItemData = {
        id_venda,
        id_produto,
        quantidade,
        preco_unitario: precoVenda.toNumber(),
        preco_venda_total: precoTotalItem.toNumber(),
        custo_total: custo_saida,
        status_item: 'ABERTO' as any,
        unidade_id,
      };
      const novoItem = await VendaItem.create(novoItemData as any, {
        transaction,
      });
      const valorTotalAtual = new DecimalCtor(venda.valor_total);
      const custoTotalAtual = new DecimalCtor(venda.custo_total);
      await venda.update(
        {
          valor_total: valorTotalAtual.plus(precoTotalItem).toNumber(),
          custo_total: custoTotalAtual.plus(custo_saida).toNumber(),
        },
        { transaction },
      );
      await transaction.commit();
      return novoItem as VendaItemModel;
    } catch (error) {
      await transaction.rollback();
      console.error(
        '❌ ERRO AO ADICIONAR ITEM À VENDA:',
        (error as Error).message,
      );
      throw error;
    }
  }

  public async removerItem(payload: RemoverItemPayload): Promise<void> {
    const { id_venda_item, colaborador_id } = payload;
    const transaction: Transaction = await connection.transaction();
    try {
      const itemParaRemover = (await VendaItem.findByPk(id_venda_item, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      })) as VendaItemModel | null;
      if (!itemParaRemover)
        throw new VendaItemNaoEncontradoError(
          `Item de Venda ID ${id_venda_item} não encontrado.`,
        );
      const unidade_id = (itemParaRemover as any).unidade_id;
      const id_venda = itemParaRemover.id_venda;
      const venda = await VendaComanda.findByPk(id_venda, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!venda || venda.status_venda !== 'ABERTA')
        throw new VendaFechadaError(
          `Venda com ID ${id_venda} não está aberta. Não é possível remover itens.`,
        );
      await this.reverterBaixaEstoque(
        itemParaRemover,
        id_venda,
        colaborador_id,
        unidade_id,
        transaction,
      );
      const valorTotalAtual = new DecimalCtor(venda.valor_total);
      const custoTotalAtual = new DecimalCtor(venda.custo_total);
      const valorRemovido = new DecimalCtor(itemParaRemover.preco_venda_total);
      const custoRemovido = new DecimalCtor(itemParaRemover.custo_total);
      await venda.update(
        {
          valor_total: valorTotalAtual.minus(valorRemovido).toNumber(),
          custo_total: custoTotalAtual.minus(custoRemovido).toNumber(),
        },
        { transaction },
      );
      await itemParaRemover.destroy({ transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error(
        `❌ ERRO AO REMOVER ITEM DE VENDA ID ${id_venda_item}:`,
        (error as Error).message,
      );
      throw error;
    }
  }
}
