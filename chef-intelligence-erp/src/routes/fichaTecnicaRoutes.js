// src/routes/fichaTecnicaRoutes.js

const express = require('express');
const router = express.Router();
const FichaTecnicaController = require('../controllers/FichaTecnicaController');

// Rota GET para listar a Ficha Técnica de um Produto Pai
router.get('/fichatecnica/pai/:id_produto_pai', FichaTecnicaController.index);

// Rota POST para CRIAÇÃO ou SUBSTITUIÇÃO completa da Ficha Técnica de um produto (recebe um ARRAY de itens)
// O teste usa essa rota para criar a FT (Passo 3).
router.post('/fichatecnica/pai/:id_produto_pai', FichaTecnicaController.storeOrUpdate);

// Rota PUT para atualizar a QUANTIDADE de um item específico da Ficha Técnica
router.put('/fichatecnica/item/:idItem', FichaTecnicaController.updateItemFichaTecnica);

// Rota DELETE para remover um item específico da Ficha Técnica
router.delete('/fichatecnica/item/:idItem', FichaTecnicaController.deleteItemFichaTecnica);

module.exports = router;