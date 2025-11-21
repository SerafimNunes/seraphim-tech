// ARQUIVO: frontend/src/features/store.ts

import { configureStore } from '@reduxjs/toolkit';
import { apiSlice } from './api/apiSlice';
import authReducer from './auth/authSlice'; // Importa o Reducer real de autenticação

/**
 * configureStore: Configuração central do Redux Store para o frontend.
 */
export const store = configureStore({
  reducer: {
    // Reducer da API (RTK Query)
    [apiSlice.reducerPath]: apiSlice.reducer,
    // Reducer de Autenticação
    auth: authReducer,
  },
  
  // Adiciona o middleware padrão do Redux e o middleware do RTK Query
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
    
  // Habilita devtools apenas em ambiente de desenvolvimento
  devTools: process.env.NODE_ENV !== 'production',
});

// Tipagens para TypeScript (Muito importante)
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;