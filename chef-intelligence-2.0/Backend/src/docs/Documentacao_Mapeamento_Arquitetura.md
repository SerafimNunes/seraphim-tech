# Documentacao de Referência: Arquitetura e Mapeamento do Chef Intelligence 2.0

Este documento descreve a arquitetura de software (baseada em Camadas) e o mapeamento dos principais componentes do sistema Chef Intelligence 2.0, focando nas camadas de Model (Dados), Service (Negócio), Controller (API) e Roteamento.

A arquitetura segue o padrão de Separação de Responsabilidades (SRP), onde o Controller trata a requisição HTTP e validação de entrada (Regra 1.B), o Service encapsula a lógica de negócio e o acesso a dados (Regra 2.B), e o Model representa a estrutura de dados persistente.Mapeamento Detalhado dos Componentes (Models)Os modelos (Models) representam as entidades do banco de dados e são a única camada com permissão para interagir diretamente com o Sequelize (ORM), conforme a Regra 2.B (GCI). Todos os Models principais implementam a Regra R4 (Multi-Unidade) via a chave unidade_id (Regra GPR-1).

## Tipo de Arquivo | Nome da Tabela no DB | Chave Primária (PK) | Chaves Estrangeiras (FK) | Regras Chave / Função Principal | Associações (Exemplos) | Frontend/Uso Principal

######################################################################

### NOME do ARQUIVO: // src/config/associations.ts

TIPO DE ARQUIVO: Config
NOME DA TABELA NO DB: N/A (Arquivo de Configuração do ORM)
CHAVE PRIMÁRIA (PK): N/A
CHAVES ESTRANGEIRAS (FK): N/A
REGRAS CHAVE / FUNÇÃO PRINCIPAL:Regra GPR-3 (Gerenciamento de Associações de Modelos): Centraliza a configuração de todas as relações de Modelos (e.g., belongsTo, hasMany, belongsToMany) após o carregamento de todos eles pelo ORM (Sequelize).Estabilidade Arquitetural: Este ponto de centralização é crucial para prevenir problemas de dependência circular (A depende de B e B depende de A) que podem ocorrer quando as associações são definidas dentro dos arquivos de modelo. Ao centralizar, garantimos que todos os Modelos estão carregados antes de ligarmos suas Chaves Estrangeiras (FKs).Habilitação de Consultas: Assegura que as referências FKs estejam corretamente mapeadas, permitindo que a Camada de Service execute consultas de dados complexas e eficientes com JOINs, o que é fundamental para a performance e a recuperação de dados em dashboards.
ASSOCIAÇÕES COM OUTROS ARQUIVOS:Modelos (VendaComanda.ts, VendaItem.ts, VendaMesa.ts, etc.): Depende da execução da função associate estática exportada por cada arquivo Model.Tipagem (types.ts): Normaliza o objeto IModelFactory para garantir a correta injeção e referência de modelos.Regra R4/GPR-1 (Multi-Unidade): Estabelece a associação crítica do campo unidade_id a todos os Modelos que implementam esta chave (Regra R4), garantindo a integridade referencial e o Isolamento de Dados entre as unidades de negócio.
FRONTEND / USO PRINCIPAL:Infraestrutura de Backend: Não é utilizado diretamente pelo frontend.Uso Vital: Sua execução é vital durante a inicialização do servidor (processo de bootstrapping). A correta aplicação das associações é o que permite à Camada de Service (em concordância com a Regra 2.D GCI) realizar a agregação e o cálculo de KPIs consolidados, como o CMV e a Receita.

######################################################################

### Nome do arquivo: // src/config/database.ts

TIPO DE ARQUIVO: Config

NOME DA TABELA NO DB: N/A

CHAVE PRIMÁRIA (PK): N/A

CHAVES ESTRANGEIRAS (FK): N/A

REGRAS CHAVE / FUNÇÃO PRINCIPAL:

Regra GPR-4 (Configuração de Infraestrutura): Este arquivo é o ponto central para a configuração de acesso ao banco de dados PostgreSQL. Ele encapsula todos os parâmetros de conexão (host, porta, usuário, senha, nome do DB) para o ORM (Sequelize).

Separação de Configuração (R3): Garante a separação de credenciais do ambiente de código, buscando variáveis sensíveis exclusivamente de process.env (lido via dotenv/config), seguindo o princípio de 12 fatores.

Controle de Conexão: Define parâmetros críticos do pool de conexões (máximo, mínimo, tempo de aquisição e inatividade), otimizando a performance e o uso de recursos do banco de dados, o que impacta a estabilidade geral da aplicação (Regra GCI-1.A - Estabilidade de Dependência).

Ambiente Único: O código mostra que ele é configurado primariamente para o ambiente development, garantindo que os logs de conexão sejam desligados (logging: false) para produção (ou desabilitados para development neste caso específico).

ASSOCIAÇÕES COM OUTROS ARQUIVOS:

dotenv: Depende da biblioteca dotenv para carregar as variáveis de ambiente necessárias.

sequelize: O objeto de configuração exportado é consumido pelo arquivo src/config/sequelize.ts (ou equivalente) para inicializar a instância do ORM.

Tipagem (Typescript): Define e utiliza a interface IDatabaseConfig para garantir a tipagem estrita de todas as propriedades de conexão.

FRONTEND / USO PRINCIPAL: Componente de infraestrutura de backend. Sua função é estritamente a de prover o objeto de configuração inicial para a camada de persistência. A sua correta configuração é um pré-requisito para que todos os Models consigam se conectar ao DB e, consequentemente, para que a Regra 2.D GCI (acesso a dados) seja executada.

######################################################################

### Nome do arquivo: // src/config/sequelize.ts

TIPO DE ARQUIVO: Config

NOME DA TABELA NO DB: N/A

CHAVE PRIMÁRIA (PK): N/A

CHAVES ESTRANGEIRAS (FK): N/A

REGRAS CHAVE / FUNÇÃO PRINCIPAL:

Regra GPR-4 (Inicialização do ORM): Este arquivo é responsável por instanciar e inicializar o ORM Sequelize, criando o objeto de conexão primário (connection) que será compartilhado por todos os Modelos do sistema.

Isolamento de Conexão: Centraliza o objeto de conexão, garantindo que todos os Modelos e Services (Regra 2.D GCI) utilizem a mesma instância de conexão, otimizando o uso do pool de conexões definido em database.ts.

Teste de Integridade: A função connectToDatabase executa um teste de autenticação (connection.authenticate()), confirmando a funcionalidade da conexão. Este é um passo crítico no processo de bootstrapping da aplicação (Regra GCI-1.A - Estabilidade de Dependência).

Gestão de Ambiente: Determina dinamicamente a configuração de banco de dados a ser usada (desenvolvimento ou produção) com base na variável process.env.NODE_ENV.

ASSOCIAÇÕES COM OUTROS ARQUIVOS:

Configuração do DB (database.ts): Consome o objeto de configuração de credenciais e parâmetros do pool definido em database.ts.

Modelos (\*.ts): Exporta o objeto connection, que é importado por todos os arquivos de Modelo (e.g., VendaComanda.ts, VendaItem.ts) para a sua inicialização (método Model.init).

Entrypoint/Bootstrapping: A função connectToDatabase é chamada no arquivo de entrada da aplicação (geralmente server.ts ou app.ts) para garantir que o DB esteja online antes de o servidor iniciar a escuta de requisições.

FRONTEND / USO PRINCIPAL: Componente de infraestrutura de backend. Sua execução bem-sucedida garante que o backend tenha acesso aos dados (Regra GPR-1), o que é essencial para todas as funcionalidades do sistema, como o carregamento de KPIs financeiros no dashboard (Regra 2.D GCI).

######################################################################

### Nome do arquivo: // src/config/types.ts

TIPO DE ARQUIVO: Config

NOME DA TABELA NO DB: N/A

CHAVE PRIMÁRIA (PK): N/A

CHAVES ESTRANGEIRAS (FK): N/A

REGRAS CHAVE / FUNÇÃO PRINCIPAL:

Regra GCI-1.B (Contrato de Serviço/Modelo): Este arquivo define o contrato de dados (Interfaces e Typescript Enums/Types) usado em toda a arquitetura. Ele garante a consistência da tipagem entre as camadas Controller, Service e Model, o que é fundamental para a integridade do código.

Domínio de Status (GPR-1/GCI-3): Centraliza todos os _Enums_ e _Types_ de status de domínio (`StatusColaborador`, `StatusQualidade`, `StatusAprovacaoCompras`, `TipoPerda`), evitando redundância e garantindo que o ciclo de vida dos objetos de negócio seja consistente, conforme as regras de negócio.
Segurança e RBAC (GCI-1.G): Define as enums `Recursos` e `Acoes`, que são o fundamento para a implementação da Autorização (RBAC - Role-Based Access Control) nos Middlewares e Controllers, garantindo que a Regra 1.G GCI de segurança seja aplicada consistentemente.
Contrato de KPI (GCI-2.B): Define o formato das interfaces de entrada (`KPIFilter`) e saída (`DashboardKPIs`) para os Services de Análise (Regra 2.B GCI), estruturando o cálculo e o retorno de métricas financeiras.
Fábrica de Modelos (`IModelFactory`):\*\* Define a estrutura para injeção e associação dinâmica de Modelos no ORM, facilitando o gerenciamento de dependências entre Modelos (Regra GPR-3).
ASSOCIAÇÕES COM OUTROS ARQUIVOS:

Modelos (Unidade, Colaborador, Fornecedor): Importa as classes de Modelos para tipar a IModelFactory, indicando que esses Modelos estão sendo gerenciados e referenciados via uma coleção centralizada.

Controllers e Services: Praticamente todos os Controllers e Services importam este arquivo para tipar as requisições (Request e Response bodies), filtros (KPIFilter) e objetos de retorno (DashboardKPIs).

