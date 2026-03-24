//================================================//
//--- BLOCO 1: Gestão de Cabeçalhos e Listagem ---//
//===============================================//

//=== 1.1. ABRE O FORMULÁRIO PARA CRIAR OU EDITAR O CABEÇALHO DA LISTA (VTR, UNIDADE, POSTO) ===//
async function abrirFormularioLista(dadosEdicao = null) {
    const isEdit = !!dadosEdicao;
    // Identifica se o usuário é Master ou Gestor de Unidade
    const isMaster = currentUserData.nivel === 'MASTER';
    const minhaUnidadeId = currentUserData.unidade_id;

    Swal.fire({ title: 'Carregando opções...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const [snapAtivos, snapUnidades, snapPostos] = await Promise.all([
            db.collection('viaturas').orderBy('prefixo').get(),
            db.collection('unidades_estruturadas').where('ativo', '==', true).get(),
            db.collection('postos_estruturados').where('ativo', '==', true).get()
        ]);

        // 1. ATIVOS
        let optAtivos = '<option value="" disabled selected>Selecione o Ativo...</option>';
        snapAtivos.forEach(doc => {
            const v = doc.data();
            const sel = isEdit && dadosEdicao.ativo_id === doc.id ? 'selected' : '';
            optAtivos += `<option value="${doc.id}" data-nome="${v.prefixo}" ${sel}>${v.prefixo} (${v.placa})</option>`;
        });

        // 2. UNIDADES (COM TRAVA DE GESTOR)
        let optUnidades = '<option value="" disabled selected>Selecione a Unidade...</option>';
        snapUnidades.forEach(doc => {
            const u = doc.data();
            // Se não for Master, a única opção selecionada/visível deve ser a dele
            const isMinhaUnid = minhaUnidadeId === doc.id;
            let sel = '';
            
            if (isEdit) {
                sel = dadosEdicao.unidade_id === doc.id ? 'selected' : '';
            } else if (!isMaster && isMinhaUnid) {
                sel = 'selected';
            }

            optUnidades += `<option value="${doc.id}" data-sigla="${u.sigla}" ${sel}>${u.sigla}</option>`;
        });

        // 3. POSTOS
        let optPostos = '<option value="" disabled selected>Vincular ao Posto...</option>';
        snapPostos.forEach(doc => {
            const p = doc.data();
            const sel = isEdit && dadosEdicao.posto_id === doc.id ? 'selected' : '';
            optPostos += `<option value="${doc.id}" data-nome="${p.nome}" ${sel}>${p.nome}</option>`;
        });

        // Atributo disabled para o select caso não seja Master
        const lockUnidade = !isMaster ? 'disabled' : '';

        Swal.fire({
            title: isEdit ? '<i class="fas fa-edit"></i> Editar Lista' : '<i class="fas fa-plus-circle"></i> Nova Lista para conferência',
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
                            <select id="swal-lista-unidade" ${lockUnidade} class="swal2-select" style="width:100%; margin:5px 0 15px 0; border-radius: 10px; background-color: ${!isMaster ? '#f1f5f9' : '#fff'};">${optUnidades}</select>
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
            confirmButtonColor: isEdit ? '#2c7399' : '#1e293b',
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
                // Fecha o modal anterior e abre um novo loading para evitar o travamento
                Swal.fire({ title: 'Gravando dados...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                
                const abrirEditor = !isEdit;
                gravarCabecalhoListaV3(abrirEditor, isEdit ? dadosEdicao.uid : null, result.value);
            }
        });

    } catch (e) {
        console.error(e);
        Swal.fire('Erro', 'Falha ao carregar dependências.', 'error');
    }
}
//=== 1.2. GRAVA OS DADOS BÁSICOS DA LISTA NO FIRESTORE E DECIDE SE ABRE O EDITOR DE ITENS ===//
async function gravarCabecalhoListaV3(abrirEditor, uidExistente, dados) {
    // 1. Loading inicial
    Swal.fire({ 
        title: 'Validando integridade...', 
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading() 
    });

    try {
        const uidFinal = uidExistente || `LISTA_${dados.ativo_id}_${Date.now()}`;
        const docRef = db.collection('listas_conferencia').doc(uidFinal);

        // --- TRAVA DE SEGURANÇA V3: VALIDAÇÃO DE CUSTÓDIA ---
        if (uidExistente) {
            const snapAtual = await docRef.get();
            if (snapAtual.exists) {
                const dadosAntigos = snapAtual.data();
                const unidadeMudou = dadosAntigos.unidade_id !== dados.unidade_id;
                const temItensNaCarga = (dadosAntigos.list || []).some(setor => (setor.itens || []).length > 0);

                if (unidadeMudou && temItensNaCarga) {
                    Swal.close();
                    await Swal.fire({
                        icon: 'error',
                        title: 'Troca de Unidade Bloqueada',
                        html: `Esta lista já possui itens vinculados à unidade <b>${dadosAntigos.unidade_sigla}</b>.<br><br>` +
                              `Para mudar a unidade gestora, você deve primeiro <b>estornar todos os itens</b> ao estoque original ou excluir a lista.`,
                        confirmButtonColor: '#800020'
                    });
                    return; // Interrompe a gravação para evitar erro de saldo
                }
            }
        }

        // Se passou na trava ou é lista nova, prossegue com a gravação
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
            payload.list = []; 
        }

        await docRef.set(payload, { merge: true });

        Swal.close();

        if (abrirEditor) {
            abrirModalEditorItens(uidFinal, dados.ativo_nome);
        } else {
            await Swal.fire({ 
                icon: 'success', 
                title: 'Configurações Salvas!', 
                timer: 1500, 
                showConfirmButton: false 
            });
            
            if (typeof carregarCardsListasExistentes === 'function') {
                carregarCardsListasExistentes();
            }
        }

    } catch (e) {
        console.error("Erro ao gravar cabeçalho:", e);
        Swal.fire({
            icon: 'error',
            title: 'Falha na Gravação',
            text: 'Verifique sua conexão e tente novamente.'
        });
    }
}

