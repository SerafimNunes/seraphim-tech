// src/controllers/AdminSetupController.ts

import { Request, Response } from "express";
import { z } from "zod";
import { AuthService } from "../services/AuthService";

// 🔑 R1: Esquema de validação para o Setup
const setupSchema = z.object({
  id_usuario: z.number().int().positive(),
  novo_email: z.string().email(),
  nova_senha: z
    .string()
    .min(8, "A nova senha deve ter pelo menos 8 caracteres."), // R12: Segurança
});

class AdminSetupController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  public async setupAdmin(req: Request, res: Response): Promise<Response> {
    try {
      const setupData = setupSchema.parse(req.body);
      const { id_usuario, novo_email, nova_senha } = setupData; // 🔑 Chama o método de serviço corrigido (que usa senha_hash e atualiza login/email)

      await this.authService.setupSuperUser(id_usuario, novo_email, nova_senha);

      return res.status(200).json({
        message:
          "Configuração de Superusuário concluída. Por favor, faça login com as novas credenciais.",
      });
    } catch (error) {
      // ... (Tratamento de erros)
      const message = (error as Error).message;
      const status = message.includes("já concluída") ? 403 : 500;
      return res.status(status).json({
        error: "Falha na configuração.",
        details: message,
      });
    }
  }
}

export default new AdminSetupController();
