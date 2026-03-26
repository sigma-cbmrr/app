/* --- central de comando do item; exibe todas as pendências ativas de um material e oferece as opções de manter, resolver ou relatar um novo problema --- */
async function abrirModalPendenciaV3(uid, tipo, nomeItem, saldoDisponivel, uidPai = null) {
    const isChecklist = window.isModoChecklist;
    const corPrimaria = isChecklist ? "#2c3e50" : "#800020";
    const nomeLimpo = nomeItem.replace(/\\'/g, "'");

    const fonteDados = window.dadosConferencia || [];
    let pendencias = [];
    let acessoriosDoKit = [];

    // ✅ 1. LOCALIZAÇÃO E COLETA HIERÁRQUICA (DNA V3)
    let todasAsPendenciasBrutas = [];

    fonteDados.forEach(setor => {
        setor.itens.forEach(it => {
            const idMestre = String(it.uid_instancia || it.uid_global || it.id || "");
            const isMatch = (idMestre === String(uid));

            if (isMatch) {
                // Coleta do PAI
                if (it.pendencias_ids) todasAsPendenciasBrutas.push(...it.pendencias_ids);

                // Coleta dos FILHOS (Acessórios)
                const filhos = it.acessorios_vinculados || it.acessorios_acoplados || [];
                filhos.forEach(ac => {
                    if (ac.pendencias_ids) todasAsPendenciasBrutas.push(...ac.pendencias_ids);
                });

                acessoriosDoKit = filhos;
            }

            // Tratamento para Tombamentos
            if (it.tombamentos) {
                it.tombamentos.forEach(t => {
                    const uidComp = `${it.uid_global || it.id}-${t.tomb}`;
                    if (uidComp === uid) {
                        if (t.pendencias_ids) todasAsPendenciasBrutas.push(...t.pendencias_ids);
                        const filhosT = t.acessorios_vinculados || it.acessorios_vinculados || [];
                        filhosT.forEach(ac => {
                            if (ac.pendencias_ids) todasAsPendenciasBrutas.push(...ac.pendencias_ids);
                        });
                        acessoriosDoKit = t.acessorios_vinculados || acessoriosDoKit;
                    }
                });
            }
        });
    });

    // 1.2 MERGE DE MEMÓRIA (Relatos da Sessão Atual)
    const statusAnfitriao = window.itemStatus[uid];
    if (statusAnfitriao && statusAnfitriao.pendencias_temporarias) {
        statusAnfitriao.pendencias_temporarias.forEach(pt => {
            if (String(pt.uid_alvo_direto).startsWith(uid)) {
                todasAsPendenciasBrutas.push(pt);
            }
        });
    }

    // ✅ 1.3 FILTRO DE UNICIDADE (Elimina Duplicados pelo ID)
    const mapUnico = new Map();
    todasAsPendenciasBrutas.forEach(p => {
        if (!mapUnico.has(String(p.id))) {
            mapUnico.set(String(p.id), p);
        }
    });

    // Esta é a lista final, limpa e única de avarias/faltas
    pendencias = Array.from(mapUnico.values());

    // ✅ 1.4 NOVA LÓGICA V3: CAPTURA PROFUNDA DE CAUTELAS (SINGLE E MULTI)
    let cautelasDoItem = [];
    const mapCautelasUnicas = new Map();

    fonteDados.forEach(setor => {
        setor.itens.forEach(it => {
            const idMestre = String(it.uid_instancia || it.uid_global || it.id || "");
            
            // Caso A: O Modal foi aberto a partir do card Mestre
            if (idMestre === String(uid)) {
                // Cautelas em item Single
                if (it.cautelas && Array.isArray(it.cautelas)) {
                    it.cautelas.forEach(c => {
                        const key = c.id_cautela || c.id;
                        if (!mapCautelasUnicas.has(key)) {
                            mapCautelasUnicas.set(key, true);
                            cautelasDoItem.push(c);
                        }
                    });
                }
                // Cautelas em item Multi (Varrer todos os tombamentos)
                if (it.tombamentos && Array.isArray(it.tombamentos)) {
                    it.tombamentos.forEach(t => {
                        if (t.cautela) {
                            const cObj = { ...t.cautela, ref_tomb: t.tomb };
                            const key = `${cObj.id_cautela || cObj.id}-${t.tomb}`;
                            if (!mapCautelasUnicas.has(key)) {
                                mapCautelasUnicas.set(key, true);
                                cautelasDoItem.push(cObj);
                            }
                        }
                    });
                }
            } 
            // Caso B: O Modal foi aberto com o UID composto de um tombamento específico
            else if (it.tombamentos && Array.isArray(it.tombamentos)) {
                it.tombamentos.forEach(t => {
                    const uidComp = `${it.uid_global || it.id}-${t.tomb}`;
                    if (uidComp === String(uid) && t.cautela) {
                        const cObj = { ...t.cautela, ref_tomb: t.tomb };
                        const key = `${cObj.id_cautela || cObj.id}-${t.tomb}`;
                        if (!mapCautelasUnicas.has(key)) {
                            mapCautelasUnicas.set(key, true);
                            cautelasDoItem.push(cObj);
                        }
                    }
                });
            }
        });
    });

    // 2. CONSTRUÇÃO DINÂMICA DOS CARDS DE PENDÊNCIA
    let htmlPendencias = "";

    // 🏆 INJETA O CARD DOURADO DE CAUTELA NO TOPO DA LISTA
    cautelasDoItem.forEach(c => {
        const isCiente = window.itemStatus[uid]?.cautela_confirmada;
        
        // Lógica visual: Apagado (Borda Cinza/Texto Cinza) -> Aceso (Fundo Verde/Texto Branco)
        const btnBg = isCiente ? '#10b981' : 'transparent';
        const btnBorder = isCiente ? '2px solid #10b981' : '2px solid #94a3b8';
        const btnColor = isCiente ? 'white' : '#64748b';
        const btnIcon = isCiente ? 'fa-check-double' : 'fa-check';
        const btnText = isCiente ? 'CIENTE' : 'DAR CIENTE';

        // O que mudou:
        // 1. Adicionado gap:10px no flex container pai para o texto não encostar no botão
        // 2. Removida a classe 'v3-action-icon' do botão
        // 3. Adicionado: white-space: nowrap; flex-shrink: 0; display: inline-flex; align-items: center; gap: 5px;
        htmlPendencias += `
            <div class="v3-manage-card" style="background:#fffbeb; border:1px solid #fcd34d; padding:15px; border-radius:12px; margin-bottom:12px; width: 100%; box-sizing: border-box;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 10px;">
                    <div style="min-width: 0;">
                        <small style="color:#d97706; font-weight:900; font-size:0.65em; text-transform:uppercase; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><i class="fas fa-file-contract"></i> MATERIAL CAUTELADO</small>
                        <span style="font-size: 0.85em; font-weight: 900; color: #92400e;">${c.id || c.id_cautela || 'N/D'}</span>
                    </div>
                    <button type="button" id="btn-ciente-${uid}" onclick="registrarCienteCautela('${uid}', event)" style="background:${btnBg}; border:${btnBorder}; color:${btnColor}; padding:6px 12px; border-radius:8px; font-size:0.7em; font-weight: bold; cursor: pointer; transition: all 0.2s; white-space: nowrap; flex-shrink: 0; display: inline-flex; align-items: center; gap: 5px; height: fit-content; line-height: 1;">
                        <i class="fas ${btnIcon}"></i> <span>${btnText}</span>
                    </button>
                </div>
                <div style="font-weight:700; color:#1e293b; font-size:0.9em; margin-top:8px; word-break: break-word;">
                    Destinatário: <span style="color:#800020;">${c.destinatario || 'N/D'}</span>
                </div>
                <div style="font-size:0.7em; color:#64748b; margin-top:4px; font-style:italic;">
                    <i class="fas fa-info-circle"></i> Item sob responsabilidade de terceiros. Quantidade: ${c.quantidade || 1} un.
                </div>
            </div>`;
    });

    pendencias.sort((a, b) => String(b.id).includes('TEMP') ? 1 : -1);

    pendencias.forEach((p, index) => {
        const isTemp = String(p.id).startsWith('TEMP-');
        const isMantido = window.itemStatus[uid]?.ids_mantidos?.includes(String(p.id));
        const isResolvido = p.status_gestao === 'RESOLVIDO';

        const labelAlvo = p.nome_item_alvo ? p.nome_item_alvo : nomeLimpo;

        htmlPendencias += `
            <div class="v3-manage-card" style="background:${isResolvido ? '#f0fdf4' : (isTemp ? '#f0f9ff' : '#fff5f5')}; 
                 border:1px solid ${isResolvido ? '#bbf7d0' : (isTemp ? '#bae6fd' : '#ffcccc')}; 
                 padding:15px; border-radius:12px; margin-bottom:12px; position:relative; width: 100%; box-sizing: border-box;">
                
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                    <div style="display:flex; flex-direction: column; gap:2px;">
                        <small style="color:${isResolvido ? '#166534' : (isTemp ? '#0369a1' : '#64748b')}; font-weight:800; font-size:0.6em; text-transform:uppercase;">
                            ${isResolvido ? '✅ SOLUÇÃO REGISTRADA' : (isTemp ? '✨ NOVO RELATO' : '📜 RELATO ANTERIOR')}
                        </small>
                        <span style="font-size: 0.65em; font-weight: 900; color: ${corPrimaria};">
                            ${p.quantidade} UNIDADE(S) • <span style="color:#e20b0b">${labelAlvo.toUpperCase()}</span>
                        </span>
                    </div>
                    <div style="display:flex; gap:10px;">
                        ${isResolvido ? '' : `
                            ${isTemp ? `
                                <button type="button" onclick="confirmarExclusaoRelato('${p.id}', '${uid}')" class="v3-mini-btn delete" title="Excluir"><i class="fas fa-trash"></i></button>
                                <button type="button" onclick="abrirModalEditar('${p.id}', '${uid}', ${p.quantidade}, '${p.descricao}')" class="v3-mini-btn edit" title="Editar"><i class="fas fa-edit"></i></button>
                            ` : `
                                <button type="button" id="btn-manter-${index}" onclick="manterID('${p.id}', '${uid}', ${index})" class="v3-action-icon ${isMantido ? 'active' : ''}">
                                    <i class="fas ${isMantido ? 'fa-check-double' : 'fa-thumbtack'}"></i>
                                </button>
                                <button type="button" onclick="abrirFormularioResolucaoV3(${JSON.stringify(p).replace(/"/g, '&quot;')}, '${uid}')" class="v3-action-icon resolver">
                                    <i class="fas fa-wrench"></i>
                                </button>
                            `}
                        `}
                    </div>
                </div>

                <div style="font-weight:700; color:#1e293b; font-size:0.95em; line-height:1.4; text-transform: uppercase;">
                    ${p.descricao}
                </div>
                <div style="font-size:0.65em; color:#94a3b8; margin-top:8px; font-weight:600;">
                    ${p.autor_nome} • ${p.data_criacao}
                </div>
            </div>`;
    });

    // ✅ 3. LISTAGEM DE COMPONENTES (RASTREABILIDADE CIRÚRGICA)
    let htmlListaComponentes = "";
    if (acessoriosDoKit.length > 0) {
        htmlListaComponentes = `
            <div style="margin-top: 5px; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 15px;">
                <small style="display:block; font-weight:800; font-size:0.65em; color:#64748b; text-transform:uppercase; margin-bottom:8px; text-align:center;">Componentes Vinculados ao Kit:</small>
                <div style="display:flex; flex-wrap:wrap; gap:6px; justify-content:center;">
                    ${acessoriosDoKit.map((ac) => {
            const uidGlobalReal = ac.uid_global || ac.id;
            return `<button type="button" onclick="exibirModalInsercaoNovoRelato('${uidGlobalReal}', 'single', '${ac.nome.replace(/'/g, "")}', 1, '${corPrimaria}', '${uid}')" 
                                style="font-size:0.55em; background:#fff; padding:4px 8px; border-radius:6px; border:1px solid #cbd5e1; font-weight:800; color:#334155; cursor:pointer; text-transform:uppercase;">
                                <i class="fas fa-exclamation-circle" style="color:#e20b0b"></i> ${ac.nome}
                                </button>`;
        }).join('')}
                </div>
            </div>`;
    }

    return Swal.fire({
        showCloseButton: true,
        allowOutsideClick: true,
        title: `<span style="color:${corPrimaria}; font-weight:700;">GERENCIAR PENDÊNCIAS</span>`,
        width: window.innerWidth > 600 ? '550px' : '95%',
        padding: '1.5em 1em',
        html: `
            <div style="margin-bottom: 10px; text-align: center;">
                <b style="color: #1e293b; text-transform: uppercase; font-size: 0.9em;">${nomeLimpo}</b>
            </div>
            ${htmlListaComponentes}
            <div id="v3-modal-scroll" style="text-align:left; max-height:40vh; overflow-y:auto; padding-right:5px; width: 100%; box-sizing: border-box;">
                ${htmlPendencias || '<p style="text-align:center; color:#94a3b8; padding:30px;">Nenhum relato encontrado.</p>'}
            </div>
            <div style="display: flex; gap: 10px; margin-top: 25px; width: 100%;">
                <button type="button" id="btn-novo-relato-v3" style="flex: 1; background: #0284c7; color: white; border: none; padding: 12px 5px; border-radius: 10px; font-weight: 800; font-size: 0.75rem; cursor: pointer;">
                    <i class="fas fa-plus-circle"></i> NOVO RELATO
                </button>
                <button type="button" onclick="Swal.clickConfirm()" style="flex: 1; background: ${corPrimaria}; color: white; border: none; padding: 12px 5px; border-radius: 10px; font-weight: 800; font-size: 0.75rem; cursor: pointer;">
                    <i class="fas fa-check-double"></i> CONCLUIR
                </button>
            </div>`,
        showConfirmButton: false,
        customClass: { popup: 'v3-padrao-modal' },
        didOpen: () => {
            const btnNovo = document.getElementById('btn-novo-relato-v3');
            if (btnNovo) {
                btnNovo.onclick = () => {
                    exibirModalInsercaoNovoRelato(uid, tipo, nomeLimpo, saldoDisponivel, corPrimaria, uid);
                };
            }
        },
        preConfirm: () => {
            const status = window.itemStatus[uid];
            if (!status || !status.interacao_humana) {
                Swal.showValidationMessage('Interaja com os relatos antes de concluir.');
                return false;
            }
            
            // ✅ Lógica de Conclusão: Define o status final da linha de fundo
            const temAvariaMantida = status.ids_mantidos && status.ids_mantidos.length > 0;
            const temAvariaNova = status.pendencias_temporarias && status.pendencias_temporarias.length > 0;

            if (status.cautela_confirmada && !temAvariaMantida && !temAvariaNova) {
                 // Se tem Cautela Ativa, o usuário deu ciente e NÃO há outras avarias, a linha fica OK
                 window.itemStatus[uid].status = 'ok';
                 const row = document.getElementById(`item-row-${uid}`);
                 if (row) {
                     row.classList.remove('status-alert');
                     row.classList.add('status-ok');
                     row.style.setProperty('background-color', '#f0fdf4', 'important');
                 }
            } else {
                 // Se tem qualquer avaria ativa, a linha continua em Alerta
                 window.itemStatus[uid].status = 'C/A';
                 const row = document.getElementById(`item-row-${uid}`);
                 if (row) {
                     row.classList.add('status-alert');
                     row.classList.remove('status-ok');
                     row.style.setProperty('background-color', '#fff5f5', 'important');
                 }
            }

            if (typeof updateOverallStatus === 'function') updateOverallStatus();
            return { confirmado: true, uidPrincipal: uid };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            setTimeout(() => {
                if (typeof verificarFluxoSetor === 'function') verificarFluxoSetor(result.value.uidPrincipal);
            }, 300);
        }
    });
}

// ✅ FUNÇÃO DE APOIO PARA LANÇAR RELATO NO ALVO SELECIONADO (VERSÃO FINAL)
function prepararNovoRelatoInteligente(uidOriginal, tipo, nomeItem, saldo, cor, uidPai = null, dadosAcessorios = []) {
    const selectTarget = document.getElementById('swal-target-uid');

    // 1. Define quem é o alvo (quem sofre a avaria)
    const targetUid = selectTarget ? selectTarget.value : uidOriginal;

    // 2. Limpa o nome para o histórico de vida (remove parênteses e extras)
    let targetNome = nomeItem;
    if (selectTarget) {
        targetNome = selectTarget.options[selectTarget.selectedIndex].text.split('(')[0].trim();
    }

    // 3. Define quem é o dono do card (para reabrir o modal certo no final)
    const idReferenciaPai = uidPai || uidOriginal;

    console.log(`%c[INTELIGÊNCIA V3] Alvo: ${targetNome} | Referência Card: ${idReferenciaPai}`, "color: #0284c7; font-weight: bold;");

    // ✅ O PULO DO GATO: Passamos os 'dadosAcessorios' adiante para o modal de inserção não ficar "cego"
    exibirModalInsercaoNovoRelato(targetUid, tipo, targetNome, saldo, cor, idReferenciaPai, dadosAcessorios);
}

/* --- Abre o formulário para o militar descrever uma nova avaria ou falta --- */
async function exibirModalInsercaoNovoRelato(uid, tipo, nomeItem, saldoDisponivel, corPrimaria, uidPai = null) {
    const isChecklist = window.isModoChecklist;
    const fonteDados = window.dadosConferencia || [];
    let acessoriosDoKit = [];

    // ✅ 1. BUSCA PRECISA DO ITEM MESTRE (Para garantir que os acessórios existam no objeto)
    const uidBusca = String(uidPai || uid);

    fonteDados.forEach(setor => {
        setor.itens.forEach(it => {
            // Verifica no item ou nos seus tombamentos se o UID coincide
            const idMestre = String(it.uid_instancia || it.uid_global || it.id || "");
            let itemAlvo = null;

            if (idMestre === uidBusca) {
                itemAlvo = it;
            } else if (it.tombamentos) {
                // Se for um suporte multi, precisamos garantir que estamos olhando o material certo
                const tFound = it.tombamentos.find(t => `${it.uid_global || it.id}-${t.tomb}` === uidBusca);
                if (tFound) itemAlvo = it; // Pegamos o 'it' mestre porque os acessórios costumam estar na raiz
            }

            if (itemAlvo) {
                acessoriosDoKit = itemAlvo.acessorios_vinculados || itemAlvo.acessorios_acoplados || [];
            }
        });
    });

    // ✅ 2. CONSTRUÇÃO DO SELETOR COM IDs DE INSTÂNCIA (DNA V3 FINAL)
    let htmlSeletorAlvo = "";
    if (acessoriosDoKit.length > 0) {
        htmlSeletorAlvo = `
        <div style="background: #f1f5f9; padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
            <label style="display:block; font-weight:800; font-size:0.7em; color:#475569; text-transform:uppercase; margin-bottom:8px; text-align:center;">
                <i class="fas fa-bullseye"></i> Confirmar alvo do problema:
            </label>
            <select id="swal-target-alvo" class="swal2-select" style="width: 100%; margin: 0; font-size: 0.85em; font-weight: bold; text-transform: uppercase; border: 1px solid #cbd5e1; border-radius: 8px;">
                <option value="${uidPai || uid}" ${uid === (uidPai || uid) ? 'selected' : ''} data-nome="${nomeItem}">${nomeItem} (GERAL)</option>
                ${acessoriosDoKit.map((ac, idx) => {
            const uidInstanciaFilho = `${uidPai || uid}_ac_${idx}`;
            // ✅ AUTO-SELEÇÃO: Se o UID clicado for este acessório, ele já vem marcado
            const isSelected = (uid === uidInstanciaFilho || ac.uid_global === uid) ? 'selected' : '';
            return `<option value="${uidInstanciaFilho}" ${isSelected} data-nome="${ac.nome}">${ac.nome.toUpperCase()}</option>`;
        }).join('')}
            </select>
        </div>
    `;
    }

    const { value: formValues } = await Swal.fire({
        title: `<span style="color:${corPrimaria}; font-weight:900; letter-spacing:-0.5px;">RELATAR ALTERAÇÃO</span>`,
        width: window.innerWidth > 600 ? '550px' : '95%',
        padding: '1.5em 1em',
        html: `
            <div style="text-align:left; width: 100%; box-sizing: border-box; font-family: 'Inter', sans-serif;">
                <div style="margin-bottom: 20px; text-align: center;">
                    <b style="color: #475569; font-size: 0.9em; text-transform: uppercase;">${nomeItem}</b>
                </div>
                ${htmlSeletorAlvo}
                ${(tipo === 'single' && !isChecklist) ? `
                    <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; padding: 10px 15px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
                        <label style="font-size:0.8em; font-weight:800; color:#64748b; text-transform:uppercase;">Quantidade:</label>
                        <input id="swal-qtd" type="number" value="1" max="${saldoDisponivel}" min="1" 
                               style="width: 70px; height: 35px; border-radius: 8px; border: 2px solid ${corPrimaria}; text-align: center; font-weight: 900; color: ${corPrimaria}; margin: 0;">
                    </div>
                ` : ''}
                <label style="font-size:0.75em; font-weight:800; color:#64748b; text-transform:uppercase; margin-left: 5px; display: block; margin-bottom: 8px;">
                    Descrição do Problema:
                </label>
                <textarea id="swal-obs" class="swal2-textarea" placeholder="DETALHE A ALTERAÇÃO ENCONTRADA..." 
                          style="height:140px; text-transform:uppercase; width: 100%; box-sizing: border-box; font-size: 0.95em; border-radius: 12px; margin: 0; padding: 15px; border: 1px solid #e2e8f0; background: #fff;"></textarea>
            </div>`,
        showCancelButton: true,
        confirmButtonText: 'SALVAR RELATO',
        confirmButtonColor: corPrimaria,
        cancelButtonText: 'CANCELAR',
        reverseButtons: true,
        backdrop: `rgba(15, 23, 42, 0.5)`,
        customClass: { popup: 'v3-popup-radius' },
        didOpen: () => {
            const inputObs = document.getElementById('swal-obs');
            if (inputObs) inputObs.focus();
        },
        preConfirm: () => {
            // ✅ CAPTURA FORÇADA: Busca o elemento diretamente no popup ativo do SweetAlert
            const popup = Swal.getPopup();
            const selectAlvo = popup.querySelector('#swal-target-alvo');
            const inputObs = popup.querySelector('#swal-obs');
            const inputQtd = popup.querySelector('#swal-qtd');

            const obs = inputObs ? inputObs.value.trim() : "";
            const qtd = isChecklist ? 1 : (inputQtd ? parseInt(inputQtd.value) : 1);

            // ✅ SEPARAÇÃO DE DNA: Se houver select, pegamos o valor dele. Se não, o ID do Pai.
            const finalUid = selectAlvo ? selectAlvo.value : (uidPai || uid);
            const finalNome = selectAlvo ? selectAlvo.options[selectAlvo.selectedIndex].getAttribute('data-nome') : nomeItem;

            if (obs.length < 5) return Swal.showValidationMessage("A descrição deve ser mais detalhada.");

            return { qtd, obs: obs.toUpperCase(), finalUid, finalNome };
        }
    });

    if (formValues) {
        if (typeof salvarNovoID === 'function') {
            const anfitriao = uidPai || uid;

            // ✅ LOG DE DEPURAÇÃO (Para você ver no console antes de salvar)
            console.log(`🚀 DESPACHANDO: Alvo=${formValues.finalUid} | Pai=${anfitriao}`);

            salvarNovoID(formValues.finalUid, formValues.qtd, tipo, formValues.obs, anfitriao, formValues.finalNome);
        }

        setTimeout(() => {
            abrirModalPendenciaV3((uidPai || uid), tipo, nomeItem, saldoDisponivel, null);
        }, 350);
    }
}

/* --- Abre a interface para que o conferente registre como um problema antigo foi sanado, exigindo a justificativa da solução--- */
async function abrirFormularioResolucaoV3(pendencia, uid) {
    const isChecklist = window.isModoChecklist;
    const corSucesso = "#1b8a3e"; // Verde Sigma
    const corCancel = "#64748b"; // Cinza Slate

    // ✅ 1. NORMALIZAÇÃO DE CONTEXTO: Garante que o PDF e os Modais falem do mesmo item
    const uidAlvo = String(uid);
    const itRef = typeof buscarDadosItemPeloUid === 'function' ? buscarDadosItemPeloUid(uidAlvo) : null;

    // Identifica se o problema que estamos resolvendo é de um acessório específico
    const nomeExibicao = pendencia.nome_item_alvo || (itRef ? itRef.nome : "Material");

    const { value: resolucao } = await Swal.fire({
        title: `<span style="color: ${corSucesso}; font-weight: 900; letter-spacing: -0.5px;">RESOLVER ALTERAÇÃO</span>`,
        // ✅ PADRÃO DE TAMANHO V3: 500px para desktop, 95% para mobile
        width: window.innerWidth > 600 ? '500px' : '95%',
        padding: '1.5em 1em',
        html: `
            <div style="text-align: center; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 0.8em; color: #475569; font-weight: 800; text-transform: uppercase;">${nomeExibicao}</p>
                <div style="margin-top: 8px; background: #f1f5f9; padding: 10px; border-radius: 8px; border: 1px dashed #cbd5e1;">
                    <small style="color: #64748b; font-weight: 700; text-transform: uppercase; font-size: 0.7em; line-height: 1.2;">
                        <i class="fas fa-exclamation-triangle"></i> Problema Original:<br>
                        "${pendencia.descricao}"
                    </small>
                </div>
            </div>

            <div style="text-align: left; font-family: 'Inter', sans-serif;">
                
                ${(!isChecklist && pendencia.quantidade > 1) ? `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
                    <label style="font-weight: 800; font-size: 0.75rem; color: #475569; text-transform: uppercase; margin: 0;">
                        Qtd a Resolver:
                    </label>
                    <input id="swal-res-qtd" type="number" value="${pendencia.quantidade}" min="1" max="${pendencia.quantidade}" 
                           style="width: 70px; height: 35px; border: 2px solid ${corSucesso}; border-radius: 8px; text-align: center; font-weight: 900; color: ${corSucesso}; outline: none;">
                </div>
                ` : `<input id="swal-res-qtd" type="hidden" value="${pendencia.quantidade}">`}

                <label style="display: block; font-weight: 800; font-size: 0.75rem; color: #475569; text-transform: uppercase; margin-bottom: 8px; margin-left: 5px;">
                    Justificativa da Solução:
                </label>
                <textarea id="swal-res-obs" placeholder="DESCREVA COMO O PROBLEMA FOI SANADO..." 
                          style="width: 100%; height: 130px; border: 2px solid #e2e8f0; border-radius: 12px; padding: 12px; font-size: 0.9rem; text-transform: uppercase; box-sizing: border-box; outline: none; transition: all 0.3s;"></textarea>
            </div>

            <div style="display: flex; gap: 10px; margin-top: 25px; width: 100%;">
                <button id="btn-cancelar-res" style="flex: 1; background: ${corCancel}; color: white; border: none; padding: 15px; border-radius: 10px; font-weight: 800; font-size: 0.8rem; cursor: pointer; text-transform: uppercase;">
                    <i class="fas fa-arrow-left"></i> VOLTAR
                </button>
                <button id="btn-confirmar-res" style="flex: 1; background: ${corSucesso}; color: white; border: none; padding: 15px; border-radius: 10px; font-weight: 800; font-size: 0.8rem; cursor: pointer; text-transform: uppercase; display: flex; align-items: center; justify-content: center; gap: 5px;">
                    <i class="fas fa-check"></i> CONFIRMAR SOLUÇÃO
                </button>
            </div>
        `,
        showConfirmButton: false,
        allowOutsideClick: false,
        customClass: {
            container: 'sigma-v3-modal',
            popup: 'v3-popup-radius'
        },
        didOpen: () => {
            const textarea = document.getElementById('swal-res-obs');
            if (textarea) {
                textarea.focus();
                // ✅ Efeito Focus Sigma
                textarea.onfocus = () => textarea.style.borderColor = corSucesso;
                textarea.onblur = () => textarea.style.borderColor = "#e2e8f0";
            }

            document.getElementById('btn-cancelar-res').onclick = () => Swal.close();
            document.getElementById('btn-confirmar-res').onclick = () => {
                const obs = document.getElementById('swal-res-obs').value.trim();
                if (obs.length < 5) {
                    Swal.showValidationMessage("Descreva a solução detalhadamente.");
                    return;
                }
                Swal.clickConfirm();
            };
        },
        preConfirm: () => {
            const obs = document.getElementById('swal-res-obs').value.trim();
            const qtdInput = document.getElementById('swal-res-qtd');

            return {
                qtd: parseInt(qtdInput.value),
                obs: obs.toUpperCase()
            };
        }
    });

    if (resolucao) {
        // ✅ 2. PROCESSAMENTO TÉCNICO: Envia para o motor de baixa
        resolverID(pendencia.id, uidAlvo, resolucao.qtd, resolucao.obs);
    } else {
        // ✅ 3. LOOP DE INTERFACE: Se o militar desistir, volta para o Gerenciador (Passo 3)
        // Mantemos o tipo e saldo originais para não quebrar o modal pai
        const tipoPai = itRef ? itRef.tipo : (uidAlvo.includes('_ac_') ? 'single' : 'single');
        const saldoPai = itRef ? itRef.saldo : 0;
        const nomePai = itRef ? itRef.nome : "Material";

        if (typeof abrirModalPendenciaV3 === 'function') {
            abrirModalPendenciaV3(uidAlvo, tipoPai, nomePai, saldoPai);
        }
    }
}

/* --- Permite ao usuário corrigir um relato feito na mesma sessão antes de finalizar a conferência --- */
async function abrirModalEditar(pendenciaId, uid, qtdAtual, descricaoAtual) {
    const corEdicao = "#2196F3";
    const uidString = String(uid);
    const isChecklist = window.isModoChecklist;

    // ✅ BUSCA INTELIGENTE DE CONTEXTO V3
    const dadosPai = buscarDadosItemPeloUid(uidString);

    // Tentamos recuperar o nome específico do alvo (ex: "Cilindro") na memória de interação
    // Se não houver (ex: erro no item principal), usamos o nome do Pai.
    const statusLocal = window.itemStatus[uidString];
    let nomeExibicao = dadosPai ? dadosPai.nome : "Item";

    // Se o relato for temporário, o 'itemStatus' tem o nome exato do acessório que sofreu a alteração
    if (statusLocal && statusLocal.pendencias_temporarias) {
        const pnd = statusLocal.pendencias_temporarias.find(p => String(p.id) === String(pendenciaId));
        if (pnd && pnd.nome_item_alvo) {
            nomeExibicao = pnd.nome_item_alvo;
        }
    }

    const { value: formValues, dismiss } = await Swal.fire({
        title: `<span style="color: ${corEdicao}; font-size: 0.9em; font-weight: bold;"><i class="fas fa-edit"></i> Editar Relato</span>`,
        width: window.innerWidth > 600 ? '450px' : '95%',
        padding: '1em',
        html: `
            <div style="text-align: left; font-family: sans-serif; width: 100%; box-sizing: border-box;">
                <p style="margin-bottom: 15px; font-size: 0.85em; color: #64748b; text-align: center; text-transform: uppercase;">
                    <small style="display:block; opacity:0.6; font-size:0.7em;">Alteração em:</small>
                    <b>${nomeExibicao}</b>
                </p>
                
                ${!isChecklist ? `
                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-weight: 800; font-size: 0.7em; color: #64748b; text-transform: uppercase; margin-bottom: 5px;">Quantidade:</label>
                    <input id="swal-input-qtd" type="number" class="swal2-input" value="${qtdAtual}" min="1" 
                           style="width: 100%; margin: 0; height: 40px; border-radius: 8px; font-weight: bold;">
                </div>
                ` : ''}

                <label style="display: block; font-weight: 800; font-size: 0.7em; color: #64748b; text-transform: uppercase; margin-bottom: 5px;">Descrição da Alteração:</label>
                <textarea id="swal-input-obs" class="swal2-textarea" placeholder="Descreva a alteração..." 
                          style="width: 100%; margin: 0; min-height: 120px; text-transform: uppercase; font-size: 0.9em; border-radius: 8px; padding: 10px;">${descricaoAtual}</textarea>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'SALVAR ALTERAÇÕES',
        cancelButtonText: 'VOLTAR',
        confirmButtonColor: corEdicao,
        reverseButtons: true,
        backdrop: `rgba(15, 23, 42, 0.6)`,
        allowOutsideClick: false,
        didOpen: () => {
            const input = document.getElementById('swal-input-obs');
            if (input) {
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
            }
        },
        preConfirm: () => {
            const obs = document.getElementById('swal-input-obs').value.trim();
            const qtdInput = document.getElementById('swal-input-qtd');
            const qtd = isChecklist ? 1 : (qtdInput ? parseInt(qtdInput.value) : 1);

            if (!obs || obs.length < 5) {
                Swal.showValidationMessage('A descrição deve ter pelo menos 5 caracteres');
                return false;
            }
            return { qtd, obs: obs.toUpperCase() };
        }
    });

    if (formValues) {
        // Executa a edição na memória
        executarEdicaoRelato(pendenciaId, uidString, formValues.qtd, formValues.obs);

        // Retorno ao modal principal (Passamos nomeExibicao para manter a coerência)
        setTimeout(() => {
            abrirModalPendenciaV3(uidString, isChecklist ? 'single' : 'multi', nomeExibicao, (dadosPai ? dadosPai.saldo : 0));
        }, 300);
    }
    else if (dismiss === Swal.DismissReason.cancel) {
        setTimeout(() => {
            abrirModalPendenciaV3(uidString, isChecklist ? 'single' : 'multi', nomeExibicao, (dadosPai ? dadosPai.saldo : 0));
        }, 100);
    }
}

/* --- Gera o alerta de segurança para deletar uma alteração e limpa a memória do sistema --- */
async function confirmarExclusaoRelato(pendenciaId, uid) {
    const uidAlvo = String(uid);
    // Busca dados do item para manter o contexto se precisar reabrir o modal
    const itRef = typeof buscarDadosItemPeloUid === 'function' ? buscarDadosItemPeloUid(uidAlvo) : null;

    const result = await Swal.fire({
        title: 'Apagar Alteração?',
        text: "Esta ação removerá o relato selecionado da memória.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: '<i class="fas fa-trash-alt"></i> SIM, APAGAR',
        cancelButtonText: 'CANCELAR',
        reverseButtons: true,
        backdrop: `rgba(15, 23, 42, 0.6)`
    });

    if (!result.isConfirmed) {
        if (itRef) {
            abrirModalPendenciaV3(uidAlvo, itRef.tipo, itRef.nome, itRef.saldo);
        }
        return;
    }

    const fonteDados = window.dadosConferencia || [];
    let excluido = false;
    let infoParaRetorno = {
        nome: itRef?.nome || "Item",
        tipo: itRef?.tipo || "single",
        saldo: itRef?.saldo || 0,
        restantes: 0
    };

    // ✅ 1. LIMPEZA NA FONTE DE DADOS (Persistência/Dataset)
    fonteDados.forEach(setor => {
        setor.itens.forEach(item => {
            // Match prioritário por uid_instancia (DNA V3)
            const idItemMestre = String(item.uid_instancia || item.uid_global || item.id);
            const matchPrincipal = (idItemMestre === uidAlvo);

            if (matchPrincipal && item.pendencias_ids) {
                const index = item.pendencias_ids.findIndex(p => String(p.id) === String(pendenciaId));
                if (index > -1) {
                    item.pendencias_ids.splice(index, 1);
                    excluido = true;
                }
            }

            // Busca profunda em tombamentos (Itens Multi não migrados ou sub-objetos)
            if (item.tombamentos) {
                item.tombamentos.forEach(t => {
                    const uidComp = `${item.uid_global || item.id}-${t.tomb}`;
                    if (uidComp === uidAlvo && t.pendencias_ids) {
                        const indexT = t.pendencias_ids.findIndex(p => String(p.id) === String(pendenciaId));
                        if (indexT > -1) {
                            t.pendencias_ids.splice(indexT, 1);
                            excluido = true;
                        }
                    }
                });
            }
        });
    });

    // ✅ 2. LIMPEZA NA MEMÓRIA TEMPORÁRIA (pendencias_temporarias)
    // Essencial para remover o carimbo azul "✨ NOVO RELATO"
    const statusLocal = window.itemStatus[uidAlvo];
    if (statusLocal && statusLocal.pendencias_temporarias) {
        const indexTemp = statusLocal.pendencias_temporarias.findIndex(p => String(p.id) === String(pendenciaId));
        if (indexTemp > -1) {
            statusLocal.pendencias_temporarias.splice(indexTemp, 1);
            excluido = true;
        }
    }

    if (excluido) {
        // ✅ 3. CONTROLE DE ESTADO: Calcula se o item ainda possui algum problema relatado
        const pRestantesBanco = fonteDados.reduce((acc, setor) => {
            const it = setor.itens.find(i => (i.uid_instancia || i.uid_global || i.id) === uidAlvo);
            return acc + (it?.pendencias_ids?.length || 0);
        }, 0);

        const pRestantesTemp = window.itemStatus[uidAlvo]?.pendencias_temporarias?.length || 0;
        infoParaRetorno.restantes = pRestantesBanco + pRestantesTemp;

        // Se o item ficou "limpo", removemos o alerta visual da interface principal
        if (infoParaRetorno.restantes === 0) {
            delete window.itemStatus[uidAlvo];

            const elItem = document.getElementById(`item-row-${uidAlvo}`);
            if (elItem) {
                elItem.classList.remove('status-alert', 'status-ok', 'has-carimbo');
                elItem.style.backgroundColor = "";
                elItem.style.borderLeft = "";
                const btnAlert = elItem.querySelector('.btn-alert');
                if (btnAlert) btnAlert.classList.remove('active', 'v3-pulse-orange');
            }
        }

        // Sincroniza a barra de progresso global
        if (typeof updateOverallStatus === 'function') updateOverallStatus();

        // ✅ 4. FEEDBACK E REABERTURA
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 1000
        });

        Toast.fire({ icon: 'success', title: 'Relato removido' });

        setTimeout(() => {
            // Reabre o gerenciador se ainda houver o que gerenciar (Passo 3)
            if (infoParaRetorno.restantes > 0) {
                abrirModalPendenciaV3(uidAlvo, infoParaRetorno.tipo, infoParaRetorno.nome, infoParaRetorno.saldo);
            }
        }, 400);
    }
}

/* --- Função de apoio que gera o objeto de pendência (TEMP-...) com carimbo de autoria e insere na memória do sistema --- */
/* --- SALVAR NOVO RELATO (DNA V3 - RASTREABILIDADE TOTAL) --- */
function salvarNovoID(uid, qtd, tipo, obsModal = null, uidPai = null, nomeItemAlvo = "") {
    const obsDigitada = obsModal ? obsModal.trim().toUpperCase() : "";
    const qtdInformada = parseInt(qtd) || 1;
    const militarInfoEl = document.getElementById('militar-info');

    // 1. CAPTURA DE ASSINATURA SEGURA
    let nomeAssinatura = militarInfoEl ? militarInfoEl.innerText.split('\n')[0].replace('Conferente:', '').trim() : "";
    if (!nomeAssinatura) {
        nomeAssinatura = `${window.userInfo?.postoGraduacao || ""} ${window.userInfo?.quadro || ""} ${window.userInfo?.nomeGuerra || "SISTEMA"}`.trim();
    }

    // ✅ 2. CRIAÇÃO DO OBJETO DE PENDÊNCIA (Com metadados de rastreabilidade V3)
    // O uid_alvo_direto agora é a chave para o histórico de vida individual
    const novoID = {
        id: "TEMP-" + Date.now(),
        tipo: "PENDENCIA",
        data_criacao: new Date().toLocaleDateString('pt-BR'),
        autor_uid: String(window.userInfo?.uid || "S_UID"),
        autor_nome: nomeAssinatura,
        descricao: obsDigitada,
        quantidade: qtdInformada,
        status_gestao: "PENDENTE",
        id_pai: uidPai, // Chave do Anfitrião (Ex: Suporte Dorsal)
        uid_alvo_direto: uid, // Chave do Componente Real (Ex: Cilindro)
        nome_item_alvo: nomeItemAlvo.toUpperCase()
    };

    let itemEncontrado = false;
    const fonteDados = window.dadosConferencia || [];
    const alvoBusca = String(uidPai || uid);

    // 3. BUSCA E INSERÇÃO NO DATASET (DNA V3)
    fonteDados.forEach(setor => {
        setor.itens.forEach(item => {
            const idRealDoItem = String(item.uid_instancia || item.uid_global || item.id);

            if (idRealDoItem === alvoBusca) {
                if (!item.pendencias_ids) item.pendencias_ids = [];
                item.pendencias_ids.push(novoID);
                itemEncontrado = true;
            }

            if (!itemEncontrado && item.tombamentos) {
                item.tombamentos.forEach(t => {
                    const uidComposto = String(`${item.uid_global || item.id}-${t.tomb}`);
                    if (alvoBusca === uidComposto) {
                        if (!t.pendencias_ids) t.pendencias_ids = [];
                        t.pendencias_ids.push(novoID);
                        itemEncontrado = true;
                    }
                });
            }
        });
    });

    if (itemEncontrado) {
        // 4. ATUALIZAÇÃO DO STATUS DE INTERAÇÃO (Interface V3)
        const uidInteracao = alvoBusca;

        if (!window.itemStatus[uidInteracao]) window.itemStatus[uidInteracao] = {};
        if (!window.itemStatus[uidInteracao].pendencias_temporarias) {
            window.itemStatus[uidInteracao].pendencias_temporarias = [];
        }

        window.itemStatus[uidInteracao].pendencias_temporarias.push(novoID);

        window.itemStatus[uidInteracao] = {
            ...window.itemStatus[uidInteracao],
            status: 'C/A',
            interacao_humana: true,
            ultimo_alvo_relatado: uid,
            nome_alvo_relatado: nomeItemAlvo.toUpperCase()
        };

        // 5. PINTURA DO CARD NO DOM
        const row = document.getElementById(`item-row-${uidInteracao}`);
        if (row) {
            row.classList.remove('status-ok');
            row.classList.add('status-alert');
            row.style.setProperty('background-color', '#fff5f5', 'important');
            row.style.setProperty('border-left', '6px solid #e20b0b', 'important');

            const btnAlert = row.querySelector('.btn-alert');
            const btnCheck = row.querySelector('.btn-check');

            if (btnAlert) btnAlert.classList.add('active');
            if (btnCheck) btnCheck.classList.remove('active');

            row.style.transition = "background 0.3s";
            row.style.background = "rgba(226, 11, 11, 0.1)";
            setTimeout(() => row.style.background = "", 800);
        }

        if (typeof updateOverallStatus === 'function') updateOverallStatus();
        console.log(`✅ [V3] Relato salvo para componente: ${nomeItemAlvo}`);

    } else {
        console.error("❌ [V3] Erro: Item mestre não localizado para salvamento.", { alvoBusca });
        Swal.fire("Erro de Sincronia", "Não localizamos o item pai na lista atual.", "error");
    }
}

/* --- Processa a baixa de uma pendência na memória, movendo o saldo de "pendente" para "ok" e registrando o histórico de solução --- */
async function resolverID(pendenciaId, uid, qtdResolvidaModal, justificativaModal) {
    const qtdResolvida = parseInt(qtdResolvidaModal) || 1;
    const justificativa = justificativaModal ? justificativaModal.trim().toUpperCase() : "";
    const nomeResolutor = `${window.userInfo?.postoGraduacao || ""} ${window.userInfo?.quadro || ""} ${window.userInfo?.nomeGuerra || "SISTEMA"}`.trim();
    const fonteDados = window.dadosConferencia || [];
    let acaoConcluida = false;
    let itemContexto = null;

    const idProcurado = String(pendenciaId);
    const isResolvendoAvaria = idProcurado.startsWith('AVARIA-');

    // --- LÓGICA DE BAIXA NO OBJETO (REVISADA V3) ---
    function executarBaixaNoObjeto(obj) {
        if (!obj) return false;

        // Caso 1: Resolvendo Avaria de Cautela
        if (isResolvendoAvaria) {
            if (!obj.historico_vida) obj.historico_vida = [];
            obj.historico_vida.push({
                evento: "RESOLUÇÃO_AVARIA_CAUTELA",
                data: new Date().toLocaleString('pt-BR'),
                quem: nomeResolutor,
                detalhes: `AVARIA RESOLVIDA. JUSTIFICATIVA: ${justificativa}`,
                cautela_origem: idProcurado.replace('AVARIA-', '')
            });
            obj.situacao = "DISPONÍVEL";
            obj.status = "OK";
            delete obj.id_cautela_origem;
            delete obj.motivo_avaria;
            return true;
        }

        // Caso 2: Resolvendo Pendência Comum
        if (!obj.pendencias_ids) return false;
        const index = obj.pendencias_ids.findIndex(p => String(p.id) === idProcurado);

        if (index === -1) return false;

        const pOriginal = obj.pendencias_ids[index];
        if (!obj.historico_vida) obj.historico_vida = [];

        const registroHistorico = {
            id_referencia: pOriginal.id,
            evento: qtdResolvida >= pOriginal.quantidade ? "SOLUCAO_TOTAL" : "SOLUCAO_PARCIAL",
            quantidade: qtdResolvida,
            data: new Date().toLocaleString('pt-BR'),
            quem: nomeResolutor,
            detalhes: `RESOLVIDO VIA CONFERÊNCIA. JUSTIFICATIVA: ${justificativa}. (REF: ${pOriginal.descricao})`
        };

        if (qtdResolvida >= pOriginal.quantidade) {
            pOriginal.status_gestao = 'RESOLVIDO';
            pOriginal.justificativa_solucao = justificativa;
            pOriginal.data_solucao = new Date().toLocaleString('pt-BR');
            pOriginal.resolvido_por = nomeResolutor;
        } else {
            pOriginal.quantidade -= qtdResolvida;
        }

        obj.historico_vida.push(registroHistorico);
        return true;
    }

    // --- BUSCA RECURSIVA (DNA V3 - ESCANEAMENTO DE HIERARQUIA) ---
    fonteDados.forEach(setor => {
        setor.itens.forEach(item => {
            const idMestre = String(item.uid_instancia || item.uid_global || item.id);

            // Verifica se o alvo é o item principal ou seus acessórios
            if (idMestre === String(uid) || String(uid).startsWith(idMestre + "_ac_")) {

                // Tenta resolver no Pai
                if (executarBaixaNoObjeto(item)) {
                    acaoConcluida = true;
                    itemContexto = item;
                }

                // Tenta resolver nos Acessórios do Pai
                const filhos = item.acessorios_vinculados || item.acessorios_acoplados || [];
                filhos.forEach(ac => {
                    if (executarBaixaNoObjeto(ac)) {
                        acaoConcluida = true;
                        itemContexto = item;
                    }
                });

                // Se for item multi, verifica tombamentos e seus respectivos acessórios
                if (item.tombamentos) {
                    item.tombamentos.forEach(t => {
                        const uidTomb = `${item.uid_global || item.id}-${t.tomb}`;
                        if (uidTomb === String(uid) || String(uid).startsWith(uidTomb + "_ac_")) {
                            if (executarBaixaNoObjeto(t)) {
                                acaoConcluida = true;
                                itemContexto = item;
                            }
                            const filhosT = t.acessorios_vinculados || [];
                            filhosT.forEach(acT => {
                                if (executarBaixaNoObjeto(acT)) {
                                    acaoConcluida = true;
                                    itemContexto = item;
                                }
                            });
                        }
                    });
                }
            }
        });
    });

    if (acaoConcluida) {
        // ✅ REFORÇO DE MEMÓRIA HIERÁRQUICA
        if (!window.itemStatus[uid]) window.itemStatus[uid] = {};

        const checkAtivas = (obj) => (obj.pendencias_ids || []).some(p => p.status_gestao !== 'RESOLVIDO');

        // Verifica se ainda resta algum problema no Pai ou em QUALQUER um dos seus Filhos
        let aindaTemProblema = checkAtivas(itemContexto);
        const todosFilhos = itemContexto.acessorios_vinculados || itemContexto.acessorios_acoplados || [];
        if (todosFilhos.some(ac => checkAtivas(ac))) aindaTemProblema = true;

        const temNovas = (window.itemStatus[uid].pendencias_temporarias || []).length > 0;

        // Atualiza status visual e lógico
        window.itemStatus[uid].status = (aindaTemProblema || temNovas) ? 'C/A' : 'ok';
        window.itemStatus[uid].interacao_humana = true;

        if (window.itemStatus[uid].ids_mantidos) {
            window.itemStatus[uid].ids_mantidos = window.itemStatus[uid].ids_mantidos.filter(id => String(id) !== idProcurado);
        }

        const row = document.getElementById(`item-row-${uid}`);
        if (row) {
            row.style.backgroundColor = "#dcfce7";
            setTimeout(() => row.style.backgroundColor = "", 1500);
        }

        Swal.close();

        // Reabre o modal atualizado
        setTimeout(async () => {
            if (typeof updateOverallStatus === 'function') updateOverallStatus();

            const itRef = typeof buscarDadosItemPeloUid === 'function' ? buscarDadosItemPeloUid(uid) : null;
            const nomeParaModal = itRef ? itRef.nome : (itemContexto ? itemContexto.nome : "Item");
            const saldoParaModal = itRef ? itRef.saldo : 0;

            if (typeof abrirModalPendenciaV3 === 'function') {
                await abrirModalPendenciaV3(uid, itemContexto.tipo, nomeParaModal, saldoParaModal);
            }

            Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000
            }).fire({ icon: 'success', title: 'Solução registrada!' });

        }, 500);

    } else {
        Swal.fire('Erro de Sincronia', 'Não foi possível localizar o registro para baixa nesta hierarquia.', 'error');
    }
}

/* --- Registra que uma pendência antiga foi vista e continua existindo, garantindo a rastreabilidade do item --- */
function manterID(pendenciaId, uid, index) {
    // 1. GARANTE A EXISTÊNCIA DO OBJETO E DNA DO ITEM NA MEMÓRIA
    if (!window.itemStatus[uid]) {
        window.itemStatus[uid] = {
            status: 'C/A',
            ids_mantidos: [],
            pendencias_originais_mantidas: [],
            interacao_humana: true
        };
    }

    if (!window.itemStatus[uid].ids_mantidos) {
        window.itemStatus[uid].ids_mantidos = [];
        window.itemStatus[uid].pendencias_originais_mantidas = [];
    }

    // 2. BUSCA E CAPTURA O OBJETO DA PENDÊNCIA (RASTREABILIDADE CIRÚRGICA)
    const idStr = String(pendenciaId);

    // Se já foi mantido nesta sessão, não duplicamos
    if (!window.itemStatus[uid].ids_mantidos.includes(idStr)) {
        window.itemStatus[uid].ids_mantidos.push(idStr);

        // ✅ BUSCA HIERÁRQUICA (DNA V3): Varre Pais, Filhos e Tombamentos
        const fonte = window.dadosConferencia || [];
        let objetoEncontrado = null;

        fonte.forEach(setor => {
            setor.itens.forEach(it => {
                const idMestre = String(it.uid_instancia || it.uid_global || it.id);

                // Só entra se o UID for relacionado a este conjunto (Pai ou Filho)
                if (idMestre === String(uid) || String(uid).startsWith(idMestre + "_ac_")) {

                    // A) Busca no Pai e nos Acessórios do Pai
                    const subLista = [it, ...(it.acessorios_vinculados || []), ...(it.acessorios_acoplados || [])];
                    subLista.forEach(ent => {
                        if (ent.pendencias_ids && !objetoEncontrado) {
                            const p = ent.pendencias_ids.find(pnd => String(pnd.id) === idStr);
                            if (p) objetoEncontrado = p;
                        }
                    });

                    // B) Busca em Tombamentos e seus respectivos acessórios (Caso 517/518)
                    if (!objetoEncontrado && it.tombamentos) {
                        it.tombamentos.forEach(t => {
                            const uidComp = `${it.uid_global || it.id}-${t.tomb}`;
                            if (uidComp === String(uid) || String(uid).startsWith(uidTomb + "_ac_")) {
                                const subListaT = [t, ...(t.acessorios_vinculados || [])];
                                subListaT.forEach(entT => {
                                    if (entT.pendencias_ids && !objetoEncontrado) {
                                        const pT = entT.pendencias_ids.find(pnd => String(pnd.id) === idStr);
                                        if (pT) objetoEncontrado = pT;
                                    }
                                });
                            }
                        });
                    }
                }
            });
        });

        if (objetoEncontrado) {
            // Guarda o objeto original para que o Bloco 1 do salvar saiba o que imprimir no PDF
            window.itemStatus[uid].pendencias_originais_mantidas.push(objetoEncontrado);
        }
    }

    // 3. ATUALIZAÇÃO DO ESTADO GLOBAL DO ITEM (DNA V3)
    window.itemStatus[uid].status = 'C/A';
    window.itemStatus[uid].interacao_humana = true;

    // Normalização de UID Global para Inventário
    if (!window.itemStatus[uid].uid_global_ref) {
        const uidStr = String(uid);
        const partes = uidStr.split('-');
        const uidGlobalFull = partes.length > 4 ? partes.slice(0, -1).join('-') : uidStr;
        window.itemStatus[uid].uid_global_ref = uidGlobalFull;
    }

    // 4. FEEDBACK VISUAL NO BOTÃO DENTRO DO MODAL
    const btnModal = document.getElementById(`btn-manter-${index}`);
    if (btnModal) {
        btnModal.classList.add('active');
        const icon = btnModal.querySelector('i');
        if (icon) icon.className = 'fas fa-check-double';

        btnModal.style.transform = "scale(1.15)";
        btnModal.style.transition = "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
        setTimeout(() => btnModal.style.transform = "scale(1)", 200);
    }

    // 5. FEEDBACK VISUAL NA LINHA (TELA AO FUNDO)
    const row = document.getElementById(`item-row-${uid}`);
    if (row) {
        row.classList.remove('status-ok');
        row.classList.add('status-alert');

        const btnAlert = row.querySelector('.btn-alert');
        if (btnAlert) {
            btnAlert.classList.add('active');
            btnAlert.classList.remove('v3-pulse-orange');
        }

        row.style.transition = "transform 0.2s ease, background-color 0.3s ease";
        row.style.transform = "scale(1.01)";
        row.style.backgroundColor = "rgba(245, 124, 0, 0.05)";

        setTimeout(() => {
            row.style.transform = "scale(1)";
            row.style.backgroundColor = "";
        }, 300);
    }

    if (typeof updateOverallStatus === 'function') updateOverallStatus();
    console.log(`✅ [V3] Pendência ${idStr} mantida e capturada para o PDF em ${uid}.`);
}

/* --- Exibe um resumo rápido dos dados de emissão de uma cautela específica para consulta rápida durante o recebimento --- */
async function verExtratoCautela(cautelaId) {
    if (!cautelaId) return;
    try {
        const doc = await db.collection('cautelas_abertas').doc(cautelaId).get();
        if (!doc.exists) return alert("Cautela não encontrada.");

        const data = doc.data();

        const html = `
            <div id="extrato-wrapper" style="position: fixed; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.4); z-index: 29999; display: flex; align-items: center; justify-content: center;" onclick="this.remove()">
                <div style="position: relative; background: white; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); padding: 15px; z-index: 30000; width: 85%; max-width: 320px; border-top: 4px solid #f57c00; font-family: Arial, sans-serif;" onclick="event.stopPropagation()">
                    <h4 style="margin:0 0 10px 0; color:#800020; font-size:1em; border-bottom:1px solid #eee; padding-bottom:5px; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-eye"></i> Detalhes da Cautela
                    </h4>
                    <p style="font-size:0.85em; margin:8px 0; color: #333;"><b>Emitente:</b><br>${data.emitente}</p>
                    
                    <p style="font-size:0.85em; margin:12px 0; color: #333; display: flex; align-items: center; gap: 8px;">
                        <b>Status:</b> 
                        <span style="background: #f57c00; color: white; padding: 3px 10px; border-radius: 12px; font-weight: bold; font-size: 0.85em; text-transform: uppercase;">
                            ${data.status}
                        </span>
                    </p>

                    <p style="font-size:0.85em; margin:10px 0 5px 0; color: #333;"><b>Observação:</b></p>
                    <div style="font-size:0.8em; background:#f9f9f9; padding:8px; border-radius:4px; font-style:italic; color:#555; max-height:100px; overflow-y:auto; border: 1px solid #eee; line-height: 1.4;">
                        ${data.observacoes_emissao || 'Sem observações.'}
                    </div>
                    <button onclick="document.getElementById('extrato-wrapper').remove()" style="width:100%; margin-top:15px; padding:10px; background:#800020; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer; text-transform: uppercase; font-size: 0.8em;">Fechar</button>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    } catch (e) { console.error(e); }
}

/* --- Modal de entrada rápida para novos registros, adaptando-se para itens com ou sem tombamento. --- */
async function abrirFormNovoID(uid, tipo, nomeItem, saldo, tombReal = "") {
    // ✅ IDENTIDADE VISUAL DINÂMICA V3
    const isChecklist = window.isModoChecklist;
    const corPrimaria = isChecklist ? "#2c3e50" : "#800020";
    const nomeLimpo = nomeItem.replace(/\\'/g, "'");
    const saldoReal = parseInt(saldo) || 0;

    // Validação de saldo inicial para itens que não são tombados
    if (tipo !== 'multi' && saldoReal <= 0) {
        return Swal.fire({
            icon: 'error',
            title: 'Saldo Insuficiente',
            text: 'Este item não possui saldo disponível para relatar nova alteração.',
            confirmButtonColor: corPrimaria
        });
    }

    // ✅ DISPARO DO MODAL ELEGANTE (Swal)
    const { value: formValues } = await Swal.fire({
        title: `<span style="color: ${corPrimaria}; font-size: 0.9em; font-weight: bold;">${nomeLimpo}</span>`,
        html: `
            <div style="text-align: left; font-family: sans-serif;">
                ${tipo === 'multi'
                ? `<p style="margin-bottom: 15px; font-size: 0.9em;">Referência Tomb.: <b style="color: #d90f23;">${tombReal}</b></p>`
                : `
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; font-weight: bold; font-size: 0.85em; color: #666;">Quantidade Alterada (Disponível: ${saldoReal}):</label>
                        <input id="swal-input-qtd" type="number" class="swal2-input" value="1" min="1" max="${saldoReal}" style="width: 100%; margin: 5px 0 0 0; height: 40px;">
                    </div>`
            }
                <label style="display: block; font-weight: bold; font-size: 0.85em; color: #666;">Descrição do Problema:</label>
                <textarea id="swal-input-obs" class="swal2-textarea" placeholder="Descreva o problema detalhadamente..." style="width: 100%; margin: 5px 0 0 0; min-height: 100px; text-transform: uppercase; font-size: 0.9em;"></textarea>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'INCLUIR ALTERAÇÃO',
        cancelButtonText: 'CANCELAR',
        confirmButtonColor: corPrimaria,
        reverseButtons: true,
        backdrop: `rgba(15, 23, 42, 0.4)`, // Backdrop suave V3
        didOpen: () => {
            // Foco automático no campo de observação ao abrir
            const input = document.getElementById('swal-input-obs');
            if (input) input.focus();
        },
        preConfirm: () => {
            const obs = document.getElementById('swal-input-obs').value;
            const qtd = tipo === 'multi' ? 1 : document.getElementById('swal-input-qtd').value;

            // Validações internas do modal
            if (!obs || obs.trim().length < 5) {
                Swal.showValidationMessage('Por favor, descreva o problema (mínimo 5 caracteres)');
                return false;
            }
            if (tipo !== 'multi' && (parseInt(qtd) > saldoReal || parseInt(qtd) < 1)) {
                Swal.showValidationMessage(`Quantidade inválida (Máx: ${saldoReal})`);
                return false;
            }

            return { qtd: parseInt(qtd), obs: obs.trim().toUpperCase() };
        }
    });

    // ✅ PROCESSAMENTO FINAL
    if (formValues) {
        // Envia para a função de salvamento que já existe no seu código
        salvarNovoID(uid, formValues.qtd, tipo, formValues.obs);
    }
}

function processarAcaoFinalModal() {
    // 1. CAPTURA DE DADOS
    const objetivo = document.getElementById('modal-acao-objetivo').value;
    const uid = document.getElementById('modal-uid').value; // Referência do Item/Tombamento
    const qtdInput = document.getElementById('modal-input-qtd');
    const obs = document.getElementById('modal-input-obs').value;
    const tipoOuPendenciaId = document.getElementById('modal-tipo').value;

    // 2. VALIDAÇÃO DE CONTEÚDO (UX V3)
    if (obs.trim().length < 5) {
        // Alerta visual no próprio campo antes do alert do navegador
        document.getElementById('modal-input-obs').style.borderColor = "#d90f23";
        return alert("⚠️ Detalhamento insuficiente! Por favor, descreva a situação com pelo menos 5 caracteres.");
    }

    // 3. NORMALIZAÇÃO E SEGURANÇA
    const qtdNumerica = parseInt(qtdInput.value) || 1;
    const uidString = String(uid);
    const refIdString = String(tipoOuPendenciaId);

    // Validação de limite de quantidade (evita erros de digitação)
    if (qtdInput.max && qtdNumerica > parseInt(qtdInput.max)) {
        return alert(`⚠️ Erro de Quantidade! O valor máximo permitido para este item é ${qtdInput.max}.`);
    }

    // 4. ORQUESTRAÇÃO LOGÍSTICA
    try {
        if (objetivo === "editar") {
            executarEdicaoRelato(refIdString, uidString, qtdNumerica, obs);
        }
        else if (objetivo === "resolver") {
            resolverID(refIdString, uidString, qtdNumerica, obs);
        }
        else {
            salvarNovoID(uidString, qtdNumerica, refIdString, obs);
        }

        // ✅ FEEDBACK V3: Efeito visual de sucesso no elemento que originou a ação
        const elAlvo = document.querySelector(`[data-id="${uidString}"]`);
        if (elAlvo) {
            elAlvo.style.transition = "all 0.5s ease";
            elAlvo.style.boxShadow = "0 0 15px rgba(27, 138, 62, 0.4)";
            setTimeout(() => elAlvo.style.boxShadow = "none", 1500);
        }

        // 5. FECHAMENTO E LIMPEZA
        fecharModalPendencia();

    } catch (error) {
        console.error("Erro ao processar ação do modal:", error);
        alert("❌ Ocorreu um erro ao salvar esta alteração. Verifique o console.");
    }
}

/* --- Processa a alteração de um relato na memória antes da publicação final --- */
function executarEdicaoRelato(pendenciaId, uid, novaQtd, novaObs) {
    const fonteDados = window.dadosConferencia || [];
    const uidAlvo = String(uid);
    const idProcurado = String(pendenciaId);
    let editado = false;

    // Variáveis para garantir a reabertura correta do modal
    let nomeParaModal = "";
    let tipoParaModal = "single";
    let saldoParaModal = 0;

    // ✅ 1. BUSCA E EDIÇÃO NA MEMÓRIA TEMPORÁRIA (DNA V3)
    // Verifica se o relato é um "TEMP-" recém-criado nesta sessão
    const statusLocal = window.itemStatus[uidAlvo];
    if (statusLocal && statusLocal.pendencias_temporarias) {
        const pndTemp = statusLocal.pendencias_temporarias.find(p => String(p.id) === idProcurado);
        if (pndTemp) {
            pndTemp.quantidade = parseInt(novaQtd) || 0;
            pndTemp.descricao = novaObs.trim().toUpperCase();
            editado = true;

            // Metadados para reabertura (fallback caso não ache na fonte principal)
            nomeParaModal = statusLocal.nome_alvo_relatado || "Item";
        }
    }

    // ✅ 2. BUSCA E EDIÇÃO NA FONTE DE DADOS (Persistência/Histórico)
    if (!editado) {
        fonteDados.forEach(setor => {
            setor.itens.forEach(item => {
                // Match resiliente: uid_instancia (Mestre) ou global
                const isMatchItem = (item.uid_instancia === uidAlvo || item.uid_global === uidAlvo || item.id === uidAlvo);

                let alvosParaVerificar = (item.tipo === 'multi' && item.tombamentos) ? item.tombamentos : [item];

                alvosParaVerificar.forEach(alvo => {
                    // Se for multi, o uidAlvo deve bater com o composto ID-TOMB
                    const uidComposto = item.tipo === 'multi' ? `${item.uid_global || item.id}-${alvo.tomb}` : (item.uid_instancia || item.uid_global || item.id);

                    if (uidComposto === uidAlvo && alvo.pendencias_ids) {
                        const p = alvo.pendencias_ids.find(pend => String(pend.id) === idProcurado);
                        if (p) {
                            p.descricao = novaObs.trim().toUpperCase();
                            p.quantidade = parseInt(novaQtd) || 0;
                            editado = true;

                            // Captura metadados exatos do item pai
                            nomeParaModal = item.nome + (item.tipo === 'multi' ? ` (${alvo.tomb})` : "");
                            tipoParaModal = item.tipo;

                            const totalEsperado = Number(item.quantidadeEsperada || item.quantidade || 1);
                            const totalLancado = alvo.pendencias_ids.reduce((s, pnd) => s + (pnd.quantidade || 0), 0);
                            saldoParaModal = totalEsperado - totalLancado;

                            // Sincroniza o itemStatus para manter o card atualizado
                            if (window.itemStatus[uidAlvo]) {
                                window.itemStatus[uidAlvo].obs = p.descricao;
                                window.itemStatus[uidAlvo].quantidade = p.quantidade;
                                window.itemStatus[uidAlvo].interacao_humana = true;
                            }
                        }
                    }
                });
            });
        });
    }

    if (editado) {
        // Sincroniza UI de fundo
        if (typeof renderizarConferencia === 'function') renderizarConferencia();
        if (typeof updateOverallStatus === 'function') updateOverallStatus();

        // ✅ FECHAMENTO E REABERTURA FLUIDA
        Swal.close();

        setTimeout(() => {
            // Busca dados atualizados para garantir que o saldo no modal esteja correto
            const itRef = typeof buscarDadosItemPeloUid === 'function' ? buscarDadosItemPeloUid(uidAlvo) : null;
            const finalNome = itRef ? itRef.nome : nomeParaModal;
            const finalSaldo = itRef ? itRef.saldo : saldoParaModal;

            // Reabre o gerenciador (Passo 3)
            if (typeof abrirModalPendenciaV3 === 'function') {
                abrirModalPendenciaV3(uidAlvo, tipoParaModal, finalNome, finalSaldo);
            }

            // Toast discreto de confirmação
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Relato atualizado!',
                showConfirmButton: false,
                timer: 1500,
                timerProgressBar: true
            });
        }, 150);

    } else {
        console.error("❌ Erro V3: Pendência não localizada.", { idProcurado, uidAlvo });
        Swal.fire({
            icon: 'error',
            title: 'Erro ao salvar',
            text: 'Não foi possível localizar o registro original na memória.',
            confirmButtonColor: '#800020'
        });
    }
}

function setItemStatusID(btn, status, uid) {
    // 1. GARANTIA DE OBJETO DE MEMÓRIA
    if (!window.itemStatus) window.itemStatus = {};
    if (!window.itemStatus[uid]) window.itemStatus[uid] = {};

    const isChecklist = window.isModoChecklist;
    const uidStr = String(uid);

    // ✅ NORMALIZAÇÃO PARA UID GLOBAL (DNA do Banco): 
    // Remove o sufixo de tombamento ou acessório para encontrar o ID da Família no inventário
    let uidGlobalFull = isChecklist ? "ITEM_VISTORIA_LIVRE" :
        (uidStr.includes('FAM-') ? uidStr.split('-').slice(0, 4).join('-') : uidStr.split('-')[0]);

    // 2. ATUALIZAÇÃO DO ESTADO EM MEMÓRIA
    window.itemStatus[uid] = {
        ...window.itemStatus[uid],
        status: status,
        interacao_humana: true,
        uid_global_ref: uidGlobalFull
    };

    // ✅ 3. LOCALIZAÇÃO DO ALVO VISUAL (Fiel ao novo ID Único)
    // Se vier de um acessório interno do Kit (_ac_), precisamos subir para o card pai.
    // Se for o ID Único (Com tombamento), o document.getElementById vai direto ao ponto.
    const uidCardFisico = uidStr.includes('_ac_') ? uidStr.split('_ac_')[0] : uidStr;
    const row = document.getElementById(`item-row-${uidCardFisico}`);

    // 4. LÓGICA DE ATUALIZAÇÃO VISUAL
    if (status === 'ok') {
        if (row) {
            // ✅ PINTURA ATÔMICA: Feedback visual instantâneo e garantido
            row.classList.remove('status-alert');
            row.classList.add('status-ok');

            row.style.setProperty('background-color', '#f0fdf4', 'important');
            row.style.setProperty('border-left', '6px solid #1b8a3e', 'important');

            const bCheck = row.querySelector('.btn-check');
            const bAlert = row.querySelector('.btn-alert');

            if (bCheck) bCheck.classList.add('active');
            if (bAlert) {
                bAlert.classList.remove('active', 'v3-pulse-orange');
                bAlert.style.backgroundColor = "";
            }

            // Sincroniza a barra neon superior
            if (typeof updateOverallStatus === 'function') {
                updateOverallStatus();
            }
        }

    } else if (status === 'cautela_ciente') {
        if (btn) {
            btn.innerHTML = '<i class="fas fa-check-double"></i> Ciente registrado';
            btn.disabled = true;
            btn.style.opacity = "0.8";
        }

        setTimeout(() => {
            if (typeof renderizarConferencia === 'function') renderizarConferencia();
            if (typeof updateOverallStatus === 'function') updateOverallStatus();
            // Avança o fluxo usando o UID físico normalizado
            if (typeof verificarFluxoSetor === 'function') verificarFluxoSetor(uidCardFisico);
        }, 400);
    }
}

// ✅ FUNÇÃO DE FEEDBACK PARA O MÓDULO DE FOTOS
function handlePhotoUploadClick() {
    // Usamos um alerta simples, mas informativo
    alert("📷 Módulo de Registro Fotográfico\n\n" +
        "Esta funcionalidade está em fase de integração com o servidor de arquivos (Storage).\n\n" +
        "Em breve, você poderá anexar até 5 fotos diretamente da câmera ou galeria para evidenciar o estado da viatura.");
}

// ✅ AJUSTE V3: Fechamento de Modal Dinâmico
function fecharModalPendencia() {
    // 1. Se estiver usando o sistema global do SIGMA:
    // sigmaModal.close(); 

    // 2. Se estiver usando a abordagem dinâmica pura:
    const modal = document.getElementById('modal-nova-pendencia');
    if (modal) {
        modal.classList.add('v3-modal-out'); // Animação de saída
        setTimeout(() => {
            modal.style.display = 'none'; // Ou modal.remove() se for 100% dinâmico
            // Limpa o scroll da página (caso tenha sido travado)
            document.body.style.overflow = 'auto';
        }, 300);
    }
}

// ✅ FUNÇÃO MANTER ATUALIZADA (Removido o texto "MANTIDO" sobreposto)
window.manterRelatoV3 = function (pendenciaId, uid, index) {
    const pId = String(pendenciaId);

    if (!window.itemStatus[uid]) window.itemStatus[uid] = { status: 'C/A', ids_mantidos: [], interacao_humana: true };
    if (!window.itemStatus[uid].ids_mantidos) window.itemStatus[uid].ids_mantidos = [];

    const indexId = window.itemStatus[uid].ids_mantidos.indexOf(pId);
    const jaMantido = indexId > -1;

    if (jaMantido) {
        window.itemStatus[uid].ids_mantidos.splice(indexId, 1);
    } else {
        window.itemStatus[uid].ids_mantidos.push(pId);
    }

    window.itemStatus[uid].interacao_humana = true;
    window.itemStatus[uid].status = 'C/A';

    // Atualiza o botão: O ícone passa a ser check-double quando mantido
    const btn = document.getElementById(`btn-manter-${index}`);
    if (btn) {
        btn.classList.toggle('active');
        btn.innerHTML = `<i class="fas ${!jaMantido ? 'fa-check-double' : 'fa-thumbtack'}"></i>`;

        // Efeito de clique no botão
        btn.style.transform = "scale(0.9)";
        setTimeout(() => btn.style.transform = "scale(1)", 100);
    }

    updateOverallStatus();
};

/* --- Registra que o conferente está ciente da Cautela (TRUG), liberando a conferência do item --- */
window.registrarCienteCautela = function(uid, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    if (!window.itemStatus[uid]) window.itemStatus[uid] = {};
    
    // Marca a interação humana e a flag de confirmação na memória
    window.itemStatus[uid].cautela_confirmada = true;
    window.itemStatus[uid].interacao_humana = true;

    // Atualiza visualmente o botão dentro do Modal (Muda de Apagado para Aceso)
    const btn = document.getElementById(`btn-ciente-${uid}`);
    if (btn) {
        btn.style.background = '#10b981'; // Verde sucesso
        btn.style.border = '2px solid #10b981';
        btn.style.color = 'white';
        btn.innerHTML = '<i class="fas fa-check-double"></i> CIENTE';
        
        // Efeito sutil de pulso ao clicar
        btn.style.transform = "scale(0.95)";
        setTimeout(() => btn.style.transform = "scale(1)", 150);
    }

    // Atualiza a barra neon de progresso ao fundo sem destruir o modal
    if (typeof updateOverallStatus === 'function') {
        updateOverallStatus();
    }
    
    console.log(`✅ [V3] Ciente registrado para o TRUG no item ${uid}. Modal permanece aberto aguardando CONCLUIR.`);
};
