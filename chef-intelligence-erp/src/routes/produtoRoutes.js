// src/routes/produtoRoutes.js

const express = require('express');
const router = express.Router();
const ProdutoController = require('../controllers/ProdutoController');

// Mapeia a requisição POST para a função store do nosso Controller
router.post('/produtos', ProdutoController.store);

// Rota GET para listar todos os produtos: GET /api/v1/produtos
router.get('/produtos', ProdutoController.index);

// 🔑 CORREÇÃO: Rota GET para buscar um produto por ID: GET /api/v1/produtos/:id
router.get('/produtos/:id', ProdutoController.show); // ⬅️ NOVA ROTA ADICIONADA

// Rota PUT para atualizar: PUT /api/v1/produtos/:id
router.put('/produtos/:id', ProdutoController.update);

// Rota PATCH para entrada/compra de estoque: PATCH /api/v1/produtos/:id/entrada
router.patch('/produtos/:id/entrada', ProdutoController.receberEstoque);

// Rota PATCH para saída/consumo de estoque: PATCH /api/v1/produtos/:id/saida
router.patch('/produtos/:id/saida', ProdutoController.saidaEstoque);

module.exports = router;