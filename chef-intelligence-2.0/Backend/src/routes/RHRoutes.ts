import { Router, Request, Response, NextFunction } from "express";
import { RHController } from "../controllers/RHController"; // Assumindo este caminho

// ⚠️ SIMULAÇÃO DE MIDDLEWARES ⚠️
// Devem ser implementados para validar JWT, unidade do usuário (R4) e permissões (R12).
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Lógica de Autenticação JWT e extração de userId/unidadeId
  console.log("[Middleware] Usuário autenticado e unidade verificada (R4).");
  next();
};

const rbacMiddleware = (permissoesRequeridas: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Lógica de Autorização (RBAC - R12): Verifica se o usuário tem as permissões necessárias
    console.log(
      `[Middleware] Checando Permissões: ${permissoesRequeridas.join(", ")}`
    );
    next(); // Passa adiante se autorizado
  };
};

/**
 * Define as rotas HTTP para o domínio de Recursos Humanos (RH).
 * Segue o padrão de Rotas do Express + Middlewares de Segurança (R12).
 */
export class RHRoutes {
  public router: Router;
  private rhController: RHController;

  constructor(rhController: RHController) {
    this.rhController = rhController;
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // ------------------------------------------------------------------------
    // Rota para Dashboard BI (Turnover)
    // [GET] /api/rh/turnover?unidade_id=X&ano=Y
    // Acesso: ADMIN, GERENTE (para BI e KPIs)
    // ------------------------------------------------------------------------
    this.router.get(
      "/turnover",
      authMiddleware,
      rbacMiddleware(["RH_LEITURA", "DASHBOARD_BI"]),
      (req, res) => this.rhController.getTurnoverAnalysis(req, res)
    );

    // ------------------------------------------------------------------------
    // Rota para Definição do Perfil Ideal (Configuração de RH)
    // [POST] /api/rh/perfil-ideal
    // Acesso: ADMIN, COORDENADOR (para configuração de metas/perfis)
    // ------------------------------------------------------------------------
    this.router.post(
      "/perfil-ideal",
      authMiddleware,
      rbacMiddleware(["RH_GESTAO", "CONFIG_GERAL"]),
      (req, res) => this.rhController.definirPerfilIdeal(req, res)
    );

    // ------------------------------------------------------------------------
    // Rota para Registro de Performance (Avaliação de RH)
    // [POST] /api/rh/performance
    // Acesso: ADMIN, COORDENADOR (para registrar avaliações)
    // ------------------------------------------------------------------------
    this.router.post(
      "/performance",
      authMiddleware,
      rbacMiddleware(["RH_GESTAO", "GESTOR_REGISTRO"]),
      (req, res) => this.rhController.registrarPerformance(req, res)
    );

    // ------------------------------------------------------------------------
    // Rota para Aprovação de Escala (Se a aprovação for delegada ao RHController)
    // [PUT] /api/rh/escalas/:id/aprovar
    // Acesso: ADMIN, GERENTE
    // ------------------------------------------------------------------------
    this.router.put(
      "/escalas/:id/aprovar",
      authMiddleware,
      rbacMiddleware(["ESCALA_APROVACAO", "RH_GESTAO"]),
      (req, res) => this.rhController.aprovarEscala(req, res)
    );
  }
}
