/*--- RENDERIZA OS CARDS DE GESTÃO DE PENDÊNCIAS PARA ADMIN/GESTOR ---*/
function renderAdminGestorCards(canViewDashboardCards) {
    const containerPai = document.getElementById('admin-gestor-cards-container');
    const cardsContainer = document.getElementById('cards-container');
    const msgLoading = document.getElementById('loading-message-dashboard');
    const opContainer = document.getElementById('operacional-cards-container');
    const masterContainer = document.getElementById('dashboard-content-by-role');

    if (!containerPai || !cardsContainer) return;

    if (!canViewDashboardCards) {
        containerPai.style.setProperty('display', 'none', 'important');
        return;
    }

    const placeholder = document.getElementById('detail-placeholder');
    const detailsWrapper = document.querySelector('.sigma-v3-details-wrapper');
    const detailColumn = document.querySelector('.dashboard-detail-column');
    const caTableWrapper = document.getElementById('ca-table-wrapper');

    // 1. LIMPEZA TOTAL DA COLUNA DA DIREITA
    if (caTableWrapper) {
        // ✅ MATANDO A BARRA CINZA: Escondemos o wrapper e resetamos o tamanho
        caTableWrapper.style.setProperty('display', 'none', 'important');
        caTableWrapper.style.setProperty('height', '0', 'important');
        caTableWrapper.style.setProperty('padding', '0', 'important');

        caTableWrapper.innerHTML = `
            <div id="table-title"></div>
            <div id="no-issues-msg" style="display:none; text-align:center; padding:20px; color:#94a3b8;"></div>
            <div id="sigma-v3-dynamic-grid" class="sigma-v3-details-grid"></div>
        `;
    }

    // 2. RESET DE LAYOUT
    if (opContainer) opContainer.style.setProperty('display', 'none', 'important');

    if (masterContainer) {
        masterContainer.classList.remove('dashboard-operacional-full');
        masterContainer.style.setProperty('display', 'flex', 'important');
    }

    if (detailColumn) {
        detailColumn.style.setProperty('display', 'block', 'important');
        detailColumn.style.setProperty('background', '#fff', 'important'); // Coluna sempre branca
    }

    if (detailsWrapper) {
        detailsWrapper.style.setProperty('display', 'block', 'important');
        detailsWrapper.style.setProperty('background', 'transparent', 'important');
        detailsWrapper.style.setProperty('padding', '0', 'important');
        detailsWrapper.style.setProperty('border', 'none', 'important');
        detailsWrapper.style.setProperty('height', 'auto', 'important'); // ✅ Garante que ele não estique sozinho
    }

    // 3. DESENHO DO PLACEHOLDER
    if (placeholder) {
        placeholder.style.setProperty('display', 'flex', 'important');
        placeholder.style.setProperty('visibility', 'visible', 'important');

        // Altura otimizada para Desktop
        placeholder.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; min-height: 180px; color: #94a3b8; text-align: center; padding: 15px; background: #fff; border-radius: 12px;">
                <div style="background: #f8fafc; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; border: 1.5px dashed #e2e8f0;">
                    <i class="fas fa-mouse-pointer" style="font-size: 1.2em; color: #cbd5e1;"></i>
                </div>
                    <h3 style="margin: 0; font-size: 1rem; color: #475569; font-weight: 700;">Gestão de Pendências</h3>
                    <p style="font-size: 0.8rem; margin-top: 6px; color: #94a3b8; max-width: 220px; line-height: 1.3;">
                    Selecione um card de pendência à esquerda para detalhar as alterações.
                </p>
            </div>
        `;
    }

    containerPai.style.setProperty('display', 'block', 'important');
    loadCaaData();
}

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

        console.log("👤 LOG PERMISSÃO:", {
            nome: currentUserData.nome_militar_completo,
            role: currentUserData.role,
            unidadeIdDoGestor: gestorUnidadeId,
            ehAdmin: isAdmin
        });

        const snap = await db.collection(COLECAO_RESULTADOS).orderBy('timestamp', 'desc').limit(100).get();
        console.log(`📊 LOG BANCO: Encontrados ${snap.size} registros brutos em ${COLECAO_RESULTADOS}`);

        const map = {};
        const cacheUnidadesLista = {};

        for (const doc of snap.docs) {
            const d = doc.data();
            const lId = d.lista_id;
            const nomeViatura = d.local;

            if (map[lId]) continue;

            // 1. Identificação de Unidade
            let unidadeVinculada = d.unidade_id;
            let siglaVinculada = d.unidade_sigla || "GERAL";

            // Se o resultado for "órfão" (seu caso do ABT-18), busca na lista mestra
            if (!unidadeVinculada && lId) {
                console.log(`🔍 LOG TRIANGULAÇÃO: Buscando unidade para a viatura: ${nomeViatura} (ID: ${lId})`);
                if (!cacheUnidadesLista[lId]) {
                    const docLista = await db.collection('listas_conferencia').doc(lId).get();
                    if (docLista.exists) {
                        const dataL = docLista.data();
                        cacheUnidadesLista[lId] = {
                            id: dataL.unidade_id,
                            sigla: dataL.unidade_sigla
                        };
                        console.log(`✅ LOG TRIANGULAÇÃO: Viatura ${nomeViatura} pertence a: ${dataL.unidade_sigla} (ID: ${dataL.unidade_id})`);
                    } else {
                        console.warn(`⚠️ LOG TRIANGULAÇÃO: Lista Mestra ${lId} não encontrada no banco!`);
                    }
                }

                if (cacheUnidadesLista[lId]) {
                    unidadeVinculada = cacheUnidadesLista[lId].id;
                    siglaVinculada = cacheUnidadesLista[lId].sigla;
                }
            }

            // 2. Filtro de Pendências
            let pendenciasReais = [];
            const fonte = d.itensRelatorio || d.itensCaa || [];
            fonte.forEach(it => {
                if (it.status === 'C/A' && it.pendencias_ids) {
                    it.pendencias_ids.forEach(p => {
                        if (p.status_gestao !== 'RESOLVIDO') {
                            pendenciasReais.push({
                                ...p,
                                itemNome: it.nomeCompleto || it.nome,
                                itemId: it.id || it.uid_global,
                                tipoRegistro: 'PENDENCIA'
                            });
                        }
                    });
                }
            });

            // 3. Validação de Visibilidade com Log de Bloqueio
            const bateUnidade = (unidadeVinculada === gestorUnidadeId);
            const podeVer = isAdmin || bateUnidade;

            if (pendenciasReais.length > 0 && podeVer) {
    
                // ✅ LÓGICA DE EXIBIÇÃO DE SIGLA
                // Se for Admin Geral, podemos forçar a sigla "GERAL" para agrupar tudo,
                // ou manter a sigla real da unidade.
                let siglaParaExibir = siglaVinculada;
    
                if (isAdmin && !bateUnidade) {
                    // Se eu sou admin e estou vendo algo que não é da minha unidade 'sede'
                    // Posso escolher manter a sigla original ou marcar como GERAL.
                // siglaParaExibir = "GERAL"; // Descomente se quiser unificar tudo para o Admin
                }

                map[lId] = {
                    docId: doc.id,
                    lista_id: lId,
                    local: d.local,
                    conferente: d.conferente,
                    date: d.timestamp ? d.timestamp.toDate().toLocaleString('pt-BR') : 'N/D',
                    unidade_sigla: siglaParaExibir, // <--- Aqui define o grupo na tela
                    items: pendenciasReais
                };
            }
        }

        console.log("🖼️ LOG FINAL: Renderizando total de cards:", Object.keys(map).length);
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

    let rotas = {};
    try {
        const rotasDoc = await db.collection('config_geral').doc('rotas').get();
        rotas = rotasDoc.data() || {};
    } catch (e) { console.warn("Falha rotas:", e); }

    if (keys.length === 0) {
        container.innerHTML = `
            <div style="padding:60px; text-align:center; color:#64748b; width:100%;">
                <i class="fas fa-check-circle" style="font-size:4em; color:#1b8a3e; opacity:0.2; display:block; margin-bottom:20px;"></i>
                <b style="font-size:1.2em;">Tudo em Conformidade</b><br>Nenhuma pendência ativa identificada.
            </div>`;
        return;
    }

    // 1. AGRUPAMENTO INTELIGENTE (UNIFICAÇÃO)
    const groupedCards = {};
    keys.forEach(listaId => {
        const d = map[listaId];

        // ✅ Prioridade absoluta para a unidade gravada no documento de conferência
        // Isso impede que o Admin veja o mesmo item em 'GERAL' e na 'UNIDADE'
        const unit = d.unidade_sigla || rotas[listaId]?.unidade || 'OUTROS';

        if (!groupedCards[unit]) groupedCards[unit] = [];
        groupedCards[unit].push(d);
    });

    const sortedUnits = Object.keys(groupedCards).sort();

    sortedUnits.forEach(unit => {
        // ✅ Títulos Dinâmicos por Unidade
        const unitHeader = document.createElement('h3');
        unitHeader.className = 'unit-header';
        unitHeader.style.cssText = 'display: block; width: 100%; color: #800020; border-bottom: 2px solid rgba(0,0,0,0.05); padding-bottom: 10px; margin-top: 20px; margin-bottom: 15px; font-size: 1.1em; font-weight: 800; text-transform: uppercase;';

        // Ícone seletivo para categorias especiais
        const icon = (unit === 'OUTROS' || unit === 'GERAL') ? 'fa-folder-open' : 'fa-building';
        unitHeader.innerHTML = `<div class="unit-flex-title"><i class="fas ${icon}"></i> <span>${unit}</span></div>`;
        container.appendChild(unitHeader);

        const cardsList = groupedCards[unit];
        cardsList.forEach(d => {
            const allItems = d.items || [];
            const countTotal = allItems.length;
            const temAlteracao = countTotal > 0;

            const div = document.createElement('div');
            div.className = `sigma-v3-floating-card`;

            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <h3 style="margin:0; font-size: 1.2em; font-weight: 900; color: #1e293b;">${d.local}</h3>
                    <div class="sigma-v3-stat-badge ${!temAlteracao ? 'sigma-v3-card-ok-badge' : ''}">
                        ${countTotal === 0 ? '<i class="fas fa-check" style="font-size: 0.6em;"></i>' : countTotal}
                    </div>
                </div>
        
                <div style="margin-top: 10px;">
                    <span style="font-size: 0.7em; font-weight: 800; color: ${temAlteracao ? '#d90f23' : '#1b8a3e'}; text-transform: uppercase;">
                        ${temAlteracao ? '⚠️ Atenção Requerida' : '✅ Inventário em Dia'}
                    </span>
                </div>

                <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #f1f5f9;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-user-shield" style="color: #94a3b8; font-size: 0.8em;"></i>
                        <span style="font-size: 0.75em; color: #64748b; font-weight: 600;">${d.conferente}</span>
                    </div>
                    <small style="display: block; color: #94a3b8; font-size: 0.7em; margin-top: 4px; margin-left: 22px;">
                        ${d.date}
                    </small>
                </div>
            `;

            div.onclick = () => mostrarTabela(d);
            container.appendChild(div);
        });
    });
}

/*CRIA A TABELA DE PENDÊNCIAS COM BASE NOS DADOS FORNECIDOS PELO BACKEND (CA-ADMIN)*/
function mostrarTabela(data) {
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
    const wrapper = document.getElementById('ca-table-wrapper');
    const placeholder = document.getElementById('detail-placeholder');

    // 1. ESCONDE A TABELA (Mata a "Barra Cinza")
    if (wrapper) {
        // ✅ Usamos setProperty com important para garantir que o CSS não a mantenha visível
        wrapper.style.setProperty('display', 'none', 'important');
    }

    // 2. LÓGICA DE ESTADO MASTER-DETAIL
    // No Desktop, o placeholder DEVE voltar para não deixar o quadro branco
    if (window.innerWidth > 1100 && placeholder) {
        placeholder.style.setProperty('display', 'flex', 'important');
    }

    // 3. COMPORTAMENTO MOBILE
    if (window.innerWidth <= 1100) {
        // No mobile, apenas voltamos para a lista de cards
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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