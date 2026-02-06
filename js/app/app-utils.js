function getUrlParameter(n) {
    const params = new URLSearchParams(window.location.search);
    const value = params.get(n);
    // Retorna o valor decodificado ou uma string vazia, evitando "null" na interface
    return value ? decodeURIComponent(value) : '';
}

function formatarDataSimples(timestamp) {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    // Retorna no padrão Brasileiro sem horas, conforme exigido em relatórios de carga
    return date.toLocaleDateString('pt-BR');
}

const gerarLinhasFormatadas = (textoBruto, autorAtual, dataAtual, adminStatus, adminObs) => {
    const linhas = [];
    if (adminStatus) linhas.push(`[${adminStatus.toUpperCase()}] (Admin): ${adminObs}`);
    const separator = ' | + NOVA: ';
    if (typeof textoBruto !== 'string') return [];

    if (textoBruto.includes(separator)) {
        const partes = textoBruto.split(separator);
        partes.forEach(p => {
            p = p.trim();
            const regex = /^"(.*)" \(Por: (.*) em (.*)\)$/; const match = p.match(regex);
            if (match) linhas.push(`Por: ${match[2]} em ${match[3]}: "${match[1]}"`);
            else linhas.push(`Por: ${autorAtual} em ${dataAtual}: "${p}"`);
        });
    } else {
        const p = textoBruto.trim();
        const regex = /^"(.*)" \(Por: (.*) em (.*)\)$/; const match = p.match(regex);
        if (match) linhas.push(`Por: ${match[2]} em ${match[3]}: "${match[1]}"`);
        else linhas.push(`Por: ${autorAtual} em ${dataAtual}: "${p}"`);
    }
    return linhas;
};

// --- 2. FUNÇÃO VISUAL ÚNICA (SEM HORAS VIA REGEX) ---
const gerarHtmlVisualApp = (pendencia, autorAtual, dataAtual) => {
    let html = '<ul class="lista-pendencias" style="list-style: none; padding: 0; margin: 5px 0;">';
    const lista = (pendencia && pendencia.pendencias_ca) ? pendencia.pendencias_ca :
        (Array.isArray(pendencia) ? pendencia : null);
    if (lista && Array.isArray(lista) && lista.length > 0) {
        lista.forEach(p => {
            const militar = p.quem || 'Militar';
            const dataFull = p.data || '';

            // Extrai apenas a data (DD/MM/AAAA) usando regex
            const matchData = dataFull.match(/\d{2}\/\d{2}\/\d{4}/);
            const dataApenas = matchData ? matchData[0] : dataFull;

            html += `
                <li class="linha-obs" style="margin-bottom: 8px; line-height: 1.4; text-align: left; font-size: 0.9rem; border-bottom: 1px dashed #eee; padding-bottom: 4px;">
                    <span style="margin-right: 8px;">⚠️</span>
                    <b>Por </b>
                    <span style="color: #d90f23; font-weight: bold;">${militar}</span>
                    <span> em <b>${dataApenas}</b>:</span>
                    <i style="margin-left: 5px; color: #333; font-weight: normal; display: block; padding-left: 25px;">${p.obs}</i>
                </li>`;
        });
    }
    // 3. FALLBACK PARA DADOS ANTIGOS (Só entra aqui se NÃO houver lista)
    else if (pendencia && pendencia.obs && typeof pendencia.obs === 'string') {
        const militar = pendencia.quem || autorAtual || 'Militar';
        const dataFull = pendencia.data || dataAtual || '';
        const matchData = dataFull.match(/\d{2}\/\d{2}\/\d{4}/);
        const dataApenas = matchData ? matchData[0] : dataFull;

        html += `
            <li class="linha-obs" style="margin-bottom: 8px; line-height: 1.4; text-align: left; font-size: 0.9rem;">
                <span style="margin-right: 8px;">⚠️</span>
                <b>Por </b>
                <span style="color: #d90f23; font-weight: bold;">${militar}</span>
                <span> em <b>${dataApenas}</b>:</span>
                <i style="margin-left: 5px; color: #333; font-weight: normal;">${pendencia.obs}</i>
            </li>`;
    }

    html += '</ul>';
    return html;
};

// (Auxiliar): Busca dados do item para retorno caso o modal precise reabrir sem ID
function buscarDadosItemPeloUid(uid) {
    const fonte = window.dadosConferencia || [];
    let result = null;
    fonte.forEach(s => s.itens.forEach(it => {
        if (it.id === uid || it.uid_global === uid) result = { nome: it.nome, tipo: it.tipo, saldo: it.quantidadeEsperada };
        if (it.tombamentos) it.tombamentos.forEach(t => {
            if (`${it.uid_global || it.id}-${t.tomb}` === uid) result = { nome: `${it.nome} (${t.tomb})`, tipo: it.tipo, saldo: 0 };
        });
    }));
    return result;
}

// ✅ Adicione este trecho ao início da sua função carregarDadosRemotos
function aplicarCoresV3(modo) {
    const root = document.documentElement;
    if (modo === 'checklist_vtr') {
        document.body.style.setProperty('background', 'linear-gradient(135deg, #2c3e50 0%, #000000 100%)', 'important');
    } else if (modo === 'recebimento_carga') {
        document.body.style.setProperty('background', 'linear-gradient(135deg, #1a1a1a 0%, #333333 100%)', 'important');
    }
}
