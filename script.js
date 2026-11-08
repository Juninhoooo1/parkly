
// ==========================================
// PARKLY - CONEXÃO COM A API
// ==========================================

const API_BASE =
    window.ESTACIONAMENTO_API_URL ||
    "https://parkly-backend-t08b.onrender.com/api";

const $ = (selector) => document.querySelector(selector);

// ==========================================
// FUNÇÃO DE COMUNICAÇÃO COM A API
// ==========================================

async function api(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        ...options
    });

    let data = {};

    try {
        data = await response.json();
    } catch (error) {
        data = {};
    }

    if (!response.ok) {
        throw new Error(
            data.error ||
            data.erro ||
            data.detalhe ||
            `Erro HTTP ${response.status}`
        );
    }

    return data;
}

// ==========================================
// FORMATAÇÃO DE VALORES
// ==========================================

function money(value) {
    return Number(value || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function formatTime(value) {
    if (!value) return "--";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

function relativeTime(value) {
    if (!value) return "--";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return formatTime(value);
    }

    const diff = Math.max(0, Date.now() - date.getTime());
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "agora";
    if (minutes === 1) return "há 1 min";
    if (minutes < 60) return `há ${minutes} min`;

    const hours = Math.floor(minutes / 60);

    if (hours === 1) return "há 1 h";

    return `há ${hours} h`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

// ==========================================
// DASHBOARD
// ==========================================

function renderDashboard(data) {
    const total = Number(data.total_vagas || 0);
    const livres = Number(data.vagas_livres || 0);
    const ocupadas = Number(data.vagas_ocupadas || 0);
    const reservadas = Number(data.vagas_reservadas || 0);

    const ocupacao = total
        ? Math.round((ocupadas / total) * 100)
        : 0;

    const elementos = {
        ocupacaoValor: `${ocupacao}%`,
        ocupacaoDetalhe: `${ocupadas} ocupadas de ${total}`,
        vagasLivresValor: livres,
        vagasLivresDetalhe: `de ${total} vagas`,
        entradasValor: Number(data.entradas_hoje || 0),
        receitaValor: money(data.receita_hoje),
        livresCount: livres,
        ocupadasCount: ocupadas,
        reservadasCount: reservadas,
        mapResumo: `Monitoramento em tempo real: ${total} vagas`
    };

    Object.entries(elementos).forEach(([id, valor]) => {
        const elemento = document.getElementById(id);

        if (elemento) {
            elemento.textContent = valor;
        }
    });

    const status = $("#apiStatus");

    if (status) {
        status.textContent = "◉ Infraestrutura online";
        status.style.color = "";
    }
}

// ==========================================
// VAGAS
// ==========================================

function renderVagas(vagas) {
    const container = $("#spots");

    if (!container) return;

    container.innerHTML = "";

    vagas.forEach((vaga) => {
        const button = document.createElement("button");

        const status = String(vaga.status || "").toUpperCase();

        const statusClass = {
            LIVRE: "free",
            OCUPADA: "busy",
            RESERVADA: "reserved"
        }[status] || "free";

        button.className = statusClass;
        button.textContent = vaga.codigo;
        button.title = `${vaga.codigo} — ${status}`;

        button.dataset.id = vaga.id;
        button.dataset.status = status;

        if (status !== "LIVRE") {
            button.disabled = true;
        }

        container.appendChild(button);
    });
}

// ==========================================
// EVENTOS RECENTES
// ==========================================

function renderEventos(movimentacoes) {
    const list = $("#eventList");

    if (!list) return;

    if (!movimentacoes.length) {
        list.innerHTML = `
            <div>
                <p>
                    <strong>Nenhuma movimentação registrada.</strong>
                </p>
            </div>
        `;

        return;
    }

    list.innerHTML = movimentacoes
        .slice(0, 4)
        .map((m, index) => {
            const saiu = String(m.estado).toUpperCase() === "SAIU";

            const iconClass = saiu
                ? "cyan"
                : ["green", "amber", "purple"][index % 3];

            const horario = saiu ? m.saida : m.entrada;

            return `
                <div>
                    <b class="event-icon ${iconClass}">
                        ${saiu ? "↗" : "↘"}
                    </b>

                    <p>
                        <strong>${escapeHtml(m.identificador)}</strong>

                        <small>
                            ${escapeHtml(m.vaga)}
                            ·
                            ${saiu ? "Saída" : "Entrada"}
                        </small>
                    </p>

                    <time>${relativeTime(horario)}</time>
                </div>
            `;
        })
        .join("");
}

// ==========================================
// TABELA DE MOVIMENTAÇÕES
// ==========================================

function renderMovimentacoes(movimentacoes) {
    const tbody = $("#movimentacoesBody");

    if (!tbody) return;

    if (!movimentacoes.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5">
                    Nenhuma movimentação registrada.
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML = movimentacoes
        .map((m) => {
            const estado = String(m.estado || "").toUpperCase();

            return `
                <tr>
                    <td>${escapeHtml(m.identificador)}</td>
                    <td>${escapeHtml(m.veiculo)}</td>
                    <td>${formatTime(m.entrada)}</td>
                    <td>${escapeHtml(m.vaga)}</td>
                    <td>
                        ${
                            estado === "DENTRO"
                                ? "<mark>Dentro</mark>"
                                : "<span>Saiu</span>"
                        }
                    </td>
                </tr>
            `;
        })
        .join("");
}

// ==========================================
// CARREGAR DADOS DO BANCO
// ==========================================

async function carregarDashboard() {
    try {
        const [
            dashboard,
            vagas,
            movimentacoes
        ] = await Promise.all([
            api("/dashboard"),
            api("/vagas"),
            api("/movimentacoes")
        ]);

        renderDashboard(dashboard);
        renderVagas(vagas);
        renderEventos(movimentacoes);
        renderMovimentacoes(movimentacoes);

    } catch (error) {
        console.error("Erro ao carregar PARKLY:", error);

        const status = $("#apiStatus");

        if (status) {
            status.textContent = "◉ Servidor offline";
            status.style.color = "#ff6b7a";
        }
    }
}

// ==========================================
// REGISTRAR ENTRADA
// ==========================================

async function registrarEntrada() {
    const placa = prompt("Digite a placa do veículo:");

    if (!placa || !placa.trim()) return;

    const modelo = prompt("Digite o modelo do veículo:");

    if (!modelo || !modelo.trim()) return;

    const cor = prompt("Digite a cor do veículo (opcional):") || "";

    const vaga = prompt("Digite a vaga (ex.: A01):");

    if (!vaga || !vaga.trim()) return;

    try {
        const resultado = await api("/entrada", {
            method: "POST",

            body: JSON.stringify({
                placa: placa.trim().toUpperCase(),
                modelo: modelo.trim(),
                cor: cor.trim(),
                vaga: vaga.trim().toUpperCase()
            })
        });

        alert(
            resultado.mensagem ||
            "Entrada registrada com sucesso!"
        );

        await carregarDashboard();

    } catch (error) {
        console.error(error);
        alert(error.message);
    }
}

// ==========================================
// REGISTRAR SAÍDA
// ==========================================

async function registrarSaida() {
    const placa = prompt(
        "Digite a placa do veículo que está saindo:"
    );

    if (!placa || !placa.trim()) return;

    try {
        const resultado = await api("/saida", {
            method: "POST",

            body: JSON.stringify({
                placa: placa.trim().toUpperCase()
            })
        });

        alert(
            `Saída registrada!\n` +
            `Placa: ${resultado.placa}\n` +
            `Tempo: ${resultado.horas} hora(s)\n` +
            `Valor pago: ${money(resultado.valor_pago)}`
        );

        await carregarDashboard();

    } catch (error) {
        console.error(error);
        alert(error.message);
    }
}

// ==========================================
// CONFIGURAR BOTÕES
// ==========================================

function configurarBotoes() {
    const btnEntrada = $("#btnEntrada");
    const btnSaida = $("#btnSaida");

    if (btnEntrada) {
        btnEntrada.addEventListener("click", registrarEntrada);
    }

    if (btnSaida) {
        btnSaida.addEventListener("click", registrarSaida);
    }
}

// ==========================================
// INICIALIZAÇÃO DO PARKLY
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    configurarBotoes();

    carregarDashboard();

    // Atualização automática a cada 15 segundos.
    setInterval(carregarDashboard, 15000);
});
