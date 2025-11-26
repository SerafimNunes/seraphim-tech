import { Op, ModelCtor } from "sequelize";
// 🔑 CORRIGIDO: Importação namespace do moment para evitar erro TS2307
import moment from "moment";
import {
  IModelFactory,
  StatusColaborador,
  IPerfilIdeal,
  IHistoricoPerformance,
  TurnoverAnalysisItem,
} from "../config/types";
import { ColaboradorModel } from "../models/Colaborador";
import { CargoModel } from "../models/Cargo";
import { PerfilIdealModel } from "../models/PerfilIdeal";
import { HistoricoPerformanceModel } from "../models/HistoricoPerformance";

export class RHService {
  private Colaborador: ModelCtor<ColaboradorModel>;
  private Cargo: ModelCtor<CargoModel>;
  private PerfilIdeal: ModelCtor<PerfilIdealModel>;
  private HistoricoPerformance: ModelCtor<HistoricoPerformanceModel>;

  constructor(models: IModelFactory) {
    this.Colaborador = models.Colaborador as ModelCtor<ColaboradorModel>;
    this.Cargo = models.Cargo as ModelCtor<CargoModel>;
    this.PerfilIdeal = models.PerfilIdeal as ModelCtor<PerfilIdealModel>;
    this.HistoricoPerformance =
      models.HistoricoPerformance as ModelCtor<HistoricoPerformanceModel>;
  }

  // -------------------------------------------------------------------------
  // BI & ANÁLISE DE DADOS (Turnover Real - R13)
  // -------------------------------------------------------------------------

  public async getTurnoverAnalysis(
    unidadeId: number,
    ano: number
  ): Promise<TurnoverAnalysisItem[]> {
    const result: TurnoverAnalysisItem[] = [];

    for (let mes = 0; mes < 12; mes++) {
      const dataInicio = moment()
        .year(ano)
        .month(mes)
        .startOf("month")
        .toDate();
      const dataFim = moment().year(ano).month(mes).endOf("month").toDate();

      if (moment(dataInicio).isAfter(moment())) {
        break;
      }

      // 🔑 CORRIGIDO: Cast para number (TS2322)
      const admissoes = (await this.Colaborador.count({
        where: {
          unidade_id: unidadeId,
          data_contratacao: { [Op.between]: [dataInicio, dataFim] },
        },
      })) as unknown as number;

      // 🔑 CORRIGIDO: Cast para number
      const desligamentos = (await this.Colaborador.count({
        where: {
          unidade_id: unidadeId,
          data_desligamento: { [Op.between]: [dataInicio, dataFim] },
        },
      })) as unknown as number;

      const ativosNoMes = (await this.Colaborador.count({
        where: {
          unidade_id: unidadeId,
          data_contratacao: { [Op.lte]: dataFim },
          [Op.or]: [
            { data_desligamento: { [Op.eq]: null } },
            { data_desligamento: { [Op.gte]: dataInicio } },
          ],
        },
      })) as unknown as number;

      // 🔑 CORRIGIDO: TS agora entende que são numbers (TS2365/TS2362)
      const mediaColaboradores = ativosNoMes > 0 ? ativosNoMes : 1;
      const taxaTurnover = parseFloat(
        ((desligamentos / mediaColaboradores) * 100).toFixed(2)
      );

      result.push({
        mes: mes + 1,
        admissoes,
        desligamentos,
        mediaColaboradores: ativosNoMes,
        taxaTurnover,
      });
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // OPERACIONAL
  // -------------------------------------------------------------------------

  public async getColaboradorById(
    id_colaborador: number,
    unidade_id: number
  ): Promise<ColaboradorModel | null> {
    return await this.Colaborador.findOne({
      where: { id_colaborador, unidade_id },
      include: [this.Cargo],
    });
  }

  public async getColaboradorAtivo(
    id_colaborador: number,
    unidade_id: number
  ): Promise<ColaboradorModel | null> {
    const colaborador = await this.getColaboradorById(
      id_colaborador,
      unidade_id
    );

    if (!colaborador) return null;

    const statusAtual = colaborador.Status as string | StatusColaborador;

    const isAtivoStatus =
      statusAtual === StatusColaborador.ATIVO || statusAtual === "ATIVO";
    // 🔑 CORRIGIDO: data_desligamento agora existe no model Colaborador
    const isDesligado =
      colaborador.data_desligamento &&
      moment(colaborador.data_desligamento).isBefore(moment());

    if (!isAtivoStatus || isDesligado) {
      return null;
    }

    return colaborador;
  }

  // -------------------------------------------------------------------------
  // GESTÃO DE PERFORMANCE E PERFIL (Persistência Real)
  // -------------------------------------------------------------------------

  public async definirPerfilIdeal(perfil: IPerfilIdeal): Promise<void> {
    const existingProfile = await this.PerfilIdeal.findOne({
      where: {
        cargo_id: perfil.cargo_id,
        competencia_id: perfil.competencia_id,
      },
    });

    if (existingProfile) {
      await existingProfile.update({
        peso: perfil.peso || 1,
      });
    } else {
      await this.PerfilIdeal.create({
        cargo_id: perfil.cargo_id,
        competencia_id: perfil.competencia_id,
        peso: perfil.peso || 1,
        nivel_minimo: 1,
      });
    }
  }

  public async registrarPerformance(
    performance: IHistoricoPerformance
  ): Promise<void> {
    await this.HistoricoPerformance.create({
      colaborador_id: performance.colaborador_id,
      erros_registrados: performance.erros_registrados,
      desperdicio_total: performance.desperdicio_total,
      data_registro: new Date(),
    });
  }
}
