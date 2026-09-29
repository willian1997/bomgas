from django.urls import path
from . import views

urlpatterns = [
    
    path("", views.inicio, name="inicio"),
    path("produtos/", views.produtos, name="produtos"),
    path("carrinho/", views.carrinho, name="carrinho"),
    path("finalizar-pedido/", views.finalizar_pedido, name="finalizar_pedido"),
    path("meus_pedidos.html", views.meus_pedidos, name="meus_pedidos"),

    path("api/produtos/", views.api_produtos, name="api_produtos"),
    path("api/pedidos/", views.api_pedidos, name="api_pedidos"),
    path("api/pedidos/<int:pedido_id>/", views.api_pedido_status, name="api_pedido_status"),
]
