async function abrirFormularioUsuario(dadosEdicao = null) {
    const isEdit = !!dadosEdicao;

    // Feedback imediato de carregamento
    Swal.fire({ title: 'Acessando Banco...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        // Busca unidades para o seletor
        const snapUnidades = await db.collection('unidades_estruturadas').where('ativo', '==', true).get();
        let optUnidades = '<option value="" disabled selected>Selecione a Unidade...</option>';
        snapUnidades.forEach(doc => {
            const u = doc.data();
            const sel = isEdit && dadosEdicao.unidade_id === doc.id ? 'selected' : '';
            optUnidades += `<option value="${doc.id}" ${sel}>${u.sigla}</option>`;
        });

        Swal.fire({
            title: isEdit ? '<i class="fas fa-user-edit"></i> EDITAR DADOS' : '<i class="fas fa-user-plus"></i> NOVO MILITAR',
            width: '750px',
            confirmButtonText: isEdit ? 'SALVAR ALTERAÇÕES' : 'GRAVAR MILITAR',
            confirmButtonColor: '#800020',
            showCancelButton: true,
            cancelButtonText: 'CANCELAR',
            showDenyButton: isEdit, // Mostra botão de excluir apenas se for edição
            denyButtonText: 'EXCLUIR PERFIL',
            denyButtonColor: '#d33',
            html: `
                <div style="text-align: left; padding: 5px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 15px;">
                        <div class="swal-v3-form-group">
                            <label style="font-weight: 800; font-size: 0.7em; color: #64748b; text-transform: uppercase;">Nome Completo (Civil)</label>
                            <input type="text" id="swal-user-nome" class="swal2-input" value="${isEdit ? (dadosEdicao.nome_completo || '') : ''}" style="width:100%; margin:5px 0 15px 0; border-radius: 8px;">
                        </div>
                        <div class="swal-v3-form-group">
                            <label style="font-weight: 800; font-size: 0.7em; color: #64748b; text-transform: uppercase;">Nome de Guerra</label>
                            <input type="text" id="swal-user-guerra" class="swal2-input" value="${isEdit ? (dadosEdicao.nome_guerra || '') : ''}" style="width:100%; margin:5px 0 15px 0; border-radius: 8px;">
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-top: 5px;">
                        <div class="swal-v3-form-group">
                            <label style="font-weight: 800; font-size: 0.7em; color: #64748b; text-transform: uppercase;">Posto / Graduação</label>
                            <select id="swal-user-posto" class="swal2-select" style="width:100%; margin:5px 0 15px 0; border-radius: 8px;">
                                <option value="" disabled selected>Posto</option>
                                ${['CEL', 'TEN CEL', 'MAJ', 'CAP', '1º TEN', '2º TEN', 'ST', '1º SGT', '2º SGT', '3º SGT', 'CB', 'SD'].map(p =>
                `<option value="${p}" ${isEdit && dadosEdicao.posto === p ? 'selected' : ''}>${p}</option>`
            ).join('')}
                            </select>
                        </div>
                        <div class="swal-v3-form-group">
                            <label style="font-weight: 800; font-size: 0.7em; color: #64748b; text-transform: uppercase;">Quadro</label>
                            <select id="swal-user-quadro" class="swal2-select" style="width:100%; margin:5px 0 15px 0; border-radius: 8px;" disabled>
                                <option value="" disabled selected>Selecione o Posto</option>
                            </select>
                        </div>
                        <div class="swal-v3-form-group">
                            <label style="font-weight: 800; font-size: 0.7em; color: #64748b; text-transform: uppercase;">Telefone (WhatsApp)</label>
                            <input type="text" id="swal-user-tel" class="swal2-input" value="${isEdit ? (dadosEdicao.telefone_contato || dadosEdicao.telefone || '') : ''}" placeholder="(00) 00000-0000" style="width:100%; margin:5px 0 15px 0; border-radius: 8px;">
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-top: 5px;">
                        <div class="swal-v3-form-group">
                            <label style="font-weight: 800; font-size: 0.7em; color: #64748b; text-transform: uppercase;">CPF (Login)</label>
                            <input type="text" id="swal-user-cpf" class="swal2-input" value="${isEdit ? (dadosEdicao.cpf || '') : ''}" placeholder="Apenas números" ${isEdit ? 'disabled' : ''} style="width:100%; margin:5px 0 15px 0; border-radius: 8px;">
                        </div>
                        <div class="swal-v3-form-group">
                            <label style="font-weight: 800; font-size: 0.7em; color: #64748b; text-transform: uppercase;">Perfil de Acesso</label>
                            <select id="swal-user-role" class="swal2-select" style="width:100%; margin:5px 0 15px 0; border-radius: 8px;">
                                <option value="operacional" ${isEdit && dadosEdicao.role === 'operacional' ? 'selected' : ''}>Operacional</option>
                                <option value="gestor" ${isEdit && dadosEdicao.role === 'gestor' ? 'selected' : ''}>Gestor de Unidade</option>
                                <option value="admin" ${isEdit && dadosEdicao.role === 'admin' ? 'selected' : ''}>Administrador Geral</option>
                            </select>
                        </div>
                        <div class="swal-v3-form-group">
                            <label style="font-weight: 800; font-size: 0.7em; color: #64748b; text-transform: uppercase;">Unidade</label>
                            <select id="swal-user-unit" class="swal2-select" style="width:100%; margin:5px 0 15px 0; border-radius: 8px;">${optUnidades}</select>
                        </div>
                    </div>

                    ${!isEdit ? `
                    <div class="swal-v3-form-group" style="margin-top:5px;">
                        <label style="font-weight: 800; font-size: 0.7em; color: #64748b; text-transform: uppercase;">Senha Inicial</label>
                        <input type="password" id="swal-user-pass" class="swal2-input" placeholder="Mínimo 6 dígitos" style="width:100%; margin:5px 0 0 0; border-radius: 8px;">
                    </div>` : ''}
                </div>
            `,
            didOpen: () => {
                const pSel = document.getElementById('swal-user-posto');
                const qSel = document.getElementById('swal-user-quadro');

                // Ativa a lógica de dependência que corrigimos
                pSel.addEventListener('change', () => atualizarQuadroCad(pSel, qSel));

                // Caso seja edição, preenche o quadro atual
                if (isEdit) {
                    atualizarQuadroCad(pSel, qSel);
                    qSel.value = dadosEdicao.quadro || '';
                }
            },
            preConfirm: () => {
                const dados = {
                    nome_completo: document.getElementById('swal-user-nome').value.trim().toUpperCase(),
                    nome_guerra: document.getElementById('swal-user-guerra').value.trim().toUpperCase(),
                    posto: document.getElementById('swal-user-posto').value,
                    quadro: document.getElementById('swal-user-quadro').value,
                    cpf: document.getElementById('swal-user-cpf').value.replace(/\D/g, ''),
                    telefone: document.getElementById('swal-user-tel').value,
                    role: document.getElementById('swal-user-role').value,
                    unidade_id: document.getElementById('swal-user-unit').value,
                    unidade_sigla: document.getElementById('swal-user-unit').options[document.getElementById('swal-user-unit').selectedIndex].text
                };

                if (!dados.nome_completo || !dados.nome_guerra || !dados.posto || !dados.quadro || !dados.unidade_id) {
                    return Swal.showValidationMessage('Preencha todos os campos obrigatórios');
                }

                if (!isEdit) {
                    dados.senha = document.getElementById('swal-user-pass').value;
                    if (dados.senha.length < 6) return Swal.showValidationMessage('A senha deve ter 6 dígitos');
                }

                return dados;
            }
        }).then(result => {
            if (result.isConfirmed) {
                salvarMilitarV3(isEdit ? dadosEdicao.uid : null, result.value);
            } else if (result.isDenied) {
                // Chama a exclusão se o botão Deny (Excluir) for clicado
                excluirUsuarioV3(dadosEdicao.uid, dadosEdicao.nome_guerra);
            }
        });
    } catch (e) {
        console.error(e);
        Swal.fire('Erro', 'Falha ao carregar formulário', 'error');
    }
}

function mudarModoVisao(modo) {
    visaoAtual = modo;
    document.getElementById('btn-visao-grid').classList.toggle('active', modo === 'grid');
    document.getElementById('btn-visao-lista').classList.toggle('active', modo === 'lista');

    // Ajusta a classe do container para mudar o layout
    const container = document.getElementById('users-render-container');
    container.className = (modo === 'grid') ? 'v3-vtr-grid' : 'v3-list-stack';

    carregarUsuariosVisuais();
}

// Gera o alfabeto no topo
function renderizarAlfabeto() {
    const container = document.querySelector('.alphabet-filter');
    const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    let html = `<button class="alpha-btn ${letraAtiva === 'TODOS' ? 'active' : ''}" onclick="filtrarPorLetra('TODOS')">TODOS</button>`;

    letras.forEach(l => {
        html += `<button class="alpha-btn ${letraAtiva === l ? 'active' : ''}" onclick="filtrarPorLetra('${l}')">${l}</button>`;
    });
    container.innerHTML = html;
}

function filtrarPorLetra(letra) {
    letraAtiva = letra;
    renderizarAlfabeto();
    carregarUsuariosVisuais();
}

function filtrarUsuariosCards() {
    const input = document.getElementById('user-search-input');
    if (!input) return;

    // Normalização para ignorar acentos e espaços
    const termo = input.value.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .trim();

    // Seleciona tanto cards (grid) quanto linhas (lista)
    const itens = document.querySelectorAll('#users-render-container .v3-posto-card, #users-render-container .v3-list-row');

    itens.forEach(item => {
        const conteudo = item.innerText.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        if (conteudo.includes(termo)) {
            // Se estiver no modo lista, usamos 'flex'. No modo grid, o CSS original assume o layout.
            item.style.display = (visaoAtual === 'grid') ? "block" : "grid";
            item.style.animation = "fadeIn 0.2s ease";
        } else {
            item.style.display = "none";
        }
    });

    // Se o usuário apagar a busca e houver uma letra ativa, resetamos para a letra
    if (termo === "" && letraAtiva !== 'TODOS') {
        carregarUsuariosVisuais();
    }
}

//--- FUNÇÃO PRINCIPAL: CARREGA USUÁRIOS E RENDERIZA OS CARDS/ITENS DE LISTA ---//
async function carregarUsuariosVisuais() {
    const container = document.getElementById('users-render-container');
    if (!container) return;

    renderizarAlfabeto();
    container.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:60px; color:#64748b;">
            <i class="fas fa-sync fa-spin fa-3x" style="opacity:0.3; margin-bottom:15px; display:block;"></i>
            <span style="font-weight:700; letter-spacing:1px; text-transform:uppercase; font-size:0.8em;">Sincronizando Efetivo...</span>
        </div>`;

    try {
        const snap = await db.collection('usuarios').orderBy('nome_guerra').get();
        let html = '';

        snap.forEach(doc => {
            const u = doc.data();
            const iniciais = u.nome_guerra ? u.nome_guerra.substring(0, 2).toUpperCase() : '??';
            const primeiraLetra = u.nome_guerra ? u.nome_guerra[0].toUpperCase() : '';

            // Filtro Alfabético
            if (letraAtiva !== 'TODOS' && primeiraLetra !== letraAtiva) return;

            const corPerfil = u.role === 'admin' ? '#800020' : (u.role === 'gestor' ? '#2c7399' : '#64748b');
            const fone = u.telefone_contato || 'Sem fone';
            const unidade = u.unidade || 'S/U';

            if (visaoAtual === 'grid') {
                // MODO GRID: Card Limpo (Clique abre o Prontuário)
                html += `
                    <div class="v3-posto-card" style="border-top: 6px solid ${corPerfil}; cursor:pointer;" onclick="verDetalhesMilitar('${doc.id}')">
                        <div style="padding: 20px; display: flex; flex-direction: column; align-items: center; text-align: center;">
                            <div style="width: 65px; height: 65px; background: ${corPerfil}15; color: ${corPerfil}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.2em; border: 2px solid ${corPerfil}30; margin-bottom: 15px;">
                                ${iniciais}
                            </div>

                            <div style="margin-bottom: 12px;">
                                <span style="display:block; font-weight:900; font-size:1.1em; color:#1e293b;">${u.posto} ${u.nome_guerra}</span>
                                <span style="display:block; font-size: 0.65em; font-weight: 700; color: #94a3b8; text-transform: uppercase;">${u.nome_completo}</span>
                            </div>

                            <div style="width: 100%; border-top: 1px solid #f1f5f9; padding-top: 12px; margin-top: auto;">
                                <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <span style="font-size: 0.65em; font-weight: 800; color: ${corPerfil}; text-transform: uppercase; background:${corPerfil}10; padding:2px 6px; border-radius:4px;">${u.role}</span>
                                    <span style="font-size: 0.7em; font-weight: 800; color: #475569;">${unidade}</span>
                                </div>
                                <div style="text-align: left;">
                                    <span style="font-size:0.75em; color:#166534; font-weight:700;">
                                        <i class="fab fa-whatsapp"></i> ${fone}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>`;
            } else {
                // MODO LISTA: Linha Elegante (Clique abre o Prontuário)
                html += `
                    <div class="v3-list-row" onclick="verDetalhesMilitar('${doc.id}')">
                        <div style="width: 35px; height: 35px; background: ${corPerfil}15; color: ${corPerfil}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.8em;">${iniciais}</div>
                        <div style="font-weight: 700; color: #1e293b; font-size: 0.9em;">
                            ${u.posto} ${u.nome_guerra} 
                            <small style="display:block; font-weight:400; color:#64748b; font-size: 0.8em;">${u.nome_completo}</small>
                        </div>
                        <div style="font-size: 0.85em; color: #475569; font-weight:600;">${unidade}</div>
                        <div style="font-size: 0.8em; color: #166534; font-weight:700;">${fone}</div>
                        <div style="font-size: 0.7em; text-transform:uppercase; color:${corPerfil}; font-weight:800; text-align:right;">${u.role}</div>
                    </div>`;
            }
        });

        container.innerHTML = html || '<div style="grid-column:1/-1; text-align:center; padding:50px; color:#94a3b8;">Nenhum militar localizado com este filtro.</div>';
        if (window.FontAwesome) FontAwesome.dom.i2svg();

    } catch (e) {
        console.error("Erro Efetivo V3:", e);
        container.innerHTML = '<p style="color:red; text-align:center; padding:40px;">Erro ao carregar mapa de usuários.</p>';
    }
}

//--- FUNÇÃO DE PRONTUÁRIO: EXIBE DETALHES COMPLETOS DO MILITAR COM OPÇÕES DE EDIÇÃO E EXCLUSÃO ---//
async function verDetalhesMilitar(uid) {
    Swal.fire({ title: 'Carregando prontuário...', didOpen: () => Swal.showLoading() });

    try {
        const doc = await db.collection('usuarios').doc(uid).get();
        if (!doc.exists) return Swal.fire('Erro', 'Militar não encontrado', 'error');

        const u = doc.data();
        const corPerfil = u.role === 'admin' ? '#800020' : (u.role === 'gestor' ? '#2c7399' : '#64748b');

        Swal.fire({
            title: `<span style="color:${corPerfil}">${u.posto} ${u.nome_guerra}</span>`,
            width: '600px',
            showConfirmButton: false,
            html: `
                <div style="text-align: left; padding: 10px; font-family: sans-serif;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8fafc; padding: 15px; border-radius: 10px; border-left: 5px solid ${corPerfil};">
                        <div>
                            <small style="font-weight:800; color:#64748b;">NOME COMPLETO</small>
                            <div style="font-weight:700; font-size:0.9em;">${u.nome_completo}</div>
                        </div>
                        <div>
                            <small style="font-weight:800; color:#64748b;">MATRÍCULA</small>
                            <div style="font-weight:700;">${u.matricula || '---'}</div>
                        </div>
                        <div>
                            <small style="font-weight:800; color:#64748b;">CPF / LOGIN</small>
                            <div style="font-weight:700;">${u.cpf || '---'}</div>
                        </div>
                        <div>
                            <small style="font-weight:800; color:#64748b;">QUADRO</small>
                            <div style="font-weight:700;">${u.quadro || '---'}</div>
                        </div>
                        <div>
                            <small style="font-weight:800; color:#64748b;">UNIDADE</small>
                            <div style="font-weight:700;">${u.unidade || '---'}</div>
                        </div>
                        <div>
                            <small style="font-weight:800; color:#64748b;">PERFIL</small>
                            <div style="font-weight:700; text-transform:uppercase;">${u.role}</div>
                        </div>
                    </div>

                    <div style="margin-top: 15px; padding: 5px;">
                        <small style="font-weight:800; color:#64748b;">CONTATOS</small>
                        <div style="display:flex; gap:20px; margin-top:5px;">
                            <span><i class="fab fa-whatsapp" style="color:#166534"></i> ${u.telefone_contato}</span>
                            <span><i class="far fa-envelope" style="color:#2c7399"></i> ${u.email_contato}</span>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 25px;">
                        <button onclick="abrirFormularioUsuario(${JSON.stringify(u).replace(/"/g, '&quot;')})" 
                                style="padding:12px; border-radius:8px; border:none; background:#2c7399; color:white; font-weight:700; cursor:pointer;">
                            <i class="fas fa-edit"></i> EDITAR DADOS
                        </button>
                        <button onclick="excluirUsuarioV3('${u.uid}', '${u.nome_guerra}')" 
                                style="padding:12px; border-radius:8px; border:none; background:#800020; color:white; font-weight:700; cursor:pointer;">
                            <i class="fas fa-trash-alt"></i> EXCLUIR MILITAR
                        </button>
                    </div>
                </div>
            `
        });
    } catch (e) {
        Swal.fire('Erro', 'Falha ao carregar detalhes', 'error');
    }
}

//--- FUNÇÃO DE SALVAMENTO: CRIA OU ATUALIZA O USUÁRIO NO FIRESTORE E, SE FOR NOVO, TAMBÉM NO AUTH ---//
async function salvarMilitarV3(uidExistente, dados) {
    Swal.fire({
        title: uidExistente ? 'Atualizando...' : 'Criando Conta...',
        didOpen: () => Swal.showLoading(),
        allowOutsideClick: false
    });

    try {
        const firestore = window.db || db;
        const isEdit = !!uidExistente;

        // Se for novo usuário, precisa criar no Auth primeiro
        let uidFinal = uidExistente;

        if (!isEdit) {
            const emailLogin = `${dados.cpf}@sigma.com.br`;
            const userCredential = await secondaryAuth.createUserWithEmailAndPassword(emailLogin, dados.senha);
            uidFinal = userCredential.user.uid;
            await secondaryAuth.signOut(); // Desloga a conta criada do "secondaryAuth"
        }

        const payload = {
            uid: uidFinal,
            nome_completo: dados.nome_completo,
            nome_guerra: dados.nome_guerra,
            posto: dados.posto,
            nome_militar_completo: `${dados.posto} ${dados.nome_guerra}`,
            cpf: dados.cpf,
            telefone_contato: dados.telefone,
            role: dados.role,
            unidade_id: dados.unidade_id,
            unidade: dados.unidade_sigla,
            atualizado_em: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (!isEdit) {
            payload.data_cadastro = firebase.firestore.FieldValue.serverTimestamp();
            payload.email = `${dados.cpf}@sigma.com.br`;
        }

        await firestore.collection('usuarios').doc(uidFinal).set(payload, { merge: true });

        Swal.fire({
            icon: 'success',
            title: isEdit ? 'Militar Atualizado' : 'Militar Cadastrado',
            text: `Acesso liberado para ${dados.nome_guerra}`,
            timer: 2000,
            showConfirmButton: false
        });

        carregarUsuariosVisuais(); // Recarrega os cards

    } catch (e) {
        console.error("Erro no salvamento:", e);
        Swal.fire('Falha no Processo', e.message, 'error');
    }
}

//--- FUNÇÃO DE EXCLUSÃO: Remove o usuário do Firestore (e alerta para remoção manual do Auth) ---//
async function excluirUsuarioV3(uid, nomeGuerra) {
    // 1. Alerta de Segurança Premium
    const result = await Swal.fire({
        title: 'Excluir Militar?',
        html: `Você está prestes a remover <b>${nomeGuerra}</b> do sistema.<br><br><small style="color:#ef4444">⚠️ O login (Auth) deve ser removido manualmente no console do Firebase.</small>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#800020',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sim, excluir permanentemente',
        cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    // 2. Processo de Deleção
    Swal.fire({ title: 'Removendo...', didOpen: () => Swal.showLoading() });

    try {
        const firestore = window.db || db;

        // Remove do Firestore
        await firestore.collection('usuarios').doc(uid).delete();

        // Feedback de Sucesso
        Swal.fire({
            icon: 'success',
            title: 'Militar Removido',
            text: `${nomeGuerra} não faz mais parte do efetivo no sistema.`,
            timer: 2000,
            showConfirmButton: false
        });

        // 3. Atualiza a Interface (Cards)
        carregarUsuariosVisuais();

    } catch (e) {
        console.error("Erro ao excluir militar:", e);
        Swal.fire('Erro Técnico', 'Não foi possível remover o registro: ' + e.message, 'error');
    }
}

