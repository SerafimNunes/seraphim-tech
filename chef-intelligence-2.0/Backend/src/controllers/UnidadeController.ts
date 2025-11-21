// src/controllers/UnidadeController.ts

import { Request, Response } from 'express';
import { z } from 'zod';
import { UnidadeService } from '../services/UnidadeService';

const createSchema = z.object({
  nome_unidade: z.string().min(3),
  cnpj: z.string().length(14, 'CNPJ deve ter 14 dígitos.'),
  endereco: z.string().min(10),
});

const updateStatusSchema = z.object({
  status_operacional: z.enum(['ATIVA', 'INATIVA', 'EM_REFORMA']),
});

class UnidadeController {
  private service: UnidadeService;

  constructor() {
    this.service = new UnidadeService();
  }

  // POST /api/v1/unidades (CRIAÇÃO)
  public async create(req: Request, res: Response): Promise<Response> {
    try {
      const payload = createSchema.parse(req.body);
      const unidade = await this.service.create(payload);
      return res.status(201).json(unidade);
    } catch (error) {
      if (error instanceof z.ZodError)
        return res
          .status(400)
          .json({ error: 'Dados inválidos.', details: error.issues });
      return res.status(500).json({
        error: 'Falha ao criar unidade.',
        details: (error as Error).message,
      });
    }
  }

  // GET /api/v1/unidades (LISTAGEM ATIVAS)
  public async index(req: Request, res: Response): Promise<Response> {
    try {
      // Listagem de unidades ativas é a mais comum para UI
      const unidades = await this.service.findAllActive();
      return res.status(200).json(unidades);
    } catch (error) {
      return res.status(500).json({
        error: 'Falha ao listar unidades.',
        details: (error as Error).message,
      });
    }
  }

  // PATCH /api/v1/unidades/:id_unidade/status (ATUALIZAÇÃO DE STATUS)
  public async updateStatus(req: Request, res: Response): Promise<Response> {
    try {
      const id_unidade = parseInt(req.params.id_unidade, 10);
      const { status_operacional } = updateStatusSchema.parse(req.body);

      const unidade = await this.service.updateStatus(
        id_unidade,
        status_operacional,
      );
      return res
        .status(200)
        .json({ message: 'Status atualizado com sucesso.', unidade });
    } catch (error) {
      if (error instanceof z.ZodError)
        return res
          .status(400)
          .json({ error: 'Status inválido.', details: error.issues });

      const status = (error as Error).message.includes('não encontrada')
        ? 404
        : 500;
      return res.status(status).json({
        error: 'Falha ao atualizar status.',
        details: (error as Error).message,
      });
    }
  }
}

export default new UnidadeController();
