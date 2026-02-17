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
    // Carregar Logo
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
    updateLeadSelect();
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
    if (sectionId === 'calculator') updateLeadSelect();
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

function globalSearch() {
    const term = document.getElementById('global-search').value.toLowerCase();
    if (!term) { renderCRM(); return; }
    
    showSection('crm');
    const filtered = leads.filter(l => 
        l.cliente.toLowerCase().includes(term) || 
        (l.empresa && l.empresa.toLowerCase().includes(term))
    );
    
    document.getElementById('kanban-view').style.display = 'none';
    document.getElementById('table-view').style.display = 'block';
    
    const body = document.getElementById('crm-table-body');
    body.innerHTML = "";
    filtered.forEach(lead => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${lead.cliente}</td><td>${lead.empresa || '-'}</td><td>${settings.steps[lead.status]}</td><td>${formatBRL(lead.valor)}</td><td>${lead.entrega || '-'}</td><td><button class="btn-modern" onclick="editLead('${lead.id}')">EDITAR</button></td>`;
        body.appendChild(row);
    });
}

// ================================================================================= //
//                                     DRE & BI                                      //
// ================================================================================= //

function renderDRE() {
    const monthFilter = document.getElementById('dre-month-filter').value;
    const [year, month] = monthFilter.split('-').map(Number);

    const monthLeads = leads.filter(l => {
        if (l.status != 4 || l.resultado !== 'Venda' || !l.entrega) return false;
        const d = new Date(l.entrega + 'T00:00:00');
        return d.getMonth() === (month - 1) && d.getFullYear() === year;
    });

    const receitaBruta = monthLeads.reduce((acc, l) => acc + (l.valor || 0), 0);
    const cpv = monthLeads.reduce((acc, l) => acc + (l.cpv || 0), 0);
    const impostos = monthLeads.reduce((acc, l) => acc + (l.impostos || 0), 0);

    const despesas = transactions.filter(t => {
        if (t.tipo !== 'Saída') return false;
        const d = new Date(t.data + 'T00:00:00');
        return d.getMonth() === (month - 1) && d.getFullYear() === year;
    }).reduce((acc, t) => acc + t.valor, 0);

    const receitaLiquida = receitaBruta - impostos;
    const lucroBruto = receitaLiquida - cpv;
    const resultadoLiquido = lucroBruto - despesas;

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = formatBRL(val); };
    const setPerc = (id, val, base) => {
        const el = document.getElementById(id);
        if (el) {
            const p = base > 0 ? ((val / base) * 100).toFixed(1) : 0;
            el.innerText = `${p}%`;
        }
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
    
    if (document.getElementById('dre-resultado')) {
        document.getElementById('dre-resultado').style.color = resultadoLiquido >= 0 ? 'var(--success)' : 'var(--danger)';
    }
    
    return { receitaBruta, resultadoLiquido, lucroBruto, despesas, cpv, impostos };
}

function updateDashboard() {
    const dre = renderDRE();
    const monthFilter = document.getElementById('dash-month-filter').value;
    const [year, month] = monthFilter.split('-').map(Number);

    document.getElementById('dash-faturamento').innerText = formatBRL(dre.receitaBruta);
    document.getElementById('dash-lucro-real').innerText = formatBRL(dre.resultadoLiquido);
    const margem = dre.receitaBruta > 0 ? ((dre.resultadoLiquido / dre.receitaBruta) * 100).toFixed(1) : 0;
    document.getElementById('dash-lucro-margem').innerText = `Margem: ${margem}%`;

    const pipelineVal = leads.filter(l => l.status < 4 && l.resultado !== 'Perda').reduce((acc, l) => acc + (l.valor || 0), 0);
    document.getElementById('dash-pipeline').innerText = formatBRL(pipelineVal);
    
    const previsao = dre.receitaBruta + (pipelineVal * 0.5);
    document.getElementById('dash-faturamento-trend').innerText = `Previsão: ${formatBRL(previsao)}`;

    const activePedidos = leads.filter(l => (l.status == 1 || l.status == 2) && l.resultado !== 'Perda');
    document.getElementById('dash-pedidos').innerText = activePedidos.length;
    const pedidosValor = activePedidos.reduce((acc, l) => acc + (l.valor || 0), 0);
    document.getElementById('dash-pedidos-valor').innerText = formatBRL(pedidosValor);

    renderCharts(year, month, dre, pipelineVal);
    renderTimeline();
}

function renderCharts(year, month, dre, pipeline) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? '#2d333f' : '#e2e8f0';

    const ctxPerf = document.getElementById('chart-performance');
    if (ctxPerf) {
        if (window.myChartPerf) window.myChartPerf.destroy();
        window.myChartPerf = new Chart(ctxPerf, {
            type: 'bar',
            data: {
                labels: ['Receita Bruta', 'CPV', 'Despesas', 'Lucro Líquido'],
                datasets: [{
                    data: [dre.receitaBruta, dre.cpv, dre.despesas, dre.resultadoLiquido],
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

    const ctxPrev = document.getElementById('chart-previsibilidade');
    if (ctxPrev) {
        if (window.myChartPrev) window.myChartPrev.destroy();
        window.myChartPrev = new Chart(ctxPrev, {
            type: 'doughnut',
            data: {
                labels: ['Já Faturado', 'Pipeline (Potencial)'],
                datasets: [{
                    data: [dre.receitaBruta, pipeline],
                    backgroundColor: ['#00e6cb', '#2d333f']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: textColor } } } }
        });
    }

    const ctxOrigem = document.getElementById('chart-origem');
    if (ctxOrigem) {
        const counts = {};
        leads.forEach(l => counts[l.origem] = (counts[l.origem] || 0) + 1);
        if (window.myChartOrigem) window.myChartOrigem.destroy();
        window.myChartOrigem = new Chart(ctxOrigem, {
            type: 'pie',
            data: {
                labels: Object.keys(counts),
                datasets: [{ data: Object.values(counts), backgroundColor: ['#00e6cb', '#2979ff', '#ffea00', '#ff1744', '#7c4dff'] }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: textColor } } } }
        });
    }
}

function renderTimeline() {
    const container = document.getElementById('timeline-wrapper');
    if (!container) return;
    container.innerHTML = "";
    const active = leads.filter(l => (l.status == 1 || l.status == 2) && l.entrega).sort((a, b) => new Date(a.entrega) - new Date(b.entrega));
    
    if (active.length === 0) {
        container.innerHTML = "<p style='color:var(--text-secondary); font-size:0.8rem;'>Nenhum pedido em produção.</p>";
        return;
    }

    active.forEach(l => {
        const d = new Date(l.entrega + 'T00:00:00');
        const diff = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = `<h4>${l.cliente}</h4><p>Entrega em: ${d.toLocaleDateString('pt-BR')} (${diff} dias)</p>`;
        container.appendChild(item);
    });
}

// ================================================================================= //
//                                     CRM LOGIC                                     //
// ================================================================================= //

function renderCRM() {
    const kanban = document.getElementById('kanban-view');
    const table = document.getElementById('table-view');
    
    if (kanban.style.display !== 'none') {
        settings.steps.forEach((step, i) => {
            const container = document.getElementById(`cards-${i}`);
            const countEl = document.getElementById(`count-${i}`);
            if (!container) return;
            container.innerHTML = "";
            const filtered = leads.filter(l => l.status == i && l.resultado !== 'Perda');
            countEl.innerText = filtered.length;
            
            filtered.forEach(lead => {
                const card = document.createElement('div');
                card.className = 'kanban-card';
                card.draggable = true;
                card.onclick = () => editLead(lead.id);
                card.ondragstart = (e) => e.dataTransfer.setData('leadId', lead.id);
                card.innerHTML = `<h4>${lead.cliente}</h4><p>${lead.empresa || '-'}</p><div class="card-meta"><span class="price">${formatBRL(lead.valor)}</span><span class="date">${lead.entrega ? new Date(lead.entrega + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</span></div>`;
                container.appendChild(card);
            });
        });
    } else {
        const body = document.getElementById('crm-table-body');
        body.innerHTML = "";
        leads.filter(l => l.resultado !== 'Perda').forEach(lead => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${lead.cliente}</td><td>${lead.empresa || '-'}</td><td>${settings.steps[lead.status]}</td><td>${formatBRL(lead.valor)}</td><td>${lead.entrega || '-'}</td><td><button class="btn-modern" onclick="editLead('${lead.id}')">EDITAR</button></td>`;
            body.appendChild(row);
        });
    }
}

