import { Transaction } from 'sequelize';
import { connection } from '../config/sequelize';
import FichaTecnica, { FichaTecnicaModel } from '../models/FichaTecnica';
import ItemEstoque from '../models/ItemEstoque';
import Decimal from 'decimal.js';
// Assumindo que você importou as interfaces de Model do seu arquivo

// Extende os atributos do model para o payload
interface FichaTecnicaItemPayload {
  id_produto_filho: number;
  quantidade_necessaria: number;
}

export class FichaTecnicaService {
  /**
   * Função Auxiliar Crítica: Recalcula e atualiza o Custo Médio de Produção (CMP) do Produto Pai.
   */
  public async recalcularCustoFichaTecnica(
    idProdutoPai: number,
    transaction?: Transaction,
  ): Promise<number> {
    // 1. Busca todos os itens (insumos) da Ficha Técnica e os dados do ItemEstoque Filho (insumo)
    const composicao = await FichaTecnica.findAll({
      where: { id_produto_pai: idProdutoPai },
      include: [
        {
          model: ItemEstoque,
          as: 'produto_filho',
          attributes: ['preco_custo_unitario'],
        },
      ],
      transaction,
    });

    let custoTotal = new Decimal(0); // 🔑 FIX: Declaração e Inicialização de custoTotal // 2. Calcula o custo total: SUM(quantidade_necessaria * preco_custo_unitario)

    for (const item of composicao) {
      const qtd = new Decimal(item.quantidade_necessaria as unknown as string);

      const custoInsumo = item.produto_filho?.preco_custo_unitario
        ? new Decimal(
            item.produto_filho.preco_custo_unitario as unknown as string,
          )
        : new Decimal(0);

      custoTotal = custoTotal.plus(qtd.times(custoInsumo));
    } // 3. Atualiza o Custo Médio de Produção (CMP) no Produto Pai (ItemEstoque)

    const produtoPai = await ItemEstoque.findByPk(idProdutoPai, {
      transaction,
    });

    if (!produtoPai) {
      throw new Error(
        `Produto Pai (ID: ${idProdutoPai}) não encontrado para atualização de CMP.`,
      );
    }

    await produtoPai.update(
      { preco_custo_unitario: custoTotal.toNumber() }, // 🔑 FIX: custoTotal agora é reconhecido
      { transaction },
    );

    return custoTotal.toNumber(); // 🔑 FIX: custoTotal agora é reconhecido
  } // --- MÉTODOS DE NEGÓCIO ---
  /**
   * Cria ou Substitui COMPLETAMENTE a Ficha Técnica de um Produto Pai.
   */
  public async storeOrUpdate(
    idProdutoPai: number,
    novosItens: FichaTecnicaItemPayload[],
    unidadeId: number,
  ): Promise<{ itens: FichaTecnicaModel[]; novoCusto: number }> {
    // 🔑 2.C: Inicia a Transação
    const transaction: Transaction = await connection.transaction();

    try {
      // 🔑 2.D/R4: Validação: Checa se o produto pai existe E pertence à unidade
      const produtoPai = await ItemEstoque.findOne({
        where: { id_produto: idProdutoPai, unidade_id: unidadeId },
        transaction,
      });
      if (!produtoPai) {
        throw new Error(
          'Produto Pai não encontrado ou não pertence à sua unidade.',
        );
      } // 2. Apaga todos os itens existentes

      await FichaTecnica.destroy({
        where: { id_produto_pai: idProdutoPai },
        transaction,
      }); // 3. Cria os novos itens. Nota: Assumindo que o model FichaTecnica tem unidade_id

      const itensCriados = await FichaTecnica.bulkCreate(
        novosItens.map((item) => ({
          ...item,
          id_produto_pai: idProdutoPai,
          unidade_id: unidadeId,
        })),
        { transaction, validate: true },
      ); // 4. Recalcula o Custo Médio de Produção (CMP)

      const novoCusto = await this.recalcularCustoFichaTecnica(
        idProdutoPai,
        transaction,
      );

      await transaction.commit(); // 🔑 2.C: Commit
      return { itens: itensCriados, novoCusto };
    } catch (error) {
      await transaction.rollback(); // 🔑 2.C: Rollback
      throw error;
    }
  } /**
   * Atualiza a quantidade de um item específico da Ficha Técnica e recalcula o CMP.
   */
  public async updateItemQuantidade(
    idItem: number,
    quantidade_necessaria: number,
    unidadeId: number,
  ): Promise<{ item: FichaTecnicaModel; novoCusto: number }> {
    const transaction: Transaction = await connection.transaction();

    try {
      const item = await FichaTecnica.findByPk(idItem, { transaction }); // 🔑 2.D/R4: Validação da posse do item (o item deve ter a unidade_id)
      if (!item || (item as any).unidade_id !== unidadeId) {
        throw new Error(
          'Item da Ficha Técnica não encontrado ou não pertence à sua unidade.',
        );
      }

      await item.update({ quantidade_necessaria }, { transaction });

      const novoCusto = await this.recalcularCustoFichaTecnica(
        item.id_produto_pai,
        transaction,
      );

      await transaction.commit();
      return { item, novoCusto };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } /**
   * Remove um item específico da Ficha Técnica e recalcula o CMP.
   */
  public async deleteItem(
    idItem: number,
    unidadeId: number,
  ): Promise<{
    id_removido: number;
    id_produto_pai: number;
    novoCusto: number;
  }> {
    const transaction: Transaction = await connection.transaction();

    try {
      const item = await FichaTecnica.findByPk(idItem, { transaction }); // 🔑 2.D/R4: Validação da posse do item

      if (!item || (item as any).unidade_id !== unidadeId) {
        throw new Error(
          'Item da Ficha Técnica não encontrado ou não pertence à sua unidade.',
        );
      }

      const idProdutoPai = item.id_produto_pai;
      await item.destroy({ transaction });

      const novoCusto = await this.recalcularCustoFichaTecnica(
        idProdutoPai,
        transaction,
      );

      await transaction.commit();
      return { id_removido: idItem, id_produto_pai: idProdutoPai, novoCusto };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } /**
   * Busca a Ficha Técnica de um Produto Pai (READ).
   */
  public async findFichaTecnica(
    idProdutoPai: number,
    unidadeId: number,
    transaction?: Transaction, // 🔑 CORREÇÃO: Adiciona transação opcional
  ): Promise<FichaTecnicaModel[]> {
    // 🔑 2.D/R4: Primeiro, verifica a posse do produto pai (Produto Pai pertence à unidade?)
    const produtoPai = await ItemEstoque.findOne({
      where: { id_produto: idProdutoPai, unidade_id: unidadeId },
      transaction, // Adiciona transação aqui também
    });
    if (!produtoPai) {
      return [];
    } // Busca a composição (a FT está implicitamente isolada via id_produto_pai)

    const composicao = await FichaTecnica.findAll({
      where: { id_produto_pai: idProdutoPai },
      include: [
        {
          model: ItemEstoque,
          as: 'produto_filho',
          attributes: [
            'id_produto',
            'nome',
            'unidade_medida',
            'preco_custo_unitario',
          ],
        },
      ],
      transaction, // Adiciona transação aqui
    });
    return composicao;
  }
}
