/* --- A central de comando do item; exibe todas as pendências ativas de um material e oferece as opções de manter, resolver ou relatar um novo problema --- */
async function abrirModalPendenciaV3(uid, tipo, nomeItem, saldoDisponivel) {
    const isChecklist = window.isModoChecklist;
    const corPrimaria = isChecklist ? "#2c3e50" : "#800020";
    const nomeLimpo = nomeItem.replace(/\\'/g, "'");

    const fonteDados = window.dadosConferencia || dadosConferencia;
    let pendencias = [];

    // 1. LOCALIZA TODAS AS PENDÊNCIAS ATUAIS E HERDADAS
    fonteDados.forEach(setor => {
        setor.itens.forEach(it => {
            const isMatch = (it.uid_global === uid || it.id === uid);
            if (isMatch && it.pendencias_ids) pendencias = [...it.pendencias_ids];

            if (it.tombamentos) {
                it.tombamentos.forEach(t => {
                    const uidComp = `${it.uid_global || it.id}-${t.tomb}`;
                    if (uidComp === uid && t.pendencias_ids) pendencias = [...t.pendencias_ids];
                });
            }
        });
    });

    // 2. CONSTRUÇÃO DINÂMICA DOS CARDS DE PENDÊNCIA
    let htmlPendencias = "";
    pendencias.forEach((p, index) => {
        const isTemp = String(p.id).startsWith('TEMP-');
        const isMantido = window.itemStatus[uid]?.ids_mantidos?.includes(String(p.id));
        
        // ✅ NOVA LÓGICA: Identifica se o relato foi resolvido nesta sessão
        const isResolvido = p.status_gestao === 'RESOLVIDO';

        htmlPendencias += `
            <div class="v3-manage-card" style="background:${isResolvido ? '#f0fdf4' : (isTemp ? '#f0f9ff' : '#fff5f5')}; 
                 border:1px solid ${isResolvido ? '#bbf7d0' : (isTemp ? '#bae6fd' : '#ffcccc')}; 
                 padding:15px; border-radius:12px; margin-bottom:12px; position:relative; width: 100%; box-sizing: border-box; transition: 0.3s;
                 ${isResolvido ? 'opacity: 0.9;' : ''}">
                
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                    <div style="display:flex; flex-direction: column; gap:2px;">
                        <small style="color:${isResolvido ? '#166534' : '#64748b'}; font-weight:800; font-size:0.6em; text-transform:uppercase; letter-spacing:0.5px;">
                            ${isResolvido ? '✅ SOLUÇÃO REGISTRADA (AGUARDANDO ENVIO)' : (isTemp ? '✨ RELATO ATUAL' : '📜 RELATO ANTERIOR')}
                        </small>
                        <span style="font-size: 0.65em; font-weight: 900; color: ${isResolvido ? '#166534' : corPrimaria}; opacity: 0.8;">
                            ${p.quantidade} UNIDADE(S)
                        </span>
                    </div>
                    <div style="display:flex; gap:10px;">
                        ${isResolvido ? `
                            <div style="color: #166534; background: #dcfce7; padding: 5px 10px; border-radius: 8px; font-size: 0.7em; font-weight: bold;">
                                <i class="fas fa-check-double"></i> RESOLVIDO
                            </div>
                        ` : `
                            ${isTemp ? `
                                <button onclick="abrirModalEditar('${p.id}', '${uid}', ${p.quantidade}, '${p.descricao.replace(/'/g, "\\'")}')" class="v3-mini-btn" title="Editar"><i class="fas fa-pen"></i></button>
                                <button onclick="confirmarExclusaoRelato('${p.id}', '${uid}')" class="v3-mini-btn delete" title="Excluir"><i class="fas fa-trash"></i></button>
                            ` : `
                                <button id="btn-manter-${index}" onclick="manterID('${p.id}', '${uid}', ${index})" class="v3-action-icon ${isMantido ? 'active' : ''}" title="Manter Alteração">
                                    <i class="fas ${isMantido ? 'fa-check-double' : 'fa-thumbtack'}"></i>
                                </button>
                                <button onclick="abrirFormularioResolucaoV3(${JSON.stringify(p).replace(/"/g, '&quot;')}, '${uid}')" class="v3-action-icon resolver" title="Resolver">
                                    <i class="fas fa-wrench"></i>
                                </button>
                            `}
                        `}
                    </div>
                </div>

                <div style="font-weight:700; color:${isResolvido ? '#166534' : '#1e293b'}; font-size:0.95em; line-height:1.4; margin-bottom:10px; word-wrap: break-word; text-transform: uppercase; ${isResolvido ? 'text-decoration: line-through; opacity: 0.7;' : ''}">
                    ${p.descricao}
                </div>

                ${isResolvido ? `
                    <div style="font-size: 0.7em; color: #15803d; background: rgba(22, 101, 52, 0.05); padding: 8px; border-radius: 6px; border-left: 3px solid #166534;">
                        <b>SOLUÇÃO:</b> ${p.justificativa_solucao}
                    </div>
                ` : `
                    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(0,0,0,0.05); padding-top:8px;">
                        <span style="font-size:0.65em; color:#94a3b8; font-weight:600; text-transform: uppercase;">${p.autor_nome} • ${p.data_criacao}</span>
                    </div>
                `}
            </div>
        `;
    });

    // 3. DISPARO DO MODAL CENTRAL
    return Swal.fire({
        title: `<span style="color:${corPrimaria}; font-weight:700; letter-spacing:-0.5px;">GERENCIAR PENDÊNCIAS</span>`,
        width: '95%',
        padding: '1.5em 1em',
        html: `
            <div style="margin-bottom: 15px; text-align: center;">
                <small style="color: #64748b; font-weight: 700; text-transform: uppercase; font-size: 0.7em;"> ${nomeLimpo}</small>
            </div>

            <div id="v3-modal-scroll" style="text-align:left; max-height:45vh; overflow-y:auto; padding-right:2px; width: 100%; box-sizing: border-box;">
                ${htmlPendencias || '<p style="text-align:center; color:#94a3b8; padding:30px;">Nenhum relato encontrado.</p>'}
            </div>
            
            <div style="display: flex; gap: 10px; margin-top: 25px; width: 100%;">
                
                ${(tipo === 'single' && (isChecklist || saldoDisponivel > 0)) ? `
                    <button onclick="exibirModalInsercaoNovoRelato('${uid}', '${tipo}', '${nomeItem}', ${saldoDisponivel}, '${corPrimaria}')" 
                            style="flex: 1; background: #0284c7; color: white; border: none; padding: 12px 5px; border-radius: 10px; font-weight: 800; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: all 0.2s;">
                        <i class="fas fa-plus-circle"></i> NOVO RELATO
                    </button>
                ` : ''}

                <button onclick="Swal.clickConfirm()" 
                        style="flex: 1; background: ${corPrimaria}; color: white; border: none; padding: 12px 5px; border-radius: 10px; font-weight: 800; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: all 0.2s;">
                    <i class="fas fa-check-circle"></i> CONCLUIR
                </button>
            </div>
        `,
        showConfirmButton: false, // ✅ Agora usamos nossos botões customizados lado a lado
        allowOutsideClick: false,
        customClass: {
            container: 'sigma-v3-modal',
            popup: 'v3-popup-radius'
        },
        // ✅ VERIFICAÇÃO DE FLUXO AO CONCLUIR (Disparado pelo clickConfirm nosso)
        preConfirm: () => {
            try {
                const status = window.itemStatus[uid];
                if (!status || !status.interacao_humana) {
                    Swal.showValidationMessage('Interaja com os relatos antes de concluir.');
                    return false;
                }

                // ✅ Escrita síncrona imediata
                window.itemStatus[uid].status = 'ok';
                
                if (typeof updateOverallStatus === 'function') {
                    updateOverallStatus();
                }

                // Retornamos o UID para o próximo passo
                return { confirmado: true, uid: uid };
            } catch (e) {
                console.error("Erro no preConfirm:", e);
                return true; 
            }
        },
        // ✅ O SEGREDO: Usamos o callback de fechamento do Swal.fire().then(...)
        // mas mantemos o didClose apenas para limpeza de UI se necessário.
        didClose: () => {
            console.log("=== MODAL FECHADO (UI LIMPA) ===");
        }
    }).then((result) => {
        // Se o usuário clicou em "Concluir" (Confirmou)
        if (result.isConfirmed) {
            console.log("%c[FLUXO] Navegação disparada após fechamento real.", "color: #10b981; font-weight: bold;");
            
            // Pequeno delay apenas para garantir que o overlay sumiu da frente dos olhos
            setTimeout(() => {
                const funcFluxo = window.verificarFluxoSetor || verificarFluxoSetor;
                if (typeof funcFluxo === 'function') {
                    funcFluxo(uid);
                } else {
                    // Fallback de emergência (Navegação manual)
                    document.body.classList.remove('modo-inspecao');
                    const pSetores = document.getElementById('v3-painel-setores');
                    const pItens = document.getElementById('v3-painel-itens');
                    if (pSetores) pSetores.style.display = 'block';
                    if (pItens) pItens.style.display = 'none';
                }
            }, 150);
        }
    });
}

/* --- Abre o formulário para o militar descrever uma nova avaria ou falta, controlando a quantidade e a descrição técnica --- */
async function exibirModalInsercaoNovoRelato(uid, tipo, nomeItem, saldoDisponivel, corPrimaria) {
    const isChecklist = window.isModoChecklist;

    const { value: formValues } = await Swal.fire({
        title: `<span style="color:${corPrimaria}; font-weight:900; letter-spacing:-0.5px;">RELATAR ALTERAÇÃO</span>`,
        width: '95%',
        padding: '1.5em 1em',
        html: `
            <div style="text-align:left; width: 100%; box-sizing: border-box; font-family: 'Inter', sans-serif;">
                
                <div style="margin-bottom: 20px; text-align: center;">
                    <b style="color: #475569; font-size: 0.9em; text-transform: uppercase;">${nomeItem}</b>
                </div>

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

            const inputQtd = document.getElementById('swal-qtd');
            if (inputQtd) {
                inputQtd.addEventListener('input', (e) => {
                    if (parseInt(e.target.value) > saldoDisponivel) e.target.value = saldoDisponivel;
                });
            }
        },
        preConfirm: () => {
            const obs = document.getElementById('swal-obs').value.trim();
            const qtdInput = document.getElementById('swal-qtd');
            const qtd = isChecklist ? 1 : (qtdInput ? parseInt(qtdInput.value) : 1);

            if (obs.length < 5) return Swal.showValidationMessage("A descrição deve ser mais detalhada.");
            if (!isChecklist && tipo === 'single' && (qtd < 1 || qtd > saldoDisponivel)) {
                return Swal.showValidationMessage(`Saldo insuficiente (Máx: ${saldoDisponivel})`);
            }

            return { qtd, obs };
        }
    });

    if (formValues) {
        // 1. Executa o salvamento
        salvarNovoID(uid, formValues.qtd, tipo, formValues.obs);

        // 2. DIRECIONAMENTO CIRÚRGICO: Reabre o modal de gerenciamento atualizado
        // O timeout de 300ms garante que o DOM local já processou a inclusão do novo item
        setTimeout(() => {
            abrirModalPendenciaV3(uid, tipo, nomeItem, (saldoDisponivel - formValues.qtd));
        }, 300);
    }
}

/* --- Abre a interface para que o conferente registre como um problema antigo foi sanado, exigindo a justificativa da solução--- */
async function abrirFormularioResolucaoV3(pendencia, uid) {
    const isChecklist = window.isModoChecklist;
    const corSucesso = "#1b8a3e"; // Verde Sigma
    const corCancel = "#64748b"; // Cinza Slate
    
    // Captura dados do item para o retorno em caso de cancelamento
    const itRef = buscarDadosItemPeloUid(uid);
    const nomeItem = itRef ? itRef.nome : (pendencia.itemNome || "Material");

    const { value: resolucao } = await Swal.fire({
        title: `<span style="color: ${corSucesso}; font-weight: 800; letter-spacing: -0.5px;">RESOLVER ALTERAÇÃO</span>`,
        width: '95%',
        padding: '1.5em 1em',
        html: `
            <div style="text-align: center; margin-bottom: 20px;">
                <small style="color: #64748b; font-weight: 700; text-transform: uppercase; font-size: 0.7em; letter-spacing: 1px;">
                    ${pendencia.descricao}
                </small>
            </div>

            <div style="text-align: left; font-family: sans-serif;">
                
                ${!isChecklist ? `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
                    <label style="font-weight: 800; font-size: 0.75rem; color: #475569; text-transform: uppercase; margin: 0;">
                        Unidades Resolvidas:
                    </label>
                    <input id="swal-res-qtd" type="number" value="${pendencia.quantidade}" min="1" max="${pendencia.quantidade}" 
                           style="width: 70px; border: 2px solid ${corSucesso}; border-radius: 8px; padding: 5px; text-align: center; font-weight: 900; color: ${corSucesso}; outline: none;">
                </div>
                ` : ''}

                <label style="display: block; font-weight: 800; font-size: 0.75rem; color: #475569; text-transform: uppercase; margin-bottom: 8px; margin-left: 5px;">
                    Justificativa da Solução:
                </label>
                <textarea id="swal-res-obs" placeholder="DESCREVA COMO O PROBLEMA FOI SANADO..." 
                          style="width: 100%; height: 120px; border: 2px solid #cbd5e1; border-radius: 12px; padding: 12px; font-size: 0.9rem; text-transform: uppercase; box-sizing: border-box; outline: none; transition: border-color 0.3s;"></textarea>
            </div>

            <div style="display: flex; gap: 10px; margin-top: 25px; width: 100%;">
                <button id="btn-cancelar-res" style="flex: 1; background: ${corCancel}; color: white; border: none; padding: 15px; border-radius: 10px; font-weight: 800; font-size: 0.8rem; cursor: pointer; text-transform: uppercase;">
                    <i class="fas fa-arrow-left"></i> VOLTAR
                </button>
                <button id="btn-confirmar-res" style="flex: 1; background: ${corSucesso}; color: white; border: none; padding: 15px; border-radius: 10px; font-weight: 800; font-size: 0.8rem; cursor: pointer; text-transform: uppercase; display: flex; align-items: center; justify-content: center; gap: 5px;">
                    <i class="fas fa-check"></i> RESOLVER
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
            // Foco automático na justificativa
            const textarea = document.getElementById('swal-res-obs');
            if (textarea) textarea.focus();

            // Mapeamento dos botões customizados
            document.getElementById('btn-cancelar-res').onclick = () => Swal.close();
            document.getElementById('btn-confirmar-res').onclick = () => {
                const obs = document.getElementById('swal-res-obs').value.trim();
                if (obs.length < 5) {
                    Swal.showValidationMessage("Descreva a solução (mín. 5 letras)");
                    return;
                }
                Swal.clickConfirm();
            };
        },
        preConfirm: () => {
            const obs = document.getElementById('swal-res-obs').value.trim();
            const qtdInput = document.getElementById('swal-res-qtd');
            const qtd = isChecklist ? pendencia.quantidade : (qtdInput ? qtdInput.value : pendencia.quantidade);

            return {
                qtd: parseInt(qtd),
                obs: obs.toUpperCase()
            };
        }
    });

    if (resolucao) {
        // Executa a lógica de banco
        resolverID(pendencia.id, uid, resolucao.qtd, resolucao.obs);
    } else {
        // Se cancelar ou voltar, mantém o loop do Passo 3 reabrindo o modal pai
        abrirModalPendenciaV3(uid, itRef ? itRef.tipo : 'single', nomeItem, itRef ? itRef.saldo : 0);
    }
}

