// --- ENGINE VISUAL SIGMA V3 ---

//Ativa o modo de inspeção visual, escondendo a lista de setores e mostrando os itens específicos para conferência.
function navegarParaItens() {
    document.body.classList.add('modo-inspecao');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

//Retorna à visão macro dos setores e dispara a re-renderização para atualizar os indicadores de progresso.
window.navegarParaSetores = function () {
    console.log("%c[NAV] Retornando para o Painel de Setores...", "color: #f43f5e; font-weight: bold;");

    // 1. Transição Visual de Telas
    document.body.classList.remove('modo-inspecao');
    const painelSetores = document.getElementById('v3-painel-setores');
    const painelItens = document.getElementById('v3-painel-itens');

    if (painelSetores) painelSetores.style.display = 'block';
    if (painelItens) painelItens.style.display = 'none';

    // 2. Sincronização de Dados e UI
    if (typeof renderizarConferencia === 'function') {
        // ✅ IMPORTANTE: O renderizarConferencia agora NÃO deve ter o updateOverallStatus dentro dele
        renderizarConferencia();

        // 3. O SEGREDO DO SINCRONISMO:
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (typeof updateOverallStatus === 'function') {
                    console.log("%c[UI] Forçando atualização de badges e barra neon...", "color: #10b981");

                    // ✅ AJUSTE: Forçamos a limpeza de cache visual do navegador antes do update
                    updateOverallStatus();
                }
            });
        });
    }

    // 4. Reset de posição
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

//Atualiza o HUD (painel superior) com o nome da viatura, posto, data, hora e as cores institucionais do modo ativo.
function updateHeaderInfo() {
    const elListaNome = document.getElementById('militar-nome-hud'); // Destaque (Linha 1)
    const elApoioInfo = document.getElementById('local-titulo-hud'); // Apoio (Linha 2)
    const elAvatar = document.getElementById('militar-avatar');

    if (!elListaNome || !elApoioInfo) return;

    // 1. DEFINIÇÃO DE CORES E ÍCONE POR MODO
    const isChecklist = window.isModoChecklist;
    const isCarga = (new URLSearchParams(window.location.search)).get('modo') === 'recebimento_carga';

    let corHUD = "#800020"; // Bordô (Padrão)
    let iconeHUD = "fa-clipboard-list";

    if (isChecklist) {
        corHUD = "#2c3e50"; // Azul Petróleo (Vistoria)
        iconeHUD = "fa-truck-moving";
    } else if (isCarga) {
        corHUD = "#000000"; // Preto (Carga)
        iconeHUD = "fa-exchange-alt";
    }

    // 2. FORMATAÇÃO DOS DADOS DE EXIBIÇÃO
    let destaquePrincipal = infoLocal.nome || "LISTA";

    if (isChecklist) {
        // Captura KM e Combustível via URL (Parâmetros já definidos no app-config.js)
        const km = urlParams.get('km') || "0";
        const combustivel = urlParams.get('combustivel') || "N/D";
        const kmFormatado = Number(km).toLocaleString('pt-BR');

        // Monta o destaque com ÍCONES em vez de textos
        // Usamos innerHTML para renderizar as tags <i> do FontAwesome
        elListaNome.innerHTML = `
            ${infoLocal.nome} 
            <span style="margin: 0 10px; opacity: 0.3;">|</span> 
            <i class="fas fa-tachometer-alt" style="font-size: 0.8em; color: #94a3b8;"></i> ${kmFormatado} 
            <span style="margin: 0 10px; opacity: 0.3;">|</span> 
            <i class="fas fa-gas-pump" style="font-size: 0.8em; color: #94a3b8;"></i> ${combustivel.toUpperCase()}
        `;
    } else {
        const nomePosto = infoLocal.posto ? ` | ${infoLocal.posto}` : "";
        elListaNome.textContent = `${destaquePrincipal}${nomePosto}`;
    }

    // Apoio: Data e Hora atual da sessão
    const agora = new Date();
    const dataFormatada = agora.toLocaleDateString('pt-BR');
    const horaFormatada = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const apoioTexto = `${dataFormatada} às ${horaFormatada}`;
    elApoioInfo.textContent = apoioTexto;

    // 3. ATUALIZAÇÃO DA ESTILIZAÇÃO (HUD)
    if (elAvatar) {
        elAvatar.style.background = corHUD;
        elAvatar.innerHTML = `<i class="fas ${iconeHUD}"></i>`;
    }

    const progressFill = document.getElementById('overall-progress-bar');
    if (progressFill) {
        progressFill.style.background = corHUD;
        progressFill.style.boxShadow = `0 0 10px ${corHUD}`;
    }
}

