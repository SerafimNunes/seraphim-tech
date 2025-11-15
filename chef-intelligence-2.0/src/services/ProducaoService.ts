// src/services/ProducaoService.ts (Serviço do Módulo Produção)

import { Transaction, Op, col } from "sequelize";
import { connection } from "../config/sequelize";
import { EstoqueService } from "./EstoqueService"; // 🔑 Dependência do novo serviço
import ProducaoRegistro, {
  ProducaoRegistroCreationAttributes,
  ProducaoRegistroModel,
} from "../models/ProducaoRegistro"; // 🔑 Model Renomeado
import ProducaoRequisicaoInsumo, {
  ProducaoRequisicaoInsumoCreationAttributes,
  ProducaoRequisicaoInsumoModel,
} from "../models/ProducaoRequisicaoInsumo"; // 🔑 Model Renomeado
import ProducaoRegistroPerda, {
  ProducaoRegistroPerdaCreationAttributes,
  ProducaoRegistroPerdaModel,
} from "../models/ProducaoRegistroPerda"; // 🔑 Model Renomeado
import ItemEstoque, { ItemEstoqueModel } from "../models/ItemEstoque";
import FichaTecnica from "../models/FichaTecnica";

interface ProducaoPayload {
  id_produto_produzido: number;
  quantidade_produzida: number;
  colaborador_id_sugestao: number;
  observacoes?: string;
}

interface ItemPerdaPayload {
  id_produto: number;
  quantidade_perdida: number;
  tipo_perda: "QUEBRA" | "VALIDADE" | "ERRO_PRODUCAO" | "ERRO_VENDA" | "OUTROS";
  colaborador_id: number;
  observacoes?: string;
}

export class ProducaoService {
  private estoqueService: EstoqueService;

  constructor() {
    this.estoqueService = new EstoqueService();
  }

  // --- FUNÇÕES DE CONSULTA ---

  /**
   * Lista todas as Ordens de Produção com filtros.
   */
  public async index(status?: string): Promise<ProducaoRegistroModel[]> {
    const whereClause: any = {};
    if (status) {
      whereClause.status_producao = status;
    }

    return ProducaoRegistro.findAll({
      where: whereClause,
      include: [
        {
          model: ItemEstoque,
          as: "produto_final",
          attributes: ["nome", "unidade_medida"],
        },
      ],
      order: [["createdAt", "DESC"]],
    }) as Promise<ProducaoRegistroModel[]>;
  }

  /**
   * Sugere Ordens de Produção para produtos abaixo do estoque mínimo.
   */
  public async suggestProduction(): Promise<
    { id_produto: number; nome: string; qtd_sugerida: number }[]
  > {
    // 1. Busca todos os produtos que são Vendáveis OU Pré-Prontos e estão abaixo do mínimo
    const produtosAlerta = await ItemEstoque.findAll({
      where: {
        [Op.or]: [{ is_vendavel: true }, { is_pre_pronto: true }],
        estoque_atual: { [Op.lt]: col("estoque_minimo") }, // Estoque Atual < Estoque Mínimo
      },
      attributes: [
        "id_produto",
        "nome",
        "unidade_medida",
        "estoque_atual",
        "estoque_minimo",
      ],
    });

    // 2. Calcula a quantidade sugerida para repor até o dobro do mínimo
    const sugestoes = produtosAlerta
      .map((produto) => {
        const estoqueAtual = parseFloat(
          produto.estoque_atual as unknown as string
        );
        const estoqueMinimo = parseFloat(
          produto.estoque_minimo as unknown as string
        );

        // Sugere produzir até 2x o estoque mínimo
        const target = estoqueMinimo * 2;
        const qtd_sugerida = Math.max(0, target - estoqueAtual);

        return {
          id_produto: produto.id_produto,
          nome: produto.nome,
          unidade_medida: produto.unidade_medida,
          estoque_atual: estoqueAtual,
          estoque_minimo: estoqueMinimo,
          qtd_sugerida: parseFloat(qtd_sugerida.toFixed(3)),
        };
      })
      .filter((s) => s.qtd_sugerida > 0);

    return sugestoes;
  }

