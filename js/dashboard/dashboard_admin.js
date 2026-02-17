/*--- RENDERIZA O LAYOUT DE GESTÃO PARA ADMIN/GESTOR (PREPARADOR DE PALCO) ---*/
function renderAdminGestorCards(canViewDashboardCards) {
    const containerPai = document.getElementById('admin-gestor-cards-container');
    const cardsContainer = document.getElementById('cards-container');
    const opContainer = document.getElementById('operacional-cards-container');
    const masterContainer = document.getElementById('dashboard-content-by-role');

    if (!containerPai || !cardsContainer) return;

    if (!canViewDashboardCards) {
        containerPai.style.setProperty('display', 'none', 'important');
        return;
    }

    const placeholder = document.getElementById('detail-placeholder');
    const detailColumn = document.querySelector('.dashboard-detail-column');
    const caTableWrapper = document.getElementById('ca-table-wrapper');

    // 1. RESET DE INTERFACE
    if (caTableWrapper) {
        caTableWrapper.style.setProperty('display', 'none', 'important');
        caTableWrapper.innerHTML = `
            <div id="table-title"></div>
            <div id="no-issues-msg" style="display:none; text-align:center; padding:20px; color:#94a3b8;"></div>
            <div id="sigma-v3-dynamic-grid" class="sigma-v3-details-grid"></div>
        `;
    }

    // 2. CONFIGURAÇÃO DE LAYOUT INICIAL (Cards em Grid)
    if (opContainer) opContainer.style.setProperty('display', 'none', 'important');

    if (masterContainer) {
        masterContainer.classList.remove('dashboard-operacional-full');
        masterContainer.style.removeProperty('display'); // Libera para o Grid do CSS
        masterContainer.classList.remove('split-view');  // Remove o modo de duas colunas
    }

    // ✅ CORREÇÃO: A coluna de detalhes deve começar ESCONDIDA para o Grid ocupar a tela toda
    if (detailColumn) {
        detailColumn.style.setProperty('display', 'none', 'important');
    }

    // 3. PREPARAÇÃO DO PLACEHOLDER (Mas não exibe ainda)
    if (placeholder) {
        // Deixamos o conteúdo pronto, mas o display:none da detailColumn manda agora
        placeholder.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; min-height: 180px; color: #94a3b8; text-align: center; padding: 15px; background: #fff; border-radius: 12px;">
                <div style="background: #f8fafc; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; border: 1.5px dashed #e2e8f0;">
                    <i class="fas fa-list-check" style="font-size: 1.2em; color: #cbd5e1;"></i>
                </div>
                <h3 style="margin: 0; font-size: 1rem; color: #475569; font-weight: 700;">Monitoramento Listas de Conferência</h3>
                <p style="font-size: 0.8rem; margin-top: 6px; color: #94a3b8; max-width: 220px; line-height: 1.3;">
                    Selecione um card à esquerda para verificar o status do inventário e pendências.
                </p>
            </div>
        `;
    }

    // Exibe o contêiner de cards
    containerPai.style.setProperty('display', 'block', 'important');

    // Carrega os dados (cards)
    loadCaaData();
}

/*--- FUNÇÃO PRINCIPAL DE CARGA DE DADOS DE PENDÊNCIAS DAS CONFERÊNCIAS ---*/
/*---FUNÇÃO PRINCIPAL DE CARGA DE DADOS DE PENDÊNCIAS DAS CONFERÊNCIAS---*/
async function loadCaaData() {
    const container = document.getElementById('cards-container');
    if (!container) { console.error("❌ LOG: Container 'cards-container' não existe no HTML."); return; }

    if (isCaaLoading) return;
    isCaaLoading = true;

    console.log("🚀 LOG INICIAL: Iniciando carga de pendências para o Dashboard...");
    const loading = document.getElementById('loading-message-dashboard');
    if (loading) loading.style.display = 'block';

    try {
        await loadCautelaPendencies();

        const isAdmin = currentUserData.role === 'admin' || currentUserData.role === 'gestor_geral';
        const gestorUnidadeId = currentUserData.unidade_id;

        const map = {};
        const cacheUnidadesLista = {};

        // 1. BUSCA DOS RESULTADOS (Ordenados do mais recente para o mais antigo)
        const snap = await db.collection(COLECAO_RESULTADOS).orderBy('timestamp', 'desc').limit(100).get();
        console.log(`📊 LOG BANCO: Encontrados ${snap.size} registros para análise.`);

        for (const doc of snap.docs) {
            const d = doc.data();
            const lId = d.lista_id;
            if (!lId) continue;

            // Identificação de Unidade para conferência de permissão
            let unidadeVinculada = d.unidade_id;
            let siglaVinculada = d.unidade_sigla || "GERAL";

            // Triangulação se o documento for órfão de unidade_id
            if (!unidadeVinculada) {
                if (!cacheUnidadesLista[lId]) {
                    const docLista = await db.collection('listas_conferencia').doc(lId).get();
                    if (docLista.exists) {
                        const dL = docLista.data();
                        cacheUnidadesLista[lId] = { id: dL.unidade_id, sigla: dL.unidade_sigla };
                    }
                }
                if (cacheUnidadesLista[lId]) {
                    unidadeVinculada = cacheUnidadesLista[lId].id;
                    siglaVinculada = cacheUnidadesLista[lId].sigla;
                }
            }

            // Validação de Visibilidade
            const bateUnidade = (unidadeVinculada === gestorUnidadeId);
            const podeVer = isAdmin || bateUnidade;

            if (podeVer) {
                // ✅ O PULO DO GATO: Se é a primeira vez que vemos esta lista no loop, 
                // ela é a conferência mais recente (devido ao orderBy timestamp desc).
                // Portanto, definimos o rodapé com estes dados.
                if (!map[lId]) {
                    map[lId] = {
                        docId: doc.id,
                        lista_id: lId,
                        local: d.local,
                        conferente: d.conferente, // Aqui será o 3º SGT JHONATH
                        date: d.timestamp ? d.timestamp.toDate().toLocaleString('pt-BR') : 'N/D',
                        unidade_sigla: siglaVinculada,
                        items: []
                    };
                }

                // Agora, independente de quem conferiu, acumulamos as pendências ativas
                const fonte = d.itensRelatorio || d.itensCaa || [];
                fonte.forEach(it => {
                    if (it.status === 'C/A' && it.pendencias_ids) {
                        it.pendencias_ids.forEach(p => {
                            if (p.status_gestao !== 'RESOLVIDO') {
                                // Evita duplicar a mesma pendência se ela aparecer em vários logs
                                const jaExiste = map[lId].items.some(existente => existente.id === p.id);
                                if (!jaExiste) {
                                    map[lId].items.push({
                                        ...p,
                                        itemNome: it.nomeCompleto || it.nome,
                                        itemId: it.id || it.uid_global,
                                        tipoRegistro: 'PENDENCIA'
                                    });
                                }
                            }
                        });
                    }
                });
            }
        }

        // --- 2. COMPLEMENTO DE LISTAS VAZIAS (S/A) ---
        // Se for gestor, garante que listas que não tiveram conferência recente no snap também apareçam
        if (!isAdmin && gestorUnidadeId) {
            const snapMestras = await db.collection('listas_conferencia')
                .where('unidade_id', '==', gestorUnidadeId)
                .where('ativo', '==', true).get();

            snapMestras.forEach(docM => {
                if (!map[docM.id]) {
                    const dM = docM.data();
                    map[docM.id] = {
                        docId: docM.id,
                        lista_id: docM.id,
                        local: dM.ativo_nome || dM.local || docM.id,
                        conferente: dM.atualizado_por || "N/D",
                        date: dM.atualizado_em ? dM.atualizado_em.toDate().toLocaleString('pt-BR') : 'N/D',
                        unidade_sigla: dM.unidade_sigla || "CCI",
                        items: []
                    };
                }
            });
        }

        console.log("🖼️ LOG FINAL: Renderizando cards com último conferente cronológico.");
        renderCards(map);

    } catch (e) {
        console.error("❌ LOG ERRO FATAL:", e);
    } finally {
        if (loading) loading.style.display = 'none';
        setTimeout(() => { isCaaLoading = false; }, 800);
    }
}

/*--- DESENHA OS CARDS DE PENDÊNCIAS NO DASHBOARD ADMIN/GESTOR ---*/
async function renderCards(map) {
    const container = document.getElementById('cards-container');
    if (!container) return;
    container.innerHTML = '';
    const keys = Object.keys(map);

    // 1. Carrega rotas para fallback de unidade (se necessário)
    let rotas = {};
    try {
        const rotasDoc = await db.collection('config_geral').doc('rotas').get();
        rotas = rotasDoc.data() || {};
    } catch (e) { console.warn("Falha rotas:", e); }

    // Se o mapa estiver vazio aqui, significa que não há nem listas cadastradas
    if (keys.length === 0) {
        container.innerHTML = `
            <div style="padding:60px; text-align:center; color:#94a3b8; width:100%;">
                <i class="fas fa- ghost fa-3x" style="opacity:0.2; margin-bottom:15px; display:block;"></i>
                <p>Nenhuma viatura ou lista mapeada para sua unidade.</p>
            </div>`;
        return;
    }

    // 2. AGRUPAMENTO POR UNIDADE
    const groupedCards = {};
    keys.forEach(listaId => {
        const d = map[listaId];
        const unit = d.unidade_sigla || rotas[listaId]?.unidade || 'OUTROS';
        if (!groupedCards[unit]) groupedCards[unit] = [];
        groupedCards[unit].push(d);
    });

    const sortedUnits = Object.keys(groupedCards).sort();

    sortedUnits.forEach(unit => {
        // Títulos da Unidade
        const unitHeader = document.createElement('h3');
        unitHeader.className = 'unit-header';
        unitHeader.style.cssText = 'display: block; width: 100%; color: #800020; border-bottom: 2px solid rgba(0,0,0,0.05); padding-bottom: 10px; margin-top: 25px; margin-bottom: 15px; font-size: 1.1em; font-weight: 800; text-transform: uppercase;';

        const icon = (unit === 'OUTROS' || unit === 'GERAL') ? 'fa-folder-open' : 'fa-building';
        unitHeader.innerHTML = `<div class="unit-flex-title"><i class="fas ${icon}"></i> <span>${unit}</span></div>`;
        container.appendChild(unitHeader);

        const cardsList = groupedCards[unit];
        cardsList.forEach(d => {
            const allItems = d.items || [];
            const countTotal = allItems.length;
            const temAlteracao = countTotal > 0;

            // ✅ DEFINIÇÃO DE CORES V3
            const corPrimaria = temAlteracao ? '#d90f23' : '#1b8a3e'; // Vermelho vs Verde
            const corFundoBadge = temAlteracao ? '#fff1f2' : '#f0fdf4'; // Fundo do badge
            const labelStatus = temAlteracao ? '⚠️ Atenção Requerida' : '✅ Inventário em Dia';

            const div = document.createElement('div');
            // Mantemos a classe base e adicionamos uma classe de estado se necessário
            div.className = `sigma-v3-floating-card ${temAlteracao ? 'has-issue' : 'is-ok'}`;

            // Aplica borda lateral colorida dinamicamente
            div.style.borderLeft = `6px solid ${corPrimaria}`;

            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <h3 style="margin:0; font-size: 1.2em; font-weight: 900; color: #1e293b;">${d.local}</h3>
                    <div class="sigma-v3-stat-badge" style="background: ${corFundoBadge}; color: ${corPrimaria}; border: 1px solid ${corPrimaria}22;">
                        ${!temAlteracao ? '<i class="fas fa-check" style="font-size: 0.7em;"></i>' : countTotal}
                    </div>
                </div>
        
                <div style="margin-top: 10px;">
                    <span style="font-size: 0.7em; font-weight: 800; color: ${corPrimaria}; text-transform: uppercase; letter-spacing: 0.5px;">
                        ${labelStatus}
                    </span>
                </div>

                <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #f1f5f9;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-user-shield" style="color: #94a3b8; font-size: 0.8em;"></i>
                        <span style="font-size: 0.75em; color: #64748b; font-weight: 600;">${d.conferente}</span>
                    </div>
                    <small style="display: block; color: #94a3b8; font-size: 0.7em; margin-top: 4px; margin-left: 22px;">
                        <i class="far fa-clock"></i> ${d.date}
                    </small>
                </div>
            `;

            // Ao clicar, abre a tabela de detalhes (que mostrará as pendências ou a msg de S/A)
            div.onclick = () => {
                const masterContainer = document.getElementById('dashboard-content-by-role');
                const detailColumn = document.querySelector('.dashboard-detail-column');

                if (masterContainer) {
                    // 1. Ativa a transição CSS (cards encolhem para 380px)
                    masterContainer.classList.add('split-view');
                }

                if (detailColumn) {
                    // 2. Garante que a coluna de detalhes fique visível
                    detailColumn.style.setProperty('display', 'block', 'important');
                }

                // 3. Carrega os dados na tabela (sua função original)
                mostrarTabela(d);

                // 4. Scroll suave para o topo da tabela (opcional, melhora a experiência)
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
            container.appendChild(div);
        });
    });
}

