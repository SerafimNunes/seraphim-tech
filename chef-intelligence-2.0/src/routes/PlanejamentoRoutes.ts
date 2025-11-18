// src/routes/PlanejamentoRoutes.ts

import { Router } from "express";
import { PlanejamentoController } from "../controllers/PlanejamentoController";
import { authMiddleware } from "../Middlewares/authMiddleware";
import { podeAcessar } from "../Middlewares/rbacMiddleware";
import { Acoes, Recursos } from "../config/types"; // Assumindo que você tem tipos definidos para RBAC

const router = Router();
const planejamentoController = new PlanejamentoController();

// Todas as rotas de planejamento requerem Autenticação
router.use(authMiddleware);

// Rota para a funcionalidade principal do Puxador Kanban (R11)
router.get(
  "/necessidades",
  // R12: Apenas usuários com permissão para LER Planejamento podem acessar
  podeAcessar(Recursos.PLANEJAMENTO, Acoes.LEITURA),
  planejamentoController.getNecessidadesReposicao
);

// Futuro: Rota para acionar a criação automática de pedidos/lotes

export const planejamentoRoutes = router;
