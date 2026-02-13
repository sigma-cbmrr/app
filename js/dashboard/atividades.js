//====================================//
//--- BLOCO: NAVEGAÇÃO E CONTROLE ---//
//===================================//

//=== Alterna entre a visão do Militar (Pessoal) e a visão do Gestor (Unidade) ===//
function switchAtividadesTab(tab) {
    // 1. Definição de elementos
    const contentPessoal = document.getElementById('content-pessoal');
    const contentUnidade = document.getElementById('content-unidade');
    const btnPessoal = document.getElementById('tab-pessoal');
    const btnUnidade = document.getElementById('tab-unidade');
    const titleSpan = document.getElementById('atividades-main-title');

    // 2. Lógica de troca
    if (tab === 'pessoal') {
        if (contentPessoal) contentPessoal.style.display = 'block';
        if (contentUnidade) contentUnidade.style.display = 'none';

        btnPessoal.classList.add('active');
        btnUnidade.classList.remove('active');
        titleSpan.innerText = 'Atividades Pessoais';

        loadMyHistory(); // Recarrega os dados pessoais
    } else {
        if (contentPessoal) contentPessoal.style.display = 'none';
        if (contentUnidade) contentUnidade.style.display = 'block';

        btnPessoal.classList.remove('active');
        btnUnidade.classList.add('active');
        titleSpan.innerText = 'Gestão de Registros (Unidade)';

        // ✅ GATILHOS DE SEGURANÇA E FILTRO
        // Carrega os filtros baseados na Unidade do Gestor antes de listar o histórico
        carregarLocaisFiltroHistorico(); 
        carregarUsuariosFiltro();
        
        loadGlobalHistory(); // Recarrega os dados da unidade
    }
}

//=== CARREGA O FILTRO DE USUÁRIOS NA ABA DE ATIVIDADES DA UNIDADE ===//
async function carregarUsuariosFiltro() {
    const select = document.getElementById('glob-hist-user');
    if (!select) return;

    select.innerHTML = '<option value="">Todos</option>';

    // ✅ AJUSTE: O Gestor agora filtra pelo unidade_id (mais seguro e preciso)
    const isGestor = currentUserData.role === 'gestor';
    const unidadeIdGestor = currentUserData.unidade_id;

    let userQuery = db.collection('usuarios');

    if (isGestor && unidadeIdGestor) {
        userQuery = userQuery.where('unidade_id', '==', unidadeIdGestor);
    }

    try {
        const snap = await userQuery.get();
        let users = [];
        snap.forEach(doc => {
            const u = doc.data();
            if (u.nome_militar_completo) {
                users.push(u.nome_militar_completo);
            }
        });

        // Remove duplicatas e ordena alfabeticamente
        [...new Set(users)].sort().forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            select.appendChild(opt);
        });

    } catch (e) {
        console.error("Erro ao carregar filtro de usuários:", e);
    }
}

//==============================================//
//--- BLOCO: CARREGAMENTO DE DADOS (Queries) ---//
//==============================================//

