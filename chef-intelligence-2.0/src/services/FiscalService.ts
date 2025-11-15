// src/services/FiscalService.ts

import { Transaction, Op, WhereOptions } from "sequelize";
import RegistroFiscal, {
  RegistroFiscalAttributes,
  RegistroFiscalCreationAttributes,
} from "../models/RegistroFiscal";

// Tipagem para os filtros de busca
export interface ExportFiscalFilters {
  data_inicio?: string;
  data_fim?: string;
  tipo_origem?: string;
}

// 🔑 CORREÇÃO TS1192: Adiciona 'default' à exportação da classe.
export default class FiscalService {
  /**
   * Cria um registro fiscal dentro de uma transação.
   * É um método interno, chamado por outros Services (ex: VendaService) para garantir atomicidade (R2/R5).
   */
  public async createAutomaticFiscalRecord(
    data: RegistroFiscalCreationAttributes,
    transaction: Transaction
  ): Promise<RegistroFiscalAttributes> {
    if (!transaction) {
      // Regra de segurança: A transação é obrigatória.
      throw new Error(
        "A transação Sequelize é obrigatória para o registro fiscal."
      );
    }

    try {
      const registro = await RegistroFiscal.create(data, { transaction });
      return registro.toJSON() as RegistroFiscalAttributes;
    } catch (error) {
      // Re-throw para que a transação maior faça o rollback (R5)
      const message =
        error instanceof Error ? error.message : "Erro desconhecido";
      throw new Error(
        "Falha ao registrar Registro Fiscal automático: " + message
      );
    }
  }

  /**
   * Busca registros fiscais com base em filtros de data e tipo de origem, para exportação/visualização.
   */
  public async findFiscalRecords(
    filters: ExportFiscalFilters
  ): Promise<RegistroFiscalAttributes[]> {
    // Inicializa a cláusula WHERE com tipagem rigorosa (R1)
    const where: WhereOptions<RegistroFiscalAttributes> = {};
    const { data_inicio, data_fim, tipo_origem } = filters;

    // Filtro de período (data_inicio e data_fim já validados pelo Controller)
    if (data_inicio && data_fim) {
      // Converte as strings para objetos Date
      where.data_emissao = {
        [Op.between]: [new Date(data_inicio), new Date(data_fim)],
      };
    }

    // Filtro de tipo de origem
    if (tipo_origem) {
      where.tipo_origem = tipo_origem;
    }

    // 🔑 Busca no banco de dados (R5)
    const registros = await RegistroFiscal.findAll({
      where,
      order: [["data_emissao", "ASC"]],
    });

    return registros.map((r) => r.toJSON() as RegistroFiscalAttributes);
  }
}
