// src/models/Colaborador.ts (Versão Corrigida para TS)

import { DataTypes, Model, Optional, ModelCtor, ModelOptions } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory, NivelAcesso, StatusColaborador } from "../config/types";
import { CargoModel } from "./Cargo";
import Cargo from "./Cargo"; // Importa o modelo Cargo para usar na associação

// 1. Interfaces e Tipagem (Ajustada)

// Define os atributos que a tabela possui
export interface ColaboradorAttributes {
  id_colaborador: number;
  nome_completo: string;
  email: string;
  nivel_acesso: NivelAcesso; // Usando o tipo do seu types.ts
  cargo_id: number;
  status: StatusColaborador; // Usando o tipo do seu types.ts
  data_contratacao: Date;
}

// Atributos que são opcionais na criação (TS2344 corrigido)
export interface ColaboradorCreationAttributes
  extends Optional<ColaboradorAttributes, "id_colaborador" | "status"> {}

// 2. Definição da Classe do Modelo (TS2353 corrigido)
// A classe estende Model<Atributos, Atributos de Criação>
export class Colaborador
  extends Model<ColaboradorAttributes, ColaboradorCreationAttributes>
  implements ColaboradorAttributes
{
  // 🔑 NOVO: Defina os atributos como propriedades da classe (Sequelize V6/V7)
  public id_colaborador!: number;
  public nome_completo!: string;
  public email!: string;
  public nivel_acesso!: NivelAcesso;
  public cargo_id!: number;
  public status!: StatusColaborador;
  public data_contratacao!: Date;

  // Associações carregadas
  public cargo?: CargoModel;

  // Define a função estática para associações
  public static associate(models: IModelFactory) {
    Colaborador.belongsTo(models.Cargo as ModelCtor<CargoModel>, {
      foreignKey: "cargo_id",
      as: "cargo",
    });
  }
}

// 3. Inicialização do Modelo
Colaborador.init(
  {
    id_colaborador: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nome_completo: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
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
    status: {
      type: DataTypes.ENUM("ATIVO", "AFASTADO", "DESLIGADO"),
      allowNull: false,
      defaultValue: "ATIVO",
    },
    data_contratacao: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
  },
  // 4. Configurações de Sequelize
  {
    tableName: "COLABORADORES",
    sequelize: connection,
    timestamps: true,
    modelName: "Colaborador",
  }
);

// 5. Exportação (Apenas a Classe, o padrão é o mais simples)
export default Colaborador;

// ✅ CORREÇÃO TS2484: Removemos a declaração duplicada das interfaces de exportação.
// Elas já estão exportadas acima.
/*export {
  //ColaboradorModel, // Este era um problema, a classe Colaborador é o modelo
  ColaboradorAttributes,
  ColaboradorCreationAttributes,
};*/
