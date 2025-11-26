<script lang="ts">
    // Esta página não precisa de nenhuma lógica, pois o
    // hooks.server.ts (SSR) cuida do redirecionamento
    // antes que o Svelte a renderize no cliente.
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="text-center p-6 bg-white shadow-lg rounded-lg">
        <h1 class="text-3xl font-bold text-gray-700 mb-4">
            Carregando o Chef Intelligence...
        </h1>
        <p class="text-gray-500">
            Aguarde o redirecionamento.
        </p>
        <div class="mt-6">
            <svg class="animate-spin h-8 w-8 text-blue-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        </div>
    </div>
</div>

<style>
    /* Opcional: Estilos globais se não estiver usando Tailwind */
</style>