Middlewares: Os Middlewares de RBAC (Autorização) utilizam Recursos e Acoes para validar as permissões.

FRONTEND / USO PRINCIPAL: Embora seja um arquivo de backend, suas interfaces de KPI (DashboardKPIs) são a base para o contrato da API (GET /analise/financeiro). O frontend o utiliza indiretamente, pois seu código deve estar em conformidade com a estrutura de dados (tipos, enums) definidas aqui, suportando a visualização de todos os painéis e a gestão de ciclos de vida dos objetos (e.g., pedidos de compra, produção).

######################################################################

### Nome do arquivo: // src/controllers/AnaliseController.ts

TIPO DE ARQUIVO: Controller

NOME DA TABELA NO DB: N/A

CHAVE PRIMÁRIA (PK): N/A

CHAVES ESTRANGEIRAS (FK): N/A

REGRAS CHAVE / FUNÇÃO PRINCIPAL:

Regra GCI-1.A (Ponto de Entrada da Requisição): Este arquivo é o ponto de entrada principal para as requisições de análise financeira (KPIs). Sua função é receber, validar e delegar a lógica de negócio.

Regra GCI-1.C (Validação de Entrada): A função getFinanceiroKPIs utiliza o schema kpiSchema (com zod) para validar a estrutura dos dados de entrada (datas data_inicio e data_fim nos query parameters). Isto garante que apenas dados bem-formados cheguem à camada de Service.

Regra GCI-1.G / R4 / R12 (Segurança/Multi-Unidade): Implementa a regra de segurança ao extrair o unidade_id do objeto req.usuario (populado pelo authMiddleware). Isto assegura que a consulta de KPIs seja estritamente filtrada pela unidade de negócio à qual o usuário pertence (R4 - Regra de Filtro Multi-Unidade). Se a unidade não for identificada, a requisição é rejeitada (status 401).

Regra GCI-2.A (Delegação ao Service): O Controller não contém lógica de cálculo de KPI. Ele instancia e invoca o AnaliseService (Regra GCI-2.A), delegando toda a complexidade de agregação de dados e cálculo ao Service (Regra GCI-2.D).

Função Principal: Intermediar a requisição HTTP, validar filtros, impor a regra de segurança R4 (filtro por unidade_id do usuário) e formatar a resposta JSON final.

ASSOCIAÇÕES COM OUTROS ARQUIVOS:

Service (AnaliseService): Dependência principal, responsável por executar a lógica de negócio e cálculos dos KPIs.

Rotas (AnaliseRoutes.ts): O método getFinanceiroKPIs é associado à rota GET /financeiro (via bindMethods), tornando-o acessível pelo cliente.

Tipagem (express / jsonwebtoken): Utiliza Request, Response e tipos de carga JWT para manipular a requisição e o contexto do usuário.

FRONTEND / USO PRINCIPAL: Suporta a funcionalidade principal de visualização de dados do módulo de Análise Financeira no frontend. Especificamente, atende à requisição para carregar o Dashboard Financeiro Consolidado da unidade do usuário, exibindo métricas como CMV, Receita e Tendências.

######################################################################

### Nome do arquivo: // src/controllers/AuthController.ts

TIPO DE ARQUIVO: Controller

NOME DA TABELA NO DB: N/A

CHAVE PRIMÁRIA (PK): N/A

CHAVES ESTRANGEIRAS (FK): N/A

REGRAS CHAVE / FUNÇÃO PRINCIPAL:

Regra GCI-1.A (Ponto de Entrada da Autenticação): É o ponto de entrada da API para a funcionalidade de Login (POST /api/v1/auth/login), servindo como a porta de acesso ao sistema.

Regra GCI-1.C (Validação de Entrada): Utiliza o loginSchema do Zod para validar a estrutura e o formato dos campos de entrada (email e senha), rejeitando requisições malformadas ou com senhas curtas (Regra R9 - Segurança de Senha).

Shutterstock

- **Regra GCI-2.A (Delegação ao Service):** Delega o processo crítico de validação de credenciais, busca de usuário e geração de token JWT ao `AuthService`. O Controller não acessa o banco de dados diretamente e não realiza a lógica de criptografia ou comparação de hash.
- **Regra GCI-1.G / R12 (Preparação do Contexto do Usuário):** Após o login bem-sucedido, o Controller recebe o token JWT e dados estruturados do usuário (incluindo `unidade_id`, `cargo_id` e `nome_cargo`) do Service e os retorna ao cliente. Esta estrutura de dados é essencial para o Frontend e para o `authMiddleware` (Regra GCI-1.G), que usará essas informações para filtros de segurança (R4) e autorização (R12).
- **Função Principal:** Controlar o fluxo de autenticação, validar o formato dos dados, delegar a lógica ao Service e retornar o token JWT e o payload de segurança do usuário.
  ASSOCIAÇÕES COM OUTROS ARQUIVOS:

Service (AuthService): Dependência de inversão de controle (IoC), responsável pela lógica de negócio de login.

Rotas (AuthRoutes.ts): O método login é associado à rota de login da API.

Tipagem (zod): Utilizado para validação estrita da entrada.

FRONTEND / USO PRINCIPAL: Suporta a funcionalidade essencial de Login de Usuários. O resultado é consumido pela aplicação frontend para estabelecer a sessão do usuário, armazenar o token JWT e inicializar o contexto de segurança (ID da Unidade, Cargo, Permissões) para todas as requisições subsequentes.

Sugestão de melhoria em poucas palavras: Implementar validação do campo unidade_id na resposta e adicionar refresh token para segurança estendida.

######################################################################

### Nome do arquivo: // src/controllers/CaixaController.ts

TIPO DE ARQUIVO: Controller

NOME DA TABELA NO DB: N/A

CHAVE PRIMÁRIA (PK): N/A

CHAVES ESTRANGEIRAS (FK): N/A

REGRAS CHAVE / FUNÇÃO PRINCIPAL:

Regra GCI-1.A (Ponto de Entrada): Atua como o handler das rotas HTTP relacionadas à gestão de caixa (abertura, fechamento, listagem e registro de lançamentos).

Regra GCI-1.C (Validação de Entrada): Realiza validação de presença de campos críticos (colaborador_id_abertura, id_caixa, unidade_id). Observação: Idealmente, seria complementada com validação Zod para tipagem e formato (e.g., saldo inicial ser numérico).

Regra GCI-1.G / R4 (Segurança Multi-Unidade): Extrai o unidade_id da propriedade res.locals.unidade_id (assumindo que foi injetado pelo authMiddleware). Essa unidade_id é usada como filtro obrigatório em todas as chamadas ao Service (Regra R4), garantindo o isolamento de dados entre unidades de negócio.

Regra GCI-2.A (Delegação ao Service): Delega a lógica de negócio, como a criação, atualização e verificação de caixa ativo, para o CaixaService e o registro de movimentos para o LancamentoService. O Controller foca apenas no fluxo da requisição.

Regra GCI-2.C (Regra de Concorrência): Implementa a regra de negócio central de que apenas um caixa pode estar ativo por vez para uma unidade_id específica (getCaixaAtivo antes de abrirCaixa), retornando um status 409 Conflict se a regra for violada.

Função Principal: Gerenciar o ciclo de vida do caixa (abertura e fechamento) e a interação com lançamentos, sempre garantindo o filtro de contexto da unidade (R4).

ASSOCIAÇÕES COM OUTROS ARQUIVOS:

Service (CaixaService): Dependência principal para lógica de Caixa (abrir/fechar/listar).

Service (LancamentoService): Dependência para registrar lançamentos financeiros no contexto do caixa.

Middleware (authMiddleware): Responsável por injetar res.locals.unidade_id e res.locals.colaborador_id.

FRONTEND / USO PRINCIPAL: Suporta a interface do Módulo de Ponto de Venda (PDV) e o Dashboard de Caixa, permitindo que o colaborador:

Abra e feche o turno de trabalho/caixa.

Registre movimentos não transacionais (sangrias, reforços, despesas).

Consulte o status atual do caixa da sua unidade.

Sugestão de melhoria em poucas palavras: Implementar validação Zod completa para req.body e req.params nos métodos.

######################################################################

### Nome do arquivo: src/controllers/ComprasPedidoController.ts

TIPO DE ARQUIVO: Controller

NOME DA TABELA NO DB: N/A (controllers não representam tabelas; operam sobre múltiplas entidades de compras)

CHAVE PRIMÁRIA (PK): N/A

CHAVES ESTRANGEIRAS (FK):

colaborador_id (via payload de cotação)

id_item_pedido (via recebimento)

id_produto (via cotação)

id_pedido (parâmetro de rota)

REGRAS CHAVE / FUNÇÃO PRINCIPAL:

Regra GCI-1.A (Ponto de Entrada): Expõe rotas HTTP relativas ao ciclo de compras — cotação, listagem, sugestão de itens e recebimento de insumos.

Regra GCI-1.C (Validação de Entrada): Implementa validação formal via Zod (R9), com dois esquemas robustos: recebimentoSchema e cotacaoSchema.

Regra GCI-2.A (Delegação ao Service): Toda lógica de negócio é delegada ao ComprasPedidoService, mantendo o controller fino.

Regra GCI-2.E (Fluxo de Compras): Gerencia o fluxo operacional do processo de compras baseado no Pedido, incluindo início da cotação e recebimento.

Regra R4 (Multi-Unidade): Não aparece explicitamente no controller, mas é aplicada no service conforme padrão arquitetural.

Função Principal: Intermediar as solicitações do frontend com regras de validação e delegação para o ComprasPedidoService, controlando o ciclo completo do pedido de compra (cotação → acompanhamento → recebimento).

ASSOCIAÇÕES COM OUTROS ARQUIVOS:

../services/ComprasPedidoService – principal serviço usado pelo controller.

../models/ComprasItemPedido – utilizado para enum de StatusQualidade.

../config/types – utilizado para enum StatusAprovacaoCompras.

