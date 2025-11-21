// src/controllers/PedidoController.js

const { connection } = require('../config/sequelize');
const LancamentoController = require('./LancamentoController');
const FiscalController = require('./FiscalController'); // AGORA ESTE IMPORT VAI FUNCIONAR
const PedidoCompra = require('../models/PedidoCompra');
const ItemPedido = require('../models/ItemPedido');
const Fornecedor = require('../models/Fornecedor');
const Produto = require('../models/Produto');
const Sequelize = require('sequelize');

// NOVO IMPORT: Necessário para chamar a lógica de entrada em estoque/CMV
const ProdutoController = require('./ProdutoController'); 

class PedidoController {

    /**
     * Alerta de Estoque Mínimo: Gera uma lista de produtos que estão abaixo do estoque mínimo.
     * Rota: GET /api/v1/compras/alerta
     */
    async suggestItemsBelowMin(req, res) {
        // ... (código existente, está OK)
        try {
            // Busca todos os produtos onde o estoque atual é menor que o estoque mínimo
            const produtosEmAlerta = await Produto.findAll({
                attributes: ['id_produto', 'nome', 'estoque_atual', 'estoque_minimo', 'unidade_medida', 'preco_custo_unitario'],
                where: {
                    estoque_atual: {
                        [Sequelize.Op.lt]: Sequelize.col('estoque_minimo') // estoque_atual < estoque_minimo
                    }
                },
                order: [['nome', 'ASC']]
            });

            if (produtosEmAlerta.length === 0) {
                return res.status(200).json({ message: "Nenhum produto abaixo do estoque mínimo. Estoque está OK." });
            }
            
            // Lógica de Sugestão de Compra: Comprar 50% a mais do que falta para segurança
            const sugestao = produtosEmAlerta.map(produto => {
                const qtdFaltando = parseFloat(produto.estoque_minimo) - parseFloat(produto.estoque_atual);
                const qtdSugerida = qtdFaltando * 1.5; 

                return {
                    id_produto: produto.id_produto,
                    nome: produto.nome,
                    unidade_medida: produto.unidade_medida,
                    estoque_atual: parseFloat(produto.estoque_atual).toFixed(3),
                    estoque_minimo: parseFloat(produto.estoque_minimo).toFixed(3),
                    quantidade_sugerida: qtdSugerida.toFixed(3),
                    custo_previsto_unitario: parseFloat(produto.preco_custo_unitario).toFixed(2)
                };
            });

            return res.status(200).json({ 
                message: `${sugestao.length} itens encontrados abaixo do estoque mínimo. Sugestão de Compra gerada.`,
                data: sugestao
            });

        } catch (error) {
            console.error('❌ ERRO NA SUGESTÃO DE COMPRA:', error);
            return res.status(500).json({ error: 'Erro ao gerar alerta de estoque mínimo.', details: error.message });
        }
    }

    /**
     * Cria um novo Pedido de Compra com status SUGERIDO.
     * Rota: POST /api/v1/pedidos
     */
    async store(req, res) {
        // ... (código existente, está OK)
        const { id_fornecedor, colaborador_id_sugestao, itens } = req.body;

        if (!id_fornecedor || !itens || itens.length === 0) {
            return res.status(400).json({ error: 'ID do Fornecedor e lista de Itens são obrigatórios.' });
        }

        const transaction = await connection.transaction({ 
            isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
        });

        try {
            let valorTotalPrevisto = 0;
            
            // 1. Valida e calcula o valor total
            const itensValidados = itens.map(item => {
                const totalItem = item.quantidade_pedida * item.preco_unitario_negociado;
                valorTotalPrevisto += totalItem;
                return {
                    id_produto: item.id_produto,
                    quantidade_pedida: item.quantidade_pedida,
                    preco_unitario_negociado: item.preco_unitario_negociado,
                };
            });

            // 2. Cria o Cabeçalho do Pedido (Status inicial: SUGERIDO)
            const pedido = await PedidoCompra.create({
                id_fornecedor,
                colaborador_id_sugestao: colaborador_id_sugestao || 0, // 0 = Sugestão do Sistema/Auto-alerta
                status_aprovacao: 'SUGERIDO',
                valor_total_previsto: valorTotalPrevisto,
            }, { transaction });

            // 3. Adiciona os Itens do Pedido
            const itensParaCriar = itensValidados.map(item => ({
                ...item,
                id_pedido: pedido.id_pedido, // Associa ao cabeçalho
            }));

            await ItemPedido.bulkCreate(itensParaCriar, { transaction });

            // 4. Commit da Transação
            await transaction.commit();

            return res.status(201).json({ 
                message: `Pedido de Compra nº ${pedido.id_pedido} SUGERIDO e aguardando aprovação.`,
                pedido_id: pedido.id_pedido,
                valor_previsto: valorTotalPrevisto.toFixed(2),
                total_itens: itens.length
            });

        } catch (error) {
            await transaction.rollback();
            console.error('❌ ERRO NA CRIAÇÃO DO PEDIDO DE COMPRA:', error);
            return res.status(500).json({ error: 'Erro ao criar o pedido de compra.', details: error.message });
        }
    }
    
