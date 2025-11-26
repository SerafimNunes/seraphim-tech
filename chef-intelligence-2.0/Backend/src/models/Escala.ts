//src/models/Escala.ts
import { DataTypes, Model, Optional, ModelCtor } from "sequelize";
import { connection } from "../config/sequelize";
import Colaborador from "./Colaborador"; // Assumindo que este modelo existe
import Usuario from "./Usuario"; // Assumindo que este modelo existe
import { IModelFactory } from "../config/types"; // Importando o tipo para as associações

// 1. Definição da interface de atributos
export interface EscalaAttributes {
  // Exportado para uso em outros arquivos (e.g., payloads)
  id_escala: number; // Chave Primária ajustada
  unidade_id: number;
  data_inicio: Date;
  data_fim: Date;
  status: "PENDENTE" | "APROVADA" | "REJEITADA";
  criador_id: number; // ID do Usuário/Colaborador que criou
  aprovador_id?: number; // ID do Usuário/Colaborador que aprovou
  // ...
}

// 2. Definindo atributos opcionais na criação
export interface EscalaCreationAttributes
  extends Optional<EscalaAttributes, "id_escala" | "status" | "aprovador_id"> {}

// 3. Definição da classe Model
export class Escala
  extends Model<EscalaAttributes, EscalaCreationAttributes>
  implements EscalaAttributes
{
  public id_escala!: number;
  public unidade_id!: number;
  public data_inicio!: Date;
  public data_fim!: Date;
  public status!: "PENDENTE" | "APROVADA" | "REJEITADA";
  public criador_id!: number;
  public aprovador_id?: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associações (Adicione o 'as any' para evitar erros de tipagem com a interface IModelFactory)
  public static associate(models: IModelFactory) {
    Escala.belongsTo(models.Usuario as any, {
      foreignKey: "criador_id",
      as: "Criador",
    });
    Escala.belongsTo(models.Usuario as any, {
      foreignKey: "aprovador_id",
      as: "Aprovador",
    });
    Escala.belongsToMany(models.Colaborador as any, {
      through: "EscalaColaboradores",
      foreignKey: "escala_id",
      as: "Colaboradores",
    });
  }
}

// ** CORREÇÃO DE TIPAGEM: Exporta o tipo para que outros services possam importar **
// Isso resolve o erro 'Cannot find name EscalaModel'
export type EscalaModel = Escala;

// 4. Inicialização do Modelo
Escala.init(
  {
    id_escala: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: "id_escala", // Garante que o nome do campo seja correto
    },
    unidade_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    data_inicio: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    data_fim: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("PENDENTE", "APROVADA", "REJEITADA"),
      allowNull: false,
      defaultValue: "PENDENTE",
    },
    criador_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      // Assumindo que o criador é um ID de Usuário (login)
      references: { model: "USUARIOS", key: "id_usuario" },
    },
    aprovador_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      // Assumindo que o aprovador é um ID de Usuário (login)
      references: { model: "USUARIOS", key: "id_usuario" },
    },
  },
  {
    tableName: "ESCALAS", // Usando maiúsculas para consistência
    sequelize: connection,
    timestamps: true,
    underscored: true, // Usa snake_case para colunas automáticas
  }
);

export default Escala;
