// Caminho: src/controllers/SetupController.ts
import { Request, Response } from "express";
import { z } from "zod";
import { SetupService } from "../services/SetupService"; // Importaremos o service a seguir

// 🔑 R1: Tipagem Rígida e Validação Zod para o Setup
export const setupAdminSchema = z.object({
  id_usuario: z.number().int().min(1, "ID de usuário inválido."),
  nova_senha: z.string().min(8, "A senha deve ter no mínimo 8 caracteres."),
  novo_email: z.string().email("Formato de e-mail inválido.").optional(),
});

class SetupController {
  private service: SetupService;

  constructor() {
    this.service = new SetupService();
  }

  public async setupAdmin(req: Request, res: Response): Promise<Response> {
    try {
      // Valida o payload de entrada (R1)
      const payload = setupAdminSchema.parse(req.body);

      // Chama o service para processar a atualização
      const result = await this.service.finalizeAdminSetup(payload);

      // Retorna o novo token e dados do usuário atualizados
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Dados de setup inválidos.", details: error.issues });
      }
      const message = (error as Error).message;
      return res.status(500).json({
        error: "Falha ao concluir o setup.",
        message: message,
      });
    }
  }
}

export default new SetupController();
