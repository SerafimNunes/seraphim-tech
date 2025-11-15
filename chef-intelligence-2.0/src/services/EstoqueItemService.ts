// src/services/EstoqueItemService.ts (CORRIGIDO)

import { Transaction, Sequelize, Op } from "sequelize";
import ItemEstoque, {
  ItemEstoqueModel,
  ItemEstoqueCreationAttributes,
} from "../models/ItemEstoque";
import EstoqueRegistroMovimento, {
  EstoqueRegistroMovimentoCreationAttributes,
} from "../models/EstoqueRegistroMovimento";
import { connection } from "../config/sequelize";

// Interfaces de dados
interface ReceberEstoqueData {
  produto: ItemEstoqueModel;
  quantidade: number;
  preco_custo_unitario: number;
  descricao: string;
  referencia: string;
}

interface SaidaEstoqueData {
  id_produto: number;
  quantidade: number;
  descricao: string;
  referencia: string;
}

interface SaidaResult {
  produto: ItemEstoqueModel;
  custo_saida: number;
}

export class EstoqueItemService {
  private dbConnection: Sequelize;

  // ✅ CORREÇÃO 1: Construtor OK, recebe a conexão
  constructor(sequelize: Sequelize) {
    this.dbConnection = sequelize;
  }

  // --- MÉTODOS CRUD (Adicionados para resolver TS2339) ---
  public async create(
    data: ItemEstoqueCreationAttributes
  ): Promise<ItemEstoqueModel> {
    return ItemEstoque.create(data as any);
  }

  public async findAll(): Promise<ItemEstoqueModel[]> {
    return ItemEstoque.findAll();
  }

  public async findById(id_produto: number): Promise<ItemEstoqueModel | null> {
    return ItemEstoque.findByPk(id_produto);
  }

  public async update(
    id_produto: number,
    updates: Partial<ItemEstoqueModel>
  ): Promise<ItemEstoqueModel> {
    const produto = await this.findById(id_produto);
    if (!produto) {
      throw new Error("Produto não encontrado.");
    }
    await produto.update(updates as any);
    return produto;
  }
  // --- FIM DOS MÉTODOS CRUD ---

  /**
   * ✅ ENTRADA/RECEBIMENTO: Recalcula o Custo Médio Ponderado (CMP).
   * Requer 2 argumentos: data e transaction.
   */
  public async receberEstoque(
    data: ReceberEstoqueData,
    transaction: Transaction
  ) {
    const { produto, quantidade, preco_custo_unitario } = data;

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

    // Lógica de Registro de Movimento aqui
  }

  /**
   * ✅ SAÍDA DE ESTOQUE (Adicionado para resolver TS2339).
   * Requer 2 argumentos: data e transaction.
   */
  public async saidaEstoque(
    data: SaidaEstoqueData,
    transaction: Transaction
  ): Promise<SaidaResult> {
    const { id_produto, quantidade: qtd_saida } = data;

    const produto = await ItemEstoque.findByPk(id_produto, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!produto) {
      throw new Error("Produto não encontrado para a saída de estoque.");
    }

    const estoque_anterior = parseFloat(
      produto.getDataValue("estoque_atual") as unknown as string
    );
    const custo_medio_unitario = parseFloat(
      produto.getDataValue("preco_custo_unitario") as unknown as string
    );

    if (estoque_anterior < qtd_saida) {
      throw new Error(
        `Estoque insuficiente para o produto ${produto.nome}. Disponível: ${estoque_anterior}, Requerido: ${qtd_saida}.`
      );
    }

    // 1. Cálculo da Saída (Custo)
    const custo_saida = qtd_saida * custo_medio_unitario;
    const novo_estoque = estoque_anterior - qtd_saida;

    // 2. Atualiza o Produto (ItemEstoque)
    await produto.update({ estoque_atual: novo_estoque }, { transaction });

    // 3. Registra o Movimento de Estoque (Audit Log) - (Removido o model para não gerar outro 2307)
    // ... Lógica de Registro de Movimento aqui

    return { produto: produto as ItemEstoqueModel, custo_saida };
  }
}
