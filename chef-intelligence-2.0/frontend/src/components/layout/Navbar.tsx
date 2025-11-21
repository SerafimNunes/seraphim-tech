// ARQUIVO: frontend/src/components/layout/Navbar.tsx

import React from 'react';
import { Bell, User, LogOut } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '@/features/auth/authSlice';
import { RootState } from '@/features/store';
import { useRouter } from 'next/navigation';

/**
 * Navbar: Barra superior do ERP para ações rápidas, notificações e perfil do usuário.
 */
export default function Navbar() {
  const router = useRouter();
  const dispatch = useDispatch();
  
  // Obter o usuário do estado Redux
  const user = useSelector((state: RootState) => state.auth.user);
  
  // Placeholder para o nome da unidade e nome do usuário
  const unitName = user?.unidade_id ? `Unidade ${user.unidade_id}` : "Carregando Unidade"; 
  const userName = user?.email.split('@')[0] || "Usuário"; 
  
  // Ação de Logout
  const handleLogout = () => {
      dispatch(logout()); // Limpa o estado Redux e o LocalStorage
      router.push('/auth/login'); // Redireciona para a tela de Login
  };

  return (
    <header className="flex-shrink-0 bg-white shadow-md border-b border-gray-200 z-10">
      <div className="mx-auto max-w-full px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          
          {/* Informação da Unidade */}
          <div className="flex items-center">
            <h1 className="text-lg font-semibold text-gray-900">
              Módulo Atual: Dashboard
              <span className="ml-3 text-sm font-medium text-indigo-600 border border-indigo-100 bg-indigo-50 px-3 py-1 rounded-full">
                {unitName}
              </span>
            </h1>
          </div>

          {/* Ações do Usuário */}
          <div className="flex items-center space-x-4">
            
            {/* Botão de Notificações */}
            <button
              type="button"
              className="relative p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Notificações"
            >
              <Bell className="h-6 w-6" />
              {/* Badge de Notificação */}
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            </button>

            {/* Menu de Perfil */}
            <div className="relative">
              <button
                type="button"
                className="flex items-center max-w-xs rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 p-1"
              >
                <span className="sr-only">Abrir menu do usuário</span>
                <User className="h-8 w-8 text-indigo-600 border-2 border-indigo-600 rounded-full p-1" />
                <span className="ml-3 text-sm font-medium text-gray-700 hidden sm:block">
                  {userName}
                </span>
              </button>
            </div>
            
            {/* Botão de Logout */}
            <button
                onClick={handleLogout}
                className="flex items-center space-x-2 text-sm font-medium text-gray-500 hover:text-red-600 transition-colors bg-gray-50 hover:bg-red-50 p-2 rounded-lg"
            >
                <LogOut className="h-5 w-5" />
                <span className="hidden md:inline">Sair</span>
            </button>

          </div>
        </div>
      </div>
    </header>
  );
}