// src/models/ItemEstoque.ts
import { DataTypes, Model, Optional, ModelCtor } from 'sequelize';
import { connection } from '../config/sequelize';
import Unidade from './Unidade';
import { IModelFactory } from '../config/types';

export interface ItemEstoqueAttributes {
  id_item: number;
  id_produto: number; // será mapeado para id_item via field
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
    'id_item' | 'id_produto' | 'estoque_atual' | 'preco_custo_unitario'
  > {}

export interface ItemEstoqueModel
  extends Model<ItemEstoqueAttributes, ItemEstoqueCreationAttributes>,
    ItemEstoqueAttributes {
  unidade?: typeof Unidade;
  // métodos convenientes
  getSaldoAtual(): number;
  getProntoPedido(): number;
}

export const ItemEstoque: ModelCtor<ItemEstoqueModel> =
  connection.define<ItemEstoqueModel>(
    'ItemEstoque',
    {
      id_item: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id_item',
      },
      // Expor id_produto que faz where funcionar.
      id_produto: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'id_item', // mapeia para a mesma coluna física
        get() {
          return this.getDataValue('id_item');
        },
      },
      unidade_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'ID da Unidade de negócio (Regra R4)',
        references: { model: 'Unidades', key: 'id_unidade' },
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
          const v = this.getDataValue('estoque_atual') as unknown as
            | string
            | number;
          return v === null || v === undefined ? 0 : parseFloat(String(v));
        },
      },
      estoque_minimo: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 0,
        get() {
          const v = this.getDataValue('estoque_minimo') as unknown as
            | string
            | number;
          return v === null || v === undefined ? 0 : parseFloat(String(v));
        },
      },
      preco_custo_unitario: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        get() {
          const v = this.getDataValue('preco_custo_unitario') as unknown as
            | string
            | number;
          return v === null || v === undefined ? 0 : parseFloat(String(v));
        },
      },
      preco_venda: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        get() {
          const v = this.getDataValue('preco_venda') as unknown as
            | string
            | number;
          return v === null || v === undefined ? 0 : parseFloat(String(v));
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
    },
    {
      tableName: 'PRODUTOS',
      timestamps: true,
      modelName: 'ItemEstoque',
      // Não coloquei `sequelize: connection` (remove para agradar ModelOptions)
    } as any,
  );

// Métodos utilitários (define via prototype)
(ItemEstoque as any).prototype.getSaldoAtual = function () {
  return (this.getDataValue('estoque_atual') as unknown as number) || 0;
};
(ItemEstoque as any).prototype.getProntoPedido = function () {
  const estoqueAtual =
    (this.getDataValue('estoque_atual') as unknown as number) || 0;
  const estoqueMinimo =
    (this.getDataValue('estoque_minimo') as unknown as number) || 0;
  return estoqueAtual - estoqueMinimo;
};

(ItemEstoque as any).associate = (models: IModelFactory) => {
  if (!models || !models.Unidade) return;
  ItemEstoque.belongsTo(models.Unidade as any, {
    foreignKey: 'unidade_id',
    as: 'unidade',
  });
};

export default ItemEstoque;
