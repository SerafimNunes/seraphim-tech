Guia de Contexto e Integração (GCI)
Este documento consolida as regras de arquitetura e segurança para as camadas de Controller, Service e Acesso a Dados, visando a separação de responsabilidades (SRP) e a defesa em profundidade.

1. 🌐 Camada de Roteamento e Controle (Routes & Controllers)
   O Controller atua como a interface entre o mundo HTTP e a lógica de negócios, focando em validação e delegação.

Regra,Título,Descrição
1.A,Injeção de Dependência,O Controller deve instanciar o Service correspondente no seu construtor (new Service()) para facilitar a testabilidade.
1.B,Validação de Entrada (Zod),"O Controller é o único responsável por validar todos os dados de entrada (req.body, req.params, req.query) utilizando a biblioteca Zod (ou similar)."
1.C,Tratamento de Erros HTTP,O Controller deve capturar erros: Zod → 400 Bad Request; Lógicos/Não Encontrado → 404/409 Conflict; Outros → 500 Internal Server Error.
1.D,Remoção de Transações,"O Controller NUNCA deve iniciar, comitar ou dar rollback em transações. Essa responsabilidade pertence ao Service."
1.E,Padronização de Respostas,"O Controller deve retornar status HTTP coerentes com a operação: 200 OK, 201 Created, 204 No Content (para deleção)."
1.F,Isolamento de Lógica,"O Controller NÃO pode conter lógica de negócios, cálculos complexos ou manipular múltiplos Services para uma única operação. Ele apenas chama o método do Service."
1.G,Segurança no Controller/Routes,"O Controller/Router DEVE aplicar a Autenticação e Autorização (RBAC) usando middlewares (AuthMiddleware.verify, podeAcessar) para proteger o acesso às rotas."

2. ⚙️ Camada de Serviço (Service Layer)
   O Service é o orquestrador da lógica de negócios e o único ponto de acesso ao banco de dados.
   Regra,Título,Descrição
   2.A,Injeção de Dependência,O Service deve instanciar outros Services dependentes em seu construtor para garantir testabilidade.
   2.B,Acesso a Dados Direto,O Service é a única camada que pode interagir diretamente com os Models do Sequelize (ORM).
   2.C,Gestão da Transação,"O Service de nível mais alto (o orquestrador) é o único responsável por iniciar a transação, passá-la para Services dependentes e executar commit() ou rollback()."
   2.D,Isolamento de Dados (R4),"O Service DEVE utilizar o unidade_id (e/ou id_usuario) fornecido pelo Controller para filtrar todas as consultas de leitura, atualização e exclusão, garantindo que usuários só acessem dados de sua própria unidade (Defesa em Profundidade)."
   2.E,Orquestração de Lógica,"O Service contém a lógica de negócio (cálculos, fluxos de status, validações de estado). Operações que envolvem múltiplos Models ou Services devem ser orquestradas aqui."
