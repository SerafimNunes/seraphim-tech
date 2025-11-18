import { DataTypes, Model, ModelCtor } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory } from "../config/types";
import { CargoModel } from "./Cargo"; // Importa o tipo do Cargo
import Cargo from "./Cargo"; // Importa o modelo Cargo para a associação

// Interface para os atributos de Usuário
interface UsuarioAttributes {
  id_usuario: number; // Renomeado para seguir o padrão
  email: string;
  senha_hash: string; // Adicionado para ser usado pelo AuthService.login
  cargo_id: number; // 🔑 CHAVE CRÍTICA ADICIONADA para o relacionamento com Cargo
  unidade_id: number; // Campo crucial para o R4 (Multi-Unidade) // ... outros campos (nome, etc.)
}

/**
 * Modelo Sequelize para a tabela 'usuarios'.
 * Implementa o relacionamento com Cargo (e indiretamente Permissões) para o RBAC.
 */
export default class Usuario
  extends Model<UsuarioAttributes>
  implements UsuarioAttributes
{
  public id_usuario!: number;
  public email!: string;
  public senha_hash!: string;
  public cargo_id!: number;
  public unidade_id!: number; // Associações carregadas

  public cargo?: CargoModel; // R12: Permite carregar o objeto Cargo // Associações (CRÍTICO para o AuthService)

  public static associate(models: IModelFactory) {
    Usuario.belongsTo(models.Cargo as ModelCtor<CargoModel>, {
      foreignKey: "cargo_id",
      as: "cargo", // 🔑 ALIAS CRÍTICO: Deve ser 'cargo' para o AuthService
    });
  }
}

// Inicialização do Modelo
Usuario.init(
  {
    id_usuario: {
      type: DataTypes.INTEGER, // Ajustado de UNSIGNED
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    senha_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    cargo_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "CARGOS", // Nome da tabela
        key: "id_cargo",
      },
    },
    unidade_id: {
      type: DataTypes.INTEGER, // Ajustado de UNSIGNED
      allowNull: false,
    },
  },
  {
    tableName: "USUARIOS", // Nome da tabela
    sequelize: connection,
    timestamps: true,
    modelName: "Usuario",
  }
);
