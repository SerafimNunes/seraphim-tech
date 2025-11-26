// backend/src/services/DashboardService.ts

import { IModelFactory } from "../config/types";
import { Op, ModelCtor } from "sequelize";
// 🔑 CORRIGIDO: Importação 'namespace' para corrigir erro TS2307/TS1259
import * as moment from "moment";
import { ColaboradorModel } from "../models/Colaborador";
import { VendaItemModel } from "../models/VendaItem";
import { ProducaoRegistroPerdaModel } from "../models/ProducaoRegistroPerda";
// 🔑 CORRIGIDO: Importa default (CustoFixo) e o tipo nomeado (CustoFixoModel)
import CustoFixo, { CustoFixoModel } from "../models/CustoFixo";

export type Trend = "rising" | "falling" | "stable";

export interface KpiMetric {
  valor: number;
  unidade: "%" | "R$" | "unid";
  tendencia: Trend;
  meta?: number;
}

export interface TurnoverAnalysisItem {
  mes: number;
  taxaTurnover: number;
  admissoes: number;
  desligamentos: number;
}

export interface DashboardData {
  cmv: KpiMetric;
  desperdicio: KpiMetric;
  lucroBruto: KpiMetric;
  kpiAtual: KpiMetric & { meta: number };
  ticketMedio: KpiMetric;
  custosFixos: KpiMetric;
  historicoMensal: TurnoverAnalysisItem[];
}

export class DashboardService {
  private Colaborador: ModelCtor<ColaboradorModel>;
  private VendaItem: ModelCtor<VendaItemModel>;
  private ProducaoRegistroPerda: ModelCtor<ProducaoRegistroPerdaModel>;
  private CustoFixo: ModelCtor<CustoFixoModel>;

  constructor(models: IModelFactory) {
    this.Colaborador = models.Colaborador as ModelCtor<ColaboradorModel>;
    this.VendaItem = models.VendaItem as ModelCtor<VendaItemModel>;
    this.ProducaoRegistroPerda =
      models.ProducaoRegistroPerda as ModelCtor<ProducaoRegistroPerdaModel>; // 🔑 CORRIGIDO: O tipo CustoFixoModel agora está disponível no import.
    this.CustoFixo = (models.CustoFixo ||
      CustoFixo) as ModelCtor<CustoFixoModel>;
  }

  private calculateTrend(
    currentValue: number,
    previousValue: number,
    isBad: boolean = false
  ): Trend {
    if (previousValue === 0) return "stable";
    const change = currentValue - previousValue;
    if (Math.abs(change / previousValue) < 0.01) return "stable";

    if (change > 0) {
      return isBad ? "falling" : "rising";
    }
    return isBad ? "rising" : "falling";
  }

  private async getBaseColaboradores(
    unitId: string,
    endDate: Date
  ): Promise<number> {
    // 🔑 CORRIGIDO: Cast explícito para 'number' para resolver TS2322/TS2769
    const count = await this.Colaborador.count({
      where: {
        [Op.and]: [
          { unidade_id: parseInt(unitId, 10) },
          { data_contratacao: { [Op.lte]: endDate } },
          {
            [Op.or]: [
              { data_desligamento: { [Op.eq]: null } },
              { data_desligamento: { [Op.gt]: endDate } },
            ],
          },
        ],
      },
    });
    return (count as unknown as number) || 1;
  }

