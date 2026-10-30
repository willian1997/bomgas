import json
from collections import Counter
from decimal import Decimal, InvalidOperation
from datetime import timedelta
from functools import wraps
from urllib.parse import urlencode
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.models import User
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils.http import url_has_allowed_host_and_scheme
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db import transaction
from django.db.models import Count, DecimalField, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from .models import Produto, Pedido, ItemPedido


def _garantir_admin_padrao():
    """Garante que o usuário padrão 'admin' (senha '123456') exista no banco."""
    if not User.objects.filter(username="admin").exists():
        User.objects.create_user(
            username="admin",
            password="123456",
            is_staff=True,
            is_superuser=True,
        )


def _usuario_eh_admin(user):
    return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser))


def _requer_admin(view_func):
    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        if not _usuario_eh_admin(request.user):
            parametros = urlencode({"aba": "admin", "next": request.get_full_path()})
            return redirect(f"{reverse('entrar')}?{parametros}")
        return view_func(request, *args, **kwargs)

    return _wrapped


def _requer_admin_api(view_func):
    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        if not _usuario_eh_admin(request.user):
            return JsonResponse(
                {"erro": "Acesso restrito ao administrador."},
                status=401,
            )
        return view_func(request, *args, **kwargs)

    return _wrapped


def _buscar_cliente_por_telefone(telefone_informado):
    """Busca o pedido mais recente do cliente no SQLite pelo telefone."""
    texto = (telefone_informado or "").strip()
    if not texto:
        return None

    digitos = "".join(c for c in texto if c.isdigit())
    if not digitos:
        return None

    chaves_aceitas = {digitos}
    if len(digitos) in (12, 13) and digitos.startswith("55"):
        chaves_aceitas.add(digitos[2:])

    pedidos_qs = Pedido.objects.all().order_by("-criado_em", "-id")
    for pedido in pedidos_qs:
        chave_pedido = "".join(c for c in (pedido.telefone or "") if c.isdigit())
        if chave_pedido and chave_pedido in chaves_aceitas:
            nome_completo = (pedido.cliente or "").strip()
            primeiro_nome = nome_completo.split()[0] if nome_completo else "Cliente"
            return {
                "nome": nome_completo,
                "primeiro_nome": primeiro_nome,
                "telefone": (pedido.telefone or texto).strip(),
                "telefone_chave": chave_pedido,
                "endereco": (pedido.endereco or "").strip(),
                "numero_endereco": (pedido.numero_endereco or "").strip(),
                "bairro": (pedido.bairro or "").strip(),
            }
    return None


def _data_local(dt):
    if dt is None:
        return None
    if timezone.is_aware(dt):
        return timezone.localtime(dt)
    return dt


def _decimal_para_float(valor, padrao=0.0):
    if valor is None:
        return padrao
    try:
        numero = float(valor)
        return numero if numero == numero else padrao
    except (TypeError, ValueError, InvalidOperation):
        return padrao


def _contar_pedidos_pendentes():
    return Pedido.objects.filter(status__in=["Em preparação", "A caminho"]).count()


def inicio(request):
    return render(request, "cliente/inicio.html")


def produtos(request):
    produtos_disponiveis = Produto.objects.filter(disponivel=True).order_by("id")
    return render(
        request,
        "cliente/produtos.html",
        {"produtos": produtos_disponiveis},
    )


def carrinho(request):
    return render(request, "cliente/carrinho.html")


def finalizar_pedido(request):
    return render(request, "cliente/finalizar_pedido.html")


def meus_pedidos(request):
    return render(request, "cliente/meus_pedidos.html")


