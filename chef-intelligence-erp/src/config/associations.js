// src/config/associations.js

/**
 * Itera sobre todos os modelos carregados (connection.models) e chama o método 'associate'
 * se ele estiver definido. Isso garante que todos os relacionamentos (hasMany, belongsTo, etc.)
 * sejam configurados após o carregamento de todos os modelos.
 * @param {object} models Um objeto contendo todos os modelos Sequelize (ex: connection.models)
 */
const applyAssociations = (models) => {
    // Itera sobre todos os modelos carregados
    Object.values(models).forEach(model => {
        // Verifica se o modelo tem a função 'associate' definida (em Produto.js, FichaTecnica.js, etc.)
        if (typeof model.associate === 'function') {
            console.log(`🔗 Aplicando associações para o modelo: ${model.name}`);
            model.associate(models); // Passa o objeto 'models' para que o modelo possa referenciar outros
        }
    });
    console.log('✅ Associações de modelos aplicadas com sucesso.');
};

module.exports = { applyAssociations };