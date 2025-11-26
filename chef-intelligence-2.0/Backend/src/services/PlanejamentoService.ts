// src/services/PlanejamentoService.ts

import ItemEstoque, { ItemEstoqueModel } from "../models/ItemEstoque";
import { connection } from "../config/sequelize";
import { Op, literal } from "sequelize";

// 🔑 NOVOS IMPORTS: Services que este Service irá orquestrar
import { ForecastService } from "./ForecastService";
import { FichaTecnicaService } from "./FichaTecnicaService";

/**
 * Interface para o DTO (Data Transfer Object) de Necessidade de Reposição.
 * Define o formato dos dados de saída do Service.
 */
interface NecessidadeItem {
  id_item: number;
  nome: string;
  unidade_medida: string;
  estoque_atual: number;
  pronto_pedido: number;
  necessidade: number; // Quantidade a ser comprada/produzida (Calculada pelo R11)
  tipo_movimentacao: "COMPRA" | "PRODUCAO";
}

/**
 * Interface para os filtros de busca no Planejamento.
 */
interface PlanejamentoFilter {
  unidade_id: number; // R4: Segregação obrigatória
}

export class PlanejamentoService {
  // 🔑 Propriedades para Injeção de Dependência
  private forecastService: ForecastService;
  private fichaTecnicaService: FichaTecnicaService;
  // ... (outras injeções, se houver)

  // 🔑 CONSTRUTOR CORRIGIDO: Implementando Injeção de Dependência Limpa
  // Note: Ele RECEBE os serviços, e o index.ts os cria e passa.
  constructor(
    forecastService: ForecastService,
    fichaTecnicaService: FichaTecnicaService
  ) {
    this.forecastService = forecastService;
    this.fichaTecnicaService = fichaTecnicaService;
    // ... inicialização de outros serviços
  }

  /**
   * 🎯 R11 (Ponto de Pedido Otimizado) - Calcula sugestão baseada no Forecast (Previsão de Vendas).
   * Este método ignora 'pronto_pedido' do model e usa a previsão de demanda.
   */
  public async gerarSugestaoCompraOtimizada(
    payload: PlanejamentoFilter // Usa o filtro de unidade existente
  ): Promise<NecessidadeItem[]> {
    // 1. Gera a Previsão de Demanda (ForecastService)
    const forecast = await this.forecastService.gerarForecastVendas({
      unidade_id: payload.unidade_id,
      dias_previsao: 7, // Ex: Prever para os próximos 7 dias
      dias_historico: 30, // Ex: Usar histórico dos últimos 30 dias
    });

    // 2. Explode a Demanda (Previsão) em Insumos Necessários (FichaTecnicaService)
    const insumosNecessarios = await this.fichaTecnicaService.explodirDemanda(
      forecast,
      payload.unidade_id
    );

    const sugestoes: NecessidadeItem[] = [];

    for (const necessidade of insumosNecessarios) {
      // 3. Busca o Estoque Atual do Insumo (R4)
      const itemEstoque = (await ItemEstoque.findOne({
        where: {
          id_item: necessidade.id_produto,
          unidade_id: payload.unidade_id,
        },
      })) as ItemEstoqueModel | null;

      if (!itemEstoque) continue;

      const estoqueAtual = itemEstoque.getSaldoAtual();

      // Assume-se que 'estoque_seguranca' já foi adicionado ao ItemEstoque Model
      const estoqueSeguranca = (itemEstoque as any).estoque_seguranca || 0;

      // R11: Necessidade de Compra = (Total Necessário do Forecast + Estoque de Segurança) - Estoque Atual
      let quantidadeComprar =
        necessidade.quantidade_total_necessaria +
        estoqueSeguranca -
        estoqueAtual;

      if (quantidadeComprar > 0) {
        sugestoes.push({
          id_item: itemEstoque.id_item,
          nome: itemEstoque.nome,
          unidade_medida: itemEstoque.unidade_medida,
          estoque_atual: estoqueAtual,
          // Mantemos 'pronto_pedido' no DTO, mas o valor é 0 ou o antigo PP, pois a lógica mudou
          pronto_pedido: (itemEstoque as any).getProntoPedido
            ? (itemEstoque as any).getProntoPedido()
            : 0,
          necessidade: parseFloat(quantidadeComprar.toFixed(2)),
          tipo_movimentacao:
            itemEstoque.tipo_item === "INGREDIENTE" ? "COMPRA" : "PRODUCAO",
        });
      }
    }

    // 4. Gera a lista de sugestões de alto nível
    return sugestoes;
  }

  /**
   * (GSI 1.E, 1.F) Implementa a lógica REATIVA (Ponto de Pedido tradicional).
   * Este método é mantido para compatibilidade, mas a R11 é preferencial.
   */
  public async gerarListaNecessidade(
    filter: PlanejamentoFilter
  ): Promise<NecessidadeItem[]> {
    try {
      // 1. Buscar todos os itens de estoque para a unidade (R4) que possuem Ponto de Pedido definido
      const itens = await ItemEstoque.findAll({
        where: {
          unidade_id: filter.unidade_id,
          [Op.and]: [
            { estoque_atual: { [Op.gt]: literal("estoque_minimo") } },
            { estoque_minimo: { [Op.gt]: 0 } }, // Only consider items with a defined minimum stock
          ],
        },
      });

      const listaNecessidade: NecessidadeItem[] = [];

      // 2. Aplicar a lógica do Ponto de Pedido (PP)
      for (const item of itens) {
        // 🛑 CORRIGIDO: Usa 'pronto_pedido' na lógica de comparação
        if (item.getSaldoAtual() < item.getProntoPedido()) {
          // 🛑 CORRIGIDO: Usa 'pronto_pedido' no cálculo da necessidade
          const necessidade = item.getProntoPedido() - item.getSaldoAtual();

          // Determina se a reposição deve ser por COMPRA (Ingrediente) ou PRODUCAO (Pré-Pronto/Final)
          const tipoMovimentacao =
            item.tipo_item === "INGREDIENTE" ? "COMPRA" : "PRODUCAO";

          listaNecessidade.push({
            id_item: item.id_item,
            nome: item.nome,
            unidade_medida: item.unidade_medida,
            estoque_atual: item.getSaldoAtual(),
            // 🛑 CORRIGIDO: Popula o DTO com 'pronto_pedido'
            pronto_pedido: item.getProntoPedido(),
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
