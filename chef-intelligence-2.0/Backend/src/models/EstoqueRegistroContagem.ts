// src/models/EstoqueRegistroContagem.ts

import { DataTypes, Model, Optional, ModelCtor } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory } from "../config/types";
import { ItemEstoqueModel } from "./ItemEstoque"; // Importa o modelo pai

// R1. Interface para Atributos
export interface EstoqueRegistroContagemAttributes {
  id_contagem: number;
  id_produto: number;
  data_contagem: Date;
  estoque_contado: number;
  estoque_teorico_na_hora: number;
  discrepancia: number;
  custo_discrepancia: number;
  colaborador_id: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// R2. Interface para Criação
export interface EstoqueRegistroContagemCreationAttributes
  extends Optional<
    EstoqueRegistroContagemAttributes,
    | "id_contagem"
    | "data_contagem"
    | "colaborador_id"
    | "createdAt"
    | "updatedAt"
  > {}

// R3. Interface do Modelo
export interface EstoqueRegistroContagemModel
  extends Model<
      EstoqueRegistroContagemAttributes,
      EstoqueRegistroContagemCreationAttributes
    >,
    EstoqueRegistroContagemAttributes {
  produto?: ItemEstoqueModel;
}

// R4. Criação e Exportação do Modelo (CORRIGIDO)
// 🔑 CORREÇÃO: Removemos a anotação de tipo na esquerda (`: ModelCtor<...>`) e garantimos os DOIS tipos genéricos na direita.
const EstoqueRegistroContagem = connection.define<
  EstoqueRegistroContagemModel,
  EstoqueRegistroContagemCreationAttributes
>(
  "EstoqueRegistroContagem",
  {
    id_contagem: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: "id_contagem",
    },
    id_produto: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "id_produto",
    },
    data_contagem: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    estoque_contado: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
    },
    estoque_teorico_na_hora: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
    },
    discrepancia: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
    },
    custo_discrepancia: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    colaborador_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "colaborador_id",
    },
  },
  {
    tableName: "CONTAGEM_ESTOQUE",
    timestamps: true,
    modelName: "EstoqueRegistroContagem",
  }
);

// R5: Associações
(EstoqueRegistroContagem as any).associate = function (models: IModelFactory) {
  // 1:N - Cada ItemEstoque (PRODUTOS) pode ter muitas Contagens
  EstoqueRegistroContagem.belongsTo(
    models.ItemEstoque as ModelCtor<ItemEstoqueModel>,
    {
      foreignKey: "id_produto",
      as: "produto",
      targetKey: "id_produto",
    }
  );
};

export default EstoqueRegistroContagem;
