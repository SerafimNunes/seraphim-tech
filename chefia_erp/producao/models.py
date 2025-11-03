# producao/models.py
from django.db import models
from django.conf import settings # Import para acessar o modelo User
from estoque.models import Produto # Importamos Produto para vincular as fichas e requisições
from decimal import Decimal # Import para garantir precisão decimal

# =========================================================
# MODELOS DE FICHA TÉCNICA
# =========================================================

class FichaTecnica(models.Model):
    """
    Representa a receita/lista de materiais para um Produto acabado ou pré-pronto.
    """
    produto_produzido = models.OneToOneField(
        Produto,
        on_delete=models.CASCADE,
        related_name='ficha_tecnica',
        verbose_name='Produto Produzido'
    )
    
    rendimento_base = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('1.00'),
        verbose_name='Rendimento Base (unidade de medida do produto produzido)'
    )
    
    data_criacao = models.DateTimeField(auto_now_add=True)
    
    # Precisão CRÍTICA: 4 casas decimais para cálculo de custos (ponto 1)
    custo_total = models.DecimalField(
        max_digits=10,
        decimal_places=4, 
        default=Decimal('0.0000'), 
        verbose_name='Custo Total da Receita'
    )
    
    # Precisão CRÍTICA: 4 casas decimais para cálculo de custos (ponto 1)
    custo_unitario = models.DecimalField(
        max_digits=10, 
        decimal_places=4, 
        default=Decimal('0.0000'), 
        verbose_name="Custo Unitário do Produto (R$/UN)"
    )

    class Meta:
        verbose_name = 'Ficha Técnica'
        verbose_name_plural = 'Fichas Técnicas'
        ordering = ('produto_produzido__nome',)

    def __str__(self):
        # NOTA: O campo 'unidade_medida' no Produto não tem o atributo '.sigla'. 
        # Vou usar o nome do objeto ForeignKey diretamente.
        try:
            # Tenta pegar a sigla ou nome da unidade_medida, se for um objeto
            unidade_display = str(self.produto_produzido.unidade_medida)
        except:
            # Fallback se a unidade_medida for nula ou não tiver um __str__ decente
            unidade_display = 'UN'

        return f"FT: {self.produto_produzido.nome} (Rende {self.rendimento_base} {unidade_display})"


class ItemFichaTecnica(models.Model):
    """
    Detalha um insumo (Produto) necessário para uma Ficha Técnica.
    """
    ficha_tecnica = models.ForeignKey(
        FichaTecnica,
        on_delete=models.CASCADE,
        related_name='itens',
        verbose_name='Ficha Técnica'
    )
    
    insumo = models.ForeignKey(
        Produto,
        on_delete=models.PROTECT,
        related_name='usado_em_fichas',
        verbose_name='Insumo (Produto de Estoque)'
    )
    
    quantidade_necessaria = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        verbose_name='Quantidade Necessária'
    )
    
    # Precisão CRÍTICA: 4 casas decimais para custo do insumo (ponto 1)
    custo_insumo = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        default=Decimal('0.0000'),
        verbose_name='Custo do Insumo'
    )

    class Meta:
        verbose_name = 'Item da Ficha Técnica'
        verbose_name_plural = 'Itens da Ficha Técnica'
        unique_together = ('ficha_tecnica', 'insumo')
        
    def __str__(self):
        return f"{self.insumo.nome} ({self.quantidade_necessaria})"


# =========================================================
# NOVO MODELO: PROCESSO DE PRODUÇÃO (Passos Chave)
# =========================================================
class EtapaProcesso(models.Model):
    """
    Define as etapas padronizadas do processo de produção para uma FT.
    """
    ficha_tecnica = models.ForeignKey(
        FichaTecnica, 
        on_delete=models.CASCADE, 
        related_name='processo', 
        verbose_name="Ficha Técnica"
    )
    # Etapa
    numero_etapa = models.IntegerField(verbose_name="Etapa Nº")
    # Tarefa
    tarefa = models.CharField(max_length=255, verbose_name="Tarefa / Passo Chave")
    # Tempo Estimado (Armazenado como texto pois a formatação pode ser "10 min" ou "1:30h")
    tempo_estimado = models.CharField(max_length=50, blank=True, null=True, verbose_name="Tempo Estimado")
    # Observações de Qualidade
    observacoes_qualidade = models.TextField(blank=True, null=True, verbose_name="Observações de Qualidade")

    class Meta:
        verbose_name = "Etapa do Processo"
        verbose_name_plural = "Processo de Produção (Passos Chave)"
        # Garante a ordem das etapas na exibição
        ordering = ['numero_etapa']
        # Garante que não haja duas etapas com o mesmo número na mesma FT
        unique_together = ('ficha_tecnica', 'numero_etapa')

    def __str__(self):
        return f"Etapa {self.numero_etapa}: {self.tarefa}"


# =========================================================
# FLUXO DE PRODUÇÃO (ORDEM E REQUISIÇÃO)
# =========================================================

