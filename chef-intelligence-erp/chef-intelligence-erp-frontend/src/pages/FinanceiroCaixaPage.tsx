// src/pages/FinanceiroCaixaPage.tsx (Template Correto)

import AppShellLayout from '../components/AppShellLayout'; 
import { Title } from '@mantine/core'; // Necessário para o componente Title

// 🔑 ESSA É A LINHA CRÍTICA que estava faltando o 'export default'
export default function FinanceiroCaixaPage() { 
    return (
        <AppShellLayout>
            {/* O CONTEÚDO VAI AQUI */}
            <Title order={1}>Módulo de Caixa e Movimentações Financeiras</Title>
        </AppShellLayout>
    );
}