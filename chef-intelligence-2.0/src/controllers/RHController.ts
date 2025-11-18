// src/controllers/RHController.ts

import { Request, Response } from "express";
import { RHService } from "../services/RHService";
import { EscalaService } from "../services/EscalaService";
import { StatusCodes } from "http-status-codes"; // Adicionado StatusCodes
import { z, ZodError } from "zod"; // Adicionado ZodError

// Tipos necessários (adicionados para garantir a coerência)
import {
  IPerfilIdeal,
  IHistoricoPerformance,
  IRegraColaborador,
  IColaboradorBase,
} from "../config/types"; // Importe seus tipos

// Schemas Zod (Exemplo para fins de tipagem)
const perfilIdealSchema = z.object({
  cargo_id: z.number().int().positive(),
  descricao: z.string().min(1),
  // ... outras propriedades
});

const performanceSchema = z.object({
  colaborador_id: z.number().int().positive(),
  data_avaliacao: z.string().date(),
  // ... outras propriedades
});

export class RHController {
  private rhService: RHService;
  private escalaService: EscalaService;

  // Regra 1.A: Construtor recebe e atribui as dependências
  constructor(
    rhServiceInstance: RHService,
    escalaServiceInstance: EscalaService
  ) {
    this.rhService = rhServiceInstance;
    this.escalaService = escalaServiceInstance;
  }

  async definirPerfilIdeal(req: Request, res: Response): Promise<Response> {
    try {
      // Regra 1.B: Validação Zod
      const perfil = perfilIdealSchema.parse(req.body) as IPerfilIdeal;

      // Regra 1.D/1.F: Delega ao Service
      await this.rhService.definirPerfilIdeal(perfil);

      // Regra 1.E: Resposta 201
      return res
        .status(StatusCodes.CREATED)
        .json({ message: "Perfil Ideal definido com sucesso." });
    } catch (error) {
      // Regra 1.C: Tratamento de Erros
      if (error instanceof ZodError) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "Erro de Validação: Dados de Perfil Ideal inválidos.",
          details: error.errors,
        });
      }
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: (error as Error).message || "Falha ao definir perfil ideal.",
      });
    }
  }

  async registrarPerformance(req: Request, res: Response): Promise<Response> {
    try {
      // Regra 1.B: Validação Zod
      const data = performanceSchema.parse(req.body) as IHistoricoPerformance;

      // Regra 1.D/1.F: Delega ao Service
      await this.rhService.registrarPerformance(data);

      // Regra 1.E: Resposta 201
      return res
        .status(StatusCodes.CREATED)
        .json({ message: "Performance registrada." });
    } catch (error) {
      // Regra 1.C: Tratamento de Erros
      if (error instanceof ZodError) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "Erro de Validação: Dados de Performance inválidos.",
          details: error.errors,
        });
      }
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: (error as Error).message || "Falha ao registrar performance.",
      });
    }
  }

  async gerarEscala(req: Request, res: Response): Promise<Response> {
    try {
      // Validação Zod simplificada (aqui pode ser mais complexa)
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

      // Regra 1.D/1.F: Delega ao Service
      const escalaSugerida = await this.escalaService.gerarEscalaOtimizada(
        demanda,
        regras,
        colaboradores
      );

      // Regra 1.E: Resposta 200
      return res.status(StatusCodes.OK).json({
        message: "Escala algorítmica sugerida com checagem R13 (Treinamento).",
        escala: escalaSugerida,
      });
    } catch (error) {
      // Regra 1.C: Tratamento de Erros
      if (error instanceof ZodError) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error:
            "Erro de Validação: Dados de entrada para geração de escala inválidos.",
          details: error.errors,
        });
      }
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: (error as Error).message || "Falha ao gerar escala.",
      });
    }
  }

  // Exemplo de aprovação (R12)
  async aprovarEscala(req: Request, res: Response): Promise<Response> {
    try {
      const escalaId = parseInt(req.params.id, 10);
      const gerenteId = z
        .object({ gerente_id: z.number().int().positive() })
        .parse(req.body).gerente_id;

      // Validação manual do ID
      if (isNaN(escalaId) || escalaId <= 0) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: "ID de escala inválido." });
      }

      // Regra 1.D/1.F: Delega ao Service
      const escalaAprovada = await this.escalaService.aprovarEscala(
        escalaId,
        gerenteId
      );

      // Regra 1.E: Resposta 200
      return res.status(StatusCodes.OK).json({
        message: "Escala aprovada com sucesso.",
        escala: escalaAprovada,
      });
    } catch (error) {
      // Regra 1.C: Tratamento de Erros
      if (error instanceof ZodError) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "Erro de Validação: ID do Gerente inválido.",
          details: error.errors,
        });
      }
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: (error as Error).message || "Falha ao aprovar escala.",
      });
    }
  }
}
