// src/services/IAnaliseService.ts

import { KPIFilter, DashboardKPIs } from '../config/types'; // AJUSTE: Importando de config/types.ts

/**
 * Define a interface para o AnaliseService.
 * (Seguindo o padrão de tipagem para Serviços, facilitando Mocks e Injeção de Dependência)
 */
export interface IAnaliseService {
  getCMVRealTime(filter: KPIFilter): Promise<number>;
  getMCMP(filter: KPIFilter): Promise<number>;
  getIndiceDesperdicio(filter: KPIFilter): Promise<number>;

  /**
   * R10: Agrega as principais métricas para o dashboard de BI.
   * @param filter Filtro de unidade e período.
   * @returns Objeto contendo todos os KPIs principais.
   */
  getInsightsPrincipais(filter: KPIFilter): Promise<DashboardKPIs>;
}
