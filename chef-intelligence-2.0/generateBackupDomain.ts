import * as fs from 'fs/promises';
import * as path from 'path';
import * as process from 'process';

// ====================================================================
// 1. Configuração e Mapeamento
// ====================================================================

// Pasta de saída para todos os arquivos de domínio
const OUTPUT_DIR = path.join(process.cwd(), 'backup_dominios');

// Diretorios de origem (apenas src/*)
const DIRS_TO_PROCESS = [
  'src/models',
  'src/controllers',
  'src/services',
  'src/routes',
  'src/Middlewares',
  'src/config',
  'src/tests',
];
// Arquivos de configuração/infraestrutura de nível superior
const ADDITIONAL_FILES = ['src/index.ts'];

// Apenas arquivos .ts
const EXTENSIONS_TO_INCLUDE = ['.ts'];

// Mapeamento dos domínios com REGEX refinado
// ORDEM É CRUCIAL (o primeiro match é o que prevalece)
const DOMAIN_MAP = [
  // Módulos Transacionais de Negócio (Prioridade Alta)
  // GPR-1: VENDAS inclui tudo relacionado a Comanda e Mesa
  { name: 'VENDAS', regex: /(Venda|Comanda|Mesa|VendaItem|Comissao|Imposto)/i },
  {
    name: 'ESTOQUE',
    regex: /(Estoque|ItemEstoque|Contagem|Movimento|Requisicao)/i,
  },
  { name: 'PRODUÇÃO', regex: /(Producao|FichaTecnica|Registro|Perda|Insumo)/i },
  { name: 'COMPRAS', regex: /(Compra|Fornecedor|Necessidade)/i },
  { name: 'RH', regex: /(RH|Cargo|Colaborador|Escala)/i },
  {
    name: 'FINANCEIRO/CAIXA',
    regex: /(Custo|Caixa|Lancamento|ContaContabil)/i,
  },
  { name: 'FISCAL', regex: /(Fiscal|RegistroFiscal|Cupom|DocumentoContabil)/i }, // GPR-1: Incluindo "Usuario" em uma categoria mais geral se for de autenticação, caso contrário "ANALÍTICO"
  {
    name: 'ANALÍTICO',
    regex: /(FeedBack|Analise|IAAnalise|Planejamento)/i,
  }, // Módulos de Infraestrutura e Suporte

  {
    name: 'SEGURANÇA/AUTH',
    regex:
      /(auth|rbac|AuthService|authMiddleware|rbacMiddleware|Usuario|Permissao)/i,
  },
  { name: 'TESTES', regex: /(tests|test\.ts)/i },
  {
    name: 'CONFIGURAÇÃO/INFRA',
    regex: /(config|database|sequelize|index|types|associations|Unidade)/i,
  }, // O finalizador (Catch-all)
  { name: 'OUTROS/GERAL', regex: /./i },
];

interface FileContent {
  path: string;
  content: string;
  domain: string; // Novo campo para o subdiretório original (e.g., 'models', 'controllers')
  subdir: string;
}

interface DomainGroupedContent {
  [domain: string]: {
    [subdir: string]: FileContent[];
  };
}

/**
 * Determina o domínio de negócio de um arquivo com base no seu nome e caminho.
 * @param relativePath Caminho relativo do arquivo (e.g., 'src/models/VendaComanda.ts')
 */
function getFileDomain(relativePath: string): string {
  const fileName = path.basename(relativePath);

  for (const domain of DOMAIN_MAP) {
    // Testa tanto o nome do arquivo quanto o caminho completo
    if (domain.regex.test(fileName) || domain.regex.test(relativePath)) {
      return domain.name;
    }
  }
  return 'OUTROS/GERAL';
}

/**
 * Extrai o subdiretório original do arquivo (e.g., 'models' de 'src/models/Arquivo.ts').
 */
