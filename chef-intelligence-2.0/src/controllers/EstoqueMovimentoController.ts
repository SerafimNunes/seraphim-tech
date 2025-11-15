// src/controllers/EstoqueMovimentoController.ts (Refatorado de MovimentoController.js)

import { Request, Response } from "express";
import { WhereOptions } from "sequelize";
import EstoqueRegistroMovimento from "../models/EstoqueRegistroMovimento"; // Novo nome do Model
import ItemEstoque from "../models/ItemEstoque"; // Novo nome do Model

class EstoqueMovimentoController {
  /**
   * Lista o histórico de movimentos de estoque, com filtros opcionais.
   * Rota: GET /api/v1/movimentos
   * Query Params: id_produto (number), tipo_movimento (string - ENTRADA, SAIDA, etc.)
   */
  async index(req: Request, res: Response): Promise<Response> {
    // Query parameters são strings por padrão (Ex: req.query.id_produto é '1' ou undefined)
    const { id_produto, tipo_movimento } = req.query;

    // Cria o objeto WHERE para filtrar a consulta (tipado)
    const where: WhereOptions = {};

    if (id_produto) {
      // Conversão segura de id_produto para número
      const idProdutoNum = parseInt(id_produto as string, 10);
      if (isNaN(idProdutoNum)) {
        return res
          .status(400)
          .json({ error: "O id_produto fornecido é inválido." });
      }
      where.id_produto = idProdutoNum;
    }

    if (tipo_movimento && typeof tipo_movimento === "string") {
      // Filtra pelo tipo de movimento (ENTRADA, SAIDA, etc.)
      where.tipo_movimento = tipo_movimento.toUpperCase();
    }

    try {
      const movimentos = await EstoqueRegistroMovimento.findAll({
        where,
        // Inclui o nome do produto (Model ItemEstoque) para facilitar a leitura do relatório
        include: [
          {
            model: ItemEstoque,
            as: "produto",
            attributes: ["id_produto", "nome", "unidade_medida"],
          },
        ],
        // Ordena do mais recente para o mais antigo
        order: [["createdAt", "DESC"]],
      });

      return res.status(200).json(movimentos);
    } catch (error) {
      console.error("❌ ERRO AO LISTAR MOVIMENTOS:", error);
      return res.status(500).json({
        error: "Erro ao listar movimentos de estoque.",
        details: (error as Error).message,
      });
    }
  }
}

export default new EstoqueMovimentoController();
