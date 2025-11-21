// src/models/Fornecedor.js

const { DataTypes } = require('sequelize');
const { connection } = require('../config/sequelize');

const Fornecedor = connection.define('Fornecedor', {
    id_fornecedor: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    nome_fantasia: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    razao_social: {
        type: DataTypes.STRING(150),
        allowNull: false,
    },
    cnpj: {
        type: DataTypes.STRING(18),
        allowNull: false,
        unique: true, // Garante que o CNPJ é único
    },
    email: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    telefone: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    endereco_completo: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    observacoes: { // Notas sobre condições de pagamento, horários de entrega, etc.
        type: DataTypes.TEXT,
        allowNull: true,
    },
}, {
    tableName: 'FORNECEDORES',
    timestamps: true,
    // Adicionamos um índice para garantir a performance de busca pelo CNPJ
    indexes: [
        {
            unique: true,
            fields: ['cnpj']
        }
    ]
});

// Associações (Serão usadas no PedidoCompra.js)
Fornecedor.associate = (models) => {
    // Um fornecedor pode ter muitos pedidos de compra
    Fornecedor.hasMany(models.PedidoCompra, {
        foreignKey: 'id_fornecedor',
        as: 'pedidos_compra',
    });
};

module.exports = Fornecedor;