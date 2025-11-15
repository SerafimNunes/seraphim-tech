// src/controllers/ComprasPedidoController.ts

import { Request, Response } from "express";
import { z } from "zod";
import { ComprasPedidoService } from "../services/ComprasPedidoService"; // ✅ Import resolvido
import { StatusAprovacao } from "../models/ComprasPedido"; // ✅ Import resolvido
import { StatusQualidade } from "../models/ComprasItemPedido"; // ✅ Import resolvido

// R9: Esquemas de validação Zod
const recebimentoSchema = z.object({
  numero_documento: z.string().min(5),
  data_emissao: z.string().datetime(),
  imposto_simples: z.number().nonnegative().default(0),
  cst_cfop_padrao: z.string().length(4),
  observacoes_fisco: z.string().optional().nullable(),
  chave_acesso_nfe: z.string().length(44).optional().nullable(),
  itens_recebidos: z
    .array(
      z.object({
        id_item_pedido: z.number().int().positive(),
        quantidade_recebida: z.number().positive(),
        preco_custo_unitario_real: z.number().positive(),
        status_qualidade: z.enum([
          "PENDENTE",
          "APROVADO",
          "REPROVADO",
          "DEVOLVIDO",
        ]),
      })
    )
    .min(1, "A lista de itens recebidos não pode estar vazia."),
});

const cotacaoSchema = z.object({
  colaborador_id: z.number().int().positive(),
  itens: z
    .array(
      z.object({
        id_produto: z.number().int().positive(),
        quantidade: z.number().positive(),
      })
    )
    .min(1),
});

class ComprasPedidoController {
  private service: ComprasPedidoService;

  constructor() {
    this.service = new ComprasPedidoService();
  }

  async createQuotation(req: Request, res: Response): Promise<Response> {
    try {
      const payload = cotacaoSchema.parse(req.body);
      const pedidoCotacao = await this.service.createQuotation(
        payload.colaborador_id,
        payload.itens
      );

      return res.status(201).json({
        message: "Ciclo de Cotação iniciado com sucesso.",
        id_pedido: pedidoCotacao.id_pedido,
        status: pedidoCotacao.status_aprovacao,
      });
    } catch (error) {
      return res.status(500).json({ error: "Erro ao iniciar a Cotação." });
    }
  }

  async index(req: Request, res: Response): Promise<Response> {
    const pedidos = await this.service.index(req.query);
    return res.status(200).json(pedidos);
  }

  async suggestItemsBelowMin(req: Request, res: Response): Promise<Response> {
    const sugestoes = await this.service.suggestItemsBelowMin();
    return res.status(200).json(sugestoes);
  }

  async receberInsumos(req: Request, res: Response): Promise<Response> {
    const id_pedido = parseInt(req.params.id_pedido, 10);
    if (isNaN(id_pedido)) {
      return res.status(400).json({ error: "ID do Pedido inválido." });
    }

    try {
      const payload = recebimentoSchema.parse(req.body);
      const pedidoFinalizado = await this.service.receberInsumos(
        id_pedido,
        payload as any
      );

      return res.status(200).json({
        message: `Recebimento do Pedido ${id_pedido} FINALIZADO.`,
        pedido: pedidoFinalizado,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Dados de recebimento inválidos.",
          details: error.issues,
        });
      }
      return res.status(500).json({
        error: "Erro ao processar o recebimento de insumos.",
        details: (error as Error).message,
      });
    }
  }
}

export default new ComprasPedidoController();
