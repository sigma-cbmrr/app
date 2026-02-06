/* --- Carrega os dados remotos do Firestore conforme parâmetros da URL ---*/
async function carregarDadosRemotos() {
    // 1. CAPTURA IMEDIATA E HIGIENIZAÇÃO DE PARÂMETROS
    const urlParamsLocal = new URLSearchParams(window.location.search);
    const idUrl = urlParamsLocal.get('id');
    const cautelaIdUrl = urlParamsLocal.get('cautelaId');
    const modoUrl = urlParamsLocal.get('modo');
    const transferenciaIdUrl = urlParamsLocal.get('transferenciaId');

    // 2. DEFINIÇÃO DO MODO E ID ALVO
    let ID_ALVO = transferenciaIdUrl || cautelaIdUrl || idUrl;

    if (modoUrl === 'checklist_vtr' && ID_ALVO && !ID_ALVO.startsWith('CHECKLIST_VTR_')) {
        ID_ALVO = 'CHECKLIST_VTR_' + ID_ALVO;
    }

    if (!ID_ALVO || ID_ALVO === "null") {
        console.error("SIGMA: ID_ALVO inválido.");
        return;
    }

    const loadingMsg = document.getElementById('loading-message');
    const btnFinalizar = document.getElementById('btn-finalizar');

    try {
        let docData = null;
        let colecaoEncontrada = "";

        // --- 3. MOTOR DE BUSCA AUTÔNOMO (DNA V3) ---
        // Resolve o erro de 'modo null' procurando o ID em todas as gavetas possíveis
        const colecoesParaTestar = ['listas_checklist', 'listas_conferencia', 'cautelas_abertas', 'transferencias_pendentes'];

        for (const colecao of colecoesParaTestar) {
            const doc = await db.collection(colecao).doc(ID_ALVO).get();
            if (doc.exists) {
                docData = doc.data();
                colecaoEncontrada = colecao;
                break;
            }
        }

        if (!docData) throw new Error(`Documento ${ID_ALVO} não localizado no banco.`);

        // --- 4. IDENTIFICAÇÃO AUTOMÁTICA DE MODO ---
        window.isModoChecklist = (colecaoEncontrada === 'listas_checklist' || docData.tipo === 'checklist_viatura');
        const isRecebimentoCarga = (colecaoEncontrada === 'transferencias_pendentes');
        const isCautelaLocal = (colecaoEncontrada === 'cautelas_abertas');
        const isDevolucaoFinal = modoUrl === 'devolucao_final';

        if (isRecebimentoCarga) window.dadosTransferencia = docData;

        // --- 5. IDENTIDADE DO CONFERENTE (BACK-END) ---
        userInfo.postoGraduacao = urlParamsLocal.get('posto_grad') || "ND";
        userInfo.quadro = urlParamsLocal.get('quadro') || "ND";
        userInfo.nomeGuerra = urlParamsLocal.get('nome_guerra') || "ND";
        userInfo.uid = urlParamsLocal.get('user_uid') || "ND";

        // --- 6. BUSCA REVERSA: HERANÇA DE PENDÊNCIAS (CRÍTICO) ---
        let pendenciasHerdadas = {};
        if (!isCautelaLocal && !isRecebimentoCarga) {
            const colecaoResultados = window.isModoChecklist ? 'resultados_checklist' : 'resultados_conferencias';
            const ultimaConfQuery = await db.collection(colecaoResultados)
                .where('lista_id', '==', ID_ALVO)
                .orderBy('timestamp', 'desc')
                .limit(1)
                .get();

            if (!ultimaConfQuery.empty) {
                const ultimoResultado = ultimaConfQuery.docs[0].data();
                (ultimoResultado.itensRelatorio || []).forEach(itemRel => {
                    const idBusca = itemRel.id || itemRel.uid_global;
                    if (itemRel.status === 'C/A' && itemRel.pendencias_ids && idBusca) {
                        pendenciasHerdadas[idBusca] = itemRel.pendencias_ids;
                    }
                });
            }
        }

        // --- 7. PROCESSAMENTO E MAPEAMENTO DA ÁRVORE DE DADOS ---
        if (isCautelaLocal || isRecebimentoCarga) {
            dadosConferencia = adaptarCautelaParaRender(docData);
        } else {
            const listaBruta = docData.list || [];
            dadosConferencia = listaBruta.map(setor => ({
                ...setor,
                itens: (setor.itens || []).map(item => {
                    if (!item.id) item.id = item.uid_global;
                    item.pendencias_ids = pendenciasHerdadas[item.id] || [];
                    item.quantidadeEsperada = Number(item.quantidadeEsperada || item.quantidade || 0);
                    item._ocultarCarimbo = isDevolucaoFinal;
                    return item;
                })
            }));
        }

        window.dadosConferencia = dadosConferencia;

        // --- 8. CONFIGURAÇÃO DO HUD PROFISSIONAL (FOCO NO ATIVO) ---
        const localNome = isCautelaLocal ? `CAUTELA: ${ID_ALVO}` : (docData.ativo_nome || docData.nome_local || "Lista");
        const postoNome = isCautelaLocal ? "" : (docData.posto_nome || docData.unidade_sigla || "Geral");

        // Alimenta a global para a updateHeaderInfo formatar com Data/Hora
        infoLocal = { nome: localNome, posto: postoNome };

        if (typeof updateHeaderInfo === "function") updateHeaderInfo();

        // --- 9. CONFIGURAÇÃO VISUAL DO TÍTULO E BOTÃO FINALIZAR ---
        const tituloPrincipal = document.getElementById('titulo-conferencia');
        if (tituloPrincipal) {
            if (window.isModoChecklist) {
                tituloPrincipal.innerText = "Vistoria de Viatura";
                tituloPrincipal.style.color = "#2c3e50";
            } else if (isRecebimentoCarga) {
                const ano = new Date().getFullYear();
                tituloPrincipal.innerText = `GUIA: TR-${ano}/${ID_ALVO.substring(0, 5).toUpperCase()}`;
                tituloPrincipal.style.color = "#000000";
            } else {
                tituloPrincipal.innerText = isCautelaLocal ? "Recebimento de Cautela" : "Conferência de Materiais";
                tituloPrincipal.style.color = "#800020";
            }
        }

        if (btnFinalizar) {
            btnFinalizar.disabled = false;
            const corBotao = window.isModoChecklist ? "#2c3e50" : (isRecebimentoCarga ? "#000000" : "#800020");
            btnFinalizar.style.backgroundColor = corBotao;

            if (isDevolucaoFinal) {
                btnFinalizar.innerText = "FINALIZAR DEVOLUÇÃO";
                btnFinalizar.onclick = () => finalizarRecebimentoDevolucao(docData);
            } else if (isRecebimentoCarga) {
                btnFinalizar.innerText = "CONFIRMAR RECEBIMENTO";
                btnFinalizar.onclick = () => finalizarRecebimentoCarga(docData);
            } else if (isCautelaLocal) {
                btnFinalizar.innerText = "CONFIRMAR RECEBIMENTO";
                btnFinalizar.onclick = () => finalizarRecebimentoCautela(docData);
            } else {
                btnFinalizar.innerText = window.isModoChecklist ? "FINALIZAR VISTORIA" : "FINALIZAR CONFERÊNCIA";
                btnFinalizar.onclick = () => finalizarConferencia();
            }
        }

        // --- 10. ATIVAÇÃO DA INTERFACE V3 ---
        renderizarConferencia();
        if (typeof updateOverallStatus === "function") updateOverallStatus();

        if (loadingMsg) loadingMsg.style.display = 'none';

        const mainViewport = document.getElementById('main-viewport');
        if (mainViewport) {
            mainViewport.style.display = 'flex';
        }

    } catch (e) {
        console.error("V3 Critical Error:", e);
        if (loadingMsg) loadingMsg.innerHTML = `<span style='color:red'>Erro ao carregar dados: ${e.message}</span>`;
    }
}

