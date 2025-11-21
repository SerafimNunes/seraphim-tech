// src/routes/movimentoRoutes.js

const express = require('express');
const router = express.Router();
const MovimentoController = require('../controllers/MovimentoController');

// Rota GET para listar todos os movimentos de estoque (com filtros opcionais)
router.get('/movimentos', MovimentoController.index);

module.exports = router;