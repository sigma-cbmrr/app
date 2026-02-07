const firebaseConfig = { apiKey: "AIzaSyCB0PH0UgghgsvH0BgPkG4AkKON6xSQ9mc", authDomain: "sigma-cbmrr.firebaseapp.com", projectId: "sigma-cbmrr", storageBucket: "sigma-cbmrr.firebasestorage.app", messagingSenderId: "378026276038", appId: "1:378026276038:web:620dd6ff57501b1a8313c7" };
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
firebase.firestore().clearPersistence().catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn("Múltiplas abas abertas, persistência não pôde ser limpa.");
    }
});
const auth = firebase.auth();
const secondaryApp = firebase.initializeApp(firebaseConfig, 'Secondary');
const secondaryAuth = secondaryApp.auth();

async function openNewConferenceModal() {
    if (window.innerWidth <= 768) toggleFabMenu();
    materialSelecionadoNoModal = null; // Reseta variável global

    try {
        // 🛡️ MUDANÇA CIRÚRGICA 1: Busca apenas as listas que REALMENTE estão em prontidão (tem posto_id)
        const snapListas = await db.collection('listas_conferencia')
            .where('ativo', '==', true)
            .get();

        if (snapListas.empty) {
            Swal.fire('Aviso', 'Não há nenhuma viatura ou lista alocada em postos no momento.', 'info');
            return;
        }

        // Transforma os documentos em objetos e filtra quem tem posto_id
        const todasListasAtivas = snapListas.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const listasComPosto = todasListasAtivas.filter(l => l.posto_id && l.posto_nome);

        // 🛡️ MUDANÇA CIRÚRGICA 2: Gera os setores (Postos) ÚNICOS baseados nos vínculos reais
        const setoresUnicos = [...new Set(listasComPosto.map(l => l.posto_nome))].sort();

        if (setoresUnicos.length === 0) {
            Swal.fire('Aviso', 'Nenhuma lista foi vinculada a um posto pela Gestão.', 'warning');
            return;
        }

        // Guardamos as listas filtradas em uma variável temporária para a função de filtragem usar
        window.listasVigentesParaModal = listasComPosto;

        Swal.fire({
            title: '<i class="fas fa-clipboard-check"></i> Conferência de Materiais',
            backdrop: `rgba(0,0,0,0.6)`,
            target: 'body',
            allowOutsideClick: false,
            html: `
                <div style="text-align: left; padding: 5px;">
                    <div id="area-selecao-material">
                        <div class="form-group">
                            <label style="font-size: 0.85em; font-weight:bold; color:#800020;">1. SELECIONE O POSTO / BASE:</label>
                            <select id="swal-select-posto" class="swal2-select" style="width: 100%; margin: 10px 0;" onchange="filtrarListasParaMaterial(this.value)">
                                <option value="" disabled selected>Escolha o posto...</option>
                                ${setoresUnicos.map(s => `<option value="${s}">${s}</option>`).join('')}
                            </select>
                        </div>

                        <div class="form-group" id="group-select-lista" style="display:none; margin-top:15px;">
                            <label style="font-size: 0.85em; font-weight:bold; color:#800020;">2. ESCOLHA A VIATURA / LISTA:</label>
                            <select id="swal-select-lista" class="swal2-select" style="width: 100%; margin: 10px 0;" onchange="selecionarMaterialVisual()">
                                <option value="" disabled selected>Selecione a lista...</option>
                            </select>
                        </div>
                    </div>

                    <div id="resumo-material-vtr" style="display:none;">
                        <div class="vtr-selected-summary" style="border-color: #2c7399; padding:15px; border:2px solid #2c7399; border-radius:8px; text-align:center;">
                            <i class="fas fa-file-invoice" style="color:#2c7399; font-size:1.5em; margin-bottom:10px;"></i>
                            <p style="margin:0; font-size:0.9em; color:#666;">Lista Selecionada</p>
                            <h2 id="resumo-nome-lista" style="font-size:1.5em; color:#2c7399; margin:5px 0;">---</h2>
                            <div id="resumo-detalhe-posto" style="margin-top:10px; color:#475569; font-size:0.85em; font-weight:bold; text-transform:uppercase;">
                                POSTO/BASE: ---
                            </div>
                        </div>
                    </div>

                    <button id="btn-confirmar-material-modal" class="btn-iniciar-check-modal" style="display:none; background-color:#2c7399 !important; width:100%; color:white; padding:12px; border:none; border-radius:6px; font-weight:bold; margin-top:15px; cursor:pointer;" onclick="confirmarInicioMaterial()">
                        INICIAR CONFERÊNCIA
                    </button>
                    
                    <button id="btn-trocar-material" style="display:none; background:none; border:none; color:#2c7399; cursor:pointer; width:100%; margin-top:10px; font-size:0.8em; text-decoration:underline;" onclick="resetarSelecaoMaterial()">
                        Trocar material selecionado
                    </button>
                </div>
            `,
            showConfirmButton: false,
            showCancelButton: true,
            cancelButtonText: 'Cancelar'
        });

    } catch (e) {
        console.error("Erro ao abrir modal de conferência:", e);
        Swal.fire('Erro', 'Falha ao carregar dados do inventário.', 'error');
    }
}

// Constantes Globais
const COLECAO_RESULTADOS = 'resultados_conferencias';
const COLECAO_LISTAS = 'listas_conferencia';

// Variáveis Globais
let currentUserData = null;
let allLists = [];
let allUsersData = [];
let allTargetUsers = [];
let dadosConferencia = []; // Para o editor
let currentEditingId = null;
let conferente = '';
let userCache = {};
let cautelaItensSelecionados = [];
let cautelaIdAtualParaReporte = '';
let itensDaCautelaAtual = [];
let pendenciaSendoResolvida = null
let cachePendenciasCautela = [];
let arquiteturaAtiva = []; // Guarda o array 'list' da viatura em edição
let idListaSendoEditada = null;
let itensParaEstorno = []; // Itens que foram marcados com "X"
let estoqueGestorLocal = []; // Cache do estoque da unidade para a busca rápida
let vtrSelecionadaNoModal = null;
let materialSelecionadoNoModal = null;
let dadosChecklistTemp = { vtr: null, km: 0, combustivel: '1/2' };
let isModoVistoria = false;
let houveAlteracaoNoPosto = false; // Controle de sincronização visual
window.colecaoAtivaNoEditor = 'listas_conferencia';
let visaoAtual = 'grid'; // Padrão
let letraAtiva = 'TODOS';
let isCaaLoading = false;

// --- 1. AUTH & PERMISSÕES ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        try {
            const doc = await db.collection('usuarios').doc(user.uid).get();
            if (doc.exists) {
                currentUserData = doc.data();
                conferente = currentUserData.nome_militar_completo;
                setupUIBasedOnRole();
            } else {
                alert("Usuário sem registro no banco.");
                window.location.href = 'index.html';
            }
        } catch (e) {
            console.error(e);
        }
    } else {
        window.location.href = 'index.html';
    }
});

function setupUIBasedOnRole() {
    if (typeof atualizarIdentidadeSidebar === 'function') {
        atualizarIdentidadeSidebar();
    }

    const role = currentUserData.role || 'operacional';
    const p = currentUserData.permissoes || {};

    // ✅ ETIQUETA MESTRE: Permite que o CSS ajude no bloqueio preventivo
    document.body.setAttribute('data-user-role', role);

    atualizarSaudacao(currentUserData);
    carregarAlertasTransferencia();

    setTimeout(() => {
        if (!document.getElementById('alerta-carga-transito')) {
            carregarAlertasTransferencia();
        }
    }, 1500);

    // 1. DEFINIÇÕES DE PODER
    const isOperacional = (role === 'operacional');
    const isAdminOuGeral = (role === 'admin' || role === 'gestor_geral');
    const isGestorLocal = (role === 'gestor');
    const isGestorOuAdmin = (isGestorLocal || isAdminOuGeral);
    const souCúpula = isAdminOuGeral;

    // 2. MAPEAMENTO DE PERMISSÕES DINÂMICAS
    const canViewDashboardCards = souCúpula || (isGestorLocal && p.canViewDashboardCards);
    const canViewUnitHistory = souCúpula || (isGestorLocal && p.canViewUnitHistory);
    const canManagePosts = souCúpula || (isGestorLocal && p.canManagePosts);
    const canManageUnitUsers = souCúpula || (isGestorLocal && p.canManageUnitUsers);
    const canManageUnitLists = souCúpula || isGestorLocal;

    // --- 🔐 BLOCO DE VISIBILIDADE DA SIDEBAR ---

    // A. Esconder preventivamente todos os itens de classe restrita e o separador
    document.querySelectorAll('.restricted-admin-only').forEach(el => {
        el.style.setProperty('display', 'none', 'important');
    });

    // B. Ativar menus baseados em permissão (Apenas se NÃO for operacional)
    const configuracaoMenus = [
        { id: 'link-unidades', permitir: souCúpula },
        { id: 'link-postos', permitir: canManagePosts },
        { id: 'link-usuarios', permitir: canManageUnitUsers },
        { id: 'link-listas', permitir: canManageUnitLists }, 
        { id: 'link-vtr-bases', permitir: souCúpula },
        { id: 'link-almoxarifado', permitir: isGestorOuAdmin },
        { id: 'link-global-history', permitir: canViewUnitHistory }
    ];

    configuracaoMenus.forEach(item => {
        const el = document.getElementById(item.id);
        if (el) {
            if (!isOperacional && item.permitir) {
                el.style.setProperty('display', 'flex', 'important');
            } else {
                el.style.setProperty('display', 'none', 'important');
            }
        }
    });

    // C. Forçar menus básicos sempre visíveis (Dashboard, Atividades e Cautelas)
    const menusBase = ['link-dashboard', 'link-my-history', 'link-cautelas-group'];
    menusBase.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.setProperty('display', 'flex', 'important');
    });

    // 3. BOTÕES DE AÇÃO NO DASHBOARD
    const botoesAcao = ['btn-toggle-posto', 'btn-toggle-vtr-base', 'btn-novo-cadastro-global'];
    botoesAcao.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = (!isOperacional && souCúpula) ? 'inline-flex' : 'none';
        }
    });

    // --- 📊 BLOCO CRÍTICO: RENDERIZAÇÃO DO DASHBOARD (FIM DO PULO VISUAL) ---

    const masterContainer = document.getElementById('dashboard-content-by-role');
    const adminCont = document.getElementById('admin-gestor-cards-container');
    const opCont = document.getElementById('operacional-cards-container');

    // ✅ RESET INICIAL FORÇADO: Garante que nada apareça antes da decisão
    if (adminCont) adminCont.style.setProperty('display', 'none', 'important');
    if (opCont) opCont.style.setProperty('display', 'none', 'important');

    if (isOperacional) {
        // Liga o operacional e garante que o container master-detail se comporte como full-width
        if (masterContainer) masterContainer.style.setProperty('display', 'block', 'important');
        renderOperacionalCards(); 
    } else {
        // Liga o gestor e restaura as colunas (display flex)
        if (masterContainer) masterContainer.style.setProperty('display', 'flex', 'important');
        renderAdminGestorCards(canViewDashboardCards);
    }

    // 5. RÓTULO DA SEÇÃO ADMINISTRATIVA
    const rotuloAdmin = document.getElementById('sidebar-rotulo-admin');
    if (rotuloAdmin) {
        const anyAdminVisible = !isOperacional && configuracaoMenus.some(m => m.permitir);
        rotuloAdmin.style.display = anyAdminVisible ? 'block' : 'none';
    }

    // 6. FINALIZAÇÃO
    const editorArq = document.getElementById('view-editor-arquitetura');
    if (editorArq) editorArq.style.display = 'none';

    closeMenuMobile();
    if (window.innerWidth <= 768) history.pushState(null, null, location.href);

    // ✅ DISPARO FINAL: Note que removemos a lógica duplicada de dentro do switchView('dashboard') 
    // pois já resolvemos a renderização nos passos acima.
    switchView('dashboard');
    
    if (typeof setupMasksForModal === 'function') setupMasksForModal();
}

/**
 * Adiciona listeners de formatação (máscara) aos inputs do modal Gerenciar Militar.
 */
function setupMasksForModal() {
    const cpfInput = document.getElementById('edit-user-cpf');
    if (cpfInput) {
        cpfInput.addEventListener('input', () => formatarCPF(cpfInput));
        // Aplica a máscara imediatamente para valores preenchidos na abertura do modal
        formatarCPF(cpfInput);
    }

    const matriculaInput = document.getElementById('edit-user-matricula');
    if (matriculaInput) {
        matriculaInput.addEventListener('input', () => formatarMatricula(matriculaInput));
        formatarMatricula(matriculaInput);
    }

    const telefoneInput = document.getElementById('edit-user-telefone');
    if (telefoneInput) {
        telefoneInput.addEventListener('input', () => formatarTelefone(telefoneInput));
        formatarTelefone(telefoneInput);
    }
}
function toggleSubMenu(id, btn) {
    const submenu = document.getElementById(id);
    const isVisible = submenu.style.display === 'block';

    // Oculta outros submenus abertos para manter a sidebar limpa
    document.querySelectorAll('.sigma-v3-submenu').forEach(s => {
        if (s.id !== id) s.style.display = 'none';
    });
    document.querySelectorAll('.sigma-v3-dropdown-btn').forEach(b => {
        if (b !== btn) b.classList.remove('open');
    });

    // Alterna o estado atual
    if (isVisible) {
        submenu.style.display = 'none';
        btn.classList.remove('open');
    } else {
        submenu.style.display = 'block';
        btn.classList.add('open');
    }
}
// --- NOVO: Cards Específicos para Operacional ---
function renderOperacionalCards() {
    const container = document.getElementById('operacional-cards-container');
    const masterContainer = document.getElementById('dashboard-content-by-role');
    
    if (!container) return;

    // ✅ BLOQUEIO DO PULO VISUAL: Garante que o container operacional apareça e o de admin suma
    container.style.setProperty('display', 'block', 'important');
    
    const adminContainer = document.getElementById('admin-gestor-cards-container');
    if (adminContainer) {
        adminContainer.style.setProperty('display', 'none', 'important');
    }

    // ✅ AJUSTE ESTRUTURAL: Ativa a largura total no container pai
    if (masterContainer) {
        masterContainer.classList.add('dashboard-operacional-full');
    }

    // ✅ HIERARQUIA V3: Layout de largura total (Full-Width)
    container.innerHTML = `
        <div class="sigma-v3-clean-wrapper" style="margin-top: 10px; width: 100%;">
            
            <div class="sigma-v3-title-label">
                <i class="fas fa-calendar-day" style="color: #800020;"></i>
                <span>Atividades Realizadas Hoje</span>
            </div>
            <ul id="today-list" class="history-list" style="background: white; border-radius: 15px; padding: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); margin-bottom: 40px; list-style: none; width: 100%;">
                <li style="text-align:center; color:#999; padding:20px;">
                    <i class="fas fa-sync fa-spin"></i> Carregando registros de hoje...
                </li>
            </ul>

            <div class="sigma-v3-title-label" style="border-top: 1px solid rgba(0,0,0,0.08); padding-top: 30px;">
                <i class="fas fa-chart-bar" style="color: #2c7399;"></i> 
                <span>Dashboard de Serviço</span>
            </div>

            <div class="cards-grid-v3-op">
                
                <div class="sigma-v3-summary-card sigma-v3-card-ok icon-conferencia" onclick="switchView('my-history')" style="width:100%; margin:0;">
                    <h3>Minhas Conferências</h3>
                    <div class="sigma-v3-main-stat">
                        <div class="sigma-v3-stat-circle" id="op-conf-count">0</div>
                        <div style="line-height: 1.2;">
                            <span style="font-size: 0.8em; font-weight: 800; color: #1b8a3e;">HISTÓRICO</span><br>
                            <small style="color: #64748b; font-size: 0.7em;">Registros totais</small>
                        </div>
                    </div>
                    <div class="sigma-v3-footer-info">
                        <strong><i class="fas fa-arrow-right"></i> Clique para acessar</strong>
                        <small>Histórico completo de atividades</small>
                    </div>
                </div>

                <div class="sigma-v3-summary-card sigma-v3-card-unit icon-custodia" onclick="switchView('cautelas-ativas')" style="width:100%; margin:0;">
                    <h3>Cautelas Ativas</h3>
                    <div class="sigma-v3-main-stat">
                        <div class="sigma-v3-stat-circle" id="op-my-active-cautela-count">0</div>
                        <div style="line-height: 1.2;">
                            <span style="font-size: 0.8em; font-weight: 800; color: #2c7399;">ATIVAS</span><br>
                            <small style="color: #64748b; font-size: 0.7em;">Materiais em seu nome</small>
                        </div>
                    </div>
                    <div class="sigma-v3-footer-info">
                        <strong><i class="fas fa-shield-alt"></i> Gestão de Cautela</strong>
                        <small>Itens sob sua responsabilidade</small>
                    </div>
                </div>

                <div class="sigma-v3-summary-card sigma-v3-card-posto icon-receber" onclick="switchView('cautelas-receber')" style="width:100%; margin:0;">
                    <h3>Cautelas a receber</h3>
                    <div class="sigma-v3-main-stat">
                        <div class="sigma-v3-stat-circle" id="op-cautela-receive-count">0</div>
                        <div style="line-height: 1.2;">
                            <span style="font-size: 0.8em; font-weight: 800; color: #8e44ad;">PENDENTES</span><br>
                            <small style="color: #64748b; font-size: 0.7em;">Ação necessária</small>
                        </div>
                    </div>
                    <div class="sigma-v3-footer-info">
                        <strong><i class="fas fa-box-open"></i> Aguardando Você</strong>
                        <small>Recebimento de materiais</small>
                    </div>
                </div>
                
            </div>
        </div>
    `;

    // Dispara a lógica de preenchimento dos dados
    updateOperacionalCards();
}

// [NOVO] Atualiza a contagem do Card "Minhas Conferências"
async function getCautelasAReceberCount() {
    if (!currentUserData) return 0;
    const militarUid = firebase.auth().currentUser.uid;

    try {
        // Cautelas NOVAS (Alvo Original)
        const snapNovas = await db.collection('cautelas_abertas')
            .where('destinatario_original_uid', '==', militarUid)
            .where('status', '==', 'ABERTA')
            .get();

        // DEVOLUÇÕES para conferir (Destinatário Atual)
        const snapDevolucoes = await db.collection('cautelas_abertas')
            .where('destinatario_uid', '==', militarUid)
            .where('status', '==', 'DEVOLUÇÃO')
            .get();

        // Usamos um Set para garantir que se uma cautela cair em ambos, conte apenas uma vez
        const totalIds = new Set();
        snapNovas.forEach(doc => totalIds.add(doc.id));
        snapDevolucoes.forEach(doc => totalIds.add(doc.id));

        return totalIds.size;
    } catch (e) {
        console.error("Erro ao contar cautelas:", e);
        return 0;
    }
}

/**
 * Calcula a contagem total e desduplicada de cautelas ativas para o dashboard,
 * respeitando os filtros de perfil (Operacional, Gestor, Admin).
 */
