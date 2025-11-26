// src/models/CompraNecessidade.ts

import { DataTypes, Model, Optional, ModelCtor } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory } from "../config/types";
import { ResolvedModelMap } from "../config/associations";
import { ItemEstoqueModel } from "./ItemEstoque";
import ProducaoNecessidade from "./ProducaoNecessidade";

type OrigemNecessidade = "PRODUCAO" | "ESTOQUE_MINIMO" | "MANUAL";

export interface CompraNecessidadeAttributes {
  id_necessidade_compra: number;
  unidade_id: number;
  id_produto: number;
  quantidade_solicitada: number;
  origem: OrigemNecessidade;
  id_origem_referencia: number | null;
  data_solicitacao: Date;
  colaborador_id_solicitante: number;
  data_limite_atendimento: Date | null;
  status_atendimento: "PENDENTE" | "PARCIAL" | "ATENDIDA" | "CANCELADA";
  observacoes: string | null;
}

export interface CompraNecessidadeCreationAttributes
  extends Optional<
    CompraNecessidadeAttributes,
    | "id_necessidade_compra"
    | "id_origem_referencia"
    | "data_limite_atendimento"
    | "status_atendimento"
    | "observacoes"
  > {}

class CompraNecessidade
  extends Model<
    CompraNecessidadeAttributes,
    CompraNecessidadeCreationAttributes
  >
  implements CompraNecessidadeAttributes
{
  public id_necessidade_compra!: number;
  public unidade_id!: number;
  public id_produto!: number;
  public quantidade_solicitada!: number;
  public origem!: OrigemNecessidade;
  public id_origem_referencia!: number | null;
  public data_solicitacao!: Date;
  public colaborador_id_solicitante!: number;
  public data_limite_atendimento!: Date | null;
  public status_atendimento!: "PENDENTE" | "PARCIAL" | "ATENDIDA" | "CANCELADA";
  public observacoes!: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CompraNecessidade.init(
  {
    id_necessidade_compra: {
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
    quantidade_solicitada: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
      get() {
        return parseFloat(this.getDataValue("quantidade_solicitada") as any);
      },
    },
    origem: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    id_origem_referencia: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    data_solicitacao: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    colaborador_id_solicitante: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    data_limite_atendimento: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    status_atendimento: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "PENDENTE",
    },
    observacoes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize: connection,
    modelName: "CompraNecessidade",
    tableName: "PLANEJAMENTO_COMPRA",
    underscored: true,
  }
);

(CompraNecessidade as any).associate = (models: ResolvedModelMap) => {
  CompraNecessidade.belongsTo(
    models.ItemEstoque as ModelCtor<ItemEstoqueModel>,
    {
      foreignKey: "id_produto",
      as: "produto",
    }
  );

  CompraNecessidade.belongsTo(models.ProducaoNecessidade, {
    foreignKey: "id_origem_referencia",
    as: "origemProducao",
  });
};

export default CompraNecessidade;
