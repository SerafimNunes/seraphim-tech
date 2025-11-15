// src/config/database.ts

import "dotenv/config";
import { Options } from "sequelize";

// R1: Interface para garantir a tipagem do objeto de configuração
interface IDatabaseConfig extends Options {
  username: string;
  password: string;
  database: string;
  host: string;
  dialect: "postgres";
}

interface IConfig {
  [env: string]: IDatabaseConfig;
}

const config: IConfig = {
  development: {
    username: process.env.DB_USER!,
    password: process.env.DB_PASS!,
    database: process.env.DB_NAME!,
    host: process.env.DB_HOST!,
    dialect: "postgres",
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
    logging: false,
    schema: "public",
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  } as IDatabaseConfig,
};

export default config;
