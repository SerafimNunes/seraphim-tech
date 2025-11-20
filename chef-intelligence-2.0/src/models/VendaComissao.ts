// src/models/VendaComissao.ts

import { DataTypes, Model, Optional, ModelCtor } from 'sequelize';
import { connection } from '../config/sequelize';
import { IModelFactory } from '../config/types';

// GPR-2: Tipagem Rígida e Completa
export interface VendaComissaoAttributes {
  id_venda_comissao: number;
  unidade_id: number; // GPR-1: Conformidade R4
  id_venda_item: number;
  tipo_comissao: 'VENDEDOR' | 'CARTAO' | 'GATEWAY' | 'OUTRO';
  taxa: number; // Ex: 0.02 para 2%
  valor_comissao: number; // Valor final em R$
  createdAt?: Date;
  updatedAt?: Date;
}

export interface VendaComissaoCreationAttributes
  extends Optional<VendaComissaoAttributes, 'id_venda_comissao'> {}

export interface VendaComissaoModel
  extends Model<VendaComissaoAttributes, VendaComissaoCreationAttributes>,
    VendaComissaoAttributes {}

const VendaComissao: ModelCtor<VendaComissaoModel> =
  connection.define<VendaComissaoModel>(
    'VendaComissao',
    {
      id_venda_comissao: {
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
      tipo_comissao: { type: DataTypes.STRING(50), allowNull: false },
      // GPR-4: Tratamento de Decimais
      taxa: {
        type: DataTypes.DECIMAL(5, 4), // 99.99%
        allowNull: false,
        get() {
          return parseFloat(this.getDataValue('taxa') as unknown as string);
        },
      },
      // GPR-4: Tratamento de Decimais
      valor_comissao: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        get() {
          return parseFloat(
            this.getDataValue('valor_comissao') as unknown as string,
          );
        },
      },
    },
    {
      tableName: 'VENDAS_COMISSOES',
      timestamps: true,
      modelName: 'VendaComissao',
    },
  );

// GPR-3: Associação
(VendaComissao as any).associate = function (models: IModelFactory) {
  // Exemplo: VendaComissao.belongsTo(models.VendaItem, { foreignKey: 'id_venda_item', as: 'vendaItem' });
};

export default VendaComissao;
