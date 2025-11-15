// src/services/EstoqueItemService.ts

import { Transaction, Sequelize } from "sequelize";
// Ajuste os imports dos modelos conforme seu projeto
import { ItemEstoqueModel } from "../models/ItemEstoque";
// import EstoqueRegistroMovimento, { EstoqueRegistroMovimentoCreationAttributes } from "../models/EstoqueRegistroMovimento";

// Interface de dados que é passada como o primeiro argumento para receberEstoque
interface ReceberEstoqueData {
  produto: ItemEstoqueModel;
  quantidade: number;
  preco_custo_unitario: number;
  descricao: string;
  referencia: string;
}

export class EstoqueItemService {
  private dbConnection: Sequelize;

  // 🔑 CORREÇÃO DO ERRO 2554 (CONSTRUTOR): Agora aceita 1 argumento (o objeto de conexão)
  constructor(sequelize: Sequelize) {
    this.dbConnection = sequelize;
  }

  /**
   * Processa a entrada de estoque, recalcula o Custo Médio Ponderado (CMP) e registra o movimento.
   * 🔑 CORREÇÃO DO ERRO 2554 (MÉTODO): Assinatura refatorada para aceitar (Data Object, Transaction)
   * * @param data Objeto contendo os dados do recebimento. (1º Argumento)
   * @param transaction Transação ativa. (2º Argumento)
   */
  public async receberEstoque(
    data: ReceberEstoqueData,
    transaction: Transaction
  ) {
    const { produto, quantidade, preco_custo_unitario } = data;

    // ** (Lógica de CMP e atualização do produto) **
    const estoque_anterior = parseFloat(
      produto.getDataValue("estoque_atual") as unknown as string
    );
    const custo_medio_unitario_anterior = parseFloat(
      produto.getDataValue("preco_custo_unitario") as unknown as string
    );

    const valor_total_anterior =
      estoque_anterior * custo_medio_unitario_anterior;
    const valor_total_novo_insumo = quantidade * preco_custo_unitario;

    const novo_estoque = estoque_anterior + quantidade;
    const novo_custo_medio_ponderado =
      novo_estoque > 0
        ? (valor_total_anterior + valor_total_novo_insumo) / novo_estoque
        : 0;

    await produto.update(
      {
        estoque_atual: novo_estoque,
        preco_custo_unitario: novo_custo_medio_ponderado,
      },
      { transaction }
    );

    // ** (Lógica de Registro de Movimento aqui) **
  }
}
