// backend/src/controllers/DashboardController.ts

import { Request, Response } from "express";
import { DashboardService } from "../services/DashboardService";
import { IModelFactory } from "../config/types";
import Joi from "joi"; // 🔑 Import default para compatibilidade

/**
 * Esquema de validação para os parâmetros de query da requisição GET.
 * 🔑 CORRIGIDO TS2304: O Schema Joi estava faltando no escopo.
 */
const dashboardSchema = Joi.object({
  unitId: Joi.string()
    .required()
    .pattern(/^[0-9]+$/)
    .messages({
      "any.required": "O parâmetro unitId é obrigatório (R4).",
      "string.pattern": "O unitId deve ser um número inteiro.",
    }),
  year: Joi.number()
    .integer()
    .min(2020)
    .max(new Date().getFullYear())
    .required()
    .messages({
      "any.required": "O parâmetro year é obrigatório.",
      "number.base": "O year deve ser um número.",
    }),
});

export class DashboardController {
  private dashboardService: DashboardService;

  // 🔑 CORRIGIDO: Agora recebe o Service já instanciado, mantendo a arquitetura limpa (Controller injeta Service).
  constructor(dashboardService: DashboardService) {
    this.dashboardService = dashboardService;
  }

  public getDashboardData = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      // 🔑 O dashboardSchema agora está definido e acessível.
      const validation = dashboardSchema.validate(req.query);

      if (validation.error) {
        res.status(400).json({
          message: "Erro de validação dos parâmetros de BI (unitId e year).",
          details: validation.error.details.map(
            (d: Joi.ValidationErrorItem) => d.message
          ),
        });
        return;
      }

      const { unitId, year } = validation.value;
      const data = await this.dashboardService.getDashboardData(unitId, year);

      res.status(200).json(data);
    } catch (error) {
      console.error("Erro ao buscar dados do Dashboard BI:", error);
      res
        .status(500)
        .json({ message: "Erro interno ao buscar dados do Dashboard BI." });
    }
  };
}
