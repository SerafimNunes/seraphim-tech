// src/controllers/FeedbackController.ts

import { Request, Response } from "express";
import { z } from "zod";
import { FeedbackService } from "../services/FeedbackService";

// R9: Validação
const feedbackCreationSchema = z.object({
  venda_comanda_id: z.number().int().positive(),
  nps: z.number().int().min(0).max(10),
  comentario: z.string().min(5),
  colaborador_id: z.number().int().positive(),
});

class FeedbackController {
  private service: FeedbackService;

  constructor() {
    this.service = new FeedbackService();
  }

  // POST /api/v1/feedback
  public async create(req: Request, res: Response): Promise<Response> {
    try {
      const payload = feedbackCreationSchema.parse(req.body);
      const novoFeedback = await this.service.createFeedback(payload);

      return res.status(201).json({
        message: "Feedback registrado. Rastreamento de qualidade iniciado.",
        feedback: novoFeedback,
      });
    } catch (error) {
      if (error instanceof z.ZodError)
        return res
          .status(400)
          .json({ error: "Dados inválidos.", details: error.issues });
      return res
        .status(500)
        .json({
          error: "Falha ao registrar feedback.",
          details: (error as Error).message,
        });
    }
  }

  // GET /api/v1/feedback/:id/rastreio
  public async rastrear(req: Request, res: Response): Promise<Response> {
    try {
      const id_feedback = parseInt(req.params.id, 10);
      const rastreio = await this.service.rastrearQualidade(id_feedback);
      return res.status(200).json(rastreio);
    } catch (error) {
      return res
        .status(404)
        .json({
          error: "Falha ao rastrear feedback.",
          details: (error as Error).message,
        });
    }
  }
}

export default new FeedbackController();
