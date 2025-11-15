// src/routes/movimentoRoutes.ts (Refatorado de movimentoRoutes.js)

import express from "express";
import EstoqueMovimentoController from "../controllers/EstoqueMovimentoController"; // 🔑 NOVO CONTROLLER

const router = express.Router();

// Rota GET para listar todos os movimentos de estoque (com filtros opcionais)
router.get("/movimentos", EstoqueMovimentoController.index);

export default router;