Middleware de autenticação (authMiddleware) – dependência indireta para controle de acesso (embora não usada explicitamente aqui).

Zod (validação) – reforça Regra R9.

FRONTEND / USO PRINCIPAL:

Usado na tela de Compras / Suprimentos para:

Iniciar ciclo de cotação.

Listar pedidos de compra.

Sugerir itens abaixo do estoque mínimo (Kanban/Ponto de Pedido).

Registrar recebimento físico e fiscal do pedido.

Permite operar o módulo de compras garantindo aderência ao processo do ERP (cotação → pedido → recebimento).

Sugestão de melhoria em poucas palavras:

Incluir R4 explicitamente no controller (injeção e validação de unidade_id).

Padronizar mensagens de erro e sucesso com helper centralizado.

Adicionar try/catch também nos métodos index e suggestItemsBelowMin.

######################################################################

### Nome do arquivo: src/controllers/ContabilidadeController.ts

TIPO DE ARQUIVO: Controller

NOME DA TABELA NO DB: N/A (controller não representa diretamente uma tabela; opera sobre múltiplos domínios contábeis)

CHAVE PRIMÁRIA (PK): N/A

CHAVES ESTRANGEIRAS (FK):

unidade_id (R4 – injetado via autenticação e usado como filtro obrigatório)

REGRAS CHAVE / FUNÇÃO PRINCIPAL:

Regra GCI-1.A (Ponto de Entrada): Expõe endpoints contábeis para o frontend acessar dados fiscais e gerenciais.

Regra GCI-1.C (Validação de Entrada): Usa validação formal via Zod (R9) no filtro de mês/ano para geração de documentos.

Regra GCI-2.A (Delegação ao Service): Toda a lógica fiscal e contábil é delegada ao ContabilidadeService.

Regra R4 (Segurança Multi-Unidade): Cada operação utiliza usuario.unidade_id para garantir segregação de dados entre filiais.

Regra GCI-3.F (Compliance Fiscal): Endpoint getAlertaSimples implementa lógica de alerta quando unidade se aproxima do limite do Simples Nacional.

Regra GCI-3.G (Documentos Gerenciais): Controller coordena geração de DRE/Relatório gerencial.

Função Principal: Fornecer operações de alerta fiscal e geração de relatórios contábeis, com forte aderência à segurança multi-unidade e validação.

ASSOCIAÇÕES COM OUTROS ARQUIVOS:

../services/ContabilidadeService – responsável pela lógica fiscal, consolidação de dados de vendas/compras/folha.

zod – validação de filtros de data (R9).

Dependência indireta dos serviços: VendaService, ComprasService, RHService (via ContabilidadeService).

FRONTEND / USO PRINCIPAL:

Dashboard gerencial de contabilidade.

Tela de alertas fiscais (Simples Nacional).

Tela de geração de relatórios mensais para envio ao contador.

Suporta exportações e análises financeiras no módulo administrativo do ERP.

Sugestão de melhoria em poucas palavras:

Padronizar acesso ao usuário autenticado usando res.locals em vez de (req as any).

Centralizar tratamento de erros em middleware global.

Adicionar try/catch também para validações no método getAlertaSimples.

######################################################################

### Nome do arquivo: EscalaController.ts

2. TIPO DE ARQUIVO: Controller
3. NOME DA TABELA NO DB: ESCALAS
4. CHAVE PRIMÁRIA (PK): id_escala
5. CHAVES ESTRANGEIRAS (FK): usuario_id (R4), unidade_id (R4), aprovador_id
6. REGRAS CHAVE / FUNÇÃO PRINCIPAL:
   - Regra 2.B GCI: Recebe requisições HTTP e valida parâmetros de entrada.
   - Regra 3.A GCI: Encaminha dados para EscalaService e UsuarioService para processamento.
   - Função principal: Gerenciar a criação e aprovação de escalas, garantindo validação de usuários e associação correta com unidades e RH.

7. ASSOCIAÇÕES COM OUTROS ARQUIVOS: EscalaService, UsuarioService, RHService
8. FRONTEND / USO PRINCIPAL: Permite ao usuário criar novas propostas de escala e aprovar escalas existentes via interface web ou API.
9. COMO OUTROS ARQUIVOS ACESSAM ESTE ARQUIVO (Técnico — Import/Export): `import { EscalaController } from '../controllers/EscalaController';`
10. Sugestão de melhoria em poucas palavras: Implementar tratamento centralizado de erros e padronizar respostas HTTP.

######################################################################

### Nome do arquivo: EstoqueContagemController.ts

2. TIPO DE ARQUIVO: Controller
3. NOME DA TABELA NO DB: ESTOQUE_CONTAGEM
4. CHAVE PRIMÁRIA (PK): id_contagem
5. CHAVES ESTRANGEIRAS (FK): id_produto, colaborador_id
6. REGRAS CHAVE / FUNÇÃO PRINCIPAL:
   - Regra 1.A GCI: Injeção de dependência via construtor.
   - Regra 1.B GCI: Validação de dados de entrada usando Zod.
   - Regra 1.C GCI: Tratamento uniforme de erros com try/catch.
   - Regra 1.E GCI: Retorno HTTP 201 em criação bem-sucedida.
   - Função principal: Registrar contagens cegas de estoque, delegando lógica ao EstoqueContagemService e garantindo integridade e auditoria do inventário.

7. ASSOCIAÇÕES COM OUTROS ARQUIVOS: EstoqueContagemService
8. FRONTEND / USO PRINCIPAL: Permite ao usuário registrar contagens físicas de produtos e ajustar estoques via interface ou API.
9. COMO OUTROS ARQUIVOS ACESSAM ESTE ARQUIVO (Técnico — Import/Export): `import EstoqueContagemController from '../controllers/EstoqueContagemController';`
10. Sugestão de melhoria em poucas palavras: Integrar container de DI para facilitar testes e manutenção.

######################################################################

### Nome do arquivo: EstoqueItemController.ts

2. TIPO DE ARQUIVO: Controller
3. NOME DA TABELA NO DB: ESTOQUE_ITEM
4. CHAVE PRIMÁRIA (PK): id_produto
5. CHAVES ESTRANGEIRAS (FK): colaborador_id
6. REGRAS CHAVE / FUNÇÃO PRINCIPAL:
   - Regra 1.A GCI: Injeção de dependência simplificada no construtor.
   - Regra 1.B GCI: Validação de dados de entrada usando Zod.
   - Regra 1.C GCI: Tratamento uniforme de erros via try/catch.
   - Regra 1.D GCI: Remoção de lógica de transação do Controller (SRP), delegando atomicidade ao Service.
   - Regra 1.E GCI: Retorno HTTP 201 para criação e 200 para operações bem-sucedidas.
   - Função principal: Gerenciar itens de estoque, incluindo criação, listagem, atualização, recebimento e saída de estoque, garantindo integridade de dados e auditoria.

7. ASSOCIAÇÕES COM OUTROS ARQUIVOS: EstoqueItemService
8. FRONTEND / USO PRINCIPAL: Permite ao usuário cadastrar produtos, atualizar informações de estoque, registrar recebimento e saída de produtos via interface web ou API.
9. COMO OUTROS ARQUIVOS ACESSAM ESTE ARQUIVO (Técnico — Import/Export): `import EstoqueItemController from '../controllers/EstoqueItemController';`
10. Sugestão de melhoria em poucas palavras: Utilizar container de DI e padronizar schemas de validação para todos endpoints.

######################################################################

### Nome do arquivo: EstoqueMovimentoController.ts

2. TIPO DE ARQUIVO: Controller
3. NOME DA TABELA NO DB: ESTOQUE_MOVIMENTO
4. CHAVE PRIMÁRIA (PK): id_movimento
5. CHAVES ESTRANGEIRAS (FK): id_produto, unidade_id
6. REGRAS CHAVE / FUNÇÃO PRINCIPAL:
   - Regra 1.A GCI: Injeção de dependência simplificada no construtor.
   - Regra 1.C GCI: Tratamento uniforme de erros via try/catch.
   - Regra R4 GCI: Garantir contexto de unidade ao listar movimentos de estoque.
   - Função principal: Listar e filtrar o histórico de movimentos de estoque por produto, tipo de movimento e unidade, garantindo consistência e auditoria.

7. ASSOCIAÇÕES COM OUTROS ARQUIVOS: EstoqueMovimentoService
8. FRONTEND / USO PRINCIPAL: Permite ao usuário visualizar o histórico de entradas e saídas de produtos, com filtros por produto, tipo de movimento e unidade, via interface web ou API.
9. COMO OUTROS ARQUIVOS ACESSAM ESTE ARQUIVO (Técnico — Import/Export): `import EstoqueMovimentoController from '../controllers/EstoqueMovimentoController';`
10. Sugestão de melhoria em poucas palavras: Adicionar paginação e filtros avançados para histórico de movimentos.

######################################################################

### Nome do arquivo: FeedbackController.ts

2. TIPO DE ARQUIVO: Controller
3. NOME DA TABELA NO DB: FEEDBACK
4. CHAVE PRIMÁRIA (PK): id_feedback
5. CHAVES ESTRANGEIRAS (FK): venda_comanda_id, colaborador_id
6. REGRAS CHAVE / FUNÇÃO PRINCIPAL:
   - Regra 1.A GCI: Instanciação de serviço no construtor (poderia usar DI).
   - Regra 1.B GCI: Validação de dados de entrada usando Zod.
   - Regra 1.C GCI: Tratamento uniforme de erros via try/catch.
   - Regra R9 GCI: Garantir integridade de NPS e comentários.
   - Função principal: Registrar feedback de clientes, validar NPS e comentário, e permitir rastreamento de qualidade.

