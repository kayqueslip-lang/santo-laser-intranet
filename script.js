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
    simLabels: ["Pró-labore", "Custos Fixos", "Marketing", "Reserva/Investimento", "DAS"],
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
    if (sectionId === 'simulator') renderSimInputs();
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
        const origens = leads.reduce((acc, l) => { acc[l.origem] = (acc[l.origem] || 0) + 1; return acc; }, {});
        if (window.myChartOrigem) window.myChartOrigem.destroy();
        window.myChartOrigem = new Chart(ctxOrigem, {
            type: 'polarArea',
            data: {
                labels: Object.keys(origens),
                datasets: [{ data: Object.values(origens), backgroundColor: ['#00e6cb', '#2979ff', '#ffea00', '#ff1744', '#7c4dff'] }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: textColor } } }, scales: { r: { grid: { color: gridColor }, ticks: { display: false } } } }
        });
    }
}

function renderTimeline() {
    const container = document.getElementById('timeline-wrapper');
    if (!container) return;
    container.innerHTML = "";
    
    const active = leads.filter(l => (l.status == 1 || l.status == 2) && l.entrega && l.resultado !== 'Perda')
                        .sort((a, b) => new Date(a.entrega) - new Date(b.entrega));
    
    if (active.length === 0) {
        container.innerHTML = "<p style='opacity:0.5; text-align:center; padding:20px;'>Nenhum pedido em produção.</p>";
        return;
    }

    active.forEach(l => {
        const diff = Math.ceil((new Date(l.entrega + 'T00:00:00') - new Date()) / (1000 * 60 * 60 * 24));
        const div = document.createElement('div');
        div.className = 'timeline-item';
        div.innerHTML = `
            <div class="tl-info"><strong>${l.cliente}</strong><br><small>${l.empresa || 'Final: ' + l.entrega}</small></div>
            <div class="tl-bar-bg"><div class="tl-bar-fill" style="width: ${Math.min(100, Math.max(10, 100 - diff * 10))}%"></div></div>
            <div class="tl-days">${diff}d</div>
        `;
        container.appendChild(div);
    });
}

// ================================================================================= //
//                                     CALCULADORA                                   //
// ================================================================================= //

function updateLeadSelect() {
    const select = document.getElementById('g_vincular_lead');
    if (!select) return;
    select.innerHTML = '<option value="">-- Criar Novo Lead --</option>';
    leads.filter(l => l.status < 4 && l.resultado !== 'Perda').forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.id;
        opt.innerText = `${l.cliente} (${l.empresa || 'S/E'})`;
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
    items.push({ id, nome: "", arte: 0, setup: 0, grav: 0, mat_custo: 0, mat_rend: 1, qtd: 1 });
    renderItems();
}