async function countActiveCautelas() {
    if (!currentUserData || !currentUserData.nome_militar_completo) return 0;

    const role = currentUserData.role;
    const user = currentUserData;

    // Conjunto para garantir que cada Cautela ID seja contada apenas uma vez
    const countedIds = new Set();

    // --- 1. BUSCAS PARA OPERACIONAL / GESTOR (Regras Pessoais) ---
    if (role === 'operacional' || role === 'gestor') {

        // A. CUSTÓDIA ATIVA + RASTREIO DE DEVOLUÇÃO (RECEBIDA como destinatário OU DEVOLUÇÃO como reversor)
        // Usaremos duas queries separadas e depois desduplicaremos para garantir a contagem.

        // CUSTÓDIA ATIVA (RECEBIDA)
        const custodiaRecebida = await queryCautelas(['RECEBIDA'], role, user, 'destinatario', 'personal');
        custodiaRecebida.forEach(c => countedIds.add(c.cautela_id));

        // RASTREIO DE RESPONSABILIDADE (DEVOLUÇÃO como Reversor)
        const devolucaoRastreio = await queryCautelas(['DEVOLUÇÃO'], role, user, 'militar_completo_reversor', 'personal');
        devolucaoRastreio.forEach(c => countedIds.add(c.cautela_id));

        // B. RASTREIO PESSOAL (ABERTA, RECEBIDA, DEVOLUÇÃO como Emitente)
        const rastreioEmitente = await queryCautelas(['ABERTA', 'RECEBIDA', 'DEVOLUÇÃO'], role, user, 'emitente', 'personal');
        rastreioEmitente.forEach(c => countedIds.add(c.cautela_id));
    }

    // --- 2. BUSCAS PARA GESTOR / ADMIN (Regras Gerenciais de Monitoramento) ---
    if (role === 'gestor' || role === 'admin') {

        // MONITORAMENTO: ABERTA, RECEBIDA, DEVOLUÇÃO (Filtro por Unidade ou Global)
        const monitoramentoRaw = await queryCautelas(['ABERTA', 'RECEBIDA', 'DEVOLUÇÃO'], role, user, null, 'unit');

        // Adiciona todos os IDs de monitoramento no Set (ele cuida da desduplicação)
        monitoramentoRaw.forEach(c => countedIds.add(c.cautela_id));
    }

    // O tamanho do Set é a contagem total desduplicada de todas as cautelas ativas
    return countedIds.size;
}
// Localização: Linha ~2792
async function updateOperacionalCards() {
    const ul = document.getElementById('today-list');
    const countEl = document.getElementById('op-conf-count');
    const cautelaReceiveCountEl = document.getElementById('op-cautela-receive-count');
    const myActiveCautelaCountEl = document.getElementById('op-my-active-cautela-count');

    const conferenteUid = firebase.auth().currentUser.uid;
    if (!conferenteUid || !ul || !countEl || !cautelaReceiveCountEl || !myActiveCautelaCountEl) {
        console.warn("Elemento de card operacional ou UID ausente. Pulando atualização.");
        return;
    }
    countEl.textContent = "...";
    cautelaReceiveCountEl.textContent = "...";
    myActiveCautelaCountEl.textContent = "...";
    try {
        // --- 1. CONSULTA DUPLA (MATERIAIS E VISTORIAS) ---
        // Buscamos os últimos registros de ambas as coleções para este usuário
        const [snapMateriais, snapChecklists] = await Promise.all([
            db.collection('resultados_conferencias')
                .where('conferente_uid', '==', conferenteUid)
                .orderBy('timestamp', 'desc')
                .limit(50)
                .get(),
            db.collection('resultados_checklist')
                .where('conferente_uid', '==', conferenteUid)
                .orderBy('timestamp', 'desc')
                .limit(50)
                .get()
        ]);

        // Unifica os documentos na memória para processar a "Lista de Hoje"
        let todosDocs = [];
        snapMateriais.forEach(doc => todosDocs.push(doc.data()));
        snapChecklists.forEach(doc => todosDocs.push(doc.data()));

        // Atualiza o contador total (Soma das duas frentes de trabalho)
        const totalGeralAtividades = snapMateriais.size + snapChecklists.size;
        countEl.textContent = totalGeralAtividades;

        // --- 2. OUTROS CONTADORES (CAUTELAS) ---
        const [totalCautelasAReceber, totalMyActiveCautelas] = await Promise.all([
            getCautelasAReceberCount(),
            countActiveCautelas()
        ]);
        cautelaReceiveCountEl.textContent = totalCautelasAReceber;
        myActiveCautelaCountEl.textContent = totalMyActiveCautelas;

        // --- 3. FILTRAGEM PARA "HOJE" E RENDERIZAÇÃO ---
        const hojeStr = new Date().toLocaleDateString('pt-BR');

        // Ordena por timestamp antes de filtrar
        todosDocs.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);

        let html = '';
        todosDocs.forEach(data => {
            const dt = data.timestamp.toDate();
            // Filtro de data local (apenas as que caem na data de hoje)
            if (dt.toLocaleDateString('pt-BR') === hojeStr) {
                html += criarItemHistoricoHTML(data);
            }
        });

        ul.innerHTML = html ||
            '<li style="padding:15px; text-align:center; color:#999;">Nenhuma atividade hoje.</li>';

    } catch (e) {
        console.error("Erro ao carregar dados operacionais unificados:", e);
        if (countEl) countEl.textContent = 'Erro';
        if (ul) ul.innerHTML = '<li style="text-align:center; color:red;">Erro ao carregar lista de hoje.</li>';
    }
}

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
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; min-height: 280px; color: #94a3b8; text-align: center; padding: 20px; background: #fff;">
                <div style="background: #f8fafc; width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; border: 2px dashed #e2e8f0;">
                    <i class="fas fa-mouse-pointer" style="font-size: 2em; color: #cbd5e1;"></i>
                </div>
                <h3 style="margin: 0; font-size: 1.1em; color: #475569; font-weight: 700;">Gestão de Pendências</h3>
                <p style="font-size: 0.85em; margin-top: 10px; color: #94a3b8; max-width: 250px;">
                    Selecione um card de viatura à esquerda para detalhar as alterações.
                </p>
            </div>
        `;
    }

    containerPai.style.setProperty('display', 'block', 'important');
    loadCaaData();
}

closeMenuMobile();

// --- Trava do Botão Voltar (Mobile/Browser) ---
if (window.innerWidth <= 768) {
    // Adiciona um estado para interceptar o botão Voltar do navegador
    history.pushState(null, null, location.href);
}
// ----------------------------------------------

// Garante que a visão seja o dashboard ao logar
switchView('dashboard');

function atualizarSaudacao(user) {
    const now = new Date();
    const hour = now.getHours();

    let saudacao = "Bom dia";
    if (hour >= 12 && hour < 18) saudacao = "Boa tarde";
    else if (hour >= 18) saudacao = "Boa noite";

    const opcoesData = { weekday: 'long', day: 'numeric', month: 'long' };
    let dataStr = now.toLocaleDateString('pt-BR', opcoesData);
    dataStr = dataStr.charAt(0).toUpperCase() + dataStr.slice(1);

    const nomeExibicao = user.nome_guerra || user.nome_militar_completo || "Militar";
    const postoQuadro = `${user.posto || ''} ${user.quadro || ''}`.trim();

    // ✅ Atualiza o texto de boas-vindas
    document.getElementById('greeting-text').textContent = `${saudacao}, ${nomeExibicao}!`;

    // ✅ MUDANÇA CIRÚRGICA: Agora exibe a Graduação na saudação
    const elRank = document.getElementById('greeting-name');
    if (elRank) elRank.textContent = postoQuadro || "Militar CBMRR";

    document.getElementById('current-date').textContent = dataStr;

    // ✅ REMOÇÃO DA FOTO: Garante que o container da foto suma se existir
    const elFoto = document.getElementById('greeting-photo');
    if (elFoto) {
        elFoto.style.display = 'none'; // Remove visualmente do Dashboard
    }
}

/*CONTROLA O BOTÃO + NA TELA INICIAL*/
function toggleFabMenu() {
    const options = document.getElementById('fab-options');
    const mainBtn = document.querySelector('.v3-fab-main');
    const icon = document.getElementById('fab-icon');

    // 1. Verificação de segurança: evita erros se o elemento não existir na tela atual
    if (!options || !mainBtn || !icon) return;

    // 2. Trava de Execução: Só funciona no Mobile (largura <= 768px)
    if (window.innerWidth <= 768) {
        const isActive = options.classList.toggle('active');
        mainBtn.classList.toggle('active');

        // 3. Troca de ícones com tratamento de erro
        if (isActive) {
            icon.classList.remove('fa-plus');
            icon.classList.add('fa-times');
        } else {
            icon.classList.remove('fa-times');
            icon.classList.add('fa-plus');
        }
    }
}
// Monitora cliques em toda a janela PRA FECHAR O BOTÃO +
window.addEventListener('click', function (e) {
    const hub = document.querySelector('.v3-action-hub');
    const options = document.getElementById('fab-options');
    const icon = document.getElementById('fab-icon');
    const mainBtn = document.querySelector('.v3-fab-main');

    // Verifica se o menu existe e se está aberto no mobile
    if (options && options.classList.contains('active')) {
        // Se o clique NÃO foi dentro do conjunto do botão (hub), ele recolhe
        if (!hub.contains(e.target)) {
            options.classList.remove('active');
            mainBtn.classList.remove('active');
            if (icon) {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-plus');
            }
        }
    }
});

/**
 * Alterna a visibilidade da sidebar no modo mobile
 */
function toggleMenuMobile(forceClose = false) {
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.getElementById('mobile-overlay');

    if (!sidebar) return;

    // Se forceClose for true, nós removemos a classe. 
    // Se não, fazemos o toggle normal (abre/fecha).
    if (forceClose) {
        sidebar.classList.remove('mobile-active');
    } else {
        sidebar.classList.toggle('mobile-active');
    }

    // Sincroniza o overlay com o estado real da sidebar
    if (overlay) {
        const isOpen = sidebar.classList.contains('mobile-active');
        overlay.style.display = isOpen ? 'block' : 'none';
    }
}

/**
 * Encerra a sessão do usuário no Firebase e redireciona
 */
function logout() {
    Swal.fire({
        title: 'Sair do Sistema?',
        text: "Deseja realmente encerrar sua sessão?",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#800020',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sim, Sair',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            // Executa o logout no Firebase Auth
            auth.signOut().then(() => {
                console.log("Sessão encerrada com sucesso.");
                // Redireciona para a página de login (ajuste o nome se for diferente)
                window.location.href = "index.html";
            }).catch((error) => {
                console.error("Erro ao deslogar:", error);
                Swal.fire('Erro', 'Não foi possível encerrar a sessão.', 'error');
            });
        }
    });
}

// --- 3. DASHBOARD HIERÁRQUICO ---
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

            if (pendenciasReais.length > 0) {
                if (podeVer) {
                    console.log(`✨ LOG SUCESSO: Card ${nomeViatura} APROVADO para exibição.`);
                    map[lId] = {
                        docId: doc.id,
                        lista_id: lId,
                        local: d.local,
                        conferente: d.conferente,
                        date: d.timestamp ? d.timestamp.toDate().toLocaleString('pt-BR') : 'N/D',
                        unidade_sigla: siglaVinculada,
                        items: pendenciasReais
                    };
                } else {
                    console.warn(`🚫 LOG BLOQUEIO: Viatura ${nomeViatura} tem pendências, mas a Unidade (${unidadeVinculada}) não é a do Gestor (${gestorUnidadeId}).`);
                }
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

// --- 4. NOVA CONFERÊNCIA ---
async function carregarListasParaNovaConferencia() {
    try {
        const doc = await db.collection('config_geral').doc('rotas').get();
        const rotas = doc.data();
        allLists = [];
        const setores = new Set();

        Object.entries(rotas).forEach(([id, info]) => {
            if (info.ativo !== false && id !== 'ABT-17' && id !== 'ABT-18' && id.indexOf('bravo 5') === -1) {
                allLists.push({ id: id, nome: info.nome, setor: info.posto });
                setores.add(info.posto);
            }
        });

        const sel = document.getElementById('dash-select-setor');
        sel.innerHTML = '<option value="" disabled selected>Selecione o Setor...</option>';

        Array.from(setores).sort().forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            sel.appendChild(opt);
        });
    } catch (e) { }
}

async function filtrarListasParaMaterial(postoNome) {
    const selectLista = document.getElementById('swal-select-lista');
    const groupLista = document.getElementById('group-select-lista');

    if (!selectLista || !groupLista) return;

    // 🛡️ MUDANÇA CIRÚRGICA: Não busca mais em 'config_geral/rotas'
    // Usa a variável global que populamos com dados REAIS na openNewConferenceModal
    const listasVigentes = window.listasVigentesParaModal || [];

    // Filtra apenas as listas que pertencem ao posto selecionado pelo usuário
    const filtradas = listasVigentes.filter(l => l.posto_nome === postoNome);

    let options = '<option value="" disabled selected>Selecione a lista...</option>';

    if (filtradas.length > 0) {
        filtradas.forEach(lista => {
            // Usamos o ID do documento da 'listas_conferencia' e o nome real gravado nela
            options += `<option value="${lista.id}">${lista.ativo_nome}</option>`;
        });

        selectLista.innerHTML = options;
        groupLista.style.display = 'block';
    } else {
        // Caso de segurança: se por algum motivo o posto aparecer mas não tiver listas
        selectLista.innerHTML = '<option value="">Nenhuma viatura disponível</option>';
        groupLista.style.display = 'block';
    }
}

// Localização: Linha ~1353
function selecionarMaterialVisual() {
    const selectPosto = document.getElementById('swal-select-posto');
    const selectLista = document.getElementById('swal-select-lista');

    if (!selectLista.value) return;

    const idLista = selectLista.value;
    const nomeLista = selectLista.options[selectLista.selectedIndex].text;
    const nomePosto = selectPosto.value;

    // Armazena o objeto completo para o início da conferência
    materialSelecionadoNoModal = { id: idLista, nome: nomeLista, posto: nomePosto };

    // UI: Transição suave para o resumo
    document.getElementById('area-selecao-material').style.display = 'none';
    document.getElementById('resumo-nome-lista').textContent = nomeLista;
    document.getElementById('resumo-detalhe-posto').textContent = `POSTO: ${nomePosto}`;
    document.getElementById('resumo-material-vtr').style.display = 'block';

    // Exibe botões de ação
    document.getElementById('btn-confirmar-material-modal').style.display = 'block';
    document.getElementById('btn-trocar-material').style.display = 'block';
}

function resetarSelecaoMaterial() {
    materialSelecionadoNoModal = null;
    const selectLista = document.getElementById('swal-select-lista');
    if (selectLista) selectLista.value = ""; // Limpa o select anterior

    document.getElementById('area-selecao-material').style.display = 'block';
    document.getElementById('resumo-material-vtr').style.display = 'none';
    document.getElementById('btn-confirmar-material-modal').style.display = 'none';
    document.getElementById('btn-trocar-material').style.display = 'none';
}

function confirmarInicioMaterial() {
    if (!materialSelecionadoNoModal) return;

    const { id, nome, posto } = materialSelecionadoNoModal;
    const userUid = firebase.auth()?.currentUser?.uid || 'SISTEMA';

    // Preparação dos dados do militar
    const userForDraft = (currentUserData?.nome_guerra || 'ND').toUpperCase();
    const postoGrad = (currentUserData?.posto || 'MILITAR').toUpperCase();

    // ✅ CORREÇÃO V3: Inclusão do parâmetro &modo para evitar o 'null' no Iframe
    // Além disso, mantemos a estrutura para os demais dados de sessão.
    const url = `conferencia_app.html?id=${id}` +
        `&modo=conferencia_materiais` + // 🚀 A peça que faltava
        `&posto_grad=${encodeURIComponent(currentUserData.posto || '')}` +
        `&quadro=${encodeURIComponent(currentUserData.quadro || '')}` +
        `&nome_guerra=${encodeURIComponent(userForDraft)}` +
        `&user_uid=${userUid}` +
        `&unidade_id=${encodeURIComponent(currentUserData.unidade_id || '')}` +
        `&unidade_nome=${encodeURIComponent(currentUserData.unidade || '')}`;

    Swal.close();

    // Disparo do Iframe
    const container = document.getElementById('app-runner-container');
    const iframe = document.getElementById('app-iframe');

    if (iframe && container) {
        // Define a URL completa e exibe o container
        iframe.src = url;
        container.style.display = 'block';
        console.log(`🚀 Iniciando Conferência: ${nome} no posto ${posto} | Modo: conferencia_materiais`);
    } else {
        console.error("Erro: Container do App não localizado no DOM.");
        Swal.fire('Erro', 'O executor de aplicativos não foi encontrado na página.', 'error');
    }
}
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
async function loadGlobalHistory() {
    const listContainer = document.getElementById('global-history-list');
    const localFilter = document.getElementById('glob-hist-local').value;
    const conferenteFilter = document.getElementById('glob-hist-user').value;

    if (!listContainer) return;

    listContainer.innerHTML = `
        <div style="text-align:center; padding:60px; color:#64748b;">
            <i class="fas fa-circle-notch fa-spin fa-2x"></i>
            <p style="margin-top:15px; font-weight:700; text-transform:uppercase; font-size:0.8em;">
                Consultando registros da unidade ${currentUserData.unidade}...
            </p>
        </div>`;

    const dI = new Date(document.getElementById('glob-hist-start').value + 'T00:00:00');
    const dF = new Date(document.getElementById('glob-hist-end').value + 'T23:59:59');

    if (isNaN(dI.getTime()) || isNaN(dF.getTime())) {
        listContainer.innerHTML = `<div class="status-error">Selecione o período corretamente.</div>`;
        return;
    }

    const startTS = firebase.firestore.Timestamp.fromDate(dI);
    const endTS = firebase.firestore.Timestamp.fromDate(dF);

    try {
        // ✅ 1. CONSULTA DIRECIONADA (Filtro por Unidade no Servidor)
        let refConf = db.collection('resultados_conferencias')
            .where('timestamp', '>=', startTS)
            .where('timestamp', '<=', endTS);

        let refCheck = db.collection('resultados_checklist')
            .where('timestamp', '>=', startTS)
            .where('timestamp', '<=', endTS);

        // Se for GESTOR, ele só pode ver a própria unidade (Filtro nativo do banco)
        if (currentUserData.role === 'gestor') {
            refConf = refConf.where('unidade', '==', currentUserData.unidade);
            refCheck = refCheck.where('unidade', '==', currentUserData.unidade);
        }

        // Filtro opcional por nome do militar
        if (conferenteFilter) {
            refConf = refConf.where('conferente', '==', conferenteFilter);
            refCheck = refCheck.where('conferente', '==', conferenteFilter);
        }

        // Executa busca
        const [snapConf, snapCheck] = await Promise.all([
            refConf.orderBy('timestamp', 'desc').get(),
            refCheck.orderBy('timestamp', 'desc').get()
        ]);

        let docs = [];
        snapConf.forEach(d => docs.push({ ...d.data(), id_doc: d.id }));
        snapCheck.forEach(d => docs.push({ ...d.data(), id_doc: d.id }));

        // Ordena tudo por tempo
        docs.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);

        let html = '';
        docs.forEach(d => {
            // ✅ 2. FILTRO DE LOCAL (Filtro na memória apenas para o local específico)
            const localLimpo = d.local.includes(': ') ? d.local.split(': ')[1] : (d.local.split(' - ')[1] || d.local);

            if (!localFilter || localLimpo === localFilter) {
                html += criarItemHistoricoHTML(d);
            }
        });

        listContainer.innerHTML = html || `<div style="text-align:center; padding:80px; color:#94a3b8;"><p>Nenhum registro encontrado.</p></div>`;

    } catch (e) {
        console.error("Erro no loadGlobalHistory:", e);
        listContainer.innerHTML = `<div style="text-align:center; padding:40px; color:#d90f23;"><p>Erro na consulta. Certifique-se de que os índices do Firestore foram criados.</p></div>`;
    }
}
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
// --- 6. GESTÃO DE UNIDADES (ADMIN) ---
async function carregarUnidadesVisuais() {
    const container = document.getElementById('units-cards-container');
    if (!container) return;

    // Loading Shimmer V3
    container.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding:60px; color:#64748b;">
            <i class="fas fa-sync fa-spin fa-3x" style="opacity:0.3; margin-bottom:15px; display:block;"></i>
            <span style="font-weight:700; letter-spacing:1px; text-transform:uppercase; font-size:0.8em;">Sincronizando Estrutura Organizacional...</span>
        </div>`;

    try {
        const snap = await db.collection('unidades_estruturadas').where('ativo', '==', true).get();

        if (snap.empty) {
            container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:50px; color:#94a3b8;">Nenhuma unidade cadastrada.</div>`;
            return;
        }

        const unidades = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Separação por Natureza para criar os Headers de Grupo
        const adm = unidades.filter(u => u.tipo === 'administrativo');
        const ope = unidades.filter(u => u.tipo === 'operacional');

        let html = '';

        const renderGrupo = (lista, titulo, icone, cor) => {
            if (lista.length === 0) return '';

            let grupoHtml = `
                <div class="unit-header" style="grid-column: 1/-1; display: flex; align-items: center; gap: 12px; margin: 30px 0 15px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; color: #1e293b; font-weight: 800; text-transform: uppercase; font-size: 0.9em; letter-spacing: 1px;">
                    <i class="fas ${icone}" style="color:${cor}"></i> ${titulo} (${lista.length})
                </div>`;

            lista.forEach(u => {
                const corTipo = u.tipo === 'administrativo' ? '#475569' : '#800020';
                const icon = u.tipo === 'administrativo' ? 'fa-landmark' : 'fa-building-shield';

                // Sanitização para o objeto de edição
                const uJson = JSON.stringify(u).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

                grupoHtml += `
                    <div class="v3-posto-card" style="border-top: 6px solid ${corTipo}; min-height: 200px;">
                        <div class="v3-posto-actions">
                            <button class="v3-btn-action" title="Editar Unidade" onclick="abrirFormularioUnidade(JSON.parse('${uJson}'))">
                                <i class="fas fa-pencil-alt"></i>
                            </button>
                            <button class="v3-btn-action" title="Excluir Unidade" onclick="deletarUnidadeSistema('${u.id}', '${u.sigla}')">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>

                        <div style="padding: 20px; display: flex; flex-direction: column; align-items: center; text-align: center;">
                            <div class="v3-icon-box" style="background: ${corTipo}15; color: ${corTipo}; width: 60px; height: 60px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 1.5em; margin-bottom: 15px;">
                                <i class="fas ${icon}"></i>
                            </div>

                            <div style="margin-bottom: 15px;">
                                <span style="display:block; font-weight:900; font-size:1.4em; color:#1e293b; letter-spacing:-0.5px;">${u.sigla}</span>
                                <span style="display:block; font-size: 0.7em; font-weight: 700; color: #64748b; text-transform: uppercase;">${u.nome_completo}</span>
                            </div>

                            <div style="width: 100%; border-top: 1px solid #f1f5f9; padding-top: 12px; margin-top: auto;">
                                <small style="display:block; font-size:0.6em; color:#94a3b8; font-weight:800; text-transform:uppercase; margin-bottom:4px;">Comando / Direção</small>
                                <span style="font-size:0.85em; font-weight:700; color:#1e293b;">
                                    <i class="fas fa-user-tie" style="margin-right:5px; opacity:0.5; color:${corTipo}"></i> ${u.comandante_nome_estatico || 'Não definido'}
                                </span>
                            </div>
                        </div>
                    </div>`;
            });
            return grupoHtml;
        };

        // Renderiza primeiro os Comandos (ADM) e depois as Unidades Operacionais
        html += renderGrupo(adm, 'Comandos e Diretorias', 'fa-crown', '#475569');
        html += renderGrupo(ope, 'Unidades Operacionais', 'fa-shield-halved', '#800020');

        container.innerHTML = html;

        // Gatilho de ícones FontAwesome
        if (window.FontAwesome) FontAwesome.dom.i2svg();

    } catch (e) {
        console.error("Erro ao renderizar unidades:", e);
        container.innerHTML = `<p style="color:red; text-align:center; padding:40px;">Erro ao carregar mapa de unidades.</p>`;
    }
}
async function abrirFormularioUnidade(dadosEdicao = null) {
    const isEdit = !!dadosEdicao;

    Swal.fire({
        title: isEdit ? '<i class="fas fa-edit"></i> Editar Unidade' : '<i class="fas fa-sitemap"></i> Nova Unidade',
        width: '550px',
        html: `
            <div style="text-align: left; padding: 5px;">
                <div class="swal-v3-form-group">
                    <label style="font-weight: 800; font-size: 0.75em; color: #64748b; text-transform: uppercase;">1. Nome Completo da Unidade</label>
                    <input type="text" id="swal-unid-nome" class="swal2-input" value="${isEdit ? dadosEdicao.nome_completo : ''}" placeholder="Ex: 1º Batalhão de Bombeiros Militar" style="width:100%; margin:5px 0 15px 0; border-radius: 10px;">
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="swal-v3-form-group">
                        <label style="font-weight: 800; font-size: 0.75em; color: #64748b; text-transform: uppercase;">2. Sigla</label>
                        <input type="text" id="swal-unid-sigla" class="swal2-input" value="${isEdit ? dadosEdicao.sigla : ''}" placeholder="Ex: 1º BBM" style="width:100%; margin:5px 0 15px 0; border-radius: 10px; text-transform: uppercase;">
                    </div>
                    <div class="swal-v3-form-group">
                        <label style="font-weight: 800; font-size: 0.75em; color: #64748b; text-transform: uppercase;">3. Natureza</label>
                        <select id="swal-unid-tipo" class="swal2-select" style="width:100%; margin:5px 0 15px 0; border-radius: 10px;">
                            <option value="operacional" ${isEdit && dadosEdicao.tipo === 'operacional' ? 'selected' : ''}>Operacional</option>
                            <option value="administrativo" ${isEdit && dadosEdicao.tipo === 'administrativo' ? 'selected' : ''}>Administrativo</option>
                        </select>
                    </div>
                </div>

                <div class="swal-v3-form-group" style="margin-top:10px; position: relative;">
                    <label style="font-weight: 800; font-size: 0.75em; color: #64748b; text-transform: uppercase;">4. Comandante / Diretor (Busca Inteligente)</label>
                    <input type="text" id="swal-unid-comandante" class="swal2-input" value="${isEdit ? dadosEdicao.comandante_nome_estatico : ''}" placeholder="Digite o nome de guerra..." style="width:100%; margin:5px 0 0 0; border-radius: 10px;" autocomplete="off">
                    <input type="hidden" id="swal-unid-comandante-uid" value="${isEdit ? dadosEdicao.comandante_uid : ''}">
                    <div id="swal-unid-sugestoes" class="suggestions-box" style="display:none; position: absolute; width: 100%; z-index: 1000; background: white; border: 1px solid #ddd; border-top: none; border-radius: 0 0 10px 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); max-height: 150px; overflow-y: auto;"></div>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'SALVAR UNIDADE',
        confirmButtonColor: '#800020',
        cancelButtonText: 'Cancelar',
        // ✅ INSERÇÃO DO DIDOPEN (LÓGICA DE AUTOCOMPLETE)
        didOpen: () => {
            const inputCmd = document.getElementById('swal-unid-comandante');
            const hiddenUid = document.getElementById('swal-unid-comandante-uid');
            const sugestoesBox = document.getElementById('swal-unid-sugestoes');

            inputCmd.addEventListener('input', () => {
                const termo = inputCmd.value.toUpperCase();
                sugestoesBox.innerHTML = '';

                if (termo.length < 2) {
                    sugestoesBox.style.display = 'none';
                    return;
                }

                // Filtra no array global de militares que você já possui
                const filtrados = allTargetUsers.filter(u => u.nome.toUpperCase().includes(termo));

                filtrados.forEach(militar => {
                    const item = document.createElement('div');
                    item.style.padding = '10px';
                    item.style.cursor = 'pointer';
                    item.style.borderBottom = '1px solid #eee';
                    item.innerHTML = `<i class="fas fa-user-shield" style="color:#800020"></i> ${militar.nome}`;

                    item.onclick = () => {
                        inputCmd.value = militar.nome;
                        hiddenUid.value = militar.id;
                        sugestoesBox.style.display = 'none';
                        inputCmd.style.borderColor = '#166534'; // Verde para indicar seleção válida
                    };
                    sugestoesBox.appendChild(item);
                });

                sugestoesBox.style.display = filtrados.length > 0 ? 'block' : 'none';
            });

            // Fecha sugestões ao clicar fora
            document.addEventListener('click', (e) => {
                if (!inputCmd.contains(e.target)) sugestoesBox.style.display = 'none';
            });
        },
        preConfirm: () => {
            const nome = document.getElementById('swal-unid-nome').value.trim().toUpperCase();
            const sigla = document.getElementById('swal-unid-sigla').value.trim().toUpperCase();
            const comandante = document.getElementById('swal-unid-comandante').value.trim().toUpperCase();
            const comandanteUid = document.getElementById('swal-unid-comandante-uid').value;

            if (!nome || !sigla || !comandante) {
                return Swal.showValidationMessage('Todos os campos são obrigatórios');
            }

            return {
                nome_completo: nome,
                sigla: sigla,
                tipo: document.getElementById('swal-unid-tipo').value,
                comandante_nome_estatico: comandante,
                comandante_uid: comandanteUid
            };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            executarSalvamentoUnidade(isEdit ? dadosEdicao.uid : null, result.value);
        }
    });
}

async function executarSalvamentoUnidade(uid, dados) {
    Swal.fire({
        title: 'Sincronizando...',
        html: 'Atualizando estrutura organizacional.',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const uidFinal = uid || ("UNID-" + Date.now());
        const unitRef = db.collection('unidades_estruturadas').doc(uidFinal);
        const dataHora = firebase.firestore.FieldValue.serverTimestamp();

        const payload = {
            uid: uidFinal,
            nome_completo: dados.nome_completo,
            sigla: dados.sigla,
            tipo: dados.tipo,
            comandante_nome_estatico: dados.comandante_nome_estatico,
            comandante_uid: dados.comandante_uid || "",
            ativo: true,
            ultima_atualizacao: dataHora,
            atualizado_por: currentUserData.nome_militar_completo
        };

        if (!uid) {
            payload.data_criacao = dataHora;
        }

        // Gravação Atômica
        await unitRef.set(payload, { merge: true });

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
            title: uid ? 'Unidade atualizada!' : 'Unidade cadastrada com sucesso!'
        });

        carregarUnidadesVisuais(); // Recarrega o grid de cards

    } catch (e) {
        console.error("Erro ao salvar unidade:", e);
        Swal.fire('Erro Técnico', 'Não foi possível salvar a unidade no Firebase.', 'error');
    }
}
//---GESTÃO DE POSTOS--- 08.01.2025
async function abrirGestaoPosto(postoUid) {
    // 1. Busca os dados do Posto
    const postoDoc = await db.collection('postos_estruturados').doc(postoUid).get();
    if (!postoDoc.exists) return;
    const postoData = postoDoc.data();

    // Mostra loading inicial no SweetAlert
    Swal.fire({
        title: 'Sincronizando Ativos...',
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const minhaUnidadeId = currentUserData?.unidade_id;
        const souAdmin = (currentUserData?.role === 'admin' || currentUserData?.role === 'gestor_geral');

        // 2. Busca TODAS as listas ativas para cruzamento
        const listasSnapshot = await db.collection('listas_conferencia').where('ativo', '==', true).get();

        let htmlGestao = `<div style="margin-bottom: 20px; text-align: left;">
            <p style="font-size: 0.75em; font-weight: 800; color: #8e44ad; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.5px;">
                <i class="fas fa-truck-monster"></i> Suas Viaturas / Listas (Gestão Ativa)
            </p>`;

        let htmlLeitura = `<div style="text-align: left; border-top: 1px solid #eee; padding-top: 15px;">
            <p style="font-size: 0.75em; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.5px;">
                <i class="fas fa-lock"></i> Outras Unidades no Local
            </p>`;

        let contadorGestao = 0;
        let contadorLeitura = 0;

        listasSnapshot.forEach(doc => {
            const lista = doc.data();
            const estaNestePosto = (lista.posto_id === postoUid);
            const ehMinhaLista = (lista.unidade_id === minhaUnidadeId);
            const podeVincular = souAdmin || ehMinhaLista;

            if (podeVincular) {
                contadorGestao++;
                htmlGestao += `
                    <div class="swal-v3-list-item">
                        <div class="swal-v3-item-info">
                            <span class="swal-v3-item-name">${lista.ativo_nome}</span>
                            <span class="swal-v3-item-detail">${lista.unidade_sigla || 'Sem Unidade'}</span>
                        </div>
                        <label class="switch">
                            <input type="checkbox" ${estaNestePosto ? 'checked' : ''} 
                                   onchange="vincularListaAoPosto('${doc.id}', '${postoUid}', this.checked)">
                            <span class="slider round"></span>
                        </label>
                    </div>`;
            } else if (estaNestePosto) {
                contadorLeitura++;
                htmlLeitura += `
                    <div class="swal-v3-list-item swal-v3-lock">
                        <div class="swal-v3-item-info">
                            <span class="swal-v3-item-name" style="color:#64748b;">${lista.ativo_nome}</span>
                            <span class="swal-v3-item-detail">${lista.unidade_sigla} (Unidade Externa)</span>
                        </div>
                        <i class="fas fa-shield-alt" style="color:#cbd5e1;"></i>
                    </div>`;
            }
        });

        htmlGestao += (contadorGestao === 0) ? '<p style="color:#94a3b8; font-size:0.8em; text-align:center;">Nenhuma viatura disponível para alocação.</p>' : '';
        htmlGestao += '</div>';

        htmlLeitura += (contadorLeitura === 0) ? '<p style="color:#cbd5e1; font-size:0.8em; text-align:center;">Nenhuma viatura externa vinculada.</p>' : '';
        htmlLeitura += '</div>';

        // 3. Renderiza o Modal Final
        Swal.fire({
            title: `<div style="font-size:0.7em; color:#8e44ad; font-weight:800; text-transform:uppercase;">Gerenciar Localização</div> ${postoData.nome}`,
            html: `
                <div style="background:#f8fafc; padding:10px; border-radius:8px; margin-bottom:20px; border:1px solid #e2e8f0; text-align:left;">
                    <small style="color:#64748b; font-size:0.8em;"><i class="fas fa-map-marker-alt"></i> ${postoData.endereco}</small>
                </div>
                <div style="max-height: 400px; overflow-y: auto; padding-right: 5px;">
                    ${htmlGestao}
                    ${htmlLeitura}
                </div>
            `,
            showConfirmButton: true,
            confirmButtonText: 'CONCLUIR',
            confirmButtonColor: '#8e44ad',
            allowOutsideClick: true,
            didClose: () => {
                if (houveAlteracaoNoPosto) {
                    carregarPostosVisuais();
                    houveAlteracaoNoPosto = false;
                }
            }
        });

    } catch (e) {
        console.error("Erro ao gerir posto:", e);
        Swal.fire('Erro', 'Não foi possível carregar os ativos.', 'error');
    }
}

async function vincularListaAoPosto(listaUid, postoUid, associar) {
    try {
        const listaRef = db.collection('listas_conferencia').doc(listaUid);
        const postoRef = db.collection('postos_estruturados').doc(postoUid);
        const dadosPosto = (await postoRef.get()).data();

        const nomeMilitar = currentUserData ? `${currentUserData.posto} ${currentUserData.quadro} ${currentUserData.nome_guerra}` : "SISTEMA";

        await listaRef.update({
            posto_id: associar ? postoUid : null,
            posto_nome: associar ? dadosPosto.nome : "NÃO VINCULADO",
            ultima_movimentacao_posto: firebase.firestore.FieldValue.serverTimestamp(),
            movimentado_por: nomeMilitar
        });

        houveAlteracaoNoPosto = true; // Gatilho para atualizar os cards ao fechar o modal

        // Toast discreto de sucesso (padrão Sigma V3)
        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
        Toast.fire({ icon: 'success', title: associar ? 'Viatura alocada!' : 'Viatura removida!' });

    } catch (e) {
        console.error("Erro no vínculo:", e);
        Swal.showValidationMessage(`Erro ao salvar: ${e.message}`);
    }
}
async function abrirFormularioPosto(dadosEdicao = null) {
    const isEdit = !!dadosEdicao;

    // Busca as unidades para preencher o novo seletor de Unidade Gestora
    const snapUnidades = await db.collection('unidades_estruturadas').where('ativo', '==', true).get();
    let optionsUnidades = '<option value="" disabled selected>Selecione a Unidade Responsável...</option>';

    snapUnidades.forEach(u => {
        const d = u.data();
        const selected = (isEdit && dadosEdicao.unidade_gestora_id === u.id) ? 'selected' : '';
        optionsUnidades += `<option value="${u.id}" data-sigla="${d.sigla}" ${selected}>${d.sigla} - ${d.nome_completo}</option>`;
    });

    Swal.fire({
        title: isEdit ? '<i class="fas fa-edit"></i> Editar Posto' : '<i class="fas fa-plus-circle"></i> Novo Posto',
        width: '550px',
        html: `
            <div style="padding: 5px; text-align: left;">
                <div class="swal-v3-form-group">
                    <label style="font-weight: 800; font-size: 0.75em; color: #64748b; text-transform: uppercase;">1. Nome do Posto / Base:</label>
                    <input type="text" id="swal-posto-nome" class="swal2-input" placeholder="Ex: PRONTIDÃO ALFA" value="${isEdit ? dadosEdicao.nome : ''}" style="margin: 5px 0 15px 0; width:100%; border-radius: 10px;">
                </div>

                <div class="swal-v3-form-group">
                    <label style="font-weight: 800; font-size: 0.75em; color: #64748b; text-transform: uppercase;">2. Unidade Gestora (Responsável pela Prontidão/Material):</label>
                    <select id="swal-posto-unidade-gestora" class="swal2-select" style="width:100%; margin: 5px 0 15px 0; border-radius: 10px; font-size: 0.9em;">
                        ${optionsUnidades}
                    </select>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="swal-v3-form-group">
                        <label style="font-weight: 800; font-size: 0.75em; color: #64748b; text-transform: uppercase;">3. Natureza:</label>
                        <select id="swal-posto-natureza" class="swal2-select" style="width:100%; margin: 5px 0 15px 0; border-radius: 10px; font-size: 0.85em;">
                            <option value="SERVIÇO OPERACIONAL" ${isEdit && dadosEdicao.natureza === 'SERVIÇO OPERACIONAL' ? 'selected' : ''}>OPERACIONAL</option>
                            <option value="MISSÃO" ${isEdit && dadosEdicao.natureza === 'MISSÃO' ? 'selected' : ''}>MISSÃO / ESPECIAL</option>
                        </select>
                    </div>
                    <div class="swal-v3-form-group">
                        <label style="font-weight: 800; font-size: 0.75em; color: #64748b; text-transform: uppercase;">4. Endereço:</label>
                        <input type="text" id="swal-posto-endereco" class="swal2-input" placeholder="Localização..." value="${isEdit ? dadosEdicao.endereco : ''}" style="margin: 5px 0 0 0; width:100%; border-radius: 10px; font-size: 0.85em;">
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: isEdit ? 'SALVAR ALTERAÇÕES' : 'GRAVAR POSTO',
        confirmButtonColor: '#800020',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const nome = document.getElementById('swal-posto-nome').value.trim().toUpperCase();
            const unidadeEl = document.getElementById('swal-posto-unidade-gestora');
            const gestora_id = unidadeEl.value;
            const gestora_sigla = unidadeEl.options[unidadeEl.selectedIndex].getAttribute('data-sigla');
            const natureza = document.getElementById('swal-posto-natureza').value;
            const endereco = document.getElementById('swal-posto-endereco').value.trim();

            if (!nome || !gestora_id) return Swal.showValidationMessage('Nome e Unidade Gestora são obrigatórios');

            return { nome, gestora_id, gestora_sigla, natureza, endereco };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            executarSalvamentoPosto(isEdit ? dadosEdicao.uid : null, result.value);
        }
    });
}
async function executarSalvamentoPosto(uid, dados) {
    Swal.fire({
        title: 'Sincronizando...',
        html: 'Gravando dados no território global.',
        didOpen: () => Swal.showLoading()
    });

    try {
        const uidFinal = uid || ("POSTO-" + Date.now());
        const postoRef = db.collection('postos_estruturados').doc(uidFinal);
        const dataHora = firebase.firestore.FieldValue.serverTimestamp();

        const payload = {
            uid: uidFinal,
            nome: dados.nome,
            natureza: dados.natureza,
            endereco: dados.endereco || "Não informado",

            // ✅ VÍNCULO DE GESTÃO (Substitui o menu Bases)
            unidade_gestora_id: dados.gestora_id,
            unidade_gestora_sigla: dados.gestora_sigla,

            ativo: true,
            atualizado_por: currentUserData.nome_militar_completo,
            ultima_atualizacao: dataHora
        };

        if (!uid) {
            payload.criado_em = dataHora;
            payload.criado_por_unidade = currentUserData.unidade || "SISTEMA";
        }

        await postoRef.set(payload, { merge: true });

        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
        });

        Toast.fire({
            icon: 'success',
            title: uid ? 'Posto atualizado!' : 'Novo posto cadastrado!'
        });

        carregarPostosVisuais();

    } catch (e) {
        console.error("Erro ao salvar posto:", e);
        Swal.fire({ icon: 'error', title: 'Falha na Gravação', confirmButtonColor: '#800020' });
    }
}
function filtrarPostosCards() {
    // Remove espaços e hífens para busca aproximada (Ex: "1 BBM" acha "1BBM")
    const termo = document.getElementById('input-busca-posto').value.trim().toUpperCase().replace(/[^A-Z0-9]/gi, '');
    const cards = document.querySelectorAll('#postos-cards-container .v3-posto-card');

    cards.forEach(card => {
        // Captura todo o texto (Nome, Endereço e agora a Unidade Gestora)
        const textoCard = card.innerText.toUpperCase().replace(/[^A-Z0-9]/gi, '');

        if (textoCard.includes(termo)) {
            card.style.display = "flex";
            card.style.animation = "fadeIn 0.3s ease";
        } else {
            card.style.display = "none";
        }
    });

    // Filtro de títulos de grupo (Mantido, está perfeito)
    document.querySelectorAll('.v3-group-title').forEach(title => {
        let proximo = title.nextElementSibling;
        let temVisivel = false;
        while (proximo && !proximo.classList.contains('v3-group-title')) {
            if (proximo.classList.contains('v3-posto-card') && proximo.style.display !== 'none') {
                temVisivel = true;
                break;
            }
            proximo = proximo.nextElementSibling;
        }
        title.style.display = temVisivel ? "flex" : "none";
    });
}
async function carregarPostosVisuais() {
    const container = document.getElementById('postos-cards-container');
    if (!container) return;

    // Loading Shimmer/Spinner V3 (Padronizado)
    container.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding:60px; color:#64748b;">
            <i class="fas fa-radar fa-spin fa-3x" style="opacity:0.3; margin-bottom:15px; display:block;"></i>
            <span style="font-weight:700; letter-spacing:1px; text-transform:uppercase; font-size:0.8em;">Sincronizando Territórios...</span>
        </div>`;

    try {
        // 1. Definição Cirúrgica de Permissão (Fácil manutenção posterior)
        const perfisAutorizadosAcoes = ['admin', 'gestor_geral'];
        const podeEditarOuExcluir = perfisAutorizadosAcoes.includes(currentUserData?.role);

        // 2. Busca dados em paralelo (Performance)
        const [snapPostos, snapListas] = await Promise.all([
            db.collection('postos_estruturados').where('ativo', '==', true).get(),
            db.collection('listas_conferencia').where('ativo', '==', true).get()
        ]);

        if (snapPostos.empty) {
            container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:50px; color:#94a3b8;"><i class="fas fa-map-marked fa-3x" style="opacity:0.2; margin-bottom:15px; display:block;"></i>Nenhum posto de serviço cadastrado.</div>`;
            return;
        }

        const todasListas = snapListas.docs.map(d => d.data());
        const postos = snapPostos.docs.map(d => ({ id: d.id, ...d.data() }));

        // --- DIVISÃO POR GRUPOS (OPERACIONAL VS MISSÃO) ---
        const operacionais = postos.filter(p => p.natureza === 'SERVIÇO OPERACIONAL' || !p.natureza);
        const missoes = postos.filter(p => p.natureza === 'MISSÃO');

        let htmlFinal = '';

        const renderGrupo = (lista, titulo, cor) => {
            if (lista.length === 0) return '';
            let htmlGrupo = `<div class="v3-group-title" style="grid-column: 1/-1; display: flex; align-items: center; gap: 12px; margin: 30px 0 15px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; color: #1e293b; font-weight: 800; text-transform: uppercase; font-size: 0.9em; letter-spacing: 1px;">
                <i class="fas fa-house-flag" style="color:${cor}"></i> ${titulo} (${lista.length})
            </div>`;

            lista.forEach(posto => {
                const ativosNoPosto = todasListas.filter(l => l.posto_id === posto.id);
                const nomesAtivos = ativosNoPosto.map(l => l.ativo_nome);

                const isMissao = posto.natureza === 'MISSÃO';
                const corTema = isMissao ? '#2c3e50' : '#800020';
                const borderStyle = `border-left: 6px solid ${corTema} !important;`;

                htmlGrupo += `
                    <div class="v3-posto-card" 
                         onclick="abrirGestaoPosto('${posto.id}')"
                         style="${borderStyle} padding: 0; background: #fff; border-radius: 20px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; height: 100%; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); position: relative; cursor: pointer; box-sizing: border-box;">
                        
                        <div class="v3-posto-actions" style="position: absolute; top: 12px; right: 12px; display: flex; gap: 8px; z-index: 5;">
                            ${podeEditarOuExcluir ? `
                                <button class="v3-btn-action" style="background:none; border:none; color:#cbd5e1; cursor:pointer;" 
                                        onclick="event.stopPropagation(); abrirFormularioPosto({ uid: '${posto.id}', nome: '${posto.nome}', endereco: '${posto.endereco}', natureza: '${posto.natureza || 'SERVIÇO OPERACIONAL'}' })">
                                    <i class="fas fa-pencil-alt"></i>
                                </button>
                                <button class="v3-btn-action" style="background:none; border:none; color:#cbd5e1; cursor:pointer;" 
                                        onclick="event.stopPropagation(); deletarPostoSistema('${posto.id}', '${posto.nome}')">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            ` : `<i class="fas fa-lock" style="color:#cbd5e1; font-size: 0.8em; margin: 4px;" title="Somente Leitura"></i>`}
                        </div>
                        
                        <div style="padding: 20px; flex-grow: 1; display: flex; flex-direction: column; align-items: center; text-align: center;">
                            <div class="v3-icon-box" style="width: 50px; height: 50px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.4em; margin-bottom: 15px; background: ${corTema}10; color: ${corTema}; flex-shrink: 0;">
                                <i class="fas fa-house-flag"></i>
                            </div>

                            <div style="width: 100%; margin-bottom: 10px;">
                                <span style="display:block; font-weight:900; font-size:1.15em; color:#1e293b; letter-spacing:-0.4px; margin-bottom: 4px;">
                                    ${posto.nome}
                                </span>
                                <div style="display: flex; align-items: center; justify-content: center; gap: 5px; color: #64748b; font-size: 0.8em; font-weight: 600;">
                                    <i class="fas fa-map-marker-alt" style="opacity:0.5; color:#ef4444; font-size: 0.9em;"></i>
                                    <span style="line-height: 1.2;">${posto.endereco || 'Local não definido'}</span>
                                </div>
                            </div>

                            <div style="width: 100%; margin-top: auto; padding-top: 12px; border-top: 1px solid #f1f5f9;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 5px;">
                                    <span style="font-weight:800; color:#94a3b8; text-transform:uppercase; font-size:0.65em; letter-spacing:0.5px;">Ativos Alocados</span>
                                    <span style="font-size:0.85em; font-weight:900; color:${corTema};">${ativosNoPosto.length}</span>
                                </div>
                                <div style="color:#475569; font-weight:700; font-size:0.78em; line-height:1.4;">
                                    ${nomesAtivos.length > 0 ? nomesAtivos.join(' • ') : '<span style="color:#cbd5e1; font-weight:500; font-style:italic;">Nenhum ativo alocado</span>'}
                                </div>
                            </div>
                        </div>
                    </div>`;
            });
            return htmlGrupo;
        };

        htmlFinal = renderGrupo(operacionais, 'Prontidão Operacional', '#800020') +
            renderGrupo(missoes, 'Missões e Reforços', '#2c3e50');

        container.innerHTML = htmlFinal;

    } catch (e) {
        console.error("Erro fatal ao carregar postos:", e);
        container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:40px; color:#e11d48;"><i class="fas fa-exclamation-circle fa-2x"></i><br><b>Erro ao sincronizar territórios.</b></div>`;
    }
}

