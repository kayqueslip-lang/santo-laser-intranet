// ================================================================================= //
//                                  CORE APP LOGIC                                   //
// ================================================================================= //

// --- THEME SWITCHER ---
const themeToggle = document.getElementById('theme-toggle-btn');
const body = document.body;
const currentTheme = localStorage.getItem('theme') || 'dark';
body.setAttribute('data-theme', currentTheme);

themeToggle.addEventListener('click', () => {
    let newTheme = body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
});

// --- NAVIGATION ---
const navLinks = document.querySelectorAll('.nav-link[data-target]');
const contentSections = document.querySelectorAll('.content-section');
navLinks.forEach(link => {
    link.addEventListener('click', function() {
        const targetId = this.getAttribute('data-target');
        if (!targetId) return;

        navLinks.forEach(innerLink => innerLink.classList.remove('active'));
        this.classList.add('active');

        contentSections.forEach(section => section.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
    });
});

// --- DYNAMIC DATE & INITIALIZATION ---
document.addEventListener('DOMContentLoaded', function() {
    const d = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const dateEl = document.getElementById('current-date');
    if (dateEl) {
        dateEl.innerText = d.toLocaleDateString('pt-BR', options).toUpperCase();
    }
    
    const dateInput = document.getElementById('g_data_proposta');
    if (dateInput) {
        dateInput.valueAsDate = d;
    }
    
    render(); // Initialize calculator view
});

// ================================================================================= //
//                                CALCULATOR LOGIC                                   //
// ================================================================================= //
let items = [{ id: Date.now(), nome: 'Luminária Custom', qtd: 1, mat_preco: 50, mat_rend: 1, arte: 15, setup: 10, grav: 20, marg: 50 }];

function addItem() {
    items.push({ id: Date.now(), nome: 'Novo Item', qtd: 1, mat_preco: 0, mat_rend: 1, arte: 0, setup: 0, grav: 0, marg: 50 });
    render();
}

function removeItem(id) {
    if(items.length > 1) {
        items = items.filter(i => i.id !== id);
        render();
    }
}

function updateItem(id, field, val) {
    const item = items.find(i => i.id === id);
    if (item) {
        item[field] = field === 'nome' ? val : parseFloat(val) || 0;
        calc();
    }
}

function render() {
    const container = document.getElementById('items-list');
    if (!container) return;
    container.innerHTML = items.map(i => `
        <div class="item-config">
            <button class="btn-remove" onclick="removeItem(${i.id})">Remover</button>
            <input type="text" class="item-name" value="${i.nome}" placeholder="Nome do Produto" oninput="updateItem(${i.id}, 'nome', this.value)">
            <div class="field-grid">
                <div class="field"><label>Qtd Peças</label><input type="number" value="${i.qtd}" oninput="updateItem(${i.id}, 'qtd', this.value)"></div>
                <div class="field"><label>Margem %</label><div class="input-wrapper"><input type="number" value="${i.marg}" oninput="updateItem(${i.id}, 'marg', this.value)" class="has-suffix"><span class="suffix">%</span></div></div>
            </div>
            <div class="field-grid">
                <div class="field"><label>Preço Placa (R$)</label><div class="input-wrapper"><span class="prefix">R$</span><input type="number" value="${i.mat_preco}" oninput="updateItem(${i.id}, 'mat_preco', this.value)" class="has-prefix"></div></div>
                <div class="field"><label>Peças/Placa</label><input type="number" value="${i.mat_rend}" oninput="updateItem(${i.id}, 'mat_rend', this.value)"></div>
            </div>
            <div class="field-grid">
                <div class="field"><label>Design (R$)</label><input type="number" value="${i.arte}" oninput="updateItem(${i.id}, 'arte', this.value)"></div>
                <div class="field"><label>Setup (m)</label><input type="number" value="${i.setup}" oninput="updateItem(${i.id}, 'setup', this.value)"></div>
            </div>
            <div class="field"><label>Corte/Grav (m)</label><input type="number" value="${i.grav}" oninput="updateItem(${i.id}, 'grav', this.value)"></div>
            <div class="internal-metrics" id="metrics-${i.id}"></div>
        </div>
    `).join('');
    calc();
}

function calc() {
    const impInput = document.getElementById('g_imp');
    if (!impInput) return;

    const nomeCliente = document.getElementById('g_cliente').value;
    const dataProposta = document.getElementById('g_data_proposta').value;
    document.getElementById('display_cliente_box').style.display = (nomeCliente || dataProposta) ? 'block' : 'none';
    document.getElementById('display_nome_cliente').innerText = nomeCliente || 'Não informado';
    document.getElementById('display_data_proposta').innerText = dataProposta ? new Date(dataProposta + 'T00:00:00').toLocaleDateString('pt-BR') : 'Não informada';

    const impGlobal = (parseFloat(document.getElementById('g_imp').value) || 0) / 100;
    const riscoGlobal = (parseFloat(document.getElementById('g_risco').value) || 0) / 100;
    const valorHora = parseFloat(document.getElementById('g_hora').value) || 0;
    const taxaAM = (parseFloat(document.getElementById('g_cartao').value) || 0) / 100;
    const freteInsumos = parseFloat(document.getElementById('g_frete').value) || 0;
    const freteCliente = parseFloat(document.getElementById('g_frete_cliente').value) || 0;
    const descontoPorc = (parseFloat(document.getElementById('g_desconto').value) || 0) / 100;
    
    const valorMinuto = valorHora / 60;
    let totalVendaGeral = 0;
    let totalCustoGeral = freteInsumos;
    let totalTempoGeral = 0;

    items.forEach(i => {
        const custoMatUnit = i.mat_preco / (i.mat_rend || 1);
        const tempoTotalMin = i.setup + (i.grav * i.qtd);
        const custoOperacional = tempoTotalMin * valorMinuto;
        const custoBaseItem = (custoMatUnit * i.qtd) + i.arte + custoOperacional;
        
        const precoSugerido = custoBaseItem / (1 - (i.marg / 100));
        const totalVendaItem = precoSugerido;

        totalVendaGeral += totalVendaItem;
        totalCustoGeral += custoBaseItem;
        totalTempoGeral += tempoTotalMin;

        const metricsDiv = document.getElementById(`metrics-${i.id}`);
        if (metricsDiv) {
            metricsDiv.innerHTML = `
                <div class="metric-line">Custo Mat. Unit: <b>R$ ${custoMatUnit.toFixed(2)}</b></div>
                <div class="metric-line">Preço Sugerido (Total): <b>R$ ${totalVendaItem.toFixed(2)}</b></div>
            `;
        }
    });

    const totalComImpostos = totalVendaGeral / (1 - (impGlobal + riscoGlobal + taxaAM));
    const totalFinal = (totalComImpostos + freteCliente) * (1 - descontoPorc);
    const lucroReal = totalFinal - totalCustoGeral - (totalFinal * impGlobal) - freteCliente;

    document.getElementById('card_total').innerText = `R$ ${totalFinal.toFixed(2)}`;
    document.getElementById('out_tempo_total').innerText = `${Math.floor(totalTempoGeral / 60)}h ${Math.round(totalTempoGeral % 60)}m`;
    document.getElementById('out_custo_total').innerText = `R$ ${totalCustoGeral.toFixed(2)}`;
    document.getElementById('out_lucro_total').innerText = `R$ ${lucroReal.toFixed(2)}`;

    // Render Card
    const cardBody = document.getElementById('card-body');
    cardBody.innerHTML = items.map(i => `
        <tr>
            <td class="qty-col">${i.qtd}x</td>
            <td style="text-align:left">${i.nome}</td>
            <td style="text-align:right">R$ ${(i.qtd * (totalFinal/totalVendaGeral) * (i.mat_preco/i.mat_rend + i.arte/i.qtd + (i.setup/i.qtd + i.grav)*valorMinuto) / (1-i.marg/100)).toFixed(2)}</td>
        </tr>
    `).join('');

    // Payment details
    const entrada = parseFloat(document.getElementById('g_ent').value) || 0;
    const parcelas = parseInt(document.getElementById('g_parc').value) || 1;
    const saldo = totalFinal - entrada;
    const valorParc = saldo / parcelas;

    document.getElementById('payment-details').innerHTML = `
        <div class="pay-option"><span>Entrada</span><b>R$ ${entrada.toFixed(2)}</b></div>
        <div class="pay-option"><span>Saldo em ${parcelas}x no Cartão</span><b>R$ ${valorParc.toFixed(2)} /mês</b></div>
    `;
}

function copyWA() {
    const total = document.getElementById('card_total').innerText;
    const cliente = document.getElementById('g_cliente').value || "Cliente";
    let msg = `*ORÇAMENTO SANTO LASER*\n\n`;
    msg += `Olá ${cliente}, segue sua proposta:\n\n`;
    
    items.forEach(i => {
        msg += `• ${i.qtd}x ${i.nome}\n`;
    });

    msg += `\n*VALOR TOTAL: ${total}*\n`;
    msg += `\nLink para contato: https://wa.me/5548996728584`;

    navigator.clipboard.writeText(msg).then(() => {
        alert("Copiado para o WhatsApp!");
    });
}
