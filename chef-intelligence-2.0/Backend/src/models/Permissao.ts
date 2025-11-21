// src/models/Permissao.ts
import { DataTypes, Model, Optional } from 'sequelize';
import { connection } from '../config/sequelize';
import { IModelFactory } from '../config/types';

export interface PermissaoAttributes {
  id_permissao: number;
  chave: string;
  descricao?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PermissaoCreationAttributes
  extends Optional<PermissaoAttributes, 'id_permissao'> {}

export interface PermissaoModel
  extends Model<PermissaoAttributes, PermissaoCreationAttributes>,
    PermissaoAttributes {}

const Permissao = connection.define<PermissaoModel>(
  'Permissao',
  {
    id_permissao: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    chave: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
    },
    descricao: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: 'PERMISSOES',
    sequelize: connection,
    timestamps: true,
    modelName: 'Permissao',
  } as any,
);

(Permissao as any).associate = (models: IModelFactory) => {
  if (!models) return;
  if (models.Cargo) {
    Permissao.belongsToMany(models.Cargo as any, {
      through: 'CARGO_PERMISSOES',
      foreignKey: 'permissao_id',
      otherKey: 'cargo_id',
      as: 'cargos',
    });
  }
};

export default Permissao;
