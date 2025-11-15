// src/controllers/FichaTecnicaController.ts (CORRIGIDO PARA TYPESCRIPT)

import { Request, Response } from "express"; // 🔑 CORREÇÃO 7006: Importa tipos Request e Response
import { FichaTecnicaService } from "../services/FichaTecnicaService"; // Importa o Service

class FichaTecnicaController {
  // 🔑 CORREÇÃO 2339: Declara a propriedade 'service' explicitamente
  private service: FichaTecnicaService;

  constructor() {
    this.service = new FichaTecnicaService();
  }

  /**
   * Rota GET para listar a Ficha Técnica de um Produto Pai
   * Rota: GET /api/v1/fichatecnica/pai/:id_produto_pai
   */
  async index(req: Request, res: Response): Promise<Response> {
    const id_produto_pai = parseInt(req.params.id_produto_pai, 10);

    try {
      const composicao = await this.service.findFichaTecnica(id_produto_pai);

      if (composicao.length === 0) {
        return res.status(200).json({
          message: "Ficha Técnica não encontrada ou vazia para este produto.",
          composicao: [],
        });
      }

      return res.status(200).json(composicao);
    } catch (error: unknown) {
      // 🔑 CORREÇÃO 18046: Tipa o catch como 'unknown'
      console.error("❌ ERRO AO LISTAR FICHA TÉCNICA:", error);
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";
      return res
        .status(500)
        .json({
          message: "Erro interno ao buscar a Ficha Técnica.",
          details: message,
        });
    }
  }

  /**
   * CRIAÇÃO ou SUBSTITUIÇÃO completa da Ficha Técnica de um produto (recebe um ARRAY de itens)
   * Rota: POST /api/v1/fichatecnica/pai/:id_produto_pai
   */
  async storeOrUpdate(req: Request, res: Response): Promise<Response> {
    const id_produto_pai = parseInt(req.params.id_produto_pai, 10);
    const novosItens = req.body; // Array de itens

    if (!Array.isArray(novosItens)) {
      return res
        .status(400)
        .json({
          message:
            "O corpo da requisição deve ser um array de itens da ficha técnica.",
        });
    }

    try {
      const { itens, novoCusto } = await this.service.storeOrUpdate(
        id_produto_pai,
        novosItens
      );

      return res.status(201).json({
        message: `Ficha Técnica atualizada com sucesso. Novo Custo de Produção (CMP) do Produto Pai: R$ ${novoCusto.toFixed(
          2
        )}`,
        itens_criados: itens,
        novo_custo_producao: novoCusto.toFixed(2),
      });
    } catch (error: unknown) {
      console.error("❌ ERRO AO CRIAR/ATUALIZAR FICHA TÉCNICA:", error);
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";
      if (message.includes("Produto Pai não encontrado")) {
        return res.status(404).json({ message: message });
      }
      return res
        .status(500)
        .json({
          message: "Erro interno na transação da Ficha Técnica.",
          details: message,
        });
    }
  }

  /**
   * Atualiza a QUANTIDADE de um item específico da Ficha Técnica
   * Rota: PUT /api/v1/fichatecnica/item/:idItem
   */
  async updateItemFichaTecnica(req: Request, res: Response): Promise<Response> {
    const idItem = parseInt(req.params.idItem, 10);
    const { quantidade_necessaria } = req.body;

    if (
      !quantidade_necessaria ||
      isNaN(parseFloat(quantidade_necessaria)) ||
      parseFloat(quantidade_necessaria) <= 0
    ) {
      return res
        .status(400)
        .json({
          message: "Quantidade necessária deve ser um valor numérico positivo.",
        });
    }

    try {
      const { item, novoCusto } = await this.service.updateItemQuantidade(
        idItem,
        parseFloat(quantidade_necessaria)
      );

      return res.status(200).json({
        message: `Quantidade do item ${idItem} atualizada. Novo Custo de Produção (CMP) do Produto Pai: R$ ${novoCusto.toFixed(
          2
        )}`,
        item_atualizado: item,
        novo_custo_producao: novoCusto.toFixed(2),
      });
    } catch (error: unknown) {
      console.error("❌ ERRO AO ATUALIZAR ITEM DA FICHA TÉCNICA:", error);
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";
      if (message.includes("Item da Ficha Técnica não encontrado")) {
        return res.status(404).json({ message: message });
      }
      return res
        .status(500)
        .json({
          message: "Erro interno ao atualizar item da Ficha Técnica.",
          details: message,
        });
    }
  }

  /**
   * Deleta um item específico da Ficha Técnica.
   * Rota: DELETE /api/v1/fichatecnica/item/:idItem
   */
  async deleteItemFichaTecnica(req: Request, res: Response): Promise<Response> {
    const idItem = parseInt(req.params.idItem, 10);

    try {
      const { id_removido, id_produto_pai, novoCusto } =
        await this.service.deleteItem(idItem);

      return res.status(200).json({
        message: `Item da Ficha Técnica removido com sucesso. Novo CMP do Produto Pai ${id_produto_pai}: R$ ${novoCusto.toFixed(
          2
        )}`,
        id_removido: id_removido,
        novo_custo_producao: novoCusto.toFixed(2),
      });
    } catch (error: unknown) {
      console.error("❌ ERRO AO DELETAR ITEM DA FICHA TÉCNICA:", error);
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";
      if (message.includes("Item da Ficha Técnica não encontrado")) {
        return res.status(404).json({ message: message });
      }
      return res
        .status(500)
        .json({
          message: "Erro interno ao deletar item da Ficha Técnica.",
          details: message,
        });
    }
  }
}

// O TypeScript não permite exportar a instância diretamente como o JavaScript (module.exports)
// Você deve usar 'export default' ou 'export const'
export default new FichaTecnicaController();