  // --- FUNÇÕES TRANSACIONAIS DE FLUXO ---

  /**
   * Cria uma nova Ordem de Produção (OP) no status 'SUGERIDO'.
   */
  public async createProducao(
    payload: ProducaoPayload,
    transaction: Transaction
  ): Promise<ProducaoRegistroModel> {
    const {
      id_produto_produzido,
      quantidade_produzida,
      colaborador_id_sugestao,
      observacoes,
    } = payload;

    // 1. Validação de pré-requisitos
    const produto = await ItemEstoque.findByPk(id_produto_produzido, {
      transaction,
    });
    if (!produto) {
      throw new Error(
        `Produto final (ID: ${id_produto_produzido}) não encontrado.`
      );
    }

    // A Ficha Técnica é validada mais tarde (na aprovação), mas é bom verificar a existência da FT
    const fichaTecnica = await FichaTecnica.findOne({
      where: { id_produto_pai: id_produto_produzido },
      transaction,
    });
    if (!fichaTecnica) {
      console.warn(
        `Produto ${produto.nome} não possui Ficha Técnica. A produção pode falhar na aprovação.`
      );
    }

    // 2. Cria o registro de produção
    const registroData: ProducaoRegistroCreationAttributes = {
      id_produto_produzido,
      quantidade_produzida,
      colaborador_id_sugestao,
      status_producao: "SUGERIDO",
      observacoes: observacoes || "Ordem de Produção manual.",
    };

    const registro = await ProducaoRegistro.create(registroData, {
      transaction,
    });
    return registro;
  }

  /**
   * [ETAPA 1] Aprova a OP, mudando o status e gerando a Requisição de Insumos.
   */
  public async startProduction(
    id_registro: number,
    colaborador_id_aprovacao: number,
    transaction: Transaction
  ): Promise<ProducaoRegistroModel> {
    const registro = await ProducaoRegistro.findByPk(id_registro, {
      transaction,
    });
    if (!registro) {
      throw new Error(`Ordem de Produção (ID: ${id_registro}) não encontrada.`);
    }
    if (registro.status_producao !== "SUGERIDO") {
      throw new Error(
        `Ordem de Produção ID ${id_registro} não pode ser iniciada. Status atual: ${registro.status_producao}.`
      );
    }

    const id_produto_pai = registro.id_produto_produzido;

    // 1. Busca a Ficha Técnica para verificar insumos
    const composicao = await FichaTecnica.findAll({
      where: { id_produto_pai },
      transaction,
    });

    if (composicao.length === 0) {
      throw new Error(
        `Não há Ficha Técnica para o produto ${id_produto_pai}. Impossível iniciar a produção.`
      );
    }

    // 2. Atualiza o status do registro de produção
    await registro.update(
      {
        status_producao: "APROVADO",
        colaborador_id_aprovacao: colaborador_id_aprovacao,
        data_inicio: new Date(),
      },
      { transaction }
    );

    // 3. Cria a Requisição de Insumos (Status SOLICITADA)
    const requisicaoData: ProducaoRequisicaoInsumoCreationAttributes = {
      id_registro_producao: id_registro,
      colaborador_id_recebedor: colaborador_id_aprovacao, // Colaborador que aprovou é o recebedor inicial
      status_requisicao: "SOLICITADA",
      // O colaborador_id_responsavel será definido na ENTREGA (passo 2)
    };

    await ProducaoRequisicaoInsumo.create(requisicaoData, { transaction });

    return registro;
  }

