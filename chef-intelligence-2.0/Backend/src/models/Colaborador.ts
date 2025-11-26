// src/models/Colaborador.ts
import {
  DataTypes,
  Model,
  Optional,
  ModelCtor,
} from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory } from "../config/types";
import { CargoModel } from "./Cargo";

export type NivelAcessoType = "COLABORADOR" | "GESTOR" | "ADMIN";
export type StatusColaboradorType = "ATIVO" | "AFASTADO" | "DESLIGADO";

export interface ColaboradorAttributes {
  id_colaborador: number;
  unidade_id: number;
  nome_completo: string;
  email: string;
  nivel_acesso: NivelAcessoType;
  cargo_id: number;
  Status: StatusColaboradorType;
  data_contratacao: Date;
  // 🔑 CORRIGIDO: Adicionado campo data_desligamento para resolver erros no RHService/DashboardService
  data_desligamento?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ColaboradorCreationAttributes
  extends Optional<ColaboradorAttributes, "id_colaborador" | "Status" | "data_desligamento"> {}

export interface ColaboradorModel
  extends Model<ColaboradorAttributes, ColaboradorCreationAttributes>,
    ColaboradorAttributes {
  cargo?: CargoModel;
}

const Colaborador: ModelCtor<ColaboradorModel> =
  connection.define<ColaboradorModel>(
    "Colaborador",
    {
      id_colaborador: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      unidade_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
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
      Status: {
        type: DataTypes.ENUM("ATIVO", "AFASTADO", "DESLIGADO"),
        allowNull: false,
        defaultValue: "ATIVO",
      },
      data_contratacao: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      // 🔑 CORRIGIDO: Mapeamento do campo data_desligamento
      data_desligamento: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
    },
    {
      tableName: "COLABORADORES",
      timestamps: true,
      modelName: "Colaborador",
    }
  );

(Colaborador as any).associate = function (models: IModelFactory) {
  const CargoModel = models.Cargo as any;

  if (CargoModel) {
    Colaborador.belongsTo(CargoModel, {
      foreignKey: "cargo_id",
      as: "cargo",
    });
  }
};

export default Colaborador;