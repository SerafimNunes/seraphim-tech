// Caminho: src/config/initialization.ts
// Lógica de Setup Inicial do DB e Garantia de Acesso de Superusuário

import { connection } from "../config/sequelize";
import Usuario from "../models/Usuario";
import Cargo from "../models/Cargo";
import { AuthService } from "../services/AuthService";

const authService = new AuthService();

/**
 * 🔑 R12 (RBAC): Garante a criação do Cargo SUPER_ADMIN e o Usuário temporário 'admin/admin'.
 */
async function ensureSuperUserSetup() {
  const defaultUnidadeId = 1; // 🔑 R4: ID da Unidade Padrão

  // 1. BUSCA O CARGO E O USUÁRIO (Lógica Idempotente)
  const existingAdmin = await Usuario.findOne({ where: { login: "admin" } });
  const superAdminCargo = await Cargo.findOne({
    where: { nome_cargo: "SUPER_ADMIN" },
  });

  if (!existingAdmin || !superAdminCargo) {
    if (!superAdminCargo) {
      console.log("[SETUP] Criando Cargo SUPER_ADMIN...");
      await Cargo.create({
        unidade_id: defaultUnidadeId,
        nome_cargo: "SUPER_ADMIN",
        is_super_admin: true,
      } as any);
    }

    if (!existingAdmin) {
      console.log("[SETUP] Criando Usuário de Acesso Único admin/admin...");
      await authService.createTemporarySuperUser(defaultUnidadeId);
      console.log(
        "[SETUP] Superusuário temporário criado com sucesso. Faça login com admin/admin."
      );
    }
  } else {
    console.log("[SETUP] Superusuário já existe. Pulando a criação.");
  }
}

/**
 * Função principal de inicialização do Banco de Dados e Modelos.
 * Chamada pelo index.ts
 */
export async function initializeDatabase(models: any) {
  try {
    console.log("Conectando e sincronizando modelos do DB...");

    // --- LÓGICA DE SINCRONIZAÇÃO SEQUENCIAL (REMOVIDA DAQUI, FOI PARA O INDEX.TS) ---
    // Aqui, faríamos connection.sync(), mas vamos delegar a sincronização
    // sequencial explícita ao index.ts, que já faz isso bem.

    // 🚨 Passo ÚNICO: Garante que o Superusuário exista após as tabelas essenciais (Cargo/Usuario) terem sido criadas.
    await ensureSuperUserSetup();

    console.log("✅ Setup Inicial concluído.");
  } catch (error) {
    console.error("❌ ERRO CRÍTICO no ensureSuperUserSetup:", error);
    throw error;
  }
}
