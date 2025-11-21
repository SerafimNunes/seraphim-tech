// src/pages/NotFoundPage.tsx
export default function NotFoundPage() {
  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h1>❌ 404 - Página Não Encontrada</h1>
      <p>A URL que você tentou acessar não existe. Verifique o endereço.</p>
      <a href="/login" style={{ marginTop: '20px', display: 'inline-block' }}>Voltar para o Login</a>
    </div>
  );
}