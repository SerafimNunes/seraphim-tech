// src/routes/fiscalRoutes.js

const express = require('express');
const router = express.Router();
const FiscalController = require('../controllers/FiscalController');

// Rota 1: Exportação de Dados Fiscais (para o Contador)
router.get('/fiscal/exportar', FiscalController.exportForAccountant);

// Rota 2: Visualização dos Registros (pelo Responsável) - Reutiliza a lógica de listagem
router.get('/fiscal', FiscalController.exportForAccountant); // Reutilizando o mesmo endpoint com filtros

module.exports = router;