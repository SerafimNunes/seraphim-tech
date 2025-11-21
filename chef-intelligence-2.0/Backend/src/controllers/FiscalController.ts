// src/controllers/FiscalController.ts

import { Request, Response } from "express";
import { z } from "zod";
// 🔑 Importação Correta: Agora o Service tem export default.
import FiscalService from "../services/FiscalService";

// (R9) Esquema de validação para os filtros de exportação
const exportSchema = z
  .object({
    // data_inicio e data_fim devem ser strings no formato ISO 8601 (incluindo tempo)
    data_inicio: z.string().datetime().optional(),
    data_fim: z.string().datetime().optional(),
    tipo_origem: z.string().optional(),
  })
  .refine(
    (data) => {
      // Regra: Se um campo de data está presente, o outro também deve estar.
      if (
        (data.data_inicio && !data.data_fim) ||
        (!data.data_inicio && data.data_fim)
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        "Se 'data_inicio' for fornecido, 'data_fim' também deve ser (e vice-versa).",
      path: ["data_inicio", "data_fim"], // Define o caminho do erro para o frontend
    }
  );

class FiscalController {
  private service: FiscalService;

  constructor() {
    this.service = new FiscalService();
  }

  /**
   * Endpoint para exportar dados fiscais (JSON/CSV) para o contador ou visualização interna.
   * Rota: GET /fiscal/exportar
   * @query { data_inicio, data_fim, tipo_origem }
   */
  async exportForAccountant(req: Request, res: Response): Promise<Response> {
    try {
      // 1. Validação de entrada (R9)
      // Os filtros (query parameters) são validados
      const filters = exportSchema.parse(req.query);

      // 2. Chamada ao Service (R5 - Assincronicidade)
      const registros = await this.service.findFiscalRecords(filters);

      // 3. Retorno de sucesso
      return res.status(200).json({
        message: `Exportação Fiscal de ${registros.length} registros no período.`,
        data_para_contador: registros,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Erro de validação Zod
        return res.status(400).json({
          error: "Filtros de entrada inválidos.",
          details: error.issues,
        });
      }

      console.error("❌ ERRO NO CONTROLLER AO EXPORTAR FISCAL:", error);
      return res.status(500).json({
        error: "Erro ao buscar registros fiscais.",
        details: (error as Error).message,
      });
    }
  }
}

export default new FiscalController();
