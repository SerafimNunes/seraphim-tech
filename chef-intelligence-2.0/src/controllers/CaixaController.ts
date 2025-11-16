// src/controllers/CaixaController.ts

import { Request, Response } from "express";
import { z } from "zod";
import CaixaService from "../services/CaixaService";
import LancamentoService from "../services/LancamentoService"; // Importação mantida

// --- R9: Esquemas de Validação Zod ---

// Esquema de validação para abertura de caixa
const abrirCaixaSchema = z.object({
  saldo_inicial: z
    .number()
    .min(0, "O saldo inicial não pode ser negativo.")
    .default(0),
  colaborador_id_abertura: z
    .number()
    .int()
    .positive("ID do colaborador inválido.")
    .optional(),
});

// Esquema de validação para fechamento de caixa
const fecharCaixaSchema = z.object({
  colaborador_id_fechamento: z
    .number()
    .int()
    .positive("ID do colaborador de fechamento inválido.")
    .optional(),
});

// 🔑 CORREÇÃO TS2769: Usar 'message' em vez de 'errorMap' para Zod Enum
const lancamentoSchema = z.object({
  tipo_lancamento: z.enum(["SANGRIA", "REFORCO", "DESPESA"], {
    // Correção: a propriedade é 'message' para customizar a mensagem de erro do enum
    message: "Tipo de lançamento inválido. Use SANGRIA, REFORCO ou DESPESA.", 
  }),
  valor: z.number().positive("O valor do lançamento deve ser positivo."),
  descricao: z.string().min(3, "A descrição do lançamento deve ser detalhada."),
  categoria: z.string().optional().nullable(),
});


class CaixaController {
  private service: CaixaService;
  private lancamentoService: LancamentoService; 

  constructor() {
    this.service = new CaixaService();
    this.lancamentoService = new LancamentoService(); 
  }
  
  // (abrirCaixa e fecharCaixa — sem alterações de código, apenas de comentários)

  public async abrirCaixa(req: Request, res: Response): Promise<Response> {
    try {
      const { colaborador_id_abertura, saldo_inicial } = abrirCaixaSchema.parse(req.body);

      // R12: Prioriza o ID do usuário logado (anexado pelo authMiddleware)
      const id_colaborador = colaborador_id_abertura || (req as any).usuario?.id_usuario;

      if (!id_colaborador) {
        return res.status(401).json({ error: "ID do colaborador não fornecido ou inválido (R12)." });
      }

      const novoCaixa = await this.service.abrirCaixa(
        id_colaborador,
        saldo_inicial
      );

      return res.status(201).json({
        message: `Caixa ID ${novoCaixa.id_caixa} aberto com sucesso.`,
        caixa: novoCaixa,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({
            error: "Dados de abertura inválidos.",
            details: error.issues,
          });
      }
      return res
        .status(500)
        .json({
          error: "Erro ao abrir o caixa.",
          details: (error as Error).message,
        });
    }
  }

  public async fecharCaixa(req: Request, res: Response): Promise<Response> {
    const id_caixa = parseInt(req.params.id_caixa || req.params.id, 10);
    if (isNaN(id_caixa)) {
      return res.status(400).json({ error: "ID do Caixa inválido." });
    }

    try {
      const { colaborador_id_fechamento } = fecharCaixaSchema.parse(req.body);

      // R12: Prioriza o ID do usuário logado para auditoria (R7)
      const id_colaborador = colaborador_id_fechamento || (req as any).usuario?.id_usuario;

      if (!id_colaborador) {
        return res.status(401).json({ error: "ID do colaborador não fornecido ou inválido (R12)." });
      }

      const result = await this.service.fecharCaixa(
        id_caixa,
        id_colaborador
      );

      return res.status(200).json({
        message: `Caixa ID ${id_caixa} fechado com sucesso.`,
        relatorio: result.relatorio,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({
            error: "Dados de fechamento inválidos.",
            details: error.issues,
          });
      }
      return res.status(500).json({
        error: "Erro ao fechar o caixa e gerar relatório.",
        details: (error as Error).message,
      });
    }
  }


  public async registrarLancamento(req: Request, res: Response): Promise<Response> {
    try {
      const validation = lancamentoSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          error: "Dados de lançamento inválidos.",
          details: validation.error.issues,
        });
      }
      
      const payload = validation.data;
      
      const id_colaborador_logado = (req as any).usuario?.id_usuario; 

      if (!id_colaborador_logado) {
        return res.status(401).json({ error: "Colaborador logado não identificado (R12)." });
      }

      // 1. Busca o caixa ativo (TS2339)
      const caixaAtivo = await this.service.getCaixaAtivo(id_colaborador_logado); 

      if (!caixaAtivo) {
        return res.status(404).json({ error: "Nenhum caixa ativo encontrado para registrar lançamentos." });
      }

      // 2. Registra o lançamento usando o LancamentoService
      const novoLancamento = await this.lancamentoService.registrarLancamento(
        {
          ...payload,
          id_caixa: caixaAtivo.id_caixa, 
          colaborador_id: id_colaborador_logado,
        },
        // 🔑 CORREÇÃO TS2345: Passar 'undefined' em vez de 'null' 
        // para argumentos opcionais de Sequelize.Transaction
        undefined 
      );

      return res.status(201).json({
        message: `${payload.tipo_lancamento} registrada com sucesso no Caixa ID ${caixaAtivo.id_caixa}.`,
        lancamento: novoLancamento,
      });
    } catch (error) {
      return res.status(500).json({
        error: "Erro ao registrar o lançamento.",
        details: (error as Error).message,
      });
    }
  }
  
  // (listarCaixasAtivos e listarMovimentos)

  public async listarCaixasAtivos(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const caixas = await this.service.listarCaixasAtivos();
      return res.status(200).json(caixas);
    } catch (error) {
      console.error("Erro ao listar caixas ativos:", (error as Error).message);
      return res.status(500).json({ error: "Falha ao buscar caixas ativos." });
    }
  }

  public async listarMovimentos(
    req: Request,
    res: Response
  ): Promise<Response> {
    const filters = req.query;

    try {
      const movimentos = await this.service.listarMovimentos(filters);
      return res.status(200).json(movimentos);
    } catch (error) {
      console.error(
        "Erro ao listar movimentos de caixa:",
        (error as Error).message
      );
      return res
        .status(500)
        .json({ error: "Falha ao buscar movimentos de caixa." });
    }
  }
}

export default new CaixaController();