/* --- ADAPTADOR DE CAUTELA PARA RENDERIZAÇÃO V3 --- */
function adaptarCautelaParaRender(cautelaData) {
    if (!cautelaData.itens || cautelaData.itens.length === 0) return [];

    const setorCautela = {
        id: cautelaData.cautela_id,
        nome: "ITENS PARA RECEBIMENTO",
        itens: cautelaData.itens.map(cItem => {

            // 🛑 AQUI ESTÁ O SEGREDO: Captura as 4 unidades de qualquer lugar que elas estejam
            const qtdReal = Number(cItem.quantidade || cItem.quantidadeEsperada || 1);

            // Verifica se é erro de cadastro (Pé de Cabra com tombamento = nome)
            const tombInvalido = (cItem.tombamento === cItem.nome || cItem.tombamento === "S/T" || !cItem.tombamento);
            let tipo = tombInvalido ? 'single' : 'multi';

            let tombamentos = null;
            if (tipo === 'multi') {
                tombamentos = [{
                    tomb: cItem.tombamento,
                    id_completo: `${cItem.id_base || cItem.id}-${cItem.tombamento}`,
                    cautela: { id: cautelaData.cautela_id, destinatario: cautelaData.destinatario || "N/D" }
                }];
            }

            return {
                id: cItem.id_base || cItem.id,
                nome: cItem.nome,
                quantidadeEsperada: qtdReal, // Define 4 unidades aqui!
                tipo: tipo,
                tombamentos: tombamentos,
                cautelas: [], // Esconde carimbo laranja
                situacao: "DISPONÍVEL"
            };
        })
    };
    return [setorCautela];
}

