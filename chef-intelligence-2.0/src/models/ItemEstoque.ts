import { DataTypes, Model, Optional, ModelCtor, Sequelize } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory } from "../config/types";
import Unidade from "./Unidade";

// R1. Interface para Atributos
export interface ItemEstoqueAttributes {
  id_item: number;
  unidade_id: number;
  id_produto: number; // Mapeia para id_item via getter/field
  nome: string;
  unidade_medida: string;
  estoque_atual: number;
  estoque_minimo: number;
  preco_custo_unitario: number;
  preco_venda: number;
  is_vendavel: boolean;
  is_pre_pronto: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  saldo_atual: number; // Atributo virtual (R11)
  pronto_pedido: number; // Atributo virtual (R11)
  tipo_item: "INGREDIENTE" | "PRODUCAO" | "PRODUTO_FINAL";
}

// R2. Interface para Criação
export interface ItemEstoqueCreationAttributes
  extends Optional<
    ItemEstoqueAttributes,
    | "id_produto"
    | "estoque_atual"
    | "preco_custo_unitario"
    | "createdAt"
    | "updatedAt"
  > {}

// R3. Interface do Modelo
export interface ItemEstoqueModel
  extends Model<ItemEstoqueAttributes, ItemEstoqueCreationAttributes>,
    ItemEstoqueAttributes {}

// R4. Criação e Exportação do Modelo
const ItemEstoque: ModelCtor<ItemEstoqueModel> =
  connection.define<ItemEstoqueModel>(
    "ItemEstoque",
    {
      // 1. CHAVE PRIMÁRIA (R4, R1): id_item da interface mapeado para id_produto do BD
      id_item: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: "id_produto",
      },

      // 🔑 FIX CRÍTICO: id_produto definido como VIRTUAL para satisfazer o TS2345
      id_produto: {
        type: DataTypes.VIRTUAL,
      },

      // 2. R4 FIX: Campo unidade_id
      unidade_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: Unidade,
          key: "id_unidade",
        },
      },

      nome: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      unidade_medida: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },

      // 3. TIPO_ITEM FIX: Adicionado campo tipo_item
      tipo_item: {
        type: DataTypes.ENUM("INGREDIENTE", "PRODUCAO", "PRODUTO_FINAL"),
        allowNull: false,
      },

      // 🔑 R11 FIX: Campos Virtuais definidos como VIRTUAL para satisfazer o TS2345
      saldo_atual: {
        type: DataTypes.VIRTUAL,
      },
      pronto_pedido: {
        type: DataTypes.VIRTUAL,
      },

      estoque_atual: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 0,
      },
      estoque_minimo: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 0,
      },
      preco_custo_unitario: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      preco_venda: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
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
      tableName: "PRODUTOS",
      timestamps: true,
      modelName: "ItemEstoque",
      // Definição dos métodos de leitura dos campos virtuais
      getterMethods: {
        id_produto(): number {
          return (this as any).getDataValue("id_item");
        },
        saldo_atual(): number {
          return (this as any).getDataValue("estoque_atual");
        },
        pronto_pedido(): number {
          const estoqueAtual = (this as any).getDataValue("estoque_atual") || 0;
          const estoqueMinimo =
            (this as any).getDataValue("estoque_minimo") || 0;
          return estoqueAtual - estoqueMinimo;
        },
      },
    }
  );

// R5: Método estático para associações
(ItemEstoque as any).associate = function (models: IModelFactory) {
  ItemEstoque.belongsTo(models.Unidade, {
    foreignKey: "unidade_id",
    targetKey: "id_unidade",
    as: "unidade",
  });
};

export default ItemEstoque;
