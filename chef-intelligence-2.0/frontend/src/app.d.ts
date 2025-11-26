// Caminho: frontend/src/app.d.ts

/// <reference types="@sveltejs/kit" />
/// <reference types="vite/client" />

// 🔑 CORREÇÃO: Importa a tipagem rígida definida em $lib/types/index.ts
// Certifique-se de que o UserData exportado tenha a propriedade 'id'.
import type { UserData } from '$lib/types';

declare global {
    namespace App {
        // REMOVA A DEFINIÇÃO DE interface UserData daqui!

        // 1. Tipagem para event.locals (Usando a interface importada)
        interface Locals {
            // Usa o tipo UserData importado
            user: UserData | null;
        }

        // 2. Tipagem para os dados retornados do lado do servidor (PageData)
        interface PageData {
            // Usa o tipo UserData importado
            user: UserData | null;
        }

        // interface Error {}
    }
}

export {};
