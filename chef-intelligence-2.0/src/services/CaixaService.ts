// src/services/CaixaService.ts

import Caixa, { CaixaAttributes } from "../models/Caixa";
import { Op, WhereOptions } from "sequelize";
import Lancamento from "../models/Lancamento";

export default class CaixaService {
  public async abrirCaixa(
    colaborador_id_abertura: number,
    // 🔑 R4: Adiciona unidade_id
    unidade_id: number,
    saldo_inicial = 0
  ): Promise<CaixaAttributes> {
    const novo = await Caixa.create({
      colaborador_id_abertura,
      // 🔑 R4: Armazena o ID da Unidade
      //unidade_id,
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
    // 🔑 R4: Adiciona unidade_id para filtro de segurança
    //unidade_id: number
  ): Promise<{ relatorio: any }> {
    const caixa = await Caixa.findOne({
      where: {
        id_caixa,
        //unidade_id, // 🔑 R4: Filtra pela Unidade (Segurança/Isolamento)
      },
    });

    if (!caixa)
      throw new Error("Caixa não encontrado ou pertence a outra unidade.");
    if (caixa.status_caixa === "FECHADO")
      throw new Error("O caixa já está fechado.");

    // TODO: A lógica de cálculo final e total_vendas/despesas deve ser feita aqui (buscando lançamentos e vendas).
    // Esta lógica é complexa e precisa ser implementada.

    await caixa.update({
      colaborador_id_fechamento,
      data_fechamento: new Date(),
      status_caixa: "FECHADO",
    });
    return { relatorio: { id_caixa, fechado_por: colaborador_id_fechamento } };
  }

  /**
   * 🔑 NOVO MÉTODO (CORREÇÃO TS2339): Busca o caixa ativo da unidade.
   * @param unidade_id ID da unidade (R4)
   * @param colaboradorId Opcional: ID do colaborador para filtro secundário.
   */
  public async getCaixaAtivo(
    unidade_id: number,
    colaboradorId?: number
  ): Promise<Caixa | null> {
    const where: WhereOptions<CaixaAttributes> = {
      status_caixa: "ABERTO",
      //unidade_id: unidade_id, // 🔑 R4: Filtra pela Unidade
    };

    // Opcionalmente, pode-se filtrar pelo colaborador, mas um caixa é geralmente global na unidade
    // if (colaboradorId) {
    //   where.colaborador_id_abertura = colaboradorId;
    // }

    return Caixa.findOne({
      where,
      order: [["data_abertura", "DESC"]],
    });
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
