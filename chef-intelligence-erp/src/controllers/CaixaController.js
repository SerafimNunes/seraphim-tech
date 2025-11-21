// src/controllers/CaixaController.js

const { connection } = require('../config/sequelize');
const Sequelize = require('sequelize');

const Caixa = require('../models/Caixa');
const Lancamento = require('../models/Lancamento');
const Venda = require('../models/Venda');

class CaixaController {

    /**
     * Inicia um novo turno de Caixa.
     * Rota: POST /api/v1/caixa/abrir
     * @body { colaborador_id_abertura, saldo_inicial }
     */
    async abrirCaixa(req, res) {
        const { colaborador_id_abertura, saldo_inicial } = req.body;

        if (!colaborador_id_abertura) {
            return res.status(400).json({ error: 'ID do colaborador é obrigatório.' });
        }

        const transaction = await connection.transaction();
        try {
            // 1. Verificar se já existe um caixa aberto
            const caixaAberto = await Caixa.findOne({ where: { status_caixa: 'ABERTO' }, transaction });

            if (caixaAberto) {
                await transaction.rollback();
                return res.status(400).json({ error: `Já existe um caixa aberto (ID ${caixaAberto.id_caixa}).` });
            }

            // 2. Abrir o novo Caixa
            const novoCaixa = await Caixa.create({
                colaborador_id_abertura,
                saldo_inicial: parseFloat(saldo_inicial) || 0.00,
                status_caixa: 'ABERTO',
            }, { transaction });

            await transaction.commit();

            return res.status(201).json({
                message: `Caixa ID ${novoCaixa.id_caixa} aberto com saldo inicial de R$ ${novoCaixa.saldo_inicial}.`,
                caixa: novoCaixa
            });

        } catch (error) {
            await transaction.rollback();
            console.error('❌ ERRO AO ABRIR CAIXA:', error);
            return res.status(500).json({ error: 'Erro ao abrir o caixa.', details: error.message });
        }
    }

    /**
     * Fecha o turno de Caixa e calcula o Saldo Final.
     * Rota: PATCH /api/v1/caixa/:id/fechar
     * @body { colaborador_id_fechamento }
     */
    async fecharCaixa(req, res) {
        const { id } = req.params;
        const { colaborador_id_fechamento } = req.body;

        if (!colaborador_id_fechamento) {
            return res.status(400).json({ error: 'ID do colaborador de fechamento é obrigatório.' });
        }

        const transaction = await connection.transaction();
        try {
            const caixa = await Caixa.findByPk(id, { transaction, lock: true });

            if (!caixa || caixa.status_caixa !== 'ABERTO') {
                await transaction.rollback();
                return res.status(400).json({ error: 'Caixa não encontrado ou já está fechado.' });
            }

            // 1. Agrega o total das Vendas associadas
            const vendasAgregadas = await Venda.findOne({
                attributes: [
                    [Sequelize.fn('SUM', Sequelize.col('valor_total')), 'total_vendas'],
                    [Sequelize.fn('SUM', Sequelize.col('custo_total')), 'total_cmv'], // Para BI
                ],
                where: { id_caixa: id, status_venda: 'FECHADA' },
                transaction,
            });

            // 2. Agrega o total dos Lançamentos (Despesas, Receitas, Sangrias)
            const lancamentosAgregados = await Lancamento.findOne({
                attributes: [
                    [Sequelize.fn('SUM', Sequelize.literal("CASE WHEN tipo_lancamento = 'DESPESA' OR tipo_lancamento = 'SANGRIA' THEN valor ELSE 0 END")), 'total_despesas'],
                    [Sequelize.fn('SUM', Sequelize.literal("CASE WHEN tipo_lancamento = 'RECEITA' OR tipo_lancamento = 'REFORCO' THEN valor ELSE 0 END")), 'total_outras_receitas'],
                ],
                where: { id_caixa: id },
                transaction,
            });

            const totalVendas = parseFloat(vendasAgregadas?.dataValues.total_vendas || 0);
            const totalDespesas = parseFloat(lancamentosAgregados?.dataValues.total_despesas || 0);
            const totalOutrasReceitas = parseFloat(lancamentosAgregados?.dataValues.total_outras_receitas || 0);
            const saldoInicial = parseFloat(caixa.saldo_inicial);
            
            // Saldo Final = Inicial + Vendas + Outras Receitas - Despesas
            const saldoFinal = saldoInicial + totalVendas + totalOutrasReceitas - totalDespesas;
            
            // 3. Atualiza o Caixa com os totais e o Saldo Final
            await caixa.update({
                status_caixa: 'FECHADO',
                colaborador_id_fechamento,
                data_fechamento: new Date(),
                total_vendas: totalVendas.toFixed(2),
                total_despesas: totalDespesas.toFixed(2),
                saldo_final_calculado: saldoFinal.toFixed(2),
            }, { transaction });

            await transaction.commit();

            return res.status(200).json({
                message: `Caixa ID ${id} fechado com sucesso.`,
                relatorio: {
                    caixa_id: caixa.id_caixa,
                    saldo_inicial: saldoInicial.toFixed(2),
                    total_vendas: totalVendas.toFixed(2),
                    total_despesas: totalDespesas.toFixed(2),
                    saldo_final_calculado: saldoFinal.toFixed(2),
                }
            });

        } catch (error) {
            await transaction.rollback();
            console.error('❌ ERRO AO FECHAR CAIXA:', error);
            return res.status(500).json({ error: 'Erro ao fechar o caixa e gerar relatório.', details: error.message });
        }
    }
}

module.exports = new CaixaController();