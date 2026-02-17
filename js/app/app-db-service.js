/* --- Carrega os dados remotos do Firestore conforme parâmetros da URL ---*/
async function carregarDadosRemotos() {
    const urlParamsLocal = new URLSearchParams(window.location.search);
    const idUrl = urlParamsLocal.get('id');
    const cautelaIdUrl = urlParamsLocal.get('cautelaId');
    const modoUrl = urlParamsLocal.get('modo');
    const transferenciaIdUrl = urlParamsLocal.get('transferenciaId');

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

        window.isModoChecklist = (colecaoEncontrada === 'listas_checklist' || docData.tipo === 'checklist_viatura');
        const isRecebimentoCarga = (colecaoEncontrada === 'transferencias_pendentes');
        const isCautelaLocal = (colecaoEncontrada === 'cautelas_abertas');
        const isDevolucaoFinal = modoUrl === 'devolucao_final';

        if (isRecebimentoCarga) window.dadosTransferencia = docData;

        userInfo.postoGraduacao = urlParamsLocal.get('posto_grad') || "ND";
        userInfo.quadro = urlParamsLocal.get('quadro') || "ND";
        userInfo.nomeGuerra = urlParamsLocal.get('nome_guerra') || "ND";
        userInfo.uid = urlParamsLocal.get('user_uid') || "ND";

        // --- 6. BUSCA REVERSA: HERANÇA DE PENDÊNCIAS (DNA V3 ATUALIZADO) ---
        let pendenciasHerdadas = {};
        if (!isCautelaLocal && !isRecebimentoCarga) {
            const colecaoResultados = window.isModoChecklist ? 'resultados_checklist' : 'resultados_conferencias';
            const ultimaConfQuery = await db.collection(colecaoResultados)
                .where('lista_id', '==', ID_ALVO)
                .orderBy('timestamp', 'desc')
                .limit(1).get();

            if (!ultimaConfQuery.empty) {
                const ultimoResultado = ultimaConfQuery.docs[0].data();
                (ultimoResultado.itensRelatorio || []).forEach(itemRel => {
                    // ✅ CAPTURA PAI
                    if (itemRel.status === 'C/A' && itemRel.pendencias_ids) {
                        pendenciasHerdadas[itemRel.id] = itemRel.pendencias_ids;
                    }
                    // ✅ CAPTURA FILHOS (Kits)
                    if (itemRel.acessorios_vinculados) {
                        itemRel.acessorios_vinculados.forEach((ac, idx) => {
                            if (ac.status === 'C/A' && ac.pendencias_ids) {
                                // O ID do filho na memória status é sempre PAI_ac_IDX
                                const idFilhoStatus = `${itemRel.id}_ac_${idx}`;
                                pendenciasHerdadas[idFilhoStatus] = ac.pendencias_ids;
                            }
                        });
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
                    const uidMestre = item.uid_instancia || item.uid_global || item.id;
                    item.id = uidMestre;

                    // Injeta pendência no Pai
                    item.pendencias_ids = pendenciasHerdadas[uidMestre] || [];
                    item.quantidadeEsperada = Number(item.quantidadeEsperada || item.quantidade || 0);
                    item._ocultarCarimbo = isDevolucaoFinal;

                    // ✅ ALIMENTAÇÃO DA RAM (window.itemStatus) PARA ACENDER OS CARDS
                    if (item.pendencias_ids.length > 0) {
                        window.itemStatus[uidMestre] = { status: 'C/A', interacao_humana: false };
                    }

                    // ✅ MAPEAMENTO PROFUNDO DE ACESSÓRIOS (FILHOS)
                    const acessorios = item.acessorios_vinculados || item.acessorios_acoplados || [];
                    acessorios.forEach((ac, idx) => {
                        const idFilho = `${uidMestre}_ac_${idx}`;
                        const pndsFilho = pendenciasHerdadas[idFilho] || [];
                        if (pndsFilho.length > 0) {
                            // Se o filho tem problema, garante que ele e o pai acendam na tela
                            window.itemStatus[idFilho] = {
                                status: 'C/A',
                                pendencias_temporarias: pndsFilho, // Injetamos como temporária para re-exibir o carimbo
                                interacao_humana: false
                            };
                            window.itemStatus[uidMestre] = { status: 'C/A', interacao_humana: false };
                        }
                    });

                    return item;
                })
            }));
        }

        window.dadosConferencia = dadosConferencia;

        // --- 8. CONFIGURAÇÃO DO HUD ---
        const localNome = isCautelaLocal ? `CAUTELA: ${ID_ALVO}` : (docData.ativo_nome || docData.nome_local || "Lista");
        const postoNome = isCautelaLocal ? "" : (docData.posto_nome || docData.unidade_sigla || "Geral");
        infoLocal = { nome: localNome, posto: postoNome };
        if (typeof updateHeaderInfo === "function") updateHeaderInfo();

        // --- 9. CONFIGURAÇÃO VISUAL ---
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
        if (mainViewport) mainViewport.style.display = 'flex';

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