7. ASSOCIAÇÕES COM OUTROS ARQUIVOS: FeedbackService
8. FRONTEND / USO PRINCIPAL: Permite ao usuário registrar feedback de vendas e rastrear a avaliação de qualidade via interface web ou API.
9. COMO OUTROS ARQUIVOS ACESSAM ESTE ARQUIVO (Técnico — Import/Export): `import FeedbackController from '../controllers/FeedbackController';`
10. Sugestão de melhoria em poucas palavras: Implementar injeção de dependência para facilitar testes e manutenção.

######################################################################

### Nome do arquivo: FichaTecnicaController.ts

2. TIPO DE ARQUIVO: Controller
3. NOME DA TABELA NO DB: FICHA_TECNICA
4. CHAVE PRIMÁRIA (PK): id_item_ficha_tecnica
5. CHAVES ESTRANGEIRAS (FK): id_produto_pai, id_produto_filho, unidade_id
6. REGRAS CHAVE / FUNÇÃO PRINCIPAL:
   - Regra 1.A GCI: Injeção de dependência via construtor.
   - Regra 1.B GCI: Validação de dados de entrada usando Zod para criação, atualização e deleção de itens.
   - Regra 1.C GCI: Tratamento uniforme de erros via try/catch com status HTTP apropriado.
   - Regra 1.E GCI: Retorno padronizado com códigos 200/201 e mensagens descritivas.
   - Regra 2.D/R4 GCI: Garantir isolamento por unidade ao manipular fichas técnicas.
   - Função principal: Gerenciar fichas técnicas de produtos, incluindo listagem, criação, atualização de quantidade e remoção de itens, assegurando consistência de custo de produção (CMP).

7. ASSOCIAÇÕES COM OUTROS ARQUIVOS: FichaTecnicaService, authMiddleware (JwtPayload)
8. FRONTEND / USO PRINCIPAL: Permite ao usuário criar e atualizar fichas técnicas de produtos, ajustar quantidades de insumos e visualizar custos de produção via interface web ou API.
9. COMO OUTROS ARQUIVOS ACESSAM ESTE ARQUIVO (Técnico — Import/Export): `import FichaTecnicaController from '../controllers/FichaTecnicaController';`
10. Sugestão de melhoria em poucas palavras: Implementar injeção de dependência para facilitar testes e padronizar tratamento de erros em todos os métodos.

######################################################################

### Nome do arquivo: FiscalController.ts

2. TIPO DE ARQUIVO: Controller
3. NOME DA TABELA NO DB: FISCAL
4. CHAVE PRIMÁRIA (PK): id_fiscal
5. CHAVES ESTRANGEIRAS (FK): unidade_id (R4), id_fornecedor
6. REGRAS CHAVE / FUNÇÃO PRINCIPAL:
   - Regra 1.A GCI: Injeção de dependência via construtor.
   - Regra 1.C GCI: Tratamento uniforme de erros via try/catch com retorno padronizado.
   - Regra 1.E GCI: Resposta HTTP padronizada (200/400/500) com mensagens detalhadas.
   - Regra R9: Validação de filtros de exportação usando Zod, garantindo consistência de data_inicio e data_fim.
   - Regra 2.B GCI: Chamada ao Service para encapsular a lógica de busca de registros fiscais.
   - Função principal: Exportar dados fiscais filtrados para contabilidade ou visualização interna.

7. ASSOCIAÇÕES COM OUTROS ARQUIVOS: FiscalService
8. FRONTEND / USO PRINCIPAL: Permite ao usuário exportar relatórios fiscais em JSON/CSV com filtros de data e tipo de origem para contabilidade.
9. COMO OUTROS ARQUIVOS ACESSAM ESTE ARQUIVO (Técnico — Import/Export): `import FiscalController from '../controllers/FiscalController';`
10. Sugestão de melhoria em poucas palavras: Implementar injeção de dependência para facilitar testes unitários e padronizar log de erros.

######################################################################

### Nome do arquivo: LancamentoController.ts

2. TIPO DE ARQUIVO: Controller
3. NOME DA TABELA NO DB: LANCAMENTOS
4. CHAVE PRIMÁRIA (PK): id_lancamento
5. CHAVES ESTRANGEIRAS (FK): colaborador_id (R4), unidade_id (R4), id_caixa
6. REGRAS CHAVE / FUNÇÃO PRINCIPAL:
   - Regra 1.A GCI: Injeção de dependência via construtor.
   - Regra 1.C GCI: Tratamento uniforme de erros via try/catch com retorno padronizado.
   - Regra 1.E GCI: Resposta HTTP padronizada (201 para criação de lançamento).
   - Regra R4: Uso de unidade_id do token ou sessão para contexto de execução.
   - Função principal: Registrar lançamentos financeiros (manuais ou via integrações) garantindo consistência de dados e contexto de unidade e colaborador.

7. ASSOCIAÇÕES COM OUTROS ARQUIVOS: LancamentoService
8. FRONTEND / USO PRINCIPAL: Permite que o usuário registre lançamentos financeiros, vinculando automaticamente o colaborador e a unidade, podendo incluir caixa opcional.
9. COMO OUTROS ARQUIVOS ACESSAM ESTE ARQUIVO (Técnico — Import/Export): `import { LancamentoController } from '../controllers/LancamentoController';`
10. Sugestão de melhoria em poucas palavras: Implementar injeção de dependência externa para facilitar testes unitários e padronizar logs de erro.

######################################################################

### Nome do arquivo: PlanejamentoController.ts

2. TIPO DE ARQUIVO: Controller
3. NOME DA TABELA NO DB: N/A
4. CHAVE PRIMÁRIA (PK): N/A
5. CHAVES ESTRANGEIRAS (FK): unidade_id (R4), usuario_id
6. REGRAS CHAVE / FUNÇÃO PRINCIPAL:
   - Regra 1.A GCI: Recebe e orquestra requisições, delegando lógica de negócio para o Service.
   - Regra 1.B GCI: Valida contexto de usuário e unidade antes de processar a requisição.
   - Regra 1.C GCI: Retorno HTTP padronizado, tratamento de erros unificado.
   - Regra 1.D GCI: SRP, Controller não implementa lógica de negócio, delega ao Service.
   - Regra R4: Uso de unidade_id do usuário logado para contexto seguro e filtragem de dados.
   - Função principal: Gerar lista de itens que atingiram o Ponto de Pedido (PP) para planejamento de reposição.

7. ASSOCIAÇÕES COM OUTROS ARQUIVOS: PlanejamentoService, UsuarioService
8. FRONTEND / USO PRINCIPAL: Fornece ao usuário final a lista de itens que precisam ser repostos, servindo como base para pedidos de compra ou produção.
9. COMO OUTROS ARQUIVOS ACESSAM ESTE ARQUIVO (Técnico — Import/Export): `import { PlanejamentoController } from '../controllers/PlanejamentoController';`
10. Sugestão de melhoria em poucas palavras: Injetar serviços via construtor para facilitar testes e reduzir acoplamento global.

######################################################################

### Nome do arquivo: ProducaoController.ts

2. TIPO DE ARQUIVO: Controller
3. NOME DA TABELA NO DB: N/A
4. CHAVE PRIMÁRIA (PK): N/A
5. CHAVES ESTRANGEIRAS (FK): id_produto_produzido, colaborador_id, unidade_id (indireta via Service)
6. REGRAS CHAVE / FUNÇÃO PRINCIPAL:
   - Regra 1.A GCI: Recebe requisições HTTP e delega toda lógica de negócio ao Service.
   - Regra 1.B GCI: Valida dados de entrada usando Zod (ex.: criação de OP, registro de perda, ações de produção).
   - Regra 1.C GCI: Tratamento unificado de erros, diferenciando validação (400) e falhas internas (500).
   - Regra 1.D GCI: Controller não acessa diretamente o DB; Service encapsula todas operações de persistência.
   - Função principal: Gerenciar todo o fluxo de produção, incluindo sugestões, criação de ordens, aprovações, entregas de insumos, finalização, registro de perdas e cancelamentos.

7. ASSOCIAÇÕES COM OUTROS ARQUIVOS: ProducaoService
8. FRONTEND / USO PRINCIPAL: Permite ao usuário (gestor, cozinheiro, estoquista) acompanhar e gerenciar o ciclo completo de produção e registro de perdas, fornecendo feedback em tempo real sobre o status da OP.
9. COMO OUTROS ARQUIVOS ACESSAM ESTE ARQUIVO (Técnico — Import/Export): `import ProducaoController from '../controllers/ProducaoController';`
10. Sugestão de melhoria em poucas palavras: Injetar ProducaoService via construtor para facilitar testes unitários e reduzir acoplamento global.

######################################################################

### Nome do arquivo: RHController.ts

2. TIPO DE ARQUIVO: Controller
3. NOME DA TABELA NO DB: N/A
4. CHAVE PRIMÁRIA (PK): N/A
5. CHAVES ESTRANGEIRAS (FK): colaborador_id, cargo_id, competencia_id (indiretas via Service)
6. REGRAS CHAVE / FUNÇÃO PRINCIPAL:
   - Regra 1.A GCI: Recebe requisições HTTP e delega toda lógica de negócio aos Services (RHService e EscalaService).
   - Regra 1.B GCI: Valida dados de entrada usando Zod (definição de perfil ideal, registro de performance, geração e aprovação de escalas).
   - Regra 1.C GCI: Tratamento de erros, diferenciando falhas de validação (400) e erros internos do servidor (500).
   - Regra 2.D GCI: Garante integridade e consistência das operações de RH e escalas, respeitando regras de negócio.
   - Função principal: Gerenciar perfis ideais, registrar performance de colaboradores, gerar escalas de trabalho otimizadas e aprovar escalas no sistema.