/* --- FINALIZAÇÃO DA CONFERÊNCIA (DNA V3) --- */
async function finalizarConferencia() {
    const btn = document.getElementById('btn-finalizar');
    if (btn.disabled && btn.textContent.includes("SALVANDO")) return;

    if (!LISTA_ID) {
        console.warn("Redirecionando fluxo: LISTA_ID ausente.");
        if (typeof finalizarRecebimentoDevolucao === 'function' && CAUTELA_ID) {
            return finalizarRecebimentoDevolucao(window._dadosCautelaOriginal || dadosConferencia[0]);
        }
        alert("Erro: Identificador da lista não encontrado.");
        return;
    }

    const isChecklist = window.isModoChecklist || false;

    // ✅ UX V3: Feedback visual imediato
    btn.innerHTML = `<i class="fas fa-sync fa-spin"></i> ${isChecklist ? "SALVANDO VISTORIA..." : "SALVANDO CONFERÊNCIA..."}`;
    btn.disabled = true;
    btn.style.opacity = "0.7";

    try {
        // ✅ AJUSTE CIRÚRGICO: Assinatura extraída da global userInfo (independente do HUD)
        const p = {
            uid: userInfo?.uid || "S_UID",
            postoGraduacao: userInfo?.postoGraduacao || "ND",
            quadro: userInfo?.quadro || "ND",
            nomeGuerra: userInfo?.nomeGuerra || "ND"
        };

        const conferenteCompleto = `${p.postoGraduacao} ${p.quadro} ${p.nomeGuerra}`;

        const localNome = isChecklist ? `VISTORIA: ${infoLocal.nome}` : `${infoLocal.posto} - ${infoLocal.nome}`;
        const timestampAgora = firebase.firestore.Timestamp.now();
        const dataAtualLog = new Date().toLocaleString('pt-BR');

        const urlParams = new URLSearchParams(window.location.search);
        const unidadeId = urlParams.get('unidade_id') || userInfo?.unidadeId || "UNID-GERAL";
        const unidadeNome = urlParams.get('unidade_nome') || userInfo?.unidade || "GERAL";
        const kmEntrada = urlParams.get('km') || "0";
        const combustivelEntrada = urlParams.get('combustivel') || "N/D";

        // Em vistorias, as observações podem vir de um campo específico se houver
        const obsGeraisEl = document.getElementById('obs-geral-vistoria');
        const obsGeraisTexto = obsGeraisEl ? obsGeraisEl.value.trim() : "";

        let itensRelatorio = [];
        let itensCaa = [];
        let totalCaa = 0;
        const fonteDeDados = window.dadosConferencia || dadosConferencia;

        // --- PROCESSAMENTO DA ÁRVORE DE DADOS (Mantendo suas regras de saldo/histórico) ---
        const novaListaMestra = fonteDeDados.map(setor => {
            return {
                ...setor,
                itens: setor.itens.map(item => {
                    const processarEntidade = (entidade, uid, nomeParaRelatorio) => {
                        const statusLocal = window.itemStatus[uid];
                        if (!entidade.pendencias_ids) entidade.pendencias_ids = [];
                        if (!entidade.historico_vida) entidade.historico_vida = [];

                        if (entidade.situacao === 'AVARIADO' && statusLocal?.status === 'ok') {
                            entidade.situacao = 'DISPONÍVEL';
                            delete entidade.id_cautela_origem;
                            delete entidade.motivo_avaria;
                        }

                        // Se não houve interação, assume o estado atual (visto como OK se não houver pendência)
                        if (!statusLocal || statusLocal.status === 'pending') {
                            const qtdFix = entidade.quantidadeEsperada || entidade.quantidade || 1;
                            itensRelatorio.push({
                                id: String(uid || entidade.uid_global || ""),
                                uid_global: String(item.uid_global || ""),
                                nomeCompleto: String(nomeParaRelatorio || ""),
                                status: 'S/A',
                                situacao_patrimonial: entidade.situacao || 'DISPONÍVEL',
                                quantidade: qtdFix,
                                setor: String(setor.nome || ""),
                                obs: ""
                            });
                            return entidade;
                        }

                        // Lógica de Resolução de Pendências
                        if (statusLocal.ids_resolvidos) {
                            statusLocal.ids_resolvidos.forEach(res => {
                                const idx = entidade.pendencias_ids.findIndex(pnd => String(pnd.id) === String(res.id));
                                if (idx > -1) {
                                    const pendenciaMorta = entidade.pendencias_ids[idx];
                                    entidade.historico_vida.push({
                                        evento: res.qtd_remanescente > 0 ? "SOLUCAO_PARCIAL" : "SOLUCAO_TOTAL",
                                        id_pendencia_origem: String(pendenciaMorta.id || ""),
                                        quem: conferenteCompleto,
                                        data: dataAtualLog,
                                        detalhes: `Resolvido ${res.qtd_resolvida}. Justificativa: ${res.obs}`
                                    });
                                    entidade.pendencias_ids.splice(idx, 1);
                                    if (res.qtd_remanescente > 0) {
                                        entidade.pendencias_ids.push({
                                            ...pendenciaMorta,
                                            id: "PEND_" + Date.now() + "_RES",
                                            quantidade: res.qtd_remanescente,
                                            descricao: pendenciaMorta.descricao + " (SALDO)",
                                            herdado_de: pendenciaMorta.id
                                        });
                                    }
                                }
                            });
                        }

                        // Conversão de TEMP para PEND (DNA Permanente)
                        entidade.pendencias_ids = entidade.pendencias_ids.map(p => {
                            if (p.id && String(p.id).startsWith('TEMP-')) {
                                const novoId = p.id.replace('TEMP-', 'PEND-');
                                entidade.historico_vida.push({
                                    evento: isChecklist ? "ALTERACAO_VISTORIA" : "NOVA_PENDENCIA",
                                    id_pendencia: novoId,
                                    quem: conferenteCompleto,
                                    data: dataAtualLog,
                                    detalhes: `${p.quantidade}un - ${p.descricao || ""}`
                                });
                                return { ...p, id: novoId };
                            }
                            return p;
                        });

                        // Consolida alertas para o Relatório Final
                        let pendenciasParaRelatorio = [...entidade.pendencias_ids];

                        if (entidade.cautelas && Array.isArray(entidade.cautelas)) {
                            entidade.cautelas.forEach(c => {
                                pendenciasParaRelatorio.push({
                                    autor_nome: String(c.emitente || "SISTEMA"),
                                    data_criacao: String(c.data || ""),
                                    quantidade: c.quantidade || 0,
                                    descricao: `Cautelado para ${c.destinatario} (ID: ${c.id}).`,
                                    status_gestao: "CAUTELADO"
                                });
                            });
                        }

                        const temAlteracao = pendenciasParaRelatorio.length > 0 || entidade.situacao === 'AVARIADO' || statusLocal.status === 'C/A';
                        const statusFinal = temAlteracao ? 'C/A' : 'S/A';
                        const quantidadeReal = entidade.quantidade || entidade.quantidadeEsperada || 1;

                        const dRel = {
                            id: String(uid || entidade.uid_global || ""),
                            uid_global: String(item.uid_global || ""),
                            nomeCompleto: String(nomeParaRelatorio || ""),
                            status: statusFinal,
                            situacao_patrimonial: entidade.situacao || 'DISPONÍVEL',
                            pendencias_ids: pendenciasParaRelatorio,
                            quantidade: quantidadeReal,
                            setor: String(setor.nome || ""),
                            obs: pendenciasParaRelatorio.map(p => `${p.quantidade}un: ${p.descricao}`).join(' | ')
                        };

                        itensRelatorio.push(dRel);
                        if (temAlteracao) { itensCaa.push(dRel); totalCaa++; }
                        return entidade;
                    };

                    if (item.tipo === 'multi' && item.tombamentos) {
                        item.tombamentos = item.tombamentos.map(t => processarEntidade(t, `${item.id}-${t.tomb}`, `${item.nome} (${t.tomb})`));
                    } else {
                        item = processarEntidade(item, item.id, item.nome);
                    }
                    return item;
                })
            };
        });

        // ✅ INICIO DO BATCH (OPERAÇÃO ATÔMICA NO FIREBASE)
        const batch = db.batch();

        // Limpeza de campos temporários para salvar na lista mestra
        const listaLimpaParaArquitetura = novaListaMestra.map(setor => ({
            ...setor,
            itens: setor.itens.map(item => {
                const i = { ...item };
                delete i.pendencias_ids;
                delete i.historico_vida;
                if (item.tombamentos) {
                    i.tombamentos = item.tombamentos.map(t => {
                        const tt = { ...t };
                        delete tt.pendencias_ids;
                        delete tt.historico_vida;
                        return tt;
                    });
                }
                return i;
            })
        }));

        const colecaoListaOrigem = isChecklist ? 'listas_checklist' : COLECAO_LISTAS;
        const colecaoResultadosDestino = isChecklist ? 'resultados_checklist' : 'resultados_conferencias';

        batch.update(db.collection(colecaoListaOrigem).doc(LISTA_ID), { list: listaLimpaParaArquitetura });

        const resRef = db.collection(colecaoResultadosDestino).doc();
        batch.set(resRef, {
            local: String(localNome || ""),
            unidade: String(unidadeNome || ""),
            unidade_id: String(unidadeId || ""),
            lista_id: String(LISTA_ID || ""),
            conferente_uid: String(p.uid || ""),
            conferente: String(conferenteCompleto || ""),
            timestamp: timestampAgora,
            totalItensConferidos: itensRelatorio.length,
            totalCaa: totalCaa,
            itensCaa: itensCaa || [],
            itensRelatorio: itensRelatorio || [],
            modo: isChecklist ? 'CHECKLIST_VISTORIA' : 'CONFERENCIA_PADRAO',
            km_entrada: String(kmEntrada || "0"),
            combustivel_entrada: String(combustivelEntrada || "N/D"),
            obs_gerais_vistoria: String(obsGeraisTexto || "")
        });

        // ✅ ATUALIZAÇÃO DE INVENTÁRIO (Saldos e Históricos)
        for (const itemAlterado of itensCaa) {
            const uidGlobal = itemAlterado.uid_global;
            if (!uidGlobal) continue;

            const itemRef = db.collection('inventario').doc(uidGlobal);
            const ehMulti = itemAlterado.id.includes('-') && itemAlterado.id !== uidGlobal;

            if (ehMulti) {
                const partesId = itemAlterado.id.split('-');
                const tombamentoAlvo = partesId[partesId.length - 1];
                const tombRef = itemRef.collection('tombamentos').doc(tombamentoAlvo);

                const novosLogs = (itemAlterado.pendencias_ids || [])
                    .filter(pend => pend.id && String(pend.id).startsWith('PEND-'))
                    .map(pend => ({
                        data: dataAtualLog,
                        evento: isChecklist ? "ALERTA_VISTORIA" : "ALERTA_CONFERENCIA",
                        quem: conferenteCompleto,
                        detalhes: `⚠️ Alteração em ${localNome}: ${pend.descricao}`,
                        uid_pendencia: pend.id,
                        lista_origem_id: LISTA_ID
                    }));

                novosLogs.forEach((log, idx) => {
                    batch.set(tombRef.collection('historico_vida').doc("EVT-P-" + Date.now() + idx), log);
                });
                batch.update(tombRef, { situacao_atual: "PENDENTE" });
            } else {
                const saldoRef = itemRef.collection('saldos_unidades').doc(unidadeId);
                const novasPendencias = (itemAlterado.pendencias_ids || []).filter(pend => pend.id && String(pend.id).startsWith('PEND-'));

                if (novasPendencias.length > 0) {
                    const qtdPendenteTotal = novasPendencias.reduce((sum, pend) => sum + (Number(pend.quantidade) || 0), 0);

                    // Blindagem de Saldo Físico: Se não for checklist, move de DISP para PEND
                    if (!isChecklist) {
                        batch.update(saldoRef, {
                            qtd_disp: firebase.firestore.FieldValue.increment(-qtdPendenteTotal),
                            qtd_pend: firebase.firestore.FieldValue.increment(qtdPendenteTotal),
                            last_update: dataAtualLog
                        });
                    } else {
                        batch.update(saldoRef, {
                            qtd_pend: firebase.firestore.FieldValue.increment(qtdPendenteTotal),
                            last_update: dataAtualLog
                        });
                    }

                    novasPendencias.forEach((pend, idx) => {
                        batch.set(saldoRef.collection('historico_vida').doc("EVT-S-P-" + Date.now() + idx), {
                            data: dataAtualLog,
                            evento: "PENDENCIA_RELATADA",
                            quem: conferenteCompleto,
                            detalhes: `⚠️ Alteração em ${localNome}: ${pend.descricao}`,
                            quantidade: pend.quantidade,
                            uid_pendencia: pend.id,
                            lista_origem_id: LISTA_ID,
                            local_sigla: infoLocal.nome || "N/D"
                        });
                    });
                }
            }
        }

        await batch.commit();

        alert(isChecklist ? "✅ Vistoria Finalizada com Sucesso!" : "✅ Conferência Finalizada com Sucesso!");
        window.top.location.href = "sigma_dashboard.html";

    } catch (e) {
        console.error("V3 Critical Error:", e);
        alert("❌ Erro fatal ao gravar dados: " + e.message);
        btn.disabled = false;
        btn.innerHTML = isChecklist ? "FINALIZAR VISTORIA" : "FINALIZAR CONFERÊNCIA";
    }
}

