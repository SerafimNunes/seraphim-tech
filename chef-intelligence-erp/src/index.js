// src/index.js (Versão Corrigida e Completa)

require('dotenv').config(); 
const express = require('express');

// 1. Importa a conexão (instância Sequelize) e a função de conexão
const { connectToDatabase, connection } = require('./config/sequelize'); 
// 2. Importa a função que aplica as associações
const { applyAssociations } = require('./config/associations'); 

// 🔑 CARREGAMENTO CRÍTICO DE TODOS OS MODELOS:
// Isso registra os modelos na instância Sequelize (connection) antes de aplicar as associações.
// modelos do Estoque
require('./models/Produto');
require('./models/FichaTecnica');
require('./models/ContagemEstoque');
require('./models/MovimentoEstoque');
require('./models/RegistroPerda');
// modelos de Compras
require('./models/Fornecedor');         
require('./models/PedidoCompra');      
require('./models/ItemPedido');        
require('./models/RegistroProducao'); 
require('./models/RequisicaoInsumo'); 
// modelos do PDV
require('./models/Mesa');
require('./models/Venda');
require('./models/ItemVenda');
// modelos do Financeiro/Fiscal
require('./models/Caixa');
require('./models/Lancamento');
require('./models/RegistroFiscal');
// modelos de Recursos Humanos
require('./models/Colaborador');
require('./models/Escala');

// Importa as rotas
const produtoRoutes = require('./routes/produtoRoutes');
const fichaTecnicaRoutes = require ('./routes/fichaTecnicaRoutes');
const contagemRoutes = require('./routes/contagemRoutes'); 
const movimentoRoutes = require('./routes/movimentoRoutes'); 
const pedidoRoutes = require('./routes/pedidoRoutes'); 
const producaoRoutes = require('./routes/producaoRoutes'); 
const vendaRoutes = require('./routes/vendaRoutes');
const caixaRoutes = require('./routes/caixaRoutes');
const rhRoutes = require('./routes/rhRoutes');
const fiscalRoutes = require('./routes/fiscalRoutes');
const biRoutes = require('./routes/biRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();

const cors = require('cors');

// 1. CONFIGURAÇÃO DE CORS
app.use(cors({
    origin: 'http://localhost:5173', // Permite APENAS o frontend local acessar o backend
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
}));

// ... (resto da função startServer)

const port = process.env.SERVER_PORT || 3000;

app.use(express.json());

// --- Lógica de Inicialização Assíncrona e Segura ---
(async () => {
    try {
        // 1. Conecta-se ao banco de dados e sincroniza os modelos
        // NOTE: Isso deve ser aguardado (await)
        await connectToDatabase(); 

        // 2. Aplica as associações/relacionamentos entre todos os modelos
        // Se um modelo precisar de outro, ele estará aqui.
        applyAssociations(connection.models); 

        // 3. Define e usa as rotas
        app.use('/api/v1', produtoRoutes); 
        app.use('/api/v1', fichaTecnicaRoutes);
        app.use('/api/v1', contagemRoutes);
        app.use('/api/v1', movimentoRoutes);
        app.use('/api/v1', pedidoRoutes);
        app.use('/api/v1', producaoRoutes);
        app.use('/api/v1', vendaRoutes);
        app.use('/api/v1', caixaRoutes);
        app.use('/api/v1', rhRoutes);
        app.use('/api/v1', fiscalRoutes);
        app.use('/api/v1', biRoutes);
        app.use('/api/v1', authRoutes);

        // Rota de teste
        app.get('/', (req, res) => {
            res.status(200).json({ message: "Chef Intelligence ERP Backend Rodando! Status: OK" });
        });

        // 4. Inicia o Servidor
        // NOTA: O console.log aqui será executado primeiro por causa do await acima.
        // O log "Servidor rodando..." agora só aparecerá DEPOIS que a conexão e associações terminarem.
        app.listen(port, () => {
            // Este log será o ÚLTIMO a aparecer, confirmando o sucesso total.
            console.log(`Servidor rodando na porta ${port}`);
        });

    } catch (error) {
        console.error('❌ ERRO CRÍTICO NA INICIALIZAÇÃO DO SERVIDOR:', error);
        // Em caso de falha na conexão ou associações, o processo deve ser encerrado.
        process.exit(1); 
    }
})();
// --- Fim da Lógica de Inicialização Assíncrona ---