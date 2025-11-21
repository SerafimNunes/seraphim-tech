// ARQUIVO: frontend/src/features/api/apiSlice.ts

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { RootState } from '../store';

// URL base do seu backend Node.js (Ajuste se o backend não estiver em localhost:3000)
const BASE_URL = 'http://localhost:3000/api/'; 

/**
 * apiSlice: Define o serviço base para todas as chamadas de API usando RTK Query.
 */
export const apiSlice = createApi({
  // Onde o reducer será adicionado ao store
  reducerPath: 'api',
  
  // Configuração da requisição base, incluindo headers e URL
  baseQuery: fetchBaseQuery({
    baseUrl: BASE_URL,
    
    // Prepara os headers para incluir o token de autenticação JWT
    prepareHeaders: (headers, { getState }) => {
      // O token é assumido como armazenado no estado de 'auth'
      const token = (getState() as RootState).auth.token; 
      
      if (token) {
        // Formato padrão para JWT
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  
  // Tags para cache e invalidação de dados (útil para dashboards em tempo real)
  tagTypes: ['Dashboard', 'Estoque', 'Vendas', 'Producao', 'RH'],
  
  // Endpoints: Definidos em arquivos separados (injetados), mas inicializados aqui.
  endpoints: (builder) => ({
    // Nenhum endpoint é definido aqui; todos são injetados de forma modular (ex: authApi.ts)
  }),
});