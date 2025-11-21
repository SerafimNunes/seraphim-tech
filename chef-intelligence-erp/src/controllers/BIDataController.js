// src/controllers/BIDataController.js

const { connection } = require('../config/sequelize');
const Sequelize = require('sequelize');
const { Op } = Sequelize;

// Modelos que serão a fonte de dados do BI (Vendas, Custos e Despesas)
const Venda = require('../models/Venda');
const Lancamento = require('../models/Lancamento');
const Produto = require('../models/Produto');
const ItemVenda = require('../models/ItemVenda'); 


// 🔑 FUNÇÕES AUXILIARES DE PRECISÃO FINANCEIRA (CRÍTICO)
// 1. Converte R$ para Centavos (Inteiro) para cálculos seguros
const toCents = (value) => Math.round(parseFloat(value || 0) * 100); 
// 2. Converte Centavos de volta para o formato BRL (R$ com 2 casas)
const toBRL = (valueInCents) => (valueInCents / 100).toFixed(2);
const isValidDate = (date) => !isNaN(new Date(date));


class BIDataController {

    /**
     * Auxiliar: Configura o filtro de data (usando o mês atual como fallback)
     */
    _getDateFilter(dataInicio, dataFim) {
        if (!dataInicio || !dataFim || !isValidDate(dataInicio) || !isValidDate(dataFim)) {
            const today = new Date();
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            endOfMonth.setHours(23, 59, 59, 999); // Garante que inclui o último segundo do dia

            return {
                [Op.between]: [startOfMonth, endOfMonth],
                message: `Datas inválidas ou ausentes. Utilizando o filtro padrão: ${startOfMonth.toLocaleDateString('pt-BR')} a ${endOfMonth.toLocaleDateString('pt-BR')}.`
            };
        }

        const dateEnd = new Date(dataFim);
        dateEnd.setHours(23, 59, 59, 999);

        return {
            [Op.between]: [new Date(dataInicio), dateEnd],
            message: `Filtro aplicado: ${new Date(dataInicio).toLocaleDateString('pt-BR')} a ${new Date(dataFim).toLocaleDateString('pt-BR')}.`
        };
    }


    /**
     * 1. KPI: DRE Simplificada (Demonstração do Resultado do Exercício)
     * Rota: GET /api/v1/bi/dre
     * @query { data_inicio, data_fim }
     */
    async getDRESimplificada(req, res) {
        const { data_inicio, data_fim } = req.query;
        const dateFilter = this._getDateFilter(data_inicio, data_fim);
        const whereDate = dateFilter[Op.between] ? dateFilter : this._getDateFilter(null, null);

        try {
            // --- CÁLCULO DE VENDAS E CMV (Tabela VENDAS) ---
            const totaisVenda = await Venda.findOne({
                attributes: [
                    [Sequelize.fn('COALESCE', Sequelize.fn('SUM', Sequelize.col('valor_total')), 0), 'receita_bruta'],
                    [Sequelize.fn('COALESCE', Sequelize.fn('SUM', Sequelize.col('custo_total')), 0), 'custo_total_vendas'], // CMV
                ],
                where: {
                    data_fechamento: whereDate[Op.between],
                    status_venda: 'FECHADA',
                },
                raw: true,
            });

            const receitaBrutaCentavos = toCents(totaisVenda.receita_bruta);
            const cmvCentavos = toCents(totaisVenda.custo_total_vendas);
            const lucroBrutoCentavos = receitaBrutaCentavos - cmvCentavos;


            // --- CÁLCULO DE DESPESAS E OUTRAS RECEITAS (Tabela LANCAMENTOS) ---
            const lancamentos = await Lancamento.findAll({
                attributes: [
                    'tipo_lancamento', 
                    [Sequelize.fn('COALESCE', Sequelize.fn('SUM', Sequelize.col('valor')), 0), 'valor_total_lancamento'],
                ],
                where: {
                    data_lancamento: whereDate[Op.between],
                    tipo_lancamento: {
                        [Op.in]: ['RECEITA', 'DESPESA'] 
                    }
                },
                group: ['tipo_lancamento'],
                raw: true,
            });

            let outrasReceitasCentavos = 0;
            let despesasOperacionaisCentavos = 0;

            lancamentos.forEach(item => {
                const valorCentavos = toCents(item.valor_total_lancamento);
                if (item.tipo_lancamento === 'RECEITA') {
                    outrasReceitasCentavos += valorCentavos;
                } else if (item.tipo_lancamento === 'DESPESA') {
                    despesasOperacionaisCentavos += valorCentavos;
                }
            });

            const resultadoLiquidoCentavos = lucroBrutoCentavos + outrasReceitasCentavos - despesasOperacionaisCentavos;
            
            // --- FORMATANDO O RESULTADO ---
            return res.status(200).json({
                message: dateFilter.message,
                dre_simplificada: {
                    receita_bruta: toBRL(receitaBrutaCentavos), 
                    custo_mercadoria_vendida_cmv: toBRL(cmvCentavos), 
                    lucro_bruto: toBRL(lucroBrutoCentavos), 
                    outras_receitas: toBRL(outrasReceitasCentavos),
                    despesas_operacionais: toBRL(despesasOperacionaisCentavos),
                    resultado_liquido: toBRL(resultadoLiquidoCentavos),
                },
            });

        } catch (error) {
            console.error('❌ ERRO NO CÁLCULO DE BI (DRE Simplificada):', error);
            return res.status(500).json({ 
                error: 'Erro ao gerar o KPI de DRE Simplificada.', 
                details: error.message,
            });
        }
    }
    