  public async getDashboardData(
    unitId: string,
    year: number
  ): Promise<DashboardData> {
    const unitIdNum = parseInt(unitId, 10);
    const currentYearStart = moment
      .utc(`${year}-01-01`)
      .startOf("day")
      .toDate();
    const currentYearEnd = moment.utc(`${year}-12-31`).endOf("day").toDate();
    const previousYearStart = moment
      .utc(`${year - 1}-01-01`)
      .startOf("day")
      .toDate();
    const previousYearEnd = moment
      .utc(`${year - 1}-12-31`)
      .endOf("day")
      .toDate();

    const calculateMetrics = async (start: Date, end: Date) => {
      const totalVendasBruta =
        (await this.VendaItem.sum("preco_venda_total" as any, {
          where: {
            unidade_id: unitIdNum,
            createdAt: { [Op.between]: [start, end] },
          },
        })) || 0;

      const cmvValor =
        (await this.VendaItem.sum("custo_total" as any, {
          where: {
            unidade_id: unitIdNum,
            createdAt: { [Op.between]: [start, end] },
          },
        })) || 0; // 🔑 CORRIGIDO: Cast 'as any' no where para evitar erro TS2353 em ProducaoRegistroPerda

      const totalPerdasValor =
        (await this.ProducaoRegistroPerda.sum("custo_total_perda" as any, {
          where: {
            unidade_id: unitIdNum,
            createdAt: { [Op.between]: [start, end] },
          } as any,
        })) || 0;

      const dateField = (this.CustoFixo.getAttributes() as any).data_lancamento
        ? "data_lancamento"
        : "createdAt";

      const totalCustoFixo =
        (await this.CustoFixo.sum("valor" as any, {
          where: {
            unidade_id: unitIdNum,
            [dateField]: { [Op.between]: [start, end] },
          },
        })) || 0;

      const totalItensVendidos =
        ((await this.VendaItem.count({
          where: {
            unidade_id: unitIdNum,
            createdAt: { [Op.between]: [start, end] },
          },
        })) as unknown as number) || 1;

      return {
        totalVendasBruta,
        cmvValor,
        totalPerdasValor,
        totalCustoFixo,
        totalItensVendidos,
      };
    };

    const currentYear = await calculateMetrics(
      currentYearStart,
      currentYearEnd
    );
    const previousYear = await calculateMetrics(
      previousYearStart,
      previousYearEnd
    );

    const lucroBruto = currentYear.totalVendasBruta - currentYear.cmvValor;
    const lucroBrutoAnterior =
      previousYear.totalVendasBruta - previousYear.cmvValor;

    const cmvPercentualAtual =
      currentYear.totalVendasBruta > 0
        ? (currentYear.cmvValor / currentYear.totalVendasBruta) * 100
        : 0;
    const cmvPercentualAnterior =
      previousYear.totalVendasBruta > 0
        ? (previousYear.cmvValor / previousYear.totalVendasBruta) * 100
        : 0;

    const desperdicioPercentualAtual =
      currentYear.totalVendasBruta > 0
        ? (currentYear.totalPerdasValor / currentYear.totalVendasBruta) * 100
        : 0;
    const desperdicioPercentualAnterior =
      previousYear.totalVendasBruta > 0
        ? (previousYear.totalPerdasValor / previousYear.totalVendasBruta) * 100
        : 0;

    const ticketMedio =
      currentYear.totalVendasBruta / currentYear.totalItensVendidos;
    const ticketMedioAnterior =
      previousYear.totalVendasBruta / previousYear.totalItensVendidos;

    const baseCollaborators = await this.getBaseColaboradores(
      unitId,
      currentYearEnd
    ); // 🔑 CORRIGIDO: Cast explícito para number para resolver TS2362 (Arithmetic ops)

    const desligamentos = (await this.Colaborador.count({
      where: {
        unidade_id: unitIdNum,
        data_desligamento: { [Op.between]: [currentYearStart, currentYearEnd] },
      },
    })) as unknown as number;

    const desligamentosAnterior = (await this.Colaborador.count({
      where: {
        unidade_id: unitIdNum,
        data_desligamento: {
          [Op.between]: [previousYearStart, previousYearEnd],
        },
      },
    })) as unknown as number;

    const baseForTurnoverCalc = baseCollaborators > 0 ? baseCollaborators : 1;
    const turnoverAtual = (desligamentos / baseForTurnoverCalc) * 100;

    const basePrevious = await this.getBaseColaboradores(
      unitId,
      previousYearEnd
    );
    const baseForPreviousCalc = basePrevious > 0 ? basePrevious : 1;
    const turnoverAnterior =
      (desligamentosAnterior / baseForPreviousCalc) * 100;

    const historicalData: TurnoverAnalysisItem[] = [];
    for (let month = 1; month <= 12; month++) {
      const monthStart = moment
        .utc(`${year}-${month}-01`)
        .startOf("day")
        .toDate();
      const monthEnd = moment.utc(monthStart).endOf("month").toDate();

      const monthAdmissoes = (await this.Colaborador.count({
        where: {
          unidade_id: unitIdNum,
          data_contratacao: { [Op.between]: [monthStart, monthEnd] },
        },
      })) as unknown as number;

      const monthDesligamentos = (await this.Colaborador.count({
        where: {
          unidade_id: unitIdNum,
          data_desligamento: { [Op.between]: [monthStart, monthEnd] },
        },
      })) as unknown as number;

      const baseMonthStart = await this.getBaseColaboradores(
        unitId,
        monthStart
      );
      const baseForCalc = baseMonthStart > 0 ? baseMonthStart : 1;
      const taxaTurnover = (monthDesligamentos / baseForCalc) * 100;

      historicalData.push({
        mes: month,
        taxaTurnover: parseFloat(taxaTurnover.toFixed(1)),
        admissoes: monthAdmissoes,
        desligamentos: monthDesligamentos,
      });
    }

    return {
      cmv: {
        valor: parseFloat(cmvPercentualAtual.toFixed(1)),
        unidade: "%",
        tendencia: this.calculateTrend(
          cmvPercentualAtual,
          cmvPercentualAnterior,
          true
        ),
      },
      desperdicio: {
        valor: parseFloat(desperdicioPercentualAtual.toFixed(1)),
        unidade: "%",
        tendencia: this.calculateTrend(
          desperdicioPercentualAtual,
          desperdicioPercentualAnterior,
          true
        ),
      },
      lucroBruto: {
        valor: parseFloat(lucroBruto.toFixed(2)),
        unidade: "R$",
        tendencia: this.calculateTrend(lucroBruto, lucroBrutoAnterior, false),
      },
      kpiAtual: {
        valor: parseFloat(turnoverAtual.toFixed(1)),
        unidade: "%",
        tendencia: this.calculateTrend(turnoverAtual, turnoverAnterior, true),
        meta: 15,
      },
      ticketMedio: {
        valor: parseFloat(ticketMedio.toFixed(2)),
        unidade: "R$",
        tendencia: this.calculateTrend(ticketMedio, ticketMedioAnterior, false),
      },
      custosFixos: {
        valor: parseFloat(currentYear.totalCustoFixo.toFixed(2)),
        unidade: "R$",
        tendencia: this.calculateTrend(
          currentYear.totalCustoFixo,
          previousYear.totalCustoFixo,
          true
        ),
      },
      historicoMensal: historicalData,
    };
  }
}
