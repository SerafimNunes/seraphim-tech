// src/routes/producaoRoutes.js

const express = require('express');
const router = express.Router();
const ProducaoController = require('../controllers/ProducaoController');

// Rota 1: Sugestão de Produção Automática (Alerta de Estoque Mínimo)
router.get('/producao/alerta', ProducaoController.suggestProduction);

// Rota 2: Listagem de Ordens de Produção (Para o Painel de Monitoramento do Gestor)
router.get('/producao', ProducaoController.index); // Descomentada e essencial

// Rota 3: Criação manual de uma OP (opcional, mantendo a flexibilidade)
router.post('/producao', ProducaoController.store); 

// Rota 4: Aprovação (Gestor) - Início da Produção (Gera Requisição de Insumos)
router.patch('/producao/:id/aprovar', ProducaoController.startProduction);

// Rota 5: Entrega/Confirmação (Estoquista/João) - Abate os insumos do Estoque
router.patch('/producao/:id/entregar-insumos', ProducaoController.deliverInsumos);

// Rota 6: Conclusão (Cozinheiro/Gestor/Pedro) - Adiciona o Produto Final ao Estoque
router.patch('/producao/:id/concluir', ProducaoController.finishProduction);

// 🔑 Rota 7 (NOVA): Rejeição/Cancelamento de OP (Antes da Entrega dos Insumos)
router.patch('/producao/:id/cancelar', ProducaoController.cancelProduction); // NOVO MÉTODO

module.exports = router;