7. ASSOCIAÇÕES COM OUTROS ARQUIVOS: RHService, EscalaService, tipos definidos em config/types (IPerfilIdeal, IHistoricoPerformance, IRegraColaborador, IColaboradorBase)
8. FRONTEND / USO PRINCIPAL: Permite ao gestor definir perfis ideais, registrar performance, gerar e aprovar escalas de colaboradores; fornece feedback e resultados de forma visual no sistema de RH.
9. COMO OUTROS ARQUIVOS ACESSAM ESTE ARQUIVO (Técnico — Import/Export): `import { RHController } from '../controllers/RHController';`
10. Sugestão de melhoria em poucas palavras: Injetar serviços via construtor padrão opcional e criar um wrapper de validação genérico para reduzir repetição de Zod.

######################################################################

### Nome do arquivo: UnidadeController.ts

2. TIPO DE ARQUIVO: Controller
3. NOME DA TABELA NO DB: UNIDADES
4. CHAVE PRIMÁRIA (PK): id_unidade
5. CHAVES ESTRANGEIRAS (FK): N/A
6. REGRAS CHAVE / FUNÇÃO PRINCIPAL:
   - Regra 1.A GCI: Recebe requisições HTTP e delega lógica de negócio ao UnidadeService.
   - Regra 1.B GCI: Valida dados de entrada usando Zod (criação de unidade e atualização de status).
   - Regra 1.C GCI: Tratamento de erros, retornando códigos HTTP apropriados (400 para validação, 404 ou 500 para falhas internas).
   - Regra 2.D GCI: Garantir consistência de status operacional das unidades no sistema.
   - Função principal: Criar novas unidades, listar unidades ativas e atualizar status operacional das unidades.

7. ASSOCIAÇÕES COM OUTROS ARQUIVOS: UnidadeService
8. FRONTEND / USO PRINCIPAL: Permite ao usuário gerenciar unidades no sistema, incluindo cadastro, listagem de unidades ativas e atualização do status operacional para ATIVA, INATIVA ou EM_REFORMA.
9. COMO OUTROS ARQUIVOS ACESSAM ESTE ARQUIVO (Técnico — Import/Export): `import UnidadeController from '../controllers/UnidadeController';`
10. Sugestão de melhoria em poucas palavras: Adicionar logs detalhados e padronizar respostas JSON para consistência no frontend.

######################################################################

### Nome do arquivo: VendaComandaController.ts

2. TIPO DE ARQUIVO: Controller
3. NOME DA TABELA NO DB: VENDAS_COMANDA
4. CHAVE PRIMÁRIA (PK): id_venda
5. CHAVES ESTRANGEIRAS (FK): unidade_id (R4), colaborador_id_abertura, colaborador_id_fechamento, id_caixa, id_mesa
6. REGRAS CHAVE / FUNÇÃO PRINCIPAL:
   - Regra 1.A GCI: Recebe requisições HTTP e delega lógica de negócio ao VendaComandaService.
   - Regra 1.B GCI: Valida dados de entrada (criação, fechamento e busca de comandas).
   - Regra 1.C GCI: Tratamento de erros com códigos HTTP apropriados (400 para validação, 401 para autenticação, 404 para não encontrado, 500 para erros internos).
   - Regra 2.B GCI: Encapsula a lógica de abertura, fechamento, listagem e consulta de comandas, garantindo a consistência do fluxo de vendas por unidade.
   - Função principal: Gerenciar o ciclo de vida das comandas/vendas no sistema, incluindo abertura, fechamento, listagem de comandas ativas, histórico de vendas e consulta por ID.

7. ASSOCIAÇÕES COM OUTROS ARQUIVOS: VendaComandaService
8. FRONTEND / USO PRINCIPAL: Permite ao usuário final abrir e fechar comandas, consultar comandas ativas, acessar histórico de vendas e consultar detalhes de uma comanda específica por ID no sistema de gestão de vendas.
9. COMO OUTROS ARQUIVOS ACESSAM ESTE ARQUIVO (Técnico — Import/Export): `import { VendaComandaController } from '../controllers/VendaComandaController';`
10. Sugestão de melhoria em poucas palavras: Padronizar mensagens de erro e extrair validações repetidas para middleware.

######################################################################

### Nome do arquivo: VendaItemController.ts

2. TIPO DE ARQUIVO: Controller
3. NOME DA TABELA NO DB: VENDAS_ITENS
4. CHAVE PRIMÁRIA (PK): id_venda_item
5. CHAVES ESTRANGEIRAS (FK): id_venda, id_produto, colaborador_id
6. REGRAS CHAVE / FUNÇÃO PRINCIPAL:
   - Regra 1.A GCI: Recebe requisições HTTP e delega a lógica de negócio ao VendaItemService.
   - Regra 1.B GCI: Valida dados de entrada para adicionar ou remover itens da venda usando Zod.
   - Regra 1.C GCI: Trata erros específicos (EstoqueInsuficiente, VendaFechada, ProdutoInvalido, VendaItemNaoEncontrado) e responde com códigos HTTP apropriados (400, 404, 409, 422, 500).
   - Regra 2.B GCI: Encapsula a lógica de gestão de itens de venda garantindo consistência do estoque e integridade da venda.
   - Função principal: Adicionar e remover itens de uma venda/comanda no sistema de ponto de venda, garantindo validações de estoque e estado da venda.

7. ASSOCIAÇÕES COM OUTROS ARQUIVOS: VendaItemService
8. FRONTEND / USO PRINCIPAL: Permite ao usuário final adicionar produtos a uma comanda/venda, remover itens e gerenciar o conteúdo de uma venda antes do fechamento.
9. COMO OUTROS ARQUIVOS ACESSAM ESTE ARQUIVO (Técnico — Import/Export): `import VendaItemController from '../controllers/VendaItemController';`
10. Sugestão de melhoria em poucas palavras: Centralizar tratamento de erros comuns em middleware para reduzir repetição de código.

######################################################################

### Nome do arquivo: authMiddleware.ts

2. TIPO DE ARQUIVO: Middleware
3. NOME DA TABELA NO DB: N/A
4. CHAVE PRIMÁRIA (PK): N/A
5. CHAVES ESTRANGEIRAS (FK): N/A
6. REGRAS CHAVE / FUNÇÃO PRINCIPAL:
   - Regra 12 GCI: Valida o token JWT recebido nas requisições HTTP.
   - Regra 4 GCI: Extrai e adiciona o payload do usuário (id_usuario, id_cargo, nome_cargo, unidade_id, permissoes) ao objeto `req`.
   - Função principal: Garantir que apenas usuários autenticados e autorizados acessem rotas protegidas, fornecendo informações de contexto de usuário para Controllers e Services.

7. ASSOCIAÇÕES COM OUTROS ARQUIVOS: Nenhuma dependência direta; usado por qualquer Controller ou Route que exija autenticação.
8. FRONTEND / USO PRINCIPAL: Protege rotas do backend, garantindo que apenas usuários com token válido possam acessar recursos e operações.
9. COMO OUTROS ARQUIVOS ACESSAM ESTE ARQUIVO (Técnico — Import/Export): `import { authMiddleware } from '../Middlewares/authMiddleware';` e aplicado como middleware nas rotas Express (`app.use(authMiddleware)`).
10. Sugestão de melhoria em poucas palavras: Adicionar logging estruturado e refresh token para maior segurança e rastreabilidade.

######################################################################

### Nome do arquivo: rbacMiddleware.ts

2. TIPO DE ARQUIVO: Middleware
3. NOME DA TABELA NO DB: N/A
4. CHAVE PRIMÁRIA (PK): N/A
5. CHAVES ESTRANGEIRAS (FK): N/A
6. REGRAS CHAVE / FUNÇÃO PRINCIPAL:
   - Regra 12 GCI: Implementa controle de acesso baseado em permissões do usuário (RBAC) extraídas do JWT.
   - Valida se o usuário possui as permissões necessárias para acessar uma rota específica.
   - Admin (id_cargo 99) tem acesso irrestrito.
   - Função principal: Garantir segurança das rotas, evitando acesso não autorizado a recursos críticos.

7. ASSOCIAÇÕES COM OUTROS ARQUIVOS: authMiddleware (para obter payload do usuário), config/types (Recursos, Acoes).
8. FRONTEND / USO PRINCIPAL: Usado para proteger endpoints, garantindo que apenas usuários com permissões corretas possam executar ações no sistema.
9. COMO OUTROS ARQUIVOS ACESSAM ESTE ARQUIVO (Técnico — Import/Export): `import { podeAcessar } from '../Middlewares/rbacMiddleware';` e aplicado como middleware nas rotas Express (`app.get('/rota', podeAcessar(...), controller.metodo)`).
10. Sugestão de melhoria em poucas palavras: Adicionar cache de permissões para reduzir consultas repetidas e melhorar performance.

######################################################################

### Nome do arquivo:\*\* // src/models/Cargo.ts

- **TIPO DE ARQUIVO:** Model
- **NOME DA TABELA NO DB:** CARGOS
- **CHAVE PRIMÁRIA (PK):** id_cargo
- **CHAVES ESTRANGEIRAS (FK):** unidade_id
- **REGRAS CHAVE / FUNÇÃO PRINCIPAL:**
  - **Regra GPR-1.A (Entidade de Dados):** Define a estrutura da tabela `CARGOS` no banco de dados, incluindo a tipagem em TypeScript (`CargoAttributes`, `CargoModel`) e a definição das colunas para o ORM (Sequelize).
  - **Regra GPR-2.A / R4 (Segurança e Contexto):** Inclui o campo `unidade_id` como obrigatório, aderindo à Regra R4 que exige o contexto de unidade em modelos de dados essenciais para permitir o isolamento de dados por unidade de negócio.
  - **Regra GPR-2.B (Associações ORM):** Define associações com outras entidades:
    - `hasMany` com `Usuario` (Um Cargo pode ter muitos Usuários).
    - `belongsToMany` com `Permissao` (via tabela de junção `CARGO_PERMISSOES`), implementando um relacionamento M:N para gestão de acesso e perfis.
  - **Regra GPR-1.C (Manipulação de Dados):** O método `get()` para `salario_base` garante que o valor seja corretamente parseado para `float` ao ser lido do banco, seguindo a boa prática de evitar o uso direto de _string_ para cálculos de valores monetários.
  - **Função Principal:** Mapear a entidade Cargo, essencial para a estrutura organizacional e para o módulo de Recursos Humanos, servindo como base para definição de perfis de usuários e permissões.