//=== 1.3. BUSCA E RENDERIZA OS CARDS DE TODAS AS LISTAS EXISTENTES PARA O GESTOR ===//
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

        let query = db.collection('listas_conferencia')
            .where('tipo', '==', 'conferencia_materiais');

        if (!isAdminGeral) {
            query = query.where('unidade_id', '==', minhaUnidadeId);
        }

        const snap = await query.get();

        if (snap.empty) {
            container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:50px; color:#94a3b8;">Nenhuma lista localizada.</div>`;
            return;
        }

        let htmlAtivas = '';
        let htmlInativas = '';

        snap.forEach(doc => {
            const lista = doc.data();
            const isAtiva = lista.ativo !== false;
            const qtdItens = (lista.list || []).reduce((acc, setor) => acc + (setor.itens ? setor.itens.length : 0), 0);
            const listaJson = JSON.stringify({ uid: doc.id, ...lista }).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

            // ✅ CORREÇÃO: Iniciando a Div do Card (v3-posto-card)
            const cardHtml = `
                <div class="v3-posto-card" 
                     style="border-top: 6px solid ${isAtiva ? '#2c7399' : '#94a3b8'}; cursor:pointer; position:relative; ${isAtiva ? '' : 'filter: grayscale(1); opacity: 0.6; background: #f8fafc;'}" 
                     onclick="abrirModalEditorItens('${doc.id}', '${lista.ativo_nome}')">
                    
                    <div class="v3-card-menu-container" style="position: absolute; top: 10px; right: 10px; z-index: 10;">
                        <button class="v3-menu-btn" onclick="event.stopPropagation(); toggleCardMenu(this)" 
                                style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 5px; font-size: 1.2em;">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        
                        <div class="v3-card-dropdown" style="display: none; position: absolute; right: 0; top: 35px; background: white; border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border: 1px solid #f1f5f9; width: 180px; overflow: hidden; text-align: left;">
                            
                            <div class="v3-dd-item" onclick="event.stopPropagation(); abrirFormularioLista(JSON.parse('${listaJson}'))" 
                                 style="padding: 10px 15px; font-size: 0.85em; color: #475569; display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                <i class="fas fa-pencil-alt" style="width: 15px;"></i> Editar Informações
                            </div>

                            ${isAtiva ? `
                                <div class="v3-dd-item" onclick="event.stopPropagation(); gerenciarInativacaoLista('${doc.id}', '${lista.ativo_nome}')" 
                                     style="padding: 10px 15px; font-size: 0.85em; color: #f59e0b; display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                    <i class="fas fa-eye-slash" style="width: 15px;"></i> Inativar
                                </div>
                            ` : `
                                <div class="v3-dd-item" onclick="event.stopPropagation(); reativarLista('${doc.id}', '${lista.ativo_nome}')" 
                                     style="padding: 10px 15px; font-size: 0.85em; color: #1b8a3e; display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                    <i class="fas fa-eye" style="width: 15px;"></i> Reativar
                                </div>
                            `}

                            ${isAdminGeral ? `
                                <div class="v3-dd-item" onclick="event.stopPropagation(); deletarListaInteira('${doc.id}', '${lista.ativo_nome}')" 
                                     style="padding: 10px 15px; font-size: 0.85em; color: #ef4444; display: flex; align-items: center; gap: 10px; border-top: 1px solid #f1f5f9; cursor: pointer;">
                                    <i class="fas fa-trash-alt" style="width: 15px;"></i> Excluir Permanente
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div style="padding: 20px; display: flex; flex-direction: column; align-items: center; text-align: center; flex-grow: 1;">
                        <div class="v3-icon-box" style="background: ${isAtiva ? 'rgba(44, 115, 153, 0.1)' : '#e2e8f0'}; color: ${isAtiva ? '#2c7399' : '#64748b'}; width: 60px; height: 60px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 1.6em; margin-bottom: 15px;">
                            <i class="fa-solid fa-clipboard-list"></i>
                        </div>
                        <div style="margin-bottom: 10px;">
                            <span style="display:block; font-weight:900; font-size:1.2em; color:#1e293b; letter-spacing:-0.5px;">${lista.ativo_nome}</span>
                            <span class="v3-vtr-badge" style="margin-top: 5px; display: inline-block; background: ${isAtiva ? '#e0f2fe' : '#f1f5f9'}; color: ${isAtiva ? '#0369a1' : '#64748b'};">
                                ${isAtiva ? `${qtdItens} ITENS NO INVENTÁRIO` : 'LISTA ARQUIVADA'}
                            </span>
                        </div>
                        <div style="width: 100%; border-top: 1px solid #f1f5f9; padding-top: 12px; margin-top: auto; text-align: left;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <i class="fas fa-map-marker-alt" style="color:#94a3b8; font-size:0.75em;"></i>
                                <span style="font-size:0.8em; font-weight:700; color:#64748b;">${lista.posto_nome || 'N/D'} | ${lista.unidade_sigla || 'N/D'}</span>
                            </div>
                        </div>
                    </div>
                </div>`; // ✅ FECHAMENTO DA DIV PRINCIPAL

            if (isAtiva) htmlAtivas += cardHtml;
            else htmlInativas += cardHtml;
        });

        container.innerHTML = `
    <div style="grid-column: 1/-1; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
        <div style="width: 4px; height: 18px; background: #10b981; border-radius: 10px;"></div>
        <h3 style="color:#1e293b; font-size:0.95em; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin:0;">Listas Operacionais</h3>
    </div>
    
    ${htmlAtivas || `
        <div style="grid-column: 1/-1; background: #f8fafc; border: 2px dashed #e2e8f0; border-radius: 16px; padding: 40px 20px; text-align: center;">
            <div style="width: 50px; height: 50px; background: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                <i class="fa-solid fa-clipboard-check" style="color: #cbd5e1; font-size: 1.5em;"></i>
            </div>
            <h4 style="color: #64748b; font-size: 0.9em; font-weight: 700; margin-bottom: 5px;">Nenhuma lista ativa</h4>
            <p style="color: #94a3b8; font-size: 0.8em; margin: 0;">Inicie um novo inventário ou checklist para que ele apareça aqui.</p>
        </div>
    `}

    <div style="grid-column: 1/-1; margin-top: 50px; padding-top: 30px; border-top: 1px solid #f1f5f9; display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
        <div style="width: 4px; height: 18px; background: #94a3b8; border-radius: 10px;"></div>
        <h3 style="color:#64748b; font-size:0.85em; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin:0;">Arquivos e Histórico</h3>
    </div>

    ${htmlInativas || `
        <div style="grid-column: 1/-1; padding: 30px; text-align: center; opacity: 0.6;">
            <i class="fa-solid fa-box-archive" style="color: #cbd5e1; font-size: 1.2em; margin-bottom: 10px; display: block;"></i>
            <span style="color: #94a3b8; font-size: 0.8em; font-weight: 600;">O arquivo de listas inativas está vazio.</span>
        </div>
    `}
`;

        if (window.FontAwesome) FontAwesome.dom.i2svg();

    } catch (e) {
        console.error(e);
        container.innerHTML = `<p style="color:red; text-align:center; padding:40px;">Erro ao carregar inventários.</p>`;
    }
}

//=== 1.4. FILTRA OS CARDS DAS LISTAS (ACESAS E APAGADAS) EM TEMPO REAL ===//
function filtrarCardsListas() {
    const termo = document.getElementById('filter-lista-busca').value.toUpperCase();
    const container = document.getElementById('container-cards-listas');
    if (!container) return;

    // 1. Filtra todos os cards
    const cards = container.querySelectorAll('.v3-posto-card');
    cards.forEach(card => {
        const textoCard = card.innerText.toUpperCase();
        card.style.display = textoCard.includes(termo) ? "flex" : "none";
    });

    // 2. Inteligência Visual: Esconde os títulos (h3) se o grupo ficar vazio no filtro
    const grupos = container.querySelectorAll('div[style*="grid-column: 1/-1"]');
    grupos.forEach(grupo => {
        const titulo = grupo.querySelector('h3');
        if (titulo) {
            // Verifica se existe algum card visível após este título até o próximo grupo
            let proximoElemento = grupo.nextElementSibling;
            let temCorrespondente = false;

            while (proximoElemento && !proximoElemento.style.gridColumn.includes('1/-1')) {
                if (proximoElemento.classList.contains('v3-posto-card') && proximoElemento.style.display !== 'none') {
                    temCorrespondente = true;
                    break;
                }
                proximoElemento = proximoElemento.nextElementSibling;
            }

            // Se não houver nenhum card visível no bloco, esconde o título do grupo
            grupo.style.display = temCorrespondente ? "block" : "none";
        }
    });
}

//=== 1.5. EXCLUI DEFINITIVAMENTE UMA LISTA E SEU INVENTÁRIO DO BANCO ===//
async function deletarListaInteira(listaUid, nomeAtivo) {
    const firestore = firebase.firestore();

    Swal.fire({
        title: 'Verificando inventário...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const docSnap = await firestore.collection('listas_conferencia').doc(listaUid).get();
        if (!docSnap.exists) {
            Swal.fire('Erro', 'Lista não localizada.', 'error');
            return;
        }

        const dadosLista = docSnap.data();
        const arquiteturaRemover = dadosLista.list || [];

        // Calcula total de itens
        let totalItensContagem = 0;
        arquiteturaRemover.forEach(setor => {
            totalItensContagem += (setor.itens ? setor.itens.length : 0);
        });
        const temItens = totalItensContagem > 0;

        // --- 1. CONFIRMAÇÃO E JUSTIFICATIVA ---
        const { value: justificativa, isConfirmed } = await Swal.fire({
            title: temItens ? '⚠️ ESTORNO E EXCLUSÃO' : 'Excluir Lista?',
            html: temItens 
                ? `Esta lista possui itens em carga. Digite o <b>motivo da exclusão</b> para devolver o material ao estoque:` 
                : `Deseja remover a lista <b>${nomeAtivo}</b>?`,
            icon: 'warning',
            input: temItens ? 'text' : undefined,
            inputPlaceholder: 'Ex: Viatura baixada, erro de digitação...',
            showCancelButton: true,
            confirmButtonText: 'Sim, Processar Exclusão',
            confirmButtonColor: '#d33',
            cancelButtonText: 'Cancelar',
            inputValidator: (value) => {
                if (temItens && !value) return 'Você precisa digitar uma justificativa!';
            }
        });

        if (!isConfirmed) return;

        Swal.fire({ title: 'Processando Estornos...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const batch = firestore.batch();
        const unidadeId = currentUserData.unidade_id;
        const unidadeSigla = currentUserData.unidade_sigla || "N/D";
        const dataReg = new Date().toLocaleString('pt-BR');

        // --- 2. LÓGICA DE ESTORNO V3 ---
        if (temItens) {
            for (const setor of arquiteturaRemover) {
                for (const itemSaida of (setor.itens || [])) {
                    if (itemSaida.uid_global === "ITEM_VISTORIA_LIVRE") continue;

                    const uidGlobal = itemSaida.uid_global;
                    const itemRef = firestore.collection('inventario').doc(uidGlobal);
                    const saldoRef = itemRef.collection('saldos_unidades').doc(unidadeId);
                    
                    // Calculamos a quantidade total a devolver (Pai + Acessórios se houver)
                    // Para simplificar e manter a integridade, focamos no item principal e seus componentes
                    const qtdPrincipal = Number(itemSaida.quantidadeEsperada) || 1;

                    // A. TRATAMENTO DE ITENS SINGLE (VIRTUAIS)
                    if (itemSaida.tipo === 'single' || itemSaida.tipo === 'consumo') {
                        const snapV = await itemRef.collection('tombamentos')
                            .where('viatura_id', '==', listaUid)
                            .get();

                        snapV.forEach(docV => {
                            batch.update(docV.ref, {
                                situacao_atual: "DISPONÍVEL",
                                local_id: "ALMOXARIFADO",
                                viatura_id: null,
                                sub_local: "ALMOXARIFADO",
                                data_movimentacao: dataReg
                            });
                        });
                    } 
                    // B. TRATAMENTO DE ITENS MULTI (PATRIMÔNIO)
                    else if (itemSaida.tipo === 'multi' && itemSaida.tombamentos) {
                        itemSaida.tombamentos.forEach(t => {
                            const tombRef = itemRef.collection('tombamentos').doc(t.tomb);
                            batch.update(tombRef, {
                                situacao_atual: "DISPONÍVEL",
                                local_id: "ALMOXARIFADO",
                                viatura_id: null,
                                sub_local: "ALMOXARIFADO",
                                data_movimentacao: dataReg
                            });

                            batch.set(tombRef.collection('historico_vida').doc(), {
                                data: dataReg,
                                evento: "ESTORNO_POR_EXCLUSAO",
                                quem: currentUserData.nome_militar_completo,
                                detalhes: `Lista ${nomeAtivo} excluída. Motivo: ${justificativa}`
                            });
                        });
                    }

                    // C. ATUALIZAÇÃO DE SALDOS (PADRÃO V3: disp / uso)
                    batch.set(saldoRef, {
                        disp: firebase.firestore.FieldValue.increment(qtdPrincipal),
                        uso: firebase.firestore.FieldValue.increment(-qtdPrincipal),
                        last_update: dataReg
                    }, { merge: true });

                    const pathCache = `unidades_cache.${unidadeId}`;
                    batch.update(itemRef, {
                        [`${pathCache}.disp`]: firebase.firestore.FieldValue.increment(qtdPrincipal),
                        [`${pathCache}.uso`]: firebase.firestore.FieldValue.increment(-qtdPrincipal),
                        ultima_movimentacao: dataReg
                    });

                    // Log de Fluxo na Unidade
                    const histRef = saldoRef.collection('historico_vida').doc();
                    batch.set(histRef, {
                        data: dataReg,
                        evento: "ESTORNO_POR_EXCLUSAO",
                        detalhes: `Estorno de ${qtdPrincipal} un. devido à exclusão da lista ${nomeAtivo}.`,
                        quem: currentUserData.nome_militar_completo,
                        unidade: unidadeSigla
                    });
                }
            }
        }

        // --- 3. DELEÇÃO DO DOCUMENTO DA LISTA ---
        batch.delete(firestore.collection('listas_conferencia').doc(listaUid));

        await batch.commit();

        await Swal.fire({
            icon: 'success',
            title: 'Lista Removida',
            text: temItens ? 'Itens estornados e lista apagada com sucesso.' : 'Lista apagada.',
            timer: 2000,
            showConfirmButton: false
        });

        if (typeof carregarCardsListasExistentes === "function") {
            carregarCardsListasExistentes();
        } else {
            location.reload();
        }

    } catch (e) {
        console.error("Erro ao deletar lista:", e);
        Swal.fire('Erro', 'Falha na exclusão: ' + e.message, 'error');
    }
}

//=== 1.6. INATIVA A LISTA (APAGA O CARD) PERGUNTANDO SE DEVE ESTORNAR OS ITENS OU MANTER A CARGA ===//
async function gerenciarInativacaoLista(listaUid, nomeAtivo) {
    const firestore = firebase.firestore();

    // 1. Loading de verificação
    Swal.fire({
        title: 'Verificando inventário...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const listaRef = firestore.collection('listas_conferencia').doc(listaUid);
        const docSnap = await listaRef.get();

        if (!docSnap.exists) {
            Swal.fire('Erro', 'Lista não localizada.', 'error');
            return;
        }

        const dadosLista = docSnap.data();
        const arquitetura = dadosLista.list || [];
        const totalItens = arquitetura.reduce((acc, setor) => acc + (setor.itens ? setor.itens.length : 0), 0);
        const temItens = totalItens > 0;

        // 2. CONFIGURAÇÃO DINÂMICA DO MODAL
        let configModal;
        if (temItens) {
            configModal = {
                title: 'Inativar Lista?',
                html: `A lista <b>${nomeAtivo}</b> contém ${totalItens} itens.<br><br>Escolha o destino dos materiais:`,
                icon: 'warning',
                showDenyButton: true,
                confirmButtonText: 'Manter Carga e Inativar',
                denyButtonText: 'Estornar e Inativar',
                confirmButtonColor: '#f59e0b',
                denyButtonColor: '#d33',
                width: '550px'
            };
        } else {
            configModal = {
                title: 'Inativar Lista?',
                html: `A lista <b>${nomeAtivo}</b> está vazia e será movida para o grupo de inativas.`,
                icon: 'question',
                confirmButtonText: 'Confirmar Inativação',
                confirmButtonColor: '#2c7399'
            };
        }

        const { isConfirmed, isDenied, isDismissed } = await Swal.fire({
            ...configModal,
            showCancelButton: true,
            cancelButtonColor: '#64748b',
            cancelButtonText: 'Voltar'
        });

        if (isDismissed) return;

        // JUSTIFICATIVA PARA ESTORNO
        let justificativa = "";
        if (isDenied && temItens) {
            const { value: text, isConfirmed: confJust } = await Swal.fire({
                title: 'Motivo do Estorno',
                input: 'text',
                inputPlaceholder: 'Ex: Viatura baixada definitivamente...',
                showCancelButton: true,
                confirmButtonText: 'Concluir Estorno',
                cancelButtonText: 'Cancelar',
                inputValidator: (value) => {
                    if (!value) return 'Você precisa justificar o retorno ao estoque!';
                }
            });
            if (!confJust) return;
            justificativa = text;
        }

        // 3. PROCESSAMENTO
        Swal.fire({ title: 'Processando...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

        const batch = firestore.batch();
        const unidadeId = currentUserData.unidade_id;
        const unidadeSigla = currentUserData.unidade_sigla || "N/D";
        const dataReg = new Date().toLocaleString('pt-BR');

        // LÓGICA DE ESTORNO V3 (APENAS SE ESCOLHER DENY)
        if (isDenied && temItens) {
            for (const setor of arquitetura) {
                for (const itemSaida of (setor.itens || [])) {
                    if (itemSaida.uid_global === "ITEM_VISTORIA_LIVRE") continue;

                    const uidGlobal = itemSaida.uid_global;
                    const itemRef = firestore.collection('inventario').doc(uidGlobal);
                    const saldoRef = itemRef.collection('saldos_unidades').doc(unidadeId);
                    const qtdPrincipal = Number(itemSaida.quantidadeEsperada) || 1;

                    // A. TRATAMENTO SINGLE (VIRTUAL)
                    if (itemSaida.tipo === 'single' || itemSaida.tipo === 'consumo') {
                        const snapV = await itemRef.collection('tombamentos')
                            .where('viatura_id', '==', listaUid)
                            .get();

                        snapV.forEach(docV => {
                            batch.update(docV.ref, {
                                situacao_atual: "DISPONÍVEL",
                                local_id: "ALMOXARIFADO",
                                viatura_id: null,
                                sub_local: "ALMOXARIFADO",
                                data_movimentacao: dataReg
                            });
                        });
                    } 
                    // B. TRATAMENTO MULTI (PATRIMÔNIO)
                    else if (itemSaida.tipo === 'multi' && itemSaida.tombamentos) {
                        itemSaida.tombamentos.forEach(t => {
                            const tombRef = itemRef.collection('tombamentos').doc(t.tomb);
                            batch.update(tombRef, {
                                situacao_atual: "DISPONÍVEL",
                                local_id: "ALMOXARIFADO",
                                viatura_id: null,
                                sub_local: "ALMOXARIFADO",
                                data_movimentacao: dataReg
                            });
                        });
                    }

                    // C. ATUALIZAÇÃO CONTÁBIL (PADRÃO V3)
                    batch.set(saldoRef, {
                        disp: firebase.firestore.FieldValue.increment(qtdPrincipal),
                        uso: firebase.firestore.FieldValue.increment(-qtdPrincipal),
                        last_update: dataReg
                    }, { merge: true });

                    const pathCache = `unidades_cache.${unidadeId}`;
                    batch.update(itemRef, {
                        [`${pathCache}.disp`]: firebase.firestore.FieldValue.increment(qtdPrincipal),
                        [`${pathCache}.uso`]: firebase.firestore.FieldValue.increment(-qtdPrincipal),
                        ultima_movimentacao: dataReg
                    });

                    // Log de Fluxo
                    const histRef = saldoRef.collection('historico_vida').doc();
                    batch.set(histRef, {
                        data: dataReg, evento: "ESTORNO_POR_INATIVACAO", quem: currentUserData.nome_militar_completo,
                        detalhes: `Material retornado à unidade devido à inativação da lista ${nomeAtivo}.`,
                        justificativa: justificativa, unidade: unidadeSigla
                    });
                }
            }
        }

        // 4. ATUALIZA STATUS DA LISTA
        batch.update(listaRef, {
            ativo: false,
            inativado_em: firebase.firestore.FieldValue.serverTimestamp(),
            inativado_por: currentUserData.nome_militar_completo,
            motivo_inativacao: isDenied ? justificativa : "Inativação com manutenção de carga"
        });

        await batch.commit();

        await Swal.fire({
            icon: 'success', title: isDenied ? 'Estornado e Inativado!' : 'Lista Inativada!',
            text: `A lista ${nomeAtivo} foi arquivada.`, timer: 2000, showConfirmButton: false
        });

        if (typeof carregarCardsListasExistentes === "function") carregarCardsListasExistentes();
        else location.reload();

    } catch (e) {
        console.error("Erro na inativação:", e);
        Swal.fire('Erro', 'Falha ao processar: ' + e.message, 'error');
    }
}

//=== 1.7. REATIVA A LISTA (ACENDE O CARD) TRAZENDO-A DE VOLTA PARA O GRID DE OPERAÇÃO ===//
async function reativarLista(listaUid, nomeAtivo) {
    const confirm = await Swal.fire({
        title: 'Reativar Lista?',
        text: `A lista do ${nomeAtivo} voltará para o grid principal de operação.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#1b8a3e',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sim, Reativar',
        cancelButtonText: 'Cancelar'
    });

    if (!confirm.isConfirmed) return;

    Swal.fire({ title: 'Reativando...', didOpen: () => Swal.showLoading() });

    try {
        const firestore = firebase.firestore();

        // Atualiza para ativo e registra quem/quando reativou
        await firestore.collection('listas_conferencia').doc(listaUid).update({
            ativo: true,
            reativado_em: firebase.firestore.FieldValue.serverTimestamp(),
            reativado_por: currentUserData.nome_militar_completo,
            // Limpa campos de inativação para manter o histórico limpo
            inativado_em: firebase.firestore.FieldValue.delete(),
            inativado_por: firebase.firestore.FieldValue.delete()
        });

        await Swal.fire({
            icon: 'success',
            title: 'Lista Ativa!',
            text: `O card do ${nomeAtivo} foi aceso com sucesso.`,
            timer: 2000,
            showConfirmButton: false
        });

        // Recarrega o grid para a lista "subir" para o grupo principal
        carregarCardsListasExistentes();

    } catch (e) {
        console.error("Erro ao reativar lista:", e);
        Swal.fire('Erro', 'Não foi possível reativar: ' + e.message, 'error');
    }
}

