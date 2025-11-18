// src/services/EstoqueService.ts

import { Transaction } from "sequelize";
import ItemEstoque, { ItemEstoqueModel } from "../models/ItemEstoque";
// 🔑 CORREÇÃO: Importa os tipos necessários diretamente da Model (fonte de verdade)
import {
  TipoMovimentoEstoque,
  EstoqueRegistroMovimentoCreationAttributes,
} from "../models/EstoqueRegistroMovimento";
import Decimal from "decimal.js";
// 🔑 CORREÇÃO: Importa o EstoqueMovimentoService para delegar o registro de histórico
import { EstoqueMovimentoService } from "./EstoqueMovimentoService";

// ❌ REMOVIDO: A definição local de TipoMovimentoEstoque foi removida.

// 🔑 CORREÇÃO CRÍTICA: Reexporta TipoMovimentoEstoque para que outros services (como ProducaoService) possam importá-lo daqui.
export { TipoMovimentoEstoque };

export interface MovimentoPayload {
  id_produto: number;
  tipo_movimento: TipoMovimentoEstoque;
  quantidade: number;
  // Renomeado para seguir o padrão do novo Model: custo_unitario
  custo_unitario_momento?: number;
  observacoes?: string;
  referencia_origem?: string | null;
  colaborador_id?: number;
}

export class EstoqueService {
  private movimentoService: EstoqueMovimentoService; // 🔑 Dependência injetada

  constructor() {
    // 1.A: Injeção de Dependência
    this.movimentoService = new EstoqueMovimentoService();
  }

  public async entradaEstoque(
    produto: ItemEstoqueModel,
    qtd_entrada: number,
    custo_entrada_unitario: number,
    tipo_movimento: TipoMovimentoEstoque,
    observacoes: string,
    referencia_origem: string | null,
    colaborador_id?: number,
    transaction?: Transaction
  ): Promise<ItemEstoqueModel> {
    const estoque_anterior_dec = new Decimal(
      produto.estoque_atual as unknown as string
    );
    const custo_medio_unitario_anterior_dec = new Decimal(
      produto.preco_custo_unitario as unknown as string
    );
    const qtd_entrada_dec = new Decimal(qtd_entrada);
    const custo_entrada_unitario_dec = new Decimal(custo_entrada_unitario);

    // ... Lógica de Cálculo de Custo Médio Ponderado (CMP) ...
    const custo_total_anterior = estoque_anterior_dec.times(
      custo_medio_unitario_anterior_dec
    );
    const custo_total_entrada = qtd_entrada_dec.times(
      custo_entrada_unitario_dec
    );

    const novo_custo_total = custo_total_anterior.plus(custo_total_entrada);
    const nova_quantidade = estoque_anterior_dec.plus(qtd_entrada_dec);

    const novo_custo_medio_unitario = nova_quantidade.greaterThan(0)
      ? novo_custo_total.div(nova_quantidade)
      : new Decimal(0);

    // 1. Atualiza o Produto
    await produto.update(
      {
        estoque_atual: nova_quantidade.toNumber(),
        preco_custo_unitario: novo_custo_medio_unitario.toNumber(),
      },
      { transaction }
    );

    // 2. Registra o Movimento (Delegação)
    const custoTotalEntrada = custo_total_entrada.toNumber();

    const registroMovimento: EstoqueRegistroMovimentoCreationAttributes = {
      id_produto: produto.id_produto,
      // Usamos o TipoMovimentoEstoque importado
      tipo_movimento: tipo_movimento,
      quantidade: qtd_entrada_dec.toNumber(),
      // Preço de custo unitário usado no momento (custo de compra/entrada)
      custo_unitario: custo_entrada_unitario_dec.toNumber(),
      custo_total: custoTotalEntrada,
      data_movimento: new Date(),
      referencia_documento: referencia_origem || `ENTRADA - ${observacoes}`,
      // CAMPOS NOVOS (Não estavam na model, mas seguem o padrão)
      // id_origem e tipo_origem podem ser preenchidos se soubermos a origem (ex: ID da Compra)
      id_origem: null,
      tipo_origem: null,
    };

    // 🔑 Delegação para o EstoqueMovimentoService para registrar o histórico
    await this.movimentoService.registrarMovimento(
      registroMovimento,
      transaction
    );

    return produto;
  }

  public async saidaEstoque(
    produto: ItemEstoqueModel,
    qtd_saida: number,
    tipo_movimento: TipoMovimentoEstoque,
    observacoes: string,
    referencia_origem: string | null,
    colaborador_id?: number,
    transaction?: Transaction
  ): Promise<{ produto: ItemEstoqueModel; custo_saida: number }> {
    const estoque_anterior_dec = new Decimal(
      produto.estoque_atual as unknown as string
    );
    const custo_medio_unitario_dec = new Decimal(
      produto.preco_custo_unitario as unknown as string
    );
    const qtd_saida_dec = new Decimal(qtd_saida);

    if (estoque_anterior_dec.lessThan(qtd_saida_dec)) {
      throw new Error(
        `Estoque insuficiente para o produto ${
          produto.nome
        }. Disponível: ${estoque_anterior_dec.toFixed(
          3
        )}, Requerido: ${qtd_saida_dec.toFixed(3)}.`
      );
    }

    const custo_saida_dec = qtd_saida_dec.times(custo_medio_unitario_dec);
    const novo_estoque_dec = estoque_anterior_dec.minus(qtd_saida_dec);

    // 1. Atualiza o Produto
    await produto.update(
      {
        estoque_atual: novo_estoque_dec.toNumber(),
      },
      { transaction }
    );

    // 2. Registra o Movimento (Delegação)
    const custoTotalSaida = custo_saida_dec.toNumber();

    const registroMovimento: EstoqueRegistroMovimentoCreationAttributes = {
      id_produto: produto.id_produto,
      // Usamos o TipoMovimentoEstoque importado
      tipo_movimento: tipo_movimento,
      quantidade: qtd_saida_dec.toNumber(),
      // Preço de custo unitário usado no momento (custo médio)
      custo_unitario: custo_medio_unitario_dec.toNumber(),
      custo_total: custoTotalSaida,
      data_movimento: new Date(),
      referencia_documento: referencia_origem || `SAÍDA - ${observacoes}`,
      id_origem: null,
      tipo_origem: null,
    };

    // 🔑 Delegação para o EstoqueMovimentoService para registrar o histórico
    await this.movimentoService.registrarMovimento(
      registroMovimento,
      transaction
    );

    return { produto, custo_saida: custoTotalSaida };
  }
}