- **ASSOCIAÇÕES COM OUTROS ARQUIVOS:**
  - **Model (`Permissao`):** Associação Many-to-Many (`belongsToMany`).
  - **Model (`Usuario`):** Associação One-to-Many (`hasMany`).
  - **Model (`Unidade`):** Associação `belongsTo` implícita via FK `unidade_id` (apesar de não estar explicitamente no `associate`, é uma dependência de dados).
  - **Config (`sequelize.ts`):** Importa `connection` para inicialização do modelo.
- **FRONTEND / USO PRINCIPAL:** Suporta o Módulo de Gestão de RH/Organograma, permitindo que administradores:
  - Criem e gerenciem a lista de Cargos disponíveis na(s) Unidade(s).
  - Definam o salário base e o departamento associado a cada Cargo.
- **COMO OUTROS ARQUIVOS ACESSAM ESTE ARQUIVO (Técnico — Import/Export):**
  - **Export:** Exporta o Model `Cargo` (default) e as interfaces/tipos relacionados.
  - **Import:** É importado por `CargoService` (para operações CRUD), `UsuarioModel` (para a FK) e pelo _index_ de _models_ (para rodar a função `associate`).
- **Sugestão de melhoria em poucas palavras:** Implementar o método `associate` como um _static method_ dentro da classe Cargo (Padrão Sequelize 6+) ou refatorar a conversão de `salario_base` para usar o `DataTypes.FLOAT` ou `DataTypes.DOUBLE` com cuidado na precisão.

######################################################################

### Nome do arquivo:\*\* // src/models/Colaborador.ts

- **TIPO DE ARQUIVO:** Model
- **NOME DA TABELA NO DB:** COLABORADORES
- **CHAVE PRIMÁRIA (PK):** id_colaborador
- **CHAVES ESTRANGEIRAS (FK):**
  - unidade_id
  - cargo_id
- **REGRAS CHAVE / FUNÇÃO PRINCIPAL:**
  - **Regra GPR-1.A (Entidade de Dados):** Define o esquema da tabela `COLABORADORES`, as interfaces de tipagem (`ColaboradorAttributes`, `ColaboradorModel`) e a definição de colunas, como `email` (única) e `data_contratacao`.
  - **Regra GPR-2.A / R4 (Segurança e Contexto):** A inclusão e obrigatoriedade do campo `unidade_id` reforça a Regra R4, garantindo que o acesso e as operações sobre colaboradores sejam sempre filtradas pelo contexto da unidade de negócio.
  - **Regra GPR-1.D (Tipagem Restrita):** Utiliza `DataTypes.ENUM` para os campos `nivel_acesso` e `Status`, garantindo a integridade dos dados ao limitar os valores aceitos a um conjunto predefinido de constantes.
  - **Regra GPR-2.B (Associações ORM):** Estabelece associações de chave estrangeira (`belongsTo`) com `Cargo` e `Unidade`, permitindo que o Service carregue dados relacionados de forma eficiente.
  - **Função Principal:** Servir como o Model de usuário base do sistema, representando os funcionários da empresa e suas características essenciais (acesso, cargo, status), sendo fundamental para a autenticação e autorização, bem como para o módulo de RH.
- **ASSOCIAÇÕES COM OUTROS ARQUIVOS:**
  - **Model (`Cargo`):** Associação `belongsTo` via `cargo_id`.
  - **Model (`Unidade`):** Associação `belongsTo` via `unidade_id`.
  - **Model (`Caixa`):** É referenciado por `Caixa` como `colaborador_id_abertura` e `colaborador_id_fechamento` (Associação `hasMany` implícita no model `Caixa`).
  - **Config (`sequelize.ts`):** Importa `connection` para inicialização.
  - **Config (`types.ts`):** Importa tipos customizados (`NivelAcesso`, `StatusColaborador`).
- **FRONTEND / USO PRINCIPAL:**
  - **Módulo de RH/Usuários:** Gestão de cadastro, status e alteração de cargo/acesso dos colaboradores.
  - **Autenticação:** Usado para verificar credenciais e determinar o nível de acesso do usuário logado.
  - **PDV/Operacional:** Usado para registrar quem abriu/fechou o caixa e quem realizou vendas/operações.
- **COMO OUTROS ARQUIVOS ACESSAM ESTE ARQUIVO (Técnico — Import/Export):**
  - **Export:** Exporta o Model `Colaborador` (default), a interface `ColaboradorModel` e os tipos relacionados.
  - **Import:** É importado pelo `ColaboradorService` (para operações de negócio), outros Models (como `Caixa`, para definir FKs) e pelos _indexers_ do ORM para configurar as associações.
- **Sugestão de melhoria em poucas palavras:** Separar campos sensíveis (como senha ou token, se existissem) em um Model/Tabela separado para segurança.

######################################################################

### Nome do arquivo:\*\* // src/models/CompraNecessidade.ts

- **TIPO DE ARQUIVO:** Model
- **NOME DA TABELA NO DB:** PLANEJAMENTO_COMPRA
- **CHAVE PRIMÁRIA (PK):** id_necessidade_compra
- **CHAVES ESTRANGEIRAS (FK):**
  - unidade_id (R4)
  - id_produto
  - colaborador_id_solicitante
  - id_origem_referencia (Referência opcional à origem da necessidade)
- **REGRAS CHAVE / FUNÇÃO PRINCIPAL:**
  - **Regra GPR-1.A (Entidade de Dados):** Mapeia a tabela `PLANEJAMENTO_COMPRA` e define a estrutura para rastrear a demanda por insumos.
  - **Regra GPR-2.A / R4 (Segurança e Contexto):** A obrigatoriedade da `unidade_id` garante a conformidade com a Regra R4, que isola as necessidades de compra por unidade de negócio.

[Image of data isolation diagram]

```
* **Regra GPR-1.D (Tipagem Restrita):** Utiliza enums/strings restritas para os campos `origem` (`PRODUCAO`, `ESTOQUE_MINIMO`, `MANUAL`) e `status_atendimento`, garantindo o fluxo de status controlado.
* **Regra GPR-2.B (Associações ORM):** Implementa associações para `ItemEstoque` (qual produto comprar) e `ProducaoNecessidade` (se a origem for um plano de produção).
* **Função Principal:** Registrar e rastrear todas as necessidades de aquisição de insumos geradas automaticamente pelo sistema (ou manualmente) para que o módulo de Compras possa planejar e executar os pedidos.
```

- **ASSOCIAÇÕES COM OUTROS ARQUIVOS:**
  - **Model (`ItemEstoque`):** Associação `belongsTo` (`id_produto`).
  - **Model (`ProducaoNecessidade`):** Associação `belongsTo` condicional via `id_origem_referencia` (quando `origem` = 'PRODUCAO').
  - **Model (`Colaborador`):** Associação implícita `belongsTo` via `colaborador_id_solicitante`.
  - **Config (`sequelize.ts`):** Importa a conexão com o banco de dados.
- **FRONTEND / USO PRINCIPAL:**
  - Módulo de Planejamento de Compras (PCP): Onde o usuário visualiza a "Lista de Compras Pendentes" ou o "Kanban de Compras" gerado a partir desta tabela.
  - Módulo de Produção: É o registro de onde a requisição de compra se originou, permitindo rastreabilidade.
- **COMO OUTROS ARQUIVOS ACESSAM ESTE ARQUIVO (Técnico — Import/Export):**
  - **Export:** Exporta o Model `CompraNecessidade` (default).
  - **Import:** É importado principalmente pelo `CompraNecessidadeService` (camada GCI para regras de negócio) para criar, atualizar status e consultar as necessidades. Outros models (como `ProducaoNecessidade`) podem importá-lo para gerar novas entradas após a execução de um plano.
- **Sugestão de melhoria em poucas palavras:** Adicionar associação `belongsTo(Colaborador)` e usar o `DataTypes.ENUM` para o campo `status_atendimento`.

######################################################################

### Nome do arquivo:\*\* // src/models/ComprasItemPedido.ts

- **TIPO DE ARQUIVO:** Model
- **NOME DA TABELA NO DB:** COMPRAS_ITENS_PEDIDO
- **CHAVE PRIMÁRIA (PK):** id_item_pedido
- **CHAVES ESTRANGEIRAS (FK):**
  - id_pedido
  - id_produto
- **REGRAS CHAVE / FUNÇÃO PRINCIPAL:**
  - **Regra GPR-1.A (Entidade de Dados):** Mapeia a tabela que detalha cada item dentro de um pedido de compra.
  - **Regra GPR-4 (Consistência Numérica):** Implementa _Getters_ em todos os campos `DECIMAL` (`quantidade_prevista`, `preco_custo_unitario_previsto`, `quantidade_recebida`, `preco_custo_unitario_real`) para garantir que os valores sejam sempre retornados como `number` no JavaScript, evitando problemas de precisão e tipagem.
  - **Regra GPR-1.D (Rastreabilidade e Status):** Inclui campos para rastrear a quantidade recebida e o preço real de custo, essenciais para o cálculo de CMV e auditoria de recebimento, além do `status_qualidade` para controle de qualidade na recepção.
  - **Regra GPR-2.B (Associações ORM):** Define as associações `belongsTo` obrigatórias com `ComprasPedido` (agregação) e `ItemEstoque` (produto referenciado).
  - **Função Principal:** Registrar as linhas de itens que compõem um pedido de compra, armazenando informações sobre o que foi pedido (quantidade/preço previsto) e o que foi efetivamente recebido (quantidade/preço real), servindo como elo para o controle de estoque e custos.
