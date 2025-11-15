// src/config/types.ts

import { ModelCtor } from "sequelize";

// Define a estrutura para o objeto de modelos do Sequelize (connection.models).
export interface IModelFactory {
  [key: string]: ModelCtor<any> & {
    associate?: (models: IModelFactory) => void;
  };
}
