// src/routes/ForecastRoutes.ts

import { Router } from 'express';
import { ForecastController } from '../controllers/ForecastController';

export class ForecastRoutes {
  public router: Router;
  private controller: ForecastController;

  constructor(controller: ForecastController) {
    // Injeção de dependência do Controller
    this.controller = controller;
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // POST /api/forecast/gerar -> Gera a previsão (R11)
    this.router.post('/gerar', (req, res) => this.controller.gerarForecast(req, res));
  }
}