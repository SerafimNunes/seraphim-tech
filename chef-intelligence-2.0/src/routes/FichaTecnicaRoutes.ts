// src/routes/FichaTecnicaRoutes.ts (Novo arquivo modular)

import { Router } from "express";
// 🔑 Importa o Controller com o nome já modularizado (do seu arquivo anterior)
import FichaTecnicaController from "../controllers/FichaTecnicaController";

const router = Router();

// Rota GET para listar a Ficha Técnica de um Produto Pai
router.get("/fichatecnica/pai/:id_produto_pai", FichaTecnicaController.index);

// Rota POST para CRIAÇÃO ou SUBSTITUIÇÃO completa da Ficha Técnica de um produto (recebe um ARRAY de itens)
router.post(
  "/fichatecnica/pai/:id_produto_pai",
  FichaTecnicaController.storeOrUpdate
);

// Rota PUT para atualizar a QUANTIDADE de um item específico da Ficha Técnica
router.put(
  "/fichatecnica/item/:idItem",
  FichaTecnicaController.updateItemFichaTecnica
);

// Rota DELETE para remover um item específico da Ficha Técnica
router.delete(
  "/fichatecnica/item/:idItem",
  FichaTecnicaController.deleteItemFichaTecnica
);

export default router;
