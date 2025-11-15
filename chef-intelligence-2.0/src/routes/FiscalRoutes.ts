// src/routes/FiscalRoutes.ts

import { Router } from "express";
import FiscalController from "../controllers/FiscalController";

const router = Router();

// Rota 1: Exportação de Dados Fiscais (para o Contador)
// Rota: GET /fiscal/exportar
router.get("/fiscal/exportar", FiscalController.exportForAccountant);

// Rota 2: Visualização dos Registros (pelo Responsável)
// Rota: GET /fiscal
router.get("/fiscal", FiscalController.exportForAccountant);

export default router;
