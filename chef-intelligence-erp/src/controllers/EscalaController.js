// src/controllers/EscalaController.js

const Escala = require('../models/Escala');
const Colaborador = require('../models/Colaborador');
const { connection } = require('../config/sequelize');
const Sequelize = require('sequelize');

class EscalaController {
    
    /**
     * Lista todas as escalas ativas (não-RASCUNHO ou de uma versão específica).
     * Rota: GET /api/v1/escalas
     */
    async index(req, res) {
        const { versao_escala, status_aprovacao } = req.query; // Filtros opcionais

        let where = {};
        if (versao_escala) {
            where.versao_escala = versao_escala;
        }
        if (status_aprovacao) {
            where.status_aprovacao = status_aprovacao;
        } else {
            // Por padrão, pode-se excluir rascunhos para não poluir a lista principal
            where.status_aprovacao = { [Sequelize.Op.ne]: 'RASCUNHO' }; 
        }

        try {
            const escalas = await Escala.findAll({
                where,
                include: [{ model: Colaborador, as: 'colaborador', attributes: ['nome', 'funcao'] }],
                order: [['data_escala', 'ASC'], ['hora_entrada', 'ASC']],
            });
            return res.status(200).json(escalas);
        } catch (error) {
            return res.status(500).json({ error: 'Erro ao buscar escalas.', details: error.message });
        }
    }

    /**
     * Cria ou atualiza uma escala (usado pelo Auto-Scheduling ou edição manual).
     * Rota: POST /api/v1/escalas
     * @body { id_colaborador, data_escala, hora_entrada, hora_saida, versao_escala, status_aprovacao }
     */
    async store(req, res) {
        const { id_colaborador, data_escala, hora_entrada, hora_saida, versao_escala, status_aprovacao } = req.body;
        
        try {
            // O algoritmo de agendamento fará a maior parte da lógica, aqui é o registro
            const escala = await Escala.create({
                id_colaborador,
                data_escala,
                hora_entrada,
                hora_saida,
                versao_escala: versao_escala || 1,
                status_aprovacao: status_aprovacao || 'RASCUNHO',
            });
            
            return res.status(201).json(escala);

        } catch (error) {
            return res.status(500).json({ error: 'Erro ao registrar escala.', details: error.message });
        }
    }
    
    /**
     * CRÍTICO: Altera o status de uma VERSÃO de escala para APROVADA.
     * Rota: PATCH /api/v1/escalas/versao/:versao/aprovar
     * @body { id_aprovador }
     */
    async aprovarVersao(req, res) {
        const { versao } = req.params;
        const { id_aprovador } = req.body;

        if (!id_aprovador) {
            return res.status(400).json({ error: 'ID do aprovador é obrigatório.' });
        }
        
        const transaction = await connection.transaction();
        
        try {
            // Atualiza todas as escalas dessa versão para APROVADA
            const [numAtualizados] = await Escala.update({
                status_aprovacao: 'APROVADA',
                id_aprovador,
            }, {
                where: {
                    versao_escala: versao,
                    status_aprovacao: { [Sequelize.Op.ne]: 'APROVADA' } // Não tenta re-aprovar
                },
                transaction
            });

            if (numAtualizados === 0) {
                await transaction.rollback();
                return res.status(404).json({ error: `Nenhuma escala da versão ${versao} estava pendente de aprovação.` });
            }

            await transaction.commit();
            return res.status(200).json({
                message: `Sucesso! ${numAtualizados} escalas da versão ${versao} foram aprovadas.`,
            });
            
        } catch (error) {
            await transaction.rollback();
            console.error('❌ ERRO NA APROVAÇÃO DE ESCALA:', error);
            return res.status(500).json({ error: 'Erro ao aprovar a versão da escala.', details: error.message });
        }
    }
    
    // ... Implementar o método para chamar o Auto-Scheduling (futuro)
}

module.exports = new EscalaController();