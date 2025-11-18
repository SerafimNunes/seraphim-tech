import { Router } from "express";
import FichaTecnicaController from "../controllers/FichaTecnicaController";
import { authMiddleware } from "../Middlewares/authMiddleware";
import { podeAcessar } from "../Middlewares/rbacMiddleware";
import { Acoes, Recursos } from "../config/types";

const router = Router();

// Mapeamento das Permissões para o Recurso PRODUCAO (R12)
const FT_READ =
  Recursos.PRODUCAO.toUpperCase() + "_" + Acoes.LEITURA.toUpperCase();
const FT_WRITE =
  Recursos.PRODUCAO.toUpperCase() + "_" + Acoes.ATUALIZACAO.toUpperCase();

// 🔑 1.G: Aplica autenticação a todas as rotas
router.use(authMiddleware);

// Rota GET para listar (READ)
router.get(
  "/fichatecnica/pai/:id_produto_pai",
  podeAcessar([FT_READ, FT_WRITE]),
  FichaTecnicaController.index.bind(FichaTecnicaController)
);

// Rota POST para CRIAÇÃO ou SUBSTITUIÇÃO (WRITE)
router.post(
  "/fichatecnica/pai/:id_produto_pai",
  podeAcessar([FT_WRITE]), // 🔑 CORREÇÃO: Passando como array de string.
  FichaTecnicaController.storeOrUpdate.bind(FichaTecnicaController)
);

// Rota PUT para atualizar QUANTIDADE de item (WRITE)
router.put(
  "/fichatecnica/item/:idItem",
  podeAcessar([FT_WRITE]), // 🔑 CORREÇÃO: Passando como array de string.
  FichaTecnicaController.updateItemFichaTecnica.bind(FichaTecnicaController)
);

// Rota DELETE para remover um item (WRITE)
router.delete(
  "/fichatecnica/item/:idItem",
  podeAcessar([FT_WRITE]), // 🔑 CORREÇÃO: Passando como array de string.
  FichaTecnicaController.deleteItemFichaTecnica.bind(FichaTecnicaController)
);

export default router;
