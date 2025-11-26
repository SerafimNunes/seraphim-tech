import { Request, Response } from 'express';
import { EscalaService } from '../services/EscalaService';
import { UsuarioService } from '../services/UsuarioServices';
import { RHService } from '../services/RHService';

/**
 * Controller responsável por manipular requisições relacionadas a Escalas.
 */
export class EscalaController {
  // Serviços injetados (Simulação de Injeção de Dependência)
  private escalaService: EscalaService;
  private usuarioService: UsuarioService;
  private rhService: RHService;

  constructor(
    escalaService: EscalaService,
    usuarioService: UsuarioService,
    rhService: RHService,
  ) {
    this.escalaService = escalaService;
    this.usuarioService = usuarioService;
    this.rhService = rhService;

    // 🔑 Injeção de dependência via setter, mantendo o fluxo existente (R3)
    // O EscalaService precisa do RHService para validar colaboradores
    this.escalaService.setRHService(this.rhService);
  }

  /**
   * [POST] /escalas
   * Cria uma nova proposta de escala, checando a unidade do usuário logado.
   */
  public criarEscala = async (req: Request, res: Response): Promise<void> => {
    // Assumindo que o ID do usuário logado vem do token ou body
    const { usuario_id, ...payload } = req.body;

    if (!usuario_id) {
      res
        .status(400)
        .json({ message: 'ID do usuário logado (usuario_id) é obrigatório.' });
      return;
    }

    // 🔑 R4/R12: Obter o ID da unidade do usuário logado (simulado ou do token)
    // Assumindo que o `usuarioService` possui um método para obter a unidade
    // const unidade_id = await this.usuarioService.getUnidadeId(usuario_id);
    const unidade_id = payload.unidade_id || 1; // Placeholder para R4

    const data = { ...payload, unidade_id };

    try {
      // Chama o serviço de Escala para criar (que internamente checa o RH)
      const novaEscala = await this.escalaService.criarEscala(data);

      res.status(201).json({
        message: 'Proposta de escala criada com sucesso.',
        escala: novaEscala,
      });
    } catch (error: any) {
      console.error('[EscalaController] Erro na criação da escala:', error);
      // Retorna a mensagem de erro da camada de serviço (ex: Colaborador Inativo)
      res.status(400).json({
        message: error.message || 'Erro ao criar a escala.',
      });
    }
  };

  /**
   * [PUT] /escalas/:id_escala/aprovar
   * R13: Altera o status da escala para APROVADA.
   */
  public aprovarEscala = async (req: Request, res: Response): Promise<void> => {
    const id_escala = parseInt(req.params.id_escala, 10);
    const { aprovador_id } = req.body;

    if (isNaN(id_escala) || !aprovador_id) {
      res
        .status(400)
        .json({ message: 'ID da escala ou do aprovador inválido.' });
      return;
    }

    try {
      // Delega a aprovação para o serviço de escala
      const escalaAprovada = await this.escalaService.aprovarEscala(
        id_escala,
        aprovador_id,
      );

      res.status(200).json({
        message: 'Escala aprovada com sucesso.',
        escala: escalaAprovada,
      });
    } catch (error: any) {
      console.error('[EscalaController] Erro na aprovação da escala:', error);
      res.status(400).json({
        message: error.message || 'Erro ao aprovar a escala.',
      });
    }
  };

  // ⚠️ Outros métodos como getEscalas, updateEscala, etc. seriam implementados aqui.
}