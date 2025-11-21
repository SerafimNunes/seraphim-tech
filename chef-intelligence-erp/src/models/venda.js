// src/models/Venda.js

const { DataTypes } = require('sequelize');
const { connection } = require('../config/sequelize');

const Venda = connection.define('Venda', {
    id_venda: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    // Referência à Mesa (se a venda for de balcão, este campo será null)
    id_mesa: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'MESAS',
            key: 'id_mesa'
        }
    },
    // Referência ao Caixa (para Fechamento e BI)
    id_caixa: { 
        type: DataTypes.INTEGER,
        allowNull: true,
        // Assumindo que você terá um modelo 'Caixa' mais tarde
    },
    colaborador_id_abertura: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    // Status: 'ABERTA' (Comanda ativa), 'FECHADA' (Pagamento realizado), 'CANCELADA'
    status_venda: { 
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'ABERTA',
    },
    data_abertura: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    data_fechamento: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    // Preço de Venda total (Soma dos ITENS_VENDA.preco_venda)
    valor_total: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
    },
    // CRÍTICO para BI: Custo Total da Venda (Soma dos ITENS_VENDA.custo_total)
    custo_total: { 
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
    },
    // Método de Pagamento: 'PIX', 'CARTAO', 'DINHEIRO', 'PARCIAL'
    metodo_pagamento: {
        type: DataTypes.STRING(50),
        allowNull: true,
    }
}, {
    tableName: 'VENDAS',
    timestamps: true,
});

// Venda.associate = (models) => { /* ... */ };
// ... (código do modelo)

Venda.associate = (models) => {
    // 1. Uma venda pertence a uma Mesa (se não for venda de balcão)
    Venda.belongsTo(models.Mesa, { foreignKey: 'id_mesa', as: 'mesa' });
    // 2. Uma venda tem MÚLTIPLOS itens (o pedido)
    Venda.hasMany(models.ItemVenda, { foreignKey: 'id_venda', as: 'itens_venda' });
    // 3. Uma venda pertence a um colaborador (quem abriu)
    // Venda.belongsTo(models.Colaborador, { foreignKey: 'colaborador_id_abertura', as: 'aberta_por' });
    // 4. Uma venda está associada a um Caixa
    // Venda.belongsTo(models.Caixa, { foreignKey: 'id_caixa', as: 'caixa_associado' });
};

module.exports = Venda;