function formatarCPF(input) {
    let value = input.value.replace(/\D/g, ''); // Remove tudo que não for dígito
    value = value.substring(0, 11); // Limita a 11 dígitos

    if (value.length > 9) {
        value = value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    } else if (value.length > 6) {
        value = value.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1.$2.$3');
    } else if (value.length > 3) {
        value = value.replace(/^(\d{3})(\d{3})$/, '$1.$2');
    } else if (value.length > 0) {
        value = value.replace(/^(\d{3})$/, '$1');
    }
    input.value = value;
}

function formatarMatricula(input) {
    let value = input.value.replace(/\D/g, ''); // Remove tudo que não for dígito
    value = value.substring(0, 10); // Limita a 10 dígitos

    if (value.length > 7) {
        value = value.replace(/^(\d{7})(\d{3})$/, '$1-$2');
    }
    input.value = value;
}

function formatarTelefone(input) {
    let value = input.value.replace(/\D/g, ''); // Remove tudo que não for dígito
    value = value.substring(0, 11); // Limita a 11 dígitos (DDD + 9 dígitos)

    if (value.length > 6) {
        value = value.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    } else if (value.length > 2) {
        value = value.replace(/^(\d{2})(\d+)$/, '($1) $2');
    } else if (value.length > 0) {
        value = value.replace(/^(\d{2})$/, '($1)');
    }
    input.value = value;
}

