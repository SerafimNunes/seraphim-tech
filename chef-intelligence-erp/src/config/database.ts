// src/config/database.ts (CORRIGIDO)

import 'dotenv/config'; 
import { Options } from 'sequelize'; 

// R1: Interface para garantir a tipagem da configuração
interface IDatabaseConfig extends Options {
    // Definimos como obrigatório para corresponder à garantia do operador !
    username: string; 
    password: string;
    database: string;
    host: string;
}

interface IConfig {
    [env: string]: IDatabaseConfig;
}

const config: IConfig = {
    development: {
        // CORREÇÃO CRÍTICA: Uso do operador de Não-Nulo (!) para forçar a tipagem 'string'
        username: process.env.DB_USER!, 
        password: process.env.DB_PASS!,
        database: process.env.DB_NAME!,
        host: process.env.DB_HOST!,
        dialect: 'postgres', 
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432, 
        logging: false, 
        pool: { 
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
    } as IDatabaseConfig, 
};

export default config;