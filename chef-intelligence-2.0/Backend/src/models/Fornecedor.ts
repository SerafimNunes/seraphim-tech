// src/models/Fornecedor.ts

import { DataTypes, Model, Optional, ModelCtor } from "sequelize";
import { connection } from "../config/sequelize";

export interface FornecedorAttributes {
  id_fornecedor: number;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
  prazo_medio_entrega_dias: number;
  nota_qualidade_acumulada: number;
}

export interface FornecedorCreationAttributes
  extends Optional<
    FornecedorAttributes,
    | "id_fornecedor"
    | "telefone"
    | "email"
    | "ativo"
    | "prazo_medio_entrega_dias"
    | "nota_qualidade_acumulada"
  > {}

export interface FornecedorModel
  extends Model<FornecedorAttributes, FornecedorCreationAttributes>,
    FornecedorAttributes {}

const Fornecedor: ModelCtor<FornecedorModel> =
  connection.define<FornecedorModel>(
    "Fornecedor",
    {
      id_fornecedor: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      nome_fantasia: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      razao_social: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: true,
      },
      cnpj: {
        type: DataTypes.STRING(18),
        allowNull: false,
        unique: true,
      },
      telefone: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      ativo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      prazo_medio_entrega_dias: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      nota_qualidade_acumulada: {
        type: DataTypes.DECIMAL(3, 1),
        allowNull: false,
        defaultValue: 10.0,
        get() {
          return parseFloat(
            this.getDataValue("nota_qualidade_acumulada") as unknown as string
          );
        },
      },
    },
    {
      tableName: "FORNECEDORES",
      sequelize: connection, // 🔑 CORREÇÃO DO ERRO 2353 (cast implícito no TS do define)
      timestamps: true,
      modelName: "Fornecedor",
    } as any // 🔑 CAST EXPLÍCITO para resolver o ERRO 2353
  );

export default Fornecedor;
