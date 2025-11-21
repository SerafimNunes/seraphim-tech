// src/controllers/FichaTecnicaController.js

const FichaTecnica = require('../models/FichaTecnica');
const Produto = require('../models/Produto'); 
const { connection } = require('../config/sequelize'); // Necessário para Transações


// --- FUNÇÃO AUXILIAR: RECALCULA O CUSTO DA FICHA TÉCNICA (CUSTO MÉDIO DE PRODUÇÃO) ---
async function recalcularCustoFichaTecnica(idProdutoPai) {
    try {
        // 1. Busca todos os itens (insumos) da Ficha Técnica e os dados do Produto Filho (insumo)
        const composicao = await FichaTecnica.findAll({
            where: { id_produto_pai: idProdutoPai },
            // A associação é feita no FichaTecnica.js
            include: [{
                model: Produto,
                as: 'produto_filho',
                attributes: ['preco_custo_unitario'], // Pega o custo do insumo
            }],
        });

        let custoTotal = 0;

        // 2. Calcula o custo total: SUM(quantidade_necessaria * preco_custo_unitario)
        for (const item of composicao) {
            const qtd = parseFloat(item.quantidade_necessaria);
            // Pega o custo médio do insumo que está no estoque (tabela PRODUTOS)
            const custoInsumo = item.produto_filho ? parseFloat(item.produto_filho.preco_custo_unitario) : 0; 
            custoTotal += qtd * custoInsumo;
        }

        // 3. Atualiza o custo do Produto Pai (o produto que está sendo feito)
        await Produto.update(
            { preco_custo_unitario: custoTotal.toFixed(2) },
            { where: { id_produto: idProdutoPai } }
        );
        
        console.log(`✅ Custo da Ficha Técnica ID ${idProdutoPai} recalculado para R$ ${custoTotal.toFixed(2)}.`);

    } catch (error) {
        console.error('❌ ERRO AO RECALCULAR CUSTO DA FICHA TÉCNICA:', error.message);
    }
}
// --------------------------------------------------------------------------------------


class FichaTecnicaController {

    /**
     * Lista a composição (insumos/ingredientes) de um Produto Pai.
     * Rota: GET /api/v1/fichatecnica/pai/:id_produto_pai
     */
    async index(req, res) {
        const id = req.params.id_produto_pai; // Corrigido para ser consistente com a rota
        try {
            const produtoPai = await Produto.findByPk(id);

            if (!produtoPai) {
                return res.status(404).json({ error: 'Produto Pai (Vendável/Pré-Pronto) não encontrado.' });
            }

            const composicao = await FichaTecnica.findAll({
                where: { id_produto_pai: id },
                include: [{
                    model: Produto,
                    as: 'produto_filho', 
                    attributes: ['id_produto', 'nome', 'unidade_medida', 'preco_custo_unitario', 'is_vendavel', 'is_pre_pronto'], 
                }],
                attributes: ['id_ficha_tecnica', 'quantidade_necessaria', 'id_produto_filho'],
            });
            
            return res.status(200).json({
                produto_pai: {
                    id: produtoPai.id_produto,
                    nome: produtoPai.nome,
                    // Retorna o custo calculado automaticamente
                    custo_atual_producao: produtoPai.preco_custo_unitario, 
                },
                composicao: composicao
            });

        } catch (error) {
            console.error('❌ ERRO AO LISTAR COMPOSIÇÃO:', error);
            return res.status(500).json({ error: 'Erro ao listar a composição da Ficha Técnica.', details: error.message });
        }
    }


