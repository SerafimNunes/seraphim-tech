import { Sequelize, Transaction, Op } from 'sequelize';
import VendaComanda, { VendaComandaAttributes } from '../models/VendaComanda';
import VendaMesa from '../models/VendaMesa';
// 🔑 Integração Caixa
import LancamentoService from './LancamentoService';
import Caixa from '../models/Caixa';

import RegistroFiscal from '../models/RegistroFiscal';
import { RegistroFiscalAttributes } from '../models/RegistroFiscal'; // Importação para tipagem
import Decimal from 'decimal.js';
import { connection } from '../config/sequelize';

// Tipagem para a função Abrir (R4 Adicionada)
interface AbrirComandaData {
  colaborador_id_abertura: number;
  id_mesa: number | null;
  // 🔑 R4 CORRIGIDO: Adicionando o campo obrigatório
  unidade_id: number;
}

// Tipagem para a função Fechar (R4 Adicionada)
interface FecharComandaData {
  id_venda: number;
  metodo_pagamento: string;
  colaborador_id_fechamento: number;
  id_caixa: number;
  // 🔑 R4 CORRIGIDO: Adicionando o campo obrigatório
  unidade_id: number;
}

export default class VendaComandaService {
  private lancamentoService: LancamentoService;

  constructor() {
    // 1.A: Injeção de Dependência
    this.lancamentoService = new LancamentoService();
  }

  public async abrirComanda(
    data: AbrirComandaData,
  ): Promise<VendaComandaAttributes> {
    // 1.D: Transação obrigatória
    return connection.transaction(async (t: Transaction) => {
      const { colaborador_id_abertura, id_mesa, unidade_id } = data; // 🔑 R4 CORRIGIDO: Destruturando unidade_id
      // 1. Validação prévia da Mesa (Com R4)

      if (id_mesa) {
        const mesa = await VendaMesa.findOne({
          where: { id_mesa, unidade_id }, // 🔑 R4: Filtra a mesa pela unidade
          transaction: t,
        });
        if (!mesa || mesa.status_mesa !== 'LIVRE') {
          throw new Error(
            `Mesa ID ${id_mesa} não está livre, não existe ou pertence a outra unidade.`,
          );
        }
      } // 2. Cria a Venda/Comanda

      const novaVenda = await VendaComanda.create(
        {
          id_mesa,
          colaborador_id_abertura,
          unidade_id, // 🔑 R4 CORRIGIDO: Injetando unidade_id
          status_venda: 'ABERTA',
          valor_total: 0,
          custo_total: 0,
        },
        { transaction: t },
      ); // 3. Se for em mesa, atualiza o status da mesa

      if (id_mesa) {
        await VendaMesa.update(
          {
            status_mesa: 'OCUPADA',
            colaborador_id_responsavel: colaborador_id_abertura,
            data_abertura: new Date(),
            id_venda_atual: novaVenda.id_venda,
          },
          {
            where: { id_mesa: id_mesa, unidade_id: unidade_id }, // 🔑 R4: Filtra a mesa pela unidade
            transaction: t,
          },
        );
      }

      return novaVenda.toJSON() as VendaComandaAttributes;
    });
  }

