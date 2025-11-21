// ARQUIVO: frontend/src/features/Providers.tsx
'use client'; // Necessário para usar React Hooks (Provider)

import React from 'react';
import { Provider } from 'react-redux';
import { store } from './store';

/**
 * Providers: Componente que envolve toda a aplicação no Redux Provider,
 * tornando o store e o estado acessíveis em toda a árvore de componentes.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}