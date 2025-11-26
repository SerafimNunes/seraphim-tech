import { DataTypes, Model, Optional, ModelCtor } from "sequelize";
import { connection } from "../config/sequelize";
import Unidade from "./Unidade";
import { IModelFactory } from "../config/types";
import { ResolvedModelMap } from "../config/associations";

export interface ItemEstoqueAttributes {
  id_item: number;
  id_produto: number; // Será mapeado para id_item (getter/setter virtual)
  unidade_id: number;
  nome: string;
  unidade_medida: string;
  estoque_atual: number;
  estoque_minimo: number; // 🎯 R11: Novos campos para Ponto de Pedido Otimizado

  lead_time_dias: number; // Ex: 3 dias para entrega
  estoque_seguranca: number; // Ex: Margem para atrasos ou picos inesperados

  preco_custo_unitario: number;
  preco_venda: number;
  is_vendavel: boolean;
  is_pre_pronto: boolean;
  tipo_item: "INGREDIENTE" | "PRODUCAO" | "PRODUTO_FINAL";
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ItemEstoqueCreationAttributes
  extends Optional<
    ItemEstoqueAttributes,
    | "id_item"
    | "id_produto"
    | "estoque_atual"
    | "preco_custo_unitario"
    | "lead_time_dias"
    | "estoque_seguranca"
  > {}

export interface ItemEstoqueModel
  extends Model<ItemEstoqueAttributes, ItemEstoqueCreationAttributes>,
    ItemEstoqueAttributes {
  unidade?: typeof Unidade; // métodos convenientes
  getSaldoAtual(): number;
  getProntoPedido(): number;
}

export const ItemEstoque: ModelCtor<ItemEstoqueModel> =
  connection.define<ItemEstoqueModel>(
    "ItemEstoque",
    {
      // 🔑 CHAVE PRIMÁRIA CORRIGIDA: Apenas a coluna id_item está definida.
      id_item: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: "id_item",
      },
      // 🛑 REMOVIDO: A definição da coluna 'id_produto' que mapeava para o mesmo campo.
      // O Getter abaixo resolverá a compatibilidade com a interface.
      
      unidade_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "ID da Unidade de negócio (Regra R4)",
        references: { model: "UNIDADES", key: "id_unidade" },
      },
      nome: { type: DataTypes.STRING(100), allowNull: false },
      unidade_medida: { type: DataTypes.STRING(20), allowNull: false },
      tipo_item: {
        type: DataTypes.ENUM("INGREDIENTE", "PRODUCAO", "PRODUTO_FINAL"),
        allowNull: false,
        defaultValue: "INGREDIENTE",
      },
      estoque_atual: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        defaultValue: 0,
        get() {
          const v = this.getDataValue("estoque_atual") as unknown as
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
          const v = this.getDataValue("estoque_minimo") as unknown as
            | string
            | number;
          return v === null || v === undefined ? 0 : parseFloat(String(v));
        },
      }, 
      lead_time_dias: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "Lead Time de entrega/produção (em dias)",
      },
      estoque_seguranca: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: "Estoque de segurança para margem de atraso/pico",
        get() {
          const v = this.getDataValue("estoque_seguranca") as unknown as
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
          const v = this.getDataValue("preco_custo_unitario") as unknown as
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
          const v = this.getDataValue("preco_venda") as unknown as
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
      // 🔑 Adiciona um Getter/Setter virtual para 'id_produto'
      id_produto: {
        type: DataTypes.VIRTUAL,
        get(this: ItemEstoqueModel) {
          return this.getDataValue("id_item");
        },
        set(this: ItemEstoqueModel, value: number) {
          this.setDataValue("id_item" as any, value);
        },
      },
    },
    {
      tableName: "PRODUTOS",
      timestamps: true,
      modelName: "ItemEstoque",
      indexes: [
        {
          unique: true,
          fields: ["unidade_id", "nome"], // Garante que não haja dois itens com o mesmo nome na mesma unidade.
        },
      ],
    } as any
  );

// Métodos utilitários (define via prototype)
(ItemEstoque as any).prototype.getSaldoAtual = function () {
  return (this.getDataValue("estoque_atual") as unknown as number) || 0;
};
(ItemEstoque as any).prototype.getProntoPedido = function () {
  const estoqueAtual =
    (this.getDataValue("estoque_atual") as unknown as number) || 0;
  const estoqueMinimo =
    (this.getDataValue("estoque_minimo") as unknown as number) || 0;
  return estoqueAtual - estoqueMinimo;
};

// R5: Associações
(ItemEstoque as any).associate = (models: ResolvedModelMap) => {
  if (!models || !models.Unidade) return;
  ItemEstoque.belongsTo(models.Unidade as any, {
    foreignKey: "unidade_id",
    as: "unidade",
  });
};

export default ItemEstoque;