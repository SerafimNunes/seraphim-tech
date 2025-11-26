//src/controllers/FichaTecnicaController.ts

import { Request, Response } from "express";
import { z } from "zod";
import { FichaTecnicaService } from "../services/FichaTecnicaService";
import { JwtPayload } from "../Middlewares/authMiddleware";

// 🔑 1.B: Esquema de validação para criação/atualização de itens (Array)
const FichaTecnicaItemSchema = z.object({
  id_produto_filho: z
    .number()
    .int()
    .positive({ message: "ID do item filho deve ser um número positivo." }),
  quantidade_necessaria: z.number().positive({
    message: "Quantidade necessária deve ser um número positivo.",
  }),
});

const FichaTecnicaArraySchema = z.array(FichaTecnicaItemSchema);

// 🔑 1.B: Esquema de validação para atualização de quantidade
const QuantidadeUpdateSchema = z.object({
  quantidade_necessaria: z.number().positive({
    message: "Quantidade necessária deve ser um valor numérico positivo.",
  }),
});

class FichaTecnicaController {
  private service: FichaTecnicaService;

  constructor() {
    // 🔑 1.A: Injeção de Dependência
    this.service = new FichaTecnicaService();
  } /** Rota GET: Listar Ficha Técnica */ // --- Métodos refatorados para incluir Zod (1.B) e R4/2.D (unidade_id) ---

  public async index(req: Request, res: Response): Promise<Response> {
    try {
      const usuario = req.usuario as JwtPayload; // Valida id_produto_pai
      const id_produto_pai = z
        .number()
        .int()
        .positive()
        .parse(parseInt(req.params.id_produto_pai, 10)); // 🔑 2.D/R4: Passa o unidade_id para garantir isolamento na busca.

      const composicao = await this.service.findFichaTecnica(
        id_produto_pai,
        usuario.unidade_id
      ); // 🔑 1.E: Resposta

      return res.status(200).json(composicao);
    } catch (error: unknown) {
      // 🔑 1.C: Tratamento de Erros
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "ID do produto pai inválido.",
          details: error.issues,
        });
      }
      return res
        .status(500)
        .json({ message: "Erro interno ao buscar a Ficha Técnica." });
    }
  } /** Rota POST: Criar ou Substituir Ficha Técnica */

  public async storeOrUpdate(req: Request, res: Response): Promise<Response> {
    try {
      const usuario = req.usuario as JwtPayload;
      const id_produto_pai = z
        .number()
        .int()
        .positive()
        .parse(parseInt(req.params.id_produto_pai, 10)); // 🔑 1.B: Validação Zod do Array de Itens

      const novosItens = FichaTecnicaArraySchema.parse(req.body); // 🔑 2.D/R4: Passa o unidade_id

      const { itens, novoCusto } = await this.service.storeOrUpdate(
        id_produto_pai,
        novosItens,
        usuario.unidade_id
      ); // 🔑 1.E: Retorno padronizado (201 Created)

      return res.status(201).json({
        message: `Ficha Técnica atualizada com sucesso. Novo Custo: R$ ${novoCusto.toFixed(
          2
        )}`,
        itens_criados: itens,
        novo_custo_producao: novoCusto.toFixed(2),
      });
    } catch (error: unknown) {
      // 🔑 1.C: Tratamento de Erros (400, 404, 500)
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Dados da Ficha Técnica inválidos.",
          details: error.issues,
        });
      }
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";
      const status = message.includes("não encontrado") ? 404 : 500;
      return res.status(status).json({ message: message });
    }
  } /** Rota PUT: Atualiza a QUANTIDADE de um item específico da Ficha Técnica */

  public async updateItemFichaTecnica(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const usuario = req.usuario as JwtPayload;
      const idItem = z
        .number()
        .int()
        .positive()
        .parse(parseInt(req.params.idItem, 10)); // 🔑 1.B: Validação Zod
      const { quantidade_necessaria } = QuantidadeUpdateSchema.parse(req.body);

      const { item, novoCusto } = await this.service.updateItemQuantidade(
        idItem,
        quantidade_necessaria,
        usuario.unidade_id // 🔑 2.D/R4: Passa o unidade_id
      ); // 🔑 1.E: Resposta

      return res.status(200).json({
        message: `Quantidade do item ${idItem} atualizada. Novo Custo: R$ ${novoCusto.toFixed(
          2
        )}`,
        item_atualizado: item,
        novo_custo_producao: novoCusto.toFixed(2),
      });
    } catch (error: unknown) {
      // 🔑 1.C: Tratamento de Erros
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Dados inválidos.", details: error.issues });
      }
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";
      const status = message.includes("não encontrado") ? 404 : 500;
      return res.status(status).json({ message: message });
    }
  } /** Rota DELETE: Deleta um item específico da Ficha Técnica. */

  public async deleteItemFichaTecnica(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const usuario = req.usuario as JwtPayload;
      const idItem = z
        .number()
        .int()
        .positive()
        .parse(parseInt(req.params.idItem, 10));

      const { id_removido, id_produto_pai, novoCusto } =
        await this.service.deleteItem(idItem, usuario.unidade_id); // 🔑 2.D/R4: Passa o unidade_id // 🔑 1.E: Resposta

      return res.status(200).json({
        message: `Item da Ficha Técnica removido com sucesso. Novo CMP do Produto Pai ${id_produto_pai}: R$ ${novoCusto.toFixed(
          2
        )}`,
        id_removido: id_removido,
        novo_custo_producao: novoCusto.toFixed(2),
      });
    } catch (error: unknown) {
      // 🔑 1.C: Tratamento de Erros
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";
      const status = message.includes("não encontrado") ? 404 : 500;
      return res.status(status).json({ message: message });
    }
  }
}

export default new FichaTecnicaController();
