// src/controllers/ProducaoController.js

const { connection } = require('../config/sequelize');
const Sequelize = require('sequelize');

// Modelos Necessários
const Produto = require('../models/Produto');
const RegistroProducao = require('../models/RegistroProducao');
const FichaTecnica = require('../models/FichaTecnica');
const RequisicaoInsumo = require('../models/RequisicaoInsumo');
const MovimentoEstoque = require('../models/MovimentoEstoque'); // Importado no topo para clareza

class ProducaoController {

    /**
     * Cria um novo Registro de Produção (Ordem de Produção) manual no status SUGERIDO.
     * Rota: POST /api/v1/producao
     * @body { id_produto_produzido, quantidade_produzida, colaborador_id_sugestao }
     */
    async store(req, res) {
        const { id_produto_produzido, quantidade_produzida, colaborador_id_sugestao } = req.body;

        if (!id_produto_produzido || !quantidade_produzida) {
            return res.status(400).json({ error: 'ID do Produto e Quantidade a produzir são obrigatórios.' });
        }

        try {
            // Verifica se o produto existe
            const produto = await Produto.findByPk(id_produto_produzido);

            if (!produto) {
                return res.status(404).json({ error: 'Produto a ser produzido não encontrado.' });
            }

            // Cria o registro inicial. O Custo Total será calculado na entrega dos insumos.
            const registro = await RegistroProducao.create({
                id_produto_produzido,
                quantidade_produzida: parseFloat(quantidade_produzida),
                // Se a sugestão foi manual, usa o ID do colaborador. Se veio do alerta, pode ser null.
                colaborador_id_sugestao: colaborador_id_sugestao || null,
                status_producao: 'SUGERIDO',
            });

            return res.status(201).json({
                message: `Ordem de Produção nº ${registro.id_registro_producao} criada manualmente e aguardando aprovação.`,
                registro
            });

        } catch (error) {
            console.error('❌ ERRO NA CRIAÇÃO DO REGISTRO DE PRODUÇÃO:', error);
            return res.status(500).json({ error: 'Erro ao criar o registro de produção.', details: error.message });
        }
    }

    /**
     * Listagem de Ordens de Produção (OP).
     * Rota: GET /api/v1/producao
     * @query { status_producao }
     */
    async index(req, res) {
        const { status_producao } = req.query;
        const where = {};

        if (status_producao) {
            where.status_producao = status_producao;
        }

        try {
            const registros = await RegistroProducao.findAll({
                where,
                // Assumindo 'produto_final' é o alias para a FK id_produto_produzido -> PRODUTOS
                include: [{ model: Produto, as: 'produto_final', attributes: ['nome', 'unidade_medida'] }],
                order: [['data_inicio', 'DESC'], ['id_registro_producao', 'DESC']]
            });

            return res.status(200).json({
                message: `${registros.length} Ordens de Produção encontradas.`,
                data: registros
            });

        } catch (error) {
            console.error('❌ ERRO NA LISTAGEM DE PRODUÇÃO:', error);
            return res.status(500).json({ error: 'Erro ao listar ordens de produção.', details: error.message });
        }
    }

    /**
     * Alerta de Produção: Lista Pré-Prontos ou Vendáveis abaixo do estoque mínimo.
     * Rota: GET /api/v1/producao/alerta
     */
    async suggestProduction(req, res) {
        try {
            // Busca produtos que são pré-prontos OU vendáveis E estão abaixo do mínimo
            const produtosEmAlerta = await Produto.findAll({
                attributes: ['id_produto', 'nome', 'estoque_atual', 'estoque_minimo', 'unidade_medida'],
                where: {
                    [Sequelize.Op.or]: [
                        { is_pre_pronto: true },
                        { is_vendavel: true }
                    ],
                    estoque_atual: {
                        [Sequelize.Op.lt]: Sequelize.col('estoque_minimo')
                    }
                },
                order: [['nome', 'ASC']]
            });

            if (produtosEmAlerta.length === 0) {
                return res.status(200).json({ message: "Nenhum produto precisa de produção imediata. Estoque está OK." });
            }

            const sugestao = produtosEmAlerta.map(produto => {
                const qtdFaltando = parseFloat(produto.estoque_minimo) - parseFloat(produto.estoque_atual);
                // Sugestão para cobrir a falta e reabastecer a metade do mínimo
                const qtdSugerida = qtdFaltando + (parseFloat(produto.estoque_minimo) / 2);

                return {
                    id_produto: produto.id_produto,
                    nome: produto.nome,
                    unidade_medida: produto.unidade_medida,
                    estoque_atual: parseFloat(produto.estoque_atual).toFixed(3),
                    estoque_minimo: parseFloat(produto.estoque_minimo).toFixed(3),
                    quantidade_sugerida: qtdSugerida.toFixed(3),
                };
            });

            return res.status(200).json({
                message: `${sugestao.length} itens precisam de produção. Ordem Sugerida.`,
                data: sugestao
            });

        } catch (error) {
            console.error('❌ ERRO NA SUGESTÃO DE PRODUÇÃO:', error);
            return res.status(500).json({ error: 'Erro ao gerar alerta de produção.', details: error.message });
        }
    }