    /**
     * Validação do Gestor: Rota para aprovação/rejeição do pedido.
     * Rota: PATCH /api/v1/pedidos/:id/status
     */
    async updateStatus(req, res) {
        // ... (código existente, está OK)
        const { id } = req.params;
        const { status_aprovacao, colaborador_id_aprovacao } = req.body;

        if (!status_aprovacao || !colaborador_id_aprovacao || 
            !['APROVADO', 'REPROVADO', 'CANCELADO'].includes(status_aprovacao)) {
            return res.status(400).json({ error: 'Status de aprovação válido e ID do colaborador são obrigatórios.' });
        }

        const transaction = await connection.transaction();

        try {
            const pedido = await PedidoCompra.findByPk(id, { transaction, lock: true });

            if (!pedido) {
                await transaction.rollback();
                return res.status(404).json({ error: 'Pedido de Compra não encontrado.' });
            }
            
            // Regra de Negócio: Só é possível alterar pedidos que não foram FINALIZADOS
            if (pedido.status_aprovacao === 'FINALIZADO') {
                await transaction.rollback();
                return res.status(400).json({ error: `Pedido nº ${id} já foi ${pedido.status_aprovacao} e não pode ser alterado.` });
            }
            
            // Regra de Negócio: Só aprova se o status atual for SUGERIDO ou REPROVADO (para reenvio)
            if (status_aprovacao === 'APROVADO' && pedido.status_aprovacao !== 'SUGERIDO' && pedido.status_aprovacao !== 'REPROVADO') {
                await transaction.rollback();
                return res.status(400).json({ error: `O status atual '${pedido.status_aprovacao}' não permite aprovação. O pedido deve estar SUGERIDO ou REPROVADO.` });
            }

            await pedido.update({
                status_aprovacao: status_aprovacao,
                colaborador_id_aprovacao: colaborador_id_aprovacao,
                data_aprovacao: new Date(),
            }, { transaction });

            await transaction.commit();

            return res.status(200).json({
                message: `Pedido de Compra nº ${id} foi atualizado para: ${status_aprovacao}.`,
                pedido: pedido
            });

        } catch (error) {
            if (transaction) await transaction.rollback();
            console.error('❌ ERRO NA ATUALIZAÇÃO DO STATUS DO PEDIDO:', error);
            return res.status(500).json({ error: 'Erro ao atualizar status do pedido.', details: error.message });
        }
    }
    
