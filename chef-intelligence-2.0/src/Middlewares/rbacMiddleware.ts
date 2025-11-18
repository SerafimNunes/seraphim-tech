// src/Middlewares/rbacMiddleware.ts

import { Request, Response, NextFunction } from "express";
import { JwtPayload } from "./authMiddleware";
import { Acoes, Recursos } from "../config/types";

/**
 * Define o tipo para as permissões (R12).
 * Ex: "FINANCEIRO_ESCRITA", "ESTOQUE_LEITURA"
 */
type Permissao = string;

/**
 * Função utilitária para formatar a permissão (ex: "PLANEJAMENTO", "LEITURA" -> "PLANEJAMENTO_LEITURA")
 */
const formatarPermissao = (recurso: Recursos, acao: Acoes): Permissao => {
  // Concatena RECURSO_ACAO em MAIÚSCULAS para bater com o formato de permissão no JWT.
  return `${recurso.toUpperCase()}_${acao.toUpperCase()}`;
};

// 🔑 Sobrecarga 1: Aceita um Recurso e uma Ação (para rotas simples, ex: getNecessidades)
export function podeAcessar(
  recurso: Recursos,
  acao: Acoes
): (req: Request, res: Response, next: NextFunction) => void;

// 🔑 Sobrecarga 2: Aceita um Array de permissões (para rotas complexas, ex: EstoqueContagemRoutes)
export function podeAcessar(
  permissoesExigidas: Permissao[]
): (req: Request, res: Response, next: NextFunction) => void;

/**
 * Middleware de RBAC (Role-Based Access Control) - Implementação Unificada.
 *
 * Determina quais permissões devem ser checadas, com base nos argumentos fornecidos.
 */
export function podeAcessar(
  recursoOuPermissoes: Recursos | Permissao[],
  acao?: Acoes
) {
  let permissoesParaChecar: Permissao[] = [];

  if (Array.isArray(recursoOuPermissoes)) {
    // Caso 1: Array de permissões (Ex: ["ESTOQUE_ESCRITA", "ESTOQUE_GERENCIAMENTO"])
    permissoesParaChecar = recursoOuPermissoes;
  } else if (acao) {
    // Caso 2: Par Recurso/Ação (Ex: Recursos.PLANEJAMENTO, Acoes.LEITURA)
    const permissaoUnica = formatarPermissao(recursoOuPermissoes, acao);
    permissoesParaChecar = [permissaoUnica];
  } else {
    // Devemos evitar que chegue aqui devido à tipagem forte, mas é uma proteção
    throw new Error(
      "O middleware 'podeAcessar' requer um array de permissões OU um par Recurso e Ação."
    );
  }

  // Retorna o middleware real do Express, que agora usa 'permissoesParaChecar'
  return (req: Request, res: Response, next: NextFunction) => {
    const usuario = req.usuario as JwtPayload;

    if (!usuario || !usuario.id_usuario) {
      return res.status(401).json({
        error: "Não autenticado. Informações de usuário não encontradas.",
      });
    }

    // Verifica se o usuário tem QUALQUER uma das permissões exigidas
    const usuarioTemPermissao = permissoesParaChecar.some(
      (p) => usuario.permissoes && usuario.permissoes.includes(p)
    );

    // Assumimos que o id_cargo 99 (ADMIN) tem acesso total
    const isAdmin = usuario.id_cargo === 99;

    if (isAdmin || usuarioTemPermissao) {
      return next(); // Permissão concedida
    }

    // Acesso Negado (R12)
    const permissoesStr = permissoesParaChecar.join(" ou ");
    return res.status(403).json({
      error: `Acesso negado. Requer pelo menos uma destas permissões: ${permissoesStr} (R12).`,
    });
  };
}
