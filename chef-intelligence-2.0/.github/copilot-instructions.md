<!-- Auto-generated to help AI coding agents be productive in this repo. -->

# Copilot / AI agent instructions for chef-intelligence-2.0

Purpose: give focused, actionable guidance so an AI coding assistant can make safe, useful edits quickly.

- **Project layout (important files):** `tsconfig.json`, `package.json`, `.env` (root), `src/` with directories: `src/config`, `src/models`, `src/routes`, `src/services`.
- **Runtime / libs:** Express (server), Sequelize + `pg`/`pg-hstore` (Postgres), `dotenv` for env. Types are provided via `@types/*` in devDependencies.

- **TypeScript config to respect:** `tsconfig.json` sets `module: CommonJS`, `target: ES2022`, `rootDir: ./src`, `outDir: ./dist`, `strict: true`. Keep compiled output under `dist` and preserve CommonJS semantics.

- **How to run / build (observed):**

  - There is no `start` or `build` script in `package.json`. Recommended immediate dev/run commands an agent may suggest or use in PRs:
    - Development (quick): `npx ts-node -r dotenv/config src/<entry>.ts` (replace `<entry>.ts` with the project entry, e.g. `index.ts` or `app.ts`).
    - Compile: `npx tsc` → then run `node dist/<entry>.js`.
  - Note: before adding scripts, check with humans; don't modify `package.json` without justification.

- **Environment and DB:** `.env` exists in repo root. Database integration is Postgres via `sequelize` + `pg`. Look for DB setup in `src/config` or a top-level DB connector file. Typical patterns to follow:

  - `import 'dotenv/config'` at the application entry or call `require('dotenv').config()` early.
  - Sequelize initialization will use `new Sequelize(process.env.DB_URL)` or `new Sequelize(db, user, pass, { dialect: 'postgres' })`.

- **Conventions & expectations for changes:**

  - Maintain `CommonJS` style (compiled output expected as CommonJS). If adding ESM code, explain why and include compilation/runtime changes.
  - Keep `strict` TypeScript checks enabled. If proposing a type loosening change, include a focused justification and tests or examples.
  - Use `src/` subfolders: models → `src/models`, services/business logic → `src/services`, routing → `src/routes`, config → `src/config`.

- **Patterns seen / examples to mirror:**

  - DB model files should live under `src/models` and export a Sequelize model instance.
  - Business logic lives under `src/services` and should be used by route handlers in `src/routes`.
  - Central app startup should import config, initialize DB, then mount routes on an Express `app` and start listening.

- **Testing & CI:** no tests or CI config detected. If adding tests, prefer small, focused unit tests that exercise service logic (not full DB integration) and include mock/sequelize stubs to avoid requiring a live Postgres instance.

- **Safety rules for the agent:**

  - Do not add or change production DB credentials. If you need env values, add placeholders to `.env.example` and request real values from maintainers.
  - Do not introduce new dependencies without a short justification and an explicit `package.json` update in the same PR.
  - If creating scripts (npm) — propose them in the PR description and keep edits minimal.

- **Debugging / local workflow tips:**

  - Build artifacts: `dist/` is produced by `tsc`. Use `node --inspect-brk dist/<entry>.js` after build to attach a debugger.
  - For fast iteration, `ts-node` is available as a dev dependency.

- **When opening PRs:**
  - Describe the exact change and why (reference file paths such as `src/services/<name>.ts`).
  - If touching DB models or migrations, include a short migration plan and how to test it locally.

If anything above is unclear or you want the file tailored (example entrypoint, preferred start scripts, test runner), tell me which area to expand and I will update this file.

## Resumo da Arquitetura (prático)

- **Visão**: Plataforma ERP integrada (RH, Estoque, Finanças) orientada a PDCA e geração de insights acionáveis.
- **Regras de Ouro (destacadas)**: mantenha atenção especial em R1 (TypeScript estrito), R2 (estoque não negativo), R3 (CMP via Ficha Técnica), R4 (segregação por `unidade_id`), R9 (validação em controllers) e R12 (RBAC em todas as rotas).

- **Checklist rápido por PR**:
  - **Tipagem**: `strict: true` e interfaces/DTOs (`I*`) usadas entre camadas.
  - **Validação**: payloads validados no controller (ex.: Zod) antes da lógica de serviço.
  - **Unidade**: queries que leem/escrevem dados críticos incluem `unidade_id` (injetado pelo middleware de auth).
  - **RBAC**: rotas sensíveis usam `SegurancaService.verificarAcesso` como middleware.
  - **Estoque**: operações de débito checam saldo e ocorrem dentro de transação atômica; evitar atualizações que deixem saldo negativo.
  - **CMP**: compras acionam recálculo de CMP; documente o algoritmo quando alterar.
  - **Tests**: adicione/unit tests para lógica de negócio crítica (estoque, CMP, produção) usando stubs para Sequelize.

## Exemplos práticos (curtos)

- Middleware de autenticação / injeção de `unidade_id` (esqueleto):

```ts
// src/middleware/authMiddleware.ts (exemplo)
import { Request, Response, NextFunction } from "express";
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // validar token, buscar usuário
  const usuario = await AuthService.verifyToken(req.headers.authorization);
  if (!usuario) return res.status(401).send({ error: "Unauthorized" });
  // injetar ctx mínimo esperado: unidade_id e usuario tipado
  (req as any).usuario = usuario;
  (req as any).unidade_id = usuario.unidade_id;
  next();
}
```

- Checagem de saldo atômica em `EstoqueService.debitar()` (pseudocódigo):

```ts
// dentro de uma transaction Sequelize
const saldoAtual = await EstoqueModel.findOne({
  where: { id_item, unidade_id },
  transaction,
});
if (saldoAtual.quantidade < quantidadeASerDebitada)
  throw new Error("Saldo insuficiente");
saldoAtual.quantidade -= quantidadeASerDebitada;
await saldoAtual.save({ transaction });
```

- Recalcular CMP ao receber `Compra` (simplificado):

```ts
// novo_custo = ((estoque.quantidade * estoque.cmp) + (qty_recebida * preco_unitario)) / (estoque.quantidade + qty_recebida)
```

## Onde documentar decisões complexas

- Para regras de negócio longas (ex.: algoritmo de escala ou cálculo CMP modificado), crie `docs/` ou `ARCHITECTURE.md` e referencie no PR.

---

Edited to include architecture summary and actionable checklist.
