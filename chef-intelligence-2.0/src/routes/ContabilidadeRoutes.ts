// src/routes/ContabilidadeRoutes.ts

import { Router } from "express";
import ContabilidadeController from "../controllers/ContabilidadeController";
import { authMiddleware } from "../Middlewares/authMiddleware";
import { rbacMiddleware } from "../Middlewares/rbacMiddleware";

const contabilidadeRouter = Router();

const CONTABILIDADE_ROLES = ["ADMIN", "GESTOR", "CONTADOR"];

contabilidadeRouter.use(authMiddleware); // Protege todas as rotas de contabilidade

contabilidadeRouter.get(
  "/contabilidade/alerta-simples",
  rbacMiddleware(CONTABILIDADE_ROLES),
  ContabilidadeController.getAlertaSimples
);

contabilidadeRouter.get(
  "/contabilidade/documento-gerencial",
  rbacMiddleware(CONTABILIDADE_ROLES),
  ContabilidadeController.gerarDocumentoGerencial
);

export default contabilidadeRouter;
