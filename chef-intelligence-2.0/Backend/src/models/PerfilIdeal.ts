import { DataTypes, Model, Optional, ModelCtor } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory } from "../config/types";
import { CargoModel } from "./Cargo";

// Definição dos Atributos (R1)
export interface PerfilIdealAttributes {
  id_perfil: number;
  cargo_id: number;
  competencia_id: number; // ID de uma tabela de competências ou Enum mapeado
  nivel_minimo?: number; // Ex: 1 a 5
  peso?: number; // Para cálculo de score
  createdAt?: Date;
  updatedAt?: Date;
}

// Atributos opcionais na criação (ID é auto-increment)
export interface PerfilIdealCreationAttributes
  extends Optional<PerfilIdealAttributes, "id_perfil"> {}

// Interface do Modelo
export interface PerfilIdealModel
  extends Model<PerfilIdealAttributes, PerfilIdealCreationAttributes>,
    PerfilIdealAttributes {
  // Associações
  cargo?: CargoModel;
}

const PerfilIdeal: ModelCtor<PerfilIdealModel> =
  connection.define<PerfilIdealModel>(
    "PerfilIdeal",
    {
      id_perfil: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      cargo_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "CARGOS", // Nome da tabela
          key: "id_cargo",
        },
      },
      competencia_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      nivel_minimo: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1,
      },
      peso: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1,
      },
    },
    {
      tableName: "PERFIL_IDEAL",
      timestamps: true,
      modelName: "PerfilIdeal",
    }
  );

// Associação (R4/R12)
(PerfilIdeal as any).associate = (models: IModelFactory) => {
  if (models.Cargo) {
    PerfilIdeal.belongsTo(models.Cargo as any, {
      foreignKey: "cargo_id",
      as: "cargo",
    });
  }
};

export default PerfilIdeal;
