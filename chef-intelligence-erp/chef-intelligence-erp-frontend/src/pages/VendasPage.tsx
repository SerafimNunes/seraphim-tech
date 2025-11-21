// src/pages/VendasPage.tsx (Template Correto)

import AppShellLayout from '../components/AppShellLayout'; 
import { Title } from '@mantine/core'; // Necessário para o componente Title

// 🔑 ESSA É A LINHA CRÍTICA que estava faltando o 'export default'
export default function VendasPage() { 
    return (
        <AppShellLayout>
            {/* O CONTEÚDO VAI AQUI */}
            <Title order={1}>Módulo de Vendas (PDV)</Title>
        </AppShellLayout>
    );
}