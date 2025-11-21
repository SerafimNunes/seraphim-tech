// src/models/RegistroProducao.js (Para referência)

const { DataTypes } = require('sequelize');
const { connection } = require('../config/sequelize');

const RegistroProducao = connection.define('RegistroProducao', {
    id_registro_producao: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    // CRÍTICO: Qual produto está sendo produzido (ID do Pré-Pronto ou Prato Vendável)
    id_produto_produzido: { 
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'PRODUTOS',
            key: 'id_produto'
        },
    },
    // Quantidade total do produto final/pré-pronto que será adicionada ao estoque
    quantidade_produzida: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
    },
    // O ID de quem sugeriu a produção (Pode ser o Sistema: 0, ou um Colaborador)
    colaborador_id_sugestao: { 
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0, 
    },
    // O ID do Gestor que aprovou a Ordem de Produção
    colaborador_id_aprovacao: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    // O ID do Colaborador (Cozinheiro/Açougueiro) responsável pela execução
    colaborador_id_responsavel: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    // O Status do Ciclo de Vida da Produção
    status_producao: { // 'SUGERIDO' | 'APROVADO' | 'EM_PRODUCAO' | 'CONCLUIDO' | 'CANCELADO'
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'SUGERIDO',
    },
    data_inicio: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    data_conclusao: {
        type: DataTypes.DATE, // Momento em que o estoque é atualizado
        allowNull: true,
    },
    // CRÍTICO: Custo real dos insumos abatidos, calculado na conclusão
    custo_total_producao: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
    },
    observacoes: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
}, {
    tableName: 'REGISTRO_PRODUCAO',
    timestamps: true,
});

// ✅ Bloco Único e Corrigido de Associações
RegistroProducao.associate = (models) => {
    // 1. A produção está associada ao produto que foi gerado
    RegistroProducao.belongsTo(models.Produto, { foreignKey: 'id_produto_produzido', as: 'produto_final' });
    // 2. Relação com a Requisição de Insumos (1:1)
    RegistroProducao.hasOne(models.RequisicaoInsumo, { foreignKey: 'id_registro_producao', as: 'requisicao' });
};

module.exports = RegistroProducao;