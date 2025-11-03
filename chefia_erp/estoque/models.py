# estoque/models.py (Versão Mesclada e Atualizada)
from django.db import models
from django.utils.translation import gettext_lazy as _
# ATUALIZAÇÃO: Importa Categoria e Usuario (Responsável)
from core.models import UnidadeMedida, Fornecedor, Cliente, Categoria, Usuario
from decimal import Decimal
from django.db.models import F # Importado para uso futuro no F-expression
from django.core.exceptions import ValidationError

# Tipos de Movimento de Estoque para rastreabilidade
TIPOS_MOVIMENTO = (
    ('ENTRADA_COMPRA', _('Entrada por Compra')),
    ('ENTRADA_PRODUCAO', _('Entrada de Produto Acabado')),
    ('ENTRADA_AJUSTE', _('Entrada por Ajuste/Inventário')),
    ('SAIDA_VENDA', _('Saída por Venda')),
    ('SAIDA_PRODUCAO', _('Saída para Produção (Insumo)')),
    ('SAIDA_AJUSTE', _('Saída por Perda/Inventário')),
)

# Status para o modelo RequisicaoEstoque
STATUS_REQUISICAO = (
    ('PENDENTE', _('Pendente')),
    ('PARCIAL', _('Parcialmente Atendida')),
    ('ATENDIDA', _('Atendida')),
    ('CANCELADA', _('Cancelada')),
)

# Status para os modelos de Auditoria e Contagem
STATUS_AUDITORIA = (
    ('PENDENTE', _('Pendente')),
    ('CONCLUIDA', _('Concluída')),
    ('CANCELADA', _('Cancelada')),
)


class Produto(models.Model):
    """
    Representa um item físico gerenciado no estoque (Insumo, Pré-Pronto ou Acabado).
    """

    # CAMPOS DO PASSO 1.1
    categoria = models.ForeignKey(
        Categoria,
        on_delete=models.PROTECT,
        verbose_name=_("Categoria do Produto"),
        help_text=_("Define a organização na Ficha Técnica e Relatórios de Estoque.")
    )

    is_pre_pronto = models.BooleanField(
        default=False,
        verbose_name=_("É Pré-Pronto/Produto Intermediário?"),
        help_text=_("Marcar se este produto é feito internamente e usado como insumo em outros produtos finais.")
    )

    # Nome e Descrição
    nome = models.CharField(max_length=255, verbose_name=_("Nome do Produto"))
    descricao = models.TextField(blank=True, verbose_name=_("Descrição Detalhada"))

    # Unidade de Medida
    unidade_medida = models.ForeignKey(UnidadeMedida, on_delete=models.PROTECT, verbose_name=_("Unidade de Medida"))

    # Status de Venda
    is_vendavel = models.BooleanField(
        default=False,
        verbose_name=_("Pode ser Vendido (Exibido no Cardápio)"),
        help_text=_("Marcar se este produto pode ser vendido diretamente no PDV (Item de Cardápio).")
    )

    # --- Campos de Controle CRÍTICOS (CMP) ---

    # Saldo e Estoque
    quantidade_atual = models.DecimalField(
        max_digits=15, decimal_places=3, default=Decimal('0.000'), editable=False,
        verbose_name=_("Saldo Atual"),
        help_text=_("Saldo calculado do estoque. Não editável diretamente.")
    )
    estoque_minimo = models.DecimalField(
        max_digits=15, decimal_places=3, default=Decimal('0.000'),
        verbose_name=_("Estoque Mínimo"),
        help_text=_("Quantidade mínima para disparar Ordem de Produção/Compra.")
    )

    # Custo e Preço
    custo_medio_ponderado = models.DecimalField(
        max_digits=15, decimal_places=4, default=Decimal('0.0000'), editable=False,
        verbose_name=_("Custo Médio Ponderado"),
        help_text=_("Custo Médio Ponderado (CMP) calculado com 4 casas decimais.")
    )
    preco_custo = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00'),
        verbose_name=_("Preço de Custo Padrão"),
        help_text=_("Custo unitário (arredondamento do CMP para 2 casas). É o custo padrão de exibição.")
    )
    preco_venda = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00'),
        verbose_name=_("Preço de Venda")
    )

    # Metadados
    ativo = models.BooleanField(default=True, verbose_name=_("Ativo no Sistema"))
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_ultima_edicao = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("Produto")
        verbose_name_plural = _("Produtos")
        ordering = ['nome']

    def __str__(self):
        return f"{self.nome} ({self.unidade_medida.sigla})"


