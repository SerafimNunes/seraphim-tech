// src/models/ContagemEstoque.js

const { DataTypes } = require('sequelize');
const { connection } = require('../config/sequelize');
const Produto = require('./Produto'); // Importa o modelo Produto para a associação

const ContagemEstoque = connection.define('ContagemEstoque', {
    id_contagem: {
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
    data_contagem: { // Dia em que a contagem foi realizada
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    estoque_contado: { // O valor físico contado pelo colaborador
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
    },
    estoque_teorico_na_hora: { // O estoque que o sistema REGISTROU antes da contagem
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
    },
    discrepancia: { // Diferença (Contado - Teórico). Positivo é sobra, negativo é perda.
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
    },
    custo_discrepancia: { // Impacto financeiro da perda/sobra (Discrepância * preco_custo_unitario)
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    colaborador_id: { // Quem realizou a contagem (Para rastreabilidade, será FK para o Módulo RH/COLABORADORES)
        type: DataTypes.INTEGER,
        allowNull: true, // Temporariamente true até criarmos o modelo COLABORADORES
    },
}, {
    tableName: 'CONTAGEM_ESTOQUE',
    timestamps: true, // Mantemos created_at para registrar o momento exato
    updatedAt: false, // Não precisamos de updated_at
});

// Associações
ContagemEstoque.associate = (models) => {
    ContagemEstoque.belongsTo(models.Produto, {
        foreignKey: 'id_produto',
        as: 'produto',
    });
};

module.exports = ContagemEstoque;