// src/controllers/VendaItemController.ts

import { Request, Response } from "express";
import { z } from "zod";
import VendaItemService from "../services/VendaItemService";

class VendaItemController {
  private service: VendaItemService;

  constructor() {
    this.service = new VendaItemService();
  }

  // R9: Validação de entrada com Zod para adicionar item
  private adicionarItemSchema = z.object({
    id_venda: z.number().int().positive(),
    id_produto: z.number().int().positive(),
    quantidade: z.number().positive(),
    colaborador_id: z.number().int().positive(),
  });

  /**
   * Adiciona um item a uma comanda/venda.
   * Rota: POST /vendas/itens
   */
  async store(req: Request, res: Response): Promise<Response> {
    try {
      // 1. Validação de entrada
      const payload = this.adicionarItemSchema.parse(req.body);

      // 2. Chamada ao Service
      const novoItem = await this.service.adicionarItem({
        ...payload,
      });

      // 3. Retorno de sucesso
      return res.status(201).json({
        message: "Item adicionado com sucesso!",
        item: novoItem,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Dados de entrada inválidos.",
          details: error.issues,
        });
      }

      console.error("❌ ERRO NO CONTROLLER AO ADICIONAR ITEM:", error);
      return res.status(500).json({
        error: "Erro ao adicionar item à venda.",
        details: (error as Error).message,
      });
    }
  }

  /**
   * Remove um item de uma comanda/venda.
   * Rota: DELETE /vendas/itens/:id_venda_item
   * 🔑 NOVO MÉTODO PARA CORRIGIR O ERRO TS2339
   */
  async destroy(req: Request, res: Response): Promise<Response> {
    const id_venda_item = parseInt(
      req.params.id_venda_item || req.params.id,
      10
    );
    if (isNaN(id_venda_item)) {
      return res.status(400).json({ error: "ID do Item de Venda inválido." });
    }

    try {
      // **TODO:** Implementar a lógica de remoção no VendaItemService
      // Essa lógica deve envolver:
      // 1. Reversão do Estoque (Baixa de Estoque precisa ser cancelada/revertida - R2)
      // 2. Atualização dos totais (valor_total e custo_total) na VendaComanda

      // Simulação de sucesso:
      // await this.service.removerItem(id_venda_item);

      return res.status(200).json({
        message: `Item de Venda ID ${id_venda_item} removido com sucesso (Lógica de Service pendente).`,
      });
    } catch (error) {
      console.error("❌ ERRO NO CONTROLLER AO REMOVER ITEM:", error);
      return res.status(500).json({
        error: "Erro ao remover item da venda.",
        details: (error as Error).message,
      });
    }
  }
}

export default new VendaItemController();
