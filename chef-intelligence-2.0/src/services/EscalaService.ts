import { RHService } from "./RHService";
// A importação agora funciona porque EscalaModel é exportado via type alias
import Escala, {
  EscalaCreationAttributes,
  EscalaModel,
} from "../models/Escala";

// Tipagem base para o payload de criação (para uso interno)
interface CriarEscalaPayload extends EscalaCreationAttributes {
  colaboradores: number[]; // Lista de IDs de colaboradores (PKs: id_colaborador)
}

/**
 * Serviço responsável pela lógica de negócio e persistência do módulo de Escalas.
 */
export class EscalaService {
  private rhService!: RHService;

  constructor() {
    // console.log("EscalaService: Instanciado.");
  }

  // Método Setter para injeção de dependência tardia
  public setRHService(rhService: RHService): void {
    this.rhService = rhService;
  }

  /**
   * R13: Cria uma nova proposta de escala no banco de dados.
   */
  public async criarEscala(data: CriarEscalaPayload): Promise<EscalaModel> {
    if (!this.rhService) {
      throw new Error("RHService não foi injetado.");
    }

    // 1. CHECAGEM DE REGRAS DE NEGÓCIO (R1.F - Colaborador Ativo)
    for (const colaboradorId of data.colaboradores) {
      // Usa o método do RHService que busca por id_colaborador
      const colaborador = await this.rhService.getColaboradorById(
        colaboradorId
      );

      // Regra de Negócio: Somente colaboradores ATIVOS podem ser escalados.
      if (!colaborador || colaborador.status !== "ATIVO") {
        throw new Error(
          `Colaborador ID ${colaboradorId} não está disponível ou ativo e não pode ser escalado.`
        );
      }
    }

    // 2. PERSISTÊNCIA (Cria a Escala Head)
    const { colaboradores, ...escalaData } = data;
    const novaEscalaHead = await Escala.create(escalaData);

    // 3. PERSISTÊNCIA (Cria as entradas na tabela de ligação)
    // Se Escala possui o método addColaboradores:
    // await (novaEscalaHead as any).addColaboradores(colaboradores);

    return novaEscalaHead.toJSON() as EscalaModel;
  }

  /**
   * R13: Altera o status da escala para 'APROVADA'.
   * Usa a chave primária 'id_escala'.
   */
  public async aprovarEscala(
    id_escala: number, // PK da escala
    aprovador_id: number // ID do usuário aprovador
  ): Promise<EscalaModel> {
    // Atualiza apenas se o status for 'PENDENTE'
    const [linhasAfetadas] = await Escala.update(
      { status: "APROVADA", aprovador_id: aprovador_id },
      {
        where: { id_escala: id_escala, status: "PENDENTE" },
      }
    );

    if (linhasAfetadas === 0) {
      const escalaExistente = await Escala.findByPk(id_escala);

      if (!escalaExistente) {
        throw new Error(`Escala ID ${id_escala} não encontrada.`);
      }
      throw new Error(
        `A escala ID ${id_escala} não pôde ser aprovada (Status atual: ${escalaExistente.status}).`
      );
    }

    // Busca o registro atualizado para retornar o objeto completo
    const escalaAprovada = (await Escala.findByPk(id_escala)) as Escala;

    return escalaAprovada.toJSON() as EscalaModel;
  }
}