async function deletarPostoSistema(uid, nome) {
    // 1. Confirmação de Segurança com Design Crítico
    const confirmacao = await Swal.fire({
        title: 'Excluir Posto?',
        html: `Você está prestes a remover <b>${nome}</b>.<br><br>
               <div style="font-size: 0.8em; background: #fff5f5; color: #c53030; padding: 10px; border-radius: 8px; border: 1px solid #feb2b2;">
                <i class="fas fa-exclamation-triangle"></i> <b>AVISO:</b> Viaturas vinculadas a este posto ficarão com o local indefinido.
               </div>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'SIM, EXCLUIR',
        cancelButtonText: 'CANCELAR',
        reverseButtons: true
    });

    if (!confirmacao.isConfirmed) return;

    // Feedback de processamento
    Swal.fire({
        title: 'Removendo...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const batch = db.batch();
        const postoRef = db.collection('postos_estruturados').doc(uid);
        const legacyRef = db.collection('config_geral').doc('postos');

        // 2. Limpeza do legado (Coleção antiga de strings)
        batch.update(legacyRef, {
            lista: firebase.firestore.FieldValue.arrayRemove(nome)
        });

        // 3. Desativação Lógica (Padrão de Auditoria Sigma)
        batch.update(postoRef, {
            ativo: false,
            data_exclusao: firebase.firestore.FieldValue.serverTimestamp(),
            excluido_por: currentUserData?.nome_militar_completo || "SISTEMA"
        });

        await batch.commit();

        // 4. Feedback Visual Imediato (Efeito de Desintegração)
        const cards = document.querySelectorAll('.unit-building-card');
        cards.forEach(card => {
            // Verifica o UID ou o texto para garantir que removemos o card certo
            if (card.innerHTML.includes(uid) || card.innerText.includes(nome)) {
                card.style.transition = "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)";
                card.style.opacity = "0";
                card.style.transform = "translateY(20px) scale(0.9)";
                card.style.filter = "blur(10px)";

                setTimeout(() => {
                    card.remove();
                    // Se o grid ficar vazio, recarrega a mensagem de "Nenhum posto"
                    const restantes = document.querySelectorAll('#postos-cards-container .unit-building-card');
                    if (restantes.length === 0) carregarPostosVisuais();
                }, 600);
            }
        });

        // Toast de confirmação final
        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
        Toast.fire({ icon: 'success', title: 'Posto removido com sucesso' });

    } catch (e) {
        console.error("Erro ao excluir posto:", e);
        Swal.fire({
            icon: 'error',
            title: 'Erro Técnico',
            text: 'Não foi possível desativar o posto no banco de dados.',
            confirmButtonColor: '#8e44ad'
        });
    }
}
function reimprimirPDF(data) {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const MARGIN = 14, PG_W = 210, LOGO_S = 15;

        // ✅ Identificação de Modo e Identidade Visual (Adicionado TRANSFERENCIA)
        const isChecklist = data.modo === 'CHECKLIST_VISTORIA';
        const isTransferencia = data.modo === 'TRANSFERENCIA_CARGA';

        // Cores: Bordô para Relatórios, Azul Petróleo para Vistorias, Cinza Grafite para Transferências
        const COR_PRIMARIA = isChecklist ? [44, 62, 80] : (isTransferencia ? [33, 37, 41] : [128, 0, 32]);
        const TITULO_DOC = isChecklist ? "RELATÓRIO DE VISTORIA DE VIATURA" : (isTransferencia ? "TERMO DE TRANSFERÊNCIA DE CARGA" : "RELATÓRIO DE CONFERÊNCIA");

        const logoDraw = (domId, x) => {
            const el = document.querySelector(`img[src*="${domId}"]`);
            if (el) {
                try {
                    const c = document.createElement('canvas');
                    c.width = 160; c.height = 160;
                    c.getContext('2d').drawImage(el, 0, 0, 160, 160);
                    doc.addImage(c.toDataURL('image/png'), 'PNG', x, 10, LOGO_S, LOGO_S);
                } catch (e) { console.warn(`Logo erro: ${domId}`); }
            }
        };

        logoDraw('cbmrr.png', MARGIN);
        logoDraw('logo_sigma.png', PG_W - MARGIN - LOGO_S);

        // Cabeçalho Institucional
        doc.setFontSize(10).setTextColor(51).setFont('helvetica', 'bold');
        doc.text('GOVERNO DE RORAIMA', PG_W / 2, 15, { align: 'center' });
        doc.setTextColor(217, 15, 35).text('CORPO DE BOMBEIROS MILITAR DE RORAIMA', PG_W / 2, 20, { align: 'center' });
        doc.setTextColor(51).setFont('helvetica', 'italic').text('"Amazônia: patrimônio dos brasileiros"', PG_W / 2, 25, { align: 'center' });

        // Título Dinâmico
        doc.setFontSize(14).setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]).setFont('helvetica', 'bold').text(TITULO_DOC, PG_W / 2, 35, { align: 'center' });

        // ✅ Container de Informações Adaptável (Box Cinza)
        const boxHeight = (isChecklist || isTransferencia) ? 32 : 25;
        doc.setFillColor(240, 240, 240).setDrawColor(200, 200, 200).roundedRect(MARGIN, 40, PG_W - (MARGIN * 2), boxHeight, 2, 2, 'FD');

        const dataTimestamp = data.timestamp?.seconds ? new Date(data.timestamp.seconds * 1000) : new Date();

        if (isTransferencia) {
            // Layout Específico para Transferência (Origem vs Destino)
            doc.setFontSize(9).setTextColor(50).setFont('helvetica', 'bold').text('GUIA Nº:', MARGIN + 5, 46);
            doc.setFont('helvetica', 'normal').text(data.id_amigavel || data.id, MARGIN + 35, 46);
            doc.setFont('helvetica', 'bold').text('ORIGEM:', MARGIN + 5, 52);
            doc.setFont('helvetica', 'normal').text(`${data.origem_sigla} (${data.emitente})`, MARGIN + 35, 52);
            doc.setFont('helvetica', 'bold').text('DESTINO:', MARGIN + 5, 58);
            doc.setFont('helvetica', 'normal').text(`${data.destino_sigla} (${data.conferente})`, MARGIN + 35, 58);
            doc.setFont('helvetica', 'bold').text('DATA REC:', MARGIN + 5, 64);
            doc.setFont('helvetica', 'normal').text(dataTimestamp.toLocaleString('pt-BR'), MARGIN + 35, 64);
        } else {
            // Layout Original (Checklist/Conferência)
            doc.setFontSize(9).setTextColor(50).setFont('helvetica', 'bold').text(isChecklist ? 'Viatura:' : 'Local:', MARGIN + 5, 46);
            doc.setFont('helvetica', 'normal').text(data.local || '', MARGIN + 35, 46);
            doc.setFont('helvetica', 'bold').text('Conferente:', MARGIN + 5, 52);
            doc.setFont('helvetica', 'normal').text(data.conferente || '', MARGIN + 35, 52);
            doc.setFont('helvetica', 'bold').text('Data/Hora:', MARGIN + 5, 58);
            doc.setFont('helvetica', 'normal').text(dataTimestamp.toLocaleString('pt-BR'), MARGIN + 35, 58);

            if (isChecklist) {
                doc.setFont('helvetica', 'bold').text('Odômetro:', MARGIN + 5, 64);
                doc.setFont('helvetica', 'normal').text(`${data.km_entrada || '0'} KM`, MARGIN + 35, 64);
                doc.setFont('helvetica', 'bold').text('Tanque:', MARGIN + 100, 64);
                doc.setFont('helvetica', 'normal').text(`${data.combustivel_entrada || 'N/D'}`, MARGIN + 120, 64);
            }
        }

        doc.setFont('helvetica', 'bold').setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]).text(`ITENS: ${data.totalItensConferidos || 0} | C/A: ${data.totalCaa || 0}`, PG_W - MARGIN - 5, 46, { align: 'right' });

        // Montagem da Tabela
        let tableBody = [];
        const RED_FILL = [217, 15, 35], GREEN_FILL = [27, 138, 62], SECTOR_BG = (isChecklist || isTransferencia) ? COR_PRIMARIA : [60, 60, 60];
        let listaParaImprimir = data.itensRelatorio || data.itensCaa || [];

        if (listaParaImprimir.length > 0) {
            let currentSector = null;
            listaParaImprimir.forEach(item => {
                const nomeSetor = (item.setor || "").toUpperCase();
                if (isChecklist && (nomeSetor.includes("FOTO") || nomeSetor.includes("OBSERVAÇ"))) return;

                let setorItem = item.setor || "ITENS GERAIS";
                if (setorItem !== currentSector) {
                    tableBody.push([{ content: setorItem.toUpperCase(), colSpan: 4, styles: { fillColor: SECTOR_BG, textColor: 255, fontStyle: 'bold', halign: 'left' } }]);
                    currentSector = setorItem;
                }

                let finalObs = '-';
                if (item.pendencias_ids && item.pendencias_ids.length > 0) {
                    // ✅ AJUSTE CIRÚRGICO: Inclusão da data e formatação padrão SIGMA
                    finalObs = item.pendencias_ids.map(p => {
                        const dataP = p.data_criacao || "";
                        return `\u2022 Por ${p.autor_nome}${dataP ? ' em ' + dataP : ''}: ${p.descricao}`;
                    }).join('\n');
                } else if (item.obs) {
                    finalObs = item.obs;
                }

                let bgStatus = (item.status === 'C/A') ? RED_FILL : GREEN_FILL;

                tableBody.push([
                    item.nomeCompleto || 'Item',
                    { content: `${item.quantidade || 1} un.`, styles: { halign: 'center' } },
                    { content: item.status || 'S/A', styles: { fillColor: bgStatus, textColor: 255, fontStyle: 'bold', halign: 'center' } },
                    { content: finalObs, styles: { halign: 'left', fontSize: 7 } }
                ]);
            });
        }

        doc.autoTable({
            startY: 45 + boxHeight,
            head: [['Descrição do Item', 'Qtd', 'Status', 'Observações / Pendências']],
            body: tableBody,
            theme: 'striped',
            styles: { fontSize: 8, valign: 'middle', textColor: 51, cellPadding: 2 },
            columnStyles: { 0: { cellWidth: 75 }, 1: { cellWidth: 15 }, 2: { cellWidth: 15 }, 3: { cellWidth: 'auto' } },
            headStyles: { fillColor: COR_PRIMARIA, textColor: 255, fontStyle: 'bold', halign: 'center' }
        });

        let finalY = doc.lastAutoTable.finalY + 10;

        // ✅ SEÇÃO ORIGINAL PRESERVADA: Considerações Gerais
        if (isChecklist && data.obs_gerais_vistoria) {
            if (finalY > 250) { doc.addPage(); finalY = 20; }
            doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
            doc.text("CONSIDERAÇÕES GERAIS DA VISTORIA:", MARGIN, finalY);
            doc.setFont('helvetica', 'normal').setTextColor(50).setFontSize(9);
            const splitObs = doc.splitTextToSize(data.obs_gerais_vistoria, PG_W - (MARGIN * 2));
            doc.text(splitObs, MARGIN, finalY + 6);
            finalY += (splitObs.length * 5) + 12;
        }

        // ✅ SEÇÃO ORIGINAL PRESERVADA: Registro Fotográfico
        if (isChecklist) {
            if (finalY > 230) { doc.addPage(); finalY = 20; }
            doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
            doc.text("EVIDÊNCIAS FOTOGRÁFICAS (ANEXOS):", MARGIN, finalY);

            const boxW = 55, boxH = 40, spacing = 5;
            for (let i = 0; i < 5; i++) {
                const col = i % 3;
                const row = Math.floor(i / 3);
                const xPos = MARGIN + (col * (boxW + spacing));
                const yPos = finalY + 5 + (row * (boxH + spacing));

                doc.setDrawColor(200).setFillColor(245).rect(xPos, yPos, boxW, boxH, 'F');
                doc.setFontSize(7).setTextColor(150).text(`FOTO ${i + 1}`, xPos + boxW / 2, yPos + boxH / 2, { align: 'center' });
                doc.text("(Aguardando Integração Storage)", xPos + boxW / 2, yPos + boxH / 2 + 4, { align: 'center' });
            }
        }

        // Rodapé Institucional + Autenticidade Digital
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8).setTextColor(100).setFont('helvetica', 'normal');

            // Texto original
            doc.text('SIGMA - Sistema Integrado de Gestão de Materiais e Vistorias', MARGIN, doc.internal.pageSize.height - 10);
            doc.text(`Pág. ${i} de ${totalPages}`, PG_W - MARGIN, doc.internal.pageSize.height - 10, { align: 'right' });

            // ✅ NOVO: Hash de Autenticidade (Selo de segurança)
            const hashSimples = btoa(`${data.id}-${data.conferente}`).substring(0, 20).toUpperCase();
            doc.setFontSize(7).setTextColor(150).setFont('courier', 'normal');
            doc.text(`CHAVE DE AUTENTICIDADE: ${hashSimples}`, MARGIN, doc.internal.pageSize.height - 15);
        }

        const dataIso = dataTimestamp.toISOString().split('T')[0];
        const prefixo = isTransferencia ? 'Termo_Carga' : (isChecklist ? 'Vistoria' : 'Relatorio');
        const nomeArquivo = `${prefixo}_${(data.local || 'Conf').replace(/[^a-zA-Z0-9]/g, '')}_${dataIso}.pdf`;

        // Gera os dados binários (Blob) e cria a URL temporária
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);

        // Alimenta o Modal Sigma V3
        document.getElementById('sigma-v3-pdf-frame').src = pdfUrl;
        document.getElementById('pdf-modal-filename').textContent = nomeArquivo;
        document.getElementById('modal-pdf-viewer').style.display = 'flex';

        // Salva globalmente para as funções de Imprimir/Compartilhar
        window.currentPdfBlob = pdfBlob;
        window.currentPdfName = nomeArquivo;

    } catch (e) {
        console.error("Erro PDF Unificado:", e);
        alert("Erro ao gerar PDF: " + e.message);
    }
}
/* --- FUNÇÕES DE CONTROLE DO VISUALIZADOR DE PDF SIGMA V3 --- */

// 1. FECHAR: Limpa a memória e esconde o modal
function fecharVisualizadorPdf() {
    const frame = document.getElementById('sigma-v3-pdf-frame');
    if (frame) frame.src = 'about:blank'; // Evita rastro do PDF anterior
    document.getElementById('modal-pdf-viewer').style.display = 'none';
}

// 2. IMPRIMIR: Foca no documento e dispara a impressora
function imprimirPdfInterno() {
    const frame = document.getElementById('sigma-v3-pdf-frame');
    if (frame && frame.contentWindow) {
        frame.contentWindow.focus();
        frame.contentWindow.print();
    } else {
        alert("Não foi possível acionar a impressora neste navegador.");
    }
}

// 3. COMPARTILHAR: Integração nativa com Android/iOS (WhatsApp, etc)
async function compartilharPdfInterno() {
    if (!window.currentPdfBlob) return alert("Nenhum arquivo pronto para compartilhar.");

    const file = new File([window.currentPdfBlob], window.currentPdfName, { type: 'application/pdf' });

    // Verifica se o navegador suporta compartilhamento de arquivos (Mobile e Safari Desktop)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                title: 'SIGMA - Relatório',
                text: 'Segue em anexo o relatório gerado pelo sistema SIGMA.',
                files: [file]
            });
        } catch (err) {
            console.log("Compartilhamento cancelado.");
        }
    } else {
        // Fallback: Se não suportar share, ele faz o download como segurança
        const link = document.createElement('a');
        link.href = URL.createObjectURL(window.currentPdfBlob);
        link.download = window.currentPdfName;
        link.click();
        Swal.fire({ icon: 'info', title: 'Download realizado', text: 'Seu dispositivo não suporta compartilhamento direto, o arquivo foi baixado.', timer: 2000 });
    }
}
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
function atualizarPerfilHeader(dados) {
    if (dados.nome) document.getElementById('user-name-top').innerText = dados.nome;
    if (dados.nivel) document.getElementById('user-role-top').innerText = dados.nivel;
    if (dados.unidade) document.getElementById('user-unit-top').innerText = dados.unidade;
    if (dados.nivel) document.getElementById('user-access-top').innerText = dados.nivel;

    // Atualiza o avatar se houver
    if (dados.foto) {
        document.getElementById('user-avatar-top').src = dados.foto;
    }
}
function renderizarDadosUsuario(dados) {
    // 1. Preenche o Nome e Posto na saudação da Header
    const elNome = document.getElementById('user-name-top');
    if (elNome) {
        elNome.innerText = dados.militar_nome || dados.nome || "Militar";
    }

    // 2. Preenche o Nível de Acesso abaixo do nome
    const elNivel = document.getElementById('user-role-top');
    if (elNivel) {
        elNivel.innerText = dados.nivel_acesso || "Usuário";
    }

    // 3. Preenche a Unidade dentro do Dropdown
    const elUnidade = document.getElementById('user-unit-top');
    if (elUnidade) {
        elUnidade.innerText = dados.unidade_nome || dados.unidade || "Não vinculada";
    }

    // 4. Preenche o Acesso dentro do Dropdown (detalhado)
    const elAcesso = document.getElementById('user-access-top');
    if (elAcesso) {
        elAcesso.innerText = dados.nivel_acesso || "Padrão";
    }

    // 5. Atualiza a Foto do Avatar
    const elAvatar = document.getElementById('user-avatar-top');
    if (elAvatar && dados.foto_url) {
        elAvatar.src = dados.foto_url;
    }
}

function switchView(v) {
    // 1. LIMPEZAS E PREPARAÇÕES INICIAIS
    const editorArq = document.getElementById('view-editor-arquitetura');
    if (editorArq) editorArq.style.display = 'none';

    const contentPrincipal = document.querySelector('.content');
    if (contentPrincipal) contentPrincipal.style.padding = '20px';

    document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');

    const appRunner = document.getElementById('app-runner-container');
    if (appRunner) { appRunner.style.display = 'none'; }

    // ✅ LIMPEZA DE LAYOUT: Reseta o container master e garante que colunas fantasmas não apareçam
    const masterContainer = document.getElementById('dashboard-content-by-role');
    const detailPlaceholder = document.getElementById('detail-placeholder');
    const detailColumn = document.querySelector('.dashboard-detail-column'); // Segunda coluna
    const caTableWrapper = document.getElementById('ca-table-wrapper');

    if (masterContainer) {
        masterContainer.classList.remove('dashboard-operacional-full');
        // Se não for dashboard, garante que o container master-detail suma por completo
        if (v !== 'dashboard') {
            masterContainer.style.setProperty('display', 'none', 'important');
        }
    }

    // ✅ HIGIENE DE DETALHES: Garante que a segunda coluna e placeholders sumam ao trocar de tela
    if (detailPlaceholder) detailPlaceholder.style.display = 'none';
    if (caTableWrapper) caTableWrapper.style.display = 'none';
    if (detailColumn) detailColumn.style.setProperty('display', 'none', 'important');

    // ✅ LIMPEZA DE CONTAINER OPERACIONAL: Evita carregar lixo visual
    const opContainer = document.getElementById('operacional-cards-container');
    if (opContainer && v !== 'dashboard') opContainer.innerHTML = '';

    // Limpa todos os links ativos (Pai e Submenu)
    document.querySelectorAll('#main-sidebar a, .sigma-v3-submenu a').forEach(el => el.classList.remove('active'));

    // BLOCO INTERCEPTADOR DE CAUTELAS
    if (v && v.startsWith('cautelas')) {
        const viewCautelas = document.getElementById('view-cautelas');
        if (viewCautelas) viewCautelas.style.display = 'block';

        const container = document.getElementById('cautelas-content');
        if (container) container.innerHTML = '<div style="text-align:center; padding:50px;"><i class="fas fa-sync fa-spin"></i> Preparando tela...</div>';

        if (v === 'cautelas-nova') loadNewCautelaForm();
        else if (v === 'cautelas-ativas') showCautelasDashboard('Cautelas Ativas');
        else if (v === 'cautelas-receber') showCautelasDashboard('Cautelas a Receber');
        else if (v === 'cautelas-historico') showCautelasDashboard('Histórico');

        const subLink = document.getElementById(`link-${v}`);
        if (subLink) subLink.classList.add('active');
        return;
    }

    // 2. DEFINIÇÃO DINÂMICA DA VIEW
    let targetId;
    if (v === 'listas') {
        targetId = 'menu-editor-listas';
    } else if (v === 'editor-arquitetura') {
        targetId = 'view-editor-arquitetura';
    } else {
        targetId = `view-${v}`;
    }

    const viewElement = document.getElementById(targetId);
    if (viewElement) {
        viewElement.style.display = 'block';
    } else {
        console.error(`View não encontrada: ${targetId}`);
        return;
    }

    // 3. ATIVAÇÃO VISUAL DO LINK NA SIDEBAR
    const activeLink = document.getElementById(`link-${v}`);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    // 4. DISPARO DE CARREGAMENTO DE DADOS ESPECÍFICOS
    if (v === 'dashboard') {
        const resCont = document.getElementById('resume-container');
        const adminCont = document.getElementById('admin-gestor-cards-container');
        if (resCont) resCont.innerHTML = '';
        
        carregarAlertasTransferencia();

        if (currentUserData) {
            const role = currentUserData.role || 'operacional';
            if (role === 'operacional') {
                // ✅ AJUSTE OPERACIONAL: Container Master como BLOCK (1 coluna) e esconde detalhes
                if (masterContainer) masterContainer.style.setProperty('display', 'block', 'important');
                if (detailColumn) detailColumn.style.setProperty('display', 'none', 'important');
                renderOperacionalCards();
            } else {
                // ✅ AJUSTE GESTOR: Container Master como FLEX (2 colunas) e ativa detalhes
                if (masterContainer) masterContainer.style.setProperty('display', 'flex', 'important');
                if (detailColumn) detailColumn.style.setProperty('display', 'block', 'important');
                
                // 🚀 AQUI ESTAVA O ERRO: Chamamos a função que DESENHA o placeholder e 
                // internamente ela já dispara o loadCaaData().
                const canViewDashboardCards = true; // Ou use sua variável de permissão
                renderAdminGestorCards(canViewDashboardCards);
            }
        }
    }

    if (v === 'almoxarifado') carregarAlmoxarifadoUI();
    if (v === 'unidades') { carregarUnidadesVisuais(); configurarBuscaComandanteUnidade(); }
    if (v === 'postos') carregarPostosVisuais();
    if (v === 'vtr-bases') carregarVtrBasesCards();
    if (v === 'usuarios') carregarUsuariosVisuais();
    if (v === 'listas') carregarCardsListasExistentes();

    if (v === 'my-history') {
        const tabsContainer = document.getElementById('atividades-tabs-container');
        if (currentUserData && tabsContainer) {
            const role = currentUserData.role;
            const isGestor = (role === 'admin' || role === 'gestor_geral' || role === 'gestor');
            tabsContainer.style.display = isGestor ? 'flex' : 'none';
        }

        const startInput = document.getElementById('my-hist-start');
        const endInput = document.getElementById('my-hist-end');
        
        const dataHoje = new Date().toISOString().split('T')[0];
        const dataInicio = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];

        if (startInput) startInput.value = dataInicio;
        if (endInput) endInput.value = dataHoje;

        if (currentUserData.role !== 'operacional') {
            carregarUsuariosFiltro();
            const globStart = document.getElementById('glob-hist-start');
            const globEnd = document.getElementById('glob-hist-end');
            if (globStart) globStart.value = dataInicio;
            if (globEnd) globEnd.value = dataHoje;
        }

        if (typeof flatpickr !== 'undefined') {
            flatpickr(".sigma-v3-date-input", {
                dateFormat: "Y-m-d",
                altInput: true,
                altFormat: "d/m/Y",
                allowInput: true,
                locale: "pt"
            });
        }

        switchAtividadesTab('pessoal');
        loadMyHistory();
    }

    // 5. TRATAMENTO MOBILE
    if (window.innerWidth <= 768) {
        history.pushState(null, null, location.href);
        if (typeof closeMenuMobile === "function") closeMenuMobile();
    }
}

// Força o fechamento do menu e do fundo escurecido (overlay)
function closeMenuMobile() {
    const s = document.getElementById('main-sidebar');
    const overlay = document.getElementById('mobile-overlay');

    if (s) s.classList.remove('mobile-active');
    if (overlay) overlay.style.display = 'none';
}

// --- FUNÇÕES DO MODAL GESTÃO C/A ---
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

            const btnData = {
                docId: data.docId,
                listaId: data.lista_id,
                itemId: p.itemId,
                pendenciaId: p.id,
                nome: p.itemNome,
                tombamento: p.tombamento || "",
                descricao: p.descricao,
                qtd: p.quantidade
            };
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
                    `<button class="sigma-v3-btn-manage" onclick='abrirModalGestaoID(${btnJson})'>
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

function abrirModalGestaoID(data) {
    // 1. Elementos de Interface
    const elNome = document.getElementById('gestao-item-nome');
    const elObs = document.getElementById('gestao-obs');
    const modal = document.getElementById('modal-gestao-ca');

    if (!modal) return console.error("Modal de gestão não encontrado no HTML.");

    // 2. Preenchimento de Identidade do Material
    elNome.textContent = data.nome || data.nomeCompleto || "Item não identificado";

    // 3. Mapeamento de IDs para o Processamento (Inputs Hidden)
    // Certifique-se que esses IDs existem no seu HTML
    document.getElementById('gestao-doc-id').value = data.docId || "";           // Resultado da Conf.
    document.getElementById('gestao-item-id-lista').value = data.itemId || "";   // UID Global (Inventário)

    const inputPendId = document.getElementById('gestao-pendencia-id');
    if (inputPendId) {
        inputPendId.value = data.pendenciaId || ""; // O ID da Pendência (PEND-...)
    }

    // 4. Configuração do Campo de Texto
    if (elObs) {
        elObs.value = '';
        const desc = data.descricao || "Sem descrição";
        elObs.placeholder = `Descreva a solução para: ${desc}`;
    }

    // 5. Reset de campos de quantidade (se houver)
    const elQtd = document.getElementById('gestao-qtd');
    if (elQtd) elQtd.value = data.qtd || data.quantidade || '1';

    // 6. Exibição
    modal.style.display = 'flex';
    console.log("🛠️ Modal de Gestão aberto para a pendência:", data.pendenciaId);
}
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

function toggleGestaoQtd() {
    const status = document.getElementById('gestao-status').value;
    const divQtd = document.getElementById('div-gestao-qtd');
    const max = document.getElementById('gestao-item-max-qtd').value;
    const inputQtd = document.getElementById('gestao-qtd');
    const infoQtd = document.getElementById('gestao-qtd-info');

    if (status === 'Solucionado') {
        divQtd.style.display = 'block';
        inputQtd.max = max; // Define o limite físico no input
        infoQtd.textContent = `Máximo disponível para solução: ${max} un.`;
    } else {
        divQtd.style.display = 'none';
    }
}

document.getElementById('gestao-status').onchange = toggleGestaoQtd;

async function salvarGestaoCa() {
    const docId = document.getElementById('gestao-doc-id').value;          // Doc em resultados_conferencias
    const itemId = document.getElementById('gestao-item-id-lista').value;  // UID Global (DNA do material)
    const pendId = document.getElementById('gestao-pendencia-id').value;   // ID da pendência (PEND-...)
    const statusAcao = document.getElementById('gestao-status').value;     // Solucionado, Em solução, etc.
    const obsGestor = document.getElementById('gestao-obs').value.trim();
    const qtdInformada = parseInt(document.getElementById('gestao-qtd').value) || 1;

    if (!obsGestor) return alert("Descreva a ação tomada.");

    const btnSalvar = document.querySelector('.btn-sync');
    btnSalvar.disabled = true;
    btnSalvar.textContent = "PROCESSANDO...";

    try {
        const nomeGestor = `${currentUserData.posto} ${currentUserData.nome_guerra}`;
        const dataHora = new Date().toLocaleString('pt-BR');
        const batch = db.batch();

        // 1. ATUALIZAR NO REGISTRO DE RESULTADOS (DASHBOARD)
        const resRef = db.collection('resultados_conferencias').doc(docId);
        const resSnap = await resRef.get();
        if (!resSnap.exists) throw new Error("Registro de conferência não encontrado.");

        let resData = resSnap.data();
        let itensRelatorio = resData.itensRelatorio || []; // Usamos itensRelatorio que é a fonte oficial do PDF

        const itemRes = itensRelatorio.find(i => i.id === itemId || i.uid_global === itemId);

        if (itemRes && itemRes.pendencias_ids) {
            const pIdx = itemRes.pendencias_ids.findIndex(p => p.id === pendId);
            if (pIdx > -1) {
                if (statusAcao === 'Solucionado') {
                    itemRes.pendencias_ids.splice(pIdx, 1); // Remove do dashboard pois foi resolvido
                    if (itemRes.pendencias_ids.length === 0) itemRes.status = 'S/A';
                } else {
                    itemRes.pendencias_ids[pIdx].status_gestao = statusAcao.toUpperCase();
                    itemRes.pendencias_ids[pIdx].descricao += `\n[GESTÃO ${dataHora} - ${nomeGestor}]: ${obsGestor}`;
                }
            }
        }
        batch.update(resRef, { itensRelatorio });

        // 2. SINCRONIZAÇÃO COM O INVENTÁRIO (DEVOLUÇÃO DE SALDO)
        // ✅ AJUSTE CIRÚRGICO: Se resolvido, o saldo sai de PENDENTE e volta para DISPONÍVEL
        if (statusAcao === 'Solucionado' && itemId) {
            const unidadeId = currentUserData.unidade_id || "UNID-1767838511310";
            const saldoRef = db.collection('inventario').doc(itemId).collection('saldos_unidades').doc(unidadeId);

            batch.update(saldoRef, {
                qtd_disp: firebase.firestore.FieldValue.increment(qtdInformada),
                qtd_pend: firebase.firestore.FieldValue.increment(-qtdInformada),
                last_update: dataHora
            });

            // Registro no Histórico de Vida do Material
            const histRef = saldoRef.collection('historico_vida').doc("SOL-" + Date.now());
            batch.set(histRef, {
                data: dataHora,
                evento: "SOLUCAO_GESTOR",
                quem: nomeGestor,
                detalhes: `✅ Pendência ${pendId} resolvida via Dashboard. Despacho: ${obsGestor}`,
                quantidade: qtdInformada
            });
        }

        await batch.commit();

        Swal.fire({
            icon: 'success',
            title: 'Ação Registrada!',
            text: statusAcao === 'Solucionado' ? 'O item retornou ao status DISPONÍVEL no inventário.' : 'Status de solução atualizado.',
            confirmButtonColor: '#800020'
        });

        document.getElementById('modal-gestao-ca').style.display = 'none';
        if (typeof loadCaaData === 'function') loadCaaData();
        if (typeof fecharTabela === 'function') fecharTabela();

    } catch (e) {
        console.error("Erro na gestão:", e);
        alert("Erro ao processar ação: " + e.message);
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = "Salvar Ação";
    }
}

/* --- FUNÇÕES DE CONTROLE DE ABAS (Atividades Pessoais x Unidade) --- */
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

        loadGlobalHistory(); // Recarrega os dados da unidade
    }
}

/*GESTÃO DE USUÁRIOS*/

async function abrirFormularioUsuario(dadosEdicao = null) {
    const isEdit = !!dadosEdicao;

    // Feedback imediato de carregamento
    Swal.fire({ title: 'Acessando Banco...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        // Busca unidades para o seletor
        const snapUnidades = await db.collection('unidades_estruturadas').where('ativo', '==', true).get();
        let optUnidades = '<option value="" disabled selected>Selecione a Unidade...</option>';
        snapUnidades.forEach(doc => {
            const u = doc.data();
            const sel = isEdit && dadosEdicao.unidade_id === doc.id ? 'selected' : '';
            optUnidades += `<option value="${doc.id}" ${sel}>${u.sigla}</option>`;
        });

        Swal.fire({
            title: isEdit ? '<i class="fas fa-user-edit"></i> EDITAR DADOS' : '<i class="fas fa-user-plus"></i> NOVO MILITAR',
            width: '750px',
            confirmButtonText: isEdit ? 'SALVAR ALTERAÇÕES' : 'GRAVAR MILITAR',
            confirmButtonColor: '#800020',
            showCancelButton: true,
            cancelButtonText: 'CANCELAR',
            showDenyButton: isEdit, // Mostra botão de excluir apenas se for edição
            denyButtonText: 'EXCLUIR PERFIL',
            denyButtonColor: '#d33',
            html: `
                <div style="text-align: left; padding: 5px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 15px;">
                        <div class="swal-v3-form-group">
                            <label style="font-weight: 800; font-size: 0.7em; color: #64748b; text-transform: uppercase;">Nome Completo (Civil)</label>
                            <input type="text" id="swal-user-nome" class="swal2-input" value="${isEdit ? (dadosEdicao.nome_completo || '') : ''}" style="width:100%; margin:5px 0 15px 0; border-radius: 8px;">
                        </div>
                        <div class="swal-v3-form-group">
                            <label style="font-weight: 800; font-size: 0.7em; color: #64748b; text-transform: uppercase;">Nome de Guerra</label>
                            <input type="text" id="swal-user-guerra" class="swal2-input" value="${isEdit ? (dadosEdicao.nome_guerra || '') : ''}" style="width:100%; margin:5px 0 15px 0; border-radius: 8px;">
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-top: 5px;">
                        <div class="swal-v3-form-group">
                            <label style="font-weight: 800; font-size: 0.7em; color: #64748b; text-transform: uppercase;">Posto / Graduação</label>
                            <select id="swal-user-posto" class="swal2-select" style="width:100%; margin:5px 0 15px 0; border-radius: 8px;">
                                <option value="" disabled selected>Posto</option>
                                ${['CEL', 'TEN CEL', 'MAJ', 'CAP', '1º TEN', '2º TEN', 'ST', '1º SGT', '2º SGT', '3º SGT', 'CB', 'SD'].map(p =>
                `<option value="${p}" ${isEdit && dadosEdicao.posto === p ? 'selected' : ''}>${p}</option>`
            ).join('')}
                            </select>
                        </div>
                        <div class="swal-v3-form-group">
                            <label style="font-weight: 800; font-size: 0.7em; color: #64748b; text-transform: uppercase;">Quadro</label>
                            <select id="swal-user-quadro" class="swal2-select" style="width:100%; margin:5px 0 15px 0; border-radius: 8px;" disabled>
                                <option value="" disabled selected>Selecione o Posto</option>
                            </select>
                        </div>
                        <div class="swal-v3-form-group">
                            <label style="font-weight: 800; font-size: 0.7em; color: #64748b; text-transform: uppercase;">Telefone (WhatsApp)</label>
                            <input type="text" id="swal-user-tel" class="swal2-input" value="${isEdit ? (dadosEdicao.telefone_contato || dadosEdicao.telefone || '') : ''}" placeholder="(00) 00000-0000" style="width:100%; margin:5px 0 15px 0; border-radius: 8px;">
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-top: 5px;">
                        <div class="swal-v3-form-group">
                            <label style="font-weight: 800; font-size: 0.7em; color: #64748b; text-transform: uppercase;">CPF (Login)</label>
                            <input type="text" id="swal-user-cpf" class="swal2-input" value="${isEdit ? (dadosEdicao.cpf || '') : ''}" placeholder="Apenas números" ${isEdit ? 'disabled' : ''} style="width:100%; margin:5px 0 15px 0; border-radius: 8px;">
                        </div>
                        <div class="swal-v3-form-group">
                            <label style="font-weight: 800; font-size: 0.7em; color: #64748b; text-transform: uppercase;">Perfil de Acesso</label>
                            <select id="swal-user-role" class="swal2-select" style="width:100%; margin:5px 0 15px 0; border-radius: 8px;">
                                <option value="operacional" ${isEdit && dadosEdicao.role === 'operacional' ? 'selected' : ''}>Operacional</option>
                                <option value="gestor" ${isEdit && dadosEdicao.role === 'gestor' ? 'selected' : ''}>Gestor de Unidade</option>
                                <option value="admin" ${isEdit && dadosEdicao.role === 'admin' ? 'selected' : ''}>Administrador Geral</option>
                            </select>
                        </div>
                        <div class="swal-v3-form-group">
                            <label style="font-weight: 800; font-size: 0.7em; color: #64748b; text-transform: uppercase;">Unidade</label>
                            <select id="swal-user-unit" class="swal2-select" style="width:100%; margin:5px 0 15px 0; border-radius: 8px;">${optUnidades}</select>
                        </div>
                    </div>

                    ${!isEdit ? `
                    <div class="swal-v3-form-group" style="margin-top:5px;">
                        <label style="font-weight: 800; font-size: 0.7em; color: #64748b; text-transform: uppercase;">Senha Inicial</label>
                        <input type="password" id="swal-user-pass" class="swal2-input" placeholder="Mínimo 6 dígitos" style="width:100%; margin:5px 0 0 0; border-radius: 8px;">
                    </div>` : ''}
                </div>
            `,
            didOpen: () => {
                const pSel = document.getElementById('swal-user-posto');
                const qSel = document.getElementById('swal-user-quadro');

                // Ativa a lógica de dependência que corrigimos
                pSel.addEventListener('change', () => atualizarQuadroCad(pSel, qSel));

                // Caso seja edição, preenche o quadro atual
                if (isEdit) {
                    atualizarQuadroCad(pSel, qSel);
                    qSel.value = dadosEdicao.quadro || '';
                }
            },
            preConfirm: () => {
                const dados = {
                    nome_completo: document.getElementById('swal-user-nome').value.trim().toUpperCase(),
                    nome_guerra: document.getElementById('swal-user-guerra').value.trim().toUpperCase(),
                    posto: document.getElementById('swal-user-posto').value,
                    quadro: document.getElementById('swal-user-quadro').value,
                    cpf: document.getElementById('swal-user-cpf').value.replace(/\D/g, ''),
                    telefone: document.getElementById('swal-user-tel').value,
                    role: document.getElementById('swal-user-role').value,
                    unidade_id: document.getElementById('swal-user-unit').value,
                    unidade_sigla: document.getElementById('swal-user-unit').options[document.getElementById('swal-user-unit').selectedIndex].text
                };

                if (!dados.nome_completo || !dados.nome_guerra || !dados.posto || !dados.quadro || !dados.unidade_id) {
                    return Swal.showValidationMessage('Preencha todos os campos obrigatórios');
                }

                if (!isEdit) {
                    dados.senha = document.getElementById('swal-user-pass').value;
                    if (dados.senha.length < 6) return Swal.showValidationMessage('A senha deve ter 6 dígitos');
                }

                return dados;
            }
        }).then(result => {
            if (result.isConfirmed) {
                salvarMilitarV3(isEdit ? dadosEdicao.uid : null, result.value);
            } else if (result.isDenied) {
                // Chama a exclusão se o botão Deny (Excluir) for clicado
                excluirUsuarioV3(dadosEdicao.uid, dadosEdicao.nome_guerra);
            }
        });
    } catch (e) {
        console.error(e);
        Swal.fire('Erro', 'Falha ao carregar formulário', 'error');
    }
}
function mudarModoVisao(modo) {
    visaoAtual = modo;
    document.getElementById('btn-visao-grid').classList.toggle('active', modo === 'grid');
    document.getElementById('btn-visao-lista').classList.toggle('active', modo === 'lista');

    // Ajusta a classe do container para mudar o layout
    const container = document.getElementById('users-render-container');
    container.className = (modo === 'grid') ? 'v3-vtr-grid' : 'v3-list-stack';

    carregarUsuariosVisuais();
}

// Gera o alfabeto no topo
function renderizarAlfabeto() {
    const container = document.querySelector('.alphabet-filter');
    const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    let html = `<button class="alpha-btn ${letraAtiva === 'TODOS' ? 'active' : ''}" onclick="filtrarPorLetra('TODOS')">TODOS</button>`;

    letras.forEach(l => {
        html += `<button class="alpha-btn ${letraAtiva === l ? 'active' : ''}" onclick="filtrarPorLetra('${l}')">${l}</button>`;
    });
    container.innerHTML = html;
}

function filtrarPorLetra(letra) {
    letraAtiva = letra;
    renderizarAlfabeto();
    carregarUsuariosVisuais();
}
function filtrarUsuariosCards() {
    const input = document.getElementById('user-search-input');
    if (!input) return;

    // Normalização para ignorar acentos e espaços
    const termo = input.value.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .trim();

    // Seleciona tanto cards (grid) quanto linhas (lista)
    const itens = document.querySelectorAll('#users-render-container .v3-posto-card, #users-render-container .v3-list-row');

    itens.forEach(item => {
        const conteudo = item.innerText.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        if (conteudo.includes(termo)) {
            // Se estiver no modo lista, usamos 'flex'. No modo grid, o CSS original assume o layout.
            item.style.display = (visaoAtual === 'grid') ? "block" : "grid";
            item.style.animation = "fadeIn 0.2s ease";
        } else {
            item.style.display = "none";
        }
    });

    // Se o usuário apagar a busca e houver uma letra ativa, resetamos para a letra
    if (termo === "" && letraAtiva !== 'TODOS') {
        carregarUsuariosVisuais();
    }
}
async function carregarUsuariosVisuais() {
    const container = document.getElementById('users-render-container');
    if (!container) return;

    renderizarAlfabeto();
    container.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:60px; color:#64748b;">
            <i class="fas fa-sync fa-spin fa-3x" style="opacity:0.3; margin-bottom:15px; display:block;"></i>
            <span style="font-weight:700; letter-spacing:1px; text-transform:uppercase; font-size:0.8em;">Sincronizando Efetivo...</span>
        </div>`;

    try {
        const snap = await db.collection('usuarios').orderBy('nome_guerra').get();
        let html = '';

        snap.forEach(doc => {
            const u = doc.data();
            const iniciais = u.nome_guerra ? u.nome_guerra.substring(0, 2).toUpperCase() : '??';
            const primeiraLetra = u.nome_guerra ? u.nome_guerra[0].toUpperCase() : '';

            // Filtro Alfabético
            if (letraAtiva !== 'TODOS' && primeiraLetra !== letraAtiva) return;

            const corPerfil = u.role === 'admin' ? '#800020' : (u.role === 'gestor' ? '#2c7399' : '#64748b');
            const fone = u.telefone_contato || 'Sem fone';
            const unidade = u.unidade || 'S/U';

            if (visaoAtual === 'grid') {
                // MODO GRID: Card Limpo (Clique abre o Prontuário)
                html += `
                    <div class="v3-posto-card" style="border-top: 6px solid ${corPerfil}; cursor:pointer;" onclick="verDetalhesMilitar('${doc.id}')">
                        <div style="padding: 20px; display: flex; flex-direction: column; align-items: center; text-align: center;">
                            <div style="width: 65px; height: 65px; background: ${corPerfil}15; color: ${corPerfil}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.2em; border: 2px solid ${corPerfil}30; margin-bottom: 15px;">
                                ${iniciais}
                            </div>

                            <div style="margin-bottom: 12px;">
                                <span style="display:block; font-weight:900; font-size:1.1em; color:#1e293b;">${u.posto} ${u.nome_guerra}</span>
                                <span style="display:block; font-size: 0.65em; font-weight: 700; color: #94a3b8; text-transform: uppercase;">${u.nome_completo}</span>
                            </div>

                            <div style="width: 100%; border-top: 1px solid #f1f5f9; padding-top: 12px; margin-top: auto;">
                                <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <span style="font-size: 0.65em; font-weight: 800; color: ${corPerfil}; text-transform: uppercase; background:${corPerfil}10; padding:2px 6px; border-radius:4px;">${u.role}</span>
                                    <span style="font-size: 0.7em; font-weight: 800; color: #475569;">${unidade}</span>
                                </div>
                                <div style="text-align: left;">
                                    <span style="font-size:0.75em; color:#166534; font-weight:700;">
                                        <i class="fab fa-whatsapp"></i> ${fone}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>`;
            } else {
                // MODO LISTA: Linha Elegante (Clique abre o Prontuário)
                html += `
                    <div class="v3-list-row" onclick="verDetalhesMilitar('${doc.id}')">
                        <div style="width: 35px; height: 35px; background: ${corPerfil}15; color: ${corPerfil}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.8em;">${iniciais}</div>
                        <div style="font-weight: 700; color: #1e293b; font-size: 0.9em;">
                            ${u.posto} ${u.nome_guerra} 
                            <small style="display:block; font-weight:400; color:#64748b; font-size: 0.8em;">${u.nome_completo}</small>
                        </div>
                        <div style="font-size: 0.85em; color: #475569; font-weight:600;">${unidade}</div>
                        <div style="font-size: 0.8em; color: #166534; font-weight:700;">${fone}</div>
                        <div style="font-size: 0.7em; text-transform:uppercase; color:${corPerfil}; font-weight:800; text-align:right;">${u.role}</div>
                    </div>`;
            }
        });

        container.innerHTML = html || '<div style="grid-column:1/-1; text-align:center; padding:50px; color:#94a3b8;">Nenhum militar localizado com este filtro.</div>';
        if (window.FontAwesome) FontAwesome.dom.i2svg();

    } catch (e) {
        console.error("Erro Efetivo V3:", e);
        container.innerHTML = '<p style="color:red; text-align:center; padding:40px;">Erro ao carregar mapa de usuários.</p>';
    }
}

async function verDetalhesMilitar(uid) {
    Swal.fire({ title: 'Carregando prontuário...', didOpen: () => Swal.showLoading() });

    try {
        const doc = await db.collection('usuarios').doc(uid).get();
        if (!doc.exists) return Swal.fire('Erro', 'Militar não encontrado', 'error');

        const u = doc.data();
        const corPerfil = u.role === 'admin' ? '#800020' : (u.role === 'gestor' ? '#2c7399' : '#64748b');

        Swal.fire({
            title: `<span style="color:${corPerfil}">${u.posto} ${u.nome_guerra}</span>`,
            width: '600px',
            showConfirmButton: false,
            html: `
                <div style="text-align: left; padding: 10px; font-family: sans-serif;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8fafc; padding: 15px; border-radius: 10px; border-left: 5px solid ${corPerfil};">
                        <div>
                            <small style="font-weight:800; color:#64748b;">NOME COMPLETO</small>
                            <div style="font-weight:700; font-size:0.9em;">${u.nome_completo}</div>
                        </div>
                        <div>
                            <small style="font-weight:800; color:#64748b;">MATRÍCULA</small>
                            <div style="font-weight:700;">${u.matricula || '---'}</div>
                        </div>
                        <div>
                            <small style="font-weight:800; color:#64748b;">CPF / LOGIN</small>
                            <div style="font-weight:700;">${u.cpf || '---'}</div>
                        </div>
                        <div>
                            <small style="font-weight:800; color:#64748b;">QUADRO</small>
                            <div style="font-weight:700;">${u.quadro || '---'}</div>
                        </div>
                        <div>
                            <small style="font-weight:800; color:#64748b;">UNIDADE</small>
                            <div style="font-weight:700;">${u.unidade || '---'}</div>
                        </div>
                        <div>
                            <small style="font-weight:800; color:#64748b;">PERFIL</small>
                            <div style="font-weight:700; text-transform:uppercase;">${u.role}</div>
                        </div>
                    </div>

                    <div style="margin-top: 15px; padding: 5px;">
                        <small style="font-weight:800; color:#64748b;">CONTATOS</small>
                        <div style="display:flex; gap:20px; margin-top:5px;">
                            <span><i class="fab fa-whatsapp" style="color:#166534"></i> ${u.telefone_contato}</span>
                            <span><i class="far fa-envelope" style="color:#2c7399"></i> ${u.email_contato}</span>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 25px;">
                        <button onclick="abrirFormularioUsuario(${JSON.stringify(u).replace(/"/g, '&quot;')})" 
                                style="padding:12px; border-radius:8px; border:none; background:#2c7399; color:white; font-weight:700; cursor:pointer;">
                            <i class="fas fa-edit"></i> EDITAR DADOS
                        </button>
                        <button onclick="excluirUsuarioV3('${u.uid}', '${u.nome_guerra}')" 
                                style="padding:12px; border-radius:8px; border:none; background:#800020; color:white; font-weight:700; cursor:pointer;">
                            <i class="fas fa-trash-alt"></i> EXCLUIR MILITAR
                        </button>
                    </div>
                </div>
            `
        });
    } catch (e) {
        Swal.fire('Erro', 'Falha ao carregar detalhes', 'error');
    }
}
async function salvarMilitarV3(uidExistente, dados) {
    Swal.fire({
        title: uidExistente ? 'Atualizando...' : 'Criando Conta...',
        didOpen: () => Swal.showLoading(),
        allowOutsideClick: false
    });

    try {
        const firestore = window.db || db;
        const isEdit = !!uidExistente;

        // Se for novo usuário, precisa criar no Auth primeiro
        let uidFinal = uidExistente;

        if (!isEdit) {
            const emailLogin = `${dados.cpf}@sigma.com.br`;
            const userCredential = await secondaryAuth.createUserWithEmailAndPassword(emailLogin, dados.senha);
            uidFinal = userCredential.user.uid;
            await secondaryAuth.signOut(); // Desloga a conta criada do "secondaryAuth"
        }

        const payload = {
            uid: uidFinal,
            nome_completo: dados.nome_completo,
            nome_guerra: dados.nome_guerra,
            posto: dados.posto,
            nome_militar_completo: `${dados.posto} ${dados.nome_guerra}`,
            cpf: dados.cpf,
            telefone_contato: dados.telefone,
            role: dados.role,
            unidade_id: dados.unidade_id,
            unidade: dados.unidade_sigla,
            atualizado_em: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (!isEdit) {
            payload.data_cadastro = firebase.firestore.FieldValue.serverTimestamp();
            payload.email = `${dados.cpf}@sigma.com.br`;
        }

        await firestore.collection('usuarios').doc(uidFinal).set(payload, { merge: true });

        Swal.fire({
            icon: 'success',
            title: isEdit ? 'Militar Atualizado' : 'Militar Cadastrado',
            text: `Acesso liberado para ${dados.nome_guerra}`,
            timer: 2000,
            showConfirmButton: false
        });

        carregarUsuariosVisuais(); // Recarrega os cards

    } catch (e) {
        console.error("Erro no salvamento:", e);
        Swal.fire('Falha no Processo', e.message, 'error');
    }
}


async function excluirUsuarioV3(uid, nomeGuerra) {
    // 1. Alerta de Segurança Premium
    const result = await Swal.fire({
        title: 'Excluir Militar?',
        html: `Você está prestes a remover <b>${nomeGuerra}</b> do sistema.<br><br><small style="color:#ef4444">⚠️ O login (Auth) deve ser removido manualmente no console do Firebase.</small>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#800020',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sim, excluir permanentemente',
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    // 2. Processo de Deleção
    Swal.fire({ title: 'Removendo...', didOpen: () => Swal.showLoading() });

    try {
        const firestore = window.db || db;

        // Remove do Firestore
        await firestore.collection('usuarios').doc(uid).delete();

        // Feedback de Sucesso
        Swal.fire({
            icon: 'success',
            title: 'Militar Removido',
            text: `${nomeGuerra} não faz mais parte do efetivo no sistema.`,
            timer: 2000,
            showConfirmButton: false
        });

        // 3. Atualiza a Interface (Cards)
        carregarUsuariosVisuais();

    } catch (e) {
        console.error("Erro ao excluir militar:", e);
        Swal.fire('Erro Técnico', 'Não foi possível remover o registro: ' + e.message, 'error');
    }
}



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