function toggleCRMView() {
    const kanban = document.getElementById('kanban-view');
    const table = document.getElementById('table-view');
    if (kanban.style.display === 'none') { kanban.style.display = 'flex'; table.style.display = 'none'; }
    else { kanban.style.display = 'none'; table.style.display = 'block'; }
    renderCRM();
}

function allowDrop(e) { e.preventDefault(); }
function drop(e, stepIndex) {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    const lead = leads.find(l => l.id == leadId);
    if (lead) {
        lead.status = stepIndex;
        saveLeads();
        renderCRM();
        updateDashboard();
    }
}

function openLeadModal() {
    document.getElementById('lead-modal-title').innerText = "NOVO CLIENTE";
    document.getElementById('m_lead_id').value = "";
    document.getElementById('m_cliente').value = "";
    document.getElementById('m_empresa').value = "";
    document.getElementById('m_valor').value = "";
    document.getElementById('m_lucro').value = "";
    document.getElementById('m_entrega').value = "";
    document.getElementById('m_status').value = 0;
    document.getElementById('m_origem').value = "WhatsApp";
    document.getElementById('m_resultado').value = "";
    document.getElementById('m_impostos').value = 0;
    document.getElementById('m_cpv').value = 0;
    
    document.getElementById('m_intel_impostos').innerText = "R$ 0,00";
    document.getElementById('m_intel_cpv').innerText = "R$ 0,00";
    document.getElementById('m_intel_lucro').innerText = "R$ 0,00";
    
    document.getElementById('lead-result-actions').style.display = 'none';
    document.getElementById('btn-delete-lead').style.display = 'none';
    
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
    document.getElementById('m_valor').value = lead.valor;
    document.getElementById('m_lucro').value = lead.lucro;
    document.getElementById('m_entrega').value = lead.entrega || "";
    document.getElementById('m_status').value = lead.status;
    document.getElementById('m_origem').value = lead.origem;
    document.getElementById('m_resultado').value = lead.resultado || "";
    document.getElementById('m_impostos').value = lead.impostos || 0;
    document.getElementById('m_cpv').value = lead.cpv || 0;

    document.getElementById('m_intel_impostos').innerText = formatBRL(lead.impostos);
    document.getElementById('m_intel_cpv').innerText = formatBRL(lead.cpv);
    document.getElementById('m_intel_lucro').innerText = formatBRL(lead.lucro);

    document.getElementById('lead-result-actions').style.display = 'block';
    document.getElementById('btn-delete-lead').style.display = 'block';
    
    // Highlight active result
    document.getElementById('btn-venda').className = lead.resultado === 'Venda' ? 'btn-modern btn-success' : 'btn-modern';
    document.getElementById('btn-perda').className = lead.resultado === 'Perda' ? 'btn-modern btn-danger' : 'btn-modern';

    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('lead-modal').style.display = 'block';
}