//=== CARREGA A ABA DE ATIVIDADES PESSOAIS (HISTÓRICO DE CONFERÊNCIAS, CHECKLISTS E TRANSFERÊNCIAS) ===//
async function loadMyHistory() {
    const ul = document.getElementById('my-history-list');
    const conferenteUid = firebase.auth()?.currentUser?.uid;

    if (!ul || !conferenteUid) return;

    // ✅ Feedback visual moderno durante o carregamento
    ul.innerHTML = `
        <div style="text-align:center; padding:40px; color:#64748b;">
            <i class="fas fa-sync fa-spin fa-2x"></i>
            <p style="margin-top:10px; font-weight:600;">Sincronizando sua linha do tempo...</p>
        </div>`;

    const startDateInput = document.getElementById('my-hist-start').value;
    const endDateInput = document.getElementById('my-hist-end').value;

    if (!startDateInput || !endDateInput) {
        ul.innerHTML = `
            <div style="text-align:center; padding:40px; color:#d90f23; background: #fff1f2; border-radius:15px;">
                <i class="fas fa-calendar-exclamation fa-2x"></i>
                <p style="margin-top:10px; font-weight:800;">Atenção: Selecione as datas de início e fim.</p>
            </div>`;
        return;
    }

    const startTimestamp = firebase.firestore.Timestamp.fromDate(new Date(startDateInput + 'T00:00:00'));
    const endTimestamp = firebase.firestore.Timestamp.fromDate(new Date(endDateInput + 'T23:59:59'));

    try {
        const [snapMat, snapCheck, snapTrans] = await Promise.all([
            db.collection('resultados_conferencias')
                .where('conferente_uid', '==', conferenteUid)
                .where('timestamp', '>=', startTimestamp)
                .where('timestamp', '<=', endTimestamp).get(),

            db.collection('resultados_checklist')
                .where('conferente_uid', '==', conferenteUid)
                .where('timestamp', '>=', startTimestamp)
                .where('timestamp', '<=', endTimestamp).get(),

            db.collection('transferencias_pendentes')
                .where('status', '==', 'RECEBIDO')
                .where('recebedor_uid', '==', conferenteUid).get()
        ]);

        let docs = [];

        snapMat.forEach(doc => docs.push({ ...doc.data(), id_doc: doc.id }));
        snapCheck.forEach(doc => docs.push({ ...doc.data(), id_doc: doc.id }));

        snapTrans.forEach(doc => {
            const d = doc.data();
            const ts = d.timestamp_recebimento;
            if (ts && ts.seconds >= startTimestamp.seconds && ts.seconds <= endTimestamp.seconds) {
                const itensNormalizados = (d.itens || []).map(item => ({
                    nomeCompleto: item.tombamento ? `${item.nome} (Tomb: ${item.tombamento})` : item.nome,
                    quantidade: item.quantidade || 1,
                    status: item.status_recebimento || 'S/A',
                    setor: item.setor || "CARGA",
                    obs: item.observacao_recebimento || ''
                }));

                docs.push({
                    ...d,
                    id_doc: doc.id,
                    modo: 'TRANSFERENCIA_CARGA',
                    local: `TRANSFERÊNCIA: ${d.origem_sigla} > ${d.destino_sigla}`,
                    timestamp: ts,
                    conferente: d.recebedor_nome,
                    itensRelatorio: itensNormalizados,
                    totalItensConferidos: itensNormalizados.length,
                    totalCaa: itensNormalizados.filter(i => i.status !== 'S/A').length,
                    id_amigavel: `TR-${new Date(ts.seconds * 1000).getFullYear()}/${doc.id.substring(0, 5).toUpperCase()}`
                });
            }
        });

        docs.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);

        let html = '';
        docs.forEach(d => {
            html += criarItemHistoricoHTML(d);
        });

        // ✅ Renderização final na Timeline
        ul.innerHTML = html || `
            <div style="text-align:center; padding:60px; color:#94a3b8;">
                <i class="fas fa-folder-open fa-3x" style="opacity:0.2;"></i>
                <p style="margin-top:15px; font-weight:600;">Nenhum registro encontrado para este período.</p>
            </div>`;

    } catch (e) {
        console.error("Erro no histórico:", e);
        ul.innerHTML = `
            <div style="text-align:center; padding:40px; color:#d90f23;">
                <i class="fas fa-exclamation-circle fa-2x"></i>
                <p style="margin-top:10px; font-weight:800;">Erro ao carregar atividades. Tente novamente.</p>
            </div>`;
    }
}

