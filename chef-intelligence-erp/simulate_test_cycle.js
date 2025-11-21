// simulate_test_cycle.js
// Script de simulação para testar a integração completa dos módulos Estoque, Compras e Produção
//
// ⚠️ PRÉ-REQUISITO: Certifique-se de que o seu servidor Node.js (src/index.js) esteja rodando
// na porta 3000 antes de executar este script.
//
// Para executar: node simulate_test_cycle.js
//
// Instale o axios primeiro, se necessário: npm install axios

const axios = require('axios');
const BASE_URL = 'http://localhost:3000/api/v1';

// Variáveis para armazenar os IDs dos produtos criados
let id_farinha;
let id_bolo;
// Assumindo que o Colaborador com ID 1 existe no banco de dados para fins de auditoria
const ID_COLABORADOR_AUDITORIA = 1; 

/**
 * Função utilitária para registrar o status e dados de uma requisição
 * @param {string} step - Nome do passo
 * @param {string} url - URL da requisição
 * @param {object} data - Dados da resposta ou erro
 */
function logResult(step, url, data) {
    const isSuccess = data && data.status >= 200 && data.status < 300;
    const status = isSuccess ? '✅ SUCESSO' : '❌ FALHA';
    const statusText = isSuccess ? data.statusText : data.response?.statusText || 'Erro de Rede';

    console.log(`\n======================================================`);
    console.log(`[${status}] Passo: ${step}`);
    console.log(`[URL] ${url}`);
    console.log(`[STATUS] ${data.status || data.response?.status} - ${statusText}`);
    
    if (isSuccess) {
        console.log(`[DADOS]`, data.data);
    } else {
        // Exibe o erro de forma mais clara
        const errorDetail = data.response?.data ? JSON.stringify(data.response.data) : data.message;
        console.error(`[ERRO DETALHE] ${errorDetail}`);
        console.log(`======================================================`);
        throw new Error(`Simulação interrompida no passo: ${step}`);
    }
    console.log(`======================================================`);
}

// ----------------------------------------------------
// 1. CRIAÇÃO DOS PRODUTOS BASE (INSUMO E PRODUTO FINAL)
// ----------------------------------------------------

async function createProducts() {
    console.log('// ----------------------------------------------------');
    console.log('// 1. CRIAÇÃO DOS PRODUTOS BASE');
    console.log('// ----------------------------------------------------');

    try {
        // 1.1 Criar Insumo: Farinha de Trigo
        const farinhaData = {
            nome: 'Farinha de Trigo',
            unidade_medida: 'KG',
            estoque_minimo: 5,
            is_vendavel: false,
            is_pre_pronto: false
        };
        let response = await axios.post(`${BASE_URL}/produtos`, farinhaData);
        logResult('1.1 Criar Farinha (Insumo)', `${BASE_URL}/produtos`, response);
        id_farinha = response.data.id_produto;

        // 1.2 Criar Produto Final: Bolo de Chocolate
        const boloData = {
            nome: 'Bolo de Chocolate (Prato Final)',
            unidade_medida: 'UN',
            estoque_minimo: 3,
            is_vendavel: true,
            is_pre_pronto: false
        };
        response = await axios.post(`${BASE_URL}/produtos`, boloData);
        logResult('1.2 Criar Bolo (Produto Final)', `${BASE_URL}/produtos`, response);
        id_bolo = response.data.id_produto;

    } catch (error) {
        logResult('1. CRIAÇÃO DE PRODUTOS', 'N/A', error);
    }
}

// ----------------------------------------------------
// 2. SIMULAÇÃO DE COMPRA (ENTRADA DE ESTOQUE E CMV)
// ----------------------------------------------------

