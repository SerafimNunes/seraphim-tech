import { DataTypes, Model, Optional } from 'sequelize';
import { connection } from '../config/sequelize';
import { IModelFactory } from '@config/types';

export type TipoConta =
  | 'RECEITA'
  | 'CUSTO'
  | 'DESPESA'
  | 'ATIVO'
  | 'PASSIVO'
  | 'PATRIMONIO_LIQUIDO';
export type NaturezaConta = 'DEVEDORA' | 'CREDORA';

// GPR-2: Tipagem Rígida e Completa - Attributes
export interface ContaContabilAttributes {
  id_conta_contabil: number; // GPR-5: Padrão de Chave Primária
  codigo: string; // Ex: 1.1.01.001
  nome_conta: string;
  tipo_conta: TipoConta; // Macro-grupo (RECEITA, DESPESA, etc.)
  natureza: NaturezaConta; // Se aumenta no Débito (Devedora) ou Crédito (Credora)
  conta_pai_id: number | null; // Para hierarquia (Árvore de contas)
  eh_analitica: boolean; // True se for a conta final onde os lançamentos ocorrem
}

// GPR-2: Tipagem Rígida e Completa - CreationAttributes
export type ContaContabilCreationAttributes = Optional<
  ContaContabilAttributes,
  'id_conta_contabil' | 'conta_pai_id'
>;

// GPR-2: Tipagem Rígida e Completa - Model Instance
export default class ContaContabil
  extends Model<ContaContabilAttributes, ContaContabilCreationAttributes>
  implements ContaContabilAttributes
{
  public id_conta_contabil!: number;
  public codigo!: string;
  public nome_conta!: string;
  public tipo_conta!: TipoConta;
  public natureza!: NaturezaConta;
  public conta_pai_id!: number | null;
  public eh_analitica!: boolean;

  public readonly contaPai?: ContaContabil;
  public readonly subContas?: ContaContabil[];

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ContaContabil.init(
  {
    id_conta_contabil: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    codigo: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      comment: 'Código da conta (ex: 1.1.01.001)',
    },
    nome_conta: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    tipo_conta: {
      type: DataTypes.ENUM(
        'RECEITA',
        'CUSTO',
        'DESPESA',
        'ATIVO',
        'PASSIVO',
        'PATRIMONIO_LIQUIDO',
      ),
      allowNull: false,
    },
    natureza: {
      type: DataTypes.ENUM('DEVEDORA', 'CREDORA'),
      allowNull: false,
    },
    conta_pai_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'ContasContabeis', key: 'id_conta_contabil' },
    },
    eh_analitica: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Se True, permite lançamentos diretos (contas finais).',
    },
  },
  {
    sequelize: connection,
    tableName: 'ContasContabeis',
    underscored: true,
  },
);

// GPR-3: Associação Explícita (Hierarquia)
(ContaContabil as any).associate = function (models: IModelFactory) {
  // Auto-associação para criar a hierarquia Pai/Filho
  ContaContabil.belongsTo(models.ContaContabil, {
    as: 'contaPai',
    foreignKey: 'conta_pai_id',
  });
  ContaContabil.hasMany(models.ContaContabil, {
    as: 'subContas',
    foreignKey: 'conta_pai_id',
  });
};
