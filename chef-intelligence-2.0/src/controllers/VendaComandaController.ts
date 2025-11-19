import { Request, Response } from 'express';
import VendaComandaService from '../services/VendaComandaService';

export class VendaComandaController {
  private service: VendaComandaService;

  constructor() {
    this.service = new VendaComandaService();
  }

  /**
   * Abre uma nova comanda/venda (associada ou não a uma mesa).
   * Rota: POST /venda/abrir
   */
  public abrirComanda = async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    try {
      const colaborador_id_abertura = res.locals.colaborador_id;
      const unidade_id = res.locals.unidade_id; // 🔑 R4: Extraído do token/sessão
      const { id_mesa } = req.body;

      if (!colaborador_id_abertura || unidade_id === undefined) {
        return res
          .status(401)
          .json({ error: 'Colaborador ou Unidade não identificados.' });
      }

      const novaVenda = await this.service.abrirComanda({
        colaborador_id_abertura,
        id_mesa,
        unidade_id, // 🔑 R4 CORRIGIDO: Injetando unidade_id
      });

      return res.status(201).json(novaVenda);
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  };

  /**
   * Fecha uma comanda/venda ativa.
   * Rota: POST /venda/fechar
   */
  public fecharComanda = async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    try {
      const colaborador_id_fechamento = res.locals.colaborador_id;
      const unidade_id = res.locals.unidade_id; // 🔑 R4: Extraído do token/sessão
      const { id_venda, metodo_pagamento, id_caixa } = req.body;

      if (
        !id_venda ||
        !metodo_pagamento ||
        !id_caixa ||
        !colaborador_id_fechamento ||
        unidade_id === undefined
      ) {
        return res
          .status(400)
          .json({ error: 'Dados incompletos para fechamento da comanda.' });
      }

      // 🔑 R4 CORRIGIDO: Passando o objeto FecharComandaData completo
      const vendaFechada = await this.service.fecharComanda({
        id_venda,
        metodo_pagamento,
        colaborador_id_fechamento,
        id_caixa,
        unidade_id, // 🔑 R4 CORRIGIDO: Injetando unidade_id
      });

      return res.status(200).json(vendaFechada);
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  };

  /**
   * Lista todas as comandas/vendas ativas da unidade.
   * Rota: GET /venda/ativas
   */
  public buscarComandasAtivas = async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    try {
      const unidade_id = res.locals.unidade_id; // 🔑 R4: Extraído do token/sessão

      if (unidade_id === undefined) {
        return res.status(401).json({ error: 'Unidade não identificada.' });
      }

      const comandas = await this.service.buscarComandasAtivas(unidade_id); // 🔑 R4 CORRIGIDO: Passando unidade_id

      return res.status(200).json(comandas);
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  };

  /**
   * Lista o histórico de vendas fechadas da unidade.
   * Rota: GET /venda/historico
   */
  public buscarHistoricoVendas = async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    try {
      const unidade_id = res.locals.unidade_id; // 🔑 R4: Extraído do token/sessão

      if (unidade_id === undefined) {
        return res.status(401).json({ error: 'Unidade não identificada.' });
      }

      const historico = await this.service.buscarHistoricoVendas(unidade_id); // 🔑 R4 CORRIGIDO: Passando unidade_id

      return res.status(200).json(historico);
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  };

  /**
   * Busca uma comanda específica por ID.
   * Rota: GET /venda/:id_venda
   */
  public buscarComandaPorId = async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    try {
      const id_venda = parseInt(req.params.id_venda, 10);
      const unidade_id = res.locals.unidade_id; // 🔑 R4: Extraído do token/sessão

      if (!id_venda || unidade_id === undefined) {
        return res
          .status(400)
          .json({ error: 'ID da venda ou Unidade não fornecidos.' });
      }

      const comanda = await this.service.buscarComandaPorId(
        id_venda,
        unidade_id,
      ); // 🔑 R4 CORRIGIDO: Passando unidade_id

      if (!comanda) {
        return res.status(404).json({ error: 'Comanda não encontrada.' });
      }

      return res.status(200).json(comanda);
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  };
}
