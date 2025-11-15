// src/services/EstoqueService.ts (Novo Serviço Compartilhado)

import { Transaction } from "sequelize";
import ItemEstoque, { ItemEstoqueModel } from "../models/ItemEstoque";
import EstoqueRegistroMovimento, {
  EstoqueRegistroMovimentoCreationAttributes,
} from "../models/EstoqueRegistroMovimento";
import { Op } from "sequelize";

// Interface de tipagem para reutilização
export interface MovimentoPayload {
  id_produto: number;
  tipo_movimento:
    | "ENTRADA"
    | "SAIDA"
    | "AJUSTE_SOBRA"
    | "AJUSTE_PERDA"
    | "PRODUCAO_ENTRADA"; // PROD_ENTRADA para clareza
  quantidade: number;
  preco_custo_unitario_momento?: number; // Opcional, usado apenas na ENTRADA
  observacoes?: string;
  referencia_origem?: string | null;
}

export class EstoqueService {
  /**
   * @param produto O Model Produto (ItemEstoque) já carregado.
   * @param qtd_entrada A quantidade que está entrando.
   * @param novo_custo_unitario O preço de compra/produção unitário do item (se for ENTRADA).
   * @param observacoes Observações para o log.
   * @param transaction Transação atual.
   * @returns O novo ItemEstoqueModel com os dados atualizados.
   */
  public async entradaEstoque(
    produto: ItemEstoqueModel,
    qtd_entrada: number,
    novo_custo_unitario: number, // Usado para recalcular o CMV
    observacoes: string,
    referencia_origem: string | null,
    transaction: Transaction
  ): Promise<ItemEstoqueModel> {
    const estoque_anterior = parseFloat(
      produto.estoque_atual as unknown as string
    );
    const custo_medio_unitario_anterior = parseFloat(
      produto.preco_custo_unitario as unknown as string
    );
    const qtd_total_anterior = estoque_anterior;

    // 1. Recálculo do Custo Médio Ponderado (CMP)
    // Custo Total Anterior = Qtd Antiga * Custo Médio Antigo
    const custo_total_anterior =
      qtd_total_anterior * custo_medio_unitario_anterior;

    // Custo Total da Nova Entrada = Qtd Nova * Custo Unitário Novo
    const custo_entrada = qtd_entrada * novo_custo_unitario;

    // Novo Custo Total e Nova Quantidade
    const novo_custo_total = custo_total_anterior + custo_entrada;
    const nova_quantidade = qtd_total_anterior + qtd_entrada;

    // Novo Custo Médio Ponderado (CMP)
    let novo_custo_medio_unitario = 0;
    if (nova_quantidade > 0) {
      novo_custo_medio_unitario = novo_custo_total / nova_quantidade;
    }

    const novo_estoque = nova_quantidade;
    const custo_movimento = novo_custo_unitario; // Custo do item que está entrando

    // 2. Atualiza o Produto (ItemEstoque)
    await produto.update(
      {
        estoque_atual: novo_estoque,
        preco_custo_unitario: novo_custo_medio_unitario, // O CMP foi alterado
      },
      { transaction }
    );

    // 3. Registra o Movimento de Estoque (Audit Log)
    const registroMovimento: EstoqueRegistroMovimentoCreationAttributes = {
      id_produto: produto.id_produto,
      tipo_movimento: "ENTRADA", // Tipo de movimento de estoque
      quantidade: qtd_entrada,
      preco_custo_unitario_momento: custo_movimento,
      custo_total_movimento: custo_entrada, // Custo da ENTRADA
      estoque_anterior: estoque_anterior,
      estoque_atual: novo_estoque,
      observacoes: observacoes,
      referencia_origem: referencia_origem,
    };

    await EstoqueRegistroMovimento.create(registroMovimento, { transaction });

    return produto;
  }

  /**
   * @param produto O Model Produto (ItemEstoque) já carregado.
   * @param qtd_saida A quantidade que está saindo.
   * @param observacoes Observações para o log.
   * @param transaction Transação atual.
   * @returns O novo ItemEstoqueModel com os dados atualizados.
   */
  public async saidaEstoque(
    produto: ItemEstoqueModel,
    qtd_saida: number,
    observacoes: string,
    referencia_origem: string | null,
    transaction: Transaction
  ): Promise<{ produto: ItemEstoqueModel; custo_saida: number }> {
    const estoque_anterior = parseFloat(
      produto.estoque_atual as unknown as string
    );
    const custo_medio_unitario = parseFloat(
      produto.preco_custo_unitario as unknown as string
    );

    if (estoque_anterior < qtd_saida) {
      throw new Error(
        `Estoque insuficiente para o produto ${produto.nome}. Disponível: ${estoque_anterior}, Requerido: ${qtd_saida}.`
      );
    }

    // 1. Cálculo da Saída
    // A saída utiliza o Custo Médio Ponderado atual (FIFO/LIFO não implementados)
    const custo_saida = qtd_saida * custo_medio_unitario;
    const novo_estoque = estoque_anterior - qtd_saida;

    // 2. Atualiza o Produto (ItemEstoque)
    await produto.update(
      {
        estoque_atual: novo_estoque,
        // O preco_custo_unitario (CMP) não muda na SAÍDA
      },
      { transaction }
    );

    // 3. Registra o Movimento de Estoque (Audit Log)
    const registroMovimento: EstoqueRegistroMovimentoCreationAttributes = {
      id_produto: produto.id_produto,
      tipo_movimento: "SAIDA", // Tipo de movimento de estoque
      quantidade: qtd_saida,
      preco_custo_unitario_momento: custo_medio_unitario,
      custo_total_movimento: custo_saida, // Custo da SAÍDA (CMV)
      estoque_anterior: estoque_anterior,
      estoque_atual: novo_estoque,
      observacoes: observacoes,
      referencia_origem: referencia_origem,
    };

    await EstoqueRegistroMovimento.create(registroMovimento, { transaction });

    return { produto, custo_saida };
  }
}
