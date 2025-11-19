// src/models/CompraNecessidade.ts

import { DataTypes, Model, Optional, ModelCtor } from 'sequelize';
import { connection } from '../config/sequelize';
import { IModelFactory } from '../config/types';

// Associações necessárias (assumindo ItemEstoque e ProducaoNecessidade já existem)
import { ItemEstoqueModel } from './ItemEstoque';
import { ProducaoNecessidadeModel } from './ProducaoNecessidade'; // Novo modelo
// import { ComprasPedidoModel } from "./ComprasPedido"; // Para rastrear o atendimento

type OrigemNecessidade = 'PRODUCAO' | 'ESTOQUE_MINIMO' | 'MANUAL';

// --- GPR-2: Interfaces de Tipagem ---
export interface CompraNecessidadeAttributes {
  id_necessidade_compra: number; // GPR-5: Padrão de Chave Primária
  unidade_id: number; // GPR-1: Conformidade R4 (Multi-Unidade)
  id_produto: number; // Insumo/Matéria-prima que precisa ser comprada
  quantidade_solicitada: number;
  origem: OrigemNecessidade;
  id_origem_referencia: number | null; // ID do ProducaoNecessidade ou do Pedido de Venda
  data_solicitacao: Date;
  colaborador_id_solicitante: number;
  data_limite_atendimento: Date | null;
  status_atendimento: 'PENDENTE' | 'PARCIAL' | 'ATENDIDA' | 'CANCELADA';
  observacoes: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CompraNecessidadeCreationAttributes
  extends Optional<
    CompraNecessidadeAttributes,
    | 'id_necessidade_compra'
    | 'id_origem_referencia'
    | 'data_limite_atendimento'
    | 'status_atendimento'
    | 'observacoes'
    | 'createdAt'
    | 'updatedAt'
  > {}

export interface CompraNecessidadeModel
  extends Model<
      CompraNecessidadeAttributes,
      CompraNecessidadeCreationAttributes
    >,
    CompraNecessidadeAttributes {
  produto?: ItemEstoqueModel;
  // Possível associação com ComprasPedido
  // origemProducao?: ProducaoNecessidadeModel; // Se origem for 'PRODUCAO'
}

// --- Definição do Modelo Sequelize ---
const CompraNecessidade: ModelCtor<CompraNecessidadeModel> =
  connection.define<CompraNecessidadeModel>(
    'CompraNecessidade',
    {
      id_necessidade_compra: {
        type: DataTypes.INTEGER,
        primaryKey: true, // GPR-5
        autoIncrement: true, // GPR-5
      },
      unidade_id: {
        type: DataTypes.INTEGER,
        allowNull: false, // GPR-1
        comment: 'ID da Unidade de negócio (Regra R4)',
      },
      id_produto: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      quantidade_solicitada: {
        type: DataTypes.DECIMAL(10, 3), // GPR-4: Quantidade crítica
        allowNull: false,
        get() {
          // GPR-4: Tratamento de Decimais
          return parseFloat(
            this.getDataValue('quantidade_solicitada') as unknown as string,
          );
        },
      },
      origem: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      id_origem_referencia: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'ID de ProducaoNecessidade ou outro item de origem',
      },
      data_solicitacao: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      colaborador_id_solicitante: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      data_limite_atendimento: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      status_atendimento: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'PENDENTE',
      },
      observacoes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'PLANEJAMENTO_COMPRA',
      timestamps: true,
      modelName: 'CompraNecessidade',
    },
  );

// --- GPR-3: Associação Explícita ---
(CompraNecessidade as any).associate = (models: IModelFactory) => {
  CompraNecessidade.belongsTo(
    models.ItemEstoque as ModelCtor<ItemEstoqueModel>,
    {
      foreignKey: 'id_produto',
      as: 'produto',
    },
  );

  // Associação condicional se a origem for PRODUCAO
  CompraNecessidade.belongsTo(
    models.ProducaoNecessidade as ModelCtor<ProducaoNecessidadeModel>,
    {
      foreignKey: 'id_origem_referencia',
      as: 'origemProducao',
      // Adicionar scope para 'PRODUCAO' seria feito no Service
    },
  );
};

export default CompraNecessidade;
