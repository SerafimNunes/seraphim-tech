import * as fs from "fs/promises";
import * as path from "path";
import * as process from "process"; // Importação explícita para clareza

// ====================================================================
// 1. Configuração e Mapeamento
// ====================================================================

// Pasta de saída para todos os arquivos de domínio
const OUTPUT_DIR = path.join(process.cwd(), "backup_dominios");

// Diretorios de origem (apenas src/*)
const DIRS_TO_PROCESS = [
  "src/models",
  "src/controllers",
  "src/services",
  "src/routes",
  "src/Middlewares",
  "src/config",
  "src/tests",
];
// Arquivos de configuração/infraestrutura de nível superior
const ADDITIONAL_FILES = ["src/index.ts"];

// Apenas arquivos .ts e .js (embora a estrutura seja majoritariamente .ts)
const EXTENSIONS_TO_INCLUDE = [".ts"];

// Mapeamento dos domínios com REGEX refinado
// ORDEM É CRUCIAL (o primeiro match é o que prevalece)
const DOMAIN_MAP = [
  // Módulos Transacionais de Negócio (Prioridade Alta)
  { name: "VENDAS", regex: /(Venda|Comanda|Mesa|VendaItem)/i },
  { name: "ESTOQUE", regex: /(Estoque|ItemEstoque|Contagem|Movimento)/i },
  { name: "PRODUÇÃO", regex: /(Producao|FichaTecnica)/i },
  { name: "COMPRAS", regex: /(Compras|Fornecedor)/i },
  { name: "RH", regex: /(RH|Cargo|Colaborador|Escala)/i },
  { name: "FINANCEIRO/CAIXA", regex: /(Caixa|Lancamento)/i },
  { name: "FISCAL", regex: /(Fiscal|RegistroFiscal)/i },

  // Módulos de Infraestrutura e Suporte
  {
    name: "SEGURANÇA/AUTH",
    regex: /(auth|rbac|AuthService|authMiddleware|rbacMiddleware)/i,
  },
  { name: "TESTES", regex: /(tests|test\.ts)/i },
  {
    name: "CONFIGURAÇÃO/INFRA",
    regex: /(config|database|sequelize|index|types|associations)/i,
  },
  // O finalizador
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

/**
 * Funções auxiliares para leitura e processamento de arquivos.
 */
async function processDirectory(dirPath: string): Promise<FileContent[]> {
  const fileContents: FileContent[] = [];
  try {
    const absolutePath = path.resolve(process.cwd(), dirPath);
    const files = await fs.readdir(absolutePath, { withFileTypes: true });

    for (const dirent of files) {
      if (dirent.isFile()) {
        const fullFilePath = path.join(absolutePath, dirent.name);
        const relativeFilePath = path.join(dirPath, dirent.name);
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
  } catch (error: any) {
    if (error.code === "ENOENT") {
      console.warn(`[AVISO] Diretório não encontrado, ignorando: ${dirPath}`);
    } else {
      throw error;
    }
  }
  return fileContents;
}

async function processFile(filePath: string): Promise<FileContent | null> {
  try {
    const absolutePath = path.resolve(process.cwd(), filePath);
    const ext = path.extname(filePath).toLowerCase();

    if (EXTENSIONS_TO_INCLUDE.includes(ext)) {
      const content = await fs.readFile(absolutePath, "utf-8");
      return {
        path: filePath,
        content,
        domain: getFileDomain(filePath),
      };
    }
  } catch (error: any) {
    if (error.code === "ENOENT") {
      console.warn(`[AVISO] Arquivo não encontrado, ignorando: ${filePath}`);
    } else {
      throw error;
    }
  }
  return null;
}

/**
 * Função principal para gerar o backup dividido por domínio.
 */
async function generateDomainBackup() {
  const allFileContents: FileContent[] = [];

  // 1. Processar os diretórios
  for (const dir of DIRS_TO_PROCESS) {
    const contents = await processDirectory(dir);
    allFileContents.push(...contents);
  }

  // 2. Processar os arquivos adicionais
  for (const file of ADDITIONAL_FILES) {
    const content = await processFile(file);
    if (content) {
      allFileContents.push(content);
    }
  }

  // 3. Agrupar o conteúdo por domínio
  const groupedContent = allFileContents.reduce((acc, file) => {
    if (!acc[file.domain]) {
      acc[file.domain] = [];
    }
    acc[file.domain].push(file);
    return acc;
  }, {} as { [key: string]: FileContent[] });

  // 4. Criar a pasta de saída
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // 5. Escrever um arquivo TXT separado para cada domínio
  const domainOrder = DOMAIN_MAP.map((d) => d.name);
  let totalFiles = 0;

  for (const domainName of domainOrder) {
    const files = groupedContent[domainName];
    if (files && files.length > 0) {
      // Ordenar arquivos dentro de cada domínio por caminho para maior clareza
      files.sort((a, b) => a.path.localeCompare(b.path));

      let domainContent = `================================================================\n`;
      domainContent += `DOMÍNIO: ${domainName} (${files.length} ARQUIVOS)\n`;
      domainContent += `GERADO EM: ${new Date().toISOString()}\n`;
      domainContent += `================================================================\n\n`;

      for (const file of files) {
        domainContent += `\n\n////////////////////////////////////////////////////////\n`;
        domainContent += `// ARQUIVO: ${file.path}\n`;
        domainContent += `////////////////////////////////////////////////////////\n\n`;
        domainContent += file.content.trim() + "\n\n";
        totalFiles++;
      }

      const safeDomainName = domainName.replace(/[\/\\?%*:|"<>]/g, "_");
      const outputFilePath = path.join(OUTPUT_DIR, `${safeDomainName}.txt`);
      await fs.writeFile(outputFilePath, domainContent);
      console.log(
        `- Arquivo gerado para [${domainName}]: ${files.length} arquivos.`
      );
    }
  }

  console.log(
    `\n✅ Sucesso! Foram processados ${totalFiles} arquivos .ts em ${
      Object.keys(groupedContent).length
    } domínios.`
  );
  console.log(`Os backups estão na pasta: ${OUTPUT_DIR}`);
}

generateDomainBackup().catch((err) => {
  console.error("❌ Erro fatal durante a geração do backup:", err);
  process.exit(1);
});
