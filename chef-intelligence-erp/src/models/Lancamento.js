// src/models/Lancamento.js

const { DataTypes } = require('sequelize');
const { connection } = require('../config/sequelize');

const Lancamento = connection.define('Lancamento', {
    id_lancamento: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    // Chave para o caixa que fez o lançamento
    id_caixa: {
        type: DataTypes.INTEGER,
        allowNull: true, // Pode ser null se for uma transação bancária (não física de caixa)
        references: {
            model: 'CAIXAS',
            key: 'id_caixa'
        }
    },
    colaborador_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    tipo_lancamento: { // 'RECEITA' | 'DESPESA' | 'SANGRIA' | 'REFORCO'
        type: DataTypes.STRING(20),
        allowNull: false,
    },
    valor: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    descricao: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    categoria: { // Ex: 'Aluguel', 'Salário', 'Insumos', 'Marketing'
        type: DataTypes.STRING(50),
        allowNull: true,
    },
    data_lancamento: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'LANCAMENTOS',
    timestamps: true,
});

// ✅ Associações (Prontas para o associations.js)
Lancamento.associate = (models) => {
    // 1. Um Lançamento pertence a um Caixa (se foi feito pelo caixa)
    Lancamento.belongsTo(models.Caixa, { foreignKey: 'id_caixa', as: 'caixa' });
};

module.exports = Lancamento;