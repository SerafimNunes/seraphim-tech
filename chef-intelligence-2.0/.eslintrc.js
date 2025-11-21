module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
    'prettier',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  ignorePatterns: ["node_modules/", "dist/", "coverage/"], // Ignora pastas geradas
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    'require-jsdoc': 'off',
  },
};