//=== 1.8. CONTROLE DO MENU DROPDOWN DO CARD ===//
function toggleCardMenu(btn) {
    // 1. Localiza o menu específico deste botão
    const menu = btn.nextElementSibling;

    // 2. Fecha todos os outros menus abertos (menos o atual)
    document.querySelectorAll('.v3-card-dropdown').forEach(dd => {
        if (dd !== menu) dd.style.display = 'none';
    });

    // 3. Alterna o estado do menu atual
    const isVisible = menu.style.display === 'block';
    menu.style.display = isVisible ? 'none' : 'block';

    // 4. Bloqueia o clique de se propagar para o card pai (IMPORTANTE)
    // Se o evento não for interrompido, o card vai disparar o 'onclick' dele.
    if (window.event) window.event.stopPropagation();
}

//=== 1.8.1. AUXILIAR: Fecha o menu se clicar em qualquer lugar da tela ===//
document.addEventListener('click', function (event) {
    const isClickInsideMenu = event.target.closest('.v3-card-menu-container');

    if (!isClickInsideMenu) {
        document.querySelectorAll('.v3-card-dropdown').forEach(dd => {
            dd.style.display = 'none';
        });
    }
});

//==================================================================//
//--- BLOCO 2: Motor do Editor de Arquitetura (Setores e Itens) ---//
//=================================================================//

//=== 1. PREPARA O PALCO DO EDITOR, IDENTIFICA SE É CHECKLIST OU MATERIAL E CARREGA O ESTOQUE ===//
async function abrirModalEditorItens(uid, nome, colecaoAlvo) {
    const firestore = firebase.firestore();

    // 1. NORMALIZAÇÃO DE ID
    let idReal = (typeof uid === 'object' && uid !== null) ? (uid.id || uid.uid || uid.checklistId) : String(uid);
    idReal = idReal.trim();
    idListaSendoEditada = idReal;

    itensParaEstorno = [];
    if (typeof atualizarInterfaceEstorno === 'function') atualizarInterfaceEstorno();

    // 2. DEFINIÇÃO DE CONTEXTO
    if (idReal.startsWith('CHECKLIST_VTR_')) {
        window.colecaoAtivaNoEditor = 'listas_checklist';
        window.isModoVistoria = true;
    } else {
        window.colecaoAtivaNoEditor = colecaoAlvo || 'listas_conferencia';
        window.isModoVistoria = false;
    }

    const modoCor = window.isModoVistoria ? '#2c3e50' : '#800020';
    const modoTexto = window.isModoVistoria ? 'EDITOR DE CHECKLIST' : 'EDITOR DE LISTA';
    const modoIcone = window.isModoVistoria ? 'fa-car' : 'fa-clipboard-list';

    // 3. TRANSIÇÃO DE TELA
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
            <div style="grid-column:1/-1; text-align:center; padding:50px; color:#64748b;">
                <i class="fas fa-sync fa-spin fa-2x" style="color: ${modoCor}; margin-bottom:15px;"></i><br>
                <b>SINCRONIZANDO ARQUITETURA...</b>
            </div>`;
    }

    try {
        // 4. BUSCA DOS DADOS DA LISTA
        let doc = await firestore.collection(window.colecaoAtivaNoEditor).doc(idReal).get();
        if (!doc.exists) throw new Error("A arquitetura desta lista não foi localizada.");

        const dados = doc.data();
        arquiteturaAtiva = dados.list || [];

        // 5. SINCRONIZAÇÃO DE RÓTULOS (Correção da sigla da unidade)
        const elUnidade = document.getElementById('edit-vtr-unidade');
        if (elUnidade) elUnidade.textContent = `Unidade: ${dados.unidade_sigla || dados.sigla || 'N/D'}`;

        const inputBusca = document.getElementById('input-busca-estoque');
        if (inputBusca) {
            inputBusca.placeholder = window.isModoVistoria ? "Digitar item de vistoria..." : "Pesquisar no inventário...";
        }

        // 6. CARGA DO ESTOQUE V3 (Crucial para o autocomplete funcionar)
        if (!window.isModoVistoria) {
            // Usamos o 'await' aqui para garantir que o autocomplete 'enxergue' os itens single
            // assim que a tela terminar de carregar.
            await prepararEstoqueParaEditor(); 
        } else {
            estoqueGestorLocal = [];
        }

        // 7. RENDERIZAÇÃO FINAL
        renderizarArquiteturaEditor();
        if (typeof atualizarSelectSetores === 'function') atualizarSelectSetores();

        const btnPub = document.querySelector('.btn-publish');
        if (btnPub) btnPub.style.backgroundColor = window.isModoVistoria ? '#2c7399' : '#1b8a3e';

    } catch (e) {
        console.error("❌ FALHA NO EDITOR:", e);
        alert(e.message);
        window.isModoVistoria ? switchView('vtr-bases') : switchView('listas');
    }
}

//=== 2. LIMPA O ESTADO DO EDITOR E RETORNA PARA A TELA DE LISTAGEM ===//
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

//=== 3. RENDERIZA A ESTRUTURA VISUAL DE SETORES E ITENS (SUPORTA DRAG & DROP) ===//
function renderizarArquiteturaEditor() {
    const container = document.getElementById('setores-drag-container');
    if (!container) return;

    container.innerHTML = '';
    const corTemaSetor = window.isModoVistoria ? '#2c3e50' : '#800020';

    if (arquiteturaAtiva.length === 0) {
        container.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:40px; color:#64748b;">
                <i class="fa-solid fa-folder-open fa-3x" style="display:block; margin-bottom:15px; opacity:0.3;"></i>
                Nenhum setor criado. Clique no botão + para começar.
            </div>`;
        return;
    }

    arquiteturaAtiva.forEach((setor, indexSetor) => {
        const setorDiv = document.createElement('div');
        setorDiv.className = 'setor-arquitetura-card';
        setorDiv.dataset.index = indexSetor;

        let htmlHeader = `
            <div class="setor-arquitetura-header" style="background-color: ${corTemaSetor} !important; display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; color: white;">
                <span style="font-weight: 800; text-transform: uppercase; font-size: 0.85em; letter-spacing: 0.5px;">
                    <i class="fa-solid fa-grip-lines" style="margin-right:10px; opacity:0.5;"></i> ${setor.nome}
                </span>
                <button onclick="removerSetorArquitetura(${indexSetor})" class="btn-remove-item-vtr" style="color:white; background:transparent; border:none; cursor:pointer; opacity: 0.7;">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>`;

        let htmlItens = `<div class="setor-arquitetura-body" data-setor-index="${indexSetor}" style="min-height: 50px; padding: 10px; background: #fff;">`;

        (setor.itens || []).forEach((item, indexItem) => {
            const listaAcessorios = item.acessorios_vinculados || item.acessorios_acoplados || [];
            const temTombamento = (item.tombamentos && item.tombamentos.length > 0);
            
            let iconClass = 'fa-boxes-stacked'; 
            let avatarClass = 'avatar-consumo';
            let ehAnfitriao = false;

            if (item.is_anfitriao === true || item.is_anfitriao === "true" || listaAcessorios.length > 0) {
                iconClass = 'fa-box-open';
                avatarClass = 'avatar-kit';
                ehAnfitriao = true;
            } else if (item.tipo === 'multi' || temTombamento) {
                iconClass = 'fa-tag';
                avatarClass = 'avatar-patrimonio';
            }

            const qtdPai = Number(item.quantidadeEsperada) || 1;

            // ✅ CORREÇÃO: Container principal agora é COLUMN para empilhar Título e Componentes
            htmlItens += `
                <div class="item-arquitetura-linha" data-item-index="${indexItem}" data-is-kit="${ehAnfitriao}" 
                     style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 12px; border-bottom: 1px solid #f1f5f9; position: relative; ${ehAnfitriao ? 'background: #fffcf5; border-left: 5px solid #f59e0b !important;' : ''}">
                    
                    <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                        <div class="sigma-icon-avatar ${avatarClass}" style="width: 32px; height: 32px; min-width: 32px; display: flex !important; align-items: center !important; justify-content: center !important;">
                            <i class="fa-solid ${iconClass}" style="font-family: 'Font Awesome 6 Free' !important; font-weight: 900 !important; font-size: 14px !important; display: flex !important;"></i>
                        </div>

                        <div style="flex: 1; min-width: 0;">
                            <b style="font-size: 0.9em; color: #1e293b; display: block; text-transform: uppercase; white-space: normal; line-height: 1.2;">${item.nome}</b>
                            <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-top: 4px;">
                                ${item.tipo === 'multi' ?
                                    (item.tombamentos || []).map(tData => `
                                        <span style="background: #f1f5f9; color: #475569; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; border: 1px solid #e2e8f0;">
                                            # ${tData.tomb || 'S/N'}
                                        </span>`).join('')
                                    :
                                    `<span style="color: #64748b; font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 4px;">
                                        <i class="fa-solid fa-layer-group" style="font-size: 9px; opacity: 0.5;"></i> QTD: ${item.quantidadeEsperada}
                                     </span>`
                                }
                            </div>
                        </div>

                        <button onclick="marcarParaEstorno(${indexSetor}, ${indexItem})" 
                                style="background: transparent; border: none; color: #94a3b8; cursor: pointer; padding: 5px; transition: 0.2s;"
                                onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#94a3b8'">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    ${listaAcessorios.length > 0 ? `
                        <div class="acessorios-vtr-container" style="width: 100%; margin-top: 5px; padding: 10px; background: rgba(255,255,255,0.6); border-radius: 8px; border: 1px solid #ffedd5; box-sizing: border-box; display: flex; flex-direction: column; gap: 6px;">
                            <small style="text-transform: uppercase; font-size: 0.65em; font-weight: 800; color: #f59e0b; margin-bottom: 2px; display: block; border-bottom: 1px solid #ffedd5; padding-bottom: 4px;">
                                <i class="fa-solid fa-boxes-packing"></i> Componentes do Kit
                            </small>
                            ${listaAcessorios.map((ac) => {
                                const qtdTotal = (Number(ac.quantidade) || 1) * qtdPai;
                                return `
                                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; padding: 2px 0;">
                                    <span style="color: #475569; font-weight: 600;">
                                        <i class="fa-solid fa-link" style="font-size: 9px; color: #f59e0b; margin-right: 6px;"></i> ${ac.nome}
                                    </span>
                                    <b style="color: #1e293b; background: #fff; padding: 2px 6px; border-radius: 4px; border: 1px solid #f1f5f9; font-size: 10px;">${qtdTotal} un.</b>
                                </div>`;
                            }).join('')}
                        </div>
                    ` : ''}
                </div>`;
        });

        htmlItens += `</div>`;
        setorDiv.innerHTML = htmlHeader + htmlItens;
        container.appendChild(setorDiv);

        // Sortable Setup (Mantido)
        new Sortable(setorDiv.querySelector('.setor-arquitetura-body'), {
            group: 'itens_viatura',
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: function (evt) {
                const fromIdx = evt.from.dataset.setorIndex;
                const toIdx = evt.to.dataset.setorIndex;
                const itemMovido = arquiteturaAtiva[fromIdx].itens.splice(evt.oldIndex, 1)[0];
                arquiteturaAtiva[toIdx].itens.splice(evt.newIndex, 0, itemMovido);
                if (typeof marcarAlteracao === 'function') marcarAlteracao();
            }
        });
    });
}

