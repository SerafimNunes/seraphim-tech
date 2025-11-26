import { DataTypes, Model, Optional } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory } from "../config/types";
// 🚨 REMOVIDO: import { ResolvedModelMap } from '../config/associations';

export type TipoLancamento = "RECEITA" | "DESPESA" | "SANGRIA" | "REFORCO";

export interface LancamentoAttributes {
  id_lancamento: number;
  id_caixa: number | null; // GPR-1: Adicionando o campo de segurança R4
  unidade_id: number;
  colaborador_id: number;
  tipo_lancamento: TipoLancamento;
  valor: number; // Stored as DECIMAL(10, 2)
  descricao: string;
  categoria: string | null;
  data_lancamento: Date; // Opcional para rastreabilidade de origem (ex: qual venda gerou)
  id_origem: number | null;
  tipo_origem: "VENDA" | "PEDIDO" | null;
}

export interface LancamentoCreationAttributes
  extends Optional<
    LancamentoAttributes,
    | "id_lancamento"
    | "data_lancamento"
    | "id_caixa"
    | "categoria"
    | "id_origem"
    | "tipo_origem"
  > {}

// 🚨 CORREÇÃO TS2528: Removido 'export default' e 'export' da declaração da classe
class Lancamento
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
  public tipo_origem!: "VENDA" | "PEDIDO" | null;
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
      references: { model: "CAIXAS", key: "id_caixa" },
    }, // GPR-1: Adicionando campo de segurança R4
    unidade_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID da Unidade de negócio (Regra R4)",
      references: { model: "UNIDADES", key: "id_unidade" },
    },
    colaborador_id: { type: DataTypes.INTEGER, allowNull: false },
    tipo_lancamento: { type: DataTypes.STRING(20), allowNull: false },
    valor: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      get() {
        return parseFloat(this.getDataValue("valor") as unknown as string);
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
    tableName: "LANCAMENTOS",
    sequelize: connection,
    timestamps: false,
    modelName: "Lancamento",
  }
);

// 🚨 CORREÇÃO: Uso de IModelFactory e robustez (if + as any)
(Lancamento as any).associate = function (models: IModelFactory) {
  // GPR-1: Associação obrigatória à Unidade
  if (models.Unidade) {
    Lancamento.belongsTo(models.Unidade as any, {
      foreignKey: "unidade_id",
      as: "unidade",
    });
  } else {
    console.warn(
      "Modelo Unidade não carregado. Associação Lancamento -> Unidade ignorada."
    );
  }
  // Associação à Caixa
  if (models.Caixa) {
    Lancamento.belongsTo(models.Caixa as any, {
      foreignKey: "id_caixa",
      as: "caixa",
    });
  } else {
    console.warn(
      "Modelo Caixa não carregado. Associação Lancamento -> Caixa ignorada."
    );
  }
};

export default Lancamento;
