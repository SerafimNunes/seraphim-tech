// src/config/associations.ts (Versão TS do seu associations.js)

import { ModelCtor } from "sequelize";
import { IModelFactory } from "./types";

/**
 * Itera sobre todos os modelos carregados e chama o método 'associate' para configurar as FKs.
 */
export const applyAssociations = (models: {
  [key: string]: ModelCtor<any>;
}) => {
  // Faz o cast para a interface tipada.
  const modelFactory = models as IModelFactory;

  // Aplica a lógica idêntica ao seu associations.js
  Object.values(modelFactory).forEach((model) => {
    if (typeof model.associate === "function") {
      console.log(`🔗 Aplicando associações para o modelo: ${model.name}`);
      model.associate(modelFactory);
    }
  });
  console.log("✅ Associações de modelos aplicadas com sucesso.");
};
