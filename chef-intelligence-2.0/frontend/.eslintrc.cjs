// Arquivo: frontend/.eslintrc.cjs

module.exports = {
    // 🔑 Garante que o ESLint saiba que está trabalhando com Svelte/TypeScript
    root: true,
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:svelte/recommended',
        'prettier', // Desativa regras de estilo do ESLint que conflitam com o Prettier
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        // 🔑 Configuração essencial para TypeScript em arquivos .svelte
        extraFileExtensions: ['.svelte'],
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.json'],
    },
    // 🔑 Configurações específicas para arquivos Svelte (.svelte) e TypeScript (.ts)
    overrides: [
        {
            files: ['*.svelte'],
            parser: 'svelte-eslint-parser',
            parserOptions: {
                parser: '@typescript-eslint/parser',
            },
        },
        {
            files: ['*.ts', '*.mts', '*.cts'],
            parser: '@typescript-eslint/parser',
        },
    ],
    env: {
        browser: true,
        node: true,
    },
    // 🔑 Regras de Otimização e Qualidade (Exemplos)
    rules: {
        // Regra para reforçar a Tipagem Rígida (R1)
        '@typescript-eslint/no-explicit-any': 'warn', 
        
        // Bloqueia variáveis importadas e não usadas (Otimização - R10)
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }], 
        
        // Permite o uso do console.log apenas como 'warn'
        'no-console': ['warn', { allow: ['warn', 'error'] }], 
    },
};