@require_http_methods(["GET", "POST"])
def entrar(request):
    _garantir_admin_padrao()

    if request.method == "GET":
        aba_ativa = "admin" if request.GET.get("aba") == "admin" else "cliente"
        next_url = (request.GET.get("next") or "").strip()
        return render(
            request,
            "cliente/entrar.html",
            {
                "aba_ativa": aba_ativa,
                "next_url": next_url,
            },
        )

    tipo_login = (request.POST.get("tipo_login") or "cliente").strip()
    next_url = (request.POST.get("next") or "").strip()
    url_segura = (
        next_url
        if (
            next_url
            and url_has_allowed_host_and_scheme(
                next_url,
                allowed_hosts={request.get_host()},
                require_https=request.is_secure(),
            )
        )
        else ""
    )

    if tipo_login == "admin":
        usuario = (request.POST.get("usuario") or "").strip()
        senha = request.POST.get("senha") or ""

        if not usuario or not senha:
            return render(
                request,
                "cliente/entrar.html",
                {
                    "aba_ativa": "admin",
                    "erro_admin": "Informe o usuário e a senha.",
                    "usuario_informado": usuario,
                    "next_url": next_url,
                },
            )

        user = authenticate(request, username=usuario, password=senha)
        if user is not None and _usuario_eh_admin(user):
            login(request, user)
            if url_segura and url_segura.startswith("/administrativo"):
                return redirect(url_segura)
            return redirect("admin_dashboard")

        return render(
            request,
            "cliente/entrar.html",
            {
                "aba_ativa": "admin",
                "erro_admin": "Usuário ou senha incorretos.",
                "usuario_informado": usuario,
                "next_url": next_url,
            },
        )

    telefone = (request.POST.get("telefone") or "").strip()
    digitos = "".join(c for c in telefone if c.isdigit())
    if not digitos:
        return render(
            request,
            "cliente/entrar.html",
            {
                "aba_ativa": "cliente",
                "erro_cliente": "Informe um número de telefone válido.",
                "telefone_informado": telefone,
                "next_url": next_url,
            },
        )

    dados_cliente = _buscar_cliente_por_telefone(telefone)
    if dados_cliente is None:
        return render(
            request,
            "cliente/entrar.html",
            {
                "aba_ativa": "cliente",
                "erro_cliente": "Nenhum cadastro encontrado para este telefone. Faça seu primeiro pedido para registrar seus dados!",
                "telefone_informado": telefone,
                "next_url": next_url,
            },
        )

    request.session["cliente_logado"] = dados_cliente
    if url_segura and not url_segura.startswith("/administrativo"):
        return redirect(url_segura)
    return redirect("inicio")


def sair(request):
    logout(request)
    return redirect("inicio")


