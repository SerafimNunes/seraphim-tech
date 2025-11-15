import { Request, Response } from "express";
import { connection } from "../config/sequelize";
// 🔑 R6: Importa a classe padrão
import LancamentoService from "../services/LancamentoService";
import { z } from "zod";

// 🔑 R9: Esquema de validação para lançamento
const storeLancamentoSchema = z.object({
  id_caixa: z.number().int().positive("ID do caixa inválido.").nullable(),
  colaborador_id: z.number().int().positive("ID do colaborador inválido."),
  tipo_lancamento: z.union([
    z.literal("RECEITA"),
    z.literal("DESPESA"),
    z.literal("SANGRIA"),
    z.literal("REFORCO"),
  ]),
  valor: z.number().min(0.01, "O valor do lançamento deve ser positivo."),
  descricao: z.string().min(3, "A descrição é obrigatória."),
  categoria: z.string().optional().nullable(),
  id_origem: z.number().int().positive().optional().nullable(),
  tipo_origem: z
    .union([z.literal("VENDA"), z.literal("PEDIDO")])
    .optional()
    .nullable(),
});

class LancamentoController {
  private service: LancamentoService;

  // 🔑 R6: Cria a instância do service
  constructor() {
    this.service = new LancamentoService();
  }

  /**
   * Rota: POST /api/v1/lancamentos - Registra um lançamento manual (Sangria, Reforço, Despesa).
   */
  public async store(req: Request, res: Response): Promise<Response> {
    const transaction = await connection.transaction();

    try {
      // 🔑 R9: Validação de entrada
      const payload = storeLancamentoSchema.parse(req.body);

      const novoLancamento = await this.service.registrarLancamento(
        {
          ...payload,
          // Garante que id_caixa nulo seja tratado corretamente
          id_caixa: payload.id_caixa || null,
        },
        transaction
      );

      await transaction.commit();

      return res.status(201).json({
        message: `${payload.tipo_lancamento} de R$ ${payload.valor} registrado.`,
        lancamento: novoLancamento,
      });
    } catch (error) {
      await transaction.rollback();

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Dados de lançamento inválidos.",
          details: error.issues,
        });
      }

      return res.status(500).json({
        error: "Erro interno ao registrar o lançamento.",
        details: (error as Error).message,
      });
    }
  }
}

export default new LancamentoController();