class OrdemProducao(models.Model):
    """
    Documento que autoriza a produção de um item.
    """
    STATUS_OP = (
        ('ABERTA', 'Aberta'),
        ('REQUISITANDO', 'Insumos Requisitados'),
        ('EM_PRODUCAO', 'Em Produção'),
        ('CONCLUIDA', 'Concluída'),
        ('CANCELADA', 'Cancelada'),
    )
    
    ficha_tecnica = models.ForeignKey(
        FichaTecnica,
        on_delete=models.PROTECT,
        verbose_name='Produto a ser Produzido (Ficha Técnica)'
    )
    
    quantidade_a_produzir = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='Quantidade a Produzir'
    )
    
    status = models.CharField(
        max_length=15,
        choices=STATUS_OP,
        default='ABERTA',
        verbose_name='Status da Ordem'
    )
    
    # Alterado para SET_NULL e null/blank=True para resiliência (ponto 4)
    responsavel = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, 
        null=True, blank=True,
        related_name='ordens_emitidas',
        verbose_name='Responsável pela Emissão'
    )

    data_emissao = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Data de Emissão'
    )
    
    data_conclusao = models.DateTimeField(
        null=True, blank=True,
        verbose_name='Data de Conclusão'
    )
    
    # NOVO CAMPO: Liga a OP ao movimento de ENTRADA do produto acabado no estoque (ponto 2)
    movimento_entrada_estoque = models.ForeignKey(
        'estoque.MovimentoEstoque',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='ordem_producao_entrada',
        verbose_name="Movimento de Entrada no Estoque (Produto Acabado)"
    )

    class Meta:
        verbose_name = 'Ordem de Produção'
        verbose_name_plural = 'Ordens de Produção'
        ordering = ('-data_emissao',)

    def __str__(self):
        return f"OP #{self.pk} - {self.ficha_tecnica.produto_produzido.nome} ({self.quantidade_a_produzir})"

    @property
    def produto_final(self):
        return self.ficha_tecnica.produto_produzido


class RequisicaoInsumo(models.Model):
    """
    Documento emitido pela produção para o estoque, solicitando os insumos.
    """
    STATUS_REQUISICAO = (
        ('PENDENTE', 'Pendente'),
        ('ATENDIDA', 'Atendida (Baixado do Estoque)'),
        ('PARCIAL', 'Atendida Parcialmente'),
        ('CANCELADA', 'Cancelada'),
    )

    ordem_producao = models.ForeignKey(
        OrdemProducao,
        on_delete=models.PROTECT,
        related_name='requisicoes',
        verbose_name='Ordem de Produção Relacionada'
    )
    
    status = models.CharField(
        max_length=15,
        choices=STATUS_REQUISICAO,
        default='PENDENTE',
        verbose_name='Status da Requisição'
    )
    
    # Alterado para SET_NULL e null/blank=True para resiliência (ponto 4)
    responsavel = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='requisicoes_emitidas',
        verbose_name='Responsável pela Requisição'
    )

    data_requisicao = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Data de Requisição'
    )

    # NOVO CAMPO: Liga a Requisição ao movimento de SAÍDA dos insumos do estoque (ponto 2)
    movimento_saida_estoque = models.ForeignKey(
        'estoque.MovimentoEstoque',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='requisicao_insumo_saida',
        verbose_name="Movimento de Saída no Estoque (Insumos)"
    )
    
    class Meta:
        verbose_name = 'Requisição de Insumo'
        verbose_name_plural = 'Requisições de Insumos'
        ordering = ('-data_requisicao',)

    def __str__(self):
        return f"Requisição #{self.pk} - OP {self.ordem_producao.pk} - Status: {self.get_status_display()}"


class ItemRequisicao(models.Model):
    """
    Detalha os insumos e quantidades solicitados em uma RequisicaoInsumo.
    """
    requisicao = models.ForeignKey(
        RequisicaoInsumo,
        on_delete=models.CASCADE,
        related_name='itens_requisicao',
        verbose_name='Requisição de Insumo'
    )
    
    insumo = models.ForeignKey(
        Produto,
        on_delete=models.PROTECT,
        verbose_name='Insumo (Produto de Estoque)'
    )
    
    quantidade_solicitada = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        verbose_name='Quantidade Solicitada'
    )
    
    quantidade_atendida = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=Decimal('0.000'),
        verbose_name='Quantidade Atendida'
    )
    
    # NOVO CAMPO: Captura o custo unitário do insumo no momento da baixa para o CMV (ponto 3)
    preco_custo_unitario = models.DecimalField(
        max_digits=10,
        decimal_places=4, # 4 casas decimais para precisão de custo
        null=True, blank=True,
        verbose_name="Custo Unitário (Momento da Baixa)"
    )

    class Meta:
        verbose_name = 'Item da Requisição'
        verbose_name_plural = 'Itens da Requisição'
        unique_together = ('requisicao', 'insumo')
        
    def __str__(self):
        return f"{self.insumo.nome} - {self.quantidade_solicitada} Solicitado"