@require_http_methods(["GET"])
def api_produtos(request):
    """
    GET /api/produtos/
    Retorna a lista de produtos disponíveis em formato JSON.
    """
    produtos_qs = Produto.objects.filter(disponivel=True).order_by("id")
    dados = [
        {
            "id": p.id,
            "nome": p.nome or "",
            "categoria": p.categoria or "gas",
            "preco": _decimal_para_float(p.preco),
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
        telefone = (request.GET.get("telefone") or "").strip()
        pedidos_qs = Pedido.objects.all().prefetch_related("itens")

        if telefone:
            pedidos_qs = pedidos_qs.filter(telefone=telefone)

        pedidos_lista = []
        for pedido in pedidos_qs:
            itens = [
                {
                    "nome": item.nome_produto or "",
                    "preco": _decimal_para_float(item.preco_unitario),
                    "quantidade": item.quantidade or 1,
                }
                for item in pedido.itens.all()
            ]

            dt_local = _data_local(pedido.criado_em)
            data_str = dt_local.strftime("%d/%m/%Y, %H:%M:%S") if dt_local else "--"

            pedidos_lista.append(
                {
                    "numero": pedido.id,
                    "data": data_str,
                    "cliente": pedido.cliente or "",
                    "telefone": pedido.telefone or "",
                    "endereco": pedido.endereco or "",
                    "numeroEndereco": pedido.numero_endereco or "",
                    "numero_endereco": pedido.numero_endereco or "",
                    "bairro": pedido.bairro or "",
                    "observacao": pedido.observacao or "",
                    "produtos": itens,
                    "total": _decimal_para_float(pedido.total),
                    "status": pedido.status or "Em preparação",
                    "forma_pagamento": pedido.forma_pagamento
                    or "Presencial na entrega (Dinheiro/Cartão/Pix)",
                }
            )

        return JsonResponse(pedidos_lista, safe=False)

    elif request.method == "POST":
        try:
            dados = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"erro": "JSON inválido no corpo da requisição."}, status=400)

        cliente = (dados.get("cliente") or dados.get("nome") or "").strip()
        telefone = (dados.get("telefone") or "").strip()
        endereco = (dados.get("endereco") or "").strip()
        numero_endereco = (
            dados.get("numero_endereco")
            or dados.get("numeroEndereco")
            or dados.get("numero")
            or ""
        ).strip()
        bairro = (dados.get("bairro") or "").strip()
        observacao = (dados.get("observacao") or "").strip()
        produtos_recebidos = dados.get("produtos") or []

        if not all([cliente, telefone, endereco, numero_endereco, bairro]):
            return JsonResponse(
                {"erro": "Campos obrigatórios: cliente, telefone, endereco, numero_endereco, bairro."},
                status=400,
            )

        if not produtos_recebidos:
            return JsonResponse(
                {"erro": "O pedido deve conter pelo menos um produto no carrinho."},
                status=400,
            )

        total_calculado = Decimal("0.00")
        itens_validados = []
        for item in produtos_recebidos:
            nome_prod = (item.get("nome") or "").strip()
            try:
                preco_unit = Decimal(str(item.get("preco") or 0)).quantize(Decimal("0.01"))
            except (InvalidOperation, TypeError, ValueError):
                preco_unit = Decimal("0.00")
            try:
                qtd = max(1, int(item.get("quantidade") or 1))
            except (TypeError, ValueError):
                qtd = 1

            total_calculado += preco_unit * qtd
            itens_validados.append(
                {
                    "id": item.get("id"),
                    "nome": nome_prod,
                    "preco": preco_unit,
                    "quantidade": qtd,
                }
            )

        try:
            total = (
                Decimal(str(dados.get("total"))).quantize(Decimal("0.01"))
                if dados.get("total") is not None
                else total_calculado
            )
        except (InvalidOperation, TypeError, ValueError):
            total = total_calculado

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

            for item in itens_validados:
                prod_obj = None
                if item["id"]:
                    prod_obj = Produto.objects.filter(pk=item["id"]).first()
                if prod_obj is None and item["nome"]:
                    prod_obj = Produto.objects.filter(nome=item["nome"]).first()

                ItemPedido.objects.create(
                    pedido=pedido,
                    produto=prod_obj,
                    nome_produto=item["nome"] or (prod_obj.nome if prod_obj else "Produto"),
                    preco_unitario=item["preco"],
                    quantidade=item["quantidade"],
                )

        cliente_sessao = request.session.get("cliente_logado")
        if cliente_sessao:
            chave_sessao = cliente_sessao.get("telefone_chave") or _chave_cliente(
                cliente_sessao.get("telefone")
            )
            if chave_sessao and chave_sessao == _chave_cliente(telefone):
                primeiro_nome = cliente.split()[0] if cliente else "Cliente"
                request.session["cliente_logado"] = {
                    "nome": cliente,
                    "primeiro_nome": primeiro_nome,
                    "telefone": telefone,
                    "telefone_chave": chave_sessao,
                    "endereco": endereco,
                    "numero_endereco": numero_endereco,
                    "bairro": bairro,
                }

        return JsonResponse(
            {
                "mensagem": "Pedido confirmado com sucesso!",
                "numero": pedido.id,
                "status": pedido.status,
                "total": _decimal_para_float(pedido.total),
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

    dt_local = _data_local(pedido.criado_em)
    return JsonResponse(
        {
            "numero": pedido.id,
            "status": pedido.status or "Em preparação",
            "cliente": pedido.cliente or "",
            "total": _decimal_para_float(pedido.total),
            "data": dt_local.strftime("%d/%m/%Y, %H:%M:%S") if dt_local else "--",
        }
    )


@_requer_admin
def admin_dashboard(request):
    return render(request, "admin/dashboard.html")


@_requer_admin
def admin_pedidos(request):
    return render(request, "admin/pedidos.html")


@_requer_admin
def admin_detalhes_pedido(request):
    return render(request, "admin/detalhes_pedido.html")


@_requer_admin
def admin_clientes(request):
    return render(request, "admin/clientes.html")


@_requer_admin
def admin_produtos(request):
    return render(request, "admin/produtos.html")


@_requer_admin
@require_http_methods(["GET", "POST"])
def admin_configuracoes(request):
    contexto = {
        "pendentes": _contar_pedidos_pendentes(),
    }

    if request.method == "POST":
        senha_atual = request.POST.get("senha_atual") or ""
        nova_senha = request.POST.get("nova_senha") or ""
        confirmar_senha = request.POST.get("confirmar_senha") or ""

        if not senha_atual or not nova_senha or not confirmar_senha:
            contexto["erro"] = "Preencha todos os campos para alterar a senha."
        elif not request.user.check_password(senha_atual):
            contexto["erro"] = "A senha atual informada está incorreta."
        elif len(nova_senha) < 4:
            contexto["erro"] = "A nova senha deve ter pelo menos 4 caracteres."
        elif nova_senha != confirmar_senha:
            contexto["erro"] = "A confirmação da nova senha não confere."
        else:
            request.user.set_password(nova_senha)
            request.user.save(update_fields=["password"])
            update_session_auth_hash(request, request.user)
            contexto["sucesso"] = "Senha alterada com sucesso!"

    return render(request, "admin/configuracoes.html", contexto)


def _produto_para_dict(p):
    return {
        "id": p.id,
        "nome": p.nome or "",
        "categoria": p.categoria or "gas",
        "preco": _decimal_para_float(p.preco),
        "descricao": p.descricao or "",
        "disponivel": bool(p.disponivel),
    }


def _validar_dados_produto(dados):
    """
    Valida o payload de produto (nome, categoria, preco, descricao).
    Retorna (campos_validados, mensagem_de_erro).
    """
    nome = (dados.get("nome") or "").strip()
    categoria = (dados.get("categoria") or "").strip()
    descricao = (dados.get("descricao") or "").strip()

    try:
        preco = Decimal(str(dados.get("preco")))
    except (InvalidOperation, TypeError):
        return None, "Preço inválido."

    if not nome:
        return None, "O nome do produto é obrigatório."
    if categoria not in dict(Produto.CATEGORIA_CHOICES):
        return None, "Categoria inválida. Use: gas, agua ou carvao."
    if not preco.is_finite() or preco <= 0:
        return None, "O preço deve ser maior que zero."

    return {
        "nome": nome,
        "categoria": categoria,
        "preco": preco.quantize(Decimal("0.01")),
        "descricao": descricao,
    }, None


@csrf_exempt
@_requer_admin_api
def api_admin_produtos(request):
    """
    GET /api/admin/produtos/ -> Lista todos os produtos (inclusive indisponíveis) + indicadores
    POST /api/admin/produtos/ -> Cadastra um novo produto
    """
    if request.method == "GET":
        produtos_qs = Produto.objects.all().order_by("id")
        dados = [_produto_para_dict(p) for p in produtos_qs]

        contagem = Counter(p["categoria"] for p in dados if p.get("categoria"))
        categoria_principal = contagem.most_common(1)[0][0] if contagem else None

        return JsonResponse(
            {
                "total": len(dados),
                "disponiveis": sum(1 for p in dados if p["disponivel"]),
                "categoria_principal": categoria_principal,
                "pendentes": _contar_pedidos_pendentes(),
                "produtos": dados,
            }
        )

    elif request.method == "POST":
        try:
            dados = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"erro": "JSON inválido no corpo da requisição."}, status=400)

        campos, erro = _validar_dados_produto(dados)
        if erro:
            return JsonResponse({"erro": erro}, status=400)

        produto = Produto.objects.create(**campos)
        return JsonResponse(_produto_para_dict(produto), status=201)

    return JsonResponse({"erro": "Método não permitido."}, status=405)


