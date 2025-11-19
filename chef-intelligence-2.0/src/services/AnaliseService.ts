// src/services/AnaliseService.ts
// 🎯 Responsável pela lógica de cálculo dos KPIs Financeiros (R3, R10) e Garantia R4.

import { Op, literal, ModelCtor, fn, col, Transaction } from 'sequelize';
import { connection } from '../config/sequelize';
import { KPIFilter, DashboardKPIs } from '../config/types'; // Assumindo tipagem de filtro

// --- 🔑 CORE MODELS (FINANCEIRO / GPR-1) ---
// Modelos de Venda e Custo (Base para R3 e CMV)
import ItemEstoque, { ItemEstoqueModel } from '../models/ItemEstoque';
import VendaItem, { VendaItemModel } from '../models/VendaItem';

// Modelos de Despesas Variáveis e Fixas (Base para R3 e R10)
import VendaImposto, { VendaImpostoModel } from '../models/VendaImposto';
import VendaComissao, { VendaComissaoModel } from '../models/VendaComissao';
import CustoFixo, { CustoFixoModel } from '../models/CustoFixo';

// Importação de Modelos de Compras/Estoque (Base para CMV por Perda/Produção - R8)
import ComprasItemPedido from '../models/ComprasItemPedido';
import ComprasPedido from '../models/ComprasPedido';
import ProducaoRegistroPerda, {
  ProducaoRegistroPerdaModel,
} from '../models/ProducaoRegistroPerda';
import ProducaoRegistro, {
  ProducaoRegistroModel,
} from '../models/ProducaoRegistro';
import ProducaoRequisicaoInsumo, {
  ProducaoRequisicaoInsumoModel,
} from '../models/ProducaoRequisicaoInsumo';

// Define a interface para garantir a conformidade com o Contrato do Service (R6)
interface IAnaliseService {
  getFinanceiroKPIs(filter: KPIFilter): Promise<DashboardKPIs>;
  getReceitaTotal(filter: KPIFilter): Promise<number>;
  getCMVRealTime(filter: KPIFilter): Promise<number>;
  getDespesasVariaveisTotal(filter: KPIFilter): Promise<number>;
  getCustoFixoTotal(filter: KPIFilter): Promise<number>;
  getMCMP(filter: KPIFilter): Promise<{ margem: number; percentual: number }>;
  getPontoDeEquilibrio(filter: KPIFilter): Promise<number>;
  getTendenciaReceitaMensal(filter: KPIFilter): Promise<any[]>;
  getTendenciaCMVMensal(filter: KPIFilter): Promise<any[]>;
}

export class AnaliseService implements IAnaliseService {
  // 🔑 2.B: Propriedades para acesso direto aos Models (APENAS AQUI)
  private VendaItem: ModelCtor<VendaItemModel>;
  private ItemEstoque: ModelCtor<ItemEstoqueModel>;
  private VendaImposto: ModelCtor<VendaImpostoModel>;
  private VendaComissao: ModelCtor<VendaComissaoModel>;
  private CustoFixo: ModelCtor<CustoFixoModel>;
  private ProducaoRegistroPerda: ModelCtor<ProducaoRegistroPerdaModel>;
  private ProducaoRegistro: ModelCtor<ProducaoRegistroModel>;

  constructor() {
    // 🔑 2.A: Instanciação de Models no construtor
    this.VendaItem = VendaItem;
    this.ItemEstoque = ItemEstoque;
    this.VendaImposto = VendaImposto;
    this.VendaComissao = VendaComissao;
    this.CustoFixo = CustoFixo;
    this.ProducaoRegistroPerda = ProducaoRegistroPerda;
    this.ProducaoRegistro = ProducaoRegistro;
    // ... (Instanciação de outros Models, se necessário)
  }

  // --- MÉTODOS FINANCEIROS R3 (Margem de Contribuição) ---

