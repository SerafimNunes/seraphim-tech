// src/controllers/EstoqueItemController.ts (REFACTORADO)

import { Request, Response } from "express";
import { z } from "zod";
import { EstoqueItemService } from "../services/EstoqueItemService";
// ❌ REMOVIDO: A conexão do Sequelize NÃO DEVE ser importada no Controller (Viola 1.D)
// import { connection } from "../config/sequelize";

// --- Esquemas de validação Zod (Mantido, Regra 1.B OK) ---
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
// ---------------------------------------------------------

class EstoqueItemController {
  /**
   * 🔑 REGRAS 1.A (Injeção de Dependência): Injeção simplificada no construtor.
   * Remove a dependência de 'connection' do construtor, pois o Service não deve
   * mais ser inicializado com ela.
   */
  constructor(private service: EstoqueItemService) {
    // O Service não é mais inicializado aqui. A injeção é feita na exportação.
  } // --- MÉTODOS CRUD (store, index, show, update) ---

  async store(req: Request, res: Response): Promise<Response> {
    try {
      const data = itemEstoqueSchema.parse(req.body);
      const produto = await this.service.create(data as any);
      return res.status(201).json(produto); // Regra 1.E (201 para POST)
    } catch (error) {
      // 🔑 REGRA 1.C: Tratamento de erros unificado.
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({
            error: "Dados de entrada inválidos.",
            details: error.issues,
          });
      }
      console.error("❌ Erro no Controller (store ItemEstoque):", error);
      return res.status(500).json({
        error: "Erro interno do servidor ao criar Item de Estoque.",
        details: (error as Error).message,
      });
    }
  }

  async index(req: Request, res: Response): Promise<Response> {
    try {
      const produtos = await this.service.findAll();
      return res.status(200).json(produtos);
    } catch (error) {
      // 🔑 REGRA 1.C: Tratamento de erros unificado.
      console.error("❌ Erro no Controller (index ItemEstoque):", error);
      return res
        .status(500)
        .json({
          error: "Erro interno do servidor ao listar Itens de Estoque.",
          details: (error as Error).message,
        });
    }
  }

  async show(req: Request, res: Response): Promise<Response> {
    const id_produto = parseInt(req.params.id_produto, 10);
    if (isNaN(id_produto)) {
      return res.status(400).json({ error: "ID de produto inválido." });
    }

    try {
      const produto = await this.service.findById(id_produto);
      if (!produto) {
        return res.status(404).json({ error: "Produto não encontrado." });
      }
      return res.status(200).json(produto);
    } catch (error) {
      // 🔑 REGRA 1.C: Tratamento de erros unificado.
      console.error("❌ Erro no Controller (show ItemEstoque):", error);
      return res
        .status(500)
        .json({
          error: "Erro interno do servidor ao buscar Item de Estoque.",
          details: (error as Error).message,
        });
    }
  }

  async update(req: Request, res: Response): Promise<Response> {
    const id_produto = parseInt(req.params.id_produto, 10);
    if (isNaN(id_produto)) {
      return res.status(400).json({ error: "ID de produto inválido." });
    }

    try {
      const updates = itemEstoqueSchema.partial().parse(req.body);

      const produtoAtualizado = await this.service.update(
        id_produto,
        updates as any
      );

      return res.status(200).json(produtoAtualizado);
    } catch (error) {
      // 🔑 REGRA 1.C: Tratamento de erros unificado.
      console.error("❌ Erro no Controller (update ItemEstoque):", error);
      return res
        .status(500)
        .json({
          error: "Erro interno do servidor ao atualizar Item de Estoque.",
          details: (error as Error).message,
        });
    }
  }  // --- MÉTODOS CRÍTICOS (receberEstoque, saidaEstoque) ---
  /**
   * 🔑 REGRAS 1.D (SRP/Transação): Remove toda a lógica de transação do Controller.
   * O Service agora é responsável por gerenciar a atomicidade.
   */

  async receberEstoque(req: Request, res: Response): Promise<Response> {
    // ❌ REMOVIDO: const transaction = await connection.transaction();
    try {
      const data = receberEstoqueSchema.parse(req.body); // 🔑 CHAMADA AO SERVICE: Ele agora deve fazer a busca do produto E gerenciar a transação.

      const resultado = await this.service.receberEstoque(data); // ❌ REMOVIDO: await transaction.commit();

      return res
        .status(200)
        .json({
          message: "Estoque recebido com sucesso e CMP atualizado.",
          data: resultado,
        });
    } catch (error) {
      // ❌ REMOVIDO: await transaction.rollback();

      // 🔑 REGRA 1.C: Tratamento de erros unificado.
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({
            error: "Dados de entrada inválidos.",
            details: error.issues,
          });
      }
      console.error("❌ Erro no Controller (receberEstoque):", error);
      return res.status(500).json({
        error: "Erro interno do servidor ao processar recebimento de estoque.",
        details: (error as Error).message,
      });
    }
  }
  /**
   * 🔑 REGRAS 1.D (SRP/Transação): Remove toda a lógica de transação do Controller.
   */

  async saidaEstoque(req: Request, res: Response): Promise<Response> {
    // ❌ REMOVIDO: const transaction = await connection.transaction();
    try {
      const data = saidaEstoqueSchema.parse(req.body); // 🔑 CHAMADA AO SERVICE: O Service gerencia a transação e o retorno.

      const { produto, custo_saida } = await this.service.saidaEstoque(data); // ❌ REMOVIDO: await transaction.commit();

      return res.status(200).json({
        message: "Saída de estoque registrada com sucesso.",
        id_produto: produto.id_produto,
        estoque_atual: produto.estoque_atual,
        custo_total: custo_saida,
      });
    } catch (error) {
      // ❌ REMOVIDO: await transaction.rollback();
      // 🔑 REGRA 1.C: Tratamento de erros unificado.
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({
            error: "Dados de entrada inválidos.",
            details: error.issues,
          });
      }
      console.error("❌ Erro no Controller (saidaEstoque):", error);
      return res.status(500).json({
        error: "Erro interno do servidor ao processar saída de estoque.",
        details: (error as Error).message,
      });
    }
  }
}

// 📌 Instanciando o Controller e Injetando o Service (Regra 1.A)
export default new EstoqueItemController(new EstoqueItemService());
