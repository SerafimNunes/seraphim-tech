<script>
    import { authStore, authActions } from '$stores/authStore';

    async function handleLogout() {
        // Chamada de API para o backend remover o Cookie 'jwt'
        await fetch('/api/auth/logout', { method: 'POST' }); 
        
        // Limpa o estado local
        authActions.logout(); 

        // Redireciona para /login (o Hook fará isso se o cookie for removido)
    }
</script>

<div class="p-8">
    <h1 class="text-3xl font-bold text-blue-700">👋 Dashboard BI (Chef Intelligence)</h1>
    <p class="mt-4">Bem-vindo, {$authStore.user?.name || 'Usuário'}.</p>
    <p>Você está acessando como **{$authStore.user?.roles.join(', ') || 'N/A'}** (R12 - RBAC) na unidade **{$authStore.user?.unitId || 'N/A'}** (R4 - Multi-Unidade).</p>

    <button on:click={handleLogout} class="mt-6 bg-red-500 text-white p-2 rounded hover:bg-red-600">
        Sair (Logout)
    </button>
</div>