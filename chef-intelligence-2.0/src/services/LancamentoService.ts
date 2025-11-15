import { Transaction, Op } from "sequelize";
import { connection } from "../config/sequelize";
// 🔑 R6: Importa o modelo Lancamento renomeado e Caixa
import Lancamento, {
  TipoLancamento,
  LancamentoAttributes,
} from "../models/Lancamento";
import Decimal from "decimal.js";
import Caixa from "../models/Caixa";

interface LancamentoPayload {
  id_caixa: number | null;
  colaborador_id: number;
  tipo_lancamento: TipoLancamento;
  valor: number;
  descricao: string;
  categoria?: string | null;
  id_origem?: number | null;
  tipo_origem?: "VENDA" | "PEDIDO" | null;
}

// 🔑 R6: Exportação padrão da classe
export default class LancamentoService {
  /**
   * Registra um novo lançamento financeiro (Manual ou Automático: Venda, Sangria, Reforço).
   */
  public async registrarLancamento(
    payload: LancamentoPayload,
    transaction: Transaction
  ): Promise<LancamentoAttributes> {
    const { tipo_lancamento, valor } = payload; // 1. Validações de Negócio

    if (valor <= 0) {
      throw new Error(`O valor do lançamento deve ser positivo.`);
    }

    const tiposValidos: TipoLancamento[] = [
      "RECEITA",
      "DESPESA",
      "SANGRIA",
      "REFORCO",
    ];
    if (!tiposValidos.includes(tipo_lancamento)) {
      throw new Error(`Tipo de lançamento inválido: ${tipo_lancamento}.`);
    } // 2. Criação do Registro

    try {
      const lancamento = await Lancamento.create(
        {
          ...payload,
        },
        { transaction }
      );

      return lancamento.toJSON() as LancamentoAttributes;
    } catch (error) {
      throw new Error(
        "Falha ao registrar lançamento financeiro: " + (error as Error).message
      );
    }
  }
}
