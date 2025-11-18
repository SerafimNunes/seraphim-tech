// src/services/EstoqueMovimentoService.ts

import { Op } from "sequelize";
import EstoqueRegistroMovimento, {
  EstoqueRegistroMovimentoAttributes,
  EstoqueRegistroMovimentoCreationAttributes,
  TipoMovimentoEstoque, // Importa o tipo da Model
} from "../models/EstoqueRegistroMovimento";

// Tipagem para os filtros recebidos do Controller
export interface ListarMovimentosFilters {
  id_produto?: number;
  // O Controller garantiu que isso está em maiúsculas, mas ainda é uma string.
  // O tipo mais seguro é TipoMovimentoEstoque (que está na Model)
  tipo_movimento?: string;
}

export class EstoqueMovimentoService {
  /**
   * 🔑 REGRA 1.F: O Service implementa a lógica de busca e filtragem dos dados.
   * Lista o histórico de movimentos de estoque com base nos filtros fornecidos.
   */
  public async listarMovimentos(
    filters: ListarMovimentosFilters
  ): Promise<EstoqueRegistroMovimentoAttributes[]> {
    const whereClause: any = {};

    // 1. Filtro por ID do Produto
    if (filters.id_produto) {
      whereClause.id_produto = filters.id_produto;
    }

    // 2. Filtro por Tipo de Movimento
    if (filters.tipo_movimento) {
      // Faz o type cast para garantir que o tipo do banco seja respeitado.
      whereClause.tipo_movimento =
        filters.tipo_movimento as TipoMovimentoEstoque;
    }

    try {
      // Busca os registros de movimento aplicando os filtros
      const movimentos = await EstoqueRegistroMovimento.findAll({
        where: whereClause,
        // Adiciona a ordenação por data e ID para consistência
        order: [
          ["data_movimento", "DESC"],
          ["id_movimento", "DESC"],
        ],
        limit: 1000, // Limite padrão para evitar consultas massivas
      });

      // 🔑 REGRA 1.E: Retorna os dados prontos para o Controller
      return movimentos.map(
        (mov) => mov.toJSON() as EstoqueRegistroMovimentoAttributes
      );
    } catch (error) {
      console.error(
        "❌ Erro ao buscar movimentos de estoque no Service:",
        error
      );
      // Propaga o erro para que o Controller possa tratar
      throw new Error(
        "Falha ao consultar o histórico de movimentos de estoque."
      );
    }
  }

  /**
   * Método usado por outros Services (como VendaItemService) para registrar uma baixa ou entrada.
   * Este método DEVE ser chamado dentro de uma transação.
   */
  public async registrarMovimento(
    data: EstoqueRegistroMovimentoCreationAttributes,
    transaction: any // Transaction do Sequelize
  ): Promise<EstoqueRegistroMovimentoAttributes> {
    try {
      const novoRegistro = await EstoqueRegistroMovimento.create(data, {
        transaction,
      });
      return novoRegistro.toJSON() as EstoqueRegistroMovimentoAttributes;
    } catch (error) {
      console.error("❌ Erro ao registrar movimento de estoque:", error);
      throw new Error("Falha ao criar o registro de movimento de estoque.");
    }
  }
}
