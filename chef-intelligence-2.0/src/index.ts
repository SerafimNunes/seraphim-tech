// src/index.ts

require("dotenv").config();
import express, { Router } from "express"; // Router importado para tipagem

// 1. Configurações de Banco de Dados
import { connectToDatabase } from "./config/sequelize";
import { applyAssociations } from "./config/associations";
import { connection } from "./config/sequelize";

// --- 🔑 CARREGAMENTO CRÍTICO DE TODOS OS MODELOS (20 TOTAL) ---

// 1. Estoque/Ficha Técnica
import ItemEstoque from "./models/ItemEstoque";
import EstoqueRegistroContagem from "./models/EstoqueRegistroContagem";
import EstoqueRegistroMovimento from "./models/EstoqueRegistroMovimento";
import FichaTecnica from "./models/FichaTecnica";

// 2. Vendas
import VendaComanda from "./models/VendaComanda";
import VendaItem from "./models/VendaItem";
import VendaMesa from "./models/VendaMesa";

// 3. Produção
import ProducaoRegistro from "./models/ProducaoRegistro";
import ProducaoRequisicaoInsumo from "./models/ProducaoRequisicaoInsumo";
import ProducaoRegistroPerda from "./models/ProducaoRegistroPerda";

// 4. Financeiro/Fiscal/Caixa
import Lancamento from "./models/Lancamento";
import Caixa from "./models/Caixa";
import RegistroFiscal from "./models/RegistroFiscal";

// 5. MÓDULO DE COMPRAS
import Fornecedor from "./models/Fornecedor";
import ComprasPedido from "./models/ComprasPedido";
import ComprasItemPedido from "./models/ComprasItemPedido";

// 6. 👥 MÓDULO DE RECURSOS HUMANOS E SEGURANÇA
import Cargo from "./models/Cargo";
import Colaborador from "./models/Colaborador";
import Permissao from "./models/Permissao";
import Usuario from "./models/Usuario";

// --- 🔑 IMPORTAÇÃO DOS SERVIÇOS (PARA INJEÇÃO DE DEPENDÊNCIA) ---
import { EscalaService } from "./services/EscalaService";
import { RHService } from "./services/RHService";

// --- 🔒 SEGURANÇA (R12)
import { authMiddleware } from "./Middlewares/authMiddleware"; // 🔒 Middleware de Autenticação

// 7. MÓDULO DE CRM/QUALIDADE
import Feedback from "./models/Feedback";

// 8. MÓDULO DE CONFIGURAÇÃO
import Unidade from "./models/Unidade";
// Importa as rotas da API
import EstoqueContagemRoutes from "./routes/EstoqueContagemRoutes";
import EstoqueMovimentoRoutes from "./routes/EstoqueMovimentoRoutes";
import EstoqueItemRoutes from "./routes/EstoqueItemRoutes";
import FichaTecnicaRoutes from "./routes/FichaTecnicaRoutes";
import ProducaoRoutes from "./routes/ProducaoRoutes";
import VendaComandaRoutes from "./routes/VendaComandaRoutes";
import FiscalRoutes from "./routes/FiscalRoutes";

// ✅ CORREÇÃO FINAL: Rotas de CAIXA
import CaixaRoutes from "./routes/CaixaRoutes"; // 🔑 NOVO: Rotas de Abertura/Fechamento/Lancamentos

// ROTAS DE COMPRAS
import ComprasPedidoRoutes from "./routes/ComprasPedidoRoutes";

// 👥 ROTAS DE RECURSOS HUMANOS E ESCALAS
import { configureRHRoutes } from "./routes/RHRoutes";

// 🔒 ROTAS DE AUTENTICAÇÃO
import AuthRoutes from "./routes/AuthRoutes";

// Cria a aplicação Express
const app = express();
const port = process.env.SERVER_PORT || 3000;

// Middleware para JSON
app.use(express.json());

async function startServer() {
  try {
    // 1. Conecta ao DB (Autentica)
    await connectToDatabase();

    // 2. Aplica as Associações
    applyAssociations(connection.models);

    // --------------------------------------------------------------------------
    // ✅ RESOLUÇÃO DA DEPENDÊNCIA CIRCULAR E CRIAÇÃO DOS SERVIÇOS
    // --------------------------------------------------------------------------
    const escalaService = new EscalaService();
    const rhService = new RHService(escalaService);
    escalaService.setRHService(rhService); // Injeção do setter

    // --------------------------------------------------------------------------
    // 3. REGISTRA AS ROTAS DA API - EM ORDEM CRÍTICA
    // --------------------------------------------------------------------------

    // 3a. 🔓 ROTAS PÚBLICAS: Auth (Login/Cadastro, se houver)
    app.use("/api/v1/auth", AuthRoutes);

    // 3b. 🔒 MIDDLEWARE DE SEGURANÇA (R12) - Protege tudo abaixo
    app.use(authMiddleware);

    // 3c. 🔒 ROTAS PRIVADAS (Com injeção de dependência)
    const rhRouter = configureRHRoutes(rhService, escalaService);
    app.use("/api/v1", rhRouter);

    // 3d. 🔒 ROTAS PRIVADAS (Padrão)
    app.use("/api/v1", EstoqueContagemRoutes);
    app.use("/api/v1", EstoqueMovimentoRoutes);
    app.use("/api/v1", EstoqueItemRoutes);
    app.use("/api/v1", FichaTecnicaRoutes);
    app.use("/api/v1", VendaComandaRoutes);
    app.use("/api/v1", ProducaoRoutes);
    app.use("/api/v1", FiscalRoutes);
    app.use("/api/v1", ComprasPedidoRoutes);
    app.use("/api/v1", CaixaRoutes); // ✅ ROTAS DO CAIXA REGISTRADAS

    // 4. Inicia o Servidor
    app.listen(port, () => {
      console.log(
        `✅ Servidor rodando na porta ${port} | NODE_ENV: ${process.env.NODE_ENV}`
      );
    });
  } catch (error) {
    console.log(
      "----------------------------------------------------------------"
    );
    console.error("❌ Falha Crítica na Inicialização do Servidor:", error);
    process.exit(1); // Encerra a aplicação em caso de falha de DB/Infra
  }
}

startServer();
