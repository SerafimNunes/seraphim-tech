import express, { Request, Response } from "express";
import { connection } from "./config/sequelize";
import { EscalaController } from "./controllers/EscalaController";
import { EscalaRoutes } from "./routes/EscalaRoutes"; // Importação da CLASSE EscalaRoutes
import { UsuarioService } from "./services/UsuarioServices"; // Caminho corrigido
import { EscalaService } from "./services/EscalaService";
import { RHService } from "./services/RHService";
import { Colaborador } from "./models/Colaborador";
import Cargo from "./models/Cargo";
import Permissao from "./models/Permissao";
import Usuario from "./models/Usuario";
import Escala from "./models/Escala"; // <-- NOVO: Importa o modelo de Escala
import { IModelFactory } from "./config/types";

// Funções de inicialização e associações
const models: IModelFactory = {
  Colaborador,
  Cargo,
  Permissao,
  Usuario,
  Escala, // <-- NOVO: Adiciona o modelo de Escala para que as associações sejam aplicadas
};

/**
 * Itera sobre todos os modelos e chama a função 'associate' de cada um,
 * garantindo que todas as relações do Sequelize sejam estabelecidas.
 * @param models Objeto contendo todos os modelos do Sequelize.
 */
function applyAssociations(models: IModelFactory) {
  Object.keys(models).forEach((modelName) => {
    const model = models[modelName as keyof IModelFactory];
    if (
      "associate" in model &&
      typeof (model as any).associate === "function"
    ) {
      (model as any).associate(models);
    }
  });
}

/**
 * Inicializa todos os Services e Controllers e configura a Injeção de Dependência.
 * @returns Um objeto contendo os Controllers inicializados.
 */
function initializeServices() {
  console.log("Inicializando Services e Controllers...");

  // 1. Instanciar Services de baixo nível (sem dependências de outros Services).
  const rhService = new RHService();
  const usuarioService = new UsuarioService();

  // 2. Instanciar Services de alto nível.
  const escalaService = new EscalaService();

  // 3. Injeção por Setter para ligar a dependência tardia/quebrar circularidade.
  // Garante que o EscalaService tenha acesso ao RHService.
  escalaService.setRHService(rhService);

  // 4. Instanciar Controllers com todas as dependências por construtor.
  const escalaController = new EscalaController();

  console.log("Injeção de dependência concluída.");
  return { escalaController };
}

async function startServer() {
  const app = express();
  const port = process.env.PORT || 3000;

  app.use(express.json());

  // Aplica Associações do Sequelize
  applyAssociations(models);

  // Inicializa Services e Controllers
  const { escalaController } = initializeServices();

  // Configura Rotas
  app.get("/", (req: Request, res: Response) => {
    res.send("API Chef Intelligence 2.0 Rodando!");
  });

  // Injeta o Controller nas Rotas do módulo Escala
  app.use("/api/escala", new EscalaRoutes(escalaController).router);

  // Sincronizar o banco de dados e iniciar o servidor
  try {
    await connection.authenticate();
    console.log("Conexão com o banco de dados estabelecida com sucesso.");

    // Sincronização. Use `force: true` apenas em desenvolvimento.
    // await connection.sync({ force: false });
    // console.log("Todos os modelos foram sincronizados com sucesso.");

    app.listen(port, () => {
      console.log(`Servidor rodando na porta ${port}`);
    });
  } catch (error) {
    console.error(
      "Não foi possível conectar ou sincronizar com o banco de dados:",
      error
    );
  }
}

// Inicializa a aplicação
startServer();
