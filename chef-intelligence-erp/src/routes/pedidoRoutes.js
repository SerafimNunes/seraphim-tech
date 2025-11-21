// src/routes/pedidoRoutes.js

const express = require('express');
const router = express.Router();
const PedidoController = require('../controllers/PedidoController');

// Rota 1: Sugestão de Compra Automática (Alerta de Estoque Mínimo)
router.get('/compras/alerta', PedidoController.suggestItemsBelowMin);

// Rota 2: Criação de um novo Pedido de Compra (Status SUGERIDO)
router.post('/pedidos', PedidoController.store);

// Rota 3: Listagem de Pedidos de Compra (Para o Painel do Gestor)
router.get('/pedidos', PedidoController.index);

// Rota 4: Aprovação ou Rejeição (Validação do Gestor)
router.patch('/pedidos/:id/status', PedidoController.updateStatus);

// Rota 5: CRÍTICA - Recebimento de Insumos (Entrada em Estoque e Recálculo de CMV)
router.patch('/pedidos/:id/recebimento', PedidoController.receberInsumos);

module.exports = router;