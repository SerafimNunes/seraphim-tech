//src/models/VendaMesa.ts
import { DataTypes, Model, Optional, ModelCtor } from 'sequelize';
import { connection } from '../config/sequelize';
import { IModelFactory } from '../config/types'; // Importação necessária para a tipagem de associação
import { ResolvedModelMap } from '../config/associations';
import VendaComanda from './VendaComanda'; // 🔑 Importado
import Unidade from './Unidade'; // 🔑 Importado para R4

export type StatusMesa =
  | 'LIVRE'
  | 'OCUPADA'
  | 'AGUARDANDO_FECHAMENTO'
  | 'MANUTENCAO';

export interface VendaMesaAttributes {
  id_mesa: number; // GPR-5: Padrão de Chave Primária
  unidade_id: number; // 🔑 R4: Implementação da regra Multi-Unidade
  numero_mesa: number;
  status_mesa: StatusMesa;
  colaborador_id_responsavel: number | null;
  data_abertura: Date | null;
  id_venda_atual: number | null; // Chave para a Comanda (Venda) aberta
}

export interface VendaMesaCreationAttributes
  extends Optional<
    VendaMesaAttributes,
    | 'id_mesa'
    | 'status_mesa'
    | 'colaborador_id_responsavel'
    | 'data_abertura'
    | 'id_venda_atual'
  > {}

export interface VendaMesaModel
  extends Model<VendaMesaAttributes, VendaMesaCreationAttributes>,
    VendaMesaAttributes {
  // Associações
  vendaAtual?: VendaComanda; // Associa a Comanda aberta
}

const VendaMesa: ModelCtor<VendaMesaModel> = connection.define<VendaMesaModel>(
  'VendaMesa',
  {
    id_mesa: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    unidade_id: {
      // 🔑 R4: Adicionado
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'ID da Unidade de negócio (Regra R4)',
      references: { model: 'Unidades', key: 'id_unidade' },
    },
    numero_mesa: { type: DataTypes.INTEGER, allowNull: false }, // Removido 'unique: true' para permitir duplicidade se 'unidade_id' for diferente, mas mantido o índice composto abaixo
    status_mesa: {
      type: DataTypes.ENUM<StatusMesa>(
        'LIVRE',
        'OCUPADA',
        'AGUARDANDO_FECHAMENTO',
        'MANUTENCAO',
      ), // Ajustado para ENUM
      allowNull: false,
      defaultValue: 'LIVRE',
    },
    colaborador_id_responsavel: { type: DataTypes.INTEGER, allowNull: true },
    data_abertura: { type: DataTypes.DATE, allowNull: true },
    id_venda_atual: { type: DataTypes.INTEGER, allowNull: true, unique: true },
  },
  {
    tableName: 'MESAS',
    timestamps: true,
    modelName: 'VendaMesa',
    // Criamos um índice composto para garantir que numero_mesa seja único por unidade (R4)
    indexes: [
      { fields: ['status_mesa'] },
      { unique: true, fields: ['unidade_id', 'numero_mesa'] },
    ],
  },
);

(VendaMesa as any).associate = function (models: ResolvedModelMap) {
  // 🔑 R4: Associa com a Unidade
  VendaMesa.belongsTo(models.Unidade, {
    foreignKey: 'unidade_id',
    as: 'unidade',
  });

  // Associações de Negócio
  VendaMesa.belongsTo(models.VendaComanda, {
    foreignKey: 'id_venda_atual',
    as: 'vendaAtual',
  });
  VendaMesa.hasMany(models.VendaComanda, {
    foreignKey: 'id_mesa',
    as: 'historicoComandas',
  }); // Histórico de vendas
  // Colaborador deve ser associado aqui se o Model existir.
};

export default VendaMesa;
