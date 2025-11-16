// src/tests/vendas.caixa.test.ts

/// <reference types="jest" /> // 🔑 Adiciona referência para tipos Jest

// 1. Importa os Services
import VendaComandaService from "../services/VendaComandaService";
import { EstoqueService } from "../services/EstoqueService";
import LancamentoService from "../services/LancamentoService";
import CaixaService from "../services/CaixaService";

// 2. 🔑 CORREÇÃO TS2339 (Tipagem de Mocks):
// Declara as classes como Mocks Tipados para que o TS reconheça os métodos do prototype.
const MockEstoqueService = EstoqueService as jest.MockedClass<
  typeof EstoqueService
>;
const MockLancamentoService = LancamentoService as jest.MockedClass<
  typeof LancamentoService
>;
const MockCaixaService = CaixaService as jest.MockedClass<typeof CaixaService>;

// 3. MOCKS dos Services (Mockando classes inteiras, por isso a necessidade de tipar)
jest.mock("../services/EstoqueService");
jest.mock("../services/LancamentoService");
jest.mock("../services/CaixaService");

// Mocks de Models (simular retorno de dados sem BD real)
const mockVendaComandaModel = {
  findByPk: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
  $get: jest.fn(),
};

describe("Fluxo Transacional Venda e Caixa (R2, R3, R4)", () => {
  let vendaService: VendaComandaService;
  let caixaService: CaixaService;

  beforeAll(() => {
    // 🔑 CORREÇÃO TS2554: Inicializa com instâncias (não mockadas para este test)
    vendaService = new VendaComandaService();
    caixaService = new CaixaService();

    // Injeção de Mocks de Models/Dependências
    (vendaService as any).vendaComandaModel = mockVendaComandaModel;
    (vendaService as any).vendaItemService = { registrarItem: jest.fn() };

    // 🔑 Uso da INSTÂNCIA mockada de LancamentoService
    (vendaService as any).lancamentoService = new MockLancamentoService();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("R2/R3: Deve fechar a comanda, registrar débito no estoque e calcular CMV", async () => {
    const comandaId = 1;
    const caixaAbertoId = 10;
    const valorTotal = 150.0;
    const custoCMV = 50.0;
    const colaboradorIdFechamento = 2; // Argumento extra

    // MOCK: Simula a comanda aberta com os itens
    mockVendaComandaModel.findByPk.mockResolvedValue({
      id_comanda: comandaId,
      status: "ABERTA",
      id_caixa: caixaAbertoId,
      colaborador_id_abertura: 1,
      valor_total: valorTotal,
      cmv_total: 0,
      itens: [{ id_produto: 101, quantidade: 2, valor_unitario: 75 }],
      update: mockVendaComandaModel.update,
      toJSON: () => ({
        id_comanda: comandaId,
        id_caixa: caixaAbertoId,
        valor_total: valorTotal,
        cmv_total: custoCMV,
      }),
      $get: jest.fn().mockResolvedValue([{ id_produto: 101, quantidade: 2 }]),
    });

    // MOCK: Simula o cálculo do CMV pelo serviço de Vendas (R3)
    (vendaService as any).calcularCmv = jest.fn().mockResolvedValue(custoCMV);

    const fecharPayload = {
      metodo_pagamento: "PIX",
    };

    // 🔑 CORREÇÃO TS2554: Adiciona o quarto argumento 'id_caixa'
    await vendaService.fecharComanda(
      comandaId,
      fecharPayload as any,
      colaboradorIdFechamento,
      caixaAbertoId // ⬅️ NOVO: ID do caixa adicionado aqui
    );

    expect((vendaService as any).calcularCmv).toHaveBeenCalledWith(
      comandaId,
      expect.anything()
    );

    // 🔑 CORREÇÃO TS2339: Uso de MockEstoqueService
    expect(MockEstoqueService.prototype.registrarBaixa).toHaveBeenCalled();

    // Assertiva 3: Deve registrar o lançamento de RECEITA no Financeiro
    // 🔑 CORREÇÃO TS2339: Uso de MockLancamentoService
    expect(
      MockLancamentoService.prototype.registrarLancamento
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        id_caixa: caixaAbertoId,
        tipo_lancamento: "RECEITA",
        valor: valorTotal,
        tipo_origem: "VENDA",
      }),
      expect.anything()
    );

    // Assertiva 4: A comanda deve ser marcada como FECHADA
    expect(mockVendaComandaModel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "FECHADA",
        cmv_total: custoCMV,
        colaborador_id_fechamento: colaboradorIdFechamento,
      }),
      expect.anything()
    );
  });

  it("R4: Deve abrir e fechar o caixa corretamente, registrando a movimentação no Financeiro", async () => {
    const saldoInicial = 100.0;
    const colaboradorId = 1;
    const caixaId = 1;
    const colaboradorIdFechamento = 2;

    // 1. Abertura
    const mockCaixaModel = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id_caixa: caixaId,
        toJSON: () => ({ id_caixa: caixaId, saldo_inicial: saldoInicial }),
      }),
    };
    // 🔑 Mocka a dependência do Service
    (caixaService as any).caixaModel = mockCaixaModel;

    // 🔑 CORREÇÃO TS2345: O argumento esperado é o payload completo, não um number,
    // garantindo a coerência com o fluxo.
    await caixaService.abrirCaixa({
      saldo_inicial: saldoInicial,
      colaborador_id_abertura: colaboradorId,
    });

    // 🔑 CORREÇÃO TS2339: Uso de MockLancamentoService
    expect(
      MockLancamentoService.prototype.registrarLancamento
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        id_caixa: caixaId,
        tipo_lancamento: "REFORCO",
        valor: saldoInicial,
      }),
      expect.anything()
    );

    // 2. Fechamento
    const saldoFinal = 500.0;
    const mockCaixaAberto = {
      id_caixa: caixaId,
      status: "ABERTO",
      colaborador_id_fechamento: null,
      valor_final: null,
      update: jest.fn(),
      // 🔑 Mocka o método interno para simular o valor final
      calcularValorFinal: jest.fn().mockResolvedValue(saldoFinal),
    };
    mockCaixaModel.findOne.mockResolvedValue(mockCaixaAberto);

    // O CaixaService usa o LancamentoService para calcular o saldo final
    // 🔑 CORREÇÃO TS2339: MockLancamentoService.prototype
    (
      MockLancamentoService.prototype.calcularSaldoTotalDoCaixa as jest.Mock
    ).mockResolvedValue(saldoFinal);

    // A chamada da função está correta
    await caixaService.fecharCaixa(caixaId, colaboradorIdFechamento);

    // 🔑 CORREÇÃO TS2339: Uso de MockLancamentoService
    expect(
      MockLancamentoService.prototype.calcularSaldoTotalDoCaixa
    ).toHaveBeenCalledWith(caixaId);

    expect(mockCaixaAberto.update).toHaveBeenCalledWith(
      expect.objectContaining({
        valor_final: saldoFinal,
        status: "FECHADO",
        colaborador_id_fechamento: colaboradorIdFechamento,
      }),
      expect.anything()
    );
  });
});
