// src/controllers/LancamentoController.js

const Lancamento = require('../models/Lancamento');

class LancamentoController {

    /**
     * Cria um novo lançamento financeiro no sistema (chamado por outros módulos).
     * @param {Object} data - Dados do lançamento (tipo_lancamento, valor, descricao, colaborador_id, categoria, id_caixa)
     * @param {Object} transaction - Transação Sequelize obrigatória para atomicidade
     */
    async createAutomaticLancamento(data, transaction) {
        if (!transaction) {
            throw new Error('A transação Sequelize é obrigatória para este tipo de lançamento.');
        }
        
        try {
            // A data deve ser validada no controller de origem (ex: PedidoController)
            const lancamento = await Lancamento.create(data, { transaction });
            return lancamento;
        } catch (error) {
            // Re-throw the error para que o controller chamador faça o rollback
            throw new Error('Falha ao registrar lançamento financeiro automático: ' + error.message); 
        }
    }
    
    // Rota GET /lancamentos (para listagem, se necessário)
}

module.exports = new LancamentoController();