@csrf_exempt
@_requer_admin_api
def api_admin_produto_detalhe(request, produto_id):
    """
    PUT /api/admin/produtos/<id>/ -> Edita um produto
    DELETE /api/admin/produtos/<id>/ -> Exclui um produto
    """
    try:
        produto = Produto.objects.get(pk=produto_id)
    except Produto.DoesNotExist:
        return JsonResponse({"erro": "Produto não encontrado."}, status=404)

    if request.method == "PUT":
        try:
            dados = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"erro": "JSON inválido no corpo da requisição."}, status=400)

        campos, erro = _validar_dados_produto(dados)
        if erro:
            return JsonResponse({"erro": erro}, status=400)

        for campo, valor in campos.items():
            setattr(produto, campo, valor)
        if "disponivel" in dados:
            produto.disponivel = bool(dados["disponivel"])
        produto.save()

        return JsonResponse(_produto_para_dict(produto))

    elif request.method == "DELETE":
        produto.delete()
        return JsonResponse({"mensagem": "Produto excluído com sucesso."})

    return JsonResponse({"erro": "Método não permitido."}, status=405)


def _pedido_para_dict(p):
    dt_local = _data_local(p.criado_em)
    return {
        "id": p.id,
        "numero": f"#{p.id:03d}",
        "cliente": p.cliente or "Cliente não informado",
        "telefone": p.telefone or "—",
        "endereco": p.endereco or "",
        "numero_endereco": p.numero_endereco or "",
        "bairro": p.bairro or "",
        "data": dt_local.strftime("%d/%m/%Y") if dt_local else "--/--/----",
        "hora": dt_local.strftime("%H:%M") if dt_local else "--:--",
        "data_iso": dt_local.isoformat() if dt_local else "",
        "total": _decimal_para_float(p.total),
        "status": p.status or "Em preparação",
        "forma_pagamento": p.forma_pagamento
        or "Presencial na entrega (Dinheiro/Cartão/Pix)",
    }


