// src/controllers/EstoqueItemController.ts (CORRIGIDO)

import { Request, Response } from "express";
import { z } from "zod";
import { EstoqueItemService } from "../services/EstoqueItemService";
import { connection } from "../config/sequelize"; // 🔑 Importado para gerenciar a transação

// Esquemas de validação Zod
const itemEstoqueSchema = z.object({
  nome: z.string().min(3, "O nome deve ter pelo menos 3 caracteres."),
  unidade_medida: z
    .string()
    .length(3, "A unidade de medida deve ter 3 caracteres (ex: 'KG', 'UN')."),
  estoque_minimo: z
    .number()
    .nonnegative("Estoque mínimo deve ser não negativo."),
  preco_custo_unitario: z
    .number()
    .nonnegative("Preço de custo deve ser não negativo.")
    .optional(),
});

const receberEstoqueSchema = z.object({
  id_produto: z.number().int().positive(),
  quantidade: z.number().positive("A quantidade deve ser positiva."),
  preco_custo_unitario: z
    .number()
    .positive("O preço de custo unitário deve ser positivo."),
  descricao: z
    .string()
    .min(5, "A descrição do recebimento deve ser detalhada."),
  referencia: z
    .string()
    .min(5, "A referência do documento deve ser fornecida."),
});

const saidaEstoqueSchema = z.object({
  id_produto: z.number().int().positive(),
  quantidade: z.number().positive("A quantidade de saída deve ser positiva."),
  descricao: z.string().min(5, "A descrição da saída deve ser detalhada."),
  referencia: z
    .string()
    .min(5, "A referência do documento deve ser fornecida."),
});

class EstoqueItemController {
  private service: EstoqueItemService;

  constructor() {
    this.service = new EstoqueItemService(connection as any);
  }

  /**
   * 🔑 CRIAÇÃO (store) - Corrigindo TS2339 (create)
   */
  async store(req: Request, res: Response): Promise<Response> {
    try {
      const data = itemEstoqueSchema.parse(req.body);
      // ✅ Chamada do método 'create'
      const produto = await this.service.create(data as any);
      return res.status(201).json(produto);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Dados inválidos.", details: error.issues });
      }
      return res.status(500).json({
        error: "Erro ao criar Item de Estoque.",
        details: (error as Error).message,
      });
    }
  }

  /**
   * 🔑 LEITURA (index) - Corrigindo TS2339 (findAll)
   */
  async index(req: Request, res: Response): Promise<Response> {
    try {
      // ✅ Chamada do método 'findAll'
      const produtos = await this.service.findAll();
      return res.status(200).json(produtos);
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Erro ao listar Itens de Estoque." });
    }
  }

  /**
   * 🔑 LEITURA POR ID (show) - Corrigindo TS2339 (findById)
   */
  async show(req: Request, res: Response): Promise<Response> {
    const id_produto = parseInt(req.params.id_produto, 10);
    if (isNaN(id_produto))
      return res.status(400).json({ error: "ID inválido." });

    try {
      // ✅ Chamada do método 'findById'
      const produto = await this.service.findById(id_produto);
      if (!produto) {
        return res.status(404).json({ error: "Produto não encontrado." });
      }
      return res.status(200).json(produto);
    } catch (error) {
      return res.status(500).json({ error: "Erro ao buscar Item de Estoque." });
    }
  }

  /**
   * 🔑 ATUALIZAÇÃO (update) - Corrigindo TS2339 (update)
   */
  async update(req: Request, res: Response): Promise<Response> {
    const id_produto = parseInt(req.params.id_produto, 10);
    if (isNaN(id_produto))
      return res.status(400).json({ error: "ID inválido." });

    try {
      const updates = itemEstoqueSchema.partial().parse(req.body);

      // ✅ Chamada do método 'update'
      const produtoAtualizado = await this.service.update(
        id_produto,
        updates as any
      );

      return res.status(200).json(produtoAtualizado);
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Erro ao atualizar Item de Estoque." });
    }
  }

  /**
   * 🔑 ENTRADA/RECEBIMENTO - Corrigindo TS2554 (receberEstoque)
   */
  async receberEstoque(req: Request, res: Response): Promise<Response> {
    const transaction = await connection.transaction(); // 🔑 Inicia a transação
    try {
      const data = receberEstoqueSchema.parse(req.body);

      // Busca o modelo do produto (pois o service precisa dele)
      const produtoModel = await this.service.findById(data.id_produto);
      if (!produtoModel) throw new Error("Produto não encontrado.");

      const dataParaService = {
        produto: produtoModel,
        quantidade: data.quantidade,
        preco_custo_unitario: data.preco_custo_unitario,
        descricao: data.descricao,
        referencia: data.referencia,
      };

      // ✅ CORREÇÃO DO ERRO 2554: Passa os 2 argumentos (data + transaction)
      await this.service.receberEstoque(dataParaService as any, transaction);

      await transaction.commit(); // Confirma a transação
      return res
        .status(200)
        .json({ message: "Estoque recebido com sucesso e CMP atualizado." });
    } catch (error) {
      await transaction.rollback(); // Desfaz em caso de erro
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Dados inválidos.", details: error.issues });
      }
      return res.status(500).json({
        error: "Erro ao processar recebimento de estoque.",
        details: (error as Error).message,
      });
    }
  }

  /**
   * 🔑 SAÍDA (saidaEstoque) - Corrigindo TS2339 (saidaEstoque)
   */
  async saidaEstoque(req: Request, res: Response): Promise<Response> {
    const transaction = await connection.transaction(); // 🔑 Inicia a transação
    try {
      const data = saidaEstoqueSchema.parse(req.body);

      // ✅ Chamada do método 'saidaEstoque' e passa os 2 argumentos (data + transaction)
      const { produto, custo_saida } = await this.service.saidaEstoque(
        data,
        transaction
      );

      await transaction.commit(); // Confirma a transação
      return res.status(200).json({
        message: "Saída de estoque registrada com sucesso.",
        id_produto: produto.id_produto,
        estoque_atual: produto.estoque_atual,
        custo_total: custo_saida,
      });
    } catch (error) {
      await transaction.rollback(); // Desfaz em caso de erro
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Dados inválidos.", details: error.issues });
      }
      return res.status(500).json({
        error: "Erro ao processar saída de estoque.",
        details: (error as Error).message,
      });
    }
  }
}

export default new EstoqueItemController();
