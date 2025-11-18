import { DataTypes, Model, Optional, ModelCtor, ModelOptions } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory } from "../config/types";
import { Colaborador } from "./Colaborador";
import Permissao from "./Permissao";

export interface CargoAttributes {
  id_cargo: number;
  nome_cargo: string;
  departamento: string;
  salario_base: number;
}

// ✅ CORREÇÃO TS2344: Tipagem correta de Optional
export interface CargoCreationAttributes
  extends Optional<CargoAttributes, "id_cargo"> {}

// Interface do Modelo
export interface CargoModel
  extends Model<CargoAttributes, CargoCreationAttributes>,
    CargoAttributes {
  permissoes?: Permissao[]; // R12: Associação com Permissões (para busca do AuthService)
}

// ✅ CORREÇÃO TS2314/TS2353: Uso correto de genéricos e ModelOptions no define
const Cargo: ModelCtor<CargoModel> = connection.define<
  CargoModel,
  CargoCreationAttributes
>(
  "Cargo",
  {
    id_cargo: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nome_cargo: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    departamento: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    salario_base: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
  }, // Correção do erro TS2353
  {
    tableName: "CARGOS",
    sequelize: connection, // Propriedade necessária para o define da instância
    timestamps: true,
    modelName: "Cargo",
  } as ModelOptions<CargoModel>
);

// Associações (mantidas)
(Cargo as any).associate = function (models: IModelFactory) {
  Cargo.hasMany(models.Colaborador as ModelCtor<Colaborador>, {
    foreignKey: "cargo_Id",
    as: "colaboradores",
  }); // 🔑 CRÍTICO R12: Relacionamento N:M com Permissão
  Cargo.belongsToMany(models.Permissao, {
    through: "CargoPermissoes", // tabela pivô
    foreignKey: "cargo_id",
    as: "permissoes", // 🔑 ALIAS CRÍTICO: usado para busca aninhada no AuthService
  }); // 🔑 NOVO: Adiciona a associação com Usuario (HasMany)
  Cargo.hasMany(models.Usuario, {
    foreignKey: "cargo_id",
    as: "usuarios",
  });
};

export default Cargo;
