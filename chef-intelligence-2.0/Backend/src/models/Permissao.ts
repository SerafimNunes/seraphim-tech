// src/models/Permissao.ts

import { DataTypes, Model, Optional } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory } from "../config/types";
import CargoPermissao from "./CargoPermissao"; // Importa o modelo de junção

export interface PermissaoAttributes {
  id_permissao: number;
  nome_permissao: string; // ⬅️ CORREÇÃO: Renomeado de 'chave' para 'nome_permissao'
  descricao?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PermissaoCreationAttributes
  extends Optional<PermissaoAttributes, "id_permissao"> {}

export interface PermissaoModel
  extends Model<PermissaoAttributes, PermissaoCreationAttributes>,
    PermissaoAttributes {}

const Permissao = connection.define<PermissaoModel>(
  "Permissao",
  {
    id_permissao: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nome_permissao: {
      // ⬅️ CORREÇÃO: Coluna renomeada
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
    },
    descricao: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: "PERMISSOES",
    sequelize: connection,
    timestamps: true,
    modelName: "Permissao",
  } as any
);

(Permissao as any).associate = (models: IModelFactory) => {
  if (!models) return;
  if (models.Cargo && models.CargoPermissao) {
    Permissao.belongsToMany(models.Cargo as any, {
      through: models.CargoPermissao as any,
      foreignKey: "permissao_id",
      otherKey: "cargo_id",
      as: "cargos",
    });
  }
};

export default Permissao;
