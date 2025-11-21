// src/pages/DashboardPage.tsx (Atualizado)
import AppShellLayout from '../components/AppShellLayout'; 
import { Title, Text, Skeleton } from '@mantine/core';

export default function DashboardPage() {
  return (
    <AppShellLayout>
      <Title order={1}>Bem-vindo, Gestor!</Title>
      <Text size="lg" c="dimmed">Utilize o menu lateral para acessar os módulos de gerenciamento do ERP.</Text>
      
      <div style={{ marginTop: '40px' }}>
          <Title order={2}>Visão Geral (BI)</Title>
          {/* Mockup de um widget de BI */}
          <Skeleton height={200} mt="xl" width="100%" /> 
          <Title order={4} mt="xl">Status do Servidor</Title>
          <Skeleton height={50} mt="md" width="70%" /> 
      </div>
    </AppShellLayout>
  );
}