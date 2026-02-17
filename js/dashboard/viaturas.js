async function carregarVtrBasesCards() {
    const container = document.getElementById('vtr-bases-cards-container');
    if (!container) return;

    container.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding:60px; color:#64748b;">
            <i class="fas fa-sync fa-spin fa-3x" style="opacity:0.3; margin-bottom:15px; display:block;"></i>
            <span style="font-weight:700; letter-spacing:1px; text-transform:uppercase; font-size:0.8em;">Sincronizando Frota Global...</span>
        </div>`;

    try {
        const snapshot = await db.collection('viaturas').orderBy('prefixo', 'asc').get();

        if (snapshot.empty) {
            container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:50px; color:#94a3b8;">Nenhuma viatura cadastrada no sistema.</div>`;
            return;
        }

        let html = '';

        snapshot.forEach(doc => {
            const vtr = doc.data();
            const status = vtr.status_operativo || 'ativo';
            const statusLabel = status === 'ativo' ? 'PRONTO' : (status === 'manutencao' ? 'BAIXADO' : 'RESERVA');
            const statusClass = status === 'ativo' ? 'v3-status-pronto' : 'v3-status-manutencao';

            const podeEditarOuExcluir = ['admin', 'gestor_geral'].includes(currentUserData?.role);
            const corTema = status === 'ativo' ? '#166534' : (status === 'manutencao' ? '#991b1b' : '#c2780e');

            const iconMap = {
                incendio: 'fa-truck-moving',
                ambulancia: 'fa-solid fa-truck-medical',
                salvamento: 'fa-solid fa-truck-pickup',
                passeio: 'fa-solid fa-car-side'
            };
            const iconClass = iconMap[vtr.segmento] || 'fa-solid fa-car';
            const modeloLimpo = (vtr.modelo || "").replace(/'/g, "\\'").replace(/"/g, '&quot;');

            // ✅ ADICIONADO: Evento onclick="abrirModalDetalhesVtr(...)" no card principal
            html += `
                <div class="v3-posto-card" 
                     onclick="abrirModalDetalhesVtr('${vtr.unidade_id}', '${doc.id}')"
                     style="border-left: 6px solid ${corTema}; min-height: 220px; cursor: pointer;">
                    
                    <div class="v3-posto-actions">
                        ${podeEditarOuExcluir ? `
                            <button class="v3-btn-action" onclick="event.stopPropagation(); abrirFormularioViatura({ 
                                uid: '${doc.id}', 
                                prefixo: '${vtr.prefixo}', 
                                placa: '${vtr.placa}', 
                                unidade_id: '${vtr.unidade_id}',
                                segmento: '${vtr.segmento}',
                                status: '${status}',
                                modelo: '${modeloLimpo}',
                                ano: '${vtr.ano}',
                                km_atual: ${vtr.km_atual || 0},
                                oleo_data: '${vtr.manutencao?.oleo_data || ''}',
                                oleo_km: ${vtr.manutencao?.oleo_km_prevista || 0}
                            })">
                                <i class="fas fa-pencil-alt"></i>
                            </button>
                            <button class="v3-btn-action" onclick="event.stopPropagation(); deletarViaturaGlobal('${doc.id}', '${vtr.prefixo}')">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        ` : `<i class="fas fa-lock" style="color:#cbd5e1; font-size: 0.8em; margin: 5px;"></i>`}
                    </div>

                    <div style="padding: 20px; flex-grow: 1; display: flex; flex-direction: column; align-items: center; text-align: center;">
                        
                        <div class="v3-icon-box" style="background: ${corTema}15; color: ${corTema}; width: 60px; height: 60px; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin-bottom: 15px;">
                            <i class="${iconClass}" style="font-size: 1.8em;"></i>
                        </div>

                        <div style="width: 100%; margin-bottom: 10px;">
                            <span style="display:block; font-weight:900; font-size:1.3em; color:#1e293b; letter-spacing:-0.5px; margin-bottom: 2px;">${vtr.prefixo}</span>
                            <span style="display:block; font-size: 0.75em; font-weight: 800; color: #64748b; text-transform: uppercase;">${vtr.modelo} | ${vtr.placa}</span>
                        </div>

                        <div style="width: 100%; margin-top: auto;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
                                <span class="v3-vtr-badge ${statusClass}">${statusLabel}</span>
                                <span style="font-weight: 900; color: #2c7399; font-size: 0.75em;">${vtr.unidade_sigla || 'ADMIN'}</span>
                            </div>
                            
                            <div class="v3-vtr-km-info">
                                <div style="text-align: left;">
                                    <small style="display:block; font-size:0.6em; color:#94a3b8; font-weight:800; text-transform:uppercase;">KM Atual</small>
                                    <span style="font-size:0.85em; font-weight:900; color:#1e293b;">${Number(vtr.km_atual || 0).toLocaleString('pt-BR')} km</span>
                                </div>
                                <div style="text-align: right;">
                                    <small style="display:block; font-size:0.6em; color:#94a3b8; font-weight:800; text-transform:uppercase;">Próx. Óleo</small>
                                    <span style="font-size:0.85em; font-weight:900; color:#c2780e;">${Number(vtr.manutencao?.oleo_km_prevista || 0).toLocaleString('pt-BR')} km</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
        });

        container.innerHTML = html;

        // Gatilho para processar ícones se usar FontAwesome JS
        if (window.FontAwesome) FontAwesome.dom.i2svg();

    } catch (e) {
        console.error("Erro ao carregar frota:", e);
        container.innerHTML = `<p style="color:red; text-align:center; padding:40px;">Erro técnico ao carregar frota global.</p>`;
    }
}
async function deletarViaturaGlobal(uid, prefixo) {
    // 1. Confirmação Estilizada
    const confirmacao = await Swal.fire({
        title: 'Excluir Viatura?',
        html: `Você está removendo o ativo <b>${prefixo}</b> do sistema.<br>Esta ação é irreversível.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#991b1b', // Vermelho Escuro
        cancelButtonColor: '#64748b',
        confirmButtonText: 'SIM, REMOVER',
        cancelButtonText: 'CANCELAR',
        reverseButtons: true
    });

    if (!confirmacao.isConfirmed) return;

    // Feedback de processamento
    Swal.fire({
        title: 'Removendo Ativo...',
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        // 2. Remoção no Firestore
        await db.collection('viaturas').doc(uid).delete();

        // 3. Efeito Visual de Desintegração V3
        const cards = document.querySelectorAll('.v3-posto-card');
        cards.forEach(card => {
            if (card.innerHTML.includes(uid) || card.innerText.includes(prefixo)) {
                card.style.transition = "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)";
                card.style.opacity = "0";
                card.style.transform = "scale(0.8) translateY(20px)";
                card.style.filter = "blur(10px)";

                setTimeout(() => {
                    card.remove();
                    // Se não sobrarem cards, recarrega para mostrar a mensagem de lista vazia
                    if (document.querySelectorAll('#vtr-bases-cards-container .v3-posto-card').length === 0) {
                        carregarVtrBasesCards();
                    }
                }, 600);
            }
        });

        // 4. Toast de Sucesso
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000
        });
        Toast.fire({ icon: 'success', title: 'Viatura removida da frota.' });

    } catch (e) {
        console.error("Erro ao excluir viatura:", e);
        Swal.fire('Erro', 'Não foi possível excluir o ativo. Verifique sua conexão.', 'error');
    }
}
function filtrarViaturasCards() {
    const termo = document.getElementById('input-busca-vtr').value.trim().toLowerCase().replace(/[^A-Z0-9]/gi, '');
    const statusFiltro = document.getElementById('filtro-vtr-status').value;
    const cards = document.querySelectorAll('#vtr-bases-cards-container .v3-posto-card');

    cards.forEach(card => {
        // Captura o texto do card para busca
        const textoCard = card.innerText.toLowerCase().replace(/[^A-Z0-9]/gi, '');

        // Captura o status do card através da classe de badge
        const badge = card.querySelector('.v3-vtr-badge');
        const statusCard = badge.classList.contains('v3-status-pronto') ? 'ativo' :
            (badge.innerText.includes('BAIXADO') ? 'manutencao' : 'reserva');

        const bateTexto = textoCard.includes(termo);
        const bateStatus = (statusFiltro === 'todos' || statusCard === statusFiltro);

        if (bateTexto && bateStatus) {
            card.style.display = "flex";
            card.style.animation = "fadeIn 0.3s ease";
        } else {
            card.style.display = "none";
        }
    });
}

