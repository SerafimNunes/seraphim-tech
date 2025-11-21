// src/config/types.ts
import { ModelCtor, Transaction } from 'sequelize';
import Unidade from '../models/Unidade';
import Colaborador from '../models/Colaborador';
import Fornecedor from '../models/Fornecedor';

/* ============================================================================
   ENUMS E TIPOS BÁSICOS
============================================================================ */

export enum StatusColaborador {
  ATIVO = 'ATIVO',
  INATIVO = 'INATIVO',
  FERIAS = 'FERIAS',
  AFASTADO = 'AFASTADO',
}

export enum NivelAcesso {
  ADMIN = 'ADMIN',
  GERENTE = 'GERENTE',
  COORDENADOR = 'COORDENADOR',
  OPERACIONAL = 'OPERACIONAL',
}

/* ============================================================================
   STATUS DE DOMÍNIO
============================================================================ */

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
  | 'EM_COTACAO'
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

/* ============================================================================
   RBAC (Recursos e Ações)
============================================================================ */

export enum Recursos {
  PRODUCAO = 'PRODUCAO',
  PLANEJAMENTO = 'PLANEJAMENTO',
  RH = 'RH',
}

export enum Acoes {
  LEITURA = 'LEITURA',
  CRIAR = 'CRIAR',
  ATUALIZAR = 'ATUALIZAR', // Corrige erro de "ATUALIZACAO"
  EXCLUIR = 'EXCLUIR',
}

/* ============================================================================
   RH — Tipos necessários para os Controllers e Services
============================================================================ */

export interface IColaboradorBase {
  id_colaborador: number;
  nome: string;
  cargo_id: number;
  nivel_acesso: NivelAcesso;
  status: StatusColaborador;
}

export interface IPerfilIdeal {
  cargo_id: number;
  competencia_id: number;
  nivel_esperado?: number;
}

export interface IHistoricoPerformance {
  colaborador_id: number;
  erros_registrados: number;
  desperdicio_total: number;
  observacao?: string;
}

export interface IRegraColaborador {
  cargo_id: number;
  carga_horaria_min: number;
  carga_horaria_max: number;
}

/* ============================================================================
   KPI / Dashboard
============================================================================ */

export interface KPIFilter {
  unidade_id: number;
  data_inicio: Date;
  data_fim: Date;
  transaction?: Transaction;
}

export interface DashboardKPIs {
  receita_total: number;
  custo_mercadoria_vendida: number;

  // Opcional porque seu service ainda não calcula
  receita_liquida?: number;
  cmv_real_time?: number;
  margem_bruta?: number;
  ticket_medio?: number;
  mcmp?: number;

  despesas_variaveis: number;

  margem_contribuicao_valor?: number;
  margem_contribuicao_percentual?: number;

  custo_fixo_total: number;
  lucro_operacional: number;
  ponto_equilibrio_receita: number;

  tendencia_receita: any[];
  tendencia_cmv: any[];
}

/* ============================================================================
   FÁBRICA DE MODELOS
============================================================================ */

export interface IModelFactory {
  [key: string]:
    | ModelCtor<any>
    | typeof Unidade
    | typeof Colaborador
    | typeof Fornecedor
    | undefined;

  Unidade?: typeof Unidade;
  Colaborador?: typeof Colaborador;
  Fornecedor?: typeof Fornecedor;

  ItemEstoque?: ModelCtor<any>;
  VendaComanda?: ModelCtor<any>;
  VendaMesa?: ModelCtor<any>;
  VendaItem?: ModelCtor<any>;
  ProducaoRegistro?: ModelCtor<any>;
  ProducaoRequisicaoInsumo?: ModelCtor<any>;
  ProducaoRegistroPerda?: ModelCtor<any>;
  ComprasPedido?: ModelCtor<any>;
  ComprasItemPedido?: ModelCtor<any>;
}
