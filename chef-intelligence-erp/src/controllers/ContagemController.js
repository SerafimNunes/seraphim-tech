// src/controllers/ContagemController.js

const { connection } = require('../config/sequelize');
const ContagemEstoque = require('../models/ContagemEstoque');
const Produto = require('../models/Produto');
const Sequelize = require('sequelize');


class ContagemController {
    
    /**
     * Registra uma nova Contagem Cega (Inventário Físico) de um produto.
     * Rota: POST /api/v1/contagem
     * @body { id_produto, estoque_contado, colaborador_id }
     */
    async store(req, res) {
        const { id_produto, estoque_contado, colaborador_id } = req.body;

        if (!id_produto || estoque_contado === undefined || colaborador_id === undefined) {
            return res.status(400).json({ error: 'Os campos id_produto, estoque_contado e colaborador_id são obrigatórios.' });
        }

        const transaction = await connection.transaction({ 
            isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE // Máximo nível de segurança
        });

        try {
            // 1. Busca o Produto com Lock (Garante que o estoque_atual não mude durante o cálculo)
            const produto = await Produto.findByPk(id_produto, {
                attributes: ['id_produto', 'nome', 'estoque_atual', 'preco_custo_unitario', 'unidade_medida'],
                lock: transaction.LOCK.UPDATE, // Impede outras transações de alterar o estoque
                transaction
            });

            if (!produto) {
                await transaction.rollback();
                return res.status(404).json({ error: 'Produto não encontrado para contagem.' });
            }

            // Garante que os valores sejam numéricos para os cálculos
            const estoqueTeorico = parseFloat(produto.estoque_atual);
            const estoqueFisico = parseFloat(estoque_contado);
            const precoCusto = parseFloat(produto.preco_custo_unitario);

            // 2. CÁLCULO DA DISCREPÂNCIA E CUSTO
            const discrepancia = estoqueFisico - estoqueTeorico; // Positivo = sobra, Negativo = perda
            const custoDiscrepancia = discrepancia * precoCusto;
            const tipoDiscrepancia = discrepancia > 0 ? 'SOBRA' : (discrepancia < 0 ? 'PERDA' : 'NENHUMA');

            // 3. REGISTRO DA CONTAGEM DE AUDITORIA
            const contagem = await ContagemEstoque.create({
                id_produto,
                estoque_contado: estoqueFisico,
                estoque_teorico_na_hora: estoqueTeorico,
                discrepancia: discrepancia,
                custo_discrepancia: custoDiscrepancia,
                colaborador_id,
            }, { transaction });

            // 4. ATUALIZAÇÃO CRÍTICA DO ESTOQUE (Ajuste)
            // O estoque atual do produto é atualizado para o valor contado
            await produto.update({
                estoque_atual: estoqueFisico,
            }, { transaction });

            // 5. Commit da Transação
            await transaction.commit();

            // 6. Retorno de Sucesso com o resultado da Auditoria
            return res.status(201).json({ 
                contagem_registrada: contagem,
                message: `Contagem cega de ${produto.nome} registrada.`,
                resultado_auditoria: {
                    discrepancia: `${Math.abs(discrepancia).toFixed(3)} ${produto.unidade_medida} de ${tipoDiscrepancia}.`,
                    ajuste_financeiro: `R$ ${custoDiscrepancia.toFixed(2)}`,
                    estoque_atual_apos_ajuste: estoqueFisico.toFixed(3),
                }
            });

        } catch (error) {
            await transaction.rollback();
            console.error('❌ ERRO NA TRANSAÇÃO DE CONTAGEM CEGA:', error);
            return res.status(500).json({ error: 'Erro ao registrar contagem de estoque.', details: error.message });
        }
    }

    // Futuramente, você pode adicionar um método 'report' aqui para listar discrepâncias.
}

module.exports = new ContagemController();