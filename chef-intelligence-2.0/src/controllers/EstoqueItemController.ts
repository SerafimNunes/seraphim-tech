// src/controllers/EstoqueItemController.ts (CORRIGIDO: Nomenclatura)

import { Request, Response } from "express";
import { EstoqueItemService } from "../services/EstoqueItemService";
import { connection } from "../config/sequelize";
import { Sequelize } from "sequelize";

// Tipagem para Recebimento (Entrada de Estoque)
interface ReceberEstoqueBody {
  // id_produto será lido do req.params.id
  quantidade: number;
  custo_unitario: number;
  colaborador_id: number;
  tipo_movimento: "COMPRA" | "AJUSTE_ENTRADA";
  referencia_origem: string;
}

// Tipagem para Saída de Estoque (Baixa)
interface SaidaEstoqueBody {
  // id_produto será lido do req.params.id
  quantidade: number;
  colaborador_id: number;
  tipo_movimento: "VENDA" | "PRODUCAO" | "PERDA" | "AJUSTE_SAIDA";
  referencia_origem: string;
}

// Tipagem básica para o corpo do Item de Estoque (Criação/Atualização)
interface ItemEstoqueBody {
  nome: string; // CORREÇÃO: Usando 'nome' (Model: ItemEstoque)
  unidade_medida: string;
  is_vendavel: boolean;
  is_pre_pronto: boolean;
  id_unidade: number; // Assumindo que 'id_unidade' existe
  [key: string]: any;
}

class EstoqueItemController {
  private service: EstoqueItemService;
  private sequelize: Sequelize;

  constructor() {
    this.sequelize = connection;
    this.service = new EstoqueItemService(this.sequelize);
  } // --- 1. CRUD Métodos Padrão ---

  public async store(req: Request, res: Response): Promise<Response> {
    try {
      // Usa o método 'create' do service
      const produto = await this.service.create(req.body);
      return res
        .status(201)
        .json({ message: "Item criado com sucesso.", data: produto });
    } catch (error: any) {
      console.error("Erro ao criar item:", error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  public async index(req: Request, res: Response): Promise<Response> {
    try {
      const produtos = await this.service.findAll();
      return res.status(200).json(produtos);
    } catch (error: any) {
      console.error("Erro ao listar itens:", error.message);
      return res
        .status(500)
        .json({ error: "Falha ao listar itens de estoque." });
    }
  }

  public async show(req: Request, res: Response): Promise<Response> {
    const id_produto = parseInt(req.params.id); // 'id' é o parâmetro na rota
    if (isNaN(id_produto))
      return res.status(400).json({ error: "ID inválido." });

    try {
      const produto = await this.service.findById(id_produto);
      if (!produto) {
        return res.status(404).json({ error: "Item não encontrado." });
      }
      return res.status(200).json(produto);
    } catch (error: any) {
      console.error(`Erro ao buscar item ${id_produto}:`, error.message);
      return res.status(500).json({ error: "Falha ao buscar item." });
    }
  }

  public async update(req: Request, res: Response): Promise<Response> {
    const id_produto = parseInt(req.params.id); // 'id' é o parâmetro na rota
    if (isNaN(id_produto))
      return res.status(400).json({ error: "ID inválido." });

    const updates: Partial<ItemEstoqueBody> = req.body;

    try {
      const produtoAtualizado = await this.service.update(id_produto, updates);

      return res.status(200).json({
        message: "Item atualizado com sucesso.",
        data: produtoAtualizado,
      });
    } catch (error: any) {
      console.error(`Erro ao atualizar item ${id_produto}:`, error.message);
      return res.status(500).json({ error: error.message });
    }
  } // --- 2. Lógica de Movimentação de Estoque ---

  public async receberEstoque(req: Request, res: Response): Promise<Response> {
    const id_produto = parseInt(req.params.id); // ID do Path
    if (isNaN(id_produto))
      return res.status(400).json({ error: "ID do item inválido na rota." });

    const body: ReceberEstoqueBody = req.body;

    const dataParaService = { ...body, id_produto };

    if (
      !dataParaService.id_produto ||
      !dataParaService.quantidade ||
      !dataParaService.custo_unitario ||
      !dataParaService.colaborador_id ||
      !dataParaService.tipo_movimento ||
      !dataParaService.referencia_origem
    ) {
      return res.status(400).json({
        error:
          "Campos obrigatórios faltando: quantidade, custo_unitario, colaborador_id, tipo_movimento ou referencia_origem.",
      });
    }

    try {
      const itemAtualizado = await this.service.receberEstoque(dataParaService);
      return res.status(200).json({
        message:
          "Entrada de estoque registrada com sucesso. Saldo e CMP atualizados.",
        data: itemAtualizado,
      });
    } catch (error: any) {
      console.error("Erro ao registrar entrada de estoque:", error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  public async saidaEstoque(req: Request, res: Response): Promise<Response> {
    const id_produto = parseInt(req.params.id); // ID do Path
    if (isNaN(id_produto))
      return res.status(400).json({ error: "ID do item inválido na rota." });
    const body: SaidaEstoqueBody = req.body;

    const dataParaService = { ...body, id_produto };

    if (
      !dataParaService.id_produto ||
      !dataParaService.quantidade ||
      !dataParaService.colaborador_id ||
      !dataParaService.tipo_movimento ||
      !dataParaService.referencia_origem
    ) {
      return res.status(400).json({
        error:
          "Campos obrigatórios faltando: quantidade, colaborador_id, tipo_movimento ou referencia_origem.",
      });
    }

    try {
      const { produto, custo_saida } = await this.service.saidaEstoque(
        dataParaService
      );

      return res.status(200).json({
        message: `Saída de estoque registrada com sucesso. Custo de Saída (CMV): R$ ${custo_saida}`,
        data: produto,
        custo_saida_calculado: custo_saida,
      });
    } catch (error: any) {
      console.error("Erro ao registrar saída de estoque:", error.message);
      return res.status(500).json({ error: error.message });
    }
  }
}

export default new EstoqueItemController();