  /**
   * R3: Calcula a Receita Total.
   * Usa VendaItem e ItemEstoque.
   */
  public async getReceitaTotal(filter: KPIFilter): Promise<number> {
    const { unidade_id, data_inicio, data_fim } = filter;

    try {
      // 🔑 2.D: Aplicação do filtro R4 (WHERE unidade_id = unidade_id)
      const receitaResult: any = await this.VendaItem.findOne({
        attributes: [
          [
            // Soma (quantidade * preco_venda do item de estoque)
            literal('SUM(VendaItem.quantidade * itemEstoque.preco_venda)'),
            'receita_total',
          ],
        ],
        where: {
          unidade_id: unidade_id, // 🔑 R4 - Filtragem crítica
          createdAt: {
            [Op.between]: [data_inicio, data_fim],
          },
        },
        include: [
          {
            model: this.ItemEstoque,
            as: 'itemEstoque',
            attributes: [],
          },
        ],
        raw: true,
      });

      const receitaTotal = parseFloat(receitaResult?.receita_total || 0);
      return parseFloat(receitaTotal.toFixed(2));
    } catch (error) {
      console.error('Erro ao calcular Receita Total (R3):', error);
      return 0;
    }
  }

  /**
   * R3: Calcula o Custo da Mercadoria Vendida (CMV) em tempo real.
   * Usa VendaItem e ItemEstoque.
   */
  public async getCMVRealTime(filter: KPIFilter): Promise<number> {
    const { unidade_id, data_inicio, data_fim } = filter;

    try {
      // 🔑 2.D: Aplicação do filtro R4
      const cmvResult: any = await this.VendaItem.findOne({
        attributes: [
          [
            // Soma (quantidade * preco_custo_unitario do item de estoque)
            literal(
              'SUM(VendaItem.quantidade * itemEstoque.preco_custo_unitario)',
            ),
            'cmv_total',
          ],
        ],
        where: {
          unidade_id: unidade_id, // 🔑 R4 - Filtragem crítica
          createdAt: {
            [Op.between]: [data_inicio, data_fim],
          },
        },
        include: [
          {
            model: this.ItemEstoque,
            as: 'itemEstoque',
            attributes: [],
          },
        ],
        raw: true,
      });

      const cmvTotal = parseFloat(cmvResult?.cmv_total || 0);
      return parseFloat(cmvTotal.toFixed(2));
    } catch (error) {
      console.error('Erro ao calcular CMV (R3):', error);
      return 0;
    }
  }

  /**
   * R3: Calcula o total das Despesas Variáveis (Impostos + Comissões).
   * Usa VendaImposto e VendaComissao.
   */
  public async getDespesasVariaveisTotal(filter: KPIFilter): Promise<number> {
    const { unidade_id, data_inicio, data_fim } = filter;

    try {
      // 1. Total de Impostos (DV)
      const impostosResult: any = await this.VendaImposto.findOne({
        attributes: [[fn('SUM', col('valor_imposto')), 'total_impostos']],
        where: {
          unidade_id: unidade_id, // 🔑 R4 - Filtragem crítica
          createdAt: { [Op.between]: [data_inicio, data_fim] },
        },
        raw: true,
      });
      const totalImpostos = parseFloat(impostosResult?.total_impostos || 0);

      // 2. Total de Comissões (DV)
      const comissoesResult: any = await this.VendaComissao.findOne({
        attributes: [[fn('SUM', col('valor_comissao')), 'total_comissoes']],
        where: {
          unidade_id: unidade_id, // 🔑 R4 - Filtragem crítica
          createdAt: { [Op.between]: [data_inicio, data_fim] },
        },
        raw: true,
      });
      const totalComissoes = parseFloat(comissoesResult?.total_comissoes || 0);

      const totalDV = totalImpostos + totalComissoes;
      return parseFloat(totalDV.toFixed(2));
    } catch (error) {
      console.error('Erro ao calcular Despesas Variáveis (R3):', error);
      return 0;
    }
  }

