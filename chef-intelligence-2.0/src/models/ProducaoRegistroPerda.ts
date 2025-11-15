// src/models/ProducaoRegistroPerda.ts

import { DataTypes, Model, Optional, ModelCtor } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory } from "../config/types";
import { ItemEstoqueModel } from "./ItemEstoque";

type TipoPerda =
  | "QUEBRA"
  | "VALIDADE"
  | "ERRO_PRODUCAO"
  | "ERRO_VENDA"
  | "OUTROS";

export interface ProducaoRegistroPerdaAttributes {
  id_registro_perda: number;
  id_produto: number;
  quantidade_perdida: number;
  custo_unitario_na_hora: number;
  custo_total_perda: number;
  colaborador_id: number | null;
  tipo_perda: TipoPerda;
  observacoes: string | null;
  data_registro: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProducaoRegistroPerdaCreationAttributes
  extends Optional<
    ProducaoRegistroPerdaAttributes,
    | "id_registro_perda"
    | "custo_total_perda"
    | "colaborador_id"
    | "observacoes"
    | "data_registro"
    | "createdAt"
    | "updatedAt"
  > {}

export interface ProducaoRegistroPerdaModel
  extends Model<
      ProducaoRegistroPerdaAttributes,
      ProducaoRegistroPerdaCreationAttributes
    >,
    ProducaoRegistroPerdaAttributes {
  produto?: ItemEstoqueModel;
}

const ProducaoRegistroPerda: ModelCtor<ProducaoRegistroPerdaModel> =
  connection.define<ProducaoRegistroPerdaModel>(
    "ProducaoRegistroPerda",
    {
      /* ... (Campos permanecem os mesmos) ... */
      id_registro_perda: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      id_produto: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "id_produto",
      },
      quantidade_perdida: { type: DataTypes.DECIMAL(10, 3), allowNull: false },
      custo_unitario_na_hora: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      custo_total_perda: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      colaborador_id: { type: DataTypes.INTEGER, allowNull: true },
      tipo_perda: { type: DataTypes.STRING(50), allowNull: false },
      observacoes: { type: DataTypes.TEXT, allowNull: true },
      data_registro: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "REGISTRO_PERDAS",
      timestamps: true,
      modelName: "ProducaoRegistroPerda", // 🔑 Novo nome do Model
    }
  );

(ProducaoRegistroPerda as any).associate = (models: IModelFactory) => {
  ProducaoRegistroPerda.belongsTo(
    models.ItemEstoque as ModelCtor<ItemEstoqueModel>,
    {
      foreignKey: "id_produto",
      as: "produto",
    }
  );
};

export default ProducaoRegistroPerda;