  /**
   * [ETAPA 2] Entrega dos Insumos: Abate a quantidade de insumos do Estoque.
   */
  public async deliverInsumos(
    id_registro: number,
    colaborador_id_separador: number,
    observacoes_estoque: string | null,
    transaction: Transaction
  ): Promise<ProducaoRegistroModel> {
    const registro = (await ProducaoRegistro.findByPk(id_registro, {
      transaction,
      include: [
        {
          model: ProducaoRequisicaoInsumo,
          as: "requisicao",
          where: { status_requisicao: "SOLICITADA" },
          required: true,
        },
      ],
    })) as ProducaoRegistroModel & {
      requisicao: ProducaoRequisicaoInsumoModel;
    };

    if (!registro) {
      throw new Error(
        `Ordem de Produção (ID: ${id_registro}) não encontrada ou Requisição não está 'SOLICITADA'.`
      );
    }
    if (registro.status_producao !== "APROVADO") {
      throw new Error(
        `OP ID ${id_registro} não está 'APROVADA'. Status atual: ${registro.status_producao}.`
      );
    }

    const qtd_producao = parseFloat(
      registro.quantidade_produzida as unknown as string
    );
    const id_produto_pai = registro.id_produto_produzido;

    // 1. Busca a Ficha Técnica (insumos necessários)
    const composicao = (await FichaTecnica.findAll({
      where: { id_produto_pai },
      include: [{ model: ItemEstoque, as: "produto_filho" }],
      transaction,
    })) as any[];

    let custo_total_insumos = 0;

    // 2. Itera e realiza a SAÍDA de estoque para cada insumo
    for (const item of composicao) {
      const insumo: ItemEstoqueModel = item.produto_filho;
      const qtd_necessaria_unit = parseFloat(
        item.quantidade_necessaria as unknown as string
      );
      const qtd_total_saida = qtd_necessaria_unit * qtd_producao;

      if (qtd_total_saida <= 0) continue;

      // 🔑 CRÍTICO: Chamada ao Serviço de Estoque para Saída (Baixa de Insumo)
      const { custo_saida } = await this.estoqueService.saidaEstoque(
        insumo,
        qtd_total_saida,
        `BAIXA de insumo para OP #${id_registro} (${registro.produto_final?.nome})`,
        `OP#${id_registro}`, // Referência
        transaction
      );

      custo_total_insumos += custo_saida;
    }

    // 3. Atualiza Requisição e Registro
    await registro.requisicao.update(
      {
        status_requisicao: "ENTREGUE",
        colaborador_id_separador: colaborador_id_separador,
        data_entrega: new Date(),
        observacoes_estoque:
          observacoes_estoque || "Insumos entregues conforme requisição.",
      },
      { transaction }
    );

    await registro.update(
      {
        status_producao: "EM_PRODUCAO",
        colaborador_id_responsavel:
          registro.requisicao.colaborador_id_recebedor, // O recebedor se torna o responsável pela OP
        custo_total_producao: custo_total_insumos, // Registra o custo real dos insumos abatidos
      },
      { transaction }
    );

    return registro;
  }

  /**
   * [ETAPA 3] Conclusão da Produção: Adiciona o Produto Final ao Estoque.
   */
  public async finishProduction(
    id_registro: number,
    colaborador_id_conclusao: number,
    transaction: Transaction
  ): Promise<ProducaoRegistroModel> {
    const registro = await ProducaoRegistro.findByPk(id_registro, {
      transaction,
    });

    if (!registro) {
      throw new Error(`Ordem de Produção (ID: ${id_registro}) não encontrada.`);
    }
    if (registro.status_producao !== "EM_PRODUCAO") {
      throw new Error(
        `OP ID ${id_registro} não pode ser concluída. Status atual: ${registro.status_producao}.`
      );
    }

    const qtd_produzida = parseFloat(
      registro.quantidade_produzida as unknown as string
    );
    const custo_total_producao = parseFloat(
      registro.custo_total_producao as unknown as string
    );
    const id_produto_final = registro.id_produto_produzido;

    // 1. Encontra o produto final (ItemEstoque)
    const produtoFinal = await ItemEstoque.findByPk(id_produto_final, {
      transaction,
    });
    if (!produtoFinal) {
      throw new Error(
        `Produto final (ID: ${id_produto_final}) não encontrado.`
      );
    }

    // 2. Calcula o novo custo unitário de produção
    let novo_custo_unitario_producao = 0;
    if (qtd_produzida > 0) {
      novo_custo_unitario_producao = custo_total_producao / qtd_produzida;
    }

    // 🔑 CRÍTICO: Chamada ao Serviço de Estoque para Entrada (Produto Final)
    await this.estoqueService.entradaEstoque(
      produtoFinal,
      qtd_produzida,
      novo_custo_unitario_producao, // O custo de produção
      `ENTRADA de produto final OP #${id_registro} - Concluída por ${colaborador_id_conclusao}`,
      `OP#${id_registro}`, // Referência
      transaction
    );

    // 3. Atualiza o status do registro de produção
    await registro.update(
      {
        status_producao: "CONCLUIDO",
        data_conclusao: new Date(),
      },
      { transaction }
    );

    return registro;
  }

