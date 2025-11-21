// src/models/Cargo.ts
import { DataTypes, Model, Optional } from 'sequelize';
import { connection } from '../config/sequelize';
import { IModelFactory } from '../config/types';

export interface CargoAttributes {
  id_cargo: number;
  unidade_id: number;
  nome_cargo: string;
  departamento?: string | null;
  salario_base?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CargoCreationAttributes
  extends Optional<CargoAttributes, 'id_cargo'> {}

export interface CargoModel
  extends Model<CargoAttributes, CargoCreationAttributes>,
    CargoAttributes {}

const Cargo = connection.define<CargoModel>(
  'Cargo',
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
    salario_base: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      get() {
        const v = this.getDataValue('salario_base') as unknown as
          | string
          | number;
        return v == null ? null : parseFloat(String(v));
      },
    },
  },
  {
    tableName: 'CARGOS',
    sequelize: connection,
    timestamps: true,
    modelName: 'Cargo',
  } as any,
);

(Cargo as any).associate = (models: IModelFactory) => {
  if (!models) return;
  if (models.Permissao) {
    // many-to-many via join table CARGO_PERMISSOES (exemplo)
    Cargo.belongsToMany(models.Permissao as any, {
      through: 'CARGO_PERMISSOES',
      foreignKey: 'cargo_id',
      otherKey: 'permissao_id',
      as: 'permissoes',
    });
  }
  if (models.Usuario) {
    Cargo.hasMany(models.Usuario as any, {
      foreignKey: 'cargo_id',
      as: 'usuarios',
    });
  }
};

export default Cargo;
