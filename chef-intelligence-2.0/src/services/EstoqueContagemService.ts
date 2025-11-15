// src/services/EstoqueContagemService.ts

import { Transaction, Sequelize } from "sequelize";
import { connection } from "../config/sequelize";
import EstoqueRegistroContagem, {
  EstoqueRegistroContagemCreationAttributes,
} from "../models/EstoqueRegistroContagem";
import ItemEstoque, { ItemEstoqueModel } from "../models/ItemEstoque";
import Decimal from "decimal.js";

interface ContagemPayload {
  id_produto: number;
  estoque_contado: number;
  colaborador_id: number;
}

export class EstoqueContagemService {
  /**
   * Registra uma nova Contagem Cega (Inventário Físico) e ajusta o estoque.
   * Esta é uma operação atômica e crítica que usa SERIALIZABLE lock.
   */
  public async registrarContagem(
    payload: ContagemPayload
  ): Promise<{ produto: ItemEstoqueModel; resultado_auditoria: any }> {
    const { id_produto, estoque_contado, colaborador_id } = payload;

    // 🔑 INÍCIO DA TRANSAÇÃO ATÔMICA com SERIALIZABLE lock
    const transaction = await connection.transaction({
      isolationLevel: (Sequelize as any).Transaction.ISOLATION_LEVELS
        .SERIALIZABLE,
    });

    try {
      // 1. Busca o Produto com Lock de Atualização
      const produto = (await ItemEstoque.findByPk(id_produto, {
        attributes: [
          "id_produto",
          "nome",
          "estoque_atual",
          "preco_custo_unitario",
          "unidade_medida",
        ],
        lock: transaction.LOCK.UPDATE, // Garante que o estoque_atual não mude
        transaction,
      })) as ItemEstoqueModel | null;

      if (!produto) {
        throw new Error("Produto não encontrado.");
      }

      // --- 2. CÁLCULOS CRÍTICOS (Usando Decimal.js) ---
      const estoqueTeorico = new Decimal(
        produto.estoque_atual as unknown as string
      );
      const estoqueFisico = new Decimal(estoque_contado);
      const custoUnitario = new Decimal(
        produto.preco_custo_unitario as unknown as string
      );

      // Diferença: Contado - Teórico
      const discrepancia = estoqueFisico.minus(estoqueTeorico);

      // Custo da Discrepância: Diferença * Custo Unitário (usando .abs() para valor absoluto)
      const custoDiscrepancia = discrepancia.abs().times(custoUnitario);

      const tipoDiscrepancia = discrepancia.isNegative() ? "Perda" : "Sobra";

      // 3. REGISTRA A CONTAGEM (Auditoria)
      const registroData: EstoqueRegistroContagemCreationAttributes = {
        id_produto,
        estoque_contado: estoqueFisico.toNumber(),
        estoque_teorico_na_hora: estoqueTeorico.toNumber(),
        discrepancia: discrepancia.toNumber(),
        custo_discrepancia: custoDiscrepancia.toNumber(),
        colaborador_id,
      };

      await EstoqueRegistroContagem.create(registroData, { transaction });

      // 4. ATUALIZAÇÃO CRÍTICA DO ESTOQUE (Ajuste)
      // O estoque atual do produto é ajustado para o valor contado
      await produto.update(
        {
          estoque_atual: estoqueFisico.toNumber(),
        },
        { transaction }
      );

      // 5. Commit da Transação
      await transaction.commit();

      // 6. Retorno dos dados para o Controller
      const resultado_auditoria = {
        discrepancia: `${discrepancia.abs().toFixed(3)} ${
          produto.unidade_medida
        } de ${tipoDiscrepancia}.`,
        ajuste_financeiro: `R$ ${custoDiscrepancia.toFixed(2)}`,
        estoque_atual_apos_ajuste: estoqueFisico.toFixed(3),
      };

      return { produto, resultado_auditoria };
    } catch (error) {
      await transaction.rollback();
      // Lança o erro para o Controller
      throw error;
    }
  }
}
