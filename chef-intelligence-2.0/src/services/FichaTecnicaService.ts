// src/services/FichaTecnicaService.ts

import { Transaction } from "sequelize";
import { connection } from "../config/sequelize";
import FichaTecnica, {
  FichaTecnicaCreationAttributes,
  FichaTecnicaModel,
} from "../models/FichaTecnica";
import ItemEstoque, { ItemEstoqueModel } from "../models/ItemEstoque"; // Novo nome para Produto
import Decimal from "decimal.js";

interface FichaTecnicaItemPayload extends FichaTecnicaCreationAttributes {} // Extende os atributos do model para o payload

export class FichaTecnicaService {
  /**
   * Função Auxiliar Crítica: Recalcula e atualiza o Custo Médio de Produção (CMP) do Produto Pai.
   * Deve ser chamada dentro de uma transação, mas a função encapsula seu próprio commit/rollback.
   * @param idProdutoPai O ID do produto final/pré-pronto cuja FT foi alterada.
   */
  public async recalcularCustoFichaTecnica(
    idProdutoPai: number,
    transaction?: Transaction
  ): Promise<number> {
    // 1. Busca todos os itens (insumos) da Ficha Técnica e os dados do ItemEstoque Filho (insumo)
    const composicao = await FichaTecnica.findAll({
      where: { id_produto_pai: idProdutoPai },
      include: [
        {
          model: ItemEstoque, // Novo Model
          as: "produto_filho", // A associação deve usar o alias 'produto_filho'
          attributes: ["preco_custo_unitario"], // Pega o custo atual do insumo em estoque
        },
      ],
      transaction, // Usa a transação externa se fornecida
    });

    let custoTotal = new Decimal(0);

    // 2. Calcula o custo total: SUM(quantidade_necessaria * preco_custo_unitario)
    for (const item of composicao) {
      const qtd = new Decimal(item.quantidade_necessaria as unknown as string);

      // Pega o custo médio do insumo que está no estoque (tabela ITEM_ESTOQUE)
      const custoInsumo = item.produto_filho?.preco_custo_unitario
        ? new Decimal(
            item.produto_filho.preco_custo_unitario as unknown as string
          )
        : new Decimal(0);

      custoTotal = custoTotal.plus(qtd.times(custoInsumo));
    }

    // 3. Atualiza o Custo Médio de Produção (CMP) no Produto Pai (ItemEstoque)
    const produtoPai = await ItemEstoque.findByPk(idProdutoPai, {
      transaction,
    });

    if (!produtoPai) {
      throw new Error(
        `Produto Pai (ID: ${idProdutoPai}) não encontrado para atualização de CMP.`
      );
    }

    await produtoPai.update(
      {
        // CMP do Produto Pai é igual ao Custo Total da FT
        preco_custo_unitario: custoTotal.toNumber(),
      },
      { transaction }
    );

    return custoTotal.toNumber();
  }

  /**
   * Cria ou Substitui COMPLETAMENTE a Ficha Técnica de um Produto Pai.
   * @param idProdutoPai O ID do produto a ter a FT alterada.
   * @param novosItens Array de itens da nova Ficha Técnica.
   */
  public async storeOrUpdate(
    idProdutoPai: number,
    novosItens: FichaTecnicaItemPayload[]
  ): Promise<{ itens: FichaTecnicaModel[]; novoCusto: number }> {
    const transaction: Transaction = await connection.transaction();

    try {
      // 1. Validação: Checa se o produto pai existe e é um pré-pronto/vendável (opcional, mas bom)
      const produtoPai = await ItemEstoque.findByPk(idProdutoPai, {
        transaction,
      });
      if (!produtoPai) {
        throw new Error("Produto Pai não encontrado.");
      }

      // 2. Apaga todos os itens existentes da Ficha Técnica (Substituição Completa)
      await FichaTecnica.destroy({
        where: { id_produto_pai: idProdutoPai },
        transaction,
      });

      // 3. Cria os novos itens da Ficha Técnica
      const itensCriados = await FichaTecnica.bulkCreate(
        novosItens.map((item) => ({ ...item, id_produto_pai: idProdutoPai })),
        { transaction, validate: true }
      );

      // 4. Recalcula o Custo Médio de Produção (CMP)
      const novoCusto = await this.recalcularCustoFichaTecnica(
        idProdutoPai,
        transaction
      );

      await transaction.commit();

      return { itens: itensCriados, novoCusto };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Atualiza a quantidade de um item específico da Ficha Técnica e recalcula o CMP.
   */
  public async updateItemQuantidade(
    idItem: number,
    quantidade_necessaria: number
  ): Promise<{ item: FichaTecnicaModel; novoCusto: number }> {
    const transaction: Transaction = await connection.transaction();

    try {
      const item = await FichaTecnica.findByPk(idItem, { transaction });

      if (!item) {
        throw new Error("Item da Ficha Técnica não encontrado.");
      }

      await item.update({ quantidade_necessaria }, { transaction });

      // Recalcula o custo após a atualização
      const novoCusto = await this.recalcularCustoFichaTecnica(
        item.id_produto_pai,
        transaction
      );

      await transaction.commit();

      return { item, novoCusto };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Remove um item específico da Ficha Técnica e recalcula o CMP.
   */
  public async deleteItem(idItem: number): Promise<{
    id_removido: number;
    id_produto_pai: number;
    novoCusto: number;
  }> {
    const transaction: Transaction = await connection.transaction();

    try {
      const item = await FichaTecnica.findByPk(idItem, { transaction });

      if (!item) {
        throw new Error("Item da Ficha Técnica não encontrado.");
      }

      const idProdutoPai = item.id_produto_pai;

      await item.destroy({ transaction });

      // Recalcula o custo após a exclusão
      const novoCusto = await this.recalcularCustoFichaTecnica(
        idProdutoPai,
        transaction
      );

      await transaction.commit();

      return { id_removido: idItem, id_produto_pai: idProdutoPai, novoCusto };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Busca a Ficha Técnica de um Produto Pai.
   */
  public async findFichaTecnica(
    idProdutoPai: number
  ): Promise<FichaTecnicaModel[]> {
    // Não precisa de transação, é apenas leitura
    const composicao = await FichaTecnica.findAll({
      where: { id_produto_pai: idProdutoPai },
      include: [
        {
          model: ItemEstoque,
          as: "produto_filho",
          attributes: [
            "id_produto",
            "nome",
            "unidade_medida",
            "preco_custo_unitario",
          ],
        },
      ],
    });
    return composicao;
  }
}
