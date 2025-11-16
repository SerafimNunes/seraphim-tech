// src/models/ComprasPedido.ts

import { DataTypes, Model, Optional, ModelCtor, ModelOptions } from "sequelize";
import { connection } from "../config/sequelize";

import { IModelFactory, StatusAprovacaoCompras } from "../config/types";
import Fornecedor from "./Fornecedor"; // Importa o VALOR padrão do modelo
import { ComprasItemPedidoModel } from "./ComprasItemPedido";
import { Colaborador } from "./Colaborador";

// 1. Definição das Interfaces
export interface ComprasPedidoAttributes {
  id_pedido: number;
  id_fornecedor: number;
  colaborador_id_sugestao: number;
  colaborador_id_aprovacao: number | null;
  status_aprovacao: StatusAprovacaoCompras;
  data_aprovacao: Date | null;
  data_entrega_prevista: Date | null;
  valor_total_previsto: number;
}

export interface ComprasPedidoCreationAttributes
  extends Optional<
    ComprasPedidoAttributes,
    | "id_pedido"
    | "status_aprovacao"
    | "colaborador_id_aprovacao"
    | "data_aprovacao"
    | "data_entrega_prevista"
    | "valor_total_previsto"
  > {}

export interface ComprasPedidoModel
  extends Model<ComprasPedidoAttributes, ComprasPedidoCreationAttributes>,
    ComprasPedidoAttributes {
  // ✅ CORREÇÃO TS2749: Tipagem de associação para o modelo Sequelize (o valor)
  fornecedor?: typeof Fornecedor;
  sugeridoPor?: Colaborador;
  aprovadoPor?: Colaborador;
  itens?: ComprasItemPedidoModel[];
}

// 2. Definição do Modelo
const ComprasPedido: ModelCtor<ComprasPedidoModel> = connection.define<
  ComprasPedidoModel,
  ComprasPedidoCreationAttributes
>(
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
      // ✅ CORREÇÃO TS2345: Usa as literais de string diretamente
      type: DataTypes.ENUM(
        "SUGERIDO",
        "EM_COTACAO",
        "APROVADO",
        "REPROVADO",
        "CANCELADO",
        "FINALIZADO"
      ),
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
  // 3. Uso de ModelOptions (resolve TS2353)
  {
    tableName: "PEDIDOS_COMPRA",
    sequelize: connection,
    timestamps: true,
    modelName: "ComprasPedido",
  } as ModelOptions<ComprasPedidoModel>
);

// Associações
(ComprasPedido as any).associate = function (models: IModelFactory) {
  if (models.Fornecedor) {
    ComprasPedido.belongsTo(models.Fornecedor, {
      foreignKey: "id_fornecedor",
      as: "fornecedor",
    });
  }
  if (models.Colaborador) {
    ComprasPedido.belongsTo(models.Colaborador, {
      foreignKey: "colaborador_id_sugestao",
      as: "sugeridoPor",
    });
    ComprasPedido.belongsTo(models.Colaborador, {
      foreignKey: "colaborador_id_aprovacao",
      as: "aprovadoPor",
    });
  }
  if (models.ComprasItemPedido) {
    ComprasPedido.hasMany(models.ComprasItemPedido, {
      foreignKey: "id_pedido",
      as: "itens",
    });
  }
};

export default ComprasPedido;

// Interfaces são exportadas na definição (export interface...), resolvendo TS2484
