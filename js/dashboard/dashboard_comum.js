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
