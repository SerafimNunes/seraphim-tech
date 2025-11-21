// src/routes/rhRoutes.js

const express = require('express');
const router = express.Router();
const ColaboradorController = require('../controllers/ColaboradorController');
const EscalaController = require('../controllers/EscalaController');
const AutoSchedulingController = require('../controllers/AutoSchedulingController');

// ROTAS DE COLABORADORES (CRUD BÁSICO)
// Rota 1: Listar Colaboradores
router.get('/colaboradores', ColaboradorController.index);
// Rota 2: Cadastrar Colaborador
router.post('/colaboradores', ColaboradorController.store);
// Rota 3: Atualizar/Inativar Colaborador (Ex: /colaboradores/:id)

// ROTAS DE ESCALAS
// Rota 4: Listar Escalas
router.get('/escalas', EscalaController.index);
// Rota 5: Registrar uma Escala (Usado pelo algoritmo ou manualmente)
router.post('/escalas', EscalaController.store);
// Rota 6: CRÍTICA - Aprovação de uma Versão da Escala
router.patch('/escalas/versao/:versao/aprovar', EscalaController.aprovarVersao);

// 👥 NOVA ROTA CRÍTICA: Geração de Escala por Algoritmo
router.post('/rh/auto-schedule', AutoSchedulingController.generateSchedule);

module.exports = router;