function getNovaCautelaFormHTML() {
    return `
        <div class="sigma-v3-title-label" style="margin-bottom: 25px;">
            <i class="fas fa-file-contract" style="color: #800020;"></i>
            <span>Nova Cautela de Material</span>
        </div>

        <div style="background: white; border-radius: 20px; padding: 25px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #eef2f6;">
            <div class="form-grid-2-columns" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                
                <div class="form-group">
                    <label style="font-weight: 800; font-size: 0.75em; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 8px;">
                        <i class="fas fa-user-tag"></i> Destinatário (Recebedor)
                    </label>
                    <div class="custom-select-container">
                        <input type="hidden" id="cautela-destinatario-uid">
                        <input type="text" id="cautela-destinatario" placeholder="Nome, posto ou matrícula" required autocomplete="off" 
                               style="width: 100%; padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc;">
                        <div id="cautela-suggestions-box" class="suggestions-box">
                            <ul id="cautela-suggestions-list"></ul>
                        </div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label style="font-weight: 800; font-size: 0.75em; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 8px;">
                        <i class="fas fa-warehouse"></i> Local de Origem
                    </label>
                    <select id="cautela-local-origem" required onchange="loadCustodiaItens()" 
                            style="width: 100%; padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc;">
                        <option value="" disabled selected>Selecione sua custódia...</option>
                    </select>
                </div>
            </div>
        
            <h4 style="margin-top: 30px; margin-bottom: 15px; font-weight: 800; font-size: 0.85em; color: #800020; text-transform: uppercase; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">
                <i class="fas fa-clipboard-list"></i> Seleção de Materiais
            </h4>
            
            <div id="itens-custodia-list" style="background: #f8fafc; border-radius: 15px; min-height: 150px; padding: 20px; border: 2px dashed #e2e8f0;">
                <p style="text-align: center; color: #94a3b8; font-size: 0.9em; margin-top: 40px;">
                    Selecione a Origem para listar seus itens disponíveis.
                </p>
            </div>
        
            <div class="form-group" style="margin-top: 25px;">
                <label style="font-weight: 800; font-size: 0.75em; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 8px;">Observações</label>
                <textarea id="cautela-obs" rows="3" placeholder="Detalhes ou justificativa..." 
                          style="width: 100%; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc;"></textarea>
            </div>
            
            <button class="btn-create" onclick="iniciarCautelaProcesso()" id="btn-iniciar-cautela" disabled 
                    style="width: 100%; margin-top: 20px; padding: 15px; border-radius: 12px; background: #800020; color: white; font-weight: 800; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: 0.3s; box-shadow: 0 4px 15px rgba(128,0,32,0.2);">
                <i class="fas fa-paper-plane"></i> ENVIAR CAUTELA (0 itens)
            </button>
        </div>
    `;
}

