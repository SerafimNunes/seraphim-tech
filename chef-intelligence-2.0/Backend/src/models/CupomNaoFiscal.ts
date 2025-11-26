//src/models/CupomNaoFiscal.ts
import { DataTypes, Model, Optional } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory } from "../config/types";
// import { ResolvedModelMap } from '../config/associations'; // Removido

// GPR-2: Tipagem Rígida e Completa - Attributes
export interface CupomNaoFiscalAttributes {
  id_cupom_nao_fiscal: number;
  unidade_id: number;
  data_emissao: Date;
  valor_total: number;
  tipo_pagamento: "DINHEIRO" | "CARTAO" | "PIX";
  venda_comanda_id?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// GPR-2: Tipagem Rígida e Completa - CreationAttributes
export type CupomNaoFiscalCreationAttributes = Optional<
  CupomNaoFiscalAttributes,
  "id_cupom_nao_fiscal" | "data_emissao" | "createdAt" | "updatedAt"
>;

// GPR-2: Tipagem Rígida e Completa - Model Instance
// 🚨 CORREÇÃO TS2528: Removido 'export default' daqui
class CupomNaoFiscal
  extends Model<CupomNaoFiscalAttributes, CupomNaoFiscalCreationAttributes>
  implements CupomNaoFiscalAttributes
{
  public id_cupom_nao_fiscal!: number;
  public unidade_id!: number;
  public data_emissao!: Date;
  public valor_total!: number;
  public tipo_pagamento!: "DINHEIRO" | "CARTAO" | "PIX";
  public venda_comanda_id!: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CupomNaoFiscal.init(
  {
    id_cupom_nao_fiscal: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    unidade_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID da Unidade de negócio (Regra R4)",
    },
    data_emissao: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    valor_total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      get() {
        return parseFloat(
          this.getDataValue("valor_total") as unknown as string
        );
      },
    },
    tipo_pagamento: {
      type: DataTypes.ENUM("DINHEIRO", "CARTAO", "PIX"),
      allowNull: false,
    },
    venda_comanda_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "VENDAS", key: "id_venda" },
    },
  },
  {
    sequelize: connection,
    tableName: "CUPONS_NAO_FISCAIS",
    underscored: true,
  }
);

// GPR-3: Associação Explícita (IModelFactory)
(CupomNaoFiscal as any).associate = function (models: IModelFactory) {
  // GPR-1: Associação obrigatória à Unidade
  if (models.Unidade) {
    CupomNaoFiscal.belongsTo(models.Unidade as any, {
      foreignKey: "unidade_id",
      as: "unidade",
    });
  } else {
    console.warn(
      "Modelo Unidade não encontrado no Model Factory. Associação CupomNaoFiscal -> Unidade ignorada."
    );
  }

  if (models.VendaComanda) {
    CupomNaoFiscal.belongsTo(models.VendaComanda as any, {
      foreignKey: "venda_comanda_id",
      as: "vendaComanda",
    });
  } else if (models.VendaMesa) {
    CupomNaoFiscal.belongsTo(models.VendaMesa as any, {
      foreignKey: "venda_comanda_id",
      as: "vendaComanda",
    });
  } else {
    console.warn(
      "Modelo VendaComanda (ou VendaMesa) não encontrado no Model Factory. Associação CupomNaoFiscal -> VendaComanda ignorada."
    );
  }
};

// 🚨 CORREÇÃO TS2528: Apenas UMA exportação padrão no final.
export default CupomNaoFiscal;
