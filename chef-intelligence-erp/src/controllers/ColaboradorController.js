// src/controllers/ColaboradorController.js

const Colaborador = require('../models/Colaborador');
// Módulos de segurança: bcrypt para hash de senhas (futura implementação de autenticação)
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10; 

class ColaboradorController {

    /**
     * Lista todos os colaboradores ativos.
     * Rota: GET /api/v1/colaboradores
     */
    async index(req, res) {
        try {
            const colaboradores = await Colaborador.findAll({
                where: { ativo: true },
                attributes: { exclude: ['senha_hash'] } // NUNCA expor a senha
            });
            return res.status(200).json(colaboradores);
        } catch (error) {
            return res.status(500).json({ error: 'Erro ao buscar colaboradores.', details: error.message });
        }
    }

    /**
     * Cadastra um novo colaborador (incluindo o hash da senha).
     * Rota: POST /api/v1/colaboradores
     * @body { nome, funcao, nivel_senioridade, email, senha, restricoes_individuais }
     */
    async store(req, res) {
        const { nome, funcao, nivel_senioridade, email, senha, restricoes_individuais } = req.body;

        try {
            // 🔑 CRÍTICO: Gerar hash da senha antes de salvar no banco
            let senha_hash = null;
            if (senha) {
                senha_hash = await bcrypt.hash(senha, SALT_ROUNDS);
            }

            const colaborador = await Colaborador.create({
                nome,
                funcao,
                nivel_senioridade: nivel_senioridade || 1,
                email,
                senha_hash,
                restricoes_individuais,
            });

            // Omitir o hash da senha na resposta
            const resposta = colaborador.toJSON();
            delete resposta.senha_hash;

            return res.status(201).json(resposta);

        } catch (error) {
            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).json({ error: 'Email já cadastrado.' });
            }
            return res.status(500).json({ error: 'Erro ao cadastrar colaborador.', details: error.message });
        }
    }
    
    // ... Implementar métodos update e delete(inativar)
}

module.exports = new ColaboradorController();