// src/models/CustoFixo.ts

import { DataTypes, Model, Optional, ModelCtor } from 'sequelize';
import { connection } from '../config/sequelize';
import { IModelFactory } from '../config/types';

// GPR-2: Tipagem Rígida e Completa
export interface CustoFixoAttributes {
  id_custo_fixo: number;
  unidade_id: number; // GPR-1: Conformidade R4
  descricao: string;
  valor: number;
  data_lancamento: Date;
  categoria: 'ALUGUEL' | 'SALARIO' | 'SERVICO' | 'IMPOSTO' | 'OUTRO';
}

export interface CustoFixoCreationAttributes
  extends Optional<CustoFixoAttributes, 'id_custo_fixo'> {}

export interface CustoFixoModel
  extends Model<CustoFixoAttributes, CustoFixoCreationAttributes>,
    CustoFixoAttributes {}

const CustoFixo: ModelCtor<CustoFixoModel> = connection.define<CustoFixoModel>(
  'CustoFixo',
  {
    id_custo_fixo: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    unidade_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'ID da Unidade de negócio (Regra R4)',
    },
    descricao: { type: DataTypes.STRING(255), allowNull: false },
    // GPR-4: Tratamento de Decimais para garantir valor como number
    valor: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      get() {
        return parseFloat(this.getDataValue('valor') as unknown as string);
      },
    },
    data_lancamento: { type: DataTypes.DATE, allowNull: false },
    categoria: { type: DataTypes.STRING(50), allowNull: false },
  },
  {
    tableName: 'CUSTOS_FIXOS',
    sequelize: connection,
    timestamps: true,
    modelName: 'CustoFixo',
  },
);

// GPR-3: Associação (Não há associações diretas necessárias para o cálculo do Service)
(CustoFixo as any).associate = function (models: IModelFactory) {
  // Exemplo: CustoFixo.belongsTo(models.Unidade, { foreignKey: 'unidade_id', as: 'unidade' });
};

export default CustoFixo;
