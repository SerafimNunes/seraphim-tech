import { DataTypes, Model, Optional } from 'sequelize';
import { connection } from '../config/sequelize';
import { IModelFactory } from '../config/types'; // Importando para associação

export type TipoLancamento = 'RECEITA' | 'DESPESA' | 'SANGRIA' | 'REFORCO';

export interface LancamentoAttributes {
  id_lancamento: number;
  id_caixa: number | null;
  // GPR-1: Adicionando o campo de segurança R4
  unidade_id: number;
  colaborador_id: number;
  tipo_lancamento: TipoLancamento;
  valor: number; // Stored as DECIMAL(10, 2)
  descricao: string;
  categoria: string | null;
  data_lancamento: Date; // Opcional para rastreabilidade de origem (ex: qual venda gerou)
  id_origem: number | null;
  tipo_origem: 'VENDA' | 'PEDIDO' | null;
}

export interface LancamentoCreationAttributes
  extends Optional<
    LancamentoAttributes,
    | 'id_lancamento'
    | 'data_lancamento'
    | 'id_caixa'
    | 'categoria'
    | 'id_origem'
    | 'tipo_origem'
  > {}

// Renomeado para Lancamento (R6)
export class Lancamento
  extends Model<LancamentoAttributes, LancamentoCreationAttributes>
  implements LancamentoAttributes
{
  public id_lancamento!: number;
  public id_caixa!: number | null;
  public unidade_id!: number; // GPR-1: Adicionando à instância
  public colaborador_id!: number;
  public tipo_lancamento!: TipoLancamento;
  public valor!: number;
  public descricao!: string;
  public categoria!: string | null;
  public data_lancamento!: Date;
  public id_origem!: number | null;
  public tipo_origem!: 'VENDA' | 'PEDIDO' | null; // Associações (a serem definidas no arquivo index de modelos) // public readonly caixa?: CaixaModel;
}

Lancamento.init(
  {
    id_lancamento: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_caixa: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'CAIXAS', key: 'id_caixa' },
    },
    // GPR-1: Adicionando campo de segurança R4
    unidade_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'ID da Unidade de negócio (Regra R4)',
      references: { model: 'Unidades', key: 'id_unidade' },
    },
    colaborador_id: { type: DataTypes.INTEGER, allowNull: false },
    tipo_lancamento: { type: DataTypes.STRING(20), allowNull: false },
    valor: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false, // 🔑 R1: Getter já estava presente
      get() {
        return parseFloat(this.getDataValue('valor') as unknown as string);
      },
    },
    descricao: { type: DataTypes.STRING(255), allowNull: false },
    categoria: { type: DataTypes.STRING(50), allowNull: true },
    data_lancamento: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    id_origem: { type: DataTypes.INTEGER, allowNull: true },
    tipo_origem: { type: DataTypes.STRING(10), allowNull: true },
  },
  {
    tableName: 'LANCAMENTOS',
    sequelize: connection,
    timestamps: false,
    modelName: 'Lancamento',
  },
);

// GPR-3: Associação Explícita
(Lancamento as any).associate = function (models: IModelFactory) {
  // GPR-1: Associação obrigatória à Unidade
  Lancamento.belongsTo(models.Unidade, {
    foreignKey: 'unidade_id',
    as: 'unidade',
  });
  Lancamento.belongsTo(models.Caixa, {
    foreignKey: 'id_caixa',
    as: 'caixa',
  });
};

export default Lancamento;
