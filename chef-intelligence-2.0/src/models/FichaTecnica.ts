// src/models/FichaTecnica.ts (Novo Model Modular)

import { DataTypes, Model, Optional, ModelCtor } from "sequelize";
import { connection } from "../config/sequelize";
import { IModelFactory } from "../config/types";
import { ItemEstoqueModel } from "./ItemEstoque"; // Depende de ItemEstoque

// R1. Interface para Atributos
export interface FichaTecnicaAttributes {
  id_ficha_tecnica: number;
  id_produto_pai: number;
  id_produto_filho: number;
  quantidade_necessaria: number; // DECIMAL(10, 3)
}

// R2. Interface para Criação (id_ficha_tecnica é opcional)
export interface FichaTecnicaCreationAttributes
  extends Optional<FichaTecnicaAttributes, "id_ficha_tecnica"> {}

// R3. Interface do Modelo (Inclui associações opcionais para tipagem)
export interface FichaTecnicaModel
  extends Model<FichaTecnicaAttributes, FichaTecnicaCreationAttributes>,
    FichaTecnicaAttributes {
  produto_pai?: ItemEstoqueModel;
  produto_filho?: ItemEstoqueModel;
}

// R4. Criação e Exportação do Modelo
const FichaTecnica: ModelCtor<FichaTecnicaModel> =
  connection.define<FichaTecnicaModel>(
    "FichaTecnica",
    {
      id_ficha_tecnica: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      id_produto_pai: {
        // O produto final/pré-pronto que está sendo feito
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "PRODUTOS", // Tabela externa de ItemEstoque
          key: "id_produto",
        },
      },
      id_produto_filho: {
        // O ingrediente/insumo usado
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "PRODUTOS", // Tabela externa de ItemEstoque
          key: "id_produto",
        },
      },
      quantidade_necessaria: {
        // Ex: Quantidade de Farinha para 1 Bolo
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
      },
    },
    {
      tableName: "FICHA_TECNICA",
      timestamps: false, // Desativa created_at e updated_at
      modelName: "FichaTecnica",
    }
  );

// R5: Associações
(FichaTecnica as any).associate = function (models: IModelFactory) {
  // Relacionamento do "Produto Pai" (N:1 para ItemEstoque)
  FichaTecnica.belongsTo(models.ItemEstoque as ModelCtor<ItemEstoqueModel>, {
    foreignKey: "id_produto_pai",
    as: "produto_pai",
  });

  // Relacionamento do "Produto Filho" (N:1 para ItemEstoque)
  FichaTecnica.belongsTo(models.ItemEstoque as ModelCtor<ItemEstoqueModel>, {
    foreignKey: "id_produto_filho",
    as: "produto_filho",
  });
};

export default FichaTecnica;
