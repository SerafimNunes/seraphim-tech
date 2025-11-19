// src/config/associations.ts
import { ModelCtor } from 'sequelize';
import { IModelFactory } from './types';

export const applyAssociations = (models: {
  [key: string]: ModelCtor<any>;
}) => {
  console.log('🔗 Aplicando associações de modelos...');
  Object.keys(models).forEach((key) => {
    const model = models[key];
    if (!model) {
      console.warn(`  ⚠ Modelo '${key}' indefinido — pulando associate().`);
      return;
    }
    const maybeAssociate = (model as any).associate;
    if (typeof maybeAssociate === 'function') {
      try {
        maybeAssociate(models as unknown as IModelFactory);
        console.log(`  ✔ ${key} -> associate() executada`);
      } catch (err) {
        console.warn(`  ⚠ Falha ao associar ${key}:`, (err as Error).message);
      }
    }
  });
  console.log('✅ Associações aplicadas.');
};
