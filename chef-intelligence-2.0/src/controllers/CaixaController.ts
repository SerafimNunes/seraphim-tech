import { Request, Response } from "express";
import { z } from "zod";
import CaixaService from "../services/CaixaService";

// A Request agora é a padrão do Express
// REMOVIDO: interface RequestWithUser
// REMOVIDO: Importação de JwtPayload

// 🔑 R9: Esquema de validação para abertura de caixa
const abrirCaixaSchema = z.object({
  saldo_inicial: z
    .number()
    .min(0, "O saldo inicial não pode ser negativo.")
    .default(0),
  colaborador_id_abertura: z
    .number()
    .int()
    .positive("ID do colaborador inválido."),
});

// 🔑 R9: Esquema de validação para fechamento de caixa
const fecharCaixaSchema = z.object({
  colaborador_id_fechamento: z
    .number()
    .int()
    .positive("ID do colaborador de fechamento inválido."),
});

class CaixaController {
  private service: CaixaService;

  constructor() {
    this.service = new CaixaService();
  }

  public async abrirCaixa(req: Request, res: Response): Promise<Response> {
    // REMOVIDO: Validação de unidade_id

    try {
      // 🔑 R9: Validação
      const { colaborador_id_abertura, saldo_inicial } = abrirCaixaSchema.parse(
        req.body
      );

      const novoCaixa = await this.service.abrirCaixa(
        colaborador_id_abertura,
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
      // 🔑 R9: Validação
      const { colaborador_id_fechamento } = fecharCaixaSchema.parse(req.body);

      const result = await this.service.fecharCaixa(
        id_caixa,
        colaborador_id_fechamento
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
