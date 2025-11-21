// src/controllers/FiscalController.js

const RegistroFiscal = require('../models/RegistroFiscal');
const { Op } = require('sequelize');
const { connection } = require('../config/sequelize');

class FiscalController {

    // Método interno para criação de registros (chamado por VendaController/PedidoController)
    async createAutomaticFiscalRecord(data, transaction) {
        if (!transaction) {
            throw new Error('A transação Sequelize é obrigatória para o registro fiscal.');
        }
        
        try {
            const registro = await RegistroFiscal.create(data, { transaction });
            return registro;
        } catch (error) {
            // Re-throw para que a transação maior faça o rollback
            throw new Error('Falha ao registrar Registro Fiscal automático: ' + error.message); 
        }
    }


    /**
     * Endpoint para exportar dados fiscais (JSON/CSV) para o contador.
     * Rota: GET /api/v1/fiscal/exportar
     * @query { data_inicio, data_fim, tipo_origem }
     */
    async exportForAccountant(req, res) {
        const { data_inicio, data_fim, tipo_origem } = req.query;

        let where = {};
        if (data_inicio && data_fim) {
            // Filtra por data_emissao dentro do período
            where.data_emissao = { [Op.between]: [new Date(data_inicio), new Date(data_fim)] };
        }
        if (tipo_origem) {
            where.tipo_origem = tipo_origem;
        }

        try {
            const registros = await RegistroFiscal.findAll({
                where,
                order: [['data_emissao', 'ASC']]
            });

            // Retorna o JSON completo. Na interface, um botão "Exportar CSV" consumiria este endpoint
            // e faria a conversão para CSV/planilha no Frontend, simplificando o Backend.
            return res.status(200).json({
                message: `Exportação Fiscal de ${registros.length} registros no período.`,
                data_para_contador: registros,
            });

        } catch (error) {
            console.error('❌ ERRO NA EXPORTAÇÃO FISCAL:', error);
            return res.status(500).json({ error: 'Erro ao gerar exportação fiscal.', details: error.message });
        }
    }
}

module.exports = new FiscalController();