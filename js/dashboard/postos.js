//---GESTÃO DE POSTOS---//
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

//--- VINCULA OU DESVINCULA UMA LISTA DE CONFERÊNCIA AO POSTO (Atualiza o posto_id na lista e registra a movimentação) ---//
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

//--- ABRE O FORMULÁRIO DE CRIAÇÃO/EDIÇÃO DE POSTO ---//
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

//--- SALVA O POSTO NO FIREBASE (CRIAÇÃO OU EDIÇÃO) ---//
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

//--- FILTRO DE BUSCA PARA OS CARDS DE POSTOS (Busca Aproximada + Filtro de Grupos) ---//
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

//--- CARREGA OS POSTOS E RENDERIZA OS CARDS (Versão 3.0 com foco em UX e performance) ---//
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
            renderGrupo(missoes, 'Missões e Extras', '#2c3e50');

        container.innerHTML = htmlFinal;

    } catch (e) {
        console.error("Erro fatal ao carregar postos:", e);
        container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:40px; color:#e11d48;"><i class="fas fa-exclamation-circle fa-2x"></i><br><b>Erro ao sincronizar territórios.</b></div>`;
    }
}

//--- EXCLUSÃO LÓGICA DE POSTO (Padrão Sigma para manter histórico e evitar inconsistências) ---//
async function deletarPostoSistema(uid, nome) {
    // 1. Confirmação de Segurança com Design Crítico
    const confirmacao = await Swal.fire({
        title: 'Excluir Posto?',
        html: `Você está prestes a remover <b>${nome}</b>.<br><br>
               <div style="font-size: 0.8em; background: #fff5f5; color: #c53030; padding: 10px; border-radius: 8px; border: 1px solid #feb2b2;">
                <i class="fas fa-exclamation-triangle"></i> <b>AVISO:</b> Listas vinculadas a este posto ficarão com o local indefinido.
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