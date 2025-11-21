import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import Usuario, { UsuarioModel } from "../models/Usuario";
import Cargo from "../models/Cargo";
import Permissao from "../models/Permissao";

// Interface para os dados de login recebidos
interface LoginPayload {
  email: string;
  senha_hash: string;
}

// O payload do token DEVE refletir o payload do authMiddleware (R12)
export interface JwtPayload {
  id_usuario: number;
  id_cargo: number;
  nome_cargo: string;
  unidade_id: number;
  permissoes: string[]; // 🔑 CAMPO CRÍTICO para o RBAC (R12)
}

export class AuthService {
  public async login(
    credentials: LoginPayload
  ): Promise<{ token: string; usuario: UsuarioModel }> {
    const { email, senha_hash } = credentials; // 🔑 CORREÇÃO R12: Inclui Cargo e Permissões na busca de login // O 'include' aninhado resolve o relacionamento N:M entre Cargo e Permissao

    const usuario = await Usuario.findOne({
      where: { email: email },
      include: [
        {
          model: Cargo,
          as: "cargo",
          include: [
            {
              model: Permissao,
              as: "permissoes", // Traz apenas o nome da permissão para o payload do token ser mais leve
              attributes: ["nome_permissao"],
            },
          ],
        },
      ],
    });

    if (!usuario || !usuario.cargo) {
      throw new Error("Usuário ou senha inválidos.");
    } // 🔑 Validação de Senha (CRÍTICO em produção) // A linha a seguir deve ser descomentada no ambiente final para validação real // const senhaValida = await bcrypt.compare(senha_hash, usuario.senha_hash); // if (!senhaValida) { //    throw new Error("Usuário ou senha inválidos."); // } // Nota: O Cast 'as any' é um workaround comum do Sequelize para acesso a includes.

    const token = this.gerarToken(usuario as any); // Retorna o objeto Usuario completo com os dados de Cargo/Permissões

    return { token, usuario: usuario as any };
  }

  private gerarToken(usuario: any): string {
    const secret = process.env.JWT_SECRET || "seu-segredo-super-secreto";
    if (secret === "seu-segredo-super-secreto") {
      console.warn(
        "ALERTA: Usando chave JWT padrão. Defina JWT_SECRET em .env"
      );
    } // 🔑 CORREÇÃO R12: Extrai o array de permissões // Mapeia o array de objetos 'Permissao' para um array de strings
    const permissoes: string[] = usuario.cargo?.permissoes
      ? usuario.cargo.permissoes.map(
          (p: { nome_permissao: string }) => p.nome_permissao
        )
      : [];

    const payload: JwtPayload = {
      id_usuario: usuario.id_usuario,
      id_cargo: usuario.id_cargo, // ID do cargo direto do modelo Usuario
      nome_cargo: usuario.cargo.nome_cargo,
      unidade_id: usuario.unidade_id,
      permissoes: permissoes, // CAMPO ESSENCIAL ADICIONADO (R12)
    }; // Token válido por 8 horas (R12 - Segurança)

    return jwt.sign(payload, secret, { expiresIn: "8h" });
  }
}
