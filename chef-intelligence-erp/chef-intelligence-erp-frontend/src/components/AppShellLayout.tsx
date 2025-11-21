// src/components/AppShellLayout.tsx (CORREÇÃO DE CRASH: Burger Apenas no Mobile)

import { AppShell, Burger, Group, NavLink, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconDashboard, IconUsers, IconChefHat, IconShoppingCart, IconCash, IconChartBar, IconLogout, IconTruckLoading, IconPackage } from '@tabler/icons-react';
import { Link, useLocation } from 'react-router-dom';
import React from 'react';

// Links de Navegação mapeados às rotas do backend
const mainLinks = [
    { icon: IconDashboard, label: 'Dashboard', path: '/' },
    { icon: IconShoppingCart, label: 'PDV/Vendas', path: '/vendas' },
    { icon: IconCash, label: 'Caixa/Financeiro', path: '/financeiro/caixa' },
    { icon: IconPackage, label: 'Estoque/Contagem', path: '/estoque/contagem' },
    { icon: IconTruckLoading, label: 'Compras/Fornecedores', path: '/compras/pedidos' },
    { icon: IconChefHat, label: 'Fichas Técnicas/Produção', path: '/producao/fichas' },
    { icon: IconUsers, label: 'RH/Colaboradores', path: '/rh' },
    { icon: IconChartBar, label: 'BI e Relatórios', path: '/bi' },
];

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
    // Mantemos o controle 'opened' para o mobile
    const [opened, { toggle }] = useDisclosure(); 
    const location = useLocation();

    const handleLogout = () => {
        localStorage.removeItem('erp_auth_token');
        window.location.href = '/login';
    };

    const navLinks = mainLinks.map((item) => (
        <NavLink
            key={item.label}
            component={Link}
            to={item.path}
            // 🔑 ALTERADO: Rótulo SEMPRE visível, pois o Navbar terá largura 250px (desktop)
            label={item.label} 
            leftSection={<item.icon size="1.2rem" stroke={1.5} />}
            active={location.pathname === item.path}
            variant="filled"
        />
    ));

    return (
        <AppShell
            header={{ height: 60 }}
            navbar={{ 
                // 🔑 CRÍTICO: Largura Fixa para Desktop (Não vamos usar recolhimento manual por Burger no Desktop)
                width: 250, 
                breakpoint: 'sm', 
                // CRÍTICO: Define que a barra está colapsada no mobile, controlada pelo 'opened'
                collapsed: { mobile: !opened, desktop: false } 
            }}
            padding="md"
        >
            <AppShell.Header>
                <Group h="100%" px="md">
                    {/* 🔑 CORREÇÃO CRÍTICA: Burger APENAS visível abaixo do breakpoint 'sm' (no mobile) */}
                    <Burger 
                        opened={opened} 
                        onClick={toggle} 
                        hiddenFrom="sm" 
                        size="sm" 
                    /> 
                    <Title order={3}>Chef Intelligence ERP</Title>
                </Group>
            </AppShell.Header>

            <AppShell.Navbar p="md">
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {navLinks}
                </div>
                <NavLink
                    // 🔑 ALTERADO: Rótulo SEMPRE visível
                    label="Sair (Logoff)" 
                    leftSection={<IconLogout size="1.2rem" stroke={1.5} />}
                    onClick={handleLogout}
                    style={{ color: 'red', marginTop: 'auto' }}
                />
            </AppShell.Navbar>

            <AppShell.Main>
                {children}
            </AppShell.Main>
        </AppShell>
    );
}