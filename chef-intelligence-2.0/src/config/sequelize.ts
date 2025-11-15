// src/config/sequelize.ts

import { Sequelize } from "sequelize";
import dbConfig from "./database";

const environment = process.env.NODE_ENV || "development";
const config = dbConfig[environment]!;

export const connection: Sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  config as any
);

export async function connectToDatabase(): Promise<void> {
  try {
    await connection.authenticate();
    console.log(
      "✅ Conexão com o PostgreSQL (Sequelize) estabelecida com sucesso."
    );
  } catch (error: any) {
    console.error(
      "❌ ERRO CRÍTICO AO CONECTAR O BANCO DE DADOS:",
      error.message
    );
    throw new Error("Falha crítica na conexão com o banco de dados.");
  }
}
