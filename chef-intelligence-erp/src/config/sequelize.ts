// src/config/sequelize.ts (Refatorado)

import { Sequelize } from 'sequelize';
// CRÍTICO: Importa o novo arquivo database.ts (padrão ES Module)
import dbConfig from './database'; 
// NOTA: A função applyAssociations não está mais neste arquivo, mas no associations.ts

// R1: Pega a configuração para o ambiente 'development' (ou o que estiver no NODE_ENV)
const environment = process.env.NODE_ENV || 'development';
// Pega o objeto de configuração específico do ambiente
const config = dbConfig[environment];

// R1: Cria e tipa a instância do Sequelize. Exportamos a conexão (R1)
// Usamos o tipo 'Sequelize' importado, e forçamos 'any' em 'config' para evitar quebra devido à tipagem incompleta do Sequelize
export const connection: Sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    // Passamos o objeto de configuração completo
    config as any // 'as any' para evitar erro de tipagem de terceiros (Sequelize Options)
);

/**
 * Função assíncrona que estabelece a conexão e sincroniza os modelos com o DB.
 * É a função de inicialização do Banco de Dados.
 */
export async function connectToDatabase(): Promise<void> {
    try {
        // 1. Autentica a conexão
        await connection.authenticate();
        console.log('✅ Conexão com o PostgreSQL (Sequelize) estabelecida com sucesso.');
    
        // 2. Sincroniza todos os modelos registrados (cria/altera tabelas)
        await connection.sync({ alter: true }); 
        console.log('✅ Modelos (tabelas) sincronizados com o banco de dados.');

    } catch (error: any) {
        // Captura o erro e encerra o servidor (ou tenta reconectar)
        console.error('❌ ERRO CRÍTICO AO CONECTAR/SINCRONIZAR O BANCO DE DADOS:', error.message);
        throw new Error('Falha crítica na conexão com o banco de dados.');
    }
}

// 🔑 Exporta a conexão e a função de inicialização
// A função applyAssociations está agora em associations.ts, mantendo a responsabilidade única.