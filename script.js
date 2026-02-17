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
let items = []; 

// ================================================================================= //
//                                 INICIALIZAÇÃO                                     //
// ================================================================================= //

document.addEventListener('DOMContentLoaded', () => {
    // Carregar Logo com Base64 garantido
    fetch('logo_base64.txt').then(r => r.text()).then(base64 => {
        if (base64) {
            const fullBase64 = "data:image/jpeg;base64," + base64;
            document.getElementById('main-logo-img').src = fullBase64;
            document.getElementById('quote-logo-img').src = fullBase64;
        }
    }).catch(() => {
        document.getElementById('main-logo-img').src = "https://via.placeholder.com/150?text=SANTO+LASER";
    });

    const now = new Date();
    const monthStr = now.toISOString().slice(0, 7);
    document.getElementById('dash-month-filter').value = monthStr;
    document.getElementById('dre-month-filter').value = monthStr;

    applySettings();
    updateDashboard();
    addItem(); 
});

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
    
    const target = document.getElementById(`${sectionId}-content`);
    if (target) target.classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(n => {
        if (n.getAttribute('onclick').includes(sectionId)) n.classList.add('active');
    });
    
    if (sectionId === 'dashboard') updateDashboard();
    if (sectionId === 'crm') renderCRM();
    if (sectionId === 'cashflow') renderFinance();
    if (sectionId === 'dre') renderDRE();
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
    
    updateDashboard();
}

// ================================================================================= //
//                                     DRE LOGIC                                     //
// ================================================================================= //

function renderDRE() {
    const monthFilter = document.getElementById('dre-month-filter').value;
    const [year, month] = monthFilter.split('-').map(Number);

    // Filtrar leads vendidos e pagos no mês
    const monthLeads = leads.filter(l => {
        if (l.status != 4 || l.resultado !== 'Venda' || !l.entrega) return false;
        const d = new Date(l.entrega + 'T00:00:00');
        return d.getMonth() === (month - 1) && d.getFullYear() === year;
    });

    const receitaBruta = monthLeads.reduce((acc, l) => acc + l.valor, 0);
    const cpv = monthLeads.reduce((acc, l) => acc + (l.valor - l.lucro), 0);
    
    // Estimativa de impostos baseada nos leads
    const impostos = monthLeads.reduce((acc, l) => acc + (l.valor * 0.11), 0); // Exemplo: 6% imposto + 5% taxa

    // Despesas Operacionais do Fluxo de Caixa (Saídas fixas)
    const despesas = transactions.filter(t => {
        if (t.tipo !== 'Saída') return false;
        const d = new Date(t.data + 'T00:00:00');
        return d.getMonth() === (month - 1) && d.getFullYear() === year;
    }).reduce((acc, t) => acc + t.valor, 0);

    const receitaLiquida = receitaBruta - impostos;
    const lucroBruto = receitaLiquida - cpv;
    const resultadoLiquido = lucroBruto - despesas;

    const setVal = (id, val) => document.getElementById(id).innerText = formatBRL(val);
    const setPerc = (id, val, base) => {
        const p = base > 0 ? ((val / base) * 100).toFixed(1) : 0;
        document.getElementById(id).innerText = `${p}%`;
    };

    setVal('dre-receita-bruta', receitaBruta);
    setVal('dre-impostos', impostos);
    setPerc('dre-impostos-p', impostos, receitaBruta);
    
    setVal('dre-receita-liquida', receitaLiquida);
    setPerc('dre-receita-liquida-p', receitaLiquida, receitaBruta);
    
    setVal('dre-cpv', cpv);
    setPerc('dre-cpv-p', cpv, receitaBruta);
    
    setVal('dre-lucro-bruto', lucroBruto);
    setPerc('dre-lucro-bruto-p', lucroBruto, receitaBruta);
    
    setVal('dre-despesas', despesas);
    setPerc('dre-despesas-p', despesas, receitaBruta);
    
    setVal('dre-resultado', resultadoLiquido);
    setPerc('dre-resultado-p', resultadoLiquido, receitaBruta);
    
    document.getElementById('dre-resultado').style.color = resultadoLiquido >= 0 ? 'var(--neon)' : 'var(--danger)';
    
    return { receitaBruta, resultadoLiquido, lucroBruto, despesas };
}

