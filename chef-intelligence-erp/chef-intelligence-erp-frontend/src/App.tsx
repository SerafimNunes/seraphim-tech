// src/App.tsx

import { BrowserRouter, Routes, Route } from 'react-router-dom';
// Importa as páginas
import LoginPage from './pages/LoginPage'; 
import DashboardPage from './pages/DashboardPage'; 
import NotFoundPage from './pages/NotFoundPage'; 
// NOVAS IMPORTAÇÕES DE ROTAS PLACEHOLDER
import VendasPage from './pages/VendasPage';
import FinanceiroCaixaPage from './pages/FinanceiroCaixaPage';
import EstoqueContagemPage from './pages/EstoqueContagemPage';
import ComprasPedidosPage from './pages/ComprasPedidosPage';
import ProducaoFichasPage from './pages/ProducaoFichasPage';
import RHPage from './pages/RHPage';
import BIPage from './pages/BIPage';


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rota de Acesso Público: Login */}
        <Route path="/login" element={<LoginPage />} />

        {/* ROTAS PROTEGIDAS */}
        <Route path="/" element={<DashboardPage />} />
        <Route path="/vendas" element={<VendasPage />} />
        <Route path="/financeiro/caixa" element={<FinanceiroCaixaPage />} />
        <Route path="/estoque/contagem" element={<EstoqueContagemPage />} />
        <Route path="/compras/pedidos" element={<ComprasPedidosPage />} />
        <Route path="/producao/fichas" element={<ProducaoFichasPage />} />
        <Route path="/rh" element={<RHPage />} />
        <Route path="/bi" element={<BIPage />} />
        
        {/* Rota de Erro (404) */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}