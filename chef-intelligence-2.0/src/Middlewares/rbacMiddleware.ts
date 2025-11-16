// src/Middlewares/rbacMiddleware.ts

import { Request, Response, NextFunction } from "express";
// Importa a interface atualizada do authMiddleware (que agora inclui 'permissoes')
import { JwtPayload } from "./authMiddleware";

/**
 * Define o tipo para as permissões (R12).
 * Ex: "FINANCEIRO_ESCRITA", "ESTOQUE_LEITURA"
 */
type Permissao = string;

/**
 * Middleware de RBAC (Role-Based Access Control).
 *
 * Verifica se o usuário autenticado possui as permissões necessárias para a rota (R12).
 * @param permissoesExigidas Lista de permissões que dão acesso à rota.
 */
// 🔑 CORREÇÃO: Usa 'podeAcessar' para corresponder ao uso nas rotas.
export const podeAcessar = (permissoesExigidas: Permissao[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // A propriedade 'usuario' é adicionada à Request pelo 'authMiddleware'
    // O 'req.usuario' já está tipado globalmente (declare global)
    const usuario = req.usuario as JwtPayload;

    if (!usuario || !usuario.id_usuario) {
      // Falha se o authMiddleware não funcionou ou se não há usuário
      return res.status(401).json({
        error: "Não autenticado. Informações de usuário não encontradas.",
      });
    }

    // 1. Lógica de Permissão: Verifica se alguma permissão exigida está no array do usuário
    const usuarioTemPermissao = permissoesExigidas.some(
      // A tipagem JwtPayload garante que 'usuario.permissoes' existe e é um array de strings
      (p) => usuario.permissoes && usuario.permissoes.includes(p)
    );

    // 2. Assumimos que o id_cargo 99 (ADMIN) tem acesso total
    const isAdmin = usuario.id_cargo === 99;

    if (isAdmin || usuarioTemPermissao) {
      return next(); // Permissão concedida
    }

    // 3. Acesso Negado (R12)
    return res.status(403).json({
      error: "Acesso negado. Permissão insuficiente (R12).",
    });
  };
};
