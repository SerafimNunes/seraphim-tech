// src/routes/contagemRoutes.js

const express = require('express');
const router = express.Router();
const ContagemController = require('../controllers/ContagemController');

// Rota POST para registrar uma nova Contagem Cega: POST /api/v1/contagem
router.post('/contagem', ContagemController.store);

module.exports = router;