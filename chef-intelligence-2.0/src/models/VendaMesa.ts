import { DataTypes, Model, Optional } from "sequelize";
import { connection } from "../config/sequelize";

export type StatusMesa =
  | "LIVRE"
  | "OCUPADA"
  | "AGUARDANDO_FECHAMENTO"
  | "MANUTENCAO";

export interface VendaMesaAttributes {
  id_mesa: number;
  numero_mesa: number;
  status_mesa: StatusMesa;
  colaborador_id_responsavel: number | null;
  data_abertura: Date | null;
  id_venda_atual: number | null; // Chave para a Comanda (Venda) aberta // REMOVIDO: unidade_id
}

export interface VendaMesaCreationAttributes
  extends Optional<
    VendaMesaAttributes,
    | "id_mesa"
    | "status_mesa"
    | "colaborador_id_responsavel"
    | "data_abertura"
    | "id_venda_atual"
  > {}

export class VendaMesa
  extends Model<VendaMesaAttributes, VendaMesaCreationAttributes>
  implements VendaMesaAttributes
{
  public id_mesa!: number;
  public numero_mesa!: number;
  public status_mesa!: StatusMesa;
  public colaborador_id_responsavel!: number | null;
  public data_abertura!: Date | null;
  public id_venda_atual!: number | null;
}

VendaMesa.init(
  {
    id_mesa: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    numero_mesa: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    status_mesa: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "LIVRE",
    },
    colaborador_id_responsavel: { type: DataTypes.INTEGER, allowNull: true },
    data_abertura: { type: DataTypes.DATE, allowNull: true },
    id_venda_atual: { type: DataTypes.INTEGER, allowNull: true, unique: true }, // REMOVIDO: unidade_id
  },
  {
    tableName: "MESAS",
    sequelize: connection,
    timestamps: true,
    modelName: "VendaMesa",
    indexes: [{ fields: ["status_mesa"] }],
  }
);

(VendaMesa as any).associate = function (models: any) {
  // Associações serão definidas em breve
};

export default VendaMesa;
