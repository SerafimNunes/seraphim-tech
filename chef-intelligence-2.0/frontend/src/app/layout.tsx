// ARQUIVO: frontend/src/app/layout.tsx

// **Ajuste de Caminho:** Removendo a importação explícita de globals.css no layout,
// pois o Next.js lida com isso automaticamente para o app/globals.css no App Router.
// A falha na resolução de caminhos absolutos (@/) ou relativos (./) sugere
// um problema na leitura do arquivo pelo ambiente de compilação.
import { Providers } from '../features/Providers'; // Caminho relativo direto (assumindo que layout.tsx e features estão no mesmo nível de src)

export const metadata = {
  title: 'Chef Intelligence ERP - Dashboard',
  description: 'Plataforma de Melhoria Contínua para Food Service.',
};

/**
 * RootLayout: O layout principal da aplicação Next.js (App Router).
 * Envolve a aplicação com o Redux Provider.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="h-full">
      {/* Removida a classe de fonte problemática, mantendo o estilo de corpo */}
      <body className="antialiased min-h-screen bg-gray-50">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
