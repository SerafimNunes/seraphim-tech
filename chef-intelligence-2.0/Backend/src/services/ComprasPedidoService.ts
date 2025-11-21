// src/services/ComprasPedidoService.ts

import { Transaction, Op, literal } from 'sequelize';
import { connection } from '../config/sequelize';
import ComprasPedido, {
  ComprasPedidoModel,
  ComprasPedidoCreationAttributes,
} from '../models/ComprasPedido';
import ComprasItemPedido, {
  ComprasItemPedidoModel,
  StatusQualidade,
} from '../models/ComprasItemPedido';
import ItemEstoque, { ItemEstoqueModel } from '../models/ItemEstoque';
import { EstoqueItemService } from './EstoqueItemService';
import FiscalService from './FiscalService';
import LancamentoService from './LancamentoService';

// Payload para Recebimento (mantido da versão anterior)
interface RecebimentoPayload {
  numero_documento: string;
  data_emissao: Date;
  imposto_simples: number;
  cst_cfop_padrao: string;
  observacoes_fisco?: string;
  chave_acesso_nfe?: string;
  itens_recebidos: Array<{
    id_item_pedido: number;
    quantidade_recebida: number;
    preco_custo_unitario_real: number;
    status_qualidade: StatusQualidade;
  }>;
}

export class ComprasPedidoService {
  private estoqueService: EstoqueItemService;
  private fiscalService: FiscalService;
  private lancamentoService: LancamentoService;

  constructor(
    fiscalService?: FiscalService,
    estoqueService?: EstoqueItemService,
    lancamentoService?: LancamentoService,
  ) {
    // 🔑 CORREÇÃO 1: Dependência de EstoqueItemService.
    this.estoqueService = estoqueService || new EstoqueItemService();
    this.fiscalService = fiscalService || new FiscalService();
    this.lancamentoService = lancamentoService || new LancamentoService();
  }

  public async createQuotation(
    colaboradorId: number,
    itens: Array<{ id_produto: number; quantidade: number }>,
  ): Promise<ComprasPedidoModel> {
    const transaction: Transaction = await connection.transaction();
    try {
      const pedido = await ComprasPedido.create(
        {
          id_fornecedor: 1,
          colaborador_id_sugestao: colaboradorId,
          status_aprovacao: 'EM_COTACAO',
          valor_total_previsto: 0,
        } as any,
        { transaction },
      );

      const itensCota = itens.map((item) => ({
        id_pedido: pedido.id_pedido,
        id_produto: item.id_produto,
        quantidade_prevista: item.quantidade,
        preco_custo_unitario_previsto: 0,
        status_qualidade: 'PENDENTE',
      }));

      await ComprasItemPedido.bulkCreate(itensCota as any, { transaction });
      await transaction.commit();
      return pedido;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } /**
   * CRÍTICO (R5, R3, R8) - Processa o recebimento do pedido de compra e o Controle de Qualidade.
   */

  public async receberInsumos(
    id_pedido: number,
    payload: RecebimentoPayload,
  ): Promise<ComprasPedidoModel> {
    const transaction: Transaction = await connection.transaction();

    try {
      const pedido = (await ComprasPedido.findByPk(id_pedido, {
        transaction,
        lock: transaction.LOCK.UPDATE,
        include: [
          {
            model: ComprasItemPedido,
            as: 'itens',
          },
        ],
      })) as ComprasPedidoModel | null;

      if (!pedido || pedido.status_aprovacao !== 'APROVADO') {
        throw new Error(
          "Pedido não encontrado ou não está no status 'APROVADO'.",
        );
      }

      let valorTotalRecebido = 0;

      for (const itemRecebido of payload.itens_recebidos) {
        const itemPedido = pedido.itens?.find(
          (i: ComprasItemPedidoModel) =>
            i.id_item_pedido === itemRecebido.id_item_pedido,
        );

        if (!itemPedido) continue;

        if (itemRecebido.status_qualidade === 'APROVADO') {
          const produto = await ItemEstoque.findByPk(itemPedido.id_produto, {
            transaction,
          });

          if (produto) {
            // 🔑 CORREÇÃO TS2345 (Linha 130): Adicionar o 'colaborador_id' obrigatório.
            await this.estoqueService.receberEstoque(
              {
                id_produto: produto.id_produto,
                quantidade: itemRecebido.quantidade_recebida,
                preco_custo_unitario: itemRecebido.preco_custo_unitario_real,
                descricao: `Entrada por Compra Pedido #${id_pedido} (Aprovado na Qualidade)`,
                referencia: `COMPRA#${id_pedido}`,
                colaborador_id: pedido.colaborador_id_sugestao, // 👈 ID do colaborador que sugeriu/aprovou o pedido.
              },
              transaction,
            );
          }
        }

        await itemPedido.update(
          {
            quantidade_recebida: itemRecebido.quantidade_recebida,
            preco_custo_unitario_real: itemRecebido.preco_custo_unitario_real,
            status_qualidade: itemRecebido.status_qualidade,
          },
          { transaction },
        );

        valorTotalRecebido +=
          itemRecebido.quantidade_recebida *
          itemRecebido.preco_custo_unitario_real;
      }

      await pedido.update(
        {
          status_aprovacao: 'FINALIZADO',
          valor_total_previsto: valorTotalRecebido,
        },
        { transaction },
      );

      await this.fiscalService.createAutomaticFiscalRecord(
        {
          id_origem: id_pedido,
          tipo_origem: 'COMPRA',
          numero_documento: payload.numero_documento,
          valor_total: valorTotalRecebido,
        } as any,
        transaction,
      );

      await transaction.commit();
      return pedido;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  public async suggestItemsBelowMin() {
    /* ... */ return [];
  }
  public async index(filters: any) {
    /* ... */ return [];
  }
}
