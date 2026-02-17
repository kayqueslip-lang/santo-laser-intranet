// ================================================================================= //
//                                     ESTADO GLOBAL                                 //
// ================================================================================= //

let leads = JSON.parse(localStorage.getItem('santo_leads')) || [];
let transactions = JSON.parse(localStorage.getItem('santo_transactions')) || [];
let simItems = JSON.parse(localStorage.getItem('santo_sim_items')) || [];
let stockItems = JSON.parse(localStorage.getItem('santo_stock_items')) || [];
let initialBalance = parseFloat(localStorage.getItem('santo_initial_balance')) || 0;
let settings = JSON.parse(localStorage.getItem('santo_settings')) || {
    steps: ["Proposta Enviada", "Aprovado", "Produção", "Finalizado", "Pago"],
    simLabels: ["Pró-labore", "Custos Fixos", "Marketing", "Reserva/Investimento"],
    categories: ["Materiais", "Energia", "Marketing", "Vendas CRM", "Outros"]
};
let items = []; // Itens da calculadora atual

// ================================================================================= //
//                                 INICIALIZAÇÃO                                     //
// ================================================================================= //

document.addEventListener('DOMContentLoaded', () => {
    // Carregar Logo
    fetch('logo_base64.txt').then(r => r.text()).then(base64 => {
        if (base64) {
            const fullBase64 = "data:image/jpeg;base64," + base64;
            document.getElementById('main-logo-img').src = fullBase64;
            document.getElementById('quote-logo-img').src = fullBase64;
        }
    }).catch(() => {
        document.getElementById('main-logo-img').src = "https://via.placeholder.com/80?text=SL";
    });

    applySettings();
    updateCurrentDate();
    renderCRM();
    renderFinance();
    runSimulator();
    renderStock();
    updateDashboard();
    addItem(); 
});