- **ASSOCIAÇÕES COM OUTROS ARQUIVOS:**
  - **Model (`ComprasPedido`):** Associação `belongsTo` via `id_pedido`.
  - **Model (`ItemEstoque`):** Associação `belongsTo` via `id_produto`.
  - **Config (`sequelize.ts`):** Importa a conexão.
  - **Config (`types.ts`):** Importa a factory de models.
- **FRONTEND / USO PRINCIPAL:**
  - **Tela de Pedido de Compra (Detalhe):** Componente que exibe a lista de insumos/produtos comprados dentro de um pedido específico.
  - **Módulo de Recebimento:** Usado para que o usuário informe a `quantidade_recebida` e o `preco_custo_unitario_real` no momento da entrada da mercadoria.
  - **Cálculo de Custo:** Fornece o preço de custo real para a atualização do preço médio ponderado do estoque.
- **COMO OUTROS ARQUIVOS ACESSAM ESTE ARQUIVO (Técnico — Import/Export):**
  - **Export:** Exporta o Model `ComprasItemPedido` e a interface `ComprasItemPedidoModel`.
  - **Import:** É importado pela camada `ComprasItemPedidoService` (lógica GCI) para persistência e consultas, e pelo Model `ComprasPedido` (para definir a associação `hasMany` implícita).
- **Sugestão de melhoria em poucas palavras:** Usar um `DataTypes.ENUM` para o campo `status_qualidade` em vez de `DataTypes.STRING(20)`.

######################################################################

### Nome do arquivo:\*\* // src/models/ComprasPedido.ts

- **TIPO DE ARQUIVO:** Model
- **NOME DA TABELA NO DB:** PEDIDOS_COMPRA
- **CHAVE PRIMÁRIA (PK):** id_pedido
- **CHAVES ESTRANGEIRAS (FK):**
  - id_fornecedor
  - colaborador_id_sugestao
  - colaborador_id_aprovacao (Opcional)
- **REGRAS CHAVE / FUNÇÃO PRINCIPAL:**
  - **Regra GPR-1.A (Entidade de Dados):** Mapeia o cabeçalho do pedido de compra, que agrega todos os itens e gerencia o fluxo de aprovação.
  - **Regra GPR-1.D (Fluxo de Aprovação):** Utiliza um campo `status_aprovacao` com `DataTypes.ENUM` (`SUGERIDO`, `APROVADO`, etc.) para controlar rigidamente o ciclo de vida do pedido.
  - **Regra GPR-4 (Consistência Numérica):** Implementa Getter para o `valor_total_previsto` (DECIMAL) garantindo que seja um `number` no JavaScript.
  - **Regra GPR-2.B (Associações ORM):** Define múltiplas associações `belongsTo` (`Fornecedor`, `Colaborador` sugerido e aprovador) e uma associação `hasMany` com `ComprasItemPedido`.
  - **Função Principal:** Servir como a entidade principal para o módulo de Compras, gerenciando o relacionamento com fornecedores, rastreando o status de aprovação do pedido e agregando os itens que serão adquiridos.
- **ASSOCIAÇÕES COM OUTROS ARQUIVOS:**
  - **Model (`Fornecedor`):** Associação `belongsTo` via `id_fornecedor`.
  - **Model (`Colaborador`):** Duas associações `belongsTo` para `colaborador_id_sugestao` e `colaborador_id_aprovacao`.
  - **Model (`ComprasItemPedido`):** Associação `hasMany` via `id_pedido`.
  - **Config (`sequelize.ts`):** Importa a conexão.
  - **Config (`types.ts`):** Importa as interfaces de tipagem.
- **FRONTEND / USO PRINCIPAL:**
  - **Tela de Pedidos de Compra (Lista):** Exibição da lista principal de pedidos, filtrada por status (`status_aprovacao`).
  - **Tela de Aprovação:** Interface para que colaboradores com permissão alterem o `status_aprovacao` e preencham `colaborador_id_aprovacao` e `data_aprovacao`.
  - **Integração Financeira:** Fornece o valor total do compromisso financeiro com o fornecedor.
- **COMO OUTROS ARQUIVOS ACESSAM ESTE ARQUIVO (Técnico — Import/Export):**
  - **Export:** Exporta o Model `ComprasPedido` (default) e interfaces de tipagem.
  - **Import:** É importado pela camada `ComprasPedidoService` (lógica GCI) para todas as operações CRUD e consultas de status. É também importado por `ComprasItemPedido` e `Fornecedor` (para definir associações inversas, embora não estejam no código atual).
- **Sugestão de melhoria em poucas palavras:** Implementar lógica de ganho de performance com o `valor_total_previsto` sendo um campo virtual (calculado a partir dos itens) em vez de persistido.

######################################################################

### Nome do arquivo: //src/models/ContaContabil.ts

- **TIPO DE ARQUIVO:** Model
- **NOME DA TABELA NO DB:** ContasContabeis
- **CHAVE PRIMÁRIA (PK):** id_conta_contabil
- **CHAVES ESTRANGEIRAS (FK):**
  - conta_pai_id (Auto-referência para `ContasContabeis`)
- **REGRAS CHAVE / FUNÇÃO PRINCIPAL:**
  - **Regra GPR-1.A (Entidade de Dados):** Mapeia o Plano de Contas, a estrutura fundamental do módulo Contábil/Financeiro.
  - **Regra GPR-5 (Padrão de Chave):** Utiliza `id_conta_contabil` como chave primária sequencial padrão.
  - **Regra GPR-1.D (Estrutura Hierárquica):** Implementa a auto-referência (`conta_pai_id`) para construir a hierarquia de contas (Árvore de Contas).
  - **Regra GPR-1.C (Regras de Negócio no Model):** Define `tipo_conta` (macro-grupo) e `natureza` (Devedora/Credora) usando `DataTypes.ENUM` para impor consistência e tipagem nos dados contábeis.
  - **Regra GPR-2.B (Associações ORM):** Define auto-associações `belongsTo` (`contaPai`) e `hasMany` (`subContas`) para facilitar consultas recursivas e navegação na árvore.
  - **Função Principal:** Estruturar e organizar todas as contas usadas para registrar transações financeiras (receitas, custos, despesas, ativos, passivos), garantindo a integridade da contabilidade de dupla entrada.
- **ASSOCIAÇÕES COM OUTROS ARQUIVOS:**
  - **Auto-Associação:** Associações recursivas (`belongsTo` e `hasMany`) com o próprio `ContaContabil` para hierarquia.
  - **Config (`sequelize.ts`):** Importa a conexão.
  - **Config (`types.ts`):** Importa a factory de models.
- **FRONTEND / USO PRINCIPAL:**
  - **Tela de Configuração do Plano de Contas:** Permite ao usuário criar, editar e visualizar a estrutura hierárquica das contas.
  - **Módulo de Lançamentos Contábeis:** Usado para garantir que os lançamentos de débito/crédito ocorram apenas em contas analíticas (`eh_analitica: true`).
  - **Relatórios Financeiros:** Serve como base para geração de relatórios como Balanço Patrimonial e DRE (Demonstração do Resultado do Exercício), utilizando a tipagem e natureza da conta.
- **COMO OUTROS ARQUIVOS ACESSAM ESTE ARQUIVO (Técnico — Import/Export):**
  - **Export:** Exporta o Model `ContaContabil` (default).
  - **Import:** É importado pela camada `ContaContabilService` (lógica GCI) para gerenciar o CRUD. Também é importado por Models de Lançamentos Financeiros (ex: `LoteLancamento`, `FluxoCaixa`) que precisam referenciar a qual conta a transação pertence.

- Sugestão de melhoria em poucas palavras: Adicionar validação de unicidade para o campo `codigo` no nível de ORM (já existe no DB, mas é bom reforçar).

######################################################################

### Nome do arquivo://src/models/CupomNaoFiscal.ts

- **TIPO DE ARQUIVO:** Model
- **NOME DA TABELA NO DB:** CuponsNaoFiscais
- **CHAVE PRIMÁRIA (PK):** id_cupom_nao_fiscal
- **CHAVES ESTRANGEIRAS (FK):**
  - unidade_id (R4)
  - venda_comanda_id (Opcional, referenciando `VendaComandas.id_comanda`)
- **REGRAS CHAVE / FUNÇÃO PRINCIPAL:**
  - **Regra GPR-1.A (Entidade de Dados):** Mapeia o registro de uma transação de venda finalizada, primariamente para fins de controle interno e prestação de contas ao cliente, quando não é emitido um documento fiscal oficial.
  - **Regra GPR-1.C (Tipagem de Negócio):** Define `tipo_pagamento` usando `DataTypes.ENUM` (`DINHEIRO`, `CARTAO`, `PIX`) para padronizar e restringir os métodos de recebimento aceitos pelo sistema.

[Image of sales transaction flow chart]

```
* **Regra R4 (Multi-Unidade):** Contém obrigatoriamente a FK `unidade_id`, garantindo a conformidade com a regra de isolamento de dados por unidade de negócio.
* **Regra R3 (Precisão Financeira):** Utiliza `DataTypes.DECIMAL(10, 2)` para o `valor_total`, conforme a regra de precisão em campos monetários.
* **Regra GPR-4 (Tratamento de Decimais):** Implementa um Getter para `valor_total` para garantir que o dado retornado ao TypeScript/JavaScript seja um `number` (float), facilitando cálculos.
* **Função Principal:** Registrar de forma imutável a conclusão de uma venda, servindo como base para fechamento de caixa e conciliação de recebíveis (não fiscais).
```

- **ASSOCIAÇÕES COM OUTROS ARQUIVOS:**
  - **Model (`Unidade`):** Associação `belongsTo` via `unidade_id` (Regra R4).
  - **Model (`VendaComanda`):** Associação `belongsTo` via `venda_comanda_id` (para rastrear a origem da venda).
  - **Config (`sequelize.ts`):** Importa a conexão.
  - **Config (`types.ts`):** Importa a factory de models.
