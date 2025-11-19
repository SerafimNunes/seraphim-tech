// src/models/VendaComanda.ts
import { DataTypes, Model, Optional, ModelCtor } from 'sequelize';
import { connection } from '../config/sequelize';
import VendaMesa, { VendaMesaModel } from './VendaMesa'; // 🔑 Importado
import VendaItem, { VendaItemModel } from './VendaItem'; // 🔑 Importado
import Unidade from './Unidade'; // 🔑 Importado para R4
import { IModelFactory } from '../config/types'; // Importando IModelFactory

export type StatusComanda =
  | 'ABERTA'
  | 'FECHADA'
  | 'CANCELADA'
  | 'AGUARDANDO_PAGAMENTO';

export interface VendaComandaAttributes {
  id_venda: number;
  id_mesa: number | null;
  id_caixa: number | null;
  colaborador_id_abertura: number;
  colaborador_id_fechamento: number | null;
  status_venda: StatusComanda;
  data_abertura: Date;
  data_fechamento: Date | null;
  valor_total: number;
  custo_total: number; // CMV total
  metodo_pagamento: string | null;
  // GPR-1 CORREÇÃO CRÍTICA: Adicionando o campo de segurança R4
  unidade_id: number;
}

export interface VendaComandaCreationAttributes
  extends Optional<
    VendaComandaAttributes,
    | 'id_venda'
    | 'colaborador_id_fechamento'
    | 'data_abertura'
    | 'data_fechamento'
    | 'valor_total'
    | 'custo_total'
    | 'metodo_pagamento'
  > {}

export interface VendaComandaModel
  extends Model<VendaComandaAttributes, VendaComandaCreationAttributes>,
    VendaComandaAttributes {
  // Associações
  mesa?: VendaMesaModel;
  itens?: VendaItemModel[];
}

const VendaComanda: ModelCtor<VendaComandaModel> =
  connection.define<VendaComandaModel>(
    'VendaComanda',
    {
      id_venda: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      id_mesa: { type: DataTypes.INTEGER, allowNull: true },
      id_caixa: { type: DataTypes.INTEGER, allowNull: true },
      colaborador_id_abertura: { type: DataTypes.INTEGER, allowNull: false },
      colaborador_id_fechamento: { type: DataTypes.INTEGER, allowNull: true },
      status_venda: {
        type: DataTypes.ENUM<StatusComanda>(
          'ABERTA',
          'FECHADA',
          'CANCELADA',
          'AGUARDANDO_PAGAMENTO',
        ), // Ajustado para ENUM
        allowNull: false,
        defaultValue: 'ABERTA',
      },
      data_abertura: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      data_fechamento: { type: DataTypes.DATE, allowNull: true },
      valor_total: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
        get() {
          return parseFloat(
            this.getDataValue('valor_total') as unknown as string,
          );
        },
      },
      custo_total: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
        get() {
          return parseFloat(
            this.getDataValue('custo_total') as unknown as string,
          );
        },
      },
      metodo_pagamento: { type: DataTypes.STRING(50), allowNull: true },
      // GPR-1 CORREÇÃO CRÍTICA: Adicionando o campo de segurança R4
      unidade_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'ID da Unidade de negócio (Regra R4)',
        references: { model: 'Unidades', key: 'id_unidade' },
      },
    },
    {
      tableName: 'VENDAS',
      sequelize: connection,
      timestamps: true,
      modelName: 'VendaComanda',
    },
  );

(VendaComanda as any).associate = function (models: IModelFactory) {
  // 🔑 R4: Associa com a Unidade
  VendaComanda.belongsTo(models.Unidade, {
    foreignKey: 'unidade_id',
    as: 'unidade',
  });

  // Associações de Negócio
  VendaComanda.belongsTo(models.VendaMesa, {
    foreignKey: 'id_mesa',
    as: 'mesa',
  });
  VendaComanda.hasMany(models.VendaItem, {
    foreignKey: 'id_venda',
    as: 'itens',
  });
  // Colaborador deve ser associado aqui se o Model existir.
};

export default VendaComanda;