function setResult(res) {
    document.getElementById('m_resultado').value = res;
    document.getElementById('btn-venda').className = res === 'Venda' ? 'btn-modern btn-success' : 'btn-modern';
    document.getElementById('btn-perda').className = res === 'Perda' ? 'btn-modern btn-danger' : 'btn-modern';
}

function saveLead() {
    const id = document.getElementById('m_lead_id').value;
    const data = {
        id: id || Date.now().toString(),
        cliente: document.getElementById('m_cliente').value,
        empresa: document.getElementById('m_empresa').value,
        valor: parseFloat(document.getElementById('m_valor').value) || 0,
        lucro: parseFloat(document.getElementById('m_lucro').value) || 0,
        entrega: document.getElementById('m_entrega').value,
        status: parseInt(document.getElementById('m_status').value),
        origem: document.getElementById('m_origem').value,
        resultado: document.getElementById('m_resultado').value,
        impostos: parseFloat(document.getElementById('m_impostos').value) || 0,
        cpv: parseFloat(document.getElementById('m_cpv').value) || 0
    };
    
    if (!data.cliente) return alert("Nome obrigatório!");
    
    if (id) {
        const idx = leads.findIndex(l => l.id == id);
        leads[idx] = data;
    } else {
        leads.push(data);
    }
    
    saveLeads();
    closeAllModals();
    renderCRM();
    updateDashboard();
}

