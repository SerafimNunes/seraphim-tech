# core/models.py (VERSÃO COMPLETA E CORRIGIDA PARA AS TAREFAS #1 e #4)
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.contrib.auth.models import AbstractUser
# NOVO IMPORT CRÍTICO: Para o modelo Singleton
from django.core.exceptions import ValidationError

# ====================================================================
# 1. UNIDADE DE MEDIDA (Base para Estoque e Produtos)
# ====================================================================

class UnidadeMedida(models.Model):
    """
    Define unidades de medida genéricas (e.g., Kg, Litro, Unidade)
    utilizadas por outros modelos, como Produtos e Ingredientes.
    """
    nome = models.CharField(
        max_length=50,
        unique=True,
        verbose_name=_("Nome Completo (Ex: Quilograma)")
    )
    sigla = models.CharField(
        max_length=10,
        unique=True,
        verbose_name=_("Sigla (Ex: KG)")
    )

    class Meta:
        verbose_name = _("Unidade de Medida")
        verbose_name_plural = _("Unidades de Medida")
        ordering = ['nome']

    def __str__(self):
        return f"{self.nome} ({self.sigla})"

# ====================================================================
# 2. FORNECEDOR (Base para Compras)
# ====================================================================

class Fornecedor(models.Model):
    nome = models.CharField(_("Nome/Razão Social"), max_length=200, unique=True)
    cnpj = models.CharField(_("CNPJ"), max_length=18, blank=True, null=True, unique=True)
    contato_nome = models.CharField(_("Nome do Contato"), max_length=100, blank=True)
    telefone = models.CharField(_("Telefone"), max_length=20, blank=True)
    email = models.EmailField(_("Email"), max_length=100, blank=True)
    ativo = models.BooleanField(_("Ativo"), default=True)

    class Meta:
        verbose_name = _("Fornecedor")
        verbose_name_plural = _("Fornecedores")
        ordering = ['nome']

    def __str__(self):
        return self.nome

# ====================================================================
# 3. CLIENTE (Base para Vendas)
# ====================================================================

class Cliente(models.Model):
    nome = models.CharField(_("Nome Completo"), max_length=200)
    cpf_cnpj = models.CharField(_("CPF/CNPJ"), max_length=18, unique=True, blank=True, null=True)
    telefone = models.CharField(_("Telefone"), max_length=20, blank=True, null=True)
    email = models.EmailField(_("Email"), max_length=100, blank=True, null=True)
    endereco = models.CharField(_("Endereço"), max_length=255, blank=True, null=True)
    data_cadastro = models.DateTimeField(_("Data de Cadastro"), auto_now_add=True)

    class Meta:
        verbose_name = _("Cliente")
        verbose_name_plural = _("Clientes")
        ordering = ['nome']

    def __str__(self):
        return self.nome

# ====================================================================
# 4. CATEGORIA (NOVO - Base para Produtos/Insumos)
# ====================================================================

class Categoria(models.Model):
    """
    Define categorias para produtos e insumos, permitindo
    organização na ficha técnica, estoque e cardápio.
    """
    nome = models.CharField(
        max_length=100,
        unique=True,
        verbose_name=_("Nome da Categoria")
    )
    descricao = models.TextField(
        blank=True,
        verbose_name=_("Descrição da Categoria")
    )
    ativo = models.BooleanField(default=True)

    class Meta:
        verbose_name = _("Categoria")
        verbose_name_plural = _("Categorias")
        ordering = ['nome']

    def __str__(self):
        return self.nome

# ====================================================================
# 5. USUÁRIO CUSTOMIZADO (AUTH_USER_MODEL)
# ====================================================================

class Usuario(AbstractUser):
    """
    Modelo de Usuário customizado, estendendo AbstractUser.
    Adiciona campos específicos de ERP/restaurante.
    """

    telefone = models.CharField(_("Telefone de Contato"), max_length=15, blank=True, null=True)
    cpf = models.CharField(_("CPF"), max_length=14, unique=True, blank=True, null=True)

    # Campo para integração com o app 'caixa'
    sessao_caixa_ativa = models.ForeignKey(
        'caixa.SessaoCaixa',
        on_delete=models.SET_NULL,
        related_name='operadores_ativos',
        verbose_name=_("Sessão de Caixa Ativa"),
        null=True,
        blank=True
    )

    class Meta(AbstractUser.Meta):
        verbose_name = _('Usuário do Sistema')
        verbose_name_plural = _('Usuários do Sistema')

    def __str__(self):
        nome_completo = f"{self.first_name} {self.last_name}".strip()
        return nome_completo or self.username

# ====================================================================
# 6. CONFIGURAÇÃO GERAL (MODELO SINGLETON - TAREFA #4)
# ====================================================================

class ConfiguracaoGeral(models.Model):
    """
    Modelo Singleton para armazenar configurações globais do sistema e do restaurante.
    Garante que só exista uma instância no banco de dados.
    """
    nome_restaurante = models.CharField(_("Nome do Restaurante/Empresa"), max_length=100)
    cnpj = models.CharField(_("CNPJ"), max_length=18, unique=True, blank=True, null=True)
    endereco_completo = models.CharField(_("Endereço Completo"), max_length=255, blank=True, null=True)
    telefone = models.CharField(_("Telefone de Contato"), max_length=20, blank=True, null=True)

    # Configurações operacionais
    imprime_cupom_fiscal = models.BooleanField(_("Imprime Cupom Fiscal"), default=True)
    mensagem_cupom_fiscal = models.TextField(_("Mensagem de Rodapé do Cupom"), max_length=500, blank=True, null=True)

    data_ultima_edicao = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Configuração Geral do Sistema")
        verbose_name_plural = _("Configuração Geral do Sistema")

    def save(self, *args, **kwargs):
        """Impede a criação de mais de uma instância no banco."""
        # Se o PK não existe (é uma nova criação) E já existe outra instância
        if not self.pk and ConfiguracaoGeral.objects.exists():
            raise ValidationError("Só é permitida uma instância de Configuração Geral.")
        super(ConfiguracaoGeral, self).save(*args, **kwargs)

    def __str__(self):
        return f"Configurações de {self.nome_restaurante}"
