// src/controllers/MovimentoController.js

const MovimentoEstoque = require('../models/MovimentoEstoque');
const Produto = require('../models/Produto');

class MovimentoController {

    /**
     * Lista o histórico de movimentos de estoque, com filtros opcionais.
     * Rota: GET /api/v1/movimentos
     * Query Params: id_produto, tipo_movimento
     */
    async index(req, res) {
        // Pega filtros da query string (Ex: /movimentos?id_produto=1&tipo_movimento=SAIDA)
        const { id_produto, tipo_movimento } = req.query; 

        // Cria o objeto WHERE para filtrar a consulta
        const where = {};
        if (id_produto) {
            where.id_produto = id_produto;
        }
        if (tipo_movimento) {
            where.tipo_movimento = tipo_movimento;
        }

        try {
            const movimentos = await MovimentoEstoque.findAll({
                where,
                // Inclui o nome do produto para facilitar a leitura do relatório
                include: [{
                    model: Produto,
                    as: 'produto',
                    attributes: ['id_produto', 'nome', 'unidade_medida'],
                }],
                // Ordena do mais recente para o mais antigo
                order: [['createdAt', 'DESC']], 
            });
            
            return res.status(200).json(movimentos);

        } catch (error) {
            console.error('❌ ERRO AO LISTAR MOVIMENTOS:', error);
            return res.status(500).json({ error: 'Erro ao listar histórico de movimentos de estoque.', details: error.message });
        }
    }
}

module.exports = new MovimentoController();