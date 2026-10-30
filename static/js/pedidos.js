document.addEventListener("DOMContentLoaded", function () {
    const campoBusca = document.getElementById("buscar-pedido");
    const filtroStatus = document.getElementById("filtro-status");
    const filtroPeriodo = document.getElementById("filtro-periodo");
    const botaoLimpar = document.getElementById("limpar-filtros");

    const listaPedidos = document.getElementById("lista-pedidos");
    const mensagemVazia = document.getElementById("nenhum-pedido");
    const totalPedidos = document.getElementById("total-pedidos");
    const badgePedidos = document.getElementById("badge-pedidos");

    const API_PEDIDOS = "/api/admin/pedidos/";
    let pedidosCache = [];

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

    function classeStatus(status) {
        const classes = {
            "Em preparação": "preparing",
            "A caminho": "route",
            "Entregue": "delivered",
            "Cancelado": "cancelled"
        };
        return classes[status] || "preparing";
    }

    async function requisitar(url, opcoes) {
        const resposta = await fetch(url, opcoes);
        const dados = await resposta.json().catch(function () { return {}; });

        if (!resposta.ok) {
            throw new Error(dados.erro || "Erro ao comunicar com o servidor.");
        }

        return dados;
    }

    function criarLinhaPedido(pedido) {
        const linha = document.createElement("div");
        linha.className = "order-row";
        linha.dataset.id = pedido.id;
        linha.dataset.numero = pedido.numero || "";
        linha.dataset.cliente = pedido.cliente || "";
        linha.dataset.telefone = pedido.telefone || "";
        linha.dataset.status = pedido.status || "Em preparação";
        linha.dataset.dataIso = pedido.data_iso || "";

        // Número
        const colNumero = document.createElement("div");
        colNumero.className = "order-number";
        const strongNumero = document.createElement("strong");
        strongNumero.textContent = pedido.numero || "---";
        colNumero.appendChild(strongNumero);

        // Cliente
        const colCliente = document.createElement("div");
        colCliente.className = "order-client";
        const strongCliente = document.createElement("strong");
        strongCliente.textContent = pedido.cliente || "Cliente";
        const spanTelefone = document.createElement("span");
        spanTelefone.textContent = pedido.telefone || "—";
        colCliente.append(strongCliente, spanTelefone);

        // Data
        const colData = document.createElement("div");
        colData.className = "order-date";
        colData.textContent = (pedido.data || "--/--/----") + " ";
        const spanHora = document.createElement("span");
        spanHora.textContent = pedido.hora || "";
        colData.appendChild(spanHora);

        // Total
        const colTotal = document.createElement("div");
        colTotal.className = "order-total";
        colTotal.textContent = formatarPreco(pedido.total);

        // Status
        const statusTexto = pedido.status || "Em preparação";
        const colStatus = document.createElement("div");
        const spanStatus = document.createElement("span");
        spanStatus.className = "order-status " + classeStatus(statusTexto);
        spanStatus.textContent = statusTexto;
        colStatus.appendChild(spanStatus);

        // Ações
        const colAcao = document.createElement("div");
        colAcao.className = "order-action";
        const btnDetalhes = document.createElement("button");
        btnDetalhes.type = "button";
        btnDetalhes.title = "Ver detalhes";
        btnDetalhes.innerHTML = '<i class="fa-solid fa-eye"></i><span>Detalhes</span>';
        btnDetalhes.addEventListener("click", function () {
            window.location.href = `/administrativo/pedidos/detalhes/?id=${pedido.id}`;
        });
        colAcao.appendChild(btnDetalhes);

        linha.append(colNumero, colCliente, colData, colTotal, colStatus, colAcao);
        return linha;
    }

    function correspondePeriodo(dataIso, periodo) {
        if (!periodo || periodo === "todos" || !dataIso) return true;
        const dataPedido = new Date(dataIso);
        if (Number.isNaN(dataPedido.getTime())) return true;
        const agora = new Date();

        if (periodo === "hoje") {
            return dataPedido.toDateString() === agora.toDateString();
        }

        const diffTempo = agora.getTime() - dataPedido.getTime();
        const diffDias = diffTempo / (1000 * 60 * 60 * 24);

        if (periodo === "7dias") {
            return diffDias <= 7;
        }

        if (periodo === "30dias") {
            return diffDias <= 30;
        }

        return true;
    }

    function filtrarPedidos() {
        const busca = normalizarTexto(campoBusca.value);
        const statusFiltro = filtroStatus.value;
        const periodoFiltro = filtroPeriodo.value;
        let encontrados = 0;

        document.querySelectorAll(".order-row").forEach(function (linha) {
            const numero = normalizarTexto(linha.dataset.numero);
            const cliente = normalizarTexto(linha.dataset.cliente);
            const telefone = normalizarTexto(linha.dataset.telefone);
            const status = linha.dataset.status;
            const dataIso = linha.dataset.dataIso;

            const correspondeBusca =
                !busca ||
                cliente.includes(busca) ||
                telefone.includes(busca) ||
                numero.includes(busca) ||
                numero.replace("#", "").includes(busca);

            const correspondeStatus =
                statusFiltro === "todos" || status === statusFiltro;

            const correspondeData = correspondePeriodo(dataIso, periodoFiltro);

            const mostrar = correspondeBusca && correspondeStatus && correspondeData;
            linha.hidden = !mostrar;
            linha.style.display = mostrar ? "" : "none";

            if (mostrar) encontrados++;
        });

        if (totalPedidos) {
            totalPedidos.textContent = encontrados;
        }

        if (mensagemVazia) {
            mensagemVazia.hidden = encontrados > 0;
            mensagemVazia.style.display = encontrados > 0 ? "none" : "block";
        }
    }

    campoBusca.addEventListener("input", filtrarPedidos);
    filtroStatus.addEventListener("change", filtrarPedidos);
    filtroPeriodo.addEventListener("change", filtrarPedidos);

    botaoLimpar.addEventListener("click", function () {
        campoBusca.value = "";
        filtroStatus.value = "todos";
        filtroPeriodo.value = "todos";
        filtrarPedidos();
        campoBusca.focus();
    });

    async function carregarPedidos() {
        try {
            const dados = await requisitar(API_PEDIDOS);
            pedidosCache = Array.isArray(dados.pedidos) ? dados.pedidos : [];

            listaPedidos.replaceChildren();
            pedidosCache.forEach(function (pedido) {
                listaPedidos.appendChild(criarLinhaPedido(pedido));
            });

            if (totalPedidos) {
                totalPedidos.textContent = dados.total ?? 0;
            }

            if (badgePedidos) {
                badgePedidos.textContent = dados.pendentes ?? dados.total ?? 0;
            }

            filtrarPedidos();
        } catch (erro) {
            console.error("Erro ao carregar pedidos:", erro);
            if (mensagemVazia) {
                mensagemVazia.textContent = "Erro ao carregar pedidos da API.";
                mensagemVazia.hidden = false;
            }
        }
    }

    carregarPedidos();
});
