// src/models/PedidoCompra.js

const { DataTypes } = require('sequelize');
const { connection } = require('../config/sequelize');
const Fornecedor = require('./Fornecedor'); // Para a associação

const PedidoCompra = connection.define('PedidoCompra', {
    id_pedido: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    id_fornecedor: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'FORNECEDORES',
            key: 'id_fornecedor'
        },
    },
    // Rastreia quem iniciou a sugestão (pode ser um colaborador ou o próprio sistema: 0)
    colaborador_id_sugestao: { 
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0, // 0 = Sistema (Alerta de Estoque Mínimo)
    },
    // Rastreia quem aprovou/rejeitou (Gestor)
    colaborador_id_aprovacao: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    // CRÍTICO: Status do Pedido no Ciclo de Aprovação
    status_aprovacao: { // 'SUGERIDO' | 'APROVADO' | 'REPROVADO' | 'CANCELADO' | 'FINALIZADO'
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'SUGERIDO',
    },
    data_aprovacao: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    data_entrega_prevista: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    valor_total_previsto: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
    },
}, {
    tableName: 'PEDIDOS_COMPRA',
    timestamps: true,
});

// Associações
PedidoCompra.associate = (models) => {
    // 1. Um pedido pertence a um fornecedor
    PedidoCompra.belongsTo(models.Fornecedor, {
        foreignKey: 'id_fornecedor',
        as: 'fornecedor',
    });

    // 2. Um pedido tem muitos itens de pedido
    PedidoCompra.hasMany(models.ItemPedido, {
        foreignKey: 'id_pedido',
        as: 'itens',
    });
};

module.exports = PedidoCompra;