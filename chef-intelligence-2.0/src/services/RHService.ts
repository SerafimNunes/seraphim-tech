// src/services/RHService.ts

import Colaborador from "../models/Colaborador";
import { EscalaService } from "./EscalaService"; // Importa a classe para tipagem
// 🔑 CORREÇÃO: Importa os tipos de domínio de config/types.ts
import {
  IHistoricoPerformance,
  IPerfilIdeal,
  ITreinamento,
  IColaboradorBase,
} from "../config/types";

export class RHService {
  // 🔑 Propriedade tipada como a classe (instância)
  private escalaService: EscalaService;

  // ✅ CORREÇÃO CRÍTICA: O construtor APENAS recebe a instância.
  // Isso quebra a dependência circular.
  constructor(escalaServiceInstance: EscalaService) {
    this.escalaService = escalaServiceInstance;
  }

  // --- Métodos de RHService ---

  async definirPerfilIdeal(perfil: IPerfilIdeal): Promise<void> {
    console.log(
      `👤 RHService: Perfil ideal definido para o cargo ${perfil.cargo_id}.`
    );
  }

  async verificarTreinamentoConcluido(
    colaboradorId: number,
    cargoId: number
  ): Promise<boolean> {
    const concluido = Math.random() > 0.1;
    console.log(
      `📚 RHService: Checando R13 - Colaborador ${colaboradorId} tem treinamento? ${concluido}.`
    );
    return concluido;
  }

  async registrarPerformance(data: IHistoricoPerformance): Promise<void> {
    console.log(
      `📊 RHService: Performance de ${data.colaborador_id} registrada para Análise (Módulo 6).`
    );
  }

  // Você pode adicionar outros métodos do RHService aqui (ex: consultarCursos, buscarHistorico)
}