    /**
     * Início da Produção: Aprova, designa responsável e gera a Requisição de Insumos.
     * Rota: PATCH /api/v1/producao/:id/aprovar
     * @body { colaborador_id_aprovacao, colaborador_id_responsavel }
     */
    async startProduction(req, res) {
        const { id } = req.params;
        const { colaborador_id_aprovacao, colaborador_id_responsavel } = req.body;

        if (!colaborador_id_aprovacao || !colaborador_id_responsavel) {
            return res.status(400).json({ error: 'ID do Aprovador e do Responsável são obrigatórios.' });
        }

        const transaction = await connection.transaction();

        try {
            const registro = await RegistroProducao.findByPk(id, { transaction, lock: true });

            if (!registro) {
                await transaction.rollback();
                return res.status(404).json({ error: 'Registro de Produção não encontrado.' });
            }

            if (registro.status_producao !== 'SUGERIDO') {
                await transaction.rollback();
                return res.status(400).json({ error: `O registro já está com status ${registro.status_producao}.` });
            }

            // 1. Atualiza o status do Registro de Produção
            await registro.update({
                status_producao: 'APROVADO',
                colaborador_id_aprovacao,
                colaborador_id_responsavel,
                data_inicio: new Date(),
            }, { transaction });

            // 2. Cria a Requisição de Insumos (O vale que será assinado pelo Estoquista e Cozinheiro)
            await RequisicaoInsumo.create({
                id_registro_producao: registro.id_registro_producao,
                colaborador_id_recebedor: colaborador_id_responsavel, // Pedro (Cozinheiro)
                status_requisicao: 'SOLICITADA',
            }, { transaction });

            await transaction.commit();

            return res.status(200).json({
                message: `Ordem de Produção nº ${id} APROVADA. Requisição de Insumos gerada para o Cozinheiro ${colaborador_id_responsavel}.`,
                registro: registro
            });

        } catch (error) {
            await transaction.rollback();
            console.error('❌ ERRO NA APROVAÇÃO DE PRODUÇÃO:', error);
            return res.status(500).json({ error: 'Erro ao aprovar e iniciar produção.', details: error.message });
        }
    }

