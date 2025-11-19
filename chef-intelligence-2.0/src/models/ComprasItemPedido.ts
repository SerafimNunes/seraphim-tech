import { DataTypes, Model, Optional, ModelCtor } from 'sequelize';
import { connection } from '../config/sequelize';
import { IModelFactory } from '../config/types';
// Assumindo que o ItemEstoque existe no path correto para resolver 2307

import { ItemEstoqueModel } from './ItemEstoque';
import { ComprasPedidoModel } from './ComprasPedido';

export type StatusQualidade =
  | 'PENDENTE'
  | 'APROVADO'
  | 'REPROVADO'
  | 'DEVOLVIDO';

export interface ComprasItemPedidoAttributes {
  id_item_pedido: number;
  id_pedido: number;
  id_produto: number;
  quantidade_prevista: number; // DECIMAL(10, 2)
  preco_custo_unitario_previsto: number; // DECIMAL(10, 2)
  quantidade_recebida: number; // DECIMAL(10, 2)
  preco_custo_unitario_real: number | null; // DECIMAL(10, 2)
  status_qualidade: StatusQualidade;
}

export interface ComprasItemPedidoCreationAttributes
  extends Optional<
    ComprasItemPedidoAttributes,
    | 'id_item_pedido'
    | 'status_qualidade'
    | 'quantidade_recebida'
    | 'preco_custo_unitario_real'
  > {}

export interface ComprasItemPedidoModel
  extends Model<
      ComprasItemPedidoAttributes,
      ComprasItemPedidoCreationAttributes
    >,
    ComprasItemPedidoAttributes {
  produto?: ItemEstoqueModel;
  pedido?: ComprasPedidoModel;
}

export const ComprasItemPedido: ModelCtor<ComprasItemPedidoModel> =
  connection.define<ComprasItemPedidoModel>(
    'ComprasItemPedido',
    {
      id_item_pedido: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      id_pedido: { type: DataTypes.INTEGER, allowNull: false },
      id_produto: { type: DataTypes.INTEGER, allowNull: false },
      // 🔑 GPR-4: DECIMAL fields com Getter para garantir tipo 'number'
      quantidade_prevista: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        get() {
          return parseFloat(
            this.getDataValue('quantidade_prevista') as unknown as string,
          );
        },
      },
      // 🔑 GPR-4: DECIMAL fields com Getter para garantir tipo 'number'
      preco_custo_unitario_previsto: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        get() {
          return parseFloat(
            this.getDataValue(
              'preco_custo_unitario_previsto',
            ) as unknown as string,
          );
        },
      },
      // 🔑 GPR-4: DECIMAL fields com Getter para garantir tipo 'number'
      quantidade_recebida: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        get() {
          return parseFloat(
            this.getDataValue('quantidade_recebida') as unknown as string,
          );
        },
      },
      // 🔑 GPR-4: DECIMAL fields com Getter para garantir tipo 'number'
      preco_custo_unitario_real: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        get() {
          const value = this.getDataValue('preco_custo_unitario_real');
          if (value === null) return null;
          return parseFloat(value as unknown as string);
        },
      },
      status_qualidade: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'PENDENTE',
      },
    },
    {
      tableName: 'COMPRAS_ITENS_PEDIDO',
      sequelize: connection,
      timestamps: true,
      modelName: 'ComprasItemPedido',
    } as any, // 🔑 CAST EXPLÍCITO para resolver o ERRO 2353
  );

(ComprasItemPedido as any).associate = function (models: IModelFactory) {
  ComprasItemPedido.belongsTo(
    models.ComprasPedido as ModelCtor<ComprasPedidoModel>,
    {
      foreignKey: 'id_pedido',
      as: 'pedido',
    },
  );
  ComprasItemPedido.belongsTo(
    models.ItemEstoque as ModelCtor<ItemEstoqueModel>,
    {
      foreignKey: 'id_produto',
      as: 'produto',
    },
  );
};

export default ComprasItemPedido;
