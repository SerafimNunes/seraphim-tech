// src/controllers/EstoqueContagemController.ts (Refatorado para usar o Service)

import { Request, Response } from "express";
import { z } from "zod"; // 💡 Importa o Zod para validação
import { EstoqueContagemService } from "../services/EstoqueContagemService"; // 🔑 Importa o Service

class EstoqueContagemController {
  private contagemService: EstoqueContagemService;

  constructor() {
    // Inicializa o Service
    this.contagemService = new EstoqueContagemService();
  }

  // 💡 Define um schema de validação com Zod
  private contagemSchema = z.object({
    id_produto: z.number().int().positive(),
    estoque_contado: z.number().nonnegative(),
    colaborador_id: z.number().int().positive(),
  });

  /**
   * Registra uma nova Contagem Cega (Inventário Físico) de um produto.
   * Rota: POST /api/v1/contagem
   * @body { id_produto, estoque_contado, colaborador_id }
   */
  async store(req: Request, res: Response): Promise<Response> {
    try {
      // 1. 💡 Validação de Entrada robusta com Zod
      const payload = this.contagemSchema.parse(req.body);

      // 2. 🔑 CHAMADA AO SERVICE: Toda a lógica transacional e cálculo está aqui.
      const { produto, resultado_auditoria } =
        await this.contagemService.registrarContagem({
          id_produto: payload.id_produto,
          estoque_contado: payload.estoque_contado,
          colaborador_id: payload.colaborador_id,
        });

      // 3. Retorno de Sucesso
      return res.status(201).json({
        message: `Contagem cega de ${produto.nome} registrada e estoque ajustado.`,
        resultado_auditoria: resultado_auditoria,
      });
    } catch (error) {
      // Se o erro for do Zod, retorna um erro 400 (Bad Request)
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({
            error: "Dados de entrada inválidos.",
            details: error.issues,
          });
      }

      console.error("❌ ERRO NA TRANSAÇÃO DE CONTAGEM CEGA:", error);
      // O 'error as Error' é necessário para garantir a tipagem
      return res.status(500).json({
        error: "Erro ao registrar contagem de estoque.",
        details: (error as Error).message,
      });
    }
  }
}

export default new EstoqueContagemController();
