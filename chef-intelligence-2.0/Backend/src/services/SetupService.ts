// Caminho: src/services/SetupService.ts
import UsuarioModel from "../models/Usuario";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { setupAdminSchema } from "../controllers/SetupController"; // 🔑 CORREÇÃO: Importa o schema do Controller
import { z } from "zod"; // 🔑 CORREÇÃO: Importa o namespace 'z'

// 🔑 Tipagem para o resultado do Setup
interface SetupResult {
  token: string;
  usuario: any; // Usar tipo de usuário puro após serialização
}

// 🚨 NOVO: Define o tipo de dado de entrada do Service
type SetupAdminData = z.infer<typeof setupAdminSchema>;

export class SetupService {
  // 🚨 CORREÇÃO: Usa o tipo SetupAdminData
  public async finalizeAdminSetup(data: SetupAdminData): Promise<SetupResult> {
    const { id_usuario, nova_senha, novo_email } = data;

    // 1. Encontra o usuário
    const usuario = await UsuarioModel.findByPk(id_usuario);

    if (!usuario) {
      throw new Error("Usuário não encontrado.");
    }

    // 2. Garante que o usuário está no fluxo correto (primeiro acesso)
    if (usuario.primeiro_acesso_admin !== true) {
      throw new Error(
        "Acesso negado: Setup já foi concluído ou usuário não é Admin."
      );
    }

    // 3. Hash da nova senha
    const salt = await bcrypt.genSalt(10);
    const senha_hash = await bcrypt.hash(nova_senha, salt);

    // 4. Atualiza os dados
    usuario.senha_hash = senha_hash;
    usuario.primeiro_acesso_admin = false; // 🔑 Seta o flag para false!

    if (novo_email) {
      usuario.email = novo_email;
    }

    await usuario.save();

    // 5. Gera um novo token JWT para o login definitivo
    // 🔑 R12: Incluir dados essenciais no payload do JWT
    const tokenPayload = {
      id: usuario.id_usuario,
      unidadeId: usuario.unidade_id,
      role: "SUPER_ADMIN",
    };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET!, {
      expiresIn: "1d",
    });

    // 6. Retorna o objeto puro do usuário para o Frontend
    const usuarioPuro = usuario.get({ plain: true }) as any;

    // 7. Simula a estrutura de retorno do login normal para o Frontend
    return {
      token,
      usuario: {
        id_usuario: usuarioPuro.id_usuario,
        email: usuarioPuro.email,
        unidade_id: usuarioPuro.unidade_id,
        nome_cargo: "Super Administrador",
        permissoes: ["GLOBAL_ACCESS"],
      },
    };
  }
}
