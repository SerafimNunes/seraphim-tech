// src/models/VendaItem.ts
import { DataTypes, Model, Optional, ModelCtor } from 'sequelize';
import { connection } from '../config/sequelize';
import { IModelFactory } from '../config/types';

export type StatusItem = 'ABERTO' | 'PREPARANDO' | 'ENTREGUE' | 'CANCELADO';

export interface VendaItemAttributes {
  id_item_venda: number;
  unidade_id: number;
  id_venda: number;
  id_produto: number;
  quantidade: number;
  preco_unitario: number;
  preco_venda_total: number;
  custo_total: number;
  status_item: StatusItem;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface VendaItemCreationAttributes
  extends Optional<
    VendaItemAttributes,
    'id_item_venda' | 'preco_venda_total' | 'custo_total' | 'status_item'
  > {}

export interface VendaItemModel
  extends Model<VendaItemAttributes, VendaItemCreationAttributes>,
    VendaItemAttributes {}

const VendaItem: ModelCtor<VendaItemModel> = connection.define<VendaItemModel>(
  'VendaItem',
  {
    id_item_venda: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    unidade_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'ID da Unidade de negócio (Regra R4)',
    },
    id_venda: { type: DataTypes.INTEGER, allowNull: false },
    id_produto: { type: DataTypes.INTEGER, allowNull: false },
    quantidade: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
      get() {
        return parseFloat(this.getDataValue('quantidade') as unknown as string);
      },
    },
    preco_unitario: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      get() {
        return parseFloat(
          this.getDataValue('preco_unitario') as unknown as string,
        );
      },
    },
    preco_venda_total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      get() {
        return parseFloat(
          this.getDataValue('preco_venda_total') as unknown as string,
        );
      },
    },
    custo_total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      get() {
        return parseFloat(
          this.getDataValue('custo_total') as unknown as string,
        );
      },
    },
    status_item: {
      type: DataTypes.ENUM('ABERTO', 'PREPARANDO', 'ENTREGUE', 'CANCELADO'),
      allowNull: false,
      defaultValue: 'ABERTO',
    },
  },
  {
    tableName: 'ITENS_VENDA',
    sequelize: connection,
    timestamps: true,
    modelName: 'VendaItem',
  } as any,
);

(VendaItem as any).associate = function (models: IModelFactory) {
  const UnidadeModel = models.Unidade as ModelCtor<any> | undefined;
  const VendaComandaModel = models.VendaComanda as ModelCtor<any> | undefined;
  const ItemEstoqueModel = models.ItemEstoque as ModelCtor<any> | undefined;
  const VendaImpostoModel = models.VendaImposto as ModelCtor<any> | undefined;
  const VendaComissaoModel = models.VendaComissao as ModelCtor<any> | undefined;

  if (UnidadeModel) {
    VendaItem.belongsTo(UnidadeModel, {
      foreignKey: 'unidade_id',
      as: 'unidade',
    });
  }
  if (VendaComandaModel) {
    VendaItem.belongsTo(VendaComandaModel, {
      foreignKey: 'id_venda',
      as: 'vendaComanda',
    });
  }
  if (ItemEstoqueModel) {
    VendaItem.belongsTo(ItemEstoqueModel, {
      foreignKey: 'id_produto',
      as: 'itemEstoque',
    });
  }
  if (VendaImpostoModel) {
    VendaItem.hasMany(VendaImpostoModel, {
      foreignKey: 'id_venda_item',
      as: 'impostos',
    });
  }
  if (VendaComissaoModel) {
    VendaItem.hasMany(VendaComissaoModel, {
      foreignKey: 'id_venda_item',
      as: 'comissoes',
    });
  }
};

export default VendaItem;
