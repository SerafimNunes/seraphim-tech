// ARQUIVO: frontend/src/features/auth/authSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AuthResponse } from './authApi'; // Importa a tipagem de resposta do backend

// Define o formato do objeto User no Redux (o formato final esperado pelo frontend)
export interface User {
    id: number; // Mapeado de id_usuario
    email: string;
    unidadeId: number; // Mapeado de unidade_id
    role: string; // Mapeado de nome_cargo
}

// Define o formato do estado de autenticação
interface AuthState {
  token: string | null;
  user: User | null;
}

// Estado inicial: tenta carregar do localStorage (para persistência básica)
const initialState: AuthState = {
  token: typeof window !== 'undefined' ? localStorage.getItem('authToken') : null,
  user: typeof window !== 'undefined' && localStorage.getItem('authUser') ? JSON.parse(localStorage.getItem('authUser')!) : null,
};

/**
 * authSlice: Gerencia o estado de autenticação (token e dados do usuário).
 */
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Ação para armazenar credenciais e persistir no localStorage
    // O payload é a resposta bruta do backend (AuthResponse)
    setCredentials: (
      state,
      action: PayloadAction<AuthResponse>
    ) => {
      const { token, usuario } = action.payload;
      
      // Mapeamento das chaves do Backend para o formato Redux/Frontend
      const mappedUser: User = {
          id: usuario.id_usuario,
          email: usuario.email,
          unidadeId: usuario.unidade_id,
          role: usuario.nome_cargo, // Usamos nome_cargo como o 'role' no frontend
      };
      
      state.token = token;
      state.user = mappedUser; // Armazena o objeto mapeado
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('authToken', token);
        localStorage.setItem('authUser', JSON.stringify(mappedUser)); // Persiste o objeto mapeado
      }
    },
    // Ação para fazer logout
    logout: (state) => {
      state.token = null;
      state.user = null;
      
      if (typeof window !== 'undefined') {
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
      }
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;

export default authSlice.reducer;