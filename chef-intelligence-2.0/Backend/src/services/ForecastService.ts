import { connection } from "../config/sequelize";
import { Op } from "sequelize";
// 🔑 R1: Importa o RHService para tipagem da injeção
import { RHService } from "./RHService";

// --- Interface para Previsão ---

// Payload de entrada para o Service (O que o gestor/sistema envia)
interface ForecastInput {
  unidade_id: number;
  dias_previsao: number;
  dias_historico: number;
}

// DTO de saída: Previsão de Demanda por Produto Final
export interface DemandaPrevistaItem {
  id_produto: number;
  nome_produto: string;
  unidade_medida: string;
  quantidade_prevista: number;
}

export class ForecastService {
  // 🔑 Injeção de Dependência Tardia (Circular)
  private rhService!: RHService;

  /**
   * 🔑 Setter para Injeção de Dependência (Resolve erro 'setRHService' no index.ts)
   */
  public setRHService(rhService: RHService): void {
    this.rhService = rhService;
  }

  /**
   * 🎯 R11: Gera a previsão de vendas futura usando o método da Média Móvel Simples (MMS).
   * A MMS é o modelo mais básico, mas funcional para iniciar a automação.
   */
  public async gerarForecastVendas(
    payload: ForecastInput
  ): Promise<DemandaPrevistaItem[]> {
    const { unidade_id, dias_previsao, dias_historico } = payload;

    const dataFim = new Date();
    const dataInicio = new Date();
    dataInicio.setDate(dataFim.getDate() - dias_historico);

    // 🔑 Consulta otimizada: Agrega a soma das quantidades vendidas por produto dentro do período
    const volumesVendidos = (await connection.query(
      `
      -- 🔑 R4: Filtra por unidade_id e R1: A soma de 'quantidade' usa tipagem rígida no retorno
      SELECT
        "VI"."id_produto",
        "IE"."nome" AS nome_produto,
        "IE"."unidade_medida" AS unidade_medida,
        SUM("VI"."quantidade") AS total_vendido
      FROM "VENDA_ITENS" AS "VI"
      INNER JOIN "PRODUTOS" AS "IE" ON "VI"."id_produto" = "IE"."id_produto"
      WHERE
        "VI"."unidade_id" = :unidade_id
        AND "VI"."createdAt" BETWEEN :dataInicio AND :dataFim
        AND "IE"."is_vendavel" = TRUE -- Apenas produtos que são vendidos
      GROUP BY
        "VI"."id_produto", "IE"."nome", "IE"."unidade_medida"
      `,
      {
        replacements: { unidade_id, dataInicio, dataFim },
        type: "SELECT",
      }
    )) as {
      id_produto: number;
      nome_produto: string;
      unidade_medida: string;
      total_vendido: string;
    }[];

    // 2. Cálculo da Média Móvel Simples (MMS) e Projeção
    const resultadoForecast: DemandaPrevistaItem[] = volumesVendidos.map(
      (item) => {
        const totalVendido = parseFloat(item.total_vendido);

        // Média Diária = Total Vendido / Dias de Histórico
        const mediaDiaria = totalVendido / dias_historico;

        // Previsão = Média Diária * Dias de Previsão (Projeção para o próximo ciclo)
        const quantidade_prevista = mediaDiaria * dias_previsao;

        return {
          id_produto: item.id_produto,
          nome_produto: item.nome_produto,
          unidade_medida: item.unidade_medida,
          // R1: Tipagem Rígida - Arredonda a previsão para 2 casas decimais
          quantidade_prevista: parseFloat(quantidade_prevista.toFixed(2)),
        };
      }
    );

    return resultadoForecast;
  }
}