# ====================================================================
# MODELO: REQUISIÇÃO DE ESTOQUE (Passo 1.2)
# ====================================================================
class RequisicaoEstoque(models.Model):
    """
    Representa uma solicitação de insumos ou produtos pré-prontos
    feita pela produção/cozinha ao estoque.
    """
    
    # Rastreabilidade e Status
    data_requisicao = models.DateTimeField(auto_now_add=True, verbose_name=_("Data da Requisição"))
    status = models.CharField(
        max_length=10,
        choices=STATUS_REQUISICAO,
        default='PENDENTE',
        verbose_name=_("Status da Requisição")
    )
    
    # Usuários (FKs para core.Usuario) - Nomenclatura Padrão 'responsavel'
    solicitante = models.ForeignKey(
        Usuario,
        on_delete=models.PROTECT,
        related_name='requisicoes_solicitadas',
        verbose_name=_("Solicitante (Produção/Cozinha)")
    )
    responsavel_atendimento = models.ForeignKey(
        Usuario,
        on_delete=models.SET_NULL,
        related_name='requisicoes_atendidas',
        verbose_name=_("Responsável pelo Atendimento (Estoque)"),
        null=True, blank=True
    )
    
    # Produto e Quantidades
    produto = models.ForeignKey(
        Produto,
        on_delete=models.PROTECT,
        verbose_name=_("Produto Requisitado")
    )
    
    quantidade_requisitada = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        verbose_name=_("Quantidade Requisitada")
    )
    
    quantidade_entregue = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=Decimal('0.000'),
        verbose_name=_("Quantidade Entregue"),
        help_text=_("Quantidade efetivamente liberada e registrada como SAÍDA no estoque.")
    )
    
    observacoes = models.TextField(blank=True, null=True, verbose_name=_("Observações do Solicitante"))
    
    # Campo para vincular ao movimento de saída que esta requisição gerou
    movimento_saida = models.OneToOneField(
        'MovimentoEstoque',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='requisicao_origem',
        verbose_name=_("Movimento de Saída Gerado")
    )

    class Meta:
        verbose_name = _("Requisição de Estoque")
        verbose_name_plural = _("Requisições de Estoque")
        ordering = ['data_requisicao']
        
    def __str__(self):
        return f"Req #{self.pk} - {self.produto.nome} ({self.get_status_display()})"


# ====================================================================
# NOVO MODELO: AUDITORIA DE INVENTÁRIO (INSUMOS) (Passo 1.3)
# ====================================================================
class AuditoriaInventario(models.Model):
    """
    Modelo para registrar a contagem cega de insumos/matéria-prima.
    Gera um movimento de ajuste de estoque (entrada ou saída) ao ser concluída.
    """
    data_auditoria = models.DateTimeField(auto_now_add=True, verbose_name=_("Data da Auditoria"))
    data_conclusao = models.DateTimeField(null=True, blank=True, verbose_name=_("Data de Conclusão"))
    
    status = models.CharField(
        max_length=10,
        choices=STATUS_AUDITORIA,
        default='PENDENTE',
        verbose_name=_("Status da Auditoria")
    )
    
    # Rastreabilidade do Usuário (Nomenclatura Padrão 'responsavel')
    responsavel = models.ForeignKey(
        Usuario,
        on_delete=models.PROTECT,
        related_name='auditorias_inventario_realizadas',
        verbose_name=_("Responsável pela Contagem")
    )
    
    # Produto: Limitado apenas a Insumos/Matéria-Prima
    produto = models.ForeignKey(
        Produto,
        on_delete=models.PROTECT,
        # Limita as opções de escolha apenas para produtos que NÃO são pré-prontos
        limit_choices_to={'is_pre_pronto': False}, 
        verbose_name=_("Produto (Insumo) Contado")
    )

    # Campo Cego: O valor contado em campo, sem consultar o saldo atual
    quantidade_contada = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        verbose_name=_("Quantidade Contada em Campo")
    )
    
    # Campo para armazenar o saldo do sistema no momento da contagem (para cálculo da diferença)
    quantidade_sistema = models.DecimalField(
        max_digits=15, decimal_places=3, default=Decimal('0.000'), editable=False,
        verbose_name=_("Quantidade no Sistema"),
        help_text=_("Saldo do produto no momento em que a auditoria foi iniciada.")
    )
    
    observacoes = models.TextField(blank=True, null=True, verbose_name=_("Observações do Auditor"))
    
    # Campo para vincular ao movimento de ajuste (entrada ou saída) que esta auditoria gerou
    movimento_ajuste = models.OneToOneField(
        'MovimentoEstoque',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='auditoria_inventario_origem',
        verbose_name=_("Movimento de Ajuste Gerado")
    )
    
    class Meta:
        verbose_name = _("Auditoria de Inventário (Insumos)")
        verbose_name_plural = _("Auditorias de Inventário (Insumos)")
        ordering = ['-data_auditoria']
        
    def __str__(self):
        return f"Audit #{self.pk} - {self.produto.nome} ({self.get_status_display()})"


