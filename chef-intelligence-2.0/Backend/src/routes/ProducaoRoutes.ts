// src/routes/ProducaoRoutes.ts (Novo arquivo modular)

import { Router } from "express";
import ProducaoController from "../controllers/ProducaoController"; // 🔑 Importa o Controller

const router = Router();

// Rota 1: Sugestão de Produção Automática (Alerta de Estoque Mínimo)
router.get("/producao/alerta", ProducaoController.suggestProduction);

// Rota 2: Listagem de Ordens de Produção (Painel de Monitoramento)
router.get("/producao", ProducaoController.index);

// Rota 3: Criação manual de uma OP (Status SUGERIDO)
router.post("/producao", ProducaoController.store);

// Rota 4: Aprovação (Gestor) - Início da Produção (Gera Requisição)
router.patch("/producao/:id/aprovar", ProducaoController.startProduction);

// Rota 5: Entrega/Confirmação (Estoquista) - Abate os insumos do Estoque
router.patch(
  "/producao/:id/entregar-insumos",
  ProducaoController.deliverInsumos
);

// Rota 6: Conclusão (Cozinheiro/Gestor) - Adiciona o Produto Final ao Estoque
router.patch("/producao/:id/concluir", ProducaoController.finishProduction);

// Rota 7: Registro de Perda de Estoque (Baixa Manual)
router.post("/producao/perda", ProducaoController.storePerda);

// Rota 8: Rejeição/Cancelamento de OP
router.patch("/producao/:id/cancelar", ProducaoController.cancelProduction);

export default router;
