// src/config/types.ts
import { ModelCtor, Transaction, Model } from 'sequelize';
import { JwtPayload } from 'jsonwebtoken';

/* (conteúdo exatamente como no patch acima) */

export enum Acoes {
  LER = 'LER',
  CRIAR = 'CRIAR',
  ATUALIZAR = 'ATUALIZAR',
  DELETAR = 'DELETAR',
}
export enum Recursos {
  FICHA_TECNICA = 'FICHA_TECNICA',
  PLANEJAMENTO = 'PLANEJAMENTO',
  PRODUCAO = 'PRODUCAO',
  ESCALA = 'ESCALA',
}
export enum NivelAcesso {
  ADMIN = 'ADMIN',
  USER = 'USER',
}
export enum StatusColaborador {
  ATIVO = 'ATIVO',
  INATIVO = 'INATIVO',
  DESLIGADO = 'DESLIGADO',
}
export interface IPerfilIdeal {
  cargo_id?: number;
  competencias?: string[];
}
export interface IHistoricoPerformance {
  colaborador_id?: number;
  ano?: number;
  nota?: number;
}
export interface IRegraColaborador {
  regra?: string;
}
export interface IColaboradorBase {
  id_colaborador?: number;
  nome?: string;
}
export type StatusQualidade =
  | 'PENDENTE'
  | 'APROVADO'
  | 'REPROVADO'
  | 'DEVOLVIDO';
export type StatusAprovacaoCompras =
  | 'SUGERIDO'
  | 'AGUARDANDO_APROVACAO'
  | 'APROVADO'
  | 'REPROVADO'
  | 'CANCELADO'
  | 'FINALIZADO';
export type StatusProducao =
  | 'SUGERIDO'
  | 'APROVADO'
  | 'EM_PRODUCAO'
  | 'CONCLUIDO'
  | 'CANCELADO';
export type StatusRequisicao =
  | 'SOLICITADA'
  | 'EM_SEPARACAO'
  | 'ENTREGUE'
  | 'RECUSADA'
  | 'CANCELADA';
export type TipoPerda =
  | 'QUEBRA'
  | 'VALIDADE'
  | 'ERRO_PRODUCAO'
  | 'ERRO_VENDA'
  | 'OUTROS';
export type StatusMesa =
  | 'LIVRE'
  | 'OCUPADA'
  | 'AGUARDANDO_FECHAMENTO'
  | 'MANUTENCAO';
export type StatusComanda =
  | 'ABERTA'
  | 'FECHADA'
  | 'CANCELADA'
  | 'AGUARDANDO_PAGAMENTO';
export type StatusItem = 'ABERTO' | 'PREPARANDO' | 'ENTREGUE' | 'CANCELADO';
export interface KPIFilter {
  unidade_id: number;
  data_inicio: Date;
  data_fim: Date;
  transaction?: Transaction;
}
export interface DashboardKPIs {
  receita_liquida: number;
  receita_total?: number;
  cmv_real_time: number;
  margem_bruta: number;
  despesas_variaveis: number;
  lucro_operacional: number;
  ticket_medio: number;
  mcmp: number;
  custo_mercadoria_vendida?: number;
}
export interface ProducaoKPIs {
  registros_concluidos: number;
  custo_total_producao: number;
  custo_total_perdas: number;
  eficiencia_producao: number;
}
export interface IModelFactoryNamed {
  ItemEstoque?: ModelCtor<Model<any, any>>;
  VendaComanda?: ModelCtor<Model<any, any>>;
  VendaItem?: ModelCtor<Model<any, any>>;
  VendaMesa?: ModelCtor<Model<any, any>>;
  VendaImposto?: ModelCtor<Model<any, any>>;
  VendaComissao?: ModelCtor<Model<any, any>>;
  ProducaoRegistro?: ModelCtor<Model<any, any>>;
  ProducaoRequisicaoInsumo?: ModelCtor<Model<any, any>>;
  ProducaoRegistroPerda?: ModelCtor<Model<any, any>>;
  ComprasPedido?: ModelCtor<Model<any, any>>;
  ComprasItemPedido?: ModelCtor<Model<any, any>>;
  Unidade?: ModelCtor<Model<any, any>>;
  Colaborador?: ModelCtor<Model<any, any>>;
  Fornecedor?: ModelCtor<Model<any, any>>;
  Caixa?: ModelCtor<Model<any, any>>;
  ContaContabil?: ModelCtor<Model<any, any>>;
  Lancamento?: ModelCtor<Model<any, any>>;
  DocumentoContabil?: ModelCtor<Model<any, any>>;
}
export interface IModelFactory extends IModelFactoryNamed {
  [name: string]: ModelCtor<Model<any, any>> | undefined;
}
export interface JwtUsuario extends JwtPayload {
  id_usuario: number;
  unidade_id: number;
  id_cargo?: number;
  nome_cargo?: string;
  permissoes?: string[];
}
