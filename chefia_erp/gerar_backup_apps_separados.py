import os
import datetime
from pathlib import Path
import shutil

# --- Configuração ---
# O script assume que está na pasta raiz do projeto Django (chefia_erp)
BASE_DIR = Path(os.path.dirname(os.path.abspath(__file__)))

# 🟢 CONFIGURAÇÃO CRÍTICA: Caminho de Salvamento Específico
USER_NAME = 'seraf'
OUTPUT_DIR_NAME = 'Backups_apps_separados'
# Caminho solicitado: C:\Users\seraf\OneDrive\Documentos\Backups_apps_separados
OUTPUT_BASE_DIR = Path(f"C:\\Users\\{USER_NAME}\\OneDrive\\Documentos") / OUTPUT_DIR_NAME

# Módulos (Apps Django) a serem incluídos no backup (Baseado na análise do ChefIA)
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

# Tipos de arquivos essenciais a serem salvos
ESSENTIAL_FILE_NAMES = (
    'models.py', 
    'views.py', 
    'services.py', # Crucial para a camada de serviço
    'signals.py', 
    'tests.py', 
    'admin.py', 
    'urls.py', 
    'apps.py',
    'tasks.py',
    'utils.py',
    'serializers.py',
    'api.py',
    '__init__.py', # Garante que o Python reconheça o módulo
)

# Arquivos e diretórios para IGNORAR (gerais)
IGNORE_ITEMS = ('venv', 'node_modules', '.git', '__pycache__', 'media', 'static', OUTPUT_DIR_NAME)


# --- Função Principal ---
def generate_module_backups():
    """Varre os módulos alvo e copia apenas os arquivos essenciais para uma pasta separada por app."""
    
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_folder_name = f'chefia_backup_{timestamp}'
    
    # Cria o diretório de destino principal (Ex: C:\Users\seraf\OneDrive\Documentos\Backups_apps_separados\chefia_backup_20251107_...)
    FINAL_OUTPUT_DIR = OUTPUT_BASE_DIR / backup_folder_name
    
    try:
        FINAL_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        print(f"ERRO DE PERMISSÃO: Não foi possível criar a pasta em {FINAL_OUTPUT_DIR}")
        print(f"Detalhes: {e}")
        return

    print(f"Iniciando backup segregado dos apps essenciais em: {FINAL_OUTPUT_DIR}")
    print("-" * 50)
    
    file_count = 0
    
    for module_name in TARGET_MODULES:
        module_path = BASE_DIR / module_name
        
        if not module_path.is_dir():
            print(f"AVISO: Módulo '{module_name}' não encontrado. Ignorando.")
            continue
            
        # Cria a pasta do módulo dentro do diretório de backup
        target_module_dir = FINAL_OUTPUT_DIR / module_name
        target_module_dir.mkdir(parents=True, exist_ok=True)
        
        print(f"Processando Módulo: {module_name}")
        
        # 1. Varre a pasta do módulo
        for root, dirs, files in os.walk(module_path):
            # Ignora subdiretórios comuns (ex: templates, media)
            dirs[:] = [d for d in dirs if d not in IGNORE_ITEMS and d not in ('templates', 'migrations')]

            for file_name in files:
                
                is_essential = False
                
                # Regra 1: É um dos arquivos essenciais (models.py, views.py, etc.)
                if file_name in ESSENTIAL_FILE_NAMES:
                    is_essential = True
                
                # Regra 2: É um arquivo de configuração (.py) dentro do config
                elif module_name == 'config' and file_name.endswith('.py'):
                    is_essential = True
                
                # Regra 3: É um arquivo de texto de governança
                elif file_name in ('rag.txt', 'README.md', 'requirements.txt'):
                    is_essential = True
                    
                if is_essential:
                    file_path = Path(root) / file_name
                    relative_root = Path(root).relative_to(module_path)
                    
                    # Define o caminho de destino, respeitando a estrutura de subpastas (ex: views/api.py)
                    target_sub_dir = target_module_dir / relative_root
                    target_sub_dir.mkdir(parents=True, exist_ok=True)
                    
                    target_path = target_sub_dir / file_name
                    
                    # Copia o arquivo
                    shutil.copy2(file_path, target_path)
                    file_count += 1
                    
    print("-" * 50)
    print("SUCESSO ABSOLUTO! Backup Segregado Concluído.")
    print(f"{file_count} arquivos essenciais foram copiados.")
    print(f"O backup está salvo em: {FINAL_OUTPUT_DIR}")
    print("Pronto para a análise focada em um único app!")
    print("-" * 50)


if __name__ == "__main__":
    generate_module_backups()