// ================================================================================= //
//                                     DASHBOARD                                     //
// ================================================================================= //

function updateDashboard() {
    const dreData = renderDRE();
    const monthFilter = document.getElementById('dash-month-filter').value;
    const [year, month] = monthFilter.split('-').map(Number);

    document.getElementById('dash-faturamento').innerText = formatBRL(dreData.receitaBruta);
    const margem = dreData.receitaBruta > 0 ? ((dreData.resultadoLiquido / dreData.receitaBruta) * 100).toFixed(1) : 0;
    document.getElementById('dash-margem').innerText = `${margem}%`;
    
    // Ponto de Equilíbrio = Custos Fixos / Margem de Contribuição
    const fixedCosts = dreData.despesas;
    const contributionMargin = dreData.receitaBruta > 0 ? (dreData.lucroBruto / dreData.receitaBruta) : 0;
    const breakeven = contributionMargin > 0 ? fixedCosts / contributionMargin : 0;
    document.getElementById('dash-breakeven').innerText = formatBRL(breakeven);

    const activePedidos = leads.filter(l => (l.status == 1 || l.status == 2) && l.resultado !== 'Perda').length;
    document.getElementById('dash-pedidos').innerText = activePedidos;

    renderCharts(year, month);
    renderTimeline();
}

function renderCharts(year, month) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? '#2d333f' : '#e2e8f0';

    // 1. Performance Financeira (DRE)
    const ctxPerf = document.getElementById('chart-performance');
    if (ctxPerf) {
        if (window.myChartPerf) window.myChartPerf.destroy();
        const dre = renderDRE();
        window.myChartPerf = new Chart(ctxPerf, {
            type: 'bar',
            data: {
                labels: ['Receita', 'Custos', 'Despesas', 'Lucro'],
                datasets: [{
                    data: [dre.receitaBruta, (dre.receitaBruta - dre.lucroBruto), dre.despesas, dre.resultadoLiquido],
                    backgroundColor: ['#00e6cb', '#ff1744', '#ffea00', '#2979ff']
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { y: { grid: { color: gridColor }, ticks: { color: textColor } }, x: { grid: { display: false }, ticks: { color: textColor } } },
                plugins: { legend: { display: false } }
            }
        });
    }

    // 2. Origem de Clientes Lucrativos
    const ctxOrigem = document.getElementById('chart-origem');
    if (ctxOrigem) {
        if (window.myChartOrigem) window.myChartOrigem.destroy();
        const origens = {};
        leads.filter(l => l.status == 4 && l.resultado === 'Venda').forEach(l => {
            origens[l.origem] = (origens[l.origem] || 0) + l.lucro;
        });
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
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: textColor } } } }
        });
    }
}

