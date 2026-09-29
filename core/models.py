from django.db import models


class Produto(models.Model):

    nome = models.CharField(max_length=100)
    descricao = models.TextField(blank=True, null=True)
    preco = models.DecimalField(max_digits=10, decimal_places=2)
    disponivel = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Produto"
        verbose_name_plural = "Produtos"

    def __str__(self):
        return f"{self.nome} - R$ {self.preco}"


class Pedido(models.Model):

    STATUS_CHOICES = [
        ("Em preparação", "Em preparação"),
        ("A caminho", "A caminho"),
        ("Entregue", "Entregue"),
        ("Cancelado", "Cancelado"),
    ]

    cliente = models.CharField(max_length=150)
    telefone = models.CharField(max_length=30)
    endereco = models.CharField(max_length=255)
    numero_endereco = models.CharField(max_length=20)
    bairro = models.CharField(max_length=100)
    observacao = models.TextField(blank=True, default="")
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    status = models.CharField(
        max_length=30, choices=STATUS_CHOICES, default="Em preparação"
    )
    forma_pagamento = models.CharField(
        max_length=50, default="Presencial na entrega (Dinheiro/Cartão/Pix)"
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Pedido"
        verbose_name_plural = "Pedidos"
        ordering = ["-criado_em"]

    def __str__(self):
        return f"Pedido #{self.id:03d} - {self.cliente} ({self.status})"


class ItemPedido(models.Model):

    pedido = models.ForeignKey(
        Pedido, on_delete=models.CASCADE, related_name="itens"
    )
    produto = models.ForeignKey(
        Produto, on_delete=models.SET_NULL, null=True, blank=True
    )
    nome_produto = models.CharField(max_length=100)
    preco_unitario = models.DecimalField(max_digits=10, decimal_places=2)
    quantidade = models.PositiveIntegerField(default=1)

    class Meta:
        verbose_name = "Item do Pedido"
        verbose_name_plural = "Itens do Pedido"

    @property
    def subtotal(self):
        return self.preco_unitario * self.quantidade

    def __str__(self):
        return f"{self.quantidade}x {self.nome_produto} (Pedido #{self.pedido.id:03d})"
