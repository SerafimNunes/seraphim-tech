/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  // Define o preset para que o Jest entenda arquivos TypeScript
  preset: "ts-jest",
  // O ambiente de execução para testes de backend (Node.js)
  testEnvironment: "node",

  // Onde o Jest deve procurar os arquivos de código-fonte
  roots: ["<rootDir>/src"],

  // Padrão de nomenclatura para os arquivos de teste (ex: meu_service.test.ts)
  testMatch: ["**/?(*.)+(spec|test).ts"],

  // Padrões que o Jest deve ignorar
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/coverage/"],

  // === Configuração de Cobertura de Código (Risco Crítico 1) ===
  // Liga a coleta de cobertura de código
  collectCoverage: true,
  // Arquivos que devem ser incluídos na análise de cobertura
  collectCoverageFrom: ["src/services/**/*.ts", "src/controllers/**/*.ts"],
  // Diretório onde os relatórios de cobertura serão salvos
  coverageDirectory: "coverage",

  // Resolução de Módulos: Garante que os caminhos de importação do TypeScript sejam resolvidos
  moduleFileExtensions: ["ts", "js", "json", "node"],
};
