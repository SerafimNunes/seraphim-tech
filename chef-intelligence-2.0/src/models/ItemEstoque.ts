// src/models/ItemEstoque.ts
import { DataTypes, Model, Optional, ModelCtor } from 'sequelize';
import { connection } from '../config/sequelize';
import { IModelFactory } from '../config/types';

export interface ItemEstoqueAttributes {
  id_item: number;
  unidade_id: number;
  nome: string;
  unidade_medida: string;
  estoque_atual: number;
  estoque_minimo: number;
  preco_custo_unitario: number;
  preco_venda: number;
  is_vendavel: boolean;
  is_pre_pronto: boolean;
  tipo_item: 'INGREDIENTE' | 'PRODUCAO' | 'PRODUTO_FINAL';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ItemEstoqueCreationAttributes
  extends Optional<
    ItemEstoqueAttributes,
    | 'id_item'
    | 'estoque_atual'
    | 'preco_custo_unitario'
    | 'preco_venda'
    | 'estoque_minimo'
  > {}

export interface ItemEstoqueModel
  extends Model<ItemEstoqueAttributes, ItemEstoqueCreationAttributes>,
    ItemEstoqueAttributes {
  // virtual getters
  getSaldoAtual(): number;
  getProntoPedido(): number;
}

const ItemEstoque: ModelCtor<ItemEstoqueModel> =
  connection.define<ItemEstoqueModel>(
    'ItemEstoque',
    {
      id_item: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id_item',
      },
      unidade_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'ID da Unidade de negócio (Regra R4)',
        references: { model: 'UNIDADES', key: 'id_unidade' },
      },
      nome: { type: DataTypes.STRING(100), allowNull: false },
      unidade_medida: { type: DataTypes.STRING(20), allowNull: false },
      tipo_item: {
        type: DataTypes.ENUM('INGREDIENTE', 'PRODUCAO', 'PRODUTO_FINAL'),
        allowNull: false,
        defaultValue: 'INGREDIENTE',
      },
      estoque_atual: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 0,
        get() {
          return parseFloat(
            this.getDataValue('estoque_atual') as unknown as string,
          );
        },
      },
      estoque_minimo: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 0,
        get() {
          return parseFloat(
            this.getDataValue('estoque_minimo') as unknown as string,
          );
        },
      },
      preco_custo_unitario: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        get() {
          return parseFloat(
            this.getDataValue('preco_custo_unitario') as unknown as string,
          );
        },
      },
      preco_venda: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        get() {
          return parseFloat(
            this.getDataValue('preco_venda') as unknown as string,
          );
        },
      },
      is_vendavel: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      is_pre_pronto: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      // virtuals
      saldo_atual: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('estoque_atual');
        },
      },
      pronto_pedido: {
        type: DataTypes.VIRTUAL,
        get() {
          const atual = this.getDataValue('estoque_atual') || 0;
          const minimo = this.getDataValue('estoque_minimo') || 0;
          return atual - minimo;
        },
      },
    },
    {
      tableName: 'PRODUTOS',
      timestamps: true,
      modelName: 'ItemEstoque',
    } as any,
  );

(ItemEstoque as any).associate = function (models: IModelFactory) {
  const UnidadeModel = models.Unidade as ModelCtor<any> | undefined;
  const VendaItemModel = models.VendaItem as ModelCtor<any> | undefined;
  const EstoqueRegistroModel = models.EstoqueRegistroMovimento as
    | ModelCtor<any>
    | undefined;
  const FichaTecnicaModel = models.FichaTecnica as ModelCtor<any> | undefined;

  if (UnidadeModel) {
    ItemEstoque.belongsTo(UnidadeModel, {
      foreignKey: 'unidade_id',
      as: 'unidade',
    });
  }
  if (VendaItemModel) {
    ItemEstoque.hasMany(VendaItemModel, {
      foreignKey: 'id_produto',
      as: 'vendaItems',
    });
  }
  if (EstoqueRegistroModel) {
    ItemEstoque.hasMany(EstoqueRegistroModel, {
      foreignKey: 'id_item',
      as: 'movimentos',
    });
  }
  if (FichaTecnicaModel) {
    ItemEstoque.hasMany(FichaTecnicaModel, {
      foreignKey: 'id_produto_pai',
      as: 'fichaTecnica',
    });
  }
};

export default ItemEstoque;