  /**
   * R3: Calcula a Margem de Contribuição (MC) e o Percentual da Margem (MC%).
   */
  public async getMCMP(
    filter: KPIFilter,
  ): Promise<{ margem: number; percentual: number }> {
    const [receita, cmv, despesasVariaveis] = await Promise.all([
      this.getReceitaTotal(filter),
      this.getCMVRealTime(filter),
      this.getDespesasVariaveisTotal(filter),
    ]);

    const margemContribuicao = receita - cmv - despesasVariaveis;
    const percentual = receita > 0 ? (margemContribuicao / receita) * 100 : 0;

    return {
      margem: parseFloat(margemContribuicao.toFixed(2)),
      percentual: parseFloat(percentual.toFixed(2)),
    };
  }

  // --- MÉTODOS FINANCEIROS R10 (Custo Fixo e Ponto de Equilíbrio) ---

  /**
   * R10: Calcula o Custo Fixo Total no período.
   * Usa CustoFixo.
   */
  public async getCustoFixoTotal(filter: KPIFilter): Promise<number> {
    const { unidade_id, data_inicio, data_fim } = filter;

    try {
      // 🔑 2.D: Aplicação do filtro R4
      const cfResult: any = await this.CustoFixo.findOne({
        attributes: [[fn('SUM', col('valor_mensal')), 'total_custo_fixo']],
        where: {
          unidade_id: unidade_id, // 🔑 R4 - Filtragem crítica
          // CustoFixo é geralmente mensal, então buscamos por data de criação/referência
          createdAt: { [Op.between]: [data_inicio, data_fim] },
        },
        raw: true,
      });

      const totalCustoFixo = parseFloat(cfResult?.total_custo_fixo || 0);
      return parseFloat(totalCustoFixo.toFixed(2));
    } catch (error) {
      console.error('Erro ao calcular Custo Fixo Total (R10):', error);
      return 0;
    }
  }

  /**
   * R10: Calcula o Ponto de Equilíbrio (PE) em Receita.
   * PE = Custo Fixo Total / (Margem de Contribuição Percentual / 100)
   */
  public async getPontoDeEquilibrio(filter: KPIFilter): Promise<number> {
    const [custoFixo, mcmp] = await Promise.all([
      this.getCustoFixoTotal(filter),
      this.getMCMP(filter),
    ]);

    const mcPercentual = mcmp.percentual / 100;

    if (mcPercentual <= 0) {
      // PE é indefinido ou infinito se a margem for zero ou negativa
      return 0;
    }

    const pontoEquilibrio = custoFixo / mcPercentual;
    return parseFloat(pontoEquilibrio.toFixed(2));
  }

  // --- MÉTODOS DE TENDÊNCIA (R12) ---

  /**
   * R12: Calcula a tendência mensal da Receita.
   */
  public async getTendenciaReceitaMensal(filter: KPIFilter): Promise<any[]> {
    const { unidade_id, data_inicio, data_fim } = filter;

    try {
      // 🔑 2.D: Aplicação do filtro R4
      const tendencia = await this.VendaItem.findAll({
        attributes: [
          // Agrupa por Mês e Ano
          [
            fn('DATE_TRUNC', col('VendaItem.createdAt'), 'month'),
            'mes_referencia',
          ],
          // Calcula a Receita
          [
            literal('SUM(VendaItem.quantidade * itemEstoque.preco_venda)'),
            'receita_mensal',
          ],
        ],
        where: {
          unidade_id: unidade_id, // 🔑 R4 - Filtragem crítica
          createdAt: { [Op.between]: [data_inicio, data_fim] },
        },
        include: [
          { model: this.ItemEstoque, as: 'itemEstoque', attributes: [] },
        ],
        group: ['mes_referencia'],
        order: [[literal('mes_referencia'), 'ASC']],
        raw: true,
      });

      return tendencia.map((item: any) => ({
        mes: item.mes_referencia,
        receita: parseFloat(parseFloat(item.receita_mensal || 0).toFixed(2)),
      }));
    } catch (error) {
      console.error('Erro ao calcular Tendência de Receita (R12):', error);
      return [];
    }
  }