    /**
     * [NOVO/REVISADO] Cria ou Substitui a Ficha Técnica de um Produto (em Lote/Array)
     * Rota esperada pelo teste: POST /api/v1/fichatecnica/pai/:id_produto_pai
     */
    async storeOrUpdate(req, res) {
        const id_produto_pai = req.params.id_produto_pai;
        const insumos = req.body; // Espera um array de insumos: [{ id_produto_filho, quantidade_necessaria }, ...]

        const transaction = await connection.transaction();

        try {
            // 1. Validação de formato (deve ser um array)
            if (!Array.isArray(insumos)) {
                await transaction.rollback();
                return res.status(400).json({ error: 'O corpo da requisição deve ser um array de insumos.' });
            }

            // 2. Verificar se o produto pai existe
            const produtoPai = await Produto.findByPk(id_produto_pai, { transaction });
            if (!produtoPai) {
                await transaction.rollback();
                return res.status(404).json({ error: `Produto Pai (ID ${id_produto_pai}) não encontrado.` });
            }

            // 3. Deletar todos os itens da ficha técnica existentes para o produto pai
            // Isso garante que a nova lista substitua a antiga (REPLACE)
            await FichaTecnica.destroy({
                where: { id_produto_pai: id_produto_pai },
                transaction
            });

            // 4. Inserir os novos itens se houver insumos no array
            let createdItems = [];
            if (insumos.length > 0) {
                 // Validação e mapeamento
                const novosItens = insumos.map(item => {
                    // Validação de tipo e valor
                    if (!item.id_produto_filho || typeof item.quantidade_necessaria !== 'number' || item.quantidade_necessaria <= 0) {
                        // Isso será capturado no catch
                        throw new Error(`Insumo inválido ou quantidade_necessaria inválida para produto filho ID: ${item.id_produto_filho}.`);
                    }
                    
                    return {
                        id_produto_pai: id_produto_pai,
                        id_produto_filho: item.id_produto_filho,
                        quantidade_necessaria: item.quantidade_necessaria,
                    };
                });
                createdItems = await FichaTecnica.bulkCreate(novosItens, { transaction });
            }

            // 5. Recalcular o custo do produto pai (mesmo que a FT esteja vazia)
            // Se insumos for [] o custo será 0.00
            await recalcularCustoFichaTecnica(id_produto_pai);
            
            await transaction.commit();
            
            return res.status(201).json({
                message: `Ficha Técnica para ${produtoPai.nome} atualizada com sucesso.`,
                itens_processados: insumos.length,
                itens_criados: createdItems.length,
            });

        } catch (error) {
            await transaction.rollback();
            console.error('❌ ERRO AO ATUALIZAR FICHA TÉCNICA (Bulk):', error);
            // Verifica se o erro foi de validação
            if (error.message.includes('Insumo inválido')) {
                return res.status(400).json({ error: error.message });
            }
            return res.status(500).json({ error: 'Erro interno do servidor ao processar Ficha Técnica.', details: error.message });
        }
    }


    /**
     * Atualiza um item específico da Ficha Técnica (Quantidade).
     * Rota: PUT /api/v1/fichatecnica/item/:idItem
     */
    async updateItemFichaTecnica(req, res) {
        const { idItem } = req.params; 
        const { quantidade_necessaria } = req.body;

        if (!quantidade_necessaria || isNaN(quantidade_necessaria)) {
            return res.status(400).json({ error: 'O campo quantidade_necessaria é obrigatório e deve ser um número.' });
        }

        let transaction;
        try {
            transaction = await connection.transaction();

            const item = await FichaTecnica.findByPk(idItem, { transaction });

            if (!item) {
                await transaction.rollback();
                return res.status(404).json({ message: 'Item da Ficha Técnica não encontrado.' });
            }

            await item.update({
                quantidade_necessaria: quantidade_necessaria,
            }, { transaction });
            
            // Recalcula o custo após a atualização
            await recalcularCustoFichaTecnica(item.id_produto_pai); 

            await transaction.commit();
            
            return res.status(200).json({ 
                message: 'Item da Ficha Técnica atualizado com sucesso.', 
                data: item 
            });
        } catch (error) {
            if (transaction) await transaction.rollback();
            console.error('❌ ERRO AO ATUALIZAR ITEM DA FICHA TÉCNICA:', error);
            return res.status(500).json({ 
                message: 'Erro interno ao atualizar item da ficha técnica.', 
                error: error.message 
            });
        }
    }


    /**
     * Deleta um item específico da Ficha Técnica.
     * Rota: DELETE /api/v1/fichatecnica/item/:idItem
     */
    async deleteItemFichaTecnica(req, res) {
        const { idItem } = req.params; 

        let transaction;
        try {
            transaction = await connection.transaction();

            const item = await FichaTecnica.findByPk(idItem, { transaction });

            if (!item) {
                await transaction.rollback();
                return res.status(404).json({ message: 'Item da Ficha Técnica não encontrado.' });
            }
            
            const idFichaMae = item.id_produto_pai;

            await item.destroy({ transaction });

            // Recalcula o custo após a exclusão
            await recalcularCustoFichaTecnica(idFichaMae);
            
            await transaction.commit();

            return res.status(200).json({ 
                message: 'Item da Ficha Técnica removido com sucesso.',
                id_removido: idItem
            });
        } catch (error) {
            if (transaction) await transaction.rollback();
            console.error('❌ ERRO AO DELETAR ITEM DA FICHA TÉCNICA:', error);
            return res.status(500).json({ 
                message: 'Erro interno ao deletar item da ficha técnica.', 
                error: error.message 
            });
        }
    }

}

module.exports = new FichaTecnicaController();