// src/models/Colaborador.js

const { DataTypes } = require('sequelize');
const { connection } = require('../config/sequelize');
const bcrypt = require('bcryptjs'); // ⬅️ CORRIGIDO: Removido a vírgula de arrasto.

const Colaborador = connection.define('Colaborador', {
    id_colaborador: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    nome: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    funcao: { 
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    nivel_senioridade: { 
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
    },
    email: { 
        type: DataTypes.STRING(100),
        unique: true,
        allowNull: true, // Permitido, assumindo que alguns colaboradores não precisam de login
    },
    senha_hash: {
        type: DataTypes.STRING(255),
        allowNull: true, // Permitido, assumindo que alguns colaboradores não precisam de login
    },
    restricoes_individuais: { 
        type: DataTypes.TEXT,
        allowNull: true,
    },
    ativo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
    custo_mensal_bruto: { 
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Custo fixo mensal total (salário + encargos) para cálculo de BI.',
    },
}, {
    tableName: 'COLABORADORES',
    timestamps: true,
    // 🛡️ HOOKS DE SEGURANÇA
    hooks: {
        // 🚨 CORREÇÃO CRÍTICA 1: Hashing condicional
        beforeSave: async (colaborador) => {
            // Apenas hashea a senha se o campo senha_hash foi modificado (ou é novo).
            // Isso previne que a senha seja re-hasheada em um update de nome, cargo, etc.
            if (colaborador.changed('senha_hash') && colaborador.senha_hash) { 
                colaborador.senha_hash = await bcrypt.hash(colaborador.senha_hash, 10);
            }
        },
    },   
});

// 🔑 CORREÇÃO CRÍTICA 2: Adicionar método de verificação de senha
// Este método é CRÍTICO. O AuthController.js irá chamá-lo para comparar a senha que o usuário digita
// (em texto puro) com o hash armazenado no banco.
Colaborador.prototype.checkPassword = function(password) {
    // Retorna uma Promise booleana (true se a senha for válida)
    return bcrypt.compare(password, this.senha_hash);
};

// ... (Restante do seu código está correto)
Colaborador.associate = (models) => {
    Colaborador.hasMany(models.Escala, { foreignKey: 'id_colaborador', as: 'escalas_associadas' });
};

module.exports = Colaborador;