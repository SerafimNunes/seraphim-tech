// src/Middlewares/authMiddleware.ts

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Interface para o payload do nosso token (aderente à R4 e R12)
export interface JwtPayload {
  id_usuario: number;
  id_cargo: number;
  nome_cargo: string;
  unidade_id: number;
  // 🔑 CORREÇÃO R12: Adiciona a lista de permissões
  permissoes: string[];
}

// Estende a interface Request do Express para incluir nosso payload de usuário
declare global {
  namespace Express {
    interface Request {
      usuario?: JwtPayload;
    }
  }
}

/**
 * Middleware de Autenticação (R12).
 *
 * Valida o token JWT e anexa o payload do usuário ao objeto `req`.
 */
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res
      .status(401)
      .json({ error: "Token de autenticação não fornecido." });
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({ error: "Token mal formatado." });
  }

  const token = parts[1];
  const secret = process.env.JWT_SECRET || "seu-segredo-super-secreto";
  if (secret === "seu-segredo-super-secreto") {
    console.warn("ALERTA: Usando chave JWT padrão. Defina JWT_SECRET em .env");
  }

  try {
    // Agora tipado para incluir 'permissoes'
    const decoded = jwt.verify(token, secret) as JwtPayload;

    // Anexa os dados do usuário decodificados à requisição para uso posterior
    req.usuario = decoded;

    return next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
};
