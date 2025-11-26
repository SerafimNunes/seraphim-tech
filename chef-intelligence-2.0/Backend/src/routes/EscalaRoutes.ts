import { Router } from "express";
// 🔑 CORRIGIDO: Garante que o TS encontre o Controller (assumindo que ele tem um 'export class EscalaController')
import { EscalaController } from "../controllers/EscalaController";

export class EscalaRoutes {
  public router: Router;
  private controller: EscalaController;

  constructor(controller: EscalaController) {
    this.router = Router();
    this.controller = controller;
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(
      "/",
      this.controller.criarEscala.bind(this.controller)
    );

    this.router.put(
      "/aprovar/:id_escala",
      this.controller.aprovarEscala.bind(this.controller)
    );
  }
}