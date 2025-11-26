// src/models/ProducaoNecessidade.ts

import { DataTypes, Model, Optional, ModelCtor } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory } from "../config/types";
import { ItemEstoqueModel } from "./ItemEstoque";

type TipoNecessidade = "PREVISAO_VENDA" | "PEDIDO_CLIENTE" | "ESTOQUE_MINIMO";

export interface ProducaoNecessidadeAttributes {
  id_necessidade: number;
  unidade_id: number;
  id_produto: number;
  quantidade_necessaria: number;
  tipo_necessidade: TipoNecessidade;
  data_necessidade: Date;
  colaborador_id_registro: number;
  observacoes: string | null;
  status_atendimento: "PENDENTE" | "PARCIAL" | "ATENDIDA" | "CANCELADA";
}

export interface ProducaoNecessidadeCreationAttributes
  extends Optional<
    ProducaoNecessidadeAttributes,
    "id_necessidade" | "observacoes" | "status_atendimento"
  > {}

class ProducaoNecessidade
  extends Model<
    ProducaoNecessidadeAttributes,
    ProducaoNecessidadeCreationAttributes
  >
  implements ProducaoNecessidadeAttributes
{
  public id_necessidade!: number;
  public unidade_id!: number;
  public id_produto!: number;
  public quantidade_necessaria!: number;
  public tipo_necessidade!: TipoNecessidade;
  public data_necessidade!: Date;
  public colaborador_id_registro!: number;
  public observacoes!: string | null;
  public status_atendimento!: "PENDENTE" | "PARCIAL" | "ATENDIDA" | "CANCELADA";

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ProducaoNecessidade.init(
  {
    id_necessidade: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    unidade_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    id_produto: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    quantidade_necessaria: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
      get() {
        return parseFloat(this.getDataValue("quantidade_necessaria") as any);
      },
    },
    tipo_necessidade: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    data_necessidade: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    colaborador_id_registro: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    observacoes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status_atendimento: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "PENDENTE",
    },
  },
  {
    sequelize: connection,
    tableName: "PLANEJAMENTO_PRODUCAO",
    modelName: "ProducaoNecessidade",
    underscored: true,
  }
);

(ProducaoNecessidade as any).associate = (models: IModelFactory) => {
  ProducaoNecessidade.belongsTo(
    models.ItemEstoque as ModelCtor<ItemEstoqueModel>,
    {
      foreignKey: "id_produto",
      as: "produto",
    }
  );
};

export default ProducaoNecessidade;
