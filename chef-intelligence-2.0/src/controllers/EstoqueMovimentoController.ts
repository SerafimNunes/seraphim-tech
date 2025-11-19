// src/controllers/EstoqueMovimentoController.ts (REFACTORADO)

import { Request, Response } from 'express';
import { EstoqueMovimentoService } from '../services/EstoqueMovimentoService';
// Importa o NOVO Service

// 🔑 Assumindo que a interface Request foi estendida (ex: via @types/express)
// para incluir o objeto 'user' com 'unidade_id'.
// Ex: interface AuthRequest extends Request { user: { id: number; unidade_id: number; } }

class EstoqueMovimentoController {
  /**
   * 🔑 REGRA 1.A: Injeção de Dependência Simplificada.
   */
  constructor(private movimentoService: EstoqueMovimentoService) {} /**
   * Lista o histórico de movimentos de estoque, com filtros opcionais.
   */
  async index(req: Request, res: Response): Promise<Response> {
    // 🔑 CORREÇÃO CRÍTICA R4: Obter a unidade_id do usuário logado (simulando autenticação)
    const unidadeIdRaw =
      (req as any).user?.unidade_id || req.headers['x-unidade-id'];

    // Validação da unidade_id
    let unidade_id: number;
    try {
      unidade_id = parseInt(unidadeIdRaw as string, 10);
      if (isNaN(unidade_id)) {
        return res
          .status(401)
          .json({
            error: 'Contexto de Unidade (R4) não fornecido ou inválido.',
          });
      }
    } catch (e) {
      return res
        .status(401)
        .json({ error: 'Contexto de Unidade (R4) não fornecido ou inválido.' });
    } // Query parameters

    const { id_produto, tipo_movimento } = req.query;

    let idProdutoNum: number | undefined;
    if (id_produto) {
      // Conversão segura de id_produto para número
      const parsedId = parseInt(id_produto as string, 10);
      if (isNaN(parsedId)) {
        return res
          .status(400)
          .json({ error: 'O id_produto fornecido é inválido.' });
      }
      idProdutoNum = parsedId;
    }

    const tipoMovimentoStr =
      tipo_movimento && typeof tipo_movimento === 'string'
        ? tipo_movimento.toUpperCase()
        : undefined;

    try {
      // 🔑 CORREÇÃO: Passa a unidade_id obrigatória para o Service
      const movimentos = await this.movimentoService.listarMovimentos({
        id_produto: idProdutoNum,
        tipo_movimento: tipoMovimentoStr,
        unidade_id: unidade_id, // 🔑 R4: O service agora exige este campo
      });

      return res.status(200).json(movimentos);
    } catch (error) {
      // 🔑 REGRA 1.C: Tratamento de erros unificado.
      console.error('❌ ERRO NO CONTROLLER (index Movimento):', error);
      return res.status(500).json({
        error: 'Erro interno do servidor ao listar movimentos de estoque.',
        details: (error as Error).message,
      });
    }
  }
}

// 🔑 REGRA 1.A: Instanciação e Injeção do NOVO Service na exportação.
export default new EstoqueMovimentoController(new EstoqueMovimentoService());
