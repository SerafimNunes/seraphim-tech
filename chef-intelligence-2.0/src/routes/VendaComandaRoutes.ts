// src/routes/VendaComandaRoutes.ts

import { Router } from "express";
import VendaComandaController from "../controllers/VendaComandaController";
// Importa a instância de VendaItemController, assumindo que ele também exporta a instância pronta
import VendaItemController from "../controllers/VendaItemController";

const router = Router();

// 🔑 CORREÇÃO DO ERRO TS2351: A importação já é a instância pronta, não precisa de 'new'.
// Basta usar o nome do import diretamente.
const VendaController = VendaComandaController;

// Rotas de Comanda (VendaComandaController)

/**
 * @route GET /vendas/comandas/ativas
 * @description Lista todas as comandas (vendas) ativas.
 */
router.get("/comandas/ativas", VendaController.buscarComandasAtivas);

/**
 * @route GET /vendas/comandas/historico
 * @description Lista o histórico de vendas (fechadas/canceladas).
 */
router.get("/comandas/historico", VendaController.buscarHistoricoVendas);

/**
 * @route POST /vendas/comandas
 * @description Abre uma nova comanda/venda.
 */
router.post("/comandas", VendaController.abrirComanda);

/**
 * @route GET /vendas/comandas/:id_venda
 * @description Busca uma comanda específica pelo ID.
 */
router.get("/comandas/:id_venda", VendaController.buscarComandaPorId);

/**
 * @route PUT /vendas/comandas/:id_venda/fechar
 * @description Fecha uma comanda (venda) e registra o pagamento.
 */
router.put("/comandas/:id_venda/fechar", VendaController.fecharComanda);

// Rotas de Itens da Comanda (VendaItemController)

/**
 * @route POST /vendas/itens
 * @description Adiciona um item a uma comanda (venda) aberta.
 * @access Private (Auth Required)
 */
// ⚠️ Nota: A rota foi ajustada para seguir o padrão RESTful (POST /vendas/itens).
// A função `store` em VendaItemController deve lidar com a criação do item.
router.post("/itens", VendaItemController.store); // Endpoint ajustado para /itens

/**
 * @route DELETE /vendas/itens/:id_venda_item
 * @description Remove um item de uma comanda (venda) aberta.
 * @access Private (Auth Required)
 */
router.delete("/itens/:id_venda_item", VendaItemController.destroy);

export default router;
