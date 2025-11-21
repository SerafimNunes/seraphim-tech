import { Transaction } from 'sequelize';
import ItemEstoque, { ItemEstoqueModel } from '../models/ItemEstoque';
import EstoqueRegistroMovimento, {
  EstoqueRegistroMovimentoCreationAttributes,
  TipoMovimentoEstoque,
} from '../models/EstoqueRegistroMovimento';
import { EstoqueMovimentoService } from './EstoqueMovimentoService'; // Assumindo que você usa este service

// 🔑 NOVO: Definição do Tipo de Retorno (para saidaEstoque)
export interface SaidaEstoqueResult {
  custo_saida: number;
}

// 🔑 NOVO: Definição do Tipo de Payload para reuso (resolve erro TS2305)
export interface MovimentoPayload {
  id_produto: number;
  quantidade: number;
  unidade_id: number;
  tipo_movimento: TipoMovimentoEstoque;
  custo_unitario: number;
  referencia_documento: string;
  id_origem: number | null;
  tipo_origem: string | null;
}

export class EstoqueService {
  private estoqueMovimentoService: EstoqueMovimentoService;

  constructor() {
    this.estoqueMovimentoService = new EstoqueMovimentoService();
  } /**
   * 🔑 CORREÇÃO: Implementa o método 'saidaEstoque' que outras classes esperam.
   * @returns {SaidaEstoqueResult} Retorna o custo total da saída (CMV).
   */

  public async saidaEstoque(
    itemEstoque: ItemEstoqueModel, // ItemEstoque (Model)
    quantidade: number,
    unidadeId: number, // 🔑 R4: Adicionado (3º Argumento na maioria dos serviços)
    tipoMovimento: TipoMovimentoEstoque, // Ex: 'SAIDA_VENDA', 'CONSUMO_PRODUCAO'
    descricao: string, // Este argumento é ignorado aqui, mas esperado nos Services chamadores
    referenciaDocumento: string,
    colaboradorId: number,
    transaction: Transaction,
  ): Promise<SaidaEstoqueResult> {
    const custoUnitarioSaida = itemEstoque.preco_custo_unitario; // Usa o CMP atual
    const custoTotalSaida = quantidade * custoUnitarioSaida; // 1. Registro do movimento de SAÍDA

    const registroMovimento: EstoqueRegistroMovimentoCreationAttributes = {
      id_produto: itemEstoque.id_produto,
      unidade_id: unidadeId,
      tipo_movimento: tipoMovimento,
      quantidade: quantidade * -1, // Saídas são negativas
      custo_unitario: custoUnitarioSaida,
      custo_total: custoTotalSaida,
      data_movimento: new Date(),
      referencia_documento: referenciaDocumento,
      id_origem: colaboradorId,
      tipo_origem: 'COLABORADOR', // Exemplo
    };

    await this.estoqueMovimentoService.registrarMovimento(
      registroMovimento,
      transaction,
    ); // Nota: A atualização do ItemEstoque deve ocorrer antes, com lock.
    // Se a lógica de atualização do ItemEstoque estiver em outro lugar (ex: um service de ItemEstoque)
    // você deve garantir que ela seja chamada.

    return { custo_saida: custoTotalSaida };
  } /**
   * 🔑 CORREÇÃO: Implementa o método 'entradaEstoque' que outras classes esperam.
   */

  public async entradaEstoque(
    itemEstoque: ItemEstoqueModel, // ItemEstoque (Model)
    quantidade: number,
    custoUnitario: number,
    unidadeId: number, // 🔑 R4: Adicionado (4º Argumento na maioria dos serviços)
    tipoMovimento: TipoMovimentoEstoque, // Ex: 'ENTRADA', 'AJUSTE_ENTRADA'
    descricao: string, // Este argumento é ignorado aqui, mas esperado nos Services chamadores
    referenciaDocumento: string,
    colaboradorId: number,
    transaction: Transaction,
  ): Promise<ItemEstoqueModel> {
    // 1. Registro do movimento de ENTRADA
    const custoTotal = quantidade * custoUnitario;
    const registroMovimento: EstoqueRegistroMovimentoCreationAttributes = {
      id_produto: itemEstoque.id_produto,
      unidade_id: unidadeId,
      tipo_movimento: tipoMovimento,
      quantidade: quantidade,
      custo_unitario: custoUnitario,
      custo_total: custoTotal,
      data_movimento: new Date(),
      referencia_documento: referenciaDocumento,
      id_origem: colaboradorId,
      tipo_origem: 'COLABORADOR', // Exemplo
    };

    await this.estoqueMovimentoService.registrarMovimento(
      registroMovimento,
      transaction,
    ); // Retorna o ItemEstoque (assumindo que o ItemEstoque real foi atualizado antes/depois)

    return itemEstoque;
  }
}

// 🔑 CORREÇÃO TS2459 e TS2305: Exporta os tipos para outras classes
export { TipoMovimentoEstoque };
