// src/models/CustoFixo.ts

import { DataTypes, Model, Optional } from 'sequelize';
import { connection } from '../config/sequelize';
import { IModelFactory } from '../config/types';

export interface CustoFixoAttributes {
  id_custo_fixo: number;
  unidade_id: number;
  descricao: string;
  valor: number;
  data_lancamento: Date;
  categoria: 'ALUGUEL' | 'SALARIO' | 'SERVICO' | 'IMPOSTO' | 'OUTRO';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CustoFixoCreationAttributes
  extends Optional<CustoFixoAttributes, 'id_custo_fixo'> {}

export default class CustoFixo
  extends Model<CustoFixoAttributes, CustoFixoCreationAttributes>
  implements CustoFixoAttributes
{
  public id_custo_fixo!: number;
  public unidade_id!: number;
  public descricao!: string;
  public valor!: number;
  public data_lancamento!: Date;
  public categoria!: 'ALUGUEL' | 'SALARIO' | 'SERVICO' | 'IMPOSTO' | 'OUTRO';

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CustoFixo.init(
  {
    id_custo_fixo: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    unidade_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    descricao: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    valor: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      get() {
        return parseFloat(this.getDataValue('valor') as any);
      },
    },
    data_lancamento: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    categoria: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
  },
  {
    sequelize: connection,
    tableName: 'CUSTOS_FIXOS',
    modelName: 'CustoFixo',
    underscored: true,
  },
);

(CustoFixo as any).associate = (models: IModelFactory) => {
  // Nenhuma associação obrigatória por enquanto
};
