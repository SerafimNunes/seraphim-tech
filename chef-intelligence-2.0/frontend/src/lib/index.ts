import { goto } from '$app/navigation';
// Importa a variável de ambiente PUBLIC_API_BASE_URL
const PUBLIC_API_BASE_URL = import.meta.env.PUBLIC_API_BASE_URL;

export const API_BASE_URL = PUBLIC_API_BASE_URL;

interface ApiError {
    message: string;
    statusCode: number;
    details?: any;
}

/**
 * Função utilitária para fetch de API do Chef Intelligence.
 */
export async function apiFetch<T = any>(
    endpoint: string, // Apenas o path, e.g., '/auth/login'
    options: RequestInit = {}
): Promise<T> {
    // Constrói a URL completa usando a variável de ambiente
    const url = `${PUBLIC_API_BASE_URL}${endpoint}`;

    const defaultHeaders = {
        'Content-Type': 'application/json',
        // IMPORTANTE: Não adicionamos o token JWT aqui. O navegador faz isso automaticamente via Cookie HttpOnly!
        ...options.headers,
    };

    try {
        const response = await fetch(url, {
            ...options,
            headers: defaultHeaders,
        });

        if (!response.ok) {
            const errorData = (await response.json().catch(() => ({}))) as ApiError;

            if (response.status === 401 || response.status === 403) {
                // Trata falha de Autenticação/Autorização (R12 - RBAC)
                await goto('/login');
            }

            throw {
                message: errorData.message || `Erro do servidor: ${response.statusText}`,
                statusCode: response.status,
                details: errorData.details,
            } as ApiError;
        }

        if (response.status === 204) {
            return {} as T;
        }

        return (await response.json()) as T;
    } catch (error) {
        if (error instanceof TypeError) {
            throw {
                message: 'Erro de conexão de rede. Verifique se o backend está ativo.',
                statusCode: 0,
            } as ApiError;
        }
        throw error;
    }
}