//=== 4. CACHEIA O ESTOQUE DISPONÍVEL DA UNIDADE PARA AGILIZAR A BUSCA NO EDITOR ===//
async function carregarEstoqueParaEditor(unidadeId) {
    try {
        console.log("🚀 [SIGMA V3] INICIANDO CARGA OTIMIZADA DE ESTOQUE:", unidadeId);
        estoqueGestorLocal = [];

        const snapItens = await db.collection('inventario').get();

        for (const doc of snapItens.docs) {
            const itemGlobal = doc.data();
            const uidItem = doc.id;
            const cache = (itemGlobal.unidades_cache && itemGlobal.unidades_cache[unidadeId]);
            
            if (cache && (Number(cache.total) > 0)) {
                const ehMulti = itemGlobal.tipo === 'multi';

                const objetoParaBusca = {
                    id_almox: uidItem,
                    uid_global: uidItem,
                    nome: (itemGlobal.nome || "Item sem nome").toUpperCase(),
                    tipo: itemGlobal.tipo,
                    categoria: itemGlobal.categoria || "OUTROS",
                    unidade_id: unidadeId,
                    
                    // Se for multi, marcamos como true para a função de seleção saber que precisa baixar os dados
                    precisaCarregarTombamentos: ehMulti, 
                    tombamentos: [], // Começa vazio para performance
                    
                    disponivel: Number(cache.disp) || 0,
                    is_anfitriao: itemGlobal.is_anfitriao || false,
                    componentes_regra: itemGlobal.componentes_regra || []
                };

                estoqueGestorLocal.push(objetoParaBusca);
            }
        }
        console.log(`🏁 [SIGMA V3] CACHE FINALIZADO: ${estoqueGestorLocal.length} itens.`);
    } catch (e) {
        console.error("❌ ERRO CRÍTICO NA CARGA DO ESTOQUE:", e);
    }
}

//======================================================//
//--- BLOCO 3: Inteligência de Adição e Modificação ---//
//=====================================================//

//=== 3.1. BUSCADOR INTELIGENTE (AUTOCOMPLETE) ===//
async function buscarItemParaAdicionar(termo) {
    const box = document.getElementById('sugestoes-estoque-editor');
    if (!box) return;

    const t = termo.toLowerCase().trim();
    if (t.length < 2) {
        box.style.display = 'none';
        return;
    }

    // --- 1. MAPEAMENTO DE TELA ---
    const tombamentosNaTela = [];
    const mapaRascunhosSingle = {}; 

    arquiteturaAtiva.forEach(setor => {
        (setor.itens || []).forEach(it => {
            if (it.tombamentos) {
                it.tombamentos.forEach(tm => {
                    const valTomb = typeof tm === 'object' ? tm.tomb : tm;
                    if (valTomb) tombamentosNaTela.push(String(valTomb));
                });
            }
            const qtdNovaPai = Number(it.quantidadeNoRascunho || 0);
            if (qtdNovaPai > 0) {
                const uidPai = it.uid_global;
                if (it.tipo !== 'multi') {
                    mapaRascunhosSingle[uidPai] = (mapaRascunhosSingle[uidPai] || 0) + qtdNovaPai;
                }
                const acessorios = it.acessorios_vinculados || it.acessorios_acoplados || it.componentes_regra;
                if (Array.isArray(acessorios)) {
                    acessorios.forEach(ac => {
                        const uidFilho = ac.uid_global || ac.id;
                        const qtdFilhoTotal = Number(ac.quantidade || ac.qtd_sugerida || 1) * qtdNovaPai;
                        if (uidFilho) mapaRascunhosSingle[uidFilho] = (mapaRascunhosSingle[uidFilho] || 0) + qtdFilhoTotal;
                    });
                }
            }
        });
    });

    const suggestions = [];
    const minhaUnidadeId = currentUserData.unidade_id;

    // --- 2. BUSCA NO ESTOQUE LOCAL ---
    for (const item of estoqueGestorLocal) {
        const nomeItem = (item.nome || "").toLowerCase();
        const categoriaItem = (item.categoria || "").toLowerCase();
        const uidItem = (item.uid_global || "").toLowerCase();
        const basicoMatch = nomeItem.includes(t) || categoriaItem.includes(t) || uidItem === t;

        if (item.tipo === 'multi') {
            if ((!item.tombamentos || item.tombamentos.length === 0) && (basicoMatch || !isNaN(t))) {
                if(typeof carregarTombamentosSobDemanda === 'function') {
                    await carregarTombamentosSobDemanda(item.uid_global, minhaUnidadeId);
                }
            }
            (item.tombamentos || []).forEach(tomb => {
                const numTomb = String(tomb.tomb);
                if ((basicoMatch || numTomb.toLowerCase().includes(t)) && (tomb.unidade_id === minhaUnidadeId || tomb.local_id === minhaUnidadeId)) {
                    const jaEstaNaTela = tombamentosNaTela.includes(numTomb);
                    suggestions.push({
                        ...item,
                        tombamentoExibicao: numTomb,
                        statusExtra: jaEstaNaTela ? "NA TELA" : (tomb.situacao_atual === "EM CARGA" ? "ALOCADO" : "DISPONÍVEL"),
                        id_unico: `${item.uid_global}_${numTomb}`,
                        disponivelReal: 1,
                        bloqueado: jaEstaNaTela || tomb.situacao_atual === "EM CARGA"
                    });
                }
            });
        } 
        else if (basicoMatch) {
            const cacheUnidade = item.unidades_cache ? item.unidades_cache[minhaUnidadeId] : null;
            const disponivelBanco = Number(item.resumo?.almox_disp ?? cacheUnidade?.disp ?? 0);
            const qtdRascunhoNaTela = mapaRascunhosSingle[item.uid_global] || 0;
            const saldoSeguro = disponivelBanco - qtdRascunhoNaTela;

            if (saldoSeguro > 0) {
                suggestions.push({
                    ...item,
                    id_unico: item.uid_global,
                    disponivelReal: saldoSeguro,
                    bloqueado: false
                });
            }
        }
    }

    // --- 3. RENDERIZAÇÃO MODERNA (SIGMA V3) ---
    if (suggestions.length === 0) {
        box.innerHTML = `<div style="padding:20px; text-align:center; color:#94a3b8;"><small style="font-weight:700;">Nenhum material localizado</small></div>`;
    } else {
        box.innerHTML = suggestions.slice(0, 15).map((i) => {
            const isIndisponivel = i.bloqueado;
            
            let iconClass = 'fa-boxes-stacked'; 
            let avatarClass = 'avatar-consumo';

            if (i.is_anfitriao === true || i.is_anfitriao === "true" || (i.componentes_regra && i.componentes_regra.length > 0)) {
                iconClass = 'fa-box-open';
                avatarClass = 'avatar-kit';
            } else if (i.tipo === 'multi' || i.tombamentoExibicao) {
                iconClass = 'fa-tag';
                avatarClass = 'avatar-patrimonio';
            }

            const itemEscaped = JSON.stringify(i).replace(/'/g, "\\'").replace(/"/g, "&quot;");
            const detail = i.tipo === 'multi' ? `PAT: ${i.tombamentoExibicao}` : `DISP: ${i.disponivelReal} un`;

            return `
            <div class="suggestion-item" 
                 onclick="${isIndisponivel ? '' : `selecionarSugestaoManual('${itemEscaped}')`}" 
                 style="opacity: ${isIndisponivel ? '0.5' : '1'}; cursor: ${isIndisponivel ? 'not-allowed' : 'pointer'}; display: flex; align-items: center; padding: 10px 15px; border-bottom: 1px solid #f1f5f9;">
                
                <div class="sigma-icon-avatar ${avatarClass}" style="display: flex !important; align-items: center !important; justify-content: center !important;">
                    <i class="fa-solid ${iconClass}" style="font-family: 'Font Awesome 6 Free' !important; font-weight: 900 !important; font-size: 16px !important; display: flex !important;"></i>
                </div>

                <div style="flex:1; overflow:hidden; margin-left: 12px;">
                    <b style="font-size:0.85em; color:#1e293b; display:block; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${i.nome}</b>
                    <small style="color:#64748b; font-weight:700; font-size:0.7rem;">${detail} ${i.statusExtra ? `• [${i.statusExtra}]` : ''}</small>
                </div>
            </div>`;
        }).join('');
    }
    box.style.display = 'block';
}

