// src/seeds/adminSeeder.js

// 1. Carrega as variáveis de ambiente e o Express (opcional)
require('dotenv').config(); 

// 2. Importa a conexão e os modelos (isso garante que todos os modelos estejam carregados)
const { connectToDatabase, connection } = require('../config/sequelize'); 
const Colaborador = require('../models/Colaborador');

// Dados do super usuário de teste
const ADMIN_EMAIL = 'admin@chef.com';
const ADMIN_PASSWORD = '123456'; 

async function createAdminUser() {
    try {
        // 🔑 Await para garantir que a conexão e sincronização estejam completas
        await connectToDatabase(); 

        // 1. Verifica se o usuário já existe
        const existingAdmin = await Colaborador.findOne({ where: { email: ADMIN_EMAIL } });

        if (existingAdmin) {
            console.log(`\n⚠️ O Administrador (${ADMIN_EMAIL}) já existe. Pulando a criação.`);
            // Atualiza a senha (opcional, para garantir que o hook de hash seja chamado)
            existingAdmin.senha_hash = ADMIN_PASSWORD;
            await existingAdmin.save();
            console.log(`✅ Senha do Administrador (${ADMIN_EMAIL}) atualizada (hasheada).`);

        } else {
            // 2. Cria o novo usuário
            console.log(`\n⏳ Criando o Administrador de Teste: ${ADMIN_EMAIL}`);
            
            // O HOOK beforeSave no modelo Colaborador.js irá criptografar '123456'
            await Colaborador.create({
                nome: 'Administrador Teste',
                funcao: 'Gerente Geral',
                nivel_senioridade: 3,
                email: ADMIN_EMAIL,
                senha_hash: ADMIN_PASSWORD, // Isso será hasheado automaticamente
                ativo: true,
                custo_mensal_bruto: 5000.00,
            });

            console.log('✅ Administrador de Teste criado com sucesso! Credenciais: admin@chef.com / 123456');
        }

    } catch (error) {
        console.error('❌ ERRO no Seeder de Administrador:', error.message);
    } finally {
        // Encerra a conexão para liberar o processo do Node
        await connection.close();
        process.exit(); 
    }
}

createAdminUser();