// src/services/VendaItemService.ts

import { Transaction } from "sequelize";
import { connection } from "../config/sequelize";
import VendaComanda from "../models/VendaComanda";
import VendaItem, { VendaItemCreationAttributes } from "../models/VendaItem";
import ItemEstoque, { ItemEstoqueModel } from "../models/ItemEstoque";
import { EstoqueService } from "./EstoqueService"; // Serviço de Estoque
import DecimalCtor from "decimal.js";
// 🔑 Importa o TipoMovimentoEstoque real do Model (fonte de verdade)
import { TipoMovimentoEstoque } from "../models/EstoqueRegistroMovimento";

// Erros de Domínio (Melhor Prática - Regra 1.C aprimorada)
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

// 🔑 NOVO ERRO: Para quando o item a ser removido não existe
class VendaItemNaoEncontradoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VendaItemNaoEncontradoError";
  }
}

export { VendaFechadaError, ProdutoInvalidoError, VendaItemNaoEncontradoError }; // Exporta os erros para o Controller

export interface AdicionarItemPayload {
  id_venda: number;
  id_produto: number;
  quantidade: number;
  colaborador_id: number;
}

// Interface para o payload de remoção (requer o ID do item e do colaborador para auditoria)
export interface RemoverItemPayload {
  id_venda_item: number;
  colaborador_id: number;
}

export default class VendaItemService {
  private estoqueService: EstoqueService;

  constructor() {
    // 1.A: Injeção de Dependência
    this.estoqueService = new EstoqueService();
  }

  public async adicionarItem(
    payload: AdicionarItemPayload
  ): Promise<VendaItem> {
    // 1.D: Inicia a transação
    const transaction: Transaction = await connection.transaction();

    try {
      const { id_venda, id_produto, quantidade } = payload;

      // 1. Validar a Venda e o Produto (Regra 1.F - Acesso a Model)
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
        lock: transaction.LOCK.UPDATE, // Lock na linha para garantir estoque
      })) as ItemEstoqueModel | null;

      if (!produto || !produto.is_vendavel) {
        throw new ProdutoInvalidoError(
          `Produto com ID ${id_produto} não encontrado ou não é vendável.`
        );
      }

      // 2. LÓGICA CRÍTICA: Realizar a baixa de estoque
      const { custo_saida } = await this.estoqueService.saidaEstoque(
        produto,
        quantidade,
        "SAIDA_VENDA",
        `Saída para Venda #${id_venda}`, // Observações
        `VENDA#${id_venda}`, // Referência do documento
        payload.colaborador_id,
        transaction
      );

      // 3. Preparar e Criar o VendaItem
      const precoVenda = new DecimalCtor(produto.preco_venda);
      const precoTotalItem = precoVenda.times(quantidade);

      const novoItemData: VendaItemCreationAttributes = {
        id_venda: id_venda,
        id_produto: id_produto,
        quantidade: quantidade,
        // TODO: colaborador_id deve vir da requisição/sessão
        preco_unitario: precoVenda.toNumber(),
        preco_venda_total: precoTotalItem.toNumber(),
        custo_total: custo_saida,
        status_item: "ABERTO",
      };

      const novoItem = await VendaItem.create(novoItemData, { transaction });

      // 4. Atualizar os totais da Venda (Comanda)
      const valorTotalAtual = new DecimalCtor(venda.valor_total);
      const custoTotalAtual = new DecimalCtor(venda.custo_total);

      await venda.update(
        {
          valor_total: valorTotalAtual.plus(precoTotalItem).toNumber(),
          custo_total: custoTotalAtual.plus(custo_saida).toNumber(),
        },
        { transaction }
      );

      // 5. Commit da transação
      await transaction.commit();

      return novoItem;
    } catch (error) {
      // 1.D: Rollback em caso de erro
      await transaction.rollback();
      console.error(
        "❌ ERRO AO ADICIONAR ITEM À VENDA:",
        (error as Error).message
      );

      throw error; // Propaga o erro (incluindo os customizados)
    }
  }

  /**
   * 🔑 NOVO MÉTODO: Remove um item de venda, revertendo o estoque e ajustando a comanda.
   * Este método é transacional.
   */
  public async removerItem(payload: RemoverItemPayload): Promise<void> {
    const { id_venda_item, colaborador_id } = payload;
    const transaction: Transaction = await connection.transaction();

    try {
      // 1. Encontrar e Bloquear o Item de Venda
      const itemParaRemover = await VendaItem.findByPk(id_venda_item, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!itemParaRemover) {
        throw new VendaItemNaoEncontradoError(
          `Item de Venda ID ${id_venda_item} não encontrado.`
        );
      }

      const id_venda = itemParaRemover.id_venda;
      const quantidadeRemovida = itemParaRemover.quantidade;
      const custoRemovido = new DecimalCtor(itemParaRemover.custo_total);
      const valorRemovido = new DecimalCtor(itemParaRemover.preco_venda_total);

      // 2. Encontrar e Bloquear a Venda Comanda
      const venda = await VendaComanda.findByPk(id_venda, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!venda || venda.status_venda !== "ABERTA") {
        throw new VendaFechadaError(
          `Venda com ID ${id_venda} não está aberta. Não é possível remover itens.`
        );
      }

      // 3. Reverter Estoque (ENTRADA)
      // Buscamos o item de estoque novamente (com lock)
      const produtoEstoque = (await ItemEstoque.findByPk(
        itemParaRemover.id_produto,
        {
          transaction,
          lock: transaction.LOCK.UPDATE,
        }
      )) as ItemEstoqueModel | null;

      if (!produtoEstoque) {
        throw new ProdutoInvalidoError(
          "Produto de estoque associado ao item não encontrado."
        );
      }

      // Calcula o custo unitário da devolução (CUSTO MÉDIO de quando foi vendido)
      const custoUnitarioReversao = custoRemovido
        .div(quantidadeRemovida)
        .toNumber();

      await this.estoqueService.entradaEstoque(
        produtoEstoque,
        quantidadeRemovida,
        custoUnitarioReversao,
        "AJUSTE_ENTRADA", // Tipo de movimento para devolução/remoção
        `Devolução de estoque por remoção do Item Venda #${id_venda_item} (Venda #${id_venda})`,
        `DEV_VENDA_ITEM#${id_venda_item}`, // Referência
        colaborador_id,
        transaction
      );

      // 4. Atualizar os totais da Venda (Comanda)
      const valorTotalAtual = new DecimalCtor(venda.valor_total);
      const custoTotalAtual = new DecimalCtor(venda.custo_total);

      await venda.update(
        {
          valor_total: valorTotalAtual.minus(valorRemovido).toNumber(),
          custo_total: custoTotalAtual.minus(custoRemovido).toNumber(),
        },
        { transaction }
      );

      // 5. Deletar o Item da Venda
      await itemParaRemover.destroy({ transaction });

      // 6. Commit
      await transaction.commit();
    } catch (error) {
      // 1.D: Rollback em caso de erro
      await transaction.rollback();
      console.error(
        `❌ ERRO AO REMOVER ITEM DE VENDA ID ${id_venda_item}:`,
        (error as Error).message
      );
      throw error; // Propaga o erro
    }
  }
}