/**
 * Carrega o formulário de Nova Cautela, escondendo o menu de botões.
 * Chamado pelo botão "Nova Cautela".
 */
function loadNewCautelaForm() {
    const contentArea = document.getElementById('cautelas-content');

    if (contentArea) {
        // Injeta o novo HTML limpo
        contentArea.innerHTML = getNovaCautelaFormHTML();

        // Ativa os listeners de busca (Autocomplete)
        if (typeof setupCautelaDestinatarioListener === 'function') {
            setupCautelaDestinatarioListener();
        }

        // Libera campos e carrega dados iniciais
        setTimeout(() => {
            const obsField = document.getElementById('cautela-obs');
            if (obsField) {
                obsField.removeAttribute('readonly');
                obsField.removeAttribute('disabled');
            }
        }, 50);

        loadCustodiaLocais();
        loadUsersForSearch();
    }
}
function showCautelasDashboard(type) {
    const menuContainer = document.getElementById('cautelas-options-container');
    const contentArea = document.getElementById('cautelas-content');

    // Mantém a compatibilidade com o layout de cards se ele ainda existir
    if (menuContainer) menuContainer.style.display = 'none';

    if (contentArea) {
        let htmlContent = '';
        let icon = '';
        let title = '';
        let description = '';

        // Definindo as variáveis de texto para evitar repetição de HTML
        if (type === 'Cautelas Ativas') {
            icon = 'fa-clipboard-check';
            title = 'Cautelas Ativas';
            description = 'Lista de materiais sob sua cautela. Clique em uma linha para ver os detalhes.';
        } else if (type === 'Cautelas a Receber') {
            icon = 'fa-inbox';
            title = 'Cautelas a Receber (Ação Imediata)';
            description = 'Cautelas emitidas por terceiros que precisam ser confirmadas por você.';
        } else if (type === 'Histórico') {
            icon = 'fa-archive';
            title = 'Histórico de Cautelas';
            description = 'Visualize as cautelas finalizadas de acordo com o seu papel na transação.';
        }

        // Cabeçalho Padrão Sigma V3 (Substitui o antigo header-container)
        htmlContent = `
            <div class="sigma-v3-title-label" style="margin-bottom: 20px;">
                <i class="fas ${icon}" style="color: #800020;"></i>
                <span>${title}</span>
            </div>
            <p style="font-size: 0.85em; color: #64748b; margin-bottom: 25px; padding-left: 5px;">${description}</p>
        `;

        if (type === 'Cautelas Ativas') {
            htmlContent += `
                <div class="sigma-v3-clean-card">
                    <div id="loading-cautelas" style="text-align: center; padding: 40px; color: #64748b;">
                        <i class="fas fa-spinner fa-spin fa-2x"></i><br><span style="font-size:0.8em; font-weight:700; margin-top:10px; display:block;">SINCRONIZANDO REGISTROS...</span>
                    </div>
                    <div class="table-responsive">
                        <table class="sigma-v3-table" id="cautelas-ativas-table" style="display: none; width:100%;">
                            <thead>
                                <tr>
                                    <th>ID</th><th>Destinatário</th><th>Emissão</th><th>Local Origem</th><th>Itens</th><th>Status</th>
                                </tr>
                            </thead>
                            <tbody id="cautelas-ativas-body"></tbody>
                        </table>
                    </div>
                </div>`;
            setTimeout(() => loadActiveCautelas(), 50);

        } else if (type === 'Cautelas a Receber') {
            htmlContent += `
                <div class="sigma-v3-clean-card">
                    <div id="loading-receive" style="text-align: center; padding: 40px; color: #64748b;">
                        <i class="fas fa-spinner fa-spin fa-2x"></i><br><span style="font-size:0.8em; font-weight:700; margin-top:10px; display:block;">BUSCANDO PENDÊNCIAS...</span>
                    </div>
                    <div class="table-responsive">
                        <table class="sigma-v3-table" id="cautelas-receive-table" style="display: none; width:100%;">
                            <thead>
                                <tr>
                                    <th>ID</th><th>Emitente</th><th>Emissão</th><th>Local Origem</th><th>Itens</th><th>Status</th>
                                </tr>
                            </thead>
                            <tbody id="cautelas-receive-body"></tbody>
                        </table>
                    </div>
                </div>`;
            setTimeout(() => loadCautionsToReceive(), 50);

        } else if (type === 'Histórico') {
            htmlContent += `
                <div class="sigma-v3-clean-card">
                    <div id="historico-abas-operacional" class="sigma-v3-tab-container" style="display: flex; gap: 10px; margin-bottom: 25px;">
                        <button class="sigma-v3-tab active" onclick="loadHistorico('minhas')">Minhas (Custódia)</button>
                        <button class="sigma-v3-tab" onclick="loadHistorico('devolucao')">Devoluções</button>
                        <button class="sigma-v3-tab" onclick="loadHistorico('emitidas')">Emitidas por Mim</button>
                    </div>
                    <div id="historico-content-container">
                        <div id="loading-historico" style="text-align: center; padding: 40px; color: #64748b;">
                            <i class="fas fa-sync fa-spin fa-2x"></i><br><span style="font-size:0.8em; font-weight:700; margin-top:10px; display:block;">CARREGANDO HISTÓRICO...</span>
                        </div>
                    </div>
                </div>`;
            setTimeout(() => loadHistorico('minhas'), 50);
        } else {
            console.warn("View de Cautelas desconhecida:", type);
        }

        contentArea.innerHTML = htmlContent;
        contentArea.style.display = 'block';
    }
}
async function loadUsersForSearch() {
    // 1. BUSCA IRRESTRITA E EXCLUSÃO DO PRÓPRIO USUÁRIO
    let userQuery = db.collection('usuarios');
    const militarLogadoCompleto = currentUserData.nome_militar_completo;

    try {
        const usersSnapshot = await userQuery.get();
        // Zera o array global antes de popular
        allTargetUsers = [];

        usersSnapshot.forEach(doc => {
            const user = doc.data();
            const nomeCompleto = user.nome_militar_completo;

            // Excluir o próprio usuário logado
            if (nomeCompleto && nomeCompleto !== militarLogadoCompleto) {
                // Salva o objeto completo no array (com ID e nome)
                allTargetUsers.push({
                    id: doc.id, // 🛑 CRÍTICO: Este é o UID
                    nome: nomeCompleto
                });
            }
        });

        // 2. CONFIGURA LISTENERS APÓS CARREGAR DADOS
        setupCautelaDestinatarioListener();

    } catch (error) {
        console.error("Erro ao carregar usuários para a busca:", error);
    }
}

