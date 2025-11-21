// src/models/MovimentoEstoque.js

const { DataTypes } = require('sequelize');
const { connection } = require('../config/sequelize');
const Produto = require('./Produto');

const MovimentoEstoque = connection.define('MovimentoEstoque', {
    id_movimento: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    id_produto: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'PRODUTOS',
            key: 'id_produto'
        },
    },
    tipo_movimento: { // 'ENTRADA' | 'SAIDA' | 'AJUSTE_SOBRA' | 'AJUSTE_PERDA'
        type: DataTypes.STRING(20),
        allowNull: false,
    },
    quantidade: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
    },
    // O custo médio unitário do produto NO MOMENTO do movimento (Crucial para o BI/CMV)
    preco_custo_unitario_momento: { 
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
    },
    // Custo total do movimento (Quantidade * Preço Custo Unitário Momento)
    custo_total_movimento: { 
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
    },
    referencia_origem: { // Ex: ID da Ficha Técnica (Consumo), ID da Venda (Saída)
        type: DataTypes.STRING(50),
        allowNull: true,
    },
    colaborador_id: { // Quem registrou o movimento (auditoria)
        type: DataTypes.INTEGER,
        allowNull: true, 
    },
}, {
    tableName: 'MOVIMENTO_ESTOQUE',
    timestamps: true,
});

MovimentoEstoque.associate = (models) => {
    MovimentoEstoque.belongsTo(models.Produto, {
        foreignKey: 'id_produto',
        as: 'produto',
    });
};

module.exports = MovimentoEstoque;