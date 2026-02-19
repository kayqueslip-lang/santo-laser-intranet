// ================================================================================= //
//                                     ESTADO GLOBAL                                 //
// ================================================================================= //

let leads = JSON.parse(localStorage.getItem("santo_leads")) || [];
let transactions = JSON.parse(localStorage.getItem("santo_transactions")) || [];
let stockItems = JSON.parse(localStorage.getItem("santo_stock_items")) || [];
let settings = JSON.parse(localStorage.getItem("santo_settings")) || {
    steps: ["Proposta Enviada", "Aprovado", "Produção", "Finalizado", "Pago"],
    simLabels: ["Pró-labore", "Custos Fixos", "Marketing", "Reserva/Investimento", "DAS"],
    categories: ["Materiais", "Energia", "Marketing", "Vendas CRM", "Outros"],
    calculator: {
        hora: 100,
        imposto: 6,
        markup: 2.0
    },
    initialBalance: 0
};
let items = []; // Itens da calculadora de orçamento
let currentLeadId = null; // Para edição de leads
let currentStockItemId = null; // Para edição de itens de estoque

// ================================================================================= //
//                                 INICIALIZAÇÃO                                     //
// ================================================================================= //

document.addEventListener("DOMContentLoaded", () => {
    // Popular dados de teste se vazio
    if (leads.length === 0) {
        leads = [
            { id: "1", cliente: "Cafeteria Aroma", empresa: "Aroma LTDA", valor: 1250.50, status: 2, entrega: "2024-03-25", resultado: "Venda", cpv: 300, impostos: 75, lucro: 875.5, origem: "Instagram" },
            { id: "2", cliente: "Escritório Contábil", empresa: "Silva & Associados", valor: 450.00, status: 4, entrega: "2024-03-10", resultado: "Venda", cpv: 50, impostos: 27, lucro: 373, origem: "Indicação" },
            { id: "3", cliente: "Noiva Feliz", empresa: "Particular", valor: 2100.00, status: 0, entrega: "2024-04-05", resultado: "Venda", cpv: 800, impostos: 126, lucro: 1174, origem: "WhatsApp" },
            { id: "4", cliente: "Restaurante Sabor", empresa: "Sabor Real", valor: 900.00, status: 3, entrega: "2024-03-28", resultado: "Venda", cpv: 200, impostos: 54, lucro: 646, origem: "Google" },
            { id: "5", cliente: "Loja Geek", empresa: "Geek World", valor: 150.00, status: 1, entrega: "2024-03-22", resultado: "Venda", cpv: 30, impostos: 9, lucro: 111, origem: "Instagram" }
        ];
        localStorage.setItem("santo_leads", JSON.stringify(leads));
    }

    if (transactions.length === 0) {
        transactions = [
            { id: "t1", desc: "Compra de MDF", valor: 250, tipo: "saída", cat: "Materiais", data: "2024-02-10" },
            { id: "t2", desc: "Venda de Luminária", valor: 1200, tipo: "entrada", cat: "Vendas CRM", data: "2024-02-15" },
            { id: "t3", desc: "Pagamento de Energia", valor: 150, tipo: "saída", cat: "Energia", data: "2024-02-20" }
        ];
        localStorage.setItem("santo_transactions", JSON.stringify(transactions));
    }

    if (stockItems.length === 0) {
        stockItems = [
            { id: "s1", nome: "MDF 3mm", quantidade: 10, unidade: "chapa", custoUnitario: 50 },
            { id: "s2", nome: "Acrílico 2mm", quantidade: 5, unidade: "chapa", custoUnitario: 80 }
        ];
        localStorage.setItem("santo_stock_items", JSON.stringify(stockItems));
    }

    applySettings();
    loadLogo();
    setupNavigation();
    showSection("dashboard");
    updateDashboard();
    updateLeadSelect();
    addItem(); // Adiciona um item inicial na calculadora
    renderFinanceCategories();
    renderSimInputs();
    renderStock();
    loadSettingsPage();

    // Definir data atual para filtros de data
    const today = new Date().toISOString().split("T")[0];
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (document.getElementById("dash-month-filter")) document.getElementById("dash-month-filter").value = currentMonth;
    if (document.getElementById("dre-month-filter")) document.getElementById("dre-month-filter").value = currentMonth;
    if (document.getElementById("flow-start")) document.getElementById("flow-start").value = currentMonth + "-01";
    if (document.getElementById("flow-end")) document.getElementById("flow-end").value = today;
    if (document.getElementById("g_data_proposta")) document.getElementById("g_data_proposta").value = today;
    if (document.getElementById("f_data")) document.getElementById("f_data").value = today;
    if (document.getElementById("lead-entrega")) document.getElementById("lead-entrega").value = today;
});

