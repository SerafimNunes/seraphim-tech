// src/controllers/ProducaoController.ts

import { Request, Response } from "express";
import { connection } from "../config/sequelize";
import { ProducaoService } from "../services/ProducaoService"; // 🔑 Importa o Serviço

export class ProducaoController {
  private producaoService: ProducaoService;

  constructor() {
    this.producaoService = new ProducaoService();
  }

  /**
   * Rota 1: Sugestão de Produção Automática (Alerta de Estoque Mínimo)
   * Rota: GET /api/v1/producao/alerta
   */
  async suggestProduction(req: Request, res: Response): Promise<Response> {
    try {
      const sugestoes = await this.producaoService.suggestProduction();
      return res.status(200).json(sugestoes);
    } catch (error) {
      console.error("❌ ERRO NA SUGESTÃO DE PRODUÇÃO:", error);
      return res
        .status(500)
        .json({
          error: "Erro ao sugerir ordens de produção.",
          details: (error as Error).message,
        });
    }
  }

  /**
   * Rota 2: Listagem de Ordens de Produção
   * Rota: GET /api/v1/producao?status=...
   */
  async index(req: Request, res: Response): Promise<Response> {
    const { status } = req.query; // Filtro opcional

    try {
      const registros = await this.producaoService.index(status as string);
      return res.status(200).json(registros);
    } catch (error) {
      console.error("❌ ERRO AO LISTAR PRODUÇÕES:", error);
      return res
        .status(500)
        .json({
          error: "Erro ao listar ordens de produção.",
          details: (error as Error).message,
        });
    }
  }

  /**
   * Rota 3: Criação manual de uma OP (Status SUGERIDO)
   * Rota: POST /api/v1/producao
   * @body { id_produto_produzido, quantidade_produzida, colaborador_id_sugestao }
   */
  async store(req: Request, res: Response): Promise<Response> {
    const {
      id_produto_produzido,
      quantidade_produzida,
      colaborador_id_sugestao,
      observacoes,
    } = req.body;

    if (
      !id_produto_produzido ||
      !quantidade_produzida ||
      !colaborador_id_sugestao
    ) {
      return res
        .status(400)
        .json({
          error:
            "ID do Produto, Quantidade e ID do Colaborador são obrigatórios.",
        });
    }

    const transaction = await connection.transaction();
    try {
      const registro = await this.producaoService.createProducao(
        {
          id_produto_produzido,
          quantidade_produzida,
          colaborador_id_sugestao,
          observacoes,
        },
        transaction
      );
      await transaction.commit();

      return res.status(201).json({
        message: `Ordem de Produção (OP) SUGERIDA com sucesso.`,
        registro,
      });
    } catch (error) {
      await transaction.rollback();
      console.error("❌ ERRO NA CRIAÇÃO DE PRODUÇÃO:", error);
      return res
        .status(500)
        .json({
          error: "Erro ao criar a ordem de produção.",
          details: (error as Error).message,
        });
    }
  }

  /**
   * Rota 4: Aprovação (Gestor) - Início da Produção (Gera Requisição de Insumos)
   * Rota: PATCH /api/v1/producao/:id/aprovar
   * @body { colaborador_id_aprovacao }
   */
  async startProduction(req: Request, res: Response): Promise<Response> {
    const id = parseInt(req.params.id);
    const { colaborador_id_aprovacao } = req.body;

    if (isNaN(id) || !colaborador_id_aprovacao) {
      return res
        .status(400)
        .json({ error: "ID da OP e ID do Aprovador são obrigatórios." });
    }

    const transaction = await connection.transaction();
    try {
      const registro = await this.producaoService.startProduction(
        id,
        colaborador_id_aprovacao,
        transaction
      );
      await transaction.commit();

      return res.status(200).json({
        message: `Ordem de Produção (OP) nº ${id} APROVADA. Requisição de Insumos gerada.`,
        registro,
      });
    } catch (error) {
      await transaction.rollback();
      console.error("❌ ERRO NA APROVAÇÃO DE PRODUÇÃO:", error);
      return res
        .status(500)
        .json({
          error: "Erro ao aprovar a ordem de produção.",
          details: (error as Error).message,
        });
    }
  }