function updateCurrentDate() {
    const now = new Date();
    document.getElementById('current-date').innerText = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatBRL(val) {
    return parseFloat(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ================================================================================= //
//                                     NAVEGAÇÃO                                     //
// ================================================================================= //

function showSection(sectionId) {
    closeAllModals();
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById(`${sectionId}-content`).classList.add('active');
    event.currentTarget.classList.add('active');
    
    if (sectionId === 'dashboard') updateDashboard();
    if (sectionId === 'crm') renderCRM();
    if (sectionId === 'cashflow') renderFinance();
    if (sectionId === 'simulator') runSimulator();
    if (sectionId === 'stock') renderStock();
    if (sectionId === 'settings') loadSettingsPage();
}

function closeAllModals() {
    document.getElementById('modal-overlay').style.display = 'none';
    document.querySelectorAll('.modal-modern').forEach(m => m.style.display = 'none');
}

function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    
    const btn = document.getElementById('theme-toggle');
    btn.innerHTML = next === 'dark' ? 
        '<i class="fa-solid fa-moon"></i> <span>MODO ESCURO</span>' : 
        '<i class="fa-solid fa-sun"></i> <span>MODO CLARO</span>';
}

// ================================================================================= //
//                                     SETTINGS                                      //
// ================================================================================= //

function applySettings() {
    for (let i = 0; i < 5; i++) {
        const label = document.getElementById(`label-step-${i+1}`);
        const opt = document.getElementById(`opt-step-${i+1}`);
        if (label) label.innerText = settings.steps[i].toUpperCase();
        if (opt) opt.innerText = settings.steps[i];
    }

    const labels = [
        {id: 'label-prolabore', text: settings.simLabels[0]},
        {id: 'label-custos-fixos', text: settings.simLabels[1]},
        {id: 'label-marketing', text: settings.simLabels[2]},
        {id: 'label-reserva', text: settings.simLabels[3]}
    ];
    labels.forEach(l => {
        const el = document.getElementById(l.id);
        if (el) el.innerText = `${l.text} (R$)`;
    });

    const filterCat = document.getElementById('filter-cat');
    const modalCat = document.getElementById('f_cat_select');
    if (filterCat && modalCat) {
        filterCat.innerHTML = '<option value="">Todas</option>';
        modalCat.innerHTML = '';
        settings.categories.forEach(cat => {
            filterCat.innerHTML += `<option value="${cat}">${cat}</option>`;
            modalCat.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
    }
}

function loadSettingsPage() {
    for (let i = 0; i < 5; i++) {
        document.getElementById(`set-step-${i+1}`).value = settings.steps[i];
    }
    for (let i = 0; i < 4; i++) {
        document.getElementById(`set-label-${i+1}`).value = settings.simLabels[i];
    }
    renderSettingsCategories();
}

function renderSettingsCategories() {
    const list = document.getElementById('settings-categories-list');
    list.innerHTML = "";
    settings.categories.forEach((cat, idx) => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.gap = '10px';
        div.style.marginBottom = '10px';
        div.innerHTML = `
            <input type="text" value="${cat}" onchange="updateCategory(${idx}, this.value)" style="flex:1">
            <button class="btn-modern btn-danger" onclick="removeCategory(${idx})"><i class="fa-solid fa-trash"></i></button>
        `;
        list.appendChild(div);
    });
}

function updateCategory(idx, val) { settings.categories[idx] = val; saveSettings(); }
function removeCategory(idx) { settings.categories.splice(idx, 1); saveSettings(); renderSettingsCategories(); }
function addCategory() { settings.categories.push("Nova Categoria"); saveSettings(); renderSettingsCategories(); }

function saveSettings() {
    for (let i = 0; i < 5; i++) settings.steps[i] = document.getElementById(`set-step-${i+1}`).value;
    for (let i = 0; i < 4; i++) settings.simLabels[i] = document.getElementById(`set-label-${i+1}`).value;
    localStorage.setItem('santo_settings', JSON.stringify(settings));
    applySettings();
}

function resetSystem() {
    if (confirm("ATENÇÃO: Isso apagará TODOS os dados do sistema. Deseja continuar?")) {
        localStorage.clear();
        location.reload();
    }
}

// ================================================================================= //
//                                     DASHBOARD                                     //
// ================================================================================= //

function updateDashboard() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const paidLeadsMonth = leads.filter(l => {
        if (l.status != 4 || !l.entrega || l.resultado === 'Perda') return false;
        const d = new Date(l.entrega + 'T00:00:00');
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const faturamento = paidLeadsMonth.reduce((acc, l) => acc + parseFloat(l.valor || 0), 0);
    const lucro = paidLeadsMonth.reduce((acc, l) => acc + parseFloat(l.lucro || 0), 0);
    const pedidosAtivos = leads.filter(l => (l.status == 1 || l.status == 2) && l.resultado !== 'Perda').length;
    
    const totalFinalizados = leads.filter(l => l.status == 4 || l.resultado === 'Perda').length;
    const totalVendas = leads.filter(l => l.status == 4 && l.resultado === 'Venda').length;
    const conversao = totalFinalizados > 0 ? (totalVendas / totalFinalizados * 100).toFixed(1) : 0;

    document.getElementById('dash-faturamento').innerText = formatBRL(faturamento);
    document.getElementById('dash-lucro').innerText = formatBRL(lucro);
    document.getElementById('dash-pedidos').innerText = pedidosAtivos;
    document.getElementById('dash-conversao').innerText = `${conversao}%`;
    
    renderCharts();
    renderTimeline();
}

function renderCharts() {
    const ctxOrigem = document.getElementById('chart-origem');
    const ctxStatus = document.getElementById('chart-status');
    if (!ctxOrigem || !ctxStatus) return;
    
    if (window.Chart) {
        if (window.myChartOrigem) window.myChartOrigem.destroy();
        const origens = {};
        leads.forEach(l => origens[l.origem] = (origens[l.origem] || 0) + 1);
        
        window.myChartOrigem = new Chart(ctxOrigem, {
            type: 'doughnut',
            data: {
                labels: Object.keys(origens).length ? Object.keys(origens) : ['Sem dados'],
                datasets: [{
                    data: Object.values(origens).length ? Object.values(origens) : [1],
                    backgroundColor: ['#00e6cb', '#ff1744', '#ffea00', '#00c853', '#2979ff'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } } }
        });

        if (window.myChartStatus) window.myChartStatus.destroy();
        const statusCount = [0,0,0,0,0];
        leads.forEach(l => { if (l.status < 5) statusCount[l.status]++; });

        window.myChartStatus = new Chart(ctxStatus, {
            type: 'bar',
            data: {
                labels: settings.steps,
                datasets: [{
                    label: 'Leads',
                    data: statusCount,
                    backgroundColor: '#00e6cb'
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                scales: { 
                    y: { beginAtZero: true, grid: { color: '#2d333f' }, ticks: { color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }
}

function renderTimeline() {
    const container = document.getElementById('timeline-wrapper');
    if (!container) return;
    container.innerHTML = "";
    
    const activeLeads = leads.filter(l => (l.status == 1 || l.status == 2) && l.entrega && l.resultado !== 'Perda');
    
    if (activeLeads.length === 0) {
        container.innerHTML = "<p style='text-align:center; padding:40px; color:var(--text-secondary)'>Nenhum pedido em produção com data de entrega definida.</p>";
        return;
    }

    activeLeads.sort((a, b) => new Date(a.entrega) - new Date(b.entrega));

    activeLeads.forEach(l => {
        const row = document.createElement('div');
        row.className = 'timeline-row';
        
        const entrega = new Date(l.entrega + 'T00:00:00');
        const hoje = new Date();
        const diffDays = Math.ceil((entrega - hoje) / (1000 * 60 * 60 * 24));
        
        const barWidth = Math.max(diffDays * 40, 120);
        
        row.innerHTML = `
            <div class="timeline-client">${l.cliente}</div>
            <div class="timeline-track">
                <div class="timeline-bar" style="width: ${Math.min(barWidth, 500)}px; background: ${diffDays < 0 ? 'var(--danger)' : 'var(--neon)'}">
                    ${diffDays < 0 ? 'ATRASADO' : `ENTREGA EM ${diffDays} DIAS`}
                </div>
            </div>
            <div style="width:120px; text-align:right; font-size:0.8rem; color:var(--text-secondary)">${entrega.toLocaleDateString('pt-BR')}</div>
        `;
        container.appendChild(row);
    });
}

// ================================================================================= //
//                                        CRM                                        //
// ================================================================================= //

function renderCRM() {
    const tableBody = document.getElementById('crm-table-body');
    if (tableBody) tableBody.innerHTML = "";

    for (let i = 0; i < 5; i++) {
        const column = document.getElementById(`cards-${i}`);
        const countEl = document.getElementById(`count-${i}`);
        if (!column) continue;
        column.innerHTML = "";
        
        const filteredLeads = leads.filter(l => l.status == i && l.resultado !== 'Perda');
        if (countEl) countEl.innerText = filteredLeads.length;

        filteredLeads.forEach(lead => {
            const card = document.createElement('div');
            card.className = 'kanban-card';
            card.draggable = true;
            card.id = `lead-${lead.id}`;
            card.ondragstart = (e) => {
                e.dataTransfer.setData("text", lead.id);
                setTimeout(() => card.style.opacity = '0.4', 0);
            };
            card.ondragend = () => card.style.opacity = '1';
            card.onclick = () => editLead(lead.id);
            
            card.innerHTML = `
                <div class="card-title" style="font-weight:800; margin-bottom:10px;">${lead.cliente}</div>
                ${lead.empresa ? `<div class="card-company" style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:10px;">${lead.empresa}</div>` : ''}
                <div class="card-meta" style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="color:var(--neon); font-weight:700; font-size:0.85rem;">${formatBRL(lead.valor)}</span>
                    ${lead.entrega ? `<span style="font-size:0.7rem; opacity:0.7;"><i class="fa-regular fa-calendar"></i> ${new Date(lead.entrega + 'T00:00:00').toLocaleDateString('pt-BR')}</span>` : ''}
                </div>
            `;
            column.appendChild(card);

            if (tableBody) {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${lead.cliente}</td>
                    <td>${lead.empresa || '-'}</td>
                    <td><span class="tag price">${settings.steps[lead.status]}</span></td>
                    <td>${formatBRL(lead.valor)}</td>
                    <td>${lead.entrega ? new Date(lead.entrega + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                    <td><button class="btn-modern" onclick="editLead('${lead.id}')"><i class="fa-solid fa-pen"></i></button></td>
                `;
                tableBody.appendChild(row);
            }
        });
    }
    localStorage.setItem('santo_leads', JSON.stringify(leads));
}

function allowDrop(e) { e.preventDefault(); }
function drop(e, newStatus) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text");
    const lead = leads.find(l => l.id == id);
    if (lead) {
        lead.status = newStatus;
        renderCRM();
        updateDashboard();
    }
}

function openLeadModal() {
    document.getElementById('lead-modal-title').innerText = "NOVO CLIENTE";
    document.getElementById('m_lead_id').value = "";
    document.getElementById('m_cliente').value = "";
    document.getElementById('m_empresa').value = "";
    document.getElementById('m_status').value = "0";
    document.getElementById('m_origem').value = "WhatsApp";
    document.getElementById('m_entrega').value = "";
    document.getElementById('m_valor').value = "";
    document.getElementById('m_lucro').value = "";
    document.getElementById('m_resultado').value = "";
    document.getElementById('btn-delete-lead').style.display = 'none';
    updateResultButtons("");
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('lead-modal').style.display = 'block';
}

function editLead(id) {
    const lead = leads.find(l => l.id == id);
    if (!lead) return;
    
    document.getElementById('lead-modal-title').innerText = "EDITAR CLIENTE";
    document.getElementById('m_lead_id').value = lead.id;
    document.getElementById('m_cliente').value = lead.cliente;
    document.getElementById('m_empresa').value = lead.empresa || "";
    document.getElementById('m_status').value = lead.status;
    document.getElementById('m_origem').value = lead.origem;
    document.getElementById('m_entrega').value = lead.entrega || "";
    document.getElementById('m_valor').value = lead.valor || "";
    document.getElementById('m_lucro').value = lead.lucro || "";
    document.getElementById('m_resultado').value = lead.resultado || "";
    document.getElementById('btn-delete-lead').style.display = 'flex';
    updateResultButtons(lead.resultado || "");
    
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('lead-modal').style.display = 'block';
}

function saveLead() {
    const id = document.getElementById('m_lead_id').value;
    const leadData = {
        id: id || Date.now().toString(),
        cliente: document.getElementById('m_cliente').value,
        empresa: document.getElementById('m_empresa').value,
        status: parseInt(document.getElementById('m_status').value),
        origem: document.getElementById('m_origem').value,
        entrega: document.getElementById('m_entrega').value,
        valor: parseFloat(document.getElementById('m_valor').value) || 0,
        lucro: parseFloat(document.getElementById('m_lucro').value) || 0,
        resultado: document.getElementById('m_resultado').value
    };

    if (!leadData.cliente) { alert("Nome do cliente é obrigatório!"); return; }

    if (id) {
        const index = leads.findIndex(l => l.id == id);
        leads[index] = leadData;
    } else {
        leads.push(leadData);
    }

    renderCRM();
    updateDashboard();
    closeLeadModal();
}

function deleteLead() {
    const id = document.getElementById('m_lead_id').value;
    if (!id) return;
    if (confirm("Deseja realmente excluir este lead?")) {
        leads = leads.filter(l => l.id != id);
        renderCRM();
        updateDashboard();
        closeLeadModal();
    }
}

function setResult(res) {
    const current = document.getElementById('m_resultado').value;
    const newVal = current === res ? "" : res;
    document.getElementById('m_resultado').value = newVal;
    updateResultButtons(newVal);
}

function updateResultButtons(val) {
    const btnVenda = document.getElementById('btn-venda');
    const btnPerda = document.getElementById('btn-perda');
    btnVenda.style.background = val === 'Venda' ? 'var(--success)' : '';
    btnVenda.style.color = val === 'Venda' ? '#fff' : '';
    btnPerda.style.background = val === 'Perda' ? 'var(--danger)' : '';
    btnPerda.style.color = val === 'Perda' ? '#fff' : '';
}

function closeLeadModal() {
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('lead-modal').style.display = 'none';
}

function toggleCRMView() {
    const kanban = document.getElementById('kanban-view');
    const table = document.getElementById('table-view');
    if (kanban.style.display === 'none') {
        kanban.style.display = 'flex';
        table.style.display = 'none';
    } else {
        kanban.style.display = 'none';
        table.style.display = 'block';
    }
}

// ================================================================================= //
//                                   CALCULADORA                                     //
// ================================================================================= //

function addItem() {
    const id = Date.now();
    items.push({ id, nome: "", qtd: 1, setup: 0, grav: 0, arte: 0, mat: 0 });
    renderItems();
}

function renderItems() {
    const list = document.getElementById('items-list');
    list.innerHTML = "";
    items.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'item-block';
        div.style.background = 'rgba(255,255,255,0.02)';
        div.style.padding = '15px';
        div.style.borderRadius = '10px';
        div.style.marginBottom = '15px';
        div.style.border = '1px solid var(--border-color)';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <strong style="font-size:0.8rem; color:var(--neon)">ITEM #${idx + 1}</strong>
                <span onclick="removeItem(${item.id})" style="color:var(--danger); cursor:pointer; font-size:0.7rem; font-weight:800;">REMOVER</span>
            </div>
            <div class="field-group">
                <input type="text" value="${item.nome}" oninput="updateItem(${item.id}, 'nome', this.value)" placeholder="Descrição do Item">
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
                <div class="field-group"><label>Qtd</label><input type="number" value="${item.qtd}" oninput="updateItem(${item.id}, 'qtd', this.value)"></div>
                <div class="field-group"><label>Material (R$)</label><input type="number" value="${item.mat}" oninput="updateItem(${item.id}, 'mat', this.value)"></div>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; margin-top:10px;">
                <div class="field-group"><label>Arte</label><input type="number" value="${item.arte}" oninput="updateItem(${item.id}, 'arte', this.value)"></div>
                <div class="field-group"><label>Setup</label><input type="number" value="${item.setup}" oninput="updateItem(${item.id}, 'setup', this.value)"></div>
                <div class="field-group"><label>Laser</label><input type="number" value="${item.grav}" oninput="updateItem(${item.id}, 'grav', this.value)"></div>
            </div>
        `;
        list.appendChild(div);
    });
    calc();
}

function updateItem(id, field, val) {
    const item = items.find(i => i.id === id);
    if (item) {
        item[field] = field === 'nome' ? val : parseFloat(val) || 0;
        calc();
    }
}

function removeItem(id) {
    items = items.filter(i => i.id !== id);
    renderItems();
}

function calc() {
    const valorHora = parseFloat(document.getElementById('g_valor_hora').value) || 0;
    const impostoPorc = (parseFloat(document.getElementById('g_imposto').value) || 0) / 100;
    const taxaCartao = (parseFloat(document.getElementById('g_cartao').value) || 0) / 100;
    const freteInsumos = parseFloat(document.getElementById('g_frete').value) || 0;
    const freteCliente = parseFloat(document.getElementById('g_frete_cliente').value) || 0;
    const descontoPorc = (parseFloat(document.getElementById('g_desconto').value) || 0) / 100;

    const valorMinuto = valorHora / 60;
    let totalBruto = 0;
    let lucroTotal = 0;
    
    const cardBody = document.getElementById('card-body');
    cardBody.innerHTML = "";

    items.forEach(item => {
        const tempoTotal = item.arte + item.setup + item.grav;
        const custoTempo = tempoTotal * valorMinuto;
        const custoTotalItem = (custoTempo + item.mat) * item.qtd;
        
        const precoVendaBase = custoTotalItem * 2;
        totalBruto += precoVendaBase;
        lucroTotal += (precoVendaBase - custoTotalItem);

        const row = document.createElement('tr');
        row.innerHTML = `<td>${item.qtd}x</td><td>${item.nome || 'Item sem nome'}</td><td>${formatBRL(precoVendaBase)}</td>`;
        cardBody.appendChild(row);
    });

    let totalFinal = (totalBruto + freteCliente) * (1 - descontoPorc);
    totalFinal = totalFinal / (1 - impostoPorc - taxaCartao);

    document.getElementById('card_total').innerText = formatBRL(totalFinal);
    document.getElementById('display_nome_cliente').innerText = document.getElementById('g_cliente').value || "Não informado";
    const dataProp = document.getElementById('g_data_proposta').value;
    document.getElementById('display_data_proposta').innerText = dataProp ? new Date(dataProp + 'T00:00:00').toLocaleDateString('pt-BR') : "";

    window.lastCalcLucro = lucroTotal;
    window.lastCalcTotal = totalFinal;
}

function sendToCRM() {
    const nome = document.getElementById('g_cliente').value;
    if (!nome) { alert("Informe o nome do cliente na calculadora!"); return; }
    
    const newLead = {
        id: Date.now().toString(),
        cliente: nome,
        empresa: "",
        status: 0,
        origem: "WhatsApp",
        entrega: document.getElementById('g_data_proposta').value,
        valor: window.lastCalcTotal || 0,
        lucro: window.lastCalcLucro || 0,
        resultado: "Venda"
    };
    leads.push(newLead);
    renderCRM();
    alert("Orçamento salvo no CRM com sucesso!");
    showSection('crm');
}

function copyWA() {
    const total = document.getElementById('card_total').innerText;
    const cliente = document.getElementById('g_cliente').value;
    let msg = `Olá ${cliente}! Segue o orçamento da Santo Laser:\n\n`;
    items.forEach(i => msg += `- ${i.qtd}x ${i.nome}\n`);
    msg += `\n*Valor Total: ${total}*\n\nAguardamos seu retorno!`;
    navigator.clipboard.writeText(msg).then(() => alert("Texto copiado para o WhatsApp!"));
}

// ================================================================================= //
//                                 FLUXO DE CAIXA                                    //
// ================================================================================= //

function renderFinance() {
    const body = document.getElementById('finance-table-body');
    if (!body) return;
    body.innerHTML = "";

    const start = document.getElementById('filter-start').value;
    const end = document.getElementById('filter-end').value;
    const type = document.getElementById('filter-type').value;
    const catFilter = document.getElementById('filter-cat').value;

    const autoTransactions = leads.filter(l => l.status == 4 && l.resultado === 'Venda').map(l => ({
        id: `auto-${l.id}`,
        data: l.entrega || new Date().toISOString().split('T')[0],
        desc: `VENDA: ${l.cliente}`,
        tipo: 'Entrada',
        cat: 'Vendas CRM',
        valor: parseFloat(l.valor)
    }));

    const allTransactions = [...transactions, ...autoTransactions].sort((a, b) => new Date(b.data) - new Date(a.data));

    let entradas = 0;
    let saidas = 0;

    allTransactions.forEach(t => {
        if (start && t.data < start) return;
        if (end && t.data > end) return;
        if (type && t.tipo !== type) return;
        if (catFilter && t.cat !== catFilter) return;

        if (t.tipo === 'Entrada') entradas += t.valor;
        else saidas += t.valor;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${new Date(t.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
            <td>${t.desc}</td>
            <td><span class="tag" style="color:${t.tipo === 'Entrada' ? 'var(--success)' : 'var(--danger)'}">${t.tipo.toUpperCase()}</span></td>
            <td>${t.cat}</td>
            <td>${formatBRL(t.valor)}</td>
            <td>
                ${t.id.toString().startsWith('auto') ? '' : `
                    <button class="btn-modern btn-danger" onclick="deleteTransaction(${t.id})"><i class="fa-solid fa-trash"></i></button>
                `}
            </td>
        `;
        body.appendChild(row);
    });

    document.getElementById('fin-entradas').innerText = formatBRL(entradas);
    document.getElementById('fin-saidas').innerText = formatBRL(saidas);
    document.getElementById('fin-saldo').innerText = formatBRL(initialBalance + entradas - saidas);
    
    localStorage.setItem('santo_transactions', JSON.stringify(transactions));
}

function openFinanceModal(tipo) {
    document.getElementById('f_tipo').value = tipo;
    document.getElementById('fin-modal-title').innerText = `NOVA ${tipo.toUpperCase()}`;
    document.getElementById('f_desc').value = "";
    document.getElementById('f_valor').value = "";
    document.getElementById('f_data').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('finance-modal').style.display = 'block';
}

function saveTransaction() {
    const t = {
        id: Date.now(),
        desc: document.getElementById('f_desc').value,
        valor: parseFloat(document.getElementById('f_valor').value) || 0,
        cat: document.getElementById('f_cat_select').value,
        data: document.getElementById('f_data').value,
        tipo: document.getElementById('f_tipo').value
    };
    if (!t.desc || !t.valor) return;
    transactions.push(t);
    renderFinance();
    closeAllModals();
}

function deleteTransaction(id) {
    if (confirm("Excluir transação?")) {
        transactions = transactions.filter(t => t.id !== id);
        renderFinance();
    }
}

function openInitialBalanceModal() {
    const val = prompt("Informe o saldo inicial em conta:", initialBalance);
    if (val !== null) {
        initialBalance = parseFloat(val) || 0;
        localStorage.setItem('santo_initial_balance', initialBalance);
        renderFinance();
    }
}

function clearFinanceFilters() {
    document.getElementById('filter-start').value = "";
    document.getElementById('filter-end').value = "";
    document.getElementById('filter-type').value = "";
    document.getElementById('filter-cat').value = "";
    renderFinance();
}

// ================================================================================= //
//                               SIMULADOR DE METAS                                  //
// ================================================================================= //

function runSimulator() {
    const metaLucro = (parseFloat(document.getElementById('sim-prolabore').value) || 0) +
                      (parseFloat(document.getElementById('sim-fixos').value) || 0) +
                      (parseFloat(document.getElementById('sim-marketing').value) || 0) +
                      (parseFloat(document.getElementById('sim-reserva').value) || 0);
    
    document.getElementById('sim-meta-total').innerText = formatBRL(metaLucro);

    const tableBody = document.getElementById('sim-table-body');
    tableBody.innerHTML = "";

    simItems.forEach(item => {
        const margemValor = item.preco * (item.margem / 100);
        const vendasNecessarias = margemValor > 0 ? Math.ceil(metaLucro / margemValor) : 0;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="text" value="${item.nome}" onchange="updateSimItem(${item.id}, 'nome', this.value)" style="background:transparent; border:none; color:inherit;"></td>
            <td><input type="number" value="${item.preco}" onchange="updateSimItem(${item.id}, 'preco', this.value)" style="background:transparent; border:none; color:inherit; width:100px;"></td>
            <td><input type="number" value="${item.margem}" onchange="updateSimItem(${item.id}, 'margem', this.value)" style="background:transparent; border:none; color:inherit; width:60px;">%</td>
            <td><input type="number" value="${item.atual}" onchange="updateSimItem(${item.id}, 'atual', this.value)" style="background:transparent; border:none; color:inherit; width:60px;"></td>
            <td><strong>${vendasNecessarias}</strong></td>
            <td><button class="btn-modern btn-danger" onclick="removeSimItem(${item.id})"><i class="fa-solid fa-trash"></i></button></td>
        `;
        tableBody.appendChild(row);
    });
    localStorage.setItem('santo_sim_items', JSON.stringify(simItems));
}

function addSimItem() {
    simItems.push({ id: Date.now(), nome: "", preco: 0, margem: 0, atual: 0 });
    runSimulator();
}

function updateSimItem(id, field, val) {
    const item = simItems.find(i => i.id === id);
    if (item) {
        item[field] = field === 'nome' ? val : parseFloat(val) || 0;
        runSimulator();
    }
}

function removeSimItem(id) {
    simItems = simItems.filter(i => i.id !== id);
    runSimulator();
}

// ================================================================================= //
//                                     ESTOQUE                                       //
// ================================================================================= //

function renderStock() {
    const body = document.getElementById('stock-table-body');
    if (!body) return;
    body.innerHTML = "";
    
    stockItems.forEach(item => {
        const row = document.createElement('tr');
        const lowStock = item.qtd <= item.min;
        row.innerHTML = `
            <td><strong>${item.nome}</strong></td>
            <td>${item.cat}</td>
            <td style="color: ${lowStock ? 'var(--danger)' : 'inherit'}">${item.qtd} ${lowStock ? '<i class="fa-solid fa-triangle-exclamation"></i>' : ''}</td>
            <td>${item.min}</td>
            <td>${formatBRL(item.valor)}</td>
            <td>${formatBRL(item.qtd * item.valor)}</td>
            <td>
                <button class="btn-modern" onclick="editStockItem(${item.id})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-modern btn-danger" onclick="removeStockItem(${item.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        body.appendChild(row);
    });
    localStorage.setItem('santo_stock_items', JSON.stringify(stockItems));
}

function openStockModal() {
    document.getElementById('s_item_id').value = "";
    document.getElementById('s_nome').value = "";
    document.getElementById('s_cat').value = "";
    document.getElementById('s_valor').value = "";
    document.getElementById('s_qtd').value = "";
    document.getElementById('s_min').value = "";
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('stock-modal').style.display = 'block';
}

function editStockItem(id) {
    const item = stockItems.find(i => i.id == id);
    if (!item) return;
    document.getElementById('s_item_id').value = item.id;
    document.getElementById('s_nome').value = item.nome;
    document.getElementById('s_cat').value = item.cat;
    document.getElementById('s_valor').value = item.valor;
    document.getElementById('s_qtd').value = item.qtd;
    document.getElementById('s_min').value = item.min;
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('stock-modal').style.display = 'block';
}

function saveStockItem() {
    const id = document.getElementById('s_item_id').value;
    const item = {
        id: id || Date.now(),
        nome: document.getElementById('s_nome').value,
        cat: document.getElementById('s_cat').value,
        valor: parseFloat(document.getElementById('s_valor').value) || 0,
        qtd: parseFloat(document.getElementById('s_qtd').value) || 0,
        min: parseFloat(document.getElementById('s_min').value) || 0
    };
    if (id) {
        const idx = stockItems.findIndex(i => i.id == id);
        stockItems[idx] = item;
    } else {
        stockItems.push(item);
    }
    renderStock();
    closeAllModals();
}

function removeStockItem(id) {
    if (confirm("Excluir item do estoque?")) {
        stockItems = stockItems.filter(i => i.id != id);
        renderStock();
    }
}

function closeStockModal() { closeAllModals(); }
function closeFinanceModal() { closeAllModals(); }
