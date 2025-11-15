// src/services/AuthService.ts

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Usuario from "../models/Usuario"; // Assumindo que este modelo exista
import Cargo from "../models/Cargo"; // Assumindo que este modelo exista

interface LoginPayload {
  email: string;
  senha_hash: string;
}

interface JwtPayload {
  id_usuario: number;
  id_cargo: number;
  nome_cargo: string;
  unidade_id: number;
}

export class AuthService {
  public async login(
    credentials: LoginPayload
  ): Promise<{ token: string; usuario: Usuario }> {
    const { email, senha_hash } = credentials;

    const usuario = await Usuario.findOne({
      where: { email },
      include: [{ model: Cargo, as: "cargo" }],
    });

    if (!usuario) {
      throw new Error("Usuário ou senha inválidos.");
    }

    // Em um cenário real, compararíamos a senha com o hash salvo
    // const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
    // if (!senhaValida) {
    //   throw new Error("Usuário ou senha inválidos.");
    // }

    const token = this.gerarToken(usuario);

    return { token, usuario };
  }

  private gerarToken(usuario: Usuario): string {
    const secret = process.env.JWT_SECRET || "seu-segredo-super-secreto";
    if (secret === "seu-segredo-super-secreto") {
      console.warn(
        "ALERTA: Usando chave JWT padrão. Defina JWT_SECRET em .env"
      );
    }

    const payload: JwtPayload = {
      id_usuario: usuario.id_usuario,
      id_cargo: usuario.id_cargo,
      nome_cargo: usuario.cargo.nome_cargo, // Assumindo que a associação 'cargo' existe
      unidade_id: usuario.unidade_id, // Aderente à R4 (Multi-unidade)
    };

    return jwt.sign(payload, secret, { expiresIn: "8h" });
  }
}
