// src/routes/EstoqueContagemRoutes.ts (CORRIGIDO: Incluindo RBAC)

import { Router } from "express";
// 🔑 Importa a instância exportada do Controller
import EstoqueContagemController from "../controllers/EstoqueContagemController";
import { authMiddleware } from "../Middlewares/authMiddleware";
import { podeAcessar } from "../Middlewares/rbacMiddleware";

const router = Router();

// Rota POST para registrar uma nova Contagem Cega: POST /api/v1/contagem
// Protegida por Auth e RBAC (R12) - Apenas Gerente ou Estoquista.
router.post(
  "/contagem",
  authMiddleware,
  podeAcessar(["Gerente", "Estoquista"]),
  EstoqueContagemController.store
);

export default router;
