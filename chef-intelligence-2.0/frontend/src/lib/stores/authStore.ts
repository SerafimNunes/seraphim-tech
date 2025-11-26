// Caminho: frontend/src/lib/stores/authStore.ts

// R1: Tipagem Rígida (TS)
import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { UserData } from '$lib/types'; // 🔑 CORREÇÃO 1: Importa UserData rígido

// --- Definição de Tipos ---

/**
 * Define a estrutura completa da Store de Autenticação.
 * (Alinhado com R1: Tipagem Rígida)
 */
interface AuthState {
    isAuthenticated: boolean;
    // 🔑 CORREÇÃO 2: Usa o tipo UserData importado, garantindo R1, R4, R12.
    user: UserData | null;
}

const initialState: AuthState = {
    isAuthenticated: false,
    user: null,
};

// --- Criação da Store ---

// Cria a store Writable com o estado inicial
export const authStore = writable<AuthState>(initialState);

// --- Funções Utilitárias (Actions) ---

export const authActions = {
    /**
     * Seta o estado de autenticação (usado na hidratação do SSR e no login).
     * @param userData O objeto UserData completo (id, email, name, roles, unitId).
     */
    // 🔑 CORREÇÃO 3: Usa o tipo UserData rigoroso para garantir a consistência dos dados.
    setUser: (userData: UserData) => {
        authStore.set({
            isAuthenticated: true,
            // 🔑 CORREÇÃO 4: Atribui o objeto userData diretamente.
            user: userData,
        });
    },

    /**
     * Limpa o estado e solicita o logout ao servidor (remoção do cookie JWT).
     * (Alinhado com a preferência por 'fetch' nativo)
     */
    logout: async () => {
        // 1. Limpa o estado local
        authStore.set(initialState);

        // 2. 🔑 Implementação do Logout via API (Remoção Segura do Cookie)
        // Usamos o fetch nativo e garantimos que o endpoint de logout seja acionado.
        if (browser) {
            try {
                // O endpoint de logout do Backend deve ser um POST que limpa o cookie JWT.
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                });
                // Note: O redirecionamento após o logout é tratado no +layout.server.ts/hooks.server.ts
            } catch (error) {
                console.error('Falha ao enviar requisição de logout:', error);
                // O erro de requisição não impede o frontend de deslogar.
            }
        }
    },
};
