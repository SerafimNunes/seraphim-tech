// src/models/RequisicaoInsumo.js

const { DataTypes } = require('sequelize');
const { connection } = require('../config/sequelize');

const RequisicaoInsumo = connection.define('RequisicaoInsumo', {
    id_requisicao: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    // CRÍTICO: Vincula à Ordem de Produção que a gerou
    id_registro_producao: { 
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'REGISTRO_PRODUCAO',
            key: 'id_registro_producao'
        },
    },
    // O ID do Colaborador (Estoquista/João) que separou/entregou os insumos
    colaborador_id_separador: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    // O ID do Colaborador (Cozinheiro/Pedro) que retirou e confirmou os insumos
    colaborador_id_recebedor: {
        type: DataTypes.INTEGER,
        allowNull: false, // Deve ser o responsável pela produção
    },
    status_requisicao: { // 'SOLICITADA' | 'EM_SEPARACAO' | 'ENTREGUE' | 'RECUSADA'
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'SOLICITADA',
    },
    data_entrega: { // Quando o estoquista separou e entregou (Assinatura de João)
        type: DataTypes.DATE,
        allowNull: true,
    },
    data_confirmacao: { // Quando o recebedor confirmou o recebimento (Assinatura de Pedro)
        type: DataTypes.DATE,
        allowNull: true,
    },
    observacoes_estoque: { // Notas sobre a separação (Ex: 'Faltou 1kg de Farinha')
        type: DataTypes.TEXT,
        allowNull: true,
    },
}, {
    tableName: 'REQUISICOES_INSUMOS',
    timestamps: true,
});

RequisicaoInsumo.associate = (models) => {
    // Uma requisição pertence a um registro de produção
    RequisicaoInsumo.belongsTo(models.RegistroProducao, {
        foreignKey: 'id_registro_producao',
        as: 'registro_producao',
    });
};

module.exports = RequisicaoInsumo;