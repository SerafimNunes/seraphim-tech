// src/routes/AnaliseRoutes.ts (Refatorado - Foco no 1.G/R12)

import { Router } from "express";
import AnaliseController from "../controllers/AnaliseController";
import { authMiddleware } from "../Middlewares/authMiddleware";
import { podeAcessar } from "../Middlewares/rbacMiddleware";
// 🔑 Importar a Enum ou definir a string de permissão
// import { PermissaoEnum } from "@models/Permissao";

const analiseRouter = Router();

// ⚠️ AJUSTE CRÍTICO (Regra 1.G / R12):
// O rbacMiddleware espera permissões no formato RECURSO_ACAO.
// Assumindo que a permissão de leitura é "ANALISE_LEITURA".
const ANALISE_PERMISSIONS = ["ANALISE_LEITURA", "ANALISE_GERENCIAMENTO"];
// Se o "ADMIN" tiver id_cargo 99, ele já tem acesso pelo bypass no rbacMiddleware.

analiseRouter.use(authMiddleware); // 🔑 1.G: Autenticação em todo o módulo.

analiseRouter.get(
  "/financeiro", // 🔑 Rota ajustada para ser concisa (ex: /api/v1/analise/financeiro) // 🔑 1.G: Autorização (RBAC). Permite acesso se o usuário tiver QUALQUER UMA das permissões listadas.
  podeAcessar(ANALISE_PERMISSIONS),
  AnaliseController.getFinanceiroKPIs.bind(AnaliseController) // 🔑 Melhor prática: usar bind
);

export default analiseRouter;
