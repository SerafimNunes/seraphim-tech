// src/services/AnaliseService.ts

import { Op, literal } from "sequelize";
// Os serviços de análise dependem da leitura de Venda, Estoque (CMP), Produção, etc.

interface KPIFilter {
  unidade_id: number; // R4: Filtro obrigatório
  data_inicio: Date;
  data_fim: Date;
}

export class AnaliseService {
  // --- MÉTODOS FINANCEIROS (R8, R10) ---

  /**
   * Calcula o Custo da Mercadoria Vendida (CMV) em tempo real.
   */
  public async getCMVRealTime(filter: KPIFilter): Promise<number> {
    // Lógica: Buscar VendaItem e multiplicar a quantidade vendida pelo CMP atual do Estoque.
    return 15000.5; // Mock
  }

  /**
   * Calcula a Margem de Contribuição Média Ponderada (MCMP).
   */
  public async getMCMP(filter: KPIFilter): Promise<number> {
    // Lógica: (Receita Total - CMV - Despesas Variáveis) / Receita Total
    const receita: number = 50000; // ✅ CORREÇÃO: Declarado explicitamente como 'number'
    const cmv = await this.getCMVRealTime(filter);
    const despesasVariaveis: number = 5000; // Declarado explicitamente como 'number'

    if (receita === 0) return 0; // Agora o TS aceita, pois 'receita' é tratada como 'number'
    const mcmp = (receita - cmv - despesasVariaveis) / receita;

    return parseFloat(mcmp.toFixed(4));
  }

  // --- MÉTODOS OPERACIONAIS (R7) ---

  /**
   * Calcula o percentual de desperdício em relação ao volume total de produção/compra (R7).
   */
  public async getIndiceDesperdicio(filter: KPIFilter): Promise<number> {
    // Lógica: Sum(Perdas em valor/volume) / Sum(Total Produzido/Comprado)
    const totalPerdido: number = 500;
    const totalMovimentado: number = 20000; // ✅ CORREÇÃO: Declarado explicitamente como 'number'

    if (totalMovimentado === 0) return 0; // Agora o TS aceita

    return parseFloat(((totalPerdido / totalMovimentado) * 100).toFixed(2));
  }
}
