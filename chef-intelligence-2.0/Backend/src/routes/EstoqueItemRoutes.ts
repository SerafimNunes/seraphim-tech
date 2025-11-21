// src/routes/EstoqueItemRoutes.ts (Refatorado de produtoRoutes.js)

import express from "express";
// Importa a INSTÂNCIA do Controller (Corrigido para ser uma instância, resolvendo TS2339)
import EstoqueItemController from "../controllers/EstoqueItemController";

const router = express.Router();

// Rota POST para criar um novo item: POST /api/v1/produtos
router.post("/produtos", EstoqueItemController.store);

// Rota GET para listar todos: GET /api/v1/produtos
router.get("/produtos", EstoqueItemController.index);

// Rota GET para buscar por ID: GET /api/v1/produtos/:id
router.get("/produtos/:id", EstoqueItemController.show);

// Rota PUT para atualizar: PUT /api/v1/produtos/:id
router.put("/produtos/:id", EstoqueItemController.update);

// Rota PATCH para entrada/compra de estoque (CMV - R3): PATCH /api/v1/produtos/:id/entrada
// O Controller lerá o :id para saber qual item movimentar.
router.patch("/produtos/:id/entrada", EstoqueItemController.receberEstoque);

// Rota PATCH para saída/consumo de estoque (Bloqueio Negativo - R2): PATCH /api/v1/produtos/:id/saida
// O Controller lerá o :id para saber qual item movimentar.
router.patch("/produtos/:id/saida", EstoqueItemController.saidaEstoque);

export default router;
