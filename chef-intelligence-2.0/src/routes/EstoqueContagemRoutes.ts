// src/routes/EstoqueContagemRoutes.ts (CORRIGIDO: Usando Permissões)

import { Router } from "express";
import EstoqueContagemController from "../controllers/EstoqueContagemController";
import { authMiddleware } from "../Middlewares/authMiddleware";
// 🔑 CORREÇÃO 1: Renomeia o import para 'podeAcessar' (se a exportação do middleware foi mudada)
import { podeAcessar } from "../Middlewares/rbacMiddleware";

const router = Router();

// Rota POST para registrar uma nova Contagem Cega: POST /api/v1/contagem
// Protegida por Auth e RBAC (R12) - Ação é uma 'ESCRITA' no domínio 'ESTOQUE'.
router.post(
  "/contagem",
  authMiddleware,
  // 🔑 CORREÇÃO 2: Passa as permissões de domínio (Ex: ESTOQUE_ESCRITA)
  podeAcessar(["ESTOQUE_ESCRITA", "ESTOQUE_GERENCIAMENTO"]),
  EstoqueContagemController.store
);

export default router;