  /**
   * R12: Calcula a tendência mensal do CMV.
   */
  public async getTendenciaCMVMensal(filter: KPIFilter): Promise<any[]> {
    const { unidade_id, data_inicio, data_fim } = filter;

    try {
      // 🔑 2.D: Aplicação do filtro R4
      const tendencia = await this.VendaItem.findAll({
        attributes: [
          // Agrupa por Mês e Ano
          [
            fn('DATE_TRUNC', col('VendaItem.createdAt'), 'month'),
            'mes_referencia',
          ],
          // Calcula o CMV
          [
            literal(
              'SUM(VendaItem.quantidade * itemEstoque.preco_custo_unitario)',
            ),
            'cmv_mensal',
          ],
        ],
        where: {
          unidade_id: unidade_id, // 🔑 R4 - Filtragem crítica
          createdAt: { [Op.between]: [data_inicio, data_fim] },
        },
        include: [
          { model: this.ItemEstoque, as: 'itemEstoque', attributes: [] },
        ],
        group: ['mes_referencia'],
        order: [[literal('mes_referencia'), 'ASC']],
        raw: true,
      });

      return tendencia.map((item: any) => ({
        mes: item.mes_referencia,
        cmv: parseFloat(parseFloat(item.cmv_mensal || 0).toFixed(2)),
      }));
    } catch (error) {
      console.error('Erro ao calcular Tendência de CMV (R12):', error);
      return [];
    }
  }

  // --- CONSOLIDADO: OBTÉM TODOS OS KPIS ---

  /**
   * Obtém todos os KPIs financeiros consolidados (R3, R10 e R12).
   */
  public async getFinanceiroKPIs(filter: KPIFilter): Promise<DashboardKPIs> {
    try {
      // Execução em paralelo das 5 métricas principais (R3/R10)
      const [receita, cmv, despesasVariaveis, custoFixo, mcmpResult] =
        await Promise.all([
          this.getReceitaTotal(filter),
          this.getCMVRealTime(filter),
          this.getDespesasVariaveisTotal(filter),
          this.getCustoFixoTotal(filter),
          this.getMCMP(filter),
        ]);

      // Cálculo do Ponto de Equilíbrio (depende do Custo Fixo e MC%)
      const pontoEquilibrio = await this.getPontoDeEquilibrio(filter);

      // Execução em paralelo das Tendências (R12)
      const [tendenciaReceita, tendenciaCMV] = await Promise.all([
        this.getTendenciaReceitaMensal(filter),
        this.getTendenciaCMVMensal(filter),
      ]);

      const lucroOperacional = mcmpResult.margem - custoFixo;

      const kpis: DashboardKPIs = {
        // R3: Lucratividade da Venda
        receita_total: receita,
        custo_mercadoria_vendida: cmv,
        despesas_variaveis: despesasVariaveis,
        margem_contribuicao_valor: mcmpResult.margem,
        margem_contribuicao_percentual: mcmpResult.percentual,

        // R10: Ponto de Equilíbrio
        custo_fixo_total: custoFixo,
        lucro_operacional: parseFloat(lucroOperacional.toFixed(2)),
        ponto_equilibrio_receita: pontoEquilibrio,

        // R12: Tendências
        tendencia_receita: tendenciaReceita,
        tendencia_cmv: tendenciaCMV,
      };

      return kpis;
    } catch (error) {
      console.error('Erro ao consolidar KPIs Financeiros:', error);
      // 1.C: Tratamento de erro robusto no Service
      throw new Error('Falha ao calcular o dashboard financeiro.');
    }
  }
}
