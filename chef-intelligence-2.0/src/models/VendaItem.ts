import { DataTypes, Model, Optional } from "sequelize";
import { connection } from "../config/sequelize";
// 🔑 R6: Importa modelos renomeados
import VendaComanda from "./VendaComanda";
// 🔑 Importa ItemEstoque (assumindo que existe)
import ItemEstoque, { ItemEstoqueModel } from "./ItemEstoque";

export type StatusItem = "ABERTO" | "PREPARANDO" | "ENTREGUE" | "CANCELADO";

export interface VendaItemAttributes {
  id_item_venda: number;
  id_venda: number; // Chave para VendaComanda
  id_produto: number;
  quantidade: number;
  preco_unitario: number;
  preco_venda_total: number;
  custo_total: number; // CMV do Item
  status_item: StatusItem;
}

export interface VendaItemCreationAttributes
  extends Optional<
    VendaItemAttributes,
    "id_item_venda" | "preco_venda_total" | "custo_total" | "status_item"
  > {}

// 🔑 R6: Renomeado para VendaItem
export class VendaItem
  extends Model<VendaItemAttributes, VendaItemCreationAttributes>
  implements VendaItemAttributes
{
  public id_item_venda!: number;
  public id_venda!: number;
  public id_produto!: number;
  public quantidade!: number;
  public preco_unitario!: number;
  public preco_venda_total!: number;
  public custo_total!: number;
  public status_item!: StatusItem;

  public readonly produto?: ItemEstoqueModel;
  public readonly venda?: VendaComanda; // 🔑 R6: Atualiza a tipagem de associação // timestamps

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

VendaItem.init(
  {
    id_item_venda: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_venda: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "VENDAS", key: "id_venda" },
    },
    id_produto: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "PRODUTOS", key: "id_produto" },
    },
    quantidade: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
      // 🔑 R1: Getter para número
      get() {
        return parseFloat(this.getDataValue("quantidade") as unknown as string);
      },
    },
    preco_unitario: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      // 🔑 R1: Getter para número
      get() {
        return parseFloat(
          this.getDataValue("preco_unitario") as unknown as string
        );
      },
    },
    preco_venda_total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      // 🔑 R1: Getter para número
      get() {
        return parseFloat(
          this.getDataValue("preco_venda_total") as unknown as string
        );
      },
    },
    custo_total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      // 🔑 R1: Getter para número
      get() {
        return parseFloat(
          this.getDataValue("custo_total") as unknown as string
        );
      },
    },
    status_item: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "ABERTO",
    },
  },
  {
    tableName: "ITENS_VENDA",
    sequelize: connection,
    timestamps: true,
    modelName: "VendaItem", // R6
  }
);

(VendaItem as any).associate = function (models: any) {
  VendaItem.belongsTo(VendaComanda, {
    foreignKey: "id_venda",
    as: "venda",
  });
  VendaItem.belongsTo(ItemEstoque, {
    foreignKey: "id_produto",
    as: "produto",
  });
};

export default VendaItem;
