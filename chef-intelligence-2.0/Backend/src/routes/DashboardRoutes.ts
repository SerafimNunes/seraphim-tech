import { Router } from "express";
import { DashboardController } from "../controllers/DashboardController";
// Adicionar Middleware de autenticação/JWT e RBAC aqui, se necessário (R12)

export class DashboardRoutes {
  public router: Router;
  private dashboardController: DashboardController;

  constructor(dashboardController: DashboardController) {
    this.dashboardController = dashboardController;
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // GET /api/dashboard?unitId=1&year=2024
    this.router.get(
      "/",
      // ⚠️ Middleware de autenticação e RBAC (R12) pode ser adicionado aqui,
      // ex: authMiddleware, checkPermission('VIEW_DASHBOARD'),
      this.dashboardController.getDashboardData
    );
  }
}
