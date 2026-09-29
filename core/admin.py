from django.contrib import admin
from .models import Produto, Pedido, ItemPedido


class ItemPedidoInline(admin.TabularInline):
    model = ItemPedido
    extra = 0


@admin.register(Produto)
class ProdutoAdmin(admin.ModelAdmin):
    list_display = ("nome", "preco", "disponivel")
    list_filter = ("disponivel",)
    search_fields = ("nome",)


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = ("id", "cliente", "telefone", "total", "status", "criado_em")
    list_filter = ("status", "criado_em")
    search_fields = ("cliente", "telefone", "endereco")
    inlines = [ItemPedidoInline]
