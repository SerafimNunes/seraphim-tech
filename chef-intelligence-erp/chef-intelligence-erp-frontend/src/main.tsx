// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider } from '@mantine/core'; 
import '@mantine/core/styles.css'; 
import App from './App.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* ⬅️ Este provedor é CRÍTICO para os componentes Mantine */}
    <MantineProvider defaultColorScheme="light"> 
      <App />
    </MantineProvider>
  </React.StrictMode>,
);