  public async fecharComanda(
    data: FecharComandaData, // 🔑 R4 CORRIGIDO: Usando o objeto tipado
  ): Promise<VendaComandaAttributes> {
    // 1.D: Transação obrigatória
    return connection.transaction(async (t: Transaction) => {
      const {
        id_venda,
        metodo_pagamento,
        colaborador_id_fechamento,
        id_caixa,
        unidade_id,
      } = data; // 🔑 R4 CORRIGIDO: Destruturando unidade_id
      // 1. Busca a Venda (com lock de atualização)

      const venda = await VendaComanda.findOne({
        where: { id_venda, unidade_id }, // 🔑 R4: Filtra a venda pela unidade
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!venda) {
        throw new Error(
          `Comanda ID ${id_venda} não encontrada ou pertence a outra unidade.`,
        );
      }

      if (venda.status_venda !== 'ABERTA') {
        throw new Error(
          `Comanda ID ${id_venda} não está aberta (Status: ${venda.status_venda}).`,
        );
      }
      // 🔑 Valida se o unidade_id na Venda coincide com o da requisição (Segurança)
      if (venda.unidade_id !== unidade_id) {
        throw new Error(
          'Falha de segurança R4: A venda pertence a outra unidade.',
        );
      } // 2. Valida o Caixa Ativo

      const caixa = await Caixa.findOne({
        where: { id_caixa, unidade_id }, // 🔑 R4: Filtra o caixa pela unidade
        transaction: t,
      });
      if (!caixa || caixa.status_caixa !== 'ABERTO') {
        throw new Error(
          `Caixa ID ${id_caixa} não encontrado, não está aberto ou pertence a outra unidade.`,
        );
      }

      const valorTotalVenda = new Decimal(venda.valor_total || 0); // 3. Atualiza a Comanda (Venda) para FECHADA

      const updateData: Partial<VendaComandaAttributes> = {
        status_venda: 'FECHADA',
        data_fechamento: new Date(),
        metodo_pagamento: metodo_pagamento,
        colaborador_id_fechamento: colaborador_id_fechamento,
        id_caixa: id_caixa,
      };

      await venda.update(updateData, { transaction: t }); // 4. Cria o Lançamento de Receita no Caixa (Integração Financeira)

      await this.lancamentoService.registrarLancamento(
        {
          id_caixa: id_caixa,
          unidade_id: unidade_id, // 🔑 R4 CORRIGIDO: Passando unidade_id
          colaborador_id: colaborador_id_fechamento,
          tipo_lancamento: 'RECEITA',
          valor: valorTotalVenda.toNumber(),
          descricao: `Venda ID ${id_venda} - Pagamento: ${metodo_pagamento}`,
          categoria: 'VENDAS',
          id_origem: id_venda,
          tipo_origem: 'VENDA',
        },
        t,
      ); // 5. Libera a Mesa (se for uma venda de mesa)

      if (venda.id_mesa) {
        await VendaMesa.update(
          {
            status_mesa: 'LIVRE',
            colaborador_id_responsavel: null,
            data_abertura: null,
            id_venda_atual: null,
          },
          {
            where: { id_mesa: venda.id_mesa, unidade_id: unidade_id }, // 🔑 R4: Filtra a mesa pela unidade
            transaction: t,
          },
        );
      } // 6. Cria o Registro Fiscal (Log de Faturamento)

      const impostoCalculado = valorTotalVenda.times(0.04).toDP(2).toNumber();

      await RegistroFiscal.create(
        {
          // CAMPOS OBRIGATÓRIOS
          unidade_id: unidade_id, // 🔑 R4 CORRIGIDO: Usando unidade_id da requisição (Seguro)
          tipo_registro: 'SAIDA_VENDA', // CAMPOS EXISTENTES

          id_origem: venda.id_venda,
          tipo_origem: 'VENDA',
          numero_documento: `VENDA-${venda.id_venda}`,
          data_emissao: new Date(),
          valor_total_documento: valorTotalVenda.toNumber(),
          imposto_simples: impostoCalculado,
          cst_cfop_padrao: '5102',
          observacoes_fisco: `Registro Fiscal gerado na conclusão da Venda ID ${venda.id_venda}.`,
        } as RegistroFiscalAttributes,
        { transaction: t },
      );

      return venda.toJSON() as VendaComandaAttributes;
    });
  }

  public async buscarComandasAtivas(
    unidade_id: number,
  ): Promise<VendaComandaAttributes[]> {
    // 🔑 R4: Adicionando unidade_id
    const comandas = await VendaComanda.findAll({
      where: {
        status_venda: { [Op.in]: ['ABERTA', 'AGUARDANDO_PAGAMENTO'] },
        unidade_id: unidade_id, // 🔑 R4 CORRIGIDO: Filtra pela Unidade
      },
    });
    return comandas.map((c) => c.toJSON() as VendaComandaAttributes);
  }

  public async buscarHistoricoVendas(
    unidade_id: number,
  ): Promise<VendaComandaAttributes[]> {
    // 🔑 R4: Adicionando unidade_id
    const historico = await VendaComanda.findAll({
      where: {
        status_venda: { [Op.in]: ['FECHADA', 'CANCELADA'] },
        unidade_id: unidade_id, // 🔑 R4 CORRIGIDO: Filtra pela Unidade
      },
      order: [['data_fechamento', 'DESC']],
      limit: 100,
    });
    return historico.map((c) => c.toJSON() as VendaComandaAttributes);
  }

  public async buscarComandaPorId(
    id_venda: number,
    unidade_id: number, // 🔑 R4: Adicionando unidade_id
  ): Promise<VendaComandaAttributes | null> {
    const comanda = await VendaComanda.findOne({
      where: { id_venda, unidade_id }, // 🔑 R4 CORRIGIDO: Filtra pela Unidade
    });
    return comanda ? (comanda.toJSON() as VendaComandaAttributes) : null;
  }
}