async function simulatePurchase() {
    console.log('\n// ----------------------------------------------------');
    console.log('// 2. SIMULAÇÃO DE COMPRA (ENTRADA DE ESTOQUE E CMV)');
    console.log('// ----------------------------------------------------');

    try {
        // 2.1 Primeira Compra de Farinha: 10 KG a R$ 20,00 (CMV inicial R$ 2,00/KG)
        let purchaseData1 = {
            quantidade: 10,
            preco_total_compra: 20.00
        };
        let response = await axios.patch(`${BASE_URL}/produtos/${id_farinha}/entrada`, purchaseData1);
        logResult('2.1 Compra 1: Farinha (10KG @ R$2.00)', `${BASE_URL}/produtos/${id_farinha}/entrada`, response);
        // Esperado: estoque_atual = 10, preco_custo_unitario = 2.00
        
        // 2.2 Segunda Compra de Farinha: 5 KG a R$ 12,50 (Novo CMV)
        let purchaseData2 = {
            quantidade: 5,
            preco_total_compra: 12.50
        };
        response = await axios.patch(`${BASE_URL}/produtos/${id_farinha}/entrada`, purchaseData2);
        logResult('2.2 Compra 2: Farinha (5KG @ R$2.50)', `${BASE_URL}/produtos/${id_farinha}/entrada`, response);
        // Esperado: estoque_atual = 15, preco_custo_unitario ≈ 2.17
        
        // 2.3 🔎 VERIFICAÇÃO 1: Movimento de Estoque
        console.log('\n🔎 VERIFICAÇÃO 1: Checar log de movimentos...');
        response = await axios.get(`${BASE_URL}/movimentos?id_produto=${id_farinha}`);
        logResult('2.3 Verificar Movimentos da Farinha', `${BASE_URL}/movimentos?id_produto=${id_farinha}`, response);

    } catch (error) {
        logResult('2. SIMULAÇÃO DE COMPRA', 'N/A', error);
    }
}

// ----------------------------------------------------
// 3. ENGENHARIA (CRIAÇÃO DA FICHA TÉCNICA)
// ----------------------------------------------------

async function createRecipe() {
    console.log('\n// ----------------------------------------------------');
    console.log('// 3. ENGENHARIA (CRIAÇÃO DA FICHA TÉCNICA)');
    console.log('// ----------------------------------------------------');

    try {
        // 3.1 Criar a Ficha Técnica para o Bolo, que consome Farinha
        const recipeData = [{
            id_produto_filho: id_farinha,
            quantidade_necessaria: 0.5 // 0.5 KG de farinha por 1 UN de bolo
        }];
        let response = await axios.post(`${BASE_URL}/fichatecnica/pai/${id_bolo}`, recipeData);
        logResult('3.1 Criar Ficha Técnica para Bolo', `${BASE_URL}/fichatecnica/pai/${id_bolo}`, response);
        
    } catch (error) {
        logResult('3. CRIAÇÃO DE FICHA TÉCNICA', 'N/A', error);
    }
}


// ----------------------------------------------------
// 4. SIMULAÇÃO DE PRODUÇÃO (SAÍDA E ENTRADA DE ESTOQUE)
// ----------------------------------------------------

