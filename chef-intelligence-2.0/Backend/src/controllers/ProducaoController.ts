// src/controllers/ProducaoController.ts (Refatorado - SRP e Zod Corrigido)

import { Request, Response } from "express";
import { ProducaoService } from "../services/ProducaoService";
import { z, ZodError } from "zod";

// ❌ REMOVIDO: import { connection } from "../config/sequelize";

// --- Definição dos Schemas de Validação (Regra 1.B) ---

const ProducaoStoreSchema = z.object({
  id_produto_produzido: z.number().int().positive(),
  quantidade_produzida: z.number().positive(),
  colaborador_id_sugestao: z.number().int().positive(),
  observacoes: z.string().optional().nullable(),
});

const ProducaoAcaoSchema = z.object({
  colaborador_id_aprovacao: z.number().int().positive().optional(),
  colaborador_id_separador: z.number().int().positive().optional(),
  colaborador_id_conclusao: z.number().int().positive().optional(),
  colaborador_id_cancelamento: z.number().int().positive().optional(),
  observacoes: z.string().optional().nullable(),
  observacoes_estoque: z.string().optional().nullable(),
});

// 🔑 CORREÇÃO TS (Linha 195): Enum sincronizado com o Service
const PerdaStoreSchema = z.object({
  id_produto: z.number().int().positive(),
  quantidade_perdida: z.number().positive(),
  tipo_perda: z.enum([
    "QUEBRA",
    "VALIDADE",
    "ERRO_PRODUCAO",
    "ERRO_VENDA",
    "OUTROS",
  ]),
  colaborador_id: z.number().int().positive(),
  observacoes: z.string().optional().nullable(),
});

// --- Controller Refatorado ---

export class ProducaoController {
  private producaoService: ProducaoService;

  constructor(service?: ProducaoService) {
    this.producaoService = service || new ProducaoService();
  }

  // Helper para tratamento de erros (Regra 1.C)
  private handleErrors(res: Response, error: unknown): Response {
    if (error instanceof ZodError) {
      // Erro 400 para falha de validação
      return res
        .status(400)
        .json({
          message: "Erro de validação de dados de entrada.",
          details: error.issues,
        });
    }
    // Erro 500 para outros erros, incluindo os de Service/DB
    console.error("❌ ERRO INTERNO DO CONTROLADOR:", error);
    return res.status(500).json({
      error: "Erro interno do servidor.",
      details: error instanceof Error ? error.message : "Erro desconhecido.",
    });
  }

  /** Rota 1: Sugestão de Produção Automática */
  async suggestProduction(req: Request, res: Response): Promise<Response> {
    try {
      const sugestoes = await this.producaoService.suggestProduction();
      return res.status(200).json(sugestoes);
    } catch (error) {
      return this.handleErrors(res, error);
    }
  }

  /** Rota 2: Listagem de Ordens de Produção */
  async index(req: Request, res: Response): Promise<Response> {
    try {
      const { status } = req.query;
      const registros = await this.producaoService.index(status as string);
      return res.status(200).json(registros);
    } catch (error) {
      return this.handleErrors(res, error);
    }
  }

  /** Rota 3: Criação manual de uma OP (Status SUGERIDO) */
  async store(req: Request, res: Response): Promise<Response> {
    try {
      // 🔑 Validação Zod
      const dadosValidados = ProducaoStoreSchema.parse(req.body);

      // ❌ Regra 1.D: Transação removida. O Service lida com o DB.
      const registro = await this.producaoService.createProducao(
        dadosValidados
      );

      return res.status(201).json({
        message: `Ordem de Produção (OP) SUGERIDA com sucesso.`,
        registro,
      });
    } catch (error) {
      return this.handleErrors(res, error);
    }
  }

