import { Router } from "express";
// 🔑 R6: Importa a instância do Controller
import AuthController from "../controllers/AuthController";

const authRouter = Router();

/**
 * Rota pública para Login (POST /api/v1/auth/login).
 * Não requer authMiddleware (R12).
 */
authRouter.post("/login", AuthController.login.bind(AuthController)); // Vincula o 'this'

export default authRouter;
