import { Request, Response } from "express";
import { z } from "zod";
import { AuthService } from "../services/AuthService";

// 🔑 R9: Esquema de validação para a rota de Login
const loginSchema = z.object({
  email: z.string().email("Formato de e-mail inválido."), // O campo enviado pelo cliente é 'senha'
  senha: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
});

// Implementação da classe AuthController
class AuthController {
  private service: AuthService;

  constructor() {
    // 🔑 1.A: Injeção de Dependência
    this.service = new AuthService();
  }
  /**
   * Rota POST /api/v1/auth/login
   * Valida as credenciais, chama o AuthService e retorna o token JWT.
   */

  public async login(req: Request, res: Response): Promise<Response> {
    try {
      // 🔑 R9: Validação
      const credentials = loginSchema.parse(req.body); // Mapeia o campo 'senha' do body para o campo 'senha_hash' que o Service espera

      const loginPayload = {
        email: credentials.email, // Em uma implementação real, esta senha deveria ser o hash/salt
        senha_hash: credentials.senha,
      }; // 🔑 R12: O Service retorna o token e o objeto do usuário (com Cargo e Permissões)

      const { token, usuario } = await this.service.login(loginPayload as any); // Retorna o token e os dados básicos do usuário

      return res.status(200).json({
        token,
        usuario: {
          id_usuario: usuario.id_usuario,
          email: usuario.email,
          cargo_id: usuario.cargo_id,
          unidade_id: usuario.unidade_id, // O objeto 'cargo' foi incluído pelo Sequelize no Service
          nome_cargo: (usuario as any).cargo.nome_cargo,
        },
        message: "Login efetuado com sucesso.",
      });
    } catch (error) {
      // 🔑 1.C: Tratamento de Erros
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Dados de login inválidos.", details: error.issues });
      } // Trata erros de negócio, como "Usuário ou senha inválidos."

      const message = (error as Error).message;
      const status = message.includes("Usuário ou senha inválidos") ? 401 : 500;

      return res.status(status).json({
        error: "Falha na autenticação.",
        details: message,
      });
    }
  }
}

export default new AuthController();
