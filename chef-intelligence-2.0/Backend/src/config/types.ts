import { ModelCtor, Transaction } from "sequelize";
import Unidade from "../models/Unidade";
import Colaborador from "../models/Colaborador";
import Fornecedor from "../models/Fornecedor";
// Importa as Interfaces dos Novos Modelos
import PerfilIdeal from "../models/PerfilIdeal";
import HistoricoPerformance from "../models/HistoricoPerformance";

/* ===========================================================================
   ENUMS DE RBAC (Permissões)
============================================================================ */
export enum Acoes {
  CRIAR = "CRIAR",
  LER = "LER",
  LEITURA = "LER",
  ATUALIZAR = "ATUALIZAR",
  DELETAR = "DELETAR",
  APROVAR = "APROVAR",
  RELATORIOS = "RELATORIOS",
  GERENCIAR = "GERENCIAR",
}

export enum Recursos {
  DASHBOARD = "DASHBOARD",
  USUARIOS = "USUARIOS",
  ESCALAS = "ESCALAS",
  FINANCEIRO = "FINANCEIRO",
  ESTOQUE = "ESTOQUE",
  PRODUCAO = "PRODUCAO",
  FICHA_TECNICA = "FICHA_TECNICA",
  RH = "RH",
  VENDAS = "VENDAS",
  PLANEJAMENTO = "PLANEJAMENTO",
  CONFIGURACOES = "CONFIGURACOES",
}

/* ===========================================================================
   ENUMS E TIPOS BÁSICOS
============================================================================ */
export enum StatusColaborador {
  ATIVO = "ATIVO",
  INATIVO = "INATIVO",
  FERIAS = "FERIAS",
  AFASTADO = "AFASTADO",
  DESLIGADO = "DESLIGADO",
}

export enum NivelAcesso {
  ADMIN = "ADMIN",
  GERENTE = "GERENTE",
  COORDENADOR = "COORDENADOR",
  OPERACIONAL = "OPERACIONAL",
}

/* ===========================================================================
   STATUS DE DOMÍNIO
============================================================================ */
export type StatusQualidade =
  | "PENDENTE"
  | "APROVADO"
  | "REPROVADO"
  | "DEVOLVIDO";

export type StatusAprovacaoCompras =
  | "SUGERIDO"
  | "AGUARDANDO_APROVACAO"
  | "APROVADO"
  | "REPROVADO"
  | "CANCELADO"
  | "EM_COTACAO"
  | "FINALIZADO";

export type StatusProducao =
  | "SUGERIDO"
  | "EM_PRODUCAO"
  | "PRONTO"
  | "ENTREGUE"
  | "CANCELADO";

/* ===========================================================================
   INTERFACES DE RECURSOS HUMANOS (RH) - R1
============================================================================ */
export interface IPerfilIdeal {
  cargo_id: number;
  competencia_id: number;
  peso?: number; // Adicionado para compatibilidade com Model
}

export interface IHistoricoPerformance {
  colaborador_id: number;
  erros_registrados: number;
  desperdicio_total: number;
}

export interface IRegraColaborador {
  id_colaborador: number;
  unidade_id: number;
}

export interface IColaboradorBase {
  id_colaborador: number;
  nome_completo: string;
}

export interface TurnoverAnalysisItem {
  mes: number;
  admissoes: number;
  desligamentos: number;
  mediaColaboradores: number;
  taxaTurnover: number;
}

/* ===========================================================================
   FILTROS E UTILS
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

/* ===========================================================================
   FÁBRICA DE MODELOS (GPR-3: Injeção de Modelos)
============================================================================ */
type AllowedModel =
  | ModelCtor<any>
  | typeof Unidade
  | typeof Colaborador
  | typeof Fornecedor
  | typeof PerfilIdeal // Adicionado
  | typeof HistoricoPerformance // Adicionado
  | undefined;

export interface IModelFactory {
  [key: string]: AllowedModel;

  Unidade?: typeof Unidade;
  Colaborador?: typeof Colaborador;
  Fornecedor?: typeof Fornecedor;
  PerfilIdeal?: typeof PerfilIdeal;
  HistoricoPerformance?: typeof HistoricoPerformance;
}
