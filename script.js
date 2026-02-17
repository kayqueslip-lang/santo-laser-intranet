// ================================================================================= //
//                                     ESTADO GLOBAL                                 //
// ================================================================================= //

let leads = JSON.parse(localStorage.getItem('santo_leads')) || [];
let transactions = JSON.parse(localStorage.getItem('santo_transactions')) || [];
let simItems = JSON.parse(localStorage.getItem('santo_sim_items')) || [];
let stockItems = JSON.parse(localStorage.getItem('santo_stock_items')) || [];
let initialBalance = parseFloat(localStorage.getItem('santo_initial_balance')) || 0;
let items = []; // Itens da calculadora atual

// Logo em Base64 (integrada para evitar erro 404)
const LOGO_BASE64 = "data:image/jpeg;base64," + localStorage.getItem('santo_logo_cache') || "";

// ================================================================================= //
//                                 INICIALIZAÇÃO                                     //
// ================================================================================= //

document.addEventListener('DOMContentLoaded', () => {
    // Tenta carregar a logo do arquivo gerado se não estiver no cache
    fetch('logo_base64.txt').then(r => r.text()).then(base64 => {
        if (base64) {
            const fullBase64 = "data:image/jpeg;base64," + base64;
            localStorage.setItem('santo_logo_cache', base64);
            document.getElementById('main-logo-img').src = fullBase64;
            document.getElementById('quote-logo-img').src = fullBase64;
        }
    }).catch(() => {
        // Fallback se falhar
        document.getElementById('main-logo-img').src = "https://via.placeholder.com/80?text=SL";
    });

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

// ================================================================================= //
//                                     NAVEGAÇÃO                                     //
// ================================================================================= //

function showSection(sectionId) {
    closeAllModals(); // Fecha modais ao trocar de aba
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById(`${sectionId}-content`).classList.add('active');
    event.currentTarget.classList.add('active');
    
    if (sectionId === 'dashboard') updateDashboard();
    if (sectionId === 'crm') renderCRM();
    if (sectionId === 'cashflow') renderFinance();
    if (sectionId === 'simulator') runSimulator();
    if (sectionId === 'stock') renderStock();
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
//                                     DASHBOARD                                     //
// ================================================================================= //

function updateDashboard() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const paidLeadsMonth = leads.filter(l => {
        if (l.status !== 'Pago' || !l.entrega || l.resultado === 'Perda') return false;
        const d = new Date(l.entrega + 'T00:00:00');
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const faturamento = paidLeadsMonth.reduce((acc, l) => acc + parseFloat(l.valor || 0), 0);
    const lucro = paidLeadsMonth.reduce((acc, l) => acc + parseFloat(l.lucro || 0), 0);
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
    const ctxStatus = document.getElementById('chart-status');
    if (!ctxOrigem || !ctxStatus) return;
    
    if (window.Chart) {
        // Gráfico de Origem
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

        // Gráfico de Status
        if (window.myChartStatus) window.myChartStatus.destroy();
        const statusCount = {};
        leads.forEach(l => statusCount[l.status] = (statusCount[l.status] || 0) + 1);

        window.myChartStatus = new Chart(ctxStatus, {
            type: 'bar',
            data: {
                labels: Object.keys(statusCount),
                datasets: [{
                    label: 'Leads',
                    data: Object.values(statusCount),
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

// ================================================================================= //
//                                        CRM                                        //
// ================================================================================= //

function renderCRM() {
    const statuses = ["Proposta Enviada", "Aprovado", "Produção", "Finalizado", "Pago"];
    const tableBody = document.getElementById('crm-table-body');
    if (tableBody) tableBody.innerHTML = "";

    statuses.forEach(status => {
        const columnId = `cards-${status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-')}`;
        const countId = `count-${status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-')}`;
        
        const column = document.getElementById(columnId);
        const countEl = document.getElementById(countId);
        
        if (!column) return;
        column.innerHTML = "";
        
        const filteredLeads = leads.filter(l => l.status === status && l.resultado !== 'Perda' && !l.excluido);
        if (countEl) countEl.innerText = filteredLeads.length;

        filteredLeads.forEach(lead => {
            const card = document.createElement('div');
            card.className = 'kanban-card';
            card.draggable = true;
            card.id = `lead-${lead.id}`;
            card.ondragstart = (e) => {
                e.dataTransfer.setData("text", lead.id);
                setTimeout(() => card.style.display = 'none', 0);
            };
            card.ondragend = () => card.style.display = 'block';
            card.onclick = () => editLead(lead.id);
            
            card.innerHTML = `
                <div class="card-title">${lead.cliente}</div>
                ${lead.empresa ? `<div class="card-company">${lead.empresa}</div>` : ''}
                <div class="card-meta">
                    <span class="tag price">R$ ${parseFloat(lead.valor || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>
                    ${lead.entrega ? `<span class="tag date">${new Date(lead.entrega + 'T00:00:00').toLocaleDateString('pt-BR')}</span>` : ''}
                </div>
            `;
            column.appendChild(card);

            // Adiciona na tabela também
            if (tableBody) {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${lead.cliente}</td>
                    <td>${lead.empresa || '-'}</td>
                    <td><span class="tag price">${lead.status}</span></td>
                    <td>R$ ${parseFloat(lead.valor || 0).toFixed(2)}</td>
                    <td>${lead.entrega ? new Date(lead.entrega + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                    <td><button class="btn-modern" onclick="editLead('${lead.id}')"><i class="fa-solid fa-pen"></i></button></td>
                `;
                tableBody.appendChild(row);
            }
        });
    });
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
        renderFinance();
        updateDashboard();
    }
}

function openLeadModal() {
    document.getElementById('lead-modal-title').innerText = "NOVO CLIENTE";
    document.getElementById('m_lead_id').value = "";
    document.getElementById('m_cliente').value = "";
    document.getElementById('m_empresa').value = "";
    document.getElementById('m_status').value = "Proposta Enviada";
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
        status: document.getElementById('m_status').value,
        origem: document.getElementById('m_origem').value,
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
    btnVenda.classList.remove('active-venda');
    btnPerda.classList.remove('active-perda');
    if (val === 'Venda') btnVenda.classList.add('active-venda');
    if (val === 'Perda') btnPerda.classList.add('active-perda');
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
        div.innerHTML = `
            <div class="item-header">
                <strong>Item #${idx + 1}</strong>
                <span class="remove-item" onclick="removeItem(${item.id})">REMOVER</span>
            </div>
            <div class="field-group">
                <label>Descrição do Item</label>
                <input type="text" value="${item.nome}" oninput="updateItem(${item.id}, 'nome', this.value)" placeholder="Ex: Luminária de Acrílico">
            </div>
            <div class="field-row">
                <div class="field-group"><label>Quantidade</label><input type="number" value="${item.qtd}" oninput="updateItem(${item.id}, 'qtd', this.value)"></div>
                <div class="field-group"><label>Custo Material (R$)</label><input type="number" value="${item.mat}" oninput="updateItem(${item.id}, 'mat', this.value)"></div>
            </div>
            <div class="field-row">
                <div class="field-group"><label>Tempo Arte (min)</label><input type="number" value="${item.arte}" oninput="updateItem(${item.id}, 'arte', this.value)"></div>
                <div class="field-group"><label>Tempo Setup (min)</label><input type="number" value="${item.setup}" oninput="updateItem(${item.id}, 'setup', this.value)"></div>
                <div class="field-group"><label>Corte/Grav (min)</label><input type="number" value="${item.grav}" oninput="updateItem(${item.id}, 'grav', this.value)"></div>
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
        
        // Simplificação: Preço de venda = Custo * 2 (Margem 100% sobre custo) + impostos
        const precoVendaBase = custoTotalItem * 2;
        totalBruto += precoVendaBase;
        lucroTotal += (precoVendaBase - custoTotalItem);

        const row = document.createElement('tr');
        row.innerHTML = `<td>${item.qtd}x</td><td>${item.nome || 'Item sem nome'}</td><td>R$ ${precoVendaBase.toFixed(2)}</td>`;
        cardBody.appendChild(row);
    });

    let totalFinal = (totalBruto + freteCliente) * (1 - descontoPorc);
    totalFinal = totalFinal / (1 - impostoPorc - taxaCartao);

    document.getElementById('card_total').innerText = `R$ ${totalFinal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    document.getElementById('display_nome_cliente').innerText = document.getElementById('g_cliente').value || "Não informado";
    const dataProp = document.getElementById('g_data_proposta').value;
    document.getElementById('display_data_proposta').innerText = dataProp ? new Date(dataProp + 'T00:00:00').toLocaleDateString('pt-BR') : "";

    // Armazena lucro para o CRM
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
        status: "Proposta Enviada",
        origem: "WhatsApp",
        entrega: document.getElementById('g_data_proposta').value,
        valor: window.lastCalcTotal || 0,
        lucro: window.lastCalcLucro || 0,
        resultado: ""
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

    // Adiciona transações automáticas de leads pagos
    const autoTransactions = leads.filter(l => l.status === 'Pago' && l.resultado !== 'Perda').map(l => ({
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

        if (t.tipo === 'Entrada') entradas += t.valor;
        else saidas += t.valor;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${new Date(t.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
            <td>${t.desc}</td>
            <td><span class="tag ${t.tipo === 'Entrada' ? 'price' : 'date'}" style="color:${t.tipo === 'Entrada' ? 'var(--success)' : 'var(--danger)'}">${t.tipo.toUpperCase()}</span></td>
            <td>${t.cat}</td>
            <td>R$ ${t.valor.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
            <td>${t.id.toString().startsWith('auto') ? '' : `<button class="btn-modern btn-danger" onclick="deleteTransaction(${t.id})"><i class="fa-solid fa-trash"></i></button>`}</td>
        `;
        body.appendChild(row);
    });

    document.getElementById('fin-entradas').innerText = `R$ ${entradas.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('fin-saidas').innerText = `R$ ${saidas.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    document.getElementById('fin-saldo').innerText = `R$ ${(initialBalance + entradas - saidas).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    
    localStorage.setItem('santo_transactions', JSON.stringify(transactions));
}

function openFinanceModal(tipo) {
    document.getElementById('f_tipo').value = tipo;
    document.getElementById('fin-modal-title').innerText = `NOVA ${tipo.toUpperCase()}`;
    document.getElementById('f_desc').value = "";
    document.getElementById('f_valor').value = "";
    document.getElementById('f_cat').value = "";
    document.getElementById('f_data').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('finance-modal').style.display = 'block';
}

function saveTransaction() {
    const t = {
        id: Date.now(),
        desc: document.getElementById('f_desc').value,
        valor: parseFloat(document.getElementById('f_valor').value) || 0,
        cat: document.getElementById('f_cat').value,
        data: document.getElementById('f_data').value,
        tipo: document.getElementById('f_tipo').value
    };
    if (!t.desc || !t.valor) return;
    transactions.push(t);
    renderFinance();
    closeAllModals();
}

function deleteTransaction(id) {
    transactions = transactions.filter(t => t.id !== id);
    renderFinance();
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
            <td><input type="text" value="${item.nome}" onchange="updateSimItem(${item.id}, 'nome', this.value)" placeholder="Nome do Produto"></td>
            <td><input type="number" value="${item.preco}" onchange="updateSimItem(${item.id}, 'preco', this.value)"></td>
            <td><input type="number" value="${item.margem}" onchange="updateSimItem(${item.id}, 'margem', this.value)">%</td>
            <td><input type="number" value="${item.atual}" onchange="updateSimItem(${item.id}, 'atual', this.value)"></td>
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
    closeAllModals();
}

function removeStockItem(id) {
    if (confirm("Excluir item do estoque?")) {
        stockItems = stockItems.filter(i => i.id != id);
        renderStock();
    }
}

function closeStockModal() {
    closeAllModals();
}
