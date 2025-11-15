import { DataTypes, Model, Optional } from "sequelize";
import { connection } from "../config/sequelize";

export type StatusCaixa = "ABERTO" | "FECHADO";

export interface CaixaAttributes {
  id_caixa: number;
  colaborador_id_abertura: number;
  colaborador_id_fechamento: number | null;
  data_abertura: Date;
  data_fechamento: Date | null;
  saldo_inicial: number;
  total_vendas: number;
  total_despesas: number;
  saldo_final_calculado: number;
  status_caixa: StatusCaixa;
  // REMOVIDO: unidade_id
}

export interface CaixaCreationAttributes
  extends Optional<
    CaixaAttributes,
    | "id_caixa"
    | "data_abertura"
    | "colaborador_id_fechamento"
    | "data_fechamento"
    | "total_vendas"
    | "total_despesas"
    | "saldo_final_calculado"
    | "status_caixa"
  > {}

export class Caixa
  extends Model<CaixaAttributes, CaixaCreationAttributes>
  implements CaixaAttributes
{
  public id_caixa!: number;
  public colaborador_id_abertura!: number;
  public colaborador_id_fechamento!: number | null;
  public data_abertura!: Date;
  public data_fechamento!: Date | null;
  public saldo_inicial!: number;
  public total_vendas!: number;
  public total_despesas!: number;
  public saldo_final_calculado!: number;
  public status_caixa!: StatusCaixa;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Caixa.init(
  {
    id_caixa: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    colaborador_id_abertura: { type: DataTypes.INTEGER, allowNull: false },
    colaborador_id_fechamento: { type: DataTypes.INTEGER, allowNull: true },
    data_abertura: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    data_fechamento: { type: DataTypes.DATE, allowNull: true },
    saldo_inicial: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      get() {
        return parseFloat(
          this.getDataValue("saldo_inicial") as unknown as string
        );
      },
    },
    total_vendas: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      get() {
        return parseFloat(
          this.getDataValue("total_vendas") as unknown as string
        );
      },
    },
    total_despesas: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      get() {
        return parseFloat(
          this.getDataValue("total_despesas") as unknown as string
        );
      },
    },
    saldo_final_calculado: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      get() {
        return parseFloat(
          this.getDataValue("saldo_final_calculado") as unknown as string
        );
      },
    },
    status_caixa: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "ABERTO",
    },
  },
  {
    tableName: "CAIXAS",
    sequelize: connection,
    timestamps: true,
    modelName: "Caixa",
  }
);

(Caixa as any).associate = function (models: any) {
  // Associações serão definidas em breve
};

export default Caixa;
