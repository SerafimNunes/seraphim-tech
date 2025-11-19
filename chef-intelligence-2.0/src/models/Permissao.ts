// src/models/Permissao.ts
import { DataTypes, Model, Optional, ModelCtor } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory } from "../config/types";

// 1. Interfaces e Tipagem (GPR-2)
export interface PermissaoAttributes {
  id_permissao: number; // GPR-5: Padrão de chave Primária
  nome_permissao: string;
  descricao: string | null;
}

export interface PermissaoCreationAttributes
  extends Optional<PermissaoAttributes, "id_permissao" | "descricao"> {}

// Model com tipagem Sequelize
export interface PermissaoModel
  extends Model<PermissaoAttributes, PermissaoCreationAttributes>,
    PermissaoAttributes {}

// 2. Definição do Modelo (Usando ModelCtor para tipagem correta)
const Permissao: ModelCtor<PermissaoModel> = connection.define<PermissaoModel>(
  "Permissao",
  {
    id_permissao: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true, // GPR-5: Definição de chave primária
    },
    nome_permissao: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    descricao: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  }
);

// 3. Associação Explicita (GPR-3)
(Permissao as any).associate = function (models: IModelFactory) {
  // Este modelo não possui associações belongsto.
  // As associações com Permissao (ex: UsuarioPermissao) devem ser definidas nos modelos que a utilizam.
};

// Exportamos como default para facilitar a importação
export default Permissao;
