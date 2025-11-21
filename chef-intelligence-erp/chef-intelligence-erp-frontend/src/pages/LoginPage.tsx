// src/pages/LoginPage.tsx
import { Container, Title, Paper, TextInput, PasswordInput, Button, Center } from '@mantine/core';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    // ⚠️ CRÍTICO: Confirme a porta do seu backend (o Express que você subiu)
    const BACKEND_URL = 'http://localhost:3000/api/v1/auth/login';

    try {
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        // Assume que o backend retorna um objeto com uma chave 'token'
        localStorage.setItem('erp_auth_token', data.token);
        navigate('/'); // Redireciona para a Dashboard
      } else {
        alert('Falha no login. Credenciais inválidas.');
      }
    } catch (error) {
      console.error('Erro de conexão:', error);
      alert('Erro de conexão. Verifique se o servidor Express está rodando.');
    }
  };

  return (
    <Center style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      <Container size={420} my={40}>
        <Title align="center" order={2} mb="xl">
          Chef Intelligence ERP 
        </Title>
        <Paper 
          withBorder 
          shadow="md" 
          p={30} 
          radius="md" 
          component="form" 
          onSubmit={handleSubmit}
        >
          <TextInput 
            label="Email/Usuário" 
            placeholder="seu.usuario@exemplo.com" 
            required 
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
          <PasswordInput 
            label="Senha" 
            placeholder="Sua senha" 
            required 
            mt="md" 
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
          <Button fullWidth mt="xl" type="submit">
            Entrar no Sistema
          </Button>
        </Paper>
      </Container>
    </Center>
  );
}