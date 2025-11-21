# Consolidação do Modelo de Venda

Data: 14 de novembro de 2025
Branch: fix/estoque-cmp-race-condition

Resumo:

- **Mudança**: Remoção do modelo redundante `Venda.ts` (duplicado de `VendaComanda.ts`).
- **Decisão**: Manter `VendaComanda.ts` como o modelo canônico para vendas (comanda eletrônica / PDV).

Motivo:

- O repositório continha dois modelos muito semelhantes (`Venda.ts` e `VendaComanda.ts`) mapeando para a mesma semântica de venda, gerando risco de conflito no registro de modelos do Sequelize e redundância de código.
- `VendaComanda.ts` representa o fluxo do restaurante (comandas, mesas, itens) e já é referenciado pelos serviços e controllers.

Impacto:

- Arquivo redundante removido do fluxo de importação da aplicação (`src/index.ts` atualizado).
- Reduz complexidade e evita conflitos silenciosos de registro de modelos no Sequelize.

Rollback:

Para restaurar o arquivo removido (se necessário), use a tag criada antes da alteração:

```pwsh
git checkout backup-before-venda-removal-20251114 -- src/models/Venda.ts
```

Notas adicionais:

- Antes de aplicar exclusão física do arquivo (git rm), confirmar que nenhum serviço ou controller referencie `Venda` diretamente. A revisão automatizada indicou que `VendaService` já usa `VendaComanda`.
- Recomenda-se rodar `npx tsc --noEmit` e `npm run dev` após a alteração para validar runtime e registrar modelos no log de inicialização.

Autor: GitHub Copilot (agent)