function renderItems() {
    const container = document.getElementById('items-list');
    container.innerHTML = "";
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'item-card-calc';
        div.innerHTML = `
            <div class="item-header-calc">
                <input type="text" placeholder="Nome do Item" value="${item.nome}" oninput="updateItem(${item.id}, 'nome', this.value)">
                <button class="btn-icon-danger" onclick="removeItem(${item.id})"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="field-row">
                <div class="field-group"><label>Arte (min)</label><input type="number" value="${item.arte}" oninput="updateItem(${item.id}, 'arte', this.value)"></div>
                <div class="field-group"><label>Setup (min)</label><input type="number" value="${item.setup}" oninput="updateItem(${item.id}, 'setup', this.value)"></div>
                <div class="field-group"><label>Corte (min)</label><input type="number" value="${item.grav}" oninput="updateItem(${item.id}, 'grav', this.value)"></div>
            </div>
            <div class="field-row">
                <div class="field-group"><label>Custo Placa (R$)</label><input type="number" value="${item.mat_custo}" oninput="updateItem(${item.id}, 'mat_custo', this.value)"></div>
                <div class="field-group"><label>Rendimento (un)</label><input type="number" value="${item.mat_rend}" oninput="updateItem(${item.id}, 'mat_rend', this.value)"></div>
                <div class="field-group"><label>Qtd Pedido</label><input type="number" value="${item.qtd}" oninput="updateItem(${item.id}, 'qtd', this.value)"></div>
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
    const markup = parseFloat(document.getElementById('g_markup').value) || 2.5;
    const impPorc = (parseFloat(document.getElementById('g_imposto').value) || 0) / 100;
    const taxaPorc = (parseFloat(document.getElementById('g_cartao').value) || 0) / 100;
    const fCli = parseFloat(document.getElementById('g_frete_cliente').value) || 0;
    const descPorc = (parseFloat(document.getElementById('g_desconto').value) || 0) / 100;

    const vMin = vHora / 60;
    let totalCustoTempo = 0;
    let totalCustoMaterial = 0;
    let totalMinutos = 0;
    let totalPrecoItens = 0;

    const body = document.getElementById('card-body');
    body.innerHTML = "";

    items.forEach(item => {
        const minPorItem = (item.arte + item.setup + item.grav);
        const minTotalItem = minPorItem * item.qtd;
        const custoTempoItem = minTotalItem * vMin;
        
        // Lógica de Rendimento Industrial
        const rendimento = item.mat_rend || 1;
        const placasNecessarias = Math.ceil(item.qtd / rendimento);
        const custoMatTotalItem = placasNecessarias * item.mat_custo;
        
        const custoTotalItem = custoTempoItem + custoMatTotalItem;
        const precoVendaItem = custoTotalItem * markup;

        totalCustoTempo += custoTempoItem;
        totalCustoMaterial += custoMatTotalItem;
        totalMinutos += minTotalItem;
        totalPrecoItens += precoVendaItem;

        const row = document.createElement('tr');
        row.innerHTML = `<td>${item.qtd}x</td><td>${item.nome || 'Item'}</td><td>${formatBRL(precoVendaItem)}</td>`;
        body.appendChild(row);
    });

    let totalFinal = (totalPrecoItens + fCli) * (1 - descPorc);
    totalFinal = totalFinal / (1 - impPorc - taxaPorc);

    const impostosTotais = totalFinal * (impPorc + taxaPorc);
    const lucroReal = totalFinal - (totalCustoTempo + totalCustoMaterial) - impostosTotais;

    // Atualizar Orçamento Visual
    document.getElementById('card_total').innerText = formatBRL(totalFinal);
    document.getElementById('display_nome_cliente').innerText = document.getElementById('g_cliente').value || "Cliente não informado";
    document.getElementById('display_empresa_cliente').innerText = document.getElementById('g_empresa_calc').value;
    const data = document.getElementById('g_data_proposta').value;
    document.getElementById('display_data_proposta').innerText = data ? new Date(data + 'T00:00:00').toLocaleDateString('pt-BR') : "";
    
    // WhatsApp Link
    const wa = document.getElementById('g_whatsapp').value.replace(/\D/g, '');
    const waLink = document.getElementById('display_whatsapp_link');
    if (wa) {
        waLink.innerHTML = `<a href="https://wa.me/55${wa}" target="_blank" style="color:var(--primary); text-decoration:none;"><i class="fa-brands fa-whatsapp"></i> WhatsApp: ${wa}</a>`;
    } else {
        waLink.innerHTML = "";
    }

    // Atualizar KPIs de Produção
    document.getElementById('intel-minutos').innerText = totalMinutos.toFixed(0);
    document.getElementById('intel-custo-tempo').innerText = formatBRL(totalCustoTempo);
    document.getElementById('intel-custo-mat').innerText = formatBRL(totalCustoMaterial);
    document.getElementById('intel-custo-geral').innerText = formatBRL(totalCustoTempo + totalCustoMaterial);

    // Atualizar Inteligência de Custos
    document.getElementById('intel-impostos').innerText = formatBRL(impostosTotais);
    document.getElementById('intel-cpv').innerText = formatBRL(totalCustoTempo + totalCustoMaterial);
    document.getElementById('intel-lucro').innerText = formatBRL(lucroReal);

    window.lastCalc = {
        total: totalFinal,
        lucro: lucroReal,
        impostos: impostosTotais,
        cpv: totalCustoTempo + totalCustoMaterial
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
    const wa = document.getElementById('g_whatsapp').value.replace(/\D/g, '');
    let msg = `Olá ${cliente}! Segue orçamento da Santo Laser:\n\n`;
    items.forEach(i => msg += `• ${i.qtd}x ${i.nome}\n`);
    msg += `\n*Total Final: ${total}*\n\nQualquer dúvida, estou à disposição!`;
    
    if (wa) {
        window.open(`https://wa.me/55${wa}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
        navigator.clipboard.writeText(msg).then(() => alert("Texto copiado para o clipboard!"));
    }
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
    document.getElementById('fin-resultado').innerText = formatBRL(e - s);
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
    
    const catSelect = document.getElementById('f_cat_select');
    catSelect.innerHTML = "";
    settings.categories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.innerText = c;
        catSelect.appendChild(opt);
    });

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
        const el = document.getElementById(`sim-val-${i}`);
        if (el) meta += parseFloat(el.value) || 0;
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
    localStorage.setItem('santo_sim_items', JSON.stringify(simItems));
}

