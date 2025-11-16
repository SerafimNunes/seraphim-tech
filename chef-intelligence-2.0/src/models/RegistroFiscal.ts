// src/models/RegistroFiscal.ts

import { DataTypes, Model, Optional } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory } from "../config/types";
import Unidade from "./Unidade"; // Importado diretamente
import { ModelCtor } from "sequelize";

export type TipoOrigemFiscal = "VENDA" | "COMPRA" | "TRANSFERENCIA";

export interface RegistroFiscalAttributes {
  id_registro_fiscal: number;
  unidade_id: number; //R4: Multi-Unidade
  tipo_registro: "ENTRADA_COMPRA" | "SAIDA_VENDA" | "AJUSTE";
  id_origem: number;
  tipo_origem: TipoOrigemFiscal;
  numero_documento: string;
  data_emissao: Date;
  valor_total_documento: number;
  imposto_simples: number;
  cst_cfop_padrao: string;
  observacoes_fisco: string | null;
  chave_acesso_nfe: string | null;
}

export interface RegistroFiscalCreationAttributes
  extends Optional<
    RegistroFiscalAttributes,
    | "id_registro_fiscal"
    | "data_emissao"
    | "observacoes_fisco"
    | "chave_acesso_nfe"
  > {}

export class RegistroFiscal
  extends Model<RegistroFiscalAttributes, RegistroFiscalCreationAttributes>
  implements RegistroFiscalAttributes
{
  public id_registro_fiscal!: number;
  public unidade_id!: number;
  public tipo_registro!: "ENTRADA_COMPRA" | "SAIDA_VENDA" | "AJUSTE";
  public id_origem!: number;
  public tipo_origem!: TipoOrigemFiscal;
  public numero_documento!: string;
  public data_emissao!: Date;
  public valor_total_documento!: number;
  public imposto_simples!: number;
  public cst_cfop_padrao!: string;
  public observacoes_fisco!: string | null;
  public chave_acesso_nfe!: string | null;

  /**
   * Define as associações do modelo, essenciais para R4.
   */
  public static associate(models: IModelFactory) {
    // 🔑 CORREÇÃO CRÍTICA: Usar a referência 'Unidade' importada diretamente
    // para garantir que o belongsTo receba uma subclasse válida de Model.
    (RegistroFiscal as any).belongsTo(Unidade as ModelCtor<Unidade>, {
      foreignKey: "unidade_id",
      as: "unidade",
    });
    // As associações polimórficas (Venda, Compra) seriam definidas aqui.
  }
}

RegistroFiscal.init(
  {
    id_registro_fiscal: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    unidade_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Unidades", key: "id_unidade" },
    },
    tipo_registro: {
      type: DataTypes.ENUM("ENTRADA_COMPRA", "SAIDA_VENDA", "AJUSTE"),
      allowNull: false,
    },
    id_origem: { type: DataTypes.INTEGER, allowNull: false },
    tipo_origem: { type: DataTypes.STRING(30), allowNull: false },
    numero_documento: { type: DataTypes.STRING(50), allowNull: false },
    data_emissao: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    valor_total_documento: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      get() {
        return parseFloat(
          this.getDataValue("valor_total_documento") as unknown as string
        );
      },
    },
    imposto_simples: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      get() {
        return parseFloat(
          this.getDataValue("imposto_simples") as unknown as string
        );
      },
    },
    cst_cfop_padrao: { type: DataTypes.STRING(10), allowNull: false },
    observacoes_fisco: { type: DataTypes.STRING(255), allowNull: true },
    chave_acesso_nfe: { type: DataTypes.STRING(44), allowNull: true },
  },
  {
    tableName: "REGISTROS_FISCAIS",
    sequelize: connection,
    timestamps: true,
    modelName: "RegistroFiscal",
  }
);

export default RegistroFiscal;
