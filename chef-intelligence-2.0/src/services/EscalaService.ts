// src/services/EscalaService.ts

import { IEscala, IRegraColaborador, IColaboradorBase } from "../config/types";
import { RHService } from "./RHService";

export class EscalaService {
  // ✅ CORREÇÃO 1: Usamos '!' (non-null assertion) para dizer ao TS
  // que a propriedade será inicializada após o construtor (pelo setter).
  private rhService!: RHService; // ✅ CORREÇÃO 2: Construtor limpo. Remove a chamada 'new RHService()'.

  constructor() {
    // O 'this.rhService' não é inicializado aqui.
  } // ✅ CORREÇÃO 3: Setter dentro da classe, com sintaxe correta.

  public setRHService(rhServiceInstance: RHService): void {
    this.rhService = rhServiceInstance;
  } // --- Geração Algorítmica (R13) ---

  async gerarEscalaOtimizada(
    demanda: any,
    regras: IRegraColaborador[],
    colaboradores: IColaboradorBase[]
  ): Promise<IEscala[]> {
    console.log(`⚙️ EscalaService: Iniciando algoritmo de otimização.`);

    // É seguro usar this.rhService aqui, pois ele será inicializado pelo ponto de entrada.
    const escalaGerada: IEscala[] = [];

    for (const colaborador of colaboradores) {
      const isTrained = await this.rhService.verificarTreinamentoConcluido(
        colaborador.id_colaborador,
        colaborador.cargo_id
      );
      // ... (restante da lógica)
    }
    return escalaGerada;
  } // --- Validação e Aprovação (R12) ---

  async aprovarEscala(escalaId: number, gerenteId: number): Promise<IEscala> {
    console.log(
      `✅ EscalaService: Escala ${escalaId} aprovada pelo Gerente ${gerenteId} (R12).`
    );
    return {
      /* ... */
    } as IEscala;
  }
}
