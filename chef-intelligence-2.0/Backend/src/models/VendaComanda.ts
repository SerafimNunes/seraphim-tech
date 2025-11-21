import { DataTypes, Model, Optional } from 'sequelize';
import { connection } from '../config/sequelize';
import { IModelFactory } from '../config/types';

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
  custo_total: number;
  metodo_pagamento: string | null;
  unidade_id: number;
  createdAt?: Date;
  updatedAt?: Date;
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

export class VendaComanda
  extends Model<VendaComandaAttributes, VendaComandaCreationAttributes>
  implements VendaComandaAttributes
{
  public id_venda!: number;
  public id_mesa!: number | null;
  public id_caixa!: number | null;
  public colaborador_id_abertura!: number;
  public colaborador_id_fechamento!: number | null;
  public status_venda!: StatusComanda;
  public data_abertura!: Date;
  public data_fechamento!: Date | null;
  public valor_total!: number;
  public custo_total!: number;
  public metodo_pagamento!: string | null;
  public unidade_id!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// 🔑 CORREÇÃO CRÍTICA: Adicionar sequelize: connection
VendaComanda.init(
  {
    id_venda: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_mesa: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'MESAS', key: 'id_mesa' },
    },
    id_caixa: { type: DataTypes.INTEGER, allowNull: true },
    colaborador_id_abertura: { type: DataTypes.INTEGER, allowNull: false },
    colaborador_id_fechamento: { type: DataTypes.INTEGER, allowNull: true },
    status_venda: {
      type: DataTypes.STRING(30),
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
        const v = this.getDataValue('valor_total') as unknown as
          | string
          | number;
        return v === null || v === undefined ? 0 : parseFloat(String(v));
      },
    },
    custo_total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      get() {
        const v = this.getDataValue('custo_total') as unknown as
          | string
          | number;
        return v === null || v === undefined ? 0 : parseFloat(String(v));
      },
    },
    metodo_pagamento: { type: DataTypes.STRING(50), allowNull: true },
    unidade_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'ID da Unidade de negócio (Regra R4)',
      references: { model: 'Unidades', key: 'id_unidade' },
    },
  },
  {
    tableName: 'VENDAS',
    timestamps: true,
    modelName: 'VendaComanda',
    // 🔑 AQUI ESTÁ A CORREÇÃO: Passando a instância de conexão do Sequelize.
    sequelize: connection,
  } as any,
);

(VendaComanda as any).associate = function (models: IModelFactory) {
  if (!models) return;
  if (models.VendaItem) {
    VendaComanda.hasMany(models.VendaItem as any, {
      foreignKey: 'id_venda',
      as: 'itens',
    });
  }
  if (models.VendaMesa) {
    VendaComanda.belongsTo(models.VendaMesa as any, {
      foreignKey: 'id_mesa',
      as: 'mesa',
    });
  }
  if (models.Unidade) {
    VendaComanda.belongsTo(models.Unidade as any, {
      foreignKey: 'unidade_id',
      as: 'unidade',
    });
  }
};

export default VendaComanda;
