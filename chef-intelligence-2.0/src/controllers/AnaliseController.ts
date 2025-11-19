// src/controllers/AnaliseController.ts
// 🎯 Responsável por: 1.B Validação de Entrada (Zod), 1.C Tratamento de Erros, 1.E Resposta Padrão.

import { Request, Response } from 'express';
import { z } from 'zod';
import { AnaliseService } from '../services/AnaliseService'; // Importa a classe do Service

// 🔑 1.B: Esquema de validação para os filtros de KPI (query params)
const kpiSchema = z.object({
  data_inicio: z.string().datetime({ message: 'Data de início inválida.' }),
  data_fim: z.string().datetime({ message: 'Data de fim inválida.' }),
});

// Tipagem para a Requisição após o middleware de autenticação (R4/R12)
interface AuthRequest extends Request {
  usuario?: {
    id_usuario: number;
    unidade_id: number;
    // outros campos...
  };
}

class AnaliseController {
  private service: AnaliseService;

  // 🔑 1.A: Injeção de Dependência via construtor
  constructor() {
    this.service = new AnaliseService();
  }

  /**
   * Retorna um dashboard consolidado de KPIs financeiros (R3, R10, R12).
   * GET /api/v1/analise/financeiro?data_inicio=...&data_fim=...
   */
  public async getFinanceiroKPIs(
    req: AuthRequest,
    res: Response,
  ): Promise<Response> {
    try {
      // 1.B: Validação da entrada
      const { data_inicio, data_fim } = kpiSchema.parse(req.query);

      // 🔑 R4, R12: Filtro pela unidade do usuário logado (Regra 2.D)
      if (!req.usuario || !req.usuario.unidade_id) {
        return res
          .status(401)
          .json({
            error: 'Usuário não autenticado ou unidade não identificada.',
          });
      }
      const unidade_id = req.usuario.unidade_id;

      const filter = {
        unidade_id,
        data_inicio: new Date(data_inicio),
        data_fim: new Date(data_fim),
      };

      // 2. Orquestração da lógica de negócio
      const kpis = await this.service.getFinanceiroKPIs(filter);

      // 1.E: Resposta padronizada de sucesso
      return res.status(200).json({
        data_referencia: { inicio: data_inicio, fim: data_fim },
        financeiro: kpis,
      });
    } catch (error) {
      // 🔑 1.C: Tratamento de Erros
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Erro de validação nos filtros de data.',
          details: error.errors,
        });
      }

      console.error('Erro no Controller ao buscar KPIs financeiros:', error);
      // Erro não tratado -> 500 Internal Server Error
      return res.status(500).json({
        error: 'Erro interno do servidor ao processar a análise financeira.',
      });
    }
  }

  // 🔑 1.H: Associa os métodos à instância do Controller
  // Isso garante que o 'this' dentro do método seja a instância do Controller.
  public bindMethods() {
    this.getFinanceiroKPIs = this.getFinanceiroKPIs.bind(this);
    // ... outros métodos ...
  }
}

// 🔑 1.A: Exporta a instância única do Controller
const controller = new AnaliseController();
controller.bindMethods();
export default controller;
