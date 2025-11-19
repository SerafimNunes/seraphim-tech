import { Request, Response } from "express";
import { EscalaService } from "../services/EscalaService";
import { UsuarioService } from "../services/UsuarioServices";
import { RHService } from "../services/RHService";

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
    rhService: RHService
  ) {
    this.escalaService = escalaService;
    this.usuarioService = usuarioService;
    this.rhService = rhService;

    // Injeção de dependência via setter
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
        .status(401)
        .json({ message: "ID do usuário não fornecido ou não autenticado." });
      return;
    }

    try {
      // R4: Busca o ID da unidade usando o serviço de Usuário
      const unidade_id = await this.usuarioService.getUnidadeIdByUsuarioId(
        usuario_id
      );

      if (!unidade_id) {
        res.status(404).json({
          message: `Unidade não encontrada para o usuário ID ${usuario_id}.`,
        });
        return;
      }

      // Adiciona a unidade_id ao payload para fins de persistência/registro
      const data = { ...payload, unidade_id };

      // Chama o serviço de Escala para criar (que internamente checa o RH)
      const novaEscala = await this.escalaService.criarEscala(data);

      res.status(201).json({
        message: "Proposta de escala criada com sucesso.",
        escala: novaEscala,
      });
    } catch (error: any) {
      console.error("[EscalaController] Erro na criação da escala:", error);
      res.status(400).json({
        message: error.message || "Erro ao criar a escala.",
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
        .json({ message: "ID da escala ou do aprovador inválido." });
      return;
    }

    try {
      const escalaAprovada = await this.escalaService.aprovarEscala(
        id_escala,
        aprovador_id
      );

      res.status(200).json({
        message: `Escala ID ${id_escala} aprovada com sucesso.`,
        escala: escalaAprovada,
      });
    } catch (error: any) {
      console.error("[EscalaController] Erro na aprovação da escala:", error);
      res.status(400).json({
        message: error.message || "Erro ao aprovar a escala.",
      });
    }
  };
}
