// src/models/Usuario.ts

import { DataTypes, Model, Optional } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory } from "../config/types";
import { CargoModel } from "./Cargo";

export interface UsuarioAttributes {
  id_usuario: number;
  unidade_id: number;
  colaborador_id: number;
  cargo_id: number;
  login: string;
  email: string;
  senha_hash: string; // 🔑 PADRONIZADO
  ativo: boolean;
  primeiro_acesso_admin: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UsuarioCreationAttributes
  extends Optional<
    UsuarioAttributes,
    "id_usuario" | "ativo" | "primeiro_acesso_admin"
  > {}

export interface UsuarioModel
  extends Model<UsuarioAttributes, UsuarioCreationAttributes>,
    UsuarioAttributes {
  cargo?: CargoModel;
}

class Usuario
  extends Model<UsuarioAttributes, UsuarioCreationAttributes>
  implements UsuarioAttributes
{
  public id_usuario!: number;
  public unidade_id!: number;
  public colaborador_id!: number;
  public cargo_id!: number;
  public login!: string;
  public email!: string;
  public senha_hash!: string; // 🔑 PADRONIZADO
  public ativo!: boolean;
  public primeiro_acesso_admin!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Usuario.init(
  {
    id_usuario: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    unidade_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    colaborador_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    cargo_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    login: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING(80),
      allowNull: false,
      unique: true,
    },
    senha_hash: {
      // 🔑 CORREÇÃO CRÍTICA: Padronizado para 'senha_hash' para resolver o erro TS2353
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    ativo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    primeiro_acesso_admin: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "USUARIOS",
    modelName: "USUARIOS",
    sequelize: connection,
    timestamps: true,
    underscored: true,
  }
);

(Usuario as any).associate = (models: IModelFactory) => {
  // Associação 1: Usuario PERTENCE A Cargo (N:1)
  if (models.Cargo) {
    Usuario.belongsTo(models.Cargo as any, {
      foreignKey: "cargo_id",
      as: "cargo",
    });
  } // Associação 2: Usuario PERTENCE A Colaborador (1:1/N)

  if (models.Colaborador) {
    Usuario.belongsTo(models.Colaborador as any, {
      foreignKey: "colaborador_id",
      as: "colaborador",
    });
  } // Associação 3: Usuario PERTENCE A Unidade (R4)

  if (models.Unidade) {
    Usuario.belongsTo(models.Unidade as any, {
      foreignKey: "unidade_id",
      as: "unidade",
    });
  }
};

export default Usuario;
