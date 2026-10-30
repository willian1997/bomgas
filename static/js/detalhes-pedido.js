document.addEventListener("DOMContentLoaded", function () {
    const seletorStatus = document.getElementById("detalhe-select-status") || document.querySelector(".status-control select");
    const botaoAtualizar = document.getElementById("detalhe-btn-status") || document.querySelector(".status-control button");
    const timeline = document.querySelector(".order-timeline");
    const etiquetaStatus = document.getElementById("detalhe-status-topo") || document.querySelector(".order-details-header .order-status");
    const badgePedidos = document.getElementById("badge-pedidos");

    const numeroPedido = document.getElementById("detalhe-numero-pedido");
    const clienteNome = document.getElementById("detalhe-cliente-nome");
    const clienteTelefone = document.getElementById("detalhe-cliente-telefone");
    const endereco = document.getElementById("detalhe-endereco");
    const bairro = document.getElementById("detalhe-bairro");
    const listaProdutos = document.getElementById("detalhe-lista-produtos");
    const totalPedido = document.getElementById("detalhe-total-pedido");
    const pagamento = document.getElementById("detalhe-pagamento");
    const observacao = document.getElementById("detalhe-observacao");

    const urlParams = new URLSearchParams(window.location.search);
    const pedidoId = urlParams.get("id");

    if (!pedidoId) {
        window.location.href = "/administrativo/pedidos/";
        return;
    }

    if (!seletorStatus || !botaoAtualizar || !timeline) {
        console.error("Elementos do status não encontrados.");
        return;
    }

    const etapas = Array.from(
        timeline.querySelectorAll(".timeline-item")
    );

    const iconesEtapas = [
        "fa-solid fa-check",
        "fa-solid fa-box",
        "fa-solid fa-truck",
        "fa-solid fa-house-circle-check"
    ];

    const statusEtapas = {
        "Em preparação": 1,
        "A caminho": 2,
        "Entregue": 3
    };

    function formatarPreco(valor) {
        const numero = Number(valor ?? 0);
        return (Number.isFinite(numero) ? numero : 0).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });
    }

    function classeIconeProduto(categoria) {
        if (categoria === "agua") return "fa-solid fa-droplet";
        if (categoria === "carvao") return "fa-solid fa-cubes-stacked";
        return "fa-solid fa-fire-flame-simple";
    }

    function atualizarTimeline(status) {
        etapas.forEach(function (etapa, indice) {
            etapa.classList.remove(
                "completed",
                "current",
                "cancelled"
            );

            const icone = etapa.querySelector(".timeline-icon i");

            if (status === "Cancelado") {
                if (indice === 0) {
                    etapa.classList.add("completed");
                    if (icone) {
                        icone.className = "fa-solid fa-check";
                    }
                } else {
                    etapa.classList.add("cancelled");
                    if (icone) {
                        icone.className = "fa-solid fa-xmark";
                    }
                }

                return;
            }

            const etapaAtual = statusEtapas[status] ?? 1;

            if (indice < etapaAtual) {
                etapa.classList.add("completed");
            } else if (indice === etapaAtual) {
                etapa.classList.add("current");
            }

            if (icone) {
                icone.className =
                    indice < etapaAtual
                        ? "fa-solid fa-check"
                        : iconesEtapas[indice];
            }
        });

        if (etiquetaStatus) {
            etiquetaStatus.textContent = status;

            etiquetaStatus.classList.remove(
                "preparing",
                "route",
                "delivered",
                "cancelled"
            );

            const classesStatus = {
                "Em preparação": "preparing",
                "A caminho": "route",
                "Entregue": "delivered",
                "Cancelado": "cancelled"
            };

            etiquetaStatus.classList.add(classesStatus[status] || "preparing");
        }
    }

    function renderizarItens(itens) {
        if (!listaProdutos) return;
        listaProdutos.replaceChildren();

        if (!itens || itens.length === 0) {
            const aviso = document.createElement("div");
            aviso.className = "product-order";
            aviso.textContent = "Nenhum produto registrado neste pedido.";
            listaProdutos.appendChild(aviso);
            return;
        }

        itens.forEach(function (item) {
            const linhaProduto = document.createElement("div");
            linhaProduto.className = "product-order";

            const divIcone = document.createElement("div");
            divIcone.className = "product-order-icon";
            const icone = document.createElement("i");
            icone.className = classeIconeProduto(item.categoria);
            divIcone.appendChild(icone);

            const divInfo = document.createElement("div");
            divInfo.className = "product-order-info";
            const strongNome = document.createElement("strong");
            strongNome.textContent = item.nome || "Produto";
            const spanQtd = document.createElement("span");
            spanQtd.textContent = `Quantidade: ${item.quantidade ?? 1}`;
            divInfo.append(strongNome, spanQtd);

            const strongPreco = document.createElement("strong");
            strongPreco.className = "product-order-price";
            const subtotal = item.subtotal !== undefined
                ? item.subtotal
                : ((Number(item.preco_unitario) || 0) * (Number(item.quantidade) || 1));
            strongPreco.textContent = formatarPreco(subtotal);

            linhaProduto.append(divIcone, divInfo, strongPreco);
            listaProdutos.appendChild(linhaProduto);
        });
    }

    async function carregarDetalhes() {
        try {
            const resposta = await fetch(`/api/admin/pedidos/${pedidoId}/`);
            if (!resposta.ok) {
                const erroDados = await resposta.json().catch(() => ({}));
                throw new Error(erroDados.erro || "Pedido não encontrado.");
            }

            const pedido = await resposta.json();

            if (numeroPedido) numeroPedido.textContent = pedido.numero || "---";
            if (clienteNome) clienteNome.textContent = pedido.cliente || "---";
            if (clienteTelefone) clienteTelefone.textContent = pedido.telefone || "---";

            const enderecoCompleto = pedido.numero_endereco
                ? `${pedido.endereco || ""}, ${pedido.numero_endereco}`
                : (pedido.endereco || "---");
            if (endereco) endereco.textContent = enderecoCompleto;
            if (bairro) bairro.textContent = pedido.bairro || "---";

            if (totalPedido) totalPedido.textContent = formatarPreco(pedido.total);
            if (pagamento) pagamento.textContent = pedido.forma_pagamento || "Presencial na entrega";
            if (observacao) observacao.textContent = pedido.observacao || "Nenhuma observação informada.";
            if (badgePedidos && pedido.pendentes !== undefined) {
                badgePedidos.textContent = pedido.pendentes;
            }

            renderizarItens(pedido.itens);

            const statusAtual = pedido.status || "Em preparação";
            seletorStatus.value = statusAtual;
            atualizarTimeline(statusAtual);
        } catch (erro) {
            console.error(erro);
            alert(erro.message);
            window.location.href = "/administrativo/pedidos/";
        }
    }

    botaoAtualizar.addEventListener("click", async function () {
        const novoStatus = seletorStatus.value;
        botaoAtualizar.disabled = true;

        try {
            const resposta = await fetch(`/api/admin/pedidos/${pedidoId}/`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ status: novoStatus })
            });

            const dados = await resposta.json().catch(() => ({}));

            if (!resposta.ok) {
                throw new Error(dados.erro || "Erro ao atualizar status do pedido.");
            }

            atualizarTimeline(novoStatus);
            if (badgePedidos && dados.pendentes !== undefined) {
                badgePedidos.textContent = dados.pendentes;
            }

            botaoAtualizar.innerHTML =
                '<i class="fa-solid fa-check"></i> Status atualizado!';

            setTimeout(function () {
                botaoAtualizar.innerHTML =
                    '<i class="fa-solid fa-check"></i> Atualizar status';
                botaoAtualizar.disabled = false;
            }, 1800);
        } catch (erro) {
            alert(erro.message);
            botaoAtualizar.disabled = false;
        }
    });

    carregarDetalhes();
});
