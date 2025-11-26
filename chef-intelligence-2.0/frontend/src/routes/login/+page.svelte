<script lang="ts">
    import { goto } from '$app/navigation';
    import { authActions } from '$stores/authStore';
    // Importe $lib/api/fetchHelper (vamos usar o fetch nativo do SvelteKit)
    
    let username = 'admin'; // Preenchido conforme sua regra
    let password = 'admin'; // Preenchido conforme sua regra
    let error: string | null = null;
    let loading = false;

    async function handleLogin() {
        loading = true;
        error = null;

        try {
            // 1. Usa o fetch nativo do SvelteKit
            const response = await fetch('/api/auth/login-admin', { // Rota do seu backend
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                // Backend deve ter setado o Cookie 'jwt' (HttpOnly) no header 'Set-Cookie'
                const { user } = await response.json(); // Backend pode retornar dados básicos do usuário
                
                // 2. Atualiza o estado local (authStore)
                authActions.setUser(user); 
                
                // 3. Redireciona para a próxima etapa: Criação do Superusuário
                goto('/criar-superusuario'); 

            } else {
                error = 'Credenciais de administrador inválidas ou erro no backend.';
            }
        } catch (e) {
            error = 'Erro de rede. Verifique a conexão com o servidor.';
        } finally {
            loading = false;
        }
    }
</script>

<div class="flex items-center justify-center min-h-screen bg-gray-50">
    <div class="p-8 bg-white shadow-xl rounded-lg w-full max-w-md">
        <h1 class="text-2xl font-bold text-center mb-6">Acesso Inicial (admin/admin)</h1>
        
        <form on:submit|preventDefault={handleLogin}>
            <button type="submit" disabled={loading} class="w-full bg-blue-600 text-white p-3 rounded-md hover:bg-blue-700 transition duration-150">
                {#if loading}Carregando...{:else}Acessar Plataforma{/if}
            </button>
        </form>

        {#if error}
            <p class="mt-4 text-sm text-red-500 text-center">{error}</p>
        {/if}
    </div>
</div>