@require_http_methods(["GET"])
@_requer_admin_api
def api_admin_pedidos(request):
    """
    GET /api/admin/pedidos/ -> Retorna a lista de pedidos filtrada + contadores para o painel
    Parâmetros opcionais:
      - busca: texto para filtrar por cliente, telefone ou ID
      - status: status do pedido ('Em preparação', 'A caminho', 'Entregue', 'Cancelado')
      - periodo: 'hoje', '7dias', '30dias'
    """
    pedidos_qs = Pedido.objects.all().order_by("-criado_em")

    busca = (request.GET.get("busca") or "").strip()
    if busca:
        filtro_busca = Q(cliente__icontains=busca) | Q(telefone__icontains=busca)
        num_limpo = busca.lstrip("#").lstrip("0")
        if num_limpo.isdigit():
            filtro_busca |= Q(id=int(num_limpo))
        pedidos_qs = pedidos_qs.filter(filtro_busca)

    status = (request.GET.get("status") or "").strip()
    if status and status != "todos":
        pedidos_qs = pedidos_qs.filter(status=status)

    periodo = (request.GET.get("periodo") or "").strip()
    agora_local = timezone.localtime(timezone.now())
    if periodo == "hoje":
        inicio_hoje = agora_local.replace(hour=0, minute=0, second=0, microsecond=0)
        pedidos_qs = pedidos_qs.filter(criado_em__gte=inicio_hoje)
    elif periodo == "7dias":
        limite_7dias = agora_local - timedelta(days=7)
        pedidos_qs = pedidos_qs.filter(criado_em__gte=limite_7dias)
    elif periodo == "30dias":
        limite_30dias = agora_local - timedelta(days=30)
        pedidos_qs = pedidos_qs.filter(criado_em__gte=limite_30dias)

    pedidos_lista = [_pedido_para_dict(p) for p in pedidos_qs]
    pendentes_count = _contar_pedidos_pendentes()

    return JsonResponse(
        {
            "total": len(pedidos_lista),
            "pendentes": pendentes_count,
            "pedidos": pedidos_lista,
        }
    )


