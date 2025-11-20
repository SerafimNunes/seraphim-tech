// src/models/VendaImposto.ts

import { DataTypes, Model, Optional, ModelCtor } from 'sequelize';
import { connection } from '../config/sequelize';
import { IModelFactory } from '../config/types';

// GPR-2: Tipagem Rígida e Completa
export interface VendaImpostoAttributes {
  id_venda_imposto: number;
  unidade_id: number; // GPR-1: Conformidade R4
  id_venda_item: number;
  tipo_imposto: 'ICMS' | 'ISS' | 'PIS' | 'COFINS' | 'OUTRO';
  aliquota: number; // Ex: 0.18 para 18%
  valor_imposto: number; // Valor final em R$
  createdAt?: Date;
  updatedAt?: Date;
}

export interface VendaImpostoCreationAttributes
  extends Optional<VendaImpostoAttributes, 'id_venda_imposto'> {}

export interface VendaImpostoModel
  extends Model<VendaImpostoAttributes, VendaImpostoCreationAttributes>,
    VendaImpostoAttributes {}

const VendaImposto: ModelCtor<VendaImpostoModel> =
  connection.define<VendaImpostoModel>(
    'VendaImposto',
    {
      id_venda_imposto: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      unidade_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'ID da Unidade de negócio (Regra R4)',
      },
      id_venda_item: { type: DataTypes.INTEGER, allowNull: false },
      tipo_imposto: { type: DataTypes.STRING(50), allowNull: false },
      // GPR-4: Tratamento de Decimais
      aliquota: {
        type: DataTypes.DECIMAL(5, 4), // 99.99%
        allowNull: false,
        get() {
          return parseFloat(this.getDataValue('aliquota') as unknown as string);
        },
      },
      // GPR-4: Tratamento de Decimais
      valor_imposto: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        get() {
          return parseFloat(
            this.getDataValue('valor_imposto') as unknown as string,
          );
        },
      },
    },
    {
      tableName: 'VENDAS_IMPOSTOS',
      timestamps: true,
      modelName: 'VendaImposto',
    },
  );

// GPR-3: Associação
(VendaImposto as any).associate = function (models: IModelFactory) {
  // Exemplo: VendaImposto.belongsTo(models.VendaItem, { foreignKey: 'id_venda_item', as: 'vendaItem' });
};

export default VendaImposto;
