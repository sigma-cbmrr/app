
closeMenuMobile();

// --- Trava do Botão Voltar (Mobile/Browser) ---
if (window.innerWidth <= 768) {
    // Adiciona um estado para interceptar o botão Voltar do navegador
    history.pushState(null, null, location.href);
}
// ----------------------------------------------

// Garante que a visão seja o dashboard ao logar
switchView('dashboard');


// --- OUTROS E FUNÇÕES GLOBAIS (UI) ---

function toggleProfileDropdown(event) {
    event.stopPropagation();
    document.getElementById('profileDropdown').classList.toggle('active');
}

// Fecha o menu se o usuário clicar fora dele
window.onclick = function (event) {
    if (!event.target.closest('.user-profile-header')) {
        const dropdown = document.getElementById('profileDropdown');
        if (dropdown && dropdown.classList.contains('active')) {
            dropdown.classList.remove('active');
        }
    }
}

// FUNÇÃO PARA PREENCHER OS DADOS (Chame isso após o login ou no carregar da página)




// Força o fechamento do menu e do fundo escurecido (overlay)
function closeMenuMobile() {
    const s = document.getElementById('main-sidebar');
    const overlay = document.getElementById('mobile-overlay');

    if (s) s.classList.remove('mobile-active');
    if (overlay) overlay.style.display = 'none';
}




function formatarCPF(input) {
    let value = input.value.replace(/\D/g, ''); // Remove tudo que não for dígito
    value = value.substring(0, 11); // Limita a 11 dígitos

    if (value.length > 9) {
        value = value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    } else if (value.length > 6) {
        value = value.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1.$2.$3');
    } else if (value.length > 3) {
        value = value.replace(/^(\d{3})(\d{3})$/, '$1.$2');
    } else if (value.length > 0) {
        value = value.replace(/^(\d{3})$/, '$1');
    }
    input.value = value;
}

function formatarMatricula(input) {
    let value = input.value.replace(/\D/g, ''); // Remove tudo que não for dígito
    value = value.substring(0, 10); // Limita a 10 dígitos

    if (value.length > 7) {
        value = value.replace(/^(\d{7})(\d{3})$/, '$1-$2');
    }
    input.value = value;
}

function formatarTelefone(input) {
    let value = input.value.replace(/\D/g, ''); // Remove tudo que não for dígito
    value = value.substring(0, 11); // Limita a 11 dígitos (DDD + 9 dígitos)

    if (value.length > 6) {
        value = value.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    } else if (value.length > 2) {
        value = value.replace(/^(\d{2})(\d+)$/, '($1) $2');
    } else if (value.length > 0) {
        value = value.replace(/^(\d{2})$/, '($1)');
    }
    input.value = value;
}

function atualizarQuadroCad(postoSelect, quadroSelect) {
    if (!postoSelect || !quadroSelect) return;

    const posto = postoSelect.value;

    // Limpa o select de quadros com um placeholder padrão
    quadroSelect.innerHTML = '<option value="" disabled selected>Selecione o Quadro...</option>';

    if (!posto) {
        quadroSelect.disabled = true;
        return;
    }

    let quadros = [];
    // Listas de postos para validação
    const oficiais = ['CEL', 'TEN CEL', 'MAJ', 'CAP', '1º TEN', '2º TEN'];
    const pracas = ['ST', '1º SGT', '2º SGT', '3º SGT', 'CB'];

    // Lógica de Atribuição de Quadros
    if (oficiais.includes(posto)) {
        quadros = ['QOCBM', 'QCOBM', 'QOSBM', 'QEOBM'];
        quadroSelect.disabled = false;
    }
    else if (pracas.includes(posto)) {
        quadros = ['QPCBM', 'QPSBM', 'QEPBM'];
        quadroSelect.disabled = false;
    }
    else if (posto === 'SD') {
        quadros = ['QPCBM'];
        // Mantemos desabilitado pois Soldado não tem variação de quadro no sistema
        quadroSelect.disabled = true;
    }

    // Preenchimento Dinâmico
    quadros.forEach(quadro => {
        const option = document.createElement('option');
        option.value = quadro;
        option.textContent = quadro;
        quadroSelect.appendChild(option);
    });

    // Seleção Automática Inteligente
    if (quadros.length === 1) {
        quadroSelect.value = quadros[0];
        // Adiciona um feedback visual de que o campo foi preenchido automaticamente
        quadroSelect.style.backgroundColor = "#f8fafc";
    } else {
        quadroSelect.style.backgroundColor = "";
    }
}

async function getUnitListIds() {
    // 1. Obter a unidade do usuário logado
    const userUnidade = currentUserData.unidade || '';
    if (!userUnidade) {
        console.warn("Unidade do usuário não definida. Retornando vazio.");
        return [];
    }

    // 2. Buscar no documento 'config_geral/rotas'
    try {
        const rotasDoc = await db.collection('config_geral').doc('rotas').get();
        const rotas = rotasDoc.data() || {};
        const unitListIds = [];

        for (const [id, info] of Object.entries(rotas)) {
            // Se o nome da unidade na rota for igual à unidade do usuário
            if (info.unidade === userUnidade && info.ativo !== false) {
                unitListIds.push(id);
            }
        }
        return unitListIds;

    } catch (error) {
        console.error("Erro ao obter IDs de listas da unidade:", error);
        return [];
    }
}


// Localização: Função queryCautelas (Aproximadamente linha 1600 do arquivo completo)

// A função queryCautelas foi alterada para suportar a busca por UID em filtros pessoais.
async function queryCautelas(statusArray, role, user, field = null, type = 'personal') {
    let query = db.collection('cautelas_abertas');

    if (type === 'personal' || role === 'admin') {
        if (statusArray.length > 0) {
            query = query.where('status', 'in', statusArray);
        } else {
            return [];
        }
    }

    const militarCompleto = user.nome_militar_completo;
    const militarUid = firebase.auth().currentUser.uid;

    if (role === 'gestor' && type === 'unit') {
        const unitListIds = await getUnitListIds();
        if (unitListIds.length > 0 && unitListIds.length <= 10) {
            query = query.where('local_origem_id', 'in', unitListIds);
        } else {
            return [];
        }
    } else if (type === 'personal') {
        if (field === 'destinatario') {
            const [snapOriginal, snapAtual] = await Promise.all([
                db.collection('cautelas_abertas')
                    .where('destinatario_original_uid', '==', militarUid)
                    .where('status', 'in', statusArray)
                    .get(),
                db.collection('cautelas_abertas')
                    .where('destinatario_uid', '==', militarUid)
                    .where('status', 'in', statusArray)
                    .get()
            ]);

            let mapResult = new Map();
            snapOriginal.forEach(doc => mapResult.set(doc.id, { id: doc.id, ...doc.data() }));
            snapAtual.forEach(doc => mapResult.set(doc.id, { id: doc.id, ...doc.data() }));

            return Array.from(mapResult.values()).sort((a, b) =>
                (b.timestamp_emissao?.toMillis() || 0) - (a.timestamp_emissao?.toMillis() || 0)
            );

        } else if (field === 'emitente') {
            query = query.where('emitente_uid', '==', militarUid);
        } else if (field === 'receptor_final_completo') {
            query = query.where('receptor_final_completo', '==', militarCompleto);
        } else if (field === 'destinatario_original') {
            query = query.where('destinatario_original', '==', militarCompleto);
        } else if (field === 'militar_completo_reversor') {
            query = query.where('militar_completo_reversor', '==', militarCompleto);
        }
    }

    try {
        const snapshot = await query.orderBy('timestamp_emissao', 'desc').get();
        let cautelas = [];
        snapshot.forEach(doc => {
            const cautela = { id: doc.id, ...doc.data() };
            if (role === 'gestor' && type === 'unit' && !statusArray.includes(cautela.status)) {
                return;
            }
            cautelas.push(cautela);
        });
        return cautelas;
    } catch (error) {
        console.error("Erro na consulta de cautelas:", error);
        throw error;
    }
}
/**
* Renderiza uma linha de tabela (<tr>) para a cautela, adicionando data-labels para responsividade mobile.
*/
function renderCautelaRow(cautela) {
    const clickAction = `showCautelaDetails('${cautela.cautela_id}')`;
    const itensCount = cautela.itens ? cautela.itens.reduce((sum, item) => sum + item.quantidade, 0) : 0;

    // 🛑 INDICADOR DE PENDÊNCIA NA LINHA
    const temPendencia = cautela.pendencias_ativas && cautela.pendencias_ativas.length > 0;
    const alertaCaa = temPendencia ? `<i class="fas fa-exclamation-circle" style="color: #f57c00;" title="Possui itens em análise"></i> ` : "";

    const dataEmissao = cautela.timestamp_emissao && typeof cautela.timestamp_emissao.toDate === 'function'
        ? cautela.timestamp_emissao.toDate().toLocaleDateString('pt-BR')
        : 'N/A';

    const status = cautela.status || 'N/A';
    let badgeClass = 'badge-cautela';
    let badgeText = 'N/D';

    if (status === 'RECEBIDA') { badgeClass = 'badge-solucao'; badgeText = 'RECEBIDA'; }
    else if (status === 'ABERTA') { badgeClass = 'badge-cautela'; badgeText = 'ABERTA'; }
    else if (status === 'DEVOLUÇÃO') { badgeClass = 'badge-pendente'; badgeText = 'EM DEVOLUÇÃO'; }
    else if (status === 'CONCLUÍDA') { badgeClass = 'badge-concluida'; badgeText = 'CONCLUÍDA'; }

    return `
        <tr onclick="${clickAction}" style="${temPendencia ? 'background-color: #fff9f0;' : ''}">
            <td data-label="ID"><strong>${cautela.cautela_id}</strong></td>
            <td data-label="Destinatário">${cautela.destinatario || cautela.destinatario_original_nome || 'Aguardando...'}</td>
            <td data-label="Emissão">${dataEmissao}</td>
            <td data-label="Origem">${cautela.local_origem}</td>
            <td data-label="Itens">${alertaCaa}${itensCount} itens</td>
            <td data-label="Status"><span class="status-badge ${badgeClass}">${badgeText}</span></td>
        </tr>
    `;
}
// Adicionar esta função no final do bloco de funções do Editor de Listas (sigma_dashboard.txt)


// Localização: Aproximadamente linha 6445
async function getUserInfoByUid(uid) {
    if (userCache[uid]) {
        return userCache[uid];
    }

    try {
        // Tenta encontrar o documento onde o UID é o ID do documento
        const doc = await db.collection('usuarios').doc(uid).get();

        if (doc.exists) {
            userCache[uid] = { id: doc.id, ...doc.data() };
            return userCache[uid];
        }

        return null;

    } catch (e) {
        console.warn(`Falha ao buscar militar pelo UID ${uid}: ${e.message}`);
        return null;
    }
}
/**
* Tenta encontrar o UID de um militar usando seu nome militar completo (Posto Quadro Nome Guerra).
* Usado como fallback para cautelas legadas.
* @param {string} nomeCompleto - O nome completo (Ex: '2º SGT QPCBM JHONATH').
* @returns {string|null} O ID do documento (UID) se encontrado.
*/
async function findUidByName(nomeCompleto) {
    if (!nomeCompleto) return null;

    try {
        // Busca exata pelo nome de exibição
        const snap = await db.collection('usuarios')
            .where('nome_militar_completo', '==', nomeCompleto.trim())
            .get();

        if (snap.empty) {
            console.warn(`Nenhum militar encontrado com o nome exato: ${nomeCompleto}`);
            return null;
        }

        if (snap.size > 1) {
            alert(`⚠️ Atenção: Foram encontrados ${snap.size} cadastros para "${nomeCompleto}". Verifique se há nomes duplicados no banco de dados.`);
        }

        // Retorna o UID do primeiro documento encontrado
        return snap.docs[0].id;
    } catch (e) {
        console.error("Erro ao buscar UID por nome:", e);
        return null;
    }
}