function deleteLead() {
    const id = document.getElementById('m_lead_id').value;
    if (confirm("Excluir este lead permanentemente?")) {
        leads = leads.filter(l => l.id != id);
        saveLeads();
        closeAllModals();
        renderCRM();
        updateDashboard();
    }
}

function saveLeads() { localStorage.setItem('santo_leads', JSON.stringify(leads)); }

// ================================================================================= //
//                                CALCULADORA LOGIC                                  //
// ================================================================================= //

function updateLeadSelect() {
    const select = document.getElementById('g_vincular_lead');
    if (!select) return;
    select.innerHTML = '<option value="">-- Criar Novo Lead --</option>';
    leads.filter(l => l.resultado !== 'Perda' && l.status < 4).forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.id;
        opt.innerText = `${l.cliente} (${l.empresa || 'Sem empresa'})`;
        select.appendChild(opt);
    });
}

function loadLeadDataIntoCalc() {
    const id = document.getElementById('g_vincular_lead').value;
    if (!id) return;
    const lead = leads.find(l => l.id == id);
    if (lead) {
        document.getElementById('g_cliente').value = lead.cliente;
        document.getElementById('g_empresa_calc').value = lead.empresa || "";
        document.getElementById('g_data_proposta').value = lead.entrega || "";
        calc();
    }
}

function addItem() {
    const id = Date.now();
    items.push({ id, nome: "", qtd: 1, mat: 0, arte: 0, setup: 0, grav: 0 });
    renderItems();
}

function renderItems() {
    const container = document.getElementById('items-list');
    container.innerHTML = "";
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'item-row';
        div.innerHTML = `
            <div class="item-grid">
                <input type="text" placeholder="Nome do Item" value="${item.nome}" oninput="updateItem(${item.id}, 'nome', this.value)">
                <input type="number" placeholder="Qtd" value="${item.qtd}" oninput="updateItem(${item.id}, 'qtd', this.value)">
                <input type="number" placeholder="Material R$" value="${item.mat}" oninput="updateItem(${item.id}, 'mat', this.value)">
                <button class="btn-modern btn-danger" onclick="removeItem(${item.id})"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="item-times">
                <div class="field-group"><label>Arte (min)</label><input type="number" value="${item.arte}" oninput="updateItem(${item.id}, 'arte', this.value)"></div>
                <div class="field-group"><label>Setup (min)</label><input type="number" value="${item.setup}" oninput="updateItem(${item.id}, 'setup', this.value)"></div>
                <div class="field-group"><label>Corte/Grav (min)</label><input type="number" value="${item.grav}" oninput="updateItem(${item.id}, 'grav', this.value)"></div>
            </div>
        `;
        container.appendChild(div);
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
    const impPorc = (parseFloat(document.getElementById('g_imposto').value) || 0) / 100;
    const taxaPorc = (parseFloat(document.getElementById('g_cartao').value) || 0) / 100;
    const fCli = parseFloat(document.getElementById('g_frete_cliente').value) || 0;
    const descPorc = (parseFloat(document.getElementById('g_desconto').value) || 0) / 100;

    const vMin = vHora / 60;
    let totalCustoProducao = 0;
    let totalPrecoBase = 0;
    const body = document.getElementById('card-body');
    body.innerHTML = "";

    items.forEach(item => {
        const custoItem = ((item.arte + item.setup + item.grav) * vMin + item.mat) * item.qtd;
        const precoItem = custoItem * 2.5; 
        totalCustoProducao += custoItem;
        totalPrecoBase += precoItem;
        const row = document.createElement('tr');
        row.innerHTML = `<td>${item.qtd}x</td><td>${item.nome || 'Item'}</td><td>${formatBRL(precoItem)}</td>`;
        body.appendChild(row);
    });

    let totalFinal = (totalPrecoBase + fCli) * (1 - descPorc);
    totalFinal = totalFinal / (1 - impPorc - taxaPorc);

    const impostosTotais = totalFinal * (impPorc + taxaPorc);
    const lucroReal = totalFinal - totalCustoProducao - impostosTotais;

    document.getElementById('card_total').innerText = formatBRL(totalFinal);
    document.getElementById('display_nome_cliente').innerText = document.getElementById('g_cliente').value || "Cliente não informado";
    document.getElementById('display_empresa_cliente').innerText = document.getElementById('g_empresa_calc').value;
    const data = document.getElementById('g_data_proposta').value;
    document.getElementById('display_data_proposta').innerText = data ? new Date(data + 'T00:00:00').toLocaleDateString('pt-BR') : "";

    // Atualizar Inteligência de Custos
    document.getElementById('intel-impostos').innerText = formatBRL(impostosTotais);
    document.getElementById('intel-cpv').innerText = formatBRL(totalCustoProducao);
    document.getElementById('intel-lucro').innerText = formatBRL(lucroReal);

    window.lastCalc = {
        total: totalFinal,
        lucro: lucroReal,
        impostos: impostosTotais,
        cpv: totalCustoProducao
    };
}

