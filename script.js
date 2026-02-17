
// ================================================================================= //
//                                 ESTADO GLOBAL                                     //
// ================================================================================= //

let leads = JSON.parse(localStorage.getItem('santo_leads')) || [];
let transactions = JSON.parse(localStorage.getItem('santo_transactions')) || [];
let simItems = JSON.parse(localStorage.getItem('santo_sim_items')) || [];
let stockItems = JSON.parse(localStorage.getItem('santo_stock_items')) || [];
let initialBalance = parseFloat(localStorage.getItem('santo_initial_balance')) || 0;
let items = []; // Itens da calculadora atual

// ================================================================================= //
//                                 INICIALIZAÇÃO                                     //
// ================================================================================= //

document.addEventListener('DOMContentLoaded', () => {
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

function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById(`${sectionId}-content`).classList.add('active');
    document.querySelector(`[onclick="showSection('${sectionId}')"]`).classList.add('active');
}

function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    
    const btn = document.getElementById('theme-toggle');
    btn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i> <span>MODO CLARO</span>' : '<i class="fa-solid fa-moon"></i> <span>MODO ESCURO</span>';
}

// ================================================================================= //
//                                     DASHBOARD                                     //
// ================================================================================= //

function updateDashboard() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Filtra leads pagos (Venda) no mês atual
    const paidLeadsMonth = leads.filter(l => {
        if (l.status !== 'Pago' || !l.entrega || l.resultado === 'Perda') return false;
        const d = new Date(l.entrega + 'T00:00:00');
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const faturamento = paidLeadsMonth.reduce((acc, l) => acc + parseFloat(l.valor || 0), 0);
    const lucro = paidLeadsMonth.reduce((acc, l) => acc + parseFloat(l.lucro || 0), 0);
    
    // Pedidos Ativos: Aprovado ou Produção
    const pedidosAtivos = leads.filter(l => l.status === 'Aprovado' || l.status === 'Produção').length;
    
    const totalFinalizados = leads.filter(l => l.status === 'Pago' || l.resultado === 'Perda').length;
    const totalVendas = leads.filter(l => l.status === 'Pago' && l.resultado !== 'Perda').length;
    const conversao = totalFinalizados > 0 ? (totalVendas / totalFinalizados * 100).toFixed(1) : 0;

    document.getElementById('dash-faturamento').innerText = `R$ ${faturamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    document.getElementById('dash-lucro').innerText = `R$ ${lucro.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    document.getElementById('dash-pedidos').innerText = pedidosAtivos;
    document.getElementById('dash-conversao').innerText = `${conversao}%`;
    
    renderCharts();
}

function renderCharts() {
    const ctxOrigem = document.getElementById('chart-origem');
    if (!ctxOrigem) return;
    
    // Simples placeholder para gráfico real se Chart.js estiver carregado
    if (window.Chart) {
        if (window.myChartOrigem) window.myChartOrigem.destroy();
        const origens = {};
        leads.forEach(l => origens[l.origem] = (origens[l.origem] || 0) + 1);
        
        window.myChartOrigem = new Chart(ctxOrigem, {
            type: 'doughnut',
            data: {
                labels: Object.keys(origens),
                datasets: [{
                    data: Object.values(origens),
                    backgroundColor: ['#00e6cb', '#ff1744', '#ffea00', '#00c853', '#2979ff']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

// ================================================================================= //
//                                        CRM                                        //
// ================================================================================= //

function renderCRM() {
    const statuses = ["Proposta Enviada", "Aprovado", "Produção", "Finalizado", "Pago"];
    const tableBody = document.getElementById('crm-table-body');
    if (tableBody) tableBody.innerHTML = "";

    statuses.forEach(status => {
        // Correção do ID da coluna (removendo acentos e espaços)
        const columnId = `cards-${status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-')}`;
        const countId = `count-${status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-')}`;
        
        const column = document.getElementById(columnId);
        const countEl = document.getElementById(countId);
        
        if (!column) return;
        column.innerHTML = "";
        
        // Filtra leads ativos (não excluídos e não perda, a menos que seja a visão de perda)
        const filteredLeads = leads.filter(l => l.status === status && l.resultado !== 'Perda' && !l.excluido);
        if (countEl) countEl.innerText = filteredLeads.length;

        filteredLeads.forEach(lead => {
            const card = document.createElement('div');
            card.className = 'kanban-card';
            card.draggable = true;
            card.id = `lead-${lead.id}`;
            card.ondragstart = (e) => {
                e.dataTransfer.setData("text", lead.id);
                card.style.opacity = '0.5';
            };
            card.ondragend = () => card.style.opacity = '1';
            card.onclick = (e) => {
                e.stopPropagation();
                editLead(lead.id);
            };
            
            card.innerHTML = `
                <div class="card-title">${lead.cliente}</div>
                ${lead.empresa ? `<div class="card-company">${lead.empresa}</div>` : ''}
                <div class="card-meta">
                    <span class="tag price">R$ ${parseFloat(lead.valor || 0).toFixed(2)}</span>
                    ${lead.entrega ? `<span class="tag date">${new Date(lead.entrega + 'T00:00:00').toLocaleDateString('pt-BR')}</span>` : ''}
                </div>
            `;
            column.appendChild(card);

            // Table Row
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${lead.cliente}</strong></td>
                <td>${lead.empresa || '-'}</td>
                <td><span class="tag">${lead.status}</span></td>
                <td>R$ ${parseFloat(lead.valor || 0).toFixed(2)}</td>
                <td>${lead.entrega ? new Date(lead.entrega + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                <td>${lead.tipo}</td>
                <td><button class="btn-modern" onclick="editLead('${lead.id}')"><i class="fa-solid fa-pen"></i></button></td>
            `;
            tableBody.appendChild(row);
        });
    });
    localStorage.setItem('santo_leads', JSON.stringify(leads));
    updateDashboard();
}

function allowDrop(ev) { ev.preventDefault(); }
function drop(ev, status) {
    ev.preventDefault();
    const id = ev.dataTransfer.getData("text");
    const lead = leads.find(l => l.id == id);
    if (lead) {
        lead.status = status;
        renderCRM();
        renderFinance();
    }
}

function openLeadModal() {
    document.getElementById('lead-modal-title').innerText = "NOVO CLIENTE";
    document.getElementById('m_lead_id').value = "";
    document.getElementById('m_cliente').value = "";
    document.getElementById('m_empresa').value = "";
    document.getElementById('m_status').value = "Proposta Enviada";
    document.getElementById('m_origem').value = "WhatsApp";
    document.getElementById('m_tipo').value = "Produto";
    document.getElementById('m_entrega').value = "";
    document.getElementById('m_valor').value = "";
    document.getElementById('m_lucro').value = "";
    document.getElementById('m_resultado').value = "";
    updateResultButtons("");
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('lead-modal').style.display = 'block';
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
    btnVenda.classList.remove('active-venda');
    btnPerda.classList.remove('active-perda');
    if (val === 'Venda') btnVenda.classList.add('active-venda');
    if (val === 'Perda') btnPerda.classList.add('active-perda');
}

function deleteLead() {
    const id = document.getElementById('m_lead_id').value;
    if (!id) return;
    if (confirm("Deseja realmente excluir este lead?")) {
        leads = leads.filter(l => l.id != id);
        renderCRM();
        closeLeadModal();
    }
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
    document.getElementById('m_tipo').value = lead.tipo;
    document.getElementById('m_entrega').value = lead.entrega || "";
    document.getElementById('m_valor').value = lead.valor || "";
    document.getElementById('m_lucro').value = lead.lucro || "";
    document.getElementById('m_resultado').value = lead.resultado || "";
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
        status: document.getElementById('m_status').value,
        origem: document.getElementById('m_origem').value,
        tipo: document.getElementById('m_tipo').value,
        entrega: document.getElementById('m_entrega').value,
        valor: document.getElementById('m_valor').value,
        lucro: document.getElementById('m_lucro').value,
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
    renderFinance();
    closeLeadModal();
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
//                                 FLUXO DE CAIXA                                    //
// ================================================================================= //

function openFinanceModal(tipo) {
    document.getElementById('f_tipo').value = tipo;
    document.getElementById('finance-modal-title').innerText = tipo === 'entrada' ? 'ADICIONAR ENTRADA' : 'ADICIONAR SAÍDA';
    document.getElementById('f_desc').value = "";
    document.getElementById('f_valor').value = "";
    document.getElementById('f_data').valueAsDate = new Date();
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('finance-modal').style.display = 'block';
}

function closeFinanceModal() {
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('finance-modal').style.display = 'none';
}

function saveTransaction() {
    const t = {
        id: Date.now().toString(),
        desc: document.getElementById('f_desc').value,
        valor: parseFloat(document.getElementById('f_valor').value) || 0,
        data: document.getElementById('f_data').value,
        metodo: document.getElementById('f_metodo').value,
        tipo: document.getElementById('f_tipo').value
    };
    if (!t.desc || !t.valor) return;
    transactions.push(t);
    localStorage.setItem('santo_transactions', JSON.stringify(transactions));
    renderFinance();
    closeFinanceModal();
}

function renderFinance() {
    const tableBody = document.getElementById('finance-table-body');
    tableBody.innerHTML = "";
    
    let inflow = 0;
    let outflow = 0;

    const start = document.getElementById('filter-start').value;
    const end = document.getElementById('filter-end').value;

    // Unifica transações manuais e vendas do CRM
    const allTrans = [
        ...transactions.map(t => ({...t, source: 'manual'})),
        ...leads.filter(l => l.status === 'Pago').map(l => ({
            id: l.id,
            data: l.entrega,
            desc: `VENDA: ${l.cliente}`,
            tipo: 'entrada',
            metodo: 'CRM',
            valor: parseFloat(l.valor || 0),
            source: 'crm'
        }))
    ];

    allTrans.sort((a, b) => new Date(b.data) - new Date(a.data));

    allTrans.forEach(t => {
        if (start && t.data < start) return;
        if (end && t.data > end) return;

        if (t.tipo === 'entrada') inflow += t.valor;
        else outflow += t.valor;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${new Date(t.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
            <td><strong>${t.desc}</strong></td>
            <td><span class="tag">${t.source === 'crm' ? 'VENDA' : (t.tipo === 'entrada' ? 'ENTRADA' : 'SAÍDA')}</span></td>
            <td>${t.metodo}</td>
            <td class="${t.tipo === 'entrada' ? 'success' : 'danger'}" style="color: ${t.tipo === 'entrada' ? 'var(--success)' : 'var(--danger)'}">
                ${t.tipo === 'entrada' ? '+' : '-'} R$ ${t.valor.toFixed(2)}
            </td>
            <td>
                ${t.source === 'manual' ? `<button class="btn-modern" onclick="removeTransaction('${t.id}')"><i class="fa-solid fa-trash"></i></button>` : '-'}
            </td>
        `;
        tableBody.appendChild(row);
    });

    const balance = initialBalance + inflow - outflow;
    document.getElementById('cash-inflow').innerText = `R$ ${inflow.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('cash-outflow').innerText = `R$ ${outflow.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('cash-balance').innerText = `R$ ${balance.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('cash-result').innerText = `R$ ${(inflow - outflow).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
}

function removeTransaction(id) {
    transactions = transactions.filter(t => t.id !== id);
    localStorage.setItem('santo_transactions', JSON.stringify(transactions));
    renderFinance();
}

function openBalanceModal() {
    document.getElementById('initial-balance-input').value = initialBalance;
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('balance-modal').style.display = 'block';
}

function closeBalanceModal() {
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('balance-modal').style.display = 'none';
}

function saveInitialBalance() {
    initialBalance = parseFloat(document.getElementById('initial-balance-input').value) || 0;
    localStorage.setItem('santo_initial_balance', initialBalance);
    renderFinance();
    closeBalanceModal();
}

function applyFinanceFilters() { renderFinance(); }
function clearFinanceFilters() {
    document.getElementById('filter-start').value = "";
    document.getElementById('filter-end').value = "";
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
    
    document.getElementById('sim-meta-total').innerText = `R$ ${metaLucro.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;

    const tableBody = document.getElementById('sim-table-body');
    tableBody.innerHTML = "";

    simItems.forEach(item => {
        const margemValor = item.preco * (item.margem / 100);
        const vendasNecessarias = margemValor > 0 ? Math.ceil(metaLucro / margemValor) : 0;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="text" class="field-group input" style="width:100%" value="${item.nome}" onchange="updateSimItem(${item.id}, 'nome', this.value)"></td>
            <td><input type="number" class="field-group input" value="${item.preco}" onchange="updateSimItem(${item.id}, 'preco', this.value)"></td>
            <td><input type="number" class="field-group input" value="${item.margem}" onchange="updateSimItem(${item.id}, 'margem', this.value)">%</td>
            <td><input type="number" class="field-group input" value="${item.atual}" onchange="updateSimItem(${item.id}, 'atual', this.value)"></td>
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
            <td>R$ ${parseFloat(item.valor).toFixed(2)}</td>
            <td>R$ ${(item.qtd * item.valor).toFixed(2)}</td>
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
    closeStockModal();
}

function closeStockModal() {
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('stock-modal').style.display = 'none';
}

function removeStockItem(id) {
    if (confirm("Excluir item do estoque?")) {
        stockItems = stockItems.filter(i => i.id != id);
        renderStock();
    }
}

function updateSimItem(id, field, value) {
    const item = simItems.find(i => i.id == id);
    if (item) {
        item[field] = field === 'nome' ? value : parseFloat(value);
        runSimulator();
    }
}

// ================================================================================= //
//                                  CALCULADORA                                      //
// ================================================================================= //

function addItem() {
    const id = Date.now();
    items.push({ id, qtd: 1, nome: "", mat_preco: 0, mat_rend: 1, arte: 0, setup: 0, grav: 0, marg: 50 });
    renderItems();
}

function renderItems() {
    const list = document.getElementById('items-list');
    list.innerHTML = items.map(i => `
        <div class="item-card sidebar" style="width:100%; box-shadow:none; border:1px solid var(--border-color); margin-bottom:15px; background:transparent;">
            <div class="field-grid">
                <div class="field"><label>Qtd</label><input type="number" value="${i.qtd}" oninput="updateItem(${i.id}, 'qtd', this.value)"></div>
                <div class="field"><label>Nome do Item</label><input type="text" value="${i.nome}" placeholder="Ex: Chaveiro" oninput="updateItem(${i.id}, 'nome', this.value)"></div>
            </div>
            <div class="field-grid">
                <div class="field"><label>Mat. Preço (R$)</label><input type="number" value="${i.mat_preco}" oninput="updateItem(${i.id}, 'mat_preco', this.value)"></div>
                <div class="field"><label>Rendimento</label><input type="number" value="${i.mat_rend}" oninput="updateItem(${i.id}, 'mat_rend', this.value)"></div>
            </div>
            <div class="field-grid">
                <div class="field"><label>Arte (m)</label><input type="number" value="${i.arte}" oninput="updateItem(${i.id}, 'arte', this.value)"></div>
                <div class="field"><label>Setup (m)</label><input type="number" value="${i.setup}" oninput="updateItem(${i.id}, 'setup', this.value)"></div>
                <div class="field"><label>Gravação (m)</label><input type="number" value="${i.grav}" oninput="updateItem(${i.id}, 'grav', this.value)"></div>
            </div>
            <div class="field-grid">
                <div class="field"><label>Margem (%)</label><input type="number" value="${i.marg}" oninput="updateItem(${i.id}, 'marg', this.value)"></div>
                <button class="btn-modern btn-danger" onclick="removeItem(${i.id})" style="margin-top:25px"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `).join('');
    calc();
}

function updateItem(id, field, value) {
    const item = items.find(i => i.id == id);
    if (item) {
        item[field] = field === 'nome' ? value : parseFloat(value);
        calc();
    }
}

function removeItem(id) {
    items = items.filter(i => i.id !== id);
    renderItems();
}

function calc() {
    const valorHora = parseFloat(document.getElementById('g_valor_hora').value) || 0;
    const impGlobal = (parseFloat(document.getElementById('g_imposto').value) || 0) / 100;
    const taxaAM = (parseFloat(document.getElementById('g_cartao').value) || 0) / 100;
    const freteInsumos = parseFloat(document.getElementById('g_frete').value) || 0;
    const freteCliente = parseFloat(document.getElementById('g_frete_cliente').value) || 0;
    const descontoPorc = (parseFloat(document.getElementById('g_desconto').value) || 0) / 100;
    
    const valorMinuto = valorHora / 60;
    let totalVendaGeral = 0;
    let totalCustoGeral = 0;
    let totalTempoGeral = 0;

    items.forEach(i => {
        const custoMat = (i.mat_preco / i.mat_rend) + (freteInsumos / (items.length * i.qtd || 1));
        const tempoItem = i.arte + i.setup + (i.grav * i.qtd);
        const custoTempo = tempoItem * valorMinuto;
        const custoUnit = (custoMat + (custoTempo / i.qtd));
        const precoUnit = custoUnit / (1 - (i.marg / 100));
        
        totalVendaGeral += (precoUnit * i.qtd);
        totalCustoGeral += (custoUnit * i.qtd);
        totalTempoGeral += tempoItem;
    });

    const totalFinal = (totalVendaGeral * (1 - descontoPorc) + freteCliente) / (1 - impGlobal - taxaAM);
    const lucroReal = totalFinal - totalCustoGeral - (totalFinal * impGlobal) - (totalFinal * taxaAM) - freteCliente;

    document.getElementById('card_total').innerText = `R$ ${totalFinal.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('out_tempo_total').innerText = `${Math.floor(totalTempoGeral / 60)}h ${Math.round(totalTempoGeral % 60)}m`;
    document.getElementById('out_custo_total').innerText = `R$ ${totalCustoGeral.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('out_lucro_total').innerText = `R$ ${lucroReal.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;

    // Update Preview
    document.getElementById('display_nome_cliente').innerText = document.getElementById('g_cliente').value || "Não informado";
    const dataProp = document.getElementById('g_data_proposta').value;
    document.getElementById('display_data_proposta').innerText = dataProp ? new Date(dataProp + 'T00:00:00').toLocaleDateString('pt-BR') : "";

    const cardBody = document.getElementById('card-body');
    cardBody.innerHTML = items.map(i => `
        <tr>
            <td>${i.qtd}x</td>
            <td>${i.nome || 'Item sem nome'}</td>
            <td>R$ ${(i.qtd * (totalFinal/totalVendaGeral || 1) * (i.mat_preco/i.mat_rend + (i.arte+i.setup+i.grav*i.qtd)*valorMinuto/i.qtd) / (1-i.marg/100)).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
        </tr>
    `).join('');

    window.currentCalculation = { total: totalFinal, lucro: lucroReal };
}

function sendToCRM() {
    const cliente = document.getElementById('g_cliente').value;
    if (!cliente) { alert("Preencha o nome do cliente!"); return; }
    
    openLeadModal();
    document.getElementById('m_cliente').value = cliente;
    document.getElementById('m_valor').value = window.currentCalculation.total.toFixed(2);
    document.getElementById('m_lucro').value = window.currentCalculation.lucro.toFixed(2);
    document.getElementById('m_entrega').value = document.getElementById('g_data_proposta').value;
}

function copyWA() {
    const texto = `Olá ${document.getElementById('g_cliente').value}! Segue o orçamento da Santo Laser: Total R$ ${document.getElementById('card_total').innerText}`;
    navigator.clipboard.writeText(texto).then(() => alert("Copiado!"));
}

function closeAllModals(e) {
    if (e.target.classList.contains('modal-overlay')) {
        closeLeadModal();
        closeFinanceModal();
        closeBalanceModal();
    }
}