    /**
     * Recebimento de Insumos: Registra a entrada de estoque, recalcula CMV e atualiza o status do item/pedido.
     * Rota: PATCH /api/v1/pedidos/:id/recebimento
     * @body { id_colaborador_recebimento, itens_recebidos: [...], nota_fiscal, centro_custo }
     */
    async receberInsumos(req, res) {
        const { id } = req.params;
        // 🔑 ADIÇÕES CRÍTICAS para Financeiro/Fiscal
        const { id_colaborador_recebimento, itens_recebidos, nota_fiscal, centro_custo } = req.body;

        if (!id_colaborador_recebimento || !itens_recebidos || itens_recebidos.length === 0 || !nota_fiscal || !centro_custo) {
            return res.status(400).json({ error: 'ID do Colaborador, itens recebidos, Nota Fiscal e Centro de Custo são obrigatórios.' });
        }

        const transaction = await connection.transaction();
        
        try {
            // 1. Busca o Pedido e bloqueia para transação
            const pedido = await PedidoCompra.findByPk(id, { transaction, lock: true });

            if (!pedido) {
                await transaction.rollback();
                return res.status(404).json({ error: 'Pedido de Compra não encontrado.' });
            }

            // 2. Regra de Negócio: Só é possível receber insumos de pedidos APROVADOS
            if (pedido.status_aprovacao !== 'APROVADO' && !pedido.status_aprovacao.includes('RECEBIDO')) {
                 await transaction.rollback();
                 return res.status(400).json({ error: `O Pedido nº ${id} não pode ser recebido. Status atual: ${pedido.status_aprovacao}.` });
            }

            let todosRecebidos = true;
            let valorTotalReal = 0; // 🔑 Acumulador do valor final
            
            // 3. Processa cada item recebido
            for (const itemRecebido of itens_recebidos) {
                const { id_item_pedido, quantidade_recebida, preco_unitario_real } = itemRecebido;

                const itemPedido = await ItemPedido.findByPk(id_item_pedido, { transaction, lock: true });

                if (!itemPedido) {
                    await transaction.rollback();
                    return res.status(404).json({ error: `Item de Pedido ${id_item_pedido} não encontrado.` });
                }
                
                const quantidadeAnterior = parseFloat(itemPedido.quantidade_recebida || 0);
                const qtdRecebida = parseFloat(quantidade_recebida);
                const precoReal = parseFloat(preco_unitario_real);

                const quantidadeTotalRecebida = quantidadeAnterior + qtdRecebida;
                const quantidadePedida = parseFloat(itemPedido.quantidade_pedida);

                // Acumula o valor total REAL para a transação financeira
                valorTotalReal += (qtdRecebida * precoReal); 

                // Validação de Recebimento Excessivo
                if (quantidadeTotalRecebida > quantidadePedida * 1.05) { // Permite 5% de tolerância
                    await transaction.rollback();
                    return res.status(400).json({ error: `Recebimento excessivo para o item ${itemPedido.id_produto}. Pedido: ${quantidadePedida}, Recebido total: ${quantidadeTotalRecebida}.` });
                }

                // 4. ATUALIZA ESTOQUE e CMV (Chama o método do ProdutoController)
                const produtoEntrada = await ProdutoController.receberEstoque({
                    params: { id: itemPedido.id_produto },
                    body: {
                        quantidade: qtdRecebida,
                        preco_custo: precoReal,
                        id_movimento_origem: id // O ID do PedidoCompra é a origem do movimento
                    }
                }, res, transaction); 
                
                if (produtoEntrada.error) { // Se o método de entrada de estoque falhar
                    await transaction.rollback();
                    return res.status(500).json(produtoEntrada);
                }

                // 5. Atualiza o status do Item do Pedido
                let statusRecebimento = 'PARCIAL';
                if (quantidadeTotalRecebida >= quantidadePedida) {
                    statusRecebimento = 'RECEBIDO';
                } else {
                    todosRecebidos = false;
                }

                await itemPedido.update({
                    quantidade_recebida: quantidadeTotalRecebida,
                    status_recebimento: statusRecebimento,
                    preco_unitario_negociado: precoReal // Registra o custo real
                }, { transaction });
            }

            // 6. 💰 CRÍTICO: Geração do Lançamento Financeiro (Despesa)
            // Nota: Este método deve ser implementado no LancamentoController.js
            await LancamentoController.createAutomaticLancamento({
                colaborador_id: id_colaborador_recebimento,
                tipo_lancamento: 'DESPESA',
                valor: valorTotalReal,
                descricao: `Despesa de Compra Pedido #${id} (NF: ${nota_fiscal}). Centro de Custo: ${centro_custo}.`,
                categoria: centro_custo, 
            }, transaction);

            // 7. 📄 CRÍTICO: Geração do Registro Fiscal
            await FiscalController.createAutomaticFiscalRecord({
                id_origem: id,
                tipo_origem: 'COMPRA',
                numero_documento: nota_fiscal,
                chave_acesso_nfe: null, 
                data_emissao: new Date(),
                valor_total_documento: valorTotalReal,
                imposto_simples: 0.00, 
            }, transaction);
            
            // 8. Atualiza o status e o valor real do Cabeçalho do Pedido
            let statusPedido = todosRecebidos ? 'FINALIZADO' : 'RECEBIDO_PARCIAL';
            
            await pedido.update({
                status_aprovacao: statusPedido,
                valor_total_real: valorTotalReal, 
                nota_fiscal: nota_fiscal,
            }, { transaction });

            await transaction.commit();

            return res.status(200).json({
                message: `Recebimento registrado com sucesso. Pedido nº ${id} atualizado para: ${statusPedido}.`,
                status_atual: statusPedido,
                valor_total_registrado: valorTotalReal.toFixed(2)
            });
            
        } catch (error) {
            if (transaction) await transaction.rollback();
            console.error('❌ ERRO NO RECEBIMENTO DE INSUMOS:', error);
            // Retorna o detalhe da falha (seja estoque, financeiro ou fiscal)
            const details = error.message.includes('Falha ao registrar') ? error.message : 'Erro na transação de recebimento.';
            return res.status(500).json({ error: 'Erro ao processar o recebimento de insumos.', details: details });
        }
    }
    
    // Método de listagem de pedidos (index) - Essencial para o painel do gestor
    async index(req, res) {
        // ... (código existente, está OK)
        const { status } = req.query; 

        const where = {};
        if (status) {
            where.status_aprovacao = status.toUpperCase();
        }

        try {
            const pedidos = await PedidoCompra.findAll({
                where,
                include: [
                    { model: Fornecedor, as: 'fornecedor', attributes: ['nome_fantasia'] },
                    { 
                        model: ItemPedido, 
                        as: 'itens', 
                        include: [
                            { model: Produto, as: 'produto', attributes: ['nome', 'unidade_medida'] }
                        ] 
                    }
                ],
                order: [['createdAt', 'DESC']],
            });

            return res.status(200).json(pedidos);

        } catch (error) {
            console.error('❌ ERRO AO LISTAR PEDIDOS:', error);
            return res.status(500).json({ error: 'Erro ao listar Pedidos de Compra.', details: error.message });
        }
    }
}

module.exports = new PedidoController();