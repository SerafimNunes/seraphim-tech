import { DataTypes, Model, Optional } from "sequelize";
import { connection } from "config/sequelize";

// O nome da permissão (ex.: "ESTOQUE_ESCRITA", "FINANCEIRO_LEITURA")
interface PermissaoAttributes {
  id_permissao: number;
  nome_permissao: string;
  descricao: string | null;
}

// Opcionais na criação (Sequelize define o ID)
type PermissaoCreationAttributes = Optional<
  PermissaoAttributes,
  "id_permissao"
>;

export default class Permissao
  extends Model<PermissaoAttributes, PermissaoCreationAttributes>
  implements PermissaoAttributes
{
  public id_permissao!: number;
  public nome_permissao!: string;
  public descricao!: string | null;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// Inicialização do Modelo
Permissao.init(
  {
    id_permissao: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nome_permissao: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true, // Garante que não haverá duplicidade de nomes de permissão
    },
    descricao: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize: connection,
    tableName: "Permissoes",
    underscored: true,
    timestamps: true,
  }
);
