// src/models/Colaborador.ts

import { DataTypes, Model, Optional, ModelCtor, ModelOptions } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory, NivelAcesso, StatusColaborador } from "../config/types";
import { CargoModel } from "./Cargo"; // Importa CargoModel para tipagem de associação

// Interfaces (mantidas)
export interface ColaboradorAttributes {
  // ...
}
export interface ColaboradorCreationAttributes
  extends Optional<ColaboradorAttributes, "id_colaborador" | "status"> {}
export interface ColaboradorModel
  extends Model<ColaboradorAttributes, ColaboradorCreationAttributes>,
    ColaboradorAttributes {
  cargo?: CargoModel;
}

// ✅ CORREÇÃO TS2314/TS2353: Uso correto de genéricos e ModelOptions
const Colaborador: ModelCtor<ColaboradorModel> = connection.define<
  ColaboradorModel,
  ColaboradorCreationAttributes
>(
  "Colaborador",
  {
    id_colaborador: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nome_completo: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    nivel_acesso: {
      type: DataTypes.ENUM("COLABORADOR", "GESTOR", "ADMIN"),
      allowNull: false,
      defaultValue: "COLABORADOR",
    },
    cargo_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("ATIVO", "AFASTADO", "DESLIGADO"),
      allowNull: false,
      defaultValue: "ATIVO",
    },
    data_contratacao: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
  },
  // Correção do erro TS2353
  {
    tableName: "COLABORADORES",
    sequelize: connection,
    timestamps: true,
    modelName: "Colaborador",
  } as ModelOptions<ColaboradorModel>
);

// Associações (mantidas)
(Colaborador as any).associate = function (models: IModelFactory) {
  /* ... */
};

export default Colaborador;
// ✅ CORREÇÃO TS2614: Exportar as interfaces nomeadas
export {
  ColaboradorModel,
  ColaboradorAttributes,
  ColaboradorCreationAttributes,
};
