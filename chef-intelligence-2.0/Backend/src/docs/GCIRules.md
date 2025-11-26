// src/docs/GCIRules.md

GCI - Guia de Contexto e Integração (Controller e Service)Este guia consolida as regras de arquitetura e segurança para as camadas de Controller e Service, visando a Separação de Responsabilidades (SRP) e a Defesa em Profundidade.

1. 🌐 Camada de Roteamento e Controle (Routes & Controllers)
   O Controller atua como a interface entre o mundo HTTP e a lógica de negócios, focando em validação e delegação.

[ID - Título - Descrição]

1.A Injeção de Dependência O Controller deve instanciar o Service correspondente no seu construtor (new Service()) para gerenciar as dependências e facilitar a testabilidade da camada.

1.B Validação de Entrada (Zod)
O Controller é o único responsável por validar todos os dados de entrada (req.body, req.params, req.query) utilizando a biblioteca Zod (ou similar).

1.C Tratamento de Erros HTTPO Controller deve capturar e mapear erros para o status HTTP apropriado: Zod $\rightarrow$ 400 Bad Request; Erros Lógicos/Negócio (ex: Saldo Insuficiente, Item Não Encontrado) $\rightarrow$ 404 Not Found/409 Conflict; Outros erros não tratados $\rightarrow$ 500 Internal Server Error.

1.D Remoção de TransaçõesO Controller NUNCA deve iniciar, comitar ou dar rollback em transações do banco de dados. Essa responsabilidade é exclusiva da Camada de Service.

1.E Padronização de RespostasO Controller deve retornar status HTTP coerentes com a operação: 200 OK (Busca/Atualização), 201 Created (Criação de Recurso), 204 No Content (Deleção bem-sucedida sem corpo de resposta).

1.F Isolamento de LógicaO Controller NÃO pode conter lógica de negócios, cálculos complexos ou manipular múltiplos Services para uma única operação. Ele apenas delega a chamada para o método do Service.

1.G Segurança no Controller/RoutesO Controller/Router DEVE aplicar a Autenticação e Autorização (RBAC) usando middlewares (AuthMiddleware.verify, podeAcessar) para proteger o acesso às rotas antes de qualquer lógica.

2. ⚙️ Camada de Serviço (Service Layer)O Service é o orquestrador da lógica de negócios, o garantidor da Regra R4 e o único ponto de acesso ao banco de dados.

[ID Título Descrição]

2.A Injeção de Dependência: O Service deve instanciar outros Services dependentes em seu construtor para garantir testabilidade e controle de dependência.

2.B Acesso a Dados Direto: O Service é a única camada que pode interagir diretamente com os Models do Sequelize (ORM). Controllers, Middlewares e Outras Funções NÃO devem importar Models.

2.C Gestão da Transação: O Service de nível mais alto (o orquestrador da operação) é o único responsável por iniciar a transação, passá-la explicitamente para Services dependentes e executar commit() ou rollback() ao final.

2.D Isolamento de Dados (R4): O Service DEVE utilizar o unidade_id (e/ou id_usuario) fornecido pelo Controller para filtrar TODAS as consultas de leitura, atualização e exclusão (WHERE unidade_id = ?). Isso garante que usuários só acessem dados de sua própria unidade (Defesa em Profundidade).

2.E Orquestração de Lógica: O Service contém toda a lógica de negócio (cálculos, fluxos de status, validações de estado, etc.). Operações que envolvem múltiplos Models ou Services (ex: fechar venda que baixa estoque e registra contas a receber) DEVEM ser orquestradas aqui.