# ====================================================================
# NOVO MODELO: AUDITORIA DE PRÉ-PRONTOS (Passo 2.1)
# ====================================================================
class AuditoriaPrePronto(models.Model):
    """
    Modelo para registrar a contagem cega de produtos/subprodutos intermediários
    (itens com is_pre_pronto=True).
    Gera um movimento de ajuste de estoque (entrada ou saída) ao ser concluída.
    """
    data_auditoria = models.DateTimeField(auto_now_add=True, verbose_name=_("Data da Auditoria"))
    data_conclusao = models.DateTimeField(null=True, blank=True, verbose_name=_("Data de Conclusão"))
    
    status = models.CharField(
        max_length=10,
        choices=STATUS_AUDITORIA,
        default='PENDENTE',
        verbose_name=_("Status da Auditoria")
    )
    
    # Rastreabilidade do Usuário (Nomenclatura Padrão 'responsavel')
    responsavel = models.ForeignKey(
        Usuario,
        on_delete=models.PROTECT,
        related_name='auditorias_pre_pronto_realizadas',
        verbose_name=_("Responsável pela Contagem")
    )
    
    # Produto: Limitado apenas a Pré-Prontos
    produto = models.ForeignKey(
        Produto,
        on_delete=models.PROTECT,
        # Limita as opções de escolha apenas para produtos que SÃO pré-prontos
        limit_choices_to={'is_pre_pronto': True}, 
        verbose_name=_("Produto (Pré-Pronto) Contado")
    )
    
    # Campo Cego: O valor contado em campo, sem consultar o saldo atual
    quantidade_contada = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        verbose_name=_("Quantidade Contada em Campo")
    )
    
    # Campo para armazenar o saldo do sistema no momento da contagem (para cálculo da diferença)
    quantidade_sistema = models.DecimalField(
        max_digits=15, decimal_places=3, default=Decimal('0.000'), editable=False,
        verbose_name=_("Quantidade no Sistema"),
        help_text=_("Saldo do produto no momento em que a auditoria foi iniciada.")
    )
    
    observacoes = models.TextField(blank=True, null=True, verbose_name=_("Observações do Auditor"))
    
    # Campo para vincular ao movimento de ajuste (entrada ou saída) que esta auditoria gerou
    movimento_ajuste = models.OneToOneField(
        'MovimentoEstoque',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='auditoria_pre_pronto_origem',
        verbose_name=_("Movimento de Ajuste Gerado")
    )
    
    class Meta:
        verbose_name = _("Auditoria de Estoque (Pré-Prontos)")
        verbose_name_plural = _("Auditorias de Estoque (Pré-Prontos)")
        ordering = ['-data_auditoria']
        
    def __str__(self):
        return f"Audit PP #{self.pk} - {self.produto.nome} ({self.get_status_display()})"


# ====================================================================
# NOVO MODELO: CONTAGEM DIÁRIA FLV (Passo 2.2)
# Focado em contagem rápida de alta rotatividade.
# ====================================================================
class ContagemDiariaFLV(models.Model):
    """
    Modelo para registro rápido de contagem de itens de alta rotatividade (Ex: FLV).
    Simples, projetado para uso móvel/tablet na cozinha.
    Gera um movimento de ajuste ao ser concluída.
    """
    data_contagem = models.DateTimeField(auto_now_add=True, verbose_name=_("Data da Contagem"))
    data_conclusao = models.DateTimeField(null=True, blank=True, verbose_name=_("Data de Conclusão"))
    
    status = models.CharField(
        max_length=10,
        choices=STATUS_AUDITORIA, # Reutiliza os status de Auditoria
        default='PENDENTE',
        verbose_name=_("Status da Contagem")
    )
    
    # Rastreabilidade do Usuário (Nomenclatura Padrão 'responsavel')
    responsavel = models.ForeignKey(
        Usuario,
        on_delete=models.PROTECT,
        related_name='contagens_flv_realizadas',
        verbose_name=_("Responsável pela Contagem")
    )
    
    # Produto: Permite todos os produtos, mas deve ser usado para itens FLV
    produto = models.ForeignKey(
        Produto,
        on_delete=models.PROTECT,
        verbose_name=_("Produto Contado (FLV)")
    )
    
    # Campo Cego
    quantidade_contada = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        verbose_name=_("Quantidade Contada em Campo")
    )
    
    # Campo para armazenar o saldo do sistema no momento da contagem (para cálculo da diferença)
    quantidade_sistema = models.DecimalField(
        max_digits=15, decimal_places=3, default=Decimal('0.000'), editable=False,
        verbose_name=_("Quantidade no Sistema"),
        help_text=_("Saldo do produto no momento em que a contagem foi iniciada.")
    )
    
    observacoes = models.TextField(blank=True, null=True, verbose_name=_("Observações da Contagem"))
    
    # Campo para vincular ao movimento de ajuste (entrada ou saída) que esta contagem gerou
    movimento_ajuste = models.OneToOneField(
        'MovimentoEstoque',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='contagem_flv_origem', # Nomenclatura Padrão de Integração
        verbose_name=_("Movimento de Ajuste Gerado")
    )

    class Meta:
        verbose_name = _("Contagem Diária (FLV)")
        verbose_name_plural = _("Contagens Diárias (FLV)")
        ordering = ['-data_contagem']
        
    def __str__(self):
        return f"Contagem FLV #{self.pk} - {self.produto.nome} ({self.get_status_display()})"


