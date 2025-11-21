// src/models/Caixa.js

const { DataTypes } = require('sequelize');
const { connection } = require('../config/sequelize');

const Caixa = connection.define('Caixa', {
    id_caixa: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    colaborador_id_abertura: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    colaborador_id_fechamento: {
        type: DataTypes.INTEGER,
        allowNull: true,
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
    // Saldo inicial (o troco deixado no caixa)
    saldo_inicial: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
    },
    // Total das vendas (receita)
    total_vendas: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
    },
    // Total das despesas (pagamentos de contas, sangrias)
    total_despesas: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
    },
    // Saldo Final Calculado (Saldo Inicial + Vendas - Despesas)
    saldo_final_calculado: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
    },
    // Status: 'ABERTO' ou 'FECHADO'
    status_caixa: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'ABERTO',
    },
}, {
    tableName: 'CAIXAS',
    timestamps: true,
});

// ✅ Associações (Prontas para o associations.js)
Caixa.associate = (models) => {
    // 1. Um Caixa tem MUITAS Vendas associadas.
    Caixa.hasMany(models.Venda, { foreignKey: 'id_caixa', as: 'vendas' });
    // 2. Um Caixa tem MUITOS Lançamentos (Despesas) associados.
    Caixa.hasMany(models.Lancamento, { foreignKey: 'id_caixa', as: 'lancamentos' });
};

module.exports = Caixa;