async function loadCautelaPendencies() {
    const container = document.getElementById('admin-gestor-cards-container');
    if (!container || !currentUserData) return;

    try {
        console.log("=== BUSCANDO PENDÊNCIAS DE CAUTELA ===");

        const unitListIds = await getUnitListIds();

        let query = db.collection('cautelas_abertas')
            .where('status', 'in', ['ABERTA', 'RECEBIDA', 'DEVOLUÇÃO']);

        const snap = await query.get();
        let totalPendenciasTroca = 0;
        let cautelasComPendencia = [];

        snap.forEach(doc => {
            const data = doc.data();
            const pertenceAoSetor = currentUserData.role === 'admin' || unitListIds.includes(data.local_origem_id);

            if (pertenceAoSetor && data.pendencias_ativas && data.pendencias_ativas.length > 0) {

                // --- CORREÇÃO CIRÚRGICA: INJETAR DADOS DO MILITAR EM CADA PENDÊNCIA ---
                const pendenciasComRastreabilidade = data.pendencias_ativas.map(p => {
                    // Chaves REAIS confirmadas no seu log:
                    const nomeReal = data.destinatario_original_nome || p.solicitante_nome || "Militar";
                    const uidReal = data.destinatario_uid || p.solicitante_uid || "";

                    return {
                        ...p,
                        gestor_alvo_nome: nomeReal, // Normaliza para o fluxo seguinte
                        gestor_alvo_uid: uidReal,
                        cautelaId: doc.id,
                        localId: data.local_origem_id,
                        itemNome: p.item_nome || p.itemNome || "Item"
                    };
                });

                if (pendenciasComRastreabilidade.length > 0) {
                    totalPendenciasTroca += pendenciasComRastreabilidade.length;
                    cautelasComPendencia.push({
                        id: doc.id,
                        ...data,
                        pendencias: pendenciasComRastreabilidade
                    });
                    console.log(`Cautela ${doc.id}: ${data.destinatario} tem ${pendenciasComRastreabilidade.length} pendência(s).`);
                }
            }
        });

        // ATUALIZA O CACHE GLOBAL
        cachePendenciasCautela = cautelasComPendencia;
        console.log("Total de itens para troca localizados:", totalPendenciasTroca);

        const cardExistente = document.getElementById('card-pendencia-cautela-ativa');

        if (totalPendenciasTroca === 0) {
            if (cardExistente) cardExistente.remove();
            return;
        }

        // MONTAGEM DO CARD
        let cardHtml = `
            <div id="card-pendencia-cautela-ativa" class="sector-card status-alert" 
                 style="border-left: 5px solid #f57c00; background-color: #fff3e0; margin-bottom: 20px; flex: 1 1 100%; cursor: pointer; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"
                 onclick="abrirGestaoPendenciasCautela()">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 style="color: #e65100; margin: 0; font-size: 1.1em;"><i class="fas fa-exclamation-circle"></i> Pendências de Cautelas Ativas</h3>
                        <p style="margin: 5px 0 0 0; font-size: 0.85em; color: #666;">Existem itens aguardando substituição ou recolhimento.</p>
                    </div>
                    <div class="count-value" style="color: #e65100; font-size: 2em; font-weight: bold;">${totalPendenciasTroca}</div>
                </div>
                <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(230, 81, 0, 0.2); color: #e65100; font-size: 0.8em; font-weight: bold; text-transform: uppercase;">
                    Clique para gerenciar
                </div>
            </div>
        `;

        if (cardExistente) {
            cardExistente.outerHTML = cardHtml;
        } else {
            container.insertAdjacentHTML('afterbegin', cardHtml);
        }

    } catch (e) {
        console.error("Erro ao carregar pendências de cautela:", e);
    }
}
async function abrirGestaoPendenciasCautela() {
    const cautelas = cachePendenciasCautela;
    const wrapper = document.getElementById('ca-table-wrapper');
    const tbody = document.getElementById('ca-list-body');
    if (!wrapper || !tbody) return;

    // 1. AJUSTE DO CABEÇALHO DA TABELA
    const thead = wrapper.querySelector('thead tr');
    if (thead) {
        thead.innerHTML = `
            <th>Material</th>
            <th>Cautela ID</th>
            <th>Alteração</th>
            <th>Conferente/Data</th>
            <th>Ação</th>
        `;
    }

    document.getElementById('table-title').innerHTML = `<i class="fas fa-exchange-alt"></i> Substituições Pendentes`;
    tbody.innerHTML = '';
    wrapper.querySelector('table').style.display = 'table';
    document.getElementById('no-issues-msg').style.display = 'none';

    cautelas.forEach(cautela => {
        cautela.pendencias.forEach(p => {
            const tr = tbody.insertRow();

            // Coluna Material
            const tdMaterial = tr.insertCell();
            tdMaterial.innerHTML = `
                <strong>${p.item_nome}</strong><br>
                <small style="color:#800020">Origem: ${cautela.local_origem || 'Não especificado'}</small>
            `;

            // Coluna Cautela ID
            const tdCautela = tr.insertCell();
            tdCautela.innerHTML = `<span class="status-badge badge-cautela" style="font-family: monospace; font-size: 0.95em;">${cautela.id}</span>`;

            // Coluna Alteração (Single vs Multi)
            const tdAlteracao = tr.insertCell();
            tdAlteracao.style.textAlign = "left";

            const itemNome = (p.item_nome || "").trim().toUpperCase();
            const itemTomb = (p.item_tombamento || "S/T").trim().toUpperCase();
            const itemQtd = p.quantidade || 1;
            const ehItemSingle = !p.item_tombamento || itemTomb === "S/T" || itemTomb === itemNome;

            const labelIdentificador = ehItemSingle
                ? `<b style="color:#666;">Qtd:</b> ${itemQtd} un.`
                : `<b style="color:#666;">Tomb:</b> ${p.item_tombamento}`;

            tdAlteracao.innerHTML = `
                <div style="font-size:0.9em;">
                    <b style="color:#d90f23;">Motivo:</b> ${p.motivo}<br>
                    ${labelIdentificador}
                </div>
            `;

            // Coluna Solicitante e Data
            const tdMilitar = tr.insertCell();
            let dataFormatada = "Data indisponível";
            if (p.timestamp) {
                const d = p.timestamp.seconds ? new Date(p.timestamp.seconds * 1000) : new Date(p.timestamp);
                if (!isNaN(d.getTime())) dataFormatada = d.toLocaleString('pt-BR');
            }
            tdMilitar.innerHTML = `<small><b>${p.solicitante_nome}</b><br>${dataFormatada}</small>`;

            // Preparação dos dados (btnData)
            const idItemReal = p.id_item || "";
            const idBaseReal = p.id_base || "";
            const tombReal = p.item_tombamento || "";

            const btnData = encodeURIComponent(JSON.stringify({
                cautelaId: cautela.id,
                solicitacaoId: p.id_solicitacao,
                itemNome: p.item_nome,
                itemTomb: tombReal,
                localId: cautela.local_origem_id,
                motivo: p.motivo,
                uidItem: idItemReal || (idBaseReal ? `${idBaseReal}-${tombReal}` : ""),
                solicitante_nome: p.solicitante_nome || "Militar",
                gestor_alvo_nome: p.solicitante_nome || "Militar",
                gestor_alvo_uid: p.solicitante_uid || "",
                quantidade: itemQtd
            }));

            const tdAcao = tr.insertCell();
            tdAcao.innerHTML = `
                <button class="btn-modern-action" style="background-color: #f57c00; padding: 5px 10px; cursor:pointer; display: flex; align-items: center; gap: 8px;" 
                    onclick="abrirDecisaoGestor('${btnData}')">
                    <i class="fas fa-tools"></i> Resolver
                </button>
            `;
        });
    });

    wrapper.style.display = 'block';
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function abrirDecisaoGestor(dataJson) {
    try {
        const data = JSON.parse(decodeURIComponent(dataJson));

        // 1. NORMALIZAÇÃO DE RASTREABILIDADE
        data.gestor_alvo_nome = data.solicitante_nome || data.gestor_alvo_nome || "Militar";
        data.gestor_alvo_uid = data.solicitante_uid || data.gestor_alvo_uid || "";
        data.itemNome = data.item_nome || data.itemNome || "Item sem nome";
        data.motivo = data.motivo || "Avaria relatada";

        // 2. CORREÇÃO DE IDS ESPECÍFICOS
        if (!data.uidItem || (data.uidItem && String(data.uidItem).includes('undefined'))) {
            const nomeUpper = data.itemNome.toUpperCase();
            if (nomeUpper.includes("PÉ DE CABRA")) {
                data.uidItem = "56911524-65986249";
                data.id_base = "56911524-65986249";
            } else if (nomeUpper.includes("EPR SCOTT")) {
                data.uidItem = "56911524-64012364-" + (data.itemTomb || data.item_tombamento || "S/T");
                data.id_base = "56911524-64012364";
            }
        }

        data.quantidade = Number(data.quantidade || data.itemQtd || 1);
        pendenciaSendoResolvida = data;

        // 3. PREPARAÇÃO DA INTERFACE DO MODAL
        const tombReal = data.itemTomb || data.item_tombamento || "";
        const ehItemSingle = !tombReal || tombReal === "S/T" || tombReal.trim().toUpperCase() === data.itemNome.trim().toUpperCase();

        const identificadorHtml = ehItemSingle
            ? `<b>Quantidade relatada:</b> <span style="color:#d90f23; font-weight:bold;">${data.quantidade} un.</span>`
            : `<b>Tombamento:</b> <span style="color:#800020; font-weight:bold;">${tombReal}</span>`;

        const infoBox = document.getElementById('info-item-decisao');
        if (infoBox) {
            infoBox.innerHTML = `
                <div style="line-height: 1.6; text-align: left; background: #fff; padding: 12px; border-radius: 4px; border: 1px solid #ddd; border-left: 5px solid #800020;">
                    <b style="color: #800020; font-size: 1.1em; text-transform: uppercase;">${data.itemNome}</b><br>
                    <div style="margin-top: 8px; border-top: 1px solid #eee; padding-top: 8px; font-size: 0.95em;">
                        ${identificadorHtml}<br>
                        <b>Relatado por:</b> <span style="color: #2c7399; font-weight: bold;">${data.gestor_alvo_nome}</span><br>
                        <b>Motivo:</b> <span style="color:#333;">${data.motivo}</span>
                    </div>
                </div>
            `;
        }

        const modal = document.getElementById('modalDecisaoGestor');
        if (modal) modal.style.display = 'flex';

    } catch (e) {
        console.error("Erro crítico ao abrir modal de decisão:", e);
        alert("Erro ao processar dados da pendência.");
    }
}

async function executarRecolhimentoApenas() {
    if (!pendenciaSendoResolvida) return;

    const p = pendenciaSendoResolvida;
    const confirmacao = confirm(`Deseja confirmar o recolhimento de "${p.itemNome}"?\n\nO item sairá da carga do militar e retornará ao estoque com carimbo de PENDÊNCIA.`);
    if (!confirmacao) return;

    try {
        const cautelaRef = db.collection('cautelas_abertas').doc(p.cautelaId);
        const listaRef = db.collection('listas_conferencia').doc(p.localId);

        const [docCautela, docLista] = await Promise.all([
            cautelaRef.get(),
            listaRef.get()
        ]);

        if (!docCautela.exists || !docLista.exists) return alert("Erro: Documentos não localizados.");

        const dataCautela = docCautela.data();
        const dataRegistro = new Date().toLocaleString('pt-BR');
        const dataSimples = new Date().toLocaleDateString('pt-BR');
        const nomeLimpo = (p.itemNome || "").trim().toUpperCase();

        // Identifica o Gestor logado para o histórico (Posto + Nome de Guerra)
        let nomeGestorLogado = "Gestor";
        if (typeof currentUserData !== 'undefined' && currentUserData.nome_militar_completo) {
            nomeGestorLogado = currentUserData.nome_militar_completo;
        }

        // 1. ATUALIZAÇÃO DA CARGA DO MILITAR (CAUTELA) - CORREÇÃO CIRÚRGICA DE QUANTIDADE
        const pendenciasRestantes = (dataCautela.pendencias_ativas || []).filter(item =>
            String(item.id_solicitacao) !== String(p.solicitacaoId)
        );

        const qtdBaixa = Number(p.quantidade) || 1;
        let novosItensCautela = [];

        // Lógica para detectar se é item de estoque (Single)
        const itemTombReal = (p.itemTomb || "S/T").trim().toUpperCase();
        const ehItemSingle = !p.itemTomb || itemTombReal === "S/T" || itemTombReal === nomeLimpo;

        if (!ehItemSingle) {
            // ITEM MULTI: Remove o objeto pelo tombamento específico
            novosItensCautela = (dataCautela.itens || []).filter(it => it.tombamento !== p.itemTomb);
        } else {
            // ITEM SINGLE: Subtrai apenas a quantidade reportada, preservando o restante
            novosItensCautela = (dataCautela.itens || []).map(it => {
                const isMesmoItem = it.id === p.id_base || it.id === p.uidItem || it.nome.trim().toUpperCase() === nomeLimpo;

                if (isMesmoItem) {
                    const novaQtd = (Number(it.quantidade) || 0) - qtdBaixa;
                    return novaQtd > 0 ? { ...it, quantidade: novaQtd } : null;
                }
                return it;
            }).filter(it => it !== null);
        }

        // 2. ATUALIZAÇÃO DO ESTOQUE (LISTA MESTRA) - CONVERSÃO DE CARIMBOS
        const novaListaMestra = docLista.data().list.map(setor => ({
            ...setor,
            itens: (setor.itens || []).map(it => {
                if (it.nome.trim().toUpperCase() === nomeLimpo || it.id === p.id_base) {

                    const novoIdPendencia = "PEND-" + Date.now();
                    const descricaoPadrao = `${p.motivo} (RECOLHIDO DE ${p.cautelaId})`;

                    // A. TRATA ITENS MULTI (Tombamentos)
                    if (it.tipo === 'multi' && it.tombamentos) {
                        it.tombamentos = it.tombamentos.map(t => {
                            if (t.tomb === p.itemTomb) {
                                delete t.cautela; // Remove carimbo LARANJA
                                t.status = 'pending';

                                if (!t.pendencias_ids) t.pendencias_ids = [];
                                t.pendencias_ids.push({
                                    id: novoIdPendencia,
                                    quantidade: 1,
                                    descricao: descricaoPadrao,
                                    data_criacao: dataSimples,
                                    status_gestao: "PENDENTE",
                                    tipo: "PENDENCIA",
                                    autor_nome: p.gestor_alvo_nome || "Militar"
                                });
                            }
                            return t;
                        });
                    }

                    // B. TRATA ITENS SINGLE (Redução de carimbo laranja no estoque)
                    if (it.tipo === 'single' && it.cautelas) {
                        it.cautelas = it.cautelas.map(c => {
                            if (c.id === p.cautelaId) {
                                const novaQtdC = (Number(c.quantidade) || 0) - qtdBaixa;
                                return novaQtdC > 0 ? { ...c, quantidade: novaQtdC } : null;
                            }
                            return c;
                        }).filter(c => c !== null);
                    }

                    // C. CARIMBO DE PENDÊNCIA GERAL (Vermelho)
                    if (!it.pendencias_ids) it.pendencias_ids = [];
                    it.pendencias_ids.push({
                        id: novoIdPendencia,
                        quantidade: qtdBaixa,
                        descricao: descricaoPadrao,
                        data_criacao: dataSimples,
                        status_gestao: "PENDENTE",
                        tipo: "PENDENCIA",
                        autor_nome: p.gestor_alvo_nome || "Militar"
                    });

                    // D. HISTÓRICO DE VIDA DO ITEM
                    if (!it.historico_vida) it.historico_vida = [];
                    it.historico_vida.push({
                        data: dataRegistro,
                        evento: "RECOLHIMENTO_AVARIA",
                        detalhes: `Recolhimento de ${qtdBaixa}un. Item saiu da carga de ${p.gestor_alvo_nome} e retornou como pendência.`,
                        quem: nomeGestorLogado
                    });
                }
                return it;
            })
        }));

        // --- PREPARAÇÃO DO TEXTO DO HISTÓRICO DA CAUTELA ---
        const prefixoDescricao = ehItemSingle ? `${qtdBaixa}un de ` : "Item ";

        const batch = db.batch();

        // Update Cautela com menção à quantidade
        batch.update(cautelaRef, {
            itens: novosItensCautela,
            pendencias_ativas: pendenciasRestantes,
            historico_movimentacoes: firebase.firestore.FieldValue.arrayUnion({
                data: dataRegistro,
                descricao: `📥Recolhimento: ${prefixoDescricao}${p.itemNome} removido da carga. Motivo: ${p.motivo}`,
                militar: nomeGestorLogado
            })
        });

        // Update Lista Mestra
        batch.update(listaRef, {
            list: novaListaMestra,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();
        alert(`✅ Recolhimento concluído!\nSaldo atualizado na carga do militar.`);

        if (document.getElementById('modalDecisaoGestor')) document.getElementById('modalDecisaoGestor').style.display = 'none';
        if (typeof fecharTabela === 'function') fecharTabela();
        if (typeof loadCaaData === 'function') await loadCaaData();

    } catch (e) {
        console.error("Erro fatal no recolhimento:", e);
        alert("❌ Erro ao processar recolhimento: " + e.message);
    }
}

function gerarLogMovimentacao(itemObj, evento, detalhes) {
    if (!itemObj.historico_vida) itemObj.historico_vida = [];

    itemObj.historico_vida.push({
        data: new Date().toLocaleString('pt-BR'),
        evento: evento,
        autor: `${userInfo.postoGraduacao} ${userInfo.nomeGuerra}`,
        detalhes: detalhes,
        timestamp: Date.now()
    });

    return itemObj.historico_vida;
}

// Função para abrir o modal e carregar itens de todas as listas do gestor
async function abrirSeletorGlobalSubstituicao() {
    if (!pendenciaSendoResolvida) return;
    const p = pendenciaSendoResolvida;
    const modal = document.getElementById('modalSeletorEstoque');
    const container = document.getElementById('listaEstoqueDisponivel');

    // Identifica o "DNA" (prefixo do UID) - Ex: de 'EPR-01-511527' para 'EPR-01'
    const partesId = p.uidItem.split('-');
    partesId.pop(); // Remove o sufixo (tombamento)
    const dnaBusca = partesId.join('-');

    container.innerHTML = `<div class="loader-p">Buscando ${p.itemNome} em todas as suas ftr/setores...</div>`;
    modal.style.display = 'block';

    try {
        // Busca TODAS as listas de conferência (Jurisdição do Gestor)
        const snapshot = await db.collection('listas_conferencia').get();
        let htmlAcumulado = '';
        let totalEncontrado = 0;

        snapshot.forEach(docLista => {
            const nomeLista = docLista.id.toUpperCase();
            const dados = docLista.data();

            if (dados.list) {
                dados.list.forEach(setor => {
                    setor.itens.forEach(item => {

                        // Função interna para validar e montar o HTML do card
                        const validarEExibir = (entidade, idReal) => {
                            // Verifica se o ID começa com o DNA e se está DISPONÍVEL
                            if (idReal.startsWith(dnaBusca) && !entidade.cautela && entidade.situacao !== 'AVARIADO' && idReal !== p.uidItem) {
                                totalEncontrado++;
                                htmlAcumulado += `
                                    <div class="item-selecao-global" style="border: 1px solid #ddd; padding: 12px; margin-bottom: 8px; border-radius: 8px; background: white;">
                                        <div style="display:flex; justify-content:space-between; align-items:center;">
                                            <div>
                                                <small style="color: #666; font-weight: bold;">ORIGEM: ${nomeLista}</small><br>
                                                <b>Tombamento: ${entidade.tomb || entidade.tombamento}</b>
                                            </div>
                                            <button class="btn-resolver" style="width:auto; padding: 5px 15px;" 
                                                onclick="confirmarTrocaCruzada('${idReal}', '${docLista.id}', '${entidade.tomb || entidade.tombamento}')">
                                                Selecionar
                                            </button>
                                        </div>
                                    </div>`;
                            }
                        };

                        if (item.tipo === 'multi' && item.tombamentos) {
                            item.tombamentos.forEach(t => validarEExibir(t, `${item.id}-${t.tomb}`));
                        } else {
                            validarEExibir(item, item.id);
                        }
                    });
                });
            }
        });

        container.innerHTML = totalEncontrado > 0 ? htmlAcumulado : `<p style="text-align:center; padding:20px;">Nenhum item reserva do tipo <b>${p.itemNome}</b> disponível em suas listas.</p>`;

    } catch (e) {
        console.error(e);
        container.innerHTML = "<p>Erro ao processar busca global.</p>";
    }
}
async function confirmarTrocaCruzada(uidNovo, listaOrigemNovo, tombamentoNovo, cautelaId, localIdOrigem, idBaseOrigem, nomeItemOrigem, motivoMilitar, uidResponsavel, nomeResponsavel) {
    const dataFormatada = new Date().toLocaleString('pt-BR');
    const dataSimples = new Date().toLocaleDateString('pt-BR');
    const nomeLimpo = (nomeItemOrigem || "").trim().toUpperCase();
    const nomeMilitarRelator = nomeResponsavel || "Militar";
    const uidMilitarRelator = uidResponsavel || "";

    // 🛑 BUSCA O NOME REAL DO GESTOR LOGADO NO DASHBOARD
    let nomeGestorLogado = "Gestor";
    if (typeof currentUserData !== 'undefined' && currentUserData.nome_militar_completo) {
        nomeGestorLogado = currentUserData.nome_militar_completo;
    }

    try {
        const batch = db.batch();
        const cautelaRef = db.collection('cautelas_abertas').doc(cautelaId);
        const listaOrigemRef = db.collection('listas_conferencia').doc(localIdOrigem);

        // 1. ATUALIZAÇÃO DA CAUTELA (CARGA DO MILITAR)
        const docC = await cautelaRef.get();
        if (docC.exists) {
            const d = docC.data();
            const pAtivas = (d.pendencias_ativas || []).filter(pa => (pa.item_nome || "").trim().toUpperCase() !== nomeLimpo);

            // Identifica se o novo item é multi ou single para formatar a descrição do histórico
            const ehMulti = tombamentoNovo && tombamentoNovo !== "" && tombamentoNovo !== nomeItemOrigem;
            const identificadorNovo = ehMulti ? `tombamento ${tombamentoNovo}` : `${uidNovo.split('-').pop()} unidades`;

            const itensC = (d.itens || []).map(it => {
                if (it.nome.trim().toUpperCase() === nomeLimpo) {
                    return { ...it, id: uidNovo, tombamento: tombamentoNovo || "" };
                }
                return it;
            });

            batch.update(cautelaRef, {
                pendencias_ativas: pAtivas,
                itens: itensC,
                historico_movimentacoes: firebase.firestore.FieldValue.arrayUnion({
                    data: dataFormatada,
                    // ✅ MUDANÇA: "🔄Substituição:" e correção do texto de identificação
                    descricao: `🔄Substituição: Item ${nomeItemOrigem} substituído por ${identificadorNovo}.`,
                    militar: nomeGestorLogado // ✅ MUDANÇA: Agora aparece CAP QPCBM VIDO (ou quem estiver logado)
                })
            });
        }

        // 2. ATUALIZAÇÃO DO ESTOQUE (ITENS SINGLE E MULTI)
        const docL = await listaOrigemRef.get();
        if (docL.exists) {
            const listData = docL.data().list.map(setor => ({
                ...setor,
                itens: (setor.itens || []).map(it => {
                    if (it.id === idBaseOrigem || it.nome.trim().toUpperCase() === nomeLimpo) {

                        let objetoCautelaParaMover = null;
                        const novoIdPendencia = "PEND-" + Date.now();
                        // Aqui mantivemos o padrão solicitado anteriormente para o carimbo vermelho
                        const descricaoPadrao = `${motivoMilitar} (IDENTIFICADO EM: ${cautelaId})`;

                        if (it.tipo === "multi" && it.tombamentos) {
                            it.tombamentos = it.tombamentos.map(t => {
                                if (t.cautela && t.cautela.id === cautelaId) {
                                    objetoCautelaParaMover = t.cautela;
                                    delete t.cautela;
                                    if (!t.pendencias_ids) t.pendencias_ids = [];
                                    t.pendencias_ids.push({
                                        id: novoIdPendencia,
                                        quantidade: 1,
                                        descricao: descricaoPadrao,
                                        data_criacao: dataSimples,
                                        status_gestao: "PENDENTE",
                                        tipo: "PENDENCIA",
                                        autor_nome: nomeMilitarRelator
                                    });
                                }
                                return t;
                            }).map(t => {
                                if (t.tomb === tombamentoNovo) t.cautela = objetoCautelaParaMover;
                                return t;
                            });
                        }

                        if (!it.pendencias_ids) it.pendencias_ids = [];
                        it.pendencias_ids.push({
                            id: novoIdPendencia,
                            quantidade: 1,
                            descricao: descricaoPadrao,
                            data_criacao: dataSimples,
                            status_gestao: "PENDENTE",
                            tipo: "PENDENCIA",
                            autor_nome: nomeMilitarRelator
                        });

                        if (!it.historico_vida) it.historico_vida = [];
                        it.historico_vida.push({
                            data: dataFormatada,
                            evento: "RETORNO_TROCA",
                            detalhes: `🔄Substituição efetuada por ${nomeGestorLogado}.`,
                            quem: nomeGestorLogado
                        });
                    }
                    return it;
                })
            }));
            batch.update(listaOrigemRef, { list: listData, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        }

        await batch.commit();
        alert(`✅ Substituição concluída!\nRegistrado por: ${nomeGestorLogado}`);
        location.reload();
    } catch (e) {
        console.error(e);
        alert("Erro: " + e.message);
    }
}
async function prepararSubstituicaoFisica() {
    if (!pendenciaSendoResolvida) return;
    const p = pendenciaSendoResolvida;
    const modalSeletor = document.getElementById('modalSeletorEstoque');
    const container = document.getElementById('listaEstoqueDisponivel');

    document.getElementById('modalDecisaoGestor').style.display = 'none';
    modalSeletor.style.display = 'flex';
    container.innerHTML = `<div style="text-align:center; padding:30px;"><i class="fas fa-sync fa-spin"></i> Buscando itens compatíveis no estoque...</div>`;

    try {
        const idReferencia = p.uidItem || p.idItem || p.id_base || "";
        const partes = idReferencia.split('-');
        let dnaBusca = partes.length > 2 ? partes.slice(0, 2).join('-') : idReferencia;

        const motivoMilitar = (p.motivo || "Avaria reportada").replace(/'/g, "\\'");
        const uidResponsavel = p.gestor_alvo_uid || "";
        const nomeResponsavel = (p.gestor_alvo_nome || "Militar").replace(/'/g, "\\'");
        const nomeEscapado = p.itemNome.replace(/'/g, "\\'");

        const snapshot = await db.collection('listas_conferencia').get();
        let htmlAcumulado = '';
        let totalEncontrado = 0;

        snapshot.forEach(docLista => {
            const dadosLista = docLista.data();
            const nomeLocal = dadosLista.nome_local || docLista.id.toUpperCase();

            if (dadosLista.list) {
                dadosLista.list.forEach(setor => {
                    setor.itens.forEach(item => {
                        if (item.id && item.id.startsWith(dnaBusca)) {

                            // --- LÓGICA PARA ITEM SINGLE ---
                            if (item.tipo === 'single' || !item.tombamentos || item.tombamentos.length === 0) {
                                const qtdCautelada = (item.cautelas || []).reduce((acc, c) => acc + (Number(c.quantidade) || 0), 0);
                                const qtdPendente = (item.pendencias_ids || []).reduce((acc, pen) => acc + (Number(pen.quantidade) || 0), 0);
                                const saldoDisponivel = (Number(item.quantidadeEsperada) || 0) - qtdCautelada - qtdPendente;

                                if (saldoDisponivel > 0) {
                                    totalEncontrado++;
                                    const etiquetaLocal = docLista.id === p.localId ? `${nomeLocal} (ESTOQUE LOCAL)` : nomeLocal;

                                    htmlAcumulado += `
                                        <div class="item-selecao-global" style="border: 1px solid #ddd; padding: 15px; border-radius: 10px; background: white; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                                            <div style="flex: 1;">
                                                <small style="color: #1b8a3e; font-weight: bold;"><i class="fas fa-map-marker-alt"></i> ${etiquetaLocal}</small><br>
                                                <b style="color: #333; font-size: 1.1em;">${item.nome}</b><br>
                                                <small style="color: #666;">Saldo disponível: <b>${saldoDisponivel} un</b></small>
                                            </div>
                                            <div style="display: flex; align-items: center; gap: 15px;">
                                                <div style="display: flex; flex-direction: column; align-items: center;">
                                                    <label style="font-size: 0.7em; font-weight: bold; color: #555; margin-bottom: 4px; text-transform: uppercase;">Qtd</label>
                                                    <input type="number" id="qtd_subst_${item.id}_${docLista.id}" 
                                                        value="1" min="1" max="${saldoDisponivel}" 
                                                        style="width: 55px; padding: 8px; border: 1px solid #1b8a3e; border-radius: 5px; text-align: center; font-weight: bold;">
                                                </div>
                                                <button class="btn-resolver" style="height: 42px; padding: 0 20px; background: #1b8a3e; color:white; border:none; border-radius:5px; cursor:pointer; font-weight: bold;" 
                                                    onclick="confirmarTrocaCruzada('${item.id}', '${docLista.id}', '${item.nome}', '${p.cautelaId}', '${p.localId}', '${p.id_base || p.uidItem}', '${nomeEscapado}', '${motivoMilitar}', '${uidResponsavel}', '${nomeResponsavel}')">
                                                    Selecionar
                                                </button>
                                            </div>
                                        </div>`;
                                }
                            }
                            // --- LÓGICA PARA ITEM MULTI ---
                            else {
                                item.tombamentos.forEach(t => {
                                    const idCompleto = `${item.id}-${t.tomb}`;
                                    const temPendenciaAtiva = (t.pendencias_ids && t.pendencias_ids.length > 0);
                                    const disponivel = !t.cautela && !temPendenciaAtiva && t.situacao !== 'AVARIADO';

                                    if (disponivel && idCompleto !== idReferencia) {
                                        totalEncontrado++;
                                        const etiquetaLocal = docLista.id === p.localId ? `${nomeLocal} (RESERVA)` : nomeLocal;

                                        htmlAcumulado += `
                                            <div class="item-selecao-global" style="border: 1px solid #ddd; padding: 15px; border-radius: 10px; background: white; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                                                <div>
                                                    <small style="color: #1b8a3e; font-weight: bold;"><i class="fas fa-map-marker-alt"></i> ${etiquetaLocal}</small><br>
                                                    <b style="color: #333;">Tombamento: ${t.tomb}</b><br>
                                                    <small style="color: #666;">${item.nome}</small>
                                                </div>
                                                <button class="btn-resolver" style="width:auto; padding: 10px 15px; background: #1b8a3e; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;" 
                                                    onclick="confirmarTrocaCruzada('${idCompleto}', '${docLista.id}', '${t.tomb}', '${p.cautelaId}', '${p.localId}', '${p.id_base || p.uidItem}', '${nomeEscapado}', '${motivoMilitar}', '${uidResponsavel}', '${nomeResponsavel}')">
                                                    Selecionar
                                                </button>
                                            </div>`;
                                    }
                                });
                            }
                        }
                    });
                });
            }
        });

        container.innerHTML = totalEncontrado > 0 ? htmlAcumulado : `<div style="text-align:center; padding:20px; color:#666;">Nenhum item compatível livre encontrado.</div>`;

    } catch (e) {
        console.error("Erro na busca global:", e);
        container.innerHTML = `<div style="color:red; padding:20px; text-align:center;">Erro: ${e.message}</div>`;
    }
}
async function sincronizarAlmoxarifado() {
    if (!confirm("Deseja recalcular o saldo global baseado em todas as listas da unidade?")) return;

    // Feedback visual de carregamento
    const tbody = document.getElementById('almox-body');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;"><i class="fas fa-sync fa-spin"></i> Sincronizando dados das viaturas...</td></tr>';

    try {
        const unitListIds = await getUnitListIds();
        const inventarioCalculado = {};

        // 1. Varre todas as listas (viaturas/bases) vinculadas à unidade
        for (const listaId of unitListIds) {
            const doc = await db.collection('listas_conferencia').doc(listaId).get();
            if (!doc.exists) continue;

            const data = doc.data().list || [];
            data.forEach(setor => {
                setor.itens.forEach(item => {
                    const uidGlobal = item.uid_global; // Usamos o UID Global como chave única
                    if (!uidGlobal) return;

                    if (!inventarioCalculado[uidGlobal]) {
                        inventarioCalculado[uidGlobal] = { emCarga: 0, emAlteracao: 0, tipo: item.tipo };
                    }

                    if (item.tipo === 'single') {
                        const esperado = Number(item.quantidadeEsperada || item.quantidade) || 0;
                        const cautelado = (item.cautelas || []).reduce((s, c) => s + (Number(c.quantidade) || 0), 0);
                        const pendente = (item.pendencias_ids || []).reduce((s, p) => s + (Number(p.quantidade) || 0), 0);

                        inventarioCalculado[uidGlobal].emCarga += (esperado - cautelado - pendente);
                        inventarioCalculado[uidGlobal].emAlteracao += (cautelado + pendente);
                    } else {
                        const tombamentos = item.tombamentos || [];
                        inventarioCalculado[uidGlobal].emCarga += tombamentos.filter(t => !t.cautela && (!t.pendencias_ids || t.pendencias_ids.length === 0)).length;
                        inventarioCalculado[uidGlobal].emAlteracao += tombamentos.filter(t => t.cautela || (t.pendencias_ids && t.pendencias_ids.length > 0)).length;
                    }
                });
            });
        }

        // 2. Atualiza os saldos nas sub-coleções de cada item no Inventário
        const batch = db.batch();
        const minhaUnidadeId = currentUserData.unidade_id;
        const dataReg = new Date().toLocaleString('pt-BR');

        for (const [uidGlobal, dados] of Object.entries(inventarioCalculado)) {
            const itemRef = db.collection('inventario').doc(uidGlobal);

            if (dados.tipo === 'single') {
                const saldoRef = itemRef.collection('saldos_unidades').doc(minhaUnidadeId);
                // Sincroniza apenas os campos de carga e alteração, mantendo o total e disponível
                batch.update(saldoRef, {
                    qtd_em_carga: dados.emCarga,
                    qtd_pend: dados.emAlteracao,
                    last_sync: dataReg
                });
            }
            // Itens Multi não precisam de update aqui pois o status está no documento do próprio tombamento
        }

        await batch.commit();
        alert("✅ Sincronização concluída! Saldos de carga atualizados no inventário.");

        // 3. Recarrega a UI (Substituindo o "();" anterior pela chamada correta)
        if (typeof carregarAlmoxarifadoUI === 'function') {
            await carregarAlmoxarifadoUI();
        }

    } catch (e) {
        console.error("Erro na sincronização:", e);
        alert("Erro ao sincronizar. Verifique o console.");
        if (typeof carregarAlmoxarifadoUI === 'function') {
            carregarAlmoxarifadoUI();
        }
    }
}

/**
 * RENDERIZAÇÃO DA TABELA DO ALMOXARIFADO
 * Ajustada para permitir visão global ao ADMIN e restrita ao GESTOR.
 */
async function carregarAlmoxarifadoUI() {
    const tbody = document.getElementById('almox-body');
    const palcoPrincipal = document.getElementById('container-tabela-principal');
    const wrapperRastreio = document.getElementById('almox-rastreio-wrapper');
    const filtroCard = document.getElementById('almox-filtros-container');
    const breadcrumb = document.getElementById('almox-breadcrumb');

    // Reset de UI padrão V3
    if (palcoPrincipal) palcoPrincipal.style.display = 'block';
    if (wrapperRastreio) wrapperRastreio.style.display = 'none';
    if (breadcrumb) breadcrumb.innerHTML = `Almoxarifado <i class="fas fa-chevron-right" style="font-size:0.7em; margin:0 5px;"></i> Inventário Geral`;

    if (!tbody) return;

    // Loading Padronizado V3
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:60px; color:#64748b;">
        <i class="fas fa-sync fa-spin fa-2x" style="opacity:0.3; margin-bottom:15px; display:block;"></i>
        <span style="font-weight:600;">CONSOLIDANDO INVENTÁRIO...</span>
    </td></tr>`;

    try {
        const role = currentUserData ? currentUserData.role : null;
        const isAdmin = (role === 'admin' || role === 'gestor_geral');
        const temUnidade = !!(currentUserData && currentUserData.unidade_id);

        if (!role || (!isAdmin && !temUnidade)) {
            setTimeout(carregarAlmoxarifadoUI, 1000);
            return;
        }

        const minhaUnidadeId = currentUserData.unidade_id;
        const snapItens = await db.collection('inventario').get();
        const listaFinal = [];

        for (const doc of snapItens.docs) {
            const d = doc.data();
            if (!d) continue;

            const itemConsolidado = {
                id: doc.id,
                nome: d.nome || "Item sem Nome",
                tipo: d.tipo || "single",
                categoria: d.categoria || "OUTROS",
                total: 0, disponivel: 0, emCarga: 0, emAlteracao: 0, locais: []
            };

            if (itemConsolidado.tipo === 'multi') {
                let queryTomb = doc.ref.collection('tombamentos');
                if (!isAdmin) queryTomb = queryTomb.where('local_id', '==', minhaUnidadeId);
                const snapTomb = await queryTomb.get();
                snapTomb.forEach(tDoc => {
                    const t = tDoc.data();
                    itemConsolidado.total++;
                    if (t.situacao_atual === 'DISPONÍVEL') itemConsolidado.disponivel++;
                    else if (t.situacao_atual === 'EM CARGA') itemConsolidado.emCarga++;
                    else if (['AVARIADO', 'PENDENTE', 'MANUTENÇÃO'].includes(t.situacao_atual)) itemConsolidado.emAlteracao++;
                    if (t.local_id && !itemConsolidado.locais.includes(t.local_id)) itemConsolidado.locais.push(t.local_id);
                });
            } else {
                let querySaldo = doc.ref.collection('saldos_unidades');
                if (!isAdmin) querySaldo = querySaldo.where(firebase.firestore.FieldPath.documentId(), '==', minhaUnidadeId);
                const snapSaldo = await querySaldo.get();
                snapSaldo.forEach(sDoc => {
                    const s = sDoc.data();
                    itemConsolidado.total += (Number(s.qtd_total) || 0);
                    itemConsolidado.disponivel += (Number(s.qtd_disp) || 0);
                    itemConsolidado.emCarga += (Number(s.qtd_em_carga) || 0);
                    itemConsolidado.emAlteracao += (Number(s.qtd_pend) || 0) + (Number(s.qtd_caut) || 0) + (Number(s.qtd_transito) || 0);
                    if (s.unidade_sigla && !itemConsolidado.locais.includes(s.unidade_sigla)) itemConsolidado.locais.push(s.unidade_sigla);
                });
            }
            if (itemConsolidado.total > 0 || isAdmin) listaFinal.push(itemConsolidado);
        }

        let html = '';
        listaFinal.sort((a, b) => a.nome.localeCompare(b.nome));

        if (listaFinal.length === 0) {
            html = `<tr><td colspan="6" style="text-align:center; padding:60px; color:#64748b;">
                <i class="fas fa-box-open fa-3x" style="opacity:0.2; margin-bottom:15px; display:block;"></i>
                <span style="font-weight:600;">Nenhum material localizado.</span>
            </td></tr>`;
        } else {
            listaFinal.forEach(d => {
                // Cores baseadas no design System V3
                let statusColor = (d.disponivel === 0) ? '#e11d48' : (d.disponivel < (d.total * 0.25)) ? '#f59e0b' : '#10b981';

                const labelLocais = isAdmin && d.locais.length > 0
                    ? `<div style="margin-top:4px;"><span style="font-size:10px; background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-weight:bold;"><i class="fas fa-map-marker-alt"></i> ${d.locais.join(', ')}</span></div>`
                    : '';

                html += `
                <tr data-categoria="${d.categoria.toUpperCase()}">
                    <td>
                        <div style="line-height:1.4;">
                            <span style="font-weight:700; color:#1e293b; font-size:1.1em;">${d.nome}</span>
                            ${labelLocais}
                            <div style="font-size:10px; color:#94a3b8; font-weight:700; text-transform:uppercase; margin-top:2px;">CAT: ${d.categoria} • ${d.tipo}</div>
                        </div>
                    </td>
                    <td style="text-align:center; font-weight:700; color:#475569;">${d.total}</td>
                    <td style="text-align:center; color:#64748b;">${d.emCarga}</td>
                    <td style="text-align:center; color:#e11d48; font-weight:600;">${d.emAlteracao}</td>
                    <td style="text-align:center;">
                        <span style="display:inline-block; padding:4px 12px; border-radius:8px; background:${statusColor}15; color:${statusColor}; font-weight:800; font-size:1.1em;">
                            ${d.disponivel}
                        </span>
                    </td>
                    <td>
                        <div style="display:flex; gap:8px; justify-content:center;">
                            <button class="sigma-v3-tab" title="Rastrear" onclick="verDetalhesItemAlmox('${d.id}')" style="padding:8px 12px; background:#f1f5f9;">
                                <i class="fas fa-search-location"></i>
                            </button>
                            <button class="sigma-v3-tab" title="Entrada" onclick="prepararAporte('${d.id}')" style="padding:8px 12px; background:#800020; color:white;">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
            });
        }
        tbody.innerHTML = html;
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#e11d48; padding:20px; font-weight:bold;">ERRO NA CONSOLIDAÇÃO</td></tr>';
    }
}
/**
 * Filtro de pesquisa unificado (Texto + Categoria) com feedback de lista vazia.
 */
function filtrarAlmoxarifado() {
    const searchInput = document.getElementById('almox-search');
    const catSelect = document.getElementById('almox-cat-filter');
    const searchTerm = searchInput.value.toUpperCase().trim();
    const categoryTerm = catSelect.value.toUpperCase().trim();
    const tbody = document.getElementById('almox-body');
    const rows = tbody.querySelectorAll('tr:not(.no-results-row)');

    let visibleCount = 0;

    rows.forEach(row => {
        if (!row.hasAttribute('data-categoria')) return;

        const textMaterial = row.cells[0]?.textContent.toUpperCase() || "";
        const itemCategory = row.getAttribute('data-categoria').toUpperCase().trim();

        const matchesSearch = textMaterial.includes(searchTerm);
        const matchesCategory = (categoryTerm === "" || itemCategory === categoryTerm);

        if (matchesSearch && matchesCategory) {
            row.style.display = "";
            visibleCount++;
        } else {
            row.style.display = "none";
        }
    });

    // --- LÓGICA DE MENSAGEM V3 ---
    const existingMsg = tbody.querySelector('.no-results-row');
    if (existingMsg) existingMsg.remove();

    if (visibleCount === 0) {
        const tr = document.createElement('tr');
        tr.className = 'no-results-row';
        tr.innerHTML = `
            <td colspan="6" style="text-align:center; padding:60px; color:#64748b;">
                <div style="display:flex; flex-direction:column; align-items:center; gap:12px;">
                    <i class="fas fa-box-open fa-3x" style="opacity:0.2; color:#94a3b8;"></i>
                    <span style="font-weight:600; font-size:0.95em;">Nenhum material localizado nos filtros atuais.</span>
                    <button onclick="document.getElementById('almox-search').value=''; document.getElementById('almox-cat-filter').value=''; filtrarAlmoxarifado();" 
                            style="margin-top:8px; padding:8px 16px; border-radius:8px; border:1px solid #e2e8f0; background:#fff; color:#800020; cursor:pointer; font-weight:700; font-size:0.8em; transition:0.3s; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                        <i class="fas fa-filter-circle-xmark"></i> LIMPAR BUSCA
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    }
}

async function verDetalhesItemAlmox(docId) {
    const palcoPrincipal = document.getElementById('container-tabela-principal');
    const palcoRastreio = document.getElementById('almox-rastreio-wrapper');
    const tbodyRastreio = document.getElementById('almox-rastreio-body');
    const theadRastreio = document.getElementById('almox-rastreio-thead');
    const filtroCard = document.getElementById('almox-filtros-container');
    const breadcrumb = document.getElementById('almox-breadcrumb');

    if (!docId || !palcoPrincipal || !palcoRastreio) return;

    palcoPrincipal.style.display = 'none';
    // ✅ ALTERAÇÃO CIRÚRGICA: Removida a linha que ocultava o filtroCard (display = 'none')
    // O filtro agora permanece visível para permitir buscas dentro dos detalhes do item.
    palcoRastreio.style.display = 'block';

    tbodyRastreio.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:60px; color:#64748b;">
        <i class="fas fa-radar fa-spin fa-3x" style="opacity:0.3; margin-bottom:15px; display:block;"></i>
        <span style="font-weight:600;">MAPEANDO LOGÍSTICA ESTADUAL...</span>
    </td></tr>`;

    try {
        const docAlvo = await db.collection('inventario').doc(docId).get();
        if (!docAlvo.exists) throw new Error("Item não encontrado.");

        const itemData = docAlvo.data();
        const ehMulti = itemData.tipo === 'multi';
        const uidGlobal = itemData.uid_global || docId;
        const role = currentUserData.role;
        const souAdminGeral = (role === 'admin' || role === 'gestor_geral');

        if (breadcrumb) breadcrumb.innerHTML = `Almoxarifado <i class="fas fa-chevron-right" style="font-size:0.7em; margin:0 5px;"></i> Detalhes <i class="fas fa-chevron-right" style="font-size:0.7em; margin:0 5px;"></i> <b style="color:#800020;">${itemData.nome}</b>`;

        const btnHistGlobal = !ehMulti ?
            `<button class="sigma-v3-tab" title="Ver histórico de movimentações do lote" onclick="verHistoricoVidaGlobal('${docId}')" style="background:#fef3c7; color:#92400e; border:none;"><i class="fas fa-history"></i> Lote</button>` : '';

        const headerHtml = `
            <div id="header-detalhe-item" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding:15px; background:#f8fafc; border-radius:12px;">
                <div>
                    <h2 style="margin:0; color:#1e293b; font-size:1.4em; font-weight:800;">${itemData.nome}</h2>
                    <small style="color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Rastreio em Tempo Real</small>
                </div>
                ${btnHistGlobal}
            </div>`;

        const oldHeader = document.getElementById('header-detalhe-item');
        if (oldHeader) oldHeader.remove();
        palcoRastreio.prepend(new DOMParser().parseFromString(headerHtml, 'text/html').body.firstChild);

        theadRastreio.innerHTML = `
            <tr>
                ${ehMulti ? '<th>Tombamento / Unidade</th>' : '<th>Localização / Unidade</th>'}
                <th style="text-align:center;">Saldo</th>
                <th style="text-align:center;">Status</th>
                <th style="text-align:right;">Ações</th>
            </tr>`;

        let htmlPrioridade = ''; let htmlRestante = '';
        let cDisp = 0, cUso = 0, cCaut = 0, cPend = 0;
        const pendenciasVtrMap = {};

        // --- 1. PROCESSAMENTO DE ESTOQUE (ALMOXARIFADO) ---
        if (ehMulti) {
            const snapTombs = await db.collection('inventario').doc(docId).collection('tombamentos').get();
            for (const tDoc of snapTombs.docs) {
                const t = tDoc.data();
                const ehDono = (t.local_id === currentUserData.unidade_id);
                const podeEnviar = (souAdminGeral && t.local_id === "ADMIN") || (ehDono && !souAdminGeral);
                if (!t.viatura_id) {
                    const temP = t.pendencias_ids?.length > 0;
                    if (ehDono || souAdminGeral) { if (temP) cPend++; else cDisp++; }
                    const statusTxt = temP ? 'PENDENTE' : 'DISPONÍVEL';
                    const badgeStyle = temP ? 'background:#fee2e2;color:#b91c1c;' : 'background:#dcfce7;color:#15803d;';
                    let bufferHtml = `
                        <tr style="background:${ehDono ? 'rgba(16,185,129,0.03)' : '#fff'};">
                            <td><span style="font-weight:700; color:#1e293b;">${t.tomb}</span><br><small style="color:#64748b;"><i class="fas fa-warehouse"></i> ${t.unidade_sigla || '---'}</small></td>
                            <td style="text-align:center; font-weight:800; color:#1e293b;">1 un.</td>
                            <td style="text-align:center;"><span style="padding:4px 10px; border-radius:6px; font-size:0.75em; font-weight:800; ${badgeStyle}">${statusTxt}</span></td>
                            <td style="text-align:right;">
                                <div style="display:flex; gap:5px; justify-content:flex-end;">
                                    ${podeEnviar ? `<button onclick="prepararMovimentacao('${docId}','ENVIO','${t.tomb}')" title="Enviar para outra unidade" class="sigma-v3-tab active" style="padding:6px 10px; background:#800020;"><i class="fas fa-paper-plane"></i></button>` : ''}
                                    <button onclick="verHistoricoVidaGlobal('${docId}', '${t.tomb}')" title="Ver histórico individual" class="sigma-v3-tab" style="padding:6px 10px; background:#fef3c7; color:#92400e;"><i class="fas fa-history"></i></button>
                                </div>
                            </td>
                        </tr>`;
                    if (ehDono) htmlPrioridade += bufferHtml; else htmlRestante += bufferHtml;
                }
            }
        } else {
            const snapSaldos = await db.collection('inventario').doc(docId).collection('saldos_unidades').get();
            for (const sDoc of snapSaldos.docs) {
                const s = sDoc.data();
                const ehDono = (sDoc.id === currentUserData.unidade_id);
                const podeEnviar = (souAdminGeral && sDoc.id === "ADMIN") || (ehDono && !souAdminGeral);

                const snapLogs = await sDoc.ref.collection('historico_vida').where('evento', '==', 'PENDENCIA_RELATADA').get();
                let pendenciaVazanteParaVtr = 0;

                snapLogs.forEach(logDoc => {
                    const log = logDoc.data();
                    if (log.lista_origem_id) {
                        pendenciasVtrMap[log.lista_origem_id] = (pendenciasVtrMap[log.lista_origem_id] || 0) + (log.quantidade || 0);
                        pendenciaVazanteParaVtr += (log.quantidade || 0);
                    }
                });

                const saldoDispRealAlmox = Number(s.qtd_disp) || 0;
                const saldoPendLocalAlmox = (Number(s.qtd_pend) || 0) - pendenciaVazanteParaVtr;
                const saldoFisicoNoAlmox = saldoDispRealAlmox + saldoPendLocalAlmox;

                if (ehDono || souAdminGeral) { cDisp += saldoDispRealAlmox; }

                if (saldoFisicoNoAlmox > 0) {
                    let statusHtml = '';
                    if (saldoDispRealAlmox > 0 && saldoPendLocalAlmox > 0) {
                        statusHtml = `<div><span style="font-size:0.75em; font-weight:800; color:#15803d;">${saldoDispRealAlmox} un. DISPONÍVEL</span></div>
                                      <div style="margin-top:2px;"><span style="padding:2px 8px; border-radius:4px; font-size:0.7em; font-weight:800; background:#fee2e2; color:#b91c1c;">${saldoPendLocalAlmox} un. PENDENTE</span></div>`;
                    } else if (saldoPendLocalAlmox > 0) {
                        statusHtml = `<span style="padding:4px 10px; border-radius:6px; font-size:0.75em; font-weight:800; background:#fee2e2; color:#b91c1c;">${saldoPendLocalAlmox} un. PENDENTE</span>`;
                    } else {
                        statusHtml = `<span style="padding:4px 10px; border-radius:6px; font-size:0.75em; font-weight:800; background:#dcfce7; color:#15803d;">DISPONÍVEL</span>`;
                    }

                    let bufferHtml = `
                        <tr style="background:${ehDono ? 'rgba(16,185,129,0.03)' : '#fff'};">
                            <td><i class="fas fa-warehouse" style="margin-right:8px; color:#64748b;"></i><span style="font-weight:700;">${s.unidade_sigla}</span></td>
                            <td style="text-align:center; font-weight:800; color:#1e293b;">${saldoFisicoNoAlmox} un.</td>
                            <td style="text-align:center;">${statusHtml}</td>
                            <td style="text-align:right;">
                                ${podeEnviar ? `<button onclick="prepararMovimentacao('${docId}','ENVIO')" title="Transferir saldo" class="sigma-v3-tab active" style="background:#800020;"><i class="fas fa-paper-plane"></i></button>` : ''}
                            </td>
                        </tr>`;
                    if (ehDono) htmlPrioridade += bufferHtml; else htmlRestante += bufferHtml;
                }
            }
        }

        // --- 2. BUSCA EM VIATURAS ---
        const snapListas = await db.collection('listas_conferencia').where('ativo', '==', true).get();
        snapListas.forEach(docVtr => {
            const vtrData = docVtr.data();
            const ehMinhaVtr = (vtrData.unidade_id === currentUserData.unidade_id);

            (vtrData.list || []).forEach(setor => {
                (setor.itens || []).forEach(itemPrincipal => {

                    // A. Verifica se o item principal é o alvo
                    let itemAlvo = null;
                    let infoAdicional = "";

                    if (itemPrincipal.uid_global === uidGlobal || itemPrincipal.nome === itemData.nome) {
                        itemAlvo = itemPrincipal;
                    }
                    // ✅ NOVO: B. Verifica se o alvo está "escondido" dentro de um Kit (Acessórios)
                    else if (itemPrincipal.acessorios_acoplados) {
                        const ac = itemPrincipal.acessorios_acoplados.find(a => a.uid_global === uidGlobal);
                        if (ac) {
                            itemAlvo = ac;
                            infoAdicional = ` <small style="color:#800020; font-weight:800;">[NO KIT: ${itemPrincipal.nome}]</small>`;
                        }
                    }

                    if (!itemAlvo) return;

                    if (ehMulti) {
                        // ... (Mantenha sua lógica original de Multi aqui se necessário, 
                        // mas geralmente itens Multi como Suportes Dorsais são os Pais)
                        (itemAlvo.tombamentos || []).forEach(t => {
                            const temC = !!t.cautela; const temP = t.pendencias_ids?.length > 0;
                            if (ehMinhaVtr || souAdminGeral) { if (temP) cPend++; else if (temC) cCaut++; else cUso++; }
                            const statusTxt = temP ? 'PENDENTE' : (temC ? 'CAUTELADO' : 'EM USO');
                            const badgeStyle = temP ? 'background:#fee2e2;color:#b91c1c;' : (temC ? 'background:#fff3cd;color:#856404;' : 'background:#f1f5f9;color:#475569;');
                            let bufferVtr = `<tr style="background:${ehMinhaVtr ? 'rgba(16,185,129,0.03)' : '#fff'};">
                                <td><span style="font-weight:700;">${t.tomb}</span>${infoAdicional}<br><small style="color:#64748b;"><i class="fas fa-truck-container" style="margin-right:5px;"></i> ${vtrData.ativo_nome}</small></td>
                                <td style="text-align:center; font-weight:800; color:#1e293b;">1 un.</td>
                                <td style="text-align:center;"><span style="padding:4px 10px; border-radius:6px; font-size:0.75em; font-weight:800; ${badgeStyle}">${statusTxt}</span></td>
                                <td style="text-align:right;">
                                    <div style="display:flex; gap:5px; justify-content:flex-end;">
                                        ${ehMinhaVtr || role === 'admin' ? `<button onclick="prepararMovimentacao('${docId}','RECOLHIMENTO','${t.tomb}','${docVtr.id}')" title="Retornar ao estoque" class="sigma-v3-tab" style="background:#f59e0b; color:white;"><i class="fas fa-arrow-down"></i></button>` : ''}
                                        <button onclick="verHistoricoVidaGlobal('${docId}', '${t.tomb}')" title="Ver histórico" class="sigma-v3-tab" style="padding:6px 10px; background:#fef3c7; color:#92400e;"><i class="fas fa-history"></i></button>
                                    </div>
                                </td>
                            </tr>`;
                            if (ehMinhaVtr) htmlPrioridade += bufferVtr; else htmlRestante += bufferVtr;
                        });
                    } else {
                        // Lógica para itens SINGLE (Cilindros, Máscaras, etc.)
                        const qtdFisicaVtr = Number(itemAlvo.quantidadeEsperada || itemAlvo.quantidade) || 0;
                        const qtdPendVtr = pendenciasVtrMap[docVtr.id] || 0;
                        const qtdEmUsoLimpa = qtdFisicaVtr - qtdPendVtr;

                        if (ehMinhaVtr || souAdminGeral) {
                            cUso += qtdEmUsoLimpa;
                            cPend += qtdPendVtr;
                        }

                        if (qtdFisicaVtr > 0) {
                            let statusHtml = '';
                            if (qtdEmUsoLimpa > 0 && qtdPendVtr > 0) {
                                statusHtml = `<div><span style="font-size:0.75em; font-weight:800; color:#475569;">${qtdEmUsoLimpa} un. EM USO</span></div>
                                              <div style="margin-top:2px;"><span style="padding:2px 8px; border-radius:4px; font-size:0.7em; font-weight:800; background:#fee2e2; color:#b91c1c;">${qtdPendVtr} un. PENDENTE</span></div>`;
                            } else if (qtdPendVtr > 0) {
                                statusHtml = `<span style="padding:4px 10px; border-radius:6px; font-size:0.75em; font-weight:800; background:#fee2e2; color:#b91c1c;">${qtdPendVtr} un. PENDENTE</span>`;
                            } else {
                                statusHtml = `<span style="padding:4px 10px; border-radius:6px; font-size:0.75em; font-weight:800; background:#f1f5f9; color:#475569;">EM USO</span>`;
                            }

                            let bufferVtr = `<tr style="background:${ehMinhaVtr ? 'rgba(16,185,129,0.03)' : '#fff'};">
                                <td><i class="fas fa-truck-pickup" style="margin-right:8px; color:#64748b;"></i><span style="font-weight:700;">${vtrData.ativo_nome}</span>${infoAdicional}</td>
                                <td style="text-align:center; font-weight:800; color:#1e293b;">${qtdFisicaVtr} un.</td>
                                <td style="text-align:center;">${statusHtml}</td>
                                <td style="text-align:right;">
                                    ${ehMinhaVtr || role === 'admin' ?
                                    `<button onclick="prepararMovimentacao('${docId}','RECOLHIMENTO', null,'${docVtr.id}')" title="Recolher material" class="sigma-v3-tab" style="background:#f59e0b; color:white;"><i class="fas fa-arrow-down"></i></button>` : ''}
                                </td>
                            </tr>`;
                            if (ehMinhaVtr) htmlPrioridade += bufferVtr; else htmlRestante += bufferVtr;
                        }
                    }
                });
            });
        });

        let finalHtml = "";
        if (htmlPrioridade) {
            finalHtml += `<tr class="sigma-v3-table-group-header"><td colspan="4" style="background:#f0fdf4; color:#166534; font-weight:800; font-size:0.75em; padding:10px 15px; text-transform:uppercase; letter-spacing:1px; border-left:4px solid #10b981;"><i class="fas fa-shield-alt"></i> Custódia de Minha Unidade (Estoque Local)</td></tr>`;
            finalHtml += htmlPrioridade;
        }
        if (htmlRestante) {
            finalHtml += `<tr class="sigma-v3-table-group-header"><td colspan="4" style="background:#f8fafc; color:#64748b; font-weight:800; font-size:0.75em; padding:25px 15px 10px 15px; text-transform:uppercase; letter-spacing:1px; border-left:4px solid #cbd5e1;"><i class="fas fa-globe-americas"></i> Disponibilidade em Outras Unidades (Consulta Global)</td></tr>`;
            finalHtml += htmlRestante;
        }

        const totalG = cDisp + cUso + cCaut + cPend;
        const extratoHtml = `
            <div id="almox-resumo-topo" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap:15px; margin-bottom:25px;">
                <div style="background:#dcfce7; padding:15px; border-radius:12px; text-align:center; border:1px solid #bcf0da;">
                    <small style="color:#15803d; font-weight:800; display:block; font-size:0.7em; text-transform:uppercase;">Disponível</small>
                    <b style="font-size:1.6em; color:#15803d;">${cDisp}</b>
                </div>
                <div style="background:#f1f5f9; padding:15px; border-radius:12px; text-align:center; border:1px solid #e2e8f0;">
                    <small style="color:#475569; font-weight:800; display:block; font-size:0.7em; text-transform:uppercase;">Em Uso</small>
                    <b style="font-size:1.6em; color:#475569;">${cUso}</b>
                </div>
                <div style="background:#fff3cd; padding:15px; border-radius:12px; text-align:center; border:1px solid #ffeeba;">
                    <small style="color:#856404; font-weight:800; display:block; font-size:0.7em; text-transform:uppercase;">Cautelado</small>
                    <b style="font-size:1.6em; color:#856404;">${cCaut}</b>
                </div>
                <div style="background:#fee2e2; padding:15px; border-radius:12px; text-align:center; border:1px solid #fecaca;">
                    <small style="color:#b91c1c; font-weight:800; display:block; font-size:0.7em; text-transform:uppercase;">Pendente</small>
                    <b style="font-size:1.6em; color:#b91c1c;">${cPend}</b>
                </div>
                <div style="background:#800020; padding:15px; border-radius:12px; text-align:center;">
                    <small style="color:#fff; font-weight:800; display:block; font-size:0.7em; text-transform:uppercase;">Total Geral</small>
                    <b style="font-size:1.6em; color:#fff;">${totalG}</b>
                </div>
            </div>`;

        const resOld = document.getElementById('almox-resumo-topo');
        if (resOld) resOld.remove();
        palcoRastreio.querySelector('#header-detalhe-item').insertAdjacentHTML('afterend', extratoHtml);
        tbodyRastreio.innerHTML = finalHtml || `<tr><td colspan="4" style="text-align:center; padding:60px; color:#64748b;"><i class="fas fa-box-open fa-3x" style="opacity:0.2; margin-bottom:15px; display:block;"></i>Nenhum registro localizado.</td></tr>`;

    } catch (e) {
        console.error(e);
        tbodyRastreio.innerHTML = '<tr><td colspan="4" style="color:#e11d48; text-align:center; font-weight:bold; padding:40px;">ERRO NO PROCESSAMENTO DE RASTREIO</td></tr>';
    }
}

/**
 * Função de ponte que prepara o modal de transferência com os dados clicados na lupa
 */
async function prepararMovimentacao(docId, operacao, tombamento = null, viaturaId = null) {
    // 1. Busca os dados do item no Inventário V3 antes de abrir o modal
    const docAlvo = await db.collection('inventario').doc(docId).get();
    if (!docAlvo.exists) return alert("Erro ao localizar item no inventário.");

    const itemData = docAlvo.data();
    const ehMulti = itemData.tipo === 'multi';
    const role = currentUserData.role;
    const souAdmin = (role === 'admin' || role === 'gestor_geral');

    // ✅ NOVO: INTERCEPTAÇÃO DE ANFITRIÃO (Apenas no ENVIO)
    // Se o item for um anfitrião (Kit) e estiver saindo do estoque
    if (operacao === 'ENVIO' && itemData.is_anfitriao && !souAdmin) {
        return abrirModalAcoplamentoAnfitriao(docId, itemData, tombamento);
    }

    // 2. Define Identidade Visual (Cores e Títulos)
    const config = {
        ENVIO: {
            titulo: souAdmin ? "Transferência de Unidade" : "Enviar para Viatura",
            cor: "#2c7399",
            icone: "fa-paper-plane",
            btnTexto: souAdmin ? "CONFIRMAR TRANSFERÊNCIA" : "CONFIRMAR ENVIO"
        },
        RECOLHIMENTO: {
            titulo: "Recolher para Almoxarifado",
            cor: "#f57c00",
            icone: "fa-arrow-down",
            btnTexto: "CONFIRMAR RECOLHIMENTO"
        }
    }[operacao];

    // 3. Monta o Modal SweetAlert2 Moderno
    Swal.fire({
        title: `<i class="fas ${config.icone}"></i> ${config.titulo}`,
        html: `
            <div style="text-align: left; padding: 5px;">
                <div class="summary-item-modal" style="background:#f8fafc; padding:10px; border-radius:8px; margin-bottom:15px; border-left:4px solid ${config.cor};">
                    <small style="color:#64748b; font-weight:700; text-transform:uppercase; font-size:0.7em;">Item Selecionado</small>
                    <div style="font-weight:800; color:#1e293b; font-size:1.1em;">${itemData.nome}</div>
                </div>

                <div class="form-group">
                    <label style="font-size: 0.85em; font-weight:bold; color:#800020;">
                        ${souAdmin ? '1. UNIDADE DE DESTINO:' : '1. VIATURA / LOCAL ALVO:'}
                    </label>
                    <select id="swal-mov-destino" class="swal2-select" style="width: 100%; margin: 10px 0;">
                        <option value="" disabled selected>Selecione o destino...</option>
                    </select>
                </div>

                ${!souAdmin && operacao === 'ENVIO' ? `
                <div class="form-group" style="margin-top:15px;">
                    <label style="font-size: 0.85em; font-weight:bold; color:#800020;">2. SETOR DE CARGA:</label>
                    <select id="swal-mov-setor" class="swal2-select" style="width: 100%; margin: 10px 0;">
                        <option value="CABINE">CABINE</option>
                        <option value="CARROCERIA">CARROCERIA</option>
                    </select>
                </div>` : ''}

                <div class="form-group" style="margin-top:15px;">
                    <label id="label-qtd-swal" style="font-size: 0.85em; font-weight:bold; color:#800020;">
                        ${ehMulti ? 'PATRIMÔNIO / TOMBAMENTO:' : 'QUANTIDADE PARA MOVIMENTAR:'}
                    </label>
                    
                    ${ehMulti ? `
                        <div id="lista-tomb-swal" style="max-height:150px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:6px; padding:10px; margin-top:5px; background:#fff;">
                            <i class="fas fa-spinner fa-spin"></i> Carregando materiais...
                        </div>
                    ` : `
                        <input type="number" id="swal-mov-qtd" class="swal2-input" 
                            style="width:80%; margin:10px 0;" placeholder="0" min="1" max="0"
                            oninput="if(parseInt(this.value) > parseInt(this.max)) { this.value = this.max; Swal.showValidationMessage('Saldo insuficiente! Máximo: ' + this.max); } else { Swal.resetValidationMessage(); }">
                    `}
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: config.btnTexto,
        confirmButtonColor: config.cor,
        cancelButtonText: 'Cancelar',
        didOpen: async () => {
            await popularDestinosMovimentacao(souAdmin, operacao, viaturaId);

            if (ehMulti) {
                await popularTombamentosMovimentacao(docId, operacao, tombamento, viaturaId, config.cor);
            } else {
                try {
                    const minhaUnidadeId = currentUserData.unidade_id;
                    const snapSaldo = await db.collection('inventario').doc(docId)
                        .collection('saldos_unidades').doc(minhaUnidadeId).get();

                    const saldoDisp = snapSaldo.exists ? (snapSaldo.data().qtd_disp || 0) : 0;
                    const inputQtd = document.getElementById('swal-mov-qtd');
                    const labelQtd = document.getElementById('label-qtd-swal');

                    if (inputQtd) {
                        inputQtd.max = saldoDisp;
                        if (labelQtd) {
                            labelQtd.innerHTML = `QUANTIDADE PARA MOVIMENTAR: <span style="float:right; color:#1b8a3e;">Saldo Disponível: ${saldoDisp}</span>`;
                        }
                        if (saldoDisp <= 0 && operacao === 'ENVIO') {
                            inputQtd.disabled = true;
                            Swal.showValidationMessage('Atenção: Esta unidade não possui saldo disponível para envio.');
                        }
                    }
                } catch (e) { console.error("Erro ao carregar saldo:", e); }
            }
        },
        preConfirm: () => {
            const destino = document.getElementById('swal-mov-destino').value;
            const inputQtd = document.getElementById('swal-mov-qtd');

            if (!destino) return Swal.showValidationMessage('Por favor, selecione o destino');

            if (inputQtd) {
                const qtdValor = parseInt(inputQtd.value);
                const qtdMax = parseInt(inputQtd.max);

                if (!qtdValor || qtdValor <= 0) return Swal.showValidationMessage('Informe uma quantidade válida');
                if (qtdValor > qtdMax && operacao === 'ENVIO') {
                    return Swal.showValidationMessage(`Saldo insuficiente! Você só possui ${qtdMax} unidades.`);
                }

                return {
                    destinoId: destino,
                    quantidade: qtdValor,
                    tombamentos: null,
                    setorId: document.getElementById('swal-mov-setor')?.value || 'CABINE'
                };
            }

            return {
                destinoId: destino,
                quantidade: null,
                tombamentos: ehMulti ? Array.from(document.querySelectorAll('.swal-tomb-check:checked')).map(cb => cb.value) : null,
                setorId: document.getElementById('swal-mov-setor')?.value || 'CABINE'
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            executarMovimentacaoReal(docId, operacao, result.value);
        }
    });
}

// Adicionado o parâmetro setorDestinoIdx para saber onde inserir ao confirmar
async function abrirModalAcoplamentoAnfitriao(docId, itemData, tombamentoAlvo = null, setorDestinoIdx = null) {
    const minhaUnidadeId = currentUserData.unidade_id;
    const componentesRegra = itemData.componentes_regra || [];

    const isNoEditor = (document.getElementById('view-editor-arquitetura').style.display === 'block');

    Swal.fire({
        title: 'Montagem de Kit / Acoplamento',
        width: '600px',
        html: `
            <div style="text-align: left; padding: 5px;">
                <div style="background: #fff8e1; padding: 12px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #ffe0b2;">
                    <small style="color: #e65100; font-weight: 800; text-transform: uppercase; font-size: 0.7em;">Item Anfitrião Identificado</small>
                    <div style="font-weight: 800; color: #333; font-size: 1.1em;">${itemData.nome} ${tombamentoAlvo ? `[TOMB: ${tombamentoAlvo}]` : ''}</div>
                    <p style="font-size: 0.8em; margin: 5px 0 0 0; color: #666;">
                        ${isNoEditor ? 'Selecione os acessórios que compõem este conjunto para a lista atual.' : 'Deseja acoplar acessórios a este item antes de enviar?'}
                    </p>
                </div>

                <div id="container-acoplamento-dinamico">
                    <i class="fas fa-sync fa-spin"></i> Consultando estoque...
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'CONFIRMAR COMPOSIÇÃO',
        confirmButtonColor: '#1b8a3e',
        cancelButtonText: 'CANCELAR',
        didOpen: async () => {
            const container = document.getElementById('container-acoplamento-dinamico');
            let htmlComponentes = "";

            if (componentesRegra.length === 0) {
                container.innerHTML = `<p style="font-size:0.85em; color:#94a3b8;">Nenhuma regra de montagem definida.</p>`;
                return;
            }

            for (const regra of componentesRegra) {
                const snapEstoque = await db.collection('inventario')
                    .where(firebase.firestore.FieldPath.documentId(), '>=', regra.familia_uid)
                    .where(firebase.firestore.FieldPath.documentId(), '<=', regra.familia_uid + '\uf8ff')
                    .get();

                let optionsItens = `<option value="">Não acoplar ${regra.nome_familia}</option>`;
                let temDisponivel = false;

                for (const docIt of snapEstoque.docs) {
                    const itGlobal = docIt.data();
                    const saldoDoc = await docIt.ref.collection('saldos_unidades').doc(minhaUnidadeId).get();

                    if (saldoDoc.exists) {
                        const disponivel = Number(saldoDoc.data().qtd_disp) || 0;
                        if (disponivel > 0) {
                            temDisponivel = true;
                            optionsItens += `<option value="${docIt.id}">${itGlobal.nome} (Disp: ${disponivel})</option>`;
                        }
                    }
                }

                htmlComponentes += `
                    <div class="linha-acoplamento" style="margin-bottom: 15px; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
                        <label style="display:block; font-weight:800; font-size:0.7em; color:#64748b; text-transform:uppercase; margin-bottom:8px;">${regra.nome_familia}</label>
                        <div style="display:flex; gap:10px;">
                            <select class="swal2-select select-item-acoplar" style="flex:2; margin:0; font-size:0.85em; height: 42px;">
                                ${temDisponivel ? optionsItens : `<option value="">Sem saldo em ${currentUserData.unidade}</option>`}
                            </select>
                            <input type="number" class="swal2-input input-qtd-acoplar" value="${temDisponivel ? regra.qtd_sugerida : 0}" min="1" style="flex:0.5; margin:0; height:42px; font-size:0.9em; text-align:center;" ${!temDisponivel ? 'disabled' : ''}>
                        </div>
                    </div>`;
            }
            container.innerHTML = htmlComponentes;
        },
        preConfirm: () => {
            const acoplados = [];
            const linhas = document.querySelectorAll('.linha-acoplamento');

            linhas.forEach(linha => {
                const select = linha.querySelector('.select-item-acoplar');
                const input = linha.querySelector('.input-qtd-acoplar');

                if (select && select.value) {
                    acoplados.push({
                        uid_global: select.value,
                        nome: select.options[select.selectedIndex].text.split(' (Disp:')[0],
                        quantidade: parseInt(input.value) || 0
                    });
                }
            });
            return acoplados;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const acopladosConfirmados = result.value || [];

            if (isNoEditor) {
                itemSelecionadoTemp = {
                    ...itemData,
                    id_almox: docId,
                    tombamentoExibicao: tombamentoAlvo,
                    acessorios_acoplados: acopladosConfirmados,
                    acessorios_ja_montados: true
                };

                exibirDraftCard(`${itemData.nome} [TOMB: ${tombamentoAlvo}] + ${acopladosConfirmados.length} acessórios`);

                // ✅ AJUSTE AQUI: Chama a gravação final diretamente
                if (setorDestinoIdx !== null) {
                    executarInsercaoNoSetor(setorDestinoIdx);
                } else {
                    setTimeout(() => {
                        const selectSetor = document.getElementById('select-setor-destino');
                        if (selectSetor) {
                            selectSetor.focus();
                            selectSetor.style.border = "2px solid #2c7399";
                        }
                    }, 100);
                }

            } else {
                executarMovimentacaoAnfitriao(docId, 'ENVIO', {
                    tombamento: tombamentoAlvo,
                    acessorios: acopladosConfirmados
                });
            }
        } else {
            // Se cancelar, reseta o select para o usuário não achar que o item foi adicionado
            const selectSetor = document.getElementById('select-setor-destino');
            if (selectSetor) selectSetor.value = "";
        }
    });
}

function executarInsercaoNoSetor(setorIdx) {
    const selectSetor = document.getElementById('select-setor-destino');
    const inputBusca = document.getElementById('input-busca-estoque');

    const novoItem = {
        uid_global: itemSelecionadoTemp.uid_global || itemSelecionadoTemp.id_almox,
        nome: itemSelecionadoTemp.nome,
        tipo: itemSelecionadoTemp.tipo,
        quantidadeEsperada: 0,
        is_anfitriao: itemSelecionadoTemp.is_anfitriao || false
    };

    // Recupera os acessórios (se houver)
    const acessorios = itemSelecionadoTemp.acessorios_acoplados || itemSelecionadoTemp.acessoriosEscolhidos;
    if (novoItem.is_anfitriao && acessorios) {
        novoItem.acessorios_acoplados = JSON.parse(JSON.stringify(acessorios));
    }

    // Define Saldos/Tombamentos
    if (itemSelecionadoTemp.tipo === 'single') {
        novoItem.quantidadeEsperada = itemSelecionadoTemp.quantidadeEscolhida || 1;
    } else {
        novoItem.tombamentos = [{
            tomb: itemSelecionadoTemp.tombamentoExibicao,
            situacao: "EM CARGA"
        }];
        novoItem.quantidadeEsperada = 1;
    }

    // Inserção na Arquitetura Ativa
    if (!arquiteturaAtiva[setorIdx].itens) arquiteturaAtiva[setorIdx].itens = [];
    arquiteturaAtiva[setorIdx].itens.push(novoItem);

    // LIMPEZA E FINALIZAÇÃO
    cancelarRascunho();

    if (selectSetor) {
        selectSetor.value = "";
        selectSetor.style.border = "1px solid #cbd5e1";
    }

    // Só mescla se NÃO for kit
    if (!novoItem.is_anfitriao) {
        processarMesclagemAutomatica(setorIdx);
    }

    marcarAlteracao();
    renderizarArquiteturaEditor();

    if (inputBusca) {
        inputBusca.value = '';
        inputBusca.focus();
    }
}

async function executarMovimentacaoAnfitriao(uidAnfitriao, operacao, dadosKit) {
    const { tombamento, acessorios } = dadosKit;
    const minhaUnidadeId = currentUserData.unidade_id;
    const dataReg = new Date().toLocaleString('pt-BR');
    const autor = currentUserData.nome_militar_completo;

    const { value: formValues } = await Swal.fire({
        title: '<span style="font-size: 1.2em; font-weight: 800; color: #1e293b;">Destino do Conjunto</span>',
        width: '500px',
        html: `
            <div style="text-align: left; margin-top: 15px;">
                <label style="font-size: 0.75em; font-weight: 800; color: #64748b; text-transform: uppercase;">1. Viatura / Destino Alvo:</label>
                <select id="swal-destino-kit" class="swal2-select" style="width: 100%; height: 45px; margin: 8px 0 20px 0; display: flex;"></select>
                <label style="font-size: 0.75em; font-weight: 800; color: #64748b; text-transform: uppercase;">2. Setor de Carga Disponível:</label>
                <select id="swal-setor-kit" class="swal2-select" style="width: 100%; height: 45px; margin: 8px 0 5px 0; display: flex;" disabled></select>
            </div>
        `,
        didOpen: () => {
            const selectVtr = document.getElementById('swal-destino-kit');
            const selectSetor = document.getElementById('swal-setor-kit');
            popularDestinosMovimentacao(false, 'ENVIO');
            selectVtr.addEventListener('change', async (e) => {
                const vtrId = e.target.value;
                if (!vtrId) return;
                const docVtr = await db.collection('listas_conferencia').doc(vtrId).get();
                if (docVtr.exists) {
                    const setores = docVtr.data().list || [];
                    selectSetor.innerHTML = setores.map(s => `<option value="${s.nome}">${s.nome}</option>`).join('');
                    selectSetor.disabled = false;
                }
            });
        },
        preConfirm: () => {
            const d = document.getElementById('swal-destino-kit').value;
            const s = document.getElementById('swal-setor-kit').value;
            if (!d || !s) return Swal.showValidationMessage('Selecione viatura e setor!');
            return { destinoId: d, setorId: s }
        }
    });

    if (!formValues) return;

    Swal.fire({ title: 'Processando Kit...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        await db.runTransaction(async (transaction) => {
            // --- 1. BLOCO DE LEITURAS (OBRIGATÓRIO NO TOPO) ---

            // Leitura Viatura
            const vtrRef = db.collection('listas_conferencia').doc(formValues.destinoId);
            const vtrSnap = await transaction.get(vtrRef);

            // Leitura Anfitrião
            const anfitriaoRef = db.collection('inventario').doc(uidAnfitriao);
            const anfitriaoSnap = await transaction.get(anfitriaoRef);

            // Leituras de Saldos dos Acessórios (Mapeamos todos antes das escritas)
            const acessoriosSaldosSnaps = [];
            for (const ac of acessorios) {
                const sRef = db.collection('inventario').doc(ac.uid_global).collection('saldos_unidades').doc(minhaUnidadeId);
                const sSnap = await transaction.get(sRef);
                acessoriosSaldosSnaps.push({ snap: sSnap, ref: sRef, info: ac });
            }

            // --- 2. VALIDAÇÕES ---
            if (!vtrSnap.exists) throw new Error("Viatura não encontrada.");
            if (!anfitriaoSnap.exists) throw new Error("Anfitrião não encontrado.");

            for (const item of acessoriosSaldosSnaps) {
                if (!item.snap.exists || item.snap.data().qtd_disp < item.info.quantidade) {
                    throw new Error(`Saldo insuficiente: ${item.info.nome}`);
                }
            }

            // --- 3. BLOCO DE ESCRITAS (APÓS TODAS AS LEITURAS) ---

            const vtrData = vtrSnap.data();
            let novaLista = [...vtrData.list];
            let setorObj = novaLista.find(s => s.nome === formValues.setorId);

            const itemAnfitriaoParaVtr = {
                uid_global: uidAnfitriao,
                nome: anfitriaoSnap.data().nome,
                tipo: 'multi',
                quantidadeEsperada: 1,
                tombamentos: [{ tomb: tombamento, situacao: "EM CARGA" }],
                acessorios_acoplados: acessorios
            };
            setorObj.itens.push(itemAnfitriaoParaVtr);

            // Escrita Anfitrião
            const tombRef = anfitriaoRef.collection('tombamentos').doc(tombamento);
            transaction.update(tombRef, {
                viatura_id: formValues.destinoId,
                situacao_atual: "EM CARGA",
                acessorios_vinculados: acessorios,
                ultima_mov: dataReg
            });

            // Escritas Acessórios
            for (const item of acessoriosSaldosSnaps) {
                transaction.update(item.ref, {
                    qtd_disp: firebase.firestore.FieldValue.increment(-item.info.quantidade),
                    qtd_em_carga: firebase.firestore.FieldValue.increment(item.info.quantidade),
                    last_update: dataReg
                });

                const histRef = item.ref.collection('historico_vida').doc();
                transaction.set(histRef, {
                    data: dataReg,
                    evento: "ACOPLAMENTO_KIT",
                    detalhes: `Acoplado ao Suporte ${tombamento} -> Destino: ${vtrData.ativo_nome}`,
                    quem: autor,
                    quantidade: item.info.quantidade
                });
            }

            transaction.update(vtrRef, { list: novaLista });
        });

        Swal.fire('Sucesso!', 'Kit montado e enviado.', 'success');
        if (typeof carregarAlmoxarifadoUI === 'function') carregarAlmoxarifadoUI();

    } catch (e) {
        console.error("Erro na Transaction:", e);
        Swal.fire('Erro de Sincronismo', e.message, 'error');
    }
}

async function popularDestinosMovimentacao(souAdmin, operacao, viaturaIdPreSeleccionada = null) {
    // ✅ CORREÇÃO: Tenta encontrar o ID do modal comum OU o ID do modal de kit
    const selectDestino = document.getElementById('swal-mov-destino') || document.getElementById('swal-destino-kit');

    if (!selectDestino) {
        console.warn("⚠️ [DEBUG] Select de destino não encontrado no DOM.");
        return;
    }

    try {
        let htmlOptions = `<option value="" disabled selected>Selecione o destino...</option>`;

        if (souAdmin) {
            const snapUnidades = await db.collection('unidades_estruturadas')
                .where('ativo', '==', true)
                .get();

            const unidades = snapUnidades.docs.map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => a.sigla.localeCompare(b.sigla));

            unidades.forEach(u => {
                htmlOptions += `<option value="${u.id}">${u.sigla} - ${u.nome_completo}</option>`;
            });
        } else {
            // GESTOR LOCAL: Busca as listas de conferência (ABT, ABS, etc)
            const snapVtrs = await db.collection('listas_conferencia')
                .where('unidade_id', '==', currentUserData.unidade_id)
                .where('ativo', '==', true)
                .get();

            if (snapVtrs.empty) {
                htmlOptions = `<option value="">Nenhuma viatura ativa na unidade</option>`;
            } else {
                snapVtrs.forEach(doc => {
                    const data = doc.data();
                    const isSelected = (viaturaIdPreSeleccionada === doc.id) ? 'selected' : '';
                    // Exibe o nome da viatura (Ex: ABT-18) e o posto (Ex: BRAVO)
                    htmlOptions += `<option value="${doc.id}" ${isSelected}>${data.ativo_nome} (${data.posto_nome || 'GERAL'})</option>`;
                });
            }

            if (operacao === 'RECOLHIMENTO' && viaturaIdPreSeleccionada) {
                selectDestino.disabled = true;
                selectDestino.style.backgroundColor = "#f1f5f9";
            }
        }

        selectDestino.innerHTML = htmlOptions;
        console.log("✅ Destinos populados com sucesso.");

    } catch (e) {
        console.error("❌ Erro ao popular destinos:", e);
        selectDestino.innerHTML = `<option value="">Erro ao carregar dados</option>`;
    }
}

async function popularTombamentosMovimentacao(docId, operacao, tombamentoFoco, viaturaId, corTema) {
    const containerTomb = document.getElementById('lista-tomb-swal');
    if (!containerTomb) return;

    try {
        let listaTombs = [];

        if (operacao === 'ENVIO') {
            // Busca tombamentos que estão no estoque central da unidade (viatura_id == null)
            const snap = await db.collection('inventario').doc(docId)
                .collection('tombamentos')
                .where('local_id', '==', currentUserData.unidade_id)
                .where('viatura_id', '==', null).get();
            snap.forEach(d => listaTombs.push(d.data()));
        } else {
            // RECOLHIMENTO: Busca tombamentos que estão especificamente naquela viatura
            const snap = await db.collection('inventario').doc(docId)
                .collection('tombamentos')
                .where('viatura_id', '==', viaturaId).get();
            snap.forEach(d => listaTombs.push(d.data()));
        }

        if (listaTombs.length === 0) {
            containerTomb.innerHTML = `<span style="color:#64748b; font-size:0.85em;">Nenhum material disponível para esta operação.</span>`;
            return;
        }

        // Gera o HTML dos checkboxes com o estilo Sigma V3
        let htmlChecks = "";
        listaTombs.forEach(t => {
            const isFoco = (t.tomb === tombamentoFoco) ? 'checked' : '';
            htmlChecks += `
                <div style="margin-bottom:8px; display:flex; align-items:center;">
                    <input type="checkbox" class="swal-tomb-check" id="chk-${t.tomb}" value="${t.tomb}" ${isFoco} style="width:18px; height:18px; accent-color:${corTema};">
                    <label for="chk-${t.tomb}" style="margin-left:10px; font-weight:700; color:#1e293b; cursor:pointer;">
                        ${t.tomb} <small style="color:#64748b; font-weight:400;">(${t.situacao_atual || 'DISPONÍVEL'})</small>
                    </label>
                </div>`;
        });

        containerTomb.innerHTML = htmlChecks;
    } catch (e) {
        containerTomb.innerHTML = "Erro ao carregar tombamentos.";
    }
}
async function executarMovimentacaoReal(docId, operacao, dados) {
    const { destinoId, quantidade, tombamentos } = dados;
    const minhaUnidadeId = currentUserData.unidade_id;
    const dataHora = new Date().toLocaleString('pt-BR');

    // Mostra o loading do Sigma V3
    Swal.fire({
        title: 'Processando Movimentação...',
        html: 'Sincronizando inventário estadual.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    const batch = db.batch();

    try {
        const itemRef = db.collection('inventario').doc(docId);
        const itemSnap = await itemRef.get();
        const itemData = itemSnap.data();
        const ehMulti = itemData.tipo === 'multi';

        // --- LÓGICA PARA ITENS MULTI (TOMBAMENTOS) ---
        if (ehMulti && tombamentos && tombamentos.length > 0) {
            for (const tomb of tombamentos) {
                const tombRef = itemRef.collection('tombamentos').doc(tomb);

                if (operacao === 'ENVIO') {
                    // SAINDO DO ALMOX -> PARA VIATURA
                    batch.update(tombRef, {
                        viatura_id: destinoId,
                        data_ultima_movimentacao: dataHora,
                        movimentado_por: currentUserData.nomeGuerra
                    });
                    // Registra no histórico do tombamento
                    const histRef = tombRef.collection('historico_vida').doc();
                    batch.set(histRef, {
                        evento: "ENVIO_PARA_VIATURA",
                        destino: destinoId,
                        data: dataHora,
                        quem: currentUserData.nomeGuerra
                    });
                } else {
                    // SAINDO DA VIATURA -> PARA ALMOX
                    batch.update(tombRef, {
                        viatura_id: null,
                        data_ultima_movimentacao: dataHora,
                        movimentado_por: currentUserData.nomeGuerra
                    });
                    // Registra no histórico do tombamento
                    const histRef = tombRef.collection('historico_vida').doc();
                    batch.set(histRef, {
                        evento: "RECOLHIMENTO_ALMOXARIFADO",
                        data: dataHora,
                        quem: currentUserData.nomeGuerra
                    });
                }
            }
        }

        // --- LÓGICA PARA ITENS SINGLE (VOLUME/LOTE) ---
        else if (!ehMulti) {
            const qtdNum = Number(quantidade);
            const saldoRef = itemRef.collection('saldos_unidades').doc(minhaUnidadeId);

            if (operacao === 'ENVIO') {
                batch.update(saldoRef, {
                    qtd_disp: firebase.firestore.FieldValue.increment(-qtdNum),
                    qtd_em_carga: firebase.firestore.FieldValue.increment(qtdNum),
                    last_update: dataHora
                });
            } else {
                batch.update(saldoRef, {
                    qtd_disp: firebase.firestore.FieldValue.increment(qtdNum),
                    qtd_em_carga: firebase.firestore.FieldValue.increment(-qtdNum),
                    last_update: dataHora
                });
            }
        }

        // --- ATUALIZAÇÃO DA LISTA DE CONFERÊNCIA (O ALVO) ---
        // Aqui o sistema entra na viatura alvo e insere/remove o item da lista física
        await atualizarArquiteturaViatura(destinoId, itemData, operacao, dados);

        await batch.commit();

        Swal.fire({
            icon: 'success',
            title: 'Movimentação Concluída!',
            text: `${itemData.nome} movimentado com sucesso.`,
            timer: 2000,
            showConfirmButton: false
        }).then(() => {
            // Recarrega a lupa/rastreio para mostrar a nova realidade
            if (typeof verDetalhesItemAlmox === 'function') verDetalhesItemAlmox(docId);
        });

    } catch (e) {
        console.error(e);
        Swal.fire('Erro Fatal', 'Não foi possível processar a movimentação no banco.', 'error');
    }
}
async function atualizarArquiteturaViatura(viaturaId, itemData, operacao, dados) {
    const vtrRef = db.collection('listas_conferencia').doc(viaturaId);
    const vtrSnap = await vtrRef.get();

    if (!vtrSnap.exists) {
        console.error("Viatura não encontrada para sincronização de arquitetura.");
        return;
    }

    const vtrData = vtrSnap.data();
    let listaAtualizada = [...vtrData.list]; // A estrutura principal 'list' que contém os setores
    const setorAlvo = dados.setorId || 'CABINE'; // Default para Cabine se não especificado
    const ehMulti = itemData.tipo === 'multi';

    // 1. Localiza o setor e o item dentro da lista da viatura
    let setorEncontrado = listaAtualizada.find(s => s.nome === setorAlvo);

    // Se o setor não existir na vtr (ex: Carroceria), nós o criamos ou usamos o primeiro disponível
    if (!setorEncontrado) setorEncontrado = listaAtualizada[0];

    let itemNaVtr = setorEncontrado.itens.find(it => it.uid_global === itemData.uid_global);

    if (operacao === 'ENVIO') {
        if (!itemNaVtr) {
            // ITEM NOVO NA VIATURA: Se não existia, adicionamos a estrutura base
            itemNaVtr = {
                uid_global: itemData.uid_global,
                nome: itemData.nome,
                quantidadeEsperada: 0,
                tombamentos: [],
                tipo: itemData.tipo
            };
            setorEncontrado.itens.push(itemNaVtr);
        }

        if (ehMulti) {
            // Adiciona apenas os tombamentos que ainda não estão lá
            dados.tombamentos.forEach(t => {
                if (!itemNaVtr.tombamentos.includes(t)) {
                    itemNaVtr.tombamentos.push(t);
                }
            });
            itemNaVtr.quantidadeEsperada = itemNaVtr.tombamentos.length;
        } else {
            // Soma a quantidade ao que já existia
            itemNaVtr.quantidadeEsperada += Number(dados.quantidade);
        }
    }
    else if (operacao === 'RECOLHIMENTO') {
        if (itemNaVtr) {
            if (ehMulti) {
                // Remove os tombamentos específicos recolhidos
                itemNaVtr.tombamentos = itemNaVtr.tombamentos.filter(t => !dados.tombamentos.includes(t));
                itemNaVtr.quantidadeEsperada = itemNaVtr.tombamentos.length;
            } else {
                // Subtrai a quantidade
                itemNaVtr.quantidadeEsperada -= Number(dados.quantidade);
            }

            // Se a quantidade zerar, removemos o item da viatura para não poluir a lista
            if (itemNaVtr.quantidadeEsperada <= 0) {
                setorEncontrado.itens = setorEncontrado.itens.filter(it => it.uid_global !== itemData.uid_global);
            }
        }
    }

    // 2. Grava a nova arquitetura de volta na viatura
    await vtrRef.update({
        list: listaAtualizada,
        ultima_atualizacao_inventario: new Date().toISOString()
    });
}
/**
 * Função que renderiza os carimbos originais do Conferencia App dentro do modal
 */
function mostrarCarimbos(titulo, dataJson, tipo, listaId = null, nomeItemLimpo = "") {
    const dados = JSON.parse(dataJson);
    const modal = document.getElementById('modal-detalhe-carimbos');
    const corpo = document.getElementById('corpo-modal-carimbo');
    const h3 = document.getElementById('titulo-modal-carimbo');

    if (!modal || !corpo) return;

    h3.textContent = titulo;
    modal.querySelector('.modal-content').style.borderTop = tipo === 'cautela' ? '5px solid #f57c00' : '5px solid #d90f23';

    let html = '';
    dados.forEach(item => {
        if (tipo === 'cautela') {
            const cId = item.id;
            html += `
                <div style="border: 1px solid #eee; padding: 12px; margin-bottom: 12px; border-radius: 8px; border-left: 5px solid #f57c00; background: #fffaf5;">
                    <div style="display:flex; justify-content:space-between; align-items: flex-start; margin-bottom:8px;">
                        <div>
                            <b style="font-size: 1.1em; color: #333;">${item.destinatario}</b><br>
                            <small style="color:#666;"><i class="far fa-calendar-alt"></i> Cautelado em: ${item.data || 'N/D'}</small>
                        </div>
                        <span class="badge-cautela" style="background:#f57c00; color:white; padding:4px 10px; border-radius:15px; font-weight:bold;">${item.quantidade || 1} un</span>
                    </div>
                    <div style="text-align: right; margin-top: 10px; border-top: 1px solid #ffe0b2; padding-top: 8px;">
                        <button class="btn-modern-action" style="font-size: 0.75em; padding: 5px 10px; background-color: #f57c00;" 
                                onclick="atalhoGestaoCautela('${cId}')">
                            <i class="fas fa-external-link-alt"></i> Ver Cautela
                        </button>
                    </div>
                </div>`;
        } else {
            // Pega o ID único da pendência para a busca cirúrgica
            const pId = item.id || item.pendencia_id;

            html += `
                <div style="border: 1px solid #eee; padding: 12px; margin-bottom: 12px; border-radius: 8px; border-left: 5px solid #d90f23; background: #fff5f5;">
                    <div style="display:flex; justify-content:space-between; align-items: flex-start; margin-bottom:8px;">
                        <div>
                            <b style="font-size: 1.1em; color: #333;">Relatado por: ${item.autor_nome}</b><br>
                            <small style="color:#666;"><i class="far fa-calendar-alt"></i> ${item.data_criacao || 'N/D'}</small>
                        </div>
                        <span class="badge-pendente" style="background:#d90f23; color:white; padding:4px 10px; border-radius:15px; font-weight:bold;">${item.quantidade || 1} un</span>
                    </div>
                    <div style="font-size:0.95em; color: #555; margin:8px 0; padding: 8px; background: white; border-radius: 4px; border: 1px solid #ffdada;">
                        <i class="fas fa-comment-dots"></i> "${item.descricao}"
                    </div>
                    <div style="text-align: right; margin-top: 10px; border-top: 1px solid #ffdada; padding-top: 8px;">
                        <button class="btn-modern-action" style="font-size: 0.75em; padding: 5px 10px; background-color: #d90f23;" 
                                onclick="atalhoGestaoPendencia('${listaId}', '${nomeItemLimpo}', '${pId}')">
                            <i class="fas fa-wrench"></i> Resolver na Viatura
                        </button>
                    </div>
                </div>`;
        }
    });

    corpo.innerHTML = html || '<p style="text-align:center; color:#999;">Nenhum registro detalhado encontrado.</p>';
    modal.style.display = 'flex';
}
/**
 * ATALHO 1: Direciona para a aba de Cautelas e abre o detalhe da cautela
 */
function atalhoGestaoCautela(cId) {
    document.getElementById('modal-detalhe-carimbos').style.display = 'none';
    switchView('cautelas');
    setTimeout(() => {
        showCautelaDetails(cId);
    }, 300);
}

/**
 * ATALHO 2: Simula o clique exato no card de pendência do Dashboard.
 */
async function atalhoGestaoPendencia(listaId, itemNomeAlvo) {
    if (!listaId) return alert("Erro: ID da lista não identificado.");

    document.getElementById('modal-detalhe-carimbos').style.display = 'none';
    switchView('dashboard');

    try {
        // 1. Busca a última conferência (O Cabeçalho)
        const snap = await db.collection(COLECAO_RESULTADOS)
            .where('lista_id', '==', listaId)
            .orderBy('timestamp', 'desc')
            .limit(1)
            .get();

        if (!snap.empty) {
            const docReal = snap.docs[0];
            const d = docReal.data();

            // 2. Prepara o objeto exatamente como a sua função mostrarTabela espera
            // Note que usamos d.timestamp.toDate().toLocaleString() para evitar o 'undefined'
            const objetoParaTabela = {
                id: docReal.id,
                lista_id: listaId,
                local: d.local || "Viatura",
                conferente: d.conferente,
                date: d.timestamp ? d.timestamp.toDate().toLocaleString('pt-BR') : 'Data N/D',
                items: [] // Vamos preencher abaixo
            };

            // 3. Busca a Lista Mestra para extrair as Pendências/Cautelas Reais
            // Esse é o segredo para não aparecer "Tudo OK"
            const docMestra = await db.collection('listas_conferencia').doc(listaId).get();
            if (docMestra.exists) {
                const dataMestra = docMestra.data().list || [];
                const pendenciasReais = [];

                for (const setor of dataMestra) {
                    for (const it of (setor.itens || [])) {
                        // Pendências Single
                        if (it.pendencias_ids) {
                            it.pendencias_ids.forEach(p => pendenciasReais.push({ ...p, itemNome: it.nome, itemId: it.id, tipoRegistro: 'PENDENCIA' }));
                        }
                        // Cautelas Single
                        if (it.cautelas) {
                            it.cautelas.forEach(c => pendenciasReais.push({ ...c, itemNome: it.nome, itemId: it.id, status_gestao: 'CAUTELADO', tipoRegistro: 'CAUTELA' }));
                        }
                        // Itens Multi (Tombamentos)
                        if (it.tipo === 'multi' && it.tombamentos) {
                            it.tombamentos.forEach(t => {
                                if (t.pendencias_ids) t.pendencias_ids.forEach(p => pendenciasReais.push({ ...p, itemNome: it.nome, tombamento: t.tomb, itemId: it.id, tipoRegistro: 'PENDENCIA' }));
                                if (t.cautela) pendenciasReais.push({ ...t.cautela, itemNome: it.nome, tombamento: t.tomb, itemId: it.id, status_gestao: 'CAUTELADO', tipoRegistro: 'CAUTELA' });
                            });
                        }
                    }
                }
                objetoParaTabela.items = pendenciasReais;
            }

            // 4. Agora sim, chama a função com os dados completos e processados
            setTimeout(() => {
                mostrarTabela(objetoParaTabela);

                // 5. Aponta o item alvo
                setTimeout(() => {
                    destacarItemNaTabela(itemNomeAlvo);
                }, 600);
            }, 300);
        }
    } catch (e) {
        console.error("Erro no atalho:", e);
    }
}
/**
 * Localiza o item na tabela, com sistema de espera (polling) 
 * para garantir que a renderização terminou.
 */
function destacarItemNaTabela(nomeItem, pendenciaId) {
    let tentativas = 0;
    const alvoNome = nomeItem ? nomeItem.trim().toUpperCase() : null;

    const intervalBusca = setInterval(() => {
        const rows = document.querySelectorAll('#ca-list-body tr');
        let linhaEncontrada = null;

        rows.forEach(row => {
            if (linhaEncontrada) return; // Se já achou, ignora o resto

            // 1. PRIORIDADE MÁXIMA: Busca pelo ID da Pendência em qualquer lugar da linha
            if (pendenciaId) {
                // Procura o ID no HTML da linha toda (botões, inputs hidden, textos)
                if (row.innerHTML.includes(pendenciaId)) {
                    linhaEncontrada = row;
                }
            }

            // 2. SEGUNDA PRIORIDADE: Busca por Nome + Texto "PENDENTE" 
            // Isso evita focar no item "CAUTELADO" se o objetivo é resolver pendência
            if (!linhaEncontrada && alvoNome) {
                const textoLinha = row.innerText.toUpperCase();
                // Verifica se na mesma linha tem o Nome do Item E a palavra PENDENTE
                if (textoLinha.includes(alvoNome) && textoLinha.includes("PENDENTE")) {
                    linhaEncontrada = row;
                }
            }
        });

        if (linhaEncontrada) {
            clearInterval(intervalBusca);

            // Centraliza e destaca
            linhaEncontrada.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Estilo visual de impacto
            linhaEncontrada.style.backgroundColor = "#fff3cd";
            linhaEncontrada.style.outline = "3px solid #d90f23"; // Vermelho para pendência

            linhaEncontrada.animate([
                { transform: 'scale(1)', boxShadow: 'none' },
                { transform: 'scale(1.01)', boxShadow: '0 0 20px #d90f23' },
                { transform: 'scale(1)', boxShadow: 'none' }
            ], { duration: 400, iterations: 5 });

            setTimeout(() => {
                linhaEncontrada.style.backgroundColor = "";
                linhaEncontrada.style.outline = "none";
            }, 6000);

        } else if (tentativas >= 25) {
            clearInterval(intervalBusca);
            console.warn("Destaque: Falha ao localizar o item alvo.");
        }

        tentativas++;
    }, 200);
}

function abrirModalCadastroGlobal() {
    const modal = document.getElementById('modal-cadastro-global');
    if (!modal) return;

    // Reseta o formulário para garantir que abra limpo
    document.getElementById('form-cadastro-global').reset();

    // Oculta área de kit por padrão
    document.getElementById('area-selecao-componentes').style.display = 'none';

    // Inicia na aba de identificação
    switchTabCadastro('identificacao');

    modal.style.display = 'flex';
}

/**
 * Fecha o modal
 */
function fecharModalCadastroGlobal() {
    const modal = document.getElementById('modal-cadastro-global');
    if (modal) modal.style.display = 'none';
}

/**
 * Alterna entre as abas usando Namespacing para segurança
 */
function switchTabCadastro(tabId) {
    // 1. Gerencia os botões (Abas)
    const botoes = document.querySelectorAll('.g-cat-tab-btn');
    botoes.forEach(btn => btn.classList.remove('active'));

    // 2. Gerencia os conteúdos
    const conteudos = document.querySelectorAll('.g-cat-tab-content');
    conteudos.forEach(div => div.style.display = 'none');

    // 3. Ativa o selecionado
    if (tabId === 'identificacao') {
        botoes[0].classList.add('active');
        document.getElementById('tab-identificacao').style.display = 'block';
    } else if (tabId === 'logistica') {
        botoes[1].classList.add('active');
        document.getElementById('tab-logistica').style.display = 'block';
    } else if (tabId === 'composicao') {
        botoes[2].classList.add('active');
        document.getElementById('tab-composicao').style.display = 'block';
    }
}

/**
 * Listener para o Checkbox de Kit (Exibição Dinâmica)
 * Usamos a delegação de eventos para garantir que funcione mesmo após renderizações
 */
document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'cat-is-kit') {
        const areaKit = document.getElementById('area-selecao-componentes');
        if (areaKit) {
            areaKit.style.display = e.target.checked ? 'block' : 'none';
        }
    }
});
/**
* 1. AUTOCOMPLETE: Busca em tempo real no Catálogo Global
* Acoplado ao campo 'cat-nome-tecnico' do modal
*/
async function buscarInteligenteFamilia(termo, contexto = 'principal') {
    // Contexto pode ser 'principal' (campo do topo) ou 'componente' (aba de composição)
    const listUI = contexto === 'principal' ?
        document.getElementById('list-suggestions-familia') :
        document.getElementById('list-suggestions-componentes'); // Criaremos este ID no JS da aba

    const boxUI = contexto === 'principal' ?
        document.getElementById('suggestions-familia') :
        document.getElementById('suggestions-componentes');

    const uidPaiInput = document.getElementById('cat-uid-pai');

    if (termo.length < 2) {
        if (boxUI) boxUI.style.display = 'none';
        return;
    }

    try {
        const termoUpper = termo.toUpperCase();
        const snap = await db.collection('catalogo_familias')
            .where('tags_busca', 'array-contains', termoUpper)
            .limit(5).get();

        if (snap.empty) {
            if (boxUI) boxUI.style.display = 'none';
            if (contexto === 'principal') uidPaiInput.value = '';
            return;
        }

        let html = '';
        snap.forEach(doc => {
            const fam = doc.data();
            // ✅ Mudança cirúrgica na chamada do onclick baseada no contexto
            const funcChamada = contexto === 'principal' ?
                `selecionarFamilia('${doc.id}', '${fam.nome_pai}')` :
                `adicionarLinhaComponenteRegra('${doc.id}', '${fam.nome_pai}')`;

            html += `<li onclick="${funcChamada}" style="padding:10px; cursor:pointer; border-bottom:1px solid #eee;">
                        <i class="fas fa-folder"></i> Família: <b>${fam.nome_pai}</b>
                     </li>`;
        });

        if (listUI) listUI.innerHTML = html;
        if (boxUI) boxUI.style.display = 'block';
    } catch (e) {
        console.error("Erro na busca de família:", e);
    }
}

function selecionarFamilia(uid, nome) {
    document.getElementById('cat-nome-pai').value = nome;
    document.getElementById('cat-uid-pai').value = uid;
    document.getElementById('suggestions-familia').style.display = 'none';
    document.getElementById('cat-nome-pai').style.borderColor = '#1b8a3e';
}

/*função auxiliar de "selecionarfamilia" */
function adicionarLinhaComponenteRegra(uid, nome) {
    const container = document.getElementById('lista-componentes-selecionados');
    if (!container) return;

    // Evita adicionar a mesma família duas vezes no mesmo kit
    if (container.querySelector(`[data-familia-uid="${uid}"]`)) {
        return Swal.fire('Aviso', 'Esta família já foi adicionada à composição.', 'info');
    }

    const div = document.createElement('div');
    div.className = 'componente-selecionado-regra'; // Classe que o seu salvamento procura
    div.dataset.familiaUid = uid;
    div.dataset.nomeFamilia = nome;
    div.style.cssText = "display: flex; align-items: center; justify-content: space-between; background: #fff; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);";

    div.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-link" style="color: #2c7399; font-size: 0.8em;"></i>
            <b style="font-size: 0.9em; color: #1e293b;">${nome}</b>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
            <label style="font-size: 0.7em; font-weight: 800; color: #64748b; margin: 0;">QTD SUGERIDA:</label>
            <input type="number" class="input-qtd-regra" value="1" min="1" 
                   style="width: 50px; padding: 4px; border: 1px solid #cbd5e1; border-radius: 4px; text-align: center; font-weight: bold;">
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 5px;">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    container.appendChild(div);

    // Limpa a busca de componentes após adicionar
    const inputBusca = document.getElementById('input-busca-componente-kit'); // Precisamos criar esse input no HTML da aba
    if (inputBusca) inputBusca.value = '';
    document.getElementById('suggestions-componentes').style.display = 'none';
}

/**
 * 3. SALVAMENTO: Cria o DNA (Global) e o Saldo (Local)
 */
async function salvarCadastroGlobalHierarquico() {
    const nomePai = document.getElementById('cat-nome-pai').value.trim().toUpperCase();
    const marca = document.getElementById('cat-marca').value.trim().toUpperCase();
    const modelo = document.getElementById('cat-modelo').value.trim().toUpperCase();
    const categoria = document.getElementById('cat-categoria').value;
    const tipoControle = document.querySelector('input[name="cat-tipo"]:checked').value;
    let uidPai = document.getElementById('cat-uid-pai').value;

    // ✅ NOVOS CAMPOS CAPTURADOS DO HTML
    const unidadeMedida = document.getElementById('cat-unidade-medida').value;
    const exigeInspecao = document.getElementById('cat-has-inspecao').checked;
    const isAnfitriao = document.getElementById('cat-is-kit').checked;

    // ✅ CAPTURA DE COMPONENTES DA COMPOSIÇÃO (SE HOUVER)
    let listaComponentesRegra = [];
    if (isAnfitriao) {
        const itensSelecionados = document.querySelectorAll('.componente-selecionado-regra');
        itensSelecionados.forEach(el => {
            listaComponentesRegra.push({
                familia_uid: el.dataset.familiaUid,
                nome_familia: el.dataset.nomeFamilia,
                qtd_sugerida: parseInt(el.querySelector('.input-qtd-regra').value) || 1
            });
        });
    }

    if (!nomePai || !marca || !modelo) return alert("Preencha os campos obrigatórios.");

    const btn = document.querySelector('.btn-sync');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = "Processando DNA...";

    const autorNome = currentUserData.nome_militar_completo;
    const unidadeCriadorId = currentUserData.unidade_id || "ADMIN";
    const unidadeCriadorSigla = currentUserData.unidade || "ADMINISTRATIVO";
    const dataRegistro = new Date().toLocaleString('pt-BR');

    try {
        await db.runTransaction(async (transaction) => {
            const contRef = db.collection('config_geral').doc('contadores');
            const contSnap = await transaction.get(contRef);
            const contData = contSnap.data() || { ultimo_id_pai: 0, ultimo_id_modelo: 0 };

            // 1. GERENCIAR UID PAI (FAMÍLIA)
            if (!uidPai) {
                const proximoPai = (contData.ultimo_id_pai || 0) + 1;
                uidPai = `FAM-${String(proximoPai).padStart(6, '0')}`;

                transaction.set(db.collection('catalogo_familias').doc(uidPai), {
                    uid_pai: uidPai,
                    nome_pai: nomePai,
                    tags_busca: [nomePai],
                    criado_em: firebase.firestore.FieldValue.serverTimestamp()
                });
                transaction.update(contRef, { ultimo_id_pai: proximoPai });
            }

            // 2. GERENCIAR UID GLOBAL (MODELO TÉCNICO)
            const proximoMod = (contData.ultimo_id_modelo || 0) + 1;
            const uidGlobal = `${uidPai}-MOD-${proximoMod}`;
            const nomeTecnicoCompleto = `${nomePai} ${marca} ${modelo}`;

            // 3. SALVAR NO CATÁLOGO GLOBAL (DNA)
            transaction.set(db.collection('catalogo_global').doc(uidGlobal), {
                uid_global: uidGlobal,
                uid_pai: uidPai,
                nome_pai: nomePai,
                nome_tecnico: nomeTecnicoCompleto,
                marca: marca,
                modelo: modelo,
                categoria: categoria,
                tipo_controle: tipoControle,
                unidade_medida: unidadeMedida, // ✅ Adicionado
                exige_inspecao: exigeInspecao, // ✅ Adicionado
                is_anfitriao: isAnfitriao,     // ✅ Novo: Flag de Kit
                componentes_regra: listaComponentesRegra, // ✅ Novo: Lista de famílias compatíveis
                criado_por: autorNome,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 4. ATUALIZAR TAGS DA FAMÍLIA E CONTADOR
            transaction.update(db.collection('catalogo_familias').doc(uidPai), {
                tags_busca: firebase.firestore.FieldValue.arrayUnion(marca, modelo)
            });
            transaction.update(contRef, { ultimo_id_modelo: proximoMod });

            // 5. INICIALIZAR NO INVENTÁRIO COM VÍNCULO DE UNIDADE
            const invRef = db.collection('inventario').doc(uidGlobal);
            transaction.set(invRef, {
                uid_global: uidGlobal,
                nome: nomeTecnicoCompleto,
                tipo: tipoControle,
                categoria: categoria,
                is_anfitriao: isAnfitriao, // ✅ Importante para filtros no Almox
                componentes_regra: listaComponentesRegra, // ✅ Referência rápida para saída
                qtd_corporativa_total: 0,
                criado_em: dataRegistro,
                criado_por: autorNome,
                unidade_origem_id: unidadeCriadorId
            });

            // ✅ SE FOR SINGLE, JÁ CRIA O DOCUMENTO DE SALDO NA UNIDADE DO CRIADOR
            if (tipoControle === 'single') {
                const saldoRef = invRef.collection('saldos_unidades').doc(unidadeCriadorId);
                transaction.set(saldoRef, {
                    unidade_sigla: unidadeCriadorSigla,
                    qtd_total: 0,
                    qtd_disp: 0,
                    qtd_em_carga: 0,
                    qtd_pend: 0,
                    qtd_caut: 0,
                    last_update: dataRegistro
                });
            }
        });

        alert(`✅ Cadastro Global realizado!\nItem vinculado à unidade ${unidadeCriadorSigla}.`);
        fecharModalCadastroGlobal();
        if (typeof carregarAlmoxarifadoUI === 'function') carregarAlmoxarifadoUI();

    } catch (e) {
        console.error("Erro na transação:", e);
        alert("Erro ao salvar: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function prepararAporte(docId) {
    // 1. Busca os dados do item no Inventário V3
    const docAlvo = await db.collection('inventario').doc(docId).get();
    if (!docAlvo.exists) return alert("Erro ao localizar material.");

    const item = docAlvo.data();
    const ehMulti = item.tipo === 'multi';

    // 2. Lança o Modal Elegante
    Swal.fire({
        title: `<i class="fas fa-plus-circle"></i> Aporte de Material`,
        html: `
            <div style="text-align: left; padding: 5px;">
                <div style="background: #f0fdf4; padding: 12px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #bbf7d0;">
                    <small style="color: #166534; font-weight: 800; text-transform: uppercase; font-size: 0.7em;">Material Selecionado</small>
                    <div style="font-weight: 800; color: #14532d; font-size: 1.1em;">${item.nome}</div>
                    <small style="color: #166534; font-size: 0.75em;">DNA: ${item.tipo.toUpperCase()} • ${item.categoria}</small>
                </div>

                <div class="form-group">
                    <label style="font-size: 0.85em; font-weight:bold; color:#800020;">QUANTIDADE DE ENTRADA:</label>
                    <input type="number" id="swal-aporte-qtd" class="swal2-input" value="1" min="1" 
                           style="width: 100%; margin: 10px 0;"
                           oninput="gerarInputsTombamentoDinamico(this.value, '${item.tipo}')">
                </div>

                <div id="div-tombamentos-dinamicos" style="display: ${ehMulti ? 'block' : 'none'}; margin-top: 15px; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px dashed #2c7399;">
                    <label style="font-weight: bold; color: #2c7399; font-size: 0.85em; display: block; margin-bottom: 10px;">
                        <i class="fas fa-barcode"></i> Identificação dos Itens (Tomb / Série):
                    </label>
                    <div id="container-inputs-tomb" style="max-height: 200px; overflow-y: auto;">
                        </div>
                </div>

                <div class="form-group" style="margin-top:15px;">
                    <label style="font-size: 0.85em; font-weight:bold; color:#800020;">JUSTIFICATIVA / NOTA FISCAL:</label>
                    <textarea id="swal-aporte-obs" class="swal2-textarea" style="width: 100%; margin: 10px 0; height: 80px;" placeholder="Ex: NF 455 - Compra Direta..."></textarea>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-check"></i> CONFIRMAR ENTRADA',
        confirmButtonColor: '#166534',
        cancelButtonText: 'Cancelar',
        didOpen: () => {
            // Inicializa os inputs se for multi
            if (ehMulti) gerarInputsTombamentoDinamico(1, 'multi');
        },
        preConfirm: () => {
            const qtd = document.getElementById('swal-aporte-qtd').value;
            const obs = document.getElementById('swal-aporte-obs').value.trim();

            if (!qtd || qtd < 1) return Swal.showValidationMessage('Informe uma quantidade válida');
            if (!obs) return Swal.showValidationMessage('A justificativa é obrigatória');

            let tombamentos = [];
            if (ehMulti) {
                const linhas = document.querySelectorAll('.linha-tomb-input');
                for (let linha of linhas) {
                    const t = linha.querySelector('.val-tomb').value.trim().toUpperCase();
                    const s = linha.querySelector('.val-sn').value.trim().toUpperCase();
                    if (!t) return Swal.showValidationMessage('Preencha todos os tombamentos');
                    tombamentos.push({ tomb: t, serie: s });
                }
            }

            return {
                quantidade: parseInt(qtd),
                observacao: obs,
                tombamentos: ehMulti ? tombamentos : null
            };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            // Chama a função que já temos de gravar no banco, passando os novos dados
            processarAporteNoBanco(docId, result.value);
        }
    });
}
function gerarInputsTombamentoDinamico(qtd, tipo) {
    const containerDiv = document.getElementById('div-tombamentos-dinamicos');
    const lista = document.getElementById('container-inputs-tomb');

    if (tipo !== 'multi') {
        if (containerDiv) containerDiv.style.display = 'none';
        return;
    }

    containerDiv.style.display = 'block';
    lista.innerHTML = '';

    for (let i = 1; i <= qtd; i++) {
        lista.innerHTML += `
            <div class="linha-tomb-input" style="display: grid; grid-template-columns: 30px 1fr 1fr; gap: 8px; margin-bottom: 8px; align-items: center;">
                <div style="background: #166534; color: white; text-align: center; border-radius: 4px; font-size: 0.8em; height: 30px; line-height: 30px;">${i}</div>
                <input type="text" class="swal2-input val-tomb" placeholder="Tombamento" style="margin:0; height: 35px; font-size: 0.9em;">
                <input type="text" class="swal2-input val-sn" placeholder="Nº Série" style="margin:0; height: 35px; font-size: 0.9em;">
            </div>`;
    }
}

async function processarAporteNoBanco(uidGlobal, dados) {
    const { quantidade, observacao, tombamentos } = dados;
    const ehMulti = tombamentos !== null;

    const minhaUnidadeId = currentUserData.unidade_id || "ADMIN";
    const minhaUnidadeSigla = currentUserData.unidade || "ADMINISTRATIVO";
    const dataReg = new Date().toLocaleString('pt-BR');
    const autorNome = currentUserData.nome_militar_completo;

    Swal.fire({
        title: 'Registrando Entrada...',
        html: 'Atualizando prontuários e saldos globais.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const itemRef = db.collection('inventario').doc(uidGlobal);

        // ✅ 1. ESTA VARIÁVEL É A CHAVE: Ela vive fora da transação para ser usada no Swal depois
        let qtdFinalParaExibicao = 0;

        await db.runTransaction(async (transaction) => {
            const snapItem = await transaction.get(itemRef);
            if (!snapItem.exists) throw new Error("DNA do material não encontrado.");

            const d = snapItem.data();
            const idEvento = "EVT-APORTE-" + Date.now();

            // Variável local da transação
            let qtdEfetivaLocal = 0;

            if (ehMulti) {
                let listaTombsTxt = [];
                for (let tInfo of tombamentos) {
                    qtdEfetivaLocal++;
                    listaTombsTxt.push(tInfo.tomb);
                    const tombRef = itemRef.collection('tombamentos').doc(tInfo.tomb);

                    transaction.set(tombRef, {
                        tomb: tInfo.tomb,
                        serie: tInfo.serie || "N/A",
                        situacao_atual: "DISPONÍVEL",
                        local_id: minhaUnidadeId,
                        unidade_sigla: minhaUnidadeSigla,
                        sub_local: "ALMOXARIFADO CENTRAL",
                        data_entrada: dataReg,
                        criado_por: autorNome
                    });

                    transaction.set(tombRef.collection('historico_vida').doc(idEvento), {
                        data: dataReg,
                        evento: "APORTE_ESTOQUE",
                        quem: autorNome,
                        detalhes: `Incorporado via Aporte. Justificativa: ${observacao}`
                    });
                }

                transaction.update(itemRef, {
                    historico_movimentacoes: firebase.firestore.FieldValue.arrayUnion({
                        data: dataReg,
                        evento: "APORTE_LOTE_PATRIMONIO",
                        quem: autorNome,
                        detalhes: `Aporte de ${qtdEfetivaLocal} unidades em ${minhaUnidadeSigla}. Itens: ${listaTombsTxt.join(', ')}. Obs: ${observacao}`
                    })
                });

            } else {
                qtdEfetivaLocal = Number(quantidade);
                const saldoUnidadeRef = itemRef.collection('saldos_unidades').doc(minhaUnidadeId);
                const snapSaldo = await transaction.get(saldoUnidadeRef);
                const dSaldo = snapSaldo.exists ? snapSaldo.data() : { qtd_total: 0, qtd_disp: 0 };

                transaction.set(saldoUnidadeRef, {
                    unidade_sigla: minhaUnidadeSigla,
                    qtd_total: (dSaldo.qtd_total || 0) + qtdEfetivaLocal,
                    qtd_disp: (dSaldo.qtd_disp || 0) + qtdEfetivaLocal,
                    last_update: dataReg
                }, { merge: true });

                transaction.set(saldoUnidadeRef.collection('historico_vida').doc(idEvento), {
                    data: dataReg,
                    evento: "APORTE_ESTOQUE",
                    quem: autorNome,
                    quantidade: qtdEfetivaLocal,
                    detalhes: `Entrada física de material de consumo. Obs: ${observacao}`
                });
            }

            transaction.update(itemRef, {
                qtd_corporativa_total: (d.qtd_corporativa_total || 0) + qtdEfetivaLocal,
                ultima_movimentacao: dataReg
            });

            // ✅ 2. ATRIBUIÇÃO CRÍTICA: Salva o valor local na variável que "escapa" da transação
            qtdFinalParaExibicao = qtdEfetivaLocal;
        });

        // ✅ 3. USO CORRETO: Referenciando a variável que existe neste escopo
        await Swal.fire({
            icon: 'success',
            title: 'Aporte Concluído!',
            text: `${qtdFinalParaExibicao} unidade(s) adicionada(s) ao estoque de ${minhaUnidadeSigla}.`,
            timer: 2500,
            showConfirmButton: false
        });

        if (typeof carregarAlmoxarifadoUI === 'function') carregarAlmoxarifadoUI();

    } catch (e) {
        console.error("Erro no aporte:", e);
        Swal.fire('Erro no Processamento', e.message, 'error');
    }
}

async function configurarBuscaComandanteUnidade() {
    const input = document.getElementById('new-unit-commander-search');
    const suggestionsBox = document.getElementById('unit-commander-suggestions');
    const suggestionsList = document.getElementById('unit-commander-list');
    const uidInput = document.getElementById('new-unit-commander-uid');

    if (!input) return;

    // Garante que temos militares carregados para a busca global
    // Se o array global allTargetUsers estiver vazio, buscamos todos os militares do banco
    if (typeof allTargetUsers === 'undefined' || allTargetUsers.length === 0) {
        console.log("Populando lista global de militares para seleção de comando...");
        const snap = await db.collection('usuarios').get();
        allTargetUsers = [];
        snap.forEach(doc => {
            const u = doc.data();
            allTargetUsers.push({
                id: doc.id,
                nome: u.nome_militar_completo || u.nome_completo
            });
        });
    }

    input.addEventListener('input', () => {
        const termo = input.value.toUpperCase();
        suggestionsList.innerHTML = '';

        if (termo.length < 2) {
            suggestionsBox.style.display = 'none';
            return;
        }

        const filtrados = allTargetUsers.filter(u =>
            u.nome.toUpperCase().includes(termo)
        );

        filtrados.forEach(militar => {
            const li = document.createElement('li');
            li.style.padding = "10px";
            li.style.cursor = "pointer";
            li.style.borderBottom = "1px solid #eee";
            li.innerHTML = `<i class="fas fa-user-shield"></i> ${militar.nome}`;

            li.onclick = () => {
                input.value = militar.nome;
                uidInput.value = militar.id; // Salva o UID imutável (ex: 8snxsQcrahT4...)
                suggestionsBox.style.display = 'none';
                input.style.borderColor = '#1b8a3e';
                console.log("Comandante selecionado:", militar.id);
            };
            suggestionsList.appendChild(li);
        });

        suggestionsBox.style.display = filtrados.length > 0 ? 'block' : 'none';
    });

    // Fecha a lista se clicar fora
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target)) suggestionsBox.style.display = 'none';
    });
}

function filtrarUnidadesCards() {
    // Captura o termo e normaliza (remove acentos e caracteres especiais para busca precisa)
    const inputBusca = document.getElementById('input-busca-unidade');
    if (!inputBusca) return;

    const termo = inputBusca.value.trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[^a-z0-9]/g, ""); // Mantém apenas letras e números

    // Seleciona os cards padrão V3 dentro do container de unidades
    const cards = document.querySelectorAll('#units-cards-container .v3-posto-card');
    const headers = document.querySelectorAll('#units-cards-container .unit-header');

    cards.forEach(card => {
        // Captura o conteúdo do card e normaliza para comparação
        const textoCard = card.innerText.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, "");

        const matches = textoCard.includes(termo);

        if (matches) {
            card.style.display = "flex";
            card.style.animation = "fadeIn 0.3s ease";
        } else {
            card.style.display = "none";
        }
    });

    // Filtra os títulos de grupo (Headers), escondendo se o grupo estiver vazio
    headers.forEach(header => {
        let proximo = header.nextElementSibling;
        let temVisivel = false;

        // Varre os elementos seguintes até o próximo header ou fim do container
        while (proximo && !proximo.classList.contains('unit-header')) {
            if (proximo.classList.contains('v3-posto-card') && proximo.style.display !== 'none') {
                temVisivel = true;
                break;
            }
            proximo = proximo.nextElementSibling;
        }

        header.style.display = temVisivel ? "block" : "none";
    });
}
/*[GESTÃO DE VIATURAS/BASE*/


async function carregarVtrBasesCards() {
    const container = document.getElementById('vtr-bases-cards-container');
    if (!container) return;

    container.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding:60px; color:#64748b;">
            <i class="fas fa-sync fa-spin fa-3x" style="opacity:0.3; margin-bottom:15px; display:block;"></i>
            <span style="font-weight:700; letter-spacing:1px; text-transform:uppercase; font-size:0.8em;">Sincronizando Frota Global...</span>
        </div>`;

    try {
        const snapshot = await db.collection('viaturas').orderBy('prefixo', 'asc').get();

        if (snapshot.empty) {
            container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:50px; color:#94a3b8;">Nenhuma viatura cadastrada no sistema.</div>`;
            return;
        }

        let html = '';

        snapshot.forEach(doc => {
            const vtr = doc.data();
            const status = vtr.status_operativo || 'ativo';
            const statusLabel = status === 'ativo' ? 'PRONTO' : (status === 'manutencao' ? 'BAIXADO' : 'RESERVA');
            const statusClass = status === 'ativo' ? 'v3-status-pronto' : 'v3-status-manutencao';

            const podeEditarOuExcluir = ['admin', 'gestor_geral'].includes(currentUserData?.role);
            const corTema = status === 'ativo' ? '#166534' : (status === 'manutencao' ? '#991b1b' : '#c2780e');

            const iconMap = {
                incendio: 'fa-truck-moving',
                ambulancia: 'fa-solid fa-truck-medical',
                salvamento: 'fa-solid fa-truck-pickup',
                passeio: 'fa-solid fa-car-side'
            };
            const iconClass = iconMap[vtr.segmento] || 'fa-solid fa-car';
            const modeloLimpo = (vtr.modelo || "").replace(/'/g, "\\'").replace(/"/g, '&quot;');

            // ✅ ADICIONADO: Evento onclick="abrirModalDetalhesVtr(...)" no card principal
            html += `
                <div class="v3-posto-card" 
                     onclick="abrirModalDetalhesVtr('${vtr.unidade_id}', '${doc.id}')"
                     style="border-left: 6px solid ${corTema}; min-height: 220px; cursor: pointer;">
                    
                    <div class="v3-posto-actions">
                        ${podeEditarOuExcluir ? `
                            <button class="v3-btn-action" onclick="event.stopPropagation(); abrirFormularioViatura({ 
                                uid: '${doc.id}', 
                                prefixo: '${vtr.prefixo}', 
                                placa: '${vtr.placa}', 
                                unidade_id: '${vtr.unidade_id}',
                                segmento: '${vtr.segmento}',
                                status: '${status}',
                                modelo: '${modeloLimpo}',
                                ano: '${vtr.ano}',
                                km_atual: ${vtr.km_atual || 0},
                                oleo_data: '${vtr.manutencao?.oleo_data || ''}',
                                oleo_km: ${vtr.manutencao?.oleo_km_prevista || 0}
                            })">
                                <i class="fas fa-pencil-alt"></i>
                            </button>
                            <button class="v3-btn-action" onclick="event.stopPropagation(); deletarViaturaGlobal('${doc.id}', '${vtr.prefixo}')">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        ` : `<i class="fas fa-lock" style="color:#cbd5e1; font-size: 0.8em; margin: 5px;"></i>`}
                    </div>

                    <div style="padding: 20px; flex-grow: 1; display: flex; flex-direction: column; align-items: center; text-align: center;">
                        
                        <div class="v3-icon-box" style="background: ${corTema}15; color: ${corTema}; width: 60px; height: 60px; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin-bottom: 15px;">
                            <i class="${iconClass}" style="font-size: 1.8em;"></i>
                        </div>

                        <div style="width: 100%; margin-bottom: 10px;">
                            <span style="display:block; font-weight:900; font-size:1.3em; color:#1e293b; letter-spacing:-0.5px; margin-bottom: 2px;">${vtr.prefixo}</span>
                            <span style="display:block; font-size: 0.75em; font-weight: 800; color: #64748b; text-transform: uppercase;">${vtr.modelo} | ${vtr.placa}</span>
                        </div>

                        <div style="width: 100%; margin-top: auto;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
                                <span class="v3-vtr-badge ${statusClass}">${statusLabel}</span>
                                <span style="font-weight: 900; color: #2c7399; font-size: 0.75em;">${vtr.unidade_sigla || 'ADMIN'}</span>
                            </div>
                            
                            <div class="v3-vtr-km-info">
                                <div style="text-align: left;">
                                    <small style="display:block; font-size:0.6em; color:#94a3b8; font-weight:800; text-transform:uppercase;">KM Atual</small>
                                    <span style="font-size:0.85em; font-weight:900; color:#1e293b;">${Number(vtr.km_atual || 0).toLocaleString('pt-BR')} km</span>
                                </div>
                                <div style="text-align: right;">
                                    <small style="display:block; font-size:0.6em; color:#94a3b8; font-weight:800; text-transform:uppercase;">Próx. Óleo</small>
                                    <span style="font-size:0.85em; font-weight:900; color:#c2780e;">${Number(vtr.manutencao?.oleo_km_prevista || 0).toLocaleString('pt-BR')} km</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
        });

        container.innerHTML = html;

        // Gatilho para processar ícones se usar FontAwesome JS
        if (window.FontAwesome) FontAwesome.dom.i2svg();

    } catch (e) {
        console.error("Erro ao carregar frota:", e);
        container.innerHTML = `<p style="color:red; text-align:center; padding:40px;">Erro técnico ao carregar frota global.</p>`;
    }
}
async function deletarViaturaGlobal(uid, prefixo) {
    // 1. Confirmação Estilizada
    const confirmacao = await Swal.fire({
        title: 'Excluir Viatura?',
        html: `Você está removendo o ativo <b>${prefixo}</b> do sistema.<br>Esta ação é irreversível.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#991b1b', // Vermelho Escuro
        cancelButtonColor: '#64748b',
        confirmButtonText: 'SIM, REMOVER',
        cancelButtonText: 'CANCELAR',
        reverseButtons: true
    });

    if (!confirmacao.isConfirmed) return;

    // Feedback de processamento
    Swal.fire({
        title: 'Removendo Ativo...',
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        // 2. Remoção no Firestore
        await db.collection('viaturas').doc(uid).delete();

        // 3. Efeito Visual de Desintegração V3
        const cards = document.querySelectorAll('.v3-posto-card');
        cards.forEach(card => {
            if (card.innerHTML.includes(uid) || card.innerText.includes(prefixo)) {
                card.style.transition = "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)";
                card.style.opacity = "0";
                card.style.transform = "scale(0.8) translateY(20px)";
                card.style.filter = "blur(10px)";

                setTimeout(() => {
                    card.remove();
                    // Se não sobrarem cards, recarrega para mostrar a mensagem de lista vazia
                    if (document.querySelectorAll('#vtr-bases-cards-container .v3-posto-card').length === 0) {
                        carregarVtrBasesCards();
                    }
                }, 600);
            }
        });

        // 4. Toast de Sucesso
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000
        });
        Toast.fire({ icon: 'success', title: 'Viatura removida da frota.' });

    } catch (e) {
        console.error("Erro ao excluir viatura:", e);
        Swal.fire('Erro', 'Não foi possível excluir o ativo. Verifique sua conexão.', 'error');
    }
}
function filtrarViaturasCards() {
    const termo = document.getElementById('input-busca-vtr').value.trim().toLowerCase().replace(/[^A-Z0-9]/gi, '');
    const statusFiltro = document.getElementById('filtro-vtr-status').value;
    const cards = document.querySelectorAll('#vtr-bases-cards-container .v3-posto-card');

    cards.forEach(card => {
        // Captura o texto do card para busca
        const textoCard = card.innerText.toLowerCase().replace(/[^A-Z0-9]/gi, '');

        // Captura o status do card através da classe de badge
        const badge = card.querySelector('.v3-vtr-badge');
        const statusCard = badge.classList.contains('v3-status-pronto') ? 'ativo' :
            (badge.innerText.includes('BAIXADO') ? 'manutencao' : 'reserva');

        const bateTexto = textoCard.includes(termo);
        const bateStatus = (statusFiltro === 'todos' || statusCard === statusFiltro);

        if (bateTexto && bateStatus) {
            card.style.display = "flex";
            card.style.animation = "fadeIn 0.3s ease";
        } else {
            card.style.display = "none";
        }
    });
}

// 🛑 Adicione esta função auxiliar para deletar da coleção GLOBAL
async function deletarAtivoGlobal(ativoUid, nomeIdentificador) {
    if (!confirm(`Deseja realmente remover a viatura "${nomeIdentificador}" do sistema global?`)) return;
    try {
        await db.collection('viaturas').doc(ativoUid).delete();
        alert("Viatura removida com sucesso!");
        carregarVtrBasesCards();
    } catch (e) {
        alert("Erro ao excluir viatura.");
    }
}

function fecharModalVtr() {
    // 1. Comando oficial para fechar modais do SweetAlert2
    if (typeof Swal !== 'undefined' && Swal.isVisible()) {
        Swal.close();
    }

    // 2. Segurança: Tenta fechar o elemento antigo apenas se ele ainda existir no DOM
    const modalLegado = document.getElementById('modal-detalhes-vtr');
    if (modalLegado) {
        modalLegado.style.display = 'none';
    }
}

async function abrirModalDetalhesVtr(unidadeUid, ativoUid) {
    Swal.fire({
        title: 'Acessando Prontuário...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const doc = await db.collection('viaturas').doc(ativoUid).get();
        if (!doc.exists) throw new Error("Viatura não localizada.");

        const vtr = doc.data();
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        // --- LÓGICA DE SEMÁFOROS (Cores Dinâmicas) ---

        // 1. Licenciamento
        let anoExercicio = vtr.licenciamento ? parseInt(vtr.licenciamento.toString().substring(0, 4)) : null;
        let licStatus = "N/D", licColor = "#94a3b8", licBg = "#f1f5f9";
        if (anoExercicio) {
            const isVencido = anoExercicio < hoje.getFullYear();
            licStatus = isVencido ? 'VENCIDO' : 'EM DIA';
            licColor = isVencido ? '#991b1b' : '#166534';
            licBg = isVencido ? '#fef2f2' : '#dcfce7';
        }

        // 2. Troca de Óleo
        const kmPrevisto = vtr.manutencao?.oleo_km_prevista || 0;
        const kmAtual = vtr.km_atual || 0;
        let oleoStatus = "N/D", oleoColor = "#94a3b8", oleoBg = "#f1f5f9";
        if (kmPrevisto > 0) {
            const isVencido = kmAtual >= kmPrevisto;
            oleoStatus = isVencido ? 'VENCIDO' : 'OK';
            oleoColor = isVencido ? '#991b1b' : '#166534';
            oleoBg = isVencido ? '#fef2f2' : '#dcfce7';
        }

        // 3. Situação Geral
        const stOp = (vtr.status_operativo || "").toLowerCase();
        let sitStatus = 'ATIVA', sitColor = '#166534', sitBg = '#dcfce7';
        if (vtr.em_manutencao) { sitStatus = 'MANUTENÇÃO'; sitColor = '#92400e'; sitBg = '#fef3c7'; }
        else if (stOp === 'manutencao') { sitStatus = 'BAIXADA'; sitColor = '#991b1b'; sitBg = '#fef2f2'; }
        else if (stOp === 'reserva') { sitStatus = 'RESERVA'; sitColor = '#1e293b'; sitBg = '#f1f5f9'; }

        // Renderização do Modal Premium
        Swal.fire({
            width: '650px',
            showConfirmButton: false,
            padding: '0',
            background: '#f8fafc',
            html: `
                <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 35px 25px; color: white; border-radius: 15px 15px 0 0; text-align: left;">
                    <div style="display: flex; align-items: center; gap: 20px;">
                        <div style="width: 70px; height: 70px; background: rgba(255,255,255,0.1); border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 2.2em;">
                            <i class="fa-solid fa-truck-moving"></i>
                        </div>
                        <div>
                            <h2 style="margin: 0; font-size: 1.8em; font-weight: 900; letter-spacing: -1px;">${vtr.prefixo || 'S/P'}</h2>
                            <div style="background: #800020; color: white; display: inline-block; padding: 2px 10px; border-radius: 6px; font-size: 0.7em; font-weight: 800; margin-top: 5px;">
                                UNIDADE: ${vtr.unidade_atual_nome || 'N/D'}
                            </div>
                        </div>
                    </div>
                </div>

                <div style="padding: 25px;">
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: -55px; margin-bottom: 25px;">
                        <div style="background: ${licBg}; padding: 12px; border-radius: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); text-align: center; border: 1px solid ${licColor}20;">
                            <small style="display:block; font-size: 0.6em; font-weight: 800; color: #64748b;">LICENCIAMENTO</small>
                            <b style="color: ${licColor}; font-size: 0.9em;">${licStatus}</b>
                        </div>
                        <div style="background: ${oleoBg}; padding: 12px; border-radius: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); text-align: center; border: 1px solid ${oleoColor}20;">
                            <small style="display:block; font-size: 0.6em; font-weight: 800; color: #64748b;">TROCA DE ÓLEO</small>
                            <b style="color: ${oleoColor}; font-size: 0.9em;">${oleoStatus}</b>
                        </div>
                        <div style="background: ${sitBg}; padding: 12px; border-radius: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); text-align: center; border: 1px solid ${sitColor}20;">
                            <small style="display:block; font-size: 0.6em; font-weight: 800; color: #64748b;">SITUAÇÃO</small>
                            <b style="color: ${sitColor}; font-size: 0.9em;">${sitStatus}</b>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 20px; background: white; border-radius: 18px; border: 1px solid #e2e8f0; text-align: left; margin-bottom: 20px;">
                        <div>
                            <small style="display:block; color:#94a3b8; font-weight:800; text-transform:uppercase; font-size:0.6em;">Identificação</small>
                            <div style="font-weight:700; color:#1e293b; margin-top:4px;"><i class="fa-solid fa-id-card" style="width:20px; color:#2c7399;"></i> Placa: ${vtr.placa || '---'}</div>
                            <div style="font-weight:700; color:#1e293b; margin-top:8px;"><i class="fa-solid fa-car-rear" style="width:20px; color:#2c7399;"></i> ${vtr.modelo || '---'}</div>
                        </div>
                        <div>
                            <small style="display:block; color:#94a3b8; font-weight:800; text-transform:uppercase; font-size:0.6em;">Monitoramento</small>
                            <div style="font-weight:900; color:#2c7399; margin-top:4px;"><i class="fa-solid fa-gauge-high" style="width:20px;"></i> ${(vtr.km_atual || 0).toLocaleString('pt-BR')} km</div>
                            <div style="font-weight:700; color:#1e293b; margin-top:8px;"><i class="fa-solid fa-user-shield" style="width:20px; color:#2c7399;"></i> ${vtr.responsavel_atual_nome || 'No Pátio'}</div>
                        </div>
                    </div>

                    <button onclick="verHistoricoVidaViatura('${ativoUid}', '${vtr.prefixo}')" style="width: 100%; padding: 15px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; color: #475569; font-weight: 800; font-size: 0.75em; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 25px; transition: 0.3s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'">
                        <i class="fa-solid fa-clock-rotate-left" style="color: #800020;"></i> EXIBIR LINHA DO TEMPO E REGISTROS DO ATIVO
                    </button>

                    <div style="display: flex; gap: 10px;">
                        <button onclick="gerenciarChecklistVtr('${ativoUid}', '${(vtr.prefixo || "VTR").replace(/'/g, "\\'")}')" style="flex: 2; padding: 15px; border-radius: 12px; border: none; background: #2c7399; color: white; font-weight: 800; font-size: 0.85em; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                            <i class="fa-solid fa-list-check"></i> Checklist
                        </button>
                        <button onclick="alert('Módulo de Defeitos em Breve')" style="flex: 1; padding: 15px; border-radius: 12px; border: none; background: #800020; color: white; font-weight: 800; font-size: 0.85em; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                            <i class="fa-solid fa-triangle-exclamation"></i> Defeitos
                        </button>
                    </div>
                </div>
            `
        });

    } catch (e) {
        console.error("Erro no prontuário:", e);
        Swal.fire('Erro', 'Falha ao carregar prontuário: ' + e.message, 'error');
    }
}
async function verHistoricoVidaViatura(vtrId, prefixo) {
    const containerId = 'timeline-vtr-' + Date.now();

    Swal.fire({
        title: `<i class="fa-solid fa-clock-rotate-left"></i> Histórico: ${prefixo}`,
        width: '600px',
        html: `<div id="${containerId}" style="max-height: 450px; overflow-y: auto; padding: 10px; text-align: left;">
                  <i class="fas fa-spinner fa-spin"></i> Consultando registros...
               </div>`,
        showConfirmButton: true,
        confirmButtonText: 'FECHAR',
        confirmButtonColor: '#1e293b'
    });

    try {
        // Busca vistorias realizadas especificamente para esta viatura
        // O ID do checklist segue o padrão que definimos: CHECKLIST_VTR_{vtrId}
        const checklistId = `CHECKLIST_VTR_${vtrId}`;

        const snap = await db.collection('resultados_checklist')
            .where('id_origem', '==', checklistId) // Ajuste para o campo que você usa no seu banco
            .orderBy('timestamp', 'desc')
            .limit(20)
            .get();

        const container = document.getElementById(containerId);
        if (snap.empty) {
            container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:20px;">Nenhum registro de vistoria encontrado para este ativo.</p>';
            return;
        }

        let htmlTimeline = '<div class="sigma-v3-timeline">';
        snap.forEach(doc => {
            const data = doc.data();
            const dt = data.timestamp.toDate().toLocaleString('pt-BR');
            const temPendencia = data.totalCaa > 0;

            htmlTimeline += `
                <div class="sigma-v3-timeline-item" style="margin-bottom: 20px; border-left: 3px solid ${temPendencia ? '#991b1b' : '#166534'}; padding-left: 15px; position: relative;">
                    <div style="position: absolute; left: -8px; top: 0; width: 12px; height: 12px; border-radius: 50%; background: white; border: 3px solid ${temPendencia ? '#991b1b' : '#166534'};"></div>
                    <small style="color: #64748b; font-weight: 800;">${dt}</small>
                    <div style="font-weight: 700; color: #1e293b; margin-top: 2px;">VISTORIA REALIZADA</div>
                    <div style="font-size: 0.8em; color: #475569;">Por: <b>${data.conferente}</b></div>
                    <div style="margin-top: 5px;">
                        <span style="font-size: 0.7em; padding: 2px 8px; border-radius: 4px; background: ${temPendencia ? '#fef2f2' : '#dcfce7'}; color: ${temPendencia ? '#991b1b' : '#166534'}; font-weight: 800;">
                            ${temPendencia ? '⚠️ POSSUI AVARIAS' : '✅ SEM ALTERAÇÕES'}
                        </span>
                    </div>
                </div>`;
        });
        htmlTimeline += '</div>';
        container.innerHTML = htmlTimeline;

    } catch (e) {
        console.error("Erro no histórico:", e);
        document.getElementById(containerId).innerHTML = '<p style="color:red;">Erro ao processar linha do tempo.</p>';
    }
}
/*[GESTÃO DE VIATURAS/BASE*/
async function abrirFormularioViatura(dadosEdicao = null) {
    const isEdit = !!dadosEdicao;

    // Lista de Unidades para o Select (Busca na coleção oficial V3)
    const snapUnidades = await db.collection('unidades_estruturadas').where('ativo', '==', true).get();
    let optionsUnidades = '<option value="" disabled selected>Selecione a Unidade...</option>';
    snapUnidades.forEach(u => {
        const d = u.data();
        const selected = (isEdit && dadosEdicao.unidade_id === u.id) ? 'selected' : '';
        optionsUnidades += `<option value="${u.id}" data-sigla="${d.sigla}" ${selected}>${d.sigla} - ${d.nome_completo}</option>`;
    });

    Swal.fire({
        title: isEdit ? '<i class="fas fa-edit"></i> Editar Viatura' : '<i class="fas fa-truck-pickup"></i> Nova Viatura',
        width: '600px',
        html: `
            <div style="text-align: left; padding: 5px;">
                <div style="background: #f0f7fa; padding: 15px; border-radius: 12px; border: 1px solid #d1e2eb; margin-bottom: 20px;">
                    <small style="color: #2c7399; font-weight: 800; text-transform: uppercase; font-size: 0.7em;">1. Identificação e Unidade</small>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px;">
                        <div class="swal-v3-form-group">
                            <label>Prefixo (Ex: ABT-10)</label>
                            <input type="text" id="swal-vtr-prefixo" class="swal2-input" value="${isEdit ? dadosEdicao.prefixo : ''}" style="width:100%; margin:0;">
                        </div>
                        <div class="swal-v3-form-group">
                            <label>Placa</label>
                            <input type="text" id="swal-vtr-placa" class="swal2-input" value="${isEdit ? dadosEdicao.placa : ''}" style="width:100%; margin:0;">
                        </div>
                    </div>
                    <div class="swal-v3-form-group" style="margin-top:15px;">
                        <label>Unidade Responsável</label>
                        <select id="swal-vtr-unidade" class="swal2-select" style="width:100%; margin:0;">
                            ${optionsUnidades}
                        </select>
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="swal-v3-form-group">
                            <label>Segmento / Emprego</label>
                            <select id="swal-vtr-segmento" class="swal2-select" style="width:100%; margin:0;">
                                <option value="incendio" ${isEdit && dadosEdicao.segmento === 'incendio' ? 'selected' : ''}>Incêndio (Caminhão)</option>
                                <option value="ambulancia" ${isEdit && dadosEdicao.segmento === 'ambulancia' ? 'selected' : ''}>Ambulância (Resgate)</option>
                                <option value="salvamento" ${isEdit && dadosEdicao.segmento === 'salvamento' ? 'selected' : ''}>Salvamento / Pick-up</option>
                                <option value="passeio" ${isEdit && dadosEdicao.segmento === 'passeio' ? 'selected' : ''}>Adm / Passeio</option>
                            </select>
                        </div>
                        <div class="swal-v3-form-group">
                            <label>Status Operativo</label>
                            <select id="swal-vtr-status" class="swal2-select" style="width:100%; margin:0;">
                                <option value="ativo" ${isEdit && dadosEdicao.status === 'ativo' ? 'selected' : ''}>PRONTO (ATIVO)</option>
                                <option value="manutencao" ${isEdit && dadosEdicao.status === 'manutencao' ? 'selected' : ''}>BAIXADO (MANUTENÇÃO)</option>
                                <option value="reserva" ${isEdit && dadosEdicao.status === 'reserva' ? 'selected' : ''}>RESERVA</option>
                            </select>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-top:15px;">
                         <div class="swal-v3-form-group">
                            <label>Marca/Mod.</label>
                            <input type="text" id="swal-vtr-modelo" class="swal2-input" value="${isEdit ? dadosEdicao.modelo : ''}" style="width:100%; margin:0;">
                        </div>
                        <div class="swal-v3-form-group">
                            <label>Ano</label>
                            <input type="number" id="swal-vtr-ano" class="swal2-input" value="${isEdit ? dadosEdicao.ano : ''}" style="width:100%; margin:0;">
                        </div>
                        <div class="swal-v3-form-group">
                            <label>KM Atual</label>
                            <input type="number" id="swal-vtr-km" class="swal2-input" value="${isEdit ? dadosEdicao.km_atual : ''}" style="width:100%; margin:0;">
                        </div>
                    </div>
                </div>

                <div style="background: #fff9f0; padding: 15px; border-radius: 12px; border: 1px solid #ffe8cc;">
                    <small style="color: #c2780e; font-weight: 800; text-transform: uppercase; font-size: 0.7em;">3. Manutenção Preventiva (Óleo)</small>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px;">
                        <div class="swal-v3-form-group">
                            <label>Data Prevista</label>
                            <input type="date" id="swal-vtr-oleo-data" class="swal2-input" value="${isEdit ? dadosEdicao.oleo_data : ''}" style="width:100%; margin:0;">
                        </div>
                        <div class="swal-v3-form-group">
                            <label>KM Prevista</label>
                            <input type="number" id="swal-vtr-oleo-km" class="swal2-input" value="${isEdit ? dadosEdicao.oleo_km : ''}" style="width:100%; margin:0;">
                        </div>
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'SALVAR VIATURA',
        confirmButtonColor: '#2c7399',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const prefixo = document.getElementById('swal-vtr-prefixo').value.trim().toUpperCase();
            const placa = document.getElementById('swal-vtr-placa').value.trim().toUpperCase();
            const unidadeEl = document.getElementById('swal-vtr-unidade');
            const unidade_id = unidadeEl.value;
            const unidade_sigla = unidadeEl.options[unidadeEl.selectedIndex].getAttribute('data-sigla');

            if (!prefixo || !placa || !unidade_id) {
                return Swal.showValidationMessage('Prefixo, Placa e Unidade são obrigatórios');
            }

            return {
                prefixo,
                placa,
                unidade_id,
                unidade_sigla,
                segmento: document.getElementById('swal-vtr-segmento').value,
                status: document.getElementById('swal-vtr-status').value,
                modelo: document.getElementById('swal-vtr-modelo').value.trim().toUpperCase(),
                ano: document.getElementById('swal-vtr-ano').value,
                km_atual: parseInt(document.getElementById('swal-vtr-km').value) || 0,
                oleo_data: document.getElementById('swal-vtr-oleo-data').value,
                oleo_km: parseInt(document.getElementById('swal-vtr-oleo-km').value) || 0
            };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            executarSalvamentoViatura(isEdit ? dadosEdicao.uid : null, result.value);
        }
    });
}
async function executarSalvamentoViatura(uid, dados) {
    Swal.fire({
        title: 'Sincronizando...',
        html: 'Atualizando dados da frota global.',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const uidFinal = uid || ("VTR-" + Date.now());
        const vtrRef = db.collection('viaturas').doc(uidFinal);
        const dataHora = firebase.firestore.FieldValue.serverTimestamp();

        // Criamos a chave de busca para o filtro instantâneo
        const searchKey = (dados.prefixo + dados.placa).replace(/[^A-Z0-9]/gi, '').toLowerCase();

        const payload = {
            uid: uidFinal,
            prefixo: dados.prefixo,
            placa: dados.placa,
            search_key: searchKey,
            unidade_id: dados.unidade_id,
            unidade_sigla: dados.unidade_sigla,
            segmento: dados.segmento,
            status_operativo: dados.status, // Padronizado com o seu campo original
            modelo: dados.modelo,
            ano: dados.ano,
            km_atual: dados.km_atual,
            manutencao: {
                oleo_data: dados.oleo_data,
                oleo_km_prevista: dados.oleo_km
            },
            last_update: dataHora,
            atualizado_por: currentUserData.nome_militar_completo
        };

        if (!uid) {
            payload.data_cadastro = dataHora;
        }

        await vtrRef.set(payload, { merge: true });

        // Toast de Sucesso Sigma V3
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
        });

        Toast.fire({
            icon: 'success',
            title: uid ? 'Viatura atualizada!' : 'Viatura cadastrada com sucesso!'
        });

        carregarVtrBasesCards(); // Recarrega o grid

    } catch (e) {
        console.error("Erro ao salvar viatura:", e);
        Swal.fire('Erro Técnico', 'Não foi possível salvar os dados no Firebase.', 'error');
    }
}

// MENU LISTAS
async function abrirFormularioLista(dadosEdicao = null) {
    const isEdit = !!dadosEdicao;

    // Mostra loading enquanto busca dados para os selects
    Swal.fire({ title: 'Carregando opções...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        // Busca Ativos, Unidades e Postos em paralelo para agilizar
        const [snapAtivos, snapUnidades, snapPostos] = await Promise.all([
            db.collection('viaturas').orderBy('prefixo').get(),
            db.collection('unidades_estruturadas').where('ativo', '==', true).get(),
            db.collection('postos_estruturados').where('ativo', '==', true).get()
        ]);

        let optAtivos = '<option value="" disabled selected>Selecione o Ativo...</option>';
        snapAtivos.forEach(doc => {
            const v = doc.data();
            const sel = isEdit && dadosEdicao.ativo_id === doc.id ? 'selected' : '';
            optAtivos += `<option value="${doc.id}" data-nome="${v.prefixo}" ${sel}>${v.prefixo} (${v.placa})</option>`;
        });

        let optUnidades = '<option value="" disabled selected>Selecione a Unidade...</option>';
        snapUnidades.forEach(doc => {
            const u = doc.data();
            const sel = isEdit && dadosEdicao.unidade_id === doc.id ? 'selected' : '';
            optUnidades += `<option value="${doc.id}" data-sigla="${u.sigla}" ${sel}>${u.sigla}</option>`;
        });

        let optPostos = '<option value="" disabled selected>Vincular ao Posto...</option>';
        snapPostos.forEach(doc => {
            const p = doc.data();
            const sel = isEdit && dadosEdicao.posto_id === doc.id ? 'selected' : '';
            optPostos += `<option value="${doc.id}" data-nome="${p.nome}" ${sel}>${p.nome}</option>`;
        });

        Swal.fire({
            title: isEdit ? '<i class="fas fa-edit"></i> Editar Lista' : '<i class="fas fa-plus-circle"></i> Nova Lista Mestra',
            width: '600px',
            html: `
                <div style="text-align: left; padding: 5px;">
                    <div class="swal-v3-form-group">
                        <label style="font-weight: 800; font-size: 0.75em; color: #64748b; text-transform: uppercase;">1. Ativo Vinculado (Viatura/Base)</label>
                        <select id="swal-lista-ativo" class="swal2-select" style="width:100%; margin:5px 0 15px 0; border-radius: 10px;">${optAtivos}</select>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="swal-v3-form-group">
                            <label style="font-weight: 800; font-size: 0.75em; color: #64748b; text-transform: uppercase;">2. Unidade Gestora</label>
                            <select id="swal-lista-unidade" class="swal2-select" style="width:100%; margin:5px 0 15px 0; border-radius: 10px;">${optUnidades}</select>
                        </div>
                        <div class="swal-v3-form-group">
                            <label style="font-weight: 800; font-size: 0.75em; color: #64748b; text-transform: uppercase;">3. Posto de Serviço</label>
                            <select id="swal-lista-posto" class="swal2-select" style="width:100%; margin:5px 0 15px 0; border-radius: 10px;">${optPostos}</select>
                        </div>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: isEdit ? 'ATUALIZAR CABEÇALHO' : 'CRIAR E CONFIGURAR ITENS',
            confirmButtonColor: isEdit ? '#2c7399' : '#800000',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const selAtivo = document.getElementById('swal-lista-ativo');
                const selUnid = document.getElementById('swal-lista-unidade');
                const selPosto = document.getElementById('swal-lista-posto');

                if (!selAtivo.value || !selUnid.value || !selPosto.value) {
                    return Swal.showValidationMessage('Selecione todos os campos');
                }

                return {
                    ativo_id: selAtivo.value,
                    ativo_nome: selAtivo.options[selAtivo.selectedIndex].dataset.nome,
                    unidade_id: selUnid.value,
                    unidade_sigla: selUnid.options[selUnid.selectedIndex].dataset.sigla,
                    posto_id: selPosto.value,
                    posto_nome: selPosto.options[selPosto.selectedIndex].dataset.nome
                };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const abrirEditor = !isEdit; // Só abre o editor de itens se for lista nova
                gravarCabecalhoListaV3(abrirEditor, isEdit ? dadosEdicao.uid : null, result.value);
            }
        });

    } catch (e) {
        console.error(e);
        Swal.fire('Erro', 'Falha ao carregar dependências.', 'error');
    }
}
async function gravarCabecalhoListaV3(abrirEditor, uidExistente, dados) {
    Swal.fire({ title: 'Salvando...', didOpen: () => Swal.showLoading() });

    try {
        const uidFinal = uidExistente || `LISTA_${dados.ativo_id}_${Date.now()}`;
        const docRef = db.collection('listas_conferencia').doc(uidFinal);

        const payload = {
            ...dados,
            uid: uidFinal,
            ativo: true,
            tipo: 'conferencia_materiais',
            atualizado_em: firebase.firestore.FieldValue.serverTimestamp(),
            atualizado_por: currentUserData.nome_militar_completo
        };

        if (!uidExistente) {
            payload.criado_em = firebase.firestore.FieldValue.serverTimestamp();
            payload.list = []; // Inicia vazia para o editor
        }

        await docRef.set(payload, { merge: true });

        if (abrirEditor) {
            abrirModalEditorItens(uidFinal, dados.ativo_nome);
        } else {
            Swal.fire({ icon: 'success', title: 'Lista atualizada!', timer: 1500, showConfirmButton: false });
            carregarCardsListasExistentes();
        }

    } catch (e) {
        console.error(e);
        Swal.fire('Erro', 'Erro ao gravar no banco.', 'error');
    }
}
async function carregarCardsListasExistentes() {
    const container = document.getElementById('container-cards-listas');
    if (!container) return;

    container.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding:60px; color:#64748b;">
            <i class="fas fa-sync fa-spin fa-3x" style="opacity:0.3; margin-bottom:15px; display:block;"></i>
            <span style="font-weight:700; letter-spacing:1px; text-transform:uppercase; font-size:0.8em;">Sincronizando Inventários...</span>
        </div>`;

    try {
        const role = currentUserData?.role;
        const minhaUnidadeId = currentUserData?.unidade_id;
        const isAdminGeral = (role === 'admin' || role === 'gestor_geral');

        // 1. Definição da Query Base
        let query = db.collection('listas_conferencia')
            .where('ativo', '==', true)
            .where('tipo', '==', 'conferencia_materiais');

        // ✅ FILTRO DE UNIDADE: Se não for Admin Geral, filtra obrigatoriamente pela unidade do Gestor
        if (!isAdminGeral) {
            if (!minhaUnidadeId) {
                console.warn("⚠️ Unidade do gestor não identificada no perfil.");
                container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:50px; color:#94a3b8;">Erro: Sua unidade não está vinculada ao seu perfil.</div>`;
                return;
            }
            query = query.where('unidade_id', '==', minhaUnidadeId);
        }

        const snap = await query.get();

        if (snap.empty) {
            const msgVazio = isAdminGeral ? "Nenhuma lista localizada no sistema." : "Nenhuma lista localizada para sua unidade.";
            container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:50px; color:#94a3b8;">${msgVazio}</div>`;
            return;
        }

        let html = '';
        snap.forEach(doc => {
            const lista = doc.data();
            const qtdItens = (lista.list || []).reduce((acc, setor) => acc + (setor.itens ? setor.itens.length : 0), 0);

            // Prepara o objeto para edição e sanitiza o JSON para o atributo onclick
            const listaParaEditar = { uid: doc.id, ...lista };
            const listaJson = JSON.stringify(listaParaEditar).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

            // ✅ RESTRIÇÃO DE EXCLUSÃO: Apenas Admin/Gestor Geral vê o botão de lixeira
            const btnDelete = isAdminGeral ? `
                <button class="v3-btn-action" title="Excluir Lista" onclick="event.stopPropagation(); deletarListaInteira('${doc.id}', '${lista.ativo_nome}')">
                    <i class="fas fa-trash-alt"></i>
                </button>` : '';

            html += `
                <div class="v3-posto-card" style="border-top: 6px solid #2c7399; cursor:pointer;" 
                     onclick="abrirModalEditorItens('${doc.id}', '${lista.ativo_nome}')">
                    
                    <div class="v3-posto-actions">
                        <button class="v3-btn-action" title="Editar Informações" onclick="event.stopPropagation(); abrirFormularioLista(JSON.parse('${listaJson}'))">
                            <i class="fas fa-pencil-alt"></i>
                        </button>
                        ${btnDelete}
                    </div>
                    
                    <div style="padding: 20px; display: flex; flex-direction: column; align-items: center; text-align: center; flex-grow: 1;">
                        <div class="v3-icon-box" style="background: rgba(44, 115, 153, 0.1); color: #2c7399; width: 60px; height: 60px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 1.6em; margin-bottom: 15px;">
                            <i class="fa-solid fa-clipboard-list"></i>
                        </div>

                        <div style="margin-bottom: 10px;">
                            <span style="display:block; font-weight:900; font-size:1.2em; color:#1e293b; letter-spacing:-0.5px;">${lista.ativo_nome}</span>
                            <span class="v3-vtr-badge v3-status-pronto" style="margin-top: 5px; display: inline-block; background: #e0f2fe; color: #0369a1;">
                                ${qtdItens} ITENS NO INVENTÁRIO
                            </span>
                        </div>

                        <div style="width: 100%; border-top: 1px solid #f1f5f9; padding-top: 12px; margin-top: auto; text-align: left;">
                            <small style="display:block; font-size:0.6em; font-weight:800; color:#94a3b8; text-transform:uppercase; margin-bottom:4px;">Localização & Gestão</small>
                            <div style="display:flex; align-items:center; gap:6px;">
                                <i class="fas fa-map-marker-alt" style="color:#2c7399; font-size:0.75em;"></i>
                                <span style="font-size:0.8em; font-weight:700; color:#475569;">${lista.posto_nome || 'N/D'} | ${lista.unidade_sigla || 'N/D'}</span>
                            </div>
                        </div>
                    </div>
                </div>`;
        });

        container.innerHTML = html;
        if (window.FontAwesome) FontAwesome.dom.i2svg();

    } catch (e) {
        console.error("❌ Erro ao carregar listas da unidade:", e);
        container.innerHTML = `<p style="color:red; text-align:center; padding:40px;">Erro ao sincronizar inventários.</p>`;
    }
}

function filtrarCardsListas() {
    const termo = document.getElementById('filter-lista-busca').value.toUpperCase();
    const cards = document.querySelectorAll('#container-cards-listas .v3-posto-card');
    cards.forEach(card => {
        card.style.display = card.innerText.toUpperCase().includes(termo) ? "flex" : "none";
    });
}

/**
 * Exclui a lista de conferência e limpa a rota associada
 */
async function deletarListaInteira(listaUid, nomeAtivo) {
    if (!confirm(`⚠️ ATENÇÃO: Isso apagará permanentemente o inventário de materiais do ${nomeAtivo}. Confirma?`)) return;

    try {
        const batch = db.batch();

        // 1. Remove a lista (Operação principal)
        batch.delete(db.collection('listas_conferencia').doc(listaUid));

        // 🗑️ REMOVIDO: Bloco que tentava atualizar config_geral/rotas
        // A limpeza do legado agora é automática, pois não dependemos mais desse índice.

        await batch.commit();
        alert("Lista removida com sucesso.");
        carregarCardsListasExistentes();

    } catch (e) {
        console.error("Erro ao deletar lista:", e);
        alert("Erro ao excluir lista.");
    }
}


async function abrirModalEditorItens(uid, nome, colecaoAlvo) {
    // 1. BLINDAGEM DE INSTÂNCIA
    const firestore = firebase.firestore();

    // 2. NORMALIZAÇÃO RADICAL DE ID E RESET DE CONTROLE
    let idReal = (typeof uid === 'object' && uid !== null) ? (uid.id || uid.uid || uid.checklistId) : String(uid);
    idReal = idReal.trim();
    idListaSendoEditada = idReal;

    // Reset de arrays de movimentação para evitar contaminação
    itensParaEstorno = [];
    if (typeof atualizarInterfaceEstorno === 'function') atualizarInterfaceEstorno();

    // 3. DEFINIÇÃO DE CONTEXTO (VISTORIA VS CONFERÊNCIA)
    if (idReal.startsWith('CHECKLIST_VTR_')) {
        window.colecaoAtivaNoEditor = 'listas_checklist';
        window.isModoVistoria = true;
        isModoVistoria = true;
    } else {
        window.colecaoAtivaNoEditor = colecaoAlvo || 'listas_conferencia';
        window.isModoVistoria = false;
        isModoVistoria = false;
    }

    const modoCor = isModoVistoria ? '#2c3e50' : '#800020';
    const modoTexto = isModoVistoria ? 'EDITOR DE CHECKLIST' : 'EDITOR DE LISTA';
    const modoIcone = isModoVistoria ? 'fa-car' : 'fa-clipboard-list';

    // 4. INTERFACE E TRANSIÇÃO
    switchView('editor-arquitetura');

    const headerSticky = document.querySelector('.editor-header-sticky');
    if (headerSticky) headerSticky.style.borderTop = `6px solid ${modoCor}`;

    const elNome = document.getElementById('edit-vtr-nome');
    if (elNome) {
        elNome.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas ${modoIcone}" style="color: ${modoCor}; font-size: 0.9em;"></i>
                <div style="line-height: 1;">
                    <span style="display: block; font-size: 0.5em; font-weight: 800; color: ${modoCor}; letter-spacing: 1px; text-transform: uppercase;">${modoTexto}</span>
                    <span style="font-size: 1em;">${nome}</span>
                </div>
            </div>`;
    }

    const containerDrag = document.getElementById('setores-drag-container');
    if (containerDrag) {
        containerDrag.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:50px;">
                <i class="fas fa-sync fa-spin fa-2x" style="color: ${modoCor}"></i><br>
                Sincronizando Dados...
            </div>`;
    }

    try {
        // 5. BUSCA DIRETA NO DOCUMENTO (SEM DEPENDÊNCIA DE ROTAS)
        let doc = await firestore.collection(window.colecaoAtivaNoEditor).doc(idReal).get();

        if (!doc.exists) {
            await new Promise(r => setTimeout(r, 800)); // Pequeno delay para consistência do Firebase
            doc = await firestore.collection(window.colecaoAtivaNoEditor).doc(idReal).get();
        }

        if (!doc.exists) throw new Error("A arquitetura desta lista não foi localizada.");

        const dados = doc.data();
        arquiteturaAtiva = dados.list || [];

        // 6. SINCRONIZAÇÃO DE RÓTULOS E ESTOQUE
        const elUnidade = document.getElementById('edit-vtr-unidade');
        if (elUnidade) elUnidade.textContent = `Unidade: ${dados.unidade_sigla || 'N/D'}`;

        const inputBusca = document.getElementById('input-busca-estoque');
        if (inputBusca) {
            inputBusca.placeholder = isModoVistoria ? "Digitar item de vistoria..." : "Adicionar item do estoque...";
        }

        // CARGA INTELIGENTE: Carrega o estoque baseado no unidade_id do próprio documento
        if (!isModoVistoria && dados.unidade_id) {
            await carregarEstoqueParaEditor(dados.unidade_id);
        } else {
            estoqueGestorLocal = [];
        }

        renderizarArquiteturaEditor();
        if (typeof atualizarSelectSetores === 'function') atualizarSelectSetores();

        const btnPub = document.querySelector('.btn-publish');
        if (btnPub) btnPub.style.backgroundColor = isModoVistoria ? '#2c7399' : '#1b8a3e';

    } catch (e) {
        console.error("❌ FALHA NO EDITOR:", e);
        alert(e.message);
        isModoVistoria ? switchView('vtr-bases') : switchView('listas');
    }
}
async function verHistoricoVidaGlobal(uidGlobal, tombamento = null) {
    const container = document.getElementById('timeline-container');
    const modal = document.getElementById('modal-timeline-global');
    const labelNome = document.getElementById('timeline-item-nome');

    if (!container || !modal) return;

    modal.style.display = 'flex';
    container.innerHTML = '<div style="text-align:center; padding:30px;"><i class="fas fa-spinner fa-spin"></i> Acessando prontuário...</div>';

    try {
        const docRef = db.collection('inventario').doc(uidGlobal);
        let eventos = [];

        if (tombamento) {
            // ✅ MODO MULTI: ACESSO AO PRONTUÁRIO INDIVIDUAL
            labelNome.textContent = `RG Individual: Tomb. ${tombamento}`;

            const histSnap = await docRef
                .collection('tombamentos')
                .doc(tombamento)
                .collection('historico_vida')
                .get();

            eventos = histSnap.docs.map(d => ({
                ...d.data(),
                id_evento: d.id
            }));

        } else {
            // ✅ MODO SINGLE/LOTE
            labelNome.textContent = `Histórico de Lote`;

            // 1. Busca logs no Documento Principal
            const snapPai = await docRef.get();
            if (snapPai.exists && snapPai.data().historico_movimentacoes) {
                eventos = [...snapPai.data().historico_movimentacoes];
            }

            // 2. Busca logs distribuídos nas sub-coleções de saldos das unidades
            const saldosSnap = await docRef.collection('saldos_unidades').get();
            for (const docUnid of saldosSnap.docs) {
                const hSnap = await docUnid.ref.collection('historico_vida').get();
                hSnap.forEach(hDoc => {
                    eventos.push({
                        ...hDoc.data(),
                        unidade_ref: docUnid.data().unidade_sigla
                    });
                });
            }
        }

        if (eventos.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; color:#999; padding:40px;">
                    <i class="fas fa-search fa-3x" style="opacity:0.2; margin-bottom:10px;"></i>
                    <p>Nenhum registro encontrado para este nível.</p>
                </div>`;
            return;
        }

        // Ordenação Cronológica (Mais recente primeiro)
        eventos.sort((a, b) => {
            const parseDate = (str) => {
                if (!str) return new Date(0);
                const parts = str.split(', ');
                const dateParts = parts[0].split('/');
                const timeParts = parts[1] ? parts[1].split(':') : [0, 0, 0];
                return new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1], timeParts[2]);
            };
            return parseDate(b.data) - parseDate(a.data);
        });

        // ✅ MONTAGEM DA UI COM TRATAMENTO DE QUANTIDADE E GUIA AMIGÁVEL
        container.innerHTML = eventos.map(ev => {
            let icon = 'fa-history';
            let color = '#4b5563'; // Cinza escuro padrão
            const evNome = (ev.evento || "").toUpperCase();

            // Lógica de Cores e Ícones
            if (evNome.includes('APORTE')) { icon = 'fa-plus-circle'; color = '#1b8a3e'; }
            if (evNome.includes('RECEBIMENTO')) { icon = 'fa-file-import'; color = '#1b8a3e'; }
            if (evNome.includes('ENVIO') || evNome.includes('TRANSFERENCIA')) { icon = 'fa-exchange-alt'; color = '#2c7399'; }
            if (evNome.includes('AVARIA') || evNome.includes('PENDENCIA')) { icon = 'fa-exclamation-triangle'; color = '#800020'; }

            // ✅ Tratamento da Quantidade (Apenas se houver e for lote)
            const labelQtd = ev.quantidade ? `<span style="background:${color}22; color:${color}; padding:2px 6px; border-radius:4px; margin-left:8px; font-size:0.9em;">[${ev.quantidade} un.]</span>` : '';

            // ✅ Tratamento da Guia Amigável (Converte ID longo em TR-ANO/ID)
            let detalhesTexto = ev.detalhes || ev.descricao || 'Sem descrição.';
            const regexFirestoreID = /[a-zA-Z0-9]{20}/g; // Identifica IDs padrão do Firestore
            detalhesTexto = detalhesTexto.replace(regexFirestoreID, (match) => {
                return `<b>TR-2026/${match.substring(0, 5).toUpperCase()}</b>`;
            });

            return `
                <div class="timeline-event" style="border-left: 3px solid ${color}; margin-bottom: 20px; padding-left: 20px; position: relative;">
                    <div style="position: absolute; left: -9px; top: 0; background: #fff; padding: 2px;">
                        <i class="fas ${icon}" style="color: ${color}; font-size: 12px;"></i>
                    </div>
                    <span class="event-date" style="font-size: 0.8em; color: #666; font-weight: bold;">${ev.data}</span>
                    <span class="event-title" style="display: block; font-weight: 800; color: #333; font-size: 0.85em; text-transform: uppercase;">
                        ${evNome.replace(/_/g, ' ')} ${ev.unidade_ref ? `[${ev.unidade_ref}]` : ''} ${labelQtd}
                    </span>
                    <div class="event-desc" style="font-size: 0.9em; color: #444; background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #eee; margin-top: 5px; line-height: 1.4;">
                        ${detalhesTexto}
                    </div>
                    <span class="event-user" style="font-size: 0.75em; color: #999; display: block; margin-top: 5px;">
                        <i class="fas fa-user-edit"></i> Resp: ${ev.quem || 'Sistema'}
                    </span>
                </div>`;
        }).join('');

    } catch (e) {
        console.error("❌ Erro ao carregar histórico:", e);
        container.innerHTML = `<p style="color:red; text-align:center; padding:20px;">Erro: ${e.message}</p>`;
    }
}

// ================================================================
// 2. FECHAR O EDITOR (BOTÃO VOLTAR)
// ================================================================
function fecharEditorArquitetura() {
    // 1. Verificação de segurança para mudanças não salvas
    const btnPub = document.querySelector('.btn-publish');
    if (btnPub && btnPub.classList.contains('modified')) {
        if (!confirm("Você possui alterações não publicadas. Deseja realmente sair e descartar as mudanças?")) return;
    }

    // 2. Limpa o estado global do editor
    idListaSendoEditada = null;
    arquiteturaAtiva = [];
    itensParaEstorno = [];

    // 3. UI: Esconde o palco do editor
    document.getElementById('view-editor-arquitetura').style.display = 'none';

    // 4. ✅ LÓGICA DE RETORNO INTELIGENTE
    if (isModoVistoria) {
        // Se for checklist, volta para o menu de Viaturas & Bases
        switchView('vtr-bases');
    } else {
        // Se for material, volta para a Gestão de Listas (comportamento original)
        document.getElementById('menu-editor-listas').style.display = 'block';
        const linkListas = document.getElementById('link-listas');
        if (linkListas) linkListas.classList.add('active');
        carregarCardsListasExistentes();
    }

    // 5. Restaura o padding padrão da tela que o editor remove
    const contentPrincipal = document.querySelector('.content');
    if (contentPrincipal) contentPrincipal.style.padding = '20px';
}

// ================================================================
// 3. CARREGAR ESTOQUE DA UNIDADE (BUSCA INTELIGENTE)
// ================================================================
async function carregarEstoqueParaEditor(unidadeId) {
    try {
        console.log("🚀 INICIANDO CARGA DE ESTOQUE PARA UNIDADE:", unidadeId);
        estoqueGestorLocal = [];

        const snapItens = await db.collection('inventario').get();

        for (const doc of snapItens.docs) {
            const itemGlobal = doc.data();
            const ehMulti = itemGlobal.tipo === 'multi';
            const uidItem = doc.id;

            // 1. BUSCA DE TOMBAMENTOS (Para itens Multi)
            let tombamentosDaUnidade = [];
            if (ehMulti) {
                const snapTombs = await db.collection('inventario').doc(uidItem)
                    .collection('tombamentos')
                    .where('local_id', '==', unidadeId)
                    .get();

                tombamentosDaUnidade = snapTombs.docs.map(t => t.data());
            }

            // 2. BUSCA DE SALDO (Para itens Single)
            const saldoDoc = await doc.ref.collection('saldos_unidades').doc(unidadeId).get();
            const temSaldoSingle = saldoDoc.exists && (Number(saldoDoc.data().qtd_total) > 0);

            // ✅ CORREÇÃO CRÍTICA: Se o item estiver no estoque da unidade, montamos o objeto de busca
            if (tombamentosDaUnidade.length > 0 || temSaldoSingle) {

                const objetoParaBusca = {
                    id_almox: uidItem,
                    uid_global: uidItem,
                    nome: itemGlobal.nome || "Item sem nome",
                    tipo: itemGlobal.tipo,
                    categoria: itemGlobal.categoria || "OUTROS",
                    unidade_id: unidadeId,
                    tombamentos: tombamentosDaUnidade,
                    disponivel: ehMulti ? tombamentosDaUnidade.length : (Number(saldoDoc.data().qtd_disp) || 0),
                    
                    // 🔥 A PEÇA QUE FALTA: Injeta as regras de KIT no rascunho de busca
                    is_anfitriao: itemGlobal.is_anfitriao || false,
                    componentes_regra: itemGlobal.componentes_regra || [] 
                };

                estoqueGestorLocal.push(objetoParaBusca);
            }
        }

        console.log("🏁 CACHE FINALIZADO. Itens com regras de kit mapeados:", estoqueGestorLocal.length);

    } catch (e) {
        console.error("❌ ERRO CRÍTICO NA CARGA DO ESTOQUE:", e);
    }
}
// ================================================================
// 4. RENDERIZAÇÃO DA INTERFACE (GRID E CARDS)
// ================================================================
function renderizarArquiteturaEditor() {
    const container = document.getElementById('setores-drag-container');
    if (!container) return;

    container.innerHTML = '';

    const corTemaSetor = window.isModoVistoria ? '#2c3e50' : '#800020';

    if (arquiteturaAtiva.length === 0) {
        container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:#64748b;">
            <i class="fas fa-folder-open fa-3x" style="display:block; margin-bottom:15px; opacity:0.3;"></i>
            Nenhum setor criado. Clique no botão + para começar.
        </div>`;
        return;
    }

    arquiteturaAtiva.forEach((setor, indexSetor) => {
        const setorDiv = document.createElement('div');
        setorDiv.className = 'setor-arquitetura-card';
        setorDiv.dataset.index = indexSetor;

        let htmlHeader = `
            <div class="setor-arquitetura-header" style="background-color: ${corTemaSetor} !important;">
                <span><i class="fas fa-grip-lines" style="margin-right:10px; opacity:0.5;"></i> ${setor.nome}</span>
                <button onclick="removerSetorArquitetura(${indexSetor})" class="btn-remove-item-vtr" style="color:white;">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>`;

        let htmlItens = `<div class="setor-arquitetura-body" data-setor-index="${indexSetor}">`;

        (setor.itens || []).forEach((item, indexItem) => {
            const ehMulti = item.tipo === 'multi';
            const ehAnfitriao = item.is_anfitriao || (item.acessorios_acoplados && item.acessorios_acoplados.length > 0);

            // ✅ INÍCIO DO CARD DO ITEM
            htmlItens += `
    <div class="item-arquitetura-linha" data-item-index="${indexItem}" 
         style="flex-direction: column; align-items: flex-start; gap: 5px; padding: 10px; border-bottom: 1px solid #f1f5f9; position: relative; ${ehAnfitriao ? 'background: #fffcf5; border-left: 3px solid #f59e0b;' : ''}">
        
        <div class="item-arquitetura-info" style="width: 100%; display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="display: flex; flex-direction: column;">
                <b style="color: #1e293b; font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Inter', sans-serif;">
                    ${ehAnfitriao ? '<i class="fas fa-box-open" style="color:#f59e0b; margin-right:5px;"></i>' : ''}${item.nome}
                </b>
            </div>
            
            <button onclick="${ehMulti ? '' : `marcarParaEstorno(${indexSetor}, ${indexItem})`}" 
                    style="${ehMulti ? 'display:none;' : 'background: #f1f5f9; border: none; color: #94a3b8; cursor: pointer; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.2s;'}" 
                    onmouseover="this.style.background='#fee2e2'; this.style.color='#ef4444'" 
                    onmouseout="this.style.background='#f1f5f9'; this.style.color='#94a3b8'">
                <i class="fas fa-times" style="font-size: 9px;"></i>
            </button>
        </div>
        
        <div class="lista-tombamentos-container" style="width: 100%; display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px;">
            ${ehMulti ?
                    (item.tombamentos || []).map((tData, tIndex) => `
                    <div style="display: flex; align-items: center; background: #f8fafc; padding: 2px 2px 2px 8px; border-radius: 4px; border: 1px solid #e2e8f0; gap: 6px;">
                        <span style="font-size: 11px; font-family: 'Inter', sans-serif; font-weight: 700; color: #475569; letter-spacing: -0.2px;">
                            <i class="fas fa-tag" style="font-size: 9px; color: ${corTemaSetor}; margin-right: 3px;"></i>${tData.tomb || 'S/N'}
                        </span>
                        <button onclick="removerTombamentoIndividual(${indexSetor}, ${indexItem}, ${tIndex})" 
                                style="background: #fee2e2; border: none; color: #b91c1c; cursor: pointer; border-radius: 3px; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 9px;">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>`).join('')
                    :
                    `<div style="font-size: 10px; font-weight: 800; color: #b45309; background: #fff7ed; padding: 2px 8px; border-radius: 4px; border: 1px solid #ffedd5; font-family: 'Inter', sans-serif; display: flex; align-items: center; gap: 4px;">
                    <i class="fas fa-boxes" style="font-size: 9px; opacity: 0.7;"></i>
                    QTD: ${item.quantidadeEsperada}
                </div>`
                }
        </div>

        ${item.acessorios_acoplados && item.acessorios_acoplados.length > 0 ? `
            <div class="acessorios-vtr-container" style="width: 100%; margin-top: 8px; padding-left: 12px; border-left: 2px dashed #f59e0b; box-sizing: border-box;">
                <small style="display:block; font-size: 0.6em; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 5px;">Acessórios Vinculados ao Kit:</small>
                ${item.acessorios_acoplados.map((ac, indexAc) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 4px 8px; border-radius: 5px; border: 1px solid #f1f5f9; margin-bottom: 3px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                        <span style="font-size: 10px; font-weight: 600; color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">
                            <i class="fas fa-link" style="font-size: 8px; color: #f59e0b;"></i> ${ac.nome}
                        </span>
    
                        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                            <b style="font-size: 10px; color: #1e293b;">${ac.quantidade} un.</b>
                            <button onclick="removerAcessorioDeKit(${indexSetor}, ${indexItem}, ${indexAc})" 
                                    title="Remover apenas este acessório"
                                    style="background: #fff1f2; border: none; color: #e11d48; cursor: pointer; border-radius: 3px; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 8px; transition: 0.2s;"
                                    onmouseover="this.style.background='#ffe4e6'" onmouseout="this.style.background='#fff1f2'">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    </div>`;
        });

        htmlItens += `</div>`;
        setorDiv.innerHTML = htmlHeader + htmlItens;
        container.appendChild(setorDiv);

        // Configuração do Drag and Drop para itens
        new Sortable(setorDiv.querySelector('.setor-arquitetura-body'), {
            group: 'itens_viatura',
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: function (evt) {
                const fromIdx = evt.from.dataset.setorIndex;
                const toIdx = evt.to.dataset.setorIndex;
                const oldItemIdx = evt.oldIndex;
                const newItemIdx = evt.newIndex;
                const itemMovido = arquiteturaAtiva[fromIdx].itens.splice(oldItemIdx, 1)[0];
                arquiteturaAtiva[toIdx].itens.splice(newItemIdx, 0, itemMovido);
                marcarAlteracao();
            }
        });
    });

    // Configuração do Drag and Drop para setores
    new Sortable(container, {
        animation: 150,
        handle: '.setor-arquitetura-header',
        onEnd: function (evt) {
            const oldIdx = evt.oldIndex;
            const newIdx = evt.newIndex;
            const setorMovido = arquiteturaAtiva.splice(oldIdx, 1)[0];
            arquiteturaAtiva.splice(newIdx, 0, setorMovido);
            marcarAlteracao();
        }
    });
}

/**
 * Remove um acessório específico de dentro de um item anfitrião.
 * O acessório removido vai para a Caixa de Saída para retornar ao estoque.
 */
function removerAcessorioDeKit(setorIdx, itemPaiIdx, acessorioIdx) {
    const itemPai = arquiteturaAtiva[setorIdx].itens[itemPaiIdx];

    // 1. Remove o acessório do array do pai
    const acessorioRemovido = itemPai.acessorios_acoplados.splice(acessorioIdx, 1)[0];

    // 2. Registra na Caixa de Saída (Estorno) para que o saldo volte ao estoque no 'Publish'
    itensParaEstorno.push({
        uid_global: acessorioRemovido.uid_global,
        nome: acessorioRemovido.nome,
        tipo: 'single', // Acessórios são sempre tratados como single no estoque
        quantidadeEsperada: acessorioRemovido.quantidade,
        setorOrigem: arquiteturaAtiva[setorIdx].nome,
        detalheOrigem: `(Desvinculado do kit: ${itemPai.nome})`
    });

    // 3. Atualiza a interface
    const badge = document.getElementById('badge-estorno-count');
    if (badge) badge.classList.add('badge-pulse');

    atualizarInterfaceEstorno();
    renderizarArquiteturaEditor();
    marcarAlteracao();

    console.log(`♻️ Acessório "${acessorioRemovido.nome}" desvinculado e movido para estorno.`);
}

function removerTombamentoIndividual(indexSetor, indexItem, tIndex) {
    const setorOrigem = arquiteturaAtiva[indexSetor];
    const itemOrigem = setorOrigem.itens[indexItem];

    // Remove o tombamento do array original
    const tombRemovido = itemOrigem.tombamentos.splice(tIndex, 1)[0];

    // --- CARIMBO DE ORIGEM: Fundamental para o Cancelar Estorno ---
    itensParaEstorno.push({
        uid_global: itemOrigem.uid_global,
        nome: itemOrigem.nome, // Importante para exibir na lista de estorno
        tipo: 'multi',
        tombamentos: [tombRemovido],
        setorOrigem: setorOrigem.nome // Salva o nome do setor para possível retorno
    });

    // Se o item ficou sem nenhum tombamento no setor, remove o objeto pai
    if (itemOrigem.tombamentos.length === 0) {
        arquiteturaAtiva[indexSetor].itens.splice(indexItem, 1);
    }

    marcarAlteracao();
    renderizarArquiteturaEditor();
    atualizarInterfaceEstorno();
}

// ================================================================
// 5. INTELIGÊNCIA: MESCLAGEM AUTOMÁTICA
// ================================================================
function processarMesclagemAutomatica(setorIndex) {
    const itens = arquiteturaAtiva[setorIndex].itens;
    const mapa = new Map();
    const novosItens = [];

    itens.forEach(item => {
        const chave = item.uid_global;

        if (mapa.has(chave)) {
            const existente = mapa.get(chave);

            if (item.tipo === 'single') {
                // Mesclagem de Consumo: Soma as quantidades
                existente.quantidadeEsperada = (Number(existente.quantidadeEsperada) || 0) + (Number(item.quantidadeEsperada) || 0);
            } else {
                // Mesclagem de Patrimônio: Une os arrays de tombamentos
                const tombamentosExistentes = existente.tombamentos || [];
                const novosTombamentos = item.tombamentos || [];

                // Desduplicação inteligente baseada no número do tombamento (tomb)
                novosTombamentos.forEach(novoT => {
                    const jaExiste = tombamentosExistentes.some(t => t.tomb === novoT.tomb);
                    if (!jaExiste) {
                        tombamentosExistentes.push(novoT);
                    }
                });

                existente.tombamentos = tombamentosExistentes;
                // A quantidade esperada em itens multi deve ser sempre o total de tombamentos vinculados
                existente.quantidadeEsperada = existente.tombamentos.length;
            }
        } else {
            // Se for a primeira vez que o item aparece no setor, registra no mapa
            // Fazemos um shallow copy para evitar mutações inesperadas em outros setores
            mapa.set(chave, item);
            novosItens.push(item);
        }
    });

    // Atualiza o estado global com a lista limpa e mesclada
    arquiteturaAtiva[setorIndex].itens = novosItens;

    // Renderiza a interface (onde os tombamentos aparecerão um abaixo do outro conforme configuramos)
    renderizarArquiteturaEditor();
    marcarAlteracao();
}

function marcarAlteracao() {
    const btn = document.querySelector('.btn-publish');
    if (!btn) return;

    // 1. Habilita o botão caso esteja desabilitado
    btn.disabled = false;

    // 2. Adiciona a classe de controle CSS
    btn.classList.add('modified');

    // 3. Feedback Visual Forte
    // Usamos um fundo laranja/âmbar para indicar que existem dados "pendentes" de gravação
    btn.style.backgroundColor = '#d97706';
    btn.style.color = 'white';
    btn.style.fontWeight = 'bold';

    // 4. Texto Dinâmico
    // O asterisco ajuda a indicar visualmente que o que está na tela não é o que está no banco
    btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Publicar Alterações *';

    // 5. Animação (Opcional, mas recomendado)
    // Se você tiver uma animação de "pulse" no seu CSS, pode aplicar aqui
    btn.style.animation = 'pulse-orange 2s infinite';
}
// ================================================================
// 6. BUSCA INTELIGENTE NO ESTOQUE (AUTOCOMPLETE) - ATUALIZADA PARA KITS
// ================================================================
function buscarItemParaAdicionar(termo) {
    const box = document.getElementById('sugestoes-estoque-editor');
    if (!box) return;

    const t = termo.toLowerCase().trim();
    if (t.length < 2) {
        box.style.display = 'none';
        return;
    }

    const suggestions = [];
    const minhaUnidadeId = currentUserData.unidade_id;

    console.group("🔍 DEBUG BUSCADOR SIGMA");
    console.log("1. Termo pesquisado:", t);
    console.log("2. Unidade do Gestor:", minhaUnidadeId);
    console.log("3. Itens no cache:", estoqueGestorLocal.length);

    estoqueGestorLocal.forEach(item => {
        const nomeItem = (item.nome || "").toLowerCase();
        const categoriaItem = (item.categoria || "").toLowerCase();
        const basicoMatch = nomeItem.includes(t) || categoriaItem.includes(t);

        let tombamentosNaTela = [];
        let qtdNaTela = 0;

        // Mapeia o que já está na tela para evitar duplicidade
        arquiteturaAtiva.forEach(setor => {
            (setor.itens || []).forEach(it => {
                if (it.uid_global === item.uid_global) {
                    if (item.tipo === 'multi') {
                        (it.tombamentos || []).forEach(tm => {
                            tombamentosNaTela.push(String(tm.tomb || tm));
                        });
                    } else {
                        qtdNaTela += Number(it.quantidadeEsperada || 0);
                    }
                }
            });
        });

        if (item.tipo === 'multi') {
            (item.tombamentos || []).forEach(tomb => {
                const numTomb = String(tomb.tomb);
                const numTombMatch = numTomb.toLowerCase().includes(t);

                if ((basicoMatch || numTombMatch) && tomb.local_id === minhaUnidadeId) {
                    if (!tombamentosNaTela.includes(numTomb)) {
                        const isAlocado = !!tomb.viatura_id;

                        suggestions.push({
                            ...item,
                            tombamentoExibicao: numTomb,
                            statusExtra: isAlocado ? "ALOCADO" : "DISPONÍVEL",
                            id_unico: `${item.id_almox}_${numTomb}`,
                            disponivelReal: 1 // Para consistência no label
                        });
                    }
                }
            });
        } else if (basicoMatch) {
            const saldoRestante = (Number(item.disponivel) || 0) - qtdNaTela;
            if (saldoRestante > 0) {
                suggestions.push({
                    ...item,
                    id_unico: item.id_almox,
                    disponivelReal: saldoRestante
                });
            }
        }
    });

    console.log("4. Total de sugestões encontradas:", suggestions.length);
    console.groupEnd();

    if (suggestions.length === 0) {
        box.innerHTML = `<div style="padding:15px; color:#64748b; text-align:center; font-size:0.9em;">
                            <i class="fas fa-search-minus" style="display:block; margin-bottom:5px;"></i>
                            Nenhum item reserva disponível para "${termo.toUpperCase()}"
                         </div>`;
    } else {
        // ✅ CORREÇÃO: Aplicar scroll na caixa de sugestões e aumentar limite para 50
        box.style.maxHeight = "350px";
        box.style.overflowY = "auto";
        box.style.border = "1px solid #cbd5e1";

        const matches = suggestions.slice(0, 50);

        box.innerHTML = matches.map((i) => {
            const isAlocado = i.statusExtra === "ALOCADO";
            const icon = i.is_anfitriao ? 'fa-box-open' : (i.tipo === 'multi' ? 'fa-tag' : 'fa-boxes');
            const color = isAlocado ? '#94a3b8' : (i.is_anfitriao ? '#f59e0b' : '#2c7399');
            const detail = i.tipo === 'multi' ? `TOMB: ${i.tombamentoExibicao}` : `DISP: ${i.disponivelReal} un`;

            return `
        <div class="suggestion-item" onclick='selecionarSugestaoManual(${JSON.stringify(i).replace(/"/g, "&quot;")})' 
             style="display: flex; align-items: center; padding: 12px 15px; border-bottom: 1px solid #f1f5f9; cursor: pointer; background: white;">
            
            <div style="width:32px; height:32px; background:${color}15; color:${color}; border-radius:8px; display:flex; align-items:center; justify-content:center; margin-right:12px; flex-shrink:0; position: relative !important;">
                
                <i class="fas ${icon}" style="
                    position: static !important; 
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    width: auto !important;
                    height: auto !important;
                    margin: 0 !important; 
                    padding: 0 !important;
                    font-size: 14px !important; 
                    line-height: 1 !important;
                    transform: none !important;
                    pointer-events: none !important;
                "></i>

            </div>

            <div style="flex:1; overflow:hidden;">
                <b style="font-size:0.85em; display:block; color:${isAlocado ? '#94a3b8' : '#1e293b'}; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${i.nome} ${i.is_anfitriao ? '<span style="color:#f59e0b; font-size:0.8em;">[KIT]</span>' : ''}
                </b>
                <small style="color:${isAlocado ? '#cbd5e1' : '#64748b'}; font-weight:700; font-size:0.7em;">
                    ${detail} ${isAlocado ? '• (ALOCADO)' : ''}
                </small>
            </div>
        </div>`;
        }).join('');
    }
    box.style.display = 'block';
}

// Função auxiliar para evitar erros de index
function selecionarSugestaoManual(item) {
    selecionarItemParaAdicionar(item);
    document.getElementById('sugestoes-estoque-editor').style.display = 'none';
    document.getElementById('input-busca-estoque').value = '';
}

// ================================================================
// 7. SELEÇÃO COM MICRO-MODAL - ATUALIZADA PARA KITS
// ================================================================
async function selecionarItemParaAdicionar(item) {
    if (!item) return;

    // ✅ NOVO: INTERCEPTAÇÃO DE ANFITRIÃO NO EDITOR
    if (item.is_anfitriao) {
        document.getElementById('sugestoes-estoque-editor').style.display = 'none';

        // Chamamos o modal que já existe, mas passamos um contexto de 'EDITOR'
        // para que ele não tente perguntar viatura/setor no final.
        return abrirModalAcoplamentoAnfitriao(item.uid_global, item, item.tombamentoExibicao);
    }

    itemSelecionadoTemp = item;
    const popover = document.getElementById('popover-qtd-editor');
    const inputBusca = document.getElementById('input-busca-estoque');

    document.getElementById('sugestoes-estoque-editor').style.display = 'none';

    if (item.tipo === 'single') {
        const saldoFinal = item.disponivelReal;
        popover.style.display = 'block';
        popover.style.top = (inputBusca.offsetTop + inputBusca.offsetHeight + 5) + 'px';
        popover.style.left = inputBusca.offsetLeft + 'px';

        const inputQtd = document.getElementById('input-qtd-popover');
        inputQtd.max = saldoFinal;
        inputQtd.value = 1;
        document.getElementById('info-max-popover').textContent = `Saldo livre na tela: ${saldoFinal} un.`;

        setTimeout(() => inputQtd.focus(), 50);
    } else {
        exibirDraftCard(`${item.nome} (TOMB: ${item.tombamentoExibicao})`);
        document.getElementById('select-setor-destino').focus();
    }
}

// Função de apoio para evitar passar JSON gigante no HTML
function selecionarSugestaoPorIndex(index) {
    const item = window.tempSuggestionsSearch[index];
    if (item) {
        // Esta função deve alimentar o itemSelecionadoTemp e fechar o box
        selecionarItemParaAdicionar(item);
    }
}

let itemSelecionadoTemp = null;

// 7. SELEÇÃO COM MICRO-MODAL
function selecionarItemParaAdicionar(item) {
    if (!item) return;

    itemSelecionadoTemp = item;
    const boxSugestoes = document.getElementById('sugestoes-estoque-editor');
    const popover = document.getElementById('popover-qtd-editor');
    const inputBusca = document.getElementById('input-busca-estoque');
    const selectSetor = document.getElementById('select-setor-destino');

    if (boxSugestoes) boxSugestoes.style.display = 'none';

    if (item.tipo === 'single') {
        // ✅ CAPTURA: Usamos o saldo real (já abatido) calculado na busca
        const saldoFinal = item.disponivelReal;

        popover.style.position = 'absolute';
        popover.style.top = (inputBusca.offsetTop + inputBusca.offsetHeight + 5) + 'px';
        popover.style.left = inputBusca.offsetLeft + 'px';
        popover.style.display = 'block';
        popover.style.zIndex = '1000';

        const inputQtd = document.getElementById('input-qtd-popover');
        const infoMax = document.getElementById('info-max-popover');

        // ✅ TRAVA: O máximo permitido agora é o saldo após as deduções do rascunho
        inputQtd.max = saldoFinal;
        inputQtd.value = 1;
        if (infoMax) infoMax.textContent = `Saldo livre na tela: ${saldoFinal} un.`;

        // Atribuímos ao objeto temporário para validar no confirmarQtdPopover
        itemSelecionadoTemp.disponivel = saldoFinal;

        setTimeout(() => {
            inputQtd.focus();
            inputQtd.select();
        }, 50);

    } else {
        if (popover) popover.style.display = 'none';
        exibirDraftCard(`${item.nome} (TOMB: ${item.tombamentoExibicao})`);
        if (selectSetor) selectSetor.focus();
    }
}
// Função auxiliar cirúrgica para o visual moderno
function exibirDraftCard(texto) {
    const card = document.getElementById('rascunho-item-novo'); // ID ÚNICO PARA A BUSCA
    const label = document.getElementById('texto-item-rascunho');
    const iconPlus = document.getElementById('icon-plus-busca');

    if (card && label) {
        label.innerHTML = `<i class="fas fa-check-circle" style="color:#10b981"></i> ${texto}`;
        card.style.display = 'flex';
        if (iconPlus) iconPlus.style.visibility = 'hidden';
    }
}
function confirmarQtdPopover() {
    const input = document.getElementById('input-qtd-popover');
    const qtd = parseInt(input.value);

    // ✅ SEGURANÇA: Captura o saldo real projetado (já abatido os itens da tela)
    // Se por algum motivo 'disponivelReal' não existir, usamos o 'disponivel' padrão.
    const saldoLimite = itemSelecionadoTemp.disponivelReal !== undefined ?
        itemSelecionadoTemp.disponivelReal :
        itemSelecionadoTemp.disponivel;

    if (isNaN(qtd) || qtd <= 0) {
        alert("Informe uma quantidade válida.");
        return;
    }

    // ✅ VALIDAÇÃO CIRÚRGICA: Impede que o usuário digite um valor maior do que 
    // o que sobrou no estoque físico após as alocações já feitas no editor.
    if (qtd > saldoLimite) {
        alert(`Quantidade indisponível para esta lista.\n\nSaldo Total: ${itemSelecionadoTemp.disponivel}\nJá alocado em outros setores: ${itemSelecionadoTemp.disponivel - saldoLimite}\nRestante disponível: ${saldoLimite}`);
        input.value = saldoLimite;
        input.focus();
        input.select();
        return;
    }

    // 3. Atribui a quantidade ao objeto temporário
    itemSelecionadoTemp.quantidadeEscolhida = qtd;

    // 4. Fecha o popover
    document.getElementById('popover-qtd-editor').style.display = 'none';

    // 5. Ativa o Card de Rascunho com o feedback visual
    exibirDraftCard(`${qtd}un. x ${itemSelecionadoTemp.nome}`);

    // 6. Foca no seletor de setor
    const selectSetor = document.getElementById('select-setor-destino');
    if (selectSetor) {
        selectSetor.focus();
        selectSetor.style.border = "2px solid #2c7399";
    }
}

// ================================================================
// 7. ADIÇÃO DO ITEM AO SETOR ESCOLHIDO
// ================================================================
function adicionarItemRapido() {
    const selectSetor = document.getElementById('select-setor-destino');
    const setorIdx = selectSetor.value;
    const inputBusca = document.getElementById('input-busca-estoque');

    // 1. Validação básica: se não houver item no rascunho ou setor selecionado, para.
    if (!itemSelecionadoTemp || setorIdx === "") return;

    // ✅ VERIFICAÇÃO DE KIT: Se for anfitrião e ainda não passou pelo modal de montagem...
    if (itemSelecionadoTemp.is_anfitriao && !itemSelecionadoTemp.acessorios_ja_montados) {

        // Abrimos o modal passando o setorIdx para que ele saiba onde inserir ao terminar
        abrirModalAcoplamentoAnfitriao(
            itemSelecionadoTemp.uid_global || itemSelecionadoTemp.id_almox,
            itemSelecionadoTemp,
            itemSelecionadoTemp.tombamentoExibicao,
            setorIdx // Passamos o destino para o modal concluir a ação
        );

        // Interrompemos esta execução aqui. O modal cuidará de chamar a inserção final.
        return;
    }

    // ✅ FLUXO DE EXECUÇÃO: Chamada da função centralizada para gravar os dados
    // Isso substitui toda a lógica repetida e mantém o código limpo.
    executarInsercaoNoSetor(setorIdx);
}

/**
 * Cancela a seleção atual e reseta a interface de busca.
 */
function cancelarRascunho() {
    itemSelecionadoTemp = null;
    const card = document.getElementById('rascunho-item-novo');
    const iconPlus = document.getElementById('icon-plus-busca');
    const inputBusca = document.getElementById('input-busca-estoque');
    const selectSetor = document.getElementById('select-setor-destino'); // Referência ao select

    if (card) card.style.display = 'none';
    if (iconPlus) iconPlus.style.visibility = 'visible';

    if (inputBusca) {
        inputBusca.value = '';
        inputBusca.style.backgroundColor = "#fff"; // Garante limpeza de cores residuais
    }

    if (selectSetor) {
        selectSetor.value = ""; // Reseta o seletor para "Selecione o Setor..."
        selectSetor.style.border = "1px solid #cbd5e1"; // Remove destaques de foco
    }
}
// ================================================================
// 8. UTILITÁRIOS: ATUALIZAR SELECT E NOVO SETOR
// ================================================================
function atualizarSelectSetores() {
    const select = document.getElementById('select-setor-destino');
    select.innerHTML = '<option value="">Selecione o Setor...</option>' +
        arquiteturaAtiva.map((s, idx) => `<option value="${idx}">${s.nome}</option>`).join('');
}

// 1. Abre o modal e carrega a "inteligência" de nomes
async function abrirModalNovoSetor() {
    const modal = document.getElementById('modal-novo-setor-arquitetura');
    const input = document.getElementById('input-nome-setor-modal');
    const containerTags = document.getElementById('setores-tags-container');

    input.value = '';
    modal.style.display = 'flex';
    input.focus();

    // Inteligência: Busca todos os nomes de setores já usados no sistema
    try {
        containerTags.innerHTML = '<small>Buscando padrões...</small>';
        const snap = await db.collection('listas_conferencia').get();
        const nomesSetores = new Set();

        // Nomes padrão de segurança
        ['CABINE', 'CARROCERIA', 'TETO', 'MOTOR'].forEach(n => nomesSetores.add(n));

        snap.forEach(doc => {
            const lista = doc.data().list || [];
            lista.forEach(s => nomesSetores.add(s.nome.toUpperCase()));
        });

        // Transforma o Set em Tags clicáveis (limitado a 10 sugestões mais comuns)
        const listaFinal = Array.from(nomesSetores).sort();
        containerTags.innerHTML = listaFinal.map(nome => `
            <span class="tag-sugestao-setor" onclick="selecionarTagSetor('${nome}')">${nome}</span>
        `).join('');

    } catch (e) {
        containerTags.innerHTML = '<small>Não foi possível carregar sugestões.</small>';
    }
}

// 2. Auxiliar para preencher o input via clique na tag
function selecionarTagSetor(nome) {
    document.getElementById('input-nome-setor-modal').value = nome;
    confirmarNovoSetor(); // Já confirma para agilizar
}

// 3. Valida e cria o setor no rascunho
function confirmarNovoSetor() {
    const nome = document.getElementById('input-nome-setor-modal').value.trim().toUpperCase();

    if (!nome) return alert("Digite um nome para o setor.");

    // Trava de duplicidade: Evita dois setores com mesmo nome na mesma VTR
    const existe = arquiteturaAtiva.some(s => s.nome === nome);
    if (existe) return alert("Este setor já existe nesta viatura.");

    arquiteturaAtiva.push({
        id: "setor_" + Date.now(),
        nome: nome,
        itens: []
    });

    renderizarArquiteturaEditor();
    atualizarSelectSetores();
    marcarAlteracao();
    fecharModalNovoSetor();
}

function fecharModalNovoSetor() {
    document.getElementById('modal-novo-setor-arquitetura').style.display = 'none';
}
function removerSetorArquitetura(idx) {
    const setor = arquiteturaAtiva[idx];

    if (setor.itens && setor.itens.length > 0) {
        if (!confirm(`O setor "${setor.nome}" contém ${setor.itens.length} tipo(s) de item(ns). Ao excluí-lo, todos os itens retornarão para o estoque. Confirmar?`)) {
            return;
        }

        // --- SEGURANÇA: MOVE TODOS OS ITENS COM CARIMBO DE ORIGEM ---
        setor.itens.forEach(item => {
            const baseItem = {
                uid_global: item.uid_global,
                nome: item.nome,
                tipo: item.tipo,
                setorOrigem: setor.nome // Permite desfazer mesmo se o setor sumir (vai para o 1º disponível)
            };

            if (item.tipo === 'multi') {
                itensParaEstorno.push({
                    ...baseItem,
                    tombamentos: [...(item.tombamentos || [])]
                });
            } else {
                itensParaEstorno.push({
                    ...baseItem,
                    quantidadeEsperada: item.quantidadeEsperada
                });
            }
        });
    }

    // Remove o setor do rascunho
    arquiteturaAtiva.splice(idx, 1);

    // Atualiza a interface completa
    renderizarArquiteturaEditor();
    if (typeof atualizarSelectSetores === 'function') atualizarSelectSetores();
    if (typeof atualizarInterfaceEstorno === 'function') atualizarInterfaceEstorno();

    marcarAlteracao();
}
document.addEventListener('DOMContentLoaded', function () {
    const card = document.getElementById('container-item-rascunho');
    if (card) {
        card.style.display = 'none';
    }
});
// ================================================================
// 9. GESTÃO DA CAIXA DE SAÍDA (ESTORNOS)
// ================================================================
function marcarParaEstorno(setorIdx, itemIdx) {
    const itemAlvo = arquiteturaAtiva[setorIdx].itens[itemIdx];

    // LÓGICA CIRÚRGICA: Se for modo Vistoria (Checklist), remove direto sem ir para a caixa de saída
    if (window.isModoVistoria) {
        Swal.fire({
            title: 'Remover Item?',
            text: `Deseja remover "${itemAlvo.nome}" da vistoria?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#2c3e50', // Azul Petróleo
            confirmButtonText: 'Sim, remover',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                arquiteturaAtiva[setorIdx].itens.splice(itemIdx, 1);
                renderizarArquiteturaEditor();
                marcarAlteracao();
            }
        });
        return;
    }

    // LÓGICA ORIGINAL: Para Materiais, move para a caixa de saída (estorno)
    const itemRemovido = arquiteturaAtiva[setorIdx].itens.splice(itemIdx, 1)[0];

    itensParaEstorno.push({
        ...itemRemovido,
        setorOrigem: arquiteturaAtiva[setorIdx].nome
    });

    const badge = document.getElementById('badge-estorno-count');
    if (badge) {
        badge.classList.add('badge-pulse');
        setTimeout(() => badge.classList.remove('badge-pulse'), 300);
    }

    atualizarInterfaceEstorno();
    renderizarArquiteturaEditor();
    marcarAlteracao();
    console.log(`Item ${itemRemovido.nome} movido para caixa de saída.`);
}

function atualizarInterfaceEstorno() {
    const dock = document.getElementById('caixa-estorno-dock');
    if (!dock) return;

    // ✅ O VIGILANTE: Se for modo Checklist, garante invisibilidade absoluta
    if (window.isModoVistoria === true) {
        dock.style.setProperty('display', 'none', 'important');

        // Bloqueia futuras tentativas de outras funções de mostrarem a caixa
        if (!dock.dataset.vigilanteAtivo) {
            const observer = new MutationObserver(() => {
                if (window.isModoVistoria && dock.style.display !== 'none') {
                    dock.style.setProperty('display', 'none', 'important');
                }
            });
            observer.observe(dock, { attributes: true, attributeFilter: ['style'] });
            dock.dataset.vigilanteAtivo = "true";
        }
        return;
    }
    dock.dataset.vigilanteAtivo = "";

    const container = document.getElementById('lista-itens-estorno');
    const badge = document.getElementById('badge-estorno-count');

    if (!container || !badge) return;

    // Lógica para materiais (onde a caixa deve aparecer se houver itens)
    if (itensParaEstorno.length === 0) {
        dock.style.display = 'none';
        badge.textContent = "0";
        return;
    } else {
        dock.style.display = 'block';
    }

    badge.textContent = itensParaEstorno.length;

    container.innerHTML = itensParaEstorno.map((item, idx) => {
        const ehMulti = item.tipo === 'multi';
        let detalhe = ehMulti && item.tombamentos ? item.tombamentos.map(t => t.tomb).join(', ') : item.quantidadeEsperada + ' unidades';

        return `
            <div class="item-estorno-linha" style="display: flex; align-items: center; justify-content: space-between; padding: 10px; border-bottom: 1px solid #f1f5f9; background: #fffaf0; margin-bottom: 5px; border-radius: 6px;">
                <div style="flex:1; padding-right: 10px;">
                    <b style="font-size:0.85em; display:block; color:#334155; text-transform: uppercase;">${item.nome || 'Material'}</b>
                    <small style="color:#e65100; font-weight:700; font-size: 0.75em; display: block; line-height: 1.2;">
                        ${ehMulti ? '<i class="fas fa-tag"></i> TOMB: ' + detalhe : '<i class="fas fa-boxes"></i> QTD: ' + detalhe}
                    </small>
                </div>
                <button onclick="cancelarEstorno(${idx})" class="btn-remove-item-vtr" style="background: #f1f5f9!important; color: #64748b!important; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">
                    <i class="fas fa-undo" style="font-size:0.8em;"></i>
                </button>
            </div>`;
    }).reverse().join('');
}
function toggleEstornoDock() {
    const dock = document.getElementById('caixa-estorno-dock');
    if (!dock) {
        console.error("❌ Erro: Elemento 'caixa-estorno-dock' não encontrado no HTML.");
        return;
    }

    const icon = dock.querySelector('.toggle-icon');

    // Inverte a classe de expansão
    dock.classList.toggle('expanded');

    // Sincroniza o ícone (seta para cima/baixo)
    if (icon) {
        if (dock.classList.contains('expanded')) {
            icon.classList.replace('fa-chevron-up', 'fa-chevron-down');
        } else {
            icon.classList.replace('fa-chevron-down', 'fa-chevron-up');
        }
    }
}

function cancelarEstorno(idx) {
    // 1. Remove da lista de estorno (Caixa de Saída)
    const item = itensParaEstorno.splice(idx, 1)[0];
    if (!item) return;

    // 2. Localiza o setor de destino
    // Tenta pelo nome original ou cai no primeiro setor disponível
    let setorDestino = arquiteturaAtiva.find(s => s.nome === item.setorOrigem) || arquiteturaAtiva[0];

    if (setorDestino) {
        // 3. Devolve o item para a memória da arquitetura
        if (!setorDestino.itens) setorDestino.itens = [];
        setorDestino.itens.push(item);

        // 4. ESSENCIAL: Mesclagem automática
        // Evita que o item apareça duplicado se já existir um do mesmo tipo no setor
        const sIdx = arquiteturaAtiva.indexOf(setorDestino);
        processarMesclagemAutomatica(sIdx);

        console.log(`✅ Item "${item.nome}" restaurado no setor "${setorDestino.nome}".`);
    } else {
        alert("Não há setores disponíveis para restaurar o item.");
        itensParaEstorno.splice(idx, 0, item); // Devolve para a caixa de saída em caso de erro
        return;
    }

    // 5. Sincronização Total da UI
    atualizarInterfaceEstorno();
    renderizarArquiteturaEditor();
    marcarAlteracao();
}

// ================================================================
// 10. PUBLICAÇÃO FINAL (GRAVAÇÃO NO FIREBASE)
// ================================================================
async function confirmarPublicacaoLista() {
    if (!confirm("Deseja publicar as alterações? Isso atualizará a lista e ajustará o saldo do estoque global.")) return;

    const firestore = firebase.firestore();
    const elNome = document.getElementById('edit-vtr-nome');
    const nomeAmigavelVtr = elNome ? (elNome.innerText || elNome.textContent).split('\n').pop().trim() : "Viatura";
    const justificativa = document.getElementById('justificativa-estorno-global').value.trim();
    const unidadeGestoraId = currentUserData.unidade_id;

    const estornosReais = itensParaEstorno.filter(i => i.uid_global !== "ITEM_VISTORIA_LIVRE");

    if (estornosReais.length > 0 && !justificativa) {
        alert("Para devolver materiais ao estoque, preencha a justificativa.");
        document.getElementById('justificativa-estorno-global').focus();
        return;
    }

    const btn = document.querySelector('.btn-publish');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Publicando...';

    try {
        const batch = firestore.batch();
        const listaRef = firestore.collection(window.colecaoAtivaNoEditor).doc(idListaSendoEditada);
        const snapLista = await listaRef.get();
        const listaAnterior = snapLista.exists ? (snapLista.data().list || []) : [];

        // --- 1. MAPEAMENTO HIERÁRQUICO (DNA DO KIT) ---
        const mapearSaldos = (arquitetura) => {
            const mapa = {};
            arquitetura.forEach(setor => {
                (setor.itens || []).forEach(it => {
                    if (it.uid_global === "ITEM_VISTORIA_LIVRE") return;
                    mapa[it.uid_global] = (mapa[it.uid_global] || 0) + (Number(it.quantidadeEsperada) || 0);
                    
                    if (it.acessorios_acoplados) {
                        it.acessorios_acoplados.forEach(ac => {
                            mapa[ac.uid_global] = (mapa[ac.uid_global] || 0) + (Number(ac.quantidade) || 0);
                        });
                    }
                });
            });
            return mapa;
        };

        const mapaAnterior = mapearSaldos(listaAnterior);
        const mapaAtual = mapearSaldos(arquiteturaAtiva);

        // --- 2. ATUALIZAÇÃO DA ESTRUTURA DA LISTA ---
        batch.update(listaRef, {
            list: arquiteturaAtiva,
            ultima_edicao_arquitetura: firebase.firestore.FieldValue.serverTimestamp(),
            editado_por: currentUserData.nome_militar_completo
        });

        const dataReg = new Date().toLocaleString('pt-BR');

        // --- 3. LOGÍSTICA DE INVENTÁRIO (ITENS SINGLE / ACESSÓRIOS) ---
        const todosUids = new Set([...Object.keys(mapaAnterior), ...Object.keys(mapaAtual)]);

        for (const uid of todosUids) {
            const qtdAnt = mapaAnterior[uid] || 0;
            const qtdAtu = mapaAtual[uid] || 0;
            const diferenca = qtdAtu - qtdAnt;

            if (diferenca !== 0) {
                const saldoRef = firestore.collection('inventario').doc(uid).collection('saldos_unidades').doc(unidadeGestoraId);
                
                // ✅ CORREÇÃO: Usamos SET com MERGE para evitar o erro "No document to update"
                batch.set(saldoRef, {
                    unidade_sigla: currentUserData.unidade || "N/D", // Garante a sigla se o doc for criado agora
                    qtd_disp: firebase.firestore.FieldValue.increment(-diferenca),
                    qtd_em_carga: firebase.firestore.FieldValue.increment(diferenca),
                    last_update: dataReg
                }, { merge: true });

                const histRef = saldoRef.collection('historico_vida').doc();
                batch.set(histRef, {
                    data: dataReg,
                    evento: "AJUSTE_VIA_EDITOR",
                    detalhes: `${diferenca > 0 ? 'Saída' : 'Retorno'} de ${Math.abs(diferenca)} un. via Editor (${nomeAmigavelVtr}).`,
                    quem: currentUserData.nome_militar_completo
                });
            }
        }

        // --- 4. PROCESSA ITENS MULTI (TOMBAMENTOS) ---
        arquiteturaAtiva.forEach(setor => {
            (setor.itens || []).forEach(item => {
                if (item.tipo === 'multi' && item.uid_global !== "ITEM_VISTORIA_LIVRE") {
                    (item.tombamentos || []).forEach(t => {
                        const tombRef = firestore.collection('inventario').doc(item.uid_global).collection('tombamentos').doc(t.tomb);
                        batch.update(tombRef, {
                            situacao_atual: "EM CARGA",
                            viatura_id: idListaSendoEditada,
                            sub_local: setor.nome,
                            acessorios_vinculados: item.acessorios_acoplados || []
                        });
                    });
                }
            });
        });

        // --- 5. PROCESSA ESTORNOS MANUAIS (INCLUINDO ACESSÓRIOS DE KITS DESFEITOS) ---
        for (const item of estornosReais) {
            // A. Trata o item principal se for MULTI
            if (item.tipo === 'multi' && item.tombamentos) {
                const invRef = firestore.collection('inventario').doc(item.uid_global);
                item.tombamentos.forEach(t => {
                    const tombRef = invRef.collection('tombamentos').doc(t.tomb);
                    batch.update(tombRef, {
                        situacao_atual: "DISPONÍVEL",
                        viatura_id: null,
                        sub_local: "ALMOXARIFADO",
                        acessorios_vinculados: [] 
                    });

                    const histLogRef = tombRef.collection('historico_vida').doc();
                    batch.set(histLogRef, {
                        data: dataReg,
                        evento: "ESTORNO_EDITOR",
                        quem: currentUserData.nome_militar_completo,
                        detalhes: `Material removido da lista ${nomeAmigavelVtr}. Motivo: ${justificativa}`
                    });
                });
            }

            // ✅ CORREÇÃO CIRÚRGICA: Se o item estornado for um KIT, limpa também os acessórios filhos dele
            if (item.acessorios_acoplados && item.acessorios_acoplados.length > 0) {
                item.acessorios_acoplados.forEach(ac => {
                    // O saldo numérico do acessório já foi devolvido no Passo 3. 
                    // Aqui você pode adicionar um log específico no histórico do acessório se desejar rastreio individual.
                });
            }
        }

        await batch.commit();

        itensParaEstorno = [];
        await Swal.fire({ icon: 'success', title: 'Publicado!', text: 'O inventário e os kits foram atualizados com sucesso.', timer: 2000, showConfirmButton: false });
        location.reload();

    } catch (e) {
        console.error("Erro na publicação:", e);
        Swal.fire('Erro de Sincronismo', 'Falha ao atualizar inventário: ' + e.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Tentar Novamente';
    }
}

// Fecha as caixas de busca e popover ao clicar fora delas
document.addEventListener('keydown', function (event) {
    // 1. Tratamento da tecla ESC
    if (event.key === 'Escape') {
        fecharBuscaELimpar();
    }
});

document.addEventListener('mousedown', function (event) {
    const buscaBox = document.getElementById('sugestoes-estoque-editor');
    const inputBusca = document.getElementById('input-busca-estoque');
    const popoverQtd = document.getElementById('popover-qtd-editor');

    // 2. Se a caixa de sugestões estiver aberta e o clique for fora dela e do input
    if (buscaBox && !buscaBox.contains(event.target) && event.target !== inputBusca) {
        if (buscaBox.style.display === 'block') {
            fecharBuscaELimpar();
        }
    }

    // 3. Se o popover de quantidade estiver aberto e o clique for fora dele
    if (popoverQtd && !popoverQtd.contains(event.target) && event.target !== inputBusca) {
        if (popoverQtd.style.display === 'block') {
            popoverQtd.style.display = 'none';
            itemSelecionadoTemp = null;
            if (inputBusca) inputBusca.value = ''; // Limpa ao cancelar a quantidade também
        }
    }
});

/**
 * Função auxiliar para evitar repetição de código
 */
function fecharBuscaELimpar() {
    const buscaBox = document.getElementById('sugestoes-estoque-editor');
    const inputBusca = document.getElementById('input-busca-estoque');

    if (buscaBox) buscaBox.style.display = 'none';
    if (inputBusca) {
        inputBusca.value = '';
        inputBusca.blur(); // Remove o cursor do campo
    }
}
// INSIRA ESTE BLOCO PARA DAR VIDA AO SELECT
document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'select-setor-destino') {
        const setorIdx = e.target.value;

        // Se existe um item "carimbado" aguardando destino e um setor válido foi escolhido
        if (itemSelecionadoTemp && setorIdx !== "") {

            // Se for multi, já adiciona direto. 
            // Se for single, verifica se a quantidade já foi escolhida no popover
            if (itemSelecionadoTemp.tipo === 'multi' || (itemSelecionadoTemp.tipo === 'single' && itemSelecionadoTemp.quantidadeEscolhida > 0)) {
                adicionarItemRapido();
            }
        }
    }
});

async function atualizarIdentidadeSidebar() {
    if (!currentUserData) return;

    const elNome = document.getElementById('user-name-top');
    const elRole = document.getElementById('user-role-top'); // Campo abaixo do nome
    const elUnidade = document.getElementById('user-unit-top');
    const elAcesso = document.getElementById('user-access-top');
    const avatarWrapper = document.querySelector('.user-avatar-wrapper');

    const nomeExibicao = currentUserData.nome_guerra || "MILITAR";
    const siglaUnidade = currentUserData.unidade || "SIGMA";
    const roleUsuario = currentUserData.role || "operacional";

    // Mapeamento amigável dos níveis de acesso
    const roleMap = {
        'admin': 'Administrador Geral',
        'gestor_geral': 'Gestor Geral',
        'gestor': 'Gestor de Unidade',
        'operacional': 'Operacional'
    };

    if (elNome) elNome.innerText = nomeExibicao;

    // ✅ MUDANÇA CIRÚRGICA: Agora exibe o Nível de Acesso no Header, não mais a patente
    if (elRole) elRole.innerText = roleMap[roleUsuario] || roleUsuario.toUpperCase();

    if (elUnidade) elUnidade.innerText = siglaUnidade;
    if (elAcesso) elAcesso.innerText = roleMap[roleUsuario] || roleUsuario.toUpperCase();

    // Lógica do Avatar (Foto ou Iniciais)
    if (avatarWrapper) {
        if (currentUserData.foto_url && currentUserData.foto_url !== "") {
            avatarWrapper.innerHTML = `
                <img src="${currentUserData.foto_url}" id="user-avatar-top" class="user-avatar-img">
                <i class="fas fa-chevron-down" style="font-size: 0.6rem; color: rgba(255,255,255,0.7);"></i>
            `;
        } else {
            const iniciais = nomeExibicao.substring(0, 2).toUpperCase();
            avatarWrapper.innerHTML = `
                <div class="user-avatar-img" style="background: #800020; color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.8rem; border: 2px solid rgba(255,255,255,0.2);">
                    ${iniciais}
                </div>
                <i class="fas fa-chevron-down" style="font-size: 0.6rem; color: rgba(255,255,255,0.7);"></i>
            `;
        }
    }
}

async function prepararChecklistVtr() {
    // ✅ TRAVA 1: Verifica se o Firebase já carregou o usuário
    const user = firebase.auth().currentUser;
    if (!user) {
        Swal.fire('Aguarde', 'Sincronizando credenciais...', 'info');
        return;
    }

    if (window.innerWidth <= 768) toggleFabMenu();
    dadosChecklistTemp.vtr = null;

    // ✅ TRAVA 2: Usa o user.uid do Firebase caso o currentUserData falhe
    const myUid = user.uid;
    const recentes = JSON.parse(localStorage.getItem(`sigma_vtr_recentes_${myUid}`)) || [];

    let htmlRecentes = recentes.map(v => `
        <span class="badge-vtr-recente" onclick="recuperarDadosVtrESelecionar('${v.id}')">
            ${v.prefixo}
        </span>`).join('');

    Swal.fire({
        title: '<i class="fas fa-clipboard-check"></i> Checklist de Viatura',
        backdrop: `rgba(0,0,0,0.6)`,
        target: 'body',
        allowOutsideClick: false,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Sair',
        html: `
            <div id="checklist-stepper" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding: 0 40px; position: relative;">
                <div style="position: absolute; top: 15px; left: 60px; right: 60px; height: 2px; background: #ddd; z-index: 1;"></div>
                <div id="step-1-icon" style="z-index: 2; text-align: center;">
                    <div class="step-dot" style="width: 30px; height: 30px; border-radius: 50%; background: #800020; color: white; line-height: 30px; margin: 0 auto; border: 3px solid #fff; box-shadow: 0 0 8px rgba(128,0,32,0.4);">1</div>
                    <small style="color: #800020; font-weight: bold; display: block; margin-top: 5px;">Viatura</small>
                </div>
                <div id="step-2-icon" style="z-index: 2; text-align: center;">
                    <div class="step-dot" style="width: 30px; height: 30px; border-radius: 50%; background: #ccc; color: white; line-height: 30px; margin: 0 auto; border: 3px solid #fff;">2</div>
                    <small style="color: #999; font-weight: bold; display: block; margin-top: 5px;">Dados</small>
                </div>
            </div>

            <div id="checklist-step-container" style="overflow: hidden; position: relative; min-height: 300px;">
                
                <div id="step-1-content" style="transition: all 0.4s ease; width: 100%;">
                    <div id="area-busca-vtr" style="text-align: left;">
                        <label style="font-size: 0.85em; font-weight:bold; color:#800020;">LOCALIZAR PREFIXO OU PLACA:</label>
                        <input type="text" id="input-busca-vtr-global" class="swal2-input" placeholder="Digite..." style="text-transform: uppercase; width: 100%; margin: 10px 0;">
                        <div id="container-recentes" style="margin-top: 10px; ${recentes.length ? '' : 'display:none;'}">
                            <small style="color: #999; display: block; margin-bottom: 5px;">Acesso Rápido:</small>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">${htmlRecentes}</div>
                        </div>
                        <div id="resultados-busca-vtr" style="margin-top: 15px; max-height: 180px; overflow-y: auto;"></div>
                    </div>

                    <div id="resumo-selecao-vtr" style="display:none;"></div>

                    <button id="btn-proximo-step" class="btn-iniciar-check-modal" style="display:none;" onclick="avancarParaEtapa2()">
                        PRÓXIMO <i class="fas fa-arrow-right"></i>
                    </button>
                </div>

                <div id="step-2-content" style="display:none; transition: all 0.4s ease; width: 100%; text-align: left;">
                    <div style="background: #f8fafc; padding: 15px; border-radius: 10px; border: 1px solid #e2e8f0;">
                        <div class="form-group" style="margin-bottom: 15px;">
                            <label style="font-weight: bold; color: #800020; font-size: 0.85em;">QUILOMETRAGEM ATUAL (KM):</label>
                            <input type="text" id="vtr-km-check" class="swal2-input" style="width: 100%; margin: 5px 0; font-weight: bold; text-align: center;" inputmode="numeric">
                        </div>
                        <div class="form-group">
                            <label style="font-weight: bold; color: #800020; font-size: 0.85em;">NÍVEL DE COMBUSTÍVEL:</label>
                            <select id="vtr-combustivel-check" class="swal2-select" style="width: 100%; margin: 5px 0; font-weight: bold;">
    							<option value="reserva">⛽  ⚠️  RESERVA</option>
    							<option value="1/4">⛽  ▂      1/4 (UM QUARTO)</option>
    							<option value="1/2" selected>⛽  ▄      1/2 (MEIO TANQUE)</option>
    							<option value="3/4">⛽  ▆      3/4 (TRÊS QUARTOS)</option>
    							<option value="cheio">⛽  █      FULL (TANQUE CHEIO)</option>
							</select>
                        </div>
                    </div>
                    <button class="btn-iniciar-check-modal" style="margin-top: 20px;" onclick="finalizarPreCheckEIrProApp()">
                        INICIAR INSPEÇÃO
                    </button>
                    <button style="background:none; border:none; color:#64748b; cursor:pointer; width:100%; margin-top:10px; font-size:0.8em; text-decoration:underline;" onclick="voltarParaEtapa1()">
                        <i class="fas fa-arrow-left"></i> Voltar para seleção
                    </button>
                </div>
            </div>
        `,
        didOpen: () => {
            const inputBusca = document.getElementById('input-busca-vtr-global');
            inputBusca.focus();
            inputBusca.addEventListener('input', (e) => filtrarVtrsGlobais(e.target.value));
        }
    });
}
function avancarParaEtapa2() {
    const step1 = document.getElementById('step-1-content');
    const step2 = document.getElementById('step-2-content');

    // Transição de Slide
    step1.style.transform = "translateX(-110%)";
    setTimeout(() => {
        step1.style.display = "none";
        step2.style.display = "block";
        step2.style.transform = "translateX(110%)";
        step2.offsetHeight;
        step2.style.transform = "translateX(0)";

        // 1. Sugere o KM e configura a Máscara
        const kmInput = document.getElementById('vtr-km-check');
        const kmAnterior = dadosChecklistTemp.vtr.km_atual || 0;

        if (kmInput) {
            // Exibe o KM anterior formatado como sugestão inicial
            kmInput.value = kmAnterior.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

            // Aplica a máscara enquanto digita
            kmInput.addEventListener('input', function (e) {
                // Remove tudo que não é número
                let v = e.target.value.replace(/\D/g, '');
                if (v.length > 1) v = parseInt(v).toString();
                v = v.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                // Formata com pontos de milhar
                e.target.value = v;
            });
        }
    }, 200);

    // Atualiza Stepper (Cores)
    const dot1 = document.querySelector('#step-1-icon .step-dot');
    const dot2 = document.querySelector('#step-2-icon .step-dot');
    dot1.style.background = "#1b8a3e";
    dot1.innerHTML = '<i class="fas fa-check" style="font-size:10px;"></i>';
    dot2.style.background = "#800020";
    document.querySelector('#step-2-icon small').style.color = "#800020";
}

function voltarParaEtapa1() {
    const step1 = document.getElementById('step-1-content');
    const step2 = document.getElementById('step-2-content');

    step2.style.transform = "translateX(110%)";
    setTimeout(() => {
        step2.style.display = "none";
        step1.style.display = "block";
        step1.style.transform = "translateX(-110%)";
        step1.offsetHeight;
        step1.style.transform = "translateX(0)";
    }, 200);

    // Reseta Stepper
    const dot1 = document.querySelector('#step-1-icon .step-dot');
    const dot2 = document.querySelector('#step-2-icon .step-dot');
    dot1.style.background = "#800020";
    dot1.innerHTML = '1';
    dot2.style.background = "#ccc";
    dot2.style.boxShadow = "none";
    document.querySelector('#step-2-icon small').style.color = "#999";
}

async function recuperarDadosVtrESelecionar(vtrId) {
    try {
        const doc = await db.collection('viaturas').doc(vtrId).get();
        if (doc.exists) {
            const v = doc.data();
            selecionarVtrVisual(doc.id, v.prefixo, v.placa, v.unidade_atual_nome, v.ultima_conferencia);
        }
    } catch (e) { console.error("Erro ao recuperar recente:", e); }
}
function resetarBuscaVtr() {
    dadosChecklistTemp.vtr = null;
    document.getElementById('area-busca-vtr').style.display = 'block';
    document.getElementById('resumo-selecao-vtr').style.display = 'none';
    document.getElementById('btn-proximo-step').style.display = 'none'; // Some com o botão
    setTimeout(() => document.getElementById('input-busca-vtr-global').focus(), 100);
}

function selecionarVtrVisual(id, prefixo, placa, unidade, ultimaConf) {
    // 1. Guarda os dados no objeto global temporário
    dadosChecklistTemp.vtr = { id, prefixo, placa, unidade, km_atual: 0 };

    // Busca o KM atual se disponível no cache de busca ou objeto
    // (Ajuste: tentamos pegar de onde o Firestore retornou)
    const containerBusca = document.getElementById('area-busca-vtr');
    const containerResumo = document.getElementById('resumo-selecao-vtr');
    const btnProximo = document.getElementById('btn-proximo-step');

    // 2. Limpeza Visual: Esconde o buscador e os recentes
    if (containerBusca) containerBusca.style.display = 'none';
    document.getElementById('input-busca-vtr-global').value = '';

    // 3. Monta o Card de Resumo (O militar confirma o que escolheu)
    let infoUltima = "Nenhuma checagem registrada";
    if (ultimaConf && ultimaConf.data) {
        const dataFmt = new Date(ultimaConf.data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
        infoUltima = `Último check: ${dataFmt} por ${ultimaConf.usuario_nome || 'Sistema'}`;
    }

    containerResumo.innerHTML = `
        <div class="vtr-selected-summary" style="border-color: #1b8a3e;">
            <i class="fas fa-check-circle" style="color:#1b8a3e; font-size:1.2em; margin-bottom:10px;"></i>
            <p>Viatura Selecionada</p>
            <h2>${prefixo}</h2>
            <div style="margin-top:5px; color:#475569; font-size:0.85em; font-weight:bold;">
                ${placa} | ${unidade || 'PÁTIO'}
            </div>
            <div class="last-check-info">
                <i class="fas fa-history"></i> ${infoUltima}
            </div>
        </div>
        
        <button style="background:none; border:none; color:#2c7399; cursor:pointer; width:100%; margin-top:10px; font-size:0.8em; text-decoration:underline;" onclick="resetarBuscaVtr()">
            Trocar viatura selecionada
        </button>
    `;
    containerResumo.style.display = 'block';

    // 4. MOSTRA O BOTÃO PRÓXIMO
    if (btnProximo) {
        btnProximo.style.setProperty('display', 'block', 'important');
        btnProximo.innerHTML = `PRÓXIMO <i class="fas fa-arrow-right"></i>`;
    }
}

// 2. FUNÇÃO QUE VALIDA E LANÇA O APP DE CONFERÊNCIA
function finalizarPreCheckEIrProApp() {
    // ✅ SEGURANÇA: Captura o usuário do Firebase e os dados globais de forma protegida
    const userAuth = firebase.auth().currentUser;
    const userData = window.currentUserData || {};

    // ✅ TRAVA DE SEGURANÇA: Se não houver usuário, impede o erro 'reading uid of null'
    if (!userAuth) {
        Swal.showValidationMessage("Erro: Sessão não identificada. Tente novamente.");
        return;
    }

    const kmInput = document.getElementById('vtr-km-check');
    const kmDigitado = parseInt(kmInput.value.replace(/\D/g, '')) || 0;
    const kmAnterior = (dadosChecklistTemp.vtr && dadosChecklistTemp.vtr.km_atual) ? dadosChecklistTemp.vtr.km_atual : 0;
    const combustivel = document.getElementById('vtr-combustivel-check').value;

    if (kmDigitado === 0) {
        Swal.showValidationMessage("Por favor, informe a quilometragem atual.");
        if (kmInput) kmInput.style.borderColor = "red";
        return;
    }

    if (kmDigitado < kmAnterior) {
        const kmAnteriorFmt = kmAnterior.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        Swal.showValidationMessage(`Erro: O KM não pode ser menor que o atual (${kmAnteriorFmt} km)`);
        if (kmInput) kmInput.style.borderColor = "red";
        return;
    }

    // ✅ SEGURANÇA: Garante que userData existe antes de tentar ler as propriedades
    const militarLogado = window.currentUserData || window.userData || {};

    // ✅ CAPTURA DE DADOS DA VTR E MILITAR (Seu bloco corrigido)
    const { id, prefixo } = dadosChecklistTemp.vtr;
    const idCompletoChecklist = `CHECKLIST_VTR_${id}`;

    const userUid = userAuth.uid;
    // Mapeamento exato baseado no seu documento do Firestore
    const guerra = (userData.nome_guerra || userData.nomeGuerra || 'ND').toUpperCase();
    const posto = (userData.posto || userData.postoGraduacao || 'ND');
    const quadro = (userData.quadro || 'ND');

    // ✅ URL PADRONIZADA
    const url = `conferencia_app.html?id=${idCompletoChecklist}` +
        `&modo=checklist_vtr` +
        `&prefixo=${encodeURIComponent(prefixo)}` +
        `&km=${kmDigitado}` +
        `&combustivel=${encodeURIComponent(combustivel)}` +
        `&posto_grad=${encodeURIComponent(posto)}` +
        `&quadro=${encodeURIComponent(quadro)}` +
        `&nome_guerra=${encodeURIComponent(guerra)}` +
        `&user_uid=${userUid}` +
        `&unidade_id=${encodeURIComponent(userData.unidade_id || userData.unidadeId || '')}` +
        `&unidade_nome=${encodeURIComponent(userData.unidade || '')}`;

    Swal.close();

    // ✅ REDIRECIONAMENTO OU IFRAME
    const container = document.getElementById('app-runner-container');
    const iframe = document.getElementById('app-iframe');

    if (container && iframe) {
        iframe.src = url;
        container.style.display = 'block';
    } else {
        // Fallback: se não estiver usando iframe no dashboard, redireciona a página
        window.location.href = url;
    }

    console.log("🚀 Vistoria Iniciada com Identidade V3:", { prefixo, guerra });
}
async function filtrarVtrsGlobais(termo) {
    const container = document.getElementById('resultados-busca-vtr');
    const busca = termo.replace(/[^A-Z0-9]/gi, '').toLowerCase();

    if (busca.length < 2) {
        container.innerHTML = '';
        return;
    }

    const snap = await db.collection('viaturas')
        .where('search_key', '>=', busca)
        .where('search_key', '<=', busca + '\uf8ff')
        .limit(5)
        .get();

    if (snap.empty) {
        container.innerHTML = '<p style="font-size:0.8em; color:#999; text-align:center;">Viatura não cadastrada.</p>';
        return;
    }

    let html = '';
    snap.forEach(doc => {
        const v = doc.data();
        // Escapando strings para evitar erros no onclick
        const vData = JSON.stringify(v.ultima_conferencia || {}).replace(/"/g, '&quot;');

        html += `
            <div class="result-vtr-card" onclick="selecionarVtrVisual('${doc.id}', '${v.prefixo}', '${v.placa}', '${v.unidade_atual_nome}', ${vData})">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span><i class="fas fa-truck-pickup"></i> <b>${v.prefixo}</b></span>
                    <small style="color:#2c7399; font-weight:bold;">${v.placa}</small>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function selecionarVtrBusca(id, prefixo) {
    // 1. Salva nos recentes do usuário
    const key = `sigma_vtr_recentes_${currentUserData.uid}`;
    let recentes = JSON.parse(localStorage.getItem(key)) || [];
    recentes = recentes.filter(v => v.id !== id); // Remove se já existe
    recentes.unshift({ id, prefixo }); // Adiciona no topo
    localStorage.setItem(key, JSON.stringify(recentes.slice(0, 4))); // Mantém os 4 últimos

    // 2. Fecha o modal e inicia o fluxo (Ponto 3 da nossa conversa)
    Swal.close();
    alert(`Iniciando Checklist da VTR ${prefixo}...`);
    // Aqui chamaremos o conferencia_app.html futuramente
}
async function gerenciarChecklistVtr(vtrId, prefixo) {
    const checklistId = `CHECKLIST_VTR_${vtrId}`;
    const colecaoAlvo = 'listas_checklist';

    // ✅ GARANTIA DE INSTÂNCIA
    const firestore = window.db || db;

    console.log("🚀 Iniciando gestão de checklist para:", checklistId);

    try {
        // 1. Validação da Viatura no cadastro global
        const vtrDoc = await firestore.collection('viaturas').doc(vtrId).get();
        if (!vtrDoc.exists) return alert("Erro: Viatura não localizada no cadastro global.");
        const vtrData = vtrDoc.data();

        // 2. Verificação de existência da lista de checklist
        const docRef = firestore.collection(colecaoAlvo).doc(checklistId);
        const snapChecklist = await docRef.get();

        if (!snapChecklist.exists) {
            console.log("📋 Criando novo checklist baseado no template padrão...");

            // Busca o template definido pela administração
            const templateDoc = await firestore.collection('config_checklists').doc('vtr_padrao').get();
            if (!templateDoc.exists) throw new Error("Template 'vtr_padrao' não encontrado no banco.");
            const template = templateDoc.data();

            // Mapeia os setores e itens do template para a nova lista da viatura
            const novaListaFormatada = template.setores.map(setor => ({
                id: "setor_" + Date.now() + Math.random().toString(36).substr(2, 5),
                nome: setor.nome,
                itens: setor.itens.map(it => {
                    const isObjeto = (typeof it === 'object' && it !== null);
                    const nomeFinal = isObjeto ? it.nome : it;
                    const tipoFinal = isObjeto ? (it.tipo || 'single') : 'single';
                    const idSeguro = nomeFinal.replace(/\s+/g, '_').toUpperCase();

                    return {
                        id: "item_" + Math.random().toString(36).substr(2, 9),
                        nome: nomeFinal.toUpperCase(),
                        tipo: tipoFinal,
                        quantidadeEsperada: 1,
                        uid_global: "ITEM_VISTORIA_LIVRE",
                        referencia_template: idSeguro,
                        categoria: "VISTORIA",
                        ...(isObjeto ? it : {})
                    };
                })
            }));

            // Grava a estrutura inicial
            await docRef.set({
                uid: checklistId,
                ativo_id: vtrId,
                ativo_nome: prefixo,
                unidade_id: vtrData.unidade_atual_id || vtrData.unidade_id || "",
                unidade_sigla: vtrData.unidade_atual_nome || vtrData.unidade_sigla || "N/D",
                posto_nome: "PÁTIO / MANUTENÇÃO",
                ativo: true,
                tipo: 'checklist_viatura',
                list: novaListaFormatada,
                criado_em: firebase.firestore.FieldValue.serverTimestamp(),
                criado_por: currentUserData.nome_militar_completo
            });
        }

        // 3. TRANSIÇÃO PARA O EDITOR SIGMA V3

        // Define estados globais para o comportamento do editor
        window.isModoVistoria = true;
        window.colecaoAtivaNoEditor = colecaoAlvo;

        // Fecha o modal de detalhes do SweetAlert antes de mudar a tela
        if (Swal.isVisible()) Swal.close();

        // Muda a visualização para o editor
        switchView('editor-arquitetura');

        // Ajuste de layout: remove padding lateral para foco total no editor
        const contentPrincipal = document.querySelector('.content');
        if (contentPrincipal) contentPrincipal.style.padding = '0px';

        // 4. ABERTURA DO EDITOR DE ITENS
        // Timeout para garantir que o DOM da view 'editor-arquitetura' esteja pronto
        setTimeout(async () => {
            console.log("🛠️ Abrindo interface do editor...");
            await abrirModalEditorItens(checklistId, prefixo, colecaoAlvo);
        }, 400);

    } catch (error) {
        console.error("❌ Erro crítico no gerenciarChecklistVtr:", error);
        Swal.fire({
            icon: 'error',
            title: 'Falha no Processo',
            text: error.message,
            confirmButtonColor: '#800020'
        });
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