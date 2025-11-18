// src/services/EstoqueItemService.ts (REFACTORADO PARA USAR ESTOQUE SERVICE)

import { Transaction, Sequelize, Op } from "sequelize";
import { connection } from "../config/sequelize";
import ItemEstoque, {
  ItemEstoqueModel,
  ItemEstoqueCreationAttributes,
} from "../models/ItemEstoque";
// ❌ REMOVIDO: Nã precisa mais registrar movimento aqui.
// import EstoqueRegistroMovimento, {...} from "../models/EstoqueRegistroMovimento";

// 🔑 Importa o Service de baixo nível
import { EstoqueService } from "./EstoqueService";
import { MovimentoPayload } from "./EstoqueService"; // Para reuso de tipos

// Interfaces de dados (Mantidas, mas o Service as usa como Payloads de entrada)
interface ReceberEstoquePayload {
  id_produto: number;
  quantidade: number;
  preco_custo_unitario: number;
  descricao: string;
  referencia: string;
  colaborador_id?: number; // Adicionado para auditoria
}

interface SaidaEstoquePayload {
  id_produto: number;
  quantidade: number;
  descricao: string;
  referencia: string;
  colaborador_id?: number; // Adicionado para auditoria
}

interface SaidaResult {
  produto: ItemEstoqueModel;
  custo_saida: number;
}

export class EstoqueItemService {
  private estoqueService: EstoqueService;

  /**
   * 🔑 REGRA 1.A: Injeção de Dependência do EstoqueService (Service de Baixo Nível).
   */
  constructor(estoqueService = new EstoqueService()) {
    this.estoqueService = estoqueService;
  }

  // --- MÉTODOS CRUD (Mantidos, pois são responsabilidade de ItemEstoque) ---

  public async create(
    data: ItemEstoqueCreationAttributes
  ): Promise<ItemEstoqueModel> {
    return ItemEstoque.create(data as any);
  }

  public async findAll(): Promise<ItemEstoqueModel[]> {
    return ItemEstoque.findAll({
      attributes: [
        "id_produto",
        "nome",
        "estoque_atual",
        "unidade_medida",
        "preco_custo_unitario",
      ],
    });
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
  // ---------------------------------------------------

  /**
   * 🔑 ENTRADA/RECEBIMENTO: ORQUESTRAÇÃO TRANSACIONAL.
   * Responsável por: 1. Iniciar Transação. 2. Buscar Produto com Lock. 3. Delegar a lógica de CMP.
   */
  public async receberEstoque(
    payload: ReceberEstoquePayload
  ): Promise<ItemEstoqueModel> {
    const {
      id_produto,
      quantidade,
      preco_custo_unitario,
      descricao,
      referencia,
      colaborador_id,
    } = payload;
    let transaction: Transaction | null = null;

    try {
      // 1. INÍCIO DA TRANSAÇÃO (Responsabilidade do Service Orquestrador)
      transaction = await connection.transaction({
        isolationLevel: (Sequelize as any).Transaction.ISOLATION_LEVELS
          .SERIALIZABLE,
      });

      // 2. Busca do Produto com Lock (Responsabilidade do Service Orquestrador)
      const produto = (await ItemEstoque.findByPk(id_produto, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      })) as ItemEstoqueModel | null;

      if (!produto) {
        throw new Error(
          `Produto com ID ${id_produto} não encontrado para recebimento.`
        );
      }

      // 3. 🔑 DELEGAÇÃO: Chama o EstoqueService para fazer o CMP, atualização e registro.
      const produtoAtualizado = await this.estoqueService.entradaEstoque(
        produto, // Model Produto
        quantidade,
        preco_custo_unitario, // custo_entrada_unitario
        "ENTRADA", // tipo_movimento
        descricao,
        referencia,
        colaborador_id,
        transaction // Passa a transação para o EstoqueService
      );

      // 4. Commit
      await transaction.commit();
      return produtoAtualizado;
    } catch (error) {
      // 5. Rollback
      if (transaction) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  /**
   * 🔑 SAÍDA DE ESTOQUE: ORQUESTRAÇÃO TRANSACIONAL.
   * Responsável por: 1. Iniciar Transação. 2. Buscar Produto com Lock. 3. Delegar a lógica de Saída.
   */
  public async saidaEstoque(
    payload: SaidaEstoquePayload
  ): Promise<SaidaResult> {
    const {
      id_produto,
      quantidade: qtd_saida,
      descricao,
      referencia,
      colaborador_id,
    } = payload;
    let transaction: Transaction | null = null;

    try {
      // 1. INÍCIO DA TRANSAÇÃO
      transaction = await connection.transaction({
        isolationLevel: (Sequelize as any).Transaction.ISOLATION_LEVELS
          .SERIALIZABLE,
      });

      // 2. Busca do Produto com Lock
      const produto = (await ItemEstoque.findByPk(id_produto, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      })) as ItemEstoqueModel | null;

      if (!produto) {
        throw new Error(
          `Produto com ID ${id_produto} não encontrado para saída.`
        );
      }

      // 3. 🔑 DELEGAÇÃO: Chama o EstoqueService para fazer o cálculo de CMV, atualização e registro.
      const saidaResult = await this.estoqueService.saidaEstoque(
        produto, // Model Produto
        qtd_saida,
        "AJUSTE_SAIDA", // 🔑 CORRIGIDO: Deve usar um tipo de movimento válido, como "AJUSTE_SAIDA" para saídas genéricas.
        descricao,
        referencia,
        colaborador_id,
        transaction // Passa a transação para o EstoqueService
      );

      // 4. Commit
      await transaction.commit();
      return saidaResult;
    } catch (error) {
      // 5. Rollback
      if (transaction) {
        await transaction.rollback();
      }
      throw error;
    }
  }
}