// 🛑 Adicione esta função auxiliar para deletar da coleção GLOBAL
async function deletarAtivoGlobal(ativoUid, nomeIdentificador) {
    if (!confirm(`Deseja realmente remover a viatura "${nomeIdentificador}" do sistema global?`)) return;
    try {
        await db.collection('viaturas').doc(ativoUid).delete();
        alert("Viatura removida com sucesso!");
        carregarVtrBasesCards();
    } catch (e) {
        alert("Erro ao excluir viatura.");
    }
}

function fecharModalVtr() {
    // 1. Comando oficial para fechar modais do SweetAlert2
    if (typeof Swal !== 'undefined' && Swal.isVisible()) {
        Swal.close();
    }

    // 2. Segurança: Tenta fechar o elemento antigo apenas se ele ainda existir no DOM
    const modalLegado = document.getElementById('modal-detalhes-vtr');
    if (modalLegado) {
        modalLegado.style.display = 'none';
    }
}

async function abrirModalDetalhesVtr(unidadeUid, ativoUid) {
    Swal.fire({
        title: 'Acessando Prontuário...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const doc = await db.collection('viaturas').doc(ativoUid).get();
        if (!doc.exists) throw new Error("Viatura não localizada.");

        const vtr = doc.data();
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        // --- LÓGICA DE SEMÁFOROS (Cores Dinâmicas) ---

        // 1. Licenciamento
        let anoExercicio = vtr.licenciamento ? parseInt(vtr.licenciamento.toString().substring(0, 4)) : null;
        let licStatus = "N/D", licColor = "#94a3b8", licBg = "#f1f5f9";
        if (anoExercicio) {
            const isVencido = anoExercicio < hoje.getFullYear();
            licStatus = isVencido ? 'VENCIDO' : 'EM DIA';
            licColor = isVencido ? '#991b1b' : '#166534';
            licBg = isVencido ? '#fef2f2' : '#dcfce7';
        }

        // 2. Troca de Óleo
        const kmPrevisto = vtr.manutencao?.oleo_km_prevista || 0;
        const kmAtual = vtr.km_atual || 0;
        let oleoStatus = "N/D", oleoColor = "#94a3b8", oleoBg = "#f1f5f9";
        if (kmPrevisto > 0) {
            const isVencido = kmAtual >= kmPrevisto;
            oleoStatus = isVencido ? 'VENCIDO' : 'OK';
            oleoColor = isVencido ? '#991b1b' : '#166534';
            oleoBg = isVencido ? '#fef2f2' : '#dcfce7';
        }

        // 3. Situação Geral
        const stOp = (vtr.status_operativo || "").toLowerCase();
        let sitStatus = 'ATIVA', sitColor = '#166534', sitBg = '#dcfce7';
        if (vtr.em_manutencao) { sitStatus = 'MANUTENÇÃO'; sitColor = '#92400e'; sitBg = '#fef3c7'; }
        else if (stOp === 'manutencao') { sitStatus = 'BAIXADA'; sitColor = '#991b1b'; sitBg = '#fef2f2'; }
        else if (stOp === 'reserva') { sitStatus = 'RESERVA'; sitColor = '#1e293b'; sitBg = '#f1f5f9'; }

        // Renderização do Modal Premium
        Swal.fire({
            width: '650px',
            showConfirmButton: false,
            padding: '0',
            background: '#f8fafc',
            html: `
                <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 35px 25px; color: white; border-radius: 15px 15px 0 0; text-align: left;">
                    <div style="display: flex; align-items: center; gap: 20px;">
                        <div style="width: 70px; height: 70px; background: rgba(255,255,255,0.1); border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 2.2em;">
                            <i class="fa-solid fa-truck-moving"></i>
                        </div>
                        <div>
                            <h2 style="margin: 0; font-size: 1.8em; font-weight: 900; letter-spacing: -1px;">${vtr.prefixo || 'S/P'}</h2>
                            <div style="background: #800020; color: white; display: inline-block; padding: 2px 10px; border-radius: 6px; font-size: 0.7em; font-weight: 800; margin-top: 5px;">
                                UNIDADE: ${vtr.unidade_atual_nome || 'N/D'}
                            </div>
                        </div>
                    </div>
                </div>

                <div style="padding: 25px;">
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: -55px; margin-bottom: 25px;">
                        <div style="background: ${licBg}; padding: 12px; border-radius: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); text-align: center; border: 1px solid ${licColor}20;">
                            <small style="display:block; font-size: 0.6em; font-weight: 800; color: #64748b;">LICENCIAMENTO</small>
                            <b style="color: ${licColor}; font-size: 0.9em;">${licStatus}</b>
                        </div>
                        <div style="background: ${oleoBg}; padding: 12px; border-radius: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); text-align: center; border: 1px solid ${oleoColor}20;">
                            <small style="display:block; font-size: 0.6em; font-weight: 800; color: #64748b;">TROCA DE ÓLEO</small>
                            <b style="color: ${oleoColor}; font-size: 0.9em;">${oleoStatus}</b>
                        </div>
                        <div style="background: ${sitBg}; padding: 12px; border-radius: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); text-align: center; border: 1px solid ${sitColor}20;">
                            <small style="display:block; font-size: 0.6em; font-weight: 800; color: #64748b;">SITUAÇÃO</small>
                            <b style="color: ${sitColor}; font-size: 0.9em;">${sitStatus}</b>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 20px; background: white; border-radius: 18px; border: 1px solid #e2e8f0; text-align: left; margin-bottom: 20px;">
                        <div>
                            <small style="display:block; color:#94a3b8; font-weight:800; text-transform:uppercase; font-size:0.6em;">Identificação</small>
                            <div style="font-weight:700; color:#1e293b; margin-top:4px;"><i class="fa-solid fa-id-card" style="width:20px; color:#2c7399;"></i> Placa: ${vtr.placa || '---'}</div>
                            <div style="font-weight:700; color:#1e293b; margin-top:8px;"><i class="fa-solid fa-car-rear" style="width:20px; color:#2c7399;"></i> ${vtr.modelo || '---'}</div>
                        </div>
                        <div>
                            <small style="display:block; color:#94a3b8; font-weight:800; text-transform:uppercase; font-size:0.6em;">Monitoramento</small>
                            <div style="font-weight:900; color:#2c7399; margin-top:4px;"><i class="fa-solid fa-gauge-high" style="width:20px;"></i> ${(vtr.km_atual || 0).toLocaleString('pt-BR')} km</div>
                            <div style="font-weight:700; color:#1e293b; margin-top:8px;"><i class="fa-solid fa-user-shield" style="width:20px; color:#2c7399;"></i> ${vtr.responsavel_atual_nome || 'No Pátio'}</div>
                        </div>
                    </div>

                    <button onclick="verHistoricoVidaViatura('${ativoUid}', '${vtr.prefixo}')" style="width: 100%; padding: 15px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; color: #475569; font-weight: 800; font-size: 0.75em; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 25px; transition: 0.3s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'">
                        <i class="fa-solid fa-clock-rotate-left" style="color: #800020;"></i> EXIBIR LINHA DO TEMPO E REGISTROS DO ATIVO
                    </button>

                    <div style="display: flex; gap: 10px;">
                        <button onclick="gerenciarChecklistVtr('${ativoUid}', '${(vtr.prefixo || "VTR").replace(/'/g, "\\'")}')" style="flex: 2; padding: 15px; border-radius: 12px; border: none; background: #2c7399; color: white; font-weight: 800; font-size: 0.85em; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                            <i class="fa-solid fa-list-check"></i> Checklist
                        </button>
                        <button onclick="alert('Módulo de Defeitos em Breve')" style="flex: 1; padding: 15px; border-radius: 12px; border: none; background: #800020; color: white; font-weight: 800; font-size: 0.85em; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                            <i class="fa-solid fa-triangle-exclamation"></i> Defeitos
                        </button>
                    </div>
                </div>
            `
        });

    } catch (e) {
        console.error("Erro no prontuário:", e);
        Swal.fire('Erro', 'Falha ao carregar prontuário: ' + e.message, 'error');
    }
}
async function verHistoricoVidaViatura(vtrId, prefixo) {
    const containerId = 'timeline-vtr-' + Date.now();

    Swal.fire({
        title: `<i class="fa-solid fa-clock-rotate-left"></i> Histórico: ${prefixo}`,
        width: '600px',
        html: `<div id="${containerId}" style="max-height: 450px; overflow-y: auto; padding: 10px; text-align: left;">
                  <i class="fas fa-spinner fa-spin"></i> Consultando registros...
               </div>`,
        showConfirmButton: true,
        confirmButtonText: 'FECHAR',
        confirmButtonColor: '#1e293b'
    });

    try {
        // Busca vistorias realizadas especificamente para esta viatura
        // O ID do checklist segue o padrão que definimos: CHECKLIST_VTR_{vtrId}
        const checklistId = `CHECKLIST_VTR_${vtrId}`;

        const snap = await db.collection('resultados_checklist')
            .where('id_origem', '==', checklistId) // Ajuste para o campo que você usa no seu banco
            .orderBy('timestamp', 'desc')
            .limit(20)
            .get();

        const container = document.getElementById(containerId);
        if (snap.empty) {
            container.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:20px;">Nenhum registro de vistoria encontrado para este ativo.</p>';
            return;
        }

        let htmlTimeline = '<div class="sigma-v3-timeline">';
        snap.forEach(doc => {
            const data = doc.data();
            const dt = data.timestamp.toDate().toLocaleString('pt-BR');
            const temPendencia = data.totalCaa > 0;

            htmlTimeline += `
                <div class="sigma-v3-timeline-item" style="margin-bottom: 20px; border-left: 3px solid ${temPendencia ? '#991b1b' : '#166534'}; padding-left: 15px; position: relative;">
                    <div style="position: absolute; left: -8px; top: 0; width: 12px; height: 12px; border-radius: 50%; background: white; border: 3px solid ${temPendencia ? '#991b1b' : '#166534'};"></div>
                    <small style="color: #64748b; font-weight: 800;">${dt}</small>
                    <div style="font-weight: 700; color: #1e293b; margin-top: 2px;">VISTORIA REALIZADA</div>
                    <div style="font-size: 0.8em; color: #475569;">Por: <b>${data.conferente}</b></div>
                    <div style="margin-top: 5px;">
                        <span style="font-size: 0.7em; padding: 2px 8px; border-radius: 4px; background: ${temPendencia ? '#fef2f2' : '#dcfce7'}; color: ${temPendencia ? '#991b1b' : '#166534'}; font-weight: 800;">
                            ${temPendencia ? '⚠️ POSSUI AVARIAS' : '✅ SEM ALTERAÇÕES'}
                        </span>
                    </div>
                </div>`;
        });
        htmlTimeline += '</div>';
        container.innerHTML = htmlTimeline;

    } catch (e) {
        console.error("Erro no histórico:", e);
        document.getElementById(containerId).innerHTML = '<p style="color:red;">Erro ao processar linha do tempo.</p>';
    }
}

async function abrirFormularioViatura(dadosEdicao = null) {
    const isEdit = !!dadosEdicao;

    // Lista de Unidades para o Select (Busca na coleção oficial V3)
    const snapUnidades = await db.collection('unidades_estruturadas').where('ativo', '==', true).get();
    let optionsUnidades = '<option value="" disabled selected>Selecione a Unidade...</option>';
    snapUnidades.forEach(u => {
        const d = u.data();
        const selected = (isEdit && dadosEdicao.unidade_id === u.id) ? 'selected' : '';
        optionsUnidades += `<option value="${u.id}" data-sigla="${d.sigla}" ${selected}>${d.sigla} - ${d.nome_completo}</option>`;
    });

    Swal.fire({
        title: isEdit ? '<i class="fas fa-edit"></i> Editar Viatura' : '<i class="fas fa-truck-pickup"></i> Nova Viatura',
        width: '600px',
        html: `
            <div style="text-align: left; padding: 5px;">
                <div style="background: #f0f7fa; padding: 15px; border-radius: 12px; border: 1px solid #d1e2eb; margin-bottom: 20px;">
                    <small style="color: #2c7399; font-weight: 800; text-transform: uppercase; font-size: 0.7em;">1. Identificação e Unidade</small>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px;">
                        <div class="swal-v3-form-group">
                            <label>Prefixo (Ex: ABT-10)</label>
                            <input type="text" id="swal-vtr-prefixo" class="swal2-input" value="${isEdit ? dadosEdicao.prefixo : ''}" style="width:100%; margin:0;">
                        </div>
                        <div class="swal-v3-form-group">
                            <label>Placa</label>
                            <input type="text" id="swal-vtr-placa" class="swal2-input" value="${isEdit ? dadosEdicao.placa : ''}" style="width:100%; margin:0;">
                        </div>
                    </div>
                    <div class="swal-v3-form-group" style="margin-top:15px;">
                        <label>Unidade Responsável</label>
                        <select id="swal-vtr-unidade" class="swal2-select" style="width:100%; margin:0;">
                            ${optionsUnidades}
                        </select>
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="swal-v3-form-group">
                            <label>Segmento / Emprego</label>
                            <select id="swal-vtr-segmento" class="swal2-select" style="width:100%; margin:0;">
                                <option value="incendio" ${isEdit && dadosEdicao.segmento === 'incendio' ? 'selected' : ''}>Incêndio (Caminhão)</option>
                                <option value="ambulancia" ${isEdit && dadosEdicao.segmento === 'ambulancia' ? 'selected' : ''}>Ambulância (Resgate)</option>
                                <option value="salvamento" ${isEdit && dadosEdicao.segmento === 'salvamento' ? 'selected' : ''}>Salvamento / Pick-up</option>
                                <option value="passeio" ${isEdit && dadosEdicao.segmento === 'passeio' ? 'selected' : ''}>Adm / Passeio</option>
                            </select>
                        </div>
                        <div class="swal-v3-form-group">
                            <label>Status Operativo</label>
                            <select id="swal-vtr-status" class="swal2-select" style="width:100%; margin:0;">
                                <option value="ativo" ${isEdit && dadosEdicao.status === 'ativo' ? 'selected' : ''}>PRONTO (ATIVO)</option>
                                <option value="manutencao" ${isEdit && dadosEdicao.status === 'manutencao' ? 'selected' : ''}>BAIXADO (MANUTENÇÃO)</option>
                                <option value="reserva" ${isEdit && dadosEdicao.status === 'reserva' ? 'selected' : ''}>RESERVA</option>
                            </select>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-top:15px;">
                         <div class="swal-v3-form-group">
                            <label>Marca/Mod.</label>
                            <input type="text" id="swal-vtr-modelo" class="swal2-input" value="${isEdit ? dadosEdicao.modelo : ''}" style="width:100%; margin:0;">
                        </div>
                        <div class="swal-v3-form-group">
                            <label>Ano</label>
                            <input type="number" id="swal-vtr-ano" class="swal2-input" value="${isEdit ? dadosEdicao.ano : ''}" style="width:100%; margin:0;">
                        </div>
                        <div class="swal-v3-form-group">
                            <label>KM Atual</label>
                            <input type="number" id="swal-vtr-km" class="swal2-input" value="${isEdit ? dadosEdicao.km_atual : ''}" style="width:100%; margin:0;">
                        </div>
                    </div>
                </div>

                <div style="background: #fff9f0; padding: 15px; border-radius: 12px; border: 1px solid #ffe8cc;">
                    <small style="color: #c2780e; font-weight: 800; text-transform: uppercase; font-size: 0.7em;">3. Manutenção Preventiva (Óleo)</small>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px;">
                        <div class="swal-v3-form-group">
                            <label>Data Prevista</label>
                            <input type="date" id="swal-vtr-oleo-data" class="swal2-input" value="${isEdit ? dadosEdicao.oleo_data : ''}" style="width:100%; margin:0;">
                        </div>
                        <div class="swal-v3-form-group">
                            <label>KM Prevista</label>
                            <input type="number" id="swal-vtr-oleo-km" class="swal2-input" value="${isEdit ? dadosEdicao.oleo_km : ''}" style="width:100%; margin:0;">
                        </div>
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'SALVAR VIATURA',
        confirmButtonColor: '#2c7399',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const prefixo = document.getElementById('swal-vtr-prefixo').value.trim().toUpperCase();
            const placa = document.getElementById('swal-vtr-placa').value.trim().toUpperCase();
            const unidadeEl = document.getElementById('swal-vtr-unidade');
            const unidade_id = unidadeEl.value;
            const unidade_sigla = unidadeEl.options[unidadeEl.selectedIndex].getAttribute('data-sigla');

            if (!prefixo || !placa || !unidade_id) {
                return Swal.showValidationMessage('Prefixo, Placa e Unidade são obrigatórios');
            }

            return {
                prefixo,
                placa,
                unidade_id,
                unidade_sigla,
                segmento: document.getElementById('swal-vtr-segmento').value,
                status: document.getElementById('swal-vtr-status').value,
                modelo: document.getElementById('swal-vtr-modelo').value.trim().toUpperCase(),
                ano: document.getElementById('swal-vtr-ano').value,
                km_atual: parseInt(document.getElementById('swal-vtr-km').value) || 0,
                oleo_data: document.getElementById('swal-vtr-oleo-data').value,
                oleo_km: parseInt(document.getElementById('swal-vtr-oleo-km').value) || 0
            };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            executarSalvamentoViatura(isEdit ? dadosEdicao.uid : null, result.value);
        }
    });
}
async function executarSalvamentoViatura(uid, dados) {
    Swal.fire({
        title: 'Sincronizando...',
        html: 'Atualizando dados da frota global.',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const uidFinal = uid || ("VTR-" + Date.now());
        const vtrRef = db.collection('viaturas').doc(uidFinal);
        const dataHora = firebase.firestore.FieldValue.serverTimestamp();

        // Criamos a chave de busca para o filtro instantâneo
        const searchKey = (dados.prefixo + dados.placa).replace(/[^A-Z0-9]/gi, '').toLowerCase();

        const payload = {
            uid: uidFinal,
            prefixo: dados.prefixo,
            placa: dados.placa,
            search_key: searchKey,
            unidade_id: dados.unidade_id,
            unidade_sigla: dados.unidade_sigla,
            segmento: dados.segmento,
            status_operativo: dados.status, // Padronizado com o seu campo original
            modelo: dados.modelo,
            ano: dados.ano,
            km_atual: dados.km_atual,
            manutencao: {
                oleo_data: dados.oleo_data,
                oleo_km_prevista: dados.oleo_km
            },
            last_update: dataHora,
            atualizado_por: currentUserData.nome_militar_completo
        };

        if (!uid) {
            payload.data_cadastro = dataHora;
        }

        await vtrRef.set(payload, { merge: true });

        // Toast de Sucesso Sigma V3
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
        });

        Toast.fire({
            icon: 'success',
            title: uid ? 'Viatura atualizada!' : 'Viatura cadastrada com sucesso!'
        });

        carregarVtrBasesCards(); // Recarrega o grid

    } catch (e) {
        console.error("Erro ao salvar viatura:", e);
        Swal.fire('Erro Técnico', 'Não foi possível salvar os dados no Firebase.', 'error');
    }
}