class MovimentoEstoque(models.Model):
    """
    Cabeçalho do movimento de estoque, registrando a entrada ou saída.
    Permite rastreabilidade da origem (Venda, Compra, Produção, Ajuste).
    """
    data_movimento = models.DateTimeField(auto_now_add=True)
    tipo_movimento = models.CharField(max_length=50, choices=TIPOS_MOVIMENTO, verbose_name=_("Tipo de Movimento"))
    observacoes = models.TextField(blank=True, null=True, verbose_name=_("Observações"))

    # PENDÊNCIA RESOLVIDA: Rastreabilidade do Usuário que executou o movimento
    responsavel = models.ForeignKey(
        Usuario,
        on_delete=models.PROTECT,
        related_name='movimentos_estoque_gerados',
        verbose_name=_("Responsável pelo Registro"),
        help_text=_("Usuário que disparou este movimento (via API, Admin ou Sistema).")
    )

    # --- Rastreabilidade ---

    # Rastreabilidade com Vendas
    venda = models.ForeignKey(
        'vendas.Venda',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        verbose_name=_("Venda de Origem"),
        help_text=_("Vínculo com o pedido de venda que gerou esta saída (se aplicável).")
    )
    # Rastreabilidade com Compras
    pedido_compra = models.ForeignKey(
        'compras.PedidoCompra',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        verbose_name=_("Pedido de Compra de Origem"),
        help_text=_("Vínculo com o pedido de compra que gerou esta entrada (se aplicável).")
    )
    # Rastreabilidade com Fornecedor/Cliente
    fornecedor = models.ForeignKey(
        Fornecedor,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        verbose_name=_("Fornecedor (Se Compra)")
    )
    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        verbose_name=_("Cliente (Se Venda)")
    )
    
    # Rastreabilidade com Auditoria e Requisição estão nos modelos de origem (OneToOneField)

    class Meta:
        verbose_name = _("Movimento de Estoque")
        verbose_name_plural = _("Movimentos de Estoque")
        ordering = ['-data_movimento']

    def __str__(self):
        return f"{self.get_tipo_movimento_display()} em {self.data_movimento.strftime('%d/%m/%Y %H:%M')}"


class ItemMovimentoEstoque(models.Model):
    """
    Detalhe do movimento, registrando a quantidade de cada Produto movimentado.
    Este modelo dispara o signal que atualiza o saldo do Produto.
    """
    movimento = models.ForeignKey(
        MovimentoEstoque,
        related_name='itens',
        on_delete=models.CASCADE,
        verbose_name=_("Movimento")
    )
    produto = models.ForeignKey(
        Produto,
        on_delete=models.PROTECT,
        verbose_name=_("Produto")
    )

    quantidade_movimentada = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        verbose_name=_("Quantidade Movimentada")
    )

    preco_unitario = models.DecimalField(
        max_digits=10,
        decimal_places=4, # Aumentado para 4 casas para precisão em CMP
        default=Decimal('0.0000'),
        verbose_name=_("Preço/Custo Unitário"),
        help_text=_("Preço/Custo usado para valorização do estoque no momento do movimento.")
    )

    class Meta:
        verbose_name = _("Item de Movimento de Estoque")
        verbose_name_plural = _("Itens de Movimento de Estoque")
        unique_together = ('movimento', 'produto')

    def __str__(self):
        return f"{self.produto.nome} ({self.quantidade_movimentada} {self.produto.unidade_medida.sigla})"
