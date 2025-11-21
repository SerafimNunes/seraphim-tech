//CaixaController.ts
import { Request, Response } from 'express';
import CaixaService from '../services/CaixaService';
// 🔑 CORREÇÃO TS2304: Importação do serviço de lançamento
import LancamentoService from '../services/LancamentoService';

export class CaixaController {
  private service: CaixaService;

  constructor() {
    this.service = new CaixaService();
  } // ... (Outros métodos)
  /**
   * Abre um novo caixa para a unidade.
   * Rota: POST /caixa/abrir
   */

  public abrirCaixa = async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    try {
      const { colaborador_id_abertura, saldo_inicial } = req.body;
      const unidade_id = res.locals.unidade_id; // 🔑 R4: Extraído do token/sessão

      if (!colaborador_id_abertura || unidade_id === undefined) {
        return res
          .status(400)
          .json({ error: 'Dados incompletos para abertura do caixa.' });
      } // Verifica se já existe um caixa aberto para esta unidade (R4)

      const caixaAtivo = await this.service.getCaixaAtivo(unidade_id);
      if (caixaAtivo) {
        return res.status(409).json({
          error: `Já existe um caixa aberto (ID ${caixaAtivo.id_caixa}) para a Unidade ${unidade_id}.`,
        });
      }

      const novoCaixa = await this.service.abrirCaixa(
        colaborador_id_abertura,
        unidade_id, // 🔑 R4 CORRIGIDO: Passando unidade_id
        saldo_inicial,
      );

      return res.status(201).json(novoCaixa);
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  }; /**
   * Fecha o caixa ativo.
   * Rota: POST /caixa/fechar/:id_caixa
   */

  public fecharCaixa = async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    try {
      const id_caixa = parseInt(req.params.id_caixa, 10);
      const { colaborador_id_fechamento } = req.body;
      const unidade_id = res.locals.unidade_id; // 🔑 R4: Extraído do token/sessão

      if (!id_caixa || !colaborador_id_fechamento || unidade_id === undefined) {
        return res
          .status(400)
          .json({ error: 'Dados incompletos para fechamento do caixa.' });
      }

      const result = await this.service.fecharCaixa(
        id_caixa,
        colaborador_id_fechamento,
        unidade_id, // 🔑 R4 CORRIGIDO: Passando unidade_id
      );

      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  }; /**
   * Registra um lançamento (despesa, sangria, reforço) no caixa ativo.
   * Rota: POST /caixa/lancamento
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

      const lancamento = await new LancamentoService().registrarLancamento({
        ...payload,
        unidade_id: unidade_id, // 🔑 R4 CORRIGIDO: Injetando unidade_id
        colaborador_id: id_colaborador_logado,
      });

      return res.status(201).json(lancamento);
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  }; /**
   * Lista todos os caixas ativos da unidade.
   * Rota: GET /caixa/ativos
   */

  public listarCaixasAtivos = async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    try {
      const unidade_id = res.locals.unidade_id; // 🔑 R4: Extraído do token/sessão

      if (unidade_id === undefined) {
        return res.status(401).json({ error: 'Unidade não identificada.' });
      }

      const caixas = await this.service.listarCaixasAtivos(unidade_id); // 🔑 R4 CORRIGIDO: Passando unidade_id

      return res.status(200).json(caixas);
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  }; /**
   * Lista os movimentos (lançamentos) do caixa/unidade.
   * Rota: GET /caixa/movimentos
   */

  public listarMovimentos = async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    try {
      const filters = req.query;
      const unidade_id = res.locals.unidade_id; // 🔑 R4: Extraído do token/sessão

      if (unidade_id === undefined) {
        return res.status(401).json({ error: 'Unidade não identificada.' });
      }

      const movimentos = await this.service.listarMovimentos(
        unidade_id,
        filters,
      ); // 🔑 R4 CORRIGIDO: Passando unidade_id

      return res.status(200).json(movimentos);
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  };
}
