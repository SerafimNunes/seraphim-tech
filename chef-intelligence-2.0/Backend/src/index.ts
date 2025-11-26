// Caminho: src/index.ts

import express, { Request, Response } from "express";
import cors from "cors";
import { connection } from "./config/sequelize";
import { IModelFactory } from "./config/types";
// 🔑 Importa a função de inicialização que garante o Superusuário
import { initializeDatabase } from "./config/initialization";

// 🔑 Implementação real da função applyAssociations.
function applyAssociations(models: IModelFactory) {
  // Itera sobre todos os modelos e chama o método '.associate()'
  Object.values(models)
    .filter((model: any) => typeof model.associate === "function")
    .forEach((model: any) => {
      model.associate(models); // Passa todos os modelos para que as associações cruzadas funcionem
    });

  console.log("✅ [Sequelize] Associações aplicadas com sucesso.");
}

// --- IMPORTAÇÕES DE CONTROLLERS ---
import { EscalaController } from "./controllers/EscalaController";
import { ForecastController } from "./controllers/ForecastController";
import { RHController } from "./controllers/RHController";
import { DashboardController } from "./controllers/DashboardController";
import AnaliseController from "./controllers/AnaliseController";

// --- IMPORTAÇÕES DE ROTAS (CLASSES) ---
import { EscalaRoutes } from "./routes/EscalaRoutes";
import { ForecastRoutes } from "./routes/ForecastRoutes";
import { RHRoutes } from "./routes/RHRoutes";
import { DashboardRoutes } from "./routes/DashboardRoutes";

// --- IMPORTAÇÕES DE ROTAS (ROUTER) --
import authRouter from "./routes/AuthRoutes";
import setupRouter from "./routes/SetupRoutes";
import analiseRouter from "./routes/AnaliseRoutes";
import caixaRouter from "./routes/CaixaRoutes";
import comprasPedidoRouter from "./routes/ComprasPedidoRoutes";
import contabilidadeRouter from "./routes/ContabilidadeRoutes";
import estoqueContagemRouter from "./routes/EstoqueContagemRoutes";
import estoqueItemRouter from "./routes/EstoqueItemRoutes";
import estoqueMovimentoRouter from "./routes/EstoqueMovimentoRoutes";
import feedbackRouter from "./routes/FeedbackRoutes";
import fichaTecnicaRouter from "./routes/FichaTecnicaRoutes";
import fiscalRouter from "./routes/FiscalRoutes";
import { planejamentoRoutes } from "./routes/PlanejamentoRoutes";
import producaoRouter from "./routes/ProducaoRoutes";
import vendaComandaRouter from "./routes/VendaComandaRoutes";

// --- IMPORTAÇÕES DE SERVICES ---
import { UsuarioService } from "./services/UsuarioServices";
import { EscalaService } from "./services/EscalaService";
import { RHService } from "./services/RHService";
import { ForecastService } from "./services/ForecastService";
import { DashboardService } from "./services/DashboardService";
import { AnaliseService } from "./services/AnaliseService";

// --- IMPORTAÇÕES DOS MODELOS (33 Modelos Necessários para Associações) ---
import Colaborador from "./models/Colaborador";
import Cargo from "./models/Cargo";
import Permissao from "./models/Permissao";
import CargoPermissao from "./models/CargoPermissao"; // ⬅️ NOVO: Importa o modelo de junção
import Usuario from "./models/Usuario";
import Escala from "./models/Escala";
import CupomNaoFiscal from "./models/CupomNaoFiscal";
import Lancamento from "./models/Lancamento";
import Caixa from "./models/Caixa";
import ContaContabil from "./models/ContaContabil";
import DocumentoContabil from "./models/DocumentoContabil";
import VendaMesa from "./models/VendaMesa";
import FichaTecnica from "./models/FichaTecnica";
import ItemEstoque from "./models/ItemEstoque";
import CompraNecessidade from "./models/CompraNecessidade";
import ComprasItemPedido from "./models/ComprasItemPedido";
import ComprasPedido from "./models/ComprasPedido";
import CustoFixo from "./models/CustoFixo";
import EstoqueRegistroContagem from "./models/EstoqueRegistroContagem";
import EstoqueRegistroMovimento from "./models/EstoqueRegistroMovimento";
import Feedback from "./models/Feedback";
import Fornecedor from "./models/Fornecedor";
import HistoricoPerformance from "./models/HistoricoPerformance";
import PerfilIdeal from "./models/PerfilIdeal";
import ProducaoNecessidade from "./models/ProducaoNecessidade";
import ProducaoRegistro from "./models/ProducaoRegistro";
import ProducaoRegistroPerda from "./models/ProducaoRegistroPerda";
import ProducaoRequisicaoInsumo from "./models/ProducaoRequisicaoInsumo";
import RegistroFiscal from "./models/RegistroFiscal";
import Unidade from "./models/Unidade";
import VendaComanda from "./models/VendaComanda";
import VendaComissao from "./models/VendaComissao";
import VendaImposto from "./models/VendaImposto";
import VendaItem from "./models/VendaItem";

