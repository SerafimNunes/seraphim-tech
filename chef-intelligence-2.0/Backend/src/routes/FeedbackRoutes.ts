// src/routes/FeedbackRoutes.ts

import { Router } from "express";
import FeedbackController from "../controllers/FeedbackController";
import { authMiddleware } from "../Middlewares/authMiddleware";
import { podeAcessar } from "../Middlewares/rbacMiddleware";

const feedbackRouter = Router();

const GESTAO_QUALIDADE_ROLES = ["ADMIN", "GESTOR", "QUALIDADE"];

feedbackRouter.use(authMiddleware); // Protege todas as rotas de feedback

feedbackRouter.post(
  "/",
  podeAcessar(GESTAO_QUALIDADE_ROLES),
  FeedbackController.create
);
feedbackRouter.get(
  "/feedback/:id/rastreio",
  podeAcessar(GESTAO_QUALIDADE_ROLES),
  FeedbackController.rastrear
);

export default feedbackRouter;
