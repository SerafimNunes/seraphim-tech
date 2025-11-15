// src/controllers/VendaComandaController.ts

import { Request, Response } from "express";
import { z } from "zod";
import VendaComandaService from "../services/VendaComandaService";
import { VendaComandaAttributes } from "../models/VendaComanda";

// R9: Esquema de validação para Abrir Comanda
const abrirComandaSchema = z.object({
  colaborador_id_abertura: z
    .number()
    .int()
    .positive("ID do colaborador inválido."),
  id_mesa: z
    .number()
    .int()
    .positive("ID da mesa deve ser um número positivo.")
    .nullable()
    .default(null),
});

// R9: Esquema de validação para Fechar Comanda
const fecharComandaSchema = z.object({
  metodo_pagamento: z
    .string()
    .min(3, "Método de pagamento deve ter pelo menos 3 caracteres."),
  colaborador_id_fechamento: z
    .number()
    .int()
    .positive("ID do colaborador de fechamento inválido."),
  id_caixa: z.number().int().positive("ID do caixa deve ser positivo."),
});

class VendaComandaController {
  private service: VendaComandaService;

  constructor() {
    this.service = new VendaComandaService();
  }

  /**
   * Abre uma nova comanda/venda (Rota: POST /vendas/comandas)
   */
  public async abrirComanda(req: Request, res: Response): Promise<Response> {
    try {
      // R9: Validação de entrada
      const { colaborador_id_abertura, id_mesa } = abrirComandaSchema.parse(
        req.body
      );

      // 🔑 Correção do ERRO 1: payload agora só tem os campos necessários
      const novaVenda = await this.service.abrirComanda({
        colaborador_id_abertura,
        id_mesa,
      });

      return res.status(201).json({
        message: `Comanda ID ${novaVenda.id_venda} aberta com sucesso.`,
        venda: novaVenda,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Dados de abertura inválidos.",
          details: error.issues,
        });
      }
      return res.status(500).json({
        error: "Erro ao abrir a comanda.",
        details: (error as Error).message,
      });
    }
  }

  /**
   * Fecha uma comanda (Rota: PUT /vendas/comandas/:id_venda/fechar)
   */
  public async fecharComanda(req: Request, res: Response): Promise<Response> {
    const id_venda = parseInt(req.params.id_venda || req.params.id, 10);
    if (isNaN(id_venda)) {
      return res.status(400).json({ error: "ID da Comanda inválido." });
    }

    try {
      // R9: Validação de entrada
      const { metodo_pagamento, colaborador_id_fechamento, id_caixa } =
        fecharComandaSchema.parse(req.body);

      // 🔑 Correção do ERRO 2: Removido o argumento unidade_id
      const vendaFechada = await this.service.fecharComanda(
        id_venda,
        metodo_pagamento,
        colaborador_id_fechamento,
        id_caixa
      );

      return res.status(200).json({
        message: `Comanda ID ${id_venda} fechada e lançada no caixa ${id_caixa}.`,
        venda: vendaFechada,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Dados de fechamento inválidos.",
          details: error.issues,
        });
      }
      return res.status(500).json({
        error: "Erro ao fechar a comanda.",
        details: (error as Error).message,
      });
    }
  }

  /**
   * Busca comandas ativas (ABERTAS ou AGUARDANDO_PAGAMENTO)
   * Rota: GET /vendas/comandas/ativas
   */
  public async buscarComandasAtivas(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      // 🔑 Correção do ERRO 3: Chamada sem argumentos
      const comandas = await this.service.buscarComandasAtivas();

      return res.status(200).json(comandas);
    } catch (error) {
      console.error(
        "Erro ao listar comandas ativas:",
        (error as Error).message
      );
      return res
        .status(500)
        .json({ error: "Falha ao buscar comandas ativas." });
    }
  }

  /**
   * Busca o histórico de vendas (FECHADAS ou CANCELADAS)
   * Rota: GET /vendas/comandas/historico
   */
  public async buscarHistoricoVendas(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      // 🔑 Correção do ERRO 4: Chamada sem argumentos
      const historico = await this.service.buscarHistoricoVendas();

      return res.status(200).json(historico);
    } catch (error) {
      console.error(
        "Erro ao listar histórico de vendas:",
        (error as Error).message
      );
      return res
        .status(500)
        .json({ error: "Falha ao buscar histórico de vendas." });
    }
  }

  /**
   * Busca uma comanda específica pelo ID (show)
   * Rota: GET /vendas/comandas/:id_venda
   */
  public async buscarComandaPorId(
    req: Request,
    res: Response
  ): Promise<Response> {
    const id_venda = parseInt(req.params.id_venda || req.params.id, 10);
    if (isNaN(id_venda)) {
      return res.status(400).json({ error: "ID da Comanda inválido." });
    }

    try {
      // 🔑 Correção do ERRO 5: Chamada com apenas 1 argumento (id_venda)
      const comanda = await this.service.buscarComandaPorId(id_venda);

      if (!comanda) {
        return res
          .status(404)
          .json({ message: `Comanda ID ${id_venda} não encontrada.` });
      }

      return res.status(200).json(comanda);
    } catch (error) {
      console.error("Erro ao buscar comanda:", (error as Error).message);
      return res
        .status(500)
        .json({ error: "Falha ao buscar detalhes da comanda." });
    }
  }
}

export default new VendaComandaController();