const models: IModelFactory = {
  Unidade, // Manter Unidade no topo é boa prática
  Colaborador,
  Cargo,
  Permissao,
  CargoPermissao, // ⬅️ NOVO: Adiciona o modelo de junção ao Factory
  Usuario,
  Escala,
  CupomNaoFiscal,
  Lancamento,
  Caixa,
  ContaContabil,
  DocumentoContabil,
  VendaMesa,
  FichaTecnica,
  ItemEstoque,
  CompraNecessidade,
  ComprasItemPedido,
  ComprasPedido,
  CustoFixo,
  EstoqueRegistroContagem,
  EstoqueRegistroMovimento,
  Feedback,
  Fornecedor,
  HistoricoPerformance,
  PerfilIdeal,
  ProducaoNecessidade,
  ProducaoRegistro,
  ProducaoRegistroPerda,
  ProducaoRequisicaoInsumo,
  RegistroFiscal,
  VendaComanda,
  VendaComissao,
  VendaImposto,
  VendaItem,
};

function initializeServices() {
  // Inicialização dos Services
  const usuarioService = new UsuarioService();
  const escalaService = new EscalaService();
  const rhService = new RHService(models);
  const forecastService = new ForecastService();

  const dashboardService = new DashboardService(models);

  const analiseService = new AnaliseService();

  escalaService.setRHService(rhService);
  forecastService.setRHService(rhService);

  const escalaController = new EscalaController(
    escalaService,
    usuarioService,
    rhService
  );

  const forecastController = new ForecastController(forecastService);

  const rhController = new RHController(rhService, escalaService);

  const dashboardController = new DashboardController(dashboardService);

  const analiseController = AnaliseController;

  return {
    escalaController,
    forecastController,
    rhController,
    dashboardController,
    analiseController,
  };
}

async function startServer() {
  const app = express();
  const port = process.env.PORT || 3000;

  try {
    await connection.authenticate();
    console.log("✅ Conexão com o banco de dados estabelecida com sucesso."); // 🔑 PASSO 1: Sincronização Explícita das Tabelas Mãe com Foreign Keys Críticas
    await models.Unidade!.sync({ alter: true });
    await models.ContaContabil!.sync({ alter: true }); // 2. RBAC (Cargo/Permissão) - CRÍTICO PARA O SETUP DE ADMIN
    await models.Cargo!.sync({ alter: true });
    await models.Permissao!.sync({ alter: true });
    await models.CargoPermissao!.sync({ alter: true }); // 3. Tabelas que dependem das anteriores - CRÍTICO PARA O SETUP DE ADMIN

    await models.Usuario!.sync({ alter: true }); // ⬅️ AQUI GARANTIMOS QUE A TABELA USUARIO EXISTE // 🚨 PASSO CRÍTICO: CHAMA A LÓGICA DE CRIAÇÃO DO SUPERUSUÁRIO
    await initializeDatabase(models);
    await models.Colaborador!.sync({ alter: true });
    await models.Escala!.sync({ alter: true });
    await models.ItemEstoque!.sync({ alter: true });
    await models.VendaMesa!.sync({ alter: true });
    await models.FichaTecnica!.sync({ alter: true });
    await models.VendaComanda!.sync({ alter: true }); // 🚨 PASSO 2: Sincroniza o restante das tabelas

    await connection.sync({ alter: true });
    console.log(
      "🛠️ [Sequelize] Banco de dados sincronizado e atualizado (alter: true)."
    );

    const loadedModels = Object.keys(models);
    console.log(
      `\n📚 [Sequelize] ${loadedModels.length} Models Carregados para o DB:`
    );
    console.log(loadedModels.map((name) => `\t- ${name}`).join("\n"));
    console.log("----------------------------------------------------");

    applyAssociations(models);

    const {
      escalaController,
      forecastController,
      rhController,
      dashboardController,
      analiseController,
    } = initializeServices();

    const corsOptions = {
      origin: "http://localhost:5173",
      methods: "GET, HEAD, PUT, PATCH, POST, DELETE",
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    };

    app.use(cors(corsOptions));

    app.use(express.json());

    app.get("/", (req: Request, res: Response) => {
      res.send("API Chef Intelligence 2.0 Rodando!");
    });

    app.use("/api/escala", new EscalaRoutes(escalaController).router);
    app.use("/api/forecast", new ForecastRoutes(forecastController).router);
    app.use("/api/rh", new RHRoutes(rhController).router);
    app.use("/api/dashboard", new DashboardRoutes(dashboardController).router);

    app.use("/api/auth", authRouter);
    app.use("/api/analise", analiseRouter);
    app.use("/api/planejamento", planejamentoRoutes);
    app.use("/api/feedback", feedbackRouter);

    app.use("/api", caixaRouter);
    app.use("/api", comprasPedidoRouter);
    app.use("/api", contabilidadeRouter);
    app.use("/api", estoqueContagemRouter);
    app.use("/api", estoqueItemRouter);
    app.use("/api", estoqueMovimentoRouter);
    app.use("/api", fichaTecnicaRouter);
    app.use("/api", fiscalRouter);
    app.use("/api", producaoRouter);
    app.use("/api", vendaComandaRouter);
    app.use("/api/setup", setupRouter);

    app.listen(port, () => {
      console.log(`🚀 Servidor rodando na porta ${port}`);
    });
  } catch (error) {
    console.error("❌ Erro ao iniciar o servidor ou conectar ao banco:", error);
  }
}

startServer();
