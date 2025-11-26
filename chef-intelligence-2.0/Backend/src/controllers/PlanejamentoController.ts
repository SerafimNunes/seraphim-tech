// src/controllers/PlanejamentoController.ts

import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

// 🔑 IMPORTS NECESSÁRIOS PARA INJEÇÃO DE DEPENDÊNCIA
import { PlanejamentoService } from "../services/PlanejamentoService";
import { ForecastService } from "../services/ForecastService";
import { FichaTecnicaService } from "../services/FichaTecnicaService";

import { UsuarioService } from "../services/UsuarioServices";

// 🔑 INSTANCIAÇÃO OBRIGATÓRIA PARA INJEÇÃO DE DEPENDÊNCIA

// 1. Instância de serviços de baixo nível
const forecastService = new ForecastService();
const fichaTecnicaService = new FichaTecnicaService();

// 2. Instância do PlanejamentoService com injeção de dependências (PlanejamentoService)
const planejamentoService = new PlanejamentoService(
  forecastService,
  fichaTecnicaService
);
const usuarioService = new UsuarioService();

// Controller para o Módulo 11: Planejamento (Puxador Kanban - R11)
export class PlanejamentoController {
  /**
   * Endpoint: GET /planejamento/necessidades (Lógica REATIVA - Ponto de Pedido tradicional)
   * (GSI 1.A, 1.B, 1.C) Orquestra a requisição para gerar a lista de itens
   * que atingiram o Ponto de Pedido (PP).
   */
  public async getNecessidadesReposicao(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      // 1. Obter dados de contexto/segurança (R4)
      const usuarioId = (req as any).user.id; // Assume que o authMiddleware anexou o ID do usuário
      const unidade_id = await usuarioService.getUnidadeIdByUsuarioId(
        usuarioId
      );

      if (!unidade_id) {
        // (GSI 1.B) Erro de Contexto/Segurança
        return res
          .status(StatusCodes.UNAUTHORIZED)
          .json({ message: "Unidade do usuário não encontrada (R4)." });
      }

      const filter = {
        unidade_id: unidade_id, // Filtros adicionais de query params (se necessário)
      }; // 2. (GSI 1.D) Delega a lógica de negócio ao Service

      const listaNecessidade = await planejamentoService.gerarListaNecessidade(
        filter
      ); // 3. (GSI 1.C) Retorna a resposta HTTP 200 (OK)

      return res.status(StatusCodes.OK).json({
        total_itens_necessarios: listaNecessidade.length,
        lista: listaNecessidade,
      });
    } catch (error) {
      // 4. (GSI 1.B) Trata erros levantados pelo Service
      console.error(
        "[PlanejamentoController] Erro ao gerar lista de necessidades:",
        error
      ); // O erro levantado pelo Service (GSI 1.E) é capturado aqui

      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: "Erro interno ao processar a requisição.",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }

  // 🎯 NOVO MÉTODO (R11): Sugestão de Compra Otimizada via Forecast
  /**
   * Endpoint: GET /planejamento/sugestoes-compra/otimizada
   * 🎯 R11 (Ponto de Pedido Otimizado) - Gera a sugestão de compra baseada no Forecast.
   */
  public async getSugestoesCompraOtimizada(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      // 1. Obter dados de contexto/segurança (R4)
      const usuarioId = (req as any).user.id;
      const unidade_id = await usuarioService.getUnidadeIdByUsuarioId(
        usuarioId
      );

      if (!unidade_id) {
        return res
          .status(StatusCodes.UNAUTHORIZED)
          .json({ message: "Unidade do usuário não encontrada (R4)." });
      }

      const filter = {
        unidade_id: unidade_id, // Filtros adicionais de query params, se necessários no futuro.
      }; // 2. Delega a lógica de negócio OTIMIZADA ao Service

      const listaSugestoes =
        await planejamentoService.gerarSugestaoCompraOtimizada(filter); // 3. Retorna a resposta HTTP 200 (OK)

      return res.status(StatusCodes.OK).json({
        total_itens_sugeridos: listaSugestoes.length,
        sugestoes: listaSugestoes,
      });
    } catch (error) {
      // 4. Trata erros
      console.error(
        "[PlanejamentoController] Erro ao gerar sugestões de compra otimizadas:",
        error
      );

      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message:
          "Erro interno ao processar a requisição de planejamento otimizado.",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  } // Futuro: Endpoint para registrar as necessidades em Pedidos de Compra ou Produção // public async registrarNecessidades(req: Request, res: Response): Promise<Response> { ... }
}
