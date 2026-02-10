//--- CARREGA AS UNIDADES E RENDERIZA OS CARDS ---//
async function carregarUnidadesVisuais() {
    const container = document.getElementById('units-cards-container');
    if (!container) return;

    // Loading Shimmer V3
    container.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding:60px; color:#64748b;">
            <i class="fas fa-sync fa-spin fa-3x" style="opacity:0.3; margin-bottom:15px; display:block;"></i>
            <span style="font-weight:700; letter-spacing:1px; text-transform:uppercase; font-size:0.8em;">Sincronizando Estrutura Organizacional...</span>
        </div>`;

    try {
        const snap = await db.collection('unidades_estruturadas').where('ativo', '==', true).get();

        if (snap.empty) {
            container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:50px; color:#94a3b8;">Nenhuma unidade cadastrada.</div>`;
            return;
        }

        const unidades = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Separação por Natureza para criar os Headers de Grupo
        const adm = unidades.filter(u => u.tipo === 'administrativo');
        const ope = unidades.filter(u => u.tipo === 'operacional');

        let html = '';

        const renderGrupo = (lista, titulo, icone, cor) => {
            if (lista.length === 0) return '';

            let grupoHtml = `
                <div class="unit-header" style="grid-column: 1/-1; display: flex; align-items: center; gap: 12px; margin: 30px 0 15px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; color: #1e293b; font-weight: 800; text-transform: uppercase; font-size: 0.9em; letter-spacing: 1px;">
                    <i class="fas ${icone}" style="color:${cor}"></i> ${titulo} (${lista.length})
                </div>`;

            lista.forEach(u => {
                const corTipo = u.tipo === 'administrativo' ? '#475569' : '#800020';
                const icon = u.tipo === 'administrativo' ? 'fa-landmark' : 'fa-building-shield';

                // Sanitização para o objeto de edição
                const uJson = JSON.stringify(u).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

                grupoHtml += `
                    <div class="v3-posto-card" style="border-top: 6px solid ${corTipo}; min-height: 200px;">
                        <div class="v3-posto-actions">
                            <button class="v3-btn-action" title="Editar Unidade" onclick="abrirFormularioUnidade(JSON.parse('${uJson}'))">
                                <i class="fas fa-pencil-alt"></i>
                            </button>
                            <button class="v3-btn-action" title="Excluir Unidade" onclick="deletarUnidadeSistema('${u.id}', '${u.sigla}')">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>

                        <div style="padding: 20px; display: flex; flex-direction: column; align-items: center; text-align: center;">
                            <div class="v3-icon-box" style="background: ${corTipo}15; color: ${corTipo}; width: 60px; height: 60px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 1.5em; margin-bottom: 15px;">
                                <i class="fas ${icon}"></i>
                            </div>

                            <div style="margin-bottom: 15px;">
                                <span style="display:block; font-weight:900; font-size:1.4em; color:#1e293b; letter-spacing:-0.5px;">${u.sigla}</span>
                                <span style="display:block; font-size: 0.7em; font-weight: 700; color: #64748b; text-transform: uppercase;">${u.nome_completo}</span>
                            </div>

                            <div style="width: 100%; border-top: 1px solid #f1f5f9; padding-top: 12px; margin-top: auto;">
                                <small style="display:block; font-size:0.6em; color:#94a3b8; font-weight:800; text-transform:uppercase; margin-bottom:4px;">Comando / Direção</small>
                                <span style="font-size:0.85em; font-weight:700; color:#1e293b;">
                                    <i class="fas fa-user-tie" style="margin-right:5px; opacity:0.5; color:${corTipo}"></i> ${u.comandante_nome_estatico || 'Não definido'}
                                </span>
                            </div>
                        </div>
                    </div>`;
            });
            return grupoHtml;
        };

        // Renderiza primeiro os Comandos (ADM) e depois as Unidades Operacionais
        html += renderGrupo(adm, 'Comandos e Diretorias', 'fa-crown', '#475569');
        html += renderGrupo(ope, 'Unidades Operacionais', 'fa-shield-halved', '#800020');

        container.innerHTML = html;

        // Gatilho de ícones FontAwesome
        if (window.FontAwesome) FontAwesome.dom.i2svg();

    } catch (e) {
        console.error("Erro ao renderizar unidades:", e);
        container.innerHTML = `<p style="color:red; text-align:center; padding:40px;">Erro ao carregar mapa de unidades.</p>`;
    }
}

