// EstoqueRegistroMovimento.ts
import { DataTypes, Model, Optional } from "sequelize";
import { connection } from "../config/sequelize";

// Tipos de Movimento (União de strings literais)
export type TipoMovimentoEstoque =
  | "ENTRADA"
  | "SAIDA_VENDA"
  | "AJUSTE_ENTRADA" // Ajuste genérico de entrada
  | "AJUSTE_SAIDA" // Ajuste genérico de saída
  | "AJUSTE_SOBRA" // 🔑 NOVO: Ajuste específico de contagem (ENTRADA)
  | "AJUSTE_PERDA" // 🔑 NOVO: Ajuste específico de contagem (SAÍDA)
  | "TRANSFERENCIA"
  | "PRODUCAO_ENTRADA";

// Atributos do Model (Campos da Tabela)
export interface EstoqueRegistroMovimentoAttributes {
  id_movimento: number;
  id_produto: number;
  tipo_movimento: TipoMovimentoEstoque;
  quantidade: number;
  custo_unitario: number;
  custo_total: number;
  data_movimento: Date;
  referencia_documento: string; // Ex: 'COMPRA#10', 'VENDA#50', 'AJUSTE_USER#9'
  id_origem: number | null; // ID da Venda, Compra, ou Ajuste
  tipo_origem: string | null; // Ex: 'VENDA', 'COMPRA', 'AJUSTE'
}

// Atributos de criação (id_movimento é opcional, pois é auto-incrementado)
export interface EstoqueRegistroMovimentoCreationAttributes
  extends Optional<EstoqueRegistroMovimentoAttributes, "id_movimento"> {}

// Definição do Model
export class EstoqueRegistroMovimento
  extends Model<
    EstoqueRegistroMovimentoAttributes,
    EstoqueRegistroMovimentoCreationAttributes
  >
  implements EstoqueRegistroMovimentoAttributes
{
  public id_movimento!: number;
  public id_produto!: number;
  public tipo_movimento!: TipoMovimentoEstoque;
  public quantidade!: number;
  public custo_unitario!: number;
  public custo_total!: number;
  public data_movimento!: Date;
  public referencia_documento!: string;
  public id_origem!: number | null;
  public tipo_origem!: string | null;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// Inicialização do Model
EstoqueRegistroMovimento.init(
  {
    id_movimento: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    id_produto: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    tipo_movimento: {
      type: DataTypes.STRING(20),
      allowNull: false,
      // Garante que apenas os tipos definidos no union type sejam aceitos no banco
      validate: {
        isIn: [
          [
            "ENTRADA",
            "SAIDA_VENDA",
            "AJUSTE_ENTRADA",
            "AJUSTE_SAIDA",
            "AJUSTE_SOBRA", // 🔑 Incluído na validação do Sequelize
            "AJUSTE_PERDA", // 🔑 Incluído na validação do Sequelize
            "TRANSFERENCIA",
            "PRODUCAO_ENTRADA",
          ],
        ],
      },
    },
    quantidade: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false,
    },
    custo_unitario: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false,
    },
    custo_total: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false,
    },
    data_movimento: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    referencia_documento: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    id_origem: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    tipo_origem: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    sequelize: connection,
    tableName: "estoque_registros_movimento",
  }
);

export default EstoqueRegistroMovimento;
