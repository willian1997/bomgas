function alterarQuantidade(botao, valor) {
    const quantidade = botao.parentElement.querySelector("span");
    let numero = parseInt(quantidade.textContent, 10) || 1;

    numero += valor;
    if (numero < 1) {
        numero = 1;
    }

    quantidade.textContent = numero;
}


function adicionarPedido(botao) {
    const produto = botao.closest(".produto");
    const id = produto.dataset.id ? parseInt(produto.dataset.id, 10) : null;
    const nome = produto.querySelector("h3").textContent.trim();
    const precoTexto = produto.querySelector("strong").textContent;
    const preco = parseFloat(
        precoTexto.replace("R$", "").replace(",", ".").trim()
    ) || 0;
    const quantidade = parseInt(
        produto.querySelector(".quantidade span").textContent,
        10
    ) || 1;

    let carrinho = JSON.parse(
        localStorage.getItem("carrinhoBomGas")
    ) || [];

    const produtoExistente = carrinho.find(
        item => (id && item.id === id) || item.nome === nome
    );

    if (produtoExistente) {
        produtoExistente.quantidade += quantidade;
        produtoExistente.preco = preco;
        if (id) produtoExistente.id = id;
    } else {
        carrinho.push({
            id: id,
            nome: nome,
            preco: preco,
            quantidade: quantidade
        });
    }

    localStorage.setItem(
        "carrinhoBomGas",
        JSON.stringify(carrinho)
    );

    atualizarContadorCarrinho();

    alert("Produto adicionado ao pedido!");
}


function atualizarContadorCarrinho() {
    const contador = document.getElementById("contador-carrinho");
    if (!contador) {
        return;
    }

    const carrinho = JSON.parse(
        localStorage.getItem("carrinhoBomGas")
    ) || [];

    let total = 0;
    carrinho.forEach(item => {
        total += Number(item.quantidade) || 0;
    });

    contador.textContent = total;
}


function carregarCarrinho() {
    const lista = document.getElementById("lista-carrinho");
    if (!lista) {
        return;
    }

    const carrinho = JSON.parse(
        localStorage.getItem("carrinhoBomGas")
    ) || [];

    const totalElemento = document.querySelector(".resumo-pedido h2");

    if (carrinho.length === 0) {
        lista.innerHTML = "<p>Nenhum produto adicionado ao pedido.</p>";
        if (totalElemento) {
            totalElemento.textContent = "Total: R$ 0,00";
        }
        return;
    }

    lista.innerHTML = "";
    let total = 0;

    carrinho.forEach((item, indice) => {
        const preco = Number(item.preco) || 0;
        const qtd = Number(item.quantidade) || 1;
        const subtotal = preco * qtd;
        total += subtotal;

        const produto = document.createElement("div");
        produto.className = "item-carrinho";

        const titulo = document.createElement("h3");
        titulo.textContent = item.nome;

        const controles = document.createElement("div");
        controles.className = "controle-carrinho";

        const btnMenos = document.createElement("button");
        btnMenos.type = "button";
        btnMenos.textContent = "-";
        btnMenos.addEventListener("click", () => alterarQuantidadeCarrinhoIndice(indice, -1));

        const spanQtd = document.createElement("span");
        spanQtd.textContent = qtd;

        const btnMais = document.createElement("button");
        btnMais.type = "button";
        btnMais.textContent = "+";
        btnMais.addEventListener("click", () => alterarQuantidadeCarrinhoIndice(indice, 1));

        controles.append(btnMenos, spanQtd, btnMais);

        const valorStrong = document.createElement("strong");
        valorStrong.textContent = "R$ " + subtotal.toFixed(2).replace(".", ",");

        const btnRemover = document.createElement("button");
        btnRemover.type = "button";
        btnRemover.className = "btn-remover";
        btnRemover.textContent = "Remover";
        btnRemover.addEventListener("click", () => removerProdutoCarrinhoIndice(indice));

        produto.append(titulo, controles, valorStrong, document.createElement("br"), btnRemover);
        lista.appendChild(produto);
    });

    if (totalElemento) {
        totalElemento.textContent =
            "Total: R$ " + total.toFixed(2).replace(".", ",");
    }
}


