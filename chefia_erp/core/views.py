# core/views.py

from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
import requests
import json
import os 
from django.db.models import Sum # Importa Sum para agregar valores, caso necessário
from decimal import Decimal

# Importar modelos dos módulos principais para o Dashboard (NOVIDADE)
from menu.models import ItemCardapio, CategoriaCardapio
from estoque.models import Produto
from core.models import Cliente, Fornecedor
# Vendas e Compras serão importados posteriormente, mas faremos a estrutura inicial

# =========================================================
# VISTAS BASE
# =========================================================

@login_required
def home(request):
    """
    View do Dashboard/Home do sistema.
    Coleta dados sumarizados para exibição no painel de controle.
    """
    # 1. Coleta de Dados Agregados (IMPLEMENTAÇÃO DO DASHBOARD)
    
    # Inicializa o contexto
    dashboard_context = {} 

    try:
        # --- Cardápio/Menu ---
        dashboard_context['total_itens_cardapio'] = ItemCardapio.objects.count()
        dashboard_context['total_categorias_ativas'] = CategoriaCardapio.objects.filter(ativa=True).count()
        
        # --- Estoque ---
        # Produtos que são vendáveis (vendidos no cardápio)
        dashboard_context['total_produtos_vendaveis'] = Produto.objects.filter(is_vendavel=True).count() 
        
        # Produtos com estoque baixo (critério simplificado: quantidade_atual < 10)
        # Nota: O campo quantidade_atual é um DecimalField, a comparação é precisa.
        dashboard_context['produtos_estoque_baixo'] = Produto.objects.filter(quantidade_atual__lt=Decimal('10.0000')).count()
        
        # --- Base de Dados (Core) ---
        dashboard_context['total_clientes'] = Cliente.objects.count()
        dashboard_context['total_fornecedores'] = Fornecedor.objects.count()

        # --- placeholders para futuro (vendas/compras) ---
        dashboard_context['total_vendas_hoje'] = 0 
        dashboard_context['ticket_medio'] = Decimal('0.00')

    except Exception as e:
        # Em caso de falha de DB ou Model não encontrado (apesar de termos rodado migrações), 
        # o Dashboard deve falhar de forma elegante. 
        # No momento, apenas ignoramos para permitir a renderização.
        print(f"Erro ao coletar dados para o Dashboard: {e}") 
        # Manter o contexto parcial para que o template possa tentar renderizar o que deu certo
        
    # 2. Renderização do template, passando o contexto
    return render(request, 'core/home.html', dashboard_context)


# Sugestão: Implementar view de registro de usuário (registro_usuario)
# Importações necessárias:
# from django.contrib.auth.forms import UserCreationForm
# from django.shortcuts import redirect
# from django.urls import reverse_lazy
# def registro_usuario(request):
#     ... (implementação)

# =========================================================
# INTEGRAÇÃO CHEFIA (LLM) - EAP 1.6.3
# =========================================================

@login_required
def api_chefia(request):
    """
    Endpoint para interagir com o modelo Gemini (ChefIA).
    Assume que a chamada é feita via AJAX (POST).
    """
    
    # CRÍTICO: Em um projeto real, a chave API NUNCA seria lida de forma não segura.
    # Assumimos que a chave está no ambiente ou em settings seguros.
    # Aqui, usaremos uma variável de ambiente simulada ou um valor fixo para a estrutura.
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "SUA_CHAVE_API_AQUI")
    
    if request.method == 'POST':
        try:
            # 1. Obter a consulta do usuário
            data = json.loads(request.body.decode('utf-8'))
            user_query = data.get('query', '')
            
            if not user_query:
                return JsonResponse({"error": "Consulta não fornecida."}, status=400)

            # 2. Configuração do Modelo e Endpoint
            API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent"
            
            # 3. Definição do System Instruction (Persona)
            system_prompt = (
                "Você é o ChefIA, um assistente especializado em gestão de restaurantes, "
                "estoque e finanças. Responda de forma concisa e utilize o Google Search "
                "para informações atuais, se aplicável."
            )

            # 4. Construção do Payload (com Google Search Tool)
            payload = {
                "contents": [{"parts": [{"text": user_query}]}],
                "tools": [{"google_search": {}}],  # Habilita o Google Search Grounding
                "systemInstruction": {"parts": [{"text": system_prompt}]},
            }

            headers = {
                'Content-Type': 'application/json'
            }
            
            # 5. Fazer a Requisição Externa
            # Nota: Em um ambiente de produção Django, isso deveria ser executado 
            # de forma assíncrona para evitar travar o thread (usando Celery ou Async Views).
            
            response = requests.post(
                f"{API_URL}?key={GEMINI_API_KEY}", 
                headers=headers, 
                json=payload
            )
            
            response.raise_for_status() # Lança exceção para códigos de erro HTTP
            
            # 6. Processar a Resposta
            api_result = response.json()
            
            # Tenta extrair o texto principal
            generated_text = api_result.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', 'Resposta não disponível.')
            
            # 7. Retornar o resultado para o frontend
            return JsonResponse({
                "response": generated_text,
                "sources": api_result.get('candidates', [{}])[0].get('groundingMetadata', {}).get('groundingAttributions', [])
            })

        except requests.exceptions.RequestException as e:
            return JsonResponse({"error": f"Erro de conexão com a API: {str(e)}"}, status=500)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Dados JSON inválidos na requisição."}, status=400)
        except Exception as e:
            return JsonResponse({"error": f"Erro interno: {str(e)}"}, status=500)
            
    return JsonResponse({"error": "Método não permitido."}, status=405)
