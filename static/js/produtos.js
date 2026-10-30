document.addEventListener("DOMContentLoaded", function () {
    const campoBusca = document.getElementById("buscar-produto");
    const filtroCategoria = document.getElementById("filtro-produtos");
    const listaProdutos = document.getElementById("lista-produtos");
    const mensagemVazia = document.getElementById("nenhum-produto");
    const badgePedidos = document.getElementById("badge-pedidos");

    const btnMenuMobile = document.querySelector(".mobile-menu");
    const sidebar = document.querySelector(".sidebar");
    if (btnMenuMobile && sidebar) {
        btnMenuMobile.addEventListener("click", function () {
            sidebar.classList.toggle("open");
        });
    }

    const modalDetalhes = document.getElementById("modal-produto");
    const modalForm = document.getElementById("modal-form-produto");

    const formProduto = document.getElementById("form-produto");
    const btnNovo = document.getElementById("btn-novo-produto");

    const campoNome = document.getElementById("form-nome-produto");
    const campoCategoria = document.getElementById("form-categoria-produto");
    const campoPreco = document.getElementById("form-preco-produto");
    const campoDescricao = document.getElementById("form-descricao-produto");

    const API_PRODUTOS = "/api/admin/produtos/";

    let produtoEditando = null;
    let produtoSelecionado = null;

    function nomeCategoria(categoria) {
        const categorias = {
            gas: "Gás",
            agua: "Água",
            carvao: "Carvão"
        };

        return categorias[categoria] || categoria || "-";
    }

    function normalizarTexto(texto) {
        return (texto || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }

    function formatarPreco(valor) {
        const numero = Number(valor ?? 0);
        return (Number.isFinite(numero) ? numero : 0).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });
    }

    function classeImagem(categoria) {
        return categoria === "gas" ? "gas-image" :
            categoria === "agua" ? "water-image" : "charcoal-image";
    }

    function classeIcone(categoria) {
        return "fa-solid " + (
            categoria === "gas" ? "fa-fire-flame-curved" :
                categoria === "agua" ? "fa-droplet" : "fa-cubes-stacked"
        );
    }

    async function requisitar(url, opcoes) {
        const resposta = await fetch(url, opcoes);
        const dados = await resposta.json().catch(function () { return {}; });

        if (!resposta.ok) {
            throw new Error(dados.erro || "Erro ao comunicar com o servidor.");
        }

        return dados;
    }

    // Pesquisa e filtros
    function filtrarProdutos() {
        const busca = normalizarTexto(campoBusca.value);
        const categoria = filtroCategoria.value;
        let encontrados = 0;

        document.querySelectorAll(".product-card").forEach(function (produto) {
            const nome = normalizarTexto(produto.dataset.nome);
            const categoriaProduto = produto.dataset.categoria;

            const mostrar =
                nome.includes(busca) &&
                (categoria === "todos" || categoriaProduto === categoria);

            produto.hidden = !mostrar;
            produto.style.display = mostrar ? "" : "none";

            if (mostrar) encontrados++;
        });

        mensagemVazia.hidden = encontrados > 0;
        mensagemVazia.style.display = encontrados > 0 ? "none" : "block";
        listaProdutos.hidden = encontrados === 0;
        listaProdutos.style.display = encontrados === 0 ? "none" : "";
    }

    campoBusca.addEventListener("input", filtrarProdutos);
    filtroCategoria.addEventListener("change", filtrarProdutos);

    // Detalhes do produto
    function abrirDetalhes(produto) {
        produtoSelecionado = produto;

        document.getElementById("modal-produto-nome").textContent = produto.nome || "—";
        document.getElementById("modal-produto-categoria").textContent =
            nomeCategoria(produto.categoria);
        document.getElementById("modal-produto-preco").textContent =
            formatarPreco(produto.preco);
        document.getElementById("modal-produto-descricao").textContent =
            produto.descricao || "Sem descrição informada.";

        modalDetalhes.hidden = false;
        document.body.style.overflow = "hidden";
    }

    function fecharDetalhes() {
        modalDetalhes.hidden = true;
        document.body.style.overflow = "";
    }

    document.getElementById("fechar-modal-produto")
        .addEventListener("click", fecharDetalhes);

    document.getElementById("fechar-modal-produto-secundario")
        .addEventListener("click", fecharDetalhes);

    document.getElementById("editar-modal-produto")
        .addEventListener("click", function () {
            const produto = produtoSelecionado;
            fecharDetalhes();
            abrirFormulario(produto);
        });

    modalDetalhes.addEventListener("click", function (evento) {
        if (evento.target === modalDetalhes) fecharDetalhes();
    });

    // Cadastro e edição
    function abrirFormulario(produto = null) {
        produtoEditando = produto;
        formProduto.reset();

        document.getElementById("titulo-form-produto").textContent =
            produto ? "Editar produto" : "Novo produto";

        if (produto) {
            campoNome.value = produto.nome || "";
            campoCategoria.value = produto.categoria || "";
            campoPreco.value = (Number(produto.preco) || 0).toFixed(2);
            campoDescricao.value = produto.descricao || "";
        }

        modalForm.hidden = false;
        document.body.style.overflow = "hidden";
        campoNome.focus();
    }

    function fecharFormulario() {
        modalForm.hidden = true;
        document.body.style.overflow = "";
        produtoEditando = null;
    }

    btnNovo.addEventListener("click", function () {
        abrirFormulario();
    });

    document.getElementById("fechar-form-produto")
        .addEventListener("click", fecharFormulario);

    document.getElementById("cancelar-form-produto")
        .addEventListener("click", fecharFormulario);

    modalForm.addEventListener("click", function (evento) {
        if (evento.target === modalForm) fecharFormulario();
    });

    function criarCard(dados) {
        const produto = document.createElement("article");
        produto.className = "product-card";
        produto.dataset.id = dados.id;
        produto.dataset.nome = dados.nome || "";
        produto.dataset.categoria = dados.categoria || "gas";

        const imagem = document.createElement("div");
        imagem.className = "product-image " + classeImagem(dados.categoria);

        const icone = document.createElement("i");
        icone.className = classeIcone(dados.categoria);

        const status = document.createElement("span");
        status.className = "product-status";
        status.textContent = dados.disponivel ? "Disponível" : "Indisponível";
        imagem.append(icone, status);

        const corpo = document.createElement("div");
        corpo.className = "product-card-body";

        const categoriaElemento = document.createElement("span");
        categoriaElemento.className = "product-category";
        categoriaElemento.textContent = nomeCategoria(dados.categoria);

        const titulo = document.createElement("h3");
        titulo.textContent = dados.nome || "Produto";

        const textoDescricao = document.createElement("p");
        textoDescricao.textContent = dados.descricao || "";

        const rodape = document.createElement("div");
        rodape.className = "product-card-footer";

        const textoPreco = document.createElement("strong");
        textoPreco.textContent = formatarPreco(dados.preco);

        const botaoDetalhes = document.createElement("button");
        botaoDetalhes.type = "button";
        botaoDetalhes.className = "btn-product-details";
        botaoDetalhes.setAttribute("aria-label", "Ver detalhes de " + (dados.nome || "produto"));
        botaoDetalhes.innerHTML = '<i class="fa-solid fa-eye"></i>';
        botaoDetalhes.addEventListener("click", function () {
            abrirDetalhes(dados);
        });

        const botaoExcluir = document.createElement("button");
        botaoExcluir.type = "button";
        botaoExcluir.className = "btn-product-delete";
        botaoExcluir.title = "Excluir produto";
        botaoExcluir.setAttribute("aria-label", "Excluir " + (dados.nome || "produto"));
        botaoExcluir.innerHTML = '<i class="fa-solid fa-trash"></i>';
        botaoExcluir.addEventListener("click", function () {
            excluirProduto(dados);
        });

        rodape.append(textoPreco, botaoDetalhes, botaoExcluir);
        corpo.append(categoriaElemento, titulo, textoDescricao, rodape);
        produto.append(imagem, corpo);

        return produto;
    }

    // Carrega os produtos e indicadores do backend
    async function carregarProdutos() {
        try {
            const dados = await requisitar(API_PRODUTOS);

            listaProdutos.replaceChildren();
            (dados.produtos || []).forEach(function (produto) {
                listaProdutos.appendChild(criarCard(produto));
            });

            document.getElementById("total-produtos").textContent = dados.total ?? 0;
            document.getElementById("total-disponiveis").textContent = dados.disponiveis ?? 0;
            document.getElementById("categoria-principal").textContent =
                dados.categoria_principal ? nomeCategoria(dados.categoria_principal) : "-";
            if (badgePedidos && dados.pendentes !== undefined) {
                badgePedidos.textContent = dados.pendentes;
            }

            filtrarProdutos();
        } catch (erro) {
            console.error("Erro ao carregar produtos:", erro);
        }
    }

    async function excluirProduto(produto) {
        if (!confirm('Excluir o produto "' + produto.nome + '"?')) return;

        try {
            await requisitar(API_PRODUTOS + produto.id + "/", { method: "DELETE" });
            await carregarProdutos();
        } catch (erro) {
            alert(erro.message);
        }
    }

    formProduto.addEventListener("submit", async function (evento) {
        evento.preventDefault();

        const nome = campoNome.value.trim();
        const categoria = campoCategoria.value;
        const preco = Number(campoPreco.value);
        const descricao = campoDescricao.value.trim();

        if (!nome || !categoria || !descricao || !Number.isFinite(preco) || preco <= 0) {
            alert("Preencha todos os campos corretamente.");
            return;
        }

        const url = produtoEditando
            ? API_PRODUTOS + produtoEditando.id + "/"
            : API_PRODUTOS;

        try {
            await requisitar(url, {
                method: produtoEditando ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome, categoria, preco, descricao })
            });

            fecharFormulario();
            await carregarProdutos();
        } catch (erro) {
            alert(erro.message);
        }
    });

    // Tecla Escape
    document.addEventListener("keydown", function (evento) {
        if (evento.key === "Escape") {
            if (!modalForm.hidden) fecharFormulario();
            if (!modalDetalhes.hidden) fecharDetalhes();
        }
    });

    carregarProdutos();
});
