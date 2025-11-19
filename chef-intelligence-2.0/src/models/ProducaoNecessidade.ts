// src/models/ProducaoNecessidade.ts

import { DataTypes, Model, Optional, ModelCtor } from 'sequelize';
import { connection } from '../config/sequelize';
import { IModelFactory } from '../config/types';

// Associações necessárias (assumindo ItemEstoque e Colaborador já existem)
import { ItemEstoqueModel } from './ItemEstoque';
// import { ColaboradorModel } from "./Colaborador"; // Assumindo que o Colaborador existe

type TipoNecessidade = 'PREVISAO_VENDA' | 'PEDIDO_CLIENTE' | 'ESTOQUE_MINIMO';

// --- GPR-2: Interfaces de Tipagem ---
export interface ProducaoNecessidadeAttributes {
  id_necessidade: number; // GPR-5: Padrão de Chave Primária
  unidade_id: number; // GPR-1: Conformidade R4 (Multi-Unidade)
  id_produto: number; // Produto final que precisa ser produzido
  quantidade_necessaria: number;
  tipo_necessidade: TipoNecessidade;
  data_necessidade: Date;
  colaborador_id_registro: number;
  observacoes: string | null;
  status_atendimento: 'PENDENTE' | 'PARCIAL' | 'ATENDIDA' | 'CANCELADA';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProducaoNecessidadeCreationAttributes
  extends Optional<
    ProducaoNecessidadeAttributes,
    | 'id_necessidade'
    | 'observacoes'
    | 'status_atendimento'
    | 'createdAt'
    | 'updatedAt'
  > {}

export interface ProducaoNecessidadeModel
  extends Model<
      ProducaoNecessidadeAttributes,
      ProducaoNecessidadeCreationAttributes
    >,
    ProducaoNecessidadeAttributes {
  produto?: ItemEstoqueModel;
  // registroPor?: ColaboradorModel;
}

// --- Definição do Modelo Sequelize ---
const ProducaoNecessidade: ModelCtor<ProducaoNecessidadeModel> =
  connection.define<ProducaoNecessidadeModel>(
    'ProducaoNecessidade',
    {
      id_necessidade: {
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
      quantidade_necessaria: {
        type: DataTypes.DECIMAL(10, 3), // GPR-4: Quantidade crítica
        allowNull: false,
        get() {
          // GPR-4: Tratamento de Decimais
          return parseFloat(
            this.getDataValue('quantidade_necessaria') as unknown as string,
          );
        },
      },
      tipo_necessidade: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      data_necessidade: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      colaborador_id_registro: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      observacoes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status_atendimento: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'PENDENTE',
      },
    },
    {
      tableName: 'PLANEJAMENTO_PRODUCAO',
      timestamps: true,
      modelName: 'ProducaoNecessidade',
    },
  );

// --- GPR-3: Associação Explícita ---
(ProducaoNecessidade as any).associate = (models: IModelFactory) => {
  ProducaoNecessidade.belongsTo(
    models.ItemEstoque as ModelCtor<ItemEstoqueModel>,
    {
      foreignKey: 'id_produto',
      as: 'produto',
    },
  );

  // Assumindo que a associação com Colaborador será implementada quando o modelo estiver disponível
  /*
  ProducaoNecessidade.belongsTo(models.Colaborador as ModelCtor<ColaboradorModel>, {
    foreignKey: "colaborador_id_registro",
    as: "registroPor",
  });
  */
};

export default ProducaoNecessidade;
