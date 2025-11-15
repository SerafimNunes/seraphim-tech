// src/models/ComprasPedido.ts

import { DataTypes, Model, Optional, ModelCtor } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory } from "../config/types";
import { FornecedorModel } from "./Fornecedor";
import { ComprasItemPedidoModel } from "./ComprasItemPedido"; // ✅ Import resolvido

export type StatusAprovacao =
  | "SUGERIDO"
  | "EM_COTACAO"
  | "APROVADO"
  | "REPROVADO"
  | "CANCELADO"
  | "FINALIZADO";

export interface ComprasPedidoAttributes {
  id_pedido: number;
  id_fornecedor: number;
  colaborador_id_sugestao: number;
  colaborador_id_aprovacao: number | null;
  status_aprovacao: StatusAprovacao;
  data_aprovacao: Date | null;
  data_entrega_prevista: Date | null;
  valor_total_previsto: number;
}

export interface ComprasPedidoCreationAttributes
  extends Optional<
    ComprasPedidoAttributes,
    | "id_pedido"
    | "colaborador_id_aprovacao"
    | "status_aprovacao"
    | "data_aprovacao"
    | "data_entrega_prevista"
  > {}

export interface ComprasPedidoModel
  extends Model<ComprasPedidoAttributes, ComprasPedidoCreationAttributes>,
    ComprasPedidoAttributes {
  fornecedor?: FornecedorModel;
  itens?: ComprasItemPedidoModel[];
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

const ComprasPedido: ModelCtor<ComprasPedidoModel> =
  connection.define<ComprasPedidoModel>(
    "ComprasPedido",
    {
      id_pedido: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      id_fornecedor: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "FORNECEDORES",
          key: "id_fornecedor",
        },
      },
      colaborador_id_sugestao: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      colaborador_id_aprovacao: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      status_aprovacao: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "SUGERIDO",
      },
      data_aprovacao: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      data_entrega_prevista: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      valor_total_previsto: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
        get() {
          return parseFloat(
            this.getDataValue("valor_total_previsto") as unknown as string
          );
        },
      },
    },
    {
      tableName: "PEDIDOS_COMPRA",
      sequelize: connection,
      timestamps: true,
      modelName: "ComprasPedido",
    } as any // 🔑 CAST EXPLÍCITO para resolver o ERRO 2353
  );

(ComprasPedido as any).associate = function (models: IModelFactory) {
  ComprasPedido.belongsTo(models.Fornecedor as ModelCtor<FornecedorModel>, {
    foreignKey: "id_fornecedor",
    as: "fornecedor",
  });

  ComprasPedido.hasMany(
    models.ComprasItemPedido as ModelCtor<ComprasItemPedidoModel>,
    {
      foreignKey: "id_pedido",
      as: "itens",
    }
  );
};

export default ComprasPedido;
