import { RHService } from "./RHService";
import Escala, {
  EscalaCreationAttributes,
  EscalaModel,
} from "../models/Escala";
import { Transaction } from "sequelize";

// Interface para uso interno
interface CriarEscalaPayload extends EscalaCreationAttributes {
  colaboradores: number[];
  transaction?: Transaction;
  data_escala: Date; 
}

export class EscalaService {
  private rhService!: RHService;

  public setRHService(rhService: RHService): void {
    this.rhService = rhService;
  }

  public async criarEscala(data: CriarEscalaPayload): Promise<EscalaModel> {
    if (!this.rhService) {
      throw new Error("RHService não foi injetado.");
    }

    for (const colaboradorId of data.colaboradores) {
      const colaborador = await this.rhService.getColaboradorAtivo(
        colaboradorId,
        data.unidade_id
      );

      if (!colaborador) {
        throw new Error(
          `Colaborador ID ${colaboradorId} não encontrado ou inativo na unidade ${data.unidade_id}.`
        );
      }
    }

    const novaEscalaHead = await Escala.create(data, { transaction: data.transaction });

    if ((novaEscalaHead as any).addColaboradores) {
        await (novaEscalaHead as any).addColaboradores(data.colaboradores, { transaction: data.transaction });
    }

    return novaEscalaHead.toJSON() as EscalaModel;
  }

  public async aprovarEscala(
    id_escala: number,
    aprovador_id: number
  ): Promise<EscalaModel> {
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

    return (await Escala.findByPk(id_escala)) as EscalaModel;
  }

  public async gerarPropostaEscala(
    unidade_id: number,
    data_inicio: Date,
    data_fim: Date
  ): Promise<EscalaModel> {
    // 🔑 CORRIGIDO: Payload preenchido com todos os campos obrigatórios (TS2739)
    const mockPayload: CriarEscalaPayload = {
      unidade_id: unidade_id,
      data_escala: data_inicio,
      data_inicio: data_inicio,
      data_fim: data_fim,
      criador_id: 1, // Assumindo ID sistema
      status: "PENDENTE",
      colaboradores: [1, 2, 3], 
    };

    return this.criarEscala(mockPayload);
  }
}