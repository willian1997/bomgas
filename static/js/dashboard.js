document.addEventListener("DOMContentLoaded", function () {
    const statTotalPedidos = document.getElementById("stat-total-pedidos");
    const statEmAndamento = document.getElementById("stat-em-andamento");
    const statEntregues = document.getElementById("stat-entregues");
    const statTotalClientes = document.getElementById("stat-total-clientes");
    const badgePedidos = document.getElementById("badge-pedidos");

    const listaRecentes = document.getElementById("lista-pedidos-recentes");
    const blocoVazio = document.getElementById("pedidos-recentes-vazio");

    const btnMenuMobile = document.querySelector(".mobile-menu");
    const sidebar = document.querySelector(".sidebar");
    if (btnMenuMobile && sidebar) {
        btnMenuMobile.addEventListener("click", function () {
            sidebar.classList.toggle("open");
        });
    }

    const API_DASHBOARD = "/api/admin/dashboard/";

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

    function criarItemRecente(pedido) {
        const item = document.createElement("div");
        item.className = "recent-order-item";

        const esquerda = document.createElement("div");
        esquerda.className = "recent-order-left";

        const icone = document.createElement("div");
        icone.className = "quick-icon blue";
        icone.innerHTML = '<i class="fa-solid fa-box"></i>';

        const info = document.createElement("div");
        info.className = "recent-order-info";

        const titulo = document.createElement("strong");
        titulo.textContent = `${pedido.numero || "---"} — ${pedido.cliente || "Cliente"}`;

        const subtitulo = document.createElement("span");
        const dataTexto = pedido.data || "--/--/----";
        const horaTexto = pedido.hora || "";
        subtitulo.textContent = horaTexto ? `${dataTexto} às ${horaTexto}` : dataTexto;

        info.append(titulo, subtitulo);
        esquerda.append(icone, info);

        const direita = document.createElement("div");
        direita.className = "recent-order-meta";

        const total = document.createElement("strong");
        total.className = "recent-order-total";
        total.textContent = formatarPreco(pedido.total);

        const statusTexto = pedido.status || "Em preparação";
        const status = document.createElement("span");
        status.className = "order-status " + classeStatus(statusTexto);
        status.textContent = statusTexto;

        const acao = document.createElement("div");
        acao.className = "order-action";
        const btnDetalhes = document.createElement("button");
        btnDetalhes.type = "button";
        btnDetalhes.title = "Ver detalhes";
        btnDetalhes.innerHTML = '<i class="fa-solid fa-eye"></i><span>Detalhes</span>';
        btnDetalhes.addEventListener("click", function () {
            if (pedido.id) {
                window.location.href = `/administrativo/pedidos/detalhes/?id=${pedido.id}`;
            }
        });
        acao.appendChild(btnDetalhes);

        direita.append(total, status, acao);
        item.append(esquerda, direita);
        return item;
    }

    async function carregarDashboard() {
        try {
            const dados = await requisitar(API_DASHBOARD);

            if (statTotalPedidos) statTotalPedidos.textContent = dados.total_pedidos ?? 0;
            if (statEmAndamento) statEmAndamento.textContent = dados.em_andamento ?? 0;
            if (statEntregues) statEntregues.textContent = dados.entregues ?? 0;
            if (statTotalClientes) statTotalClientes.textContent = dados.total_clientes ?? 0;
            if (badgePedidos) badgePedidos.textContent = dados.em_andamento ?? 0;

            const recentes = Array.isArray(dados.pedidos_recentes) ? dados.pedidos_recentes : [];
            if (listaRecentes) listaRecentes.replaceChildren();

            if (recentes.length === 0) {
                if (listaRecentes) {
                    listaRecentes.hidden = true;
                    listaRecentes.style.display = "none";
                }
                if (blocoVazio) {
                    blocoVazio.hidden = false;
                    blocoVazio.style.display = "";
                }
            } else {
                if (listaRecentes) {
                    recentes.forEach(function (pedido) {
                        listaRecentes.appendChild(criarItemRecente(pedido));
                    });
                    listaRecentes.hidden = false;
                    listaRecentes.style.display = "flex";
                }
                if (blocoVazio) {
                    blocoVazio.hidden = true;
                    blocoVazio.style.display = "none";
                }
            }
        } catch (erro) {
            console.error("Erro ao carregar dashboard:", erro);
            if (statTotalPedidos) statTotalPedidos.textContent = "0";
            if (statEmAndamento) statEmAndamento.textContent = "0";
            if (statEntregues) statEntregues.textContent = "0";
            if (statTotalClientes) statTotalClientes.textContent = "0";
            if (badgePedidos) badgePedidos.textContent = "0";
        }
    }

    carregarDashboard();
});
