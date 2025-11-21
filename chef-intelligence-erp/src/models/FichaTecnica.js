// src/models/FichaTecnica.js

const { DataTypes } = require('sequelize');
const { connection } = require('../config/sequelize');

const FichaTecnica = connection.define('FichaTecnica', {
    id_ficha_tecnica: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    id_produto_pai: { // O produto final ou pré-pronto que está sendo feito (Ex: Bolo)
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'PRODUTOS', // Referencia a própria tabela de PRODUTOS
            key: 'id_produto'
        },
    },
    id_produto_filho: { // O ingrediente ou insumo usado (Ex: Farinha)
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'PRODUTOS', // Referencia a própria tabela de PRODUTOS
            key: 'id_produto'
        },
    },
    quantidade_necessaria: { // Ex: Quantidade de Farinha para 1 Bolo
        type: DataTypes.DECIMAL(10, 3),
        allowNull: false,
    },
}, {
    tableName: 'FICHA_TECNICA',
    timestamps: false, // Desativa created_at e updated_at
});

// Importante: Definir as associações (Relacionamentos)
FichaTecnica.associate = (models) => {
    // Relacionamento do "Produto Pai"
    FichaTecnica.belongsTo(models.Produto, { foreignKey: 'id_produto_pai', as: 'produto_pai' });
    
    // Relacionamento do "Produto Filho"
    FichaTecnica.belongsTo(models.Produto, { foreignKey: 'id_produto_filho', as: 'produto_filho' });
};

module.exports = FichaTecnica;