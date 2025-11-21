// src/controllers/AuthController.js (Versão Provisória para Teste)

const Colaborador = require('../models/Colaborador');
const jwt = require('jsonwebtoken'); // Certifique-se de que o 'jsonwebtoken' está instalado!

class AuthController {
    async login(req, res) {
        const { email, password } = req.body;

        // ⚠️ [SENIOR ALERT]: ISTO É APENAS PARA TESTE. 
        // EM PRODUÇÃO, A SENHA DEVE SER HASHED E VERIFICADA com bcrypt/compare.
        if (email === 'admin@chef.com' && password === '123456') {
            // Busque o colaborador no banco para obter o ID real
            const colaborador = await Colaborador.findOne({ where: { email } });

            if (colaborador) {
                // 1. Gera um Token JWT
                const token = jwt.sign(
                    { id: colaborador.id_colaborador, cargo: colaborador.cargo },
                    process.env.APP_SECRET, // Chave secreta no .env
                    { expiresIn: '1h' }
                );

                // 2. Retorna o Token que o frontend espera
                return res.json({ token, user: { id: colaborador.id_colaborador, email: colaborador.email } });
            }
        }

        // Se as credenciais fixas ou a busca falharem
        return res.status(401).json({ error: 'Credenciais inválidas.' });
    }
}

module.exports = new AuthController();