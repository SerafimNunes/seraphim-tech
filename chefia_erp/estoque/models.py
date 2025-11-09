# ====================================================================
# ARQUIVO: chefia_erp/estoque/models.py (COMPLETO E CORRIGIDO)
# R2: Adicionado item_origem_estorno (ForeignKey self-referencing)
# ====================================================================
from django.db import models
from django.utils.translation import gettext_lazy as _
from core.models import UnidadeMedida, Fornecedor, Cliente, Categoria, Usuario
from decimal import Decimal
from django.db.models import F
from django.core.exceptions import ValidationError
from django.db.models import UniqueConstraint # Adicionar para R2/R3
from django.core.validators import MinValueValidator # Necessário para ItemPedidoCompra

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

class LocalEstocagem(models.Model):
    """Localização física ou lógica de um produto no estoque."""
    nome = models.CharField(max_length=100, unique=True, verbose_name=_("Nome"))
    descricao = models.TextField(blank=True, verbose_name=_("Descrição"))

    class Meta:
        verbose_name = _("Local de Estocagem")
        verbose_name_plural = _("Locais de Estocagem")

    def __str__(self):
        return self.nome

class Produto(models.Model):
    """
    Representa um item no estoque, seja matéria-prima, insumo, ou produto final.
    """
    nome = models.CharField(max_length=200, verbose_name=_("Nome"))
    unidade_medida = models.ForeignKey(
        UnidadeMedida,
        on_delete=models.PROTECT,
        verbose_name=_("Unidade de Medida")
    )
    categoria = models.ForeignKey(
        Categoria,
        on_delete=models.PROTECT,
        verbose_name=_("Categoria"),
        null=True, blank=True
    )
    codigo_barras = models.CharField(
        max_length=50, 
        unique=True, 
        null=True, blank=True, 
        verbose_name=_("Código de Barras")
    )
    
    # NOVOS CAMPOS DE LOCAL E ESTOQUE MÍNIMO
    local_estocagem = models.ForeignKey(
        LocalEstocagem,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        verbose_name=_("Local de Estocagem Padrão")
    )
    
    estoque_minimo = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=Decimal('0.000'),
        verbose_name=_("Estoque Mínimo (Alerta)")
    )
    
    # CAMPOS DE VALOR/CUSTO (Gerenciados pelo CustoProduto, mas espelhados aqui)
    # R7: CMP e saldo foram movidos para CustoProduto, mas mantemos o custo de última compra
    preco_custo = models.DecimalField(
        max_digits=10,
        decimal_places=4, # Aumentado para 4 casas para precisão em CMP
        default=Decimal('0.0000'),
        verbose_name=_("Custo de Última Compra/Entrada")
    )
    preco_venda = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        verbose_name=_("Preço de Venda")
    )
    
    # FLAGS DE CLASSIFICAÇÃO
    is_vendavel = models.BooleanField(
        default=True,
        verbose_name=_("É Vendável? (Produto Final)")
    )
    is_insumo = models.BooleanField(
        default=False,
        verbose_name=_("É Insumo? (Matéria-prima/Componente)")
    )
    is_pre_pronto = models.BooleanField(
        default=False,
        verbose_name=_("É Pré-Pronto/Semi-acabado?")
    )
    ativo = models.BooleanField(default=True, verbose_name=_("Ativo"))

    class Meta:
        verbose_name = _("Produto")
        verbose_name_plural = _("Produtos")

    def __str__(self):
        return self.nome

# =========================================================
# MODELOS DE CONTROLE FINANCEIRO/QUANTITATIVO
# =========================================================

