import Caixa, { CaixaAttributes } from "../models/Caixa";
import { Op, WhereOptions } from "sequelize";
import Lancamento from "../models/Lancamento";

export default class CaixaService {
  public async abrirCaixa(
    colaborador_id_abertura: number,
    saldo_inicial = 0
  ): Promise<CaixaAttributes> {
    const novo = await Caixa.create({
      colaborador_id_abertura,
      saldo_inicial: saldo_inicial,
      total_vendas: 0,
      total_despesas: 0,
      saldo_final_calculado: saldo_inicial,
      status_caixa: "ABERTO",
    });
    return novo.toJSON() as CaixaAttributes;
  }

  public async fecharCaixa(
    id_caixa: number,
    colaborador_id_fechamento: number
  ): Promise<{ relatorio: any }> {
    const caixa = await Caixa.findByPk(id_caixa);
    if (!caixa) throw new Error("Caixa não encontrado");
    if (caixa.status_caixa === "FECHADO")
      throw new Error("O caixa já está fechado.");

    // TODO: A lógica de cálculo final e total_vendas/despesas deve ser feita aqui.

    await caixa.update({
      colaborador_id_fechamento,
      data_fechamento: new Date(),
      status_caixa: "FECHADO",
    });
    return { relatorio: { id_caixa, fechado_por: colaborador_id_fechamento } };
  }

  /**
   * Lista caixas abertos (Globalmente)
   */
  public async listarCaixasAtivos(): Promise<CaixaAttributes[]> {
    const caixas = await Caixa.findAll({
      where: {
        status_caixa: "ABERTO",
      },
      order: [["data_abertura", "DESC"]],
    });
    return caixas.map((c) => c.toJSON() as CaixaAttributes);
  }

  /**
   * Lista lançamentos (movimentos) (Globalmente)
   */
  public async listarMovimentos(filters: any): Promise<any[]> {
    // Note: Remoção do filtro por unidade
    const lancamentos = await Lancamento.findAll({
      order: [["data_lancamento", "DESC"]],
      // ... filtros de data (filters) seriam aplicados aqui
    });
    return lancamentos;
  }
}
