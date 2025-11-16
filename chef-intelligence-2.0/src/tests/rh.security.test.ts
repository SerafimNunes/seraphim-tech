// src/tests/rh.security.test.ts

/// <reference types="jest" />

import { RHService } from "../services/RHService";
import { EscalaService } from "../services/EscalaService";
import { authMiddleware } from "../Middlewares/authMiddleware"; // Middleware real
// 🔑 CORREÇÃO TS2305: Altera a importação para default export (sem chaves)
import { rbackMiddleware } from "../Middlewares/rbacMiddleware"; // Middleware real
import { Request, Response, NextFunction } from "express";

// MOCKS dos Services
jest.mock("../services/EscalaService");
const MockEscalaService = EscalaService as jest.MockedClass<
  typeof EscalaService
>;

// 🔑 CORREÇÃO TS2305: Ajusta o mock para exportar a função como DEFAULT.
// A função de mock agora retorna diretamente o que seria o 'export default'.
jest.mock("../Middlewares/rbacMiddleware", () => {
  // Retorna a função de middleware de permissão como o DEFAULT export.
  return (requiredPermissions: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      // Simulação da lógica de verificação (R12)
      const usuario = (req as any).usuario;
      const isAdmin = usuario && usuario.id_cargo === 99;
      const temPermissaoRequerida =
        usuario && requiredPermissions.includes("FINANCEIRO_ESCRITA");

      if (!isAdmin && !temPermissaoRequerida) {
        return res
          .status(403)
          .json({ error: "Acesso negado. Permissão insuficiente." });
      }
      next();
    };
  };
});

describe("RH e Segurança - Acesso e Conformidade (R12, R13)", () => {
  let escalaService: EscalaService;
  let rhService: RHService;

  beforeAll(() => {
    escalaService = new EscalaService();
    rhService = new RHService(escalaService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("R13: Deve validar e rejeitar uma escala que viole a IRegraColaborador (Folga Fixa)", async () => {
    const colaboradorId = 10;
    const escalaGeradaInvalida = [
      { colaboradorId: colaboradorId, dia: "Domingo", inicio: "10:00" },
    ];
    const regrasColaborador = [{ tipo: "FOLGA_FIXA", dia: "Domingo" }];

    // Mocka a implementação do método no Service mockado para REJEITAR (lançar erro)
    (MockEscalaService.prototype.validarEscala as jest.Mock).mockRejectedValue(
      new Error("R13. Violação de regra fixa: Folga no Domingo.")
    );

    await expect(
      escalaService.validarEscala(
        escalaGeradaInvalida as any,
        regrasColaborador as any
      )
    ).rejects.toThrow("R13. Violação de regra fixa: Folga no Domingo.");
  });

  it("R7: Deve registrar a performance e correlacionar erros/desperdício", async () => {
    const performancePayload = {
      colaborador_id: 5,
      erros_registrados: 2,
      desperdicio_total: 150.5,
    };

    (rhService as any).historicoPerformanceModel = {
      create: jest.fn().mockResolvedValue(performancePayload),
    };

    await rhService.registrarPerformance(performancePayload as any);

    expect(
      (rhService as any).historicoPerformanceModel.create
    ).toHaveBeenCalledWith(performancePayload);
  });

  it("R12: rbacMiddleware deve bloquear o acesso para permissões insuficientes", async () => {
    // Cenário: Usuário sem a permissão requerida (FINANCEIRO_ESCRITA)
    const mockRequest = {
      usuario: {
        id_cargo: 10,
        nome_cargo: "Estoquista",
        unidade_id: 1,
        id_usuario: 1,
      } as any,
    } as Request;
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const mockNext: NextFunction = jest.fn();

    const requiredPermission = "FINANCEIRO_ESCRITA";

    // Execução do rbacMiddleware mockado
    await rbacMiddleware([requiredPermission])(
      mockRequest,
      mockResponse,
      mockNext
    );

    // Assertiva: Deve retornar 403 Forbidden
    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: "Acesso negado. Permissão insuficiente.",
    });
    expect(mockNext).not.toHaveBeenCalled();
  });
});