async function prepararEstoqueParaEditor() {
    const minhaUnidadeId = currentUserData.unidade_id;
    
    // 1. Busca todos os itens da nova coleção única
    const snap = await db.collection('inventario').get();
    
    // 2. Limpa o cache local que o buscador (autocomplete) usa
    estoqueGestorLocal = []; 

    snap.forEach(doc => {
        const d = doc.data();
        
        // 3. Acessa o mapa de cache da sua unidade (CCI)
        const cache = (d.unidades_cache && d.unidades_cache[minhaUnidadeId]) || null;

        // 4. Só adiciona se houver saldo ou se a unidade for a dona
        if (cache && (Number(cache.total || 0) > 0 || d.unidade_origem_id === minhaUnidadeId)) {
            estoqueGestorLocal.push({
                ...d,
                id_almox: doc.id,
                // Padroniza o resumo para que a busca encontre o campo 'almox_disp'
                resumo: {
                    almox_disp: Number(cache.disp || 0)
                }
            });
        }
    });
    console.log(`📦 Sigma V3: ${estoqueGestorLocal.length} itens prontos para alocação.`);
}

//=== 3.2. FINALIZA A ESCOLHA NO AUTOCOMPLETE ===//
async function selecionarSugestaoManual(itemRaw) {
    const box = document.getElementById('sugestoes-estoque-editor');
    const input = document.getElementById('input-busca-estoque');

    try {
        // 1. GARANTIA DE OBJETO: Se vier como string do HTML, converte para JSON
        let item = (typeof itemRaw === 'string') ? JSON.parse(itemRaw) : itemRaw;
        if (!item) return;

        console.log("🎯 Item selecionado:", item.nome);

        // 2. CAMADA DE SEGURANÇA PARA PATRIMONIADOS (MULTI)
        if (item.tipo === 'multi' && (!item.tombamentos || item.tombamentos.length === 0)) {
            const unidadeAlvo = currentUserData.unidade_id;
            
            // ✅ CORREÇÃO: Chamando a função correta de busca de tombamentos (Simetria V3)
            // Note que usei o nome da função que criamos para o rastreio individual
            const tombosReais = await carpZELkorMwhkkpShF5PvT8YnqRCupnLTNG(item.uid_global, unidadeAlvo);
            
            if (tombosReais && tombosReais.length > 0) {
                item.tombamentos = tombosReais;
            } else {
                Swal.fire({
                    icon: 'warning',
                    title: 'Material Indisponível',
                    text: 'Não localizamos exemplares livres deste patrimônio na sua unidade.',
                    confirmButtonColor: '#800020'
                });
                if (box) box.style.display = 'none';
                return;
            }
        }

        // 3. ENCAMINHA PARA O RASCUNHO (Popover ou Draft Card)
        if (typeof selecionarItemParaAdicionar === 'function') {
            selecionarItemParaAdicionar(item);
        }

    } catch (error) {
        console.error("❌ Erro Crítico no Editor (selecionarSugestaoManual):", error);
    } finally {
        // 4. UI CLEANUP
        if (box) box.style.display = 'none';
        
        if (input) {
            input.value = '';
            // Mantém o foco no input se for multi para permitir bips rápidos de patrimônio
            const itemParsed = (typeof itemRaw === 'string') ? JSON.parse(itemRaw) : itemRaw;
            if (itemParsed && itemParsed.tipo === 'multi') {
                input.focus();
            }
        }
    }
}
//=== FUNÇÃO DE APOIO: CARGA DE TOMBAMENTOS (Nome limpo) ===//
async function carregarTombamentosSobDemanda(uidItem, unidadeId) {
    try {
        // ✅ PADRÃO V3: Busca na subcoleção de tombamentos dentro do item no inventário único
        const snapTombs = await db.collection('inventario').doc(uidItem)
            .collection('tombamentos')
            .where('unidade_id', '==', unidadeId) // 🚨 CORREÇÃO: Usamos unidade_id para alinhar com o Aporte V3
            .where('situacao_atual', '==', 'DISPONÍVEL')
            .get();

        const tombamentos = snapTombs.docs.map(t => {
            const data = t.data();
            return {
                ...data,
                id_documento: t.id // Importante para manipulações futuras (set/update)
            };
        });

        // ✅ SINCRONISMO LOCAL: Atualiza a variável de cache da interface
        const idx = estoqueGestorLocal.findIndex(i => i.uid_global === uidItem);
        if (idx !== -1) {
            estoqueGestorLocal[idx].tombamentos = tombamentos;
        }

        return tombamentos;
    } catch (e) {
        console.error("Erro Sigma V3 ao buscar detalhes do rastreio:", e);
        return [];
    }
}

//=== 11. INTERCEPTA O ITEM SELECIONADO (VERSÃO UNIFICADA) ===//
function selecionarItemParaAdicionar(item) {
    if (!item) return;

    // 1. Clonagem e Normalização do Objeto
    itemSelecionadoTemp = { 
        ...item,
        disponivel: item.disponivelReal ?? 0
    };

    // 🔍 DEFINIÇÃO DINÂMICA DO ÍCONE (Para uso no Draft Card)
    let iconeDefinido = 'fa-boxes'; // Default Consumo
    let corDefinida = '#64748b';

    if (item.is_anfitriao || item.is_anfitriao === "true") {
        iconeDefinido = 'fa-box-open';
        corDefinida = '#f59e0b';
    } else if (item.tipo === 'multi' || item.tombamentoExibicao) {
        iconeDefinido = 'fa-tag';
        corDefinida = '#2c7399';
    }
    
    // Guardamos o ícone no objeto temporário
    itemSelecionadoTemp.iconeVisual = iconeDefinido;
    itemSelecionadoTemp.corVisual = corDefinida;

    // 2. Fluxo para Kits (Anfitrião)
    if (item.is_anfitriao) {
        const boxSugestoes = document.getElementById('sugestoes-estoque-editor');
        if (boxSugestoes) boxSugestoes.style.display = 'none';
        return abrirModalAcoplamentoAnfitriao(item.uid_global, item, item.tombamentoExibicao);
    }

    const popover = document.getElementById('popover-qtd-editor');
    const inputBusca = document.getElementById('input-busca-estoque');
    const selectSetor = document.getElementById('select-setor-destino');

    // 3. Lógica para Consumo
    if (item.tipo === 'single' || item.tipo === 'consumo') {
        const saldoFinal = itemSelecionadoTemp.disponivel;
        if (popover) {
            popover.style.position = 'absolute';
            popover.style.top = (inputBusca.offsetTop + inputBusca.offsetHeight + 5) + 'px';
            popover.style.left = inputBusca.offsetLeft + 'px';
            popover.style.display = 'block';
            
            const inputQtd = document.getElementById('input-qtd-popover');
            if (inputQtd) {
                inputQtd.max = saldoFinal;
                inputQtd.value = 1;
                setTimeout(() => { inputQtd.focus(); inputQtd.select(); }, 50);
            }
            document.getElementById('info-max-popover').textContent = `Saldo livre: ${saldoFinal} un.`;
        }
    } else {
        // 4. Lógica para Patrimônio
        if (popover) popover.style.display = 'none';
        
        // Chamada da função de rascunho (corrigida abaixo)
        exibirDraftCard(`${item.nome} (PAT: ${item.tombamentoExibicao || '---'})`);
        
        if (selectSetor) {
            selectSetor.focus();
            selectSetor.style.border = `2px solid ${corDefinida}`;
        }
    }
}

//=== DEMAIS FUNÇÕES DE APOIO (MANTIDAS) ===//
function exibirDraftCard(texto) {
    const card = document.getElementById('rascunho-item-novo');
    const label = document.getElementById('texto-item-rascunho');
    const iconPlus = document.getElementById('icon-plus-busca');
    
    if (card && label) {
        // 1. Identificação de Tipo e Classes (Sincronizado com V3)
        let iconClass = 'fa-boxes-stacked'; 
        let avatarClass = 'avatar-consumo';
        let corBorda = '#64748b';

        if (itemSelecionadoTemp) {
            const ehAnfitriao = itemSelecionadoTemp.is_anfitriao === true || itemSelecionadoTemp.is_anfitriao === "true" || (itemSelecionadoTemp.componentes_regra && itemSelecionadoTemp.componentes_regra.length > 0);
            const ehMulti = itemSelecionadoTemp.tipo === 'multi';
            
            if (ehAnfitriao) {
                iconClass = 'fa-box-open';
                avatarClass = 'avatar-kit';
                corBorda = '#f59e0b';
            } else if (ehMulti) {
                iconClass = 'fa-tag';
                avatarClass = 'avatar-patrimonio';
                corBorda = '#2c7399';
            }
        }

        // 2. Renderização usando a nova arquitetura de Avatares
        label.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                <div class="sigma-icon-avatar ${avatarClass}" style="width: 28px; height: 28px; min-width: 28px; border-radius: 8px;">
                    <i class="fa-solid ${iconClass}" style="font-size: 12px !important;"></i>
                </div>
                
                <span style="font-weight: 800; color: #1e293b; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${texto}
                </span>
            </div>`;
            
        // 3. UI Update do Card Flutuante
        card.style.display = 'flex';
        card.style.alignItems = 'center';
        card.style.border = `1px solid ${corBorda}40`; // Borda suave em toda a volta
        card.style.borderLeft = `5px solid ${corBorda}`; // Borda forte na esquerda (DNA V3)
        card.style.backgroundColor = `#fff`; // Fundo branco sólido para contraste sobre a busca
        card.style.boxShadow = `0 4px 12px ${corBorda}20`;
        
        if (iconPlus) iconPlus.style.visibility = 'hidden';
    }
}

function confirmarQtdPopover() {
    const input = document.getElementById('input-qtd-popover');
    const qtd = parseInt(input.value);
    
    // ✅ AJUSTE V3: Usamos a variável unificada que definimos na função anterior
    // Isso garante que o saldo limite já considera (Estoque Banco - O que já está na tela)
    const saldoLimite = Number(itemSelecionadoTemp.disponivel) || 0;

    if (isNaN(qtd) || qtd <= 0) {
        Swal.fire({ icon: 'warning', title: 'Quantidade inválida', text: 'Informe um valor maior que zero.' });
        return;
    }

    if (qtd > saldoLimite) {
        Swal.fire({
            icon: 'error',
            title: 'Saldo Insuficiente',
            text: `Você só possui ${saldoLimite} unidades disponíveis para alocação no momento.`,
            confirmButtonColor: '#2c7399'
        });
        input.value = saldoLimite;
        return;
    }

    // ✅ Sincronismo de Propriedade: 
    // Usamos 'quantidadeChosen' para carregar o valor temporário até a inserção no setor
    itemSelecionadoTemp.quantidadeChosen = qtd; 

    // UI Cleanup
    const popover = document.getElementById('popover-qtd-editor');
    if (popover) popover.style.display = 'none';

    // Feedback visual do rascunho
    exibirDraftCard(`${qtd}un. x ${itemSelecionadoTemp.nome}`);
    
    // Direciona o foco para o próximo passo lógico: escolher o setor
    const selectSetor = document.getElementById('select-setor-destino');
    if (selectSetor) {
        selectSetor.focus();
        // Pequeno brilho visual para indicar que este é o próximo campo
        selectSetor.style.boxShadow = "0 0 0 3px rgba(44, 115, 153, 0.2)";
    }
}

