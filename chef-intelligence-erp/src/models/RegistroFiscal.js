// src/models/RegistroFiscal.js

const { DataTypes } = require('sequelize');
const { connection } = require('../config/sequelize');

const RegistroFiscal = connection.define('RegistroFiscal', {
    id_registro_fiscal: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    // Referência à transação de origem (VENDA ou COMPRA)
    id_origem: { 
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    tipo_origem: { // 'VENDA' | 'COMPRA'
        type: DataTypes.STRING(30),
        allowNull: false,
    },
    
    // 📄 Dados do Documento Fiscal
    numero_documento: { 
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    chave_acesso_nfe: { // Campo CRÍTICO para NF-e/NFC-e
        type: DataTypes.STRING(44),
        allowNull: true, // Pode ser null para Cupons Fiscais não eletrônicos
        unique: true,
    },
    data_emissao: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    valor_total_documento: { // Valor total bruto do documento
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    
    // 💸 Dados Tributários (Para o Simples Nacional ou Lucro Presumido)
    imposto_simples: { 
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
    },
    cst_cfop_padrao: { // Ex: Código fiscal de operação para o contador
        type: DataTypes.STRING(10),
        allowNull: true,
    },
    observacoes_fisco: { 
        type: DataTypes.TEXT,
        allowNull: true,
    }
}, {
    tableName: 'REGISTROS_FISCAIS',
    timestamps: true,
});


// 🔑 CORREÇÃO CRÍTICA: Anexe a função associate.
// Mesmo que esteja vazia, a presença dela é um padrão que 
// garante o registro correto em 'connection.models' em alguns setups Sequelize.
RegistroFiscal.associate = (models) => {
    // Adicione esta associação se quiser vincular a quem fez o registro, por exemplo
    // RegistroFiscal.belongsTo(models.Colaborador, { 
    //     foreignKey: 'colaborador_id_registro', 
    //     as: 'fiscal_responsavel' 
    // });
};

module.exports = RegistroFiscal;