// src/services/PlanejamentoService.ts
import ItemEstoque, { ItemEstoqueModel } from "../models/ItemEstoque";
import { connection } from "../config/sequelize";
import { Op } from "sequelize";

/**
 * Interface para o DTO (Data Transfer Object) de Necessidade de Reposição.
 * Define o formato dos dados de saída do Service.
 */
interface NecessidadeItem {
  id_item: number;
  nome: string;
  unidade_medida: string;
  estoque_atual: number;
  // 🛑 CORRIGIDO: Nome da propriedade agora é 'pronto_pedido' (com 'r')
  pronto_pedido: number;
  necessidade: number; // Quantidade a ser comprada/produzida
  tipo_movimentacao: "COMPRA" | "PRODUCAO";
}

/**
 * Interface para os filtros de busca no Planejamento.
 */
interface PlanejamentoFilter {
  unidade_id: number; // R4: Segregação obrigatória
}

export class PlanejamentoService {
  /**
   * (GSI 1.E, 1.F) Implementa a lógica para calcular os itens que estão abaixo
   * do ponto de pedido (Pronto Pedido).
   *
   * @param filter Filtros de segregação de dados (ex: unidade_id).
   * @returns Uma lista de itens com a necessidade de reposição calculada.
   */
  public async gerarListaNecessidade(
    filter: PlanejamentoFilter
  ): Promise<NecessidadeItem[]> {
    try {
      // 1. Buscar todos os itens de estoque para a unidade (R4) que possuem Ponto de Pedido definido
      const itens = await ItemEstoque.findAll({
        // (GSI 1.F) Interação direta com o modelo
        where: {
          unidade_id: filter.unidade_id,
          // 🛑 CORRIGIDO: Usa 'pronto_pedido' na cláusula WHERE
          pronto_pedido: { [Op.gt]: 0 }, // Deve ter um ponto de pedido maior que zero
        },
      });

      const listaNecessidade: NecessidadeItem[] = [];

      // 2. Aplicar a lógica do Ponto de Pedido (PP)
      for (const item of itens) {
        // 🛑 CORRIGIDO: Usa 'pronto_pedido' na lógica de comparação
        if (item.saldo_atual < item.pronto_pedido) {
          // 🛑 CORRIGIDO: Usa 'pronto_pedido' no cálculo da necessidade
          const necessidade = item.pronto_pedido - item.saldo_atual;

          // Determina se a reposição deve ser por COMPRA (Ingrediente) ou PRODUCAO (Pré-Pronto/Final)
          const tipoMovimentacao =
            item.tipo_item === "INGREDIENTE" ? "COMPRA" : "PRODUCAO";

          listaNecessidade.push({
            id_item: item.id_item,
            nome: item.nome,
            unidade_medida: item.unidade_medida,
            estoque_atual: item.saldo_atual,
            // 🛑 CORRIGIDO: Popula o DTO com 'pronto_pedido'
            pronto_pedido: item.pronto_pedido,
            necessidade: necessidade,
            tipo_movimentacao: tipoMovimentacao,
          });
        }
      }

      return listaNecessidade;
    } catch (error) {
      console.error(
        "[PlanejamentoService] Erro ao gerar lista de necessidades:",
        error
      );
      // Lança o erro para que o Controller trate o status HTTP (GSI 1.E)
      throw new Error("Falha ao gerar lista de necessidades. Tente novamente.");
    }
  }

  /**
   * (Placeholder) - Registra uma nova compra/produção necessária
   * a partir da lista gerada.
   */
  public async registrarNecessidadeGerada(
    necessidade: NecessidadeItem[]
  ): Promise<void> {
    // Lógica futura: Criar registros em IProducaoNecessidade e ICompraNecessidade
    console.log(
      `[PlanejamentoService] Registrando ${necessidade.length} necessidades...`
    );
    // Aqui se integraria com ComprasService e ProducaoService para criar os pedidos reais.
  }
}
