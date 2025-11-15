// src/tests/VendaItemService.test.ts

import { VendaItemService } from "../services/VendaItemService";
import { EstoqueService } from "../services/EstoqueService";
import VendaComanda from "../models/VendaComanda";
import ItemEstoque from "../models/ItemEstoque";
import VendaItem from "../models/VendaItem";
import { connection } from "../config/sequelize";

// Mock dos serviços e modelos
jest.mock("../services/EstoqueService");
jest.mock("../models/VendaComanda");
jest.mock("../models/ItemEstoque");
jest.mock("../models/VendaItem");

const mockTransaction = {
  commit: jest.fn(),
  rollback: jest.fn(),
  LOCK: {
    UPDATE: "UPDATE",
  },
};

// @ts-ignore
connection.transaction = jest.fn().mockResolvedValue(mockTransaction);

describe("VendaItemService", () => {
  let vendaItemService: VendaItemService;
  let mockEstoqueService: jest.Mocked<EstoqueService>;

  beforeEach(() => {
    // Resetar mocks antes de cada teste
    jest.clearAllMocks();

    vendaItemService = new VendaItemService();
    // Acessa a instância mockada que foi criada pelo jest.mock
    mockEstoqueService = (EstoqueService as jest.Mock<EstoqueService>).mock
      .results[0].value;
  });

  it("deve adicionar um item, dar baixa no estoque e atualizar os totais da venda", async () => {
    // Arrange: Configuração do cenário
    const payload = {
      id_venda: 1,
      id_produto: 10,
      quantidade: 2,
      colaborador_id: 1,
    };

    const mockVenda = {
      id_venda: 1,
      status_venda: "ABERTA",
      valor_total: 100,
      custo_total: 40,
      update: jest.fn().mockResolvedValue(this),
    };

    const mockProduto = {
      id_produto: 10,
      is_vendavel: true,
      preco_venda: 25.0,
    };

    // @ts-ignore
    VendaComanda.findByPk.mockResolvedValue(mockVenda);
    // @ts-ignore
    ItemEstoque.findByPk.mockResolvedValue(mockProduto);
    // @ts-ignore
    VendaItem.create.mockResolvedValue({ id_item_venda: 1, ...payload });

    // Mock da baixa de estoque retornando o custo da saída
    mockEstoqueService.saidaEstoque.mockResolvedValue({
      custo_saida: 20.0, // Custo total para 2 unidades
      produto: mockProduto as any,
    });

    // Act: Execução da função
    await vendaItemService.adicionarItem(payload);

    // Assert: Verificações
    expect(EstoqueService).toHaveBeenCalledTimes(1);
    expect(mockEstoqueService.saidaEstoque).toHaveBeenCalledTimes(1);
    expect(mockEstoqueService.saidaEstoque).toHaveBeenCalledWith(
      expect.anything(), // o objeto do produto
      payload.quantidade, // a quantidade
      expect.any(String), // a observação
      expect.any(String), // a referência
      expect.any(Object) // a transação
    );

    // Verifica se a venda foi atualizada com os valores corretos
    expect(mockVenda.update).toHaveBeenCalledWith(
      {
        valor_total: 150, // 100 (inicial) + (2 * 25.0)
        custo_total: 60, // 40 (inicial) + 20 (custo_saida)
      },
      { transaction: mockTransaction }
    );

    // Garante que a transação foi commitada
    expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
    expect(mockTransaction.rollback).not.toHaveBeenCalled();
  });
});
