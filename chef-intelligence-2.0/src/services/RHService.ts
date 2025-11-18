import Colaborador from "../models/Colaborador"; // Assumindo o caminho do seu modelo

// Tipagem básica para o Colaborador (ajuste conforme seu modelo real)
interface ColaboradorModel {
  id_colaborador: number; // PK
  nome_completo: string;
  // O status é o campo crucial para checagem
  status: "ATIVO" | "AFASTADO" | "DESLIGADO";
  // Adicione mais campos do seu modelo Colaborador aqui...
}

/**
 * Serviço responsável por buscar informações de recursos humanos (Colaboradores, Cargos, etc.).
 */
export class RHService {
  constructor() {}

  /**
   * Busca um colaborador pelo ID (PK: id_colaborador), usado para checar disponibilidade.
   * @param id_colaborador ID do colaborador.
   * @returns Objeto do colaborador ou null.
   */
  public async getColaboradorById(
    id_colaborador: number
  ): Promise<ColaboradorModel | null> {
    try {
      // Busca o Colaborador usando a PK correta
      const colaborador = await Colaborador.findByPk(id_colaborador);

      if (colaborador) {
        // Simulação de conversão para o tipo ColaboradorModel
        return colaborador.toJSON() as ColaboradorModel;
      }

      return null;
    } catch (error) {
      console.error(
        `[RHService] Erro ao buscar colaborador ${id_colaborador}:`,
        error
      );
      return null;
    }
  }
}
