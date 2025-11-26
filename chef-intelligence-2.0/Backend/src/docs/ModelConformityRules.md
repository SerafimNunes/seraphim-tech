// src/docs/ModelConformityRules.md

GPR - Padrão de Conformidade e Reuso de Modelos

Este documento estabelece as regras obrigatórias de Governança, Conformidade e Integridade (GCI) para a criação de novos modelos de dados (Sequelize) no sistema Chef Intelligence ERP. A falha em cumprir estas regras compromete a segurança (R4) e a estabilidade (R1, R3) da plataforma.

As Cinco Regras de Ouro (GPR)

Estas regras visam garantir a segurança de dados multi-unidade, a integridade de cálculos financeiros e a manutenibilidade do código TypeScript.

1. GPR-1: Conformidade R4 (Multi-Unidade)

Obrigatório: Todos os modelos de entidade principal (entidades que representam um recurso gerenciável: Venda, Pedido, Colaborador, ItemEstoque, Receita, etc.) DEVEM incluir o:

campo:unidade\*id: number;// ...
unidade_id: {
type: DataTypes.INTEGER,
allowNull: false,
comment: "ID da Unidade de negócio (Regra R4)"
},

Exceções: Modelos auxiliares/tabelas-pivot que só se associam a uma entidade GPR-1 (ex: VendaItem se associa a VendaComanda) ou tabelas globais (ex: Unidade, Empresa).

2. GPR-2: Tipagem Rígida e Completa (R1)

Obrigatório: Cada modelo DEVEM ser definido por, no mínimo, as três interfaces de tipagem, seguindo a Regra R1:[NomeEntidade]
Attributes: Define todos os campos da tabela.[NomeEntidade]CreationAttributes: Extende Optional<Attributes, ...> para campos que são auto-incrementáveis ou que têm defaultValue.[NomeEntidade]Model: Extende Model<Attributes, CreationAttributes> e inclui tipagem para todas as associações (ex: cliente?: ClienteModel;).

3. GPR-3: Associação Explícita (IModelFactory)

Obrigatório: O modelo DEVE definir suas associações em uma função anexa ((Model as any).associate = function (models: IModelFactory) { ... }) ou estática (Model.associate(models: IModelFactory)), recebendo o objeto IModelFactory para garantir que as associações sejam configuradas apenas após todos os modelos estarem inicializados.

4. GPR-4: Tratamento de Decimais (R3)
   Obrigatório: Qualquer campo que armazene valores monetários, preços, ou quantidades críticas (definido como DataTypes.DECIMAL no Sequelize) DEVE incluir um método get() para converter o valor do banco (que o Sequelize retorna como string ou unknown) em um

tipo number (float) de forma segura.

valor_total: {
type: DataTypes.DECIMAL(10, 2),
allowNull: false,
get() {
return parseFloat(
this.getDataValue("valor_total") as unknown as string
);
},
},

5. GPR-5: Padrão de Chave Primária
   Obrigatório: A chave primária (PK) DEVE seguir o padrão de nomenclatura: id\*[nome_da_entidade_singular].Obrigatório: A PK DEVE ser definida como primaryKey: true e autoIncrement: true.
