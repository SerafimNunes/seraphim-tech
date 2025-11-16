// src/routes/CaixaRoutes.ts

import { Router } from "express";
import CaixaController from "../controllers/CaixaController";
// Nota: authMiddleware e rbacMiddleware seriam importados aqui,
// e são aplicados no index.ts, garantindo R12.

const router = Router();
// O CaixaController é exportado como uma instância default
const Controller = CaixaController;

/**
 * Rota para Lançamentos (Sangria, Reforço, Despesa)
 * * Este endpoint é o mais crítico que faltava para a operação.
 */

/**
 * @route POST /caixa/lancamento
 * @description Registra um novo lançamento manual (Sangria, Reforço, Despesa) no caixa ativo.
 * @access Private (Auth Required, Role: Gerente/Admin/Operador)
 */
// 🔑 Adição da rota para lançamentos manuais
router.post("/caixa/lancamento", Controller.registrarLancamento);

// -------------------------------------------------------------
// Rotas de Gestão de Estado (Caixa)
// -------------------------------------------------------------

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
