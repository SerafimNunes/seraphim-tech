// docs_all/checklist.md

# Checklist de Ações para Finalização do Backend

Este checklist é gerado a partir da `ANALISE_ADERENCIA_ARQUITETURA.MD` e foca nos pontos necessários para completar a implementação do backend conforme a arquitetura definida.

## 1. Pontos Críticos a Serem Resolvidos

- [ ] **Implementar Lógicas de Negócio Centrais:** A estrutura de serviços existe, mas a lógica interna precisa ser implementada e validada.
  - [✅ CONCLUÍDA ] **R2 (Estoque):** Garantir que o `EstoqueService` impede saldos de estoque negativos.
  - [ ] **R3 (CMV):** Implementar e auditar o cálculo de Custo Médio Ponderado no `AnaliseService`.
  - [ ] **R13 (Escalas):** Auditar e finalizar o algoritmo de geração de escalas no `EscalaService`.
- [ ] **Criar Entidades de Dados Faltantes:** Modelos essenciais para a funcionalidade de ponta a ponta de alguns módulos estão ausentes.
  - [ ] **Módulo de Planejamento:**
    - [ ] Criar modelo `ProducaoNecessidade.ts`.
    - [ ] Criar modelo `CompraNecessidade.ts`.
  - [ ] **Módulo de Contabilidade:**
    - [✅ CONCLUÍDA ] Criar modelo `CupomNaoFiscal.ts`.
    - [ ✅ CONCLUÍDA] Criar modelo `DocumentoContabil.ts`.
- [ ] **Validação de Dados de Entrada (Input):**
  - [ ] **R9 (Validação):** Implementar ou verificar o uso de uma biblioteca como Zod nos `controllers` para validar todos os dados de entrada das rotas.

## 2. Verificação e Conclusão de Regras de Negócio

- [ ] **R1 (Tipagem):** Revisar o código para garantir que a convenção de nomenclatura de interfaces (ex: `IEntidade`) está sendo seguida consistentemente.
- [ ] **R7 (Caderno de Produção):** Verificar se os campos `descartes`, `quem_produziu` e `data_validade` existem e estão sendo corretamente utilizados no modelo `ProducaoRegistro.ts`.
- [ ] **R8 (Ponto de Equilíbrio):** Verificar a implementação do cálculo de ponto de equilíbrio no `AnaliseService`.
- [ ] **R11 (Ponto de Pedido):**
  - [ ] Confirmar se o modelo `ItemEstoque.ts` possui o campo `ponto_pedido`.
  - [ ] Implementar a lógica de gatilho para sugestão de compras no `PlanejamentoService` quando o `ponto_pedido` for atingido.

## 3. Itens para Validação Funcional (Pós-implementação)

- [ ] **R10 (Feedback de Dados):** A qualidade dos insights gerados pelo `AnaliseService` deverá ser validada com o sistema em operação.
- [ ] **Cobertura de Testes:** Embora a criação de testes esteja em espera, este continua sendo um ponto crítico. Planejar a criação de testes unitários e de integração para as lógicas de negócio implementadas assim que possível.
