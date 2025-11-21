// src/controllers/VendaController.js

const { connection } = require('../config/sequelize');
const Sequelize = require('sequelize');

// Modelos Críticos
const Mesa = require('../models/Mesa');
const Venda = require('../models/Venda');
const ItemVenda = require('../models/ItemVenda');
const Produto = require('../models/Produto');
const FichaTecnica = require('../models/FichaTecnica');
const MovimentoEstoque = require('../models/MovimentoEstoque');
// 🔑 NOVO IMPORT CRÍTICO: Modelo para o Registro Fiscal
const RegistroFiscal = require('../models/RegistroFiscal'); 


class VendaController {

    /**
     * Inicia uma nova Venda/Comanda (se id_venda for nulo) ou adiciona itens a uma Venda existente.
     * CRÍTICO: Executa a baixa imediata de estoque (CMV) em uma transação.
     * Rota: POST /api/v1/vendas/pedido
     * @body { id_venda, id_mesa, colaborador_id, itens: [{ id_produto, quantidade, preco_unitario }] }
     */
    async lancarPedido(req, res) {
        const { id_venda, id_mesa, colaborador_id, itens } = req.body;

        if (!colaborador_id || !itens || itens.length === 0) {
            return res.status(400).json({ error: 'ID do colaborador e itens do pedido são obrigatórios.' });
        }

        // Transação com isolamento serializável para estoque e CMV
        const transaction = await connection.transaction({ 
            isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE 
        });

        try {
            let venda;

            // 1. Checa se é um novo pedido ou continuação de um existente
            if (id_venda) {
                venda = await Venda.findByPk(id_venda, { transaction, lock: true });
                if (!venda || venda.status_venda !== 'ABERTA') {
                    await transaction.rollback();
                    return res.status(404).json({ error: 'Venda não encontrada ou já está fechada.' });
                }
            } else {
                // Abre nova Venda e, se for de mesa, atualiza o status da mesa
                let mesaAtual;
                if (id_mesa) {
                    // Bloqueia a mesa para evitar que outro garçom a pegue
                    mesaAtual = await Mesa.findByPk(id_mesa, { transaction, lock: true });
                    if (!mesaAtual || mesaAtual.status_mesa !== 'LIVRE') {
                        await transaction.rollback();
                        return res.status(400).json({ error: 'Mesa ocupada ou indisponível.' });
                    }
                }

                venda = await Venda.create({
                    id_mesa,
                    colaborador_id_abertura: colaborador_id,
                    status_venda: 'ABERTA',
                    valor_total: 0.00,
                    custo_total: 0.00,
                }, { transaction });

                if (mesaAtual) {
                    await mesaAtual.update({
                        status_mesa: 'OCUPADA',
                        id_venda_atual: venda.id_venda,
                        colaborador_id_responsavel: colaborador_id,
                        data_abertura: new Date(),
                    }, { transaction });
                }
            }

            // 2. Processa cada item do pedido
            let valorTotalVenda = parseFloat(venda.valor_total);
            let custoTotalVenda = parseFloat(venda.custo_total);

            for (const item of itens) {
                const { id_produto, quantidade, preco_unitario } = item;

                // 2.1 Bloqueia o produto e calcula o CMV (Custo de Saída)
                const produto = await Produto.findByPk(id_produto, { transaction, lock: true });

                if (!produto || !produto.is_vendavel) {
                    await transaction.rollback();
                    return res.status(400).json({ error: `Produto ID ${id_produto} não é vendável ou não existe.` });
                }
                
                // Custo de Saída (CMV) = Quantidade * Custo Médio Ponderado Atual
                const custo_saida_unitario = parseFloat(produto.preco_custo_unitario);
                const custo_total_item = quantidade * custo_saida_unitario;

                // 2.2 Cria o ItemVenda
                await ItemVenda.create({
                    id_venda: venda.id_venda,
                    id_produto,
                    quantidade,
                    preco_unitario,
                    preco_venda_total: quantidade * preco_unitario,
                    custo_total: custo_total_item.toFixed(2), // Registra o CMV no item
                    status_item: 'ABERTO', 
                }, { transaction });

                // 2.3 Atualiza o Estoque (Baixa Imediata) e registra Movimento
                const estoque_anterior = parseFloat(produto.estoque_atual);
                const novo_estoque = estoque_anterior - quantidade;

                if (novo_estoque < 0) {
                     // Lógica para quebrar a ficha técnica e dar baixa nos insumos
                     // Não implementada aqui, mas a base de dados a suporta
                    // Por simplicidade, vamos garantir que o produto principal tenha estoque
                    await transaction.rollback();
                    return res.status(400).json({ error: `Estoque insuficiente para o produto ID ${id_produto}. Requer ${quantidade}, tem ${estoque_anterior}.` });
                }

                await produto.update({
                    estoque_atual: novo_estoque
                }, { transaction });

                await MovimentoEstoque.create({
                    id_produto,
                    tipo_movimento: 'SAIDA',
                    quantidade,
                    custo_movimento: custo_total_item.toFixed(2),
                    estoque_anterior,
                    estoque_atual: novo_estoque,
                    observacoes: `SAÍDA por Venda ID ${venda.id_venda}`,
                }, { transaction });
                
                // 2.4 Acumula totais da venda
                valorTotalVenda += (quantidade * preco_unitario);
                custoTotalVenda += custo_total_item;
            }

            // 3. Atualiza o cabeçalho da Venda com os novos totais de Venda e Custo
            await venda.update({
                valor_total: valorTotalVenda.toFixed(2),
                custo_total: custoTotalVenda.toFixed(2),
            }, { transaction });

            await transaction.commit();

            return res.status(200).json({
                message: `Pedido lançado com sucesso. Venda ID ${venda.id_venda} atualizada.`,
                venda: venda,
                itens_adicionados: itens.length
            });

        } catch (error) {
            await transaction.rollback();
            console.error('❌ ERRO NO LANÇAMENTO DO PEDIDO:', error);
            return res.status(500).json({ error: 'Erro ao lançar pedido e atualizar estoque.', details: error.message });
        }
    }