    /**
     * Ação do Estoquista (João): Entrega dos insumos e Saída de Estoque (consumo).
     * Rota: PATCH /api/v1/producao/:id/entregar-insumos
     * @body { colaborador_id_separador }
     * NOTA: A Ficha Técnica (insumos necessários) é puxada automaticamente.
     */
    async deliverInsumos(req, res) {
        const { id } = req.params;
        const { colaborador_id_separador } = req.body; // Estoquista (João)

        if (!colaborador_id_separador) {
            return res.status(400).json({ error: 'ID do Estoquista (Separador) é obrigatório.' });
        }

        // Usando Serializável para garantir que nenhum outro processo altere o estoque durante a leitura/escrita
        const transaction = await connection.transaction({
            isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
        });

        try {
            const registro = await RegistroProducao.findByPk(id, {
                // CORREÇÃO: Adiciona required: true para forçar INNER JOIN (em vez de LEFT OUTER JOIN padrão)
                // Isso resolve o erro do PostgreSQL "FOR UPDATE não pode ser aplicado ao lado com valores nulos de um junção externa"
                include: [{ model: Produto, as: 'produto_final', required: true }],
                transaction,
                lock: true // Bloqueia o registro de produção
            });

            if (!registro || registro.status_producao !== 'APROVADO') {
                await transaction.rollback();
                return res.status(400).json({ error: 'Ordem de Produção não encontrada ou não está no status APROVADO.' });
            }

            // 1. Busca a Requisição de Insumos
            const requisicao = await RequisicaoInsumo.findOne({
                where: { id_registro_producao: id, status_requisicao: 'SOLICITADA' },
                transaction,
                lock: true // Bloqueia a requisição de insumos
            });

            if (!requisicao) {
                await transaction.rollback();
                return res.status(400).json({ error: 'Requisição de insumos não encontrada ou já foi entregue.' });
            }

            // 2. Busca a Ficha Técnica completa (o que precisa ser consumido)
            const insumosRequisitados = await FichaTecnica.findAll({
                where: { id_produto_pai: registro.id_produto_produzido },
                transaction 
            });

            if (insumosRequisitados.length === 0) {
                await transaction.rollback();
                return res.status(400).json({ error: 'Ficha Técnica não encontrada para o produto.' });
            }

            // CRÍTICO: IDs dos insumos necessários
            const insumoIds = insumosRequisitados.map(item => item.id_produto_filho);

            // 3. A CORREÇÃO: Buscar e Bloquear TODOS os Insumos em uma única query para evitar o N+1 e garantir o Lock SÓ para produtos existentes.
            const produtosInsumosLock = await Produto.findAll({
                where: { id_produto: insumoIds },
                attributes: ['id_produto', 'nome', 'estoque_atual', 'preco_custo_unitario', 'unidade_medida'],
                transaction,
                lock: true // Aplica o bloqueio a TODOS os insumos de uma vez (SELECT FOR UPDATE)
            });

            // Converte a lista para um mapa de fácil acesso (ID -> Produto)
            const produtosMap = produtosInsumosLock.reduce((map, produto) => {
                map[produto.id_produto] = produto;
                return map;
            }, {});

            let custoInsumos = 0;

            // 4. Consumo de Estoque (Saída de Insumos) - Agora iterando sobre a Ficha Técnica
            for (const item of insumosRequisitados) {
                const produtoInsumoLock = produtosMap[item.id_produto_filho];
                
                // Se o produto não estiver no mapa, significa que ele está na Ficha Técnica, mas não existe na tabela PRODUTOS.
                if (!produtoInsumoLock) {
                    await transaction.rollback();
                    // Agora, o erro de integridade de dados é capturado explicitamente com um erro 404/400.
                    return res.status(404).json({ error: `Falha de Integridade: Insumo (Produto ID ${item.id_produto_filho}) requisitado na Ficha Técnica não encontrado na tabela PRODUTOS.` });
                }

                const qtdNecessaria = parseFloat(item.quantidade_necessaria) * parseFloat(registro.quantidade_produzida);
                
                const estoqueAtual = parseFloat(produtoInsumoLock.estoque_atual);
                const custoUnitario = parseFloat(produtoInsumoLock.preco_custo_unitario);

                // Validação de Estoque (Dupla Segurança)
                if (estoqueAtual < qtdNecessaria) {
                    await transaction.rollback();
                    return res.status(400).json({ error: `Estoque insuficiente para ${produtoInsumoLock.nome}. Necessário: ${qtdNecessaria.toFixed(3)} ${produtoInsumoLock.unidade_medida}. Disponível: ${estoqueAtual.toFixed(3)}.` });
                }

                const novoEstoque = estoqueAtual - qtdNecessaria;
                const custoSaida = qtdNecessaria * custoUnitario;
                custoInsumos += custoSaida;

                // Atualiza o estoque do insumo (Saída)
                await Produto.update({
                    estoque_atual: novoEstoque
                }, {
                    where: { id_produto: produtoInsumoLock.id_produto },
                    transaction
                });

                // CRÍTICO: Log de Movimento de Estoque (Auditoria de Saída)
                await MovimentoEstoque.create({
                    id_produto: produtoInsumoLock.id_produto,
                    tipo_movimento: 'SAIDA',
                    quantidade: qtdNecessaria,
                    custo_movimento: custoSaida,
                    estoque_anterior: estoqueAtual,
                    estoque_atual: novoEstoque,
                    observacoes: `SAÍDA para OP #${registro.id_registro_producao} (Entrega de Insumos)`,
                }, { transaction });
            }

            // 5. Atualiza Requisição e Registro de Produção
            await requisicao.update({
                status_requisicao: 'ENTREGUE',
                colaborador_id_separador: colaborador_id_separador, // João
                data_entrega: new Date(),
            }, { transaction });

            await registro.update({
                status_producao: 'EM_PRODUCAO', // Pedro agora tem os insumos para produzir
                custo_total_producao: custoInsumos.toFixed(2), // Registra o custo dos insumos abatidos
            }, { transaction });

            await transaction.commit();

            return res.status(200).json({
                message: `Insumos para OP #${id} entregues e R$ ${custoInsumos.toFixed(2)} abatidos do estoque. Produção EM_PRODUCAO.`,
            });

        } catch (error) {
            await transaction.rollback();
            console.error('❌ ERRO NA ENTREGA DE INSUMOS:', error);
            return res.status(500).json({ error: 'Erro ao entregar insumos e dar baixa no estoque.', details: error.message });
        }
    }

