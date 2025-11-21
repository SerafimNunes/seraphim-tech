// ARQUIVO: frontend/src/features/auth/authApi.ts

import { apiSlice } from '../api/apiSlice';

// -----------------------------------------------------
// TIPAGENS ADAPTADAS AO BACKEND (snake_case)
// -----------------------------------------------------

// O body da requisição usa 'senha'
export interface LoginRequest {
  email: string;
  senha: string; // MUDANÇA AQUI
}

// O objeto de usuário retornado pelo backend
export interface BackendUser {
    id_usuario: number; // MUDANÇA AQUI
    email: string;
    cargo_id: number;
    unidade_id: number;
    nome_cargo: string; // MUDANÇA AQUI (o que o frontend chamará de 'role')
}

// A resposta completa do backend usa 'usuario'
export interface AuthResponse {
  usuario: BackendUser; // MUDANÇA AQUI
  token: string;
  message?: string; // Opcional, pois o backend está enviando
}
// ------------------------------------------------------------------------------

/**
 * Injeta o endpoint de autenticação (login) no apiSlice principal.
 */
export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // O Mutation agora usa LoginRequest (com senha) e espera AuthResponse (com usuario)
    login: builder.mutation<AuthResponse, LoginRequest>({ 
      query: (credentials) => ({
        url: 'auth/login', // Rota do seu backend Node.js
        method: 'POST',
        body: credentials,
      }),
    }),
  }),
});

// Hook gerado automaticamente pelo RTK Query para usar o Login
export const { useLoginMutation } = authApi;