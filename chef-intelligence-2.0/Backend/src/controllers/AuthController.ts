import { Request, Response } from "express";
import { z } from "zod";
import { AuthService, LoginResult } from "../services/AuthService";

// Esquema de validação ESTREITO para usuários normais (padrão)
const standardLoginSchema = z.object({
  email: z.string().email("Formato de e-mail inválido."),
  senha: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
});

// Esquema de validação FLEXÍVEL para o usuário de SETUP (admin)
const adminLoginSchema = z.object({
  email: z.string().min(1, "O usuário não pode ser vazio."),
  senha: z.string().min(1, "A senha não pode ser vazia."),
});

// Implementação da classe AuthController
class AuthController {
  private service: AuthService;

  constructor() {
    this.service = new AuthService();
  }

  public async login(req: Request, res: Response): Promise<Response> {
    try {
      let credentials;

      if (req.body.email === "admin") {
        credentials = adminLoginSchema.parse(req.body);
      } else {
        credentials = standardLoginSchema.parse(req.body);
      }

      const loginPayload = {
        loginIdentifier: credentials.email, // ⬅️ Mapeia para o novo campo de busca flexível
        senha_hash: credentials.senha,
      };

      const result: LoginResult = await this.service.login(loginPayload as any);

      if (result.requiresSetup) {
        // Fluxo de SETUP (Primeiro Acesso)
        return res.status(200).json({
          message:
            "Primeiro acesso detectado. Por favor, configure seu novo login e senha.",
          requiresSetup: true,
          usuario: {
            // Retorna o mínimo necessário
            id_usuario: result.usuario.id_usuario,
            email: result.usuario.email,
            unidade_id: result.usuario.unidade_id || null, // Garante que unidade_id existe para o Frontend
          },
        });
      }

      // Fluxo de LOGIN NORMAL (Após Setup)
      const usuario = result.usuario;
      const token = result.token;

      // Mapeia as permissões do cargo
      const permissoesDoCargo =
        usuario.cargo && (usuario.cargo as any).permissoes
          ? (usuario.cargo as any).permissoes
          : [];

      return res.status(200).json({
        token,
        usuario: {
          id_usuario: usuario.id_usuario,
          email: usuario.email,
          cargo_id: usuario.cargo?.id_cargo,
          unidade_id: usuario.unidade_id,
          nome_cargo: usuario.cargo?.nome_cargo,
          permissoes: permissoesDoCargo.map((p: any) => p.nome_permissao),
          // 🔑 CORREÇÃO CRÍTICA AQUI: Retorna o status atualizado do DB
          primeiro_acesso: usuario.primeiro_acesso_admin, // Deve ser 'false' se o setup foi concluído
        },
        message: "Login efetuado com sucesso.",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Dados de login inválidos.", details: error.issues });
      }

      const message = (error as Error).message;
      const status = message.includes("Usuário ou senha inválidos") ? 401 : 500;

      return res.status(status).json({
        error: "Falha na autenticação.",
        details: message,
      });
    }
  }

  public async setupAdmin(req: Request, res: Response): Promise<Response> {
    // 💡 IMPORTANTE: Implemente a lógica de setup aqui.
    // Após o sucesso, você deve garantir que o campo 'primeiro_acesso_admin' no DB
    // para este usuário seja atualizado para 'false'.
    return res
      .status(501)
      .json({ error: "Rota de Setup Admin não implementada." });
  }
}

export default new AuthController();