function adicionarItemRapido() {
    const selectSetor = document.getElementById('select-setor-destino');
    const setorIdx = selectSetor.value;
    
    // 1. Verificação de segurança (Impede disparo sem item ou sem setor)
    if (!itemSelecionadoTemp) {
        return Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Selecione um material primeiro.' });
    }

    if (setorIdx === "") {
        selectSetor.style.borderColor = "#ef4444"; // Alerta visual no campo vazio
        return;
    }

    // 2. Fluxo Especial para Kits (Anfitrião)
    // Se for um Kit e ainda não passou pelo modal de acoplamento de componentes
    if (itemSelecionadoTemp.is_anfitriao && !itemSelecionadoTemp.acessorios_ja_montados) {
        // Esconde o rascunho temporário para não confundir durante o modal
        const cardRascunho = document.getElementById('rascunho-item-novo');
        if (cardRascunho) cardRascunho.style.display = 'none';

        return abrirModalAcoplamentoAnfitriao(
            itemSelecionadoTemp.uid_global, 
            itemSelecionadoTemp, 
            itemSelecionadoTemp.tombamentoExibicao, 
            setorIdx
        );
    }
    
    // 3. Execução da inserção definitiva na arquitetura local
    executarInsercaoNoSetor(setorIdx);

    // 4. Reset e Cleanup Sigma V3
    selectSetor.value = ""; 
    selectSetor.style.borderColor = "#cbd5e1"; // Restaura cor original
    
    // Devolve o foco para o campo de busca principal para permitir bipagem contínua
    const inputBusca = document.getElementById('input-busca-estoque');
    if (inputBusca) {
        inputBusca.focus();
    }
}

function processarMesclagemAutomatica(setorIndex) {
    const itens = arquiteturaAtiva[setorIndex].itens;
    if (!itens || itens.length === 0) return;

    const mapa = new Map();
    const novosItens = [];

    itens.forEach(item => {
        let chave;
        
        // 1. GERAÇÃO DE CHAVE ÚNICA (Diferencia Kit de Item Comum)
        if (item.is_anfitriao) {
            // Assinatura: UID do Pai + IDs/Qtds dos Filhos (Ordenados)
            const assinaturaAcessorios = (item.acessorios_vinculados || [])
                .map(ac => `${ac.uid_global || ac.id}_${ac.quantidade}`)
                .sort()
                .join('|');
            chave = `KIT_${item.uid_global}_${assinaturaAcessorios}`;
        } else {
            // Itens comuns mesclam apenas pelo UID global
            chave = item.uid_global;
        }

        if (mapa.has(chave)) {
            const existente = mapa.get(chave);
            
            // 2. CONSOLIDAÇÃO DE QUANTIDADES (Garante tratamento Numérico)
            const qtdTotalAnterior = Number(existente.quantidadeEsperada) || 0;
            const qtdTotalAdicional = Number(item.quantidadeEsperada) || 0;
            
            const qtdRascunhoAnterior = Number(existente.quantidadeNoRascunho) || 0;
            const qtdRascunhoAdicional = Number(item.quantidadeNoRascunho) || 0;

            if (item.tipo === 'single' || item.tipo === 'consumo') {
                // Soma as quantidades para itens de consumo
                existente.quantidadeEsperada = qtdTotalAnterior + qtdTotalAdicional;
                existente.quantidadeNoRascunho = qtdRascunhoAnterior + qtdRascunhoAdicional;

                // ✅ PADRÃO V3: Se qualquer parte da soma veio de um rascunho, o item todo vira rascunho
                if (existente.quantidadeNoRascunho > 0) {
                    existente.isNovoRascunho = true;
                }
            } else {
                // 3. CONSOLIDAÇÃO DE PATRIMÔNIOS (Itens Multi)
                const tombamentosExistentes = existente.tombamentos || [];
                const novosTombamentos = item.tombamentos || [];

                novosTombamentos.forEach(novoT => {
                    // Evita duplicar o mesmo patrimônio na mesma linha
                    if (!tombamentosExistentes.some(t => t.tomb === novoT.tomb)) {
                        tombamentosExistentes.push(novoT);
                    }
                });
                
                existente.tombamentos = tombamentosExistentes;
                // A quantidade esperada de um Multi é sempre o total de exemplares físicos
                existente.quantidadeEsperada = existente.tombamentos.length;
                
                // Se algum dos tombamentos inseridos for novo, marca como rascunho
                if (item.isNovoRascunho) existente.isNovoRascunho = true;
            }
        } else {
            // Se o item for inédito no mapa do setor, adiciona normalmente
            mapa.set(chave, item);
            novosItens.push(item);
        }
    });

    // Atualiza a arquitetura ativa com a lista limpa e mesclada
    arquiteturaAtiva[setorIndex].itens = novosItens;
}

function cancelarRascunho() {
    // 1. Limpeza do estado lógico
    itemSelecionadoTemp = null;

    // 2. Referências de Elementos
    const card = document.getElementById('rascunho-item-novo');
    const iconPlus = document.getElementById('icon-plus-busca');
    const inputBusca = document.getElementById('input-busca-estoque');
    const selectSetor = document.getElementById('select-setor-destino');
    const boxSugestoes = document.getElementById('sugestoes-estoque-editor'); // Adicionado

    // 3. UI Cleanup - Visual do Card e Ícones
    if (card) card.style.display = 'none';
    if (iconPlus) iconPlus.style.visibility = 'visible';
    
    // 4. Reset do Campo de Busca
    if (inputBusca) {
        inputBusca.value = '';
        inputBusca.style.backgroundColor = "#fff"; 
        // Devolve o foco para o input para permitir nova busca imediata
        inputBusca.focus(); 
    }

    // 5. Reset do Seletor de Setor
    if (selectSetor) {
        selectSetor.value = ""; 
        selectSetor.style.border = "1px solid #cbd5e1"; 
    }

    // 6. Fechamento da Lista de Sugestões (Evita que o menu flutuante fique órfão)
    if (boxSugestoes) {
        boxSugestoes.style.display = 'none';
        boxSugestoes.innerHTML = ''; // Limpa o HTML para não pesar o DOM
    }
}

//==============================================================//
//--- BLOCO 4: Gestão de Setores e Estornos (Caixa de Saída) ---//
//==============================================================//

//=== 4.1. CRIA UM NOVO SETOR NA LISTA (EX: CABINE, MOTOR) COM SUGESTÕES INTELIGENTES ===//
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

//=== 16.1. PREENCHE O NOME DO SETOR VIA CLIQUE NAS TAGS DE SUGESTÃO ===//
function selecionarTagSetor(nome) {
    document.getElementById('input-nome-setor-modal').value = nome;
    confirmarNovoSetor(); // Já confirma para agilizar
}

//=== 16.2. VALIDA DUPLICIDADE E INSERE O NOVO SETOR NA ARQUITETURA ===//
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

//=== 16.3. FECHA O MODAL DE NOVO SETOR ===//
function fecharModalNovoSetor() {
    document.getElementById('modal-novo-setor-arquitetura').style.display = 'none';
}

//=== 18. ATUALIZA O SELECT DE DESTINO COM OS SETORES ATIVOS ===//
function atualizarSelectSetores() {
    const select = document.getElementById('select-setor-destino');
    select.innerHTML = '<option value="">Selecione o Setor...</option>' +
        arquiteturaAtiva.map((s, idx) => `<option value="${idx}">${s.nome}</option>`).join('');
}

//=== 4.2. REMOVE UM SETOR E ENVIA TODOS OS SEUS ITENS PARA A CAIXA DE ESTORNO ===//
async function removerSetorArquitetura(idx) {
    const setor = arquiteturaAtiva[idx];
    if (!setor) return;

    const result = await Swal.fire({
        title: `Remover setor "${setor.nome}"?`,
        text: `O setor e seus itens serão movidos para a Caixa de Saída.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sim, remover',
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    // --- NOVO: Salvamos os dados de estrutura do setor (DNA) ---
    const dadosSetor = { ...setor };
    delete dadosSetor.itens; // Limpamos os itens para evitar referência circular ou peso desnecessário

    if (setor.itens && setor.itens.length > 0) {
        setor.itens.forEach(item => {
            itensParaEstorno.push({
                ...item,
                setorOrigem: setor.nome, // <--- O "Vigilante" do HTML usa essa chave
                setorDna: { ...setor, itens: [] }, // Para a ressurreição do setor
                idExclusaoBloco: idx 
            });
        });
    }

    // Remoção física
    arquiteturaAtiva.splice(idx, 1);

    // Sincronização UI
    renderizarArquiteturaEditor();
    if (typeof atualizarSelectSetores === 'function') atualizarSelectSetores();
    if (typeof atualizarInterfaceEstorno === 'function') {
        atualizarInterfaceEstorno();
        const dock = document.getElementById('caixa-estorno-dock');
        if (dock?.classList.contains('estorno-dock-minimized')) toggleEstornoDock();
    }

    marcarAlteracao();
}

//=== 4.3. REMOVE UM ITEM ESPECÍFICO DO SETOR E O ENVIA PARA A CAIXA DE ESTORNO ===//
async function marcarParaEstorno(setorIdx, itemIdx) {
    const setor = arquiteturaAtiva[setorIdx];
    const itemAlvo = setor.itens[itemIdx];

    // 1. MODO VISTORIA (CHECKLIST): Remoção direta
    if (window.isModoVistoria) {
        const result = await Swal.fire({
            title: 'Remover Item?',
            text: `Deseja remover "${itemAlvo.nome}" da vistoria?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#2c3e50',
            confirmButtonText: 'Sim, remover',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            setor.itens.splice(itemIdx, 1);
            renderizarArquiteturaEditor();
            marcarAlteracao();
        }
        return;
    }

    // 2. LÓGICA DE QUANTIDADE (Apenas para itens Single ou Kits com quantidade > 1)
    // Se for Multi (Patrimoniado), a remoção é unitária pelo tombamento, então não entra aqui.
    let quantidadeParaRemover = Number(itemAlvo.quantidadeEsperada) || 1;

    if (itemAlvo.tipo !== 'multi' && quantidadeParaRemover > 1) {
        const { value: qtd } = await Swal.fire({
            title: 'Quantos deseja remover?',
            text: `Existem ${quantidadeParaRemover} unidades de "${itemAlvo.nome}".`,
            input: 'number',
            inputAttributes: { min: 1, max: quantidadeParaRemover, step: 1 },
            inputValue: quantidadeParaRemover,
            showCancelButton: true,
            confirmButtonText: 'Remover',
            cancelButtonText: 'Cancelar'
        });

        if (!qtd) return; // Cancelou
        quantidadeParaRemover = parseInt(qtd);
    }

    // 3. SEPARAÇÃO DO ITEM (OU PARTE DELE)
    let itemParaSaida;

    if (quantidadeParaRemover < (Number(itemAlvo.quantidadeEsperada) || 1)) {
        // Remove apenas uma parte (Reduz o card na tela e cria um novo para a caixa de saída)
        itemAlvo.quantidadeEsperada -= quantidadeParaRemover;
        itemAlvo.quantidadeNoRascunho -= quantidadeParaRemover;
        
        itemParaSaida = { 
            ...itemAlvo, 
            quantidadeEsperada: quantidadeParaRemover,
            quantidadeNoRascunho: quantidadeParaRemover 
        };
    } else {
        // Remove o card inteiro
        itemParaSaida = setor.itens.splice(itemIdx, 1)[0];
    }

    // 4. PREPARAÇÃO PARA CAIXA DE SAÍDA (Com DNA para Ressurreição)
    const dadosSetorDna = { ...setor };
    delete dadosSetorDna.itens; // Limpa para não pesar

    itensParaEstorno.push({
        ...itemParaSaida,
        setorOrigem: setor.nome, // Padronizado para o Dock exibir o nome
        setorDna: dadosSetorDna  // DNA para o caso de "Desfazer"
    });

    // 5. FEEDBACK E ATUALIZAÇÃO
    const badge = document.getElementById('badge-estorno-count');
    if (badge) {
        badge.classList.add('badge-pulse');
        setTimeout(() => badge.classList.remove('badge-pulse'), 300);
    }

    atualizarInterfaceEstorno();
    renderizarArquiteturaEditor();
    marcarAlteracao();
    
    console.log(`✅ ${quantidadeParaRemover} un. de "${itemParaSaida.nome}" movido para caixa de saída.`);
}

