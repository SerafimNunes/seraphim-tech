// src/routes/ContabilidadeRoutes.ts

import { Router } from "express";
import ContabilidadeController from "../controllers/ContabilidadeController";
import { authMiddleware } from "../Middlewares/authMiddleware";
import { podeAcessar } from "../Middlewares/rbacMiddleware";

const contabilidadeRouter = Router();

const CONTABILIDADE_ROLES = ["ADMIN", "GESTOR", "CONTADOR"];

contabilidadeRouter.use(authMiddleware); // Protege todas as rotas de contabilidade

contabilidadeRouter.get(
  "/contabilidade/alerta-simples",
  podeAcessar(CONTABILIDADE_ROLES),
  ContabilidadeController.getAlertaSimples
);

contabilidadeRouter.get(
  "/contabilidade/documento-gerencial",
  podeAcessar(CONTABILIDADE_ROLES),
  ContabilidadeController.gerarDocumentoGerencial
);

export default contabilidadeRouter;
