// src/tests/estoque.flow.test.ts

/// <reference types="jest" /> // Adiciona referência para tipos Jest

// 1. Importa as classes de Serviço
import { ComprasPedidoService } from "../services/ComprasPedidoService";
import { EstoqueService } from "../services/EstoqueService";
import { ProducaoService } from "../services/ProducaoService";
import ItemEstoque from "../models/ItemEstoque"; // Model Sequelize

// 2. 🔑 CORREÇÃO TS2339 (Tipagem de Mocks):
// Declaramos as classes como Mocks Tipados.
const MockEstoqueService = EstoqueService as jest.MockedClass<
  typeof EstoqueService
>;
const MockProducaoService = ProducaoService as jest.MockedClass<
  typeof ProducaoService
>;

// 3. MOCKS para isolar os Services e Models
jest.mock("../services/EstoqueService");
jest.mock("../services/ProducaoService"); // ⬅️ Mock adicionado
jest.mock("../models/ItemEstoque");

// Mock FiscalService, que é uma dependência de ComprasPedidoService
const mockFiscalService = {
  createAutomaticFiscalRecord: jest.fn(),
  monitorarEnquadramentoFiscal: jest.fn(),
};

// Mock para simular o ComprasPedidoModel no Service
const mockPedidoModel = {
  findByPk: jest.fn(),
};

describe("Fluxo Transacional de Estoque (R2, R3, R7)", () => {
  let comprasService: ComprasPedidoService;
  let producaoService: ProducaoService;

  beforeEach(() => {
    jest.clearAllMocks();

    comprasService = new ComprasPedidoService(mockFiscalService as any);
    // Injeta o mock do Model de Pedido
    (comprasService as any).pedidoModel = mockPedidoModel;

    // A instância real da ProducaoService é criada para testar a chamada interna
    producaoService = new ProducaoService();

    // Acessa o método estático mockado do Model
    (ItemEstoque.findOne as jest.Mock).mockResolvedValue({
      id_produto: 1,
      saldo_atual: 100,
      cmp: 10.0,
      update: jest.fn(), // Mocka o método update
    });
  });

  it("R3: Deve recalcular o CMP corretamente após o recebimento de compra", async () => {
    const mockPedido = {
      id_pedido: 5,
      status_aprovacao: "APROVADO",
      get: () => ({ id_pedido: 5 }),
      update: jest.fn(),
      $get: jest.fn().mockResolvedValue([
        {
          id_item_pedido: 1,
          id_produto: 1,
          quantidade_prevista: 100,
          preco_custo_unitario_previsto: 10.0,
          update: jest.fn(),
        },
      ]),
    };

    const payloadRecebimento = {
      id_pedido: 5,
      numero_documento: "NF123",
      data_emissao: new Date().toISOString(),
      itens_recebidos: [
        {
          id_item_pedido: 1,
          quantidade_recebida: 50,
          preco_custo_unitario_real: 12.0,
          status_qualidade: "APROVADO" as "APROVADO",
        },
      ],
    };

    const novoCmpEsperado = 10.67;

    // 🔑 CORREÇÃO TS2339: Uso de MockEstoqueService
    (
      MockEstoqueService.prototype.updateCmpAndRegisterCredit as jest.Mock
    ).mockResolvedValue(novoCmpEsperado);

    mockPedidoModel.findByPk.mockResolvedValue(mockPedido);

    await comprasService.receberPedido(payloadRecebimento as any);

    // 🔑 CORREÇÃO TS2339: Uso de MockEstoqueService
    expect(
      MockEstoqueService.prototype.updateCmpAndRegisterCredit
    ).toHaveBeenCalledWith(1, 50, 12.0, "COMPRA", expect.anything());
    expect(mockFiscalService.createAutomaticFiscalRecord).toHaveBeenCalled();
  });

  it("R7/R2: Deve registrar descartes e colaboradores e realizar a movimentação de estoque correta", async () => {
    // 1. Cenário: Finalização de Lote
    const insumosDebito = [
      { id_produto: 10, quantidade: 5 },
      { id_produto: 11, quantidade: 10 },
    ];
    const produtoFinalId = 100;
    const qtdProduzida = 50;

    // MOCK: Simula a obtenção de insumos (método interno/auxiliar)
    jest
      .spyOn(producaoService as any, "getInsumosParaLote")
      .mockResolvedValue(insumosDebito);

    await producaoService.finalizarLote(1, produtoFinalId, qtdProduzida);

    // Assertiva R2 - Débito (Insumos)
    // 🔑 CORREÇÃO TS2339: Uso de MockEstoqueService
    expect(MockEstoqueService.prototype.registrarBaixa).toHaveBeenCalledTimes(
      insumosDebito.length
    );
    // 🔑 CORREÇÃO TS2339: Uso de MockEstoqueService
    expect(MockEstoqueService.prototype.registrarBaixa).toHaveBeenCalledWith(
      10,
      5,
      "PRODUCAO",
      expect.anything()
    );

    // Assertiva R2 - Crédito (Produto Final)
    // 🔑 CORREÇÃO TS2339: Uso de MockEstoqueService
    expect(MockEstoqueService.prototype.registrarCredito).toHaveBeenCalledWith(
      produtoFinalId,
      qtdProduzida,
      "PRODUCAO",
      expect.anything()
    );

    // 2. Cenário: Registro de Descarte (R7)
    const payloadRegistro = {
      loteId: 1,
      colaboradores: [1, 2],
      descartes: 5,
    };

    // MOCK: Injeta o mock do Model de Registro no Service
    (producaoService as any).producaoRegistroModel = {
      create: jest.fn().mockResolvedValue({
        descartes: 5,
        quem_produziu: JSON.stringify([1, 2]),
        toJSON: () => ({ descartes: 5, quem_produziu: [1, 2] }),
      }),
    };

    const registro = await producaoService.registrarLote(
      payloadRegistro as any
    );
    expect(registro.descartes).toBe(5);
  });
});