  /**
   * Rota 5: Entrega/Confirmação (Estoquista/João) - Abate os insumos do Estoque.
   * Rota: PATCH /api/v1/producao/:id/entregar-insumos
   * @body { colaborador_id_separador, observacoes_estoque }
   */
  async deliverInsumos(req: Request, res: Response): Promise<Response> {
    const id = parseInt(req.params.id);
    const { colaborador_id_separador, observacoes_estoque } = req.body;

    if (isNaN(id) || !colaborador_id_separador) {
      return res
        .status(400)
        .json({ error: "ID da OP e ID do Separador são obrigatórios." });
    }

    const transaction = await connection.transaction();
    try {
      const registro = await this.producaoService.deliverInsumos(
        id,
        colaborador_id_separador,
        observacoes_estoque,
        transaction
      );
      await transaction.commit();

      return res.status(200).json({
        message: `Insumos para OP nº ${id} ENTREGUES. Status alterado para EM_PRODUCAO.`,
        registro,
      });
    } catch (error) {
      await transaction.rollback();
      console.error("❌ ERRO NA ENTREGA DE INSUMOS:", error);
      return res
        .status(500)
        .json({
          error: "Erro ao entregar os insumos.",
          details: (error as Error).message,
        });
    }
  }

  /**
   * Rota 6: Conclusão (Cozinheiro/Gestor) - Adiciona o Produto Final ao Estoque.
   * Rota: PATCH /api/v1/producao/:id/concluir
   * @body { colaborador_id_conclusao }
   */
  async finishProduction(req: Request, res: Response): Promise<Response> {
    const id = parseInt(req.params.id);
    const { colaborador_id_conclusao } = req.body;

    if (isNaN(id) || !colaborador_id_conclusao) {
      return res
        .status(400)
        .json({
          error: "ID da OP e ID do Colaborador de Conclusão são obrigatórios.",
        });
    }

    const transaction = await connection.transaction();
    try {
      const registro = await this.producaoService.finishProduction(
        id,
        colaborador_id_conclusao,
        transaction
      );
      await transaction.commit();

      return res.status(200).json({
        message: `Ordem de Produção (OP) nº ${id} CONCLUÍDA. Estoque de produto final atualizado.`,
        registro,
      });
    } catch (error) {
      await transaction.rollback();
      console.error("❌ ERRO NA CONCLUSÃO DE PRODUÇÃO:", error);
      return res
        .status(500)
        .json({
          error: "Erro ao concluir a ordem de produção.",
          details: (error as Error).message,
        });
    }
  }

  /**
   * Rota 7: Registro de Perda de Estoque (Baixa Manual)
   * Rota: POST /api/v1/producao/perda
   * @body { id_produto, quantidade_perdida, tipo_perda, colaborador_id, observacoes }
   */
  async storePerda(req: Request, res: Response): Promise<Response> {
    const payload = req.body;

    if (
      !payload.id_produto ||
      !payload.quantidade_perdida ||
      !payload.tipo_perda ||
      !payload.colaborador_id
    ) {
      return res
        .status(400)
        .json({
          error:
            "Campos obrigatórios: id_produto, quantidade_perdida, tipo_perda e colaborador_id.",
        });
    }

    const transaction = await connection.transaction();
    try {
      const registroPerda = await this.producaoService.createPerda(
        payload,
        transaction
      );
      await transaction.commit();

      return res.status(201).json({
        message: `Perda de ${payload.quantidade_perdida} registrada para o produto ${payload.id_produto}.`,
        registroPerda,
      });
    } catch (error) {
      await transaction.rollback();
      console.error("❌ ERRO NO REGISTRO DE PERDA:", error);
      return res
        .status(500)
        .json({
          error: "Erro ao registrar a perda.",
          details: (error as Error).message,
        });
    }
  }

  /**
   * Rota 8: Cancelamento de OP (Antes de EM_PRODUCAO)
   * Rota: PATCH /api/v1/producao/:id/cancelar
   * @body { colaborador_id_cancelamento, observacoes }
   */
  async cancelProduction(req: Request, res: Response): Promise<Response> {
    const id = parseInt(req.params.id);
    const { colaborador_id_cancelamento, observacoes } = req.body;

    if (isNaN(id) || !colaborador_id_cancelamento) {
      return res
        .status(400)
        .json({
          error:
            "ID da OP e ID do Colaborador de Cancelamento são obrigatórios.",
        });
    }

    const transaction = await connection.transaction();
    try {
      const registro = await this.producaoService.cancelProduction(
        id,
        colaborador_id_cancelamento,
        observacoes,
        transaction
      );
      await transaction.commit();

      return res.status(200).json({
        message: `Ordem de Produção nº ${id} CANCELADA com sucesso.`,
        registro,
      });
    } catch (error) {
      await transaction.rollback();
      console.error("❌ ERRO NO CANCELAMENTO DE PRODUÇÃO:", error);
      return res
        .status(500)
        .json({
          error: "Erro ao cancelar a ordem de produção.",
          details: (error as Error).message,
        });
    }
  }
}

// Exporta uma instância do Controller
export default new ProducaoController();
