import json
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db import transaction
from .models import Produto, Pedido, ItemPedido


def inicio(request):
    return render(request, "cliente/inicio.html")


def produtos(request):
    return render(request, "cliente/produtos.html")


def carrinho(request):
    return render(request, "cliente/carrinho.html")


def finalizar_pedido(request):
    return render(request, "cliente/finalizar_pedido.html")


def meus_pedidos(request):
    return render(request, "cliente/meus_pedidos.html")

@require_http_methods(["GET"])
def api_produtos(request):
    """
    GET /api/produtos/
    Retorna a lista de produtos disponíveis em formato JSON.
    """
    produtos_qs = Produto.objects.filter(disponivel=True)
    dados = [
        {
            "id": p.id,
            "nome": p.nome,
            "preco": float(p.preco),
            "descricao": p.descricao or "",
        }
        for p in produtos_qs
    ]
    return JsonResponse(dados, safe=False)


@csrf_exempt
def api_pedidos(request):
    """
    GET /api/pedidos/ -> Lista pedidos (opcionalmente filtra por ?telefone=...)
    POST /api/pedidos/ -> Cria um novo pedido recebendo o payload JSON do checkout
    """
    if request.method == "GET":
        telefone = request.GET.get("telefone")
        pedidos_qs = Pedido.objects.all()

        if telefone:
            pedidos_qs = pedidos_qs.filter(telefone=telefone)

        pedidos_lista = []
        for pedido in pedidos_qs:
            itens = [
                {
                    "nome": item.nome_produto,
                    "preco": float(item.preco_unitario),
                    "quantidade": item.quantidade,
                }
                for item in pedido.itens.all()
            ]

            pedidos_lista.append(
                {
                    "numero": pedido.id,
                    "data": pedido.criado_em.strftime("%d/%m/%Y, %H:%M:%S"),
                    "cliente": pedido.cliente,
                    "telefone": pedido.telefone,
                    "endereco": pedido.endereco,
                    "numeroEndereco": pedido.numero_endereco,
                    "bairro": pedido.bairro,
                    "observacao": pedido.observacao,
                    "produtos": itens,
                    "total": float(pedido.total),
                    "status": pedido.status,
                    "forma_pagamento": pedido.forma_pagamento,
                }
            )

        return JsonResponse(pedidos_lista, safe=False)

    elif request.method == "POST":
        try:
            dados = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"erro": "JSON inválido no corpo da requisição."}, status=400)

        cliente = dados.get("cliente")
        telefone = dados.get("telefone")
        endereco = dados.get("endereco")
        numero_endereco = dados.get("numeroEndereco") or dados.get("numero_endereco")
        bairro = dados.get("bairro")
        observacao = dados.get("observacao", "")
        produtos_recebidos = dados.get("produtos", [])

        if not all([cliente, telefone, endereco, numero_endereco, bairro]):
            return JsonResponse(
                {"erro": "Campos obrigatórios: cliente, telefone, endereco, numeroEndereco, bairro."},
                status=400,
            )

        if not produtos_recebidos:
            return JsonResponse(
                {"erro": "O pedido deve conter pelo menos um produto no carrinho."},
                status=400,
            )

        total_calculado = 0
        for item in produtos_recebidos:
            preco_unit = float(item.get("preco", 0))
            qtd = int(item.get("quantidade", 1))
            total_calculado += preco_unit * qtd

        total = float(dados.get("total", total_calculado))

        with transaction.atomic():
            pedido = Pedido.objects.create(
                cliente=cliente,
                telefone=telefone,
                endereco=endereco,
                numero_endereco=numero_endereco,
                bairro=bairro,
                observacao=observacao,
                total=total,
                status="Em preparação",
            )

            for item in produtos_recebidos:
                nome_prod = item.get("nome", "")
                preco_unit = float(item.get("preco", 0))
                qtd = int(item.get("quantidade", 1))

                prod_obj = Produto.objects.filter(nome=nome_prod).first()

                ItemPedido.objects.create(
                    pedido=pedido,
                    produto=prod_obj,
                    nome_produto=nome_prod,
                    preco_unitario=preco_unit,
                    quantidade=qtd,
                )

        return JsonResponse(
            {
                "mensagem": "Pedido confirmado com sucesso!",
                "numero": pedido.id,
                "status": pedido.status,
                "total": float(pedido.total),
            },
            status=201,
        )

    return JsonResponse({"erro": "Método não permitido."}, status=405)


@require_http_methods(["GET"])
def api_pedido_status(request, pedido_id):
    """
    GET /api/pedidos/<id>/
    Retorna o status pontual de um pedido específico (para consulta rápida pelo usuário).
    """
    try:
        pedido = Pedido.objects.get(pk=pedido_id)
    except Pedido.DoesNotExist:
        return JsonResponse({"erro": "Pedido não encontrado."}, status=404)

    return JsonResponse(
        {
            "numero": pedido.id,
            "status": pedido.status,
            "cliente": pedido.cliente,
            "total": float(pedido.total),
            "data": pedido.criado_em.strftime("%d/%m/%Y, %H:%M:%S"),
        }
    )