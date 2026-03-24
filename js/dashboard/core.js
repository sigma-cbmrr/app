// Constantes Globais
const COLECAO_RESULTADOS = 'resultados_conferencias';
const COLECAO_LISTAS = 'listas_conferencia';
const itensPorPagina = 20; //limite da tabela inicial do almoxarifado, para evitar lentidão e travamentos.

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
let itemSelecionadoTemp = null;
let itensExibidosAlmox = 20; 
let paginaAtualAlmox = 1; // Página inicial do almoxarifado
let itemSendoVisualizado = null; // Estado Global
let dadosHistoricoTemp = []; //filtro do histórico global para evitar reconsultas desnecessárias
const trugNamesCache = {}; // Objeto global para evitar múltiplas leituras ao banco para o mesmo TRUG

// --- 1. AUTH & PERMISSÕES ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        try {
            const doc = await db.collection('usuarios').doc(user.uid).get();

            if (doc.exists) {
                currentUserData = doc.data();
                conferente = currentUserData.nome_militar_completo;

                // --- 🛠️ INJEÇÃO DE DADOS NA INTERFACE (HEADER) ---

                // 1. Nome de Guerra ou Completo
                const elNome = document.getElementById('user-name-top');
                if (elNome) {
                    elNome.innerText = currentUserData.nome_guerra || currentUserData.nome_completo || "MILITAR";
                }

                // 2. Sigla da Unidade
                const elUnidade = document.getElementById('user-unit-top');
                if (elUnidade) {
                    elUnidade.innerText = currentUserData.unidade || "SIGMA";
                }

                // 3. Nível de Acesso (Mapeamento amigável)
                const roleMap = { 'admin': 'Administrador', 'gestor': 'Gestor Local', 'operacional': 'Operacional' };
                const elRole = document.getElementById('user-role-top');
                const elAcesso = document.getElementById('user-access-top');
                const labelRole = roleMap[currentUserData.role] || "MILITAR";

                if (elRole) elRole.innerText = labelRole;
                if (elAcesso) elAcesso.innerText = labelRole;

                // 4. Avatar (Foto ou Gerador de Iniciais)
                const elAvatar = document.getElementById('user-avatar-top');
                if (elAvatar) {
                    if (currentUserData.foto_url) {
                        elAvatar.src = currentUserData.foto_url;
                    } else {
                        const iniciais = (currentUserData.nome_guerra || "M").substring(0, 2).toUpperCase();
                        elAvatar.src = `https://ui-avatars.com/api/?name=${iniciais}&background=800020&color=fff&bold=true`;
                    }
                }

                // --- 🚀 DISPARO DE FUNÇÕES DE TELA ---
                setupUIBasedOnRole();
                atualizarSaudacao(currentUserData);

            } else {
                console.warn("Usuário logado mas sem documento no Firestore.");
                window.location.href = 'index.html';
            }
        } catch (e) {
            console.error("Erro ao carregar dados do usuário:", e);
        }
    } else {
        window.location.href = 'index.html';
    }
});