//=== CARREGA O HISTÓRICO GLOBAL DE CONFERÊNCIAS E CHECKLISTS PARA A UNIDADE (ABA UNIDADE) ===//
async function loadGlobalHistory() {
    const listContainer = document.getElementById('global-history-list');
    const localIdFilter = document.getElementById('glob-hist-local').value; // Agora espera o ID da VTR
    const conferenteFilter = document.getElementById('glob-hist-user').value;

    if (!listContainer) return;

    // Feedback visual moderno
    listContainer.innerHTML = `
        <div style="text-align:center; padding:60px; color:#64748b;">
            <i class="fas fa-circle-notch fa-spin fa-2x"></i>
            <p style="margin-top:15px; font-weight:700; text-transform:uppercase; font-size:0.8em; letter-spacing:1px;">
                Consultando registros da unidade...
            </p>
        </div>`;

    const dI = new Date(document.getElementById('glob-hist-start').value + 'T00:00:00');
    const dF = new Date(document.getElementById('glob-hist-end').value + 'T23:59:59');

    if (isNaN(dI.getTime()) || isNaN(dF.getTime())) {
        listContainer.innerHTML = `
            <div style="text-align:center; padding:40px; color:#d90f23; background:#fff1f2; border-radius:12px;">
                <i class="fas fa-calendar-times fa-2x"></i>
                <p style="margin-top:10px; font-weight:bold;">Selecione o período (Início e Fim) para pesquisar.</p>
            </div>`;
        return;
    }

    const startTS = firebase.firestore.Timestamp.fromDate(dI);
    const endTS = firebase.firestore.Timestamp.fromDate(dF);

    try {
        // 1. Definição das referências base com filtro de tempo
        let refConf = db.collection('resultados_conferencias')
            .where('timestamp', '>=', startTS)
            .where('timestamp', '<=', endTS);

        let refCheck = db.collection('resultados_checklist')
            .where('timestamp', '>=', startTS)
            .where('timestamp', '<=', endTS);

        // 2. Filtro de Jurisdição (Gestor vê apenas sua Unidade ID)
        if (currentUserData.role === 'gestor') {
            const unidId = currentUserData.unidade_id;
            if (unidId) {
                refConf = refConf.where('unidade_id', '==', unidId);
                refCheck = refCheck.where('unidade_id', '==', unidId);
            }
        }

        // 3. Filtro opcional por militar
        if (conferenteFilter) {
            refConf = refConf.where('conferente', '==', conferenteFilter);
            refCheck = refCheck.where('conferente', '==', conferenteFilter);
        }

        // Execução das buscas em paralelo
        const [snapConf, snapCheck] = await Promise.all([
            refConf.orderBy('timestamp', 'desc').get(),
            refCheck.orderBy('timestamp', 'desc').get()
        ]);

        let docs = [];
        snapConf.forEach(d => docs.push({ ...d.data(), id_doc: d.id }));
        snapCheck.forEach(d => docs.push({ ...d.data(), id_doc: d.id }));

        // Ordenação unificada por tempo (mais recente primeiro)
        docs.sort((a, b) => {
            const timeA = a.timestamp?.seconds || 0;
            const timeB = b.timestamp?.seconds || 0;
            return timeB - timeA;
        });

        // 4. Renderização com filtro de Local (Viatura/Base)
        let html = '';
        docs.forEach(d => {
            // ✅ PRECISÃO CIRÚRGICA: 
            // O 'localIdFilter' contém o doc.id da lista.
            // No histórico, buscamos preferencialmente pelo campo 'lista_id' ou 'local_id'.
            const idDaVtrNoHistorico = d.lista_id || d.local_id || d.local;

            if (!localIdFilter || idDaVtrNoHistorico === localIdFilter) {
                html += criarItemHistoricoHTML(d);
            }
        });

        listContainer.innerHTML = html || `
            <div style="text-align:center; padding:80px; color:#94a3b8;">
                <i class="fas fa-search fa-3x" style="opacity:0.2; margin-bottom:15px; display:block;"></i>
                <p>Nenhum registro localizado para esta viatura/período.</p>
            </div>`;

    } catch (e) {
        console.error("Erro ao carregar histórico global:", e);
        listContainer.innerHTML = `
            <div style="text-align:center; padding:40px; color:#d90f23;">
                <i class="fas fa-exclamation-triangle fa-2x"></i>
                <p style="margin-top:10px; font-weight:800;">Erro na consulta ao banco de dados.</p>
                <small>${e.message}</small>
            </div>`;
    }
}

