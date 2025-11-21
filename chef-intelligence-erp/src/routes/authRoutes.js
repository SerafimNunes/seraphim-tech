// src/routes/authRoutes.js

const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');

// 1. Rota de Login (a que o Frontend está chamando)
// POST /api/v1/auth/login
router.post('/auth/login', AuthController.login);

module.exports = router;