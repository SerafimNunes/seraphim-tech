import { DataTypes, Model, Optional, Sequelize } from "sequelize";
import { connection } from "../config/sequelize";
import Unidade from "./Unidade";
import Colaborador from "./Colaborador";
// Nota: Importações de modelos associados não são necessárias aqui, apenas no arquivo de setup (index.ts)

export type StatusCaixa = "ABERTO" | "FECHADO";

export interface CaixaAttributes {
  id_caixa: number;
  unidade_id: number; // GPR-1: Adicionando o campo de segurança R4
  colaborador_id_abertura: number;
  colaborador_id_fechamento: number | null;
  data_abertura: Date;
  data_fechamento: Date | null;
  saldo_inicial: number;
  total_vendas: number;
  total_despesas: number;
  saldo_final_calculado: number;
  status_caixa: StatusCaixa;
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
  public unidade_id!: number;
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
  public readonly updatedAt!: Date; // Métodos auxiliares

  public calcularSaldoFinal(): number {
    return this.saldo_inicial + this.total_vendas - this.total_despesas;
  }

  public atualizarTotais(vendas: number, despesas: number) {
    this.total_vendas = vendas;
    this.total_despesas = despesas;
    this.saldo_final_calculado = this.calcularSaldoFinal();
  }

  public static associate(models: any) {
    // Associações BelongsTo (Corretas)
    Caixa.belongsTo(models.Unidade, {
      foreignKey: "unidade_id",
      as: "unidade",
    });
    Caixa.belongsTo(models.Colaborador, {
      foreignKey: "colaborador_id_abertura",
      as: "aberturaColaborador",
    });
    Caixa.belongsTo(models.Colaborador, {
      foreignKey: "colaborador_id_fechamento",
      as: "fechamentoColaborador",
      constraints: false, // Permite NULL se o caixa ainda não foi fechado
    }); // NOVAS ASSOCIAÇÕES (Substituindo as incorretas 'Venda' e 'Despesa')
    // ----------------------------------------------------------------------
    // 1. Associações de Vendas: Usando os modelos identificados no seu log
    // Verifique se estas são as chaves corretas no seu objeto 'models'!

    Caixa.hasMany(models.VendaMesa, {
      foreignKey: "caixa_id",
      as: "vendasMesa",
    });
    Caixa.hasMany(models.VendaComanda, {
      foreignKey: "caixa_id",
      as: "vendasComanda",
    }); // 2. Associações de Movimentos/Despesas: Usando o modelo 'Lancamento'
    // Assumindo que 'Lancamento' registra despesas/movimentos do caixa.

    Caixa.hasMany(models.Lancamento, {
      foreignKey: "caixa_id",
      as: "lancamentosCaixa",
    }); // As linhas abaixo foram removidas pois os modelos 'Venda' e 'Despesa' não existem.
    // Caixa.hasMany(models.Venda, { foreignKey: 'caixa_id', as: 'vendas' });
    // Caixa.hasMany(models.Despesa, { foreignKey: 'caixa_id', as: 'despesas' });
  }
}

Caixa.init(
  {
    id_caixa: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    unidade_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID da Unidade de negócio (Regra R4)",
      references: { model: "UNIDADES", key: "id_unidade" },
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

export default Caixa;