function renderTimeline() {
    const container = document.getElementById('timeline-wrapper');
    if (!container) return;
    container.innerHTML = "";
    const activeLeads = leads.filter(l => (l.status == 1 || l.status == 2) && l.entrega && l.resultado !== 'Perda');
    if (activeLeads.length === 0) {
        container.innerHTML = "<p style='text-align:center; padding:30px; color:var(--text-secondary)'>Sem projetos em produção.</p>";
        return;
    }
    activeLeads.sort((a, b) => new Date(a.entrega) - new Date(b.entrega));
    activeLeads.forEach(l => {
        const row = document.createElement('div');
        row.className = 'timeline-row';
        const entrega = new Date(l.entrega + 'T00:00:00');
        const hoje = new Date();
        const diffDays = Math.ceil((entrega - hoje) / (1000 * 60 * 60 * 24));
        const barWidth = Math.max(diffDays * 30, 80);
        row.innerHTML = `
            <div class="timeline-client">${l.cliente}</div>
            <div class="timeline-track">
                <div class="timeline-bar" style="width: ${Math.min(barWidth, 400)}px; background: ${diffDays < 0 ? 'var(--danger)' : 'var(--neon)'}">
                    ${diffDays < 0 ? 'ATRASADO' : `FALTAM ${diffDays}D`}
                </div>
            </div>
            <div style="width:100px; text-align:right; font-size:0.75rem;">${entrega.toLocaleDateString('pt-BR')}</div>
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
            card.ondragstart = (e) => { e.dataTransfer.setData("text", lead.id); };
            card.onclick = () => editLead(lead.id);
            card.innerHTML = `
                <div style="font-weight:700; margin-bottom:6px; font-size:0.85rem;">${lead.cliente}</div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="color:var(--neon); font-weight:800; font-size:0.8rem;">${formatBRL(lead.valor)}</span>
                    <span style="font-size:0.65rem; opacity:0.6;">${lead.entrega ? new Date(lead.entrega + 'T00:00:00').toLocaleDateString('pt-BR') : ''}</span>
                </div>
            `;
            column.appendChild(card);

            if (tableBody) {
                const row = document.createElement('tr');
                row.innerHTML = `<td>${lead.cliente}</td><td>${lead.empresa || '-'}</td><td>${settings.steps[lead.status]}</td><td>${formatBRL(lead.valor)}</td><td>${lead.entrega || '-'}</td><td><button class="btn-modern" onclick="editLead('${lead.id}')">EDITAR</button></td>`;
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
    if (lead) { lead.status = newStatus; renderCRM(); updateDashboard(); }
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
    document.getElementById('btn-delete-lead').style.display = 'block';
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
    if (!leadData.cliente) return;
    if (id) { const idx = leads.findIndex(l => l.id == id); leads[idx] = leadData; }
    else { leads.push(leadData); }
    renderCRM(); updateDashboard(); closeLeadModal();
}

function deleteLead() {
    const id = document.getElementById('m_lead_id').value;
    if (id && confirm("Excluir lead permanentemente?")) { leads = leads.filter(l => l.id != id); renderCRM(); updateDashboard(); closeLeadModal(); }
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
    btnPerda.style.background = val === 'Perda' ? 'var(--danger)' : '';
}

function closeLeadModal() { closeAllModals(); }
function toggleCRMView() {
    const kanban = document.getElementById('kanban-view');
    const table = document.getElementById('table-view');
    if (kanban.style.display === 'none') { kanban.style.display = 'flex'; table.style.display = 'none'; }
    else { kanban.style.display = 'none'; table.style.display = 'block'; }
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
        div.style.background = 'rgba(255,255,255,0.03)';
        div.style.padding = '12px';
        div.style.borderRadius = '8px';
        div.style.marginBottom = '12px';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><strong style="font-size:0.65rem; color:var(--neon)">ITEM #${idx+1}</strong><span onclick="removeItem(${item.id})" style="color:var(--danger); cursor:pointer; font-size:0.6rem; font-weight:800;">REMOVER</span></div>
            <div class="field-group"><input type="text" value="${item.nome}" oninput="updateItem(${item.id}, 'nome', this.value)" placeholder="Descrição do Produto"></div>
            <div class="field-row">
                <div class="field-group"><label>Qtd</label><input type="number" value="${item.qtd}" oninput="updateItem(${item.id}, 'qtd', this.value)"></div>
                <div class="field-group"><label>Mat. (R$)</label><input type="number" value="${item.mat}" oninput="updateItem(${item.id}, 'mat', this.value)"></div>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px;">
                <div class="field-group"><label>Arte (m)</label><input type="number" value="${item.arte}" oninput="updateItem(${item.id}, 'arte', this.value)"></div>
                <div class="field-group"><label>Setup (m)</label><input type="number" value="${item.setup}" oninput="updateItem(${item.id}, 'setup', this.value)"></div>
                <div class="field-group"><label>Laser (m)</label><input type="number" value="${item.grav}" oninput="updateItem(${item.id}, 'grav', this.value)"></div>
            </div>
        `;
        list.appendChild(div);
    });
    calc();
}

function updateItem(id, field, val) {
    const item = items.find(i => i.id === id);
    if (item) { item[field] = field === 'nome' ? val : parseFloat(val) || 0; calc(); }
}

function removeItem(id) { items = items.filter(i => i.id !== id); renderItems(); }

