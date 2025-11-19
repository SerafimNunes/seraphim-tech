// src/services/EstoqueContagemService.ts (REFACTORADO PARA USAR ESTOQUE SERVICE)

import { Transaction, Sequelize } from "sequelize";
import { connection } from "../config/sequelize";
// 🔑 Importa o Service Centralizado de Estoque
import { EstoqueService, TipoMovimentoEstoque } from "./EstoqueService"; // 🔑 NOVO: Importa TipoMovimentoEstoque para tipagem correta
// 🔑 Mantém o import apenas para registro da contagem cega
import EstoqueRegistroContagem, {
  EstoqueRegistroContagemCreationAttributes,
} from "../models/EstoqueRegistroContagem";
import ItemEstoque, { ItemEstoqueModel } from "../models/ItemEstoque";
import Decimal from "decimal.js";

interface ContagemPayload {
  id_produto: number;
  estoque_contado: number;
  colaborador_id: number;
  observacoes?: string; // Adicionado para incluir na auditoria do movimento
}

export class EstoqueContagemService {
  private estoqueService: EstoqueService;
  /**
   * 🔑 REGRA 1.A: Injeção de Dependência do EstoqueService.
   */

  constructor(estoqueService = new EstoqueService()) {
    this.estoqueService = estoqueService;
  }
  /**
   * Registra uma nova Contagem Cega (Inventário Físico) e ajusta o estoque.
   * 🔑 Regra 1.D (Fluxo Transacional): A transação é iniciada e finalizada SOMENTE no Service.
   */

  public async registrarContagem(
    payload: ContagemPayload
  ): Promise<{ produto: ItemEstoqueModel; resultado_auditoria: any }> {
    const { id_produto, estoque_contado, colaborador_id, observacoes } =
      payload;

    let transaction: Transaction | null = null;

    try {
      // 1. INÍCIO DA TRANSAÇÃO ATÔMICA com SERIALIZABLE lock
      transaction = await connection.transaction({
        isolationLevel: (Sequelize as any).Transaction.ISOLATION_LEVELS
          .SERIALIZABLE,
      }); // 2. Busca o Produto com Lock de Atualização

      const produto = (await ItemEstoque.findByPk(id_produto, {
        attributes: [
          "id_produto",
          "nome",
          "estoque_atual",
          "preco_custo_unitario",
          "unidade_medida",
          "unidade_id", // 🔑 NOVO: Garante que o campo 'unidade_id' seja buscado.
        ],
        lock: transaction.LOCK.UPDATE,
        transaction,
      })) as ItemEstoqueModel | null;

      if (!produto) {
        throw new Error(`Produto com ID ${id_produto} não encontrado.`);
      } // --- 3. CÁLCULOS CRÍTICOS (Discrepância) ---

      const estoqueTeorico = new Decimal(
        produto.estoque_atual as unknown as string
      );
      const estoqueFisico = new Decimal(estoque_contado);
      const custoUnitario = new Decimal(
        produto.preco_custo_unitario as unknown as string
      );

      const discrepancia = estoqueFisico.minus(estoqueTeorico);
      const custoDiscrepancia = discrepancia.abs().times(custoUnitario);
      const tipoDiscrepancia = discrepancia.isNegative() ? "PERDA" : "SOBRA"; // -------------------------------------------- // 4. REGISTRA A CONTAGEM Cega (Auditoria do Processo)
      const registroData: EstoqueRegistroContagemCreationAttributes = {
        id_produto,
        estoque_contado: estoqueFisico.toNumber(),
        estoque_teorico_na_hora: estoqueTeorico.toNumber(),
        discrepancia: discrepancia.toNumber(),
        custo_discrepancia: custoDiscrepancia.toNumber(),
        colaborador_id,
        // 🔑 NOTA: Adicione a unidade_id aqui se o modelo EstoqueRegistroContagem a exigir.
      };
      await EstoqueRegistroContagem.create(registroData, { transaction }); // 5. 🔑 DELEGAÇÃO: AJUSTE DE ESTOQUE (Movimento)

      if (discrepancia.isZero()) {
        // Nenhuma alteração no estoque se a discrepância for zero.
        // O produto não precisa ser atualizado, apenas a contagem registrada.
      } else if (discrepancia.isPositive()) {
        // Ajuste de SOBERAS (ENTRADA)
        // 🔑 CORREÇÃO TS2339 (Linha 92): Adiciona o argumento 'unidadeId' (4º argumento)
        await this.estoqueService.entradaEstoque(
          produto,
          discrepancia.toNumber(), // Quantidade que entra
          custoUnitario.toNumber(), // CMP atual (custo da entrada é o CMP)
          produto.unidade_id, // 🔑 R4: Passando a unidade_id do produto
          "AJUSTE_SOBRA" as TipoMovimentoEstoque, // 🔑 CORRIGIDO: Tipagem
          observacoes || "Ajuste de estoque por contagem cega (SOBRA).",
          `Contagem ID: ${registroData.id_produto}`,
          colaborador_id,
          transaction // Passa a transação
        );
      } else {
        // Ajuste de PERDAS (SAÍDA)
        // 🔑 CORREÇÃO TS2339 (Linha 104): Adiciona o argumento 'unidadeId' (3º argumento)
        await this.estoqueService.saidaEstoque(
          produto,
          discrepancia.abs().toNumber(), // Quantidade que sai
          produto.unidade_id, // 🔑 R4: Passando a unidade_id do produto
          "AJUSTE_PERDA" as TipoMovimentoEstoque, // 🔑 CORRIGIDO: Tipagem
          observacoes || "Ajuste de estoque por contagem cega (PERDA).",
          `Contagem ID: ${registroData.id_produto}`,
          colaborador_id,
          transaction // Passa a transação
        );
      } // 6. Commit da Transação
      await transaction.commit(); // 7. Retorno dos dados para o Controller

      const produtoFinal = await this.findById(id_produto); // Busca o produto atualizado
      const resultado_auditoria = {
        discrepancia: `${discrepancia.abs().toFixed(3)} ${
          produto.unidade_medida
        } de ${tipoDiscrepancia}.`,
        ajuste_financeiro: `R$ ${custoDiscrepancia.toFixed(2)}`,
        estoque_atual_apos_ajuste: produtoFinal?.estoque_atual, // Retorna o valor final
      };

      return { produto: produtoFinal!, resultado_auditoria };
    } catch (error) {
      // 8. Rollback da Transação
      if (transaction) {
        await transaction.rollback();
      }
      throw error;
    }
  } // 🔑 Adicionado método findById (simples) para buscar o produto atualizado após o commit

  private async findById(id_produto: number): Promise<ItemEstoqueModel | null> {
    return ItemEstoque.findByPk(id_produto);
  }
}