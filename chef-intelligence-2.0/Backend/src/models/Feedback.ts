// src/models/Feedback.ts
import { DataTypes, Model, Optional } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory } from "../config/types";
// import { ResolvedModelMap } from '../config/associations'; // 🚨 REMOVIDO para usar IModelFactory

export interface FeedbackAttributes {
  id_feedback: number;
  venda_comanda_id: number;
  colaborador_id: number; // Colaborador (vendedor/atendente)
  nps: number; // 0 a 10
  comentario: string;
  data_feedback: Date; // Rastreabilidade (PDCA):
  status_investigacao: "PENDENTE" | "INVESTIGANDO" | "CONCLUIDO";
  causa_raiz_identificada?: string | null;
}

type FeedbackCreationAttributes = Optional<
  FeedbackAttributes,
  "id_feedback" | "status_investigacao" | "data_feedback"
>;

class Feedback
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
      references: { model: "VENDAS", key: "id_venda" },
    },
    colaborador_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "COLABORADORES", key: "id_colaborador" },
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
    tableName: "FEEDBACKCLIENTES",
    underscored: true,
  }
);

// 🚨 CORREÇÃO: Uso de IModelFactory e adição de verificações e casting (as any)
(Feedback as any).associate = function (models: IModelFactory) {
  // Associação 1: Feedback pertence a VendaComanda
  if (models.VendaComanda) {
    Feedback.belongsTo(models.VendaComanda as any, {
      foreignKey: "venda_comanda_id",
      as: "venda",
    });
  } // Associação 2: Feedback pertence a Colaborador

  if (models.Colaborador) {
    Feedback.belongsTo(models.Colaborador as any, {
      foreignKey: "colaborador_id",
      as: "colaborador",
    });
  }
};

export default Feedback;
