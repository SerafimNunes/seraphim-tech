// src/controllers/VendaItemController.ts
import { Request, Response } from 'express';
import { z } from 'zod';
import VendaItemService, {
  VendaFechadaError,
  ProdutoInvalidoError,
  EstoqueInsuficienteError,
  VendaItemNaoEncontradoError,
} from '../services/VendaItemService';

class VendaItemController {
  private service: VendaItemService;

  constructor() {
    this.service = new VendaItemService();
  }

  private adicionarItemSchema = z.object({
    id_venda: z.number().int().positive(),
    id_produto: z.number().int().positive(),
    quantidade: z.number().positive(),
    colaborador_id: z.number().int().positive(),
  });

  private removerItemSchema = z.object({
    colaborador_id: z.number().int().positive(),
  });

  async store(req: Request, res: Response): Promise<Response> {
    try {
      const payload = this.adicionarItemSchema.parse(req.body);
      const novoItem = await this.service.adicionarItem({ ...payload });
      return res
        .status(201)
        .json({ message: 'Item adicionado com sucesso!', item: novoItem });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({
            error: 'Dados de entrada inválidos.',
            details: error.issues,
          });
      }
      if (error instanceof EstoqueInsuficienteError) {
        return res
          .status(409)
          .json({ error: 'Estoque Insuficiente.', details: error.message });
      }
      if (error instanceof VendaFechadaError) {
        return res
          .status(409)
          .json({ error: 'Operação Inválida.', details: error.message });
      }
      if (error instanceof ProdutoInvalidoError) {
        return res
          .status(422)
          .json({ error: 'Produto Inválido.', details: error.message });
      }
      console.error('❌ ERRO INTERNO NO CONTROLLER AO ADICIONAR ITEM:', error);
      return res
        .status(500)
        .json({
          error: 'Erro interno ao adicionar item à venda.',
          details: (error as Error).message,
        });
    }
  }

  async destroy(req: Request, res: Response): Promise<Response> {
    const id_venda_item = parseInt(
      req.params.id_venda_item || req.params.id,
      10,
    );
    if (isNaN(id_venda_item))
      return res.status(400).json({ error: 'ID do Item de Venda inválido.' });

    try {
      const payload = this.removerItemSchema.parse(req.body);
      await this.service.removerItem({
        id_venda_item,
        colaborador_id: payload.colaborador_id,
      });
      return res
        .status(200)
        .json({
          message: `Item de Venda ID ${id_venda_item} removido com sucesso.`,
        });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({
            error: 'Dados de entrada inválidos. Colaborador ID é obrigatório.',
            details: error.issues,
          });
      }
      if (error instanceof VendaItemNaoEncontradoError) {
        return res
          .status(404)
          .json({
            error: 'Item de Venda Não Encontrado.',
            details: error.message,
          });
      }
      if (error instanceof VendaFechadaError) {
        return res
          .status(409)
          .json({ error: 'Operação Inválida.', details: error.message });
      }
      console.error('❌ ERRO NO CONTROLLER AO REMOVER ITEM:', error);
      return res
        .status(500)
        .json({
          error: 'Erro interno ao remover item da venda.',
          details: (error as Error).message,
        });
    }
  }
}

export default new VendaItemController();
