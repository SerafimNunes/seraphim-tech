// Caminho: frontend/src/routes/+layout.svelte

<script lang="ts">
    import '../app.css'; // Importa o TailwindCSS

    // Importações existentes
    import { authStore, authActions } from '$stores/authStore'; 
    import { page, navigating } from '$app/stores'; 
    import { onMount } from 'svelte';

    // R1: Tipagem do dado carregado pelo +layout.server.ts
    // 🔑 CORREÇÃO CRÍTICA: Sintaxe correta para importar tipos gerados pelo SvelteKit.
    import type { UserData } from '$lib/types'; // <-- Esta é a sintaxe funcional e correta.
    
    type CustomLayoutData = {
        user: UserData | null;
    };
    // Exporta a variável 'data' usando o tipo LayoutData importado
    export let data: CustomLayoutData; 
    
    // Variáveis de estado global existentes
    let isLoading = false;
    let isSidebarOpen = true; 

    // Reage quando a navegação muda (para mostrar o loader)
    $: isLoading = $navigating !== null;

    // Lógica para alternar a sidebar
    function toggleSidebar() {
        isSidebarOpen = !isSidebarOpen;
    }
    
    // Lógica de hidratação (Mesclagem)
    // ----------------------------------------------------
    onMount(() => {
        // Agora 'data.user' é tipado corretamente.
        if (data.user) {
            // Sincroniza a Store do Svelte com o estado de autenticação do servidor (SSR)
            authActions.setUser(data.user);
        }
    });
    // ----------------------------------------------------

    // Verifica se a rota atual está no dashboard BI (já existia)
    $: isDashboard = $page.url.pathname.startsWith('/dashboard-bi');
</script>

<div class="flex h-screen bg-gray-100">

    {#if $authStore.isAuthenticated}
        <aside class="flex flex-col bg-gray-800 text-white transition-all duration-300"
                class:w-64={isSidebarOpen} 
                class:w-20={!isSidebarOpen}>
            
            <div class="p-4 text-xl font-bold border-b border-gray-700">
                {isSidebarOpen ? 'Chef Intelligence' : 'CI'}
            </div>
            
            <nav class="flex-grow p-4">
                <a href="/dashboard-bi" class="flex items-center p-2 rounded-lg hover:bg-gray-700 transition duration-150 mb-2">
                    <span class="mr-3">📊</span>
                    {#if isSidebarOpen}Dashboard BI{/if}
                </a>
                </nav>

            <button on:click={toggleSidebar} class="p-3 text-center bg-gray-900 hover:bg-gray-700">
                {isSidebarOpen ? 'Fechar' : 'Abrir'}
            </button>
        </aside>
    {/if}


    <main class="flex-grow flex flex-col overflow-y-auto">
        
        {#if $authStore.isAuthenticated}
            <header class="p-4 bg-white shadow-md flex justify-between items-center">
                <h1 class="text-2xl font-semibold text-gray-800">
                    {$page.url.pathname === '/' ? 'Home' : $page.url.pathname.substring(1).split('/')[0]}
                </h1>
                
                <div class="flex items-center space-x-4">
                    <span class="text-gray-600">
                        Olá, {$authStore.user?.name || 'Usuário'}
                    </span>
                    <button on:click={authActions.logout} 
                                class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">
                        Sair
                    </button>
                </div>
            </header>
        {/if}

        {#if isLoading}
            <div class="absolute top-0 left-0 right-0 h-1 bg-blue-500 z-50 animate-pulse"></div>
        {/if}
        
        <div class="p-6 flex-grow">
            <slot />
        </div>
        
    </main>
</div>