//--- ABRE O FORMULÁRIO DE CRIAÇÃO/EDIÇÃO DE UNIDADE ---//
async function abrirFormularioUnidade(dadosEdicao = null) {
    const isEdit = !!dadosEdicao;

    Swal.fire({
        title: isEdit ? '<i class="fas fa-edit"></i> Editar Unidade' : '<i class="fas fa-sitemap"></i> Nova Unidade',
        width: '550px',
        html: `
            <div style="text-align: left; padding: 5px;">
                <div class="swal-v3-form-group">
                    <label style="font-weight: 800; font-size: 0.75em; color: #64748b; text-transform: uppercase;">1. Nome Completo da Unidade</label>
                    <input type="text" id="swal-unid-nome" class="swal2-input" value="${isEdit ? dadosEdicao.nome_completo : ''}" placeholder="Ex: 1º Batalhão de Bombeiros Militar" style="width:100%; margin:5px 0 15px 0; border-radius: 10px;">
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="swal-v3-form-group">
                        <label style="font-weight: 800; font-size: 0.75em; color: #64748b; text-transform: uppercase;">2. Sigla</label>
                        <input type="text" id="swal-unid-sigla" class="swal2-input" value="${isEdit ? dadosEdicao.sigla : ''}" placeholder="Ex: 1º BBM" style="width:100%; margin:5px 0 15px 0; border-radius: 10px; text-transform: uppercase;">
                    </div>
                    <div class="swal-v3-form-group">
                        <label style="font-weight: 800; font-size: 0.75em; color: #64748b; text-transform: uppercase;">3. Natureza</label>
                        <select id="swal-unid-tipo" class="swal2-select" style="width:100%; margin:5px 0 15px 0; border-radius: 10px;">
                            <option value="operacional" ${isEdit && dadosEdicao.tipo === 'operacional' ? 'selected' : ''}>Operacional</option>
                            <option value="administrativo" ${isEdit && dadosEdicao.tipo === 'administrativo' ? 'selected' : ''}>Administrativo</option>
                        </select>
                    </div>
                </div>

                <div class="swal-v3-form-group" style="margin-top:10px; position: relative;">
                    <label style="font-weight: 800; font-size: 0.75em; color: #64748b; text-transform: uppercase;">4. Comandante / Diretor (Busca Inteligente)</label>
                    <input type="text" id="swal-unid-comandante" class="swal2-input" value="${isEdit ? dadosEdicao.comandante_nome_estatico : ''}" placeholder="Digite o nome de guerra..." style="width:100%; margin:5px 0 0 0; border-radius: 10px;" autocomplete="off">
                    <input type="hidden" id="swal-unid-comandante-uid" value="${isEdit ? dadosEdicao.comandante_uid : ''}">
                    <div id="swal-unid-sugestoes" class="suggestions-box" style="display:none; position: absolute; width: 100%; z-index: 1000; background: white; border: 1px solid #ddd; border-top: none; border-radius: 0 0 10px 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); max-height: 150px; overflow-y: auto;"></div>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'SALVAR UNIDADE',
        confirmButtonColor: '#800020',
        cancelButtonText: 'Cancelar',
        // ✅ INSERÇÃO DO DIDOPEN (LÓGICA DE AUTOCOMPLETE)
        didOpen: () => {
            const inputCmd = document.getElementById('swal-unid-comandante');
            const hiddenUid = document.getElementById('swal-unid-comandante-uid');
            const sugestoesBox = document.getElementById('swal-unid-sugestoes');

            inputCmd.addEventListener('input', () => {
                const termo = inputCmd.value.toUpperCase();
                sugestoesBox.innerHTML = '';

                if (termo.length < 2) {
                    sugestoesBox.style.display = 'none';
                    return;
                }

                // Filtra no array global de militares que você já possui
                const filtrados = allTargetUsers.filter(u => u.nome.toUpperCase().includes(termo));

                filtrados.forEach(militar => {
                    const item = document.createElement('div');
                    item.style.padding = '10px';
                    item.style.cursor = 'pointer';
                    item.style.borderBottom = '1px solid #eee';
                    item.innerHTML = `<i class="fas fa-user-shield" style="color:#800020"></i> ${militar.nome}`;

                    item.onclick = () => {
                        inputCmd.value = militar.nome;
                        hiddenUid.value = militar.id;
                        sugestoesBox.style.display = 'none';
                        inputCmd.style.borderColor = '#166534'; // Verde para indicar seleção válida
                    };
                    sugestoesBox.appendChild(item);
                });

                sugestoesBox.style.display = filtrados.length > 0 ? 'block' : 'none';
            });

            // Fecha sugestões ao clicar fora
            document.addEventListener('click', (e) => {
                if (!inputCmd.contains(e.target)) sugestoesBox.style.display = 'none';
            });
        },
        preConfirm: () => {
            const nome = document.getElementById('swal-unid-nome').value.trim().toUpperCase();
            const sigla = document.getElementById('swal-unid-sigla').value.trim().toUpperCase();
            const comandante = document.getElementById('swal-unid-comandante').value.trim().toUpperCase();
            const comandanteUid = document.getElementById('swal-unid-comandante-uid').value;

            if (!nome || !sigla || !comandante) {
                return Swal.showValidationMessage('Todos os campos são obrigatórios');
            }

            return {
                nome_completo: nome,
                sigla: sigla,
                tipo: document.getElementById('swal-unid-tipo').value,
                comandante_nome_estatico: comandante,
                comandante_uid: comandanteUid
            };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            executarSalvamentoUnidade(isEdit ? dadosEdicao.uid : null, result.value);
        }
    });
}

//--- SALVA A UNIDADE NO FIREBASE (CRIAÇÃO OU EDIÇÃO) ---//
async function executarSalvamentoUnidade(uid, dados) {
    Swal.fire({
        title: 'Sincronizando...',
        html: 'Atualizando estrutura organizacional.',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const uidFinal = uid || ("UNID-" + Date.now());
        const unitRef = db.collection('unidades_estruturadas').doc(uidFinal);
        const dataHora = firebase.firestore.FieldValue.serverTimestamp();

        const payload = {
            uid: uidFinal,
            nome_completo: dados.nome_completo,
            sigla: dados.sigla,
            tipo: dados.tipo,
            comandante_nome_estatico: dados.comandante_nome_estatico,
            comandante_uid: dados.comandante_uid || "",
            ativo: true,
            ultima_atualizacao: dataHora,
            atualizado_por: currentUserData.nome_militar_completo
        };

        if (!uid) {
            payload.data_criacao = dataHora;
        }

        // Gravação Atômica
        await unitRef.set(payload, { merge: true });

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
            title: uid ? 'Unidade atualizada!' : 'Unidade cadastrada com sucesso!'
        });

        carregarUnidadesVisuais(); // Recarrega o grid de cards

    } catch (e) {
        console.error("Erro ao salvar unidade:", e);
        Swal.fire('Erro Técnico', 'Não foi possível salvar a unidade no Firebase.', 'error');
    }
}