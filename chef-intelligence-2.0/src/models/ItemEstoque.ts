// src/models/ItemEstoque.ts (CORRIGIDO)

import { DataTypes, Model, Optional, ModelCtor, Sequelize } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory } from "../config/types";

// R1. Interface para Atributos
export interface ItemEstoqueAttributes {
  id_produto: number;
  nome: string;
  unidade_medida: string;
  estoque_atual: number;
  estoque_minimo: number;
  preco_custo_unitario: number;
  preco_venda: number;
  is_vendavel: boolean;
  is_pre_pronto: boolean; // ⬅️ CORRIGIDO (Para corresponder ao Controller e à lógica original)
  createdAt?: Date;
  updatedAt?: Date;
}

// R2. Interface para Criação (Atributos opcionais na criação)
export interface ItemEstoqueCreationAttributes
  extends Optional<
    ItemEstoqueAttributes,
    | "id_produto"
    | "estoque_atual"
    | "preco_custo_unitario"
    | "createdAt"
    | "updatedAt"
    // is_pre_pronto NÃO está aqui pois o Controller fornece um valor (false) se for omitido.
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
      id_produto: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: "id_produto",
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
        // ⬅️ CORRIGIDO
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: "PRODUTOS",
      timestamps: true,
      modelName: "ItemEstoque",
    }
  );

// R5: Método estático para associações
(ItemEstoque as any).associate = function (models: IModelFactory) {
  // Associações serão definidas em breve
};

export default ItemEstoque;
