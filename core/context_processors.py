def cliente_sessao(request):
    return {
        "cliente_sessao": request.session.get("cliente_logado"),
    }