    /**
     * Fecha a Venda/Comanda (Finaliza o pagamento, registra o fiscal e libera a mesa).
     * Rota: PATCH /api/v1/vendas/:id/fechar
     * @body { metodo_pagamento, colaborador_id_fechamento, id_caixa }
     */
    async fecharVenda(req, res) {
        const { id } = req.params;
        const { metodo_pagamento, colaborador_id_fechamento, id_caixa } = req.body;

        if (!metodo_pagamento || !colaborador_id_fechamento || !id_caixa) {
            return res.status(400).json({ error: 'Método de pagamento, ID do colaborador de fechamento e ID do caixa são obrigatórios.' });
        }

        const transaction = await connection.transaction();
        try {
            // 1. Localiza a Venda para update (com lock para segurança, se necessário)
            const venda = await Venda.findByPk(id, { transaction, lock: true });

            if (!venda || venda.status_venda !== 'ABERTA') {
                await transaction.rollback();
                return res.status(404).json({ error: 'Venda não encontrada ou já está fechada/cancelada.' });
            }

            // 1.1 Atualiza a Venda para 'FECHADA'
            await venda.update({
                status_venda: 'FECHADA',
                data_fechamento: new Date(),
                metodo_pagamento,
                colaborador_id_fechamento,
                id_caixa // CRÍTICO: Associa a venda ao Caixa para o Fechamento de Caixa
            }, { transaction });

            // 2. Libera a Mesa (se for venda de mesa)
            if (venda.id_mesa) {
                const mesa = await Mesa.findByPk(venda.id_mesa, { transaction, lock: true });
                if (mesa) {
                    await mesa.update({
                        status_mesa: 'LIVRE',
                        id_venda_atual: null,
                        colaborador_id_responsavel: null,
                        data_abertura: null,
                    }, { transaction });
                }
            }
            
            // 3. 🔑 CRÍTICO: Registra o Documento Fiscal de Saída (VENDA)
            // Este registro é essencial para a auditoria de faturamento e BI.
            await RegistroFiscal.create({
                id_origem: venda.id_venda,
                tipo_origem: 'VENDA',
                numero_documento: `VENDA-${venda.id_venda}`, // Numeração interna sequencial para auditoria
                data_emissao: new Date(),
                valor_total_documento: venda.valor_total,
                // Assumindo 4% de imposto (Exemplo: Alíquota de Simples Nacional para Restaurantes)
                imposto_simples: (parseFloat(venda.valor_total) * 0.04).toFixed(2),
                cst_cfop_padrao: '5102', // Venda de Mercadoria Adquirida ou Recebida de Terceiros
                observacoes_fisco: `Registro Fiscal gerado automaticamente na conclusão da Venda ID ${venda.id_venda}.`,
            }, { transaction });

            // 4. Confirma a transação
            await transaction.commit();

            return res.status(200).json({
                message: `Venda #${id} fechada com sucesso. Valor total: R$ ${venda.valor_total}.`,
                venda: venda
            });

        } catch (error) {
            await transaction.rollback();
            console.error('❌ ERRO NA FINALIZAÇÃO DA VENDA:', error);
            return res.status(500).json({ error: 'Erro ao fechar a venda.', details: error.message });
        }
    }
    
    // ... outros métodos de listagem e utilitários da classe ...

}

module.exports = new VendaController();