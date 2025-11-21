// src/routes/ComprasPedidoRoutes.ts

import { Router } from "express";
import ComprasPedidoController from "../controllers/ComprasPedidoController"; // ✅ Import resolvido

const router = Router();
const controller = ComprasPedidoController;

router.post("/compras/cotacao", controller.createQuotation);

router.get("/compras/alerta", controller.suggestItemsBelowMin);

router.get("/compras/pedidos", controller.index);

router.patch(
  "/compras/pedidos/:id_pedido/recebimento",
  controller.receberInsumos
);

export default router;
