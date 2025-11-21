// src/controllers/ContabilidadeController.ts

import { Request, Response } from "express";
import { z } from "zod";
import { ContabilidadeService } from "../services/ContabilidadeService";

const documentoSchema = z.object({
  mes: z.coerce.number().int().min(1).max(12),
  ano: z.coerce.number().int().min(2020),
});

class ContabilidadeController {
  private service: ContabilidadeService;

  constructor() {
    this.service = new ContabilidadeService();
  }

  // GET /api/v1/contabilidade/alerta-simples
  public async getAlertaSimples(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const unidade_id = (req as any).usuario.unidade_id; // R4: Filtro
      const alerta = await this.service.monitorarSimplesNacional({
        unidade_id,
      });
      return res.status(200).json(alerta);
    } catch (error) {
      return res.status(500).json({
        error: "Falha ao monitorar Simples Nacional.",
        details: (error as Error).message,
      });
    }
  }

  // GET /api/v1/contabilidade/documento-gerencial
  public async gerarDocumentoGerencial(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const unidade_id = (req as any).usuario.unidade_id; // R4: Filtro
      const { mes, ano } = documentoSchema.parse(req.query);

      const relatorio = await this.service.gerarDocumentoContabil({
        unidade_id,
        mes,
        ano,
      });

      return res.status(200).json({
        message: `Documento gerencial de ${mes}/${ano} gerado com sucesso.`,
        relatorio,
      });
    } catch (error) {
      if (error instanceof z.ZodError)
        return res
          .status(400)
          .json({ error: "Filtros de data inválidos.", details: error.issues });
      return res.status(500).json({
        error: "Falha ao gerar documento contábil.",
        details: (error as Error).message,
      });
    }
  }
}

export default new ContabilidadeController();
