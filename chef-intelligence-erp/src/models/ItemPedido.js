// src/models/ItemPedido.js

const { DataTypes } = require('sequelize');
const { connection } = require('../config/sequelize');
const Produto = require('./Produto'); // Para a associação

const ItemPedido = connection.define('ItemPedido', {
    id_item_pedido: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    id_pedido: { // Cabeçalho do pedido
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'PEDIDOS_COMPRA',
            key: 'id_pedido'
        },
    },
    id_produto: { // Qual produto está sendo comprado
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'PRODUTOS',
            key: 'id_produto'
        },
    },
    quantidade_pedida: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
    },
    // Valor unitário negociado no momento do pedido (pode mudar na hora do recebimento)
    preco_unitario_negociado: { 
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
    },
    // Quantidade REALMENTE recebida (pode ser diferente da pedida)
    quantidade_recebida: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: true,
    },
    // Status do item (opcional para rastrear entregas parciais)
    status_recebimento: { // 'PENDENTE' | 'PARCIAL' | 'RECEBIDO'
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'PENDENTE',
    },
}, {
    tableName: 'ITENS_PEDIDO',
    timestamps: false, // O timestamp do cabeçalho é suficiente
});

// Associações
ItemPedido.associate = (models) => {
    // 1. O item pertence a um pedido
    ItemPedido.belongsTo(models.PedidoCompra, {
        foreignKey: 'id_pedido',
        as: 'pedido',
    });

    // 2. O item se refere a um produto
    ItemPedido.belongsTo(models.Produto, {
        foreignKey: 'id_produto',
        as: 'produto',
    });
};

module.exports = ItemPedido;