function alterarQuantidadeCarrinhoIndice(indice, valor) {
    let carrinho = JSON.parse(
        localStorage.getItem("carrinhoBomGas")
    ) || [];

    if (!carrinho[indice]) {
        return;
    }

    carrinho[indice].quantidade += valor;
    if (carrinho[indice].quantidade < 1) {
        carrinho[indice].quantidade = 1;
    }

    localStorage.setItem("carrinhoBomGas", JSON.stringify(carrinho));
    carregarCarrinho();
    atualizarContadorCarrinho();
}


function removerProdutoCarrinhoIndice(indice) {
    let carrinho = JSON.parse(
        localStorage.getItem("carrinhoBomGas")
    ) || [];

    carrinho.splice(indice, 1);

    localStorage.setItem("carrinhoBomGas", JSON.stringify(carrinho));
    carregarCarrinho();
    atualizarContadorCarrinho();
}


function alterarQuantidadeCarrinho(nome, valor) {
    let carrinho = JSON.parse(
        localStorage.getItem("carrinhoBomGas")
    ) || [];
    const idx = carrinho.findIndex(item => item.nome === nome);
    if (idx !== -1) {
        alterarQuantidadeCarrinhoIndice(idx, valor);
    }
}


function removerProdutoCarrinho(nome) {
    let carrinho = JSON.parse(
        localStorage.getItem("carrinhoBomGas")
    ) || [];
    const idx = carrinho.findIndex(item => item.nome === nome);
    if (idx !== -1) {
        removerProdutoCarrinhoIndice(idx);
    }
}


function irParaFinalizarPedido(urlDestino) {
    const carrinho = JSON.parse(
        localStorage.getItem("carrinhoBomGas")
    ) || [];

    if (carrinho.length === 0) {
        alert("Adicione pelo menos um produto ao pedido antes de finalizar.");
        return;
    }

    window.location.href = urlDestino || "/finalizar-pedido/";
}


carregarCarrinho();
atualizarContadorCarrinho();


function confirmarPedido() {
    const nome = (document.getElementById("nome").value || "").trim();
    const telefone = (document.getElementById("telefone").value || "").trim();
    const endereco = (document.getElementById("endereco").value || "").trim();
    const numero = (document.getElementById("numero").value || "").trim();
    const bairro = (document.getElementById("bairro").value || "").trim();
    const observacao = (document.getElementById("observacao").value || "").trim();

    if (!nome || !telefone || !endereco || !numero || !bairro) {
        alert("Por favor, preencha todos os campos obrigatórios.");
        return;
    }

    const carrinho = JSON.parse(
        localStorage.getItem("carrinhoBomGas")
    ) || [];

    if (carrinho.length === 0) {
        alert("Seu pedido está vazio.");
        return;
    }

    let resumo = "";
    let total = 0;

    carrinho.forEach(item => {
        const subtotal = (Number(item.preco) || 0) * (Number(item.quantidade) || 1);
        total += subtotal;
        resumo +=
            item.nome +
            " - " +
            item.quantidade +
            "x - R$ " +
            subtotal.toFixed(2).replace(".", ",") +
            "\n";
    });

    /*
     * SALVA O PEDIDO NA API
     */
    const novoPedido = {
        cliente: nome,
        telefone: telefone,
        endereco: endereco,
        numero_endereco: numero,
        numeroEndereco: numero,
        bairro: bairro,
        observacao: observacao,
        produtos: carrinho,
        total: total
    };

    fetch("/api/pedidos/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(novoPedido)
    })
        .then(response => {
            if (!response.ok) {
                throw new Error("Erro na requisição da API");
            }
            return response.json();
        })
        .then(() => {
            alert(
                "PEDIDO CONFIRMADO!\n\n" +
                "Cliente: " + nome + "\n" +
                "Telefone: " + telefone + "\n\n" +
                "PRODUTOS:\n" +
                resumo +
                "\nTotal: R$ " +
                total.toFixed(2).replace(".", ",") +
                "\n\nENTREGA:\n" +
                endereco + ", " +
                numero +
                " - " +
                bairro +
                (
                    observacao !== ""
                        ? "\nObservação: " + observacao
                        : ""
                )
            );

            /*
             * LIMPA O CARRINHO
             */
            localStorage.removeItem("carrinhoBomGas");

            /*
             * VOLTA PARA A PÁGINA INICIAL
             */
            window.location.href = "/";
        })
        .catch(error => {
            alert("Ocorreu um erro ao confirmar o seu pedido. Tente novamente.");
            console.error("Erro ao enviar pedido para o back-end:", error);
        });
}


