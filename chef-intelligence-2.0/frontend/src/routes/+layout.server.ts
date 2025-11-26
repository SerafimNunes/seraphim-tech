// Caminho: frontend/src/routes/+layout.server.ts

import type { LayoutServerLoad } from './$types';

// Função para carregar dados do usuário no lado do servidor (SSR)
export const load: LayoutServerLoad = async ({ locals }) => {
    // Extrai o objeto 'user' que foi definido no hooks.server.ts
    // user: UserData | null
    const user = locals.user;

    // Retorna os dados que estarão disponíveis para o +layout.svelte e todas as +page.svelte
    // através da variável 'data'
    return {
        // Objeto global de dados do usuário (R12 - RBAC, R4 - Multi-Unidade)
        // ESSENCIAL para a hidratação correta do Svelte
        user: user,
    };
};

// Observação: Não use 'fetch' ou 'redirect' aqui a menos que seja estritamente necessário.
// A lógica de redirecionamento (autenticação) já está no hooks.server.ts.