- **FRONTEND / USO PRINCIPAL:**
  - **PDV (Ponto de Venda):** Gerado automaticamente após a conclusão de uma venda, principalmente para emissão de comprovantes internos para o cliente.
  - **Tela de Fechamento de Caixa:** Utilizado para somar os valores recebidos por tipo de pagamento e realizar a conferência diária da unidade.
  - **Relatórios de Venda (Gerenciais):** Usado em relatórios para analisar o volume de vendas por forma de pagamento e unidade, independentemente da emissão fiscal.
- **COMO OUTROS ARQUIVOS ACESSAM ESTE ARQUIVO (Técnico — Import/Export):**
  - **Export:** Exporta o Model `CupomNaoFiscal` (default).
  - **Import:** É importado pela camada `CaixaService` (Serviço de Caixa) e `VendaService` (Serviço de Vendas) para criar o registro no momento da finalização do pagamento. Também é importado por Models de Relatório (futuros) para consultas.
- **Sugestão de melhoria em poucas palavras:** Implementar um campo de hash/checksum para garantir a imutabilidade e a não-repúdio do cupom não fiscal.

######################################################################

### Nome do arquivo:\*\* // src/models/CustoFixo.ts

- **TIPO DE ARQUIVO:** Model
- **NOME DA TABELA NO DB:** CUSTOS_FIXOS
- **CHAVE PRIMÁRIA (PK):** id_custo_fixo
- **CHAVES ESTRANGEIRAS (FK):**
  - unidade_id (Regra R4: Multi-Unidade)
- **REGRAS CHAVE / FUNÇÃO PRINCIPAL:**
  - **Regra GPR-1.A (Entidade de Dados):** Mapeia custos operacionais que não variam com o volume de produção/venda.
  - **Regra R4 (Multi-Unidade):** A presença de `unidade_id` garante o isolamento e o rastreamento dos custos por unidade de negócio.
  - **Regra R3 (Precisão Financeira):** Utiliza `DataTypes.DECIMAL(10, 2)` no campo `valor` para garantir precisão monetária.
  - **Regra GPR-4 (Tratamento de Decimais):** Implementa o getter no campo `valor` para retornar o valor como `number` (float), facilitando a manipulação e cálculo na camada Service.
  - **Tipagem:** O campo `categoria` usa uma string restrita, servindo como uma categorização interna dos custos (ex: ALUGUEL, SALARIO).

[Image of fixed cost calculation diagram]

```
* **Função Principal:** Servir como o repositório de dados para todas as despesas fixas da unidade, sendo crucial para análises de Break-Even Point (Ponto de Equilíbrio) e DRE.
```

- **ASSOCIAÇÕES COM OUTROS ARQUIVOS:**
  - **Model (`Unidade`):** Associação lógica `belongsTo` via `unidade_id` (associação explícita pendente na função `associate`).
  - **Config (`sequelize.ts`):** Importa a conexão.
- **FRONTEND / USO PRINCIPAL:**
  - **Módulo Financeiro:** Tela de Cadastro e Consulta de Custos Fixos.
  - **Módulo de Relatórios:** Base para o cálculo de despesas operacionais na DRE (Demonstração do Resultado do Exercício).
  - **Módulo de Planejamento:** Utilizado para projeção de orçamentos e custos futuros.
- **COMO OUTROS ARQUIVOS ACESSAM ESTE ARQUIVO (Técnico — Import/Export):**
  - **Export:** Exporta o Model `CustoFixo` (default).
  - **Import:** É importado pela camada `Service` (ex: `CustoFixoService`) para operações de CRUD e pelos Services de Relatórios (ex: `RelatorioFinanceiroService`) para processamento e consolidação de dados.
- **Sugestão de melhoria em poucas palavras:** Implementar a associação `belongsTo` com o Model `Unidade` na função `associate` para conformidade GPR-3.

######################################################################

### Nome do arquivo: //src/models/DocumentoContabil.ts

- **TIPO DE ARQUIVO:** Model
- **NOME DA TABELA NO DB:** DocumentosContabeis
- **CHAVE PRIMÁRIA (PK):** id_documento_contabil
- **CHAVES ESTRANGEIRAS (FK):**
  - unidade_id (Regra R4: Multi-Unidade)
  - conta_contabil_id
- **REGRAS CHAVE / FUNÇÃO PRINCIPAL:**
  - **Regra GPR-1.A (Entidade de Dados):** Representa o lançamento contábil primário (débito ou crédito) para qualquer evento de negócio.
  - **Regra GPR-1.B (Mecanismo de Rastreabilidade):** Utiliza os campos `referencia_origem` e `id_origem` para rastrear de forma unificada a fonte de qualquer lançamento contábil (ex: qual `VendaComanda` gerou este débito).
  - **Regra R4 (Multi-Unidade):** Contém `unidade_id` para garantir que os livros contábeis sejam segregados por unidade de negócio.
  - **Regra R3 (Precisão Financeira):** Utiliza `DataTypes.DECIMAL(10, 2)` no campo `valor` para aderência à precisão monetária.
  - **Regra GPR-4 (Tratamento de Decimais):** Implementa o getter no campo `valor` para retornar o valor como `number` (float), essencial para a correta somatória e cálculo dos balancetes.
  - **Função Principal:** Registrar cada transação contábil no Livro Razão do sistema, formando a espinha dorsal para a geração de balancetes e demonstrações financeiras (DRE, Balanço Patrimonial).
- **ASSOCIAÇÕES COM OUTROS ARQUIVOS:**
  - **Model (`Unidade`):** Associação `belongsTo` via `unidade_id` (R4).
  - **Model (`ContaContabil`):** Associação `belongsTo` via `conta_contabil_id`.
  - **Model (`ContaContabil`):** Importado para definição de tipos.
  - **Config (`sequelize.ts`):** Importa a conexão.
  - **Config (`associations.ts`):** Usado para tipagem da função `associate`.
- **FRONTEND / USO PRINCIPAL:**
  - **Módulo Contábil/Financeiro:** Tela de visualização do Livro Razão e Diário.
  - **Relatórios (DRE/Balanço):** O principal motor de dados para a geração de todas as demonstrações financeiras e balancetes da unidade.
  - **Auditoria:** Usado para traçar o caminho completo de qualquer valor monetário no sistema, da origem (Ex: Venda) até a conta contábil final.
- **COMO OUTROS ARQUIVOS ACESSAM ESTE ARQUIVO (Técnico — Import/Export):**
  - **Export:** Exporta o Model `DocumentoContabil` (default).
  - **Import:** É importado e utilizado por Services de transação (ex: `VendaService`, `CustoFixoService`, `RegistroFiscalService`) sempre que uma operação com impacto financeiro é finalizada, garantindo que o lançamento contábil seja gerado.
- **Sugestão de melhoria em poucas palavras:** Adicionar índice composto na tabela para `(referencia_origem, id_origem)` para otimizar consultas de rastreabilidade.

######################################################################

### Nome do arquivo: //src/models/Escala.ts

- **TIPO DE ARQUIVO:** Model
- **NOME DA TABELA NO DB:** ESCALAS
- **CHAVE PRIMÁRIA (PK):** id_escala
- **CHAVES ESTRANGEIRAS (FK):**
  - unidade_id (Regra R4: Multi-Unidade)
  - criador_id (Referências a `Usuarios`)
  - aprovador_id (Referências a `Usuarios`)
- **REGRAS CHAVE / FUNÇÃO PRINCIPAL:**
  - **Regra GPR-1.A (Entidade de Dados):** Define a estrutura para o planejamento de turnos e horários de trabalho de múltiplos colaboradores em um período.
  - **Regra R4 (Multi-Unidade):** A presença de `unidade_id` garante que a gestão de escalas seja restrita e isolada por unidade de negócio.
  - **Regra GPR-3.B (Relação M:N):** Utiliza a associação `belongsToMany` com `Colaborador` através da tabela de junção `EscalaColaboradores`, permitindo que uma escala envolva múltiplos colaboradores.
  - **Regra GPR-6 (Workflow de Aprovação):** Inclui os campos `criador_id`, `aprovador_id` (opcional) e `status` (PENDENTE/APROVADA/REJEITADA), estabelecendo um fluxo de trabalho (workflow) de RH dentro do sistema.
  - **Função Principal:** Armazenar o plano de trabalho e o status de aprovação, sendo a base de dados para a folha de ponto e o controle de mão de obra.
- **ASSOCIAÇÕES COM OUTROS ARQUIVOS:**
  - **Model (`Unidade`):** Associação lógica `belongsTo` via `unidade_id`.
  - **Model (`Usuario`):** Associação `belongsTo` para `Criador` e `Aprovador`.
  - **Model (`Colaborador`):** Associação `belongsToMany` via tabela de junção `EscalaColaboradores`.
  - **Config (`sequelize.ts`):** Importa a conexão.
- **FRONTEND / USO PRINCIPAL:**
  - **Módulo de RH/Escalas:** Interface gráfica de arrastar e soltar (drag-and-drop) para criação, edição e visualização de escalas semanais/mensais.
  - **Workflow:** Tela de aprovação para gerentes/administradores para alterar o `status` da escala.
  - **Relatórios:** Base para cálculo de horas trabalhadas, horas extras e custo de mão de obra.
- **COMO OUTROS ARQUIVOS ACESSAM ESTE ARQUIVO (Técnico — Import/Export):**
  - **Export:** Exporta a classe `Escala` (default) e o tipo `EscalaModel`.
  - **Import:** É importado pela camada `Service` (ex: `EscalaService`) para todas as operações de CRUD, gestão de status e para as consultas complexas que envolvem os Colaboradores (`ColaboradorService`).
- **Sugestão de melhoria em poucas palavras:** Adicionar validação de datas (fim > início) e de sobreposição de escalas para o mesmo colaborador na camada Service.

######################################################################

######################################################################

######################################################################

######################################################################
