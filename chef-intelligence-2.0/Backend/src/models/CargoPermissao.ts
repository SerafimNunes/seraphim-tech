// src/models/CargoPermissao.ts

import { DataTypes, Model } from "sequelize";
import { connection } from "../config/sequelize";

// Definição do modelo de junção N:M explícito.
class CargoPermissao extends Model {}

CargoPermissao.init({
    // ⬅️ CORREÇÃO CRÍTICA: Definir as colunas FKs explicitamente
    cargo_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true, // É parte da chave primária composta da tabela de junção
    },
    permissao_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true, // É parte da chave primária composta da tabela de junção
    },
}, {
    sequelize: connection,
    tableName: 'CARGO_PERMISSOES', // Nome da tabela garantido em UPPERCASE
    modelName: 'CargoPermissao', // Nome do modelo interno
    timestamps: false,
    underscored: true,
});

export default CargoPermissao;