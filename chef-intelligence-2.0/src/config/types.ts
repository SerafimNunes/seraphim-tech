// src/config/types.ts

import { ModelCtor } from "sequelize";

// Define a estrutura para o objeto de modelos do Sequelize (connection.models).
export interface IModelFactory {
  [key: string]: ModelCtor<any> & {
    associate?: (models: IModelFactory) => void;
  };
}

export type NivelAcesso = "COLABORADOR" | "GESTOR" | "ADMIN";
export type StatusColaborador = "ATIVO" | "AFASTADO" | "DESLIGADO";
export type StatusAprovacaoEscala =
  | "SUGERIDO"
  | "EM_REVISAO"
  | "APROVADO"
  | "REPROVADO";

export interface IColaboradorBase {
  id_colaborador: number;
  nome_completo: string;
  cargo_id: number;
}

export interface IHistoricoPerformance {
  colaborador_id: number;
  erros_registrados: number;
  desperdicio_total: number;
}

export interface IPerfilIdeal {
  cargo_id: number;
  competencia_id: number;
}

export interface ITreinamento {
  id_treinamento: number;
  obrigatorio_para_cargo_id: number;
  data_conclusao: Date | null;
}

export interface IRegraColaborador {
  colaborador_id: number;
  tipo_regra: "FOLGA" | "RESTRICAO_RELIGIOSA" | "MAX_HORAS_SEMANAIS";
  valor: string;
}

export interface IEscala {
  id_escala: number;
  colaborador_id: number;
  data_trabalho: Date;
  hora_inicio: string;
  hora_fim: string;
  aprovada_gerente: boolean;
  status: StatusAprovacaoEscala;
}

export type StatusAprovacaoCompras =
  | "PENDENTE"
  | "EM_COTACAO"
  | "APROVADO"
  | "REPROVADO"
  | "CANCELADO"
  | "FINALIZADO";

// Enumeração para ações de RBAC (R12)
export enum Acoes {
  LEITURA = "leitura",
  CRIACAO = "criacao",
  ATUALIZACAO = "atualizacao",
  DELECAO = "delecao",
  APROVACAO = "aprovacao",
  FECHAMENTO = "fechamento",
}

// Enumeração para recursos de RBAC (R12)
export enum Recursos {
  ESTOQUE = "estoque",
  VENDAS = "vendas",
  PRODUCAO = "producao",
  COMPRAS = "compras",
  FINANCEIRO = "financeiro",
  RH = "rh",
  ANALISE = "analise",
  PLANEJAMENTO = "planejamento",
  UNIDADE = "unidade",
  USUARIO = "usuario",
}
