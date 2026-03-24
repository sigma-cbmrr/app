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

        const snap = await db.collection(COLECAO_RESULTADOS).orderBy('timestamp', 'desc').limit(100).get();
        console.log(`📊 LOG BANCO: Encontrados ${snap.size} registros para análise.`);

        for (const doc of snap.docs) {
            const d = doc.data();
            const lId = d.lista_id;
            if (!lId) continue;

            if (map[lId]) continue;

            let unidadeVinculada = d.unidade_id;
            let siglaVinculada = d.unidade_sigla || "GERAL";

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

            const bateUnidade = (unidadeVinculada === gestorUnidadeId);
            const podeVer = isAdmin || bateUnidade;

            if (podeVer) {
                map[lId] = {
                    docId: doc.id,
                    lista_id: lId,
                    local: d.local,
                    conferente: d.conferente,
                    date: d.timestamp ? d.timestamp.toDate().toLocaleString('pt-BR') : 'N/D',
                    unidade_sigla: siglaVinculada,
                    items: []
                };

                const fonte = d.itensRelatorio || d.itensCaa || [];

                fonte.forEach(it => {
                    if (it.status === 'C/A' && it.pendencias_ids) {
                        it.pendencias_ids.forEach(p => {
                            if (p.status_gestao !== 'RESOLVIDO') {
                                map[lId].items.push({
                                    ...p,
                                    itemNome: it.nomeCompleto || it.nome,
                                    itemId: it.uid_global || it.id,
                                    uid_global: it.uid_global || it.id,
                                    sub_local: it.setor || it.sub_local || "CABINE", // ✅ CORREÇÃO: Captura o setor do item
                                    id_pai: null,
                                    tipoRegistro: 'PENDENCIA'
                                });
                            }
                        });
                    }

                    const acessorios = it.acessorios_vinculados || it.acessorios_acoplados || [];
                    if (acessorios.length > 0) {
                        acessorios.forEach(ac => {
                            if (ac.status === 'C/A' && ac.pendencias_ids) {
                                ac.pendencias_ids.forEach(pFilho => {
                                    if (pFilho.status_gestao !== 'RESOLVIDO') {
                                        map[lId].items.push({
                                            ...pFilho,
                                            itemNome: ac.nomeCompleto || ac.nome,
                                            itemId: ac.uid_global || ac.id,
                                            uid_global: ac.uid_global || ac.id,
                                            sub_local: it.setor || it.sub_local || "CABINE", // ✅ CORREÇÃO: Acessório herda o setor do pai
                                            id_pai: it.uid_global || it.id,
                                            tipoRegistro: 'PENDENCIA'
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            }
        }

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

        renderCards(map);

        if (window.listaAtivaId && map[window.listaAtivaId]) {
            mostrarTabela(map[window.listaAtivaId]);
        }

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
        <div style="padding: 60px 20px; text-align: center; width: 100%;">
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; opacity: 0.5;">
                
                <div style="position: relative; margin-bottom: 20px;">
                    <i class="fas fa-chart-line fa-4x" style="color: #cbd5e1;"></i>
                    <i class="fas fa-clipboard-list" style="position: absolute; bottom: -8px; right: -12px; font-size: 1.8em; color: #94a3b8; background: transparent; padding: 4px;"></i>
                </div>

                <h3 style="margin: 0; color: #475569; font-size: 1em; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">
                    Nenhuma Pendência Encontrada
                </h3>
                
                <p style="margin: 5px 0 0; color: #94a3b8; font-size: 0.85em; font-weight: 600;">
                    Não há listas de conferências ativas ou pendências registradas para sua unidade.
                </p>

                <p style="margin: 15px 0 0; color: #2c7399; font-size: 0.75em; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                    <i class="fas fa-info-circle"></i> Acesse o menu de listas para cadastrar uma nova
                </p>
            </div>
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
                // ✅ SALVA O ID DA LISTA PARA PERMITIR REFRESH SILENCIOSO
                window.listaAtivaId = d.lista_id; 

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

                // 4. Scroll suave para o topo da tabela
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
            container.appendChild(div);
        });
    });
}

/*CRIA A TABELA DE PENDÊNCIAS COM BASE NOS DADOS FORNECIDOS PELO BACKEND (CA-ADMIN)*/
function mostrarTabela(data) {
    const masterContainer = document.getElementById('dashboard-content-by-role'); 
    const detailColumn = document.querySelector('.dashboard-detail-column'); 

    if (masterContainer) masterContainer.classList.add('split-view');
    if (detailColumn) detailColumn.style.setProperty('display', 'block', 'important');

    const wrapper = document.getElementById('ca-table-wrapper');
    const gridContainer = document.getElementById('sigma-v3-dynamic-grid');
    const msgNoIssues = document.getElementById('no-issues-msg');
    const placeholder = document.getElementById('detail-placeholder');
    const tableTitle = document.getElementById('table-title');
    const detailsWrapper = document.querySelector('.sigma-v3-details-wrapper');

    if (!wrapper || !gridContainer) return;

    if (placeholder) {
        placeholder.style.setProperty('display', 'none', 'important');
    }

    if (detailsWrapper) {
        detailsWrapper.style.setProperty('background', '#f1f5f9', 'important');
        detailsWrapper.style.setProperty('padding', '20px', 'important');
        detailsWrapper.style.setProperty('border-radius', '16px', 'important');
    }

    wrapper.style.setProperty('display', 'block', 'important');
    wrapper.style.setProperty('height', 'auto', 'important');

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

            const idRealParaBusca = p.uid_global || p.itemId;
            const detectIsMulti = (p.tombamento && p.tombamento !== "" && p.tombamento !== "N/A");

            const btnData = {
                docId: data.docId,
                pendId: p.id,
                idPai: p.id_pai || null, 
                item: {
                    id: idRealParaBusca, 
                    uid_global: idRealParaBusca, 
                    nome: p.itemNome,
                    tombamento: p.tombamento || "",
                    tipo_controle: detectIsMulti ? 'multi' : 'single',
                    qtd_pendente: p.quantidade || 1,
                    descricao: p.descricao,
                    setor: p.sub_local // ✅ MUDANÇA CIRÚRGICA: Alterado de p.setor para p.sub_local
                }
            };

            const btnJson = JSON.stringify(btnData).replace(/'/g, "\\'");

            const card = document.createElement('div');
            card.className = 'sigma-v3-card-item';

            const prefixoFilho = (p.id_pai && p.id_pai !== p.itemId) ?
                `<span style="font-size: 0.65em; color: #800020; font-weight: 800; display: block; margin-bottom: 4px;"><i class="fas fa-paperclip"></i> ACESSÓRIO DE KIT</span>` : '';

            card.innerHTML = `
                <div class="sigma-v3-card-header">
                    <span class="sigma-v3-badge" style="background: ${badgeBg}; color: ${colorRef};">
                        <i class="fas ${iconRef}"></i> ${statusG}
                    </span>
                    <span class="sigma-v3-date">
                        <i class="far fa-calendar-alt"></i> ${p.data_criacao || data.date.split(',')[0]}
                    </span>
                </div>
                ${prefixoFilho}
                
                <h4 style="margin-bottom: 5px;">${p.itemNome}</h4>

                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 12px;">
                    <span style="background: #f8fafc; color: #64748b; font-size: 9px; font-weight: 800; padding: 3px 8px; border-radius: 6px; border: 1px solid #e2e8f0; text-transform: uppercase; letter-spacing: 0.5px;">
                        <i class="fas fa-map-marker-alt" style="margin-right: 4px; color: #94a3b8;"></i>
                        ${p.sub_local || 'Localização não definida'} </span>
                </div>

                <div style="display: flex; gap: 10px; font-size: 0.75em; font-weight: 800; text-transform: uppercase; margin-bottom: 10px;">
                    ${detectIsMulti ?
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

async function abrirGestaoPendencia(data) {
    const { docId, item, pendId, idPai } = data;
    const unidadeGestor = currentUserData.unidade_id;

    Swal.fire({
        title: 'Carregando Opções...',
        html: '<i class="fas fa-circle-notch fa-spin fa-2x" style="color:#800020;"></i>',
        showConfirmButton: false,
        allowOutsideClick: false
    });

    // 1. BUSCA DE DADOS EM TEMPO REAL
    const [saldoEstoque, snapVirtual] = await Promise.all([
        buscarSaldoEstoqueGestor(item.id || item.uid_global),
        db.collection('inventario').doc(item.id || item.uid_global)
          .collection('tombamentos').where('uid_pendencia', '==', pendId).limit(1).get()
    ]);

    // ✅ CORREÇÃO: Redefinimos isMulti com base no tipo REAL que veio do banco de dados
    const tipoRealDoBanco = saldoEstoque.tipo || item.tipo_controle || item.tipo;
    const isMulti = tipoRealDoBanco === 'multi';

    const virtualDoc = !snapVirtual.empty ? snapVirtual.docs[0].data() : null;
    const localizacaoReal = virtualDoc?.sub_local || item.sub_local || 'N/D';

    Swal.fire({
        title: 'GESTÃO DE ATIVOS',
        width: '600px',
        html: `
            <div style="text-align: left; font-family: 'Inter', sans-serif;">
                <div style="margin-bottom: 20px; border-left: 4px solid #800020; padding-left: 15px;">
                    <b style="color: #1e293b; font-size: 1.1rem; display: block;">${item.nome}</b>
                    <div style="display:flex; gap: 10px; margin-top: 5px;">
                        <span style="font-size: 0.7rem; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-weight: 800; color: #475569;">
                            <i class="fas fa-map-marker-alt"></i> ${localizacaoReal}
                        </span>
                        <span style="font-size: 0.7rem; background: #fff1f2; padding: 2px 8px; border-radius: 4px; font-weight: 800; color: #be123c;">
                            <i class="fas fa-layer-group"></i> ${item.qtd_pendente || 1} UN. PENDENTE
                        </span>
                    </div>
                </div>

                <label style="font-weight: 800; font-size: 0.65rem; color: #64748b; text-transform: uppercase; margin-bottom: 10px; display: block;">Escolha a ação desejada:</label>
                
                <div class="sigma-gestao-cards-container" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px;">
                    <div class="gestao-card" onclick="selectGestaoCard(this, 'Solucionado')" style="border: 2px solid #e2e8f0; background: #fff; padding: 15px; border-radius: 12px; cursor: pointer; text-align: center; transition: 0.2s;">
                        <i class="fas fa-check-circle" style="color: #94a3b8; font-size: 1.5rem; margin-bottom: 8px;"></i>
                        <b style="display: block; font-size: 0.7rem; color: #64748b; text-transform: uppercase;">Resolver</b>
                    </div>
                    <div class="gestao-card" onclick="selectGestaoCard(this, 'Substituir')" style="border: 2px solid #e2e8f0; background: #fff; padding: 15px; border-radius: 12px; cursor: pointer; text-align: center; transition: 0.2s;">
                        <i class="fas fa-exchange-alt" style="color: #94a3b8; font-size: 1.5rem; margin-bottom: 8px;"></i>
                        <b style="display: block; font-size: 0.7rem; color: #64748b; text-transform: uppercase;">Substituir</b>
                    </div>
                    <div class="gestao-card" onclick="selectGestaoCard(this, 'Em solução')" style="border: 2px solid #e2e8f0; background: #fff; padding: 15px; border-radius: 12px; cursor: pointer; text-align: center; transition: 0.2s;">
                        <i class="fas fa-tools" style="color: #94a3b8; font-size: 1.5rem; margin-bottom: 8px;"></i>
                        <b style="display: block; font-size: 0.7rem; color: #64748b; text-transform: uppercase;">Manutenção</b>
                    </div>
                </div>

                <input type="hidden" id="swal-gestao-status" value="">

                <div id="swal-div-substituir" style="display:none; background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px dashed #cbd5e1; margin-bottom: 15px;">
                     <p style="font-size: 0.7rem; font-weight: 800; color: #2c7399; margin-bottom: 10px; text-transform: uppercase;">
                        <i class="fas fa-warehouse"></i> Estoque Disponível: <span style="font-size: 1rem; color: #1e293b;">${saldoEstoque.total} un.</span>
                    </p>
                    
                    ${isMulti ? `
                        <label style="font-weight: 800; font-size: 0.65rem; color: #475569; display: block; margin-bottom: 5px;">SELECIONE O NOVO PATRIMÔNIO:</label>
                        <select id="swal-novo-tombamento" class="sigma-v3-select" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #2c7399; background: white; font-weight: 700;">
                            <option value="">-- Escolha o tombamento para reposição --</option>
                            ${saldoEstoque.lista_tombamentos.map(t => `
                                <option value="${t.tomb}">
                                    🔹 ${t.tomb} ${t.serie !== 'S/N' ? `| S/N: ${t.serie}` : ''}
                                </option>
                            `).join('')}
                        </select>
                        <p style="font-size: 0.6rem; color: #64748b; margin-top: 5px;">* Apenas itens em estoque com status 'DISPONÍVEL' são exibidos.</p>
                    ` : `
                        <div style="background: #eff6ff; padding: 10px; border-radius: 8px; border: 1px solid #bfdbfe;">
                            <p style="font-size: 0.7rem; color: #1e40af; line-height: 1.4; margin: 0;">
                                <i class="fas fa-info-circle"></i> <b>Item de Consumo/Single:</b> O sistema utilizará 01 unidade virtual livre do seu almoxarifado para realizar a troca.
                            </p>
                        </div>
                    `}
                </div>

                <div class="form-group">
                    <label style="font-weight: 800; font-size: 0.65rem; color: #64748b; text-transform: uppercase; margin-bottom: 5px; display: block;">Justificativa / Despacho</label>
                    <textarea id="swal-gestao-obs" style="width: 100%; min-height: 80px; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.8rem; color: #334155;"></textarea>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'CONFIRMAR AÇÃO',
        confirmButtonColor: '#1b8a3e',
        preConfirm: () => {
            const status = document.getElementById('swal-gestao-status').value;
            const obs = document.getElementById('swal-gestao-obs').value.trim();
            const novoTomb = document.getElementById('swal-novo-tombamento')?.value;

            if (!status) return Swal.showValidationMessage('Selecione uma ação clicando nos cards.');
            if (!obs) return Swal.showValidationMessage('Descreva a justificativa.');
            
            if (status === 'Substituir') {
                if (saldoEstoque.total < 1) return Swal.showValidationMessage('Estoque insuficiente no Almoxarifado.');
                if (isMulti && !novoTomb) return Swal.showValidationMessage('Você precisa selecionar o tombamento do novo item.');
            }

            return { status, obs, novoTomb, tipo_item: tipoRealDoBanco, qtd: 1, virtualId: virtualDoc?.tomb || null };
        }
    }).then((result) => {
        if (result.isConfirmed) executarAcaoGestao({ ...data, ...result.value });
    });

    window.selectGestaoCard = (el, val) => {
        document.querySelectorAll('.gestao-card').forEach(c => {
            c.classList.remove('active');
            c.style.borderColor = '#e2e8f0';
            c.style.background = '#fff';
            c.querySelector('i').style.color = '#94a3b8';
            c.querySelector('b').style.color = '#64748b';
        });

        el.classList.add('active');
        document.getElementById('swal-gestao-status').value = val;
        
        const colors = { 'Solucionado': '#1b8a3e', 'Substituir': '#2c7399', 'Em solução': '#f59e0b' };
        const bgs = { 'Solucionado': '#f0fdf4', 'Substituir': '#f0f9ff', 'Em solução': '#fffbeb' };
        const textColors = { 'Solucionado': '#166534', 'Substituir': '#1e40af', 'Em solução': '#92400e' };

        el.style.borderColor = colors[val];
        el.style.background = bgs[val];
        el.querySelector('i').style.color = colors[val];
        el.querySelector('b').style.color = textColors[val];

        document.getElementById('swal-div-substituir').style.display = val === 'Substituir' ? 'block' : 'none';
    };
}

/*--- Ação principal para processar a decisão do gestor (Sincronizada para Pai/Filho) ---*/
async function executarAcaoGestao(data) {
    const { docId, item, pendId, idPai, status, obs, qtd, novoTomb, virtualId } = data;
    const batch = db.batch();
    const dataHora = new Date().toLocaleString('pt-BR');
    const nomeGestor = `${currentUserData.posto} ${currentUserData.nome_guerra}`;
    const unidadeId = currentUserData.unidade_id;
    const unidadeSigla = currentUserData.unidade_sigla || "N/D";

    try {
        Swal.fire({ title: 'Sincronizando Banco de Dados...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const resRef = db.collection('resultados_conferencias').doc(docId);
        const resSnap = await resRef.get();
        if (!resSnap.exists) throw new Error("Documento de conferência não encontrado.");

        let { itensRelatorio, lista_id } = resSnap.data();
        const idMaterial = item.id || item.uid_global;
        const itemRef = db.collection('inventario').doc(idMaterial);
        const saldoRef = itemRef.collection('saldos_unidades').doc(unidadeId);
        const pathCache = `unidades_cache.${unidadeId}`;

        // --- 1. LOCALIZAÇÃO DO ALVO NO RELATÓRIO (CORREÇÃO CIRÚRGICA V3) ---
        let alvoParaRemover = null;
        for (const it of itensRelatorio) {
            if (it.pendencias_ids && it.pendencias_ids.some(p => String(p.id) === String(pendId))) {
                alvoParaRemover = it;
                break;
            }
            const acessorios = it.acessorios_vinculados || it.acessorios_acoplados || [];
            const acAlvo = acessorios.find(ac => ac.pendencias_ids && ac.pendencias_ids.some(p => String(p.id) === String(pendId)));
            if (acAlvo) {
                alvoParaRemover = acAlvo;
                break;
            }
        }

        if (!alvoParaRemover) throw new Error("Pendência não localizada no relatório (Erro de Sincronismo).");

        const pIdx = alvoParaRemover.pendencias_ids.findIndex(p => String(p.id) === String(pendId));
        if (pIdx === -1) throw new Error("Pendência não localizada no relatório.");
        
        const pendenciaOriginal = alvoParaRemover.pendencias_ids[pIdx];
        const isMulti = item.tipo_controle === 'multi' || item.tipo === 'multi';

        // 2. BUSCA DE UNIDADES AFETADAS NO RASTREIO
        const snapTombamentos = await itemRef.collection('tombamentos')
            .where('unidade_id', '==', unidadeId)
            .where('uid_pendencia', '==', pendId).get();

        const docsAfetados = snapTombamentos.docs;

        // --- CASO 1: RESOLVER (SANEAMENTO INTELIGENTE) ---
        if (status === 'Solucionado') {
            const qtdParaSanear = Number(qtd);
            const docsParaLiberar = docsAfetados.slice(0, qtdParaSanear);

            docsParaLiberar.forEach(docSnap => {
                const tData = docSnap.data();
                const tRef = docSnap.ref;
                const statusDestino = (tData.local_id === "VIATURA") ? "EM CARGA" : "DISPONÍVEL";

                batch.update(tRef, {
                    situacao_atual: statusDestino,
                    motivo_pendencia: firebase.firestore.FieldValue.delete(),
                    uid_pendencia: firebase.firestore.FieldValue.delete(),
                    atualizado_por: nomeGestor,
                    atualizado_em: dataHora
                });

                // ✅ Ajuste no histórico individual
                const identMsg = isMulti ? `Tombamento ${tData.tomb}` : `1un de ITEM DE CONSUMO`;
                batch.set(tRef.collection('historico_vida').doc(), {
                    data: dataHora, evento: "SOLUCAO_PENDENCIA", quem: nomeGestor,
                    detalhes: `✅ Pendência resolvida para ${identMsg}. Definido como ${statusDestino} no local ${tData.local_id}. Obs: ${obs}`, 
                    unidade: unidadeSigla
                });
            });

            if (qtdParaSanear >= pendenciaOriginal.quantidade) {
                alvoParaRemover.pendencias_ids.splice(pIdx, 1);
            } else {
                pendenciaOriginal.quantidade -= qtdParaSanear;
                pendenciaOriginal.descricao += `\n[SANEAMENTO PARCIAL]: Resolvido ${qtdParaSanear} un. por ${nomeGestor}`;
            }

            batch.update(saldoRef, { uso_pend: firebase.firestore.FieldValue.increment(-qtdParaSanear), last_update: dataHora });
            batch.update(itemRef, { [`${pathCache}.uso_pend`]: firebase.firestore.FieldValue.increment(-qtdParaSanear) });
            
            batch.set(saldoRef.collection('historico_vida').doc(), {
                data: dataHora, evento: "SANEAMENTO", quem: nomeGestor,
                detalhes: `Baixa de -${qtdParaSanear} un. em uso_pend (Pendência resolvida).`, unidade: unidadeSigla
            });
        }

        // --- CASO 2: SUBSTITUIR (O "SWAP" DE PATRIMÔNIO E ATUALIZAÇÃO DE LISTA) ---
        else if (status === 'Substituir') {
            const docRuim = docsAfetados[0]; 
            if (!docRuim) throw new Error("Registro da unidade avariada não localizado no rastreio.");
            const dataRuim = docRuim.data();

            const despachoGestor = `[SUBSTITUIÇÃO VIA GESTÃO - ${nomeGestor}]: ${obs}`;

            let docNovoReposicao = null;
            if (isMulti) {
                if (!novoTomb) throw new Error("Nenhum novo patrimônio foi selecionado.");
                const snapNovo = await itemRef.collection('tombamentos').doc(novoTomb).get();
                if (snapNovo.exists) docNovoReposicao = snapNovo;
            } else {
                const snapDisp = await itemRef.collection('tombamentos')
                    .where('unidade_id', '==', unidadeId)
                    .where('situacao_atual', '==', 'DISPONÍVEL')
                    .where('local_id', '==', 'ALMOXARIFADO').limit(1).get();
                if (!snapDisp.empty) docNovoReposicao = snapDisp.docs[0];
            }

            if (!docNovoReposicao) throw new Error("Unidade de reposição não localizada no estoque.");
            const dataNovo = docNovoReposicao.data();

            // ✅ MELHORIA: Identificação textual amigável (Esconde UID Virtual)
            const identRuimMsg = isMulti ? dataRuim.tomb : "1un avariada";
            const identNovoMsg = isMulti ? dataNovo.tomb : "1un boa";

            // A. O "Ruim" volta para o Almoxarifado
            batch.update(docRuim.ref, {
                situacao_atual: "PENDENTE", local_id: "ALMOXARIFADO", viatura_id: null,
                sub_local: dataNovo.sub_local || "ALMOXARIFADO", 
                uid_pendencia: firebase.firestore.FieldValue.delete(),
                motivo_pendencia: despachoGestor, atualizado_por: nomeGestor, atualizado_em: dataHora
            });
            
            batch.set(docRuim.ref.collection('historico_vida').doc(), {
                data: dataHora, evento: "RECOLHIMENTO_AVARIA", quem: nomeGestor,
                detalhes: `♻️ Substituído por ${identNovoMsg}. Enviado para: ALMOXARIFADO. Motivo: ${obs}`, 
                unidade: unidadeSigla
            });

            // B. O "Novo" sai do estoque para a viatura
            batch.update(docNovoReposicao.ref, {
                situacao_atual: "EM CARGA", local_id: "VIATURA",
                viatura_id: lista_id || dataRuim.viatura_id, 
                sub_local: dataRuim.sub_local || "N/D",
                data_movimentacao: dataHora, atualizado_por: nomeGestor
            });
            
            batch.set(docNovoReposicao.ref.collection('historico_vida').doc(), {
                data: dataHora, evento: "SUBSTITUICAO_CARGA", quem: nomeGestor,
                detalhes: `✅ Alocado na VTR para substituir o item avariado (${identRuimMsg}).`, 
                unidade: unidadeSigla
            });

            // C. ATUALIZAÇÃO CIRÚRGICA DA LISTA_CONFERENCIA (VIATURA)
            const idNovoParaLista = isMulti ? `${idMaterial}-${dataNovo.tomb}` : `${idMaterial}_${dataRuim.setor_id || 'setor'}`;
            const listaRef = db.collection('listas_conferencia').doc(lista_id);
            const listaSnap = await listaRef.get();
            
            if (listaSnap.exists) {
                let { list } = listaSnap.data();
                let mudou = false;
                list = list.map(setor => ({
                    ...setor,
                    itens: setor.itens.map(it => {
                        if (it.uid_instancia === dataRuim.uid_instancia || it.id === dataRuim.id) {
                            mudou = true;
                            return { 
                                ...it, 
                                id: idNovoParaLista, 
                                uid_instancia: idNovoParaLista,
                                tombamentos: isMulti ? [{ ...dataNovo, situacao_atual: "EM CARGA", viatura_id: lista_id }] : (it.tombamentos || []),
                                tombamento: isMulti ? dataNovo.tomb : (it.tombamento || "")
                            };
                        }
                        return it;
                    })
                }));
                if (mudou) batch.update(listaRef, { list, editado_por: nomeGestor, atualizado_em: firebase.firestore.FieldValue.serverTimestamp() });
            }

            alvoParaRemover.pendencias_ids.splice(pIdx, 1);
            
            const updatesSaldo = {
                disp: firebase.firestore.FieldValue.increment(-1),
                pend: firebase.firestore.FieldValue.increment(1),
                uso_pend: firebase.firestore.FieldValue.increment(-1),
                last_update: dataHora
            };
            batch.update(saldoRef, updatesSaldo);
            batch.update(itemRef, {
                [`${pathCache}.disp`]: firebase.firestore.FieldValue.increment(-1),
                [`${pathCache}.pend`]: firebase.firestore.FieldValue.increment(1),
                [`${pathCache}.uso_pend`]: firebase.firestore.FieldValue.increment(-1)
            });

            // ✅ Correção no Histórico de Saldo (Onde aparece o log da imagem b847a2.png)
            batch.set(saldoRef.collection('historico_vida').doc(), {
                data: dataHora, evento: "SUBSTITUICAO", quem: nomeGestor,
                detalhes: `♻️ Troca realizada: 1un boa alocada na carga, 1un avariada (${identRuimMsg}) recolhida ao estoque.`, 
                unidade: unidadeSigla
            });
        }

        // --- CASO 3: MANTER (APENAS ATUALIZA DESPACHO) ---
        else if (status === 'Em solução') {
            const despachoFormatado = `⚖️ [GESTÃO - ${dataHora}]: ${obs}`;
            pendenciaOriginal.descricao += `\n${despachoFormatado}`;
            pendenciaOriginal.status_gestao = 'EM SOLUÇÃO';

            docsAfetados.forEach(docSnap => {
                const tRef = docSnap.ref;
                batch.update(tRef, {
                    motivo_pendencia: despachoFormatado,
                    atualizado_por: nomeGestor,
                    atualizado_em: dataHora
                });
                
                batch.set(tRef.collection('historico_vida').doc(), {
                    data: dataHora, evento: "ATUALIZACAO_GESTAO", quem: nomeGestor,
                    detalhes: despachoFormatado, unidade: unidadeSigla
                });
            });
        }

        // 3. FINALIZAÇÃO E COMMIT
        if (alvoParaRemover.pendencias_ids.length === 0) alvoParaRemover.status = 'S/A';

        batch.update(resRef, { itensRelatorio });
        await batch.commit();

        Swal.fire({ icon: 'success', title: 'Ação Registrada!', text: 'Inventário e Histórico atualizados corretamente.', timer: 1500, showConfirmButton: false });
        if (typeof loadCaaData === 'function') loadCaaData();

    } catch (e) {
        console.error("🚨 ERRO NA GESTÃO V3:", e);
        Swal.fire('Falha na Operação', e.message, 'error');
    }
}

// Helper para Histórico de Vida
function registrarHistoricoVida(batch, itemId, evento, detalhes, qtd, tombId = null) {
    const unidadeId = currentUserData.unidade_id;
    const unidadeSigla = currentUserData.unidade_sigla || "N/D";
    const nomeMilitar = `${currentUserData.posto} ${currentUserData.nome_guerra}`;
    const dataReg = new Date().toLocaleString('pt-BR');

    // 1. NORMALIZAÇÃO DO ID GLOBAL
    // Se o itemId vier com o tombamento (ex: ITEM-0001-V-UID...), extraímos apenas o pai
    const partes = itemId.split('-');
    const ehComposto = partes.length > 2 && (itemId.includes('V-UID') || partes.length > 4);
    const docIdGlobal = ehComposto ? partes.slice(0, 2).join('-') : itemId;
    
    // Se não recebemos tombId por parâmetro, mas o itemId é composto, extraímos o tombId dele
    const idUnidadeFisica = tombId || (ehComposto ? partes.slice(2).join('-') : null);

    let histRef;

    if (idUnidadeFisica) {
        // ✅ LOG UNITÁRIO (Forense): Grava na ficha individual do item (Patrimônio ou V-UID)
        // Isso garante que cada Peça Facial ou Amplificador tenha seu prontuário próprio.
        histRef = db.collection('inventario')
            .doc(docIdGlobal)
            .collection('tombamentos')
            .doc(idUnidadeFisica)
            .collection('historico_vida')
            .doc();
            
        console.log(`📝 Log Unitário: ${docIdGlobal} -> ${idUnidadeFisica}`);
    } else {
        // ✅ LOG DE SALDO (Contábil): Grava na subcoleção de saldos da unidade
        // Usado para itens de consumo sem rastreio ou quando a ação é no montante.
        histRef = db.collection('inventario')
            .doc(docIdGlobal)
            .collection('saldos_unidades')
            .doc(unidadeId)
            .collection('historico_vida')
            .doc();

        console.log(`📈 Log de Saldo: ${docIdGlobal} [${unidadeSigla}]`);
    }

    // 2. GRAVAÇÃO DO EVENTO (PADRÃO SIGMA V3)
    batch.set(histRef, {
        data: dataReg,
        evento: evento.toUpperCase(),
        quem: nomeMilitar,
        unidade: unidadeSigla,
        detalhes: detalhes,
        quantidade: Number(qtd) || 0,
        origem: "SISTEMA_GESTAO_V3",
        tipo_registro: idUnidadeFisica ? "INDIVIDUAL" : "COLETIVO"
    });
}

async function buscarSaldoEstoqueGestor(itemId) {
    try {
        const unidadeId = currentUserData.unidade_id || "UNID-1767838511310";
        const itemRef = db.collection('inventario').doc(itemId);
        
        const docPrincipal = await itemRef.get();
        if (!docPrincipal.exists) return { total: 0, lista_tombamentos: [] };
        
        const infoItem = docPrincipal.data();
        // Normalizamos para minúsculo para evitar erros de digitação (Multi vs multi)
        const tipoReal = (infoItem.tipo || "").toLowerCase();
        const ehMulti = tipoReal === 'multi';

        const saldoRef = itemRef.collection('saldos_unidades').doc(unidadeId);
        const docSaldo = await saldoRef.get();

        if (!docSaldo.exists) return { total: 0, lista_tombamentos: [], tipo: tipoReal };

        const dataSaldo = docSaldo.data();
        const totalDisponivel = dataSaldo.disp || 0;

        let listaCompletaTombamentos = [];
        if (ehMulti) {
            const snapTomb = await itemRef.collection('tombamentos')
                .where('unidade_id', '==', unidadeId)
                .where('situacao_atual', '==', 'DISPONÍVEL')
                .where('local_id', '==', 'ALMOXARIFADO')
                .get();

            snapTomb.forEach(doc => {
                const tData = doc.data();
                listaCompletaTombamentos.push({
                    tomb: doc.id,
                    serie: tData.serie || "S/N",
                    status_conservacao: tData.status_conservacao || "N/A"
                });
            });
        }

        return {
            total: totalDisponivel,
            lista_tombamentos: listaCompletaTombamentos,
            tipo: tipoReal // ✅ RETORNA O TIPO REAL DO BANCO
        };
        
    } catch (e) {
        console.error("🚨 ERRO BUSCA ESTOQUE:", e);
        return { total: 0, lista_tombamentos: [] };
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