function atualizarQuadroCad(postoSelect, quadroSelect) {
    if (!postoSelect || !quadroSelect) return;

    const posto = postoSelect.value;

    // Limpa o select de quadros com um placeholder padrão
    quadroSelect.innerHTML = '<option value="" disabled selected>Selecione o Quadro...</option>';

    if (!posto) {
        quadroSelect.disabled = true;
        return;
    }

    let quadros = [];
    // Listas de postos para validação
    const oficiais = ['CEL', 'TEN CEL', 'MAJ', 'CAP', '1º TEN', '2º TEN'];
    const pracas = ['ST', '1º SGT', '2º SGT', '3º SGT', 'CB'];

    // Lógica de Atribuição de Quadros
    if (oficiais.includes(posto)) {
        quadros = ['QOCBM', 'QCOBM', 'QOSBM', 'QEOBM'];
        quadroSelect.disabled = false;
    }
    else if (pracas.includes(posto)) {
        quadros = ['QPCBM', 'QPSBM', 'QEPBM'];
        quadroSelect.disabled = false;
    }
    else if (posto === 'SD') {
        quadros = ['QPCBM'];
        // Mantemos desabilitado pois Soldado não tem variação de quadro no sistema
        quadroSelect.disabled = true;
    }

    // Preenchimento Dinâmico
    quadros.forEach(quadro => {
        const option = document.createElement('option');
        option.value = quadro;
        option.textContent = quadro;
        quadroSelect.appendChild(option);
    });

    // Seleção Automática Inteligente
    if (quadros.length === 1) {
        quadroSelect.value = quadros[0];
        // Adiciona um feedback visual de que o campo foi preenchido automaticamente
        quadroSelect.style.backgroundColor = "#f8fafc";
    } else {
        quadroSelect.style.backgroundColor = "";
    }
}