/*
 * MOSTRAR / OCULTAR DETALHES DO PEDIDO
 */
function mostrarDetalhes(botao) {
    const detalhes = botao.nextElementSibling;

    if (detalhes.style.display === "block") {
        detalhes.style.display = "none";
        botao.textContent = "Ver detalhes";
    } else {
        detalhes.style.display = "block";
        botao.textContent = "Ocultar detalhes";
    }
}


function carregarPedidos() {
    const lista = document.getElementById("lista-pedidos");
    if (!lista) {
        return;
    }

    fetch("/api/pedidos/")
        .then(response => response.json())
        .then(pedidos => {
            if (!pedidos || pedidos.length === 0) {
                lista.innerHTML = `
                    <div class="sem-pedidos">
                        <p>📋 Você ainda não possui pedidos.</p>
                        <a href="/produtos/">Fazer um pedido</a>
                    </div>
                `;
                return;
            }

            lista.innerHTML = "";

            pedidos.forEach(pedido => {
                const card = document.createElement("div");
                card.className = "card-pedido";

                let produtosHTML = "";
                (pedido.produtos || []).forEach(item => {
                    produtosHTML += `
                        <p>
                            ${item.quantidade || 1}x ${item.nome || "Produto"}
                        </p>
                    `;
                });

                const statusTexto = pedido.status || "Em preparação";
                const classeBadge =
                    statusTexto === "Entregue" ? "pedido-entregue" : "pedido-andamento";
                const totalFormatado = (Number(pedido.total) || 0)
                    .toFixed(2)
                    .replace(".", ",");
                const formaPagamento =
                    pedido.forma_pagamento || "Presencial na entrega (Dinheiro/Cartão/Pix)";

                card.innerHTML = `
                    <div class="pedido-topo">
                        <h2>
                            Pedido #${String(pedido.numero || 0).padStart(3, "0")}
                        </h2>
                        <span class="status ${classeBadge}">
                            ${statusTexto}
                        </span>
                    </div>

                    <p class="data-pedido">
                        📅 ${pedido.data || "--"}
                    </p>

                    <div class="itens-pedido">
                        ${produtosHTML}
                    </div>

                    <div class="pedido-total">
                        <strong>
                            Total: R$ ${totalFormatado}
                        </strong>
                    </div>

                    <button
                        type="button"
                        class="btn-detalhes"
                        onclick="mostrarDetalhes(this)">
                        Ver detalhes
                    </button>

                    <div class="detalhes-pedido">
                        <p>
                            <strong>Cliente:</strong>
                            ${pedido.cliente || "—"}
                        </p>

                        <p>
                            <strong>Telefone:</strong>
                            ${pedido.telefone || "—"}
                        </p>

                        <p>
                            <strong>Endereço:</strong>
                            ${pedido.endereco || "—"},
                            ${pedido.numeroEndereco || pedido.numero_endereco || "S/N"}
                            - ${pedido.bairro || "—"}
                        </p>

                        <p>
                            <strong>Pagamento:</strong>
                            ${formaPagamento}
                        </p>

                        ${pedido.observacao && pedido.observacao.trim() !== ""
                            ? `<p>
                                <strong>Observação:</strong>
                                ${pedido.observacao}
                            </p>`
                            : ""
                        }

                        <p>
                            <strong>Status:</strong>
                            ${statusTexto}
                        </p>
                    </div>
                `;

                lista.appendChild(card);
            });
        })
        .catch(error => {
            console.error("Erro ao carregar pedidos da API:", error);
        });
}


carregarPedidos();
