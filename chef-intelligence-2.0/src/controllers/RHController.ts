// src/controllers/RHController.ts

import { Request, Response } from "express";
import { RHService } from "../services/RHService";
import { EscalaService } from "../services/EscalaService";

// Tipos necessários (adicionados para garantir a coerência)
import {
  IPerfilIdeal,
  IHistoricoPerformance,
  IRegraColaborador,
  IColaboradorBase,
} from "../config/types";
import { z } from "zod";

// Schemas Zod (Exemplo para fins de tipagem)
const perfilIdealSchema = z.object({
  cargo_id: z.number().int().positive(),
  // ... outras propriedades
});

const performanceSchema = z.object({
  colaborador_id: z.number().int().positive(),
  // ... outras propriedades
});

export class RHController {
  private rhService: RHService;
  private escalaService: EscalaService;

  // ✅ CORREÇÃO TS2554 e TS2564: Construtor recebe e atribui as dependências
  constructor(
    rhServiceInstance: RHService,
    escalaServiceInstance: EscalaService
  ) {
    this.rhService = rhServiceInstance;
    this.escalaService = escalaServiceInstance;
  }

  async definirPerfilIdeal(req: Request, res: Response): Promise<Response> {
    try {
      const perfil = perfilIdealSchema.parse(req.body) as IPerfilIdeal;
      await this.rhService.definirPerfilIdeal(perfil);
      return res
        .status(201)
        .json({ message: "Perfil Ideal definido com sucesso." });
    } catch (error) {
      return res.status(500).json({ error: "Falha ao definir perfil ideal." });
    }
  }

  async registrarPerformance(req: Request, res: Response): Promise<Response> {
    try {
      const data = performanceSchema.parse(req.body) as IHistoricoPerformance;
      await this.rhService.registrarPerformance(data);
      return res.status(201).json({ message: "Performance registrada." });
    } catch (error) {
      return res.status(500).json({ error: "Falha ao registrar performance." });
    }
  }

  async gerarEscala(req: Request, res: Response): Promise<Response> {
    try {
      // Aqui você pode adicionar a validação Zod para os dados de escala
      const { demanda, regras, colaboradores } = req.body as {
        demanda: any;
        regras: IRegraColaborador[];
        colaboradores: IColaboradorBase[];
      };

      // ✅ CORREÇÃO TS2341: Acessa a funcionalidade do EscalaService DIRETAMENTE
      const escalaSugerida = await this.escalaService.gerarEscalaOtimizada(
        demanda,
        regras,
        colaboradores
      );

      return res.status(200).json({
        message: "Escala algorítmica sugerida com checagem R13 (Treinamento).",
        escala: escalaSugerida,
      });
    } catch (error) {
      return res.status(500).json({ error: "Falha ao gerar escala." });
    }
  }

  // Exemplo de aprovação (R12)
  async aprovarEscala(req: Request, res: Response): Promise<Response> {
    const escalaId = parseInt(req.params.id, 10);
    const gerenteId = req.body.gerente_id;

    // Supondo que aprovarEscala seja um método em EscalaService
    const escalaAprovada = await this.escalaService.aprovarEscala(
      escalaId,
      gerenteId
    );

    return res
      .status(200)
      .json({
        message: "Escala aprovada com sucesso.",
        escala: escalaAprovada,
      });
  }
}