//=== CARREGA O FILTRO DE LOCAIS (LISTAS/VTRs) NA ABA DE HISTÓRICO DA UNIDADE ===//
async function carregarLocaisFiltroHistorico() {
    const selectLocal = document.getElementById('glob-hist-local');
    if (!selectLocal || !currentUserData) return;

    selectLocal.innerHTML = '<option value="">Todas as Listas</option>';

    try {
        // Consultamos a coleção onde as listas de conferência são armazenadas
        let query = db.collection('listas_conferencia').where('ativo', '==', true);

        // Bloqueio de Jurisdição: Gestor só vê o que é da unidade dele
        if (currentUserData.role === 'gestor') {
            const unidIdGestor = currentUserData.unidade_id;
            if (unidIdGestor) {
                query = query.where('unidade_id', '==', unidIdGestor);
            }
        }

        const snap = await query.get();

        if (snap.empty) {
            console.warn("Nenhuma lista ativa encontrada para esta unidade.");
            return;
        }

        snap.forEach(doc => {
            const data = doc.data();
            const opt = document.createElement('option');
            
            // O value deve ser o ID do documento (ex: alfa_abt18) para bater com o histórico
            opt.value = doc.id; 

            // Rótulo: "ABT-18 (BIOMA)" ou "Mucajaí - Apiaú (BIOMA)"
            const identificador = data.ativo_nome || data.prefixo || doc.id;
            const posto = data.posto_nome ? ` (${data.posto_nome})` : "";
            
            opt.textContent = `${identificador}${posto}`.toUpperCase();
            selectLocal.appendChild(opt);
        });

    } catch (e) {
        console.error("Erro ao carregar locais para filtro:", e);
    }
}

//================================================//
//--- BLOCO: RENDERIZAÇÃO E TEMPLATES (Visual) ---//
//================================================//

//=== CRIA OS CARDS DE HISTÓRICO (CONFERÊNCIAS, CHECKLISTS E TRANSFERÊNCIAS) ===//
function criarItemHistoricoHTML(data) {
    const dataHora = data.timestamp.toDate().toLocaleString('pt-BR');
    const temAlteracao = (data.itensRelatorio && data.itensRelatorio.some(i => i.status !== 'S/A')) || (!data.itensRelatorio && data.totalCaa > 0);

    // ✅ DEFINIÇÃO DE IDENTIDADE VISUAL POR MODO
    let iconClass = 'fa-file-alt';
    let corIcone = '#800020'; // Padrão Bordô
    let modoLabel = 'Conferência';

    if (data.modo === 'CHECKLIST_VISTORIA') {
        iconClass = 'fa-truck-check';
        corIcone = '#2c3e50'; // Azul Petróleo
        modoLabel = 'Vistoria VTR';
    } else if (data.modo === 'TRANSFERENCIA_CARGA') {
        iconClass = 'fa-right-left';
        corIcone = '#343a40'; // Grafite
        modoLabel = 'Carga';
    }

    const dataSegura = encodeURIComponent(JSON.stringify(data));

    return `
        <div class="sigma-v3-timeline-item">
            <div class="sigma-v3-timeline-card" onclick="reimprimirPDF(JSON.parse(decodeURIComponent('${dataSegura}')))" style="cursor: pointer;">
                <div style="display: flex; align-items: center; gap: 15px; flex: 1;">
                    <div style="width: 45px; height: 45px; border-radius: 12px; background: ${corIcone}15; color: ${corIcone}; display: flex; align-items: center; justify-content: center; font-size: 1.2em;">
                        <i class="fas ${iconClass}"></i>
                    </div>
                    
                    <div class="sigma-v3-timeline-info">
                        <span class="sigma-v3-timeline-title">${data.local}</span>
                        <div class="sigma-v3-timeline-meta">
                            <span><i class="fas fa-tag"></i> ${modoLabel}</span>
                            <span><i class="far fa-clock"></i> ${dataHora}</span>
                        </div>
                        <div style="font-size: 0.7em; color: #64748b; margin-top: 2px;">
                            <i class="fas fa-user-edit"></i> Resp: ${data.conferente}
                        </div>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 12px;">
                    <span class="sigma-v3-timeline-badge" style="background: ${temAlteracao ? '#fff1f2' : '#f0fdf4'}; color: ${temAlteracao ? '#d90f23' : '#1b8a3e'};">
                        ${temAlteracao ? 'C/A' : 'S/A'}
                    </span>
                    <div style="color: #cbd5e1;">
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>
            </div>
        </div>
    `;
}

