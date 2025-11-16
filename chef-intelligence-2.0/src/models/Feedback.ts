// src/models/Feedback.ts
import { DataTypes, Model, Optional } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory } from "@config/types";

interface FeedbackAttributes {
  id_feedback: number;
  venda_comanda_id: number;
  colaborador_id: number; // Colaborador (vendedor/atendente)
  nps: number; // 0 a 10
  comentario: string;
  data_feedback: Date;
  // Rastreabilidade (PDCA):
  status_investigacao: "PENDENTE" | "INVESTIGANDO" | "CONCLUIDO";
  causa_raiz_identificada?: string | null;
}

type FeedbackCreationAttributes = Optional<
  FeedbackAttributes,
  "id_feedback" | "status_investigacao" | "data_feedback"
>;

export default class Feedback
  extends Model<FeedbackAttributes, FeedbackCreationAttributes>
  implements FeedbackAttributes
{
  public id_feedback!: number;
  public venda_comanda_id!: number;
  public colaborador_id!: number;
  public nps!: number;
  public comentario!: string;
  public data_feedback!: Date;
  public status_investigacao!: "PENDENTE" | "INVESTIGANDO" | "CONCLUIDO";
  public causa_raiz_identificada!: string | null;
}

Feedback.init(
  {
    id_feedback: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    venda_comanda_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "VendaComandas", key: "id_comanda" },
    },
    colaborador_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Colaboradores", key: "id_colaborador" },
    },
    nps: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    comentario: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    data_feedback: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    status_investigacao: {
      type: DataTypes.ENUM("PENDENTE", "INVESTIGANDO", "CONCLUIDO"),
      defaultValue: "PENDENTE",
      allowNull: false,
    },
    causa_raiz_identificada: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize: connection,
    tableName: "FeedbackClientes",
    underscored: true,
  }
);

(Feedback as any).associate = function (models: IModelFactory) {
  Feedback.belongsTo(models.VendaComanda, {
    foreignKey: "venda_comanda_id",
    as: "venda",
  });
  Feedback.belongsTo(models.Colaborador, {
    foreignKey: "colaborador_id",
    as: "colaborador",
  });
};
