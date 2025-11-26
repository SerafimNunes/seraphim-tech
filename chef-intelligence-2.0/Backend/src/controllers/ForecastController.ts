// src/controllers/ForecastController.ts

import { Request, Response } from 'express';
import { ForecastService } from '../services/ForecastService';

export class ForecastController {
  private forecastService: ForecastService;

  constructor(forecastService: ForecastService) {
    // Injeção de dependência do Service
    this.forecastService = forecastService; 
  }

  /**
   * Rota: POST /api/forecast/gerar
   * 🎯 Função: Chama o service para gerar a previsão de vendas.
   * R1: Tipagem Rígida e R4: Multi-Unidade (unidade_id obrigatório no payload)
   */
  public async gerarForecast(req: Request, res: Response): Promise<Response> {
    try {
      // 🔑 R1: Tipagem Rígida - Validação mínima do payload
      const { unidade_id, dias_previsao, dias_historico } = req.body; 

      if (!unidade_id || !dias_previsao || !dias_historico) {
        return res.status(400).json({ 
            mensagem: 'Payload inválido. unidade_id, dias_previsao e dias_historico são obrigatórios.' 
        });
      }

      const forecast = await this.forecastService.gerarForecastVendas({
        unidade_id,
        dias_previsao,
        dias_historico,
      });

      return res.status(200).json(forecast);
    } catch (error) {
      console.error('Erro ao gerar forecast:', error);
      return res.status(500).json({ mensagem: 'Falha interna ao gerar forecast.' });
    }
  }
}