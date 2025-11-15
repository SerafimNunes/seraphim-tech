// src/routes/CaixaRoutes.ts

import { Router } from "express";
import CaixaController from "../controllers/CaixaController";
// Nota: authMiddleware e rbacMiddleware seriam importados aqui,
// mas omitidos para simplicidade.

const router = Router();
// O CaixaController é exportado como uma instância default, então podemos usá-lo diretamente
const Controller = CaixaController;

/**
 * @route POST /caixa/abrir
 * @description Abre um novo caixa para o turno.
 * @access Private (Auth Required, Role: Gerente/Admin/Operador)
 */
router.post("/caixa/abrir", Controller.abrirCaixa);

/**
 * @route PUT /caixa/fechar/:id_caixa
 * @description Fecha o caixa do turno, consolidando o saldo.
 * @access Private (Auth Required, Role: Gerente/Admin/Operador)
 */
router.put("/caixa/fechar/:id_caixa", Controller.fecharCaixa);

/**
 * @route GET /caixa/ativos
 * @description Lista todos os caixas que estão atualmente ABERTOS.
 * @access Private (Auth Required)
 */
router.get("/caixa/ativos", Controller.listarCaixasAtivos);

/**
 * @route GET /caixa/movimentos
 * @description Lista todos os movimentos (abertura, fechamento, suprimentos, sangrias).
 * @access Private (Auth Required)
 */
router.get("/caixa/movimentos", Controller.listarMovimentos);

export default router;
