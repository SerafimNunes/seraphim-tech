// src/index.ts
import express, { Request, Response } from 'express';
import { connection } from './config/sequelize';
import { applyAssociations } from './config/associations';
import { IModelFactory } from './config/types';

/* imports dos models — conforme estrutura do seu projeto */
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

const models = {
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
} as unknown as IModelFactory;

async function startServer() {
  const app = express();
  const port = process.env.PORT || 3000;
  app.use(express.json());
  applyAssociations(models);
  try {
    await connection.authenticate();
    console.log('Conexão com o banco estabelecida com sucesso.');
    app.get('/', (_req: Request, res: Response) =>
      res.send('API Chef Intelligence 2.0 Rodando!'),
    );
    app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));
  } catch (err) {
    console.error('Erro ao conectar com o banco:', (err as Error).message);
    process.exit(1);
  }
}
startServer();
