
function alterarQuantidade(botao, valor) {

    const quantidade = botao.parentElement.querySelector("span");

    let numero = parseInt(quantidade.textContent);

    numero += valor;

    if (numero < 1) {
        numero = 1;
    }

    quantidade.textContent = numero;
}


function adicionarPedido(botao) {

    const produto = botao.closest(".produto");

    const nome = produto.querySelector("h3").textContent;

    const precoTexto = produto.querySelector("strong").textContent;

    const preco = parseFloat(
        precoTexto.replace("R$", "").replace(",", ".")
    );

    const quantidade = parseInt(
        produto.querySelector(".quantidade span").textContent
    );

    let carrinho = JSON.parse(
        localStorage.getItem("carrinhoBomGas")
    ) || [];

    const produtoExistente = carrinho.find(
        item => item.nome === nome
    );

    if (produtoExistente) {

        produtoExistente.quantidade += quantidade;

    } else {

        carrinho.push({
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
        total += item.quantidade;
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

    if (carrinho.length === 0) {

        lista.innerHTML =
            "<p>Nenhum produto adicionado ao pedido.</p>";

        return;
    }

    lista.innerHTML = "";

    let total = 0;

    carrinho.forEach(item => {

        const subtotal = item.preco * item.quantidade;

        total += subtotal;

        const produto = document.createElement("div");

        produto.className = "item-carrinho";

        produto.innerHTML = `

            <h3>${item.nome}</h3>

            <div class="controle-carrinho">

                <button
                    type="button"
                    onclick="alterarQuantidadeCarrinho('${item.nome}', -1)">
                    -
                </button>

                <span>${item.quantidade}</span>

                <button
                    type="button"
                    onclick="alterarQuantidadeCarrinho('${item.nome}', 1)">
                    +
                </button>

            </div>

            <strong>
                R$ ${subtotal.toFixed(2).replace(".", ",")}
            </strong>

            <button
                type="button"
                class="btn-remover"
                onclick="removerProdutoCarrinho('${item.nome}')">
                Remover
            </button>

        `;

        lista.appendChild(produto);

    });

    const totalElemento =
        document.querySelector(".resumo-pedido h2");

    if (totalElemento) {

        totalElemento.textContent =
            "Total: R$ " +
            total.toFixed(2).replace(".", ",");

    }
}


carregarCarrinho();

atualizarContadorCarrinho();


function alterarQuantidadeCarrinho(nome, valor) {

    let carrinho = JSON.parse(
        localStorage.getItem("carrinhoBomGas")
    ) || [];

    const produto = carrinho.find(
        item => item.nome === nome
    );

    if (!produto) {
        return;
    }

    produto.quantidade += valor;

    if (produto.quantidade < 1) {
        produto.quantidade = 1;
    }

    localStorage.setItem(
        "carrinhoBomGas",
        JSON.stringify(carrinho)
    );

    carregarCarrinho();

    atualizarContadorCarrinho();
}


function removerProdutoCarrinho(nome) {

    let carrinho = JSON.parse(
        localStorage.getItem("carrinhoBomGas")
    ) || [];

    carrinho = carrinho.filter(
        item => item.nome !== nome
    );

    localStorage.setItem(
        "carrinhoBomGas",
        JSON.stringify(carrinho)
    );

    carregarCarrinho();

    atualizarContadorCarrinho();
}


function confirmarPedido() {

    const nome =
        document.getElementById("nome").value;

    const telefone =
        document.getElementById("telefone").value;

    const endereco =
        document.getElementById("endereco").value;

    const numero =
        document.getElementById("numero").value;

    const bairro =
        document.getElementById("bairro").value;

    const observacao =
        document.getElementById("observacao").value;

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

        const subtotal =
            item.preco * item.quantidade;

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
        .then(data => {

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
                    observacao.trim() !== ""
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

    const detalhes =
        botao.nextElementSibling;

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

                pedido.produtos.forEach(item => {

                    produtosHTML += `
                        <p>
                            ${item.quantidade}x ${item.nome}
                        </p>
                    `;

                });

                card.innerHTML = `

                    <div class="pedido-topo">

                        <h2>
                            Pedido #${String(pedido.numero).padStart(3, "0")}
                        </h2>

                        <span class="status pedido-andamento">
                            ${pedido.status}
                        </span>

                    </div>


                    <p class="data-pedido">
                        📅 ${pedido.data}
                    </p>


                    <div class="itens-pedido">

                        ${produtosHTML}

                    </div>


                    <div class="pedido-total">

                        <strong>
                            Total: R$ ${Number(pedido.total)
                        .toFixed(2)
                        .replace(".", ",")}
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
                            ${pedido.cliente}
                        </p>

                        <p>
                            <strong>Telefone:</strong>
                            ${pedido.telefone}
                        </p>

                        <p>
                            <strong>Endereço:</strong>
                            ${pedido.endereco},
                            ${pedido.numeroEndereco}
                            - ${pedido.bairro}
                        </p>

                        <p>
                            <strong>Pagamento:</strong>
                            Não informado
                        </p>

                        ${pedido.observacao &&
                        pedido.observacao.trim() !== ""
                        ?
                        `<p>
                                <strong>Observação:</strong>
                                ${pedido.observacao}
                            </p>`
                        :
                        ""
                    }

                        <p>
                            <strong>Status:</strong>
                            ${pedido.status}
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



