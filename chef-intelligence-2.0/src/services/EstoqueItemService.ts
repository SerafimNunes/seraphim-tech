// src/services/EstoqueItemService.ts (REFACTORADO PARA USAR ESTOQUE SERVICE)

import { Transaction, Sequelize, Op } from 'sequelize';
import { connection } from '../config/sequelize';
import ItemEstoque, {
  ItemEstoqueModel,
  ItemEstoqueCreationAttributes,
} from '../models/ItemEstoque';
// ❌ REMOVIDO: Nã precisa mais registrar movimento aqui.
// import EstoqueRegistroMovimento, {...} from "../models/EstoqueRegistroMovimento";

// 🔑 Importa o Service de baixo nível
import { EstoqueService, SaidaEstoqueResult } from './EstoqueService';
// 🔑 CORREÇÃO TS2305: MovimentoPayload foi exportado no EstoqueService.ts
import { MovimentoPayload, TipoMovimentoEstoque } from './EstoqueService';

// Interfaces de dados (Mantidas, mas o Service as usa como Payloads de entrada)
interface ReceberEstoquePayload {
  id_produto: number;
  quantidade: number;
  preco_custo_unitario: number;
  descricao: string;
  referencia: string;
  colaborador_id: number; // 🔑 CORRIGIDO TS2345: Tornando colaborador_id obrigatório
}

interface SaidaEstoquePayload {
  id_produto: number;
  quantidade: number;
  descricao: string;
  referencia: string;
  colaborador_id: number; // 🔑 CORRIGIDO TS2345: Tornando colaborador_id obrigatório
}

// 🔑 CORRIGIDO: SaidaResult agora usa o tipo exportado de EstoqueService
interface SaidaResult extends SaidaEstoqueResult {
  produto: ItemEstoqueModel;
}

export class EstoqueItemService {
  private estoqueService: EstoqueService; /**
   * 🔑 REGRA 1.A: Injeção de Dependência do EstoqueService (Service de Baixo Nível).
   */

  constructor(estoqueService = new EstoqueService()) {
    this.estoqueService = estoqueService;
  } // --- MÉTODOS CRUD (Mantidos, pois são responsabilidade de ItemEstoque) ---

  public async create(
    data: ItemEstoqueCreationAttributes,
  ): Promise<ItemEstoqueModel> {
    return ItemEstoque.create(data as any);
  }

  public async findAll(): Promise<ItemEstoqueModel[]> {
    return ItemEstoque.findAll({
      attributes: [
        'id_produto',
        'nome',
        'estoque_atual',
        'unidade_medida',
        'preco_custo_unitario',
      ],
    });
  }

  public async findById(id_produto: number): Promise<ItemEstoqueModel | null> {
    return ItemEstoque.findByPk(id_produto);
  }

  public async update(
    id_produto: number,
    updates: Partial<ItemEstoqueModel>,
  ): Promise<ItemEstoqueModel> {
    const produto = await this.findById(id_produto);
    if (!produto) {
      throw new Error('Produto não encontrado.');
    }
    await produto.update(updates as any);
    return produto;
  } // ---------------------------------------------------
  /**
   * 🔑 ENTRADA/RECEBIMENTO: ORQUESTRAÇÃO TRANSACIONAL.
   * Responsável por: 1. Iniciar Transação (se não houver). 2. Buscar Produto com Lock. 3. Delegar a lógica de CMP.
   */
  public async receberEstoque(
    payload: ReceberEstoquePayload,
    transaction?: Transaction,
  ): Promise<ItemEstoqueModel> {
    const manageTransaction = async (t: Transaction) => {
      const {
        id_produto,
        quantidade,
        preco_custo_unitario,
        descricao,
        referencia,
        colaborador_id, // Garantido como 'number' pelo Payload corrigido
      } = payload;

      const produto = (await ItemEstoque.findByPk(id_produto, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      })) as ItemEstoqueModel | null;

      if (!produto) {
        throw new Error(
          `Produto com ID ${id_produto} não encontrado para recebimento.`,
        );
      } // 🔑 CHAMADA CORRIGIDA (Linha 115)
      // colaborador_id agora é number e não undefined
      return this.estoqueService.entradaEstoque(
        produto,
        quantidade,
        preco_custo_unitario,
        produto.unidade_id, // 🔑 R4: Passando a unidade_id do produto
        'ENTRADA' as TipoMovimentoEstoque, // 🔑 CORRIGIDO: Passa o tipo corretamente
        descricao,
        referencia,
        colaborador_id,
        t,
      );
    };

    if (transaction) {
      return manageTransaction(transaction);
    } else {
      const t = await connection.transaction();
      try {
        const result = await manageTransaction(t);
        await t.commit();
        return result;
      } catch (error) {
        await t.rollback();
        throw error;
      }
    }
  } /**
   * 🔑 SAÍDA DE ESTOQUE: ORQUESTRAÇÃO TRANSACIONAL.
   * Responsável por: 1. Iniciar Transação. 2. Buscar Produto com Lock. 3. Delegar a lógica de Saída.
   */

  public async saidaEstoque(
    payload: SaidaEstoquePayload,
  ): Promise<SaidaResult> {
    const transaction = await connection.transaction();
    try {
      const {
        id_produto,
        quantidade: qtd_saida,
        descricao,
        referencia,
        colaborador_id, // Garantido como 'number' pelo Payload corrigido
      } = payload;

      const produto = (await ItemEstoque.findByPk(id_produto, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      })) as ItemEstoqueModel | null;

      if (!produto) {
        throw new Error(
          `Produto com ID ${id_produto} não encontrado para saída.`,
        );
      } // 🔑 CHAMADA CORRIGIDA (Linha 168)
      // colaborador_id agora é number e não undefined
      const saidaResult = await this.estoqueService.saidaEstoque(
        produto, // Model Produto
        qtd_saida,
        produto.unidade_id, // 🔑 R4: Passando a unidade_id do produto
        'AJUSTE_SAIDA' as TipoMovimentoEstoque, // 🔑 CORRIGIDO: Tipo de movimento (4º argumento)
        descricao,
        referencia,
        colaborador_id,
        transaction, // Passa a transação para o EstoqueService
      );

      await transaction.commit();
      return {
        produto,
        custo_saida: saidaResult.custo_saida,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
