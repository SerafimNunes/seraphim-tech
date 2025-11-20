// src/controllers/RHController.ts
import { Request, Response } from 'express';
import { RHService } from '../services/RHService';
import { EscalaService } from '../services/EscalaService';
import { StatusCodes } from 'http-status-codes';
import { z, ZodError } from 'zod';

import {
  IPerfilIdeal,
  IHistoricoPerformance,
  IRegraColaborador,
  IColaboradorBase,
} from '../config/types';

const perfilIdealSchema = z.object({
  cargo_id: z.number().int().positive(),
  competencia_id: z.number().int().positive(),
});

const performanceSchema = z.object({
  colaborador_id: z.number().int().positive(),
  erros_registrados: z.number().nonnegative(),
  desperdicio_total: z.number().nonnegative(),
});

export class RHController {
  private rhService: RHService;
  private escalaService: EscalaService;

  constructor(
    rhServiceInstance: RHService,
    escalaServiceInstance: EscalaService,
  ) {
    this.rhService = rhServiceInstance;
    this.escalaService = escalaServiceInstance;
  }

  async definirPerfilIdeal(req: Request, res: Response): Promise<Response> {
    try {
      const perfil = perfilIdealSchema.parse(req.body) as IPerfilIdeal;

      await this.rhService.definirPerfilIdeal(perfil);

      return res
        .status(StatusCodes.CREATED)
        .json({ message: 'Perfil Ideal definido com sucesso.' });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'Erro de Validação: Dados de Perfil Ideal inválidos.',
          details: error.issues,
        });
      }
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: (error as Error).message || 'Falha ao definir perfil ideal.',
      });
    }
  }

  async registrarPerformance(req: Request, res: Response): Promise<Response> {
    try {
      const data = performanceSchema.parse(req.body) as IHistoricoPerformance;

      await this.rhService.registrarPerformance(data);

      return res
        .status(StatusCodes.CREATED)
        .json({ message: 'Performance registrada.' });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'Erro de Validação: Dados de Performance inválidos.',
          details: error.issues,
        });
      }
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: (error as Error).message || 'Falha ao registrar performance.',
      });
    }
  }

  async gerarEscala(req: Request, res: Response): Promise<Response> {
    try {
      const { demanda, regras, colaboradores } = z
        .object({
          demanda: z.any(),
          regras: z.array(z.any()),
          colaboradores: z.array(z.any()),
        })
        .parse(req.body) as {
        demanda: any;
        regras: IRegraColaborador[];
        colaboradores: IColaboradorBase[];
      };

      const escalaSugerida = await this.escalaService.gerarEscalaOtimizada(
        demanda,
        regras,
        colaboradores,
      );

      return res.status(StatusCodes.OK).json({
        message: 'Escala algorítmica sugerida.',
        escala: escalaSugerida,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'Erro de Validação: Dados de entrada inválidos.',
          details: error.issues,
        });
      }
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: (error as Error).message || 'Falha ao gerar escala.',
      });
    }
  }

  async aprovarEscala(req: Request, res: Response): Promise<Response> {
    try {
      const escalaId = Number(req.params.id);

      const gerenteId = z
        .object({ gerente_id: z.number().int().positive() })
        .parse(req.body).gerente_id;

      if (!escalaId || escalaId <= 0) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: 'ID de escala inválido.' });
      }

      const escalaAprovada = await this.escalaService.aprovarEscala(
        escalaId,
        gerenteId,
      );

      return res.status(StatusCodes.OK).json({
        message: 'Escala aprovada com sucesso.',
        escala: escalaAprovada,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: 'Erro de Validação: ID do Gerente inválido.',
          details: error.issues,
        });
      }
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: (error as Error).message || 'Falha ao aprovar escala.',
      });
    }
  }
}
