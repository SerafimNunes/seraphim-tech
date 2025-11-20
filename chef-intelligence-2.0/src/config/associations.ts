// src/config/associations.ts
import { Model, ModelCtor } from 'sequelize';
import { IModelFactory } from './types';

/**
 * Tipagem interna forte:
 * Um registro de models onde cada valor é um ModelCtor,
 * ignorando os undefined de IModelFactory.
 */
export type ResolvedModelMap = Record<string, ModelCtor<Model<any, any>>>;

/**
 * Normaliza o IModelFactory eliminando undefined
 * antes de aplicar associações, pois o Sequelize
 * NÃO aceita undefined em belongsTo / hasMany / belongsToMany.
 */
function resolveModels(models: IModelFactory): ResolvedModelMap {
  const resolved: ResolvedModelMap = {};

  for (const key of Object.keys(models)) {
    const m = models[key];
    if (m) {
      resolved[key] = m as ModelCtor<Model<any, any>>;
    }
  }

  return resolved;
}

export function applyAssociations(models: IModelFactory): void {
  const resolvedModels = resolveModels(models);

  for (const key of Object.keys(resolvedModels)) {
    const model = resolvedModels[key];

    const associateFn = (model as any).associate;
    if (typeof associateFn === 'function') {
      try {
        // Agora passamos APENAS models válidos (sem undefined)
        associateFn(resolvedModels);
        console.log(`🔗 Associações aplicadas para ${key}`);
      } catch (err) {
        console.warn(
          `⚠️ Falha ao associar modelo ${key}:`,
          (err as Error).message,
        );
      }
    }
  }

  console.log('✅ Todas as associações foram processadas.');
}
