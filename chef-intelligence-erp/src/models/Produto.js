// src/models/Produto.js

const { Sequelize, DataTypes } = require('sequelize');
const { connection } = require('../config/sequelize');

const Produto = connection.define('Produto', {
    // ID único do produto (PK e SERIAL) [cite: 46]
    id_produto: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nome: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    unidade_medida: {
        type: DataTypes.STRING(10), // Ex: KG, UN [cite: 46]
        allowNull: false,
    },
    estoque_atual: {
        type: DataTypes.DECIMAL(10, 3), // Quantidade física atual [cite: 47]
        allowNull: false,
        defaultValue: 0, 
    },
    estoque_minimo: {
        type: DataTypes.DECIMAL(10, 3), // Ponto de Alerta [cite: 47]
        allowNull: false,
        defaultValue: 0,
    },
    preco_custo_unitario: {
        type: DataTypes.DECIMAL(10, 2), // Custo unitário médio [cite: 48]
        allowNull: false,
        defaultValue: 0,
    },
    preco_venda: {
        type: DataTypes.DECIMAL(10,2),
        allowNull: false,
        defaultValue: 0,
    },
    is_vendavel: {
        type: DataTypes.BOOLEAN, // TRUE se for prato final ou insumo vendido [cite: 49]
        allowNull: false,
        defaultValue: false,
    },
    is_pre_pronto: {
        type: DataTypes.BOOLEAN, // TRUE se for preparação intermediária [cite: 49]
        allowNull: false,
        defaultValue: false,
    }
}, {
    tableName: 'PRODUTOS', // Nome exato da sua tabela
    timestamps: false, // Desativa as colunas createdAt e updatedAt

   });

Produto.associate = (models) => {
    // Produto como Pai (é composto por insumos)
    Produto.hasMany(models.FichaTecnica, { 
        foreignKey: 'id_produto_pai', 
        as: 'composicao' // Ex: Produto.find(1).getComposicao()
    });

    // Produto como Filho (é um insumo em outra ficha)
    Produto.hasMany(models.FichaTecnica, {
        foreignKey: 'id_produto_filho',
        as: 'usado_em' // Ex: Produto.find(1).getUsadoEm()
    });
};



module.exports = Produto;