function renderSimInputs() {
    const container = document.getElementById('sim-dynamic-labels');
    if (!container) return;
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

function openStockModal() {
    document.getElementById('s_id').value = ""; document.getElementById('s_nome').value = ""; document.getElementById('s_cat').value = ""; document.getElementById('s_qtd').value = ""; document.getElementById('s_min').value = ""; document.getElementById('s_valor').value = "";
    document.getElementById('modal-overlay').style.display = 'flex'; document.getElementById('stock-modal').style.display = 'block';
}

function saveStockItem() {
    const id = document.getElementById('s_id').value;
    const item = { id: id || Date.now(), nome: document.getElementById('s_nome').value, cat: document.getElementById('s_cat').value, qtd: parseFloat(document.getElementById('s_qtd').value) || 0, min: parseFloat(document.getElementById('s_min').value) || 0, valor: parseFloat(document.getElementById('s_valor').value) || 0 };
    if (id) { const idx = stockItems.findIndex(i => i.id == id); stockItems[idx] = item; } else { stockItems.push(item); }
    renderStock(); closeAllModals();
}

function editStockItem(id) {
    const item = stockItems.find(i => i.id == id);
    document.getElementById('s_id').value = item.id; document.getElementById('s_nome').value = item.nome; document.getElementById('s_cat').value = item.cat; document.getElementById('s_qtd').value = item.qtd; document.getElementById('s_min').value = item.min; document.getElementById('s_valor').value = item.valor;
    document.getElementById('modal-overlay').style.display = 'flex'; document.getElementById('stock-modal').style.display = 'block';
}

function removeStockItem(id) { if (confirm("Excluir item?")) { stockItems = stockItems.filter(i => i.id !== id); renderStock(); } }

// ================================================================================= //
//                                     CRM                                           //
// ================================================================================= //

function renderCRM() {
    settings.steps.forEach((step, i) => {
        const cardsCont = document.getElementById(`cards-${i}`);
        if (!cardsCont) return;
        cardsCont.innerHTML = "";
        const stepLeads = leads.filter(l => l.status == i && l.resultado !== 'Perda');
        document.getElementById(`count-${i}`).innerText = stepLeads.length;
        
        stepLeads.forEach(l => {
            const card = document.createElement('div');
            card.className = 'kanban-card';
            card.draggable = true;
            card.ondragstart = (e) => e.dataTransfer.setData('text', l.id);
            card.onclick = () => editLead(l.id);
            card.innerHTML = `<strong>${l.cliente}</strong><br><small>${l.empresa || '-'}</small><div class="card-val">${formatBRL(l.valor)}</div>`;
            cardsCont.appendChild(card);
        });
    });
    saveLeads();
}

function allowDrop(ev) { ev.preventDefault(); }
function drop(ev, status) {
    ev.preventDefault();
    const id = ev.dataTransfer.getData('text');
    const lead = leads.find(l => l.id == id);
    if (lead) { lead.status = status; renderCRM(); updateDashboard(); }
}

function openLeadModal() {
    document.getElementById('l_id').value = ""; document.getElementById('l_cliente').value = ""; document.getElementById('l_empresa').value = ""; document.getElementById('l_valor').value = ""; document.getElementById('l_entrega').value = "";
    document.getElementById('lead-modal-title').innerText = "NOVO CLIENTE";
    document.getElementById('lead-intel-box').style.display = 'none';
    const statusSel = document.getElementById('l_status');
    statusSel.innerHTML = "";
    settings.steps.forEach((s, i) => { const opt = document.createElement('option'); opt.value = i; opt.innerText = s; statusSel.appendChild(opt); });
    document.getElementById('modal-overlay').style.display = 'flex'; document.getElementById('lead-modal').style.display = 'block';
}

function editLead(id) {
    const lead = leads.find(l => l.id == id);
    document.getElementById('l_id').value = lead.id; document.getElementById('l_cliente').value = lead.cliente; document.getElementById('l_empresa').value = lead.empresa || ""; document.getElementById('l_valor').value = lead.valor; document.getElementById('l_entrega').value = lead.entrega || "";
    document.getElementById('l_origem').value = lead.origem || "WhatsApp";
    document.getElementById('lead-modal-title').innerText = "EDITAR CLIENTE";
    
    const statusSel = document.getElementById('l_status');
    statusSel.innerHTML = "";
    settings.steps.forEach((s, i) => { const opt = document.createElement('option'); opt.value = i; opt.innerText = s; if (i == lead.status) opt.selected = true; statusSel.appendChild(opt); });
    
    if (lead.cpv) {
        document.getElementById('lead-intel-box').style.display = 'block';
        document.getElementById('l_intel_impostos').innerText = formatBRL(lead.impostos);
        document.getElementById('l_intel_cpv').innerText = formatBRL(lead.cpv);
        document.getElementById('l_intel_lucro').innerText = formatBRL(lead.lucro);
    } else {
        document.getElementById('lead-intel-box').style.display = 'none';
    }
    
    document.getElementById('modal-overlay').style.display = 'flex'; document.getElementById('lead-modal').style.display = 'block';
}

function saveLead() {
    const id = document.getElementById('l_id').value;
    const lead = { id: id || Date.now().toString(), cliente: document.getElementById('l_cliente').value, empresa: document.getElementById('l_empresa').value, valor: parseFloat(document.getElementById('l_valor').value) || 0, entrega: document.getElementById('l_entrega').value, status: parseInt(document.getElementById('l_status').value), origem: document.getElementById('l_origem').value, resultado: 'Venda' };
    if (id) { const idx = leads.findIndex(l => l.id == id); leads[idx] = { ...leads[idx], ...lead }; } else { leads.push(lead); }
    renderCRM(); updateDashboard(); closeAllModals();
}

function setLeadResult(res) {
    const id = document.getElementById('l_id').value;
    if (!id) return;
    const lead = leads.find(l => l.id == id);
    lead.resultado = res;
    if (res === 'Venda') lead.status = 4;
    renderCRM(); updateDashboard(); closeAllModals();
}

function deleteLead() { if (confirm("Excluir lead?")) { const id = document.getElementById('l_id').value; leads = leads.filter(l => l.id != id); renderCRM(); updateDashboard(); closeAllModals(); } }
function toggleCRMView() { const k = document.getElementById('kanban-view'), t = document.getElementById('table-view'); if (k.style.display === 'none') { k.style.display = 'flex'; t.style.display = 'none'; } else { k.style.display = 'none'; t.style.display = 'block'; renderCRMTable(); } }
function renderCRMTable() { const body = document.getElementById('crm-table-body'); body.innerHTML = ""; leads.filter(l => l.resultado !== 'Perda').forEach(l => { const row = document.createElement('tr'); row.innerHTML = `<td>${l.cliente}</td><td>${l.empresa || '-'}</td><td>${settings.steps[l.status]}</td><td>${formatBRL(l.valor)}</td><td>${l.entrega || '-'}</td><td><button class="btn-modern" onclick="editLead('${l.id}')">EDITAR</button></td>`; body.appendChild(row); }); }

// ================================================================================= //
//                                 CONFIGURAÇÕES                                     //
// ================================================================================= //

function loadSettingsPage() {
    const stepsCont = document.getElementById('settings-crm-steps');
    stepsCont.innerHTML = "";
    settings.steps.forEach((s, i) => {
        const div = document.createElement('div'); div.className = 'setting-item-row';
        div.innerHTML = `<input type="text" value="${s}" onchange="settings.steps[${i}] = this.value">`;
        stepsCont.appendChild(div);
    });

    const simCont = document.getElementById('settings-sim-labels');
    simCont.innerHTML = "";
    settings.simLabels.forEach((l, i) => {
        const div = document.createElement('div'); div.className = 'setting-item-row';
        div.innerHTML = `<input type="text" value="${l}" onchange="settings.simLabels[${i}] = this.value"><button class="btn-icon-danger" onclick="removeSimLabel(${i})"><i class="fa-solid fa-trash"></i></button>`;
        simCont.appendChild(div);
    });

    const catCont = document.getElementById('settings-finance-cats');
    catCont.innerHTML = "";
    settings.categories.forEach((c, i) => {
        const div = document.createElement('div'); div.className = 'setting-item-row';
        div.innerHTML = `<input type="text" value="${c}" onchange="settings.categories[${i}] = this.value"><button class="btn-icon-danger" onclick="removeFinanceCat(${i})"><i class="fa-solid fa-trash"></i></button>`;
        catCont.appendChild(div);
    });
}

function addSimLabel() { settings.simLabels.push("Novo Custo"); loadSettingsPage(); }
function removeSimLabel(i) { settings.simLabels.splice(i, 1); loadSettingsPage(); }
function addFinanceCat() { settings.categories.push("Nova Categoria"); loadSettingsPage(); }
function removeFinanceCat(i) { settings.categories.splice(i, 1); loadSettingsPage(); }

function saveSettings() {
    localStorage.setItem('santo_settings', JSON.stringify(settings));
    applySettings();
    alert("Configurações salvas!");
}

function applySettings() {
    document.getElementById('filter-cat').innerHTML = '<option value="">Todas</option>' + settings.categories.map(c => `<option value="${c}">${c}</option>`).join('');
    renderCRM();
}

// ================================================================================= //
//                                     UTILITÁRIOS                                   //
// ================================================================================= //

function saveLeads() { localStorage.setItem('santo_leads', JSON.stringify(leads)); }

function exportToExcel() {
    let csv = "DATA;DESCRIÇÃO;TIPO;CATEGORIA;VALOR\n";
    const manual = transactions;
    const auto = leads.filter(l => l.status == 4 && l.resultado === 'Venda').map(l => ({ data: l.entrega || "", desc: `VENDA: ${l.cliente}`, tipo: 'Entrada', cat: 'Vendas CRM', valor: l.valor }));
    [...manual, ...auto].forEach(t => {
        csv += `${t.data};${t.desc};${t.tipo};${t.cat};${t.valor.toString().replace('.', ',')}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "santo_laser_financeiro.csv";
    link.click();
}