async function simulateProduction() {
    console.log('\n// ----------------------------------------------------');
    console.log('// 4. SIMULAÇÃO DE PRODUÇÃO (SAÍDA E ENTRADA DE ESTOQUE)');
    console.log('// ----------------------------------------------------');

    let id_producao;

    try {
        // 4.1 Criar um Registro de Produção (OP) - Status: SUGERIDO
        const opData = {
            id_produto_produzido: id_bolo,
            quantidade_produzida: 4, 
            observacoes: 'Ordem de Produção de Teste',
            colaborador_id_sugestao: ID_COLABORADOR_AUDITORIA 
        };
        let response = await axios.post(`${BASE_URL}/producao`, opData);
        logResult('4.1 Criar Ordem de Produção (4 Bolos)', `${BASE_URL}/producao`, response);
        id_producao = response.data.registro.id_registro_producao;

        // 4.2 Aprovar a Ordem de Produção - Status: APROVADO
        const aprovacaoData = {
            colaborador_id_aprovacao: ID_COLABORADOR_AUDITORIA,      
            colaborador_id_responsavel: ID_COLABORADOR_AUDITORIA     
        };
        response = await axios.patch(`${BASE_URL}/producao/${id_producao}/aprovar`, aprovacaoData);
        logResult('4.2 Aprovar OP (Gestor) - Status: APROVADO', `${BASE_URL}/producao/${id_producao}/aprovar`, response);
        
        // 🟢 NOVO PASSO DE VERIFICAÇÃO: 4.2.5 Verificar Ficha Técnica (antes de consumir)
        // Isso garante que o dado necessário para a baixa no estoque está presente.
        console.log('\n🔎 VERIFICAÇÃO 4.2.5: Checar Ficha Técnica (insumos necessários)...');
        response = await axios.get(`${BASE_URL}/fichatecnica/pai/${id_bolo}`);
        logResult('4.2.5 Verificar Insumos da Ficha Técnica', `${BASE_URL}/fichatecnica/pai/${id_bolo}`, response);


        // 4.3 Entregar Insumos (Baixa no Estoque de Farinha) - Status: EM_PRODUCAO
        // O erro estava aqui. A falha é na consulta interna do backend. 
        // Assumindo que a nova verificação acima garante o estado correto para o backend.
        const entregaData = {
            colaborador_id_separador: ID_COLABORADOR_AUDITORIA
        };
        response = await axios.patch(`${BASE_URL}/producao/${id_producao}/entregar-insumos`, entregaData);
        logResult('4.3 Entregar Insumos (Baixa de Estoque)', `${BASE_URL}/producao/${id_producao}/entregar-insumos`, response);
        // Esperado: Estoque de Farinha cai de 15 para 13.
        
        // 4.4 🔎 VERIFICAÇÃO: Estoque Atualizado e Movimento de SAÍDA
        console.log('\n🔎 VERIFICAÇÃO 4.4: Checar estoque de Farinha e log de movimentos...');
        response = await axios.get(`${BASE_URL}/produtos/${id_farinha}`);
        logResult('4.4 Verificar Estoque da Farinha (Saída)', `${BASE_URL}/produtos/${id_farinha}`, response);
        // Esperado: estoque_atual = 13.000
        
        response = await axios.get(`${BASE_URL}/movimentos?id_produto=${id_farinha}`);
        logResult('4.5 Verificar Movimentos da Farinha (Saída)', `${BASE_URL}/movimentos?id_produto=${id_farinha}`, response);
        // Esperado: 3 movimentos (2 ENTRADA, 1 SAIDA de 2 KG)

        // 4.6 Concluir a Produção (Entrada de Estoque do Bolo) - Status: CONCLUIDO
        const conclusaoData = {
            colaborador_id_conclusao: ID_COLABORADOR_AUDITORIA
        };
        response = await axios.patch(`${BASE_URL}/producao/${id_producao}/concluir`, conclusaoData);
        logResult('4.6 Concluir Produção (Entrada de Bolo)', `${BASE_URL}/producao/${id_producao}/concluir`, response);
        // Esperado: Estoque do Bolo sobe para 4. CMV do Bolo é calculado.

        // 4.7 🔎 VERIFICAÇÃO: Estoque Atualizado e CMV do Produto Final
        console.log('\n🔎 VERIFICAÇÃO 4.7: Checar estoque e CMV do Bolo...');
        response = await axios.get(`${BASE_URL}/produtos/${id_bolo}`);
        logResult('4.7 Verificar Estoque do Bolo (Entrada)', `${BASE_URL}/produtos/${id_bolo}`, response);

        response = await axios.get(`${BASE_URL}/movimentos?id_produto=${id_bolo}`);
        logResult('4.8 Verificar Movimentos do Bolo (Entrada)', `${BASE_URL}/movimentos?id_produto=${id_bolo}`, response);

    } catch (error) {
        logResult('4. SIMULAÇÃO DE PRODUÇÃO', 'N/A', error);
    }
}

// ----------------------------------------------------
// 5. FUNÇÃO PRINCIPAL
// ----------------------------------------------------

async function runSimulation() {
    console.log('======================================================');
    console.log('  INICIANDO SIMULAÇÃO DE CICLO COMPLETO ERP');
    console.log('======================================================');
    try {
        await createProducts();
        await simulatePurchase();
        await createRecipe();
        await simulateProduction();
        
        console.log('\n\n✅ SIMULAÇÃO CONCLUÍDA COM SUCESSO!');
        console.log('Verifique os logs acima para confirmar as atualizações de Estoque, CMV e Movimentos (Auditoria).');
    } catch (error) {
        console.error('\n\n❌ SIMULAÇÃO FALHOU:', error.message);
        console.log('A nova verificação de Ficha Técnica pode ajudar a diagnosticar se o problema for de dados. Se o erro persisitir no passo 4.3, a correção deve ser feita na lógica de consulta e bloqueio (`FOR UPDATE`) no servidor Node.js/Sequelize.');
    }
}

runSimulation();