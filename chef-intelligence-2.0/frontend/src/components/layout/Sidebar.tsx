// ARQUIVO: frontend/src/components/layout/Sidebar.tsx

import React from 'react';
import { Home, PieChart, ShoppingCart, Users, Factory, BarChart3, Clock, Utensils, BookOpen, Settings } from 'lucide-react';

// Definição dos itens de navegação do ERP
const navigation = [
  { name: 'Dashboard', href: '/', icon: Home, current: true, section: 'dashboard' },
  { name: 'Vendas', href: '/vendas/comanda', icon: Utensils, current: false, section: 'vendas' },
  { name: 'Estoque', href: '/estoque/item', icon: ShoppingCart, current: false, section: 'estoque' },
  { name: 'Produção', href: '/producao/registro', icon: Factory, current: false, section: 'producao' },
  { name: 'Compras', href: '/compras/pedidos', icon: BookOpen, current: false, section: 'compras' },
  { name: 'RH', href: '/rh/colaboradores', icon: Users, current: false, section: 'rh' },
  { name: 'Planejamento', href: '/planejamento', icon: Clock, current: false, section: 'planejamento' },
  { name: 'Contabilidade', href: '/contabilidade', icon: BarChart3, current: false, section: 'contabilidade' },
  { name: 'Feedback', href: '/feedback', icon: PieChart, current: false, section: 'feedback' },
];

const SidebarLink = ({ item, isActive }) => (
  <a
    href={item.href}
    className={`
      ${isActive ? 'bg-indigo-700 text-white' : 'text-indigo-200 hover:text-white hover:bg-indigo-700'}
      group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors duration-150
    `}
  >
    <item.icon
      className={`
        ${isActive ? 'text-white' : 'text-indigo-200 group-hover:text-white'}
        mr-3 h-6 w-6 flex-shrink-0
      `}
      aria-hidden="true"
    />
    {item.name}
  </a>
);

/**
 * Sidebar: Componente lateral de navegação do ERP.
 * Inclui o logo, o nome do sistema e os links para os módulos principais.
 */
export default function Sidebar() {
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  
  // Função auxiliar para determinar se o link está ativo (basicamente verifica o segmento inicial)
  const isLinkActive = (href: string) => {
    // Para links de primeiro nível como /estoque/item, a rota deve começar com /estoque
    const basePath = href.split('/').filter(Boolean)[0];
    return currentPath.startsWith(`/${basePath}`) || (href === '/' && currentPath === '/');
  };

  return (
    <div className="flex flex-col flex-grow border-r border-indigo-900 bg-indigo-800 overflow-y-auto">
      <div className="flex items-center flex-shrink-0 px-4 py-6 bg-indigo-900 shadow-xl">
        {/* Logo Placeholder */}
        <div className="text-white text-2xl font-bold tracking-tight">
            Chef <span className='text-yellow-400'>Intelligence</span>
        </div>
      </div>
      <div className="mt-5 flex flex-col flex-grow">
        <nav className="flex-1 px-2 space-y-1">
          {navigation.map((item) => (
            <SidebarLink 
              key={item.name} 
              item={item} 
              isActive={isLinkActive(item.href)} 
            />
          ))}
        </nav>
      </div>
      
      {/* Footer da Sidebar (Configurações) */}
      <div className="border-t border-indigo-700 p-4">
        <a 
            href="/settings"
            className="group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors duration-150 text-indigo-200 hover:text-white hover:bg-indigo-700"
        >
            <Settings className="mr-3 h-6 w-6 flex-shrink-0 text-indigo-200 group-hover:text-white" />
            Configurações
        </a>
      </div>
    </div>
  );
}