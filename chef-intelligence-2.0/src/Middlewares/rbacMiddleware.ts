// src/routes/rbacMiddleware.ts

import { Request, Response, NextFunction } from "express";
import { JwtPayload } from "./authMiddleware"; // Importa a interface do authMiddleware

/**
 * Define os tipos de cargo para o controle de acesso (R12).
 * Ex: "Estoquista", "Gerente", "Chef"
 */
type Cargo = string;

/**
 * Middleware de RBAC (Role-Based Access Control).
 *
 * Verifica se o usuário, já autenticado pelo `authMiddleware`,
 * tem o cargo (`nome_cargo`) necessário para acessar a rota.
 *
 * @param permissoesExigidas Lista de nomes de cargos que podem acessar a rota.
 */
export const podeAcessar = (permissoesExigidas: Cargo[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const usuario = req.usuario;

    if (!usuario || !usuario.nome_cargo) {
      return res.status(403).json({
        error: "Acesso negado. Informações de cargo não encontradas no token.",
      });
    }

    if (permissoesExigidas.includes(usuario.nome_cargo)) {
      return next(); // O usuário tem permissão, continua para o controller.
    }

    return res.status(403).json({
      error: `Acesso negado. Cargo '${usuario.nome_cargo}' não tem permissão para este recurso.`,
    });
  };
};
