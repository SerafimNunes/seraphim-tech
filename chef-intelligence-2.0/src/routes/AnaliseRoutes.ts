// src/routes/AnaliseRoutes.ts

import { Router } from "express";
import AnaliseController from "../controllers/AnaliseController";
import { authMiddleware } from "../Middlewares/authMiddleware";
import { rbacMiddleware } from "../Middlewares/rbacMiddleware"; // Usar RBAC (R12)

const analiseRouter = Router();

// R12: Acesso restrito
const ANALISE_ROLES = ["ADMIN", "GESTOR"];

analiseRouter.use(authMiddleware); // Protege todas as rotas de análise

analiseRouter.get(
  "/analise/financeiro",
  rbacMiddleware(ANALISE_ROLES),
  AnaliseController.getFinanceiroKPIs
);

export default analiseRouter;
