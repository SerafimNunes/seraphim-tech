// src/index.ts

require("dotenv").config();
import express from "express";

// 1. Importa a conexão (instância Sequelize) e a função de conexão
import { connectToDatabase } from "./config/sequelize";
import { applyAssociations } from "./config/associations";

// Importa a instância de conexão (necessária para pegar connection.models)
import { connection } from "./config/sequelize";

// --- 🔑 CARREGAMENTO CRÍTICO DE TODOS OS MODELOS ---

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
const Lancamento = require("./models/Lancamento");
import Caixa from "./models/Caixa";
import RegistroFiscal from "./models/RegistroFiscal";

// 5. MÓDULO DE COMPRAS
import Fornecedor from "./models/Fornecedor";
import ComprasPedido from "./models/ComprasPedido";
import ComprasItemPedido from "./models/ComprasItemPedido";

// 6. 👥 MÓDULO DE RECURSOS HUMANOS E ESCALAS (NOVOS MODELOS)
import Cargo from "./models/Cargo";
import Colaborador from "./models/Colaborador";

// --- 🔑 IMPORTAÇÃO DOS SERVIÇOS (PARA INJEÇÃO DE DEPENDÊNCIA) ---
import { EscalaService } from "./services/EscalaService";
import { RHService } from "./services/RHService";

// Importa as rotas da API
import EstoqueContagemRoutes from "./routes/EstoqueContagemRoutes";
import EstoqueMovimentoRoutes from "./routes/EstoqueMovimentoRoutes";
import EstoqueItemRoutes from "./routes/EstoqueItemRoutes";
import FichaTecnicaRoutes from "./routes/FichaTecnicaRoutes";
import ProducaoRoutes from "./routes/ProducaoRoutes";
import VendaComandaRoutes from "./routes/VendaComandaRoutes";
import FiscalRoutes from "./routes/FiscalRoutes";

// ROTAS DE COMPRAS
import ComprasPedidoRoutes from "./routes/ComprasPedidoRoutes";

// 👥 ROTAS DE RECURSOS HUMANOS E ESCALAS (NOVAS ROTAS)
// ✅ CORREÇÃO: Importamos uma função para configurar o router (factory pattern)
import { configureRHRoutes } from "./routes/RHRoutes";

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
    escalaService.setRHService(rhService);

    // --------------------------------------------------------------------------
    // 3. REGISTRA AS ROTAS DA API - COM INJEÇÃO DE DEPENDÊNCIA
    // --------------------------------------------------------------------------

    // Registros das Rotas Padrão
    app.use("/api/v1", EstoqueContagemRoutes);
    app.use("/api/v1", EstoqueMovimentoRoutes);
    app.use("/api/v1", EstoqueItemRoutes);
    app.use("/api/v1", FichaTecnicaRoutes);
    app.use("/api/v1", VendaComandaRoutes);
    app.use("/api/v1", ProducaoRoutes);
    app.use("/api/v1", FiscalRoutes);
    app.use("/api/v1", ComprasPedidoRoutes);

    // 👥 REGISTRO DAS ROTAS DE RECURSOS HUMANOS
    // ✅ Injeta os serviços criados no RHRoutes
    const rhRouter = configureRHRoutes(rhService, escalaService);
    app.use("/api/v1", rhRouter);

    // 4. Inicia o Servidor
    app.listen(port, () => {
      console.log(
        `✅ Servidor rodando na porta ${port} | NODE_ENV: ${process.env.NODE_ENV}`
      );
    });
  } catch (error) {
    console.error("❌ Falha Crítica na Inicialização do Servidor:", error);
  }
}

startServer();
