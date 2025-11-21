// src/models/ProducaoRequisicaoInsumo.ts

import { DataTypes, Model, Optional, ModelCtor } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory } from "../config/types";
import { ProducaoRegistroModel } from "./ProducaoRegistro"; // 🔑 Novo nome

type StatusRequisicao =
  | "SOLICITADA"
  | "EM_SEPARACAO"
  | "ENTREGUE"
  | "RECUSADA"
  | "CANCELADA";

export interface ProducaoRequisicaoInsumoAttributes {
  id_requisicao: number;
  id_registro_producao: number;
  colaborador_id_separador: number | null;
  colaborador_id_recebedor: number;
  status_requisicao: StatusRequisicao;
  data_entrega: Date | null;
  data_confirmacao: Date | null;
  observacoes_estoque: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProducaoRequisicaoInsumoCreationAttributes
  extends Optional<
    ProducaoRequisicaoInsumoAttributes,
    | "id_requisicao"
    | "colaborador_id_separador"
    | "status_requisicao"
    | "data_entrega"
    | "data_confirmacao"
    | "observacoes_estoque"
    | "createdAt"
    | "updatedAt"
  > {}

export interface ProducaoRequisicaoInsumoModel
  extends Model<
      ProducaoRequisicaoInsumoAttributes,
      ProducaoRequisicaoInsumoCreationAttributes
    >,
    ProducaoRequisicaoInsumoAttributes {
  registro_producao?: ProducaoRegistroModel; // 🔑 Novo nome
}

const ProducaoRequisicaoInsumo: ModelCtor<ProducaoRequisicaoInsumoModel> =
  connection.define<ProducaoRequisicaoInsumoModel>(
    "ProducaoRequisicaoInsumo",
    {
      /* ... (Campos permanecem os mesmos) ... */
      id_requisicao: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      id_registro_producao: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "id_registro_producao",
      },
      colaborador_id_separador: { type: DataTypes.INTEGER, allowNull: true },
      colaborador_id_recebedor: { type: DataTypes.INTEGER, allowNull: false },
      status_requisicao: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "SOLICITADA",
      },
      data_entrega: { type: DataTypes.DATE, allowNull: true },
      data_confirmacao: { type: DataTypes.DATE, allowNull: true },
      observacoes_estoque: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: "REQUISICOES_INSUMOS",
      timestamps: true,
      modelName: "ProducaoRequisicaoInsumo", // 🔑 Novo nome do Model
    }
  );

(ProducaoRequisicaoInsumo as any).associate = (models: IModelFactory) => {
  // A requisição pertence a um registro de produção (usando o novo nome)
  ProducaoRequisicaoInsumo.belongsTo(
    models.ProducaoRegistro as ModelCtor<ProducaoRegistroModel>,
    {
      foreignKey: "id_registro_producao",
      as: "registro_producao",
    }
  );
};

export default ProducaoRequisicaoInsumo;
