import { DataTypes, Model, Optional, ModelCtor } from 'sequelize';
import { connection } from '../config/sequelize';
import { IModelFactory } from '../config/types';
import { ResolvedModelMap } from '../config/associations';
import { ItemEstoqueModel } from './ItemEstoque';
import { ProducaoRequisicaoInsumoModel } from './ProducaoRequisicaoInsumo'; // 🔑 Novo nome

type StatusProducao =
  | 'SUGERIDO'
  | 'APROVADO'
  | 'EM_PRODUCAO'
  | 'CONCLUIDO'
  | 'CANCELADO';

export interface ProducaoRegistroAttributes {
  id_registro_producao: number;
  id_produto_produzido: number;
  quantidade_produzida: number; // DECIMAL(10, 3)
  colaborador_id_sugestao: number;
  colaborador_id_aprovacao: number | null;
  colaborador_id_responsavel: number | null;
  status_producao: StatusProducao;
  data_inicio: Date | null;
  data_conclusao: Date | null;
  custo_total_producao: number; // DECIMAL(10, 2)
  observacoes: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProducaoRegistroCreationAttributes
  extends Optional<
    ProducaoRegistroAttributes,
    | 'id_registro_producao'
    | 'colaborador_id_aprovacao'
    | 'colaborador_id_responsavel'
    | 'status_producao'
    | 'data_inicio'
    | 'data_conclusao'
    | 'custo_total_producao'
    | 'observacoes'
    | 'createdAt'
    | 'updatedAt'
  > {}

export interface ProducaoRegistroModel
  extends Model<ProducaoRegistroAttributes, ProducaoRegistroCreationAttributes>,
    ProducaoRegistroAttributes {
  // Associações
  produtoProduzido?: ItemEstoqueModel;
  requisicoesInsumo?: ProducaoRequisicaoInsumoModel[];
}

export const ProducaoRegistro: ModelCtor<ProducaoRegistroModel> =
  connection.define<ProducaoRegistroModel>(
    'ProducaoRegistro',
    {
      id_registro_producao: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      id_produto_produzido: { type: DataTypes.INTEGER, allowNull: false },
      // 🔑 GPR-4: DECIMAL fields com Getter para garantir tipo 'number'
      quantidade_produzida: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
        get() {
          return parseFloat(
            this.getDataValue('quantidade_produzida') as unknown as string,
          );
        },
      },
      colaborador_id_sugestao: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      colaborador_id_aprovacao: { type: DataTypes.INTEGER, allowNull: true },
      colaborador_id_responsavel: { type: DataTypes.INTEGER, allowNull: true },
      status_producao: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'SUGERIDO',
      },
      data_inicio: { type: DataTypes.DATE, allowNull: true },
      data_conclusao: { type: DataTypes.DATE, allowNull: true },
      // 🔑 GPR-4: DECIMAL fields com Getter para garantir tipo 'number'
      custo_total_producao: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
        get() {
          return parseFloat(
            this.getDataValue('custo_total_producao') as unknown as string,
          );
        },
      },
      observacoes: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: 'REGISTRO_PRODUCAO',
      timestamps: true,
      modelName: 'ProducaoRegistro', // 🔑 Novo nome do Model
    },
  );

(ProducaoRegistro as any).associate = (models: ResolvedModelMap) => {
  ProducaoRegistro.belongsTo(
    models.ItemEstoque as ModelCtor<ItemEstoqueModel>,
    {
      foreignKey: 'id_produto_produzido',
      as: 'produtoProduzido',
    },
  );
  ProducaoRegistro.hasMany(models.ProducaoRequisicaoInsumo, {
    foreignKey: 'id_registro_producao',
    as: 'requisicoesInsumo',
  });
};

export default ProducaoRegistro;
