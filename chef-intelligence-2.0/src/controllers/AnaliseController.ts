// src/controllers/AnaliseController.ts

import { Request, Response } from "express";
import { z } from "zod";
import { AnaliseService } from "../services/AnaliseService";

const kpiSchema = z.object({
  data_inicio: z.string().datetime(),
  data_fim: z.string().datetime(),
});

class AnaliseController {
  private service: AnaliseService;

  constructor() {
    this.service = new AnaliseService();
  }

  /**
   * Retorna um dashboard consolidado de KPIs financeiros.
   * GET /api/v1/analise/financeiro
   */
  public async getFinanceiroKPIs(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      // R4, R12: Filtro pela unidade do usuário logado
      const unidade_id = (req as any).usuario.unidade_id;
      const { data_inicio, data_fim } = kpiSchema.parse(req.query);

      const filter = {
        unidade_id,
        data_inicio: new Date(data_inicio),
        data_fim: new Date(data_fim),
      };

      const [cmv, mcmp] = await Promise.all([
        this.service.getCMVRealTime(filter),
        this.service.getMCMP(filter),
      ]);

      return res.status(200).json({
        data_referencia: { inicio: data_inicio, fim: data_fim },
        financeiro: {
          cmv_real_time: cmv,
          mcmp: mcmp,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError)
        return res
          .status(400)
          .json({ error: "Filtros inválidos.", details: error.issues });
      return res
        .status(500)
        .json({
          error: "Falha ao buscar KPIs financeiros.",
          details: (error as Error).message,
        });
    }
  }
}

export default new AnaliseController();
