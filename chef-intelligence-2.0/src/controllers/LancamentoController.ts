import { Request, Response } from 'express';
import LancamentoService from '../services/LancamentoService';

export class LancamentoController {
  private service: LancamentoService;

  constructor() {
    this.service = new LancamentoService();
  }

  /**
   * Registra um lançamento financeiro (Manual ou por integrações).
   * Rota: POST /lancamento
   */
  public registrarLancamento = async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    try {
      const id_colaborador_logado = res.locals.colaborador_id;
      const unidade_id = res.locals.unidade_id; // 🔑 R4: Extraído do token/sessão

      const payload = req.body;

      if (!id_colaborador_logado || unidade_id === undefined) {
        return res
          .status(401)
          .json({ error: 'Colaborador ou Unidade não identificados.' });
      }

      const lancamento = await this.service.registrarLancamento({
        ...payload,
        unidade_id: unidade_id, // 🔑 R4 CORRIGIDO: Injetando unidade_id
        colaborador_id: id_colaborador_logado,
        id_caixa: payload.id_caixa || null,
      });

      return res.status(201).json(lancamento);
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  };
}
