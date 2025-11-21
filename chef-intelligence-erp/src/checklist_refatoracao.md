Módulo/Categoria,Arquivo Original (a ser renomeado),Novo Arquivo (Nomenclatura Padrão),Status,Ação Necessária
I. Configuração,src/config/sequelize.js,src/config/sequelize.ts,🟡 Pendente,Conversão para TS e ajuste de exports.
Configuração,src/config/database.js,src/config/database.ts,🟡 Pendente,Conversão para TS.
Configuração,src/config/associations.js,src/config/associations.ts,🟡 Pendente,Conversão para TS e ajuste de referências de modelos.
Configuração (Raiz),src/index.js,src/index.ts,🟡 Pendente,CRÍTICO: Conversão para TS e atualização de todos os require() para import (e novos nomes).
II. Modelos (Estoque),src/models/Produto.js,src/models/ItemEstoque.ts,🟡 Pendente,"Refatoração Principal: Conversão para TS, inclusão de associate(), R4, R11."
Modelos (Estoque),src/models/ContagemEstoque.js,src/models/RegistroContagem.ts,🟡 Pendente,"Conversão para TS, ajuste de referências internas, inclusão de associate()."
Modelos (Estoque),src/models/MovimentoEstoque.js,src/models/RegistroMovimento.ts,🟡 Pendente,"Conversão para TS, ajuste de referências internas, inclusão de associate()."
III. Controladores (Estoque),src/controllers/ProdutoController.js,src/controllers/ItemEstoqueController.ts,🟡 Pendente,"Conversão para TS, Injeção de EstoqueService, R3, R10."
Controladores (Estoque),src/controllers/ContagemController.js,src/controllers/RegistroContagemController.ts,🟡 Pendente,"Conversão para TS, Injeção de EstoqueService, R2."
Controladores (Estoque),src/controllers/MovimentoController.js,src/controllers/RegistroMovimentoController.ts,🟡 Pendente,"Conversão para TS, uso do novo modelo."
IV. Outros Modelos,src/models/Caixa.js,src/models/Caixa.ts,🟡 Pendente,Conversão para TS.
Outros Modelos,src/models/Colaborador.js,src/models/Colaborador.ts,🟡 Pendente,Conversão para TS.
Outros Modelos,src/models/EScala.js,src/models/Escala.ts,🟡 Pendente,"Conversão para TS (e ajuste de nome, se o original for EScala)."
Outros Modelos,src/models/FichaTecnica.js,src/models/FichaTecnica.ts,🟡 Pendente,Conversão para TS.
Outros Modelos,src/models/Fornecedor.js,src/models/Fornecedor.ts,🟡 Pendente,Conversão para TS.
Outros Modelos,src/models/ItemPedido.js,src/models/ItemPedido.ts,🟡 Pendente,Conversão para TS.
Outros Modelos,src/models/ItemVenda.js,src/models/ItemVenda.ts,🟡 Pendente,Conversão para TS.
V. Serviços (Nova Camada),N/A,src/services/EstoqueService.ts,🟡 Pendente,"CRÍTICO: Criação da camada de serviço (R2, R3)."