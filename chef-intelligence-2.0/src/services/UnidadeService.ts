// src/services/UnidadeService.ts

import Unidade, { UnidadeModel } from "../models/Unidade";
import { Transaction } from "sequelize";

export class UnidadeService {
  /**
   * Cria uma nova unidade no sistema.
   * @param payload Dados da unidade.
   */
  public async create(payload: {
    nome_unidade: string;
    cnpj: string;
    endereco: string;
  }): Promise<UnidadeModel> {
    try {
      const unidade = await Unidade.create(payload);
      return unidade;
    } catch (error) {
      throw new Error(`Falha ao criar Unidade: ${(error as Error).message}`);
    }
  }

  /**
   * Busca todas as unidades ativas.
   */
  public async findAllActive(): Promise<UnidadeModel[]> {
    return Unidade.findAll({
      where: { status_operacional: "ATIVA" },
    });
  }

  /**
   * Atualiza o status operacional de uma unidade.
   */
  public async updateStatus(
    id_unidade: number,
    status: "ATIVA" | "INATIVA" | "EM_REFORMA"
  ): Promise<UnidadeModel> {
    const unidade = await Unidade.findByPk(id_unidade);

    if (!unidade) {
      throw new Error("Unidade não encontrada.");
    }

    await unidade.update({ status_operacional: status });
    return unidade;
  }
}
