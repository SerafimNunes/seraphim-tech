// src/models/Usuario.ts
import { DataTypes, Model, Optional } from 'sequelize';
import { connection } from '../config/sequelize';
import { IModelFactory } from '../config/types';
import { CargoModel } from './Cargo';

export interface UsuarioAttributes {
  id_usuario: number;
  unidade_id: number;
  colaborador_id: number;
  email: string; // Changed from username to email
  password_hash: string;
  ativo: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UsuarioCreationAttributes
  extends Optional<UsuarioAttributes, 'id_usuario' | 'ativo'> {}

export interface UsuarioModel
  extends Model<UsuarioAttributes, UsuarioCreationAttributes>,
    UsuarioAttributes {
  cargo?: CargoModel;
}

const Usuario = connection.define<UsuarioModel>(
  'Usuario',
  {
    id_usuario: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    unidade_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    colaborador_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    email: { // Changed from username to email
      type: DataTypes.STRING(80),
      allowNull: false,
      unique: true,
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    ativo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: 'USUARIOS',
    sequelize: connection,
    timestamps: true,
    modelName: 'Usuario',
  } as any,
);

(Usuario as any).associate = (models: IModelFactory) => {
  if (!models) return;
  if (models.Colaborador) {
    Usuario.belongsTo(models.Colaborador as any, {
      foreignKey: 'colaborador_id',
      as: 'colaborador',
    });
  }
  if (models.Unidade) {
    Usuario.belongsTo(models.Unidade as any, {
      foreignKey: 'unidade_id',
      as: 'unidade',
    });
  }
};

export default Usuario;
