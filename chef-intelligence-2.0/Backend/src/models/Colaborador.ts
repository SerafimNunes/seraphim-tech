// src/models/Colaborador.ts
import {
  DataTypes,
  Model,
  Optional,
  ModelCtor,
  ModelStatic,
  BuildOptions,
} from 'sequelize';
import { connection } from '../config/sequelize';
import { IModelFactory, NivelAcesso, StatusColaborador } from '../config/types';
import { CargoModel } from './Cargo';

export type NivelAcessoType = 'COLABORADOR' | 'GESTOR' | 'ADMIN';
export type StatusColaboradorType = 'ATIVO' | 'AFASTADO' | 'DESLIGADO';

export interface ColaboradorAttributes {
  id_colaborador: number;
  unidade_id: number;
  nome_completo: string;
  email: string;
  nivel_acesso: NivelAcessoType;
  cargo_id: number;
  Status: StatusColaboradorType;
  data_contratacao: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ColaboradorCreationAttributes
  extends Optional<ColaboradorAttributes, 'id_colaborador' | 'Status'> {}

export interface ColaboradorModel
  extends Model<ColaboradorAttributes, ColaboradorCreationAttributes>,
    ColaboradorAttributes {
  cargo?: CargoModel;
}

const Colaborador = connection.define<ColaboradorModel>(
  'Colaborador',
  {
    id_colaborador: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    unidade_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    nome_completo: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    nivel_acesso: {
      type: DataTypes.ENUM('COLABORADOR', 'GESTOR', 'ADMIN'),
      allowNull: false,
      defaultValue: 'COLABORADOR',
    },
    cargo_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    Status: {
      type: DataTypes.ENUM('ATIVO', 'AFASTADO', 'DESLIGADO'),
      allowNull: false,
      defaultValue: 'ATIVO',
    },
    data_contratacao: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
  },
  {
    tableName: 'COLABORADORES',
    sequelize: connection,
    timestamps: true,
    modelName: 'Colaborador',
  } as any,
);

(Colaborador as any).associate = (models: IModelFactory) => {
  if (!models) return;
  if (models.Cargo) {
    Colaborador.belongsTo(models.Cargo as any, {
      foreignKey: 'cargo_id',
      as: 'cargo',
    });
  }
  if (models.Unidade) {
    Colaborador.belongsTo(models.Unidade as any, {
      foreignKey: 'unidade_id',
      as: 'unidade',
    });
  }
};

export default Colaborador;