class CustoProduto(models.Model):
    """
    Armazena o saldo atual e o CMP do Produto. 
    Design pattern para isolar e proteger os campos críticos.
    """
    produto = models.OneToOneField(
        Produto,
        on_delete=models.CASCADE,
        related_name='custo_info',
        verbose_name=_("Produto")
    )

    quantidade_atual = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=Decimal('0.000'),
        verbose_name=_("Saldo Atual")
    )

    custo_medio_ponderado = models.DecimalField(
        max_digits=10,
        decimal_places=4, # CRÍTICO: 4 casas decimais para precisão de custo
        default=Decimal('0.0000'),
        verbose_name=_("Custo Médio Ponderado (CMP)")
    )
    
    # NOVO: Valor total em estoque (para otimizar queries no dashboard)
    valor_total_estoque = models.DecimalField(
        max_digits=15,
        decimal_places=4, # CRÍTICO: 4 casas decimais para precisão de custo
        default=Decimal('0.0000'),
        verbose_name=_("Valor Total em Estoque (Saldo * CMP)")
    )

    class Meta:
        verbose_name = _("Custo e Saldo do Produto")
        verbose_name_plural = _("Custos e Saldos dos Produtos")

    def __str__(self):
        return f"CMP: {self.custo_medio_ponderado} | Saldo: {self.quantidade_atual} ({self.produto.nome})"

class MovimentoEstoque(models.Model):
    """
    Documento mestre que agrupa as entradas e saídas de estoque.
    """
    tipo_movimento = models.CharField(
        max_length=50,
        choices=TIPOS_MOVIMENTO,
        verbose_name=_("Tipo de Movimento")
    )
    data_movimento = models.DateTimeField(auto_now_add=True, verbose_name=_("Data do Movimento"))
    responsavel = models.ForeignKey(
        Usuario, # Usa o modelo customizado (ou settings.AUTH_USER_MODEL)
        on_delete=models.PROTECT,
        verbose_name=_("Responsável")
    )
    observacoes = models.TextField(blank=True, verbose_name=_("Observações"))

    # Rastreabilidade (Foreign Keys para documentos de origem)
    # Por exemplo: PedidoCompra, NotaFiscal, OrdemProducao, Venda
    
    # Campo para Compra
    pedido_compra = models.ForeignKey(
        'compras.PedidoCompra',
        on_delete=models.PROTECT,
        null=True, blank=True,
        verbose_name=_("Pedido de Compra de Origem")
    )
    
    # Campo para Venda (Comanda)
    comanda = models.ForeignKey(
        'vendas.Comanda',
        on_delete=models.PROTECT,
        null=True, blank=True,
        verbose_name=_("Comanda (Venda) de Origem")
    )
    
    # Campo para Produção
    ordem_producao = models.ForeignKey(
        'producao.OrdemProducao',
        on_delete=models.PROTECT,
        null=True, blank=True,
        verbose_name=_("Ordem de Produção de Origem")
    )
    
    # Campos para Auditoria/Ajuste (Serão ligados pelo signal do app auditoria/estoque)
    # motion_ajuste (FK) será ligado aqui no signal
    
    class Meta:
        verbose_name = _("Movimento de Estoque")
        verbose_name_plural = _("Movimentos de Estoque")

    def __str__(self):
        return f"Movimento {self.pk} - {self.get_tipo_movimento_display()} em {self.data_movimento.strftime('%d/%m/%Y %H:%M')}"

