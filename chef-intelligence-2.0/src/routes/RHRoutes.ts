// src/routes/RHRoutes.ts

import { Router } from "express";
import { RHController } from "../controllers/RHController";
import { RHService } from "../services/RHService";
import { EscalaService } from "../services/EscalaService";

// ✅ CORREÇÃO TS2554 (em RHRoutes.ts): Estrutura correta da função factory
export function configureRHRoutes(
  rhService: RHService,
  escalaService: EscalaService
): Router {
  const router = Router();

  // ✅ CORREÇÃO TS2554 (em RHController.ts): Instancia o Controller injetando os 2 serviços
  const rhController = new RHController(rhService, escalaService);

  // Rotas de Recursos Humanos
  router.post("/rh/perfil-ideal", rhController.definirPerfilIdeal);
  router.post("/rh/performance", rhController.registrarPerformance);

  // Rotas de Escala
  router.post("/rh/escala/gerar", rhController.gerarEscala);
  router.patch("/rh/escala/:id/aprovar", rhController.aprovarEscala);

  return router;
}

// Importante: O index.ts importa a função configureRHRoutes, e não um export default.