function setupCautelaDestinatarioListener() {
    // Referências dos elementos
    const input = document.getElementById('cautela-destinatario');
    const suggestionsBox = document.getElementById('cautela-suggestions-box');
    const suggestionsList = document.getElementById('cautela-suggestions-list');
    const uidInput = document.getElementById('cautela-destinatario-uid');

    if (!input || !suggestionsBox || !suggestionsList || !uidInput) {
        console.error("Elementos do Autocomplete de Cautela não encontrados. Não é possível configurar o listener.");
        return;
    }

    // 🛑 0. CORREÇÃO CRÍTICA DO BLUR/CLICK (MOUSEDOWN)
    // Previne que o campo perca o foco (blur) quando o usuário clica na lista.
    suggestionsBox.addEventListener('mousedown', (event) => {
        if (event.target.closest('li')) {
            event.preventDefault(); // Impede o 'blur' do input, permitindo que o 'click' seja processado.
            // console.log("MOUSEDOWN - BLUR do input temporariamente prevenido.");
        }
    });

    // 1. LISTENER DE DIGITAÇÃO (Filtra e Renderiza)
    input.addEventListener('input', () => {
        const searchTerm = input.value.trim(); // Não converte para UPPERCASE aqui para usar na RegExp
        suggestionsList.innerHTML = '';

        // Limpa o UID e a cor do border ao digitar qualquer coisa nova
        uidInput.value = '';
        input.style.borderColor = '#ccc';

        if (searchTerm.length < 3) {
            suggestionsBox.style.display = 'none';
            return;
        }

        const searchTermUpper = searchTerm.toUpperCase(); // Termo em caixa alta para a busca

        const filteredUsers = allTargetUsers.filter(user =>
            user.nome.toUpperCase().includes(searchTermUpper)
        ).sort((a, b) => a.nome.localeCompare(b.nome));

        if (filteredUsers.length > 0) {

            // 🛑 CRIA A EXPRESSÃO REGULAR PARA O DESTAQUE
            // 'gi' = global (todas as ocorrências) e case-insensitive (ignora caixa alta/baixa)
            const regex = new RegExp(`(${searchTerm})`, 'gi');

            let html = '';
            filteredUsers.forEach(user => {
                const fullUserName = user.nome;
                const safeName = fullUserName.replace(/'/g, "&#39;");

                // 🛑 CORREÇÃO: Usa a regex para substituir a ocorrência do termo de busca
                // pelo termo envolvido em tags <strong>.
                const highlightedName = fullUserName.replace(regex, '<strong>$1</strong>');

                // O layout visual anterior (separando posto/quadro) foi removido
                // para simplificar e garantir que o destaque funcione em qualquer parte do nome.

                html += `<li data-user-name="${safeName}" data-uid="${user.id}">
                             <span style="color: #800020;">${highlightedName}</span>
                         </li>`;
            });

            suggestionsList.innerHTML = html;
            suggestionsBox.style.display = 'block';
        } else {
            suggestionsBox.style.display = 'none';
        }
    });

    // 2. LISTENER DE SELEÇÃO (Preenche o Input e Esconde a Lista)
    suggestionsList.addEventListener('click', (event) => {
        const listItem = event.target.closest('li');

        if (listItem) {
            const selectedNameRaw = listItem.getAttribute('data-user-name');
            const selectedUid = listItem.getAttribute('data-uid');
            const selectedName = selectedNameRaw ? selectedNameRaw.replace(/&#39;/g, "'") : '';

            // console.log("SELEÇÃO CLIQUE - Capturado. UID:", selectedUid, " Nome:", selectedName);

            if (selectedName && selectedUid) {

                // Preenche os valores
                input.value = selectedName;
                uidInput.value = selectedUid;
                input.style.borderColor = '#1b8a3e';
                suggestionsBox.style.display = 'none';

                // Força o foco de volta para o input (complemento do mousedown)
                input.focus();

                // Dispara o change para revalidação
                input.dispatchEvent(new Event('change'));

            } else {
                console.warn("Falha na Captura do Item da Lista: UID ou Nome ausente.");
                uidInput.value = '';
                input.style.borderColor = 'red';
            }
        }
    });

    // 3. LÓGICA DE VALIDAÇÃO NO BLUR (Perda de Foco)
    input.addEventListener('blur', () => {

        setTimeout(() => {
            suggestionsBox.style.display = 'none';

            const finalName = input.value.trim();

            // console.log("BLUR VALIDATION - Final Name:", finalName, " UID:", uidInput.value);

            if (finalName.length > 0 && !uidInput.value) {

                const isNameValid = allTargetUsers.some(user => user.nome.trim() === finalName);

                if (!isNameValid) {
                    input.value = '';
                    input.style.borderColor = 'red';
                    uidInput.value = '';
                    // console.warn("BLUR - Inválido/Não selecionado. Campo Limpo.");
                } else {
                    // Fallback
                    const validUser = allTargetUsers.find(user => user.nome.trim() === finalName);
                    if (validUser) {
                        uidInput.value = validUser.id;
                        input.style.borderColor = '#1b8a3e';
                        // console.log("BLUR - UID preenchido por fallback de nome válido.");
                    } else {
                        input.value = '';
                        input.style.borderColor = 'red';
                        uidInput.value = '';
                    }
                }
            } else if (finalName.length === 0) {
                // Campo vazio, garantir que o UID esteja vazio e resetar a cor
                uidInput.value = '';
                input.style.borderColor = '#ccc';
                // console.log("BLUR - Campo Vazio. Resetado.");
            }

        }, 100);
    });

    // 4. Garante que a caixa reapareça ao focar se houver texto
    input.addEventListener('focus', () => {
        if (input.value.length >= 3) {
            input.dispatchEvent(new Event('input'));
        }
    });
}

async function loadCustodiaLocais() {
    const selectLocal = document.getElementById('cautela-local-origem');
    const militarUid = firebase.auth().currentUser.uid;

    if (!selectLocal || !militarUid) {
        const fallbackNome = currentUserData.nome_militar_completo || 'Usuário Desconhecido';
        selectLocal.innerHTML = `<option value="" disabled selected>Erro: Usuário (${fallbackNome}) não identificado.</option>`;
        return;
    }

    selectLocal.disabled = true;
    selectLocal.innerHTML = '<option value="" disabled selected>Carregando locais...</option>';

    try {
        // Busca na coleção 'custodia_atual' as listas onde o militar logado é o conferente
        const custodyRef = db.collection('custodia_atual');
        const resultsSnapshot = await custodyRef
            .where('conferente_uid', '==', militarUid)
            .get();

        // Usamos um Map para garantir que não haja duplicidade de IDs de lista
        const locaisMap = new Map();

        resultsSnapshot.forEach(doc => {
            const data = doc.data();
            const idRealDaLista = data.lista_id; // "alfa_abt17"
            const nomeExibicao = data.local_nome; // "ALFA - ABT-17"

            if (idRealDaLista && nomeExibicao) {
                locaisMap.set(idRealDaLista, nomeExibicao);
            }
        });

        let optionsHtml = '<option value="" disabled selected>Selecione um local...</option>';

        if (locaisMap.size === 0) {
            optionsHtml = '<option value="" disabled selected>Nenhum local sob sua custódia.</option>';
        } else {
            // Converte o Map em Array e ordena pelo Nome legível
            const listaOrdenada = Array.from(locaisMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));

            listaOrdenada.forEach(([id, nome]) => {
                // 🛑 CORREÇÃO: O 'value' agora é o ID (alfa_abt17) e o texto é o Nome (ALFA - ABT-17)
                optionsHtml += `<option value="${id}">${nome}</option>`;
            });
        }

        selectLocal.innerHTML = optionsHtml;
        selectLocal.disabled = false;

    } catch (error) {
        console.error("Erro ao carregar locais sob custódia:", error);
        selectLocal.disabled = false;
        selectLocal.innerHTML = '<option value="" disabled selected>Erro ao carregar locais.</option>';
    }
}
async function loadCustodiaItens() {
    const selectLocal = document.getElementById('cautela-local-origem');
    const listaId = selectLocal.value;

    const itemListContainer = document.getElementById('itens-custodia-list');
    const btnIniciar = document.getElementById('btn-iniciar-cautela');

    itemListContainer.innerHTML = '<p class="placeholder-message" style="text-align: center; color: #800020;">Buscando materiais...</p>';
    if (btnIniciar) btnIniciar.disabled = true;

    if (!listaId) {
        itemListContainer.innerHTML = '<p class="placeholder-message" style="text-align: center; color: #999;">Por favor, selecione um Local de Origem.</p>';
        return;
    }

    try {
        const listaDoc = await db.collection('listas_conferencia').doc(listaId).get();

        if (!listaDoc.exists) {
            itemListContainer.innerHTML = `<p style="color:red; text-align:center;">Erro: Documento da lista (${listaId}) não encontrado.</p>`;
            return;
        }

        const listaMestra = listaDoc.data().list || [];
        let htmlContent = '<div class="inventory-accordion-container">';
        let totalGeralDisponivel = 0;
        let isFirst = true;

        listaMestra.forEach(setor => {
            const setorItems = (setor.itens || []);

            // 🛑 CÁLCULO UNIFICADO DE DISPONIBILIDADE (Igual ao App de Conferência)
            const setorTotal = setorItems.reduce((acc, item) => {
                if (item.tipo === 'single') {
                    const esperado = Number(item.quantidadeEsperada || item.quantidade) || 0;
                    const cautelado = (item.cautelas || []).reduce((sum, c) => sum + (Number(c.quantidade) || 0), 0);
                    // ⬇️ NOVA LÓGICA: Abate também pendências de conferência não resolvidas
                    const pendente = (item.pendencias_ids || []).reduce((sum, p) => sum + (Number(p.quantidade) || 0), 0);

                    const saldo = esperado - cautelado - pendente;
                    return acc + (saldo > 0 ? saldo : 0);
                } else if (item.tipo === 'multi') {
                    // ⬇️ NOVA LÓGICA: Só conta se não tiver cautela E não tiver pendências de conferência no tombamento
                    return acc + (item.tombamentos || []).filter(t => !t.cautela && (!t.pendencias_ids || t.pendencias_ids.length === 0)).length;
                }
                return acc;
            }, 0);

            if (setorTotal <= 0) return;
            totalGeralDisponivel += setorTotal;

            const contentId = `content-${setor.id}`;
            htmlContent += `
                <div class="${isFirst ? 'accordion-header active' : 'accordion-header'}" onclick="toggleAccordion(this, '${contentId}')">
                    <span>${setor.nome} (${setorTotal} disponíveis)</span>
                    <i class="fas fa-chevron-down"></i>
                </div>
                <div class="accordion-content" id="${contentId}" style="${isFirst ? 'max-height: 1500px;' : ''}">
                    <div class="items-card-grid">`;

            setorItems.forEach(item => {
                if (item.tipo === 'single') {
                    const totalEsperado = Number(item.quantidadeEsperada || item.quantidade) || 0;
                    const totalCautelado = (item.cautelas || []).reduce((sum, c) => sum + (Number(c.quantidade) || 0), 0);
                    // ⬇️ Abatimento de pendências para o saldo individual do card
                    const totalPendente = (item.pendencias_ids || []).reduce((sum, p) => sum + (Number(p.quantidade) || 0), 0);

                    const saldoDisponivel = totalEsperado - totalCautelado - totalPendente;

                    if (saldoDisponivel > 0) {
                        htmlContent += `
                            <div class="item-selection-card" data-item-id="${item.id}">
                                <h4 class="item-card-title"><i class="fas fa-boxes"></i> ${item.nome}</h4>
                                <div class="qtd-control-wrapper">
                                    <label>
                                        <input type="checkbox" name="cautela-item-base" 
                                               data-id="${item.id}" data-nome="${item.nome}" data-tipo="single" data-max-qtd="${saldoDisponivel}"
                                               onchange="toggleItemQuantity(this); updateCautelaItemCount();"> Selecionar
                                    </label>
                                    <input type="number" class="input-qtd-cautela" data-item-id="${item.id}" 
                                           min="1" max="${saldoDisponivel}" value="1" disabled style="width: 60px;">
                                </div>
                                <small style="color:#a00030; font-weight: bold;">Disponível: ${saldoDisponivel} de ${totalEsperado}</small>
                            </div>`;
                    }
                } else if (item.tipo === 'multi' && item.tombamentos?.length > 0) {
                    // ⬇️ Filtra tombamentos que possuem pendências ativas (carimbos vermelhos)
                    const tags = (item.tombamentos || []).map(t => {
                        const isC = !!t.cautela;
                        const hasP = (t.pendencias_ids && t.pendencias_ids.length > 0);
                        const bloqueado = isC || hasP;
                        const motivoBloqueio = isC ? 'Cautelado' : (hasP ? 'Com Pendência' : 'Livre');

                        return `
                            <div class="tombamento-tag ${bloqueado ? 'cautelado' : ''}" title="${motivoBloqueio}">
                                <input type="checkbox" name="cautela-item-multi" 
                                       data-id="${item.id}-${t.tomb}" data-id-base="${item.id}" data-tombamento="${t.tomb}" 
                                       data-nome="${item.nome}" data-tipo="multi" 
                                       onchange="updateCautelaItemCount();" ${bloqueado ? 'disabled' : ''}>
                                ${t.tomb} ${bloqueado ? `<i class="fas fa-lock" style="color: ${hasP ? '#d90f23' : '#800020'};"></i>` : ''}
                            </div>`;
                    }).join('');

                    // Só renderiza o card se houver algum tombamento não bloqueado
                    if (tags.includes('type="checkbox"')) {
                        htmlContent += `
                            <div class="item-selection-card">
                                <h4 class="item-card-title"><i class="fas fa-shield-alt"></i> ${item.nome}</h4>
                                <div class="tombamento-tag-list">${tags}</div>
                            </div>`;
                    }
                }
            });
            htmlContent += '</div></div>';
            isFirst = false;
        });

        if (totalGeralDisponivel === 0) {
            itemListContainer.innerHTML = '<p style="color:green; padding:20px; text-align:center;">✅ Nenhum material disponível para cautela (itens com pendência ou cautelados).</p>';
        } else {
            itemListContainer.innerHTML = htmlContent + '</div>';
            document.querySelectorAll('.input-qtd-cautela').forEach(el => {
                el.addEventListener('input', updateCautelaItemCount);
            });
            updateCautelaItemCount();
        }

    } catch (error) {
        console.error("Erro ao carregar itens:", error);
        itemListContainer.innerHTML = '<p style="color:red; text-align:center;">Erro ao carregar materiais.</p>';
    }
}

/**
 * Lógica do Acordeão: Mostra ou esconde o conteúdo do setor.
 * @param {HTMLElement} header - O cabeçalho clicado.
 * @param {string} contentId - O ID do conteúdo a ser expandido/colapsado.
 */
function toggleAccordion(header, contentId) {
    const content = document.getElementById(contentId);

    // 1. Alterna a classe 'active' no cabeçalho
    header.classList.toggle('active');

    // 2. Controla o max-height para animação de acordeão
    if (content.style.maxHeight !== '0px' && content.style.maxHeight !== '') {
        content.style.maxHeight = '0px';
    } else {
        // Define uma altura suficientemente grande para conter o conteúdo
        content.style.maxHeight = content.scrollHeight + 50 + 'px';
    }
}

/**
 * Atualiza o texto do botão de iniciar cautela com a contagem de itens selecionados.
 */
function updateCautelaItemCount() {
    let selectedCount = 0;
    // REINICIALIZA O ARRAY GLOBAL (Garante que a função de envio veja os dados novos)
    cautelaItensSelecionados = [];

    // 1. Processar itens com Tombamento (tipo 'multi')
    document.querySelectorAll('input[name="cautela-item-multi"]:checked').forEach(chk => {
        const idBase = chk.getAttribute('data-id-base');
        const tombamento = chk.getAttribute('data-tombamento');
        const nomeCompleto = chk.getAttribute('data-nome') || "";

        // Remove "(Tomb: ...)" do nome se ele já existir, para não salvar duplicado
        const nomeLimpo = nomeCompleto.replace(/\s\(Tomb:\s[^\)]+\)/i, '').trim();

        if (idBase && tombamento) {
            cautelaItensSelecionados.push({
                id: `${idBase}-${tombamento}`,
                id_base: idBase,
                nome: nomeLimpo,
                tombamento: tombamento,
                quantidade: 1,
                tipo: 'multi'
            });
            selectedCount++;
        }
    });

    // 2. Processar itens Únicos (tipo 'single')
    document.querySelectorAll('input[name="cautela-item-base"]:checked').forEach(chk => {
        const card = chk.closest('.item-selection-card');
        if (!card) return;

        const inputQtd = card.querySelector('.input-qtd-cautela');
        const id = chk.getAttribute('data-id');
        const nome = chk.getAttribute('data-nome');

        let qtd = 1;
        if (inputQtd && !inputQtd.disabled) {
            qtd = parseInt(inputQtd.value) || 0;
            const max = parseInt(inputQtd.getAttribute('max')) || 0;

            if (qtd > max) {
                alert(`A quantidade máxima disponível para ${nome} é ${max}.`);
                inputQtd.value = max;
                qtd = max;
            }

            if (qtd < 1) {
                chk.checked = false;
                inputQtd.disabled = true;
                return;
            }
        }

        if (id) {
            cautelaItensSelecionados.push({
                id: id,
                id_base: id,
                nome: nome,
                quantidade: qtd,
                tipo: 'single'
            });
            selectedCount += qtd;
        }
    });

    // 3. Atualizar Interface do Botão
    const btnIniciar = document.getElementById('btn-iniciar-cautela');
    if (btnIniciar) {
        btnIniciar.innerHTML = `<i class="fas fa-paper-plane"></i> Enviar Cautela (${selectedCount} itens)`;
        // O botão só habilita se houver itens no array global
        btnIniciar.disabled = (selectedCount <= 0);
    }
}
function toggleItemQuantity(checkbox) {
    // 🛑 CORREÇÃO: Usar .item-selection-card como elemento pai mais próximo 🛑
    const card = checkbox.closest('.item-selection-card');
    if (!card) return; // Se o card não for encontrado (segurança)

    const inputQtd = card.querySelector('.input-qtd-cautela');

    if (inputQtd) {
        inputQtd.disabled = !checkbox.checked;

        // Garante que o valor seja pelo menos 1 quando marcado
        if (checkbox.checked) {
            if (parseInt(inputQtd.value) < 1 || isNaN(parseInt(inputQtd.value))) {
                inputQtd.value = 1;
            }
        } else {
            // Se desmarcado, reseta o valor para o máximo (ou outro valor de reset)
            inputQtd.value = inputQtd.getAttribute('max');
        }
    }
}

async function iniciarCautelaProcesso() {
    const localId = document.getElementById('cautela-local-origem').value;
    const destinatarioUid = document.getElementById('cautela-destinatario-uid').value;
    const destinatarioNome = document.getElementById('cautela-destinatario').value;
    const obsEmissao = document.getElementById('cautela-obs')?.value || "";

    if (!localId || !destinatarioUid || cautelaItensSelecionados.length === 0) {
        alert("Preencha todos os campos e selecione ao menos um item.");
        return;
    }

    const btn = document.getElementById('btn-iniciar-cautela');
    btn.disabled = true; btn.textContent = "Processando...";

    try {
        // --- 🛑 BUSCA CIRÚRGICA NA ROTA PARA NOME AMIGÁVEL ---
        const rotasDoc = await db.collection('config_geral').doc('rotas').get();
        const rotas = rotasDoc.data() || {};
        const rotaInfo = rotas[localId];

        // Monta o nome amigável no padrão "POSTO - NOME"
        const nomeAmigavelLocal = rotaInfo ? `${rotaInfo.posto} - ${rotaInfo.nome}` : "Local N/D";
        const unidadeOrigem = rotaInfo ? rotaInfo.unidade : "";
        // ----------------------------------------------------

        const cautelaId = "CAUTELA-" + Math.floor(10000000 + Math.random() * 90000000);
        const emitenteNome = `${currentUserData.posto} ${currentUserData.quadro} ${currentUserData.nome_guerra}`;
        const dataAtual = new Date().toLocaleString('pt-BR');

        const novaCautela = {
            cautela_id: cautelaId,
            emitente_uid: firebase.auth().currentUser.uid,
            emitente: emitenteNome,
            destinatario_original_uid: destinatarioUid,
            destinatario_original_nome: destinatarioNome,
            destinatario_uid: destinatarioUid, // Define destinatário atual inicial
            local_origem_id: localId,
            local_origem: nomeAmigavelLocal, // ⬅️ AGORA SALVA O NOME AMIGÁVEL VIA ROTA
            unidade_origem: unidadeOrigem,   // ⬅️ SALVA A UNIDADE PARA GESTÃO
            status: 'ABERTA',
            timestamp_emissao: firebase.firestore.FieldValue.serverTimestamp(),
            observacoes_emissao: obsEmissao,
            itens: cautelaItensSelecionados
        };

        const listaRef = db.collection('listas_conferencia').doc(localId);

        await db.runTransaction(async (transaction) => {
            const listaDoc = await transaction.get(listaRef);
            if (!listaDoc.exists) throw new Error("Lista não encontrada.");

            let list = listaDoc.data().list;

            list = list.map(setor => ({
                ...setor,
                itens: setor.itens.map(mItem => {
                    const selecoes = cautelaItensSelecionados.filter(c => c.id_base === mItem.id);

                    if (selecoes.length > 0) {
                        if (!mItem.historico_vida) mItem.historico_vida = [];

                        selecoes.forEach(sel => {
                            const carimbo = {
                                id: cautelaId,
                                destinatario: destinatarioNome,
                                data: dataAtual,
                                quantidade: Number(sel.quantidade) || 1
                            };

                            mItem.historico_vida.push({
                                evento: "SAIDA_CAUTELA", id_doc: cautelaId, quem: emitenteNome, data: dataAtual,
                                detalhes: `Saída de ${carimbo.quantidade}un para ${destinatarioNome}`
                            });

                            if (mItem.tipo === 'multi' && sel.tombamento) {
                                mItem.tombamentos = mItem.tombamentos.map(t => {
                                    if (t.tomb === sel.tombamento) t.cautela = carimbo;
                                    return t;
                                });
                            } else {
                                if (!mItem.cautelas) mItem.cautelas = [];
                                mItem.cautelas.push(carimbo);
                            }
                        });
                    }
                    return mItem;
                })
            }));

            transaction.set(db.collection('cautelas_abertas').doc(cautelaId), novaCautela);
            transaction.update(listaRef, { list });
        });

        alert(`✅ Cautela ${cautelaId} enviada com sucesso!`);
        location.reload();

    } catch (e) {
        console.error(e);
        alert("Erro ao emitir cautela: " + e.message);
        btn.disabled = false;
        btn.textContent = "Enviar Cautela";
    }
}

/**
 * Busca e exibe as cautelas ativas.
 * Exibe todas as cautelas da unidade para Gestores/Admin,
 * e apenas as emitidas para/pelo usuário logado para Operacionais.
 */
// Localização: Função loadActiveCautelas (aprox. linha 1132)

async function loadActiveCautelas() {
    const tbody = document.getElementById('cautelas-ativas-body');
    const loading = document.getElementById('loading-cautelas');
    const table = document.getElementById('cautelas-ativas-table');
    if (!tbody || !loading || !table) return;
    const role = currentUserData.role || 'operacional';

    tbody.innerHTML = '';
    loading.style.display = 'block';
    table.style.display = 'none';

    try {
        const user = currentUserData;

        // Estrutura para os subgrupos
        const grupos = {
            custodiaAtiva: { title: 'Custódia Ativa (Itens sob sua responsabilidade)', data: [] },
            rastreioPessoal: { title: 'Meus Envios em Trânsito (Acompanhamento)', data: [] },
            monitoramento: { title: 'Monitoramento Gerencial/Global', data: [] },
        };

        const renderedIds = new Set();

        // --- 1. CONFIGURAÇÃO E EXECUÇÃO DAS BUSCAS ---

        // A. Pessoal: Custódia Ativa (RECEBIDA como destinatário)
        if (role === 'operacional' || role === 'gestor') {
            const militarCompleto = currentUserData.nome_militar_completo;

            // --- 1. GRUPO CUSTÓDIA ATIVA (APENAS POSSE ATIVA) ---

            // A. CUSTÓDIA ATIVA: RECEBIDA (Destinatário)
            // Somente itens que estão sob POSSE ATIVA.
            grupos.custodiaAtiva.data = await queryCautelas(['RECEBIDA'], role, user, 'destinatario', 'personal');
            grupos.custodiaAtiva.data.forEach(c => renderedIds.add(c.cautela_id));

            // --- 2. GRUPO RASTREIO PESSOAL (REMETENTE E REVERSOR) ---

            // B. RASTREIO PESSOAL - PARTE 1: Emitente (ABERTA, RECEBIDA, DEVOLUÇÃO)
            // Rastreamento para itens que ele EMITIU.
            const rastreioEmitente = await queryCautelas(['ABERTA', 'RECEBIDA', 'DEVOLUÇÃO'], role, user, 'emitente', 'personal');

            // C. RASTREIO PESSOAL - PARTE 2: Reversor (DEVOLUÇÃO)
            // Rastreamento para itens que ele DEVOLVEU (e precisa acompanhar o retorno).
            const rastreioReversor = await queryCautelas(['DEVOLUÇÃO'], role, user, 'militar_completo_reversor', 'personal');

            // Concatena as duas listas de rastreio
            let rastreioRaw = [...rastreioEmitente, ...rastreioReversor];

            // 🛑 CORREÇÃO: Desduplica o array rastreioRaw internamente, usando Map 🛑
            const uniqueRastreio = new Map();
            rastreioRaw.forEach(c => uniqueRastreio.set(c.cautela_id, c));
            const rastreioDesduplicado = Array.from(uniqueRastreio.values());

            // Remove itens que já estão na Custódia Ativa (filtro contra o outro grupo)
            grupos.rastreioPessoal.data = rastreioDesduplicado.filter(c => !renderedIds.has(c.cautela_id));
            grupos.rastreioPessoal.data.forEach(c => renderedIds.add(c.cautela_id));
        }

        // C. Gerencial/Admin: Monitoramento da Unidade/Global
        if (role === 'gestor' || role === 'admin') {

            if (role === 'gestor') {
                // 🛑 CORREÇÃO CRÍTICA PARA GESTOR (Evitar duplo 'in') 🛑
                const unitListIds = await getUnitListIds();
                let monitoramentoRaw = [];
                const statuses = ['ABERTA', 'RECEBIDA', 'DEVOLUÇÃO'];

                grupos.monitoramento.title = 'Monitoramento da Unidade (Material sob sua gestão)';

                // Verifica se há IDs de lista e se estamos dentro do limite de 10 do 'in'
                if (unitListIds.length > 0 && unitListIds.length <= 10) {

                    // 1. Executa a consulta APENAS com o filtro 'local_origem_id' ('in')
                    let queryRef = db.collection('cautelas_abertas')
                        .where('local_origem_id', 'in', unitListIds)
                        .orderBy('timestamp_emissao', 'desc');

                    const snapshot = await queryRef.get();
                    snapshot.forEach(doc => {
                        const cautela = { id: doc.id, ...doc.data() };

                        // 2. Filtra por status ABERTA, RECEBIDA, DEVOLUÇÃO na MEMÓRIA
                        if (statuses.includes(cautela.status)) {
                            monitoramentoRaw.push(cautela);
                        }
                    });

                } else if (unitListIds.length > 10) {
                    console.error("ALERTA: Gestor tem mais de 10 Listas. Filtro de unidade está incompleto.");
                } else {
                    // Nenhum ID de lista, Monitoramento vazio.
                }

                grupos.monitoramento.data = monitoramentoRaw;

            } else { // role === 'admin'
                grupos.monitoramento.title = 'Monitoramento Global (ADMIN)';
                // Admin pode usar o 'in' para status, pois não usa o 'in' para local_origem_id
                grupos.monitoramento.data = await queryCautelas(['ABERTA', 'RECEBIDA', 'DEVOLUÇÃO'], role, user, null, 'unit');
            }

            // Remove itens que já foram vistos nos grupos pessoais (APÓS A BUSCA)
            grupos.monitoramento.data = grupos.monitoramento.data.filter(c => !renderedIds.has(c.cautela_id));
        }

        // --- 2. CONSOLIDAÇÃO E RENDERIZAÇÃO NA TABELA ---
        let htmlContent = '';
        const allGroups = [grupos.custodiaAtiva, grupos.rastreioPessoal, grupos.monitoramento];
        let totalCautelas = 0;

        allGroups.forEach(group => {
            if (group.data.length > 0) {
                totalCautelas += group.data.length;

                // Adiciona o cabeçalho do subgrupo (usando colspan para mesclar a linha)
                htmlContent += `
                    <tr class="group-header">
                        <td colspan="6" class="group-title-cell" data-label="">
                            <i class="fas fa-folder-open"></i> <strong>${group.title}</strong> (${group.data.length})
                        </td>
                    </tr>
                `;

                // Renderiza as linhas de dados (usando a nova função auxiliar)
                group.data.forEach(cautela => {
                    htmlContent += renderCautelaRow(cautela);
                });
            }
        });

        // --- 3. EXIBIÇÃO FINAL ---
        if (totalCautelas === 0) {
            tbody.innerHTML = `
    <tr>
        <td colspan="6" style="text-align:center; padding:60px; color:#64748b;">
            <i class="fas fa-file-signature fa-3x" style="opacity:0.2; margin-bottom:15px; display:block;"></i>
            <span style="font-weight:600; font-size:0.95em;">Nenhuma cautela ativa encontrada.</span>
            <p style="font-size:0.8em; opacity:0.7; margin-top:5px;">No momento, não existem materiais sob sua responsabilidade direta.</p>
        </td>
    </tr>`;
        } else {
            tbody.innerHTML = htmlContent;
        }

        loading.style.display = 'none';
        table.style.display = 'table';

    } catch (e) {
        console.error("Erro ao carregar cautelas ativas:", e);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red; padding:20px;">Erro ao carregar dados: ${e.message}</td></tr>`;
        loading.style.display = 'none';
        table.style.display = 'table';
    }
}

async function loadCautionsToReceive() {
    const tbody = document.getElementById('cautelas-receive-body');
    const loading = document.getElementById('loading-receive');
    const table = document.getElementById('cautelas-receive-table');

    // Configurações de exibição inicial
    tbody.innerHTML = '';
    loading.style.display = 'block';
    table.style.display = 'none';

    try {
        const role = currentUserData.role || 'operacional';
        const user = currentUserData;

        // Statuses de Ação Pessoal: ABERTA e DEVOLUÇÃO
        const statusesToReceive = ['ABERTA', 'DEVOLUÇÃO'];

        // Busca: Filtra pelo 'destinatario' e usa escopo 'personal' para TODOS os perfis (Operacional, Gestor, Admin).
        // Isso implementa a regra de que esta aba é APENAS para AÇÃO PESSOAL.
        const cautionsToReceive = await queryCautelas(
            statusesToReceive,
            role,
            user,
            'destinatario',
            'personal'
        );

        // --- RENDERIZAÇÃO ---

        if (cautionsToReceive.length === 0) {
            tbody.innerHTML = `
    			<tr>
        			<td colspan="6" style="text-align:center; padding:60px; color:#64748b;">
            			<i class="fas fa-file-import fa-3x" style="opacity:0.2; margin-bottom:15px; display:block;"></i>
            			<span style="font-weight:600; font-size:0.95em;">Nenhuma cautela pendente de recebimento.</span>
			            <p style="font-size:0.8em; opacity:0.7; margin-top:5px;">Você está em dia com suas conferências de materiais.</p>
        			</td>
    			</tr>`;
        } else {
            let htmlContent = '';
            cautionsToReceive.forEach(cautela => {
                htmlContent += renderCautelaRow(cautela);
            });
            tbody.innerHTML = htmlContent;
        }

        // --- FINALIZAÇÃO DA EXIBIÇÃO ---
        loading.style.display = 'none';
        table.style.display = 'table';

    } catch (e) {
        console.error("Erro ao carregar cautelas a receber:", e);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red; padding:20px;">Erro ao carregar dados: ${e.message}</td></tr>`;
        loading.style.display = 'none';
        table.style.display = 'table';
    }
}
async function showCautelaDetails(cautelaId) {
    const modal = document.getElementById('cautelaDetailsModal');
    const btnReceber = document.getElementById('btn-receber-cautela');
    const btnDevolver = document.getElementById('btn-devolver-cautela');
    const btnConfirmarDevolucao = document.getElementById('btn-confirmar-devolucao');
    const btnSubstituir = document.getElementById('btn-reportar-problema');

    document.getElementById('modal-cautela-id').textContent = cautelaId;
    modal.style.display = 'flex';

    [btnReceber, btnDevolver, btnConfirmarDevolucao, btnSubstituir].forEach(b => { if (b) b.style.display = 'none'; });

    try {
        const docRef = db.collection('cautelas_abertas').doc(cautelaId);
        const doc = await docRef.get();
        if (!doc.exists) return alert("Erro: Cautela não encontrada.");

        let cautela = doc.data();
        const currentStatus = cautela.status || 'N/D';
        const meuUid = firebase.auth().currentUser.uid;

        // --- LÓGICA DE PENDÊNCIAS PARA BLOQUEIO VISUAL ---
        const pendencias = cautela.pendencias_ativas || [];
        const temPendencia = pendencias.length > 0;

        let donoProvisorioNome = "Aguardando Devolução";
        let destaqueRecebedor = "";

        if (currentStatus === 'RECEBIDA' && cautela.local_origem_id) {
            const custodyDoc = await db.collection('custodia_atual').doc(cautela.local_origem_id).get();
            if (custodyDoc.exists) {
                donoProvisorioNome = custodyDoc.data().conferente_completo || "Dono não identificado";
                if (meuUid !== cautela.destinatario_uid) {
                    destaqueRecebedor = `<span style="background-color: #fff5f5; color: #800020; padding: 4px 10px; border-radius: 6px; border: 1.5px solid #800020; font-weight: bold; display: inline-flex; align-items: center; gap: 8px;">
                                            <i class="fas fa-hand-holding"></i> ${donoProvisorioNome}
                                         </span>`;
                }
            }
        }

        const getUpdatedName = async (uid, fallbackName) => {
            if (uid) {
                const userData = await getUserInfoByUid(uid);
                return userData ? userData.nome_militar_completo : fallbackName || 'N/D';
            }
            return fallbackName || 'N/D';
        };

        document.getElementById('modal-emitente').textContent = await getUpdatedName(cautela.emitente_uid, cautela.emitente);
        document.getElementById('modal-destinatario-original').textContent = await getUpdatedName(cautela.destinatario_original_uid, cautela.destinatario_original_nome);
        document.getElementById('modal-destinatario-atual').innerHTML = destaqueRecebedor || donoProvisorioNome;
        document.getElementById('modal-local-origem').textContent = cautela.local_origem || 'N/D';
        document.getElementById('modal-data-emissao').textContent = cautela.timestamp_emissao ? cautela.timestamp_emissao.toDate().toLocaleDateString('pt-BR') : 'N/D';
        document.getElementById('modal-obs-emissao').textContent = cautela.observacoes_emissao || 'Nenhuma observação.';

        const statusTextElement = document.getElementById('modal-status-text');
        if (statusTextElement) {
            statusTextElement.textContent = currentStatus;
            let color = (currentStatus === 'ABERTA') ? "#f57c00" : (currentStatus === 'RECEBIDA') ? "#2e7d32" : "#c62828";
            statusTextElement.style.cssText = `background: ${color}; color: white; padding: 2px 10px; border-radius: 12px; font-weight: bold; font-size: 0.85em; text-transform: uppercase;`;
        }

        const histContainer = document.getElementById('modal-historico-movimentacoes');
        if (cautela.historico_movimentacoes && cautela.historico_movimentacoes.length > 0) {
            histContainer.innerHTML = cautela.historico_movimentacoes.map(h => `
                <div style="border-bottom: 1px solid #eee; padding: 10px 0;">
                    <strong style="color:#800020;">${h.data || ''}:</strong> 
                    <div style="white-space: pre-line; font-size: 0.95em; color: #333; margin-top: 5px;">
                        ${h.descricao || h.mensagem || h.detalhes || ''}
                    </div>
                    <small style="color:#666; font-style:italic; display: block; margin-top: 5px;">
                        Por: ${h.militar || h.autor || h.quem || 'N/D'}
                    </small>
                </div>
            `).join('');
        } else {
            histContainer.innerHTML = '<p style="color: #999; text-align: center; margin: 5px 0;">Nenhuma movimentação registrada.</p>';
        }

        const itensList = document.getElementById('modal-itens-cautela');
        itensList.innerHTML = '';
        if (cautela.itens) {
            cautela.itens.forEach((item, idx) => {
                const li = document.createElement('li');
                li.style.cssText = `display:flex; justify-content:space-between; align-items:center; padding:8px 10px; border-bottom:1px solid #eee; background-color: ${idx % 2 !== 0 ? '#f2f2f2' : 'transparent'}; font-size: 0.9em;`;

                // 🛑 LÓGICA DO ÍCONE DE ALERTA NO ITEM 🛑
                const pDoItem = pendencias.find(p => p.item_index === idx);
                let htmlAlerta = "";
                if (pDoItem) {
                    htmlAlerta = `<i class="fas fa-exclamation-triangle" style="color: #f57c00; margin-left: 8px; cursor: help;" title="Aguardando Análise: ${pDoItem.motivo}"></i>`;
                }

                const temTombamentoReal = item.tombamento && item.tombamento !== "" && item.tombamento !== item.nome;
                const qtdExibicao = item.quantidade !== undefined ? item.quantidade : 1;
                const rotulo = temTombamentoReal
                    ? `<b style="color: #800020;">Tomb.:</b> ${item.tombamento}`
                    : `<b style="color: #800020;">QTD:</b> ${qtdExibicao}UN`;

                li.innerHTML = `<span>${idx + 1}. ${item.nome}${htmlAlerta}</span> <span>${rotulo}</span>`;
                itensList.appendChild(li);
            });
        }

        // --- BLOQUEIO VISUAL DO BOTÃO DE DEVOLUÇÃO ---
        if (currentStatus === 'ABERTA' && cautela.destinatario_original_uid === meuUid) {
            if (btnReceber) { btnReceber.style.display = 'block'; btnReceber.onclick = () => iniciarRecebimentoCautela(cautelaId); }
        }
        else if (currentStatus === 'RECEBIDA' && (cautela.destinatario_uid === meuUid || cautela.destinatario_original_uid === meuUid)) {
            if (btnDevolver) {
                btnDevolver.style.display = 'block';
                if (temPendencia) {
                    // Estado Desativado/Bloqueado
                    btnDevolver.disabled = true;
                    btnDevolver.style.opacity = "0.5";
                    btnDevolver.style.cursor = "not-allowed";
                    btnDevolver.title = "A devolução está bloqueada porque existem itens com problemas aguardando análise do Gestor.";
                    btnDevolver.innerHTML = `<i class="fas fa-lock"></i> Devolução Bloqueada`;
                } else {
                    // Estado Normal
                    btnDevolver.disabled = false;
                    btnDevolver.style.opacity = "1";
                    btnDevolver.style.cursor = "pointer";
                    btnDevolver.title = "";
                    btnDevolver.innerHTML = `<i class="fas fa-undo"></i> Iniciar Devolução`;
                    btnDevolver.onclick = () => iniciarDevolucaoCautela(cautelaId, donoProvisorioNome);
                }
            }
            if (btnSubstituir) { btnSubstituir.style.display = 'block'; }
        }
        else if (currentStatus === 'DEVOLUÇÃO' && cautela.destinatario_uid === meuUid) {
            if (btnConfirmarDevolucao) { btnConfirmarDevolucao.style.display = 'block'; btnConfirmarDevolucao.onclick = () => iniciarConferenciaDevolucao(cautelaId, currentUserData.nome_militar_completo); }
        }

    } catch (e) {
        console.error("Erro no modal:", e);
    }
}
// Função para mostrar/esconder campo de quantidade no modal de reporte
function fecharModalReporte() {
    document.getElementById('modalReportarItem').style.display = 'none';
    showCautelaDetails(cautelaIdAtualParaReporte); // Reabre o detalhe ao cancelar
}

