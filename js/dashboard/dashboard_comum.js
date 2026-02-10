/*---ABRER MODAL DE CONFERÊNCIA DE MATERIAIS---*/
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

//--- FILTRA AS LISTAS DE CONFERÊNCIA COM BASE NO POSTO SELECIONADO PELO USUÁRIO ---//
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

//--- QUANDO O USUÁRIO SELECIONA A LISTA, MOSTRA O RESUMO VISUAL E EXIBE O BOTÃO DE CONFIRMAR ---//
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

//--- CONTROLA O RESET DA SELEÇÃO DE MATERIAL PARA VOLTAR AO PASSO 1 ---//
function resetarSelecaoMaterial() {
    materialSelecionadoNoModal = null;
    const selectLista = document.getElementById('swal-select-lista');
    if (selectLista) selectLista.value = ""; // Limpa o select anterior

    document.getElementById('area-selecao-material').style.display = 'block';
    document.getElementById('resumo-material-vtr').style.display = 'none';
    document.getElementById('btn-confirmar-material-modal').style.display = 'none';
    document.getElementById('btn-trocar-material').style.display = 'none';
}

//--- QUANDO O USUÁRIO CONFIRMAR, INICIA A CONFERÊNCIA ABRINDO O IFRAME COM OS PARÂMETROS CORRETOS ---//
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

/*CONTROLA O BOTÃO + NA TELA INICIAL MOBILE*/
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