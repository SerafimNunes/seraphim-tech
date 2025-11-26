// src/services/UsuarioServices.ts

import Usuario, { UsuarioModel } from "../models/Usuario";
import { IModelFactory } from "../config/types";
import { Op } from "sequelize"; // Necessário se for fazer busca por login/email
// Importação dos modelos associados (Necessário para o 'include')
import Cargo from "../models/Cargo";
import Permissao from "../models/Permissao";

// Assumindo que você passa o IModelFactory no construtor para consultas complexas
// Se o seu `UsuarioService` usa apenas o modelo Usuario importado, adapte o código.

export class UsuarioService {
  // Se for necessário usar o IModelFactory para associations, use a injeção:
  // private models: IModelFactory;
  // constructor(models: IModelFactory) { this.models = models; }
  constructor() {}
  /**
   * R4: Busca o ID da Unidade (Empresa) associada a um usuário.
   */

  public async getUnidadeIdByUsuarioId(
    usuarioId: number
  ): Promise<number | null> {
    const usuario = await Usuario.findByPk(usuarioId, {
      attributes: ["unidade_id"], // Busca apenas o campo necessário para otimização
    });

    return usuario ? usuario.unidade_id : null;
  }
  /**
   * Método de autenticação (Hipótese de onde o erro ocorre).
   * Busca o usuário e todas as suas permissões para montar o JWT (R12 - RBAC).
   */

  public async findUserWithPermissions(
    loginIdentifier: string
  ): Promise<UsuarioModel | null> {
    // Usa o Op.or para permitir login por email ou nome de usuário
    const usuario = await Usuario.findOne({
      where: {
        [Op.or]: [{ login: loginIdentifier }, { email: loginIdentifier }],
      },
      include: [
        {
          model: Cargo, // Associa com Cargo
          as: "cargo", // Nome da associação definida em Usuario.ts
          attributes: ["id_cargo", "nome_cargo", "is_super_admin"],
          include: [
            {
              model: Permissao, // Associa com Permissao (via CargoPermissao)
              as: "permissoes", // Nome da associação definida em Cargo.ts // ⬅️ CORREÇÃO FINAL: Garante que busca o campo RENOMEADO
              attributes: ["nome_permissao"],
              through: { attributes: [] }, // Oculta as colunas da tabela de junção
            },
          ],
        },
      ],
    });

    return usuario;
  } // *Observação: Outros métodos de CRUD (create, update, delete) viriam aqui.*
}
