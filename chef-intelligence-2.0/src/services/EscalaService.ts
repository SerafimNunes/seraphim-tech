// src/services/EscalaService.ts

import { IEscala, IRegraColaborador, IColaboradorBase } from "../config/types";
import { RHService } from "./RHService";

export class EscalaService {
  // A propriedade 'rhService' será inicializada externamente via setter (Injeção de Dependência).
  private rhService!: RHService;

  constructor() {
    // Construtor limpo para Injeção de Dependência
  }

  // Setter para Injeção de Dependência
  public setRHService(rhServiceInstance: RHService): void {
    this.rhService = rhServiceInstance;
  }

  // --- Geração Algorítmica (R13) ---

  /**
   * Executa o algoritmo de otimização de escala, levando em conta a demanda,
   * regras de colaborador e treinamento (R13).
   */
  async gerarEscalaOtimizada(
    demanda: any, // Detalhes da demanda (horas necessárias por cargo, por exemplo)
    regras: IRegraColaborador[], // Regras de cada colaborador (folgas, preferências)
    colaboradores: IColaboradorBase[] // Lista de colaboradores disponíveis
  ): Promise<IEscala[]> {
    console.log(`⚙️ EscalaService: Iniciando algoritmo de otimização (R13).`);

    const escalaGerada: IEscala[] = [];
    let idEscalaCounter = 1;

    // 1. Filtragem e Classificação de Colaboradores (Pré-requisitos)
    const colaboradoresQualificados = [];

    for (const colaborador of colaboradores) {
      // 1.1. 🔑 R13: Verifica se o colaborador tem o treinamento necessário via RHService
      const isTrained = await this.rhService.verificarTreinamentoConcluido(
        colaborador.id_colaborador,
        colaborador.cargo_id
      );

      if (isTrained) {
        colaboradoresQualificados.push({
          ...colaborador,
          // Simulação: Anexa regras relevantes
          regras: regras.find(
            (r) => r.colaborador_id === colaborador.id_colaborador
          ),
        });
      } else {
        console.log(
          `❌ Colaborador ${colaborador.id_colaborador} desqualificado: Treinamento pendente.`
        );
      }
    }

    // 2. Simulação da Alocação Otimizada
    console.log(
      `✅ ${colaboradoresQualificados.length} colaboradores qualificados para alocação.`
    );

    // Núcleo do Algoritmo de Otimização (Heurísticas, Alocação, etc.)

    if (colaboradoresQualificados.length > 0) {
      // Exemplo de alocação simples para demonstrar o fluxo R13
      const primeiroColaborador = colaboradoresQualificados[0];

      escalaGerada.push({
        id_escala: idEscalaCounter++,
        status: "SUGERIDO",
        colaborador_id: primeiroColaborador.id_colaborador,
        unidade_id: 1, // Assumindo unidade 1

        // 🔑 CORREÇÃO TS2352: Usa new Date() para corresponder ao tipo Date da IEscala
        data_trabalho: new Date(),
        hora_inicio: "08:00",
        hora_fim: "16:00",
        aprovada_gerente: false,

        // Propriedades já existentes
        turno: "MATUTINO",
        horas_alocadas: 8,
        id_cargo: primeiroColaborador.cargo_id,
      } as IEscala);
    }

    return escalaGerada;
  }

  // --- Validação e Aprovação (R12) ---

  /**
   * Valida se uma escala gerada ou editada está em conformidade com todas as regras
   * (sindicais, folgas obrigatórias, horas mínimas/máximas).
   */
  public async validarEscala(escala: IEscala): Promise<boolean> {
    console.log(
      `🔍 EscalaService: Validando escala [ID: ${escala.id_escala}]...`
    );
    // 💡 Implementar a lógica de validação real aqui.
    return true;
  }

  /**
   * Aprova uma escala após a validação e as verificações do RBAC (R12).
   */
  async aprovarEscala(escalaId: number, gerenteId: number): Promise<IEscala> {
    console.log(
      `✅ EscalaService: Escala ${escalaId} aprovada pelo Gerente ${gerenteId} (R12).`
    );

    // 💡 Implementação futura: Buscar e atualizar o status no banco de dados.
    return {
      id_escala: escalaId,
      status: "APROVADO",
      colaborador_id: 0,
      // 🔑 CORREÇÃO TS2352: Usa new Date()
      data_trabalho: new Date(),
      hora_inicio: "08:00",
      hora_fim: "16:00",
      aprovada_gerente: true,
      turno: "MATUTINO",
      horas_alocadas: 8,
      id_cargo: 0,
      unidade_id: 0,
    } as IEscala;
  }
}
