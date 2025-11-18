// src/controllers/VendaItemController.ts (Refatorado com Regra 1.C Avançada)

import { Request, Response } from "express";
import { z } from "zod";
// 🔑 Importa o Service e os Erros de Domínio Customizados (incluindo o novo erro)
import VendaItemService, {
  VendaFechadaError,
  ProdutoInvalidoError,
  VendaItemNaoEncontradoError,
} from "../services/VendaItemService";

class VendaItemController {
  private service: VendaItemService; // 1.A: Injeção de Dependência (DI)

  constructor() {
    this.service = new VendaItemService();
  }

  // R9: Validação de entrada com Zod para adicionar item (Regra 1.B)
  private adicionarItemSchema = z.object({
    id_venda: z.number().int().positive(),
    id_produto: z.number().int().positive(),
    quantidade: z.number().positive(),
    colaborador_id: z.number().int().positive(),
  });

  // 🔑 NOVO SCHEMA: Validação de entrada para remover item (Requer colaborador_id)
  private removerItemSchema = z.object({
    colaborador_id: z.number().int().positive(),
  });

  /**
   * Adiciona um item a uma comanda/venda.
   * Rota: POST /vendas/itens
   */
  async store(req: Request, res: Response): Promise<Response> {
    try {
      // 1. Validação de entrada (Regra 1.B)
      const payload = this.adicionarItemSchema.parse(req.body);

      // 2. Chamada ao Service (Regra 1.F)
      const novoItem = await this.service.adicionarItem({
        ...payload,
      });

      // 3. Retorno de sucesso (Regra 1.E)
      return res.status(201).json({
        message: "Item adicionado com sucesso!",
        item: novoItem,
      });
    } catch (error) {
      // 1.C: Tratamento de Erros Avançado
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Dados de entrada inválidos.",
          details: error.issues,
        });
      }

      if (error instanceof VendaFechadaError) {
        // Erro de Negócio: Não pode adicionar item a uma venda fechada/inativa (409 Conflict)
        return res.status(409).json({
          error: "Operação Inválida.",
          details: error.message,
        });
      }

      if (error instanceof ProdutoInvalidoError) {
        // Erro de Negócio: Produto inexistente ou não vendável (422 Unprocessable Entity)
        return res.status(422).json({
          error: "Produto Inválido.",
          details: error.message,
        });
      }

      // 1.C: Erro Genérico (500)
      console.error("❌ ERRO INTERNO NO CONTROLLER AO ADICIONAR ITEM:", error);
      return res.status(500).json({
        error: "Erro interno ao adicionar item à venda.",
        details: (error as Error).message,
      });
    }
  }

  /**
   * Remove um item de uma comanda/venda.
   * Rota: DELETE /vendas/itens/:id_venda_item
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
      // 1. Validação de entrada (colaborador_id no body)
      const payload = this.removerItemSchema.parse(req.body);

      // 2. Chamada ao Service (Regra 1.F)
      await this.service.removerItem({
        id_venda_item,
        colaborador_id: payload.colaborador_id,
      });

      return res.status(200).json({
        message: `Item de Venda ID ${id_venda_item} removido com sucesso.`,
      });
    } catch (error) {
      // 1.C: Tratamento de Erros Avançado
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Dados de entrada inválidos. Colaborador ID é obrigatório.",
          details: error.issues,
        });
      }

      if (error instanceof VendaItemNaoEncontradoError) {
        // Erro de Negócio: Item não encontrado (404 Not Found)
        return res.status(404).json({
          error: "Item de Venda Não Encontrado.",
          details: error.message,
        });
      }

      if (error instanceof VendaFechadaError) {
        // Erro de Negócio: Venda Fechada (409 Conflict)
        return res.status(409).json({
          error: "Operação Inválida.",
          details: error.message,
        });
      }

      // 1.C: Erro Genérico (500)
      console.error("❌ ERRO NO CONTROLLER AO REMOVER ITEM:", error);
      return res.status(500).json({
        error: "Erro interno ao remover item da venda.",
        details: (error as Error).message,
      });
    }
  }
}

export default new VendaItemController();
