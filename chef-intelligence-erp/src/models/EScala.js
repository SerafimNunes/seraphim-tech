// src/models/Escala.js

const { DataTypes } = require('sequelize');
const { connection } = require('../config/sequelize');

const Escala = connection.define('Escala', {
    id_escala: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    // Chave para o colaborador escalado
    id_colaborador: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'COLABORADORES',
            key: 'id_colaborador'
        }
    },
    data_escala: { // O dia de trabalho
        type: DataTypes.DATEONLY,
        allowNull: false,
    },
    hora_entrada: {
        type: DataTypes.TIME,
        allowNull: false,
    },
    hora_saida: {
        type: DataTypes.TIME,
        allowNull: false,
    },
    // CRÍTICO: Versão da Escala (para que o gestor possa criar rascunhos)
    versao_escala: { 
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
    },
    // Status da Escala: 'RASCUNHO', 'PENDENTE_APROVACAO', 'APROVADA'
    status_aprovacao: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: 'RASCUNHO',
    },
    // ID do Gestor que aprovou a versão final
    id_aprovador: {
        type: DataTypes.INTEGER,
        allowNull: true,
    }
}, {
    tableName: 'ESCALAS',
    timestamps: true,
    // Garante que um colaborador não tenha dois turnos no mesmo dia e versão
    indexes: [{ unique: true, fields: ['id_colaborador', 'data_escala', 'versao_escala'] }]
});

// ✅ Associações (Prontas para o associations.js)
Escala.associate = (models) => {
    // 1. A escala pertence a um colaborador
    Escala.belongsTo(models.Colaborador, { foreignKey: 'id_colaborador', as: 'colaborador' });
    // 2. O aprovador também é um colaborador (auto-associação)
    Escala.belongsTo(models.Colaborador, { foreignKey: 'id_aprovador', as: 'aprovador' });
};

module.exports = Escala;