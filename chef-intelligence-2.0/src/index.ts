// src/index.ts (trecho principal)
import express, { Request, Response } from 'express';
import { connection } from './config/sequelize';
import { EscalaController } from './controllers/EscalaController';
import { EscalaRoutes } from './routes/EscalaRoutes';
import { UsuarioService } from './services/UsuarioServices';
import { EscalaService } from './services/EscalaService';
import { RHService } from './services/RHService';
import Colaborador from './models/Colaborador';
import Cargo from './models/Cargo';
import Permissao from './models/Permissao';
import Usuario from './models/Usuario';
import Escala from './models/Escala';
import CupomNaoFiscal from './models/CupomNaoFiscal';
import Lancamento from './models/Lancamento';
import Caixa from './models/Caixa';
import ContaContabil from './models/ContaContabil';
import DocumentoContabil from './models/DocumentoContabil';
import VendaMesa from './models/VendaMesa';
import FichaTecnica from './models/FichaTecnica';
import ItemEstoque from './models/ItemEstoque';
import VendaComanda from './models/VendaComanda';
import VendaItem from './models/VendaItem';
import ComprasPedido from './models/ComprasPedido';
import ComprasItemPedido from './models/ComprasItemPedido';
import ProducaoRegistro from './models/ProducaoRegistro';
import ProducaoRequisicaoInsumo from './models/ProducaoRequisicaoInsumo';
import ProducaoRegistroPerda from './models/ProducaoRegistroPerda';
import { IModelFactory } from './config/types';
import { applyAssociations } from './config/associations';

const models: IModelFactory = {
  Colaborador,
  Cargo,
  Permissao,
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
  VendaComanda,
  VendaItem,
  ComprasPedido,
  ComprasItemPedido,
  ProducaoRegistro,
  ProducaoRequisicaoInsumo,
  ProducaoRegistroPerda,
  Unidade: require('./models/Unidade').default,
};

applyAssociations(models);

function initializeServices() {
  const rhService = new RHService(models);
  const usuarioService = new UsuarioService();
  const escalaService = new EscalaService();
  escalaService.setRHService(rhService);

  const escalaController = new EscalaController(
    escalaService,
    usuarioService,
    rhService,
  );
  return { escalaController };
}

async function startServer() {
  const app = express();
  const port = process.env.PORT || 3000;

  app.use(express.json());
  const { escalaController } = initializeServices();

  app.get('/', (req: Request, res: Response) => {
    res.send('API Chef Intelligence 2.0 Rodando!');
  });

  app.use('/api/escala', new EscalaRoutes(escalaController).router);

  try {
    await connection.authenticate();
    console.log('Conexão com o banco de dados estabelecida com sucesso.');
    app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));
  } catch (error) {
    console.error('Não foi possível conectar ao banco de dados:', error);
  }
}

startServer();
