// src/services/AuthService.ts

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Op, DataTypes } from "sequelize";

import Usuario, { UsuarioModel } from "../models/Usuario";
import Cargo, { CargoModel } from "../models/Cargo";
import Permissao from "../models/Permissao";

// Interface para os dados de login recebidos
interface LoginPayload {
  loginIdentifier: string;
  senha_hash: string;
}

// O tipo de retorno do Login para o Controller
export interface LoginResult {
  token?: string;
  usuario: UsuarioModel;
  requiresSetup?: boolean;
}

// O payload do token DEVE refletir o payload do authMiddleware (R12)
export interface JwtPayload {
  id_usuario: number;
  id_cargo: number;
  nome_cargo: string;
  unidade_id: number;
  permissoes: string[]; // 🔑 CAMPO CRÍTICO para o RBAC (R12)
  primeiro_acesso: boolean;
}

// 🔑 CORREÇÃO R1: Interface de Projeção para o resultado do SELECT de Permissões
interface PermissaoProjection {
  nome_permissao: string;
}

export class AuthService {
  public async createTemporarySuperUser(
    unidadeId: number
  ): Promise<UsuarioModel> {
    const TEMP_EMAIL = "admin";
    const TEMP_SENHA = "admin";

    let superAdminCargo: CargoModel | null = await (Cargo as any).findOne({
      where: { nome_cargo: "SUPER_ADMIN" },
    });

    if (!superAdminCargo) {
      superAdminCargo = await (Cargo as any).create({
        unidade_id: unidadeId,
        nome_cargo: "SUPER_ADMIN",
        is_super_admin: true, // 🚨 Flag R12
      });
    }

    const passwordHash = await bcrypt.hash(TEMP_SENHA, 10);

    const temporaryUser = await (Usuario as any).create({
      unidade_id: unidadeId,
      colaborador_id: 1,
      cargo_id: superAdminCargo!.id_cargo,
      email: TEMP_EMAIL,
      login: TEMP_EMAIL,
      senha_hash: passwordHash, // 🔑 PADRONIZADO
      ativo: true,
      primeiro_acesso_admin: true,
    });

    return temporaryUser as UsuarioModel;
  }
  public async login(credentials: LoginPayload): Promise<LoginResult> {
    // 🔑 CORREÇÃO CRÍTICA: Usa 'loginIdentifier' para busca
    const { loginIdentifier, senha_hash: senha } = credentials; // 🚨 DEBUG 1: Mostra o que está sendo buscado

    console.log(
      `[AUTH DEBUG] Tentativa de login com identificador: ${loginIdentifier}`
    );

    const usuario: UsuarioModel | null = await (Usuario.findOne({
      where: {
        [Op.or]: [
          // Permite login por 'login' OU 'email'
          { login: loginIdentifier },
          { email: loginIdentifier },
        ],
      },
      include: [
        {
          model: Cargo,
          as: "cargo",
          include: [
            {
              model: Permissao,
              as: "permissoes",
              attributes: ["nome_permissao"],
            },
          ],
        },
      ],
    }) as Promise<UsuarioModel | null>); // 🚨 DEBUG 2: Confirma se o usuário foi encontrado no banco

    if (!usuario || !usuario.cargo) {
      console.log(
        "[AUTH DEBUG] FALHA: Usuário não encontrado no DB ou Cargo ausente."
      );
      throw new Error("Usuário ou senha inválidos.");
    } // Se o usuário for encontrado, exibe o hash

    console.log(
      `[AUTH DEBUG] Usuário encontrado. Email: ${
        usuario.email
      }. Hash no DB: ${usuario.senha_hash.substring(0, 10)}...`
    );

    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash); // 🚨 DEBUG 3: Confirma a validação final da senha

    if (!senhaValida) {
      console.log(
        "[AUTH DEBUG] FALHA: Senha digitada não confere com o Hash do DB."
      );
      throw new Error("Usuário ou senha inválidos.");
    }

    console.log("[AUTH DEBUG] SUCESSO: Autenticação concluída."); // 🔑 CORREÇÃO CRÍTICA: Converte o modelo Sequelize para um objeto puro antes de retornar. // Isso garante que as propriedades, especialmente 'id_usuario', sejam expostas corretamente.

    const usuarioPuro = usuario.get({ plain: true }) as UsuarioModel;

    if (usuarioPuro.primeiro_acesso_admin === true) {
      // Usa usuarioPuro (objeto JavaScript simples) para o JSON de resposta
      return {
        usuario: usuarioPuro,
        requiresSetup: true,
      };
    } // Gera o token usando o modelo Sequelize original (que tem as associações)

    const token = this.gerarToken(usuario); // Retorna o token e o objeto puro

    return { token, usuario: usuarioPuro };
  }
  private gerarToken(usuario: UsuarioModel): string {
    // ... (restante da função gerarToken e setupSuperUser - sem alterações de debug)

    const secret = process.env.JWT_SECRET || "seu-segredo-super-secreto";
    if (secret === "seu-segredo-super-secreto") {
      console.warn(
        "ALERTA: Usando chave JWT padrão. Defina JWT_SECRET em .env"
      );
    }

    const cargo = usuario.cargo!;

    let permissoes: string[] = cargo.permissoes
      ? (cargo.permissoes as any[]).map((p) => p.nome_permissao)
      : [];

    if (cargo.is_super_admin === true) {
      permissoes = ["GLOBAL_ACCESS"];
    }

    const payload: JwtPayload = {
      id_usuario: usuario.id_usuario,
      id_cargo: cargo.id_cargo,
      nome_cargo: cargo.nome_cargo,
      unidade_id: usuario.unidade_id,
      permissoes: permissoes,
      primeiro_acesso: usuario.primeiro_acesso_admin || false,
    };

    return jwt.sign(payload, secret, { expiresIn: "8h" });
  }
  public async setupSuperUser(
    usuarioId: number,
    novoEmail: string,
    novaSenha: string
  ): Promise<UsuarioModel> {
    const adminUser = await Usuario.findByPk(usuarioId);

    if (!adminUser) {
      throw new Error("Usuário não encontrado.");
    }

    if (adminUser.primeiro_acesso_admin === false) {
      throw new Error("Configuração de Superusuário já concluída.");
    }

    const novaSenhaHash = await bcrypt.hash(novaSenha, 10);

    await adminUser.update({
      email: novoEmail,
      login: novoEmail,
      senha_hash: novaSenhaHash,
      primeiro_acesso_admin: false,
    });

    return adminUser as UsuarioModel;
  }
}
