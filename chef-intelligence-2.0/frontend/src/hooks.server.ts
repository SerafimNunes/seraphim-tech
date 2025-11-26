// Caminho: frontend/src/hooks.server.ts

import type { Handle } from '@sveltejs/kit';
import type { UserData } from '$lib/types'; // Importa a tipagem rígida

const JWT_SECRET = process.env.JWT_SECRET;
// ATENÇÃO: Embora você tenha importado JWT_SECRET, ele não está sendo usado
// na simulação. Em produção, você DEVE usar o JWT_SECRET aqui (junto a uma biblioteca JWT)
// para verificar a assinatura do token antes de confiar nos dados.

/**
 * @param token Token JWT do cookie
 * @returns UserData | null
 */
function validateToken(token: string): UserData | null {
    // 🔑 CORREÇÃO: O objeto retornado agora INCLUI id e email para satisfazer a interface UserData (R1).
    if (token) {
        // ATENÇÃO: Em produção, o 'jwt.verify' retornaria este objeto decodificado.
        return {
            id: 'user-id-123',
            name: 'João Superuser',
            email: 'joao.s@ci.com',
            roles: ['superuser', 'admin'],
            unitId: 'unit-1',
        };
    }
    return null;
}

export const handle: Handle = async ({ event, resolve }) => {
    // Rotas protegidas (acesso restrito - R12)
    const protectedRoutes = ['/dashboard-bi', '/vendas', '/estoque'];

    // Rotas de Autenticação (acesso público para deslogados, redireciona logados)
    const authRoutes = ['/criar-superusuario', '/login'];

    const currentPath = event.url.pathname;

    // 1. Tenta obter o token do cookie
    const token = event.cookies.get('jwt');
    const user = validateToken(token || '');

    event.locals.user = user; // Torna os dados do usuário acessíveis

    // 2. Flags de Roteamento
    const isProtectedRoute = protectedRoutes.some((route) => currentPath.startsWith(route));
    const isAuthRoute = authRoutes.includes(currentPath);
    const isRoot = currentPath === '/'; // NOVO: Flag para a rota raiz

    if (user) {
        // ------------------------------------
        // Usuário AUTENTICADO
        // ------------------------------------
        if (isAuthRoute || isRoot) {
            // Se logado e tentando acessar a página de auth OU a raiz (//)
            // Redireciona para o Dashboard BI (R4, R12)
            return Response.redirect(new URL('/dashboard-bi', event.url), 302);
        }
    } else {
        // ------------------------------------
        // Usuário NÃO AUTENTICADO
        // ------------------------------------
        if (isProtectedRoute || isRoot) {
            // Se tenta acessar rota protegida OU a rota raiz (//)
            // Redireciona para a página de criação de superusuário (ponto de entrada)
            return Response.redirect(new URL('/criar-superusuario', event.url), 302);
        }
    }

    // 3. Continua para a renderização normal
    return resolve(event);
};
