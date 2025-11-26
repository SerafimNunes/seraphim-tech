/** @type {import('eslint').Linter.Config} */
module.exports = {
  // 🔑 Configuração raiz
  root: true,

  // 🔑 Ambiente de execução
  env: {
    node: true, // Define que o código roda no ambiente Node.js
    es2020: true, // Suporte a recursos modernos do JavaScript
  },

  // 🔑 Configurações herdadas:
  extends: [
    "eslint:recommended", // Regras básicas de JS
    "plugin:@typescript-eslint/recommended", // Regras recomendadas do TypeScript
    "prettier", // Desativa regras de estilo que conflitam com o Prettier
  ],

  // 🔑 Parser
  parser: "@typescript-eslint/parser",

  // 🔑 Opções do Parser (Essencial para o TS)
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
    // 🎯 R1 (Tipagem Rígida): O ESLint usa o tsconfig para verificar o código
    tsconfigRootDir: __dirname,
    project: ["./tsconfig.json"],
  },

  // 🔑 Regras de Qualidade e Tipagem (Customizadas)
  rules: {
    // 🎯 R1 (Tipagem Rígida): Permite 'any' apenas com um warning.
    // Troque para 'error' se quiser forçar a tipagem completa.
    "@typescript-eslint/no-explicit-any": "warn",

    // Bloqueia a declaração de variáveis que nunca são usadas (Otimização)
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],

    // Permite o uso de console.log/error/warn, mas alerta sobre logs simples
    "no-console": ["warn", { allow: ["warn", "error", "log"] }],

    // Bloqueia a re-declaração de variáveis (Ex: const foo = 1; let foo = 2;)
    "no-redeclare": "error",

    // Força a clareza nos Controllers/Services
    "@typescript-eslint/explicit-module-boundary-types": "off", // Pode ser desativado para funções privadas/simples
  },
};