function formatBRL(val) {
    return parseFloat(val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatNumber(val) {
    return parseFloat(val || 0).toLocaleString("pt-BR");
}

function saveState() {
    localStorage.setItem("santo_leads", JSON.stringify(leads));
    localStorage.setItem("santo_transactions", JSON.stringify(transactions));
    localStorage.setItem("santo_stock_items", JSON.stringify(stockItems));
    localStorage.setItem("santo_settings", JSON.stringify(settings));
}

// ================================================================================= //
//                                      UTILITÁRIOS                                  //
// ================================================================================= //

function loadLogo() {
    fetch("logo_base64.txt")
        .then(response => response.text())
        .then(data => {
            const logoContainer = document.getElementById("logo-circle-container");
            if (logoContainer) {
                logoContainer.innerHTML = `<img src="data:image/jpeg;base64,${data.trim()}" alt="Santo Laser Logo" class="main-logo">`;
            }
        })
        .catch(error => console.error("Erro ao carregar o logo:", error));
}

// ================================================================================= //
//                                     NAVEGAÇÃO                                     //
// ================================================================================= //

function setupNavigation() {
    document.querySelectorAll(".nav-links .nav-item").forEach(item => {
        item.addEventListener("click", function() {
            const sectionId = this.getAttribute("data-section");
            showSection(sectionId);
        });
    });

    document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
}

function showSection(sectionId) {
    closeAllModals();
    document.querySelectorAll(".content-section").forEach(s => s.classList.remove("active"));
    document.querySelectorAll(".nav-links .nav-item").forEach(n => n.classList.remove("active"));
    
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add("active");
    }
    
    const activeNavItem = document.querySelector(`.nav-links .nav-item[data-section="${sectionId}"]`);
    if (activeNavItem) {
        activeNavItem.classList.add("active");
    }
    
    // Atualizar conteúdo específico da seção
    if (sectionId === "dashboard") updateDashboard();
    if (sectionId === "crm") renderCRM();
    if (sectionId === "cashflow") renderFinance();
    if (sectionId === "dre") renderDRE();
    if (sectionId === "goals") renderSimInputs();
    if (sectionId === "inventory") renderStock();
    if (sectionId === "settings") loadSettingsPage();
    if (sectionId === "calculator") updateLeadSelect();
}

function closeAllModals() {
    document.getElementById("modal-overlay").style.display = "none";
    document.querySelectorAll(".modal-modern").forEach(m => m.style.display = "none");
}

function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", next);
    // Re-renderizar gráficos para aplicar o tema se necessário
    updateDashboard();
    renderDRE();
    calculateSim();
}

function exportToExcel() {
    alert("Funcionalidade de exportar para Excel ainda não implementada.");
}

function globalSearch(query) {
    console.log("Buscando por:", query);
    // Implementar lógica de busca global aqui
}

// ================================================================================= //
//                                     DASHBOARD                                     //
// ================================================================================= //

let trendChart, originChart, categoryChart;

function updateDashboard() {
    const monthFilter = document.getElementById("dash-month-filter").value;
    const [year, month] = monthFilter.split("-").map(Number);

    const monthLeads = leads.filter(l => {
        if (l.resultado !== "Venda" || !l.entrega) return false;
        const d = new Date(l.entrega + "T00:00:00");
        return d.getMonth() === (month - 1) && d.getFullYear() === year;
    });

    const totalRevenue = monthLeads.reduce((acc, l) => acc + (l.valor || 0), 0);
    const totalProfit = monthLeads.reduce((acc, l) => acc + (l.lucro || 0), 0);
    const activeOrders = leads.filter(l => l.status < 4 && l.resultado === "Venda").length;
    
    const totalLeads = leads.filter(l => {
        const d = new Date(l.entrega + "T00:00:00");
        return d.getMonth() === (month - 1) && d.getFullYear() === year;
    }).length;
    const convertedLeads = monthLeads.length;
    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads * 100).toFixed(2) : 0;

    document.getElementById("dash-revenue").innerText = formatBRL(totalRevenue);
    document.getElementById("dash-profit").innerText = formatBRL(totalProfit);
    document.getElementById("dash-active-orders").innerText = activeOrders;
    document.getElementById("dash-conversion").innerText = `${conversionRate}%`;

    renderDashboardCharts(monthLeads);
    renderTimeline();
}

