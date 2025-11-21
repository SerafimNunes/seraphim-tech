// ARQUIVO: frontend/src/components/layout/DashboardLayout.tsx
'use client';

import React, { useEffect } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useSelector } from 'react-redux';
import { RootState } from '@/features/store';
import { useRouter } from 'next/navigation';

/**
 * DashboardLayout: O componente wrapper que combina a Sidebar e a Navbar,
 * criando a estrutura visual principal do ERP.
 * * Inclui Proteção de Rota (Guarda): Redireciona para o login se o token não existir.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const token = useSelector((state: RootState) => state.auth.token);
  const isLoading = token === null && typeof window !== 'undefined' && localStorage.getItem('authToken') !== null;
  
  // Efeito para verificar o status de autenticação
  useEffect(() => {
    // Se o token for nulo (e não estiver no meio do carregamento inicial), redireciona para login
    if (!token && !isLoading) {
      // Usamos replace para que o usuário não possa voltar para o dashboard
      router.replace('/auth/login'); 
    }
  }, [token, isLoading, router]);

  // Se estiver carregando o token ou não autenticado, não renderiza o conteúdo
  if (isLoading || !token) {
    // Tela de carregamento simples para evitar flashes de conteúdo
    return (
        <div className="flex h-screen items-center justify-center bg-indigo-50">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-600"></div>
            <p className="ml-4 text-gray-600">Carregando painel...</p>
        </div>
    );
  }

  // Renderiza o layout completo se autenticado
  return (
    // Usa flexbox para preencher a tela inteira (h-screen)
    <div className="flex h-screen overflow-hidden bg-gray-50">
      
      {/* Sidebar: Fixa à esquerda, escondida em mobile */}
      <div className="w-64 flex-shrink-0 hidden md:flex">
        <Sidebar />
      </div>

      {/* Conteúdo Principal: Ocupa o restante da tela */}
      <div className="flex flex-col w-full overflow-x-hidden">
        
        {/* Navbar: Barra superior */}
        <Navbar />

        {/* Área de Conteúdo (o "children" é o conteúdo da página) */}
        <main className="flex-1 overflow-y-auto focus:outline-none p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}