/*CRIA A TABELA DE PENDÊNCIAS COM BASE NOS DADOS FORNECIDOS PELO BACKEND (CA-ADMIN)*/
function mostrarTabela(data) {
    const masterContainer = document.getElementById('dashboard-content-by-role'); // O pai de todos
    const detailColumn = document.querySelector('.dashboard-detail-column'); // A coluna branca

    // ✅ GARANTE QUE O LAYOUT MUDE PARA DUAS COLUNAS
    if (masterContainer) masterContainer.classList.add('split-view');
    if (detailColumn) detailColumn.style.setProperty('display', 'block', 'important');
    const wrapper = document.getElementById('ca-table-wrapper');
    const gridContainer = document.getElementById('sigma-v3-dynamic-grid');
    const msgNoIssues = document.getElementById('no-issues-msg');
    const placeholder = document.getElementById('detail-placeholder');
    const tableTitle = document.getElementById('table-title');
    const detailsWrapper = document.querySelector('.sigma-v3-details-wrapper');

    if (!wrapper || !gridContainer) return;

    // 0. GESTÃO DE ESTADO (MASTER-DETAIL)
    if (placeholder) {
        placeholder.style.setProperty('display', 'none', 'important');
    }

    // ✅ CORREÇÃO 1: Ativa o fundo cinza de contraste APENAS agora que há dados
    if (detailsWrapper) {
        detailsWrapper.style.setProperty('background', '#f1f5f9', 'important');
        detailsWrapper.style.setProperty('padding', '20px', 'important');
        detailsWrapper.style.setProperty('border-radius', '16px', 'important');
    }

    wrapper.style.setProperty('display', 'block', 'important');
    wrapper.style.setProperty('height', 'auto', 'important');

    // 1. CABEÇALHO PREMIUM COM BOTÃO FECHAR ESTILIZADO
    if (tableTitle) {
        tableTitle.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px;">
                <div style="display: flex; flex-direction: column; line-height: 1.2;">
                    <span style="letter-spacing: -0.5px; font-weight: 800; font-size: 1.2em; color: #1e293b;">Lista: ${data.local}</span>
                    <span style="font-size: 0.7em; color: #64748b; font-weight: 600; margin-top: 6px; text-transform: uppercase;">
                        <i class="fas fa-user-check" style="color: #1b8a3e;"></i> Conferido por: <b style="color: #1e293b;">${data.conferente}</b>
                    </span>
                    <span style="font-size: 0.65em; color: #94a3b8; margin-top: 2px;">Data: ${data.date}</span>
                </div>
                
                <button class="btn-v3-action" 
                        style="background: #800020 !important; color: #ffffff !important; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 6px rgba(128, 0, 32, 0.2); transition: all 0.2s ease;" 
                        onclick="fecharTabela()">
                    <i class="fas fa-times"></i> <span class="desktop-only">FECHAR</span>
                </button>
            </div>
        `;
    }

    gridContainer.innerHTML = '';
    const pendenciasReais = data.items || [];

    if (pendenciasReais.length === 0) {
        gridContainer.style.setProperty('display', 'none', 'important');
        if (msgNoIssues) {
            msgNoIssues.style.setProperty('display', 'block', 'important');
            msgNoIssues.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #94a3b8; background: white; border-radius: 12px; border: 1px dashed #cbd5e1;">
                    <i class="fas fa-check-circle" style="font-size: 3em; color: #1b8a3e; opacity: 0.3; margin-bottom: 15px;"></i>
                    <p style="font-weight: 600;">Nenhuma alteração pendente nesta lista.</p>
                </div>
            `;
        }
    } else {
        gridContainer.style.setProperty('display', 'grid', 'important');
        if (msgNoIssues) msgNoIssues.style.setProperty('display', 'none', 'important');

        pendenciasReais.forEach(p => {
            const statusG = p.status_gestao || 'PENDENTE';
            const ehCautela = p.tipoRegistro === 'CAUTELA';
            const colorRef = ehCautela ? '#f57c00' : (statusG === 'PENDENTE' ? '#d90f23' : '#2c7399');
            const badgeBg = ehCautela ? '#fff3e0' : (statusG === 'PENDENTE' ? '#ffebee' : '#e0f2fe');
            const iconRef = ehCautela ? 'fa-hand-holding' : 'fa-exclamation-triangle';
            const nomeAutorCompleto = p.autor_nome || "Militar não identificado";

            // ✅ OBJETO FORMATADO PARA O NOVO dashboard_admin.js
            const btnData = {
                docId: data.docId,
                pendId: p.id,
                idPai: p.id_pai || null, // Captura vínculo de conjunto se existir
                item: {
                    id: p.itemId,
                    uid_global: p.itemId,
                    nome: p.itemNome,
                    tombamento: p.tombamento || "",
                    tipo_controle: p.tombamento ? 'multi' : 'single',
                    qtd_pendente: p.quantidade || 1,
                    descricao: p.descricao
                }
            };

            // Escapa aspas para evitar quebra no atributo onclick
            const btnJson = JSON.stringify(btnData).replace(/'/g, "\\'");

            const card = document.createElement('div');
            card.className = 'sigma-v3-card-item';
            card.innerHTML = `
                <div class="sigma-v3-card-header">
                    <span class="sigma-v3-badge" style="background: ${badgeBg}; color: ${colorRef};">
                        <i class="fas ${iconRef}"></i> ${statusG}
                    </span>
                    <span class="sigma-v3-date">
                        <i class="far fa-calendar-alt"></i> ${p.data_criacao || data.date.split(',')[0]}
                    </span>
                </div>
                <h4>${p.itemNome}</h4>
                <div style="display: flex; gap: 10px; font-size: 0.75em; font-weight: 800; text-transform: uppercase;">
                    ${p.tombamento ?
                    `<span style="color: #800020;"><i class="fas fa-tag"></i> Tomb: ${p.tombamento}</span>` :
                    `<span style="color: #d90f23;"><i class="fas fa-layer-group"></i> Qtd: ${p.quantidade} un.</span>`}
                </div>
                <p class="sigma-v3-obs-box">"${p.descricao}"</p>
                <div class="sigma-v3-author-info">
                    <i class="fas fa-user-edit"></i> 
                    <span>Por: <b>${nomeAutorCompleto}</b></span>
                </div>
                ${!ehCautela ?
                    `<button class="sigma-v3-btn-manage" onclick='abrirGestaoPendencia(${btnJson})'>
                        <i class="fas fa-gavel"></i> Gerenciar Pendência
                    </button>` :
                    `<div style="text-align: center; padding: 12px; background: #ffffff; border-radius: 10px; font-size: 0.7em; color: #94a3b8; font-weight: 700; border: 1px dashed #cbd5e1;">
                        <i class="fas fa-lock"></i> ITEM EM POSSE PESSOAL
                    </div>`
                }
            `;
            gridContainer.appendChild(card);
        });
    }

    const oldFooter = document.getElementById('wrapper-footer-actions');
    if (oldFooter) oldFooter.remove();

    if (window.innerWidth <= 1100) {
        wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Função para fechar a tabela e resetar o estado
function fecharTabela() {
    const masterContainer = document.getElementById('dashboard-content-by-role');
    const detailColumn = document.querySelector('.dashboard-detail-column');
    const wrapper = document.getElementById('ca-table-wrapper');
    const placeholder = document.getElementById('detail-placeholder');

    console.log("🔙 Executando fechamento e reset de Grid...");

    // 1. O PONTO CHAVE: Remove a classe que divide a tela
    if (masterContainer) {
        masterContainer.classList.remove('split-view');
        // Removemos qualquer trava de display que o JS possa ter colocado
        masterContainer.style.removeProperty('display');
    }

    // 2. ESCONDE A COLUNA DE DETALHES COMPLETAMENTE
    // Se ela ficar como 'block', os cards continuam espremidos na esquerda
    if (detailColumn) {
        detailColumn.style.setProperty('display', 'none', 'important');
    }

    // 3. LIMPEZA INTERNA (Opcional, mas boa prática)
    if (wrapper) wrapper.style.setProperty('display', 'none', 'important');
    if (placeholder) placeholder.style.setProperty('display', 'none', 'important');

    // 4. COMPORTAMENTO DE NAVEGAÇÃO
    // Independente de ser mobile ou desktop, voltamos o scroll para o topo dos cards
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Abre o Modal de Gestão via SweetAlert2
 * @param {Object} data - Objeto contendo docId, itemData, pendId, etc.
 */
async function abrirGestaoPendencia(data) {
    const { docId, item, pendId, idPai } = data;
    const isMulti = item.tipo_controle === 'multi';

    // Busca saldo atual no estoque para informar o gestor
    const saldoEstoque = await buscarSaldoEstoqueGestor(item.id || item.uid_global);

    Swal.fire({
        title: 'GERENCIAR PENDÊNCIA',
        html: `
            <div style="text-align: left; font-family: 'Inter', sans-serif;">
                <p style="color: #800020; font-weight: 800; margin-bottom: 5px; font-size: 1.1rem;">${item.nome}</p>
                
                <p style="font-size: 0.8rem; color: #64748b; font-weight: 600; margin-bottom: 20px; text-transform: uppercase;">
                    <i class="fas fa-layer-group"></i> Quantidade Pendente: <span style="color: #d90f23;">${item.qtd_pendente || 1} un.</span>
                </p>
                
                <div class="form-group">
                    <label style="font-weight: 800; font-size: 0.75rem; color: #64748b; text-transform: uppercase;">Ação do Gestor</label>
                    <select id="swal-gestao-status" class="sigma-v3-select" style="width: 100%; margin-bottom: 15px;">
                        <option value="Solucionado">✅ Resolver Pendência (Saneamento)</option>
                        <option value="Substituir">♻️ Substituir Item (Troca por Estoque)</option>
                        <option value="Em solução">⏳ Em solução (Acompanhamento)</option>
                    </select>
                </div>

                <div id="swal-div-qtd" style="display:none;">
                    <label style="font-weight: 800; font-size: 0.75rem; color: #d90f23;">Qtd para Saneamento (Máx: ${item.qtd_pendente || 1})</label>
                    <input type="number" id="swal-gestao-qtd" class="sigma-v3-date-input" value="${item.qtd_pendente || 1}" min="1" max="${item.qtd_pendente || 1}">
                </div>

                <div id="swal-div-substituir" style="display:none; background: #f8fafc; padding: 15px; border-radius: 10px; border: 1px dashed #cbd5e1;">
                    <p style="font-size: 0.8rem; font-weight: bold; color: #2c7399; margin-bottom: 10px;">
                        Disponível no Almoxarifado: <span id="swal-estoque-count">${saldoEstoque.total}</span> un.
                    </p>
                    ${isMulti ? `
                        <label style="font-weight: 800; font-size: 0.7rem;">SELECIONE O NOVO TOMBAMENTO:</label>
                        <select id="swal-novo-tombamento" class="sigma-v3-select">
                            ${saldoEstoque.tombamentos.map(t => `<option value="${t}">${t}</option>`).join('')}
                        </select>
                    ` : `
                        <p style="font-size: 0.75rem; color: #64748b;">A quantidade 1 será retirada do estoque e o item danificado será recolhido.</p>
                    `}
                </div>

                <div class="form-group" style="margin-top: 15px;">
                    <label style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 800; font-size: 0.65rem; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; display: block;">
                        DESPACHO TÉCNICO / OBSERVAÇÕES
                    </label>
                    <textarea id="swal-gestao-obs" 
                        style="
                            width: 100%; 
                            min-height: 100px; 
                            padding: 12px; 
                            border: 1px solid #cbd5e1; 
                            border-radius: 8px; 
                            background-color: #ffffff; 
                            font-family: 'Segoe UI', Roboto, -apple-system, sans-serif; 
                            font-size: 0.85rem; 
                            color: #334155; 
                            line-height: 1.5; 
                            resize: vertical; 
                            outline: none; 
                            box-sizing: border-box;
                            transition: border-color 0.2s;
                        " 
                        onfocus="this.style.borderColor='#800020'"
                        onblur="this.style.borderColor='#cbd5e1'"
                        placeholder="Descreva detalhadamente a solução ou o andamento da manutenção...">
                    </textarea>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'SALVAR AÇÃO',
        confirmButtonColor: '#1b8a3e',
        cancelButtonText: 'CANCELAR',
        didOpen: () => {
            const selectStatus = document.getElementById('swal-gestao-status');
            const divQtd = document.getElementById('swal-div-qtd');
            const divSub = document.getElementById('swal-div-substituir');

            selectStatus.onchange = () => {
                divQtd.style.display = selectStatus.value === 'Solucionado' ? 'block' : 'none';
                divSub.style.display = selectStatus.value === 'Substituir' ? 'block' : 'none';
            };
        },
        preConfirm: () => {
            const status = document.getElementById('swal-gestao-status').value;
            const obs = document.getElementById('swal-gestao-obs').value.trim();
            const qtd = document.getElementById('swal-gestao-qtd') ? parseInt(document.getElementById('swal-gestao-qtd').value) : 1;
            const novoTomb = document.getElementById('swal-novo-tombamento') ? document.getElementById('swal-novo-tombamento').value : null;

            if (!obs) {
                Swal.showValidationMessage('O despacho técnico é obrigatório');
                return false;
            }

            return { status, obs, qtd, novoTomb };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            executarAcaoGestao({ ...data, ...result.value });
        }
    });
}

/*--- Ação principal para processar a decisão do gestor ---*/
async function executarAcaoGestao(data) {
    const { docId, item, pendId, idPai, status, obs, qtd, novoTomb } = data;
    const batch = db.batch();
    const dataHora = new Date().toLocaleString('pt-BR');
    const nomeGestor = `${currentUserData.posto} ${currentUserData.nome_guerra}`;
    const unidadeId = currentUserData.unidade_id;

    try {
        Swal.fire({ title: 'Processando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const resRef = db.collection('resultados_conferencias').doc(docId);
        const resSnap = await resRef.get();
        let { itensRelatorio } = resSnap.data();

        // Localiza o item no relatório
        const idBusca = idPai || item.id || item.uid_global;
        const itemRes = itensRelatorio.find(i => i.id === idBusca || i.uid_global === idBusca);
        const pIdx = itemRes.pendencias_ids.findIndex(p => p.id === pendId);

        // --- CASO 1: SANEAMENTO (SOLUCIONADO) ---
        if (status === 'Solucionado') {
            itemRes.pendencias_ids.splice(pIdx, 1);
            if (itemRes.pendencias_ids.length === 0) itemRes.status = 'S/A';

            // Ajusta saldo: De Pendente para Disponível
            const saldoRef = db.collection('inventario').doc(item.id || item.uid_global).collection('saldos_unidades').doc(unidadeId);
            batch.update(saldoRef, {
                qtd_disp: firebase.firestore.FieldValue.increment(qtd),
                qtd_pend: firebase.firestore.FieldValue.increment(-qtd)
            });
            registrarHistoricoVida(batch, item.id, "SANEAMENTO", `✅ Pendência resolvida. Despacho: ${obs}`, qtd);
        }

        // --- CASO 2: SUBSTITUIÇÃO (A LÓGICA NOVA) ---
        else if (status === 'Substituir') {
            const saldoRef = db.collection('inventario').doc(item.id || item.uid_global).collection('saldos_unidades').doc(unidadeId);

            // 🔍 Busca o saldo atual em tempo real (fora do batch para decisão lógica)
            const saldoAtual = await buscarSaldoEstoqueGestor(item.id || item.uid_global);

            if (saldoAtual.total <= 0) {
                // 🛑 CASO 1: ESTOQUE ZERADO - APENAS RECOLHIMENTO
                itemRes.pendencias_ids.splice(pIdx, 1);
                itemRes.status = 'RECOLHIDO/PENDENTE'; // Sinaliza a saída do item sem reposição

                batch.update(saldoRef, {
                    qtd_pend: firebase.firestore.FieldValue.increment(1),
                    last_update: dataHora
                });

                registrarHistoricoVida(batch, item.id, "RECOLHIMENTO_AVULSO", `⚠️ Sem estoque para troca. Item recolhido da viatura para o almoxarifado como pendente. Despacho: ${obs}`, 1);
            }
            else {
                // ✅ CASO 2: HÁ ESTOQUE - SUBSTITUIÇÃO NORMAL
                if (item.tipo_controle === 'multi') {
                    // Lógica Multi: Troca tombamento na lista
                    const tombOriginal = item.tombamento;
                    itemRes.tombamento = novoTomb;
                    itemRes.pendencias_ids.splice(pIdx, 1);
                    itemRes.status = 'S/A';

                    batch.update(saldoRef, {
                        tombamentos_disponiveis: firebase.firestore.FieldValue.arrayRemove(novoTomb),
                        tombamentos_pendentes: firebase.firestore.FieldValue.arrayUnion(tombOriginal),
                        last_update: dataHora
                    });
                    registrarHistoricoVida(batch, item.id, "SUBSTITUICAO_MULTI", `♻️ Substituído tombamento ${tombOriginal} por ${novoTomb}. Motivo: ${obs}`, 1);
                } else {
                    // Lógica Single: Saneia a lista e ajusta saldos numéricos
                    itemRes.pendencias_ids.splice(pIdx, 1);
                    itemRes.status = 'S/A';

                    batch.update(saldoRef, {
                        qtd_disp: firebase.firestore.FieldValue.increment(-1), // Sai um bom do estoque
                        qtd_pend: firebase.firestore.FieldValue.increment(1),  // Entra um ruim no estoque
                        last_update: dataHora
                    });
                    registrarHistoricoVida(batch, item.id, "SUBSTITUICAO_SINGLE", `♻️ Item substituído por um novo do estoque. Original recolhido como pendente. Despacho: ${obs}`, 1);
                }
            }
        }

        // --- CASO 3: EM SOLUÇÃO ---
        else if (status === 'Em solução') {
            itemRes.pendencias_ids[pIdx].status_gestao = 'EM SOLUÇÃO';
            itemRes.pendencias_ids[pIdx].descricao += `\n[GESTÃO ${dataHora}]: ${obs}`;
            registrarHistoricoVida(batch, item.id, "ACOMPANHAMENTO", `⏳ Gestor marcou como 'Em Solução'. Obs: ${obs}`, 0);
        }

        batch.update(resRef, { itensRelatorio });
        await batch.commit();

        Swal.fire('Sucesso!', 'Ação registrada com sucesso no sistema e no histórico de vida.', 'success');
        if (typeof loadCaaData === 'function') loadCaaData();

    } catch (e) {
        console.error(e);
        Swal.fire('Erro', 'Falha ao processar ação: ' + e.message, 'error');
    }
}

// Helper para Histórico de Vida
function registrarHistoricoVida(batch, itemId, evento, detalhes, qtd) {
    const unidadeId = currentUserData.unidade_id;
    const histRef = db.collection('inventario').doc(itemId).collection('saldos_unidades').doc(unidadeId).collection('historico_vida').doc();
    batch.set(histRef, {
        data: new Date().toLocaleString('pt-BR'),
        evento: evento,
        quem: `${currentUserData.posto} ${currentUserData.nome_guerra}`,
        detalhes: detalhes,
        quantidade: qtd
    });
}

/**
 * Busca o saldo e tombamentos disponíveis no estoque da unidade do gestor
 * @param {string} itemId - UID do material no inventário global
 */
async function buscarSaldoEstoqueGestor(itemId) {
    try {
        const unidadeId = currentUserData.unidade_id || "UNID-1767838511310";
        const saldoRef = db.collection('inventario').doc(itemId)
            .collection('saldos_unidades').doc(unidadeId);

        const doc = await saldoRef.get();

        if (!doc.exists) {
            return { total: 0, tombamentos: [] };
        }

        const data = doc.data();
        return {
            total: data.qtd_disp || 0,
            // Filtra apenas tombamentos que estão marcados como disponíveis no array
            tombamentos: data.tombamentos_disponiveis || []
        };
    } catch (e) {
        console.error("Erro ao buscar estoque:", e);
        return { total: 0, tombamentos: [] };
    }
}
async function carregarAlertasTransferencia() {
    const container = document.getElementById('resume-container');

    // Verifica se os dados básicos existem
    if (!currentUserData || !currentUserData.unidade_id) {
        // Se ainda não carregou, não exibe erro, apenas sai silenciosamente 
        // pois o setTimeout ou o switchView tentarão novamente.
        return;
    }

    // Se o usuário for Operacional, ele não recebe carga (geralmente), 
    // então paramos aqui para poupar processamento
    if (currentUserData.role === 'operacional') return;

    try {
        const minhaUnidadeId = currentUserData.unidade_id;

        const snap = await db.collection('transferencias_pendentes')
            .where('destino_id', '==', minhaUnidadeId)
            .where('status', '==', 'EM_TRANSITO')
            .get();

        if (snap.empty) {
            console.log("Nenhuma carga em trânsito para a unidade:", minhaUnidadeId);
            return;
        }

        // Se chegou aqui, há carga. Remove duplicados e insere.
        const alertaExistente = document.getElementById('alerta-carga-transito');
        if (alertaExistente) alertaExistente.remove();

        const alertaHtml = `
            <div id="alerta-carga-transito" class="op-card resume" style="background-color: #fff8e1; border-left-color: #f57c00; margin-bottom: 20px; animation: fadeIn 0.5s ease;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <i class="fas fa-truck-loading fa-2x" style="color: #f57c00;"></i>
                    <div style="flex: 1; text-align: left;">
                        <h3 style="margin: 0; color: #e65100; font-size: 1.1em;">Carga em Trânsito</h3>
                        <p style="margin: 5px 0 0 0; font-size: 0.9em; color: #666;">
                            Existem <b>${snap.size}</b> guias aguardando conferência nesta unidade.
                        </p>
                    </div>
                    <button class="btn-modern-action" style="background-color: #f57c00 !important;" onclick="abrirListaRecebimentoCarga()">
                        <i class="fas fa-clipboard-check"></i> Conferir
                    </button>
                </div>
            </div>`;

        if (container) {
            const alertaAntigo = document.getElementById('alerta-carga-transito');
            if (alertaAntigo) alertaAntigo.remove(); // Limpa apenas o dele, se houver

            container.insertAdjacentHTML('afterbegin', alertaHtml); // Insere no topo sem apagar os outros
        }

    } catch (e) {
        console.error("Erro na busca de transferências:", e);
    }
}
async function abrirListaRecebimentoCarga() {
    const minhaUnidadeId = currentUserData.unidade_id;
    const snap = await db.collection('transferencias_pendentes')
        .where('destino_id', '==', minhaUnidadeId)
        .where('status', '==', 'EM_TRANSITO')
        .get();

    if (snap.empty) {
        Swal.fire('Informação', 'Nenhuma carga em trânsito para sua unidade.', 'info');
        return;
    }

    let htmlLista = '<div style="text-align: left; max-height: 350px; overflow-y: auto; padding: 5px;">';

    snap.forEach(doc => {
        const tr = doc.data();

        // 1. Lógica do Número da Guia (TR-AAAA / Prefixo do ID)
        const ano = tr.timestamp_envio ? tr.timestamp_envio.toDate().getFullYear() : new Date().getFullYear();
        const guiaLegivel = `TR-${ano}/${doc.id.substring(0, 5).toUpperCase()}`;

        // 2. Cálculo do Volume Total - CORREÇÃO: Usando 'quantidade' conforme o banco
        const totalVolumes = tr.itens.reduce((acc, item) => acc + (Number(item.quantidade) || 0), 0);

        htmlLista += `
            <div class="result-vtr-card" onclick="iniciarRecebimentoCargaApp('${doc.id}')" 
                 style="margin-bottom: 12px; padding: 15px; border: 1px solid #eee; border-left: 6px solid #000; border-radius: 10px; cursor: pointer; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: transform 0.2s;">
                
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
                    <span style="font-weight: 800; color: #000; font-size: 1.1em;">${guiaLegivel}</span>
                    <span style="font-size: 0.75em; background: #f0f0f0; padding: 2px 8px; border-radius: 4px; color: #666;">
                        <i class="far fa-calendar-alt"></i> ${tr.timestamp_envio?.toDate().toLocaleDateString('pt-BR')}
                    </span>
                </div>

                <div style="font-size: 0.85em; color: #444; line-height: 1.5;">
                    <div style="margin-bottom: 4px;">
                        <i class="fas fa-user-edit" style="width: 18px; color: #888;"></i> 
                        Origem: <b>${tr.origem_sigla || 'DLOG'}</b> (${tr.emitente})
                    </div>
                    <div style="display: flex; gap: 15px; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #eee;">
                        <span><i class="fas fa-boxes" style="color: #2c3e50;"></i> Itens: <b>${tr.itens.length}</b></span>
                        <span><i class="fas fa-layer-group" style="color: #2c3e50;"></i> Volume Total: <b>${totalVolumes}</b></span>
                    </div>
                </div>
            </div>`;
    });

    htmlLista += '</div>';

    Swal.fire({
        title: '<i class="fas fa-truck-loading"></i> Cargas Destinadas à Unidade',
        html: htmlLista,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Fechar',
        customClass: {
            title: 'swal-title-left'
        }
    });
}
function iniciarRecebimentoCargaApp(transferenciaId) {
    Swal.close();

    const userUid = firebase.auth().currentUser.uid;
    const guerra = (currentUserData.nome_guerra || 'ND').toUpperCase();
    const posto = (currentUserData.posto || 'ND');
    const quadro = (currentUserData.quadro || 'ND');

    const url = `conferencia_app.html?transferenciaId=${transferenciaId}` +
        `&modo=recebimento_carga` +
        `&posto_grad=${encodeURIComponent(posto)}` +
        `&quadro_mil=${encodeURIComponent(quadro)}` +
        `&nome_guerra=${encodeURIComponent(guerra)}` +
        `&user_uid=${userUid}`;

    const container = document.getElementById('app-runner-container');
    const iframe = document.getElementById('app-iframe');

    if (container && iframe) {
        iframe.src = url;
        container.style.display = 'block';
    }
}