//Calcula o progresso global da conferência, atualiza a barra neon de progresso e gerencia o estado do botão "Finalizar".
function updateOverallStatus() {
    // 1. MAPEAMENTO DE DADOS (INDEPENDENTE DA TELA ATIVA)
    const fonteDados = window.dadosConferencia || [];
    const isChecklist = window.isModoChecklist;
    let totalItensObrigatorios = 0; // Itens que PRECISAM de conferência
    let concluidosGeral = 0;

    fonteDados.forEach(setor => {
        setor.itens.forEach(item => {
            // ✅ EXCEÇÃO: Ignora o item de foto na contagem de obrigatoriedade global
            if (item.tipo === 'upload_foto') return;

            const uid = isChecklist ? item.id : (item.uid_global || item.id);
            const status = window.itemStatus[uid];

            totalItensObrigatorios++;

            // ✅ AJUSTE PASSO 3: Validação rigorosa de Interação Humana
            // Além do status, exigimos que o militar tenha interagido (Manter/Resolver/Check)
            if (status && status.interacao_humana === true) {
                if (status.status === 'ok' || status.status === 'C/A' || status.cautela_confirmada) {
                    concluidosGeral++;
                }
            }
        });
    });

    const todosConcluidos = totalItensObrigatorios > 0 && concluidosGeral === totalItensObrigatorios;

    // 2. ATUALIZAÇÃO DA BARRA NEON (HEADER HUD)
    const progBar = document.getElementById('overall-progress-bar');
    if (progBar) {
        const percentual = totalItensObrigatorios > 0 ? (concluidosGeral / totalItensObrigatorios) * 100 : 0;
        progBar.style.width = `${percentual}%`;

        if (percentual === 100) {
            progBar.style.background = "#1b8a3e";
            progBar.style.boxShadow = "0 0 10px #1b8a3e";
        } else {
            const corModo = isChecklist ? "#2c3e50" : "#800020";
            progBar.style.background = corModo;
            progBar.style.boxShadow = `0 0 10px ${corModo}`;
        }
    }

    // 3. ATUALIZAÇÃO DO BOTÃO FINALIZAR (TELA 1)
    const btn = document.getElementById('btn-finalizar');
    if (btn) {
        const corV3 = isChecklist ? '#2c3e50' : '#800020';
        const buttonPrefix = isChecklist ? 'FINALIZAR VISTORIA' : 'FINALIZAR CONFERÊNCIA';

        btn.disabled = !todosConcluidos;
        btn.style.transition = "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)";

        if (btn.disabled) {
            btn.innerHTML = `<i class="fas fa-tasks"></i> PENDENTE (${concluidosGeral}/${totalItensObrigatorios})`;
            btn.style.background = '#94a3b8';
            btn.style.transform = 'scale(1)'; // Preservado da sua versão original
            btn.style.animation = 'none';    // Preservado da sua versão original
        } else {
            btn.innerHTML = `<i class="fas fa-paper-plane"></i> ${buttonPrefix}`;
            btn.style.background = corV3;
            btn.style.boxShadow = `0 10px 20px rgba(0,0,0,0.2)`;
            btn.style.animation = "v3-pulse 2s infinite"; // Preservado da sua versão original
        }
    }

    // 4. ATUALIZAÇÃO DAS LINHAS DE SETOR (TELA 1)
    document.querySelectorAll('.v3-setor-row').forEach((row, index) => {
        const setor = fonteDados[index];
        if (!setor) return;

        let totalSetorObrigatorio = 0;
        let concluidosSetor = 0;
        let alertasSetor = 0;

        setor.itens.forEach(it => {
            if (it.tipo === 'upload_foto') return;

            totalSetorObrigatorio++;
            const uidSetor = isChecklist ? it.id : (it.uid_global || it.id);
            const st = window.itemStatus[uidSetor];

            // 1. CONTAGEM DE CONCLUSÃO (Para barra de progresso e ícone de check)
            // Se houve interação humana E o status final é positivo (OK ou Alteração Mantida)
            if (st && st.interacao_humana === true) {
                if (st.status === 'ok' || st.status === 'C/A') {
                    concluidosSetor++;
                }
            }

            // 2. CONTAGEM DE ALERTA (Para o badge vermelho "ALT")
            // Condição A: O item está marcado como Alteração Mantida ou Nova (C/A)
            const temAlteracaoAtiva = (st && st.status === 'C/A');

            // Condição B: Tem pendência no banco mas o usuário ainda NÃO interagiu com ela
            const temPendenciaBancoSemInteracao = (it.pendencias_ids && it.pendencias_ids.length > 0 && (!st || !st.interacao_humana));

            // Condição C: Segurança para não contar se o status final for 'ok' (Resolvido)
            const foiResolvidoAgora = (st && st.status === 'ok');

            if ((temAlteracaoAtiva || temPendenciaBancoSemInteracao) && !foiResolvidoAgora) {
                alertasSetor++;
            }
        });

        // Atualiza os badges de texto dentro da linha do setor
        const badgeTotal = row.querySelector('.badge-total');
        if (badgeTotal) {
            if (totalSetorObrigatorio === 0) {
                badgeTotal.innerText = "REGISTRO OPCIONAL";
            } else {
                badgeTotal.innerText = `${concluidosSetor}/${totalSetorObrigatorio} CONFERIDOS`;
            }
        }

        // Gerencia badge de alertas
        // --- GERENCIAMENTO AGRESSIVO DO BADGE DE ALERTAS ---
        const containerBadges = row.querySelector('.v3-setor-badges');

        if (containerBadges) {
            // Removemos qualquer badge antigo para evitar duplicidade
            const badgeAntigo = containerBadges.querySelector('.badge-alerta');
            if (badgeAntigo) badgeAntigo.remove();

            if (alertasSetor > 0) {
                // Injetamos o HTML puro diretamente
                const htmlAlerta = `<span class="badge-mini badge-alerta" style="
                    display: inline-flex !important; 
                    align-items: center; 
                    gap: 5px; 
                    background-color: #be123c !important; 
                    color: white !important; 
                    padding: 2px 8px !important; 
                    border-radius: 4px !important; 
                    font-weight: bold !important; 
                    font-size: 11px !important;
                    margin-left: 8px !important;
                    visibility: visible !important;
                    opacity: 1 !important;">
                    <i class="fas fa-exclamation-triangle"></i> ${alertasSetor} ALT
                </span>`;

                containerBadges.insertAdjacentHTML('beforeend', htmlAlerta);
                console.log(`%c[UI] Badge injetado no setor ${index} com ${alertasSetor} alertas.`, "color: #10b981");
            }
        }
        // Status de Concluído (Fica verde se os itens OBRIGATÓRIOS estiverem OK)
        if (concluidosSetor === totalSetorObrigatorio && totalSetorObrigatorio > 0) {
            row.classList.add('concluido');
            const icon = row.querySelector('i.fas');
            if (icon) {
                icon.className = 'fas fa-check-circle';
                icon.style.color = "#1b8a3e"; // ✅ VERDE SIGMA
            }
        } else if (totalSetorObrigatorio === 0) {
            row.classList.remove('concluido');
            const icon = row.querySelector('i.fas');
            if (icon) {
                icon.className = 'fas fa-camera';
                icon.style.color = "#94a3b8";
            }
        } else {
            row.classList.remove('concluido');
            const icon = row.querySelector('i.fas');
            if (icon) {
                icon.className = 'fas fa-chevron-right';
                icon.style.color = "#94a3b8";
            }
        }
    });
}