async function iniciarFluxoSubstituicao() {
    const cautelaId = document.getElementById('modal-cautela-id').textContent;
    cautelaIdAtualParaReporte = cautelaId;

    try {
        const doc = await db.collection('cautelas_abertas').doc(cautelaId).get();
        if (!doc.exists) return alert("Erro: Cautela não encontrada.");

        const data = doc.data();
        itensDaCautelaAtual = data.itens || [];
        const pendenciasAtivas = data.pendencias_ativas || [];
        const indicesBloqueados = pendenciasAtivas.map(p => p.item_index);

        let unidadeAlvo = data.unidade_destino || "";
        if (!unidadeAlvo && data.local_origem_id) {
            const rotasDoc = await db.collection('config_geral').doc('rotas').get();
            const rotas = rotasDoc.data() || {};
            if (rotas[data.local_origem_id]) unidadeAlvo = rotas[data.local_origem_id].unidade;
        }
        if (!unidadeAlvo) unidadeAlvo = currentUserData.unidade;

        const container = document.getElementById('lista-itens-reporte');

        // --- CORREÇÃO CIRÚRGICA INICIA AQUI ---
        container.innerHTML = itensDaCautelaAtual.map((item, index) => {
            const estaBloqueado = indicesBloqueados.includes(index);
            const corFundo = estaBloqueado ? '#fff5f5' : '#fff';
            const corTexto = estaBloqueado ? '#999' : '#000';

            // 1. Identifica se é MULTI (tem tombamento real e diferente do nome)
            const ehMulti = item.tombamento && item.tombamento !== "" && item.tombamento !== item.nome;

            // 2. Monta o texto de exibição do nome (Sem repetir se for single)
            const textoExibicao = ehMulti
                ? `${item.nome} <span style="color:#800020;">[Tomb: ${item.tombamento}]</span>`
                : `${item.nome} (Qtd: ${item.quantidade} un)`;

            return `
            <div style="margin-bottom: 10px; padding: 10px; border: 1px solid ${estaBloqueado ? '#ffcccc' : '#ddd'}; background: ${corFundo}; border-radius:6px; opacity: ${estaBloqueado ? '0.8' : '1'};">
                <label style="display: flex; align-items: center; cursor: ${estaBloqueado ? 'not-allowed' : 'pointer'}; font-weight: bold; color: ${corTexto};">
                    <input type="checkbox" class="check-item-reporte" data-index="${index}" 
                           ${estaBloqueado ? 'disabled' : ''} 
                           style="margin-right: 10px;" onchange="toggleObsInput(${index})">
                    ${textoExibicao}
                    ${estaBloqueado ? '<span style="margin-left:auto; color:#d90f23; font-size:0.7em;"><i class="fas fa-clock"></i> EM ANÁLISE</span>' : ''}
                </label>
                <div id="div-obs-${index}" style="display: none; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #eee;">
                    ${!ehMulti ? `
                        <label style="font-size: 0.8em; color:#d90f23; font-weight:bold;">QUANTIDADE COM PROBLEMA:</label>
                        <input type="number" id="qtd-obs-${index}" value="1" min="1" max="${item.quantidade}" 
                               style="width: 100%; padding: 8px; margin-bottom: 8px; border: 1px solid #ccc; border-radius:4px; box-sizing: border-box;">
                    ` : `<input type="hidden" id="qtd-obs-${index}" value="1">`}
                    
                    <label style="font-size: 0.8em; font-weight:bold;">MOTIVO DO RELATO:</label>
                    <textarea id="text-obs-${index}" placeholder="Descreva o que houve..." 
                              style="width: 100%; height: 50px; font-size: 0.85em; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;"></textarea>
                </div>
            </div>
        `}).join('');
        // --- FIM DA CORREÇÃO ---

        const selectGestor = document.getElementById('select-gestor-alvo');
        selectGestor.innerHTML = '<option value="" disabled selected>Buscando gestores...</option>';
        const gestoresSnap = await db.collection('usuarios').where('unidade', '==', unidadeAlvo).get();
        let options = '<option value="" disabled selected>Selecione o Gestor...</option>';
        let encontrouAlguem = false;

        gestoresSnap.forEach(gDoc => {
            const gData = gDoc.data();
            if (gData.role === 'gestor' || gData.role === 'admin') {
                options += `<option value="${gDoc.id}">${gData.nome_militar_completo}</option>`;
                encontrouAlguem = true;
            }
        });

        if (!encontrouAlguem) {
            const adminsGerais = await db.collection('usuarios').where('role', '==', 'admin').get();
            adminsGerais.forEach(aDoc => {
                options += `<option value="${aDoc.id}">${aDoc.data().nome_militar_completo} (Admin Geral)</option>`;
                encontrouAlguem = true;
            });
        }
        selectGestor.innerHTML = encontrouAlguem ? options : '<option value="" disabled selected>Nenhum gestor disponível</option>';
        document.getElementById('cautelaDetailsModal').style.display = 'none';
        document.getElementById('modalReportarItem').style.display = 'flex';

    } catch (e) {
        console.error("Erro:", e);
        alert("Erro ao carregar dados.");
    }
}

function toggleObsInput(index) {
    const div = document.getElementById(`div-obs-${index}`);
    const isChecked = document.querySelector(`.check-item-reporte[data-index="${index}"]`).checked;
    div.style.display = isChecked ? 'block' : 'none';
}

async function salvarRelatosMultiplos() {
    const checks = document.querySelectorAll('.check-item-reporte:checked');
    const gestorUid = document.getElementById('select-gestor-alvo').value;

    if (checks.length === 0) return alert("Selecione pelo menos um item com problema.");
    if (!gestorUid) return alert("Por favor, selecione o Gestor que receberá este relato.");

    const selectG = document.getElementById('select-gestor-alvo');
    const nomeGestorAlvo = selectG.options[selectG.selectedIndex].text;

    let pendencias = [];
    let logsParaAdicionar = [];
    const dataAtual = new Date();
    const dataFormatada = dataAtual.toLocaleString('pt-BR');

    for (let check of checks) {
        const idx = check.getAttribute('data-index');
        const item = itensDaCautelaAtual[idx];
        const motivo = document.getElementById(`text-obs-${idx}`).value;
        const qtd = parseInt(document.getElementById(`qtd-obs-${idx}`).value) || 1;

        if (!motivo.trim()) {
            alert(`Descreva o problema do item: ${item.nome}`);
            return;
        }

        pendencias.push({
            item_nome: item.nome,
            item_tombamento: item.tombamento || null,
            item_id_base: item.id_base || item.id,
            item_index: parseInt(idx),
            quantidade: qtd,
            motivo: motivo,
            status: "PENDENTE",
            timestamp: dataAtual,
            solicitante_nome: currentUserData.nome_militar_completo,
            gestor_alvo_uid: gestorUid,
            gestor_alvo_nome: nomeGestorAlvo
        });

        logsParaAdicionar.push({
            data: dataFormatada,
            descricao: `⚠️ PENDÊNCIA ENVIADA: ${qtd}un de ${item.nome} (${item.tombamento || 'S/T'}) para análise de ${nomeGestorAlvo}. Motivo: ${motivo}`,
            militar: currentUserData.nome_militar_completo
        });
    }

    try {
        const cautelaRef = db.collection('cautelas_abertas').doc(cautelaIdAtualParaReporte);

        await cautelaRef.update({
            pendencias_ativas: firebase.firestore.FieldValue.arrayUnion(...pendencias),
            historico_movimentacoes: firebase.firestore.FieldValue.arrayUnion(...logsParaAdicionar)
        });

        alert(`Relato enviado com sucesso para ${nomeGestorAlvo}!`);
        document.getElementById('modalReportarItem').style.display = 'none';
        showCautelaDetails(cautelaIdAtualParaReporte);

    } catch (e) {
        console.error("Erro ao salvar:", e);
        alert("Erro ao processar envio.");
    }
}

function iniciarRecebimentoCautela(cautelaId) {
    // 1. Fecha o modal de detalhes
    document.getElementById('cautelaDetailsModal').style.display = 'none';

    // 2. Coleta e codifica os dados do militar
    const pGradEncoded = currentUserData && currentUserData.posto ? encodeURIComponent(currentUserData.posto) : 'ND';
    const quadroEncoded = currentUserData && currentUserData.quadro ? encodeURIComponent(currentUserData.quadro) : 'ND';
    const nomeGuerraEncoded = currentUserData && currentUserData.nome_guerra ? encodeURIComponent(currentUserData.nome_guerra) : 'ND';

    // 3. Constrói a URL para a cautela. (Usa 'cautelaId')
    const url = `conferencia_app.html?cautelaId=${cautelaId}&posto_grad=${pGradEncoded}&quadro_mil=${quadroEncoded}&nome_guerra=${nomeGuerraEncoded}`;

    // 4. 🛑 LÓGICA DE ABERTURA DO IFRAME (REPLICADA DA CONFERÊNCIA NORMAL) 🛑
    const container = document.getElementById('app-runner-container');
    const iframe = document.getElementById('app-iframe');

    if (!container || !iframe) {
        console.error("Erro CRÍTICO: Componentes de execução (app-runner-container ou app-iframe) não encontrados.");
        alert("Erro ao iniciar a conferência. Componentes de UI faltando.");
        return;
    }

    iframe.src = url;
    container.style.display = 'block';

    // 5. Oculta a área principal do dashboard (content-area) e a sidebar para dar foco total ao app
    const contentArea = document.getElementById('content-area');
    if (contentArea) {
        contentArea.style.display = 'none';
    }
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.style.display = 'none';
    }

    // 6. Configura o listener para lidar com o retorno do app (ao finalizar)
    window.removeEventListener('message', handleIframeMessage);
    window.addEventListener('message', handleIframeMessage);
}
function iniciarConferenciaDevolucao(cautelaId, destinatario) {
    // 1. Fecha o modal de detalhes
    document.getElementById('cautelaDetailsModal').style.display = 'none';

    // 2. Coleta e codifica os dados do militar
    // 🛑 CORREÇÃO AQUI: Alterando de 'posto_graduacao' para 'posto' (ou similar)
    const pGradEncoded = currentUserData && currentUserData.posto ? encodeURIComponent(currentUserData.posto) : 'ND';

    const quadroEncoded = currentUserData && currentUserData.quadro ? encodeURIComponent(currentUserData.quadro) : 'ND';
    const nomeGuerraEncoded = currentUserData && currentUserData.nome_guerra ? encodeURIComponent(currentUserData.nome_guerra) : 'ND';

    // 3. Constrói a URL CRÍTICA com o modo de devolução final
    const url = `conferencia_app.html?cautelaId=${cautelaId}&posto_grad=${pGradEncoded}&quadro_mil=${quadroEncoded}&nome_guerra=${nomeGuerraEncoded}&modo=devolucao_final&destinatarioDevolucao=${encodeURIComponent(destinatario)}`;

    // 4. LÓGICA DE ABERTURA DO IFRAME (INLINE)
    const container = document.getElementById('app-runner-container');
    const iframe = document.getElementById('app-iframe');

    if (!container || !iframe) {
        console.error("Erro CRÍTICO: Componentes de execução (app-runner-container ou app-iframe) não encontrados.");
        alert("Erro ao iniciar a conferência. Componentes de UI faltando.");
        return;
    }

    iframe.src = url;
    container.style.display = 'block';

    // 5. Oculta a área principal do dashboard (content-area) e a sidebar
    const contentArea = document.getElementById('content-area');
    if (contentArea) {
        contentArea.style.display = 'none';
    }
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.style.display = 'none';
    }

    // 6. Configura o listener para lidar com o retorno do app (ao finalizar)
    window.removeEventListener('message', handleIframeMessage);
    window.addEventListener('message', handleIframeMessage);
}

// Localização: Linha ~1594
function handleIframeMessage(event) {
    // Garante que a mensagem veio do seu domínio (Importante por segurança)
    if (event.origin !== window.location.origin) return;

    if (event.data && event.data.type === 'SIGMA_FINISHED') {
        alert('✅ Operação finalizada com sucesso. Voltando ao Dashboard.');

        // 1. Oculta o container do Iframe
        const container = document.getElementById('app-runner-container');
        if (container) {
            container.style.display = 'none';
            // Limpa a URL do iframe para liberar recursos
            document.getElementById('app-iframe').src = 'about:blank';
        }

        // 2. Mostra a área principal do dashboard e a sidebar
        const contentArea = document.getElementById('content-area');
        if (contentArea) {
            contentArea.style.display = 'block';
        }
        const sidebar = document.getElementById('sidebar') || document.getElementById('main-sidebar');
        if (sidebar) {
            sidebar.style.display = 'block';
        }

        // 3. Recarrega a lista mais relevante (Cautelas a Receber e Ativas)
        // Isso garante que o item CONCLUÍDA suma da lista A RECEBER/ATIVAS.

        // 🛑 CORREÇÃO DE REFERÊNCIA 🛑
        // A função correta é loadActiveCautelas (com 't' e 'l').
        loadCautionsToReceive(); // Atualiza a lista A RECEBER (item sumiu)
        loadActiveCautelas();    // Atualiza a lista ATIVAS (item sumiu/mudou)

        // Força a atualização dos cards (contadores) e da lista "Conferências de Hoje"
        if (typeof updateOperacionalCards === 'function') {
            updateOperacionalCards();
        }

        // Volta para a view de Cautelas Ativas após o sucesso, se o usuário não estava no Dashboard.
        // Isto é mais seguro do que tentar recarregar a aba 'Histórico' que estava ativa.
        switchView('cautelas');
        showCautelasDashboard('Cautelas Ativas');
    }
}        /**
 * Busca cautelas com status ABERTA e RECEBIDA para Gestores (filtradas por Unidade).
 * @param {string} unidade - A unidade do Gestor.
 * @returns {Array} Lista combinada de cautelas.
 */
async function getCautelasForGestor(unidade) {
    // Consulta 1: ABERTAS na Unidade
    const queryAberta = db.collection('cautelas_abertas')
        .where('unidade_destino', '==', unidade)
        .where('status', '==', 'ABERTA');

    // Consulta 2: RECEBIDAS na Unidade
    const queryRecebida = db.collection('cautelas_abertas')
        .where('unidade_destino', '==', unidade)
        .where('status', '==', 'RECEBIDA');

    const [snapAberta, snapRecebida] = await Promise.all([
        queryAberta.get(),
        queryRecebida.get()
    ]);

    let cautelas = [...snapAberta.docs.map(doc => doc.data()), ...snapRecebida.docs.map(doc => doc.data())];

    // Ordena a lista combinada por timestamp_emissao (mais recente primeiro)
    cautelas.sort((a, b) => (b.timestamp_emissao?.toMillis() || 0) - (a.timestamp_emissao?.toMillis() || 0));

    return cautelas;
}

/**
 * Busca todas as cautelas com status ABERTA e RECEBIDA para Admin.
 * @returns {Array} Lista combinada de cautelas.
 */
async function getCautelasForAdmin() {
    // Consulta 1: Todas ABERTAS
    const queryAberta = db.collection('cautelas_abertas')
        .where('status', '==', 'ABERTA');

    // Consulta 2: Todas RECEBIDAS
    const queryRecebida = db.collection('cautelas_abertas')
        .where('status', '==', 'RECEBIDA');

    const [snapAberta, snapRecebida] = await Promise.all([
        queryAberta.get(),
        queryRecebida.get()
    ]);

    let cautelas = [...snapAberta.docs.map(doc => doc.data()), ...snapRecebida.docs.map(doc => doc.data())];

    // Ordena a lista combinada por timestamp_emissao (mais recente primeiro)
    cautelas.sort((a, b) => (b.timestamp_emissao?.toMillis() || 0) - (a.timestamp_emissao?.toMillis() || 0));

    return cautelas;
}

