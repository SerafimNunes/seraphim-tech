// src/controllers/ProdutoController.js

const { connection } = require('../config/sequelize');
const Produto = require('../models/Produto');
// 💡 CRÍTICO: Importa o modelo de Movimento de Estoque para auditoria
const MovimentoEstoque = require('../models/MovimentoEstoque'); 
const Sequelize = require('sequelize');


class ProdutoController {

    async store(req, res) { 
        // ✅ CORREÇÃO: Desestrutura preco_venda
        const { nome, unidade_medida, estoque_minimo, preco_venda, is_vendavel, is_pre_pronto } = req.body;

        try {
            const produto = await Produto.create({
                nome,
                unidade_medida,
                estoque_minimo: parseFloat(estoque_minimo) || 0, // Garante que é numérico
                estoque_atual: 0, 
                preco_custo_unitario: 0, 
                preco_venda: parseFloat(preco_venda) || 0, // ✅ CORREÇÃO: Inclui e garante que é numérico.
                is_vendavel: is_vendavel || false,
                is_pre_pronto: is_pre_pronto || false,
            });

            return res.status(201).json(produto);

        } catch (error) {
            console.error('❌ ERRO ao criar produto:', error);
            return res.status(500).json({ error: 'Erro ao criar produto.', details: error.message });
        }
    }
    
    async index(req, res) { 
        try {
            const produtos = await Produto.findAll();
            return res.status(200).json(produtos);
        } catch (error) {
            console.error('❌ ERRO ao listar produtos:', error);
            return res.status(500).json({ error: 'Erro ao listar produtos.', details: error.message });
        }
    }
    
    async update(req, res) { 
        const { id } = req.params;
        const updates = req.body;

        try {
            const [updated] = await Produto.update(updates, {
                where: { id_produto: id }
            });

            if (updated) {
                const produtoAtualizado = await Produto.findByPk(id);
                return res.status(200).json(produtoAtualizado);
            }

            return res.status(404).json({ error: 'Produto não encontrado.' });

        } catch (error) {
            console.error('❌ ERRO ao atualizar produto:', error);
            return res.status(500).json({ error: 'Erro ao atualizar produto.', details: error.message });
        }
    }

    async show(req, res) { 
        const { id } = req.params;

        try {
            const produto = await Produto.findByPk(id); 

            if (!produto) {
                return res.status(404).json({ error: 'Produto não encontrado.' });
            }

            return res.status(200).json(produto);

        } catch (error) {
            console.error('❌ ERRO ao buscar produto:', error);
            return res.status(500).json({ error: 'Erro ao buscar produto.', details: error.message });
        }
    }

    /**
     * Entrada de Estoque (Compra/Recebimento) - Calcula CMV E Registra Movimento
     * Rota: PATCH /api/v1/produtos/:id/entrada
     * @body { qtd_entrada, preco_custo_unitario_novo, observacoes }
     */
    async receberEstoque(req, res) {
        const { id } = req.params;
        // 1. Desestrutura valores originais (Strings)
        const { qtd_entrada, preco_custo_unitario_novo, observacoes } = req.body;
        
        // 2. ✅ CORREÇÃO CRÍTICA (Crash e Validação): Converte para Float usando novos nomes de variável
        const qtdEntradaParsed = parseFloat(qtd_entrada);
        const precoCustoUnitarioNovoParsed = parseFloat(preco_custo_unitario_novo);

        // 3. ✅ CORREÇÃO CRÍTICA (Typo 'isNan' e lógica): Usa isNaN e as variáveis parseadas
        if (isNaN(qtdEntradaParsed) || qtdEntradaParsed <= 0 || isNaN(precoCustoUnitarioNovoParsed) || precoCustoUnitarioNovoParsed < 0) {
            return res.status(400).json({ 
                error: 'Quantidade de entrada e custo unitário de compra são obrigatórios e devem ser valores numéricos válidos (a quantidade deve ser positiva).',
                details: 'Valores recebidos: qtd_entrada=' + qtd_entrada + ' preco_custo_unitario_novo=' + preco_custo_unitario_novo
            });
        }

        const transaction = await connection.transaction();

        try {
            const produto = await Produto.findByPk(id, { transaction });

            if (!produto) {
                await transaction.rollback();
                return res.status(404).json({ error: 'Produto não encontrado (ID inválido).' });
            }

            const estoque_anterior = parseFloat(produto.estoque_atual);
            const custo_anterior = parseFloat(produto.preco_custo_unitario);
            
            // 1. CÁLCULO DO NOVO CUSTO MÉDIO PONDERADO (CMV)
            const novo_estoque = estoque_anterior + qtdEntradaParsed; // Usa o valor parseado
            const custo_total_anterior = estoque_anterior * custo_anterior;
            const custo_total_nova_compra = qtdEntradaParsed * precoCustoUnitarioNovoParsed; // Usa o valor parseado
            const novo_custo_unitario = (custo_total_anterior + custo_total_nova_compra) / novo_estoque;

            // 2. Atualiza o Produto no Banco de Dados
            await produto.update({
                estoque_atual: novo_estoque,
                preco_custo_unitario: novo_custo_unitario.toFixed(2), // Atualiza o CMP
            }, { transaction });

            // 3. 🔑 CRÍTICO: Registra o movimento de estoque para auditoria (Audit Log)
            const custo_movimento = qtdEntradaParsed * precoCustoUnitarioNovoParsed;

            await MovimentoEstoque.create({
                id_produto: id,
                tipo_movimento: 'ENTRADA',
                quantidade: qtdEntradaParsed,
                // Nota: O seu MovimentoEstoque.js usa preco_custo_unitario_momento/custo_total_movimento
                // Estou assumindo que 'custo_movimento' no controller mapeia corretamente (ou precisa ser ajustado no Model)
                preco_custo_unitario_momento: precoCustoUnitarioNovoParsed.toFixed(2), // Ajuste o nome se necessário
                custo_total_movimento: custo_movimento.toFixed(2), // Ajuste o nome se necessário
                estoque_anterior: estoque_anterior,
                estoque_atual: novo_estoque,
                observacoes: observacoes || 'ENTRADA por Compra/Recebimento', // ✅ CORREÇÃO: Inclui observacoes
            }, { transaction });


            await transaction.commit();

            return res.status(200).json({
                produto: produto,
                novo_custo_unitario: novo_custo_unitario.toFixed(2),
                message: `${qtdEntradaParsed} ${produto.unidade_medida} de ${produto.nome} registrado como entrada. Novo Custo Médio: R$ ${novo_custo_unitario.toFixed(2)}`,
            });

        } catch (error) {
            await transaction.rollback();
            console.error('❌ ERRO NA TRANSAÇÃO DE ENTRADA:', error);
            return res.status(500).json({
                error: 'Erro grave no servidor ao registrar entrada de estoque. Transação desfeita', 
                details: error.message 
            });
        }
    }

