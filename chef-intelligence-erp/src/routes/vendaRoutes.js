// src/routes/vendaRoutes.js

const express = require('express');
const router = express.Router();
const VendaController = require('../controllers/VendaController');

// Rota 1: Lançar Pedido (Abre Venda/Comanda ou adiciona itens e faz o CMV)
// Rota: POST /api/v1/vendas/pedido
router.post('/vendas/pedido', VendaController.lancarPedido);

// Rota 2: Fechar Venda/Comanda (Finaliza o pagamento e libera a mesa)
// Rota: PATCH /api/v1/vendas/:id/fechar
router.patch('/vendas/:id/fechar', VendaController.fecharVenda);

// Rota 3: Listar Vendas Abertas/Fechadas (Para painel e BI)
// router.get('/vendas', VendaController.index); 

module.exports = router;