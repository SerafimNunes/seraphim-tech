// src/models/RegistroPerda.js

const { DataTypes } = require('sequelize');
const { connection } = require('../config/sequelize');
const Produto = require('./Produto'); // Para a associação

const RegistroPerda = connection.define('RegistroPerda', {
    id_registro_perda: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    // O Produto/Insumo que foi perdido
    id_produto: { 
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'PRODUTOS',
            key: 'id_produto'
        },
    },
    // Quantidade perdida (em KG, UN, Litros, etc.)
    quantidade_perdida: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
    },
    // O custo unitário do produto no momento da baixa (para o cálculo financeiro)
    custo_unitario_na_hora: { 
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    // CRÍTICO para BI: Custo Total da Perda (Quantidade * Custo Unitário)
    custo_total_perda: { 
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    // Quem registrou a perda (ou quem estava responsável pela área/turno)
    colaborador_id: { 
        type: DataTypes.INTEGER,
        allowNull: true, 
    },
    // Categoria do Desperdício: 'QUEBRA', 'VALIDADE', 'ERRO_PRODUCAO', 'ERRO_VENDA', 'OUTROS'
    tipo_perda: { 
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    observacoes: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    data_registro: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'REGISTRO_PERDAS',
    timestamps: true,
});

// Associações
RegistroPerda.associate = (models) => {
    RegistroPerda.belongsTo(models.Produto, { foreignKey: 'id_produto', as: 'produto' });
    // Futuramente: RegistroPerda.belongsTo(models.Colaborador, { foreignKey: 'colaborador_id', as: 'colaborador' });
};


module.exports = RegistroPerda;