function renderDashboardCharts(monthLeads) {
    // Trend Chart (Exemplo: Faturamento Mensal - precisa de dados históricos)
    const trendCtx = document.getElementById("trendChart");
    if (trendChart) trendChart.destroy();
    trendChart = new Chart(trendCtx, {
        type: "line",
        data: {
            labels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"], // Exemplo
            datasets: [{
                label: "Faturamento Mensal",
                data: [10000, 12000, 11000, 15000, 13000, 16000], // Dados de exemplo
                borderColor: "var(--primary)",
                tension: 0.3,
                fill: true,
                backgroundColor: "rgba(0, 230, 203, 0.1)"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });

    // Origin Chart
    const originData = monthLeads.reduce((acc, l) => {
        acc[l.origem] = (acc[l.origem] || 0) + 1;
        return acc;
    }, {});
    const originLabels = Object.keys(originData);
    const originValues = Object.values(originData);

    const originCtx = document.getElementById("originChart");
    if (originChart) originChart.destroy();
    originChart = new Chart(originCtx, {
        type: "pie",
        data: {
            labels: originLabels,
            datasets: [{
                data: originValues,
                backgroundColor: ["#00e6cb", "#2979ff", "#7c4dff", "#ffea00", "#ff1744"]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: "right" } }
        }
    });

    // Category Chart (Lucro por Categoria - precisa de mais dados de leads)
    const categoryData = monthLeads.reduce((acc, l) => {
        // Assumindo que leads teriam uma categoria de produto/serviço
        const category = "Geral"; // Placeholder
        acc[category] = (acc[category] || 0) + (l.lucro || 0);
        return acc;
    }, {});
    const categoryLabels = Object.keys(categoryData);
    const categoryValues = Object.values(categoryData);

    const categoryCtx = document.getElementById("categoryChart");
    if (categoryChart) categoryChart.destroy();
    categoryChart = new Chart(categoryCtx, {
        type: "bar",
        data: {
            labels: categoryLabels,
            datasets: [{
                label: "Lucro por Categoria",
                data: categoryValues,
                backgroundColor: "#00e6cb"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });
}

function renderTimeline() {
    const container = document.getElementById("timeline-list");
    const active = leads.filter(l => (l.status < 4 && l.resultado === "Venda")).sort((a, b) => new Date(a.entrega) - new Date(b.entrega));
    
    container.innerHTML = active.map(l => {
        const today = new Date();
        const deliveryDate = new Date(l.entrega + "T00:00:00");
        const diffTime = Math.abs(deliveryDate - today);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        const isLate = deliveryDate < today;

        return `
            <div class="timeline-item">
                <div class="tl-info"><strong>${l.cliente}</strong><br><small>${l.empresa || "N/A"}</small></div>
                <div class="tl-bar-bg">
                    <div class="tl-bar-fill" style="width: ${Math.min(100, (l.status / (settings.steps.length -1)) * 100)}%"></div>
                </div>
                <div class="tl-days" style="color: ${isLate ? "var(--danger)" : "var(--primary)"}">${isLate ? "-" : ""}${diffDays} dias</div>
            </div>
        `;
    }).join("") || "<p style=\"text-align:center; padding:20px; color: var(--text-muted);\">Nenhum projeto ativo.</p>";
}

// ================================================================================= //
//                                       CRM                                         //
// ================================================================================= //

let crmView = "kanban"; // "kanban" ou "table"

function renderCRM() {
    const kanbanView = document.getElementById("kanban-view");
    const tableView = document.getElementById("table-view");

    if (crmView === "kanban") {
        kanbanView.style.display = "flex";
        tableView.style.display = "none";
        kanbanView.innerHTML = settings.steps.map((step, idx) => `
            <div class="kanban-column">
                <div class="column-header">${step} <span class="count">${leads.filter(l => l.status === idx).length}</span></div>
                <div class="kanban-cards" ondrop="dropLead(event, ${idx})" ondragover="allowDrop(event)">
                    ${leads.filter(l => l.status === idx).map(l => `
                        <div class="kanban-card" draggable="true" ondragstart="dragLead(event, '${l.id}')" onclick="openLeadModal('${l.id}')">
                            <strong>${l.cliente}</strong>
                            <small>${l.empresa || "N/A"}</small>
                            <div class="card-val">${formatBRL(l.valor)}</div>
                        </div>
                    `).join("")}
                </div>
            </div>
        `).join("");
    } else {
        kanbanView.style.display = "none";
        tableView.style.display = "block";
        const tbody = document.getElementById("crm-table-body");
        tbody.innerHTML = leads.map(l => `
            <tr>
                <td>${l.cliente}</td>
                <td>${l.empresa || "N/A"}</td>
                <td>${settings.steps[l.status]}</td>
                <td>${formatBRL(l.valor)}</td>
                <td>${l.entrega || "N/A"}</td>
                <td>
                    <button class="btn-modern btn-primary" onclick="openLeadModal('${l.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-modern btn-danger" onclick="deleteLead('${l.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join("");
    }
}

function toggleCRMView() {
    crmView = crmView === "kanban" ? "table" : "kanban";
    renderCRM();
}

function openLeadModal(leadId = null) {
    currentLeadId = leadId;
    const lead = leads.find(l => l.id === leadId);

    document.getElementById("lead-cliente").value = lead ? lead.cliente : "";
    document.getElementById("lead-empresa").value = lead ? lead.empresa : "";
    document.getElementById("lead-valor").value = lead ? lead.valor : "";
    document.getElementById("lead-entrega").value = lead ? lead.entrega : "";
    document.getElementById("lead-origem").value = lead ? lead.origem : "";
    document.getElementById("lead-resultado").value = lead ? lead.resultado : "Pendente";

    const statusSelect = document.getElementById("lead-status");
    statusSelect.innerHTML = settings.steps.map((step, idx) => 
        `<option value="${idx}" ${lead && lead.status === idx ? "selected" : ""}>${step}</option>`
    ).join("");

    document.getElementById("modal-overlay").style.display = "block";
    document.getElementById("lead-modal").style.display = "block";
}

function saveLead() {
    const cliente = document.getElementById("lead-cliente").value;
    const empresa = document.getElementById("lead-empresa").value;
    const valor = parseFloat(document.getElementById("lead-valor").value) || 0;
    const status = parseInt(document.getElementById("lead-status").value);
    const entrega = document.getElementById("lead-entrega").value;
    const origem = document.getElementById("lead-origem").value;
    const resultado = document.getElementById("lead-resultado").value;

    if (!cliente || !valor) {
        alert("Cliente e Valor são obrigatórios.");
        return;
    }

    if (currentLeadId) {
        const leadIndex = leads.findIndex(l => l.id === currentLeadId);
        if (leadIndex > -1) {
            leads[leadIndex] = { ...leads[leadIndex], cliente, empresa, valor, status, entrega, origem, resultado };
        }
    } else {
        const newLead = { id: Date.now().toString(), cliente, empresa, valor, status, entrega, origem, resultado };
        leads.push(newLead);
    }
    saveState();
    closeAllModals();
    renderCRM();
    updateDashboard();
    updateLeadSelect();
}

function deleteLead(leadId) {
    if (confirm("Tem certeza que deseja excluir este lead?")) {
        leads = leads.filter(l => l.id !== leadId);
        saveState();
        renderCRM();
        updateDashboard();
        updateLeadSelect();
    }
}

function allowDrop(ev) {
    ev.preventDefault();
}

function dragLead(ev, leadId) {
    ev.dataTransfer.setData("text", leadId);
}

function dropLead(ev, newStatus) {
    ev.preventDefault();
    const leadId = ev.dataTransfer.getData("text");
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
        lead.status = newStatus;
        saveState();
        renderCRM();
        updateDashboard();
    }
}

// ================================================================================= //
//                                     CALCULADORA                                   //
// ================================================================================= //

function updateLeadSelect() {
    const select = document.getElementById("g_vincular_lead");
    select.innerHTML = "<option value=\"\">-- Criar Novo Lead --</option>";
    leads.filter(l => l.resultado === "Pendente" || l.resultado === "Venda").forEach(l => {
        const opt = document.createElement("option");
        opt.value = l.id;
        opt.innerText = `${l.cliente} (${settings.steps[l.status]})`;
        select.appendChild(opt);
    });
}

function loadLeadDataIntoCalc() {
    const leadId = document.getElementById("g_vincular_lead").value;
    if (leadId) {
        const lead = leads.find(l => l.id === leadId);
        if (lead) {
            document.getElementById("g_cliente").value = lead.cliente;
            document.getElementById("g_empresa_calc").value = lead.empresa || "";
            // Outros campos do lead podem ser carregados aqui
            // Se o lead tiver itens de orçamento, eles também podem ser carregados
            updateQuote();
        }
    } else {
        document.getElementById("g_cliente").value = "";
        document.getElementById("g_empresa_calc").value = "";
        // Limpar outros campos se nenhum lead estiver selecionado
        updateQuote();
    }
}

function addItem() {
    const id = Date.now();
    items.push({ id, nome: "", tempo_arte: 0, tempo_setup: 0, tempo_gravacao: 0, custo_material: 0, rendimento_chapa: 1, quantidade: 1 });
    renderItems();
}

function removeItem(id) {
    items = items.filter(item => item.id !== id);
    renderItems();
}

function renderItems() {
    const container = document.getElementById("items-list");
    container.innerHTML = items.map(item => `
        <div class="item-card-calc">
            <div class="item-header-calc">
                <input type="text" placeholder="Nome do Item" value="${item.nome}" oninput="updateItem(${item.id}, 'nome', this.value)">
                <button class="btn-modern btn-danger" onclick="removeItem(${item.id})"><i class="fas fa-trash"></i></button>
            </div>
            <div class="field-row">
                <div class="field-group">
                    <label>Tempo Arte (min)</label>
                    <input type="number" value="${item.tempo_arte}" oninput="updateItem(${item.id}, 'tempo_arte', this.value)">
                </div>
                <div class="field-group">
                    <label>Tempo Setup (min)</label>
                    <input type="number" value="${item.tempo_setup}" oninput="updateItem(${item.id}, 'tempo_setup', this.value)">
                </div>
            </div>
            <div class="field-row">
                <div class="field-group">
                    <label>Tempo Gravação (min)</label>
                    <input type="number" value="${item.tempo_gravacao}" oninput="updateItem(${item.id}, 'tempo_gravacao', this.value)">
                </div>
                <div class="field-group">
                    <label>Custo Material (R$)</label>
                    <input type="number" value="${item.custo_material}" oninput="updateItem(${item.id}, 'custo_material', this.value)">
                </div>
            </div>
            <div class="field-row">
                <div class="field-group">
                    <label>Rendimento Chapa</label>
                    <input type="number" value="${item.rendimento_chapa}" oninput="updateItem(${item.id}, 'rendimento_chapa', this.value)">
                </div>
                <div class="field-group">
                    <label>Quantidade</label>
                    <input type="number" value="${item.quantidade}" oninput="updateItem(${item.id}, 'quantidade', this.value)">
                </div>
            </div>
        </div>
    `).join("");
    calc();
}

function updateItem(id, field, val) {
    const item = items.find(i => i.id === id);
    if (item) {
        item[field] = field === "nome" ? val : parseFloat(val) || 0;
        calc();
    }
}

function calc() {
    const valorHora = parseFloat(document.getElementById("g_valor_hora").value) || settings.calculator.hora;
    const impostoPercent = parseFloat(document.getElementById("g_imposto").value) || settings.calculator.imposto;
    const taxaCartaoPercent = parseFloat(document.getElementById("g_cartao").value) || 0;
    const markupGlobal = parseFloat(document.getElementById("g_markup").value) || settings.calculator.markup;
    const freteInsumos = parseFloat(document.getElementById("g_frete_insumos").value) || 0;
    const freteCliente = parseFloat(document.getElementById("g_frete_cliente").value) || 0;
    const descontoPercent = parseFloat(document.getElementById("g_desconto").value) || 0;

    let totalTempo = 0;
    let totalCustoMaterial = 0;
    let totalPrecoVendaItens = 0;

    const quoteItemsBody = document.getElementById("quote-items-body");
    quoteItemsBody.innerHTML = "";

    items.forEach(item => {
        const tempoTotalItem = (item.tempo_arte + item.tempo_setup + item.tempo_gravacao) * item.quantidade;
        totalTempo += tempoTotalItem;

        const chapasNecessarias = Math.ceil(item.quantidade / (item.rendimento_chapa || 1));
        const custoMaterialItem = chapasNecessarias * item.custo_material;
        totalCustoMaterial += custoMaterialItem;

        const custoProducaoItem = (tempoTotalItem / 60 * valorHora) + custoMaterialItem;
        const precoVendaItem = custoProducaoItem * markupGlobal;
        totalPrecoVendaItens += precoVendaItem;

        quoteItemsBody.innerHTML += `
            <tr>
                <td>${item.nome || "Item"}</td>
                <td>${item.quantidade}</td>
                <td>${formatBRL(precoVendaItem / item.quantidade)}</td>
                <td>${formatBRL(precoVendaItem)}</td>
            </tr>
        `;
    });

    const custoTempoTotal = (totalTempo / 60) * valorHora;
    const custoGeral = custoTempoTotal + totalCustoMaterial + freteInsumos;
    const impostosCalculados = (totalPrecoVendaItens + freteCliente) * (impostoPercent / 100);
    const precoFinalBruto = totalPrecoVendaItens + freteCliente + impostosCalculados;
    const valorComDesconto = precoFinalBruto * (1 - (descontoPercent / 100));
    const lucroReal = valorComDesconto - custoGeral - impostosCalculados;

    document.getElementById("res_tempo").innerText = `${Math.floor(totalTempo / 60)}h ${totalTempo % 60}min`;
    document.getElementById("res_custo_tempo").innerText = formatBRL(custoTempoTotal);
    document.getElementById("res_custo_mat").innerText = formatBRL(totalCustoMaterial);
    document.getElementById("res_impostos").innerText = formatBRL(impostosCalculados);
    document.getElementById("res_custo_geral").innerText = formatBRL(custoGeral);
    document.getElementById("res_lucro_real").innerText = formatBRL(lucroReal);

    const markupCalculado = custoGeral > 0 ? (valorComDesconto / custoGeral).toFixed(2) : 0;
    const indicator = document.getElementById("markup-indicator");
    indicator.innerText = `MARKUP: ${markupCalculado}x`;
    indicator.className = "markup-indicator";
    if (markupCalculado < 1.5) { indicator.classList.add("markup-low"); }
    else if (markupCalculado < 2.5) { indicator.classList.add("markup-mid"); }
    else { indicator.classList.add("markup-high"); }

    document.getElementById("q_total").innerText = formatBRL(valorComDesconto);
    updateQuote();
}

function updateQuote() {
    const cliente = document.getElementById("g_cliente").value;
    const dataProposta = document.getElementById("g_data_proposta").value;
    const whatsapp = document.getElementById("g_whatsapp").value;

    document.getElementById("q_nome").innerText = cliente || "Cliente não informado";
    document.getElementById("q_data").innerText = `Data: ${dataProposta ? new Date(dataProposta + "T00:00:00").toLocaleDateString("pt-BR") : "--/--/----"}`;
    document.getElementById("q_whatsapp_link").innerText = whatsapp ? `WhatsApp: ${whatsapp}` : "WhatsApp: (00) 00000-0000";
}

function saveToCRM() {
    const cliente = document.getElementById("g_cliente").value;
    const empresa = document.getElementById("g_empresa_calc").value;
    const valor = parseFloat(document.getElementById("q_total").innerText.replace("R$", "").replace(".", "").replace(",", ".")) || 0;
    const entrega = document.getElementById("g_data_proposta").value; // Usar data da proposta como entrega inicial

    if (!cliente || !valor) {
        alert("Nome do Cliente e Valor Total são obrigatórios para salvar no CRM.");
        return;
    }

    const newLead = { 
        id: Date.now().toString(), 
        cliente, 
        empresa, 
        valor, 
        status: 0, // Proposta Enviada
        entrega, 
        resultado: "Pendente", 
        origem: "Calculadora",
        cpv: parseFloat(document.getElementById("res_custo_geral").innerText.replace("R$", "").replace(".", "").replace(",", ".")) || 0,
        impostos: parseFloat(document.getElementById("res_impostos").innerText.replace("R$", "").replace(".", "").replace(",", ".")) || 0,
        lucro: parseFloat(document.getElementById("res_lucro_real").innerText.replace("R$", "").replace(".", "").replace(",", ".")) || 0
    };
    leads.push(newLead);
    saveState();
    alert("Orçamento salvo no CRM como novo lead!");
    renderCRM();
    updateLeadSelect();
}

// ================================================================================= //
//                                  FLUXO DE CAIXA                                   //
// ================================================================================= //

function renderFinanceCategories() {
    const selectCat = document.getElementById("f_cat");
    const transCat = document.getElementById("trans-cat");
    selectCat.innerHTML = "";
    transCat.innerHTML = "";
    settings.categories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.innerText = cat;
        selectCat.appendChild(opt);
        transCat.appendChild(opt.cloneNode(true));
    });
}

function renderFinance() {
    const startDate = document.getElementById("flow-start").value;
    const endDate = document.getElementById("flow-end").value;
    const typeFilter = document.getElementById("flow-type-filter").value;

    let filteredTransactions = transactions.filter(t => {
        const tDate = new Date(t.data + "T00:00:00");
        const start = new Date(startDate + "T00:00:00");
        const end = new Date(endDate + "T00:00:00");
        return tDate >= start && tDate <= end && (typeFilter === "" || t.tipo === typeFilter);
    }).sort((a, b) => new Date(a.data) - new Date(b.data));

    const tbody = document.getElementById("finance-table-body");
    tbody.innerHTML = filteredTransactions.map(t => `
        <tr>
            <td>${new Date(t.data + "T00:00:00").toLocaleDateString("pt-BR")}</td>
            <td>${t.desc}</td>
            <td>${t.cat}</td>
            <td style="color: ${t.tipo === "entrada" ? "var(--success)" : "var(--danger)"};">${t.tipo === "entrada" ? "Entrada" : "Saída"}</td>
            <td>${formatBRL(t.valor)}</td>
            <td>
                <button class="btn-modern btn-primary" onclick="openTransactionModal('${t.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-modern btn-danger" onclick="deleteTransaction('${t.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join("");

    const totalEntradas = filteredTransactions.filter(t => t.tipo === "entrada").reduce((acc, t) => acc + t.valor, 0);
    const totalSaidas = filteredTransactions.filter(t => t.tipo === "saída").reduce((acc, t) => acc + t.valor, 0);
    const saldoAtual = settings.initialBalance + totalEntradas - totalSaidas;

    document.getElementById("f_res_saldo").innerText = formatBRL(saldoAtual);
    document.getElementById("f_res_ent").innerText = formatBRL(totalEntradas);
    document.getElementById("f_res_sai").innerText = formatBRL(totalSaidas);
}

function addFinance() {
    const desc = document.getElementById("f_desc").value;
    const valor = parseFloat(document.getElementById("f_val").value) || 0;
    const tipo = document.getElementById("f_tipo").value;
    const cat = document.getElementById("f_cat").value;
    const data = document.getElementById("f_data").value;

    if (!desc || !valor || !data) {
        alert("Descrição, Valor e Data são obrigatórios para a transação.");
        return;
    }

    const newTransaction = { id: Date.now().toString(), desc, valor, tipo, cat, data };
    transactions.push(newTransaction);
    saveState();
    document.getElementById("f_desc").value = "";
    document.getElementById("f_val").value = "";
    renderFinance();
}

function openTransactionModal(transactionId = null) {
    currentTransactionId = transactionId;
    const transaction = transactions.find(t => t.id === transactionId);

    document.getElementById("trans-desc").value = transaction ? transaction.desc : "";
    document.getElementById("trans-valor").value = transaction ? transaction.valor : "";
    document.getElementById("trans-tipo").value = transaction ? transaction.tipo : "entrada";
    document.getElementById("trans-cat").value = transaction ? transaction.cat : settings.categories[0];
    document.getElementById("trans-data").value = transaction ? transaction.data : new Date().toISOString().split("T")[0];

    document.getElementById("modal-overlay").style.display = "block";
    document.getElementById("transaction-modal").style.display = "block";
}

function saveTransaction() {
    const desc = document.getElementById("trans-desc").value;
    const valor = parseFloat(document.getElementById("trans-valor").value) || 0;
    const tipo = document.getElementById("trans-tipo").value;
    const cat = document.getElementById("trans-cat").value;
    const data = document.getElementById("trans-data").value;

    if (!desc || !valor || !data) {
        alert("Descrição, Valor e Data são obrigatórios.");
        return;
    }

    if (currentTransactionId) {
        const transIndex = transactions.findIndex(t => t.id === currentTransactionId);
        if (transIndex > -1) {
            transactions[transIndex] = { ...transactions[transIndex], desc, valor, tipo, cat, data };
        }
    } else {
        const newTransaction = { id: Date.now().toString(), desc, valor, tipo, cat, data };
        transactions.push(newTransaction);
    }
    saveState();
    closeAllModals();
    renderFinance();
}

function deleteTransaction(transactionId) {
    if (confirm("Tem certeza que deseja excluir esta transação?")) {
        transactions = transactions.filter(t => t.id !== transactionId);
        saveState();
        renderFinance();
    }
}

function openBalanceModal() {
    document.getElementById("initial-balance-input").value = settings.initialBalance;
    document.getElementById("modal-overlay").style.display = "block";
    document.getElementById("balance-modal").style.display = "block";
}

function saveInitialBalance() {
    settings.initialBalance = parseFloat(document.getElementById("initial-balance-input").value) || 0;
    saveState();
    closeAllModals();
    renderFinance();
}

// ================================================================================= //
//                                     DRE & BI                                      //
// ================================================================================= //

let chartPerformance, chartPrevisibilidade;

function renderDRE() {
    const monthFilter = document.getElementById("dre-month-filter").value;
    const [year, month] = monthFilter.split("-").map(Number);

    const monthLeads = leads.filter(l => {
        if (l.resultado !== "Venda" || !l.entrega) return false;
        const d = new Date(l.entrega + "T00:00:00");
        return d.getMonth() === (month - 1) && d.getFullYear() === year;
    });

    const receitaBruta = monthLeads.reduce((acc, l) => acc + (l.valor || 0), 0);
    const cpv = monthLeads.reduce((acc, l) => acc + (l.cpv || 0), 0);
    const impostosVendas = monthLeads.reduce((acc, l) => acc + (l.impostos || 0), 0);

    const despesasOperacionais = transactions.filter(t => {
        if (t.tipo !== "saída") return false;
        const d = new Date(t.data + "T00:00:00");
        return d.getMonth() === (month - 1) && d.getFullYear() === year;
    }).reduce((acc, t) => acc + t.valor, 0);

    const receitaLiquida = receitaBruta - impostosVendas;
    const lucroBruto = receitaLiquida - cpv;
    const resultadoLiquido = lucroBruto - despesasOperacionais;

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = formatBRL(val); };
    const setPercent = (id, val, total) => { const el = document.getElementById(id); if (el) el.innerText = total > 0 ? `${(val / total * 100).toFixed(2)}%` : "0%"; };
    
    setVal("dre-receita-bruta", receitaBruta);
    setPercent("dre-receita-bruta-p", receitaBruta, receitaBruta);

    setVal("dre-impostos", impostosVendas);
    setPercent("dre-impostos-p", impostosVendas, receitaBruta);

    setVal("dre-receita-liquida", receitaLiquida);
    setPercent("dre-receita-liquida-p", receitaLiquida, receitaBruta);

    setVal("dre-cpv", cpv);
    setPercent("dre-cpv-p", cpv, receitaBruta);

    setVal("dre-lucro-bruto", lucroBruto);
    setPercent("dre-lucro-bruto-p", lucroBruto, receitaBruta);

    setVal("dre-despesas", despesasOperacionais);
    setPercent("dre-despesas-p", despesasOperacionais, receitaBruta);

    setVal("dre-resultado-final", resultadoLiquido);
    setPercent("dre-resultado-final-p", resultadoLiquido, receitaBruta);

    if (document.getElementById("dre-resultado")) {
        document.getElementById("dre-resultado").innerText = formatBRL(resultadoLiquido);
        document.getElementById("dre-resultado").style.color = resultadoLiquido >= 0 ? "var(--success)" : "var(--danger)";
    }
    
    renderDRECharts(receitaBruta, cpv, despesasOperacionais, resultadoLiquido);
}

function renderDRECharts(receitaBruta, cpv, despesasOperacionais, resultadoLiquido) {
    const ctxPerf = document.getElementById("chart-performance");
    if (chartPerformance) chartPerformance.destroy();
    chartPerformance = new Chart(ctxPerf, {
        type: "bar",
        data: {
            labels: ["Receita Bruta", "CPV", "Despesas Operacionais", "Resultado Líquido"],
            datasets: [{
                data: [receitaBruta, cpv, despesasOperacionais, resultadoLiquido],
                backgroundColor: ["var(--primary)", "var(--warning)", "var(--danger)", "var(--success)"]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } },
            plugins: { legend: { display: false } }
        }
    });

    const ctxPrev = document.getElementById("chart-previsibilidade");
    if (chartPrevisibilidade) chartPrevisibilidade.destroy();
    chartPrevisibilidade = new Chart(ctxPrev, {
        type: "line",
        data: {
            labels: ["Mês Anterior", "Mês Atual", "Próximo Mês"], // Exemplo
            datasets: [{
                label: "Receita Líquida",
                data: [receitaBruta * 0.9, receitaBruta, receitaBruta * 1.1], // Dados de exemplo
                borderColor: "var(--primary)",
                tension: 0.3,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } },
            plugins: { legend: { display: false } }
        }
    });
}

// ================================================================================= //
//                                 SIMULADOR DE METAS                                //
// ================================================================================= //

let simCostChart, simProfitChart;
let simItems = [];

function renderSimInputs() {
    const container = document.getElementById("sim-items-container");
    container.innerHTML = settings.simLabels.map((label, idx) => `
        <div class="field-group">
            <label>${label}</label>
            <input type="number" id="sim-cost-${idx}" value="0" oninput="calculateSim()">
        </div>
    `).join("");
    // Adicionar os itens customizados
    container.innerHTML += simItems.map((item, idx) => `
        <div class="field-group">
            <label>${item.label}</label>
            <input type="number" value="${item.value}" oninput="updateSimItem(${idx}, this.value)">
            <button class="btn-modern btn-danger" onclick="removeSimItem(${idx})"><i class="fas fa-trash"></i></button>
        </div>
    `).join("");
    calculateSim();
}

function addSimItem() {
    const newItem = { label: "Novo Custo", value: 0 };
    simItems.push(newItem);
    renderSimInputs();
}

function updateSimItem(index, value) {
    simItems[index].value = parseFloat(value) || 0;
    calculateSim();
}

function removeSimItem(index) {
    simItems.splice(index, 1);
    renderSimInputs();
}

function calculateSim() {
    const metaFaturamento = parseFloat(document.getElementById("sim-meta-faturamento").value) || 0;
    const markupMedioDesejado = parseFloat(document.getElementById("sim-markup-medio").value) || 0;

    let totalCustosFixosVariaveis = 0;
    settings.simLabels.forEach((label, idx) => {
        totalCustosFixosVariaveis += parseFloat(document.getElementById(`sim-cost-${idx}`).value) || 0;
    });
    totalCustosFixosVariaveis += simItems.reduce((acc, item) => acc + item.value, 0);

    let custoTotalProjetado = 0;
    let lucroLiquidoProjetado = 0;
    let pedidosNecessarios = 0;

    if (markupMedioDesejado > 0) {
        custoTotalProjetado = metaFaturamento / markupMedioDesejado;
        lucroLiquidoProjetado = metaFaturamento - custoTotalProjetado - totalCustosFixosVariaveis;
        // Simplificação: assumindo um valor médio por pedido para estimar a quantidade
        const valorMedioPorPedido = 500; // Exemplo
        pedidosNecessarios = Math.ceil(metaFaturamento / valorMedioPorPedido);
    }

    document.getElementById("sim-custo-total").innerText = formatBRL(custoTotalProjetado);
    document.getElementById("sim-lucro-liquido").innerText = formatBRL(lucroLiquidoProjetado);
    document.getElementById("sim-pedidos-necessarios").innerText = formatNumber(pedidosNecessarios);

    renderSimCharts(totalCustosFixosVariaveis, custoTotalProjetado, lucroLiquidoProjetado);
}

function renderSimCharts(totalCustosFixosVariaveis, custoTotalProjetado, lucroLiquidoProjetado) {
    const ctxCustos = document.getElementById("chart-sim-custos");
    if (simCostChart) simCostChart.destroy();
    simCostChart = new Chart(ctxCustos, {
        type: "pie",
        data: {
            labels: settings.simLabels.concat(simItems.map(item => item.label)),
            datasets: [{
                data: settings.simLabels.map((label, idx) => parseFloat(document.getElementById(`sim-cost-${idx}`).value) || 0).concat(simItems.map(item => item.value)),
                backgroundColor: ["#00e6cb", "#2979ff", "#7c4dff", "#ffea00", "#ff1744", "#94a3b8", "#e91e63", "#673ab7"]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: "right" } }
        }
    });

    const ctxLucro = document.getElementById("chart-sim-lucro");
    if (simProfitChart) simProfitChart.destroy();
    simProfitChart = new Chart(ctxLucro, {
        type: "bar",
        data: {
            labels: ["Custo Total", "Lucro Líquido"],
            datasets: [{
                data: [custoTotalProjetado, lucroLiquidoProjetado],
                backgroundColor: ["var(--danger)", "var(--success)"]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } },
            plugins: { legend: { display: false } }
        }
    });
}

// ================================================================================= //
//                                      ESTOQUE                                      //
// ================================================================================= //

function renderStock() {
    const tbody = document.getElementById("stock-table-body");
    tbody.innerHTML = stockItems.map(item => `
        <tr>
            <td>${item.nome}</td>
            <td>${item.quantidade}</td>
            <td>${item.unidade}</td>
            <td>${formatBRL(item.custoUnitario)}</td>
            <td>${formatBRL(item.quantidade * item.custoUnitario)}</td>
            <td>
                <button class="btn-modern btn-primary" onclick="openStockModal('${item.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-modern btn-danger" onclick="deleteStockItem('${item.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join("");
}

function openStockModal(itemId = null) {
    currentStockItemId = itemId;
    const item = stockItems.find(i => i.id === itemId);

    document.getElementById("stock-nome").value = item ? item.nome : "";
    document.getElementById("stock-qtd").value = item ? item.quantidade : "";
    document.getElementById("stock-unidade").value = item ? item.unidade : "";
    document.getElementById("stock-custo-unitario").value = item ? item.custoUnitario : "";

    document.getElementById("modal-overlay").style.display = "block";
    document.getElementById("stock-modal").style.display = "block";
}

function saveStockItem() {
    const nome = document.getElementById("stock-nome").value;
    const quantidade = parseFloat(document.getElementById("stock-qtd").value) || 0;
    const unidade = document.getElementById("stock-unidade").value;
    const custoUnitario = parseFloat(document.getElementById("stock-custo-unitario").value) || 0;

    if (!nome || !quantidade || !unidade || !custoUnitario) {
        alert("Todos os campos do item de estoque são obrigatórios.");
        return;
    }

    if (currentStockItemId) {
        const itemIndex = stockItems.findIndex(i => i.id === currentStockItemId);
        if (itemIndex > -1) {
            stockItems[itemIndex] = { ...stockItems[itemIndex], nome, quantidade, unidade, custoUnitario };
        }
    } else {
        const newItem = { id: Date.now().toString(), nome, quantidade, unidade, custoUnitario };
        stockItems.push(newItem);
    }
    saveState();
    closeAllModals();
    renderStock();
}

function deleteStockItem(itemId) {
    if (confirm("Tem certeza que deseja excluir este item do estoque?")) {
        stockItems = stockItems.filter(item => item.id !== itemId);
        saveState();
        renderStock();
    }
}

// ================================================================================= //
//                                  CONFIGURAÇÕES                                    //
// ================================================================================= //

function loadSettingsPage() {
    renderCrmStepsSettings();
    renderFinanceCatsSettings();
    document.getElementById("setting-hora").value = settings.calculator.hora;
    document.getElementById("setting-imposto").value = settings.calculator.imposto;
    document.getElementById("setting-markup").value = settings.calculator.markup;
}

function renderCrmStepsSettings() {
    const container = document.getElementById("settings-crm-steps");
    container.innerHTML = settings.steps.map((step, idx) => `
        <div class="setting-item-row">
            <input type="text" value="${step}" oninput="updateCrmStep(${idx}, this.value)">
            <button class="btn-modern btn-danger" onclick="removeCrmStep(${idx})"><i class="fas fa-trash"></i></button>
        </div>
    `).join("");
}

function addCrmStep() {
    const newStep = document.getElementById("new-crm-step").value;
    if (newStep && !settings.steps.includes(newStep)) {
        settings.steps.push(newStep);
        document.getElementById("new-crm-step").value = "";
        saveState();
        renderCrmStepsSettings();
        renderCRM(); // Atualiza o CRM para refletir as novas etapas
    }
}

function updateCrmStep(index, value) {
    settings.steps[index] = value;
    saveState();
    renderCRM();
}

function removeCrmStep(index) {
    if (confirm("Remover esta etapa pode afetar leads existentes. Tem certeza?")) {
        settings.steps.splice(index, 1);
        saveState();
        renderCrmStepsSettings();
        renderCRM();
    }
}

function renderFinanceCatsSettings() {
    const container = document.getElementById("settings-finance-cats");
    container.innerHTML = settings.categories.map((cat, idx) => `
        <div class="setting-item-row">
            <input type="text" value="${cat}" oninput="updateFinanceCat(${idx}, this.value)">
            <button class="btn-modern btn-danger" onclick="removeFinanceCat(${idx})"><i class="fas fa-trash"></i></button>
        </div>
    `).join("");
}

function addFinanceCat() {
    const newCat = document.getElementById("new-finance-cat").value;
    if (newCat && !settings.categories.includes(newCat)) {
        settings.categories.push(newCat);
        document.getElementById("new-finance-cat").value = "";
        saveState();
        renderFinanceCatsSettings();
        renderFinanceCategories(); // Atualiza as categorias no fluxo de caixa
    }
}

function updateFinanceCat(index, value) {
    settings.categories[index] = value;
    saveState();
    renderFinanceCategories();
}

function removeFinanceCat(index) {
    if (confirm("Remover esta categoria pode afetar transações existentes. Tem certeza?")) {
        settings.categories.splice(index, 1);
        saveState();
        renderFinanceCatsSettings();
        renderFinanceCategories();
    }
}

function updateSetting(key, value) {
    settings.calculator[key] = parseFloat(value) || 0;
    saveState();
    calc(); // Recalcula a calculadora com as novas configurações
}

// ================================================================================= //
//                                     APLICAR SETTINGS                              //
// ================================================================================= //

function applySettings() {
    // Aplicar configurações da calculadora
    if (document.getElementById("g_valor_hora")) document.getElementById("g_valor_hora").value = settings.calculator.hora;
    if (document.getElementById("g_imposto")) document.getElementById("g_imposto").value = settings.calculator.imposto;
    if (document.getElementById("g_markup")) document.getElementById("g_markup").value = settings.calculator.markup;

    // Outras configurações podem ser aplicadas aqui
}
