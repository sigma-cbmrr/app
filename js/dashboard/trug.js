//======================================//
//--- BLOCO: NOVA CAUTELA (Emissão) ---//
//=====================================//

//--- Retorna o HTML do formulário de nova cautela, com estrutura limpa e preparada para injeção ---//
function getNovaCautelaFormHTML() {
    return `
        <div class="sigma-v3-title-label" style="margin-bottom: 25px;">
            <i class="fas fa-file-contract" style="color: #800020;"></i>
            <span>Novo Termo de Responsabilidade de Uso e Guarda (TRUG)</span>
        </div>

        <div style="background: white; border-radius: 20px; padding: 25px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #eef2f6; box-sizing: border-box;">
            <div class="form-grid-2-columns" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                <div class="form-group">
                    <label style="font-weight: 800; font-size: 0.75em; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 8px;">
                        <i class="fas fa-user-tag"></i> Destinatário (Recebedor)
                    </label>
                    <div class="custom-select-container">
                        <input type="hidden" id="cautela-destinatario-uid">
                        <input type="text" id="cautela-destinatario" placeholder="Nome, posto ou matrícula" required autocomplete="off" 
                               style="width: 100%; padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-family: inherit;">
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
                            style="width: 100%; padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 700; color: #1e293b; font-family: inherit; cursor: pointer;">
                        <option value="" disabled selected>Selecione a origem...</option>
                    </select>
                </div>
            </div>

            <div id="selection-hub" style="margin-top: 30px; border-top: 2px solid #f1f5f9; padding-top: 20px;">
                <h4 style="margin-bottom: 15px; font-weight: 800; font-size: 0.85em; color: #800020; text-transform: uppercase; display: flex; justify-content: space-between; align-items: center;">
                    <span><i class="fas fa-clipboard-list"></i> Seleção de Materiais</span>
                    <span id="selected-counter-badge" style="background: #800020; color: white; padding: 2px 12px; border-radius: 20px; font-size: 0.8em; font-weight: bold;">0 itens</span>
                </h4>

                <div style="position: relative; margin-bottom: 20px;">
                    <i class="fas fa-search" style="position: absolute; left: 15px; top: 13px; color: #94a3b8;"></i>
                    <input type="text" id="trug-item-search" placeholder="🔍 Buscar material por nome ou tombamento..." 
                           oninput="filterTrugItems()"
                           style="width: 100%; padding: 12px 12px 12px 45px; border-radius: 12px; border: 2px solid #e2e8f0; outline: none; font-size: 0.95em; box-sizing: border-box; background: #fff; font-family: inherit;">
                </div>

                <div id="itens-custodia-list" style="background: #f8fafc; border-radius: 15px; min-height: 200px; padding: 15px; border: 1px solid #e2e8f0; max-height: 500px; overflow-y: auto;">
                    <div style="text-align: center; color: #94a3b8; margin-top: 60px;">
                        <i class="fas fa-arrow-up fa-2x" style="margin-bottom: 10px; opacity: 0.5;"></i>
                        <p style="font-size: 0.95em; font-weight: 600;">Selecione o Local de Origem para carregar os itens.</p>
                    </div>
                </div>
            </div>

            <div class="form-group" style="margin-top: 25px;">
                <label style="font-weight: 800; font-size: 0.75em; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 8px;">Observações</label>
                <textarea id="cautela-obs" rows="3" placeholder="Descreva o motivo desta movimentação..." 
                          style="width: 100%; max-width: 100%; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; resize: vertical; font-family: 'Inter', sans-serif; font-size: 0.95em; line-height: 1.5; color: #1e293b; box-sizing: border-box; outline: none; transition: border-color 0.2s;">
                </textarea>
            </div>
            
            <button class="btn-create" onclick="iniciarCautelaProcesso()" id="btn-iniciar-cautela" disabled 
                    style="width: 100%; margin-top: 20px; padding: 18px; border-radius: 12px; background: #800020; color: white; font-weight: 800; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: 0.3s; box-shadow: 0 4px 15px rgba(128,0,32,0.2); font-size: 1.1em; font-family: inherit;">
                <i class="fas fa-paper-plane"></i> EMITIR TRUG
            </button>
        </div>
    `;
}