class ItemMovimentoEstoque(models.Model):
    """
    Detalha um item em um MovimentoEstoque, registrando a quantidade de cada Produto movimentado.
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
    
    # 🚨 CORREÇÃO CRÍTICA R2: CAMPO DE RASTREABILIDADE DE ESTORNO
    # Permite que um item de estorno (ENTRADA) aponte para o item original (SAÍDA)
    item_origem_estorno = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='itens_estorno_reverso',
        verbose_name=_("Item Original (em caso de estorno)"),
        help_text=_("Se este item é uma reversão (ex: ENTRADA por cancelamento), aponta para o ItemMovimentoEstoque original que foi estornado.")
    )

    # 🚨 CAMPO SOFT-DELETE PARA O ITEM ORIGINAL
    is_estornado = models.BooleanField(
        default=False,
        verbose_name=_("Item Estornado"),
        help_text=_("Se 'True', o item foi logicamente estornado e deve ser ignorado no cálculo do CMP e do Saldo. O item reverso deve ser criado com item_origem_estorno preenchido.")
    )


    class Meta:
        verbose_name = _("Item de Movimento de Estoque")
        verbose_name_plural = _("Itens de Movimento de Estoque")
        # UNIQUE_TOGETHER: NÃO pode haver dois itens de estorno apontando para a mesma origem
        constraints = [
            # Garante que NENHUM item de movimento (o item de reversão) aponte duas vezes para a mesma origem
            UniqueConstraint(fields=['item_origem_estorno'], name='unique_estorno_reverso')
        ]
        
    def clean(self):
        """Validação de Integridade de Estorno"""
        if self.item_origem_estorno and self.is_estornado:
            # Um item não pode ser estornado E ser a origem de um estorno simultaneamente.
            # is_estornado = True deve ser para o item original que foi revertido.
            # O item que reverte (o estorno reverso) deve ter is_estornado = False.
            raise ValidationError(
                _("Um Item de Movimento que é uma reversão não deve ser marcado como 'Estornado' (is_estornado=True).")
            )
            
        if self.item_origem_estorno:
            # Garante que o item original foi marcado como estornado (soft-delete)
            if not self.item_origem_estorno.is_estornado:
                raise ValidationError(
                    _("O Item de Movimento Original (item_origem_estorno) deve estar marcado como estornado (is_estornado=True).")
                )


# =========================================================
# MODELOS DE REQUISIÇÃO (Para Produção e Venda)
# =========================================================

class RequisicaoEstoque(models.Model):
    """
    Representa o pedido de insumos/produtos do estoque para uso em Venda ou Produção.
    """
    status = models.CharField(
        max_length=50,
        choices=STATUS_REQUISICAO,
        default='PENDENTE',
        verbose_name=_("Status da Requisição")
    )
    data_requisicao = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_("Data da Requisição")
    )
    responsavel = models.ForeignKey(
        Usuario, 
        on_delete=models.PROTECT,
        verbose_name=_("Responsável")
    )
    
    # Campo de rastreabilidade (será preenchido pelo signal)
    movimento_saida_estoque = models.ForeignKey(
        MovimentoEstoque,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='requisicoes_estoque',
        verbose_name=_("Movimento de Saída de Estoque")
    )

    class Meta:
        verbose_name = _("Requisição de Estoque")
        verbose_name_plural = _("Requisições de Estoque")

    def __str__(self):
        return f"Requisição N° {self.pk} ({self.get_status_display()})"


class ItemRequisicaoEstoque(models.Model):
    """
    Detalhe dos itens solicitados em uma Requisição de Estoque.
    """
    requisicao = models.ForeignKey(
        RequisicaoEstoque,
        on_delete=models.CASCADE,
        related_name='itens_requisicao',
        verbose_name=_("Requisição de Estoque")
    )
    produto = models.ForeignKey(
        Produto,
        on_delete=models.PROTECT,
        verbose_name=_("Produto Solicitado")
    )
    
    quantidade_solicitada = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        verbose_name=_("Quantidade Solicitada")
    )
    
    quantidade_atendida = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=Decimal('0.000'),
        verbose_name=_("Quantidade Atendida")
    )

    class Meta:
        verbose_name = _("Item de Requisição de Estoque")
        verbose_name_plural = _("Itens de Requisição de Estoque")
        
    def clean(self):
        if self.quantidade_atendida > self.quantidade_solicitada:
            raise ValidationError(_('A quantidade atendida não pode ser maior que a quantidade solicitada.'))


# =========================================================
# MODELOS DE AUDITORIA E CONTAGEM
# (Modelos que geram Ajuste de Estoque)
# =========================================================

class AuditoriaInventario(models.Model):
    """
    Contagem de estoque para produtos não-FLV (Geral).
    """
    produto = models.ForeignKey(
        Produto,
        on_delete=models.PROTECT,
        verbose_name=_("Produto")
    )
    data_auditoria = models.DateField(verbose_name=_("Data da Auditoria"))
    responsavel = models.ForeignKey(
        Usuario, 
        on_delete=models.PROTECT,
        verbose_name=_("Responsável pela Contagem")
    )
    status = models.CharField(
        max_length=50,
        choices=STATUS_AUDITORIA,
        default='PENDENTE',
        verbose_name=_("Status")
    )
    
    # Valores de contagem e diferença (serão preenchidos por view/signal)
    quantidade_contada = models.DecimalField(max_digits=10, decimal_places=3, verbose_name=_("Quantidade Contada"))
    quantidade_sistema = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True, verbose_name=_("Quantidade do Sistema"))
    
    # Campo de rastreabilidade do Movimento de Ajuste (preenchido pelo signal)
    movimento_ajuste = models.ForeignKey(
        MovimentoEstoque,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='auditorias_inventario',
        verbose_name=_("Movimento de Ajuste Gerado")
    )

    class Meta:
        verbose_name = _("Auditoria de Inventário")
        verbose_name_plural = _("Auditorias de Inventário")
        # UNIQUE_TOGETHER: Garante apenas uma contagem por produto/dia
        unique_together = ('produto', 'data_auditoria')
    
    def __str__(self):
        return f"Auditoria de {self.produto.nome} em {self.data_auditoria}"


class AuditoriaPrePronto(models.Model):
    """
    Contagem de estoque para produtos pré-prontos (semi-acabados).
    """
    produto = models.ForeignKey(
        Produto,
        on_delete=models.PROTECT,
        limit_choices_to={'is_pre_pronto': True}, # Apenas produtos marcados como pré-prontos
        verbose_name=_("Produto Pré-Pronto")
    )
    data_auditoria = models.DateField(verbose_name=_("Data da Auditoria"))
    responsavel = models.ForeignKey(
        Usuario, 
        on_delete=models.PROTECT,
        verbose_name=_("Responsável pela Contagem")
    )
    status = models.CharField(
        max_length=50,
        choices=STATUS_AUDITORIA,
        default='PENDENTE',
        verbose_name=_("Status")
    )
    
    # Valores de contagem e diferença
    quantidade_contada = models.DecimalField(max_digits=10, decimal_places=3, verbose_name=_("Quantidade Contada"))
    quantidade_sistema = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True, verbose_name=_("Quantidade do Sistema"))
    
    # Campo de rastreabilidade
    movimento_ajuste = models.ForeignKey(
        MovimentoEstoque,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='auditorias_pre_pronto',
        verbose_name=_("Movimento de Ajuste Gerado")
    )

    class Meta:
        verbose_name = _("Auditoria de Pré-Pronto")
        verbose_name_plural = _("Auditorias de Pré-Pronto")
        unique_together = ('produto', 'data_auditoria')
        
    def __str__(self):
        return f"Auditoria de Pré-Pronto: {self.produto.nome} em {self.data_auditoria}"


class ContagemDiariaFLV(models.Model):
    """
    Contagem simplificada para perecíveis (Frutas, Legumes e Verduras)
    """
    produto = models.ForeignKey(
        Produto,
        on_delete=models.PROTECT,
        verbose_name=_("Produto FLV")
    )
    data_contagem = models.DateField(verbose_name=_("Data da Contagem"))
    responsavel = models.ForeignKey(
        Usuario, 
        on_delete=models.PROTECT,
        verbose_name=_("Responsável pela Contagem")
    )
    status = models.CharField(
        max_length=50,
        choices=STATUS_AUDITORIA,
        default='PENDENTE',
        verbose_name=_("Status")
    )
    
    # Valores de contagem e diferença
    quantidade_contada = models.DecimalField(max_digits=10, decimal_places=3, verbose_name=_("Quantidade Contada"))
    quantidade_sistema = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True, verbose_name=_("Quantidade do Sistema"))
    
    # Campo de rastreabilidade
    movimento_ajuste = models.ForeignKey(
        MovimentoEstoque,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='contagens_flv',
        verbose_name=_("Movimento de Ajuste Gerado")
    )

    class Meta:
        verbose_name = _("Contagem Diária FLV")
        verbose_name_plural = _("Contagens Diárias FLV")
        unique_together = ('produto', 'data_contagem')

    def __str__(self):
        return f"Contagem FLV: {self.produto.nome} em {self.data_contagem}"