function sendToCRM() {
    const nome = document.getElementById('g_cliente').value;
    const empresa = document.getElementById('g_empresa_calc').value;
    const idVinculo = document.getElementById('g_vincular_lead').value;
    
    if (!nome) { alert("Informe o nome do cliente!"); return; }
    
    const leadData = {
        id: idVinculo || Date.now().toString(),
        cliente: nome,
        empresa: empresa,
        status: idVinculo ? leads.find(l => l.id == idVinculo).status : 0,
        origem: idVinculo ? leads.find(l => l.id == idVinculo).origem : "WhatsApp",
        entrega: document.getElementById('g_data_proposta').value,
        valor: window.lastCalc.total,
        lucro: window.lastCalc.lucro,
        impostos: window.lastCalc.impostos,
        cpv: window.lastCalc.cpv,
        resultado: "Venda"
    };

    if (idVinculo) {
        const idx = leads.findIndex(l => l.id == idVinculo);
        leads[idx] = leadData;
        alert("Lead atualizado com sucesso!");
    } else {
        leads.push(leadData);
        alert("Novo lead criado no CRM!");
    }
    
    saveLeads(); renderCRM(); updateDashboard(); showSection('crm');
}

function copyWA() {
    const total = document.getElementById('card_total').innerText;
    const cliente = document.getElementById('g_cliente').value;
    let msg = `Olá ${cliente}! Segue orçamento da Santo Laser:\n\n`;
    items.forEach(i => msg += `• ${i.qtd}x ${i.nome}\n`);
    msg += `\n*Total Final: ${total}*\n\nQualquer dúvida, estou à disposição!`;
    navigator.clipboard.writeText(msg).then(() => alert("Copiado!"));
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

    const manual = transactions;
    const auto = leads.filter(l => l.status == 4 && l.resultado === 'Venda').map(l => ({ 
        id: `a-${l.id}`, 
        data: l.entrega || new Date().toISOString().split('T')[0], 
        desc: `VENDA: ${l.cliente}`, 
        tipo: 'Entrada', 
        cat: 'Vendas CRM', 
        valor: l.valor,
        impostos: l.impostos,
        lucro: l.lucro
    }));
    
    const all = [...manual, ...auto].sort((a, b) => new Date(b.data) - new Date(a.data));

    let e = 0, s = 0, res = 0, imp = 0, luc = 0;
    all.forEach(t => {
        if (start && t.data < start) return;
        if (end && t.data > end) return;
        if (type && t.tipo !== type) return;
        if (catF && t.cat !== catF) return;
        
        if (t.tipo === 'Entrada') {
            e += t.valor;
            imp += (t.impostos || 0);
            luc += (t.lucro || 0);
            res += (t.valor * 0.1); 
        } else {
            s += t.valor;
        }
        
        const row = document.createElement('tr');
        row.innerHTML = `<td>${new Date(t.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td><td>${t.desc}</td><td><span style="color:${t.tipo==='Entrada'?'var(--success)':'var(--danger)'}">${t.tipo}</span></td><td>${t.cat}</td><td>${formatBRL(t.valor)}</td><td>${t.id.toString().startsWith('a')?'':`<button class="btn-modern btn-danger" onclick="deleteTransaction(${t.id})"><i class="fa-solid fa-trash"></i></button>`}</td>`;
        body.appendChild(row);
    });
    
    document.getElementById('fin-entradas').innerText = formatBRL(e);
    document.getElementById('fin-saidas').innerText = formatBRL(s);
    document.getElementById('fin-saldo').innerText = formatBRL(initialBalance + e - s);
    document.getElementById('fin-reserva').innerText = formatBRL(res);
    document.getElementById('fin-impostos').innerText = formatBRL(imp);
    document.getElementById('fin-lucro').innerText = formatBRL(luc);
    
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

function deleteTransaction(id) { if (confirm("Excluir?")) { transactions = transactions.filter(t => t.id !== id); renderFinance(); } }
function openInitialBalanceModal() { const val = prompt("Saldo Inicial:", initialBalance); if (val !== null) { initialBalance = parseFloat(val) || 0; localStorage.setItem('santo_initial_balance', initialBalance); renderFinance(); } }
function clearFinanceFilters() { document.getElementById('filter-start').value = ""; document.getElementById('filter-end').value = ""; document.getElementById('filter-type').value = ""; document.getElementById('filter-cat').value = ""; renderFinance(); }

// ================================================================================= //
//                               SIMULADOR DE METAS                                  //
// ================================================================================= //

function runSimulator() {
    let meta = 0;
    settings.simLabels.forEach((label, i) => {
        const val = parseFloat(document.getElementById(`sim-val-${i}`).value) || 0;
        meta += val;
    });
    document.getElementById('sim-meta-total').innerText = formatBRL(meta);
    
    const body = document.getElementById('sim-table-body');
    body.innerHTML = "";
    simItems.forEach(item => {
        const margemV = item.preco * (item.margem / 100);
        const nec = margemV > 0 ? Math.ceil(meta / margemV) : 0;
        const row = document.createElement('tr');
        row.innerHTML = `<td><input type="text" value="${item.nome}" onchange="updateSimItem(${item.id}, 'nome', this.value)"></td><td><input type="number" value="${item.preco}" onchange="updateSimItem(${item.id}, 'preco', this.value)"></td><td><input type="number" value="${item.margem}" onchange="updateSimItem(${item.id}, 'margem', this.value)">%</td><td><input type="number" value="${item.atual}" onchange="updateSimItem(${item.id}, 'atual', this.value)"></td><td><strong>${nec}</strong></td><td><button class="btn-modern btn-danger" onclick="removeSimItem(${item.id})"><i class="fa-solid fa-trash"></i></button></td>`;
        body.appendChild(row);
    });
}

function renderSimInputs() {
    const container = document.getElementById('sim-dynamic-labels');
    container.innerHTML = "";
    settings.simLabels.forEach((label, i) => {
        const div = document.createElement('div');
        div.className = 'field-group';
        div.innerHTML = `<label>${label} (R$)</label><input type="number" id="sim-val-${i}" value="0" oninput="runSimulator()">`;
        container.appendChild(div);
    });
    runSimulator();
}

function addSimItem() { simItems.push({ id: Date.now(), nome: "Produto", preco: 0, margem: 0, atual: 0 }); runSimulator(); }
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
function saveStockItem() {
    const id = document.getElementById('s_item_id').value;
    const data = { id: id || Date.now().toString(), nome: document.getElementById('s_nome').value, cat: document.getElementById('s_cat').value, valor: parseFloat(document.getElementById('s_valor').value) || 0, qtd: parseInt(document.getElementById('s_qtd').value) || 0, min: parseInt(document.getElementById('s_min').value) || 0 };
    if (id) { const idx = stockItems.findIndex(s => s.id == id); stockItems[idx] = data; } else { stockItems.push(data); }
    renderStock(); closeAllModals();
}
function removeStockItem(id) { if (confirm("Excluir?")) { stockItems = stockItems.filter(s => s.id != id); renderStock(); } }

// ================================================================================= //
//                                 CONFIGURAÇÕES                                     //
// ================================================================================= //

function loadSettingsPage() {
    const stepsList = document.getElementById('settings-steps-list');
    stepsList.innerHTML = "";
    settings.steps.forEach((s, i) => {
        const div = document.createElement('div');
        div.className = 'setting-item-row';
        div.innerHTML = `<input type="text" value="${s}" onchange="updateSetting('steps', ${i}, this.value)">`;
        stepsList.appendChild(div);
    });

    const simList = document.getElementById('settings-sim-labels');
    simList.innerHTML = "";
    settings.simLabels.forEach((s, i) => {
        const div = document.createElement('div');
        div.className = 'setting-item-row';
        div.innerHTML = `<input type="text" value="${s}" onchange="updateSetting('simLabels', ${i}, this.value)"><button class="btn-modern btn-danger" onclick="removeSettingItem('simLabels', ${i})"><i class="fa-solid fa-trash"></i></button>`;
        simList.appendChild(div);
    });

    const catList = document.getElementById('settings-categories-list');
    catList.innerHTML = "";
    settings.categories.forEach((s, i) => {
        const div = document.createElement('div');
        div.className = 'setting-item-row';
        div.innerHTML = `<input type="text" value="${s}" onchange="updateSetting('categories', ${i}, this.value)"><button class="btn-modern btn-danger" onclick="removeSettingItem('categories', ${i})"><i class="fa-solid fa-trash"></i></button>`;
        catList.appendChild(div);
    });
}

function updateSetting(key, index, val) { settings[key][index] = val; saveSettings(); }
function addSettingItem(key) { settings[key].push("Novo Item"); saveSettings(); loadSettingsPage(); }
function removeSettingItem(key, index) { settings[key].splice(index, 1); saveSettings(); loadSettingsPage(); }
function saveSettings() { localStorage.setItem('santo_settings', JSON.stringify(settings)); applySettings(); }

function applySettings() {
    settings.steps.forEach((s, i) => {
        const el = document.getElementById(`label-step-${i+1}`);
        if (el) el.innerText = s;
        const opt = document.getElementById(`opt-step-${i+1}`);
        if (opt) opt.innerText = s;
    });
    
    const fCat = document.getElementById('f_cat_select');
    if (fCat) {
        fCat.innerHTML = "";
        settings.categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c; opt.innerText = c;
            fCat.appendChild(opt);
        });
    }

    const filterCat = document.getElementById('filter-cat');
    if (filterCat) {
        filterCat.innerHTML = '<option value="">Todas</option>';
        settings.categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c; opt.innerText = c;
            filterCat.appendChild(opt);
        });
    }
    
    renderSimInputs();
}

function resetSystem() { if (confirm("ATENÇÃO: Isso apagará TODOS os dados. Deseja continuar?")) { localStorage.clear(); location.reload(); } }

// ================================================================================= //
//                                     BACKUP                                        //
// ================================================================================= //

function exportToExcel() {
    let csv = "DATA;DESCRIÇÃO;TIPO;CATEGORIA;VALOR;IMPOSTOS;LUCRO\n";
    const manual = transactions;
    const auto = leads.filter(l => l.status == 4 && l.resultado === 'Venda').map(l => ({ 
        data: l.entrega, desc: `VENDA: ${l.cliente}`, tipo: 'Entrada', cat: 'Vendas CRM', valor: l.valor, impostos: l.impostos, lucro: l.lucro 
    }));
    [...manual, ...auto].forEach(t => {
        csv += `${t.data};${t.desc};${t.tipo};${t.cat};${t.valor};${t.impostos||0};${t.lucro||0}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "santo_laser_financeiro.csv");
    link.click();
}