function filterTrugItems() {
    const term = document.getElementById('trug-item-search').value.trim().toUpperCase();
    const cards = document.querySelectorAll('.item-selection-card');
    const accordions = document.querySelectorAll('.accordion-content');
    const headers = document.querySelectorAll('.accordion-header');

    cards.forEach(card => {
        // Busca o texto dentro do card (Nome, Tombamentos, Qtd)
        const text = card.innerText.toUpperCase();
        if (text.includes(term)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });

    // Gerencia a visibilidade dos Setores (Acordeões) baseada nos resultados
    headers.forEach((header, index) => {
        const content = accordions[index];
        const visibleCards = content.querySelectorAll('.item-selection-card[style="display: flex;"]').length;
        
        if (visibleCards > 0) {
            header.style.display = 'flex';
            if (term.length > 0) {
                // Abre o acordeão automaticamente se houver busca ativa
                content.style.maxHeight = '1500px'; 
                header.classList.add('active');
            }
        } else {
            header.style.display = 'none';
            content.style.maxHeight = '0px';
        }
    });
}

//=== Exibe o formulário de nova cautela, com campos limpos, listeners ativados e carregamento de dados necessários ===//
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

//=== Executa a transação no Firebase: grava o TRUG e "carimba" os itens no estoque===//
async function iniciarCautelaProcesso() {
    const localId = document.getElementById('cautela-local-origem').value;
    const destinatarioUid = document.getElementById('cautela-destinatario-uid').value;
    const destinatarioNome = document.getElementById('cautela-destinatario').value;
    const obsEmissao = document.getElementById('cautela-obs')?.value || "";

    if (!localId || !destinatarioUid || cautelaItensSelecionados.length === 0) {
        Swal.fire("Atenção", "Preencha o destinatário e selecione ao menos um item.", "warning");
        return;
    }

    const btn = document.getElementById('btn-iniciar-cautela');
    btn.disabled = true; 
    btn.innerHTML = `<i class="fas fa-sync fa-spin"></i> PROCESSANDO TRUG...`;

    try {
        const isDoAlmoxarifado = (localId === "ESTOQUE_GERAL");
        let listaData = null;
        let nomeAmigavelLocal = isDoAlmoxarifado ? "ALMOXARIFADO CENTRAL" : "";
        let unidadeIdOrigem = currentUserData.unidade_id;

        if (!isDoAlmoxarifado) {
            const listaDoc = await db.collection('listas_conferencia').doc(localId).get();
            if (!listaDoc.exists) throw new Error("Viatura/Lista não encontrada no banco.");
            listaData = listaDoc.data();
            unidadeIdOrigem = listaData.unidade_id;
            nomeAmigavelLocal = `${listaData.posto_nome || ''} - ${listaData.ativo_nome || localId}`;
        }

        const cautelaId = "TRUG-" + Math.floor(10000000 + Math.random() * 90000000);
        const emitenteNome = `${currentUserData.posto} ${currentUserData.quadro} ${currentUserData.nome_guerra}`;
        const dataAtual = new Date().toLocaleString('pt-BR');

        const novaCautela = {
            cautela_id: cautelaId,
            emitente_uid: firebase.auth().currentUser.uid,
            emitente: emitenteNome,
            destinatario_uid: destinatarioUid,
            destinatario: destinatarioNome,
            local_origem_id: localId,
            local_origem: nomeAmigavelLocal,
            unidade_origem: unidadeIdOrigem,
            status: 'ABERTA',
            timestamp_emissao: firebase.firestore.FieldValue.serverTimestamp(),
            observacoes_emissao: obsEmissao,
            itens: cautelaItensSelecionados,
            historico_movimentacoes: [{
                data: dataAtual,
                militar: emitenteNome,
                descricao: `TRUG emitido. Aguardando aceite de ${destinatarioNome}.`,
                tipo: "EMISSAO"
            }]
        };

        await db.runTransaction(async (transaction) => {
            
            // Log de histórico base
            const gerarLogVida = (idTombOuDoc) => ({
                data: dataAtual,
                tipo: "CAUTELA (TRUG)",
                descricao: `Material cautelado para ${destinatarioNome}. TRUG: ${cautelaId}`,
                militar_nome: emitenteNome,
                militar_uid: firebase.auth().currentUser.uid,
                local: nomeAmigavelLocal,
                quantidade: 1 // No Sigma V3, logs individuais são sempre unitários
            });

            if (!isDoAlmoxarifado && listaData) {
                let listMestra = listaData.list;

                listMestra = listMestra.map(setor => {
                    return {
                        ...setor,
                        itens: setor.itens.map(mItem => {
                            const sel = cautelaItensSelecionados.find(c => c.id === mItem.uid_instancia || c.id === mItem.id);
                            
                            if (sel) {
                                const uidGlobal = mItem.uid_global || mItem.id;
                                const itemRef = db.collection('inventario').doc(uidGlobal);
                                const saldoRef = itemRef.collection('saldos_unidades').doc(unidadeIdOrigem);
                                const qtdMov = Number(sel.quantidade) || 1;
                                const carimbo = { id: cautelaId, destinatario: destinatarioNome, data: dataAtual, quantidade: qtdMov };

                                // ✅ ALIMENTA HISTÓRICO DE VIDA (SINGLE OU MULTI)
                                const histRef = itemRef.collection('historico_vida').doc();
                                transaction.set(histRef, gerarLogVida(uidGlobal));

                                if (mItem.tipo === 'multi' && sel.tombamento) {
                                    mItem.tombamentos = mItem.tombamentos.map(t => {
                                        if (t.tomb === sel.tombamento) {
                                            t.cautela = carimbo;
                                            transaction.update(itemRef.collection('tombamentos').doc(t.tomb), { 
                                                situacao_atual: "CAUTELADO", 
                                                uid_cautela: cautelaId, 
                                                atualizado_por: emitenteNome, 
                                                atualizado_em: dataAtual 
                                            });
                                        }
                                        return t;
                                    });
                                } else {
                                    if (!mItem.cautelas) mItem.cautelas = [];
                                    mItem.cautelas.push(carimbo);
                                    transaction.update(itemRef.collection('tombamentos').doc(sel.id), {
                                        situacao_atual: "CAUTELADO", 
                                        uid_cautela: cautelaId, 
                                        atualizado_por: emitenteNome, 
                                        atualizado_em: dataAtual
                                    });
                                }

                                const acessorios = mItem.acessorios_vinculados || mItem.acessorios_acoplados || [];
                                acessorios.forEach(ac => {
                                    ac.cautela = carimbo;
                                    const acRef = db.collection('inventario').doc(ac.uid_global || ac.id).collection('tombamentos').doc(ac.tomb || ac.id);
                                    transaction.update(acRef, { 
                                        situacao_atual: "CAUTELADO", 
                                        uid_cautela: cautelaId, 
                                        atualizado_por: emitenteNome 
                                    });
                                    // ✅ Histórico para acessórios também
                                    transaction.set(db.collection('inventario').doc(ac.uid_global || ac.id).collection('historico_vida').doc(), gerarLogVida(ac.tomb));
                                });

                                transaction.update(saldoRef, {
                                    disp: firebase.firestore.FieldValue.increment(-qtdMov),
                                    uso_caut: firebase.firestore.FieldValue.increment(qtdMov),
                                    last_update: dataAtual
                                });
                                transaction.update(itemRef, {
                                    [`unidades_cache.${unidadeIdOrigem}.disp`]: firebase.firestore.FieldValue.increment(-qtdMov),
                                    [`unidades_cache.${unidadeIdOrigem}.uso_caut`]: firebase.firestore.FieldValue.increment(qtdMov)
                                });
                            }
                            return mItem;
                        })
                    };
                });
                transaction.update(db.collection('listas_conferencia').doc(localId), { list: listMestra });
            } 
            
            else {
                for (const sel of cautelaItensSelecionados) {
                    const itemRef = db.collection('inventario').doc(sel.id_base);
                    const saldoRef = itemRef.collection('saldos_unidades').doc(unidadeIdOrigem);
                    const qtdMov = Number(sel.quantidade) || 1;

                    // ✅ ALIMENTA HISTÓRICO DE VIDA NA SAÍDA DO ALMOX
                    transaction.set(itemRef.collection('historico_vida').doc(), gerarLogVida(sel.id_base));

                    const updatesInventario = {
                        situacao_atual: "CAUTELADO", 
                        uid_cautela: cautelaId, 
                        local_id: "POSSE_PESSOAL", 
                        atualizado_por: emitenteNome, 
                        atualizado_em: dataAtual
                    };

                    if (sel.tipo === 'multi') {
                        transaction.update(itemRef.collection('tombamentos').doc(sel.tombamento), updatesInventario);
                    } else {
                         transaction.update(itemRef.collection('tombamentos').doc(sel.id), updatesInventario);
                    }

                    transaction.update(saldoRef, {
                        disp: firebase.firestore.FieldValue.increment(-qtdMov),
                        caut: firebase.firestore.FieldValue.increment(qtdMov),
                        last_update: dataAtual
                    });
                    transaction.update(itemRef, {
                        [`unidades_cache.${unidadeIdOrigem}.disp`]: firebase.firestore.FieldValue.increment(-qtdMov),
                        [`unidades_cache.${unidadeIdOrigem}.caut`]: firebase.firestore.FieldValue.increment(qtdMov)
                    });
                }
            }

            transaction.set(db.collection('cautelas_abertas').doc(cautelaId), novaCautela);
        });

        await Swal.fire({ icon: 'success', title: 'TRUG EMITIDO', text: `ID: ${cautelaId}. O material foi registrado no histórico de vida.`, confirmButtonColor: '#800020' });
        location.reload();

    } catch (e) {
        console.error("Erro Crítico no TRUG:", e);
        Swal.fire('Erro na Transação', e.message, 'error');
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-paper-plane"></i> EMITIR TRUG`;
    }
}

//=== Carrega os usuários para o campo de busca (destinatário), com exclusão do próprio usuário e preparação para o Autocomplete ===//
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

//=== Configura o Autocomplete do campo Destinatário, com destaque de texto, seleção e validação ===//
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
        const searchTerm = input.value.trim();
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
            // CRIA A EXPRESSÃO REGULAR PARA O DESTAQUE
            const regex = new RegExp(`(${searchTerm})`, 'gi');

            let html = '';
            filteredUsers.forEach(user => {
                const fullUserName = user.nome;
                const safeName = fullUserName.replace(/'/g, "&#39;");

                // Destaca o termo digitado no nome
                const highlightedName = fullUserName.replace(regex, '<strong>$1</strong>');

                html += `<li data-user-name="${safeName}" data-uid="${user.id}" style="cursor: pointer; padding: 10px; border-bottom: 1px solid #f1f5f9;">
                             <span style="color: #800020;">${highlightedName}</span>
                         </li>`;
            });

            suggestionsList.innerHTML = html;
            suggestionsBox.style.display = 'block';
        } else {
            // EXIBE MENSAGEM DE USUÁRIO NÃO CADASTRADO
            suggestionsList.innerHTML = `
                <li style="padding: 15px; color: #64748b; font-style: italic; text-align: center; background: #fff5f5; border-radius: 8px;">
                    <i class="fas fa-user-slash" style="color: #d90f23; margin-bottom: 8px; display: block; font-size: 1.2em;"></i>
                    Usuário não cadastrado no sistema
                </li>`;
            suggestionsBox.style.display = 'block';
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

//======================================//
//--- BLOCO: ATIVAS E MONITORAMENTO ---//
//=====================================//

//=== Exibe as diferentes visões de Cautelas (Ativas, a Receber, Histórico), com layout atualizado e chamadas para carregamento de dados ===//
function showCautelasDashboard(type) {
    const menuContainer = document.getElementById('cautelas-options-container');
    const contentArea = document.getElementById('cautelas-content');

    if (menuContainer) menuContainer.style.display = 'none';

    if (contentArea) {
        let htmlContent = '';
        let icon = '';
        let title = '';
        let description = '';

        if (type === 'Cautelas Ativas') {
            icon = 'fa-clipboard-check';
            title = 'TRUGs Ativos';
            description = 'Termo de Responsabilidade de Uso e Guarda Ativos. Clique em uma linha para ver os detalhes.';
        } else if (type === 'Cautelas a Receber') {
            icon = 'fa-inbox';
            title = 'TRUGs a Receber';
            description = 'TRUGs que aguardam seu aceite nominal ou por custódia de viatura/setor.';
        } else if (type === 'Histórico') {
            icon = 'fa-archive';
            title = 'Histórico de TRUGs';
            description = 'Visualize os TRUGs finalizados de acordo com o seu papel na transação.';
        }

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
                                    <th style="width:100px; text-align:center;">CONTEXTO</th>
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
                                    <th style="width:100px; text-align:center;">TIPO</th>
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
        }

        contentArea.innerHTML = htmlContent;
        contentArea.style.display = 'block';
    }
}

//=== Busca e exibe as cautelas ativas|Exibe todas as cautelas da unidade  ===//
//=== para Gestores/Admin, e apenas as emitidas para/pelo usuário logado para Operacionais. ===//

async function loadActiveCautelas() {
    const tbody = document.getElementById('cautelas-ativas-body');
    const loading = document.getElementById('loading-cautelas');
    const table = document.getElementById('cautelas-ativas-table');
    if (!tbody || !loading || !table) return;

    const role = currentUserData.role || 'operacional';
    const user = currentUserData;

    tbody.innerHTML = '';
    loading.style.display = 'block';
    table.style.display = 'none';

    try {
        const grupos = {
            custodiaAtiva: { title: 'Custódia Ativa (Itens sob sua responsabilidade)', data: [] },
            rastreioPessoal: { title: 'Meus Envios em Trânsito (Acompanhamento)', data: [] },
            monitoramento: { title: 'Monitoramento Gerencial/Global', data: [] },
        };

        const renderedIds = new Set();
        const militarUid = firebase.auth().currentUser.uid;

        // --- 1. BUSCAS PESSOAIS (Operacional e Gestor vendo suas próprias cautelas) ---
        if (role === 'operacional' || role === 'gestor') {
            // A. Custódia Ativa: Itens que ele RECEBEU e estão com ele
            grupos.custodiaAtiva.data = await queryCautelas(['RECEBIDA'], role, user, 'destinatario', 'personal');
            grupos.custodiaAtiva.data.forEach(c => renderedIds.add(c.id));

            // B. Rastreio: Itens que ele EMITIU ou DEVOLVEU (estão em trânsito)
            const rastreioEmitente = await queryCautelas(['ABERTA', 'RECEBIDA', 'DEVOLUÇÃO'], role, user, 'emitente', 'personal');
            const rastreioReversor = await queryCautelas(['DEVOLUÇÃO'], role, user, 'militar_completo_reversor', 'personal');

            const uniqueRastreio = new Map();
            [...rastreioEmitente, ...rastreioReversor].forEach(c => uniqueRastreio.set(c.id, c));

            // Filtra para não repetir o que já está na Custódia Ativa
            grupos.rastreioPessoal.data = Array.from(uniqueRastreio.values()).filter(c => !renderedIds.has(c.id));
            grupos.rastreioPessoal.data.forEach(c => renderedIds.add(c.id));
        }

        // --- 2. BUSCA GERENCIAL (Gestor e Admin monitorando a Unidade ou Geral) ---
        if (role === 'gestor' || role === 'admin') {
            const scope = (role === 'admin') ? 'personal' : 'unit'; // Admin vê global, Gestor vê Unidade

            // ✅ AGORA CHAMA A QUERY DIRETA PELA UNIDADE (Sem getUnitListIds)
            const monitoramentoRaw = await queryCautelas(['ABERTA', 'RECEBIDA', 'DEVOLUÇÃO'], role, user, null, scope);

            // Filtra para não repetir cautelas que o gestor já viu na lista pessoal dele
            grupos.monitoramento.data = monitoramentoRaw.filter(c => !renderedIds.has(c.id));
            grupos.monitoramento.title = (role === 'admin') ? 'Monitoramento Global (ADMIN)' : 'Monitoramento da Unidade';
        }

        // --- 3. RENDERIZAÇÃO ---
        let htmlContent = '';
        let totalCautelas = 0;

        [grupos.custodiaAtiva, grupos.rastreioPessoal, grupos.monitoramento].forEach(group => {
            if (group.data.length > 0) {
                totalCautelas += group.data.length;
                htmlContent += `
                    <tr class="group-header">
                        <td colspan="6" class="group-title-cell">
                            <i class="fas fa-folder-open"></i> <strong>${group.title}</strong> (${group.data.length})
                        </td>
                    </tr>
                `;
                group.data.forEach(cautela => {
                    htmlContent += renderCautelaRow(cautela);
                });
            }
        });

        tbody.innerHTML = totalCautelas === 0
            ? `<tr><td colspan="6" style="text-align:center; padding:60px; color:#64748b;">Nenhuma cautela ativa.</td></tr>`
            : htmlContent;

        loading.style.display = 'none';
        table.style.display = 'table';

    } catch (e) {
        console.error("Erro ao carregar cautelas:", e);
        loading.style.display = 'none';
    }
}

//=== Identifica cautelas com avarias relatadas e cria o card de alerta no Dashboard ===/
async function loadCautelaPendencies() {
    const container = document.getElementById('admin-gestor-cards-container');
    if (!container || !currentUserData) return;

    try {
        console.log("🚀 [Gestão] Buscando pendências de cautela via unidade_id...");

        const isAdmin = currentUserData.role === 'admin' || currentUserData.role === 'gestor_geral';
        const gestorUnidadeId = currentUserData.unidade_id;

        // 1. Iniciamos a query básica
        let query = db.collection('cautelas_abertas')
            .where('status', 'in', ['ABERTA', 'RECEBIDA', 'DEVOLUÇÃO']);

        // 2. 🔥 A MUDANÇA: Se não for admin, filtra direto pela Unidade Origem no Firebase
        if (!isAdmin) {
            if (!gestorUnidadeId) {
                console.warn("⚠️ Gestor sem unidade_id definido. Abortando busca.");
                return;
            }
            query = query.where('unidade_origem', '==', gestorUnidadeId);
        }

        const snap = await query.get();
        let totalPendenciasTroca = 0;
        let cautelasComPendencia = [];

        snap.forEach(doc => {
            const data = doc.data();

            // Verificação extra de segurança: só processa se houver pendências ativas
            if (data.pendencias_ativas && data.pendencias_ativas.length > 0) {

                // --- RASTREABILIDADE DE MILITAR ---
                const pendenciasComRastreabilidade = data.pendencias_ativas.map(p => {
                    const nomeReal = data.destinatario_original_nome || p.solicitante_nome || "Militar";
                    const uidReal = data.destinatario_uid || p.solicitante_uid || "";

                    return {
                        ...p,
                        gestor_alvo_nome: nomeReal,
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
                }
            }
        });

        // ATUALIZA O CACHE GLOBAL PARA O MODAL DE GESTÃO
        cachePendenciasCautela = cautelasComPendencia;

        const cardExistente = document.getElementById('card-pendencia-cautela-ativa');

        // Se resolveu tudo, remove o card de alerta
        if (totalPendenciasTroca === 0) {
            if (cardExistente) cardExistente.remove();
            return;
        }

        // 3. MONTAGEM DO CARD VISUAL (Dashboard do Gestor)
        let cardHtml = `
            <div id="card-pendencia-cautela-ativa" class="sector-card status-alert" 
                 style="border-left: 5px solid #f57c00; background-color: #fff3e0; margin-bottom: 20px; flex: 1 1 100%; cursor: pointer; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"
                 onclick="abrirGestaoPendenciasCautela()">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 style="color: #e65100; margin: 0; font-size: 1.1em;">
                            <i class="fas fa-exclamation-circle"></i> Pendências em TRUGs
                        </h3>
                        <p style="margin: 5px 0 0 0; font-size: 0.85em; color: #666;">
                            Itens em posse pessoal aguardando substituição/sanções.
                        </p>
                    </div>
                    <div class="count-value" style="color: #e65100; font-size: 2em; font-weight: bold;">${totalPendenciasTroca}</div>
                </div>
                <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(230, 81, 0, 0.2); color: #e65100; font-size: 0.8em; font-weight: bold; text-transform: uppercase; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-gavel"></i> Clique para gerenciar
                </div>
            </div>
        `;

        if (cardExistente) {
            cardExistente.outerHTML = cardHtml;
        } else {
            container.insertAdjacentHTML('afterbegin', cardHtml);
        }

    } catch (e) {
        console.error("❌ Erro ao carregar pendências de cautela:", e);
    }
}

/*--- RESPONSÁVEL POR CONTAR CAUTELAS ATIVAS (ABERTAS + RECEBIDAS + DEVOLUÇÕES) ---*/
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

//======================================//
//--- BLOCO: A RECEBER E TRANSIÇÕES ---//
//=====================================//

//=== Lista TRUGs emitidos para o usuário que aguardam o aceite (conferência) ===//
async function loadCautionsToReceive() {
    const tbody = document.getElementById('cautelas-receive-body');
    const loading = document.getElementById('loading-receive');
    const table = document.getElementById('cautelas-receive-table');

    tbody.innerHTML = '';
    loading.style.display = 'block';
    table.style.display = 'none';

    try {
        const militarUid = firebase.auth().currentUser.uid;
        const role = currentUserData.role || 'operacional';
        const user = currentUserData;
        const statusesToReceive = ['ABERTA', 'DEVOLUÇÃO'];

        // 1. Busca as cautelas nominais (onde o UID dele é o destinatário)
        const personalCautions = await queryCautelas(
            statusesToReceive,
            role,
            user,
            'destinatario',
            'personal'
        );

        // 2. Busca se ele é dono provisório de algum local para identificar Cargas/Devoluções
        const snapCustodia = await db.collection('custodia_atual')
            .where('conferente_uid', '==', militarUid).get();
        
        const meusLocaisIds = [];
        snapCustodia.forEach(doc => meusLocaisIds.push(doc.id));

        // 3. Unifica e identifica a natureza (Contexto)
        const mapFinal = new Map();

        // Processa as Pessoais primeiro
        personalCautions.forEach(c => {
            mapFinal.set(c.id, { ...c, contexto: 'PESSOAL' });
        });

        // Se tiver locais, busca cautelas enviadas para esses locais (Carga Vtr)
        if (meusLocaisIds.length > 0) {
            const snapLocais = await db.collection('cautelas_abertas')
                .where('local_origem_id', 'in', meusLocaisIds)
                .where('status', 'in', statusesToReceive).get();

            snapLocais.forEach(doc => {
                const data = doc.data();
                const id = doc.id;
                // Se já existir no map como pessoal, o "PESSOAL" tem prioridade visual
                if (!mapFinal.has(id)) {
                    mapFinal.set(id, { id, ...data, contexto: 'DEVOLUÇÃO' });
                }
            });
        }

        const combinedResults = Array.from(mapFinal.values()).sort((a, b) => 
            (b.timestamp_emissao?.toMillis() || 0) - (a.timestamp_emissao?.toMillis() || 0)
        );

        // --- RENDERIZAÇÃO ---

        if (combinedResults.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding:60px; color:#64748b;">
                        <i class="fas fa-file-import fa-3x" style="opacity:0.2; margin-bottom:15px; display:block;"></i>
                        <span style="font-weight:600; font-size:0.95em;">Nenhuma cautela pendente de recebimento.</span>
                    </td>
                </tr>`;
        } else {
            let htmlContent = '';
            combinedResults.forEach(cautela => {
                // ✅ Agora passamos o contexto identificado para a função de linha
                htmlContent += renderCautelaRow(cautela);
            });
            tbody.innerHTML = htmlContent;
        }

        loading.style.display = 'none';
        table.style.display = 'table';

    } catch (e) {
        console.error("Erro ao carregar cautelas a receber:", e);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red; padding:20px;">Erro ao carregar dados: ${e.message}</td></tr>`;
        loading.style.display = 'none';
        table.style.display = 'table';
    }
}

//=== RESPONSÁVEL POR CONTAR CAUTELAS A RECEBER (ABERTAS + DEVOLUÇÕES) ===//
async function getCautelasAReceberCount() {
    if (!currentUserData) return 0;
    const militarUid = firebase.auth().currentUser.uid;

    try {
        // 1. Busca cautelas onde o militar é o DESTINATÁRIO NOMINAL (Novas ou Devoluções)
        const snapPessoais = await db.collection('cautelas_abertas')
            .where('destinatario_uid', '==', militarUid)
            .where('status', 'in', ['ABERTA', 'DEVOLUÇÃO'])
            .get();

        const totalIds = new Set();
        snapPessoais.forEach(doc => totalIds.add(doc.id));

        // 2. Busca se o militar possui CUSTÓDIA ATUAL de algum local (Vtr/Setor)
        // Isso cobre o caso dele ser o "Recebedor Atual" do local de destino do TRUG
        const snapCustodia = await db.collection('custodia_atual')
            .where('conferente_uid', '==', militarUid)
            .get();

        if (!snapCustodia.empty) {
            const locaisSobMinhaResponsabilidade = [];
            snapCustodia.forEach(doc => locaisSobMinhaResponsabilidade.push(doc.id));

            // Busca TRUGs enviadas para os locais que este militar está operando agora
            const snapLocais = await db.collection('cautelas_abertas')
                .where('local_origem_id', 'in', locaisSobMinhaResponsabilidade)
                .where('status', 'in', ['ABERTA', 'DEVOLUÇÃO'])
                .get();

            snapLocais.forEach(doc => totalIds.add(doc.id));
        }

        return totalIds.size;
    } catch (e) {
        console.error("Erro ao contar cautelas a receber:", e);
        return 0;
    }
}

//=== Prepara a URL e abre o App de Conferência no modo de Aceite ===//
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

//=== Inicia o fluxo de retorno do material, movendo o status para "DEVOLUÇÃO" ===//
async function iniciarDevolucaoCautela(cautelaId, ultimoConferenteNome) {
    const btnDevolver = document.getElementById('btn-devolver-cautela');

    // 1. CONFIRMAÇÃO PREMIUM COM SWEETALERT2
    const { isConfirmed } = await Swal.fire({
        title: 'Confirmar Devolução?',
        html: `O material será enviado para conferência de retorno de:<br><b>${ultimoConferenteNome}</b>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#1b8a3e',
        cancelButtonColor: '#800020',
        confirmButtonText: 'Sim, enviar para devolução',
        cancelButtonText: 'Cancelar'
    });

    if (!isConfirmed) return;

    // Feedback visual imediato
    if (btnDevolver) btnDevolver.disabled = true;
    Swal.fire({ title: 'Processando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

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
            if (!cautelaDoc.exists) throw new Error("Documento de cautela não localizado.");

            const data = cautelaDoc.data();

            // --- 🛑 TRAVA DE SEGURANÇA: ITENS EM ANÁLISE ---
            const pendencias = data.pendencias_ativas || [];
            if (pendencias.length > 0) {
                const listaItens = pendencias.map(p => p.itemNome).join(', ');
                throw new Error(`BLOQUEIO: Existem itens em análise pelo Gestor: (${listaItens}). Responda ou aguarde a solução do gestor antes de devolver.`);
            }

            if (data.status !== 'RECEBIDA') {
                throw new Error("Esta cautela não possui o status 'RECEBIDA'. Verifique sua posse.");
            }

            // --- 📝 PREPARAÇÃO DO LOG ---
            const novoLog = {
                data: new Date().toLocaleString('pt-BR'),
                descricao: `Devolução iniciada: Material enviado por ${militarCompleto} para conferência de retorno de ${ultimoConferenteNome}.`,
                militar: militarCompleto,
                tipo: "TRANSICAO_DEVOLUCAO"
            };

            transaction.update(cautelaRef, {
                status: 'DEVOLUÇÃO',
                timestamp_devolucao_iniciada: firebase.firestore.FieldValue.serverTimestamp(),
                reversor_uid: firebase.auth().currentUser.uid,
                militar_completo_reversor: militarCompleto,
                destinatario_uid: ucUid,
                destinatario: ultimoConferenteNome,
                historico_movimentacoes: firebase.firestore.FieldValue.arrayUnion(novoLog)
            });
        });

        // ✅ SUCESSO
        await Swal.fire({
            icon: 'success',
            title: 'Enviado com Sucesso',
            text: `A carga agora aguarda a conferência de ${ultimoConferenteNome}.`,
            confirmButtonColor: '#1b8a3e'
        });

        // Fecha modais estáticos se houver
        const modal = document.getElementById('cautelaDetailsModal');
        if (modal) modal.style.display = 'none';

        // Atualização de Interface
        if (typeof loadActiveCautelas === 'function') loadActiveCautelas();

        // Substituída a função obsoleta pela nova renderização
        if (typeof renderOperacionalCards === 'function') {
            renderOperacionalCards();
        }

    } catch (error) {
        console.error("Erro ao iniciar devolução:", error);
        Swal.fire({
            icon: 'error',
            title: 'Falha na Devolução',
            text: error.message,
            confirmButtonColor: '#800020'
        });
        if (btnDevolver) btnDevolver.disabled = false;
    }
}

//=== Abre o App de Conferência para o dono do material conferir o que está voltando ===//
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

//=============================================================//
//--- BLOCO: GESTÃO DE AVARIAS E SUBSTITUIÇÃO (Pós-Cautela) ---//
//=============================================================//

//=== Abre o modal com todos os dados de um TRUG e libera botões conforme o status ===//
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

        // ✅ MELHORIA: Identifica o destinatário atual usando os campos da sua coleção
        if (currentStatus === 'RECEBIDA' && cautela.local_origem_id) {
            const custodyDoc = await db.collection('custodia_atual').doc(cautela.local_origem_id).get();
            if (custodyDoc.exists) {
                donoProvisorioNome = custodyDoc.data().conferente_completo || "Dono não identificado";
            } else {
                // Fallback para o nome que consta no TRUG se a custódia_atual não estiver disponível
                donoProvisorioNome = cautela.destinatario || "Militar Identificado";
            }

            if (meuUid !== cautela.destinatario_uid) {
                destaqueRecebedor = `<span style="background-color: #fff5f5; color: #800020; padding: 4px 10px; border-radius: 6px; border: 1.5px solid #800020; font-weight: bold; display: inline-flex; align-items: center; gap: 8px;">
                                                <i class="fas fa-hand-holding"></i> ${donoProvisorioNome}
                                             </span>`;
            }
        }

        const getUpdatedName = async (uid, fallbackName) => {
            if (uid) {
                // Tenta buscar no banco de usuários, mas prioriza o fallback (seu dado gravado) se falhar
                try {
                    const userData = await getUserInfoByUid(uid);
                    return userData ? userData.nome_militar_completo : fallbackName || 'N/D';
                } catch (e) {
                    return fallbackName || 'N/D';
                }
            }
            return fallbackName || 'N/D';
        };

        // ✅ SINCRONISMO COM SUA COLEÇÃO: Alimenta os campos com os dados do TRUG
        document.getElementById('modal-emitente').textContent = await getUpdatedName(cautela.emitente_uid, cautela.emitente);
        document.getElementById('modal-destinatario-original').textContent = await getUpdatedName(cautela.destinatario_uid, cautela.destinatario);
        document.getElementById('modal-destinatario-atual').innerHTML = destaqueRecebedor || (currentStatus === 'ABERTA' ? cautela.destinatario : donoProvisorioNome);
        
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
        // ✅ ATUALIZAÇÃO: Verifica o destinatário atual ou original para permitir o aceite (Receber)
        if (currentStatus === 'ABERTA' && (cautela.destinatario_uid === meuUid)) {
            if (btnReceber) { 
                btnReceber.style.display = 'block'; 
                btnReceber.onclick = () => iniciarRecebimentoCautela(cautelaId); 
            }
        }
        else if (currentStatus === 'RECEBIDA' && (cautela.destinatario_uid === meuUid)) {
            if (btnDevolver) {
                btnDevolver.style.display = 'block';
                if (temPendencia) {
                    btnDevolver.disabled = true;
                    btnDevolver.style.opacity = "0.5";
                    btnDevolver.style.cursor = "not-allowed";
                    btnDevolver.innerHTML = `<i class="fas fa-lock"></i> Devolução Bloqueada`;
                } else {
                    btnDevolver.disabled = false;
                    btnDevolver.style.opacity = "1";
                    btnDevolver.innerHTML = `<i class="fas fa-undo"></i> Iniciar Devolução`;
                    btnDevolver.onclick = () => iniciarDevolucaoCautela(cautelaId, donoProvisorioNome);
                }
            }
            if (btnSubstituir) { btnSubstituir.style.display = 'block'; }
        }
        else if (currentStatus === 'DEVOLUÇÃO' && cautela.destinatario_uid === meuUid) {
            if (btnConfirmarDevolucao) { 
                btnConfirmarDevolucao.style.display = 'block'; 
                btnConfirmarDevolucao.onclick = () => iniciarConferenciaDevolucao(cautelaId, currentUserData.nome_militar_completo); 
            }
        }

    } catch (e) {
        console.error("Erro no modal:", e);
    }
}

//=== Prepara a lista de itens da cautela para que o militar reporte danos ===//
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

//=== Grava as pendências (avarias) relatadas pelo militar no documento da Cautela ===//
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

//=== Abre a tabela técnica para o Gestor decidir o que fazer com os itens avariados ===//
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

//=== Modal de escolha: O Gestor decide entre Recolher o item ou Substituí-lo ===//
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

//=== Remove o item da carga do militar e devolve ao estoque como pendência técnica ===//
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

//=== Busca em todas as viaturas da unidade um item igual e livre para substituir o quebrado ===//
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

//=== Quando um militar reporta que um item cautelado estragou, o Gestor aciona esta função para encontrar um substituto imediato. ===//
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

//=== Realiza a troca: dá baixa no item ruim, entrega o novo e atualiza os históricos ===//
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

//======================================//
//--- BLOCO: HISTÓRICO (Finalizadas) ---//
//=====================================//

//=== Carrega a visão de histórico para Gestores (Tabela única da unidade) ===//
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

//=== Controla as abas de histórico operacional (Minhas, Devoluções, Emitidas) ===//
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

//=== Função de renderização para as tabelas de cautelas já concluídas ===//
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

//=== Carrega as cautelas concluídas onde o militar logado é o destinatário original ===//
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

//=== Carrega as cautelas concluídas onde o militar logado é o receptor final (devoluções) ===//
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

//=== Carrega as cautelas concluídas onde o militar logado é o emitente (cautelas emitidas) ===//
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

//=========================================//
//--- BLOCO: AUXILIARES E LÓGICA DE UI ---//
//========================================//

//=== Motor central de buscas: aplica filtros de UID, Unidade e Status de forma unificada ===//
async function queryCautelas(statusArray, role, user, field = null, type = 'personal') {
    let query = db.collection('cautelas_abertas');

    // 1. Filtro de Status (Sempre aplicado para simplificar a query)
    if (statusArray.length > 0) {
        query = query.where('status', 'in', statusArray);
    } else {
        return [];
    }

    const militarUid = firebase.auth().currentUser.uid;
    const militarCompleto = user.nome_militar_completo;

    // --- 🔐 BLOCO CORRIGIDO: VISÃO DO GESTOR POR UNIDADE ---
    if (role === 'gestor' && type === 'unit') {
        const gestorUnidadeId = user.unidade_id; // Pega o ID da unidade do gestor logado

        if (!gestorUnidadeId) {
            console.warn("Gestor sem unidade_id definido.");
            return [];
        }

        // Em vez de buscar IDs de listas, filtramos direto pela unidade vinculada à cautela
        query = query.where('unidade_origem', '==', gestorUnidadeId);

    }
    // --- 👤 VISÃO PESSOAL (OPERACIONAL OU GESTOR VENDO SUAS COISAS) ---
    else if (type === 'personal') {
        if (field === 'destinatario') {
            // Mantém a consulta dupla (SnapOriginal + SnapAtual) para transições
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
        } else if (field === 'militar_completo_reversor') {
            query = query.where('militar_completo_reversor', '==', militarCompleto);
        }
        // ... outros filtros de campo se necessário
    }

    // Execução da Query Final
    try {
        const snapshot = await query.orderBy('timestamp_emissao', 'desc').get();
        let cautelas = [];
        snapshot.forEach(doc => {
            cautelas.push({ id: doc.id, ...doc.data() });
        });
        return cautelas;
    } catch (error) {
        console.error("Erro na consulta de cautelas:", error);
        throw error;
    }
}

//=== Gera o código HTML das linhas das tabelas (com cores por status) ===//
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

    // ✅ LÓGICA DE CONTEXTO (Badge da 1ª Coluna)
    // Se o objeto cautela trouxer o campo 'contexto' definido na busca, usamos ele.
    const contexto = cautela.contexto || (status === 'RECEBIDA' ? 'PESSOAL' : 'CARGA');
    let contextoHtml = '';

    if (contexto === 'PESSOAL') {
        contextoHtml = `<span style="background: #800020; color: white; padding: 3px 8px; border-radius: 6px; font-size: 9px; font-weight: 800; letter-spacing: 0.5px;"><i class="fas fa-user"></i> PESSOAL</span>`;
    } else {
        contextoHtml = `<span style="background: #8e44ad; color: white; padding: 3px 8px; border-radius: 6px; font-size: 9px; font-weight: 800; letter-spacing: 0.5px;"><i class="fas fa-truck-loading"></i> DEVOLUÇÃO</span>`;
    }

    // ✅ LÓGICA DE INVERSÃO DINÂMICA: 
    const modoRecebimento = (status === 'ABERTA' || status === 'DEVOLUÇÃO');
    const nomeMilitarExibicao = modoRecebimento 
        ? (cautela.emitente || "Não identificado") 
        : (cautela.destinatario || cautela.destinatario_original_nome || 'Aguardando...');
    
    const labelColuna = modoRecebimento ? "Emitente" : "Destinatário";

    if (status === 'RECEBIDA') { badgeClass = 'badge-solucao'; badgeText = 'RECEBIDA'; }
    else if (status === 'ABERTA') { badgeClass = 'badge-cautela'; badgeText = 'ABERTA'; }
    else if (status === 'DEVOLUÇÃO') { badgeClass = 'badge-pendente'; badgeText = 'EM DEVOLUÇÃO'; }
    else if (status === 'CONCLUÍDA') { badgeClass = 'badge-concluida'; badgeText = 'CONCLUÍDA'; }

    return `
        <tr onclick="${clickAction}" style="${temPendencia ? 'background-color: #fff9f0;' : ''}">
            <td style="width: 100px; text-align: center;">${contextoHtml}</td>
            <td data-label="ID"><strong>${cautela.cautela_id}</strong></td>
            <td data-label="${labelColuna}">${nomeMilitarExibicao}</td>
            <td data-label="Emissão">${dataEmissao}</td>
            <td data-label="Origem">${cautela.local_origem}</td>
            <td data-label="Itens">${alertaCaa}${itensCount} itens</td>
            <td data-label="Status"><span class="status-badge ${badgeClass}">${badgeText}</span></td>
        </tr>
    `;
}

//=== Consulta a custódia atual do militar para nova cautela ===//
async function loadCustodiaLocais() {
    const selectLocal = document.getElementById('cautela-local-origem');
    const militarUid = firebase.auth().currentUser.uid;
    const unidadeIdGestor = currentUserData.unidade_id;
    const unidadeSigla = currentUserData.unidade_sigla || "UNIDADE";
    const role = currentUserData.role;

    if (!selectLocal || !militarUid) {
        selectLocal.innerHTML = `<option value="" disabled selected>Erro: Usuário não identificado.</option>`;
        return;
    }

    selectLocal.disabled = true;
    selectLocal.innerHTML = '<option value="" disabled selected>Carregando origens...</option>';

    try {
        const locaisMap = new Map();
        const isGestorOuAdmin = (role === 'gestor' || role === 'admin' || role === 'gestor_geral');

        // --- 1. LÓGICA DE GESTOR: INJETAR ALMOXARIFADO ---
        if (isGestorOuAdmin) {
            // Injeta a opção do Estoque Físico (Prateleira)
            // Usamos um ID especial que a função loadCustodiaItens saberá interpretar
            locaisMap.set("ESTOQUE_GERAL", `📦 ALMOXARIFADO CENTRAL - ${unidadeSigla}`);

            // Busca TODAS as listas da unidade para o Gestor
            if (unidadeIdGestor) {
                const snapListas = await db.collection('listas_conferencia')
                    .where('unidade_id', '==', unidadeIdGestor)
                    .where('ativo', '==', true)
                    .get();

                snapListas.forEach(doc => {
                    const d = doc.data();
                    const nomeExibicao = d.posto_nome ? `${d.posto_nome} - ${d.local || d.ativo_nome || doc.id}` : (d.local || d.ativo_nome || doc.id);
                    locaisMap.set(doc.id, `🚒 ${nomeExibicao}`);
                });
            }
        } else {
            // --- 2. LÓGICA OPERACIONAL: BUSCAR CUSTÓDIA ATUAL ---
            const custodyRef = db.collection('custodia_atual');
            const resultsSnapshot = await custodyRef
                .where('conferente_uid', '==', militarUid)
                .get();

            resultsSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.lista_id && data.local_nome) {
                    locaisMap.set(data.lista_id, `🚒 ${data.local_nome}`);
                }
            });
        }

        let optionsHtml = '<option value="" disabled selected>De onde sairá o material?</option>';

        if (locaisMap.size === 0) {
            optionsHtml = '<option value="" disabled selected>Nenhum local disponível.</option>';
        } else {
            // Ordenação: Garante que o ALMOXARIFADO sempre fique no topo se existir
            const listaOrdenada = Array.from(locaisMap.entries()).sort((a, b) => {
                if (a[0] === "ESTOQUE_GERAL") return -1;
                if (b[0] === "ESTOQUE_GERAL") return 1;
                return a[1].localeCompare(b[1]);
            });

            listaOrdenada.forEach(([id, nome]) => {
                optionsHtml += `<option value="${id}">${nome.toUpperCase()}</option>`;
            });
        }

        selectLocal.innerHTML = optionsHtml;
        selectLocal.disabled = false;

    } catch (error) {
        console.error("🚨 Erro ao carregar locais para TRUG:", error);
        selectLocal.disabled = false;
        selectLocal.innerHTML = '<option value="" disabled selected>Erro ao carregar locais.</option>';
    }
}

//=== Lê a lista mestra para verificar o que "existe" fisicamente para ser cautelado, com base na custódia do militar logado (conferente) ====//
async function loadCustodiaItens() {
    const selectLocal = document.getElementById('cautela-local-origem');
    const listaId = selectLocal.value;
    const itemListContainer = document.getElementById('itens-custodia-list');
    const btnIniciar = document.getElementById('btn-iniciar-cautela');
    const selectionHub = document.getElementById('selection-hub');
    const unidadeIdGestor = currentUserData.unidade_id;

    itemListContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #800020;"><i class="fas fa-circle-notch fa-spin fa-2x"></i><br><span style="font-size:0.8em; font-weight:700; margin-top:10px; display:block; letter-spacing:1px;">MAPEANDO PATRIMÔNIO...</span></div>';
    
    if (btnIniciar) btnIniciar.disabled = true;

    try {
        let htmlContent = '';
        let totalGeralDisponivel = 0;

        // --- MODO A: ALMOXARIFADO CENTRAL ---
        if (listaId === "ESTOQUE_GERAL") {
            const snapInventario = await db.collection('inventario')
                .where('unidade_origem_id', '==', unidadeIdGestor)
                .get();

            let itensDisponiveis = [];
            snapInventario.forEach(doc => {
                const item = doc.data();
                const cache = item.unidades_cache ? item.unidades_cache[unidadeIdGestor] : null;
                const saldoDisp = cache ? (Number(cache.disp) || 0) : 0;
                if (saldoDisp > 0) itensDisponiveis.push({ ...item, saldoReal: saldoDisp });
            });

            if (itensDisponiveis.length > 0) {
                totalGeralDisponivel = itensDisponiveis.length;
                htmlContent = `<div class="sigma-v3-inventory-group" style="margin-bottom: 20px;">
                    <div class="accordion-header active" style="background: #1b8a3e; color: white; padding: 12px 18px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 800; font-size: 0.85em; text-transform: uppercase;"><i class="fas fa-warehouse"></i> DISPONÍVEL NO ALMOXARIFADO</span>
                    </div>
                    <div class="accordion-content" style="max-height: none; padding: 15px 5px; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">`;

                for (const item of itensDisponiveis) {
                    if (item.tipo === 'single') {
                        htmlContent += `
                            <div class="item-selection-card" data-item-id="${item.uid_global}" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; display: flex; flex-direction: column;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                    <h4 style="margin: 0; font-size: 0.85em; color: #1e293b; font-weight: 800;">${item.nome}</h4>
                                    <span style="background: #1b8a3e; color: white; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 6px;">DISP: ${item.saldoReal}</span>
                                </div>
                                <div style="margin-top: 15px; display: flex; align-items: center; justify-content: space-between; background: #f8fafc; padding: 8px; border-radius: 8px;">
                                    <label style="font-size: 11px; font-weight: 800; color: #64748b; cursor: pointer;"><input type="checkbox" name="cautela-item-base" data-id="${item.uid_global}" data-nome="${item.nome}" data-tipo="single" data-max-qtd="${item.saldoReal}" data-setor="ALMOXARIFADO" onchange="toggleItemQuantity(this); updateCautelaItemCount();" style="width: 16px; height: 16px; accent-color: #800020;"> SELECIONAR </label>
                                    <input type="number" class="input-qtd-cautela" min="1" max="${item.saldoReal}" value="1" disabled style="width: 45px; border: 1px solid #e2e8f0; border-radius: 6px; text-align: center; font-weight: 800;">
                                </div>
                            </div>`;
                    } else {
                        const snapTomb = await db.collection('inventario').doc(item.uid_global).collection('tombamentos')
                            .where('unidade_id', '==', unidadeIdGestor).where('situacao_atual', '==', 'DISPONÍVEL').where('local_id', '==', 'ALMOXARIFADO').get();
                        let pills = '';
                        snapTomb.forEach(tDoc => {
                            const t = tDoc.data();
                            pills += `<label class="tomb-pill" style="cursor: pointer; display: flex; align-items: center; gap: 6px; background: white; border: 1px solid #e2e8f0; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700;"><input type="checkbox" name="cautela-item-multi" data-id="${item.uid_global}-${t.tomb}" data-id-base="${item.uid_global}" data-tombamento="${t.tomb}" data-nome="${item.nome}" data-tipo="multi" data-setor="ALMOXARIFADO" onchange="updateCautelaItemCount();"> ${t.tomb}</label>`;
                        });
                        if (pills) {
                            htmlContent += `<div class="item-selection-card" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; border-left: 4px solid #1b8a3e;">
                                <h4 style="margin: 0 0 12px 0; font-size: 0.85em; color: #1e293b; font-weight: 800;">${item.nome}</h4>
                                <div style="display: flex; flex-wrap: wrap; gap: 8px;">${pills}</div>
                            </div>`;
                        }
                    }
                }
                htmlContent += `</div></div>`;
            }

        } else {
            // --- MODO B: VIATURA / SETOR ---
            const listaDoc = await db.collection('listas_conferencia').doc(listaId).get();
            if (!listaDoc.exists) return;

            const listaMestra = listaDoc.data().list || [];
            listaMestra.forEach(setor => {
                const setorItems = (setor.itens || []);
                const setorTotal = setorItems.reduce((acc, item) => {
                    if (item.tipo === 'single') {
                        const saldo = (item.quantidadeEsperada || item.quantidade) - ((item.cautelas || []).reduce((s, c) => s + (c.quantidade || 0), 0)) - ((item.pendencias_ids || []).reduce((s, p) => s + (p.quantidade || 0), 0));
                        return acc + (saldo > 0 ? saldo : 0);
                    }
                    return acc + (item.tombamentos || []).filter(t => !t.cautela && (!t.pendencias_ids || t.pendencias_ids.length === 0)).length;
                }, 0);

                if (setorTotal <= 0) return;
                totalGeralDisponivel += setorTotal;

                const contentId = `content-${setor.id}`;
                htmlContent += `
                    <div class="sigma-v3-inventory-group" style="margin-bottom: 20px;">
                        <div class="accordion-header active" onclick="toggleAccordion(this, '${contentId}')" style="background: #f8fafc; padding: 12px 18px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; border: 1px solid #eef2f6;">
                            <span style="font-weight: 800; color: #475569; font-size: 0.85em; text-transform: uppercase;"><i class="fas fa-folder" style="color: #800020; margin-right: 10px;"></i> ${setor.nome}</span>
                            <span style="font-size: 0.75em; font-weight: 700; color: #94a3b8;">${setorTotal} DISPONÍVEIS</span>
                        </div>
                        <div class="accordion-content" id="${contentId}" style="max-height: 2000px; overflow: hidden; padding: 10px 5px; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">`;

                setorItems.forEach(item => {
                    // ✅ Lógica de Kit: Verifica se existem acessórios vinculados na arquitetura
                    const acessorios = item.acessorios_vinculados || item.acessorios_acoplados || [];
                    const kitText = acessorios.length > 0 ? `<div style="margin-top: 5px; color: #800020; font-size: 10px; font-weight: 700;"><i class="fas fa-link"></i> KIT: ${acessorios.map(a => a.nome).join(', ')}</div>` : "";

                    if (item.tipo === 'single') {
                        const saldoDisp = (item.quantidadeEsperada || item.quantidade) - ((item.cautelas || []).reduce((s, c) => s + (c.quantidade || 0), 0)) - ((item.pendencias_ids || []).reduce((s, p) => s + (p.quantidade || 0), 0));
                        if (saldoDisp > 0) {
                            htmlContent += `
                                <div class="item-selection-card" data-item-id="${item.id}" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; display: flex; flex-direction: column;">
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                        <div>
                                            <h4 style="margin: 0; font-size: 0.85em; color: #1e293b; font-weight: 800;">${item.nome}</h4>
                                            ${kitText}
                                        </div>
                                        <span style="background: #fff1f2; color: #be123c; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 6px;">LIVRE: ${saldoDisp}</span>
                                    </div>
                                    <div style="margin-top: 15px; display: flex; align-items: center; justify-content: space-between; background: #f8fafc; padding: 8px; border-radius: 8px;">
                                        <label style="font-size: 11px; font-weight: 800; color: #64748b; cursor: pointer;"><input type="checkbox" name="cautela-item-base" data-id="${item.id}" data-nome="${item.nome}" data-tipo="single" data-max-qtd="${saldoDisp}" data-setor="${setor.nome}" onchange="toggleItemQuantity(this); updateCautelaItemCount();" style="width: 16px; height: 16px; accent-color: #800020;"> SELECIONAR </label>
                                        <input type="number" class="input-qtd-cautela" data-item-id="${item.id}" min="1" max="${saldoDisp}" value="1" disabled style="width: 45px; border-radius: 6px; text-align: center; font-weight: 800;">
                                    </div>
                                </div>`;
                        }
                    } else if (item.tipo === 'multi' && item.tombamentos?.length > 0) {
                        const tags = (item.tombamentos || []).filter(t => !t.cautela && (!t.pendencias_ids || t.pendencias_ids.length === 0)).map(t => `
                            <label class="tomb-pill" style="cursor: pointer; display: flex; align-items: center; gap: 6px; background: white; border: 1px solid #e2e8f0; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700;"><input type="checkbox" name="cautela-item-multi" data-id="${item.id}-${t.tomb}" data-id-base="${item.id}" data-tombamento="${t.tomb}" data-nome="${item.nome}" data-tipo="multi" data-setor="${setor.nome}" onchange="updateCautelaItemCount();" style="accent-color: #800020;"> ${t.tomb}</label>`).join('');
                        if (tags) {
                            htmlContent += `
                                <div class="item-selection-card" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; border-left: 4px solid #800020;">
                                    <h4 style="margin: 0; font-size: 0.85em; color: #1e293b; font-weight: 800;">${item.nome}</h4>
                                    ${kitText}
                                    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px;">${tags}</div>
                                </div>`;
                        }
                    }
                });
                htmlContent += '</div></div></div>';
            });
        }

        itemListContainer.innerHTML = htmlContent || '<div style="text-align:center; padding:40px; color:#94a3b8;">Nenhum item disponível para TRUG.</div>';
        if (selectionHub) selectionHub.style.display = 'block';
        updateCautelaItemCount();

    } catch (e) {
        console.error("Erro ao carregar itens para TRUG:", e);
        itemListContainer.innerHTML = '<p style="color:red; text-align:center;">Erro ao carregar o inventário.</p>';
    }
}

//=== Gerencia a animação de abrir/fechar dos setores no formulário ===//
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

//=== Monitora a seleção de checkboxes e atualiza o botão de envio ===//
function updateCautelaItemCount() {
    let selectedCount = 0;
    // REINICIALIZA O ARRAY GLOBAL
    cautelaItensSelecionados = [];

    // 1. Processar itens com Tombamento (tipo 'multi')
    document.querySelectorAll('input[name="cautela-item-multi"]:checked').forEach(chk => {
        const idBase = chk.getAttribute('data-id-base');
        const tombamento = chk.getAttribute('data-tombamento');
        const nomeCompleto = chk.getAttribute('data-nome') || "";
        const setorOrigem = chk.getAttribute('data-setor') || "N/D"; // ✅ Captura o setor

        // Remove "(Tomb: ...)" do nome se ele já existir
        const nomeLimpo = nomeCompleto.replace(/\s\(Tomb:\s[^\)]+\)/i, '').trim();

        if (idBase && tombamento) {
            cautelaItensSelecionados.push({
                id: `${idBase}-${tombamento}`,
                id_base: idBase,
                nome: nomeLimpo,
                tombamento: tombamento,
                quantidade: 1,
                tipo: 'multi',
                setor_origem: setorOrigem // ✅ Adicionado ao objeto
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
        const setorOrigem = chk.getAttribute('data-setor') || "N/D"; // ✅ Captura o setor

        let qtd = 1;
        if (inputQtd && !inputQtd.disabled) {
            qtd = parseInt(inputQtd.value) || 0;
            const max = parseInt(chk.getAttribute('data-max-qtd')) || 0; // ✅ Correção: pega do chk

            if (qtd > max) {
                Swal.fire({ icon: 'warning', title: 'Limite Excedido', text: `A quantidade máxima disponível para ${nome} neste setor é ${max}.`, timer: 2000 });
                inputQtd.value = max;
                qtd = max;
            }

            if (qtd < 1) {
                chk.checked = false;
                inputQtd.disabled = true;
                inputQtd.value = 1;
                return;
            }
        }

        if (id) {
            cautelaItensSelecionados.push({
                id: id,
                id_base: id,
                nome: nome,
                quantidade: qtd,
                tipo: 'single',
                setor_origem: setorOrigem // ✅ Adicionado ao objeto
            });
            selectedCount += qtd;
        }
    });

    // 3. Atualizar Interface do Botão e o Badge do Hub
    const btnIniciar = document.getElementById('btn-iniciar-cautela');
    const badgeContador = document.getElementById('selected-counter-badge');

    if (badgeContador) {
        badgeContador.textContent = `${selectedCount} item${selectedCount !== 1 ? 's' : ''}`;
        badgeContador.style.background = selectedCount > 0 ? "#1b8a3e" : "#800020";
    }

    if (btnIniciar) {
        btnIniciar.innerHTML = `<i class="fas fa-paper-plane"></i> EMITIR TRUG (${selectedCount} ITENS)`;
        btnIniciar.disabled = (selectedCount <= 0);
        btnIniciar.style.background = selectedCount > 0 ? "#800020" : "#ccc";
    }
}

//=== Habilita ou desabilita campos numéricos ao marcar um item ===//
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

// === Mostra campo de texto apenas para itens marcados no reporte de avarias ===//
function toggleObsInput(index) {
    const div = document.getElementById(`div-obs-${index}`);
    const isChecked = document.querySelector(`.check-item-reporte[data-index="${index}"]`).checked;
    div.style.display = isChecked ? 'block' : 'none';
}