/* --- FINALIZAÇÃO DO RECEBIMENTO DE CAUTELA (DNA V3) --- */
async function finalizarRecebimentoCautela(cautela) {
    const btn = document.getElementById('btn-finalizar');
    btn.textContent = "PROCESSANDO...";
    btn.disabled = true;

    if (!isCautela || !CAUTELA_ID) {
        alert("Erro: ID da cautela não encontrado.");
        btn.disabled = false;
        return;
    }

    const userAuth = firebase.auth().currentUser;
    if (!userAuth) {
        alert("Erro: Sessão não encontrada.");
        btn.disabled = false;
        return;
    }

    const meuUid = userAuth.uid;
    const meuNomeCompleto = `${userInfo.postoGraduacao} ${userInfo.quadro} ${userInfo.nomeGuerra}`;
    const dataAtual = new Date().toLocaleString('pt-BR');
    const listaId = cautela.local_origem_id;

    try {
        const cautelaRef = db.collection(COLECAO_CAUTELAS).doc(CAUTELA_ID);
        const listaMestraRef = db.collection(COLECAO_LISTAS).doc(listaId);

        await db.runTransaction(async (transaction) => {
            const cautelaDoc = await transaction.get(cautelaRef);
            if (!cautelaDoc.exists) throw new Error("Cautela não encontrada.");

            const cData = cautelaDoc.data();
            if (cData.destinatario_original_uid !== meuUid) {
                throw new Error("Apenas o destinatário original pode assinar este recebimento.");
            }

            const listaMestraDoc = await transaction.get(listaMestraRef);
            if (!listaMestraDoc.exists) throw new Error("Lista Mestra não encontrada.");

            let listaMestra = listaMestraDoc.data().list;
            const itensConferidos = [];

            let temQualquerAlteracao = false;
            let linhasExtrato = [];

            cautela.itens.forEach((cItem, index) => {
                const uidBusca = cItem.tombamento ? `${cItem.id_base || cItem.id}-${cItem.tombamento}` : (cItem.id_base || cItem.id);
                const statusLocal = window.itemStatus[uidBusca] || {};

                const isItemOk = (statusLocal.status === 'ok' || statusLocal.status === 'S/A');
                const statusFinal = isItemOk ? 'S/A' : 'C/A';
                const obsFinal = statusLocal.obs || "";

                if (statusFinal === 'C/A') temQualquerAlteracao = true;

                itensConferidos.push({
                    ...cItem,
                    status_recebimento: statusFinal,
                    obs_recebimento: obsFinal
                });

                const identificador = cItem.tombamento ? `(Tomb.: ${cItem.tombamento})` : `(QTD: ${cItem.quantidade}UN)`;
                const relatoItem = isItemOk ? 'S/A' : (obsFinal || 'C/A sem obs.');
                linhasExtrato.push(`${index + 1}. ${cItem.nome} ${identificador}: ${relatoItem}`);

                // --- ATUALIZAÇÃO DA LISTA MESTRA ---
                listaMestra = listaMestra.map(setor => ({
                    ...setor,
                    itens: setor.itens.map(mItem => {
                        const idMestra = mItem.id_base || mItem.id;
                        const idCautelaItem = cItem.id_base || cItem.id;

                        if (idMestra === idCautelaItem) {
                            // Registro no histórico de vida do item
                            if (!mItem.historico_vida) mItem.historico_vida = [];
                            mItem.historico_vida.push({
                                evento: "CONFIRMAÇÃO_RECEBIMENTO",
                                id_doc: CAUTELA_ID,
                                quem: meuNomeCompleto,
                                data: dataAtual,
                                detalhes: statusFinal === 'C/A' ? `Avaria: ${obsFinal}` : "Recebido S/A."
                            });

                            const objetoCautelaAtualizado = {
                                id: CAUTELA_ID,
                                emitente: cData.emitente || "N/D",
                                destinatario: meuNomeCompleto,
                                data: cData.timestamp_emissao ? cData.timestamp_emissao.toDate().toLocaleDateString('pt-BR') : dataAtual,
                                status_item: statusFinal,
                                obs_item: obsFinal,
                                quantidade: Number(cItem.quantidade) || 1
                            };

                            // 🛑 CORREÇÃO PARA ITEM SINGLE: Atualiza o existente em vez de dar push
                            if (mItem.tipo === 'single' && mItem.cautelas) {
                                const idxExistente = mItem.cautelas.findIndex(c => c.id === CAUTELA_ID);
                                if (idxExistente !== -1) {
                                    // Se já existe (carimbo de emissão), apenas atualizamos os dados
                                    mItem.cautelas[idxExistente] = objetoCautelaAtualizado;
                                } else {
                                    // Se por algum motivo não existia, aí sim adicionamos
                                    mItem.cautelas.push(objetoCautelaAtualizado);
                                }
                            }
                            // PARA ITEM MULTI: A sobrescrita já é segura por natureza
                            else if (mItem.tipo === 'multi' && mItem.tombamentos) {
                                mItem.tombamentos = mItem.tombamentos.map(t => {
                                    if (t.tomb === cItem.tombamento) {
                                        t.cautela = objetoCautelaAtualizado;
                                    }
                                    return t;
                                });
                            }
                        }
                        return mItem;
                    })
                }));
            });

            const icone = temQualquerAlteracao ? '⚠️' : '✅';
            const tituloLog = `${icone} Recebido ${temQualquerAlteracao ? 'C/A' : 'S/A'} pelo destinatário: ${meuNomeCompleto}`;
            const descricaoCompleta = `${tituloLog}\n${linhasExtrato.join('\n')}`;

            const logMovimentacao = {
                data: dataAtual,
                descricao: descricaoCompleta,
                militar: meuNomeCompleto
            };

            transaction.update(cautelaRef, {
                status: 'RECEBIDA',
                timestamp_recebimento: firebase.firestore.FieldValue.serverTimestamp(),
                itens: itensConferidos,
                militar_completo_receptor: meuNomeCompleto,
                historico_movimentacoes: firebase.firestore.FieldValue.arrayUnion(logMovimentacao)
            });

            transaction.update(listaMestraRef, { list: listaMestra });
        });

        alert(`✅ Recebimento confirmado!`);
        window.parent.postMessage({ type: 'SIGMA_FINISHED' }, '*');

    } catch (error) {
        console.error("Erro ao receber cautela:", error);
        alert(`Erro: ${error.message}`);
        btn.textContent = "FINALIZAR RECEBIMENTO";
        btn.disabled = false;
    }
}

