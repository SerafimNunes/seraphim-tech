// src/models/EstoqueRegistroMovimento.ts (CORRIGIDO NOVAMENTE - Incluindo 'observacoes' como opcional)

import { DataTypes, Model, Optional, ModelCtor } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory } from "../config/types";
import { ItemEstoqueModel } from "./ItemEstoque";

// R1. Interface para Atributos
export interface EstoqueRegistroMovimentoAttributes {
  id_movimento: number;
  id_produto: number;
  tipo_movimento: "ENTRADA" | "SAIDA" | "AJUSTE_SOBRA" | "AJUSTE_PERDA"; // Enum de tipos
  quantidade: number;
  preco_custo_unitario_momento: number;
  custo_total_movimento: number;
  estoque_anterior: number;
  estoque_atual: number;
  referencia_origem: string | null;
  colaborador_id: number | null;
  observacoes: string | null; // ⬅️ GARANTIR QUE ESTÁ AQUI
  createdAt?: Date;
  updatedAt?: Date;
}

// R2. Interface para Criação
export interface EstoqueRegistroMovimentoCreationAttributes
  extends Optional<
    EstoqueRegistroMovimentoAttributes,
    | "id_movimento"
    | "custo_total_movimento"
    | "referencia_origem"
    | "colaborador_id"
    | "observacoes" // ⬅️ CORREÇÃO CRÍTICA: AGORA É OPCIONAL NA CRIAÇÃO
    | "createdAt"
    | "updatedAt"
  > {}

// R3. Interface do Modelo
export interface EstoqueRegistroMovimentoModel
  extends Model<
      EstoqueRegistroMovimentoAttributes,
      EstoqueRegistroMovimentoCreationAttributes
    >,
    EstoqueRegistroMovimentoAttributes {
  produto?: ItemEstoqueModel;
}

// R4. Criação e Exportação do Modelo
const EstoqueRegistroMovimento = connection.define<
  EstoqueRegistroMovimentoModel,
  EstoqueRegistroMovimentoCreationAttributes
>(
  "EstoqueRegistroMovimento",
  {
    id_movimento: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_produto: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "id_produto",
    },
    tipo_movimento: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    quantidade: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
    },
    preco_custo_unitario_momento: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    custo_total_movimento: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    estoque_anterior: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
    },
    estoque_atual: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
    },
    referencia_origem: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    colaborador_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    observacoes: {
      // ⬅️ GARANTIR QUE ESTÁ NO MODEL
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: "MOVIMENTO_ESTOQUE",
    timestamps: true,
    modelName: "EstoqueRegistroMovimento",
  }
);

// R5: Associações
(EstoqueRegistroMovimento as any).associate = function (models: IModelFactory) {
  EstoqueRegistroMovimento.belongsTo(
    models.ItemEstoque as ModelCtor<ItemEstoqueModel>,
    {
      foreignKey: "id_produto",
      as: "produto",
      targetKey: "id_produto",
    }
  );
};

export default EstoqueRegistroMovimento;
