// src/models/Cargo.ts
import { DataTypes, Model, Optional, ModelCtor, ModelOptions } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory } from "../config/types";
import { Colaborador } from "./Colaborador";
import Permissao, { PermissaoModel } from "./Permissao";

// 1. Interfaces e Tipagem (GPR-2)
export interface CargoAttributes {
  id_cargo: number; // GPR-5: Padrão de chave Primária
  unidade_id: number;
  nome_cargo: string;
  departamento: string;
  salario_base: number;
}

export interface CargoCreationAttributes
  extends Optional<CargoAttributes, "id_cargo"> {}

// Interface do Modelo
export interface CargoModel
  extends Model<CargoAttributes, CargoCreationAttributes>,
    CargoAttributes {
  permissoes?: PermissaoModel[]; // Associação Many-to-Many
  usuarios?: any[]; // Associações tipadas
}
const Cargo: ModelCtor<CargoModel> = connection.define<
  CargoModel,
  CargoCreationAttributes
>(
  "Cargo",
  {
    id_cargo: {
      type: DataTypes.INTEGER,
      primaryKey: true, // GPR-5: Definição de chave primária
      autoIncrement: true, // GPR-5: Auto incremento
    },
    unidade_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID da unidade de Negócio",
    },
    nome_cargo: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    departamento: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    salario_base: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      get() {
        return parseFloat(
          this.getDataValue("salario_base") as unknown as string
        );
      },
    },
  },
  {
    tableName: "CARGOS",
    timestamps: true,
    modelName: "Cargo",
  } as ModelOptions<CargoModel>
);

// 3. Associação Explicita (GPR-3)
(Cargo as any).associate = function (models: IModelFactory) {
  Cargo.hasMany(models.Colaborador as ModelCtor<Colaborador>, {
    foreignKey: "cargo_id",
    as: "colaboradores",
  });
  // Relacionamento N:M com Permissão
  Cargo.belongsToMany(models.Permissao, {
    through: "CargoPermissoes", // Tabela de pivô
    foreignKey: "cargo_id",
    as: "permissoes", // ALIAS CRÍTICO: usado para busca aninhada no AuthService
  });
  // Associações com Usuário
  Cargo.hasMany(models.Usuario, {
    foreignKey: "cargo_id",
    as: "usuarios",
  });
};

export default Cargo;
