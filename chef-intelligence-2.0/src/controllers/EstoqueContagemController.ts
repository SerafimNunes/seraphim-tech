// src/controllers/EstoqueContagemController.ts

import { Request, Response } from "express";
import { z } from "zod";
import { EstoqueContagemService } from "../services/EstoqueContagemService";

/**
 * Define o schema de validação usando Zod.
 * O Controller é o local ideal para a validação do corpo da requisição (Regra 1.B).
 */
const contagemSchema = z.object({
  id_produto: z
    .number()
    .int()
    .positive({
      message: "O ID do produto deve ser um número inteiro positivo.",
    }),
  estoque_contado: z
    .number()
    .nonnegative({ message: "O estoque contado não pode ser negativo." }),
  colaborador_id: z
    .number()
    .int()
    .positive({
      message: "O ID do colaborador deve ser um número inteiro positivo.",
    }),
});

// Tipo derivado do schema para uso interno
type ContagemPayload = z.infer<typeof contagemSchema>;

class EstoqueContagemController {
  /**
   * 🔑 REGRAS 1.A (Injeção de Dependência): A injeção DEVE ser feita no construtor.
   * Remove a declaração manual e a inicialização 'new NomeService()' do corpo do construtor.
   */
  constructor(private contagemService: EstoqueContagemService) {}
  /**
   * Registra uma nova Contagem Cega (Inventário Físico) de um produto.
   * Rota: POST /api/v1/contagem
   */

  async store(req: Request, res: Response): Promise<Response> {
    try {
      // 1. Validação de Entrada (Regra 1.B: Uso do Zod)
      const payload: ContagemPayload = contagemSchema.parse(req.body); // 2. Chamada ao Service (SRP: O Controller apenas delega)

      const { produto, resultado_auditoria } =
        await this.contagemService.registrarContagem(payload); // 3. Retorno de Sucesso (Regra 1.E: 201 para criação)

      return res.status(201).json({
        message: `Contagem cega de ${produto.nome} registrada e estoque ajustado.`,
        resultado_auditoria: resultado_auditoria,
        data: produto,
      });
    } catch (error) {
      // 🔑 REGRA 1.C (Tratamento de Erros): Padrão uniforme no try/catch.

      // Tratamento específico para ZodError (400 - Bad Request)
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Dados de entrada inválidos.",
          details: error.issues,
        });
      } // Tratamento genérico para outros erros (500 - Internal Server Error)

      console.error("❌ Erro no Controller (store Contagem):", error);
      return res.status(500).json({
        error: "Erro interno do servidor ao registrar contagem de estoque.",
        details: (error as Error).message, // Garantindo a mensagem de erro.
      });
    }
  }
}

// 📌 NOTA: O arquivo final de um projeto real usaria um Container de DI (ex: Inversify, Tsyringe, ou um Factory)
// para criar a instância. Para simplificar no arquivo, usaremos a injeção via index/factory:
export default new EstoqueContagemController(new EstoqueContagemService());

// Se o seu sistema tiver um arquivo de rotas (index.ts/routes.ts) o ideal é que a injeção
// seja feita lá, por exemplo:
// const contagemController = new EstoqueContagemController(new EstoqueContagemService());
// router.post('/contagem', contagemController.store.bind(contagemController));
