import { DataTypes, Model, Optional, ModelCtor } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory } from "../config/types";
import { ColaboradorModel } from "./Colaborador";

// Definição dos Atributos (R1)
export interface HistoricoPerformanceAttributes {
  id_historico: number;
  colaborador_id: number;
  data_registro: Date;
  erros_registrados: number;
  desperdicio_total: number; // Valor monetário ou qtd
  nota_final?: number; // Calculado ou inputado
  observacoes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Atributos opcionais na criação
export interface HistoricoPerformanceCreationAttributes
  extends Optional<
    HistoricoPerformanceAttributes,
    "id_historico" | "data_registro"
  > {}

// Interface do Modelo
export interface HistoricoPerformanceModel
  extends Model<
      HistoricoPerformanceAttributes,
      HistoricoPerformanceCreationAttributes
    >,
    HistoricoPerformanceAttributes {
  // Associações
  colaborador?: ColaboradorModel;
}

const HistoricoPerformance: ModelCtor<HistoricoPerformanceModel> =
  connection.define<HistoricoPerformanceModel>(
    "HistoricoPerformance",
    {
      id_historico: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      colaborador_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "COLABORADORES",
          key: "id_colaborador",
        },
      },
      data_registro: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      erros_registrados: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      desperdicio_total: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
        get() {
          const v = this.getDataValue("desperdicio_total") as unknown as
            | string
            | number;
          return v == null ? 0 : parseFloat(String(v));
        },
      },
      nota_final: {
        type: DataTypes.DECIMAL(4, 2),
        allowNull: true,
      },
      observacoes: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      tableName: "HISTORICO_PERFORMANCE",
      timestamps: true,
      modelName: "HistoricoPerformance",
    }
  );

// Associação
(HistoricoPerformance as any).associate = (models: IModelFactory) => {
  if (models.Colaborador) {
    HistoricoPerformance.belongsTo(models.Colaborador as any, {
      foreignKey: "colaborador_id",
      as: "colaborador",
    });
  }
};

export default HistoricoPerformance;