    /**
     * Ação do Cozinheiro/Gestor: Finaliza a produção e adiciona o produto final ao estoque.
     * Rota: PATCH /api/v1/producao/:id/concluir
     * @body { colaborador_id_conclusao } // Adicionado para auditoria
     */
    async finishProduction(req, res) {
        const { id } = req.params;
        const { colaborador_id_conclusao } = req.body; // Recebendo ID de quem concluiu/confirmou

        if (!colaborador_id_conclusao) {
            return res.status(400).json({ error: 'ID do Colaborador de Conclusão é obrigatório para auditoria.' });
        }

        const transaction = await connection.transaction({
            isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
        });

        try {
            // 1. Busca o registro de produção e bloqueia (Lock)
            const registro = await RegistroProducao.findByPk(id, {
                // Não precisamos do include 'produto_final' aqui, pois faremos uma leitura lockada do Produto
                transaction,
                lock: true
            });

            if (!registro || registro.status_producao !== 'EM_PRODUCAO') {
                await transaction.rollback();
                return res.status(400).json({ error: 'Ordem de Produção não encontrada ou não está em produção (EM_PRODUCAO).' });
            }

            const qtdProduzida = parseFloat(registro.quantidade_produzida);
            const custoProducao = parseFloat(registro.custo_total_producao);

            if (custoProducao <= 0) {
                 await transaction.rollback();
                 // MENSAGEM AJUSTADA: Confirma que o controle de estoque de entrada é responsabilidade do Estoque
                 return res.status(400).json({ error: 'O custo de produção é zero. A ENTRADA de produto final no estoque não pode ser feita sem o consumo prévio dos insumos (SAÍDA DE ESTOQUE).' });
            }

            // ** 2. CRÍTICO: Leitura e Bloqueio do PRODUTO FINAL (Estoque)**
            const produtoFinalLock = await Produto.findByPk(registro.id_produto_produzido, { 
                attributes: ['id_produto', 'nome', 'unidade_medida', 'estoque_atual', 'preco_custo_unitario'],
                transaction, 
                lock: true 
            });
            
            if (!produtoFinalLock) {
                await transaction.rollback();
                return res.status(404).json({ error: 'Produto final não encontrado no estoque.' });
            }

            // 3. CÁLCULO DE CUSTO MÉDIO PONDERADO (CMV - Entrada)
            const estoqueAnterior = parseFloat(produtoFinalLock.estoque_atual);
            const custoMedioAnterior = parseFloat(produtoFinalLock.preco_custo_unitario);
            const custoTotalAnterior = estoqueAnterior * custoMedioAnterior;

            // Novo Custo Total = Custo Anterior + Custo dos Insumos (Produção)
            const novoCustoTotal = custoTotalAnterior + custoProducao;
            const novoEstoque = estoqueAnterior + qtdProduzida;

            // Calcula o novo Custo Médio (previne divisão por zero)
            const novoCustoMedio = novoEstoque > 0 ? novoCustoTotal / novoEstoque : 0;

            // 4. Atualiza o Produto Final (Entrada) - Responsabilidade do Estoque
            await Produto.update({
                estoque_atual: novoEstoque,
                preco_custo_unitario: novoCustoMedio.toFixed(2)
            }, {
                where: { id_produto: produtoFinalLock.id_produto },
                transaction
            });

            // 5. CRÍTICO: Log de Movimento de Estoque (Auditoria de Entrada) - Responsabilidade do Estoque
            await MovimentoEstoque.create({
                id_produto: produtoFinalLock.id_produto,
                tipo_movimento: 'ENTRADA',
                quantidade: qtdProduzida,
                custo_movimento: custoProducao, // Custo da entrada é o custo dos insumos
                estoque_anterior: estoqueAnterior,
                estoque_atual: novoEstoque,
                observacoes: `ENTRADA por OP #${registro.id_registro_producao} (Produto Concluído)`,
            }, { transaction });

            // 6. Finaliza o Registro de Produção - Responsabilidade da Produção
            await registro.update({
                status_producao: 'CONCLUIDO',
                data_conclusao: new Date(),
                colaborador_id_conclusao, // Adicionado para auditoria de quem concluiu
            }, { transaction });

            await transaction.commit();

            return res.status(200).json({
                message: `OP #${id} CONCLUÍDA. ${qtdProduzida} ${produtoFinalLock.unidade_medida} de ${produtoFinalLock.nome} adicionados ao estoque.`,
                novo_custo_medio: novoCustoMedio.toFixed(2),
            });

        } catch (error) {
            await transaction.rollback();
            console.error('❌ ERRO NA FINALIZAÇÃO DA PRODUÇÃO:', error);
            return res.status(500).json({ error: 'Erro ao concluir produção e adicionar ao estoque.', details: error.message });
        }
    }
    
