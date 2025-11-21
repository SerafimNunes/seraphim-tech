// src/routes/caixaRoutes.js

const express = require('express');
const router = express.Router();
const CaixaController = require('../controllers/CaixaController');

// Rota 1: Abrir o Caixa (Início do Turno)
router.post('/caixa/abrir', CaixaController.abrirCaixa);

// Rota 2: Fechar o Caixa (Fim do Turno e Geração do Relatório)
router.patch('/caixa/:id/fechar', CaixaController.fecharCaixa);

// Rota 3: Lançar Despesa/Reforço/Sangria (Método a ser criado no Controller)
// router.post('/lancamento', CaixaController.lancarMovimento); 

module.exports = router;