  /**
   * Registra uma perda de estoque, realizando a baixa.
   */
  public async createPerda(
    payload: ItemPerdaPayload,
    transaction: Transaction
  ): Promise<ProducaoRegistroPerdaModel> {
    const {
      id_produto,
      quantidade_perdida,
      tipo_perda,
      colaborador_id,
      observacoes,
    } = payload;

    const produto = await ItemEstoque.findByPk(id_produto, { transaction });
    if (!produto) {
      throw new Error(`Produto (ID: ${id_produto}) não encontrado.`);
    }

    const qtd_perda = parseFloat(quantidade_perdida as unknown as string);
    const custo_unitario_atual = parseFloat(
      produto.preco_custo_unitario as unknown as string
    );

    // 🔑 CRÍTICO: Chamada ao Serviço de Estoque para Saída (Baixa por Perda)
    const { custo_saida } = await this.estoqueService.saidaEstoque(
      produto,
      qtd_perda,
      `BAIXA por Perda: ${tipo_perda} - Colaborador ${colaborador_id}`,
      `PERDA#${id_produto}-${new Date().getTime()}`, // Referência única
      transaction
    );

    // Cria o registro de Perda
    const registroPerdaData: ProducaoRegistroPerdaCreationAttributes = {
      id_produto: id_produto,
      quantidade_perdida: qtd_perda,
      custo_unitario_na_hora: custo_unitario_atual,
      custo_total_perda: custo_saida,
      colaborador_id: colaborador_id,
      tipo_perda: tipo_perda,
      observacoes: observacoes || `Perda registrada como ${tipo_perda}.`,
      data_registro: new Date(),
    };

    const registroPerda = await ProducaoRegistroPerda.create(
      registroPerdaData,
      { transaction }
    );
    return registroPerda;
  }

  /**
   * Cancela uma OP no status SUGERIDO ou APROVADO.
   */
  public async cancelProduction(
    id_registro: number,
    colaborador_id_cancelamento: number,
    observacoes: string | null,
    transaction: Transaction
  ): Promise<ProducaoRegistroModel> {
    const registro = await ProducaoRegistro.findByPk(id_registro, {
      transaction,
    });

    if (!registro) {
      throw new Error(`Ordem de Produção (ID: ${id_registro}) não encontrada.`);
    }
    if (
      registro.status_producao === "CONCLUIDO" ||
      registro.status_producao === "EM_PRODUCAO"
    ) {
      throw new Error(
        `Ordem de Produção ID ${id_registro} não pode ser cancelada. Status atual: ${registro.status_producao}.`
      );
    }

    // 1. Atualiza Registro de Produção
    await registro.update(
      {
        status_producao: "CANCELADO",
        colaborador_id_aprovacao: colaborador_id_cancelamento, // Usa campo para auditoria
        data_conclusao: new Date(),
        observacoes: `CANCELADA por: ${
          observacoes || "Motivo não especificado."
        }`,
      },
      { transaction }
    );

    // 2. Se Requisição existir (status SOLICITADA), marca como CANCELADA
    const requisicao = await ProducaoRequisicaoInsumo.findOne({
      where: {
        id_registro_producao: id_registro,
        status_requisicao: "SOLICITADA",
      },
      transaction,
    });

    if (requisicao) {
      await requisicao.update(
        {
          status_requisicao: "CANCELADA",
          data_entrega: new Date(),
          observacoes_estoque: `Cancelada pela OP#${id_registro} por Colaborador ${colaborador_id_cancelamento}.`,
        },
        { transaction }
      );
    }

    return registro;
  }
}
