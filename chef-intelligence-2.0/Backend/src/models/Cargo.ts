// src/models/Cargo.ts

import { DataTypes, Model, Optional } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory } from "../config/types";
import { PermissaoModel } from "./Permissao";

// Importa o modelo de junção para usá-lo no `through`
import CargoPermissao from "./CargoPermissao"; // ⬅️ NOVO: Importa o modelo de junção

export interface CargoAttributes {
  id_cargo: number;
  unidade_id: number;
  nome_cargo: string;
  departamento?: string | null;
  salario_base?: number;
  is_super_admin: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CargoCreationAttributes
  extends Optional<CargoAttributes, "id_cargo"> {}

export interface CargoModel
  extends Model<CargoAttributes, CargoCreationAttributes>,
    CargoAttributes {
  permissoes?: PermissaoModel[];
}

class Cargo
  extends Model<CargoAttributes, CargoCreationAttributes>
  implements CargoAttributes
{
  public id_cargo!: number;
  public unidade_id!: number;
  public nome_cargo!: string;
  public departamento?: string | null;
  public salario_base?: number;
  public is_super_admin!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Cargo.init(
  {
    id_cargo: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    unidade_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    nome_cargo: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    departamento: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    is_super_admin: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    salario_base: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      get() {
        const v = this.getDataValue("salario_base") as unknown as
          | string
          | number;
        return v == null ? null : parseFloat(String(v));
      },
    },
  },
  {
    tableName: "CARGOS",
    modelName: "CARGOS",
    sequelize: connection,
    timestamps: true,
    underscored: true,
  }
);

(Cargo as any).associate = (models: IModelFactory) => {
  if (!models) return; // Garante que Permissao e o modelo de junção CargoPermissao existam
  if (models.Permissao && models.CargoPermissao) {
    // many-to-many via join table CARGO_PERMISSOES (R12)
    Cargo.belongsToMany(models.Permissao as any, {
      through: models.CargoPermissao as any, // ⬅️ CORREÇÃO: Usa o modelo explícito
      foreignKey: "cargo_id",
      otherKey: "permissao_id",
      as: "permissoes",
    });
  }
  if (models.Usuario) {
    // Um cargo pode ter muitos usuários
    Cargo.hasMany(models.Usuario as any, {
      foreignKey: "cargo_id",
      as: "usuarios",
    });
  }
};

export default Cargo;
