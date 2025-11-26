/** @type {import("prettier").Config} */
const config = {
    // 🔑 Mantendo o Svelte no final para garantir que o plugin seja carregado por último
    plugins: ['prettier-plugin-svelte'],
    // 🔑 Configurações básicas de formatação (Exemplo)
    semi: true,
    singleQuote: true,
    tabWidth: 4,
    printWidth: 100,

    // 🔑 Configuração Específica do Svelte
    // Use 'svelte' como o parser para arquivos .svelte
    overrides: [
        {
            files: '*.svelte',
            options: {
                parser: 'svelte',
            },
        },
    ],
};

module.exports = config;