/* --- FINALIZAÇÃO DA CONFERÊNCIA (DNA V3 - COMPLETA E ATUALIZADA) --- */
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
        // ✅ ASSINATURA: Extraída da global userInfo
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

        const obsGeraisEl = document.getElementById('obs-geral-vistoria');
        const obsGeraisTexto = obsGeraisEl ? obsGeraisEl.value.trim() : "";

        let itensRelatorio = [];
        let itensCaa = [];
        let totalCaa = 0;
        const fonteDeDados = window.dadosConferencia || dadosConferencia;

        // --- 1. PROCESSAMENTO DA ÁRVORE DE DADOS (DNA V3 - CORREÇÃO DE HIERARQUIA E MANUTENÇÃO) ---
        const novaListaMestra = fonteDeDados.map(setor => {
            return {
                ...setor,
                itens: setor.itens.map(item => {

                    const processarEntidade = (entidade, uid, nomeParaRelatorio, uidPai = null) => {
                        // ✅ AJUSTE V3: Localiza status na memória usando o Anfitrião (Pai) ou o próprio UID
                        const idAnfitriao = uidPai || uid;
                        const statusLocal = window.itemStatus[idAnfitriao];

                        if (!entidade.pendencias_ids) entidade.pendencias_ids = [];
                        if (!entidade.historico_vida) entidade.historico_vida = [];

                        // 1.1 Atualização de situação se resolvido
                        if (entidade.situacao === 'AVARIADO' && statusLocal?.status === 'ok') {
                            entidade.situacao = 'DISPONÍVEL';
                            delete entidade.id_cautela_origem;
                            delete entidade.motivo_avaria;
                        }

                        // ✅ 1.2 CAPTURA DE PENDÊNCIAS MANTIDAS
                        if (statusLocal?.pendencias_originais_mantidas) {
                            statusLocal.pendencias_originais_mantidas.forEach(pMantida => {
                                const jaExiste = entidade.pendencias_ids.some(p => String(p.id) === String(pMantida.id));
                                if (!jaExiste) entidade.pendencias_ids.push(pMantida);
                            });
                        }

                        if (!statusLocal || (statusLocal.status === 'pending' && (!statusLocal.pendencias_originais_mantidas || statusLocal.pendencias_originais_mantidas.length === 0))) {
                            const qtdFix = entidade.quantidadeEsperada || entidade.quantidade || 1;
                            const dRelBasico = {
                                id: String(uid || entidade.uid_global || ""),
                                uid_global: String(entidade.uid_global || item.uid_global || ""),
                                nomeCompleto: String(nomeParaRelatorio || ""),
                                status: (entidade.pendencias_ids.length > 0) ? 'C/A' : 'S/A',
                                situacao_patrimonial: entidade.situacao || 'DISPONÍVEL',
                                quantidade: qtdFix,
                                setor: String(setor.nome || ""),
                                pendencias_ids: entidade.pendencias_ids.filter(p => p.status_gestao !== 'RESOLVIDO'),
                                obs: entidade.pendencias_ids.filter(p => p.status_gestao !== 'RESOLVIDO').map(p => `${p.quantidade}un: ${p.descricao}`).join(' | ')
                            };
                            return { entidade, dRel: dRelBasico };
                        }

                        // 1.4 Lógica de Resolução
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

                        // ✅ 1.5 CONVERSÃO DE TEMP PARA PEND (DNA V3 - BUSCA NO PAI)
                        const statusAnfitriao = window.itemStatus[idAnfitriao] || {};
                        const novosRelatosDestaEntidade = (statusAnfitriao.pendencias_temporarias || [])
                            .filter(p => String(p.uid_alvo_direto) === String(uid));

                        const todosNovosRelatos = novosRelatosDestaEntidade.concat(
                            entidade.pendencias_ids.filter(p => String(p.id).startsWith('TEMP-') && String(p.uid_alvo_direto) === String(uid))
                        );

                        const relatosUnicos = Array.from(new Set(todosNovosRelatos.map(a => a.id)))
                            .map(id => todosNovosRelatos.find(a => a.id === id));

                        entidade.pendencias_ids = entidade.pendencias_ids.filter(p => !String(p.id).startsWith('TEMP-'));

                        relatosUnicos.forEach(p => {
                            const novoId = p.id.replace('TEMP-', 'PEND-');
                            if (!entidade.pendencias_ids.some(x => x.id === novoId)) {
                                entidade.historico_vida.push({
                                    evento: isChecklist ? "ALTERACAO_VISTORIA" : "NOVA_PENDENCIA",
                                    id_pendencia: novoId,
                                    quem: conferenteCompleto,
                                    data: dataAtualLog,
                                    detalhes: `${p.quantidade}un - ${p.descricao || ""}`
                                });
                                entidade.pendencias_ids.push({ ...p, id: novoId });
                            }
                        });

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

                        const pendenciasAtivas = pendenciasParaRelatorio.filter(p => {
                            const isResolvida = p.status_gestao === 'RESOLVIDO';
                            const ehParaEsteAlvo = !p.uid_alvo_direto || String(p.uid_alvo_direto) === String(uid);
                            return !isResolvida && ehParaEsteAlvo;
                        });

                        const temAlteracaoAtiva = pendenciasAtivas.length > 0 || entidade.situacao === 'AVARIADO';
                        const statusFinal = temAlteracaoAtiva ? 'C/A' : 'S/A';
                        const quantidadeReal = entidade.quantidade || entidade.quantidadeEsperada || 1;

                        const dRel = {
                            id: String(uid || entidade.uid_global || ""),
                            uid_global: String(entidade.uid_global || item.uid_global || ""),
                            nomeCompleto: String(nomeParaRelatorio || ""),
                            status: statusFinal,
                            situacao_patrimonial: entidade.situacao || 'DISPONÍVEL',
                            pendencias_ids: pendenciasAtivas,
                            quantidade: quantidadeReal,
                            setor: String(setor.nome || ""),
                            obs: pendenciasAtivas.map(p => `${p.quantidade}un: ${p.descricao}`).join(' | ')
                        };

                        return { entidade, dRel };
                    };

                    const acessoriosRaiz = item.acessorios_vinculados || item.acessorios_acoplados || [];

                    if (item.tipo === 'multi' && item.tombamentos) {
                        item.tombamentos = item.tombamentos.map(t => {
                            const uidInstancia = item.uid_instancia || `${item.uid_global || item.id}-${t.tomb}`;
                            const res = processarEntidade(t, uidInstancia, `${item.nome} (${t.tomb})`);

                            // ✅ CORREÇÃO: Passando uidInstancia como o 4º parâmetro (uidPai)
                            res.dRel.acessorios_vinculados = acessoriosRaiz.map((ac, idx) => {
                                const uidFilho = `${uidInstancia}_ac_${idx}`;
                                return processarEntidade(ac, uidFilho, ac.nome, uidInstancia).dRel;
                            });

                            itensRelatorio.push(res.dRel);
                            if (res.dRel.status === 'C/A') itensCaa.push(res.dRel);
                            return res.entidade;
                        });
                    } else {
                        const uidMestre = item.uid_instancia || item.uid_global || item.id;
                        const res = processarEntidade(item, uidMestre, item.nome);

                        // ✅ CORREÇÃO: Passando uidMestre como o 4º parâmetro (uidPai)
                        res.dRel.acessorios_vinculados = acessoriosRaiz.map((ac, idx) => {
                            const uidFilho = `${uidMestre}_ac_${idx}`;
                            return processarEntidade(ac, uidFilho, ac.nome, uidMestre).dRel;
                        });

                        itensRelatorio.push(res.dRel);
                        if (res.dRel.status === 'C/A') itensCaa.push(res.dRel);
                        item = res.entidade;
                    }
                    return item;
                })
            };
        });

        // --- 2. GRAVAÇÃO EM BATCH (FIREBASE) ---
        const batch = db.batch();
        totalCaa = itensCaa.length;

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

        // --- 3. ATUALIZAÇÃO DE INVENTÁRIO GLOBAL (DNA V3 - TRADUÇÃO DE INSTÂNCIA PARA GLOBAL) ---
        let pendenciasParaInventario = [];
        itensRelatorio.forEach(ir => {
            // Coleta pendências do Pai
            if (ir.pendencias_ids) {
                pendenciasParaInventario.push(...ir.pendencias_ids.filter(p => String(p.id).startsWith('PEND-')));
            }
            // Coleta pendências dos Filhos
            if (ir.acessorios_vinculados) {
                ir.acessorios_vinculados.forEach(ac => {
                    if (ac.pendencias_ids) {
                        pendenciasParaInventario.push(...ac.pendencias_ids.filter(p => String(p.id).startsWith('PEND-')));
                    }
                });
            }
        });

        for (const pend of pendenciasParaInventario) {
            let uidAlvoRaw = pend.uid_alvo_direto;
            if (!uidAlvoRaw) continue;

            // ✅ TRADUÇÃO DE DNA: Se o ID contém "_ac_", precisamos achar o UID Global real do componente
            let uidGlobalFinal = uidAlvoRaw;

            if (uidAlvoRaw.includes('_ac_')) {
                const [idPai, resto] = uidAlvoRaw.split('_ac_');
                const indexAcessorio = parseInt(resto);

                // Busca na fonte de dados o material real que ocupa essa posição
                let materialReal = null;
                fonteDeDados.forEach(setor => {
                    setor.itens.forEach(it => {
                        const idMestre = String(it.uid_instancia || it.uid_global || it.id);
                        // Se o Pai for um tombamento (ex: 517)
                        if (it.tombamentos) {
                            it.tombamentos.forEach(t => {
                                const idTomb = `${it.uid_global || it.id}-${t.tomb}`;
                                if (idTomb === idPai) materialReal = (t.acessorios_vinculados || it.acessorios_vinculados)[indexAcessorio];
                            });
                        }
                        // Se o Pai for um item simples
                        if (idMestre === idPai) {
                            materialReal = (it.acessorios_vinculados || it.acessorios_acoplados)[indexAcessorio];
                        }
                    });
                });

                if (materialReal) {
                    uidGlobalFinal = materialReal.uid_global || materialReal.id;
                }
            }

            // ✅ LÓGICA DE DESPACHO FIREBASE (USANDO O UID GLOBAL TRADUZIDO)
            const partes = uidGlobalFinal.split('-');
            const ehPatrimonio = partes.length > 4;
            const docIdInventario = ehPatrimonio ? partes.slice(0, -1).join('-') : uidGlobalFinal;
            const itemRef = db.collection('inventario').doc(docIdInventario);

            if (ehPatrimonio) {
                const tombamentoID = partes[partes.length - 1];
                const tombRef = itemRef.collection('tombamentos').doc(tombamentoID);

                batch.set(tombRef.collection('historico_vida').doc("EVT-P-" + Date.now()), {
                    data: dataAtualLog,
                    evento: "ALERTA_VIA_ANFITRIAO",
                    quem: conferenteCompleto,
                    detalhes: `⚠️ Relatado em campo: ${pend.descricao}`,
                    uid_pendencia: pend.id,
                    lista_origem_id: LISTA_ID
                });
                batch.update(tombRef, { situacao_atual: "PENDENTE" });
            } else {
                const saldoRef = itemRef.collection('saldos_unidades').doc(unidadeId);
                const updateData = isChecklist ?
                    { qtd_pend: firebase.firestore.FieldValue.increment(pend.quantidade), last_update: dataAtualLog } :
                    {
                        qtd_disp: firebase.firestore.FieldValue.increment(-pend.quantidade),
                        qtd_pend: firebase.firestore.FieldValue.increment(pend.quantidade),
                        last_update: dataAtualLog
                    };

                batch.update(saldoRef, updateData);
                batch.set(saldoRef.collection('historico_vida').doc("EVT-S-P-" + Date.now()), {
                    data: dataAtualLog,
                    evento: "PENDENCIA_RELATADA",
                    quem: conferenteCompleto,
                    detalhes: `⚠️ Relatado em campo: ${pend.descricao}`,
                    quantidade: pend.quantidade,
                    uid_pendencia: pend.id,
                    lista_origem_id: LISTA_ID,
                    local_sigla: infoLocal.nome || "N/D"
                });
            }
        }

        await batch.commit();

        // ✅ MODAL ELEGANTE DE FINALIZAÇÃO
        Swal.fire({
            title: '<span style="color:#1b8a3e; font-weight:900;">CONFERÊNCIA SALVA!</span>',
            html: `
                <div style="text-align:center; font-family:'Inter', sans-serif;">
                    <i class="fas fa-check-circle" style="font-size:4em; color:#1b8a3e; margin-bottom:15px;"></i>
                    <p style="color:#475569; font-size:0.95em;">Os dados foram sincronizados com sucesso e o inventário atualizado.</p>
                    <div style="background:#f1f5f9; padding:15px; border-radius:12px; margin-top:10px;">
                        <small style="display:block; color:#64748b; text-transform:uppercase; font-weight:800; font-size:0.7em;">Resumo do Despacho</small>
                        <b style="font-size:1.1em; color:#1e293b;">${totalCaa} itens com alteração</b>
                    </div>
                </div>
            `,
            confirmButtonText: '<i class="fas fa-chart-line"></i> IR PARA DASHBOARD',
            confirmButtonColor: '#1b8a3e',
            allowOutsideClick: false,
            customClass: { popup: 'v3-popup-radius' }
        }).then(() => {
            window.top.location.href = "sigma_dashboard.html";
        });

    } catch (e) {
        console.error("V3 Critical Error:", e);
        Swal.fire("Erro de Gravação", "Não foi possível sincronizar os dados: " + e.message, "error");
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
    // ✅ NORMALIZAÇÃO: Garante que estamos olhando para o card físico
    const uidCardNoDom = uidAtual.includes('_ac_') ? uidAtual.split('_ac_')[0] : uidAtual;
    const rowAtual = document.getElementById(`item-row-${uidCardNoDom}`);

    // Se o modal ainda estiver fechando, damos um tempo extra em vez de abortar
    if (Swal.isVisible()) {
        setTimeout(() => verificarFluxoSetor(uidAtual), 200);
        return;
    }

    const rows = Array.from(document.querySelectorAll('.v3-item-row'));
    const index = rows.findIndex(r => r.id === `item-row-${uidCardNoDom}`);
    const nextRow = rows[index + 1];

    if (nextRow) {
        // AINDA HÁ ITENS: Rola para o próximo
        nextRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        nextRow.style.backgroundColor = "#f0f9ff";
        setTimeout(() => nextRow.style.background = "", 1000);
    } else {
        // ✅ FIM DO SETOR: Redirecionamento Garantido
        const Toast = Swal.mixin({
            toast: true, position: 'top', showConfirmButton: false, timer: 2000
        });
        Toast.fire({ icon: 'success', title: 'Setor Concluído!' });

        setTimeout(() => {
            if (typeof navegarParaSetores === 'function') {
                navegarParaSetores();
            }
        }, 1200);
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