function calc() {
    const vHora = parseFloat(document.getElementById('g_valor_hora').value) || 0;
    const imp = (parseFloat(document.getElementById('g_imposto').value) || 0) / 100;
    const taxa = (parseFloat(document.getElementById('g_cartao').value) || 0) / 100;
    const fCli = parseFloat(document.getElementById('g_frete_cliente').value) || 0;
    const desc = (parseFloat(document.getElementById('g_desconto').value) || 0) / 100;

    const vMin = vHora / 60;
    let totalBruto = 0;
    let lucroTotal = 0;
    const body = document.getElementById('card-body');
    body.innerHTML = "";

    items.forEach(item => {
        const custoTotalItem = ((item.arte + item.setup + item.grav) * vMin + item.mat) * item.qtd;
        const precoVenda = custoTotalItem * 2.5; // Margem base
        totalBruto += precoVenda;
        lucroTotal += (precoVenda - custoTotalItem);
        const row = document.createElement('tr');
        row.innerHTML = `<td>${item.qtd}x</td><td>${item.nome || 'Item'}</td><td>${formatBRL(precoVenda)}</td>`;
        body.appendChild(row);
    });

    let totalFinal = (totalBruto + fCli) * (1 - desc);
    totalFinal = totalFinal / (1 - imp - taxa);

    document.getElementById('card_total').innerText = formatBRL(totalFinal);
    document.getElementById('display_nome_cliente').innerText = document.getElementById('g_cliente').value || "Cliente não informado";
    const data = document.getElementById('g_data_proposta').value;
    document.getElementById('display_data_proposta').innerText = data ? new Date(data + 'T00:00:00').toLocaleDateString('pt-BR') : "";

    window.lastCalcLucro = lucroTotal;
    window.lastCalcTotal = totalFinal;
}

function sendToCRM() {
    const nome = document.getElementById('g_cliente').value;
    if (!nome) { alert("Informe o nome do cliente!"); return; }
    leads.push({ id: Date.now().toString(), cliente: nome, empresa: "", status: 0, origem: "WhatsApp", entrega: document.getElementById('g_data_proposta').value, valor: window.lastCalcTotal || 0, lucro: window.lastCalcLucro || 0, resultado: "Venda" });
    renderCRM(); alert("Lead criado com sucesso!"); showSection('crm');
}

function copyWA() {
    const total = document.getElementById('card_total').innerText;
    const cliente = document.getElementById('g_cliente').value;
    let msg = `Olá ${cliente}! Segue orçamento da Santo Laser:\n\n`;
    items.forEach(i => msg += `• ${i.qtd}x ${i.nome}\n`);
    msg += `\n*Total Final: ${total}*\n\nQualquer dúvida, estou à disposição!`;
    navigator.clipboard.writeText(msg).then(() => alert("Mensagem copiada!"));
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
    const catF = document.getElementById('filter-cat').value;

    const auto = leads.filter(l => l.status == 4 && l.resultado === 'Venda').map(l => ({ id: `a-${l.id}`, data: l.entrega || new Date().toISOString().split('T')[0], desc: `VENDA: ${l.cliente}`, tipo: 'Entrada', cat: 'Vendas CRM', valor: parseFloat(l.valor) }));
    const all = [...transactions, ...auto].sort((a, b) => new Date(b.data) - new Date(a.data));

    let e = 0, s = 0;
    all.forEach(t => {
        if (start && t.data < start) return;
        if (end && t.data > end) return;
        if (type && t.tipo !== type) return;
        if (catF && t.cat !== catF) return;
        if (t.tipo === 'Entrada') e += t.valor; else s += t.valor;
        const row = document.createElement('tr');
        row.innerHTML = `<td>${new Date(t.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td><td>${t.desc}</td><td><span style="color:${t.tipo==='Entrada'?'var(--success)':'var(--danger)'}">${t.tipo}</span></td><td>${t.cat}</td><td>${formatBRL(t.valor)}</td><td>${t.id.toString().startsWith('a')?'':`<button class="btn-modern btn-danger" onclick="deleteTransaction(${t.id})"><i class="fa-solid fa-trash"></i></button>`}</td>`;
        body.appendChild(row);
    });
    document.getElementById('fin-entradas').innerText = formatBRL(e);
    document.getElementById('fin-saidas').innerText = formatBRL(s);
    document.getElementById('fin-saldo').innerText = formatBRL(initialBalance + e - s);
    localStorage.setItem('santo_transactions', JSON.stringify(transactions));
}