  /** Rota 4: Aprovação (Gestor) - Início da Produção */
  async startProduction(req: Request, res: Response): Promise<Response> {
    try {
      const id = z.number().int().positive().parse(parseInt(req.params.id));
      const { colaborador_id_aprovacao } = ProducaoAcaoSchema.pick({
        colaborador_id_aprovacao: true,
      }).parse(req.body);

      const registro = await this.producaoService.startProduction(
        id,
        colaborador_id_aprovacao!
      );

      return res.status(200).json({
        message: `Ordem de Produção (OP) nº ${id} APROVADA. Requisição de Insumos gerada.`,
        registro,
      });
    } catch (error) {
      return this.handleErrors(res, error);
    }
  }

  /** Rota 5: Entrega/Confirmação (Estoquista) - Abate os insumos do Estoque. */
  async deliverInsumos(req: Request, res: Response): Promise<Response> {
    try {
      const id = z.number().int().positive().parse(parseInt(req.params.id));
      const { colaborador_id_separador, observacoes_estoque } =
        ProducaoAcaoSchema.pick({
          colaborador_id_separador: true,
          observacoes_estoque: true,
        }).parse(req.body);

      // 🔑 CORREÇÃO TS (Linha 153): Converte undefined para null, garantindo string | null para o Service
      const observacoesToService = observacoes_estoque ?? null;

      const registro = await this.producaoService.deliverInsumos(
        id,
        colaborador_id_separador!,
        observacoesToService
      );

      return res.status(200).json({
        message: `Insumos para OP nº ${id} ENTREGUES. Status alterado para EM_PRODUCAO.`,
        registro,
      });
    } catch (error) {
      return this.handleErrors(res, error);
    }
  }

  /** Rota 6: Conclusão (Cozinheiro/Gestor) - Adiciona o Produto Final ao Estoque. */
  async finishProduction(req: Request, res: Response): Promise<Response> {
    try {
      const id = z.number().int().positive().parse(parseInt(req.params.id));
      const { colaborador_id_conclusao } = ProducaoAcaoSchema.pick({
        colaborador_id_conclusao: true,
      }).parse(req.body);

      const registro = await this.producaoService.finishProduction(
        id,
        colaborador_id_conclusao!
      );

      return res.status(200).json({
        message: `Ordem de Produção (OP) nº ${id} CONCLUÍDA. Estoque de produto final atualizado.`,
        registro,
      });
    } catch (error) {
      return this.handleErrors(res, error);
    }
  }

  /** Rota 7: Registro de Perda de Estoque (Baixa Manual) */
  async storePerda(req: Request, res: Response): Promise<Response> {
    try {
      // 🔑 Validação Zod (Enum Corrigido)
      const payload = PerdaStoreSchema.parse(req.body);

      const registroPerda = await this.producaoService.createPerda(payload);

      return res.status(201).json({
        message: `Perda de ${payload.quantidade_perdida} registrada para o produto ${payload.id_produto}.`,
        registroPerda,
      });
    } catch (error) {
      return this.handleErrors(res, error);
    }
  }

  /** Rota 8: Cancelamento de OP */
  async cancelProduction(req: Request, res: Response): Promise<Response> {
    try {
      const id = z.number().int().positive().parse(parseInt(req.params.id));
      const { colaborador_id_cancelamento, observacoes } =
        ProducaoAcaoSchema.pick({
          colaborador_id_cancelamento: true,
          observacoes: true,
        }).parse(req.body);

      // 🔑 CORREÇÃO TS (Linha 221): Converte undefined para null, garantindo string | null para o Service
      const observacoesToService = observacoes ?? null;

      const registro = await this.producaoService.cancelProduction(
        id,
        colaborador_id_cancelamento!,
        observacoesToService
      );

      return res.status(200).json({
        message: `Ordem de Produção nº ${id} CANCELADA com sucesso.`,
        registro,
      });
    } catch (error) {
      return this.handleErrors(res, error);
    }
  }
}

// Exporta uma instância do Controller
export default new ProducaoController();