//--- GERENCIAMENTO DE VIEWS ---//
function switchView(v) {
    // 1. LIMPEZAS E PREPARAÇÕES INICIAIS
    const editorArq = document.getElementById('view-editor-arquitetura');
    if (editorArq) editorArq.style.display = 'none';

    const contentPrincipal = document.querySelector('.content');
    if (contentPrincipal) contentPrincipal.style.padding = '20px';

    document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');

    const appRunner = document.getElementById('app-runner-container');
    if (appRunner) { appRunner.style.display = 'none'; }

    // ✅ GESTÃO AUTOMÁTICA DE SUBMENUS: Se sair das cautelas, retrai o menu e reseta a seta
    if (v && !v.startsWith('cautelas')) {
        const submenuCautelas = document.getElementById('submenu-cautelas');
        const linkCautelasGroup = document.getElementById('link-cautelas-group');

        if (submenuCautelas) {
            submenuCautelas.style.display = 'none';
        }

        if (linkCautelasGroup) {
            const arrow = linkCautelasGroup.querySelector('.arrow-icon');
            if (arrow) arrow.style.transform = 'rotate(0deg)';
        }
    }

    // ✅ LIMPEZA DE LAYOUT: Reseta o container master e garante que colunas fantasmas não apareçam
    const masterContainer = document.getElementById('dashboard-content-by-role');
    const detailPlaceholder = document.getElementById('detail-placeholder');
    const detailColumn = document.querySelector('.dashboard-detail-column');
    const caTableWrapper = document.getElementById('ca-table-wrapper');

    if (masterContainer) {
        masterContainer.classList.remove('dashboard-operacional-full');
        if (v !== 'dashboard') {
            masterContainer.style.setProperty('display', 'none', 'important');
        }
    }

    if (detailPlaceholder) detailPlaceholder.style.display = 'none';
    if (caTableWrapper) caTableWrapper.style.display = 'none';
    if (detailColumn) detailColumn.style.setProperty('display', 'none', 'important');

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

        // ✅ CORREÇÃO: Apenas o subitem recebe a classe 'active'
        const subLink = document.getElementById(`link-${v}`);
        if (subLink) {
            subLink.classList.add('active');
        }

        // O menu pai (link-cautelas-group) NÃO recebe active aqui, 
        // assim ele permanece com a cor padrão de item não selecionado.

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
        if (resCont) resCont.innerHTML = '';

        carregarAlertasTransferencia();

        if (currentUserData) {
            const role = currentUserData.role || 'operacional';
            if (role === 'operacional') {
                if (masterContainer) masterContainer.style.setProperty('display', 'block', 'important');
                if (detailColumn) detailColumn.style.setProperty('display', 'none', 'important');
                renderOperacionalCards();
            } else {
                if (masterContainer) masterContainer.style.setProperty('display', 'flex', 'important');
                if (detailColumn) detailColumn.style.setProperty('display', 'block', 'important');

                const canViewDashboardCards = true;
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

//--- 2. CONFIGURAÇÃO DA INTERFACE COM BASE NO PAPEL DO USUÁRIO ---//
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
            // Agora permite se for Cúpula OU se for Gestor Local
            const temPermissao = souCúpula || isGestorLocal;
            el.style.display = (!isOperacional && temPermissao) ? 'inline-flex' : 'none';
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

//--- RENDERIZAÇÃO DE DADOS DO USUÁRIO NA INTERFACE ---//
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

//--- ATUALIZAÇÃO DINÂMICA DO PERFIL NO HEADER ---//
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

/*---RESPONSÁVEL POR ATUALIZAR A SAUDAÇÃO E A DATA NO DASHBOARD COMUM---*/
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

/*--- FAZ O LOGOUT DO USUÁRIO COM CONFIRMAÇÃO ---*/
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

//--- GERENCIAMENTO DE COMUNICAÇÃO COM IFRAME (CAUTELAS) ---//
function handleIframeMessage(event) {
    if (event.origin !== window.location.origin) return;

    if (event.data && event.data.type === 'SIGMA_FINISHED') {
        // Removi o alert comum e sugiro um Toast do Swal se quiser algo mais profissional
        Swal.fire({
            icon: 'success',
            title: 'Operação Finalizada',
            timer: 2000,
            showConfirmButton: false
        });

        // 1. Limpeza do Iframe
        const container = document.getElementById('app-runner-container');
        if (container) {
            container.style.display = 'none';
            document.getElementById('app-iframe').src = 'about:blank';
        }

        // 2. Restaura Interface
        const contentArea = document.getElementById('content-area');
        if (contentArea) contentArea.style.display = 'block';

        const sidebar = document.getElementById('sidebar') || document.getElementById('main-sidebar');
        if (sidebar) sidebar.style.display = 'block';

        // 3. Atualização Inteligente de Dados
        loadCautionsToReceive();
        loadActiveCautelas();

        // ✅ CORREÇÃO: Chama a renderização nova baseada no cargo do usuário
        const role = currentUserData ? currentUserData.role : 'operacional';

        if (role === 'operacional') {
            if (typeof renderOperacionalCards === 'function') {
                renderOperacionalCards();
            }
        } else {
            // Se for gestor e terminou algo no iframe, atualiza o painel de controle
            if (typeof loadCaaData === 'function') {
                loadCaaData();
            }
        }

        // 4. Navegação de retorno
        switchView('cautelas');
        if (typeof showCautelasDashboard === 'function') {
            showCautelasDashboard('Cautelas Ativas');
        }
    }
}