import os
import datetime
from pathlib import Path
import shutil
from typing import List

# --- Configuração ---
# O script assume que está na pasta raiz do projeto Django (chefia_erp)
BASE_DIR = Path(os.path.dirname(os.path.abspath(__file__)))

# 🟢 CONFIGURAÇÃO CRÍTICA: Caminho de Salvamento Específico
# ATENÇÃO: Verifique se este caminho existe e se o usuário tem permissão de escrita.
USER_NAME = 'seraf'
OUTPUT_DIR_NAME = 'Backups_apps_para_analise' # Nome da pasta alterado para clareza
OUTPUT_BASE_DIR = Path(f"C:\\Users\\{USER_NAME}\\OneDrive\\Documentos") / OUTPUT_DIR_NAME

# Módulos (Apps Django) a serem incluídos no backup
TARGET_MODULES = [
    'caixa',
    'compras',
    'contabil',
    'core',
    'estoque',
    'financeiro',
    'menu',
    'producao',
    'vendas',
    'config' # Pasta de configuração crítica
]

# Tipos de arquivos essenciais a serem incluídos no relatório
ESSENTIAL_FILE_NAMES = (
    'models.py',
    'views.py',
    'services.py',
    'signals.py',
    'tests.py',
    'admin.py',
    'urls.py',
    'apps.py',
    'tasks.py',
    'utils.py',
    'serializers.py',
    'api.py',
    '__init__.py',
)

# Arquivos e diretórios para IGNORAR (gerais)
IGNORE_ITEMS = ('venv', 'node_modules', '.git', '__pycache__', 'media', 'static', OUTPUT_DIR_NAME)


def _scan_module_files(module_path: Path) -> List[Path]:
    """Varre a pasta do módulo e retorna a lista de caminhos de arquivos essenciais."""
    
    essential_files = []
    
    for root, dirs, files in os.walk(module_path):
        # Ignora subdiretórios comuns (evita recursão em 'templates', 'migrations', etc.)
        dirs[:] = [d for d in dirs if d not in IGNORE_ITEMS and d not in ('templates', 'migrations')]

        for file_name in files:
            file_path = Path(root) / file_name
            is_essential = False

            # Regra 1: É um dos arquivos essenciais (models.py, views.py, etc.)
            if file_name in ESSENTIAL_FILE_NAMES:
                is_essential = True

            # Regra 2: É um arquivo de configuração (.py) dentro do config
            # Verifica se o caminho base é a pasta 'config' e é um arquivo Python
            if module_path.name == 'config' and file_name.endswith('.py'):
                 is_essential = True

            # Regra 3: É um arquivo de texto de governança na raiz do módulo
            elif file_name in ('rag.txt', 'README.md', 'requirements.txt') and file_path.parent == module_path:
                is_essential = True
            
            # Adiciona arquivos .py genéricos em subpastas (ex: utils/helper.py)
            elif file_name.endswith('.py') and file_path.relative_to(module_path).parts[:-1]:
                 is_essential = True
                 
            if is_essential:
                essential_files.append(file_path)
    
    return sorted(essential_files)


def _generate_report_content(module_name: str, file_paths: List[Path], module_path: Path) -> str:
    """Gera o conteúdo completo do relatório em formato Markdown para o módulo."""
    
    report_content = []
    
    # 1. CABEÇALHO DO RELATÓRIO (Metadados)
    report_content.append(f"# MÓDULO DE ANÁLISE: {module_name.upper()}")
    report_content.append(f"")
    report_content.append(f"**Data de Geração:** {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report_content.append(f"**Caminho Base do Módulo:** {module_path.resolve()}")
    report_content.append(f"**Total de Arquivos Incluídos:** {len(file_paths)}")
    report_content.append(f"")
    
    # 2. ÍNDICE DOS ARQUIVOS (Sumário)
    report_content.append("## 📄 Índice de Arquivos Inclusos")
    for i, file_path in enumerate(file_paths):
        relative_path = file_path.relative_to(module_path)
        report_content.append(f"{i+1}. [`{relative_path}`](#{relative_path.name.replace('.', '').replace('/', '').lower()})")
    report_content.append("\n---\n")
    
    # 3. CONTEÚDO AGREGADO DE CADA ARQUIVO
    for file_path in file_paths:
        relative_path = file_path.relative_to(module_path)
        anchor_name = relative_path.name.replace('.', '').replace('/', '').lower()
        
        # Título do Arquivo
        report_content.append(f"## ⚙️ Arquivo: `{relative_path}`")
        report_content.append(f"<a id=\"{anchor_name}\"></a>")
        
        try:
            # Leitura do conteúdo
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Adiciona o conteúdo do arquivo em um bloco de código Python
            report_content.append("```python")
            report_content.append(content.strip())
            report_content.append("```")
            
        except Exception as e:
            report_content.append(f"***ERRO AO LER ARQUIVO: {e}***")
            
        report_content.append("\n---\n") # Separador visual entre arquivos
        
    return "\n".join(report_content)


# --- Função Principal ---
def generate_module_backups():
    """Gera um único relatório Markdown por módulo, agregando todos os arquivos essenciais."""
    
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_folder_name = f'chefia_analysis_report_{timestamp}'
    
    # Cria o diretório de destino principal
    FINAL_OUTPUT_DIR = OUTPUT_BASE_DIR / backup_folder_name
    
    try:
        FINAL_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        print(f"ERRO DE PERMISSÃO: Não foi possível criar a pasta em {FINAL_OUTPUT_DIR}")
        print(f"Detalhes: {e}")
        return

    print(f"Iniciando a GERAÇÃO DO RELATÓRIO DE ANÁLISE em: {FINAL_OUTPUT_DIR}")
    print("-" * 70)
    
    reports_generated = 0
    total_files = 0
    
    for module_name in TARGET_MODULES:
        module_path = BASE_DIR / module_name
        
        if not module_path.is_dir():
            print(f"AVISO: Módulo '{module_name}' não encontrado no caminho: {module_path}. Ignorando.")
            continue
            
        # 1. Encontra os arquivos essenciais
        file_paths = _scan_module_files(module_path)
        
        if not file_paths:
             print(f"INFO: Módulo '{module_name}' não possui arquivos essenciais. Ignorando.")
             continue
        
        total_files += len(file_paths)
        
        # 2. Gera o conteúdo do relatório
        report_content = _generate_report_content(module_name, file_paths, module_path)
        
        # 3. Salva o relatório em Markdown
        report_filename = f"{module_name.lower()}_ANALYSIS.md"
        report_path = FINAL_OUTPUT_DIR / report_filename
        
        try:
            with open(report_path, 'w', encoding='utf-8') as f:
                f.write(report_content)
                reports_generated += 1
                print(f"✅ RELATÓRIO GERADO: {report_filename} ({len(file_paths)} arquivos)")
        except Exception as e:
             print(f"ERRO CRÍTICO ao salvar o relatório {report_filename}: {e}")
        
    print("-" * 70)
    print("SUCESSO ABSOLUTO! Geração de Relatórios de Análise Concluída.")
    print(f"Relatórios gerados: {reports_generated} (cobrem {total_files} arquivos de código).")
    print(f"O backup está salvo em: {FINAL_OUTPUT_DIR}")
    print("Para a análise, basta copiar o conteúdo de cada arquivo .md e colar aqui.")
    print("-" * 70)


if __name__ == "__main__":
    generate_module_backups()