/* --- Permite ao usuário corrigir um relato feito na mesma sessão antes de finalizar a conferência --- */
async function abrirModalEditar(pendenciaId, uid, qtdAtual, descricaoAtual) {
    const corEdicao = "#2196F3";
    const uidString = String(uid);
    const isChecklist = window.isModoChecklist;

    // Buscamos o nome do item para manter o contexto no título/subtítulo
    const dadosItem = buscarDadosItemPeloUid(uidString);
    const nomeItem = dadosItem ? dadosItem.nome : "Item";

    const { value: formValues, dismiss } = await Swal.fire({
        title: `<span style="color: ${corEdicao}; font-size: 0.9em; font-weight: bold;"><i class="fas fa-edit"></i> Editar Relato</span>`,
        width: '95%',
        padding: '1em',
        html: `
            <div style="text-align: left; font-family: sans-serif; width: 100%; box-sizing: border-box;">
                <p style="margin-bottom: 15px; font-size: 0.85em; color: #666; text-align: center;"><b>${nomeItem}</b></p>
                
                ${!isChecklist ? `
                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-weight: bold; font-size: 0.85em; color: #666;">Quantidade:</label>
                    <input id="swal-input-qtd" type="number" class="swal2-input" value="${qtdAtual}" min="1" 
                           style="width: 100%; margin: 5px 0 0 0; height: 40px; box-sizing: border-box;">
                </div>
                ` : ''}

                <label style="display: block; font-weight: bold; font-size: 0.85em; color: #666;">Nova Descrição:</label>
                <textarea id="swal-input-obs" class="swal2-textarea" placeholder="Descreva a alteração..." 
                          style="width: 100%; margin: 5px 0 0 0; min-height: 100px; text-transform: uppercase; font-size: 0.9em; box-sizing: border-box;">${descricaoAtual}</textarea>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'SALVAR ALTERAÇÕES',
        cancelButtonText: 'VOLTAR',
        confirmButtonColor: corEdicao,
        reverseButtons: true,
        backdrop: `rgba(15, 23, 42, 0.6)`, // Isola visualmente o modal de edição
        allowOutsideClick: false,
        didOpen: () => {
            const input = document.getElementById('swal-input-obs');
            if (input) {
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
            }
        },
        preConfirm: () => {
            const obs = document.getElementById('swal-input-obs').value;
            const qtdInput = document.getElementById('swal-input-qtd');
            const qtd = isChecklist ? 1 : (qtdInput ? qtdInput.value : 1);

            if (!obs || obs.trim().length < 5) {
                Swal.showValidationMessage('A descrição deve ter pelo menos 5 caracteres');
                return false;
            }
            return { qtd: parseInt(qtd), obs: obs.trim().toUpperCase() };
        }
    });

    // Se confirmou a edição
    if (formValues) {
        // Executa a edição na memória
        executarEdicaoRelato(pendenciaId, uidString, formValues.qtd, formValues.obs);
        
        // ✅ GARANTIA DE RETORNO APÓS EDIÇÃO
        setTimeout(() => {
            abrirModalPendenciaV3(uidString, isChecklist ? 'single' : 'multi', nomeItem, (dadosItem ? dadosItem.saldo : 0));
        }, 500); // Delay ligeiramente maior para o DOM respirar
    } 
    else if (dismiss === Swal.DismissReason.cancel) {
        // ✅ RETORNO AO CANCELAR
        setTimeout(() => {
            abrirModalPendenciaV3(uidString, isChecklist ? 'single' : 'multi', nomeItem, (dadosItem ? dadosItem.saldo : 0));
        }, 100);
    }
}

/* --- Gera o alerta de segurança para deletar uma alteração recém-lançada --- */
async function confirmarExclusaoRelato(pendenciaId, uid) {
    const uidAlvo = String(uid);
    const itRef = buscarDadosItemPeloUid(uidAlvo);

    const result = await Swal.fire({
        title: 'Apagar Alteração?',
        text: "Esta ação removerá o relato selecionado da memória.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: '<i class="fas fa-trash-alt"></i> SIM, APAGAR',
        cancelButtonText: 'CANCELAR',
        reverseButtons: true,
        backdrop: `rgba(15, 23, 42, 0.6)` // Isolamento visual V3
    });

    // ✅ UX: Se cancelar, volta para o modal de gerenciamento mantendo o fluxo
    if (!result.isConfirmed) {
        if (itRef) {
            abrirModalPendenciaV3(uidAlvo, itRef.tipo, itRef.nome, itRef.saldo);
        }
        return;
    }

    const fonteDados = window.dadosConferencia || [];
    let excluido = false;
    let infoParaRetorno = { nome: itRef?.nome || "Item", tipo: itRef?.tipo || "single", saldo: 0, restantes: 0 };

    fonteDados.forEach(setor => {
        setor.itens.forEach(item => {
            let alvos = (item.tipo === 'multi' && item.tombamentos) ? item.tombamentos : [item];
            alvos.forEach(alvo => {
                const isMatch = (item.id === uidAlvo || item.uid_global === uidAlvo || `${item.id}-${alvo.tomb}` === uidAlvo || `${item.uid_global}-${alvo.tomb}` === uidAlvo);
                
                if (isMatch && alvo.pendencias_ids) {
                    const index = alvo.pendencias_ids.findIndex(p => String(p.id) === String(pendenciaId));

                    if (index > -1) {
                        alvo.pendencias_ids.splice(index, 1);
                        excluido = true;

                        infoParaRetorno.restantes = alvo.pendencias_ids.length;
                        const totalEsperado = Number(item.quantidadeEsperada || item.quantidade || 1);
                        const totalLancado = alvo.pendencias_ids.reduce((s, pnd) => s + (pnd.quantidade || 0), 0);
                        infoParaRetorno.saldo = totalEsperado - totalLancado;

                        // ✅ REGRA PASSO 3: Se apagou tudo, reseta a Interação Humana
                        // O item volta a ser "pendente de conferência" real.
                        if (alvo.pendencias_ids.length === 0) {
                            delete window.itemStatus[uidAlvo];
                            
                            const elItem = document.getElementById(`item-row-${uidAlvo}`);
                            if (elItem) {
                                elItem.classList.remove('status-alert', 'status-ok', 'has-carimbo');
                                const btnAlert = elItem.querySelector('.btn-alert');
                                const btnCheck = elItem.querySelector('.btn-check');
                                if (btnAlert) btnAlert.classList.remove('active', 'v3-pulse-orange');
                                if (btnCheck) btnCheck.classList.remove('active');
                            }
                        }
                    }
                }
            });
        });
    });

    if (excluido) {
        updateOverallStatus();

        // ✅ FEEDBACK E RETORNO SINCRONIZADO
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 1500
        });

        Toast.fire({ icon: 'success', title: 'Relato removido' });

        // Espera o Toast e o modal de confirmação sumirem totalmente
        setTimeout(() => {
            // Reabre o gerenciador se ainda houver o que gerenciar
            // Se não houver mais nada, o sistema naturalmente volta para a tela de itens
            if (infoParaRetorno.restantes > 0) {
                abrirModalPendenciaV3(uidAlvo, infoParaRetorno.tipo, infoParaRetorno.nome, infoParaRetorno.saldo);
            }
        }, 600); 
    }
}

/* --- Função de apoio que gera o objeto de pendência (TEMP-...) com carimbo de autoria e insere na memória do sistema --- */
function salvarNovoID(uid, qtd, tipo, obsModal = null) {
    const obsDigitada = obsModal ? obsModal.trim().toUpperCase() : "";
    const qtdInformada = parseInt(qtd) || 1;
    const militarInfoEl = document.getElementById('militar-info');

    // 1. CAPTURA DE ASSINATURA SEGURA (Hierarquia: Elemento UI > Global config)
    let nomeAssinatura = militarInfoEl ? militarInfoEl.innerText.split('\n')[0].replace('Conferente:', '').trim() : "";
    if (!nomeAssinatura) {
        nomeAssinatura = `${window.userInfo.postoGraduacao} ${window.userInfo.quadro} ${window.userInfo.nomeGuerra}`;
    }

    // 2. CRIAÇÃO DO OBJETO DE PENDÊNCIA TEMPORÁRIA
    const novoID = {
        id: "TEMP-" + Date.now(),
        tipo: "PENDENCIA",
        data_criacao: new Date().toLocaleDateString('pt-BR'),
        autor_uid: String(window.userInfo.uid || "S_UID"),
        autor_nome: nomeAssinatura,
        descricao: obsDigitada,
        quantidade: qtdInformada,
        status_gestao: "PENDENTE"
    };

    let itemEncontrado = false;
    const fonteDados = window.dadosConferencia || [];

    // 3. BUSCA E INSERÇÃO NO DATASET EM MEMÓRIA
    fonteDados.forEach(setor => {
        setor.itens.forEach(item => {
            const isChecklist = window.isModoChecklist;
            const idRealDoItem = isChecklist ? item.id : (item.uid_global || item.id);
            const matchesID = (String(idRealDoItem) === String(uid));

            if (['single', 'texto_livre', 'upload_foto'].includes(item.tipo) && matchesID) {
                if (!item.pendencias_ids) item.pendencias_ids = [];
                item.pendencias_ids.push(novoID);
                itemEncontrado = true;
            }
            else if (item.tipo === 'multi' && item.tombamentos) {
                item.tombamentos.forEach(t => {
                    const uidComposto = `${item.uid_global || item.id}-${t.tomb}`;
                    if (String(uid) === uidComposto) {
                        if (!t.pendencias_ids) t.pendencias_ids = [];
                        t.pendencias_ids.push(novoID);
                        itemEncontrado = true;
                    }
                });
            }
        });
    });

    if (itemEncontrado) {
        // 4. ATUALIZAÇÃO DO ESTADO DE INTERAÇÃO (DNA V3 - OBRIGATÓRIO PARA O PASSO 3)
        const uidStr = String(uid);
        const uidGlobalFull = uidStr.includes('FAM-') ? uidStr.split('-').slice(0, 4).join('-') : uidStr.split('-')[0];

        window.itemStatus[uid] = {
            ...window.itemStatus[uid],
            status: 'C/A',
            interacao_humana: true, // Libera a trava de segurança do modal
            obs: obsDigitada,
            quantidade: qtdInformada,
            uid_global_ref: uidGlobalFull
        };

        // 5. FEEDBACK VISUAL NA LINHA (TELA 2 AO FUNDO)
        const row = document.getElementById(`item-row-${uid}`);
        if (row) {
            row.classList.remove('status-ok');
            row.classList.add('status-alert');

            const btnAlert = row.querySelector('.btn-alert');
            const btnCheck = row.querySelector('.btn-check');
            if (btnAlert) {
                btnAlert.classList.add('active');
                btnAlert.classList.remove('v3-pulse-orange'); // Para de pulsar pois já houve interação
                btnAlert.style.backgroundColor = ""; 
            }
            if (btnCheck) btnCheck.classList.remove('active');

            row.style.backgroundColor = "#fff9c4"; // Destaque amarelo momentâneo
            setTimeout(() => row.style.backgroundColor = "", 1000);
        }

        // 6. ATUALIZAÇÃO SÍNCRONA DE BADGES E PROGRESSO
        updateOverallStatus();

        console.log("✅ Novo relato salvo e interação humana registrada.");

    } else {
        console.error("V3 Error: Falha ao vincular relato ao item.", { uid });
        Swal.fire("Erro", "Não foi possível vincular o relato ao item selecionado.", "error");
    }
}

/* --- Processa a baixa de uma pendência na memória, movendo o saldo de "pendente" para "ok" e registrando o histórico de solução --- */
function resolverID(pendenciaId, uid, qtdResolvidaModal, justificativaModal) {
    const qtdResolvida = parseInt(qtdResolvidaModal) || 1;
    const justificativa = justificativaModal ? justificativaModal.trim().toUpperCase() : "";
    const nomeResolutor = `${window.userInfo.postoGraduacao} ${window.userInfo.quadro} ${window.userInfo.nomeGuerra}`;
    const fonteDados = window.dadosConferencia || [];
    const isChecklist = window.isModoChecklist;
    let acaoConcluida = false;
    let pendenciasRestantes = 0;
    let itemContexto = null; 

    const idProcurado = String(pendenciaId);
    const isResolvendoAvaria = idProcurado.startsWith('AVARIA-');

    // --- LÓGICA DE BAIXA NO OBJETO (REVISADA) ---
    function executarBaixaNoObjeto(obj) {
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
        pendenciasRestantes = obj.pendencias_ids.filter(p => p.status_gestao !== 'RESOLVIDO').length;
        return true;
    }

    // --- BUSCA E APLICAÇÃO ---
    fonteDados.forEach(setor => {
        setor.itens.forEach(item => {
            const idRealDoItem = isChecklist ? item.id : (item.uid_global || item.id);
            const isMatch = (String(idRealDoItem) === String(uid));

            if (isMatch) {
                itemContexto = item;
                acaoConcluida = executarBaixaNoObjeto(item);
            } else if (item.tombamentos) {
                item.tombamentos.forEach(t => {
                    const uidComposto = `${item.uid_global || item.id}-${t.tomb}`;
                    if (String(uid) === uidComposto) {
                        itemContexto = item;
                        acaoConcluida = executarBaixaNoObjeto(t);
                    }
                });
            }
        });
    });

    if (acaoConcluida) {
        // ✅ REFORÇO DE MEMÓRIA: Sincronização prévia
        if (!window.itemStatus[uid]) window.itemStatus[uid] = {};
        
        const uidStr = String(uid);
        let uidGlobalFull = isChecklist ? "ITEM_VISTORIA_LIVRE" : (uidStr.includes('FAM-') ? uidStr.split('-').slice(0, 4).join('-') : uidStr.split('-')[0]);

        window.itemStatus[uid].status = 'C/A';
        window.itemStatus[uid].interacao_humana = true;
        window.itemStatus[uid].uid_global_ref = uidGlobalFull;

        if (window.itemStatus[uid].ids_mantidos) {
            window.itemStatus[uid].ids_mantidos = window.itemStatus[uid].ids_mantidos.filter(id => String(id) !== idProcurado);
        }

        // Feedback visual na linha
        const row = document.getElementById(`item-row-${uid}`);
        if (row) {
            row.style.backgroundColor = "#dcfce7";
            setTimeout(() => row.style.backgroundColor = "", 1500);
        }

        // ✅ FECHAMENTO LIMPO: Destruímos o modal de justificativa
        Swal.close();

        // ✅ REABERTURA CONTROLADA: Aumentamos o delay para 500ms para estabilizar o DOM
        setTimeout(async () => {
            // Sincronizamos a barra antes de abrir o próximo modal
            if (typeof updateOverallStatus === 'function') updateOverallStatus();

            const itRef = buscarDadosItemPeloUid(uid);
            const nomeParaModal = itRef ? itRef.nome : (itemContexto ? itemContexto.nome : "Item");
            const saldoParaModal = itRef ? itRef.saldo : 0;

            // Reabre o gerenciador (prioridade para o escopo window)
            const abrirModal = window.abrirModalPendenciaV3 || abrirModalPendenciaV3;
            if (typeof abrirModal === 'function') {
                await abrirModal(uid, itemContexto.tipo, nomeParaModal, saldoParaModal);
            }
            
            // Notificação de sucesso
            Swal.mixin({ 
                toast: true, 
                position: 'top-end', 
                showConfirmButton: false, 
                timer: 2000 
            }).fire({ icon: 'success', title: 'Solução registrada!' });

        }, 500); 

    } else {
        Swal.fire('Erro', 'Não foi possível localizar o registro.', 'error');
    }
}

/* --- Registra que uma pendência antiga foi vista e continua existindo, garantindo a rastreabilidade do item --- */
function manterID(pendenciaId, uid, index) {
    // 1. GARANTE A EXISTÊNCIA DO OBJETO E DNA DO ITEM NA MEMÓRIA
    if (!window.itemStatus[uid]) {
        window.itemStatus[uid] = {
            status: 'C/A',
            ids_mantidos: [],
            interacao_humana: true
        };
    }

    if (!window.itemStatus[uid].ids_mantidos) {
        window.itemStatus[uid].ids_mantidos = [];
    }

    // 2. REGISTRO DO ID MANTIDO (DNA SEGURO)
    const idStr = String(pendenciaId);
    if (!window.itemStatus[uid].ids_mantidos.includes(idStr)) {
        window.itemStatus[uid].ids_mantidos.push(idStr);
    }

    // 3. ATUALIZAÇÃO DO ESTADO GLOBAL DO ITEM (DNA V3)
    window.itemStatus[uid].status = 'C/A';
    window.itemStatus[uid].interacao_humana = true;

    // VÍNCULO COM O UID GLOBAL COMPLETO
    if (!window.itemStatus[uid].uid_global_ref) {
        const uidStr = String(uid);
        const isChecklist = window.isModoChecklist;
        const uidGlobalFull = isChecklist ? "ITEM_VISTORIA_LIVRE" : (uidStr.includes('FAM-') ? uidStr.split('-').slice(0, 4).join('-') : uidStr.split('-')[0]);
        window.itemStatus[uid].uid_global_ref = uidGlobalFull;
    }

    // ✅ 4. FEEDBACK VISUAL NO BOTÃO DENTRO DO MODAL
    const btnModal = document.getElementById(`btn-manter-${index}`);
    if (btnModal) {
        btnModal.classList.add('active'); // Faz o botão "acender" (Verde via CSS)
        const icon = btnModal.querySelector('i');
        if (icon) {
            icon.className = 'fas fa-check-double'; // Troca o ícone para check duplo
        }
        
        // Pequena animação de "click" no botão do modal
        btnModal.style.transform = "scale(1.2)";
        setTimeout(() => btnModal.style.transform = "scale(1)", 200);
    }

    // 5. FEEDBACK VISUAL NA LINHA (TELA 2 AO FUNDO)
    const row = document.getElementById(`item-row-${uid}`);
    if (row) {
        row.classList.remove('status-ok');
        row.classList.add('status-alert');

        const btnAlert = row.querySelector('.btn-alert');
        if (btnAlert) {
            btnAlert.classList.add('active');
            btnAlert.classList.remove('v3-pulse-orange');
            btnAlert.style.backgroundColor = ""; 
        }

        row.style.transition = "transform 0.2s ease, background-color 0.3s ease";
        row.style.transform = "scale(1.02)";
        row.style.backgroundColor = "rgba(245, 124, 0, 0.1)"; 
        
        setTimeout(() => {
            row.style.transform = "scale(1)";
            row.style.backgroundColor = "";
        }, 300);
    }

    console.log(`✅ Pendência ${idStr} mantida e interface atualizada.`);
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

function executarEdicaoRelato(pendenciaId, uid, novaQtd, novaObs) {
    const fonteDados = window.dadosConferencia || dadosConferencia;
    let editado = false;
    const idProcurado = String(pendenciaId);
    const uidAlvo = String(uid);

    // Variáveis para garantir a reabertura correta do modal
    let nomeParaModal = "";
    let tipoParaModal = "single";
    let saldoParaModal = 0;

    fonteDados.forEach(setor => {
        setor.itens.forEach(item => {
            let alvosParaVerificar = (item.tipo === 'multi' && item.tombamentos) ? item.tombamentos : [item];

            alvosParaVerificar.forEach(alvo => {
                if (alvo.pendencias_ids && Array.isArray(alvo.pendencias_ids)) {
                    const p = alvo.pendencias_ids.find(pend => String(pend.id) === idProcurado);
                    if (p) {
                        p.descricao = novaObs.trim().toUpperCase();
                        p.quantidade = parseInt(novaQtd) || 0;
                        editado = true;

                        // Captura metadados para o retorno exato
                        nomeParaModal = item.nome + (item.tipo === 'multi' ? ` (${alvo.tomb})` : "");
                        tipoParaModal = item.tipo;

                        const totalEsperado = Number(item.quantidadeEsperada || item.quantidade || 1);
                        const totalLancado = alvo.pendencias_ids.reduce((s, pnd) => s + (pnd.quantidade || 0), 0);
                        saldoParaModal = totalEsperado - totalLancado;

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

    if (editado) {
        // Atualiza a interface de fundo
        renderizarConferencia();
        updateOverallStatus();

        // ✅ CORREÇÃO CIRÚRGICA: Limpa o alerta de sucesso anterior e reabre o gerenciador
        Swal.close();

        setTimeout(() => {
            // Reabre o modal de gerenciamento com os dados atualizados
            abrirModalPendenciaV3(uidAlvo, tipoParaModal, nomeParaModal, saldoParaModal);

            // Toast de confirmação discreto sobreposto ao modal reaberto
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000,
                timerProgressBar: true
            });
            Toast.fire({ icon: 'success', title: 'Relato atualizado!' });
        }, 150); // Delay reduzido para maior fluidez

    } else {
        console.error("V3 Error: Pendência " + idProcurado + " não encontrada.");
        Swal.fire({
            icon: 'error',
            title: 'Erro ao salvar',
            text: 'O registro original não foi localizado na memória.',
            confirmButtonColor: '#800020'
        });
    }
}

function setItemStatusID(btn, status, uid) {
    // 1. GARANTIA DE OBJETO DE MEMÓRIA
    if (!window.itemStatus[uid]) window.itemStatus[uid] = {};

    const isChecklist = window.isModoChecklist;
    const uidStr = String(uid);

    // ✅ AJUSTE V3: Definição inteligente da referência global
    // Se for checklist, a referência global é o ID genérico. Se não, extrai o ID do inventário.
    let uidGlobalFull = "";
    if (isChecklist) {
        uidGlobalFull = "ITEM_VISTORIA_LIVRE";
    } else {
        uidGlobalFull = uidStr.includes('FAM-') ? uidStr.split('-').slice(0, 4).join('-') : uidStr.split('-')[0];
    }

    // 2. LÓGICA DE ATUALIZAÇÃO POR STATUS
    if (status === 'ok') {
        window.itemStatus[uid] = {
            ...window.itemStatus[uid],
            status: 'ok',
            interacao_humana: true,
            uid_global_ref: uidGlobalFull
        };

        const row = document.getElementById(`item-row-${uid}`);
        if (row) {
            row.classList.remove('status-alert');
            row.classList.add('status-ok');

            const btnCheck = row.querySelector('.btn-check');
            const btnAlert = row.querySelector('.btn-alert');
            if (btnCheck) btnCheck.classList.add('active');
            if (btnAlert) btnAlert.classList.remove('active');

            // Remove o fundo de alerta caso existisse
            row.style.backgroundColor = "";
        }

        verificarFluxoSetor(uid);

    } else if (status === 'cautela_ciente') {
        window.itemStatus[uid] = {
            ...window.itemStatus[uid],
            status: 'cautela_ciente',
            cautela_confirmada: true,
            interacao_humana: true,
            uid_global_ref: uidGlobalFull
        };

        btn.innerHTML = '<i class="fas fa-check-double"></i> Ciente registrado';
        btn.disabled = true;
        btn.style.opacity = "0.8";

        setTimeout(() => {
            renderizarConferencia();
            updateOverallStatus();
            verificarFluxoSetor(uid);
        }, 400);
    }

    // 3. ATUALIZAÇÃO DO PROGRESSO (Barra Neon e Badges da Tela 1)
    updateOverallStatus();
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