function getSubDir(relativePath: string): string {
  const parts = relativePath.split(path.sep); // Se for um arquivo de nível superior (ex: src/index.ts)
  if (parts.length <= 2) {
    return 'RAIZ';
  } // Retorna o segundo elemento após 'src/'
  return parts[1];
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
        const fullFilePath = path.join(absolutePath, dirent.name); // Caminho relativo para categorização e estrutura de backup
        const relativeFilePath = path.join(dirPath, dirent.name);
        const ext = path.extname(dirent.name).toLowerCase();

        if (EXTENSIONS_TO_INCLUDE.includes(ext)) {
          const content = await fs.readFile(fullFilePath, 'utf-8');
          fileContents.push({
            path: relativeFilePath,
            content,
            domain: getFileDomain(relativeFilePath),
            subdir: getSubDir(relativeFilePath), // Captura o subdiretório
          });
        }
      }
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
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
      const content = await fs.readFile(absolutePath, 'utf-8');
      return {
        path: filePath,
        content,
        domain: getFileDomain(filePath),
        subdir: getSubDir(filePath),
      };
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.warn(`[AVISO] Arquivo não encontrado, ignorando: ${filePath}`);
    } else {
      throw error;
    }
  }
  return null;
}

/**
 * Função principal para gerar o backup dividido por domínio e subdiretório.
 */
async function generateDomainBackup() {
  const allFileContents: FileContent[] = []; // 1. Processar os diretórios

  for (const dir of DIRS_TO_PROCESS) {
    const contents = await processDirectory(dir);
    allFileContents.push(...contents);
  } // 2. Processar os arquivos adicionais

  for (const file of ADDITIONAL_FILES) {
    const content = await processFile(file);
    if (content) {
      allFileContents.push(content);
    }
  } // 3. Agrupar o conteúdo por domínio e subdiretório (e.g., 'VENDAS' -> 'models')

  const groupedContent: DomainGroupedContent = allFileContents.reduce(
    (acc, file) => {
      const safeDomainName = file.domain.replace(/[\/\\?%*:|"<>]/g, '_');
      if (!acc[safeDomainName]) {
        acc[safeDomainName] = {};
      }
      if (!acc[safeDomainName][file.subdir]) {
        acc[safeDomainName][file.subdir] = [];
      }
      acc[safeDomainName][file.subdir].push(file);
      return acc;
    },
    {} as DomainGroupedContent,
  ); // 4. Criar a pasta de saída

  await fs.mkdir(OUTPUT_DIR, { recursive: true }); // 5. Escrever cada arquivo no caminho correto

  let totalFiles = 0; // Itera sobre os domínios na ordem definida
  const domainKeys = DOMAIN_MAP.map((d) =>
    d.name.replace(/[\/\\?%*:|"<>]/g, '_'),
  );

  for (const safeDomainName of domainKeys) {
    const domainGroup = groupedContent[safeDomainName];
    if (!domainGroup) continue;

    const domainPath = path.join(OUTPUT_DIR, safeDomainName); // Itera sobre os subdiretórios (models, controllers, services, etc.)
    for (const subdir in domainGroup) {
      const files = domainGroup[subdir];
      const subdirPath = path.join(domainPath, subdir); // Cria a pasta aninhada (Domínio/Subdiretorio)

      await fs.mkdir(subdirPath, { recursive: true }); // Escreve cada arquivo individualmente

      for (const file of files) {
        const outputFileName = path.basename(file.path) + '.txt';
        const outputFilePath = path.join(subdirPath, outputFileName);
        let fileContent = `////////////////////////////////////////////////////////\n`;
        fileContent += `// DOMÍNIO: ${file.domain}\n`;
        fileContent += `// SUBDIRETÓRIO: ${file.subdir}\n`;
        fileContent += `// CAMINHO ORIGINAL: ${file.path}\n`;
        fileContent += `////////////////////////////////////////////////////////\n\n`;
        fileContent += file.content.trim() + '\n';
        await fs.writeFile(outputFilePath, fileContent);
        totalFiles++;
      }
    }
    console.log(
      `- Pasta gerada para [${safeDomainName}]: ${Object.values(domainGroup).flat().length} arquivos.`,
    );
  }

  console.log(
    `\n✅ Sucesso! Foram processados ${totalFiles} arquivos .ts, estruturados por domínio e subdiretório.`,
  );
  console.log(`Os backups estão na pasta: ${OUTPUT_DIR}`);
}

generateDomainBackup().catch((err) => {
  console.error('❌ Erro fatal durante a geração do backup:', err);
  process.exit(1);
});
