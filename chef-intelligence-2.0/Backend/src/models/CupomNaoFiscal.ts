//src/models/CupomNaoFiscal.ts
import { DataTypes, Model, Optional } from 'sequelize';
import { connection } from '../config/sequelize';
import { IModelFactory } from '@config/types';
import { ResolvedModelMap } from '../config/associations';

// GPR-2: Tipagem Rígida e Completa - Attributes
export interface CupomNaoFiscalAttributes {
  id_cupom_nao_fiscal: number; // GPR-5: Padrão de Chave Primária
  unidade_id: number; // GPR-1: Conformidade R4 (Multi-Unidade)
  data_emissao: Date;
  valor_total: number;
  tipo_pagamento: 'DINHEIRO' | 'CARTAO' | 'PIX';
  // Referência opcional à comanda/venda original, se existir
  venda_comanda_id?: number | null;
  // Propriedades padrão do Sequelize
  createdAt?: Date;
  updatedAt?: Date;
}

// GPR-2: Tipagem Rígida e Completa - CreationAttributes
export type CupomNaoFiscalCreationAttributes = Optional<
  CupomNaoFiscalAttributes,
  'id_cupom_nao_fiscal' | 'data_emissao' | 'createdAt' | 'updatedAt' // Adicionando createdAt/updatedAt
>;

// GPR-2: Tipagem Rígida e Completa - Model Instance
export default class CupomNaoFiscal
  extends Model<CupomNaoFiscalAttributes, CupomNaoFiscalCreationAttributes>
  implements CupomNaoFiscalAttributes
{
  public id_cupom_nao_fiscal!: number;
  public unidade_id!: number;
  public data_emissao!: Date;
  public valor_total!: number;
  public tipo_pagamento!: 'DINHEIRO' | 'CARTAO' | 'PIX';
  public venda_comanda_id!: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CupomNaoFiscal.init(
  {
    id_cupom_nao_fiscal: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    unidade_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'ID da Unidade de negócio (Regra R4)',
    },
    data_emissao: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    valor_total: {
      type: DataTypes.DECIMAL(10, 2), // R3: Garantia de precisão financeira
      allowNull: false,
      // GPR-4: Tratamento de Decimais
      get() {
        return parseFloat(
          this.getDataValue('valor_total') as unknown as string,
        );
      },
    },
    tipo_pagamento: {
      type: DataTypes.ENUM('DINHEIRO', 'CARTAO', 'PIX'),
      allowNull: false,
    },
    venda_comanda_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'VendaComandas', key: 'id_comanda' },
    },
  },
  {
    sequelize: connection,
    tableName: 'CuponsNaoFiscais',
    underscored: true,
  },
);

// GPR-3: Associação Explícita (IModelFactory)
(CupomNaoFiscal as any).associate = function (models: ResolvedModelMap) {
  // GPR-1: Associação obrigatória à Unidade
  CupomNaoFiscal.belongsTo(models.Unidade, {
    foreignKey: 'unidade_id',
    as: 'unidade',
  });
  // Relação com VendaComanda (para rastreabilidade)
  CupomNaoFiscal.belongsTo(models.VendaComanda, {
    foreignKey: 'venda_comanda_id',
    as: 'vendaComanda',
  });
};
