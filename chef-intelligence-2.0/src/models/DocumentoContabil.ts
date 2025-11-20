import { DataTypes, Model, Optional } from 'sequelize';
import { connection } from '../config/sequelize';
import { IModelFactory } from '@config/types';
import { ResolvedModelMap } from '../config/associations';
import ContaContabil from './ContaContabil';

export type TipoLancamentoContabil = 'DEBITO' | 'CREDITO';

// GPR-2: Tipagem Rígida e Completa - Attributes
export interface DocumentoContabilAttributes {
  id_documento_contabil: number; // GPR-5: Padrão de Chave Primária
  unidade_id: number; // GPR-1: Conformidade R4 (Multi-Unidade)
  data_lancamento: Date;
  conta_contabil_id: number; // Referência à Conta Contábil (Receita, Despesa, etc.)
  tipo_lancamento: TipoLancamentoContabil; // Débito ou Crédito
  valor: number;
  historico: string; // Descrição do lançamento (Ex: Venda Comanda #123)
  referencia_origem: string; // Tipo da origem (Ex: 'VendaComanda', 'RegistroFiscal')
  id_origem: number; // ID da origem (Ex: id_venda, id_registro_fiscal)
}

// GPR-2: Tipagem Rígida e Completa - CreationAttributes
export type DocumentoContabilCreationAttributes = Optional<
  DocumentoContabilAttributes,
  'id_documento_contabil' | 'data_lancamento'
>;

// GPR-2: Tipagem Rígida e Completa - Model Instance
export default class DocumentoContabil
  extends Model<
    DocumentoContabilAttributes,
    DocumentoContabilCreationAttributes
  >
  implements DocumentoContabilAttributes
{
  public id_documento_contabil!: number;
  public unidade_id!: number;
  public data_lancamento!: Date;
  public conta_contabil_id!: number;
  public tipo_lancamento!: TipoLancamentoContabil;
  public valor!: number;
  public historico!: string;
  public referencia_origem!: string;
  public id_origem!: number;

  public readonly contaContabil?: ContaContabil;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

DocumentoContabil.init(
  {
    id_documento_contabil: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    unidade_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'ID da Unidade de negócio (Regra R4)',
      references: { model: 'Unidades', key: 'id_unidade' },
    },
    data_lancamento: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    conta_contabil_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'ContasContabeis', key: 'id_conta_contabil' },
    },
    tipo_lancamento: {
      type: DataTypes.ENUM('DEBITO', 'CREDITO'),
      allowNull: false,
    },
    valor: {
      type: DataTypes.DECIMAL(10, 2), // R3: Garantia de precisão financeira
      allowNull: false,
      // GPR-4: Tratamento de Decimais
      get() {
        return parseFloat(this.getDataValue('valor') as unknown as string);
      },
    },
    historico: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    referencia_origem: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Nome do modelo de origem (Ex: VendaComanda)',
    },
    id_origem: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'ID do registro original (Ex: id_venda)',
    },
  },
  {
    sequelize: connection,
    tableName: 'DocumentosContabeis',
    underscored: true,
  },
);

// GPR-3: Associação Explícita
(DocumentoContabil as any).associate = function (models: ResolvedModelMap) {
  // GPR-1: Associação obrigatória à Unidade
  DocumentoContabil.belongsTo(models.Unidade, {
    foreignKey: 'unidade_id',
    as: 'unidade',
  });
  // Associação à Conta Contábil
  DocumentoContabil.belongsTo(models.ContaContabil, {
    foreignKey: 'conta_contabil_id',
    as: 'contaContabil',
  });
};