async function finalizarRecebimentoCarga(transferenciaData) {
    const btn = document.getElementById('btn-finalizar');
    const originalText = btn.textContent;
    btn.textContent = "PROCESSANDO RECEBIMENTO...";
    btn.disabled = true;

    // ✅ CIRÚRGICO: Garante a captura do ID da Guia (vinda do banco ou da URL)
    const urlParams = new URLSearchParams(window.location.search);
    const transferenciaId = transferenciaData.id || transferenciaData.transferencia_id || urlParams.get('transferenciaId');

    const unidadeDestinoId = transferenciaData.destino_id;
    const siglaDestino = transferenciaData.destino_sigla;
    const meuNomeCompleto = `${userInfo.postoGraduacao} ${userInfo.quadro} ${userInfo.nomeGuerra}`;
    const dataAtual = new Date().toLocaleString('pt-BR');

    if (!transferenciaId) {
        alert("Erro: ID da transferência não localizado.");
        btn.disabled = false;
        btn.textContent = "CONFIRMAR RECEBIMENTO";
        return;
    }

    try {
        const batch = db.batch();
        const transRef = db.collection('transferencias_pendentes').doc(transferenciaId);

        // 1. PROCESSAMENTO DOS ITENS NO INVENTÁRIO
        for (const item of transferenciaData.itens) {
            const uidGlobal = item.id_base || item.id;
            const uidBusca = item.tombamento ? `${uidGlobal}-${item.tombamento}` : uidGlobal;

            const statusLocal = window.itemStatus[uidBusca] || { status: 'ok' };
            const itemRef = db.collection('inventario').doc(uidGlobal);

            if (item.tombamento) {
                // ✅ LÓGICA MULTI: Atualiza o Prontuário (Tombamento)
                const tombRef = itemRef.collection('tombamentos').doc(item.tombamento);

                batch.update(tombRef, {
                    situacao_atual: statusLocal.status === 'ok' ? "DISPONÍVEL" : "PENDENTE",
                    local_id: unidadeDestinoId,
                    unidade_sigla: siglaDestino,
                    sub_local: "ALMOXARIFADO SETORIAL",
                    recebido_por: meuNomeCompleto,
                    data_recebimento: dataAtual,
                    unidade_destino_id: firebase.firestore.FieldValue.delete(),
                    unidade_destino_sigla: firebase.firestore.FieldValue.delete()
                });

                const idEvt = "REC-" + Date.now();
                batch.set(tombRef.collection('historico_vida').doc(idEvt), {
                    data: dataAtual,
                    evento: "RECEBIMENTO_CARGA",
                    quem: meuNomeCompleto,
                    detalhes: statusLocal.status === 'ok'
                        ? `Material recebido e conferido S/A na unidade ${siglaDestino}.`
                        : `Material recebido com ALTERAÇÃO: ${statusLocal.obs || 'Não descrita'}.`
                });

            } else {
                // ✅ LÓGICA SINGLE: Blindagem de quantidade e criação de saldo
                const qtdRecebida = Number(item.quantidade) || 0;
                const saldoRef = itemRef.collection('saldos_unidades').doc(unidadeDestinoId);

                batch.set(saldoRef, {
                    qtd_transito: firebase.firestore.FieldValue.increment(-qtdRecebida),
                    qtd_disp: firebase.firestore.FieldValue.increment(qtdRecebida),
                    qtd_total: firebase.firestore.FieldValue.increment(qtdRecebida),
                    unidade_sigla: siglaDestino,
                    last_update: dataAtual
                }, { merge: true });

                const idEvtS = "REC-S-" + Date.now();
                batch.set(saldoRef.collection('historico_vida').doc(idEvtS), {
                    data: dataAtual,
                    evento: "RECEBIMENTO_CARGA",
                    quem: meuNomeCompleto,
                    quantidade: qtdRecebida, // ✅ Salva a quantidade específica deste lote
                    guia_id: transferenciaId, // Para o link com a guia
                    detalhes: `Carga recebida (${qtdRecebida} un.). Guia: ${transferenciaData.id_amigavel || transferenciaId}. Status: ${statusLocal.status.toUpperCase()}.`
                });
            }
        }

        // 1.5 ✅ PREPARA OS ITENS COM O STATUS DA CONFERÊNCIA PARA O PDF POSTERIOR
        // Isso garante que o histórico salve o que o CAP JOSÉ MIGUEL conferiu de fato.
        const itensAtualizadosParaHistorico = transferenciaData.itens.map(item => {
            const uidBusca = item.tombamento ? `${item.id_base || item.id}-${item.tombamento}` : (item.id_base || item.id);
            const statusLocal = window.itemStatus[uidBusca] || { status: 'ok' };

            return {
                ...item,
                status_recebimento: statusLocal.status === 'ok' ? 'S/A' : 'C/A',
                observacao_recebimento: statusLocal.obs || ''
            };
        });

        // 2. ATUALIZA O STATUS DA TRANSFERÊNCIA NO BANCO
        batch.update(transRef, {
            status: "RECEBIDO",
            recebedor_nome: meuNomeCompleto,
            recebedor_uid: userInfo.uid,
            timestamp_recebimento: firebase.firestore.FieldValue.serverTimestamp(),
            modo: 'TRANSFERENCIA_CARGA',
            itens: itensAtualizadosParaHistorico // ✅ Salva a conferência final na guia
        });

        await batch.commit();

        // Conforme solicitado, a impressão agora é manual via "Minhas Atividades"
        alert(`✅ Carga recebida com sucesso!\nO Termo de Recebimento já está disponível em "Minhas Atividades".`);

        if (window.parent) {
            window.parent.postMessage({ type: 'SIGMA_FINISHED' }, '*');
        }

    } catch (e) {
        console.error("Erro ao finalizar recebimento:", e);
        alert("Erro técnico ao processar recebimento: " + e.message);
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

async function finalizarRecebimentoDevolucao(cautela) {
    const btn = document.getElementById('btn-finalizar');
    btn.textContent = "PROCESSANDO...";
    btn.disabled = true;

    // 🛡️ CAPTURA CIRÚRGICA DO ID DA LISTA
    const listaId = cautela.local_origem_id || urlParams.get('lista_origem');

    if (!CAUTELA_ID || !listaId) {
        console.error("IDs ausentes:", { CAUTELA_ID, listaId });
        alert("Erro Crítico: Não foi possível identificar a lista de origem para reintegrar o material.");
        btn.textContent = "FINALIZAR RECEBIMENTO DA DEVOLUÇÃO";
        btn.disabled = false;
        return;
    }

    const userAuth = firebase.auth().currentUser;
    if (!userAuth) { alert("Sessão expirada."); btn.disabled = false; return; }

    const meuNomeCompleto = `${userInfo.postoGraduacao} ${userInfo.quadro} ${userInfo.nomeGuerra}`;
    const dataAtual = new Date().toLocaleString('pt-BR');

    try {
        const cautelaRef = db.collection(COLECAO_CAUTELAS).doc(CAUTELA_ID);
        const listaMestraRef = db.collection(COLECAO_LISTAS).doc(listaId);

        await db.runTransaction(async (transaction) => {
            const cautelaDoc = await transaction.get(cautelaRef);
            if (!cautelaDoc.exists) throw new Error("Cautela não encontrada.");

            const listaMestraDoc = await transaction.get(listaMestraRef);
            if (!listaMestraDoc.exists) throw new Error("Lista Mestra original não encontrada.");

            let listaMestra = listaMestraDoc.data().list;
            const itensDevolvidos = [];

            // --- 🛑 CONSTRUÇÃO DO EXTRATO DETALHADO DE DEVOLUÇÃO 🛑 ---
            let temQualquerAlteracao = false;
            let linhasExtrato = [];

            cautela.itens.forEach((cItem, index) => {
                const uidBusca = cItem.tombamento ? `${cItem.id_base || cItem.id}-${cItem.tombamento}` : (cItem.id_base || cItem.id);
                const statusLocal = window.itemStatus[uidBusca];

                const statusFinal = statusLocal?.status === 'ok' ? 'S/A' : 'C/A';
                const obsFinal = statusLocal?.obs || "";

                if (statusFinal === 'C/A') temQualquerAlteracao = true;

                itensDevolvidos.push({
                    ...cItem, status_devolucao: statusFinal, obs_devolucao: obsFinal
                });

                // Monta a linha do extrato para o histórico
                const identificador = cItem.tombamento ? `(Tomb.: ${cItem.tombamento})` : `(QTD: ${cItem.quantidade}UN)`;
                const relatoItem = statusFinal === 'S/A' ? 'S/A' : (obsFinal || 'C/A sem obs.');
                linhasExtrato.push(`${index + 1}. ${cItem.nome} ${identificador}: ${relatoItem}`);

                // Reinclui o material no Estoque (Lista Mestra)
                listaMestra = listaMestra.map(setor => ({
                    ...setor,
                    itens: setor.itens.map(mItem => {
                        if ((mItem.id_base || mItem.id) === (cItem.id_base || cItem.id)) {
                            if (!mItem.historico_vida) mItem.historico_vida = [];
                            mItem.historico_vida.push({
                                evento: "RETORNO_DEVOLUCAO",
                                id_doc: CAUTELA_ID,
                                quem: meuNomeCompleto,
                                data: dataAtual,
                                estado_retorno: statusFinal,
                                detalhes: statusFinal === 'C/A' ? `Retorno com avaria: ${obsFinal}` : "Retorno em perfeito estado (S/A)."
                            });

                            if (cItem.tombamento && mItem.tombamentos) {
                                mItem.tombamentos = mItem.tombamentos.map(t => {
                                    if (t.tomb === cItem.tombamento) delete t.cautela;
                                    return t;
                                });
                            } else if (!cItem.tombamento && mItem.cautelas) {
                                mItem.cautelas = mItem.cautelas.filter(c => c.id !== CAUTELA_ID);
                            }
                        }
                        return mItem;
                    })
                }));
            });

            // Finaliza o Título e o Corpo do Log de Movimentação
            const icone = temQualquerAlteracao ? '⚠️' : '✅';
            const tituloLog = `${icone} Devolução recebida ${temQualquerAlteracao ? 'C/A' : 'S/A'} pelo detentor: ${meuNomeCompleto}`;
            const descricaoCompleta = `${tituloLog}\n${linhasExtrato.join('\n')}`;

            const logMovimentacao = {
                data: dataAtual,
                descricao: descricaoCompleta,
                militar: meuNomeCompleto
            };

            transaction.update(cautelaRef, {
                status: 'CONCLUÍDA',
                timestamp_conclusao: firebase.firestore.FieldValue.serverTimestamp(),
                receptor_final_completo: meuNomeCompleto,
                itens: itensDevolvidos,
                historico_movimentacoes: firebase.firestore.FieldValue.arrayUnion(logMovimentacao)
            });

            transaction.update(listaMestraRef, { list: listaMestra });
        });

        alert("✅ Devolução finalizada e estoque atualizado!");
        window.parent.postMessage({ type: 'SIGMA_FINISHED' }, '*');
    } catch (error) {
        console.error("Erro na transação:", error);
        alert(`Erro: ${error.message}`);
        btn.disabled = false;
        btn.textContent = "FINALIZAR RECEBIMENTO DA DEVOLUÇÃO";
    }
}

function verificarFluxoSetor(uidAtual) {
    // ✅ TRAVA DE SEGURANÇA V3: Se o usuário está com um modal aberto (Gerenciar, Editar, etc)
    // a navegação automática é abortada para não causar a troca de tela fantasma.
    if (Swal.isVisible()) {
        console.log("🚦 Fluxo suspenso: Usuário interagindo com Modal.");
        return;
    }

    const rowAtual = document.getElementById(`item-row-${uidAtual}`);
    const nextRow = rowAtual ? rowAtual.nextElementSibling : null;

    if (nextRow && nextRow.classList.contains('v3-item-row')) {
        // AINDA HÁ ITENS: Rola para o próximo
        setTimeout(() => {
            // Verifica novamente se um modal foi aberto nesse intervalo de 300ms
            if (Swal.isVisible()) return;

            nextRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Efeito visual de foco no próximo
            nextRow.style.backgroundColor = "#f0f9ff";
            setTimeout(() => nextRow.style.backgroundColor = "", 1000);
        }, 300);
    } else {
        // FIM DO SETOR: Feedback de sucesso e volta para a Tela 1
        const Toast = Swal.mixin({
            toast: true,
            position: 'top',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true
        });

        Toast.fire({
            icon: 'success',
            title: 'Setor Concluído!'
        });

        setTimeout(() => {
            // ✅ Verificação final: Só volta para setores se o usuário não abriu um modal no último segundo
            if (!Swal.isVisible()) {
                navegarParaSetores(); // Volta para a lista de setores (Tela 1)
            }
        }, 1500);
    }
}

async function finalizarDevolucaoCautela(cautela) {
    const btn = document.getElementById('btn-finalizar');
    btn.textContent = 'Processando...';
    btn.disabled = true;

    try {
        // Pega as informações do militar logado (quem está devolvendo)
        const userInfo = await getLoggedUser();

        if (!userInfo) {
            alert("Erro: Dados do militar logado não encontrados.");
            btn.textContent = 'ERRO AO FINALIZAR';
            btn.disabled = false;
            return;
        }

        const cautelaRef = db.collection(COLECAO_CAUTELAS).doc(CAUTELA_ID);

        // 🛑 CRÍTICO: Executa a Transação no Firebase 🛑
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(cautelaRef);

            if (!doc.exists || doc.data().status !== 'RECEBIDA') {
                throw new Error("Cautela não encontrada ou não está no status 'RECEBIDA'.");
            }

            // 1. Ação: Mudar o status da cautela para CONCLUIDA.
            transaction.update(cautelaRef, {
                status: 'CONCLUIDA', // Status final
                timestamp_devolucao: firebase.firestore.FieldValue.serverTimestamp(),

                // Quem está devolvendo (Militar Logado)
                reversor: userInfo.nomeGuerra,
                militar_completo_reversor: `${userInfo.postoGraduacao} ${userInfo.quadro} ${userInfo.nomeGuerra}`,

                // Quem está recebendo de volta (Último Conferente)
                destinatario_final_devolucao: DESTINATARIO_DEVOLUCAO,
            });

            // 2. Ação: Registrar o histórico de conferência final (opcional, mas recomendado)
            // Se necessário, você pode adicionar um novo documento na sua coleção de histórico.
        }); // Fim da Transação

        alert(`✅ Devolução da Cautela ${CAUTELA_ID} concluída e status atualizado para \"CONCLUIDA\".`);
        window.parent.postMessage({ type: 'SIGMA_FINISHED' }, '*');

    } catch (error) {
        console.error("Erro CRÍTICO ao finalizar devolução:", error);
        alert(`Erro ao finalizar devolução. Nenhum dado foi alterado. Erro: ${error.message}`);
        btn.textContent = "ERRO AO FINALIZAR";
        btn.disabled = false;
    }
}