//A função principal de montagem; gera dinamicamente todo o HTML dos setores e itens baseado nos dados vindos do banco.
function renderizarConferencia() {
    // 1. MAPEAMENTO E LIMPEZA DE CONTAINERS V3
    const containerSetores = document.getElementById('lista-setores-container');
    const containerItens = document.getElementById('lista-itens-container');

    if (!containerSetores || !containerItens) return;

    // Limpa os containers antes de renderizar para evitar duplicidade
    containerSetores.innerHTML = '';
    containerItens.innerHTML = '';

    const fonteDados = window.dadosConferencia || dadosConferencia;
    const isChecklist = window.isModoChecklist || false;
    const isRecebimentoCarga = (new URLSearchParams(window.location.search)).get('modo') === 'recebimento_carga';

    // --- CONFIGURAÇÃO DE CORES V3 ---
    let corTema = isChecklist ? '#2c3e50' : (isRecebimentoCarga ? '#000000' : '#800020');

    // 2. RENDERIZAÇÃO DA TELA 1: LINHAS DE SETORES (Visão Macro)
    let htmlSetores = '';
    fonteDados.forEach((setor, index) => {
        const totalItens = setor.itens.length;

        let concluidosSetor = 0;
        let alertasSetor = 0;
        setor.itens.forEach(it => {
            const uid = it.uid_global || it.id;
            const status = window.itemStatus[uid];

            // 1. Contagem de Conclusão (Para o 1/1)
            if (status && status.interacao_humana) {
                concluidosSetor++;
            }

            // 2. Contagem de Alertas (Para o Badge Vermelho)
            // Se o status for 'C/A' (Mantido) OU se o item tem pendências reais no banco
            // Mas apenas se ele NÃO foi resolvido totalmente (status 'ok')
            const temAlteracaoAtiva = (status && status.status === 'C/A');
            const temPendenciaBanco = (it.pendencias_ids && it.pendencias_ids.length > 0);
            const foiResolvidoTotal = (status && status.status === 'ok');

            if ((temAlteracaoAtiva || temPendenciaBanco) && !foiResolvidoTotal) {
                alertasSetor++;
            }
        });

        const setorCompleto = (concluidosSetor === totalItens && totalItens > 0);

        // SOLUÇÃO: Define a cor verde se estiver concluído, caso contrário mantém o cinza padrão
        const estiloIcone = setorCompleto ? 'color: #1b8a3e !important;' : 'color: #94a3b8;';

        htmlSetores += `
                <div class="v3-setor-row ${setorCompleto ? 'concluido' : ''}" onclick="entrarNoSetor(${index})">
                    <div class="v3-setor-label">
                        <strong>${setor.nome}</strong>
                        <div class="v3-setor-badges">
                            <span class="badge-mini badge-total">${concluidosSetor}/${totalItens} CONFERIDOS</span>
                            ${alertasSetor > 0 ? `<span class="badge-mini badge-alerta"><i class="fas fa-exclamation-triangle"></i> ${alertasSetor} ALT</span>` : ''}
                        </div>
                    </div>
                    <i class="fas ${setorCompleto ? 'fa-check-circle' : 'fa-chevron-right'}" style="${estiloIcone}"></i>
                </div>`;
    });

    containerSetores.innerHTML = htmlSetores;

    // 3. FUNÇÃO DE NAVEGAÇÃO (Com Desvio Inteligente para Fotos)
    window.entrarNoSetor = function (index) {
        const setor = fonteDados[index];
        const containerItens = document.getElementById('lista-itens-container');

        // Atualiza cabeçalho da Tela 2
        document.getElementById('nome-setor-atual').innerText = setor.nome;
        document.getElementById('nome-setor-atual').style.color = corTema;

        // ✅ DESVIO PARA MÓDULO FOTOGRÁFICO
        if (setor.nome.toUpperCase().includes("FOTOGRÁFICO")) {
            renderizarPainelFotos(containerItens);
        } else {
            // Renderização padrão de itens
            renderizarLinhasItens(setor.itens, index);
        }

        document.body.classList.add('modo-inspecao');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // 4. RENDERIZAÇÃO DA TELA 2: LINHAS ELEGANTES DE ITENS (Visão Micro)
    function renderizarLinhasItens(itens, setorIndex) {
        const container = document.getElementById('lista-itens-container');
        const isChecklist = window.isModoChecklist;

        if (!container) return;
        container.innerHTML = '';

        if (!itens || itens.length === 0) {
            const fonteBackup = window.dadosConferencia || [];
            if (fonteBackup[setorIndex]) {
                itens = fonteBackup[setorIndex].itens;
            } else {
                console.error("Erro Crítico: Setor não localizado.");
                return;
            }
        }

        itens.forEach((item) => {
            const uid = isChecklist ? item.id : (item.uid_global || item.id);
            const statusLocal = window.itemStatus[uid] || {};
            const st = statusLocal.status;

            const temPendenciaAnterior = item.pendencias_ids && item.pendencias_ids.length > 0;
            const devePulsar = temPendenciaAnterior && !statusLocal.interacao_humana;

            const totalEsperado = Number(item.quantidadeEsperada || item.quantidade || 0);
            const totalCautelado = (item.cautelas || []).reduce((s, c) => s + (Number(c.quantidade) || 0), 0);
            const totalPendente = (item.pendencias_ids || []).reduce((s, p) => s + (Number(p.quantidade) || 0), 0);
            const saldoDisponivel = totalEsperado - totalCautelado - totalPendente;

            const classeStatus = (st === 'ok') ? 'status-ok' : (st === 'C/A' ? 'status-alert' : '');
            const classeCarimbo = (temPendenciaAnterior || (item.cautelas && item.cautelas.length > 0)) ? 'has-carimbo' : '';
            const nomeSanitizado = item.nome.replace(/'/g, "\\'").replace(/"/g, '&quot;');

            // --- ITEM PRINCIPAL (PAI OU AVULSO) ---
            container.innerHTML += `
            <div class="v3-item-row ${classeStatus} ${classeCarimbo}" id="item-row-${uid}">
                <div class="v3-item-main-info">
                    <span class="v3-item-name">${item.nome}</span>
                    ${!isChecklist ? `<span class="v3-item-subtext">DISPONÍVEL: <b>${saldoDisponivel}/${totalEsperado}</b></span>` : ''}
                    ${item.tipo === 'multi' && item.tombamentos ?
                    `<span class="v3-item-subtext">TOMB: <b>${item.tombamentos.map(t => t.tomb).join(', ')}</b></span>` : ''}
                </div>
                <div class="v3-item-actions">
                    <button class="v3-btn-circle btn-check ${st === 'ok' ? 'active' : ''}" 
                            onclick="registrarCheckRapido(this, '${uid}', ${setorIndex})">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="v3-btn-circle btn-alert ${st === 'C/A' ? 'active' : ''} ${devePulsar ? 'v3-pulse-orange' : ''}" 
                            style="${devePulsar ? 'background-color: #f57c00 !important; color: white;' : ''}"
                            onclick="abrirModalPendenciaV3('${uid}', '${item.tipo}', '${nomeSanitizado}', ${saldoDisponivel})">
                        <i class="fas fa-exclamation"></i>
                    </button>
                </div>
            </div>`;

            // ✅ NOVO: RENDERIZAÇÃO DE ACESSÓRIOS ACOPLADOS (FILHOS)
            // Se este item (anfitrião) carregar acessórios vinculados
            if (item.acessorios_acoplados && item.acessorios_acoplados.length > 0) {
                item.acessorios_acoplados.forEach((ac, idx) => {
                    const acUid = `${uid}_ac_${idx}`; // ID virtual para controle de status
                    const acStatus = window.itemStatus[acUid] || {};
                    const acSt = acStatus.status;
                    const acClasse = (acSt === 'ok') ? 'status-ok' : (acSt === 'C/A' ? 'status-alert' : '');

                    container.innerHTML += `
                    <div class="v3-item-row child-item ${acClasse}" id="item-row-${acUid}" 
                         style="margin-left: 25px; min-height: 50px; background: #fdfdfd; border-left: 3px solid #cbd5e1; width: calc(100% - 25px);">
                        <div class="v3-item-main-info" style="padding-left: 10px;">
                            <span class="v3-item-name" style="font-size: 0.85em; color: #475569;">
                                <i class="fas fa-level-up-alt fa-rotate-90" style="font-size: 0.7em; margin-right: 5px; color: #94a3b8;"></i>
                                ${ac.nome}
                            </span>
                            <span class="v3-item-subtext" style="font-size: 0.65em;">ACESSÓRIO ACOPLADO • QTD: ${ac.quantidade}</span>
                        </div>
                        <div class="v3-item-actions">
                            <button class="v3-btn-circle btn-check ${acSt === 'ok' ? 'active' : ''}" 
                                    style="width: 32px; height: 32px; font-size: 0.7em;"
                                    onclick="registrarCheckRapido(this, '${acUid}', ${setorIndex})">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="v3-btn-circle btn-alert ${acSt === 'C/A' ? 'active' : ''}" 
                                    style="width: 32px; height: 32px; font-size: 0.7em;"
                                    onclick="abrirModalPendenciaV3('${acUid}', 'single', '${ac.nome.replace(/'/g, "\\'")}', ${ac.quantidade}, '${uid}')">
                                <i class="fas fa-exclamation"></i>
                            </button>
                        </div>
                    </div>`;
                });
            }
        });

        if (typeof atualizarContadorSetorInterno === 'function') {
            atualizarContadorSetorInterno(itens);
        }
    }

    /**
     * LOGICA DE CHECK RÁPIDO (S/A)
     * Modificada para respeitar o Auto-Advance se for o último item.
     */
    window.registrarCheckRapido = function (btn, uid, setorIndex) {
        if (typeof setItemStatusID === 'function') {
            setItemStatusID(btn, 'ok', uid);
        }

        const row = document.getElementById(`item-row-${uid}`);
        if (row) {
            row.classList.remove('status-alert');
            row.classList.add('status-ok');
            btn.classList.add('active');

            // Remove pulso se existir
            const btnAlert = row.querySelector('.btn-alert');
            if (btnAlert) {
                btnAlert.classList.remove('v3-pulse-orange');
                btnAlert.style.backgroundColor = "";
            }
        }
    };
}

/*---------------------------------------------------------------------------------------------------------------------------
-- Analisa um setor específico e atualiza seu selo de status (Check, Alerta ou em andamento) conforme os itens são conferidos
---------------------------------------------------------------------------------------------------------------------------*/
function updateSetorStatus(setorEl) {
    if (!setorEl) return;

    const itensPai = setorEl.querySelectorAll('.item-conferencia');
    let concluidos = 0;
    let total = itensPai.length;

    itensPai.forEach(item => {
        if (item.classList.contains('status-ok') || item.classList.contains('status-alert')) {
            concluidos++;
        }
    });

    setorEl.dataset.totalItems = total;

    const st = setorEl.querySelector('.setor-status');
    if (st) {
        st.dataset.completed = concluidos;
        st.style.color = "#ffffff";
        st.style.transition = "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)";

        if (concluidos === total && total > 0) {
            const temAlerta = setorEl.querySelectorAll('.item-conferencia.status-alert').length > 0;

            // ✅ UX V3: Texto mais curto com ícone para não quebrar o layout no mobile
            if (temAlerta) {
                st.innerHTML = '<i class="fas fa-exclamation-triangle"></i> C/ ALT';
                st.style.backgroundColor = "#d90f23";
                st.style.boxShadow = "0 0 12px rgba(217, 15, 35, 0.4)";
            } else {
                st.innerHTML = '<i class="fas fa-check-circle"></i> S/A';
                st.style.backgroundColor = "#1b8a3e";
                st.style.boxShadow = "0 0 12px rgba(27, 138, 62, 0.4)";
            }
            st.classList.add('ok');
            st.style.minWidth = "70px"; // Largura ajustada para o ícone
        } else {
            // Estado de Progresso (Andamento)
            st.innerHTML = `<i class="fas fa-spinner fa-spin" style="font-size: 0.8em; margin-right: 4px;"></i> ${concluidos}/${total}`;
            st.classList.remove('ok');
            st.style.backgroundColor = "rgba(0,0,0,0.4)"; // Efeito de transparência V3
            st.style.boxShadow = "none";
            st.style.minWidth = "55px";
        }
    }
}

/*--------------------------------------------------------------------------------------------------------------------------------
-- Gerencia a identidade visual dos cards de materiais, mudando cores e ícones conforme o preenchimento de tombamentos ou cautelas.
---------------------------------------------------------------------------------------------------------------------------------*/
function updateItemMainStatusDisplay(item) {
    if (!item || item.dataset.type === 'single') return;

    const tombs = item.querySelectorAll('.tombamento-container');
    let concluidos = 0;
    let temAlteracao = false;

    // ✅ AJUSTE V3: Identidade Visual Dinâmica
    const isChecklist = window.isModoChecklist;
    const corV3 = isChecklist ? '#2c3e50' : '#800020';

    tombs.forEach(t => {
        const uidOriginal = t.getAttribute('data-id');
        const uidCautela = `CAUTELA-${uidOriginal}`;

        const statusObj = window.itemStatus[uidOriginal];
        const statusCautelaObj = window.itemStatus[uidCautela];

        const s = statusObj ? statusObj.status : null;
        const sCautela = statusCautelaObj ? statusCautelaObj.status : null;

        // Lógica de Preenchimento: OK, Alteração, Mantido ou Ciente
        const preenchido = (s === 'ok' || s === 'C/A' || s === 'KEEP' || sCautela === 'cautela_ciente');

        if (preenchido) {
            concluidos++;
            if (s === 'C/A' || s === 'KEEP' || sCautela === 'cautela_ciente') {
                temAlteracao = true;
            }
        }
    });

    const icon = item.querySelector('.status-icon');

    // Reseta classes e estilos para aplicação limpa
    item.classList.remove('status-ok', 'status-alert');
    item.style.backgroundColor = "";
    if (icon) {
        icon.className = 'status-icon';
        icon.style.backgroundColor = "";
    }

    // ✅ LÓGICA DE ATIVAÇÃO V3: Feedback Visual do Item Pai
    if (concluidos === tombs.length && tombs.length > 0) {
        if (temAlteracao) {
            item.classList.add('status-alert');
            if (icon) {
                icon.classList.add('alert');
                icon.style.backgroundColor = "#d90f23"; // Vermelho Alerta
            }
        } else {
            item.classList.add('status-ok');
            if (icon) {
                icon.classList.add('ok');
                icon.style.backgroundColor = corV3; // Cor Institucional (Bordô/Azul)
            }
            // Efeito sutil de preenchimento no card pai para indicar "Setor Resolvido"
            item.style.backgroundColor = "rgba(40, 167, 69, 0.03)";
        }
    }

    // Atualiza o contador do setor (badge) lá no topo
    const setorEl = item.closest('.setor');
    if (setorEl) updateSetorStatus(setorEl);
}

/*---------------------------------------------------------------------------------------------------------
-- Renderiza o painel fotográfico com sugestões e botão de upload (em breve integração com Firebase Storage)
----------------------------------------------------------------------------------------------------------*/
function renderizarPainelFotos(container) {
    container.innerHTML = `
            <div class="v3-foto-panel" style="text-align: center; padding: 10px;">
                <div style="background: #fff; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px; text-align: left;">
                    <strong style="color: var(--petroleo); font-size: 0.85em; display: block; margin-bottom: 10px;">
                        <i class="fas fa-lightbulb"></i> SUGESTÕES DE REGISTRO:
                    </strong>
                    <ul style="margin: 0; padding-left: 20px; font-size: 0.8em; color: #64748b; line-height: 1.6;">
                        <li>Frente e Traseira (Placa visível)</li>
                        <li>Laterais (Direita e Esquerda)</li>
                        <li>Painel (Hodômetro e Combustível)</li>
                        <li style="color: var(--vinho); font-weight: bold; margin-top: 5px;">
                            <i class="fas fa-mobile-alt" style="transform: rotate(90deg);"></i> PREFIRA FOTOS NA HORIZONTAL
                        </li>
                    </ul>
                </div>

                <div id="container-camera-v3">
                    <button class="v3-btn-main" style="background: #64748b; width: 100%; height: 80px; border-radius: 15px; font-size: 1em;" 
                            onclick="Swal.fire('Em breve', 'O módulo de upload para o Firebase Storage está sendo preparado.', 'info')">
                        <i class="fas fa-camera" style="font-size: 1.5em; display: block; margin-bottom: 5px;"></i>
                        ANEXAR FOTOS (EM BREVE)
                    </button>
                    <small style="color: #94a3b8; display: block; margin-top: 10px; font-weight: 600;">
                        MÁXIMO: 5 FOTOS | ATÉ 10MB CADA
                    </small>
                </div>

                <div id="galeria-miniaturas" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 25px;">
                    </div>
            </div>
        `;
}

/*--------------------------------------------------------------------------------------------------------------------
-- Analisa os itens de um setor específico e atualiza o contador de progresso exibido no cabeçalho da tela de inspeção.
----------------------------------------------------------------------------------------------------------------------*/
function atualizarContadorSetorInterno(itens) {
    let feitos = 0;
    itens.forEach(it => {
        const st = window.itemStatus[it.uid_global || it.id]?.status;
        if (st === 'ok' || st === 'C/A' || st === 'cautela_ciente') feitos++;
    });
    document.getElementById('progresso-setor-atual').innerText = `${feitos}/${itens.length}`;
}

// --- VERIFICADOR MÁGICO DE FLUXO (AUTO-NEXT) ---
window.verificarFluxoSetor = function (uidAtual) {
    console.log(`%c🚀 Iniciando Verificação de Fluxo para: ${uidAtual}`, "color: #8b5cf6; font-weight: bold;");

    const rows = Array.from(document.querySelectorAll('.v3-item-row'));
    const index = rows.findIndex(r => r.id === `item-row-${uidAtual}`);

    // ✅ 2. Garantia de Leitura de Status
    const statusAtual = window.itemStatus[uidAtual];
    const itemConcluido = statusAtual && statusAtual.interacao_humana === true && statusAtual.status === 'ok';

    if (!itemConcluido) {
        console.warn("⚠️ Item ainda não consta como 'ok' na memória. Abortando fluxo.");
        return;
    }

    const nextRow = rows[index + 1];

    // ✅ 3. Lógica de Avanço (Próximo Item)
    if (nextRow) {
        console.log("➡️ Indo para o próximo item do setor...");
        setTimeout(() => {
            nextRow.scrollIntoView({ behavior: 'smooth', block: 'center' });

            const isChecklist = window.isModoChecklist;
            const corDestaque = isChecklist ? "rgba(44, 62, 80, 0.1)" : "rgba(128, 0, 32, 0.1)";

            nextRow.style.transition = "background 0.5s ease";
            nextRow.style.background = corDestaque;

            setTimeout(() => { nextRow.style.background = ""; }, 800);
        }, 100); // Reduzido para ser mais rápido

    } else {
        // ✅ 4. Lógica de Retorno (Fim do Setor)
        console.log("%c✅ Fim do setor detectado. Preparando retorno para Tela 1.", "color: #10b981; font-weight: bold;");

        // Atualiza a barra de progresso imediatamente
        updateOverallStatus();

        const Toast = Swal.mixin({
            toast: true,
            position: 'top',
            showConfirmButton: false,
            timer: 1200,
            timerProgressBar: true
        });

        Toast.fire({
            icon: 'success',
            title: 'Setor Finalizado!',
            text: 'Atualizando progresso...'
        });

        // ✅ AUTO-BACK REFORÇADO E ACELERADO
        setTimeout(() => {
            console.log("🔄 Executando navegação para Tela 1...");

            // Removemos a classe de inspeção antes de trocar os painéis
            document.body.classList.remove('modo-inspecao');

            if (typeof window.navegarParaSetores === 'function') {
                window.navegarParaSetores();
            } else if (typeof navegarParaSetores === 'function') {
                navegarParaSetores();
            } else {
                // Fallback de emergência (Garante a troca visual de painéis)
                const painelSetores = document.getElementById('v3-painel-setores');
                const painelItens = document.getElementById('v3-painel-itens');

                if (painelSetores) painelSetores.style.display = 'block';
                if (painelItens) painelItens.style.display = 'none';

                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            // Recontagem final após a transição de tela
            setTimeout(() => {
                if (typeof updateOverallStatus === 'function') updateOverallStatus();
            }, 300);

        }, 1300); // Tempo reduzido para maior fluidez
    }
};

function checkSetorCompletion(currentSetor, currentItemId) {
    if (!currentSetor) return;

    updateOverallStatus();

    const totalItensNoSetor = parseInt(currentSetor.getAttribute('data-total-items')) || 0;
    const itensNoSetor = currentSetor.querySelectorAll('.item-conferencia');
    let concluidos = 0;

    itensNoSetor.forEach(item => {
        const id = item.getAttribute('data-id');
        const isSingle = item.getAttribute('data-type') === 'single';
        const temStatusVisual = item.classList.contains('status-ok') || item.classList.contains('status-alert');

        if (isSingle) {
            // LÓGICA V3: Verificação rigorosa de interação humana para garantir validade
            const statusMemoria = window.itemStatus[id];
            if (temStatusVisual && statusMemoria && statusMemoria.interacao_humana === true) {
                concluidos++;
            }
        } else {
            if (temStatusVisual) concluidos++;
        }
    });

    // ✅ FLUXO V3: Avanço de Setor ou busca do próximo item pendente
    if (concluidos >= totalItensNoSetor && totalItensNoSetor > 0) {
        // Setor finalizado: Feedback visual de "Check" antes de fechar
        currentSetor.style.transition = "opacity 0.3s";
        currentSetor.style.opacity = "0.7";

        setTimeout(() => {
            currentSetor.style.opacity = "1";
            autoAdvanceSetor(currentSetor);
        }, 550);
    } else {
        // Busca inteligente do próximo alvo (Single ou Tombamento) dentro da lista geral
        const todosAlvos = Array.from(document.querySelectorAll('.tombamento-container, .item-conferencia[data-type="single"]'));
        const indexAtual = todosAlvos.findIndex(el => el.getAttribute('data-id') === currentItemId);

        const proximoAlvo = todosAlvos.slice(indexAtual + 1).find(el => {
            const id = el.getAttribute('data-id');
            const type = el.getAttribute('data-type');
            const stNormal = window.itemStatus[id]?.status;
            const stCautela = window.itemStatus[`CAUTELA-${id}`]?.status;
            const interacao = window.itemStatus[id]?.interacao_humana;

            const jaResolvido = (type === 'single')
                ? (interacao === true && (stNormal === 'ok' || stNormal === 'C/A'))
                : (stNormal === 'ok' || stNormal === 'C/A' || stNormal === 'KEEP' || stCautela === 'cautela_ciente');

            return !jaResolvido;
        });

        if (proximoAlvo) {
            setTimeout(() => {
                // ✅ UX V3: Scroll com efeito Spotlight (brilho de foco)
                proximoAlvo.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Aplica um "alerta visual" suave de que este é o novo foco
                const isChecklist = window.isModoChecklist;
                const glowColor = isChecklist ? "rgba(44, 62, 80, 0.4)" : "rgba(245, 124, 0, 0.4)";

                proximoAlvo.style.transition = "box-shadow 0.4s ease";
                proximoAlvo.style.boxShadow = `0 0 20px ${glowColor}`;

                setTimeout(() => proximoAlvo.style.boxShadow = "none", 1200);
            }, 350);
        }
    }
}

function autoAdvanceSetor(currentSetorElement) {
    const todosSetores = Array.from(document.querySelectorAll('.setor'));
    const currentIndex = todosSetores.indexOf(currentSetorElement);

    const currentContent = currentSetorElement.querySelector('.setor-content');
    const currentArrow = currentSetorElement.querySelector('.arrow');
    const currentHeader = currentSetorElement.querySelector('.setor-header');

    // ✅ UX V3: Fechamento elegante com reset de bordas
    if (currentContent) currentContent.classList.remove('expanded');
    if (currentArrow) currentArrow.innerHTML = '<i class="fas fa-chevron-right"></i>';
    if (currentHeader) currentHeader.style.borderRadius = "12px";

    // Verifica se existe um próximo setor
    if (currentIndex !== -1 && currentIndex < todosSetores.length - 1) {
        const nextSetorEl = todosSetores[currentIndex + 1];
        const nextContent = nextSetorEl.querySelector('.setor-content');
        const nextArrow = nextSetorEl.querySelector('.arrow');
        const nextHeader = nextSetorEl.querySelector('.setor-header');

        // ✅ Transição V3: Pequena pausa para o olho humano processar o fechamento
        setTimeout(() => {
            if (nextContent) nextContent.classList.add('expanded');
            if (nextArrow) nextArrow.innerHTML = '<i class="fas fa-chevron-down"></i>';
            if (nextHeader) nextHeader.style.borderRadius = "12px 12px 0 0";

            // Scroll suave focado no início do novo setor
            nextSetorEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

            // Feedback visual: Brilho temporário no cabeçalho do novo setor
            if (nextHeader) {
                const isChecklist = window.isModoChecklist;
                const activeColor = isChecklist ? "rgba(44, 62, 80, 0.2)" : "rgba(128, 0, 32, 0.2)";
                nextHeader.style.boxShadow = `0 0 20px ${activeColor}`;
                setTimeout(() => { nextHeader.style.boxShadow = ""; }, 1000);
            }
        }, 300);

    } else {
        // ✅ FINAL DO FLUXO: Guia o usuário diretamente ao botão de ação final
        const btnFin = document.getElementById('btn-finalizar');
        if (btnFin) {
            setTimeout(() => {
                btnFin.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Animação de pulso no botão para indicar prontidão
                btnFin.style.transform = "translateX(-50%) scale(1.1)";
                setTimeout(() => { btnFin.style.transform = "translateX(-50%) scale(1)"; }, 400);
            }, 400);
        }
    }
}

function injetarCautelasNaLista() {
    const fonteDados = window.dadosConferencia || dadosConferencia;
    // Aqui simulamos a leitura da sua coleção cautelas_abertas
    // No seu código real, você deve garantir que window.cautelasAbertas contenha os itens que você me enviou
    const cautelas = window.cautelasAbertas || [];

    fonteDados.forEach(setor => {
        setor.itens.forEach(item => {
            cautelas.forEach(cautelaDoc => {
                cautelaDoc.itens.forEach(itemCautelado => {
                    // Se o ID base coincide (Ex: 56911524-64012364)
                    if (item.id === itemCautelado.id_base) {

                        if (item.tipo === 'multi' && item.tombamentos) {
                            // Procura o tombamento específico (Ex: 511.524 ou 511.527)
                            const t = item.tombamentos.find(tomb => tomb.tomb === itemCautelado.tombamento);
                            if (t) {
                                t.cautela = {
                                    destinatario: cautelaDoc.destinatario_original_nome,
                                    quantidade: 1,
                                    id_cautela: cautelaDoc.cautela_id
                                };
                            }
                        } else if (item.tipo === 'single') {
                            if (!item.cautelas) item.cautelas = [];
                            // Evita duplicados
                            if (!item.cautelas.find(c => c.id_cautela === cautelaDoc.cautela_id)) {
                                item.cautelas.push({
                                    destinatario: cautelaDoc.destinatario_original_nome,
                                    quantidade: itemCautelado.quantidade,
                                    id_cautela: cautelaDoc.cautela_id
                                });
                            }
                        }
                    }
                });
            });
        });
    });
}

/* --- Função auxiliar de detecção visual de elementos --- */
function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (rect.top >= 60 && rect.left >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) && rect.right <= (window.innerWidth || document.documentElement.clientWidth));
}
