// src/services/FeedbackService.ts

import Feedback, { FeedbackAttributes } from "../models/Feedback";

interface FeedbackCreationPayload {
  venda_comanda_id: number;
  nps: number;
  comentario: string;
  colaborador_id: number;
}

export class FeedbackService {
  /**
   * Cria um novo registro de feedback.
   */
  public async createFeedback(
    payload: FeedbackCreationPayload
  ): Promise<FeedbackAttributes> {
    const novoFeedback = await Feedback.create(payload);
    return novoFeedback.toJSON() as FeedbackAttributes;
  }

  /**
   * Rastreia um feedback negativo até o lote de produção (R7 - PDCA).
   */
  public async rastrearQualidade(feedbackId: number): Promise<any> {
    const feedback = await Feedback.findByPk(feedbackId);

    if (!feedback) throw new Error("Feedback não encontrado.");

    // 💡 Lógica para Rastreabilidade (R7):
    // 1. Buscar a VendaComanda (venda_comanda_id)
    // 2. Buscar o VendaItem da comanda (produto vendido)
    // 3. Cruzar o VendaItem com o EstoqueRegistroMovimento (rastreio de lote)
    // 4. Se for um produto de produção interna, buscar o ProducaoRegistro que gerou o lote.

    return {
      feedback: feedback.toJSON(),
      rastreamento: "PENDENTE: Simulação de rastreamento de causa raiz (R7).",
      lote_afetado: "PRD-20251116-005", // Mock de dados encontrados
    };
  }
}
