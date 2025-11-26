// src/routes/authRouter.ts

import { Router } from "express";
import AuthController from "../controllers/AuthController";
import AdminSetupController from "../controllers/AdminSetupController"; // 🚨 Importe o novo Controller

const authRouter = Router();

// Rota pública para Login
authRouter.post("/login", AuthController.login.bind(AuthController));

/**
 * 🚨 NOVA ROTA: Rota pública para Setup do Superusuário Temporário
 * Chamada APENAS quando o Frontend recebe requiresSetup: true
 */
authRouter.post(
  "/setup-admin",
  AdminSetupController.setupAdmin.bind(AdminSetupController)
);

export default authRouter;
