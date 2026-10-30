document.addEventListener("DOMContentLoaded", function () {
    const campoBusca = document.getElementById("buscar-cliente");
    const filtroClientes = document.getElementById("filtro-clientes");
    const botaoLimpar = document.getElementById("limpar-clientes");
    const listaClientes = document.getElementById("lista-clientes");
    const textoResultados = document.getElementById("texto-resultados");
    const mensagemVazia = document.getElementById("nenhum-cliente");
    const contadorClientes = document.getElementById("contador-clientes");
    const badgePedidos = document.getElementById("badge-pedidos");

    // Elementos do modal
    const modal = document.getElementById("modal-cliente");
    const botaoFechar = document.getElementById("fechar-modal-cliente");
    const botaoFecharSecundario = document.getElementById("fechar-modal-secundario");

    const API_CLIENTES = "/api/admin/clientes/";
    const CORES_AVATAR = ["avatar-blue", "avatar-orange", "avatar-green", "avatar-purple"];

    function normalizarTexto(texto) {
        return (texto || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }

    function iniciais(nome) {
        const letras = (nome || "")
            .split(" ")
            .filter(Boolean)
            .map(function (parte) { return parte[0]; })
            .slice(0, 2)
            .join("")
            .toUpperCase();
        return letras || "CL";
    }

    function corAvatar(cliente) {
        return CORES_AVATAR[((cliente.id || 1) - 1) % CORES_AVATAR.length];
    }

    function formatarPedidos(quantidade) {
        const qtd = Number(quantidade ?? 0) || 0;
        return `${qtd} ${qtd === 1 ? "pedido" : "pedidos"}`;
    }

    async function requisitar(url, opcoes) {
        const resposta = await fetch(url, opcoes);
        const dados = await resposta.json().catch(function () { return {}; });

        if (!resposta.ok) {
            throw new Error(dados.erro || "Erro ao comunicar com o servidor.");
        }

        return dados;
    }

    // Busca e filtros
    function filtrarClientes() {
        const busca = normalizarTexto(campoBusca.value);
        const filtro = filtroClientes.value;
        let encontrados = 0;

        document.querySelectorAll(".client-row").forEach(function (linha) {
            const nome = normalizarTexto(linha.dataset.nome);
            const telefone = normalizarTexto(linha.dataset.telefone);
            const quantidadePedidos = Number(linha.dataset.pedidos) || 0;

            const correspondeBusca =
                nome.includes(busca) || telefone.includes(busca);

            let correspondeFiltro = true;

            if (filtro === "com-pedidos") {
                correspondeFiltro = quantidadePedidos > 0;
            } else if (filtro === "sem-pedidos") {
                correspondeFiltro = quantidadePedidos === 0;
            }

            const mostrar = correspondeBusca && correspondeFiltro;
            linha.hidden = !mostrar;
            linha.style.display = mostrar ? "" : "none";

            if (mostrar) encontrados++;
        });

        textoResultados.textContent =
            `Mostrando ${encontrados} ${encontrados === 1 ? "cliente" : "clientes"}`;

        contadorClientes.textContent =
            `${encontrados} ${encontrados === 1 ? "cliente encontrado" : "clientes encontrados"}`;

        mensagemVazia.hidden = encontrados !== 0;
    }

    campoBusca.addEventListener("input", filtrarClientes);
    filtroClientes.addEventListener("change", filtrarClientes);

    botaoLimpar.addEventListener("click", function () {
        campoBusca.value = "";
        filtroClientes.value = "todos";
        filtrarClientes();
        campoBusca.focus();
    });

    // Abrir modal com os dados do cliente selecionado
    function abrirDetalhes(cliente) {
        document.getElementById("modal-titulo-cliente").textContent = "Detalhes do cliente";
        document.getElementById("modal-nome-cliente").textContent = cliente.nome || "Cliente";
        document.getElementById("modal-id-cliente").textContent = `Cliente ${cliente.numero || ""}`;

        const avatar = document.getElementById("modal-avatar-cliente");
        avatar.textContent = iniciais(cliente.nome);
        avatar.className = "client-avatar " + corAvatar(cliente);

        document.getElementById("modal-telefone-cliente").textContent = cliente.telefone || "—";
        document.getElementById("modal-endereco-cliente").textContent =
            `${cliente.endereco || "—"} — ${cliente.bairro || "—"}`;
        document.getElementById("modal-pedidos-cliente").textContent =
            formatarPedidos(cliente.total_pedidos);

        const areaHistorico = document.getElementById("modal-historico-cliente");
        areaHistorico.replaceChildren();

        const historico = Array.isArray(cliente.pedidos) ? cliente.pedidos : [];
        if (historico.length === 0) {
            const vazio = document.createElement("div");
            vazio.className = "history-empty";
            vazio.textContent = "Este cliente ainda não possui pedidos.";
            areaHistorico.appendChild(vazio);
        } else {
            historico.forEach(function (pedido) {
                const item = document.createElement("div");
                item.className = "history-order";

                const informacoes = document.createElement("div");
                informacoes.className = "history-order-info";

                const titulo = document.createElement("strong");
                titulo.textContent = `Pedido ${pedido.numero || ""} — ${pedido.produtos || "Itens não informados"}`;

                const data = document.createElement("span");
                data.textContent = `${pedido.data || ""} ${pedido.hora || ""}`.trim();

                const status = document.createElement("span");
                status.className = "history-order-status";
                status.textContent = pedido.status || "Em preparação";

                informacoes.append(titulo, data);
                item.append(informacoes, status);
                areaHistorico.appendChild(item);
            });
        }

        modal.hidden = false;
        document.body.style.overflow = "hidden";
        botaoFechar.focus();
    }

    // Monta a linha de um cliente vindo da API
    function criarLinha(cliente) {
        const linha = document.createElement("div");
        linha.className = "client-row";
        linha.dataset.nome = cliente.nome || "";
        linha.dataset.telefone = cliente.telefone || "";
        linha.dataset.pedidos = cliente.total_pedidos ?? 0;

        // Identidade
        const identidade = document.createElement("div");
        identidade.className = "client-identity";
        const avatar = document.createElement("div");
        avatar.className = "client-avatar " + corAvatar(cliente);
        avatar.textContent = iniciais(cliente.nome);
        const dadosIdentidade = document.createElement("div");
        const nome = document.createElement("strong");
        nome.textContent = cliente.nome || "Cliente";
        const numero = document.createElement("span");
        numero.textContent = `Cliente ${cliente.numero || ""}`;
        dadosIdentidade.append(nome, numero);
        identidade.append(avatar, dadosIdentidade);

        // Telefone
        const colTelefone = document.createElement("div");
        colTelefone.className = "client-phone";
        const rotuloTelefone = document.createElement("span");
        rotuloTelefone.className = "mobile-label";
        rotuloTelefone.textContent = "Telefone";
        const textoTelefone = document.createElement("span");
        textoTelefone.textContent = cliente.telefone || "—";
        colTelefone.append(rotuloTelefone, textoTelefone);

        // Endereço
        const colEndereco = document.createElement("div");
        colEndereco.className = "client-address";
        const rotuloEndereco = document.createElement("span");
        rotuloEndereco.className = "mobile-label";
        rotuloEndereco.textContent = "Endereço";
        const textoEndereco = document.createElement("span");
        textoEndereco.textContent = cliente.endereco || "—";
        const textoBairro = document.createElement("small");
        textoBairro.textContent = cliente.bairro || "—";
        colEndereco.append(rotuloEndereco, textoEndereco, textoBairro);

        // Pedidos
        const colPedidos = document.createElement("div");
        colPedidos.className = "client-orders";
        const rotuloPedidos = document.createElement("span");
        rotuloPedidos.className = "mobile-label";
        rotuloPedidos.textContent = "Pedidos";
        const textoPedidos = document.createElement("strong");
        textoPedidos.textContent = formatarPedidos(cliente.total_pedidos);
        colPedidos.append(rotuloPedidos, textoPedidos);

        // Ações
        const colAcoes = document.createElement("div");
        colAcoes.className = "client-actions";
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "btn-cliente-detalhes";
        botao.title = "Ver detalhes";
        botao.setAttribute("aria-label", "Ver detalhes de " + (cliente.nome || "cliente"));
        botao.innerHTML = '<i class="fa-solid fa-eye"></i> Detalhes';
        botao.addEventListener("click", function () {
            abrirDetalhes(cliente);
        });
        colAcoes.appendChild(botao);

        linha.append(identidade, colTelefone, colEndereco, colPedidos, colAcoes);
        return linha;
    }

    // Carrega os clientes e indicadores do backend
    async function carregarClientes() {
        try {
            const dados = await requisitar(API_CLIENTES);

            listaClientes.replaceChildren();
            (dados.clientes || []).forEach(function (cliente) {
                listaClientes.appendChild(criarLinha(cliente));
            });

            document.getElementById("total-clientes").textContent = dados.total ?? 0;
            document.getElementById("total-pedidos-realizados").textContent = dados.pedidos_realizados ?? 0;
            document.getElementById("total-sem-pedidos").textContent = dados.sem_pedidos ?? 0;
            if (badgePedidos && dados.pendentes !== undefined) {
                badgePedidos.textContent = dados.pendentes;
            }

            filtrarClientes();
        } catch (erro) {
            console.error("Erro ao carregar clientes:", erro);
        }
    }

    // Fechar modal
    function fecharModal() {
        modal.hidden = true;
        document.body.style.overflow = "";
    }

    botaoFechar.addEventListener("click", fecharModal);
    botaoFecharSecundario.addEventListener("click", fecharModal);

    // Fechar ao clicar fora da janela
    modal.addEventListener("click", function (evento) {
        if (evento.target === modal) {
            fecharModal();
        }
    });

    // Fechar com a tecla Esc
    document.addEventListener("keydown", function (evento) {
        if (evento.key === "Escape" && !modal.hidden) {
            fecharModal();
        }
    });

    carregarClientes();
});