function openFinanceModal(tipo) {
    document.getElementById('f_tipo').value = tipo;
    document.getElementById('fin-modal-title').innerText = `NOVA ${tipo.toUpperCase()}`;
    document.getElementById('f_desc').value = ""; document.getElementById('f_valor').value = "";
    document.getElementById('f_data').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('finance-modal').style.display = 'block';
}

function saveTransaction() {
    const t = { id: Date.now(), desc: document.getElementById('f_desc').value, valor: parseFloat(document.getElementById('f_valor').value) || 0, cat: document.getElementById('f_cat_select').value, data: document.getElementById('f_data').value, tipo: document.getElementById('f_tipo').value };
    if (!t.desc || !t.valor) return;
    transactions.push(t); renderFinance(); closeAllModals();
}

function deleteTransaction(id) { if (confirm("Excluir lançamento?")) { transactions = transactions.filter(t => t.id !== id); renderFinance(); } }
function openInitialBalanceModal() { const val = prompt("Informe o saldo inicial em conta:", initialBalance); if (val !== null) { initialBalance = parseFloat(val) || 0; localStorage.setItem('santo_initial_balance', initialBalance); renderFinance(); } }
function clearFinanceFilters() { document.getElementById('filter-start').value = ""; document.getElementById('filter-end').value = ""; document.getElementById('filter-type').value = ""; document.getElementById('filter-cat').value = ""; renderFinance(); }

// ================================================================================= //
//                               SIMULADOR DE METAS                                  //
// ================================================================================= //

function runSimulator() {
    const meta = (parseFloat(document.getElementById('sim-prolabore').value) || 0) + (parseFloat(document.getElementById('sim-fixos').value) || 0) + (parseFloat(document.getElementById('sim-marketing').value) || 0) + (parseFloat(document.getElementById('sim-reserva').value) || 0);
    document.getElementById('sim-meta-total').innerText = formatBRL(meta);
    const body = document.getElementById('sim-table-body');
    body.innerHTML = "";
    simItems.forEach(item => {
        const margemV = item.preco * (item.margem / 100);
        const nec = margemV > 0 ? Math.ceil(meta / margemV) : 0;
        const row = document.createElement('tr');
        row.innerHTML = `<td><input type="text" value="${item.nome}" onchange="updateSimItem(${item.id}, 'nome', this.value)" style="background:transparent; border:none; color:inherit; width:100%"></td><td><input type="number" value="${item.preco}" onchange="updateSimItem(${item.id}, 'preco', this.value)" style="background:transparent; border:none; color:inherit; width:100px"></td><td><input type="number" value="${item.margem}" onchange="updateSimItem(${item.id}, 'margem', this.value)" style="background:transparent; border:none; color:inherit; width:60px">%</td><td><input type="number" value="${item.atual}" onchange="updateSimItem(${item.id}, 'atual', this.value)" style="background:transparent; border:none; color:inherit; width:60px"></td><td><strong>${nec}</strong></td><td><button class="btn-modern btn-danger" onclick="removeSimItem(${item.id})"><i class="fa-solid fa-trash"></i></button></td>`;
        body.appendChild(row);
    });
    localStorage.setItem('santo_sim_items', JSON.stringify(simItems));
}

function addSimItem() { simItems.push({ id: Date.now(), nome: "Novo Produto", preco: 0, margem: 0, atual: 0 }); runSimulator(); }
function updateSimItem(id, field, val) { const item = simItems.find(i => i.id === id); if (item) { item[field] = field === 'nome' ? val : parseFloat(val) || 0; runSimulator(); } }
function removeSimItem(id) { simItems = simItems.filter(i => i.id !== id); runSimulator(); }

// ================================================================================= //
//                                     ESTOQUE                                       //
// ================================================================================= //

