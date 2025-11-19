module.exports = {
  // Define a raiz do projeto e usa o parser TypeScript
  root: true,
  parser: '@typescript-eslint/parser',

  // Plugins que adicionam regras específicas para TypeScript e Prettier
  plugins: [
    '@typescript-eslint',
    'prettier', // Permite que o Prettier funcione como regra do linter
  ],

  // Extensões de regras:
  // 'eslint:recommended' (regras básicas)
  // 'plugin:@typescript-eslint/recommended' (regras TypeScript recomendadas)
  // 'plugin:prettier/recommended' (integra o Prettier para formatar)
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],

  // Configurações e Regras
  rules: {
    // Permite o uso temporário de 'any' em cenários de tipagem complexa ou legada
    '@typescript-eslint/no-explicit-any': 'off',
    // Desativa a regra de necessidade de comentários JSDoc
    'require-jsdoc': 'off',
    // Outras regras de estilo do Prettier são configuradas no .prettierrc
  },
};
