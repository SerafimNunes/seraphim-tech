// src/controllers/AnaliseController.ts
import { Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { JwtPayload } from 'jsonwebtoken';
import { AnaliseService } from '../services/AnaliseService';

// Validação simples de datas
const kpiSchema = z.object({
  data_inicio: z.string(),
  data_fim: z.string(),
});

// Requisição autenticada
interface AuthPayload {
  id_usuario: number;
  unidade_id: number;
  id_cargo: number;
  nome_cargo: string;
  permissoes: string[];
}

interface AuthRequest extends Request {
  usuario?: AuthPayload;
}

export class AnaliseController {
  private service: AnaliseService;

  constructor() {
    this.service = new AnaliseService();
  }

  public async getFinanceiroKPIs(
    req: AuthRequest,
    res: Response,
  ): Promise<Response> {
    try {
      const { data_inicio, data_fim } = kpiSchema.parse(req.query);

      if (!req.usuario?.unidade_id)
        return res.status(401).json({
          error: 'Usuário não autenticado ou unidade não identificada.',
        });

      const filter = {
        unidade_id: req.usuario.unidade_id,
        data_inicio: new Date(data_inicio),
        data_fim: new Date(data_fim),
      };

      const kpis = await this.service.getFinanceiroKPIs(filter);

      return res.status(200).json({
        data_referencia: { inicio: data_inicio, fim: data_fim },
        financeiro: kpis,
      });
    } catch (error) {
      if (error instanceof ZodError)
        return res.status(400).json({
          error: 'Erro de validação nos filtros de data.',
          details: error.issues,
        });

      console.error('Erro no Controller ao buscar KPIs financeiros:', error);
      return res.status(500).json({
        error: 'Erro interno do servidor ao processar a análise financeira.',
      });
    }
  }

  public bindMethods() {
    this.getFinanceiroKPIs = this.getFinanceiroKPIs.bind(this);
  }
}

const controller = new AnaliseController();
controller.bindMethods();
export default controller;
