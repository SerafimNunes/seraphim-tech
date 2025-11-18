// src/controllers/EstoqueMovimentoController.ts (REFACTORADO)

import { Request, Response } from "express";
import { EstoqueMovimentoService } from "../services/EstoqueMovimentoService"; // 🔑 Importa o NOVO Service

// ❌ REMOVIDO: Controllers NUNCA devem importar Models (Regra 1.F)
// import EstoqueRegistroMovimento from "../models/EstoqueRegistroMovimento";
// import ItemEstoque from "../models/ItemEstoque";

class EstoqueMovimentoController {
  /**
   * 🔑 REGRA 1.A: Injeção de Dependência Simplificada.
   */
  constructor(private movimentoService: EstoqueMovimentoService) {}
  /**
   * Lista o histórico de movimentos de estoque, com filtros opcionais.
   */

  async index(req: Request, res: Response): Promise<Response> {
    // Query parameters são strings por padrão
    const { id_produto, tipo_movimento } = req.query;

    let idProdutoNum: number | undefined;
    if (id_produto) {
      // Conversão segura de id_produto para número
      const parsedId = parseInt(id_produto as string, 10);
      if (isNaN(parsedId)) {
        return res
          .status(400)
          .json({ error: "O id_produto fornecido é inválido." });
      }
      idProdutoNum = parsedId;
    }

    const tipoMovimentoStr =
      tipo_movimento && typeof tipo_movimento === "string"
        ? tipo_movimento.toUpperCase()
        : undefined;

    try {
      // 🔑 DELEGAÇÃO: O Controller chama o Service para buscar os dados.
      // Ele não sabe como a query é montada ou quais Models são usados.
      const movimentos = await this.movimentoService.listarMovimentos({
        id_produto: idProdutoNum,
        tipo_movimento: tipoMovimentoStr,
      });

      return res.status(200).json(movimentos);
    } catch (error) {
      // 🔑 REGRA 1.C: Tratamento de erros unificado.
      console.error("❌ ERRO NO CONTROLLER (index Movimento):", error);
      return res.status(500).json({
        error: "Erro interno do servidor ao listar movimentos de estoque.",
        details: (error as Error).message,
      });
    }
  }
}

// 🔑 REGRA 1.A: Instanciação e Injeção do NOVO Service na exportação.
// Note que precisamos criar o EstoqueMovimentoService
export default new EstoqueMovimentoController(new EstoqueMovimentoService());