def _categoria_produto_item(item):
    if item.produto and item.produto.categoria:
        return item.produto.categoria
    nome = (item.nome_produto or "").lower()
    if "água" in nome or "agua" in nome:
        return "agua"
    elif "carvão" in nome or "carvao" in nome:
        return "carvao"
    return "gas"


@csrf_exempt
@_requer_admin_api
def api_admin_pedido_detalhe(request, pedido_id):
    """
    GET /api/admin/pedidos/<id>/ -> Retorna detalhes completos do pedido e seus itens
    PATCH/PUT/POST /api/admin/pedidos/<id>/ -> Atualiza o status do pedido
    """
    try:
        pedido = Pedido.objects.prefetch_related("itens__produto").get(pk=pedido_id)
    except Pedido.DoesNotExist:
        return JsonResponse({"erro": "Pedido não encontrado."}, status=404)

    if request.method == "GET":
        itens = [
            {
                "id": item.id,
                "nome": item.nome_produto or "Produto",
                "quantidade": item.quantidade or 1,
                "preco_unitario": _decimal_para_float(item.preco_unitario),
                "subtotal": _decimal_para_float(item.subtotal),
                "categoria": _categoria_produto_item(item),
            }
            for item in pedido.itens.all()
        ]

        dados = _pedido_para_dict(pedido)
        dados["itens"] = itens
        dados["observacao"] = pedido.observacao or ""
        dados["pendentes"] = _contar_pedidos_pendentes()
        return JsonResponse(dados)

    elif request.method in ["PATCH", "PUT", "POST"]:
        try:
            dados = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"erro": "JSON inválido no corpo da requisição."}, status=400)

        novo_status = dados.get("status")
        status_validos = [choice[0] for choice in Pedido.STATUS_CHOICES]
        if novo_status not in status_validos:
            return JsonResponse(
                {"erro": f"Status inválido. Escolha um dos seguintes: {', '.join(status_validos)}"},
                status=400,
            )

        pedido.status = novo_status
        pedido.save(update_fields=["status"])

        return JsonResponse(
            {
                "mensagem": "Status atualizado com sucesso!",
                "status": pedido.status,
                "id": pedido.id,
                "pendentes": _contar_pedidos_pendentes(),
            }
        )

    return JsonResponse({"erro": "Método não permitido."}, status=405)


def _chave_cliente(telefone):
    """Identifica o cliente pelo telefone (somente dígitos), pois não há model Cliente."""
    digitos = "".join(c for c in (telefone or "") if c.isdigit())
    return digitos or (telefone or "").strip()


