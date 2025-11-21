// src/models/ItemVenda.js

const { DataTypes } = require('sequelize');
const { connection } = require('../config/sequelize');

const ItemVenda = connection.define('ItemVenda', {
    id_item_venda: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    // Chave para a venda (Comanda) principal
    id_venda: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'VENDAS',
            key: 'id_venda'
        },
    },
    // Produto Vendido (Prato ou Bebida)
    id_produto: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'PRODUTOS',
            key: 'id_produto'
        },
    },
    quantidade: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
    },
    // Preço cobrado do cliente (no momento do pedido/venda)
    preco_unitario: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    // Preço de Venda Total (Quantidade * Preço Unitário)
    preco_venda_total: { 
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    // CRÍTICO para o CMV: Custo de Saída (Quantidade * Custo Médio do produto no estoque)
    custo_total: { 
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    status_item: { // 'ABERTO', 'PREPARANDO', 'ENTREGUE', 'CANCELADO'
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'ABERTO',
    },
}, {
    tableName: 'ITENS_VENDA',
    timestamps: true,
});

// ItemVenda.associate = (models) => { /* ... */ };
// ... (código do modelo)

ItemVenda.associate = (models) => {
    // 1. O ItemVenda pertence a uma Venda (Comanda)
    ItemVenda.belongsTo(models.Venda, { foreignKey: 'id_venda', as: 'venda' });
    // 2. O ItemVenda referencia o Produto que está sendo vendido
    ItemVenda.belongsTo(models.Produto, { foreignKey: 'id_produto', as: 'produto_vendido' });
};


module.exports = ItemVenda;