import sys

# 1. Tente importar 'config' (usando python-decouple ou similar)
try:
    from decouple import config
except ImportError:
    print("Erro: A biblioteca 'python-decouple' não está instalada.")
    print("Instale com: pip install python-decouple")
    sys.exit(1)

# 2. Tente importar 'psycopg2'
try:
    import psycopg2
except ImportError:
    print("Erro: O driver do PostgreSQL 'psycopg2' não está instalado.")
    print("Instale com: pip install psycopg2-binary")
    sys.exit(1)

print("--- Verificação de Configurações do Banco de Dados ---")

# 3. Carregue as credenciais usando a mesma lógica do settings.py
DB_HOST = config('DB_HOST', default='localhost')
DB_PORT = config('DB_PORT', default='5433')
DB_NAME = config('DB_NAME', default='chefia_db')
DB_USER = config('DB_USER', default='serafim-nunes')  # Usando o novo valor padrão
DB_PASSWORD = config('DB_PASSWORD', default='insecure-dev-pass')

# 4. Imprima as credenciais para verificação (SEM SENHA)
print(f"HOST: {DB_HOST}")
print(f"PORT: {DB_PORT}")
print(f"NAME: {DB_NAME}")
print(f"USER: {DB_USER}")
print("-" * 37)

# 5. Tente Conectar
try:
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        connect_timeout=5 # Tempo limite para não travar
    )
    conn.close()
    print("\n✅ SUCESSO! A conexão com o PostgreSQL funcionou perfeitamente.")
    print("O Django deve rodar agora.")

except psycopg2.OperationalError as e:
    print("\n❌ ERRO DE CONEXÃO OPERACIONAL (FATAL) ❌")
    print("Django OperationalError / Psycopg2 OperationalError")

    error_message = str(e)

    # Ajude a identificar o erro específico
    if "password authentication failed" in error_message:
        print(f"\nMotivo: FALHA NA AUTENTICAÇÃO DE SENHA para o usuário '{DB_USER}'.")
        print("Ação: Corrija a 'DB_PASSWORD' no seu arquivo '.env'.")
    elif "could not connect to server" in error_message:
        print("\nMotivo: Não foi possível conectar ao servidor. O PostgreSQL não está rodando ou HOST/PORTa estão errados.")
        print(f"Ação: Verifique se o PostgreSQL está ativo e se a porta ({DB_PORT}) está correta.")
    elif "database" in error_message and "does not exist" in error_message:
        print(f"\nMotivo: O banco de dados '{DB_NAME}' não existe.")
        print("Ação: Crie o banco de dados primeiro.")
    else:
        print(f"\nErro Original do PostgreSQL: {e}")

    sys.exit(1)
except Exception as e:
    print(f"\nErro Inesperado: {e}")
    sys.exit(1)
