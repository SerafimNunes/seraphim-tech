# caixa/urls.py
from django.urls import path
from . import views
from django.views.generic import TemplateView # Importado para rota de relatório/consulta

# O namespace é fundamental para referências internas, como o redirect do decorator
app_name = 'caixa'

urlpatterns = [
    # 1. Home do PDV / Controle de Fluxo
    # Esta view verifica a sessão ativa e exibe a tela de PDV ou o formulário de Abertura.
    path('', views.pdv_home_view, name='pdv_home'), 

    # 2. Abertura de Sessão de Caixa
    # Nota: Esta view é chamada se a sessão não estiver ativa (pelo pdv_home_view)
    # path('abrir/', views.abrir_sessao_caixa_view, name='abrir_sessao'),
    # No entanto, como pdv_home_view lida com o fluxo, não precisa de uma URL separada por agora.

    # 3. Fechamento de Sessão de Caixa
    # Deve ser acessada por um link na tela do PDV ativo.
    path('fechar/', views.fechar_sessao_caixa_view, name='fechar_sessao'),
    
    # 4. Registro de Movimento Avulso (Sangria/Suprimento)
    # Rota usada principalmente via AJAX/POST.
    path('movimento/registrar/', views.registrar_movimento_avulso_view, name='registrar_movimento_avulso'),
    
    # [OPCIONAL] - Rota para Consultar Histórico de Caixas/Sessões Fechadas
    # Embora a view não tenha sido fornecida, adiciono o placeholder para o fluxo completo.
    path('historico/', TemplateView.as_view(template_name='caixa/historico_caixa.html'), name='historico_caixa'),
]