//=== 4.4. DESVINCULA UM ACESSÓRIO DE UM KIT (O SALDO VOLTA AO ESTOQUE NA PUBLICAÇÃO) ===//
async function removerAcessorioDeKit(setorIdx, itemPaiIdx, acessorioIdx) {
    const setor = arquiteturaAtiva[setorIdx];
    const itemPai = setor.itens[itemPaiIdx];
    
    // 1. Identifica qual array de acessórios este item usa
    // Tenta encontrar onde os acessórios estão escondidos
    const arrayAcessorios = itemPai.acessorios_acoplados || 
                             itemPai.acessorios_vinculados || 
                             itemPai.componentes_regra;

    if (!arrayAcessorios || !arrayAcessorios[acessorioIdx]) {
        console.error("Erro: Array de acessórios não encontrado ou índice inválido.");
        return;
    }

    const acessorioAlvo = arrayAcessorios[acessorioIdx];

    // 2. Lógica de Quantidade (Multiplicador do Kit)
    const qtdPai = Number(itemPai.quantidadeEsperada) || 1;
    const qtdFilhoUnitario = Number(acessorioAlvo.quantidade || acessorioAlvo.qtd_sugerida || 1);
    const totalRemovido = qtdPai * qtdFilhoUnitario;

    const result = await Swal.fire({
        title: 'Desvincular Componente?',
        text: `Deseja remover "${acessorioAlvo.nome}" deste Kit? Ele será movido para a caixa de saída.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#0369a1',
        confirmButtonText: 'Sim, desvincular',
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    // 3. REMOÇÃO SEGURA: Agora usamos a referência que encontramos no passo 1
    const acessorioRemovido = arrayAcessorios.splice(acessorioIdx, 1)[0];

    // 4. DNA para a Caixa de Saída
    const dadosSetorDna = { ...setor };
    delete dadosSetorDna.itens;

    itensParaEstorno.push({
        ...acessorioRemovido,
        uid_global: acessorioRemovido.uid_global || acessorioRemovido.id || acessorioRemovido.familia_uid,
        quantidadeEsperada: totalRemovido,
        quantidadeNoRascunho: totalRemovido,
        setorOrigem: setor.nome,
        setorDna: dadosSetorDna,
        isComponenteKit: true,
        paiOrigem: itemPai.nome
    });

    // 5. Sincronização e Feedback
    const badge = document.getElementById('badge-estorno-count');
    if (badge) {
        badge.classList.add('badge-pulse');
        setTimeout(() => badge.classList.remove('badge-pulse'), 300);
    }

    atualizarInterfaceEstorno();
    renderizarArquiteturaEditor();
    marcarAlteracao();
}

//=== 4.5. REMOVE UM PATRIMÔNIO (TOMBAMENTO) ESPECÍFICO DE UM ITEM MULTI ===//
function removerTombamentoIndividual(indexSetor, indexItem, tIndex) {
    const setorOrigem = arquiteturaAtiva[indexSetor];
    const itemOrigem = setorOrigem.itens[indexItem];

    if (!itemOrigem || !itemOrigem.tombamentos) return;

    // 1. Remove o tombamento do array original (Arquitetura)
    const tombRemovido = itemOrigem.tombamentos.splice(tIndex, 1)[0];

    // 2. DNA do Setor para Ressurreição
    const dadosSetorDna = { ...setorOrigem };
    delete dadosSetorDna.itens;

    // 3. Envia para a Caixa de Saída
    // Note que tratamos como um item 'multi' com apenas 1 tombamento na lista
    itensParaEstorno.push({
        ...itemOrigem, // Herda nome, ícone, uid_global
        quantidadeEsperada: 1,
        quantidadeNoRascunho: 1,
        tombamentos: [tombRemovido],
        setorOrigem: setorOrigem.nome, // Padronizado para o Dock
        setorDna: dadosSetorDna        // DNA para o Cancelar Estorno
    });

    // 4. Limpeza de rastro: Se o card ficou vazio, remove o "container" do item no setor
    if (itemOrigem.tombamentos.length === 0) {
        setorOrigem.itens.splice(indexItem, 1);
    } else {
        // Se ainda restam itens, atualizamos a contagem do rascunho no card que ficou
        itemOrigem.quantidadeEsperada = itemOrigem.tombamentos.length;
        itemOrigem.quantidadeNoRascunho = itemOrigem.tombamentos.length;
    }

    // 5. Atualização da UI
    const badge = document.getElementById('badge-estorno-count');
    if (badge) {
        badge.classList.add('badge-pulse');
        setTimeout(() => badge.classList.remove('badge-pulse'), 300);
    }

    marcarAlteracao();
    renderizarArquiteturaEditor();
    atualizarInterfaceEstorno();
    
    console.log(`🏷️ Tombamento ${tombRemovido.tomb} movido para caixa de saída.`);
}

//=== 4.6. GESTÃO VISUAL DA CAIXA DE SAÍDA E CONTROLE DE VISIBILIDADE (MODO VISTORIA) ===//
function atualizarInterfaceEstorno() {
    const dock = document.getElementById('caixa-estorno-dock');
    if (!dock) return;

    // 1. O VIGILANTE (Manter invisível se for checklist/vistoria)
    if (window.isModoVistoria === true) {
        dock.style.setProperty('display', 'none', 'important');
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

    // 2. CONTROLE DE EXIBIÇÃO: Só mostra o dock se houver itens
    if (itensParaEstorno.length === 0) {
        dock.style.display = 'none';
        badge.textContent = "0";
        return;
    } else {
        dock.style.display = 'block';
    }

    // 3. ATUALIZAÇÃO DO BADGE
    badge.textContent = itensParaEstorno.length;

    // 4. RENDERIZAÇÃO DA LISTA (Do mais recente para o mais antigo)
    container.innerHTML = itensParaEstorno.map((item, idx) => {
        const ehMulti = item.tipo === 'multi';
        const ehComponente = item.isComponenteKit === true;
        
        // Formata o detalhe: Se for patrimoniado, mostra os tombamentos. Se for single, a quantidade.
        let detalhe = ehMulti && item.tombamentos 
            ? item.tombamentos.map(t => t.tomb).join(', ') 
            : (item.quantidadeNoRascunho || item.quantidadeEsperada || 0) + ' un.';

        // Estilização dinâmica
        const bgColor = ehComponente ? '#f0f9ff' : '#fffaf0'; 
        const borderColor = ehComponente ? '#bae6fd' : '#fee2e2'; // Vermelho muito claro para itens removidos
        const badgeColor = ehComponente ? '#0369a1' : '#e65100';

        return `
            <div class="item-estorno-linha" 
                 style="display: flex; align-items: center; justify-content: space-between; padding: 10px; border-bottom: 1px solid ${borderColor}; background: ${bgColor}; margin-bottom: 5px; border-radius: 6px; border-left: 4px solid ${badgeColor};">
                
                <div style="flex:1; padding-right: 10px;">
                    <b style="font-size:0.85em; display:block; color:#334155; text-transform: uppercase;">
                        ${item.nome || 'Material'}
                    </b>
                    
                    ${ehComponente ? `
                        <small style="display:inline-block; background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-size:0.65em; font-weight:800; margin-bottom:4px; text-transform:uppercase;">
                            <i class="fas fa-puzzle-piece"></i> Componente de: ${item.paiOrigem || 'Kit'}
                        </small>
                    ` : ''}

                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <small style="color:${badgeColor}; font-weight:700; font-size: 0.75em; display: flex; align-items: center; gap: 4px;">
                            ${ehMulti ? '<i class="fas fa-tag"></i>' : '<i class="fas fa-boxes"></i>'} 
                            ${ehMulti ? 'TOMB: ' + detalhe : 'QTD: ' + detalhe}
                        </small>
                        
                        <small style="color:#64748b; font-size: 0.7em; display: flex; align-items: center; gap: 4px;">
                            <i class="fas fa-map-marker-alt" style="font-size: 0.9em;"></i> 
                            Setor: <span style="font-weight: 600;">${item.setorOrigem || 'Não identificado'}</span>
                        </small>
                    </div>
                </div>

                <button onclick="cancelarEstorno(${idx})" 
                        title="Desfazer e retornar para o setor original"
                        class="btn-undo-estorno" 
                        style="background: #ffffff!important; color: #475569!important; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid #cbd5e1; transition: 0.2s; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                    <i class="fas fa-undo-alt" style="font-size:0.9em;"></i>
                </button>
            </div>`;
    }).reverse().join('');
}

//=== 21.1. EXPANDE OU RECOLHE A GAVETA DE ESTORNOS (DOCK) ===//
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

//=== 4.7. TIRA O ITEM DA CAIXA DE ESTORNO E O DEVOLVE PARA O SETOR DE ORIGEM ===//
function cancelarEstorno(idx) {
    // 1. Remove da lista de estorno (Caixa de Saída)
    const item = itensParaEstorno.splice(idx, 1)[0];
    if (!item) return;

    // 2. Padronização da busca: Usamos 'setorOrigem' que é o que salvamos na remoção
    const nomeBusca = item.setorOrigem; 
    let setorDestino = arquiteturaAtiva.find(s => s.nome === nomeBusca);

    // --- Lógica de Ressurreição do Setor ---
    if (!setorDestino && item.setorDna) {
        console.log(`Ressuscitando setor via DNA: ${nomeBusca}`);
        
        // Criamos o setor novo com base no DNA (cor, ícone, etc)
        setorDestino = { 
            ...item.setorDna, 
            itens: [] 
        };
        
        // Devolvemos o setor para a arquitetura
        arquiteturaAtiva.push(setorDestino);
        
        if (typeof atualizarSelectSetores === 'function') atualizarSelectSetores();
    } 
    // Fallback se não tiver DNA: tenta o primeiro da lista
    else if (!setorDestino && arquiteturaAtiva.length > 0) {
        setorDestino = arquiteturaAtiva[0];
    }

    if (setorDestino) {
        // 3. Preparação do Item para voltar à tela
        const itemParaRestaurar = {
            ...item,
            isNovoRascunho: item.isNovoRascunho ?? true,
            quantidadeNoRascunho: item.quantidadeNoRascunho || item.quantidadeEsperada || 0
        };

        // Limpamos os metadados de transporte para não poluir o objeto final
        delete itemParaRestaurar.setorOrigem;
        delete itemParaRestaurar.setorDna;
        delete itemParaRestaurar.idExclusaoSetor;
        delete itemParaRestaurar.idExclusaoBloco;

        if (!setorDestino.itens) setorDestino.itens = [];
        setorDestino.itens.push(itemParaRestaurar);

        // 4. Mesclagem (Soma quantidades se o item já existir no setor)
        const sIdx = arquiteturaAtiva.indexOf(setorDestino);
        processarMesclagemAutomatica(sIdx);

        // 5. Feedback visual
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true
        });

        Toast.fire({
            icon: 'success',
            title: `Item restaurado em "${setorDestino.nome}"`
        });

    } else {
        // Se a viatura estiver vazia e o item não tiver DNA (caso raro)
        Swal.fire({
            icon: 'error',
            title: 'Impossível restaurar',
            text: 'Crie um setor antes de retornar itens da caixa de saída.',
            confirmButtonColor: '#2c7399'
        });
        
        itensParaEstorno.splice(idx, 0, item); // Devolve para a caixa de saída
        return;
    }

    // 6. Sincronização Geral
    atualizarInterfaceEstorno();
    renderizarArquiteturaEditor();
    marcarAlteracao();
}

//===========================================//
//--- BLOCO 5: Finalização e Persistência ---//
//===========================================//

//=== 5.1. ALTERA O ESTILO DO BOTÃO DE PUBLICAR PARA INDICAR ALTERAÇÕES PENDENTES ===//
function marcarAlteracao() {
    const btn = document.querySelector('.btn-publish');
    if (!btn) return;

    // 1. Evita habilitar se o botão estiver no estado de "Publicando" (spinner ativo)
    if (btn.innerHTML.includes('fa-sync')) return;

    // 2. Estado Ativo
    btn.disabled = false;
    btn.classList.add('modified');

    // 3. Estilização Direta (Garante o visual independente de classes CSS externas)
    btn.style.backgroundColor = '#d97706';
    btn.style.borderColor = '#b45309';
    btn.style.color = 'white';
    btn.style.fontWeight = 'bold';
    btn.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';

    // 4. Conteúdo Dinâmico
    btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Publicar Alterações *';

    // 5. Aplicação da Animação com Fallback
    // Se não houver animação definida, o estilo apenas mudará.
    btn.style.animation = 'pulse-orange 2s infinite';

    // Injeta o Keyframe se ele não existir (Garante que a animação funcione)
    if (!document.getElementById('style-pulse-orange')) {
        const style = document.createElement('style');
        style.id = 'style-pulse-orange';
        style.innerHTML = `
            @keyframes pulse-orange {
                0% { box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.7); }
                70% { box-shadow: 0 0 0 10px rgba(217, 119, 6, 0); }
                100% { box-shadow: 0 0 0 0 rgba(217, 119, 6, 0); }
            }
        `;
        document.head.appendChild(style);
    }
}

//=== 5.2. FUNÇÃO MESTRA: SINCRONIZA TUDO NO FIREBASE (ESTRUTURA, SALDOS E PATRIMÔNIOS) ===//
async function confirmarPublicacaoLista(justificativaExterna = null) {
    // 1. CONFIRMAÇÃO INICIAL
    const resultConfirm = await Swal.fire({
        title: 'Publicar Alterações?',
        text: "O inventário será atualizado e os itens removidos retornarão ao estoque da unidade.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#1b8a3e',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sim, Publicar!'
    });

    if (!resultConfirm.isConfirmed) return;

    // 2. SANITIZAÇÃO DA ARQUITETURA
    const arquiteturaParaSalvar = JSON.parse(JSON.stringify(arquiteturaAtiva));
    arquiteturaParaSalvar.forEach(setor => {
        (setor.itens || []).forEach(it => {
            if (it.tipo === 'single' || it.tipo === 'consumo') {
                it.uid_instancia = `${it.uid_global}_${setor.id}`;
            } else {
                if (it.uid_instancia && (it.uid_instancia.startsWith('TEMP_') || it.uid_instancia.startsWith('KIT_'))) {
                    it.uid_instancia = it.uid_global; 
                }
            }
            delete it.isNovoRascunho;
            delete it.quantidadeNoRascunho;
            delete it.iconeVisual;
            delete it.corVisual;
        });
    });

    const firestore = firebase.firestore();
    const elNome = document.getElementById('edit-vtr-nome');
    const nomeAmigavelVtr = elNome ? (elNome.innerText || elNome.textContent).replace(/EDITOR DE LISTA|EDITOR DE CHECKLIST/gi, "").trim() : "Viatura";
    
    const inputJust = document.getElementById('justificativa-estorno-global');
    const justificativa = justificativaExterna || (inputJust ? inputJust.value.trim() : "");
    const unidadeGestoraId = currentUserData.unidade_id;
    const unidadeSigla = currentUserData.unidade_sigla || "N/D";
    const dataReg = new Date().toLocaleString('pt-BR');

    const estornosReais = itensParaEstorno.filter(i => i.uid_global !== "ITEM_VISTORIA_LIVRE");
    if (estornosReais.length > 0 && !justificativa) {
        Swal.fire('Justificativa Requerida', 'Preencha o motivo do estorno na Caixa de Saída.', 'warning');
        return;
    }

    const btn = document.querySelector('.btn-publish');
    if(btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-sync fa-spin"></i> Publicando...'; }

    Swal.fire({ title: 'Publicando Lista...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
        const batch = firestore.batch();
        const listaRef = firestore.collection(window.colecaoAtivaNoEditor).doc(idListaSendoEditada);
        const snapLista = await listaRef.get();
        const listaAnterior = snapLista.exists ? (snapLista.data().list || []) : [];

        const mapearSaldosComSetor = (arquitetura) => {
            const mapa = {};
            arquitetura.forEach(setor => {
                (setor.itens || []).forEach(it => {
                    if (it.uid_global === "ITEM_VISTORIA_LIVRE") return;
                    const uid = it.uid_global;
                    const qtdPai = Number(it.quantidadeEsperada) || 0;
                    if (uid) {
                        if (!mapa[uid]) mapa[uid] = { total: 0, distribuicao: [] };
                        mapa[uid].total += qtdPai;
                        // ✅ Nova lógica: Array de objetos para evitar colisões em loops
                        mapa[uid].distribuicao.push({ setor: setor.nome, qtd: qtdPai });
                    }
                    const acessorios = it.acessorios_vinculados || it.acessorios_acoplados || it.componentes_regra || [];
                    acessorios.forEach(ac => {
                        const uidAc = ac.uid_global || ac.id || ac.familia_uid;
                        const qtdTotalAc = Number(ac.quantidade || ac.qtd_sugerida || 1) * qtdPai;
                        if (uidAc) {
                            if (!mapa[uidAc]) mapa[uidAc] = { total: 0, distribuicao: [] };
                            mapa[uidAc].total += qtdTotalAc;
                            mapa[uidAc].distribuicao.push({ setor: setor.nome, qtd: qtdTotalAc });
                        }
                    });
                });
            });
            return mapa;
        };

        const mapaAnterior = mapearSaldosComSetor(listaAnterior);
        const mapaAtual = mapearSaldosComSetor(arquiteturaAtiva);

        batch.update(listaRef, {
            list: arquiteturaParaSalvar,
            ultima_edicao_arquitetura: firebase.firestore.FieldValue.serverTimestamp(),
            editado_por: currentUserData.nome_militar_completo
        });

        const todosUids = new Set([...Object.keys(mapaAnterior), ...Object.keys(mapaAtual)]);

        for (const uid of todosUids) {
            const dadosAntigos = mapaAnterior[uid] || { total: 0, distribuicao: [] };
            const dadosAtuais = mapaAtual[uid] || { total: 0, distribuicao: [] };
            const diferencaTotal = dadosAtuais.total - dadosAntigos.total;

            if (diferencaTotal !== 0) {
                const itemRef = firestore.collection('inventario').doc(uid);
                const saldoRef = itemRef.collection('saldos_unidades').doc(unidadeGestoraId);
                const itemSnap = await itemRef.get();
                const itemData = itemSnap.data();

                if (itemData && itemData.tipo === 'single') {
                    // ✅ LÓGICA DE ALOCAÇÃO SEQUENCIAL (ANTI-BUG)
                    if (diferencaTotal > 0) {
                        const snapV_UIDs = await itemRef.collection('tombamentos')
                            .where('unidade_id', '==', unidadeGestoraId)
                            .where('situacao_atual', '==', 'DISPONÍVEL')
                            .limit(diferencaTotal).get();
                        
                        let uidsDisponiveis = snapV_UIDs.docs;
                        
                        // Distribuímos os UIDs pegos entre os setores necessários
                        dadosAtuais.distribuicao.forEach(dist => {
                            const antigaNoSetor = dadosAntigos.distribuicao.find(d => d.setor === dist.setor)?.qtd || 0;
                            const diffSetor = dist.qtd - antigaNoSetor;

                            if (diffSetor > 0) {
                                for (let i = 0; i < diffSetor; i++) {
                                    const docV = uidsDisponiveis.shift(); // Pega o primeiro da fila
                                    if (docV) {
                                        batch.update(docV.ref, {
                                            situacao_atual: "EM CARGA",
                                            local_id: "VIATURA",
                                            viatura_id: idListaSendoEditada,
                                            sub_local: dist.setor,
                                            data_movimentacao: dataReg
                                        });
                                    }
                                }
                            }
                        });
                    } else {
                        // ESTORNO SINGLE
                        const snapV_UIDs = await itemRef.collection('tombamentos')
                            .where('viatura_id', '==', idListaSendoEditada)
                            .limit(Math.abs(diferencaTotal)).get();
                        
                        snapV_UIDs.forEach(docV => {
                            batch.update(docV.ref, {
                                situacao_atual: "DISPONÍVEL",
                                local_id: "ALMOXARIFADO",
                                viatura_id: null,
                                sub_local: "ALMOXARIFADO",
                                data_movimentacao: dataReg
                            });
                        });
                    }
                }

                // Saldos e Histórico
                batch.set(saldoRef, {
                    disp: firebase.firestore.FieldValue.increment(-diferencaTotal),
                    uso: firebase.firestore.FieldValue.increment(diferencaTotal),
                    last_update: dataReg
                }, { merge: true });

                const pathCache = `unidades_cache.${unidadeGestoraId}`;
                batch.update(itemRef, {
                    [`${pathCache}.disp`]: firebase.firestore.FieldValue.increment(-diferencaTotal),
                    [`${pathCache}.uso`]: firebase.firestore.FieldValue.increment(diferencaTotal),
                    ultima_movimentacao: dataReg
                });

                const histRef = saldoRef.collection('historico_vida').doc();
                batch.set(histRef, {
                    data: dataReg, evento: diferencaTotal > 0 ? "ALOCACÃO LISTA" : "ESTORNO ESTOQUE",
                    detalhes: diferencaTotal > 0 ? `Enviado para lista ${nomeAmigavelVtr}.` : `Removido da lista ${nomeAmigavelVtr}. MOTIVO: ${justificativa}`,
                    quem: currentUserData.nome_militar_completo, unidade: unidadeSigla
                });
            }
        }

        // 6. PROCESSAMENTO DE PATRIMÔNIOS (MULTI)
        for (const setor of arquiteturaAtiva) {
            for (const item of (setor.itens || [])) {
                if (item.tipo === 'multi' && item.uid_global !== "ITEM_VISTORIA_LIVRE") {
                    const itemRef = firestore.collection('inventario').doc(item.uid_global);
                    for (const t of (item.tombamentos || [])) {
                        const tombRef = itemRef.collection('tombamentos').doc(t.tomb);
                        batch.update(tombRef, { 
                            situacao_atual: "EM CARGA", 
                            local_id: "VIATURA", 
                            viatura_id: idListaSendoEditada,
                            sub_local: setor.nome,
                            data_movimentacao: dataReg
                        });
                        const jaEstava = listaAnterior.some(s => (s.itens || []).some(it => (it.tombamentos || []).some(oldT => oldT.tomb === t.tomb)));
                        if (!jaEstava) {
                            const logIndRef = tombRef.collection('historico_vida').doc();
                            batch.set(logIndRef, {
                                data: dataReg, evento: "ALOCAÇÃO LISTA", detalhes: `Enviado para lista ${nomeAmigavelVtr} no setor ${setor.nome}.`,
                                quem: currentUserData.nome_militar_completo, unidade: unidadeSigla
                            });
                        }
                    }
                }
            }
        }

        // 7. PROCESSAMENTO DE ESTORNOS (MULTI)
        for (const iEst of estornosReais) {
            if (iEst.tipo === 'multi' && iEst.tombamentos) {
                const itemRef = firestore.collection('inventario').doc(iEst.uid_global);
                for (const t of iEst.tombamentos) {
                    const tRef = itemRef.collection('tombamentos').doc(t.tomb);
                    batch.update(tRef, { 
                        situacao_atual: "DISPONÍVEL", 
                        local_id: "ALMOXARIFADO", 
                        viatura_id: null, 
                        sub_local: "ALMOXARIFADO" 
                    });
                }
            }
        }

        await batch.commit();
        await Swal.fire({ icon: 'success', title: 'Publicação Concluída!', timer: 2000, showConfirmButton: false });
        location.reload();

    } catch (e) {
        console.error("❌ ERRO NA PUBLICAÇÃO:", e);
        if(btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Tentar Publicar'; }
        Swal.fire('Erro de Sincronismo', e.message, 'error');
    }
}   

//=======================================================================//
//--- BLOCO DE INICIALIZAÇÃO (SETUP) - DISPARADO AO CARREGAR A PÁGINA ---//
//=======================================================================//

/**
 * Garante que os elementos visuais do Editor de Inventário iniciem 
 * no estado correto (ocultos) assim que o DOM estiver pronto.
 */
document.addEventListener('DOMContentLoaded', function () {
    const card = document.getElementById('container-item-rascunho');
    if (card) {
        card.style.display = 'none';
    }
});