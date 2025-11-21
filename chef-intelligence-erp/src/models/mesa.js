// src/models/Mesa.js

const { DataTypes } = require('sequelize');
const { connection } = require('../config/sequelize');

const Mesa = connection.define('Mesa', {
    id_mesa: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    numero_mesa: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true, // Garante que não haja mesas com o mesmo número
    },
    // Status principal: 'LIVRE', 'OCUPADA', 'AGUARDANDO_FECHAMENTO'
    status_mesa: { 
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: 'LIVRE',
    },
    // Opcional: ID do Garçom responsável por esta mesa no momento
    colaborador_id_responsavel: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    data_abertura: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    // Chave para a venda atual. Será populada quando a mesa for 'OCUPADA'
    id_venda_atual: {
        type: DataTypes.INTEGER,
        allowNull: true,
        unique: true, // Uma mesa só pode ter uma venda ativa (aberta)
    }
}, {
    tableName: 'MESAS',
    timestamps: true,
    // Adiciona índice para otimizar buscas por status
    indexes: [{ fields: ['status_mesa'] }],
});

// A associação 1:N com Vendas será definida nas 'associations' globais
// Mesa.associate = (models) => { /* ... */ };
// ... (código do modelo)

Mesa.associate = (models) => {
    // 1. Uma mesa pode ter apenas UMA venda atual (status 'OCUPADA')
    Mesa.hasOne(models.Venda, { foreignKey: 'id_mesa', as: 'venda_atual', sourceKey: 'id_venda_atual' }); 
};

module.exports = Mesa;