@require_http_methods(["GET"])
@_requer_admin_api
def api_admin_clientes(request):
    """
    GET /api/admin/clientes/ -> Lista os clientes (derivados dos pedidos, agrupados por telefone)
    com histórico de pedidos e indicadores para o painel.
    """
    pedidos_qs = (
        Pedido.objects.all().order_by("id").prefetch_related("itens")
    )

    clientes_map = {}
    for pedido in pedidos_qs:
        chave = _chave_cliente(pedido.telefone) or f"pedido-{pedido.id}"
        cliente = clientes_map.setdefault(chave, {"pedidos": []})

        # Como a ordem é crescente, nome/telefone/endereço ficam com os do pedido mais recente
        cliente["nome"] = (pedido.cliente or "").strip() or "Cliente sem nome"
        cliente["telefone"] = (pedido.telefone or "").strip() or "—"
        end = (pedido.endereco or "").strip()
        num = (pedido.numero_endereco or "").strip()
        cliente["endereco"] = f"{end}, {num}" if (end and num) else (end or num or "—")
        cliente["bairro"] = (pedido.bairro or "").strip() or "—"

        produtos = ", ".join(
            f"{item.quantidade or 1}x {item.nome_produto or 'Produto'}"
            for item in pedido.itens.all()
        )
        dt_local = _data_local(pedido.criado_em)
        cliente["pedidos"].append(
            {
                "id": pedido.id,
                "numero": f"#{pedido.id:03d}",
                "produtos": produtos or "Itens não informados",
                "data": dt_local.strftime("%d/%m/%Y") if dt_local else "--/--/----",
                "hora": dt_local.strftime("%H:%M") if dt_local else "--:--",
                "total": _decimal_para_float(pedido.total),
                "status": pedido.status or "Em preparação",
            }
        )

    clientes_lista = []
    for indice, cliente in enumerate(clientes_map.values(), start=1):
        cliente["pedidos"].reverse()  # histórico do mais recente para o mais antigo
        clientes_lista.append(
            {
                "id": indice,
                "numero": f"#{indice:03d}",
                "nome": cliente["nome"],
                "telefone": cliente["telefone"],
                "endereco": cliente["endereco"],
                "bairro": cliente["bairro"],
                "total_pedidos": len(cliente["pedidos"]),
                "pedidos": cliente["pedidos"],
            }
        )

    return JsonResponse(
        {
            "total": len(clientes_lista),
            "pedidos_realizados": sum(c["total_pedidos"] for c in clientes_lista),
            "sem_pedidos": sum(1 for c in clientes_lista if c["total_pedidos"] == 0),
            "pendentes": _contar_pedidos_pendentes(),
            "clientes": clientes_lista,
        }
    )


@require_http_methods(["GET"])
@_requer_admin_api
def api_admin_dashboard(request):
    """
    GET /api/admin/dashboard/ -> Retorna os indicadores gerais do negócio
    (total de pedidos, em andamento, entregues, clientes) e os últimos pedidos.
    Protegido com Coalesce e validações contra tabelas vazias, NULL e divisão por zero.
    """
    resumo = Pedido.objects.aggregate(
        total_pedidos=Coalesce(Count("id"), 0),
        em_andamento=Coalesce(
            Count("id", filter=Q(status__in=["Em preparação", "A caminho"])), 0
        ),
        entregues=Coalesce(Count("id", filter=Q(status="Entregue")), 0),
        cancelados=Coalesce(Count("id", filter=Q(status="Cancelado")), 0),
        faturamento_total=Coalesce(
            Sum("total", filter=~Q(status="Cancelado")),
            Value(Decimal("0.00")),
            output_field=DecimalField(max_digits=12, decimal_places=2),
        ),
    )

    total_pedidos = int(resumo.get("total_pedidos") or 0)
    em_andamento = int(resumo.get("em_andamento") or 0)
    entregues = int(resumo.get("entregues") or 0)
    cancelados = int(resumo.get("cancelados") or 0)
    faturamento_total = _decimal_para_float(resumo.get("faturamento_total"), 0.0)

    pedidos_validos = max(0, total_pedidos - cancelados)
    taxa_entrega = round((entregues / total_pedidos) * 100, 1) if total_pedidos > 0 else 0.0
    ticket_medio = (
        round(faturamento_total / pedidos_validos, 2) if pedidos_validos > 0 else 0.0
    )

    telefones = Pedido.objects.values_list("telefone", flat=True)
    clientes_unicos = {_chave_cliente(tel) for tel in telefones if _chave_cliente(tel)}

    pedidos_recentes_qs = Pedido.objects.all().order_by("-criado_em")[:5]
    pedidos_recentes = [_pedido_para_dict(p) for p in pedidos_recentes_qs]

    return JsonResponse(
        {
            "total_pedidos": total_pedidos,
            "em_andamento": em_andamento,
            "entregues": entregues,
            "total_clientes": len(clientes_unicos),
            "faturamento_total": faturamento_total,
            "ticket_medio": ticket_medio,
            "taxa_entrega": taxa_entrega,
            "pedidos_recentes": pedidos_recentes,
        }
    )
