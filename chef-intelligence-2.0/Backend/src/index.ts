import express, { Request, Response } from 'express';
import { connection } from './config/sequelize'; // Exporta a instância não inicializada
import { EscalaController } from './controllers/EscalaController';
import { EscalaRoutes } from './routes/EscalaRoutes';
import { UsuarioService } from './services/UsuarioServices';
import { EscalaService } from './services/EscalaService';
import { RHService } from './services/RHService';

// --- IMPORTAÇÕES DOS MODELOS (AGORA INCLUINDO OS AUSENTES) ---

// Modelos que já estavam carregando:
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

// 🔑 NOVOS IMPORTS para os modelos ausentes na inicialização:
import CompraNecessidade from './models/CompraNecessidade';
import CustoFixo from './models/CustoFixo';
import EstoqueRegistroContagem from './models/EstoqueRegistroContagem';
import EstoqueRegistroMovimento from './models/EstoqueRegistroMovimento';
import Feedback from './models/Feedback';
import Fornecedor from './models/Fornecedor';
import ProducaoNecessidade from './models/ProducaoNecessidade';
import RegistroFiscal from './models/RegistroFiscal';
import VendaComissao from './models/VendaComissao';
import VendaImposto from './models/VendaImposto';

import { IModelFactory } from './config/types';
import { applyAssociations } from './config/associations';

// 🔑 CORREÇÃO: Todos os modelos importados agora estão listados no objeto `models`.
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
  // 🚨 Modelos adicionados para correção do problema:
  CompraNecessidade,
  CustoFixo,
  EstoqueRegistroContagem,
  EstoqueRegistroMovimento,
  Feedback,
  Fornecedor,
  ProducaoNecessidade,
  RegistroFiscal,
  VendaComissao,
  VendaImposto,
  // Mantendo o require para Unidade (embora um import limpo seja o ideal)
  Unidade: require('./models/Unidade').default,
};

function initializeServices() {
  // A INICIALIZAÇÃO DE SERVICES DEVE OCORRER APÓS O applyAssociations()
  // para que os Models tenham suas associações e métodos definidos.
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

  try {
    // 1. AUTENTICAÇÃO E CONEXÃO com o Banco de Dados
    await connection.authenticate();
    console.log('✅ Conexão com o banco de dados estabelecida com sucesso.');

    // 2. APLICAÇÃO DAS ASSOCIAÇÕES
    applyAssociations(models);

    // 3. INICIALIZAÇÃO DOS SERVIÇOS E CONTROLADORES
    const { escalaController } = initializeServices();

    // 4. CONFIGURAÇÃO DO EXPRESS
    app.use(express.json());

    // 5. DEFINIÇÃO DAS ROTAS
    app.get('/', (req: Request, res: Response) => {
      res.send('API Chef Intelligence 2.0 Rodando!');
    });

    app.use('/api/escala', new EscalaRoutes(escalaController).router);

    // 6. INÍCIO DO SERVIDOR HTTP
    app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));
  } catch (error) {
    console.error(
      '❌ Não foi possível conectar ou inicializar o sistema:',
      error,
    );
    // Saída forçada em caso de falha crítica na inicialização do DB ou Models
    process.exit(1);
  }
}

startServer();
