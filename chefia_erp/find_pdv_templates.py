import os
import sys

def find_pdv_templates(root_dir="."):
    """
    Busca por arquivos .html que contenham 'pdv' no nome do arquivo 
    ou no seu conteúdo, a partir do diretório raiz.
    """
    # Acessa o diretório raiz do projeto (onde o script deve ser executado)
    root_dir = os.path.abspath(root_dir)
    print(f"Iniciando busca por templates de PDV em '{root_dir}'...")
    
    # Palavra-chave a ser procurada (minúsculas)
    keyword = "pdv"
    found_files = []
    
    # Percorre recursivamente todos os diretórios e arquivos
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Ignora diretórios virtuais, git, cache, e o próprio Django Admin para acelerar a busca e evitar ruído
        if 'venv' in dirnames:
            dirnames.remove('venv') 
        if '.git' in dirnames:
            dirnames.remove('.git')
        if '__pycache__' in dirnames:
            dirnames.remove('__pycache__')
        if 'admin' in dirnames and dirpath.endswith('django/contrib'):
            # Ignora os templates internos do Django Admin
            dirnames.remove('admin')
        
        # Percorre os arquivos na pasta atual
        for filename in filenames:
            if filename.endswith('.html'):
                full_path = os.path.join(dirpath, filename)
                
                # 1. Checa se a palavra-chave está no nome do arquivo
                if keyword in filename.lower():
                    found_files.append((full_path, "Nome do Arquivo"))
                    continue
                
                # 2. Checa se a palavra-chave está no conteúdo do arquivo
                try:
                    with open(full_path, 'r', encoding='utf-8') as f:
                        # Lê apenas o início do arquivo para maior velocidade (ex: primeiros 5KB)
                        content = f.read(5 * 1024).lower() 
                        if keyword in content:
                            found_files.append((full_path, "Conteúdo do Arquivo"))
                except Exception:
                    # Ignora arquivos que não puderam ser lidos (ex: problemas de permissão/codificação)
                    pass

    # Imprime os resultados
    if found_files:
        print("\n--- ARQUIVOS DE TEMPLATE PDV POTENCIAIS ENCONTRADOS: ---")
        for path, reason in found_files:
            # Imprime o caminho relativo à raiz do projeto para melhor visualização
            relative_path = os.path.relpath(path, root_dir)
            print(f"- {relative_path} (Encontrado no: {reason})")
        print("-" * 50)
        print("Verifique os arquivos listados. Eles podem ser templates antigos da Fase 2.")
    else:
        print("\nNenhum arquivo .html contendo 'pdv' no nome ou conteúdo foi encontrado.")

# Executa a função
if __name__ == "__main__":
    find_pdv_templates()
