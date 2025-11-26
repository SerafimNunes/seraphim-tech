npm run type-check 21:56:07

> chef-intelligence-2.0@1.0.0 type-check
> tsc --noEmit

src/services/AnaliseService.ts:383:13 - error TS2739: Type '{ receita_total: number; custo_mercadoria_vendida: number; despesas_variaveis: number; margem_contribuicao_valor: number; margem_contribuicao_percentual: number; custo_fixo_total: number; lucro_operacional: number; ponto_equilibrio_receita: number; tendencia_receita: any[]; tendencia_cmv: any[]; }' is missing the following properties from type 'DashboardKPIs': receita_liquida, cmv_real_time, margem_bruta, ticket_medio, mcmp

383 const kpis: DashboardKPIs = {
~~~~

Found 1 error in src/services/AnaliseService.ts:383
