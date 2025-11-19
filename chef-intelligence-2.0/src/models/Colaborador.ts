// src/models/Colaborador.ts
import { DataTypes, Model, Optional, ModelCtor, ModelOptions } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory, NivelAcesso, StatusColaborador } from "../config/types";
import { CargoModel } from "./Cargo";
import Cargo from "./Cargo";

// 1. Interfaces e Tipagem (GPR-2)
export interface ColaboradorAttributes {
  id_colaborador: number;
  unidade_id: number; // Campo R4 Adicionado
  nome_completo: string;
  email: string;
  nivel_acesso: NivelAcesso;
  cargo_id: number;
  Status: StatusColaborador;
  data_contratacao: Date;
}

// Atributos que são opcionais na criação
export interface ColaboradorCreationAttributes
  extends Optional<ColaboradorAttributes, "id_colaborador" | "Status"> {}

// 2. Definição do Modelo (GPR-3)
export class Colaborador
  extends Model<ColaboradorAttributes, ColaboradorCreationAttributes>
  implements ColaboradorAttributes
{
  // NOVO: Defina os atributos como propriedades da Classe
  public id_colaborador!: number;
  public unidade_id!: number; //GPR-1: Propriedade R4
  public nome_completo!: string;
  public email!: string;
  public nivel_acesso!: NivelAcesso;
  public cargo_id!: number;
  public Status!: StatusColaborador;
  public data_contratacao!: Date;
  public cargo?: CargoModel; // Associação opcional com Cargo

  // Define a função estática para associações (GPR-3)
  public static associate(models: IModelFactory): void {
    Colaborador.belongsTo(models.Cargo as ModelCtor<CargoModel>, {
      foreignKey: "cargo_id",
      as: "cargo",
    });
    Colaborador.belongsTo(models.Unidade as ModelCtor<CargoModel>, {
      foreignKey: "unidade_id",
      as: "unidade",
    });
  }
}

// 3. Inicialização do Modelo (GPR-3)
Colaborador.init(
  {
    id_colaborador: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true, // GPR-5
    },
    unidade_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID da unidade de negócio",
    },
    nome_completo: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true, // GPR-5: Email único
    },
    nivel_acesso: {
      type: DataTypes.ENUM("COLABORADOR", "GESTOR", "ADMIN"),
      allowNull: false,
      defaultValue: "COLABORADOR",
    },
    cargo_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    Status: {
      type: DataTypes.ENUM("ATIVO", "AFASTADO", "DESLIGADO"),
      allowNull: false,
      defaultValue: "ATIVO",
    },
    data_contratacao: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
  },
  // 4. Configurações de sequelize (GPR-3)
  {
    tableName: "COLABORADORES",
    sequelize: connection,
    timestamps: false,
    modelName: "Colaborador",
  }
);

// 5. Exportação do Modelo
export default Colaborador;