    /**
     * Saída de Estoque (Consumo/Baixa) - Registra Movimento
     * Rota: PATCH /api/v1/produtos/:id/saida
     * @body { quantidade, observacoes }
     */
    async saidaEstoque(req, res) {
        const { id } = req.params;
        const { quantidade, observacoes } = req.body; // ✅ Observacoes já está aqui

        if (!quantidade || parseFloat(quantidade) <= 0) {
            return res.status(400).json({ error: 'Quantidade de saída deve ser positiva.' });
        }

        const qtd_saida = parseFloat(quantidade);

        const transaction = await connection.transaction();

        try {
             // CRÍTICO: Bloqueia a linha (Lock) para evitar race condition
            const produto = await Produto.findByPk(id, { transaction, lock: true });

            if (!produto) {
                await transaction.rollback();
                return res.status(404).json({ error: 'Produto não encontrado.' });
            }

            const estoque_anterior = parseFloat(produto.estoque_atual);
            const custo_medio_unitario = parseFloat(produto.preco_custo_unitario);

            // 1. VALIDAÇÃO CRÍTICA: Não permite estoque negativo
            if (estoque_anterior < qtd_saida) {
                await transaction.rollback();
                return res.status(400).json({ error: `Estoque insuficiente. Disponível: ${estoque_anterior} ${produto.unidade_medida}.` });
            }

            // 2. CÁLCULO DA SAÍDA
            const novo_estoque = estoque_anterior - qtd_saida;
            const custo_saida = qtd_saida * custo_medio_unitario;

            // 3. Atualiza o Produto no Banco de Dados
            await produto.update({
                estoque_atual: novo_estoque
            }, { transaction });
            
            // 4. 🔑 CRÍTICO: Registra o movimento de estoque para auditoria (Audit Log)
            await MovimentoEstoque.create({
                id_produto: id,
                tipo_movimento: 'SAIDA',
                quantidade: qtd_saida,
                preco_custo_unitario_momento: custo_medio_unitario.toFixed(2), // Ajuste o nome se necessário
                custo_total_movimento: custo_saida.toFixed(2), // Custo Total da SAÍDA (CMV)
                estoque_anterior: estoque_anterior,
                estoque_atual: novo_estoque,
                observacoes: observacoes || 'SAÍDA por Consumo/Baixa Manual',
            }, { transaction });

            await transaction.commit();

            return res.status(200).json({
                produto: produto,
                custo_saida: custo_saida.toFixed(2),
                message: `${qtd_saida} ${produto.unidade_medida} de ${produto.nome} registrado como saída/consumo.`
            });

        } catch (error) {
            await transaction.rollback();
            console.error('❌ ERRO NA TRANSAÇÃO DE SAÍDA:', error);
            return res.status(500).json({ error: 'Erro ao registrar saída de estoque.', details: error.message });
        }
    }
}

module.exports = new ProdutoController();