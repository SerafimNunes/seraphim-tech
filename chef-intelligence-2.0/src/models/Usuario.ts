// src/models/Usuario.ts

import { DataTypes, Model, Optional, ModelCtor } from "sequelize";
import { connection } from "../config/sequelize";
// 🔑 Importações diretas para CORRIGIR o erro 'not a subclass of Sequelize.Model'
import Cargo, { CargoModel } from "./Cargo";
import Unidade from "./Unidade";
import Colaborador from "./Colaborador";

import { IModelFactory } from "../config/types";

interface UsuarioAttributes {
  id_usuario: number;
  email: string;
  senha_hash: string;
  // Chaves estrangeiras essenciais para Auth/RBAC (R12)
  cargo_id: number;
  unidade_id: number; // R4: Multi-Unidade
  // FK para a tabela de RH
  colaborador_id: number;
}

type UsuarioCreationAttributes = Optional<UsuarioAttributes, "id_usuario">;

// 1. CORREÇÃO TS2528: Removendo o 'export default' daqui
export class Usuario
  extends Model<UsuarioAttributes, UsuarioCreationAttributes>
  implements UsuarioAttributes
{
  public id_usuario!: number;
  public email!: string;
  public senha_hash!: string;
  public cargo_id!: number;
  public unidade_id!: number;
  public colaborador_id!: number;

  // Associações
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public cargo?: CargoModel;
}

Usuario.init(
  {
    id_usuario: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    senha_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    // R12: Acesso direto ao Cargo para busca rápida de permissões
    cargo_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Cargos", key: "id_cargo" },
    },
    // R4: Acesso direto à Unidade
    unidade_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Unidades", key: "id_unidade" },
    },
    // 1:1 com o modelo Colaborador de RH
    colaborador_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: { model: "Colaboradores", key: "id_colaborador" },
    },
  },
  {
    sequelize: connection,
    tableName: "Usuarios",
    underscored: true,
  }
);

// Associações
(Usuario as any).associate = function (models: IModelFactory) {
  // 2. CORREÇÃO TS2345/TS2352: Simplificando o cast para 'as any'
  Usuario.belongsTo(Cargo as any, {
    foreignKey: "cargo_id",
    as: "cargo",
  });

  // 2. CORREÇÃO TS2345/TS2352: Simplificando o cast para 'as any'
  Usuario.belongsTo(Unidade as any, {
    foreignKey: "unidade_id",
    as: "unidade",
  });

  // 2. CORREÇÃO TS2345/TS2352: Simplificando o cast para 'as any'
  Usuario.belongsTo(Colaborador as any, {
    foreignKey: "colaborador_id",
    as: "colaborador",
  });
};

// 1. CORREÇÃO TS2528: Mantendo a exportação default no final
export default Usuario;
