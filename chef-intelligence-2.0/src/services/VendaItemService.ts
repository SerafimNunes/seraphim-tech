// src/services/VendaItemService.ts

import { Transaction } from "sequelize";
import { connection } from "../config/sequelize";
import VendaComanda from "../models/VendaComanda";
import VendaItem, { VendaItemCreationAttributes } from "../models/VendaItem";
import ItemEstoque, { ItemEstoqueModel } from "../models/ItemEstoque";
import { EstoqueService } from "./EstoqueService"; // Importação mantida
import DecimalCtor from "decimal.js";

class VendaFechadaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VendaFechadaError";
  }
}

class ProdutoInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProdutoInvalidoError";
  }
}

export interface AdicionarItemPayload {
  id_venda: number;
  id_produto: number;
  quantidade: number;
  colaborador_id: number; // REMOVIDO: unidade_id
}

export default class VendaItemService {
  private estoqueService: EstoqueService;

  constructor() {
    this.estoqueService = new EstoqueService();
  }

  public async adicionarItem(
    payload: AdicionarItemPayload
  ): Promise<VendaItem> {
    const transaction: Transaction = await connection.transaction();

    try {
      const { id_venda, id_produto, quantidade } = payload; // R4 removida // 1. Validar a Venda e o Produto (Sem R4)

      const venda = await VendaComanda.findOne({
        where: { id_venda },
        transaction,
      });

      if (!venda || venda.status_venda !== "ABERTA") {
        throw new VendaFechadaError(
          `Venda com ID ${id_venda} não encontrada ou não está aberta.`
        );
      }

      const produto = (await ItemEstoque.findByPk(id_produto, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      })) as ItemEstoqueModel | null;

      if (!produto || !produto.is_vendavel) {
        throw new ProdutoInvalidoError(
          `Produto com ID ${id_produto} não encontrado ou não é vendável.`
        );
      } // 2. LÓGICA CRÍTICA: Realizar a baixa de estoque // 🔑 CORRIGIDO: Chamada agora usa 5 argumentos, resolvendo o erro 2554 do VSCode.

      const { custo_saida } = await this.estoqueService.saidaEstoque(
        produto,
        quantidade,
        `Saída para Venda #${id_venda}`,
        `VENDA#${id_venda}`,
        transaction
      ); // 3. Preparar e Criar o VendaItem

      const precoVenda = new DecimalCtor(produto.preco_venda);
      const precoTotalItem = precoVenda.times(quantidade);

      const novoItemData: VendaItemCreationAttributes = {
        id_venda: id_venda,
        id_produto: id_produto,
        quantidade: quantidade,
        preco_unitario: precoVenda.toNumber(),
        preco_venda_total: precoTotalItem.toNumber(),
        custo_total: custo_saida,
        status_item: "ABERTO",
      };

      const novoItem = await VendaItem.create(novoItemData, { transaction }); // 4. Atualizar os totais da Venda (Comanda)

      const valorTotalAtual = new DecimalCtor(venda.valor_total);
      const custoTotalAtual = new DecimalCtor(venda.custo_total);

      await venda.update(
        {
          valor_total: valorTotalAtual.plus(precoTotalItem).toNumber(),
          custo_total: custoTotalAtual.plus(custo_saida).toNumber(),
        },
        { transaction }
      ); // 5. Commit da transação

      await transaction.commit();

      return novoItem;
    } catch (error) {
      await transaction.rollback();
      console.error(
        "❌ ERRO AO ADICIONAR ITEM À VENDA:",
        (error as Error).message
      );

      throw error;
    }
  }
}