    /**
     * 2. KPI: Margem Bruta Global (%) e Ticket Médio
     * Rota: GET /api/v1/bi/resumo-financeiro
     * @query { data_inicio, data_fim }
     */
    async getResumoFinanceiro(req, res) {
        const { data_inicio, data_fim } = req.query;
        const dateFilter = this._getDateFilter(data_inicio, data_fim);
        const whereDate = dateFilter[Op.between] ? dateFilter : this._getDateFilter(null, null);

        try {
            const resultado = await Venda.findOne({
                attributes: [
                    [Sequelize.fn('COALESCE', Sequelize.fn('SUM', Sequelize.col('valor_total')), 0), 'receita_total'],
                    [Sequelize.fn('COALESCE', Sequelize.fn('SUM', Sequelize.col('custo_total')), 0), 'cmv_total'],
                    [Sequelize.fn('COUNT', Sequelize.col('id_venda')), 'total_vendas'],
                ],
                where: {
                    data_fechamento: whereDate[Op.between],
                    status_venda: 'FECHADA',
                },
                raw: true,
            });

            const receitaTotalCentavos = toCents(resultado.receita_total);
            const cmvTotalCentavos = toCents(resultado.cmv_total);
            const totalVendas = parseInt(resultado.total_vendas, 10) || 0;
            
            const lucroBrutoCentavos = receitaTotalCentavos - cmvTotalCentavos;
            
            // Margem Bruta %
            const margemBruta = receitaTotalCentavos > 0
                ? ((lucroBrutoCentavos / receitaTotalCentavos) * 100).toFixed(2)
                : '0.00';
                
            // Ticket Médio
            const ticketMedio = totalVendas > 0 
                ? toBRL(Math.round(receitaTotalCentavos / totalVendas)) 
                : '0.00';


            return res.status(200).json({
                message: dateFilter.message,
                resumo: {
                    receita_total: toBRL(receitaTotalCentavos),
                    cmv_total: toBRL(cmvTotalCentavos),
                    lucro_bruto: toBRL(lucroBrutoCentavos),
                    margem_bruta_percentual: `${margemBruta}%`,
                    total_vendas: totalVendas,
                    ticket_medio: ticketMedio,
                },
            });

        } catch (error) {
            console.error('❌ ERRO NO CÁLCULO DE RESUMO FINANCEIRO:', error);
            return res.status(500).json({ 
                error: 'Erro ao gerar o KPI de Resumo Financeiro.', 
                details: error.message,
            });
        }
    }


    /**
     * 3. KPI: Ranking dos 10 Produtos Mais Vendidos (por Receita)
     * Rota: GET /api/v1/bi/ranking-produtos
     * @query { data_inicio, data_fim }
     */
    async getRankingProdutos(req, res) {
        const { data_inicio, data_fim } = req.query;
        const dateFilter = this._getDateFilter(data_inicio, data_fim);
        const whereDate = dateFilter[Op.between] ? dateFilter : this._getDateFilter(null, null);

        try {
            // A. Buscar IDs das Vendas Fechadas no Período
            const vendasNoPeriodo = await Venda.findAll({
                attributes: ['id_venda'],
                where: {
                    data_fechamento: whereDate[Op.between],
                    status_venda: 'FECHADA',
                },
                raw: true,
            });
            
            const idsVendas = vendasNoPeriodo.map(v => v.id_venda);
            
            if (idsVendas.length === 0) {
                 return res.status(200).json({
                    message: `Nenhuma venda fechada no período. ${dateFilter.message}`,
                    ranking: []
                });
            }

            // B. Agregação dos Itens de Venda
            const ranking = await ItemVenda.findAll({
                attributes: [
                    'id_produto',
                    [Sequelize.fn('SUM', Sequelize.col('quantidade')), 'quantidade_total_vendida'],
                    [Sequelize.fn('SUM', Sequelize.col('preco_venda_total')), 'receita_total_produto'],
                    [Sequelize.fn('SUM', Sequelize.col('custo_total')), 'cmv_total_produto'],
                ],
                where: {
                    id_venda: { [Op.in]: idsVendas }
                },
                // Assumindo que Produto está corretamente associado a ItemVenda com 'as: produto'
                include: [{
                    model: Produto,
                    as: 'produto',
                    attributes: ['nome', 'unidade_medida', 'is_vendavel'] 
                }],
                group: ['ItemVenda.id_produto', 'produto.id_produto'],
                order: [
                    [Sequelize.fn('SUM', Sequelize.col('preco_venda_total')), 'DESC'] 
                ],
                limit: 10,
                raw: true,
            });

            // C. Formatação do Resultado (Calcula Margem Bruta %)
            const rankingFormatado = ranking.map(item => {
                const receitaCentavos = toCents(item.receita_total_produto);
                const cmvCentavos = toCents(item.cmv_total_produto);
                const lucroBrutoCentavos = receitaCentavos - cmvCentavos;
                
                const margemBruta = receitaCentavos > 0
                    ? ((lucroBrutoCentavos / receitaCentavos) * 100).toFixed(2)
                    : '0.00';
                    
                return {
                    id_produto: item.id_produto,
                    nome_produto: item['produto.nome'], 
                    quantidade_vendida: parseFloat(item.quantidade_total_vendida).toFixed(2),
                    unidade_medida: item['produto.unidade_medida'],
                    receita_total: toBRL(receitaCentavos),
                    lucro_bruto: toBRL(lucroBrutoCentavos),
                    margem_bruta_percentual: `${margemBruta}%`,
                };
            });

            return res.status(200).json({
                message: dateFilter.message,
                ranking: rankingFormatado,
            });

        } catch (error) {
            console.error('❌ ERRO NO CÁLCULO DE RANKING:', error);
            return res.status(500).json({ 
                error: 'Erro ao gerar o KPI de Ranking de Produtos.', 
                details: error.message,
            });
        }
    }
}

module.exports = new BIDataController();