// Caminho: frontend/src/lib/types/index.ts

/**
 * 🧑‍🍳 Interface de Dados do Usuário (UserData)
 * Define a tipagem rígida para os dados do usuário extraídos do JWT/Sessão.
 * (Alinhada com R1 - Tipagem Rígida, R4 - Multi-Unidade, R12 - RBAC)
 */
export interface UserData {
    /** ID único do usuário no Backend */
    id: string;
    /** Nome completo ou de exibição */
    name: string;
    /** Email (usado para login, por exemplo) */
    email: string;
    /** Lista de permissões/perfis (Essencial para RBAC - R12) */
    roles: string[];
    /** ID da unidade/restaurante que o usuário está acessando (Essencial para Multi-Unidade - R4) */
    unitId: string;
}

/**
 * 📈 Interface de Dados do Módulo Dashboard BI
 */
export interface BIProfitabilityData {
    date: string;
    cmv: number;
    sales: number;
    profitMargin: number;
}

/**
 * 📦 Interface de Dados do Módulo Estoque
 * (Alinhada com R2 - Estoque não Negativo e R11 - Ponto de Pedido)
 */
export interface StockItem {
    id: string;
    name: string;
    currentQuantity: number; // Garante que nunca é negativo (R2)
    unit: string;
    cost: number;
    minStockLevel: number;
}
