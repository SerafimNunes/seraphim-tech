# 📚 Documentação das Rotas de API (Tabela Resumo)

Para o seu documento de desenvolvimento, aqui está a lista completa de endpoints que você pode usar (assumindo que o API_BASE_URL no .env é http://localhost:3000/api):

## Módulo | Finalidade | Rota Completa (Frontend) | Método | RBAC (R12) |

DASHBOARD | "Métricas consolidadas (RH, Estoque, Finanças)" | /api/dashboard | GET | auth + VIEW_DASHBOARD

LOGIN | Autenticação | /api/auth/login | POST | Público

FINANCEIRO | KPIS de Análise Financeira | /api/analise/financeiro | GET | auth + ANALISE_LEITURA

RH | Configuração de Perfil Ideal | /api/rh/perfil-ideal | POST | auth + RH_GESTAO

RH | Registro de Performance | /api/rh/performance | POST | auth + RH_GESTAO

PLANEJAMENTO | Necessidades de Reposição (R11) | /api/planejamento/necessidades | GET,auth + PLANEJAMENTO_LEITURA

PRODUÇÃO | Alerta de Produção | /api/producao/alerta | GET,auth

ESTOQUE | Listar Itens de Estoque | /api/produtos | GET | auth

ESTOQUE | Movimento de Entrada (Compra) | /api/produtos/:id/entrada | PATCH | auth

CAIXA | Abrir/Fechar/Lançamentos | "{/api/caixa/abrir} {/api/caixa/lancamento}" | POST | auth.
