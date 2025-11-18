import { Router } from "express";
import { EscalaController } from "../controllers/EscalaController";

/**
 * Define e agrupa todas as rotas do módulo de Escalas.
 * O EscalaController é injetado no construtor.
 */
export class EscalaRoutes {
  public router: Router;
  private controller: EscalaController;

  /**
   * @param controller - A instância do EscalaController é injetada aqui.
   */
  constructor(controller: EscalaController) {
    // Inicializa o Router do Express
    this.router = Router();
    this.controller = controller;

    // Configura todas as rotas
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Rota: POST /api/escala (Cria uma nova proposta de escala)
    this.router.post(
      "/",
      // Geralmente, você adicionaria middlewares de autenticação aqui, e.g., AuthMiddleware.verify
      this.controller.criarEscala.bind(this.controller)
    );

    // Rota: PUT /api/escala/aprovar/:id_escala (Aprova uma escala pendente)
    this.router.put(
      "/aprovar/:id_escala",
      // Middleware de autorização (apenas usuários com permissão de RH/Gerente)
      this.controller.aprovarEscala.bind(this.controller)
    );

    // Exemplo: Rota GET para buscar todas as escalas
    // this.router.get("/", this.controller.listarEscalas.bind(this.controller));
  }
}
