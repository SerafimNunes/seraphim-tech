// src/models/Unidade.ts

import { DataTypes, Model, Optional, ModelCtor } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory } from "../config/types";

// Define os atributos da tabela Unidades
interface UnidadeAttributes {
  id_unidade: number;
  nome_unidade: string;
  cnpj: string;
  endereco: string;
  // R4: Status da unidade (para desativar filiais)
  status_operacional: "ATIVA" | "INATIVA" | "EM_REFORMA";
}

// Define atributos opcionais na criação (apenas o PK)
type UnidadeCreationAttributes = Optional<UnidadeAttributes, "id_unidade">;

// Interface da instância do modelo (útil para tipar includes em Services)
export interface UnidadeModel
  extends Model<UnidadeAttributes, UnidadeCreationAttributes>,
    UnidadeAttributes {}

// 🔑 R6: Exportação padrão da classe do modelo (para o index.ts)
class Unidade
  extends Model<UnidadeAttributes, UnidadeCreationAttributes>
  implements UnidadeAttributes
{
  public id_unidade!: number;
  public nome_unidade!: string;
  public cnpj!: string;
  public endereco!: string;
  public status_operacional!: "ATIVA" | "INATIVA" | "EM_REFORMA";

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Unidade.init(
  {
    id_unidade: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nome_unidade: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
    },
    cnpj: {
      type: DataTypes.STRING(14),
      allowNull: false,
      unique: true,
    },
    endereco: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    status_operacional: {
      type: DataTypes.ENUM("ATIVA", "INATIVA", "EM_REFORMA"),
      allowNull: false,
      defaultValue: "ATIVA",
    },
  },
  {
    tableName: "UNIDADES",
    modelName: "UNIDADE",
    sequelize: connection,
    timestamps: true,
    underscored: true,
  }
);

// Associações (R4: Outros modelos farão referência a Unidade)
(Unidade as any).associate = function (models: IModelFactory) {
  // Unidade.hasMany(models.Usuario, { foreignKey: 'unidade_id', as: 'usuarios' });
  // Unidade.hasMany(models.ItemEstoque, { foreignKey: 'unidade_id', as: 'estoques' });
};

export default Unidade;
