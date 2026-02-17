//================================================//
//--- BLOCO 1: Gestão de Cabeçalhos e Listagem ---//
//===============================================//

//=== 1.1. ABRE O FORMULÁRIO PARA CRIAR OU EDITAR O CABEÇALHO DA LISTA (VTR, UNIDADE, POSTO) ===//
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

//=== 1.2. GRAVA OS DADOS BÁSICOS DA LISTA NO FIRESTORE E DECIDE SE ABRE O EDITOR DE ITENS ===//
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
            <div style="grid-column: 1/-1; margin-bottom: 10px;"><h3 style="color:#1e293b; font-size:1em;">LISTAS ATIVAS</h3></div>
            ${htmlAtivas || '<div style="grid-column:1/-1; color:#94a3b8; padding:20px;">Nenhuma lista ativa.</div>'}
            
            <div style="grid-column: 1/-1; margin-top:40px; padding-top:20px; border-top: 2px dashed #e2e8f0;">
                <h3 style="color:#64748b; font-size:0.9em; text-transform:uppercase;">LISTAS INATIVAS</h3>
            </div>
            ${htmlInativas || '<div style="grid-column:1/-1; color:#94a3b8; padding:20px; font-size:0.8em;">Nenhuma lista arquivada.</div>'}
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

    // Mostra um loading rápido enquanto verifica o conteúdo da lista
    Swal.fire({
        title: 'Verificando inventário...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const docSnap = await firestore.collection('listas_conferencia').doc(listaUid).get();

        if (!docSnap.exists) {
            Swal.fire('Erro', 'Lista não localizada no banco de dados.', 'error');
            return;
        }

        const dadosLista = docSnap.data();
        const arquitetura = dadosLista.list || [];

        // Calcula o total de itens (somando itens de todos os setores)
        const totalItens = arquitetura.reduce((acc, setor) => acc + (setor.itens ? setor.itens.length : 0), 0);
        const temItens = totalItens > 0;

        // 1. DEFINIÇÃO DINÂMICA DO ALERTA
        const configAlerta = temItens ? {
            title: '⚠️ ESTORNO E EXCLUSÃO',
            html: `Esta lista contém <b>${totalItens} itens</b> alocados.<br><br>Ao confirmar, todos os materiais retornarão automaticamente ao estoque da unidade antes da exclusão.`,
            icon: 'warning',
            confirmButtonText: 'Sim, Estornar e Apagar',
            confirmButtonColor: '#d33'
        } : {
            title: 'Excluir Lista?',
            html: `A lista do <b>${nomeAtivo}</b> está vazia. Deseja removê-la?`,
            icon: 'question',
            confirmButtonText: 'Sim, excluir',
            confirmButtonColor: '#2c7399'
        };

        const confirmacao = await Swal.fire({
            ...configAlerta,
            showCancelButton: true,
            cancelButtonColor: '#64748b',
            cancelButtonText: 'Cancelar'
        });

        if (!confirmacao.isConfirmed) return;

        // Início do processo de gravação
        Swal.fire({
            title: temItens ? 'Processando Estorno...' : 'Excluindo...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        const batch = firestore.batch();
        const unidadeId = currentUserData.unidade_id;

        // 2. SE TIVER ITENS, PREPARA O ESTORNO
        if (temItens) {
            itensParaEstorno = [];
            arquitetura.forEach(setor => {
                (setor.itens || []).forEach(item => {
                    if (item.uid_global === "ITEM_VISTORIA_LIVRE") return;
                    itensParaEstorno.push({ ...item, setorOrigem: setor.nome });
                });
            });

            if (itensParaEstorno.length > 0) {
                const justificativa = `Exclusão da lista: ${nomeAtivo}`;
                await processarEstornoLote(batch, unidadeId, justificativa);
            }
        }

        // 3. EXCLUSÃO DO DOCUMENTO
        batch.delete(firestore.collection('listas_conferencia').doc(listaUid));

        await batch.commit();
        itensParaEstorno = []; // Limpa cache

        await Swal.fire({
            icon: 'success',
            title: temItens ? 'Estornado e Excluído!' : 'Excluído!',
            text: temItens ? 'Os materiais voltaram ao almoxarifado com sucesso.' : 'A lista foi removida.',
            timer: 2000,
            showConfirmButton: false
        });

        carregarCardsListasExistentes();

    } catch (e) {
        console.error("Erro ao deletar lista:", e);
        Swal.fire('Erro Crítico', e.message, 'error');
    }
}

//=== 1.6. INATIVA A LISTA (APAGA O CARD) PERGUNTANDO SE DEVE ESTORNAR OS ITENS OU MANTER A CARGA ===//
async function gerenciarInativacaoLista(listaUid, nomeAtivo) {
    const firestore = firebase.firestore();

    // 1. Loading de verificação (Rápido)
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
            // Caso tenha itens: Alerta Médio/Alto (Laranja/Vermelho)
            configModal = {
                title: 'Apagar Card (Inativar)?',
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
            // Caso esteja vazia: Alerta Baixo (Azul/Informativo)
            configModal = {
                title: 'Inativar Lista?',
                html: `A lista <b>${nomeAtivo}</b> está vazia. Ela será movida para o grupo de inativas.`,
                icon: 'question',
                showDenyButton: false, // Não precisa de botão de estorno
                confirmButtonText: 'Confirmar Inativação',
                confirmButtonColor: '#2c7399'
            };
        }

        const { isConfirmed, isDenied } = await Swal.fire({
            ...configModal,
            showCancelButton: true,
            cancelButtonColor: '#64748b',
            cancelButtonText: 'Voltar'
        });

        if (!isConfirmed && !isDenied) return;

        // 3. PROCESSAMENTO
        Swal.fire({
            title: 'Processando...',
            didOpen: () => { Swal.showLoading(); }
        });

        const batch = firestore.batch();
        const realizarEstorno = isDenied; // Só será verdadeiro se clicou no botão vermelho

        if (realizarEstorno && temItens) {
            itensParaEstorno = [];
            arquitetura.forEach(setor => {
                (setor.itens || []).forEach(item => {
                    if (item.uid_global !== "ITEM_VISTORIA_LIVRE") {
                        itensParaEstorno.push({ ...item, setorOrigem: setor.nome });
                    }
                });
            });

            if (itensParaEstorno.length > 0) {
                await processarEstornoLote(batch, currentUserData.unidade_id, `Inativação com Estorno: ${nomeAtivo}`);
            }
        }

        // Atualiza para inativo
        batch.update(listaRef, {
            ativo: false,
            inativado_em: firebase.firestore.FieldValue.serverTimestamp(),
            inativado_por: currentUserData.nome_militar_completo
        });

        await batch.commit();
        itensParaEstorno = []; // Limpa cache

        await Swal.fire({
            icon: 'success',
            title: temItens ? 'Inventário Arquivado!' : 'Lista inativada!',
            text: `A lista ${nomeAtivo} foi movida para o arquivo.`,
            timer: 2000,
            showConfirmButton: false
        });

        carregarCardsListasExistentes();

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

    // Loading rápido para feedback
    Swal.fire({ title: 'Reativando...', didOpen: () => Swal.showLoading() });

    try {
        const firestore = firebase.firestore();

        await firestore.collection('listas_conferencia').doc(listaUid).update({
            ativo: true,
            reativado_em: firebase.firestore.FieldValue.serverTimestamp(),
            reativado_por: currentUserData.nome_militar_completo
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
/* --- Renderiza a estrutura visual de setores e itens no Editor, com suporte a Kits e Drag & Drop --- */
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

            // ✅ MAPEAMENTO INTELIGENTE: Busca acessórios em ambas as chaves possíveis
            const listaAcessorios = item.acessorios_vinculados || item.acessorios_acoplados || [];
            const ehAnfitriao = item.is_anfitriao || listaAcessorios.length > 0;

            htmlItens += `
                <div class="item-arquitetura-linha" data-item-index="${indexItem}" 
                     style="flex-direction: column; align-items: flex-start; gap: 5px; padding: 10px; border-bottom: 1px solid #f1f5f9; position: relative; ${ehAnfitriao ? 'background: #fffcf5; border-left: 4px solid #f59e0b;' : ''}">
                    
                    <div class="item-arquitetura-info" style="width: 100%; display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="display: flex; flex-direction: column;">
                            <b style="color: #1e293b; font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Inter', sans-serif;">
                                ${ehAnfitriao ? '<i class="fas fa-box-open" style="color:#f59e0b; margin-right:5px;"></i>' : ''}${item.nome}
                            </b>
                            ${item.uid_instancia ? `<small style="font-size:0.6em; color:#94a3b8; font-weight:700;">ID: ${item.uid_instancia}</small>` : ''}
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

                    ${listaAcessorios.length > 0 ? `
                        <div class="acessorios-vtr-container" style="width: 100%; margin-top: 8px; padding-left: 12px; border-left: 2px dashed #f59e0b; box-sizing: border-box;">
                            <small style="display:block; font-size: 0.6em; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 5px;">Componentes Vinculados:</small>
                            ${listaAcessorios.map((ac, indexAc) => `
                                <div style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 4px 8px; border-radius: 5px; border: 1px solid #f1f5f9; margin-bottom: 3px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                                    <span style="font-size: 10px; font-weight: 600; color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">
                                        <i class="fas fa-link" style="font-size: 8px; color: #f59e0b;"></i> ${ac.nome}
                                    </span>
                
                                    <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                                        <b style="font-size: 10px; color: #1e293b;">${ac.quantidade} un.</b>
                                        <button onclick="removerAcessorioDeKit(${indexSetor}, ${indexItem}, ${indexAc})" 
                                                title="Remover acessório"
                                                style="background: #fff1f2; border: none; color: #e11d48; cursor: pointer; border-radius: 3px; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 8px;">
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

        // Sortable Setup
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

//=== 4. CACHEIA O ESTOQUE DISPONÍVEL DA UNIDADE PARA AGILIZAR A BUSCA NO EDITOR ===//
async function carregarEstoqueParaEditor(unidadeId) {
    try {
        console.log("🚀 [SIGMA V3] INICIANDO CARGA DE ESTOQUE PARA UNIDADE:", unidadeId);
        estoqueGestorLocal = [];

        // Busca a coleção raiz de inventário
        const snapItens = await db.collection('inventario').get();

        for (const doc of snapItens.docs) {
            const itemGlobal = doc.data();
            const ehMulti = itemGlobal.tipo === 'multi';
            const uidItem = doc.id;

            // 1. BUSCA DE TOMBAMENTOS (Para itens Multi/Patrimônio)
            let tombamentosDaUnidade = [];
            let qtdDisponivelMulti = 0;

            if (ehMulti) {
                const snapTombs = await db.collection('inventario').doc(uidItem)
                    .collection('tombamentos')
                    .where('local_id', '==', unidadeId)
                    .get();

                tombamentosDaUnidade = snapTombs.docs.map(t => {
                    const data = t.data();
                    // ✅ Contabiliza apenas os que não estão em nenhuma viatura (disponíveis no almox)
                    if (!data.viatura_id || data.situacao_atual === 'DISPONÍVEL') {
                        qtdDisponivelMulti++;
                    }
                    return data;
                });
            }

            // 2. BUSCA DE SALDO (Para itens Single/Consumo)
            const saldoDoc = await doc.ref.collection('saldos_unidades').doc(unidadeId).get();
            const dadosSaldo = saldoDoc.exists ? saldoDoc.data() : null;
            const temSaldoNaUnidade = dadosSaldo && (Number(dadosSaldo.qtd_total) > 0);

            // ✅ FILTRO DE VISIBILIDADE: Só entra no cache se a unidade possuir o item fisicamente
            if (tombamentosDaUnidade.length > 0 || temSaldoNaUnidade) {

                const objetoParaBusca = {
                    id_almox: uidItem,
                    uid_global: uidItem,
                    nome: (itemGlobal.nome || "Item sem nome").toUpperCase(),
                    tipo: itemGlobal.tipo,
                    categoria: itemGlobal.categoria || "OUTROS",
                    unidade_id: unidadeId,
                    tombamentos: tombamentosDaUnidade,
                    // ✅ Lógica de disponibilidade real para o buscador
                    disponivel: ehMulti ? qtdDisponivelMulti : (Number(dadosSaldo.qtd_disp) || 0),

                    // 🔥 ATRIBUTOS DE KIT: Essencial para acionar os modais de acoplamento
                    is_anfitriao: itemGlobal.is_anfitriao || false,
                    componentes_regra: itemGlobal.componentes_regra || []
                };

                estoqueGestorLocal.push(objetoParaBusca);
            }
        }

        console.log(`🏁 [SIGMA V3] CACHE FINALIZADO: ${estoqueGestorLocal.length} itens mapeados para busca.`);

    } catch (e) {
        console.error("❌ ERRO CRÍTICO NA CARGA DO ESTOQUE:", e);
        Swal.fire('Erro de Sincronia', 'Não foi possível carregar os dados do inventário.', 'error');
    }
}

//======================================================//
//--- BLOCO 3: Inteligência de Adição e Modificação ---//
//=====================================================//

//=== 3.1. BUSCADOR INTELIGENTE (AUTOCOMPLETE) QUE FILTRA ITENS DISPONÍVEIS NO ALMOXARIFADO ===//
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

//=== 10.1. FINALIZA A ESCOLHA NO AUTOCOMPLETE E LIMPA O CAMPO DE BUSCA ===//
function selecionarSugestaoManual(item) {
    selecionarItemParaAdicionar(item);
    document.getElementById('sugestoes-estoque-editor').style.display = 'none';
    document.getElementById('input-busca-estoque').value = '';
}

//=== 10.2. BUSCA O ITEM PELO ÍNDICE (SUPORTE PARA LISTAS LONGAS) ===//
function selecionarSugestaoPorIndex(index) {
    const item = window.tempSuggestionsSearch[index];
    if (item) {
        // Esta função deve alimentar o itemSelecionadoTemp e fechar o box
        selecionarItemParaAdicionar(item);
    }
}

//=== 11. INTERCEPTA O ITEM SELECIONADO E ABRE O CAMPO DE QUANTIDADE OU MODAL DE KIT ===//
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

//=== 2. INTERCEPTA O ITEM SELECIONADO E ABRE O CAMPO DE QUANTIDADE OU MODAL DE KIT ===//
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

//=== 11.1. EXIBE O FEEDBACK VISUAL DO ITEM QUE ESTÁ SENDO "MONTADO" ===//
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


//=== 3. VALIDA A QUANTIDADE DIGITADA CONTRA O SALDO REAL DO ALMOXARIFADO ===//
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

//=== 4. EXECUTA A INSERÇÃO DO ITEM NO SETOR ESCOLHIDO NA ARQUITETURA ===//
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

//=== 5. RESET DAS CORES E CAMPOS DO BOX DE BUSCA ===//
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

//=== 6. EVITA DUPLICIDADE UNINDO ITENS IGUAIS NO MESMO SETOR (SOMA QTD OU UNE TOMBAMENTOS) ===//
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

//=== 4.3. REMOVE UM ITEM ESPECÍFICO DO SETOR E O ENVIA PARA A CAIXA DE ESTORNO ===//
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

//=== 4.4. DESVINCULA UM ACESSÓRIO DE UM KIT (O SALDO VOLTA AO ESTOQUE NA PUBLICAÇÃO) ===//
function removerAcessorioDeKit(setorIdx, itemPaiIdx, acessorioIdx) {
    const itemPai = arquiteturaAtiva[setorIdx].itens[itemPaiIdx];

    // 1. Remove o acessório do array do pai (Arquitetura em memória)
    const acessorioRemovido = itemPai.acessorios_acoplados.splice(acessorioIdx, 1)[0];

    // ✅ AJUSTE CIRÚRGICO: Removido o push para 'itensParaEstorno'.
    // Como acessórios são 'single', o Passo 3 da função confirmarPublicacaoLista 
    // detectará a diminuição da quantidade total na lista e devolverá o saldo 
    // ao estoque da unidade automaticamente no momento da publicação.

    // 2. Atualiza a interface
    const badge = document.getElementById('badge-estorno-count');
    // Note: O badge de estorno só deve pulsar se houver itens na caixa de saída (geralmente itens MULTI)

    atualizarInterfaceEstorno();
    renderizarArquiteturaEditor();
    marcarAlteracao();

    console.log(`♻️ Acessório "${acessorioRemovido.nome}" desvinculado do kit. O saldo será ajustado automaticamente na publicação.`);
}

//=== 4.5. REMOVE UM PATRIMÔNIO (TOMBAMENTO) ESPECÍFICO DE UM ITEM MULTI ===//
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

//=== 4.6. GESTÃO VISUAL DA CAIXA DE SAÍDA E CONTROLE DE VISIBILIDADE (MODO VISTORIA) ===//
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

//===========================================//
//--- BLOCO 5: Finalização e Persistência ---//
//===========================================//

//=== 5.1. ALTERA O ESTILO DO BOTÃO DE PUBLICAR PARA INDICAR ALTERAÇÕES PENDENTES ===//
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

//=== 5.2. FUNÇÃO MESTRA: SINCRONIZA TUDO NO FIREBASE (ESTRUTURA, SALDOS E PATRIMÔNIOS) ===//
async function confirmarPublicacaoLista() {
    // 1. CONFIRMAÇÃO MODERNA
    const resultConfirm = await Swal.fire({
        title: 'Publicar Alterações?',
        text: "O inventário será atualizado e os itens removidos retornarão ao estoque da sua unidade.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#1b8a3e',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sim, Publicar!',
        cancelButtonText: 'Cancelar'
    });

    if (!resultConfirm.isConfirmed) return;

    const firestore = firebase.firestore();
    const elNome = document.getElementById('edit-vtr-nome');
    const nomeAmigavelVtr = elNome ? (elNome.innerText || elNome.textContent).split('\n').pop().trim() : "Viatura";
    const justificativa = document.getElementById('justificativa-estorno-global').value.trim();
    const unidadeGestoraId = currentUserData.unidade_id;

    const estornosReais = itensParaEstorno.filter(i => i.uid_global !== "ITEM_VISTORIA_LIVRE");

    // 2. VALIDAÇÃO DE JUSTIFICATIVA
    if (estornosReais.length > 0 && !justificativa) {
        await Swal.fire({
            icon: 'warning',
            title: 'Justificativa Requerida',
            text: 'Para devolver materiais ao estoque, preencha o motivo do estorno.',
            confirmButtonColor: '#d97706'
        });
        document.getElementById('justificativa-estorno-global').focus();
        return;
    }

    const btn = document.querySelector('.btn-publish');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Publicando...';

    Swal.fire({
        title: 'Sincronizando Banco de Dados',
        html: 'Aguarde enquanto processamos os saldos e patrimônios...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const batch = firestore.batch();
        const listaRef = firestore.collection(window.colecaoAtivaNoEditor).doc(idListaSendoEditada);
        const snapLista = await listaRef.get();
        const listaAnterior = snapLista.exists ? (snapLista.data().list || []) : [];

        // ✅ 3. MAPEAMENTO HIERÁRQUICO ATUALIZADO (Suporta transição de nomenclatura)
        const mapearSaldos = (arquitetura) => {
            const mapa = {};
            arquitetura.forEach(setor => {
                (setor.itens || []).forEach(it => {
                    if (it.uid_global === "ITEM_VISTORIA_LIVRE") return;

                    // Soma saldo do item principal
                    mapa[it.uid_global] = (mapa[it.uid_global] || 0) + (Number(it.quantidadeEsperada) || 0);

                    // ✅ Busca acessórios em ambas as chaves para não perder saldo no estorno
                    const acessorios = it.acessorios_vinculados || it.acessorios_acoplados;
                    if (acessorios) {
                        acessorios.forEach(ac => {
                            mapa[ac.uid_global] = (mapa[ac.uid_global] || 0) + (Number(ac.quantidade) || 0);
                        });
                    }
                });
            });
            return mapa;
        };

        const mapaAnterior = mapearSaldos(listaAnterior);
        const mapaAtual = mapearSaldos(arquiteturaAtiva);

        // --- 4. ATUALIZAÇÃO DA ESTRUTURA DA LISTA ---
        batch.update(listaRef, {
            list: arquiteturaAtiva,
            ultima_edicao_arquitetura: firebase.firestore.FieldValue.serverTimestamp(),
            editado_por: currentUserData.nome_militar_completo
        });

        const dataReg = new Date().toLocaleString('pt-BR');

        // --- 5. LOGÍSTICA DE INVENTÁRIO (ITENS SINGLE / ACESSÓRIOS) ---
        const todosUids = new Set([...Object.keys(mapaAnterior), ...Object.keys(mapaAtual)]);

        for (const uid of todosUids) {
            const qtdAnt = mapaAnterior[uid] || 0;
            const qtdAtu = mapaAtual[uid] || 0;
            const diferenca = qtdAtu - qtdAnt;

            if (diferenca !== 0) {
                const saldoRef = firestore.collection('inventario').doc(uid).collection('saldos_unidades').doc(unidadeGestoraId);

                batch.set(saldoRef, {
                    unidade_sigla: currentUserData.unidade_sigla || "N/D",
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

        // ✅ 6. PROCESSA ITENS MULTI (TOMBAMENTOS) COM NOVA CHAVE uid_instancia
        arquiteturaAtiva.forEach(setor => {
            (setor.itens || []).forEach(item => {
                if (item.tipo === 'multi' && item.uid_global !== "ITEM_VISTORIA_LIVRE") {
                    (item.tombamentos || []).forEach(t => {
                        const tombRef = firestore.collection('inventario').doc(item.uid_global).collection('tombamentos').doc(t.tomb);

                        // Atualiza o documento individual do patrimônio
                        batch.update(tombRef, {
                            situacao_atual: "EM CARGA",
                            viatura_id: idListaSendoEditada,
                            sub_local: setor.nome,
                            // ✅ Grava sempre na nova nomenclatura
                            acessorios_vinculados: item.acessorios_vinculados || item.acessorios_acoplados || []
                        });
                    });
                }
            });
        });

        // --- 7. CHAMADA DA INTELIGÊNCIA DE ESTORNO EM LOTE ---
        if (estornosReais.length > 0) {
            await processarEstornoLote(batch, unidadeGestoraId, justificativa);
        }

        // --- 8. EXECUÇÃO DO BATCH ---
        await batch.commit();

        itensParaEstorno = [];
        await Swal.fire({
            icon: 'success',
            title: 'Publicado!',
            text: 'O inventário e os kits foram atualizados com sucesso.',
            timer: 2000,
            showConfirmButton: false
        });
        location.reload();

    } catch (e) {
        console.error("Erro na publicação:", e);
        Swal.fire({
            icon: 'error',
            title: 'Erro de Sincronismo',
            text: 'Falha ao atualizar inventário: ' + e.message,
            confirmButtonColor: '#800000'
        });
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Tentar Novamente';
    }
}

//=== 5.3. INTELIGÊNCIA LOGÍSTICA: DEVOLVE ITENS DA CAIXA DE SAÍDA PARA O ALMOXARIFADO COM LOGS ===//
async function processarEstornoLote(batch, unidadeId, justificativa) {
    if (!itensParaEstorno || itensParaEstorno.length === 0) return;

    const dataReg = new Date().toLocaleString('pt-BR');
    const invRef = firebase.firestore().collection('inventario');

    // Identifica a origem (Viatura/Lista) através do DOM
    const elNome = document.getElementById('edit-vtr-nome');
    const nomeVtrOrigem = elNome ? (elNome.innerText || elNome.textContent).split('\n').pop().trim() : "Lista";

    // Identifica a sigla da unidade do gestor para um log mais preciso
    const siglaUnidade = currentUserData.unidade_sigla || "Unidade Gestora";

    for (const item of itensParaEstorno) {
        // Ignora itens virtuais de vistoria
        if (item.uid_global === "ITEM_VISTORIA_LIVRE") continue;

        const itemDocRef = invRef.doc(item.uid_global);

        if (item.tipo === 'multi') {
            // --- INTELIGÊNCIA PARA ITENS MULTI (PATRIMÔNIO) ---
            if (item.tombamentos && item.tombamentos.length > 0) {
                item.tombamentos.forEach(t => {
                    const tombRef = itemDocRef.collection('tombamentos').doc(t.tomb);

                    batch.update(tombRef, {
                        situacao_atual: "DISPONÍVEL",
                        viatura_id: null,
                        sub_local: "ALMOXARIFADO",
                        local_id: unidadeId, // Reforça o vínculo com a unidade do gestor
                        acessorios_vinculados: [] // Limpa acessórios acoplados no estorno
                    });

                    // Log detalhado no histórico individual do patrimônio
                    const histRef = tombRef.collection('historico_vida').doc();
                    batch.set(histRef, {
                        data: dataReg,
                        evento: "ESTORNO_EDITOR",
                        quem: currentUserData.nome_militar_completo,
                        detalhes: `Item estornado da [${nomeVtrOrigem}] para o Almoxarifado da Unidade [${siglaUnidade}]. Motivo: ${justificativa}`
                    });
                });
            }
        } else {
            // --- INTELIGÊNCIA PARA ITENS SINGLE (CONSUMO) ---
            const saldoUnidadeRef = itemDocRef.collection('saldos_unidades').doc(unidadeId);
            const qtdEstorno = Number(item.quantidadeEsperada) || 0;

            if (qtdEstorno > 0) {
                // Ajusta o saldo especificamente dentro da subcoleção da unidade do gestor
                batch.set(saldoUnidadeRef, {
                    qtd_disp: firebase.firestore.FieldValue.increment(qtdEstorno),
                    qtd_em_carga: firebase.firestore.FieldValue.increment(-qtdEstorno),
                    last_update: dataReg
                }, { merge: true });

                // Log detalhado no histórico de saldo da unidade
                const histSaldoRef = saldoUnidadeRef.collection('historico_vida').doc();
                batch.set(histSaldoRef, {
                    data: dataReg,
                    evento: "ESTORNO_SALDO_EDITOR",
                    detalhes: `${qtdEstorno} un. devolvidas da [${nomeVtrOrigem}] para o estoque da Unidade [${siglaUnidade}]. Motivo: ${justificativa}`,
                    quem: currentUserData.nome_militar_completo
                });
            }
        }
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
