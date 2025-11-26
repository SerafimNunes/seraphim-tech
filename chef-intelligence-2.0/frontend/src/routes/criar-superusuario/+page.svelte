<script lang="ts">
    import { goto } from '$app/navigation';
    import { authActions } from '$stores/authStore';
    
    // R1: Tipagem rígida para os dados
    let name = '';
    let email = '';
    let newPassword = '';
    
    let error: string | null = null;
    let loading = false;

    // Função de tratamento do formulário
    async function handleCreateSuperuser() {
        loading = true;
        error = null;

        try {
            // Usa o fetch nativo do SvelteKit
            const response = await fetch('/api/setup/admin', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Envia os dados do novo superusuário
                body: JSON.stringify({ name, email, newPassword }) 
            });

            if (response.ok) {
                // ASSUNÇÃO: Backend seta o Cookie JWT (HttpOnly) e retorna os dados do usuário.
                const { user } = await response.json(); 
                
                // 1. Atualiza a store com os dados do superusuário (R1, R12, R4)
                authActions.setUser(user); 
                
                // 2. Redireciona para o Dashboard BI
                goto('/dashboard-bi'); 

            } else {
                // Tratamento de erro do backend
                const errorData = await response.json();
                error = errorData.message || 'Falha ao criar o superusuário. Verifique os dados.';
            }
        } catch (e) {
            error = 'Erro de rede ou servidor.';
            console.error(e);
        } finally {
            loading = false;
        }
    }
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-100 p-4">
    <div class="w-full max-w-md bg-white p-8 rounded-xl shadow-2xl">
        
        <h1 class="text-3xl font-extrabold text-gray-900 mb-2 text-center">
            Configuração Inicial
        </h1>
        <p class="text-gray-500 mb-8 text-center">
            Crie o primeiro Superusuário do Chef Intelligence.
        </p>

        <form on:submit|preventDefault={handleCreateSuperuser} class="space-y-6">
            
            <div>
                <label for="name" class="block text-sm font-medium text-gray-700">Nome Completo</label>
                <input 
                    id="name" 
                    type="text" 
                    bind:value={name} 
                    required 
                    class="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
            </div>
            
            <div>
                <label for="email" class="block text-sm font-medium text-gray-700">E-mail (Login)</label>
                <input 
                    id="email" 
                    type="email" 
                    bind:value={email} 
                    required 
                    class="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
            </div>
            
            <div>
                <label for="password" class="block text-sm font-medium text-gray-700">Senha (Mín. 8 caracteres)</label>
                <input 
                    id="password" 
                    type="password" 
                    bind:value={newPassword} 
                    required 
                    minlength="8"
                    class="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
            </div>

            {#if error}
                <div class="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md" role="alert">
                    {error}
                </div>
            {/if}

            <button 
                type="submit" 
                disabled={loading} 
                class="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 disabled:opacity-50"
            >
                {#if loading}
                    Processando...
                {:else}
                    Criar Superusuário
                {/if}
            </button>
        </form>
    </div>
</div>