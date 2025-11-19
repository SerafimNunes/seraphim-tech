import { DataTypes, Model, Optional, ModelCtor } from 'sequelize';
import { connection } from '../config/sequelize';
// 🔑 Importa Unidade para associação (R4)
import Unidade from './Unidade';
// 🔑 CORREÇÃO: Importa apenas VendaComanda (default export)
import VendaComanda from './VendaComanda';
// Importa ItemEstoque (assumindo que existe)
import ItemEstoque, { ItemEstoqueModel } from './ItemEstoque';
import { IModelFactory } from '../config/types'; // Assumindo que você usa IModelFactory

export type StatusItem = 'ABERTO' | 'PREPARANDO' | 'ENTREGUE' | 'CANCELADO';

export interface VendaItemAttributes {
  id_item_venda: number;
  unidade_id: number; // 🔑 R4: Adicionada a chave de unidade
  id_venda: number; // Chave para VendaComanda
  id_produto: number;
  quantidade: number; // DECIMAL
  preco_unitario: number; // DECIMAL
  preco_venda_total: number;
  custo_total: number; // CMV do Item
  status_item: StatusItem;
}

export interface VendaItemCreationAttributes
  extends Optional<
    VendaItemAttributes,
    'id_item_venda' | 'preco_venda_total' | 'custo_total' | 'status_item'
  > {}

// Tipagem do Modelo VendaComanda (VendaComandaModel é exportado como default)
export interface VendaItemModel
  extends Model<VendaItemAttributes, VendaItemCreationAttributes>,
    VendaItemAttributes {
  unidade?: typeof Unidade;
  vendaComanda?: typeof VendaComanda;
  produto?: ItemEstoqueModel;
}

export const VendaItem: ModelCtor<VendaItemModel> =
  connection.define<VendaItemModel>(
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
        references: { model: 'Unidades', key: 'id_unidade' },
      },
      id_venda: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'VENDAS', key: 'id_venda' },
      },
      id_produto: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'PRODUTOS', key: 'id_item' },
      },
      // 🔑 GPR-4: Adicionando Getters
      quantidade: {
        type: DataTypes.DECIMAL(10, 3), // Assumindo 3 casas decimais
        allowNull: false,
        get() {
          return parseFloat(
            this.getDataValue('quantidade') as unknown as string,
          );
        },
      },
      // 🔑 GPR-4: Adicionando Getters
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
        defaultValue: 0.0, // 🔑 R1: Getter para número
        get() {
          return parseFloat(
            this.getDataValue('preco_venda_total') as unknown as string,
          );
        },
      },
      custo_total: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0, // 🔑 R1: Getter para número
        get() {
          return parseFloat(
            this.getDataValue('custo_total') as unknown as string,
          );
        },
      },
      status_item: {
        type: DataTypes.ENUM<StatusItem>(
          'ABERTO',
          'PREPARANDO',
          'ENTREGUE',
          'CANCELADO',
        ), // Ajustado para ENUM
        allowNull: false,
        defaultValue: 'ABERTO',
      },
    },
    {
      tableName: 'ITENS_VENDA',
      sequelize: connection,
      timestamps: true,
      modelName: 'VendaItem', // R6
    },
  );

(VendaItem as any).associate = function (models: IModelFactory) {
  // 🔑 R4: Associa com a Unidade
  VendaItem.belongsTo(models.Unidade, {
    foreignKey: 'unidade_id',
    as: 'unidade',
  });
  // Associa com VendaComanda
  VendaItem.belongsTo(models.VendaComanda, {
    foreignKey: 'id_venda',
    as: 'vendaComanda',
  });
  // Associa com ItemEstoque (Produto)
  VendaItem.belongsTo(models.ItemEstoque, {
    foreignKey: 'id_produto',
    as: 'produto',
  });
};

export default VendaItem;