async function loadHistoricalCautelas() {
    const loading = document.getElementById('loading-historico');
    const historicoContentContainer = document.getElementById('historico-content-container');
    const abasOperacional = document.getElementById('historico-abas-operacional');

    const role = currentUserData.role || 'operacional';
    const user = currentUserData;

    if (historicoContentContainer) historicoContentContainer.innerHTML = '';
    loading.style.display = 'block';

    try {
        if (role === 'operacional') {

            if (abasOperacional) {
                abasOperacional.style.setProperty('display', 'flex', 'important');
            }

            const abasHtml = `
                <div id="content-minhas" class="historico-tab-content active-tab" style="display:block;"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>  <-- NOVO: Adiciona loading na aba inicial
                <div id="content-devolucao" class="historico-tab-content"></div>
                <div id="content-emitidas" class="historico-tab-content"></div>
            `;
            historicoContentContainer.innerHTML = abasHtml;

            loadHistorico('minhas');

        } else {

            if (abasOperacional) {
                abasOperacional.style.setProperty('display', 'none', 'important');
            }

            const snapGeral = await queryCautelas(['CONCLUÍDA'], role, user, null, 'unit');

            let titulo = (role === 'admin') ? 'Histórico Global (ADMIN)' : 'Histórico da Unidade (GESTOR)';

            if (snapGeral.length > 0) {

                let tableHtml = `
                    <div class="op-card" style="padding:15px; margin-bottom:0;">
                        <h4 style="margin-top:0; color:#800020; border-bottom:1px solid #eee; padding-bottom:5px;">
                            <i class="fas fa-archive"></i> ${titulo} (${snapGeral.length} registros)
                        </h4>
                        <table class="ca-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Dest. Original</th>
                                    <th>Emitente</th>
                                    <th>Local Origem</th>
                                    <th>Data Conclusão</th>
                                    <th>Itens</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                snapGeral.forEach(cautela => {
                    const itensCount = cautela.itens ? cautela.itens.reduce((sum, item) => sum + item.quantidade, 0) : 0;
                    const dataFinal = cautela.timestamp_conclusao ? cautela.timestamp_conclusao.toDate().toLocaleDateString('pt-BR') : 'N/D';

                    tableHtml += `
                        <tr onclick="showCautelaDetails('${cautela.cautela_id}')" style="cursor:pointer;">
                            <td data-label="ID"><strong>${cautela.cautela_id}</strong></td>
                            <td data-label="Dest. Original">${cautela.destinatario_original || 'N/A'}</td>
                            <td data-label="Emitente">${cautela.emitente}</td>
                            <td data-label="Local Origem">${cautela.local_origem || 'N/D'}</td>
                            <td data-label="Conclusão">${dataFinal}</td>
                            <td data-label="Itens">${itensCount} itens</td>
                        </tr>
                    `;
                });

                tableHtml += `
                            </tbody>
                        </table>
                    </div>
                `;

                historicoContentContainer.innerHTML = tableHtml;

            } else {
                historicoContentContainer.innerHTML = `<div class="op-card" style="padding:20px; text-align:center; color:#999;">Nenhuma cautela concluída encontrada para ${role}.</div>`;
            }
        }

    } catch (e) {
        console.error("Erro ao carregar histórico de cautelas:", e);
        historicoContentContainer.innerHTML = `<div class="op-card" style="padding:20px; text-align:center; color:red;">Erro ao carregar dados: ${e.message}</div>`;
    } finally {
        loading.style.display = 'none';
    }
}

async function iniciarDevolucaoCautela(cautelaId, ultimoConferenteNome) {
    const btnDevolver = document.getElementById('btn-devolver-cautela');

    // 1. CONFIRMAÇÃO INICIAL COM O USUÁRIO
    const confirmacaoUsuario = confirm(`A CAUTELA SERÁ ENVIADA PARA DEVOLUÇÃO A "${ultimoConferenteNome}". CONFIRMA?`);
    if (!confirmacaoUsuario) return; // Cancela se o usuário clicar em "Cancelar"

    // Esconde o modal e desativa o botão após a confirmação
    document.getElementById('cautelaDetailsModal').style.display = 'none';
    if (btnDevolver) btnDevolver.disabled = true;

    try {
        const militarCompleto = currentUserData.nome_militar_completo;
        const cautelaRef = db.collection('cautelas_abertas').doc(cautelaId);

        // Busca o UID do Usuário C (o novo recebedor)
        const ucUid = await findUidByName(ultimoConferenteNome);

        if (!ucUid) {
            throw new Error(`Não foi possível localizar o ID de sistema para: ${ultimoConferenteNome}.`);
        }

        await db.runTransaction(async (transaction) => {
            const cautelaDoc = await transaction.get(cautelaRef);

            if (!cautelaDoc.exists) throw new Error("Documento não localizado.");

            const data = cautelaDoc.data();

            // --- 🛑 TRAVA DE SEGURANÇA: ITENS EM ANÁLISE 🛑 ---
            const pendencias = data.pendencias_ativas || [];
            if (pendencias.length > 0) {
                const listaItens = pendencias.map(p => p.itemNome).join(', ');
                throw new Error(`BLOQUEIO: Existem itens em análise pelo Gestor: (${listaItens}).\n\nResolva as pendências antes de devolver.`);
            }

            if (data.status !== 'RECEBIDA') {
                throw new Error("A cautela não está em sua posse confirmada para ser devolvida.");
            }

            // --- 📝 PREPARAÇÃO DO LOG DE MOVIMENTAÇÃO ---
            const novoLog = {
                data: new Date().toLocaleString('pt-BR'), // Grava como texto formatado, não como objeto Timestamp
                descricao: `Devolução iniciada: Material enviado por ${militarCompleto} para conferência de retorno de ${ultimoConferenteNome}.`,
                militar: militarCompleto, // Nome da chave corrigido para bater com o modal
                tipo: "TRANSICAO_DEVOLUCAO"
            };

            // Se passar por todas as travas, executa a atualização
            transaction.update(cautelaRef, {
                status: 'DEVOLUÇÃO',
                timestamp_devolucao_iniciada: firebase.firestore.FieldValue.serverTimestamp(),

                reversor_uid: firebase.auth().currentUser.uid,
                militar_completo_reversor: militarCompleto,

                destinatario_uid: ucUid,
                destinatario: ultimoConferenteNome,

                // Adiciona o log ao histórico da cautela
                historico_movimentacoes: firebase.firestore.FieldValue.arrayUnion(novoLog)
            });
        });

        alert(`✅ Cautela enviada para conferência de ${ultimoConferenteNome}.`);
        if (typeof loadActiveCautelas === 'function') loadActiveCautelas();
        if (typeof updateOperacionalCards === 'function') updateOperacionalCards();

    } catch (error) {
        console.error("Erro ao iniciar devolução:", error);
        alert(`${error.message}`);
        if (btnDevolver) btnDevolver.disabled = false;
    }
}
/**
* Alterna a aba do Histórico e dispara o carregamento da função correspondente.
*/
// Localização: Função loadHistorico (Aproximadamente linha 1504)

function loadHistorico(tabName) {
    const role = currentUserData.role || 'operacional';

    // 🛑 1. SE FOR GESTOR/ADMIN, FORÇAMOS A VISUALIZAÇÃO DA TABELA ÚNICA 🛑
    // Isso garante que loadHistoricalCautelas rode e sobreescreva a estrutura de abas.
    if (role === 'gestor' || role === 'admin') {
        loadHistoricalCautelas();
        return; // Sai da função após iniciar a visualização Gerencial/Global
    }

    // 2. Para Operacional, continua a lógica de abas:

    // 2.1. Atualiza a UI das abas
    document.querySelectorAll('.tab-navigation .tab-button').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        }
    });

    // 2.2. Oculta e mostra o conteúdo (containers internos)
    document.querySelectorAll('.historico-tab-content').forEach(content => {
        content.classList.remove('active-tab');
        content.style.display = 'none';
    });
    const targetContent = document.getElementById(`content-${tabName}`);
    if (targetContent) {
        targetContent.style.display = 'block';
        targetContent.classList.add('active-tab');
    }

    // 2.3. Dispara a função de carregamento de dados (Operacional)
    if (tabName === 'minhas') {
        loadHistoricoMinhas();
    } else if (tabName === 'devolucao') {
        loadHistoricoDevolucao();
    } else if (tabName === 'emitidas') {
        loadHistoricoEmitidas();
    }
}
// Função auxiliar para renderizar a tabela, minimizando a repetição
function renderHistoricoTable(containerId, cautelas) {
    const container = document.getElementById(containerId);
    const loading = document.getElementById('loading-historico');

    if (!container) return;

    // Oculta loading e garante que o container esteja visível
    if (loading) loading.style.display = 'none';

    if (cautelas.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px;">Nenhuma cautela encontrada neste histórico.</p>';
        return;
    }

    // Cria a estrutura da tabela
    let html = `
        <table class="ca-table" style="width: 100%;">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Dest. Original</th>
                    <th>Emitente</th>
                    <th>Data Final</th>
                    <th>Itens</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
    `;

    cautelas.forEach(cautela => {
        const itensCount = cautela.itens ? cautela.itens.reduce((sum, item) => sum + item.quantidade, 0) : 0;
        const dataFinal = cautela.timestamp_conclusao ? cautela.timestamp_conclusao.toDate().toLocaleDateString('pt-BR') : 'N/D';

        // Define o destinatário original de forma segura (para esta aba)
        const destOriginal = cautela.destinatario_original || 'N/A';
        const badgeText = 'CONCLUÍDA';
        const badgeClass = 'badge-solucao';

        html += `
            <tr onclick="showCautelaDetails('${cautela.cautela_id}')" style="cursor:pointer;">
                <td><strong>${cautela.cautela_id}</strong></td>
                <td>${destOriginal}</td>
                <td>${cautela.emitente}</td>
                <td>${dataFinal}</td>
                <td>${itensCount} itens</td>
                <td><span class="status-badge ${badgeClass}">${badgeText}</span></td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

// -------------------------------------------------------------
// FUNÇÕES ESPECÍFICAS DE CARREGAMENTO POR ABA
// -------------------------------------------------------------

/**
 * Aba 1: MINHAS (Destinatário Original)
 * Filtro: destinatario_original == militarCompleto E status == CONCLUÍDA
 */
async function loadHistoricoMinhas() {
    const militarCompleto = currentUserData.nome_militar_completo;

    try {
        const snap = await db.collection('cautelas_abertas')
            .where('destinatario_original', '==', militarCompleto)
            .where('status', '==', 'CONCLUÍDA')
            .orderBy('timestamp_conclusao', 'desc')
            .get();

        renderHistoricoTable('content-minhas', snap.docs.map(doc => doc.data()));
    } catch (e) {
        document.getElementById('content-minhas').innerHTML = `<p style="color:red;">Erro ao carregar histórico: ${e.message}</p>`;
    }
}

/**
 * Aba 2: DEVOLUÇÃO (Recebidas de volta, como Dono Provisório)
 * Filtro: receptor_final_completo == militarCompleto E status == CONCLUÍDA
 */
async function loadHistoricoDevolucao() {
    const militarCompleto = currentUserData.nome_militar_completo;

    try {
        const snap = await db.collection('cautelas_abertas')
            .where('receptor_final_completo', '==', militarCompleto) // Campo que registra o Dono Provisório
            .where('status', '==', 'CONCLUÍDA')
            .orderBy('timestamp_conclusao', 'desc')
            .get();

        renderHistoricoTable('content-devolucao', snap.docs.map(doc => doc.data()));
    } catch (e) {
        document.getElementById('content-devolucao').innerHTML = `<p style="color:red;">Erro ao carregar histórico: ${e.message}</p>`;
    }
}

/**
 * Aba 3: EMITIDAS POR MIM
 * Filtro: emitente == militarCompleto E status == CONCLUÍDA
 */
async function loadHistoricoEmitidas() {
    const militarCompleto = currentUserData.nome_militar_completo;

    try {
        const snap = await db.collection('cautelas_abertas')
            .where('emitente', '==', militarCompleto)
            .where('status', '==', 'CONCLUÍDA')
            .orderBy('timestamp_conclusao', 'desc')
            .get();

        renderHistoricoTable('content-emitidas', snap.docs.map(doc => doc.data()));
    } catch (e) {
        document.getElementById('content-emitidas').innerHTML = `<p style="color:red;">Erro ao carregar histórico: ${e.message}</p>`;
    }
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
                const itNaVtr = (setor.itens || []).find(i => i.uid_global === uidGlobal || i.nome === itemData.nome);
                if (!itNaVtr) return;

                if (ehMulti) {
                    (itNaVtr.tombamentos || []).forEach(t => {
                        const temC = !!t.cautela; const temP = t.pendencias_ids?.length > 0;
                        if (ehMinhaVtr || souAdminGeral) { if (temP) cPend++; else if (temC) cCaut++; else cUso++; }
                        const statusTxt = temP ? 'PENDENTE' : (temC ? 'CAUTELADO' : 'EM USO');
                        const badgeStyle = temP ? 'background:#fee2e2;color:#b91c1c;' : (temC ? 'background:#fff3cd;color:#856404;' : 'background:#f1f5f9;color:#475569;');
                        let bufferVtr = `<tr style="background:${ehMinhaVtr ? 'rgba(16,185,129,0.03)' : '#fff'};">
                            <td><span style="font-weight:700;">${t.tomb}</span><br><small style="color:#64748b;"><i class="fas fa-truck-container" style="margin-right:5px;"></i> ${vtrData.ativo_nome}</small></td>
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
                    const qtdFisicaVtr = Number(itNaVtr.quantidadeEsperada) || 0;
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
                            <td><i class="fas fa-truck-pickup" style="margin-right:8px; color:#64748b;"></i><span style="font-weight:700;">${vtrData.ativo_nome}</span></td>
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
                // ✅ BUSCA DE SALDO PARA TRAVA DE QUANTIDADE
                try {
                    const minhaUnidadeId = currentUserData.unidade_id;
                    const snapSaldo = await db.collection('inventario').doc(docId)
                        .collection('saldos_unidades').doc(minhaUnidadeId).get();

                    const saldoDisp = snapSaldo.exists ? (snapSaldo.data().qtd_disp || 0) : 0;
                    const inputQtd = document.getElementById('swal-mov-qtd');
                    const labelQtd = document.getElementById('label-qtd-swal');

                    if (inputQtd) {
                        inputQtd.max = saldoDisp; // Define o teto matemático no atributo max
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
                // ✅ VALIDAÇÃO FINAL DE SEGURANÇA
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
async function popularDestinosMovimentacao(souAdmin, operacao, viaturaIdPreSeleccionada = null) {
    const selectDestino = document.getElementById('swal-mov-destino');
    if (!selectDestino) return;

    try {
        let htmlOptions = `<option value="" disabled selected>Selecione o destino...</option>`;

        if (souAdmin) {
            // ✅ CORREÇÃO V3: Busca na coleção estruturada e ordenada por sigla
            const snapUnidades = await db.collection('unidades_estruturadas')
                .where('ativo', '==', true)
                .get();

            // Ordenação manual para garantir estética
            const unidades = snapUnidades.docs.map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => a.sigla.localeCompare(b.sigla));

            unidades.forEach(u => {
                htmlOptions += `<option value="${u.id}">${u.sigla} - ${u.nome_completo}</option>`;
            });
        } else {
            // GESTOR LOCAL: Busca as listas de conferência (Viaturas/Bases) da unidade dele
            const snapVtrs = await db.collection('listas_conferencia')
                .where('unidade_id', '==', currentUserData.unidade_id)
                .where('ativo', '==', true)
                .get();

            snapVtrs.forEach(doc => {
                const data = doc.data();
                const isSelected = (viaturaIdPreSeleccionada === doc.id) ? 'selected' : '';
                htmlOptions += `<option value="${doc.id}" ${isSelected}>${data.ativo_nome} (${data.posto_nome})</option>`;
            });

            // Se for recolhimento vindo do rastreio, trava o destino para evitar erro
            if (operacao === 'RECOLHIMENTO' && viaturaIdPreSeleccionada) {
                selectDestino.disabled = true;
                selectDestino.style.backgroundColor = "#f1f5f9";
            }
        }

        selectDestino.innerHTML = htmlOptions;

    } catch (e) {
        console.error("Erro ao popular destinos:", e);
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
async function buscarInteligenteFamilia(termo) {
    const listUI = document.getElementById('list-suggestions-familia');
    const boxUI = document.getElementById('suggestions-familia');
    const uidPaiInput = document.getElementById('cat-uid-pai');

    if (termo.length < 2) {
        boxUI.style.display = 'none';
        return;
    }

    try {
        const termoUpper = termo.toUpperCase();
        // Busca famílias que tenham o nome ou marcas vinculadas
        const snap = await db.collection('catalogo_familias')
            .where('tags_busca', 'array-contains', termoUpper)
            .limit(5).get();

        if (snap.empty) {
            boxUI.style.display = 'none';
            uidPaiInput.value = ''; // Se não achou, limpa o ID para criar novo
            return;
        }

        let html = '';
        snap.forEach(doc => {
            const fam = doc.data();
            html += `<li onclick="selecionarFamilia('${doc.id}', '${fam.nome_pai}')" style="padding:10px; cursor:pointer; border-bottom:1px solid #eee;">
                        <i class="fas fa-folder"></i> Família: <b>${fam.nome_pai}</b>
                     </li>`;
        });

        listUI.innerHTML = html;
        boxUI.style.display = 'block';
    } catch (e) { console.error(e); }
}

function selecionarFamilia(uid, nome) {
    document.getElementById('cat-nome-pai').value = nome;
    document.getElementById('cat-uid-pai').value = uid;
    document.getElementById('suggestions-familia').style.display = 'none';
    document.getElementById('cat-nome-pai').style.borderColor = '#1b8a3e';
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

    if (!nomePai || !marca || !modelo) return alert("Preencha os campos obrigatórios.");

    const btn = document.querySelector('.btn-sync');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = "Processando DNA...";

    const autorNome = currentUserData.nome_militar_completo;
    // ✅ CAPTURA A UNIDADE DO CRIADOR DINAMICAMENTE
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
                qtd_corporativa_total: 0,
                criado_em: dataRegistro,
                criado_por: autorNome,
                unidade_origem_id: unidadeCriadorId // ✅ Rastro de quem criou
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
            // Itens Multi não precisam de doc prévio, o local_id irá no tombamento no Teste 2.
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
        // 1. RESET: Limpa o cache para garantir que não haja "lixo" de outras unidades
        estoqueGestorLocal = [];

        // 2. BUSCA NA NOVA ARQUITETURA:
        // Entramos no Inventário Único. O desafio aqui é listar apenas os itens 
        // onde a unidade possui um documento de saldo criado.
        // Usamos uma "Group Query" ou buscamos os itens globais e filtramos o saldo local.
        const snapItens = await db.collection('inventario').get();

        for (const doc of snapItens.docs) {
            const itemGlobal = doc.data();
            const ehMulti = itemGlobal.tipo === 'multi';

            // 3. CAPTURA DO SALDO ESPECÍFICO DA UNIDADE
            // Buscamos na sub-coleção 'saldos_unidades' pelo ID da unidade do gestor
            const saldoDoc = await doc.ref.collection('saldos_unidades').doc(unidadeId).get();

            if (saldoDoc.exists) {
                const s = saldoDoc.data();
                const totalDisponivel = Number(s.qtd_disp) || 0;

                // 4. MAPEAMENTO PARA O BUSCADOR (estoqueGestorLocal)
                const objetoParaBusca = {
                    id_almox: doc.id, // O UID_GLOBAL (Ex: FAM-001-MOD-1)
                    nome: itemGlobal.nome,
                    tipo: itemGlobal.tipo,
                    categoria: itemGlobal.categoria,
                    disponivel: totalDisponivel,
                    unidade_id: unidadeId,
                    uid_global: doc.id
                };

                // Se for MULTI, precisamos carregar os tombamentos disponíveis para o autocomplete
                if (ehMulti) {
                    const snapTombs = await doc.ref.collection('tombamentos')
                        .where('local_id', '==', unidadeId)
                        .where('situacao_atual', '==', 'DISPONÍVEL')
                        .get();

                    objetoParaBusca.tombamentos = snapTombs.docs.map(t => t.data());
                    // Para itens multi, o 'disponivel' é a contagem de tombamentos livres
                    objetoParaBusca.disponivel = snapTombs.size;
                }

                // 5. ALIMENTA O CACHE
                // Só adicionamos se houver o que gerenciar (saldo > 0 ou tombamentos livres)
                if (objetoParaBusca.disponivel > 0) {
                    estoqueGestorLocal.push(objetoParaBusca);
                }
            }
        }

        console.log(`🚀 Buscador Inteligente: ${estoqueGestorLocal.length} itens do Inventário mapeados para a unidade ${unidadeId}`);

    } catch (e) {
        console.error("Erro ao mapear Inventário para o Editor:", e);
    }
}
// ================================================================
// 4. RENDERIZAÇÃO DA INTERFACE (GRID E CARDS)
// ================================================================
function renderizarArquiteturaEditor() {
    const container = document.getElementById('setores-drag-container');
    if (!container) return;

    container.innerHTML = '';

    // Define a cor temática baseada no modo (Checklist VTR ou Lista Materiais)
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

        // ✅ Aplica a cor dinâmica no background do cabeçalho do setor
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

            htmlItens += `
                <div class="item-arquitetura-linha" data-item-index="${indexItem}" style="flex-direction: column; align-items: flex-start; gap: 5px; padding: 10px; border-bottom: 1px solid #f1f5f9; position: relative;">
                    <div class="item-arquitetura-info" style="width: 100%; display: flex; justify-content: space-between; align-items: flex-start;">
                        <b style="color: #1e293b; font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Inter', sans-serif; padding-right: 25px;">${item.nome}</b>
                        
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
                                </div>
                            `).join('')
                    :
                    `<div style="font-size: 10px; font-weight: 800; color: #b45309; background: #fff7ed; padding: 2px 8px; border-radius: 4px; border: 1px solid #ffedd5; font-family: 'Inter', sans-serif; display: flex; align-items: center; gap: 4px;">
                                <i class="fas fa-boxes" style="font-size: 9px; opacity: 0.7;"></i>
                                QTD: ${item.quantidadeEsperada}
                            </div>`
                }
                    </div>
                </div>`;
        });

        htmlItens += `</div>`;
        setorDiv.innerHTML = htmlHeader + htmlItens;
        container.appendChild(setorDiv);

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
// 6. BUSCA INTELIGENTE NO ESTOQUE (AUTOCOMPLETE)
// ================================================================
function buscarItemParaAdicionar(termo) {
    const box = document.getElementById('sugestoes-estoque-editor');
    if (!box) return;

    if (termo.length < 2) {
        box.style.display = 'none';
        return;
    }

    const t = termo.toLowerCase().trim();
    const suggestions = [];

    estoqueGestorLocal.forEach(item => {
        const nomeMatch = item.nome.toLowerCase().includes(t);

        // ✅ CÁLCULO CIRÚRGICO: Quanto deste item já foi adicionado aos setores no rascunho?
        let qtdJaEscalada = 0;
        let tombamentosEmUsoNoRascunho = [];

        arquiteturaAtiva.forEach(setor => {
            (setor.itens || []).forEach(it => {
                if (it.uid_global === item.uid_global) {
                    if (item.tipo === 'multi') {
                        (it.tombamentos || []).forEach(tm => tombamentosEmUsoNoRascunho.push(tm.tomb));
                    } else {
                        qtdJaEscalada += Number(it.quantidadeEsperada || 0);
                    }
                }
            });
        });

        if (item.tipo === 'multi') {
            (item.tombamentos || []).forEach(tomb => {
                const tombNum = String(tomb.tomb || "");
                // ✅ FILTRO: Só sugere se não estiver na VTR (DB) E nem no rascunho atual (tela)
                if (!tomb.viatura_id && !tombamentosEmUsoNoRascunho.includes(tomb.tomb) && (nomeMatch || tombNum.toLowerCase().includes(t))) {
                    suggestions.push({
                        ...item,
                        tombamentoExibicao: tomb.tomb,
                        id_unico: `${item.id_almox}_${tomb.tomb}`
                    });
                }
            });
        } else {
            // ✅ CÁLCULO: Saldo Real = Saldo do Almoxarifado - O que já está na tela
            const saldoRealDisponivel = item.disponivel - qtdJaEscalada;

            if (nomeMatch && saldoRealDisponivel > 0) {
                suggestions.push({
                    ...item,
                    id_unico: item.id_almox,
                    disponivelReal: saldoRealDisponivel // Passamos o saldo abatido
                });
            }
        }
    });

    const matches = suggestions.slice(0, 10);
    window.tempSuggestionsSearch = matches;

    if (matches.length === 0) {
        if (isModoVistoria) {
            box.innerHTML = `
                <div class="suggestion-item" onclick="prepararInclusaoTextoLivre('${termo.replace(/'/g, "\\'")}')" 
                     style="padding:15px; background:#f0f9ff; border:1px dashed #0369a1; border-radius:6px; cursor:pointer; text-align:center;">
                    <i class="fas fa-plus-circle" style="color:#0369a1;"></i>
                    <b style="color:#0369a1; font-size:0.9em; display:block;">Adicionar "${termo}"</b>
                    <small style="color:#64748b; font-size:0.75em;">Como item de vistoria técnica</small>
                </div>`;
        } else {
            box.innerHTML = '<div style="padding:15px; color:#94a3b8; text-align:center;">Sem saldo disponível.</div>';
        }
    } else {
        let htmlFinal = matches.map((i, index) => `
            <div class="suggestion-item" onclick="selecionarSugestaoPorIndex(${index})" 
                 style="display: flex !important; align-items: center !important; width: 100% !important; border-bottom: 1px solid #f1f5f9; padding: 10px 15px; cursor: pointer; background: white; gap: 12px; box-sizing: border-box;">
                <div style="flex-shrink: 0; width: 24px; display: flex; justify-content: center; align-items: center;">
                    <i class="fas ${i.tipo === 'multi' ? 'fa-tag' : 'fa-boxes'}" 
                       style="color: ${i.tipo === 'multi' ? '#800020' : '#2c7399'}; font-size: 1.1em; position: static !important; transform: none !important;"></i>
                </div>
                <div style="flex-grow: 1; display: flex; flex-direction: column; line-height: 1.2; overflow: hidden;">
                    <b style="font-size: 0.85em; color: #1e293b; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${i.nome}
                    </b>
                    <small style="color: #64748b; font-size: 0.72em; font-weight: 600;">
                        ${i.tipo === 'multi' ? 'TOMB: ' + i.tombamentoExibicao : 'SALDO RESTANTE: ' + i.disponivelReal}
                    </small>
                </div>
            </div>`).join('');

        if (isModoVistoria) {
            htmlFinal += `<div class="suggestion-item" onclick="prepararInclusaoTextoLivre('${termo.replace(/'/g, "\\'")}')" style="padding:10px; background:#fff8e1; border-top:2px solid #ffb300; cursor:pointer; text-align:center; margin-top:5px;"><span style="font-size:0.8em; color:#856404; font-weight:bold;">+ ADICIONAR COMO TEXTO LIVRE</span></div>`;
        }
        box.innerHTML = htmlFinal;
    }
    box.style.display = 'block';
}
function prepararInclusaoTextoLivre(nomeDigitado) {
    const box = document.getElementById('sugestoes-estoque-editor');
    const inputBusca = document.getElementById('input-busca-estoque');

    // 1. Cria o objeto do item no formato que o seu editor espera
    const novoItemVistoria = {
        id_almox: "VISTORIA_" + Date.now(), // ID temporário único
        nome: nomeDigitado.toUpperCase(),
        tipo: "single",
        disponivel: 1,
        uid_global: "ITEM_VISTORIA_LIVRE",
        categoria: "VISTORIA"
    };

    // 2. Simula a seleção de uma sugestão para abrir o popover de quantidade/setor
    // Usamos a lógica que você já tem no sistema para manter a consistência
    window.tempSuggestionsSearch = [novoItemVistoria];
    selecionarSugestaoPorIndex(0);

    // 3. Limpa a interface de busca
    if (box) box.style.display = 'none';
    if (inputBusca) inputBusca.value = '';

    console.log("🛠️ Preparando inclusão de item de vistoria:", nomeDigitado);
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

    // 1. Validações de segurança
    if (!itemSelecionadoTemp) return alert("Selecione um item primeiro.");
    if (setorIdx === "") return alert("Escolha o setor de destino.");

    const novoItem = {
        uid_global: itemSelecionadoTemp.uid_global || itemSelecionadoTemp.id_almox,
        nome: itemSelecionadoTemp.nome,
        tipo: itemSelecionadoTemp.tipo,
        quantidadeEsperada: 0
    };

    if (itemSelecionadoTemp.tipo === 'single') {
        const qtd = itemSelecionadoTemp.quantidadeEscolhida || 1;
        novoItem.quantidadeEsperada = qtd;
    } else {
        novoItem.tombamentos = [{
            tomb: itemSelecionadoTemp.tombamentoExibicao,
            situacao: "EM CARGA"
        }];
        novoItem.quantidadeEsperada = 1;
    }

    arquiteturaAtiva[setorIdx].itens.push(novoItem);

    // --- MUDANÇAS CIRÚRGICAS: LIMPEZA MODERNA ---
    cancelarRascunho(); // Limpa o card, o itemTemp e o botão

    if (selectSetor) {
        selectSetor.value = "";
        selectSetor.style.border = "1px solid #cbd5e1"; // Reseta a borda
    }

    processarMesclagemAutomatica(setorIdx);
    marcarAlteracao();
    inputBusca.focus();
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
    if (!confirm("Deseja publicar as alterações? Isso atualizará a lista e ajustará o saldo do estoque.")) return;

    const firestore = firebase.firestore();
    const elNome = document.getElementById('edit-vtr-nome');
    const nomeAmigavelVtr = elNome ? (elNome.innerText || elNome.textContent).split('\n').pop().trim() : "Viatura";
    const justificativa = document.getElementById('justificativa-estorno-global').value.trim();
    const unidadeGestoraId = currentUserData.unidade_id || (typeof dados !== 'undefined' ? dados.unidade_id : null);

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

        // 1. MAPEIA ESTADO ANTERIOR
        const mapaAnterior = {};
        listaAnterior.forEach(setor => {
            (setor.itens || []).forEach(it => {
                mapaAnterior[it.uid_global] = (mapaAnterior[it.uid_global] || 0) + (Number(it.quantidadeEsperada) || 0);
            });
        });

        // 2. IDENTIFICA MUDANÇAS LÍQUIDAS NA ARQUITETURA ATIVA
        const mapaAtual = {};
        arquiteturaAtiva.forEach(setor => {
            (setor.itens || []).forEach(it => {
                if (it.uid_global !== "ITEM_VISTORIA_LIVRE") {
                    mapaAtual[it.uid_global] = (mapaAtual[it.uid_global] || 0) + (Number(it.quantidadeEsperada) || 0);
                }
            });
        });

        // --- A. ATUALIZA A ESTRUTURA DA LISTA ---
        batch.update(listaRef, {
            list: arquiteturaAtiva,
            ultima_edicao_arquitetura: firebase.firestore.FieldValue.serverTimestamp(),
            editado_por: currentUserData.nome_militar_completo
        });

        const idEvento = "EDT-" + Date.now();
        const dataReg = new Date().toLocaleString('pt-BR');

        // --- B. PROCESSA LOGÍSTICA DE INVENTÁRIO ---

        // B1. SAÍDAS E ENTRADAS PROPORCIONAIS (Itens Single)
        // Comparamos o total que havia na lista vs o total que há agora
        const todosUids = new Set([...Object.keys(mapaAnterior), ...Object.keys(mapaAtual)]);

        for (const uid of todosUids) {
            const qtdAnt = mapaAnterior[uid] || 0;
            const qtdAtu = mapaAtual[uid] || 0;
            const diferenca = qtdAtu - qtdAnt; // Positivo = saiu do estoque | Negativo = voltou

            if (diferenca !== 0) {
                const itemDoc = estoqueGestorLocal.find(i => i.uid_global === uid);
                if (itemDoc && itemDoc.tipo === 'single') {
                    const saldoRef = firestore.collection('inventario').doc(uid).collection('saldos_unidades').doc(unidadeGestoraId);
                    batch.update(saldoRef, {
                        qtd_disp: firebase.firestore.FieldValue.increment(-diferenca),
                        qtd_em_carga: firebase.firestore.FieldValue.increment(diferenca),
                        last_update: dataReg
                    });
                }
            }
        }

        // B2. PROCESSA ITENS MULTI (Tombamentos Novos)
        arquiteturaAtiva.forEach(setor => {
            (setor.itens || []).forEach(item => {
                if (item.tipo === 'multi' && item.uid_global !== "ITEM_VISTORIA_LIVRE") {
                    // Verifica se este item/tombamento já existia na lista anterior
                    // Se é novo (não estava no mapaAnterior), atualiza o prontuário
                    (item.tombamentos || []).forEach(t => {
                        const itemRef = firestore.collection('inventario').doc(item.uid_global);
                        const tombRef = itemRef.collection('tombamentos').doc(t.tomb);

                        batch.update(tombRef, {
                            situacao_atual: "EM CARGA",
                            viatura_id: idListaSendoEditada,
                            sub_local: setor.nome
                        });
                        batch.set(tombRef.collection('historico_vida').doc(idEvento), {
                            data: dataReg, evento: "SAIDA_EDITOR", quem: currentUserData.nome_militar_completo,
                            detalhes: `Alocado no setor ${setor.nome} da lista ${nomeAmigavelVtr}.`
                        });
                    });
                }
            });
        });

        // B3. PROCESSA ESTORNOS (Itens Multi que voltaram ao estoque)
        for (const item of estornosReais) {
            if (item.tipo === 'multi') {
                const itemRef = firestore.collection('inventario').doc(item.uid_global);
                for (const t of (item.tombamentos || [])) {
                    const tombRef = itemRef.collection('tombamentos').doc(t.tomb);
                    batch.update(tombRef, {
                        situacao_atual: "DISPONÍVEL",
                        viatura_id: null,
                        sub_local: "ALMOXARIFADO"
                    });
                    batch.set(tombRef.collection('historico_vida').doc(idEvento), {
                        data: dataReg, evento: "ESTORNO_EDITOR", quem: currentUserData.nome_militar_completo,
                        detalhes: `Removido da lista ${nomeAmigavelVtr}. Motivo: ${justificativa}`
                    });
                }
            }
            // Nota: Itens Single removidos já são tratados pelo cálculo de diferença no passo B1
        }

        await batch.commit();
        await Swal.fire({ icon: 'success', title: 'Publicado!', text: 'Inventário atualizado com sucesso.', timer: 2000, showConfirmButton: false });
        location.reload();

    } catch (e) {
        console.error("Erro na publicação:", e);
        alert("Falha ao salvar: " + e.message);
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
