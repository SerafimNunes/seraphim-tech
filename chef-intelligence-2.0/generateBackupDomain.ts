import * as fs from "fs/promises";
import * as path from "path";

// Configuração dos Diretórios e Arquivos
const DIRS_TO_INCLUDE = [
  "src/models",
  "src/controllers",
  "src/services",
  "src/routes",
  "src/Middlewares", // Adicionado Middlewares
  "src/config", // Adicionado Config
];
const ADDITIONAL_FILES = [
  "src/index.ts", // Mantido o principal
];
const OUTPUT_FILE = "codigo_fonte_backup_por_dominio.txt";
const EXTENSIONS_TO_INCLUDE = [".js", ".ts"];

// Mapeamento dos domínios com base no nome do arquivo
// O primeiro match de regex define o domínio
const DOMAIN_MAP = [
  {
    name: "AUTENTICAÇÃO/SEGURANÇA",
    regex: /(auth|rbac|User|AuthService|authMiddleware|rbacMiddleware)/i,
  },
  { name: "CAIXA/FINANCEIRO", regex: /(Caixa|Lancamento)/i },
  { name: "ESTOQUE", regex: /(Estoque|ItemEstoque|Contagem|Movimento)/i },
  { name: "FICHA TÉCNICA", regex: /(FichaTecnica)/i },
  { name: "PRODUÇÃO", regex: /(Producao|FichaTecnica)/i },
  { name: "VENDAS", regex: /(Venda|Comanda|Mesa|Item)/i },
  {
    name: "CONFIGURAÇÃO/INFRA",
    regex: /(config|database|sequelize|index|types|associations)/i,
  },
  // Deve ser o último
  { name: "OUTROS/GERAL", regex: /./i },
];

interface FileContent {
  path: string;
  content: string;
  domain: string;
}

/**
 * Determina o domínio de negócio de um arquivo com base no seu nome e caminho.
 * @param relativePath Caminho relativo do arquivo (e.g., 'src/models/VendaComanda.ts')
 */
function getFileDomain(relativePath: string): string {
  const fileName = path.basename(relativePath);

  for (const domain of DOMAIN_MAP) {
    if (domain.regex.test(fileName) || domain.regex.test(relativePath)) {
      return domain.name;
    }
  }
  return "OUTROS/GERAL";
}

async function generateDomainBackup() {
  const backupPath = path.resolve(process.cwd(), OUTPUT_FILE);
  const fileContents: FileContent[] = [];

  // Função auxiliar para processar um diretório ou arquivo
  const processPath = async (itemPath: string) => {
    try {
      const absolutePath = path.resolve(process.cwd(), itemPath);
      const stat = await fs.stat(absolutePath);

      if (stat.isDirectory()) {
        // Se for um diretório, lê recursivamente (apenas 1 nível)
        const files = await fs.readdir(absolutePath, { withFileTypes: true });

        for (const dirent of files) {
          if (dirent.isFile()) {
            const fullFilePath = path.join(absolutePath, dirent.name);
            const relativeFilePath = path.join(itemPath, dirent.name);
            const ext = path.extname(dirent.name).toLowerCase();

            if (EXTENSIONS_TO_INCLUDE.includes(ext)) {
              const content = await fs.readFile(fullFilePath, "utf-8");
              fileContents.push({
                path: relativeFilePath,
                content,
                domain: getFileDomain(relativeFilePath),
              });
            }
          }
        }
      } else if (stat.isFile()) {
        // Se for um arquivo adicional (como index.ts)
        const ext = path.extname(itemPath).toLowerCase();
        if (EXTENSIONS_TO_INCLUDE.includes(ext)) {
          const content = await fs.readFile(absolutePath, "utf-8");
          fileContents.push({
            path: itemPath,
            content,
            domain: getFileDomain(itemPath),
          });
        }
      }
    } catch (error: any) {
      // Ignora caminhos que não existem
      if (error.code === "ENOENT") {
        console.warn(`[AVISO] Caminho não encontrado, ignorando: ${itemPath}`);
      } else {
        throw error;
      }
    }
  };

  // 1. Processar os diretórios e arquivos adicionais
  for (const dir of DIRS_TO_INCLUDE) {
    await processPath(dir);
  }
  for (const file of ADDITIONAL_FILES) {
    await processPath(file);
  }

  // 2. Montar o conteúdo final
  let fullContent = `================================================================\n`;
  fullContent += `BACKUP DO CÓDIGO FONTE AGRUPADO POR DOMÍNIO (${new Date().toISOString()})\n`;
  fullContent += `================================================================\n\n`;

  // Agrupar e Ordenar
  const groupedContent = fileContents.reduce((acc, file) => {
    if (!acc[file.domain]) {
      acc[file.domain] = [];
    }
    acc[file.domain].push(file);
    return acc;
  }, {} as { [key: string]: FileContent[] });

  // Definir uma ordem de exibição para os domínios
  const domainOrder = DOMAIN_MAP.map((d) => d.name);

  for (const domainName of domainOrder) {
    const files = groupedContent[domainName];
    if (files && files.length > 0) {
      // Ordenar arquivos dentro de cada domínio por caminho para maior clareza
      files.sort((a, b) => a.path.localeCompare(b.path));

      fullContent += `\n\n########################################################\n`;
      fullContent += `# DOMÍNIO: ${domainName} (${files.length} ARQUIVOS)\n`;
      fullContent += `########################################################\n`;

      for (const file of files) {
        fullContent += `\n\n========================================\n`;
        fullContent += `ARQUIVO: ${file.path}\n`;
        fullContent += `========================================\n\n`;
        fullContent += file.content.trim() + "\n\n";
      }
      fullContent += `\n######################## FIM DO DOMÍNIO ${domainName} ########################\n`;
    }
  }

  // 3. Escrever o arquivo de backup
  await fs.writeFile(backupPath, fullContent);

  console.log(`\n✅ Sucesso! O backup completo foi gerado em: ${OUTPUT_FILE}`);
  console.log(`Por favor, anexe o arquivo ${OUTPUT_FILE} na próxima mensagem.`);
}

generateDomainBackup().catch((err) => {
  console.error("❌ Erro fatal durante a geração do backup:", err);
  process.exit(1);
});
