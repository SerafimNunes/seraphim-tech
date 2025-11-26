// src/scripts/checkAssociations.ts
import { connection } from "../config/sequelize";
import { IModelFactory } from "../config/types";
import { Model } from "sequelize"; // ✅ Importação correta: Model (singular)

// --- Importação EXPLICITA de modelos para resolver TS2307 ---
// 🔑 IMPORTANTE: Você deve ter todos esses modelos exportados como 'default export' em seus respectivos arquivos.
import Colaborador from "../models/Colaborador";
import Cargo from "../models/Cargo";
import Permissao from "../models/Permissao";
import Usuario from "../models/Usuario";
import Escala from "../models/Escala";
import CupomNaoFiscal from "../models/CupomNaoFiscal";
import Lancamento from "../models/Lancamento";
import Caixa from "../models/Caixa";
import ContaContabil from "../models/ContaContabil";
import DocumentoContabil from "../models/DocumentoContabil";
import VendaMesa from "../models/VendaMesa";
import FichaTecnica from "../models/FichaTecnica";
import ItemEstoque from "../models/ItemEstoque";
import CompraNecessidade from "../models/CompraNecessidade";
import ComprasItemPedido from "../models/ComprasItemPedido";
import ComprasPedido from "../models/ComprasPedido";
import CustoFixo from "../models/CustoFixo";
import EstoqueRegistroContagem from "../models/EstoqueRegistroContagem";
import EstoqueRegistroMovimento from "../models/EstoqueRegistroMovimento";
import Feedback from "../models/Feedback";
import Fornecedor from "../models/Fornecedor";
import HistoricoPerformance from "../models/HistoricoPerformance";
import PerfilIdeal from "../models/PerfilIdeal";
import ProducaoNecessidade from "../models/ProducaoNecessidade";
import ProducaoRegistro from "../models/ProducaoRegistro";
import ProducaoRegistroPerda from "../models/ProducaoRegistroPerda";
import ProducaoRequisicaoInsumo from "../models/ProducaoRequisicaoInsumo";
import RegistroFiscal from "../models/RegistroFiscal";
import Unidade from "../models/Unidade";
import VendaComanda from "../models/VendaComanda";
import VendaComissao from "../models/VendaComissao";
import VendaImposto from "../models/VendaImposto";
import VendaItem from "../models/VendaItem";

// 💡 Adicione todos os outros modelos que você tem no seu 'index.ts' aqui!

// 🔑 Cria o Factory de Modelos de forma explícita
const modelFactory: IModelFactory = {
  Colaborador,
  Cargo,
  Permissao,
  Usuario,
  Escala,
  CupomNaoFiscal,
  Lancamento,
  Caixa,
  ContaContabil,
  DocumentoContabil,
  VendaMesa,
  FichaTecnica,
  ItemEstoque,
  CompraNecessidade,
  ComprasItemPedido,
  ComprasPedido,
  CustoFixo,
  EstoqueRegistroContagem,
  EstoqueRegistroMovimento,
  Feedback,
  Fornecedor,
  HistoricoPerformance,
  PerfilIdeal,
  ProducaoNecessidade,
  ProducaoRegistro,
  ProducaoRegistroPerda,
  ProducaoRequisicaoInsumo,
  RegistroFiscal,
  Unidade,
  VendaComanda,
  VendaComissao,
  VendaImposto,
  VendaItem,

  // Adicione outros modelos aqui
};

function applyAssociations(models: IModelFactory): void {
  if (!models) {
    console.error("ERRO: Model Factory está vazio ou não foi carregado.");
    return;
  }

  // Itera sobre as propriedades do objeto para garantir que o 'model' não é undefined (resolve TS18048)
  Object.values(models).forEach((model) => {
    // Usa uma constante para forçar a verificação de tipo dentro do loop.
    const sequelizeModel = model as any;

    // Verifica se o objeto tem o método 'associate' e é um modelo Sequelize válido
    if (
      sequelizeModel &&
      typeof sequelizeModel.associate === "function" &&
      sequelizeModel.prototype instanceof Model
    ) {
      const modelName = sequelizeModel.name;

      try {
        // Tenta aplicar as associações.
        sequelizeModel.associate(models);
        console.log(
          `✅ Associações aplicadas com sucesso para o modelo: ${modelName}`
        );
      } catch (error) {
        // Captura o erro específico de associação e informa o modelo que falhou.
        console.error(`❌ ERRO FATAL de Associação em ${modelName}:`);
        console.error((error as Error).message);
        throw new Error(`Falha na Aplicação das Associações.`);
      }
    } else if (sequelizeModel) {
      // Caso o modelo exista mas não seja do Sequelize ou não tenha associate
      console.warn(
        `⚠️ Aviso: Modelo '${sequelizeModel.name}' ignorado (Não é um modelo Sequelize ou não possui o método .associate()).`
      );
    }
  });
}

async function runAssociationCheck() {
  console.log("Iniciando verificação de associações...");

  try {
    await connection.authenticate();
    console.log("✅ Conexão com o banco de dados estabelecida.");

    applyAssociations(modelFactory);

    console.log(
      "\n🚀 VERIFICAÇÃO CONCLUÍDA: Todas as associações foram aplicadas com sucesso."
    );
    process.exit(0);
  } catch (error) {
    console.error(
      "\n🛑 FALHA NA VERIFICAÇÃO DAS ASSOCIAÇÕES. Corrija o modelo e tente novamente."
    );
    // Exibe a mensagem de erro que foi gerada dentro do applyAssociations
    console.error((error as Error).message);
    process.exit(1);
  }
}

runAssociationCheck();
