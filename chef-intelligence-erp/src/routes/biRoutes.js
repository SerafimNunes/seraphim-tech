// src/routes/biRoutes.js

const express = require('express');
const router = express.Router();
const BIDataController = require('../controllers/BIDataController');

// 1. DRE Simplificada / Fluxo de Caixa Operacional
// GET /api/v1/bi/dre?data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD
router.get('/bi/dre', BIDataController.getDRESimplificada);

// 2. Resumo Financeiro Global (Margem Bruta %, Ticket Médio)
// GET /api/v1/bi/resumo-financeiro?data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD
router.get('/bi/resumo-financeiro', BIDataController.getResumoFinanceiro);

// 3. Ranking de Produtos Mais Vendidos
// GET /api/v1/bi/ranking-produtos?data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD
router.get('/bi/ranking-produtos', BIDataController.getRankingProdutos);

module.exports = router;