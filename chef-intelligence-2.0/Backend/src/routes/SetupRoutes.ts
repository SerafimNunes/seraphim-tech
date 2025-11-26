// Caminho: src/routes/SetupRoutes.ts
import { Router } from "express";
import SetupController from "../controllers/SetupController";

const router = Router();

// Rota para configurar o primeiro acesso do Super Admin
// POST /api/setup/admin
router.post("/admin", SetupController.setupAdmin);

export default router;