function renderStock() {
    const body = document.getElementById('stock-table-body');
    if (!body) return; body.innerHTML = "";
    stockItems.forEach(item => {
        const row = document.createElement('tr');
        const low = item.qtd <= item.min;
        row.innerHTML = `<td><strong>${item.nome}</strong></td><td>${item.cat}</td><td style="color:${low?'var(--danger)':'inherit'}">${item.qtd} ${low?'⚠️':''}</td><td>${item.min}</td><td>${formatBRL(item.valor)}</td><td>${formatBRL(item.qtd*item.valor)}</td><td><button class="btn-modern" onclick="editStockItem(${item.id})"><i class="fa-solid fa-pen"></i></button><button class="btn-modern btn-danger" onclick="removeStockItem(${item.id})"><i class="fa-solid fa-trash"></i></button></td>`;
        body.appendChild(row);
    });
    localStorage.setItem('santo_stock_items', JSON.stringify(stockItems));
}

function openStockModal() { document.getElementById('s_item_id').value = ""; document.getElementById('s_nome').value = ""; document.getElementById('s_cat').value = ""; document.getElementById('s_valor').value = ""; document.getElementById('s_qtd').value = ""; document.getElementById('s_min').value = ""; document.getElementById('modal-overlay').style.display = 'flex'; document.getElementById('stock-modal').style.display = 'block'; }
function editStockItem(id) { const item = stockItems.find(i => i.id == id); if (!item) return; document.getElementById('s_item_id').value = item.id; document.getElementById('s_nome').value = item.nome; document.getElementById('s_cat').value = item.cat; document.getElementById('s_valor').value = item.valor; document.getElementById('s_qtd').value = item.qtd; document.getElementById('s_min').value = item.min; document.getElementById('modal-overlay').style.display = 'flex'; document.getElementById('stock-modal').style.display = 'block'; }
function saveStockItem() { const id = document.getElementById('s_item_id').value; const item = { id: id || Date.now(), nome: document.getElementById('s_nome').value, cat: document.getElementById('s_cat').value, valor: parseFloat(document.getElementById('s_valor').value) || 0, qtd: parseFloat(document.getElementById('s_qtd').value) || 0, min: parseFloat(document.getElementById('s_min').value) || 0 }; if (id) { const idx = stockItems.findIndex(i => i.id == id); stockItems[idx] = item; } else { stockItems.push(item); } renderStock(); closeAllModals(); }
function removeStockItem(id) { if (confirm("Excluir item?")) { stockItems = stockItems.filter(i => i.id != id); renderStock(); } }

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
    const labels = settings.simLabels;
    document.getElementById('label-prolabore').innerText = labels[0];
    document.getElementById('label-custos-fixos').innerText = labels[1];
    document.getElementById('label-marketing').innerText = labels[2];
    document.getElementById('label-reserva').innerText = labels[3];

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
    for (let i = 0; i < 5; i++) document.getElementById(`set-step-${i+1}`).value = settings.steps[i];
    for (let i = 0; i < 4; i++) document.getElementById(`set-label-${i+1}`).value = settings.simLabels[i];
    renderSettingsCategories();
}

function renderSettingsCategories() {
    const list = document.getElementById('settings-categories-list');
    list.innerHTML = "";
    settings.categories.forEach((cat, idx) => {
        const div = document.createElement('div');
        div.className = 'cat-item';
        div.innerHTML = `
            <input type="text" value="${cat}" onchange="updateCategory(${idx}, this.value)">
            <button class="btn-modern btn-danger" onclick="removeCategory(${idx})"><i class="fa-solid fa-trash-can"></i></button>
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
    if (confirm("ATENÇÃO: Isso apagará TODOS os dados permanentemente. Continuar?")) {
        localStorage.clear();
        location.reload();
    }
}

// ================================================================================= //
//                                     BACKUP                                        //
// ================================================================================= //

function exportToExcel() {
    let csv = "DATA;DESCRICAO;TIPO;CATEGORIA;VALOR\n";
    const auto = leads.filter(l => l.status == 4 && l.resultado === 'Venda').map(l => ({ data: l.entrega || "", desc: `VENDA: ${l.cliente}`, tipo: 'Entrada', cat: 'Vendas CRM', valor: l.valor }));
    const all = [...transactions, ...auto];
    all.forEach(t => csv += `${t.data};${t.desc};${t.tipo};${t.cat};${t.valor}\n`);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "backup_santo_laser.csv";
    link.click();
}

function closeFinanceModal() { closeAllModals(); }
function closeStockModal() { closeAllModals(); }
function closeLeadModal() { closeAllModals(); }