    /**
     * 🔑 NOVO: Cancelamento/Rejeição de Produção: Altera o status para CANCELADO.
     * Rota: PATCH /api/v1/producao/:id/cancelar
     * @body { colaborador_id_cancelamento, observacoes }
     */
    async cancelProduction(req, res) {
        const { id } = req.params;
        const { colaborador_id_cancelamento, observacoes } = req.body;

        if (!colaborador_id_cancelamento) {
            return res.status(400).json({ error: 'ID do Colaborador de Cancelamento é obrigatório.' });
        }

        const transaction = await connection.transaction();

        try {
            const registro = await RegistroProducao.findByPk(id, { transaction, lock: true });

            if (!registro) {
                await transaction.rollback();
                return res.status(404).json({ error: 'Registro de Produção não encontrado.' });
            }

            // CRÍTICO: Não permite cancelamento se já houver consumo de estoque.
            if (registro.status_producao === 'EM_PRODUCAO' || registro.status_producao === 'CONCLUIDO') {
                await transaction.rollback();
                return res.status(400).json({ error: `Não é possível cancelar. A OP já está no status ${registro.status_producao} e insumos já foram entregues/consumidos. Use um ajuste manual de estoque, se necessário.` });
            }
            
            // 1. Atualiza o status do Registro de Produção
            await registro.update({
                status_producao: 'CANCELADO',
                colaborador_id_conclusao: colaborador_id_cancelamento, // Reutiliza campo para auditoria
                data_conclusao: new Date(), // Usa data_conclusao como data de cancelamento
                observacoes: `CANCELADA por: ${observacoes || 'Motivo não especificado.'}`,
            }, { transaction });

            // 2. Se a Requisição de Insumos existir (OP APROVADA), marca como CANCELADA
            const requisicao = await RequisicaoInsumo.findOne({
                where: { id_registro_producao: id, status_requisicao: 'SOLICITADA' },
                transaction,
            });

            if (requisicao) {
                await requisicao.update({
                    status_requisicao: 'CANCELADA',
                    data_entrega: new Date(),
                }, { transaction });
            }


            await transaction.commit();

            return res.status(200).json({
                message: `Ordem de Produção nº ${id} CANCELADA com sucesso.`,
                registro: registro
            });

        } catch (error) {
            await transaction.rollback();
            console.error('❌ ERRO NO CANCELAMENTO DE PRODUÇÃO:', error);
            return res.status(500).json({ error: 'Erro ao cancelar a ordem de produção.', details: error.message });
        }
    }
}

module.exports = new ProducaoController();