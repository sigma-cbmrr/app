//=== Abre a interface de criação de novos itens no Inventário Global, resetando campos e estados de kits ===//
function abrirModalCadastroGlobal() {
    const modal = document.getElementById('modal-cadastro-global');
    if (!modal) return;

    // 1. RESET DO FORMULÁRIO (Campos visíveis)
    const form = document.getElementById('form-cadastro-global');
    if (form) form.reset();

    // 2. ✅ RESET DO BOTÃO DE SALVAMENTO (Cura o problema do F5)
    // Se o botão ficou 'disabled' ou com o texto 'Processando...', voltamos ao estado original
    const btn = document.querySelector('.btn-sync');
    if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.innerHTML = '<i class="fas fa-save"></i> SALVAR NO CATÁLOGO';
    }

    // 3. ✅ LIMPEZA DE ESTADOS OCULTOS E DINÂMICOS
    // Garante que o ID da família anterior não contamine o novo cadastro
    const inputUidPai = document.getElementById('cat-uid-pai');
    if (inputUidPai) inputUidPai.value = '';

    // Limpa a lista visual de componentes se for um kit
    const listaComponentes = document.getElementById('lista-componentes-selecionados');
    if (listaComponentes) listaComponentes.innerHTML = '';
    
    // Oculta área de kit por padrão
    document.getElementById('area-selecao-componentes').style.display = 'none';

    // 4. RESET VISUAL DE INPUTS TRAVADOS (Estilo verde/laranja de seleção)
    const inputNomePai = document.getElementById('cat-nome-pai');
    if (inputNomePai) {
        inputNomePai.readOnly = false;
        inputNomePai.style.background = '#fff';
        inputNomePai.style.borderColor = '#cbd5e1';
        // Remove o link [TROCAR] se ele existir
        const resetLink = inputNomePai.parentElement.querySelector('small');
        if (resetLink) resetLink.remove();
    }

    // 5. NAVEGAÇÃO INICIAL
    switchTabCadastro('identificacao');

    modal.style.display = 'flex';
}

//=== Encerra a interface de cadastro global, ocultando o modal da visualização do usuário ===//
function fecharModalCadastroGlobal() {
    const modal = document.getElementById('modal-cadastro-global');
    if (modal) modal.style.display = 'none';
}

//=== Gerencia a alternância visual entre as abas de Identificação, Logística e Composição no cadastro global ===//
function switchTabCadastro(tabId) {
    // 1. Gerencia os botões (Abas)
    const botoes = document.querySelectorAll('.g-cat-tab-btn');
    botoes.forEach(btn => btn.classList.remove('active'));

    // 2. Gerencia os conteúdos
    const conteudos = document.querySelectorAll('.g-cat-tab-content');
    conteudos.forEach(div => div.style.display = 'none');

    // 3. Ativa o selecionado
    if (tabId === 'identificacao') {
        botoes[0].classList.add('active');
        document.getElementById('tab-identificacao').style.display = 'block';
    } else if (tabId === 'logistica') {
        botoes[1].classList.add('active');
        document.getElementById('tab-logistica').style.display = 'block';
    } else if (tabId === 'composicao') {
        botoes[2].classList.add('active');
        document.getElementById('tab-composicao').style.display = 'block';
    }
}

//=== Monitora a ativação do modo Anfitrião, exibindo ou ocultando dinamicamente a área de configuração de regras de acoplamento ===//
document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'cat-is-kit') {
        const areaKit = document.getElementById('area-selecao-componentes');
        if (areaKit) {
            // Exibe a área de componentes (regras de acoplamento)
            areaKit.style.display = e.target.checked ? 'block' : 'none';

            // Logica Peer: Se for marcado como Anfitrião (is-kit), 
            // garantimos que o usuário saiba que ele poderá acoplar 
            // itens mesmo sendo Single (Virtualização).
            if (e.target.checked) {
                console.log("Modo Anfitrião ativado para o item. Regras de acoplamento liberadas.");
            }
        }
    }
});

//=== Realiza busca preditiva de famílias no catálogo, permitindo vincular o item a uma categoria pai ou definir regras de acoplamento para kits ===//
async function buscarInteligenteFamilia(termo, contexto = 'principal') {
    const listUI = contexto === 'principal' ?
        document.getElementById('list-suggestions-familia') :
        document.getElementById('list-suggestions-componentes');

    const boxUI = contexto === 'principal' ?
        document.getElementById('suggestions-familia') :
        document.getElementById('suggestions-componentes');

    const uidPaiInput = document.getElementById('cat-uid-pai');

    if (!termo || termo.length < 2) {
        if (boxUI) boxUI.style.display = 'none';
        return;
    }

    try {
        const termoUpper = termo.toUpperCase();

        // ✅ CIRÚRGICO: Agora buscamos diretamente na coleção única 'inventario'
        // Buscamos pelo campo 'familia_nome' que definimos no cadastro unificado
        const snap = await db.collection('inventario')
            .where('familia_nome', '>=', termoUpper)
            .where('familia_nome', '<=', termoUpper + '\uf8ff')
            .limit(20) // Pegamos mais itens para poder filtrar duplicatas no JS
            .get();

        if (snap.empty) {
            let htmlNovo = `
                <li onclick="prepararNovaFamilia('${termoUpper}')" 
                    style="padding:12px; cursor:pointer; background: #fffaf0; border-bottom:1px solid #fbd38d; display:flex; align-items:center; gap:10px;">
                    <i class="fas fa-plus-circle" style="color: #d97706;"></i>
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-size:13px; color:#92400e; font-weight:600;">Definir nova família: "${termoUpper}"</span>
                        <span style="font-size:10px; color:#b45309;">Esta família será criada junto com este item.</span>
                    </div>
                </li>`;

            if (listUI) listUI.innerHTML = htmlNovo;
            if (boxUI) boxUI.style.display = 'block';
            if (contexto === 'principal' && uidPaiInput) uidPaiInput.value = '';
            return;
        }

        // ✅ FILTRO DE UNICIDADE: Como vários itens podem ter a mesma família,
        // filtramos para mostrar o nome da família apenas uma vez na lista de sugestões.
        const familiasUnicas = [];
        const nomesProcessados = new Set();

        snap.forEach(doc => {
            const d = doc.data();
            const nomeFam = d.familia_nome || d.nome_pai; // fallback para compatibilidade
            if (nomeFam && !nomesProcessados.has(nomeFam)) {
                familiasUnicas.push({ nome: nomeFam, id: d.uid_pai || doc.id });
                nomesProcessados.add(nomeFam);
            }
        });

        let html = '';
        // Mostramos apenas as 5 primeiras famílias únicas encontradas
        familiasUnicas.slice(0, 5).forEach(fam => {
            const funcChamada = contexto === 'principal' ?
                `selecionarFamilia('${fam.id}', '${fam.nome}')` :
                `adicionarLinhaComponenteRegra('${fam.id}', '${fam.nome}')`;

            html += `
                <li onclick="${funcChamada}" style="padding:12px; cursor:pointer; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; gap:10px;" 
                    onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <i class="fas fa-folder-tree" style="color: #2c7399;"></i>
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-size:13px; color:#1e293b; font-weight:600;">${fam.nome}</span>
                        <span style="font-size:10px; color:#94a3b8;">Família existente no Inventário</span>
                    </div>
                </li>`;
        });

        if (listUI) listUI.innerHTML = html;
        if (boxUI) boxUI.style.display = 'block';

    } catch (e) {
        console.error("Erro na busca Sigma V3:", e);
    }
}

//=== Prepara a interface para o registro de uma nova família no catálogo, sinalizando ao back-end a necessidade de gerar um novo identificador (FAM-XXXXXX) ===//
function prepararNovaFamilia(nome) {
    const inputNome = document.getElementById('cat-nome-pai');
    const inputUid = document.getElementById('cat-uid-pai');

    inputNome.value = nome;
    
    // ✅ AJUSTE V3: Limpamos o UID para que a função salvarCadastroGlobalHierarquico
    // entenda que deve gerar um novo ID ou apenas usar o nome digitado.
    if (inputUid) inputUid.value = ''; 

    // Feedback visual de nova linhagem no inventário
    inputNome.style.borderColor = '#d97706';
    inputNome.style.background = '#fffaf0';
    inputNome.readOnly = false; // Garante que o usuário possa ajustar o nome se quiser

    const suggestions = document.getElementById('suggestions-familia');
    if (suggestions) suggestions.style.display = 'none';

    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'info',
        title: `Nova linhagem: "${nome}"`,
        showConfirmButton: false,
        timer: 2500
    });
}

//=== Vincula o item a uma linhagem/família já existente no Inventário Único ===//
function selecionarFamilia(uid, nome) {
    const inputNome = document.getElementById('cat-nome-pai');
    const inputUid = document.getElementById('cat-uid-pai');

    if (inputNome) {
        inputNome.value = nome;
        // ✅ AJUSTE V3: Mudamos o visual para verde indicando que o item herdará
        // as propriedades de uma linhagem já existente no banco.
        inputNome.style.background = '#f0fdf4'; 
        inputNome.style.borderColor = '#16a34a';
        inputNome.readOnly = true; // Trava para evitar desalinhamento com o UID
    }

    // ✅ AJUSTE V3: Mantemos o UID apenas para agrupamento lógico no documento híbrido
    if (inputUid) inputUid.value = uid;

    const suggestions = document.getElementById('suggestions-familia');
    if (suggestions) suggestions.style.display = 'none';

    // Botão para "limpar" e permitir digitar outro nome caso o usuário tenha clicado errado
    const btnReset = document.createElement('small');
    btnReset.innerHTML = `<a href="javascript:void(0)" onclick="resetarSelecaoFamilia()" style="color:#dc2626; margin-left:10px; font-weight:700;">[TROCAR]</a>`;
    
    // Evita duplicar o botão de reset
    const existingReset = inputNome.parentElement.querySelector('small');
    if (!existingReset) inputNome.parentElement.appendChild(btnReset);
}

// Função auxiliar para permitir que o usuário mude de ideia após selecionar uma família
function resetarSelecaoFamilia() {
    const inputNome = document.getElementById('cat-nome-pai');
    const inputUid = document.getElementById('cat-uid-pai');
    
    inputNome.value = '';
    inputUid.value = '';
    inputNome.readOnly = false;
    inputNome.style.background = '#fff';
    inputNome.style.borderColor = '#cbd5e1';
    
    const resetLink = inputNome.parentElement.querySelector('small');
    if (resetLink) resetLink.remove();
    inputNome.focus();
}

//=== Adiciona uma nova família de acessórios à regra de composição do anfitrião, definindo a quantidade sugerida para a montagem do kit ===//
function adicionarLinhaComponenteRegra(uid, nome) {
    const container = document.getElementById('lista-componentes-selecionados');
    if (!container) return;

    // 1. Evita duplicados baseando-se no UID da linhagem/família
    if (container.querySelector(`[data-familia-uid="${uid}"]`)) {
        return Swal.fire({
            icon: 'info',
            title: 'Já adicionado',
            text: 'Esta linhagem já faz parte da composição deste kit.',
            timer: 2000,
            showConfirmButton: false
        });
    }

    // 2. Cria o elemento visual (Representa uma "regra de kit")
    const div = document.createElement('div');
    div.className = 'componente-selecionado-regra';
    
    // ✅ PADRÃO V3: Mantemos os datasets consistentes com o que a função de salvar espera
    div.dataset.familiaUid = uid;
    div.dataset.nomeFamilia = nome;
    
    div.style.cssText = "display: flex; align-items: center; justify-content: space-between; background: #fdfdfd; padding: 10px 14px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); transition: all 0.2s;";

    div.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="background: #eff6ff; padding: 8px 12px; border-radius: 8px; border: 1px solid #dbeafe;">
                <i class="fas fa-boxes-stacked" style="color: #2563eb; font-size: 0.9em;"></i>
            </div>
            <div style="display: flex; flex-direction: column;">
                <b style="font-size: 0.85em; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">${nome}</b>
                <span style="font-size: 10px; color: #64748b; font-family: monospace; font-weight: 600;">REF: ${uid}</span>
            </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 15px;">
            <div style="display: flex; flex-direction: column; align-items: center; background: #f8fafc; padding: 4px 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
                <label style="font-size: 9px; font-weight: 900; color: #475569; margin-bottom: 2px; text-transform: uppercase;">Qtd. Padrão</label>
                <input type="number" class="input-qtd-regra" value="1" min="1" 
                       style="width: 50px; border: none; background: transparent; text-align: center; font-weight: 800; color: #0f172a; outline: none;">
            </div>
            
            <button onclick="this.closest('.componente-selecionado-regra').remove()" 
                    title="Remover regra de componente"
                    style="background: #fff1f2; border: 1px solid #fecdd3; color: #e11d48; cursor: pointer; padding: 8px 10px; border-radius: 8px; transition: 0.2s;">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    container.appendChild(div);

    // 3. Reset da busca de componentes para agilizar o próximo acréscimo
    const inputBuscaComp = document.getElementById('cat-busca-componente');
    if (inputBuscaComp) {
        inputBuscaComp.value = '';
        inputBuscaComp.focus();
    }

    const boxSuggestions = document.getElementById('suggestions-componentes');
    if (boxSuggestions) boxSuggestions.style.display = 'none';

    // Notificação discreta de inclusão
    console.log(`Regra adicionada: ${nome} (${uid})`);
}
//=== Processa o salvamento DNA do item no Catálogo Global e sua instância no Inventário, gerenciando contadores sequenciais de Família (FAM) e Modelo (MOD) ===//
async function salvarCadastroGlobalHierarquico() {
    const btn = document.querySelector('.btn-sync');
    if (!btn || btn.disabled) return; 

    const nomePai = document.getElementById('cat-nome-pai').value.trim().toUpperCase();
    const marca = document.getElementById('cat-marca').value.trim().toUpperCase();
    const modelo = document.getElementById('cat-modelo').value.trim().toUpperCase();
    const categoria = document.getElementById('cat-categoria').value;
    const tipoControle = document.querySelector('input[name="cat-tipo"]:checked').value;
    const unidadeMedida = document.getElementById('cat-unidade-medida').value;
    const exigeInspecao = document.getElementById('cat-has-inspecao').checked;
    const isAnfitriao = document.getElementById('cat-is-kit').checked;
    const qtdInicial = parseInt(document.getElementById('cat-qtd-inicial')?.value) || 0;

    if (!nomePai || !marca || !modelo) return alert("Preencha Família, Marca e Modelo.");

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';

    const autorNome = currentUserData.nome_militar_completo || currentUserData.nome_guerra;
    const autorUid = firebase.auth().currentUser.uid;
    const minhaUnidadeId = currentUserData.unidade_id;

    try {
        // ✅ BUSCA SIGLA REAL NA COLEÇÃO unidades_estruturadas ANTES DA TRANSAÇÃO
        const snapUnidade = await db.collection('unidades_estruturadas').doc(minhaUnidadeId).get();
        if (!snapUnidade.exists) throw new Error("Unidade do militar não localizada no cadastro estruturado.");
        const minhaUnidadeSigla = snapUnidade.data().sigla.toUpperCase();

        const dataRegistro = new Date().toLocaleString('pt-BR');
        const nomeTecnicoFinal = `${nomePai} ${marca} ${modelo}`;

        await db.runTransaction(async (transaction) => {
            const contRef = db.collection('config_geral').doc('contadores');
            const contSnap = await transaction.get(contRef);
            const proximoMod = (contSnap.data()?.ultimo_id_modelo || 0) + 1;
            const uidGlobalFinal = `ITEM-${String(proximoMod).padStart(6, '0')}`;

            const objetoSaldoV3 = {
                sigla: minhaUnidadeSigla,
                total: qtdInicial,
                disp: qtdInicial,
                pend: 0, caut: 0, uso: 0, uso_pend: 0, uso_caut: 0,
                last_update: dataRegistro
            };

            const invRef = db.collection('inventario').doc(uidGlobalFinal);
            transaction.set(invRef, {
                uid_global: uidGlobalFinal,
                nome: nomeTecnicoFinal,
                familia_nome: nomePai,
                marca: marca,
                modelo: modelo,
                categoria: categoria,
                tipo: tipoControle,
                unidade_medida: unidadeMedida,
                exige_inspecao: exigeInspecao,
                is_anfitriao: isAnfitriao,
                componentes_regra: isAnfitriao ? Array.from(document.querySelectorAll('.componente-selecionado-regra')).map(el => ({
                    uid_global: el.dataset.familiaUid,
                    nome: el.dataset.nomeFamilia,
                    quantidade: parseInt(el.querySelector('.input-qtd-regra').value) || 1,
                    tipo_vinculo: "ACESSORIO_VINCULADO"
                })) : [],
                tags_busca: [nomePai, marca, modelo, categoria, uidGlobalFinal],
                qtd_corporativa_total: qtdInicial,
                unidades_cache: { [minhaUnidadeId]: objetoSaldoV3 },
                criado_em: dataRegistro,
                criado_por: autorNome,
                criado_por_uid: autorUid,
                unidade_origem_id: minhaUnidadeId
            });

            const saldoRef = invRef.collection('saldos_unidades').doc(minhaUnidadeId);
            transaction.set(saldoRef, objetoSaldoV3);

            if (qtdInicial > 0 && tipoControle === 'single') {
                for (let i = 0; i < qtdInicial; i++) {
                    const randomId = Math.random().toString(36).substr(2, 5).toUpperCase();
                    const filhoUid = `V-UID-${Date.now()}-${randomId}-${i}`;
                    transaction.set(invRef.collection('tombamentos').doc(filhoUid), {
                        tomb: filhoUid,
                        situacao_atual: "DISPONÍVEL",
                        local_id: "ALMOXARIFADO",
                        unidade_id: minhaUnidadeId,
                        unidade_sigla: minhaUnidadeSigla,
                        data_entrada: dataRegistro,
                        tipo_rastreio: 'virtual',
                        atualizado_por: autorNome,
                        atualizado_por_uid: autorUid
                    });
                }
            }

            const histRef = saldoRef.collection('historico_vida').doc();
            transaction.set(histRef, {
                data: dataRegistro,
                evento: "CADASTRO_GLOBAL",
                detalhes: `Material registrado via Cadastro Hierárquico. Carga inicial: ${qtdInicial} un.`,
                quem: autorNome,
                quem_uid: autorUid,
                unidade: minhaUnidadeSigla
            });

            transaction.update(contRef, { ultimo_id_modelo: proximoMod });
        });

        Swal.fire({ icon: 'success', title: 'Cadastro Concluído!', text: nomeTecnicoFinal });
        fecharModalCadastroGlobal();
        carregarAlmoxarifadoUI();

    } catch (e) {
        console.error("Erro no cadastro:", e);
        Swal.fire("Erro", e.message, "error");
        btn.disabled = false;
        btn.innerHTML = 'SALVAR NO CATÁLOGO';
    }
}

//=== Prepara a interface de aporte de material, gerenciando a entrada de quantidades e a identificação individual (tombamento/série) para itens do tipo Multi ===//
async function prepararAporte(docId) {
    const docAlvo = await db.collection('inventario').doc(docId).get();
    if (!docAlvo.exists) return Swal.fire("Erro", "Material não localizado no DNA Global.", "error");

    const item = docAlvo.data();
    const ehMulti = item.tipo === 'multi';

    Swal.fire({
        title: `<i class="fas fa-plus-circle"></i> Aporte de Material`,
        html: `
            <div style="text-align: left; padding: 5px;">
                <div style="background: #f0fdf4; padding: 12px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #bbf7d0;">
                    <small style="color: #166534; font-weight: 800; text-transform: uppercase; font-size: 0.7em;">Material Selecionado</small>
                    <div style="font-weight: 800; color: #14532d; font-size: 1.1em;">${item.nome}</div>
                    <small style="color: #166534; font-size: 0.75em;">DNA: ${item.tipo.toUpperCase()} • ${item.categoria}</small>
                </div>

                <div class="form-group" style="margin-bottom: 15px;">
                    <label style="font-size: 0.85em; font-weight:bold; color:#800020;">DESTINAR AO SETOR / LOCAL:</label>
                    <select id="swal-aporte-setor" class="swal2-input" style="width: 100%; margin: 10px 0; font-size: 0.9em;">
                        <option value="">Carregando setores...</option>
                    </select>
                </div>

                <div class="form-group">
                    <label style="font-size: 0.85em; font-weight:bold; color:#800020;">QUANTIDADE DE ENTRADA:</label>
                    <input type="number" id="swal-aporte-qtd" class="swal2-input" value="1" min="1" 
                           style="width: 100%; margin: 10px 0;"
                           oninput="gerarInputsTombamentoDinamico(this.value, '${item.tipo}')">
                </div>

                <div id="div-tombamentos-dinamicos" style="display: ${ehMulti ? 'block' : 'none'}; margin-top: 15px; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px dashed #2c7399;">
                    <label style="font-weight: bold; color: #2c7399; font-size: 0.85em; display: block; margin-bottom: 10px;">
                        <i class="fas fa-barcode"></i> Identificação dos Itens (Tomb / Série):
                    </label>
                    <div id="container-inputs-tomb" style="max-height: 200px; overflow-y: auto;"></div>
                </div>

                <div class="form-group" style="margin-top:15px;">
                    <label style="font-size: 0.85em; font-weight:bold; color:#800020;">JUSTIFICATIVA / NOTA FISCAL:</label>
                    <textarea id="swal-aporte-obs" class="swal2-textarea" style="width: 100%; margin: 10px 0; height: 80px;" placeholder="Ex: NF 455 - Aquisição via Pregão Eletrônico..."></textarea>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-check"></i> CONFIRMAR ENTRADA',
        confirmButtonColor: '#166534',
        cancelButtonText: 'Cancelar',
        didOpen: async () => {
            if (ehMulti) gerarInputsTombamentoDinamico(1, 'multi');

            // ✅ POPULAR SETORES DINAMICAMENTE AO ABRIR
            const selectSetor = document.getElementById('swal-aporte-setor');
            const unidadeId = currentUserData.unidade_id;
            const snapSetores = await db.collection('config_setores')
                .where('unidade_id', '==', unidadeId)
                .orderBy('nome').get();

            selectSetor.innerHTML = '<option value="">-- Selecione um Setor --</option>';
            snapSetores.forEach(doc => {
                selectSetor.innerHTML += `<option value="${doc.id}">${doc.data().nome.toUpperCase()}</option>`;
            });
        },
        preConfirm: () => {
            const qtd = document.getElementById('swal-aporte-qtd').value;
            const obs = document.getElementById('swal-aporte-obs').value.trim();
            const setorId = document.getElementById('swal-aporte-setor').value;

            if (!setorId) return Swal.showValidationMessage('Selecione o setor de destino');
            if (!qtd || qtd < 1) return Swal.showValidationMessage('Informe uma quantidade válida');
            if (!obs) return Swal.showValidationMessage('A justificativa é obrigatória');

            let tombamentos = [];
            if (ehMulti) {
                const linhas = document.querySelectorAll('.linha-tomb-input');
                for (let linha of linhas) {
                    const t = linha.querySelector('.val-tomb').value.trim().toUpperCase();
                    const s = linha.querySelector('.val-sn').value.trim().toUpperCase();
                    if (!t) return Swal.showValidationMessage('Preencha todos os números de tombamento');
                    tombamentos.push({ tomb: t, serie: s });
                }
            }

            return {
                quantidade: parseInt(qtd),
                observacao: obs,
                setor_id: setorId, // ✅ ID DO SETOR CAPTURADO
                tombamentos: ehMulti ? tombamentos : null,
                tipo_item: item.tipo
            };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            processarAporteNoBanco(docId, result.value);
        }
    });
}

//=== Executa a entrada física de materiais no estoque, gerando identificadores individuais (reais para Multi ou V-UIDs para Single) e atualizando os saldos da unidade e o cache corporativo ===//
async function processarAporteNoBanco(uidGlobal, dados) {
    const { quantidade, observacao, tombamentos, setor_id } = dados;
    const ehMulti = tombamentos !== null;
    const minhaUnidadeId = currentUserData.unidade_id;
    const autorNome = currentUserData.nome_militar_completo || currentUserData.nome_guerra;
    const autorUid = firebase.auth().currentUser.uid;
    const dataReg = new Date().toLocaleString('pt-BR');

    Swal.fire({ title: 'Sincronizando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        // ✅ BUSCA SIGLA REAL E NOME DO SETOR ANTES DA TRANSAÇÃO
        const [snapUnidade, snapSetor] = await Promise.all([
            db.collection('unidades_estruturadas').doc(minhaUnidadeId).get(),
            db.collection('config_setores').doc(setor_id).get()
        ]);

        if (!snapUnidade.exists) throw new Error("Unidade não localizada.");
        const minhaUnidadeSigla = snapUnidade.data().sigla.toUpperCase();
        const nomeSetorAmigavel = snapSetor.exists ? snapSetor.data().nome.toUpperCase() : "ALMOXARIFADO";

        const itemRef = db.collection('inventario').doc(uidGlobal);
        const saldoUnidadeRef = itemRef.collection('saldos_unidades').doc(minhaUnidadeId);
        let qtdEfetivaLote = ehMulti ? tombamentos.length : Number(quantidade);

        await db.runTransaction(async (transaction) => {
            const snapItem = await transaction.get(itemRef);
            if (!snapItem.exists) throw new Error("Material não encontrado.");
            const d = snapItem.data();

            const snapSaldo = await transaction.get(saldoUnidadeRef);
            const sUnid = snapSaldo.exists ? snapSaldo.data() : {
                total: 0, disp: 0, pend: 0, caut: 0, uso: 0, uso_pend: 0, uso_caut: 0, setores_ids: []
            };

            let listaSetores = Array.isArray(sUnid.setores_ids) ? [...sUnid.setores_ids] : [];
            if (setor_id && !listaSetores.includes(setor_id)) listaSetores.push(setor_id);

            const novoSaldoV3 = {
                sigla: minhaUnidadeSigla,
                total: (sUnid.total || 0) + qtdEfetivaLote,
                disp: (sUnid.disp || 0) + qtdEfetivaLote,
                pend: (sUnid.pend || 0),
                caut: (sUnid.caut || 0),
                uso: (sUnid.uso || 0),
                uso_pend: (sUnid.uso_pend || 0),
                uso_caut: (sUnid.uso_caut || 0),
                setores_ids: listaSetores,
                last_update: dataReg
            };

            if (ehMulti) {
                for (let tInfo of tombamentos) {
                    const filhoRef = itemRef.collection('tombamentos').doc(tInfo.tomb);
                    transaction.set(filhoRef, {
                        tomb: tInfo.tomb,
                        serie: tInfo.serie || "N/A",
                        situacao_atual: "DISPONÍVEL",
                        local_id: "ALMOXARIFADO",
                        unidade_id: minhaUnidadeId,
                        unidade_sigla: minhaUnidadeSigla,
                        setor_id: setor_id,
                        sub_local: nomeSetorAmigavel,
                        data_entrada: dataReg,
                        tipo_rastreio: 'patrimonio',
                        atualizado_por: autorNome,
                        atualizado_por_uid: autorUid
                    });

                    transaction.set(filhoRef.collection('historico_vida').doc(), {
                        data: dataReg, evento: "APORTE_PATRIMONIO", detalhes: `Entrada via aporte. Obs: ${observacao}`,
                        quem: autorNome, quem_uid: autorUid, unidade: minhaUnidadeSigla
                    });
                }
            } else {
                for (let i = 0; i < qtdEfetivaLote; i++) {
                    const randomId = Math.random().toString(36).substr(2, 5).toUpperCase();
                    const filhoUid = `V-UID-${Date.now()}-${randomId}-${i}`;
                    const filhoRef = itemRef.collection('tombamentos').doc(filhoUid);
                    transaction.set(filhoRef, {
                        tomb: filhoUid, situacao_atual: "DISPONÍVEL", local_id: "ALMOXARIFADO",
                        unidade_id: minhaUnidadeId, unidade_sigla: minhaUnidadeSigla,
                        setor_id: setor_id, sub_local: nomeSetorAmigavel,
                        data_entrada: dataReg, tipo_rastreio: 'virtual',
                        atualizado_por: autorNome, atualizado_por_uid: autorUid
                    });

                    transaction.set(filhoRef.collection('historico_vida').doc(), {
                        data: dataReg, evento: "GERACAO_VIRTUAL", detalhes: `Entrada física. Obs: ${observacao}`,
                        quem: autorNome, quem_uid: autorUid, unidade: minhaUnidadeSigla
                    });
                }
            }

            const logUnidRef = saldoUnidadeRef.collection('historico_vida').doc();
            transaction.set(logUnidRef, {
                data: dataReg, evento: "APORTE_ESTOQUE", detalhes: `Aporte de ${qtdEfetivaLote} un. Obs: ${observacao}`,
                quem: autorNome, quem_uid: autorUid, unidade: minhaUnidadeSigla, qtd: qtdEfetivaLote, tipo: "APORTE"
            });

            const updatePai = { qtd_corporativa_total: (d.qtd_corporativa_total || 0) + qtdEfetivaLote, ultima_movimentacao: dataReg };
            updatePai[`unidades_cache.${minhaUnidadeId}`] = novoSaldoV3;

            transaction.update(itemRef, updatePai);
            transaction.set(saldoUnidadeRef, novoSaldoV3);
        });

        Swal.fire({ icon: 'success', title: 'Aporte Concluído!' });
        carregarAlmoxarifadoUI();

    } catch (e) {
        console.error("Erro no aporte:", e);
        Swal.fire('Erro', e.message, 'error');
    }
}

//=== Gera dinamicamente campos de entrada para tombamento e número de série quando o item requer rastreio individual (Tipo Multi) ===//
function gerarInputsTombamentoDinamico(qtd, tipo) {
    const containerDiv = document.getElementById('div-tombamentos-dinamicos');
    const lista = document.getElementById('container-inputs-tomb');

    if (tipo !== 'multi') {
        if (containerDiv) containerDiv.style.display = 'none';
        return;
    }

    containerDiv.style.display = 'block';
    lista.innerHTML = '';

    for (let i = 1; i <= qtd; i++) {
        lista.innerHTML += `
            <div class="linha-tomb-input" style="display: grid; grid-template-columns: 30px 1fr 1fr; gap: 8px; margin-bottom: 8px; align-items: center;">
                <div style="background: #166534; color: white; text-align: center; border-radius: 4px; font-size: 0.8em; height: 30px; line-height: 30px;">${i}</div>
                <input type="text" class="swal2-input val-tomb" placeholder="Tombamento" style="margin:0; height: 35px; font-size: 0.9em;">
                <input type="text" class="swal2-input val-sn" placeholder="Nº Série" style="margin:0; height: 35px; font-size: 0.9em;">
            </div>`;
    }
}

//=== Renderiza a Matriz Operacional do Almoxarifado, consolidando os saldos de estoque local, itens em carga nas viaturas e materiais cautelados para visualização do Gestor ===//
async function carregarAlmoxarifadoUI() {
    const tbody = document.getElementById('almox-body');
    const palcoPrincipal = document.getElementById('container-tabela-principal');
    const wrapperRastreio = document.getElementById('almox-rastreio-wrapper');
    const breadcrumb = document.getElementById('almox-breadcrumb');

    if (typeof popularFiltroSetores === 'function') popularFiltroSetores();
    itemSendoVisualizado = null; 

    if (palcoPrincipal) palcoPrincipal.style.display = 'block';
    if (wrapperRastreio) wrapperRastreio.style.display = 'none';
    if (breadcrumb) breadcrumb.innerHTML = `Almoxarifado <i class="fas fa-chevron-right" style="font-size:0.7em; margin:0 5px;"></i> Inventário Geral`;

    if (!tbody) return;

    // Loading Inicial Elegante
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:60px; color:#64748b;">
        <i class="fas fa-sync fa-spin fa-2x" style="color:#2c7399; margin-bottom:15px; display:block; width:100%;"></i>
        <span style="font-weight:600; letter-spacing:1px;">MAPEANDO ESTOQUE OPERACIONAL...</span>
    </td></tr>`;

    try {
        const minhaUnidadeId = currentUserData.unidade_id;
        const role = currentUserData ? currentUserData.role : null;
        const isAdmin = (role === 'admin' || role === 'gestor_geral');

        // Mapeamento de Setores
        const snapSetores = await db.collection('config_setores').where('unidade_id', '==', minhaUnidadeId).get();
        const mapaSetores = {};
        snapSetores.forEach(s => { mapaSetores[s.id] = s.data().nome.toUpperCase(); });

        const snapItens = await db.collection('inventario').get();
        const listaFinal = [];

        snapItens.forEach(doc => {
            const d = doc.data();
            if (!d) return;

            const c = (d.unidades_cache && d.unidades_cache[minhaUnidadeId]) || {
                total: 0, disp: 0, pend: 0, caut: 0, uso: 0, uso_pend: 0, uso_caut: 0, setores_ids: []
            };

            const ehDonoDoItem = d.unidade_origem_id === minhaUnidadeId;

            // Filtro de visibilidade Sigma V3
            if (isAdmin || c.total > 0 || ehDonoDoItem) {
                listaFinal.push({
                    id: doc.id,
                    nome: d.nome || "Item sem Nome",
                    tipo: d.tipo || "single",
                    categoria: d.categoria || "OUTROS",
                    setores_ids: c.setores_ids || [],
                    resumo: {
                        total: Number(c.total || 0),
                        almox_disp: Number(c.disp || 0),
                        almox_pend: Number(c.pend || 0),
                        vtr_ok: Math.max(0, Number(c.uso || 0) - Number(c.uso_pend || 0) - Number(c.uso_caut || 0)),
                        vtr_pend: Number(c.uso_pend || 0),
                        vtr_caut: Number(c.uso_caut || 0),
                        vtr_tot: Number(c.uso || 0)
                    }
                });
            }
        });

        // Ordenação e Filtros
        listaFinal.sort((a, b) => a.nome.localeCompare(b.nome));

        const searchTerm = (document.getElementById('almox-search')?.value || "").toUpperCase().trim();
        const categoryTerm = document.getElementById('almox-cat-filter')?.value || "";
        const sectorTerm = document.getElementById('almox-setor-filter')?.value || "";

        const listaFiltrada = listaFinal.filter(it => {
            const matchesSearch = searchTerm === "" || it.nome.toUpperCase().includes(searchTerm);
            const matchesCategory = categoryTerm === "" || it.categoria === categoryTerm;
            const matchesSector = sectorTerm === "" || it.setores_ids.includes(sectorTerm);
            return matchesSearch && matchesCategory && matchesSector;
        });

        // Paginação
        const totalItens = listaFiltrada.length;
        const itensPorPagina = window.itensPorPagina || 10;
        const paginaAtual = window.paginaAtualAlmox || 1;
        const inicio = (paginaAtual - 1) * itensPorPagina;
        const fim = inicio + itensPorPagina;
        const itensPaginados = listaFiltrada.slice(inicio, fim);

        // Renderização da Tabela
        if (itensPaginados.length === 0) {
            // ✅ AVISO ELEGANTE: EMPTY STATE
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:80px 20px; color:#94a3b8;">
                <div style="display:inline-block; margin-bottom:20px; width:80px; height:80px; line-height:80px; background:#f1f5f9; border-radius:50%; color:#cbd5e1;">
                    <i class="fas fa-box-open fa-3x" style="vertical-align:middle;"></i>
                </div>
                <h3 style="margin:0; color:#475569; font-size:1.2em; font-weight:700;">Nenhum item localizado</h3>
                <p style="margin:10px 0 0 0; font-size:0.9em; opacity:0.8;">Não encontramos registros para os filtros aplicados ou <br>sua unidade ainda não possui saldo neste inventário.</p>
            </td></tr>`;
            return;
        }

        let html = '';
        itensPaginados.forEach((it, idx) => {
            const r = it.resumo;
            const indexReal = inicio + idx + 1;
            const corDisp = r.almox_disp > 0 ? '#10b981' : '#94a3b8';
            const corPendAlmox = r.almox_pend > 0 ? '#e11d48' : '#94a3b8';
            const nomesDosSetores = it.setores_ids.map(id => mapaSetores[id] || 'S/ SETOR').join(' • ');

            html += `
            <tr class="linha-material">
                <td style="text-align:center; color:#94a3b8; font-weight:700; font-size:0.85em;">${indexReal}</td>
                <td>
                    <div style="line-height:1.4;">
                        <span style="font-weight:700; color:#1e293b; font-size:1.1em;">${it.nome}</span>
                        <div style="font-size:10px; color:#94a3b8; font-weight:700; text-transform:uppercase;">
                            ${it.tipo === 'multi' ? '<i class="fas fa-barcode"></i> PATRIMONIADO' : '<i class="fas fa-layer-group"></i> CONSUMO'} • ${it.categoria}
                        </div>
                        <div style="font-size:10px; color:#2c7399; font-weight:800; text-transform:uppercase; margin-top:2px;">
                            SETOR: <span style="color:#475569;">${nomesDosSetores || 'NÃO DEFINIDO'}</span>
                        </div>
                    </div>
                </td>
                <td style="text-align:center; font-weight:700; color:#1e293b; background:#f8fafc;">${r.total}</td>
                <td style="text-align:center;">
                    <div style="display:inline-flex; border:1px solid #e2e8f0; border-radius:6px; overflow:hidden; font-size:0.8em;">
                        <div style="padding:4px 6px; background:#fff; border-right:1px solid #e2e8f0;"><small style="display:block; font-size:8px; color:#10b981; font-weight:800;">OK</small><b style="color:#10b981;">${r.vtr_ok}</b></div>
                        <div style="padding:4px 6px; background:#fff; border-right:1px solid #e2e8f0;"><small style="display:block; font-size:8px; color:#e11d48; font-weight:800;">PEND</small><b style="color:#e11d48;">${r.vtr_pend}</b></div>
                        <div style="padding:4px 6px; background:#fff; border-right:1px solid #e2e8f0;"><small style="display:block; font-size:8px; color:#f57c00; font-weight:800;">CAUT</small><b style="color:#f57c00;">${r.vtr_caut}</b></div>
                        <div style="padding:4px 8px; background:#f1f5f9;"><small style="display:block; font-size:8px; color:#475569; font-weight:800;">TOT</small><b style="color:#475569;">${r.vtr_tot}</b></div>
                    </div>
                </td>
                <td style="text-align:center; background:#fffaf5;"><b style="color:#f57c00; font-size:1.1em;">${r.vtr_caut}</b></td>
                <td style="text-align:center;"><b style="color:${corPendAlmox}; font-size:1.1em;">${r.almox_pend}</b></td>
                <td style="text-align:center;"><b style="color:${corDisp}; font-size:1.1em;">${r.almox_disp}</b></td>
                <td style="text-align:right;">
                    <div style="display:flex; gap:5px; justify-content:flex-end;">                  
                        <button class="sigma-v3-tab" title="Adicionar Saldo" onclick="prepararAporte('${it.id}')" style="background:#166534; color:white;"><i class="fas fa-plus"></i></button>
                        <button class="sigma-v3-tab" title="Enviar para Lista" onclick="prepararMovimentacao('${it.id}','ENVIO')" style="background:#800020; color:white;"><i class="fas fa-paper-plane"></i></button>
                        <button class="sigma-v3-tab" title="Detalhar Item" onclick="verDetalhesItemAlmox('${it.id}')" style="padding: 6px 10px; background: rgba(30, 144, 255, 0.15); color: #1e90ff; border: 1px solid rgba(30, 144, 255, 0.3); border-radius: 6px;"><i class="fas fa-search"></i> </button>
                    </div>
                </td>
            </tr>`;
        });

        tbody.innerHTML = html;
        
        // Dispara a atualização dos controles de paginação (Função que você deve ter no dashboard.js)
        if (typeof renderizarPaginacaoAlmox === 'function') {
            renderizarPaginacaoAlmox(totalItens);
        }

    } catch (e) {
        console.error("Erro ao carregar Almoxarifado UI:", e);
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:40px; color:#e11d48; font-weight:bold;">
            <i class="fas fa-exclamation-triangle fa-2x" style="margin-bottom:10px;"></i><br>
            FALHA NA SINCRONIZAÇÃO: ${e.message}
        </td></tr>`;
    }
}

//=== Função dedicada a renderizar os controles de paginação, com lógica de exibição dinâmica para páginas próximas e botões de navegação ===//
function renderizarControlesPaginacao(totalPaginas, totalItens) {
    if (totalPaginas <= 1) return '';

    let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; background:#fff; border-top:1px solid #e2e8f0; font-family:sans-serif;">
        <div style="font-size:13px; color:#64748b;">
            Mostrando <b>${Math.min(itensPorPagina, totalItens)}</b> de <b>${totalItens}</b> materiais
        </div>
        <div style="display:flex; gap:5px;">
            <button onclick="mudarPaginaAlmox(${paginaAtualAlmox - 1})" ${paginaAtualAlmox === 1 ? 'disabled' : ''} 
                style="padding:5px 10px; border-radius:4px; border:1px solid #e2e8f0; background:${paginaAtualAlmox === 1 ? '#f8fafc' : '#fff'}; cursor:pointer;">
                <i class="fas fa-chevron-left"></i>
            </button>`;

    for (let i = 1; i <= totalPaginas; i++) {
        if (i === 1 || i === totalPaginas || (i >= paginaAtualAlmox - 1 && i <= paginaAtualAlmox + 1)) {
            html += `
            <button onclick="mudarPaginaAlmox(${i})" 
                style="padding:5px 12px; border-radius:4px; border:1px solid ${i === paginaAtualAlmox ? '#2c7399' : '#e2e8f0'}; 
                background:${i === paginaAtualAlmox ? '#2c7399' : '#fff'}; 
                color:${i === paginaAtualAlmox ? '#fff' : '#475569'}; font-weight:700; cursor:pointer;">
                ${i}
            </button>`;
        } else if (i === paginaAtualAlmox - 2 || i === paginaAtualAlmox + 2) {
            html += `<span style="padding:5px; color:#94a3b8;">...</span>`;
        }
    }

    html += `
            <button onclick="mudarPaginaAlmox(${paginaAtualAlmox + 1})" ${paginaAtualAlmox === totalPaginas ? 'disabled' : ''} 
                style="padding:5px 10px; border-radius:4px; border:1px solid #e2e8f0; background:${paginaAtualAlmox === totalPaginas ? '#f8fafc' : '#fff'}; cursor:pointer;">
                <i class="fas fa-chevron-right"></i>
            </button>
        </div>
    </div>`;

    return html;
}

// ✅ FUNÇÃO PARA NAVEGAR ENTRE AS PÁGINAS
function mudarPaginaAlmox(novaPagina) {
    paginaAtualAlmox = novaPagina;
    carregarAlmoxarifadoUI();
    // Opcional: Voltar ao topo da tabela ao mudar
    const container = document.getElementById('container-tabela-principal');
    if (container) container.scrollIntoView({ behavior: 'smooth' });
}

//=== Gerencia o motor de busca e filtragem por categoria da Matriz de Estoque, aplicando regras de visibilidade por Unidade e Perfil de Acesso ===//
function filtrarAlmoxarifado() {
    // 1. Toda vez que filtrar, voltamos para a página 1 para não exibir tabelas vazias
    paginaAtualAlmox = 1;

    // 2. Simplesmente chamamos a função principal novamente
    // Ela vai ler os valores dos inputs e filtrar o Array ANTES de desenhar
    carregarAlmoxarifadoUI();
}

//=== Renderiza uma linha de aviso na tabela quando nenhum item é encontrado pelos filtros ou na busca inicial ===//
function renderizarMensagemVazia() {
    return `
        <tr class="no-results-row">
            <td colspan="8" style="text-align:center; padding:60px; color:#64748b;">
                <div style="display:flex; flex-direction:column; align-items:center; gap:12px;">
                    <i class="fas fa-box-open fa-3x" style="opacity:0.2; color:#94a3b8;"></i>
                    <span style="font-weight:600; font-size:0.95em;">Nenhum material localizado com os filtros aplicados.</span>
                    <button onclick="limparFiltrosAlmox();" 
                            style="margin-top:8px; padding:8px 16px; border-radius:8px; border:1px solid #e2e8f0; background:#fff; color:#800020; cursor:pointer; font-weight:700; font-size:0.8em; transition: all 0.2s;">
                        <i class="fas fa-filter-circle-xmark"></i> LIMPAR BUSCA E FILTROS
                    </button>
                </div>
            </td>
        </tr>`;
}

//Auxilia na limpeza dos filtros de busca e categoria, resetando a página para 1 e recarregando a UI do Almoxarifado para exibir o estoque completo novamente.
function limparFiltrosAlmox() {
    const search = document.getElementById('almox-search');
    const cat = document.getElementById('almox-cat-filter');
    const setor = document.getElementById('almox-setor-filter');

    if (search) search.value = "";
    if (cat) cat.value = "";
    if (setor) setor.value = "";

    // Resetamos a página global antes de recarregar
    paginaAtualAlmox = 1;
    
    // Recarrega a UI com os campos vazios (mostrando tudo)
    carregarAlmoxarifadoUI();
}

//=== Pupolar filtro com setores do almox ===//
async function popularFiltroSetores() {
    const selectFiltro = document.getElementById('almox-setor-filter');
    if (!selectFiltro) return;

    if (selectFiltro.options.length > 1) return;

    try {
        const unidadeId = currentUserData.unidade_id;
        const snap = await db.collection('config_setores')
            .where('unidade_id', '==', unidadeId)
            .orderBy('nome')
            .get();

        selectFiltro.innerHTML = '<option value="">Todos os Setores</option>';

        snap.forEach(doc => {
            const setor = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = setor.nome.toUpperCase();
            selectFiltro.appendChild(option);
        });

    } catch (e) {
        console.error("Erro ao popular filtro de setores:", e);
    }
}

async function prepararTrocaSetor(docId) {
    const doc = await db.collection('inventario').doc(docId).get();
    const item = doc.data();
    const unidadeId = currentUserData.unidade_id;

    const snapSetores = await db.collection('config_setores')
        .where('unidade_id', '==', unidadeId)
        .orderBy('nome').get();

    let optionsHtml = '<option value="">-- Selecione o Novo Destino --</option>';
    snapSetores.forEach(s => {
        optionsHtml += `<option value="${s.id}">${s.data().nome.toUpperCase()}</option>`;
    });

    Swal.fire({
        title: 'Mover Material de Setor',
        html: `
            <div style="text-align:left; font-size:0.9em;">
                <p>Mover <b>${item.nome}</b> para um novo local.</p>
                <label style="font-weight:bold; color:#800020;">NOVO SETOR:</label>
                <select id="swal-novo-setor" class="swal2-input" style="width:100%">${optionsHtml}</select>
                
                <div style="margin-top:15px; padding:10px; background:#fff9db; border-radius:8px; border:1px solid #fab005; font-size:0.8em;">
                    <i class="fas fa-exclamation-triangle"></i> <b>Nota:</b> Esta ação atualizará a localização de todos os itens (Patrimônio e Consumo) que estão no Almoxarifado desta unidade.
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'CONFIRMAR MUDANÇA',
        confirmButtonColor: '#2c7399',
        preConfirm: () => {
            const novoSetor = document.getElementById('swal-novo-setor').value;
            if (!novoSetor) return Swal.showValidationMessage('Selecione o setor de destino');
            return novoSetor;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            processarMudancaSetor(docId, result.value);
        }
    });
}

async function processarMudancaSetor(uidGlobal, novoSetorId) {
    Swal.fire({ title: 'Atualizando localização...', didOpen: () => Swal.showLoading() });

    try {
        const itemRef = db.collection('inventario').doc(uidGlobal);
        const unidadeId = currentUserData.unidade_id;
        const dataReg = new Date().toLocaleString('pt-BR');

        await db.runTransaction(async (transaction) => {
            const snap = await transaction.get(itemRef);
            const d = snap.data();
            const cache = d.unidades_cache[unidadeId];

            // 1. Atualizamos o Cache com o novo array de setores (resetando para o novo)
            const novoCache = {
                ...cache,
                setores_ids: [novoSetorId]
            };

            transaction.update(itemRef, {
                [`unidades_cache.${unidadeId}`]: novoCache,
                ultima_movimentacao: dataReg,
                historico_movimentacoes: firebase.firestore.FieldValue.arrayUnion({
                    data: dataReg,
                    evento: "TRANSFERENCIA_SETOR",
                    quem: currentUserData.nome_militar_completo,
                    detalhes: `Material movido para o setor ID: ${novoSetorId}`
                })
            });

            // 2. Atualiza Patrimoniados (Tombamentos)
            const snapFilhos = await itemRef.collection('tombamentos')
                .where('local_id', '==', unidadeId)
                .where('situacao_atual', '==', 'DISPONÍVEL')
                .get();

            snapFilhos.forEach(filhoDoc => {
                transaction.update(filhoDoc.ref, { setor_id: novoSetorId });
            });

            // 3. ✅ ATUALIZAÇÃO CIRÚRGICA: Atualiza itens de Consumo (Saldos)
            // Itens de consumo ficam na subcoleção 'saldos' vinculados ao setor antigo
            const snapSaldos = await itemRef.collection('saldos')
                .where('unidade_id', '==', unidadeId)
                .get();

            snapSaldos.forEach(saldoDoc => {
                transaction.update(saldoDoc.ref, { setor_id: novoSetorId });
            });
        });

        Swal.fire('Sucesso!', 'Localização atualizada em todos os registros.', 'success');
        carregarAlmoxarifadoUI();

    } catch (e) {
        console.error(e);
        Swal.fire('Erro', 'Não foi possível mover o material.', 'error');
    }
}

//=== Abre o modal de gestão de setores, permitindo ao usuário visualizar, adicionar, editar e excluir setores vinculados à sua unidade ===//
async function abrirGestaoSetores() {
    const unidadeId = currentUserData.unidade_id;

    // 1. Busca os setores no banco
    const snap = await db.collection('config_setores')
        .where('unidade_id', '==', unidadeId)
        .orderBy('nome')
        .get();

    let listaHtml = '<div id="setores-lista" style="max-height: 250px; overflow-y: auto; margin-top: 15px; border: 1px solid #f1f5f9; border-radius: 8px; background: #f8fafc;">';

    if (snap.empty) {
        listaHtml += '<p style="padding: 20px; text-align: center; color: #94a3b8; font-size: 0.9em;">Nenhum setor cadastrado.</p>';
    } else {
        snap.forEach(doc => {
            const setor = doc.data();
            listaHtml += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; border-bottom: 1px solid #e2e8f0; background: #fff;">
                    <span style="font-weight: 700; color: #1e293b; font-size: 0.9em; text-transform: uppercase;">${setor.nome}</span>
                    <div style="display: flex; gap: 15px;">
                        <button onclick="editarSetor('${doc.id}', '${setor.nome}')" style="background: none; border: none; color: #64748b; cursor: pointer; padding: 5px;" title="Editar">
                            <i class="fas fa-pencil-alt"></i>
                        </button>
                        <button onclick="excluirSetor('${doc.id}', '${setor.nome}')" style="background: none; border: none; color: #e11d48; cursor: pointer; padding: 5px;" title="Excluir">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>`;
        });
    }
    listaHtml += '</div>';

    // 2. Abre o Swal.fire
    Swal.fire({
        title: 'Gestão de Setores',
        html: `
            <div style="text-align: left;">
                <label style="font-size: 0.75em; font-weight: 800; color: #64748b; text-transform: uppercase;">Novo Setor / Localização</label>
                <div style="display: flex; gap: 8px; margin-top: 5px;">
                    <input id="novo-setor-nome" class="swal2-input" style="margin: 0; flex: 1; height: 45px; font-size: 0.9em;" placeholder="Ex: PRATELEIRA A1">
                    <button onclick="salvarNovoSetor()" style="background: #800020; color: white; border: none; border-radius: 6px; padding: 0 20px; cursor: pointer; transition: opacity 0.2s;">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
                
                <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center;">
                    <label style="font-size: 0.75em; font-weight: 800; color: #64748b; text-transform: uppercase;">Setores Ativos</label>
                    <span style="font-size: 10px; color: #94a3b8; font-weight: 600;">${snap.size} TOTAL</span>
                </div>
                ${listaHtml}
            </div>
        `,
        showConfirmButton: false,
        showCloseButton: true,
        customClass: { popup: 'sigma-v3-swal-border' }
    });
}

// AUX de abrirGestaoSetores - SALVAR NOVO SETOR
async function salvarNovoSetor() {
    const input = document.getElementById('novo-setor-nome');
    const nome = input.value.trim().toUpperCase(); // Padroniza para maiúsculas
    
    if (!nome) {
        input.style.borderColor = '#e11d48';
        return;
    }

    try {
        // Bloqueia o botão ou mostra loading simples se desejar, mas o recarregamento é rápido
        await db.collection('config_setores').add({
            nome: nome,
            unidade_id: currentUserData.unidade_id,
            criado_em: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Limpa o cache de setores do filtro global para forçar atualização na próxima vez que abrir o almoxarifado
        const selectFiltro = document.getElementById('almox-setor-filter');
        if (selectFiltro) selectFiltro.innerHTML = '<option value="">Todos os Setores</option>';

        abrirGestaoSetores(); // Recarrega o modal
    } catch (e) {
        console.error("Erro ao salvar setor:", e);
        Swal.fire('Erro', 'Não foi possível salvar o setor.', 'error');
    }
}

// AUX de abrirGestaoSetores - EDITAR SETOR EXISTENTE
async function editarSetor(id, nomeAtual) {
    const { value: novoNome } = await Swal.fire({
        title: 'Editar Nome do Setor',
        input: 'text',
        inputValue: nomeAtual,
        showCancelButton: true,
        confirmButtonColor: '#800020',
        cancelButtonText: 'Cancelar',
        confirmButtonText: 'Salvar Alteração',
        inputAttributes: { style: 'text-transform: uppercase;' },
        preConfirm: (value) => {
            if (!value) return Swal.showValidationMessage('O nome não pode estar vazio');
            return value.toUpperCase();
        }
    });

    if (novoNome && novoNome !== nomeAtual) {
        try {
            await db.collection('config_setores').doc(id).update({
                nome: novoNome.trim()
            });

            // Limpa o cache do filtro lateral
            const selectFiltro = document.getElementById('almox-setor-filter');
            if (selectFiltro) selectFiltro.innerHTML = '<option value="">Todos os Setores</option>';

            abrirGestaoSetores(); 
        } catch (e) {
            console.error("Erro ao editar setor:", e);
        }
    }
}

// AUX de abrirGestaoSetores - EXCLUIR SETOR
async function excluirSetor(id, nome) {
    const confirm = await Swal.fire({
        title: 'Excluir Setor?',
        text: `Deseja apagar o setor "${nome}"? Itens vinculados a ele ficarão "Sem Setor".`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e11d48',
        confirmButtonText: 'Sim, excluir'
    });

    if (confirm.isConfirmed) {
        try {
            await db.collection('config_setores').doc(id).delete();
            // Força reset do filtro para carregar a lista nova
            const selectFiltro = document.getElementById('almox-setor-filter');
            if (selectFiltro) selectFiltro.innerHTML = '<option value="">Todos os Setores</option>';
            
            abrirGestaoSetores();
        } catch (e) {
            console.error("Erro ao excluir setor:", e);
            Swal.fire('Erro', 'Não foi possível excluir o setor.', 'error');
        }
    }
}

// Aux de filtrarPorSetor - Garante que a mensagem de "vazio" apareça após o filtro
function verificarTabelaVazia() {
    const tbody = document.getElementById('almox-body');
    if (!tbody) return;

    const linhasVisiveis = Array.from(tbody.querySelectorAll('tr.linha-material'))
        .filter(tr => tr.style.display !== 'none');

    const avisoAntigo = document.getElementById('aviso-setor-vazio');
    if (avisoAntigo) avisoAntigo.remove();

    if (linhasVisiveis.length === 0) {
        const tr = document.createElement('tr');
        tr.id = 'aviso-setor-vazio';
        tr.innerHTML = `
            <td colspan="8" style="text-align:center; padding:60px; color:#64748b; background:#f8fafc;">
                <i class="fas fa-filter" style="display:block; font-size:2.5em; margin-bottom:15px; opacity:0.2;"></i>
                <b style="display:block;">Nenhum material encontrado neste setor.</b>
                <small>Tente mudar o filtro ou limpar a busca.</small>
            </td>`;
        tbody.appendChild(tr);
    }
}

//=== Mapeia a localização exata de cada unidade de um item ===//
async function verDetalhesItemAlmox(docId) {
    const palcoPrincipal = document.getElementById('container-tabela-principal');
    const palcoRastreio = document.getElementById('almox-rastreio-wrapper');
    const tbodyRastreio = document.getElementById('almox-rastreio-body');
    const theadRastreio = document.getElementById('almox-rastreio-thead');
    const breadcrumb = document.getElementById('almox-breadcrumb');

    if (!docId || !palcoPrincipal || !palcoRastreio) return;

    palcoPrincipal.style.display = 'none';
    palcoRastreio.style.display = 'block';

    tbodyRastreio.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:60px; color:#64748b;">
        <i class="fas fa-radar fa-spin fa-3x" style="opacity:0.3; margin-bottom:15px; display:block; width:100%;"></i>
        <span style="font-weight:600; letter-spacing:1px;">MAPEANDO LOGÍSTICA...</span>
    </td></tr>`;

    try {
        const docAlvo = await db.collection('inventario').doc(docId).get();
        if (!docAlvo.exists) throw new Error("Item não encontrado.");

        const itemData = docAlvo.data();
        const ehMulti = itemData.tipo === 'multi';
        const minhaUnidadeId = currentUserData.unidade_id;

        const [snapTombamentos, snapListas] = await Promise.all([
            db.collection('inventario').doc(docId).collection('tombamentos')
                .where('unidade_id', '==', minhaUnidadeId).get(),
            db.collection('listas_conferencia')
                .where('unidade_id', '==', minhaUnidadeId)
                .where('ativo', '==', true).get()
        ]);

        // 1. CACHE DE TRUGs (Nomes dos destinatários)
        const trugsParaBuscar = [];
        snapTombamentos.forEach(docV => {
            const v = docV.data();
            const idTrug = v.uid_cautela || (v.cautela ? v.cautela.id : null);
            if (idTrug && (v.situacao_atual || "").toUpperCase() === 'CAUTELADO' && !trugNamesCache[idTrug]) {
                trugsParaBuscar.push(idTrug);
            }
        });

        if (trugsParaBuscar.length > 0) {
            const docsTrug = await Promise.all([...new Set(trugsParaBuscar)].map(id => db.collection('cautelas_abertas').doc(id).get()));
            docsTrug.forEach(d => { if (d.exists) trugNamesCache[d.id] = d.data().destinatario; });
        }

        const mapaNomesListas = {};
        snapListas.forEach(l => { mapaNomesListas[l.id] = l.data().ativo_nome || "VTR S/N"; });

        if (breadcrumb) breadcrumb.innerHTML = `Almoxarifado <i class="fas fa-chevron-right" style="font-size:0.7em; margin:0 5px;"></i> Detalhes <i class="fas fa-chevron-right" style="font-size:0.7em; margin:0 5px;"></i> <b style="color:#800020;">${itemData.nome}</b>`;

        // ✅ CORREÇÃO: ADICIONA O BOTÃO DE HISTÓRICO GERAL NO CABEÇALHO PARA ITENS SINGLE
        const headerHtml = `
            <div id="header-detalhe-item" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding:15px; background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0;">
                <div>
                    <h2 style="margin:0; color:#1e293b; font-size:1.4em; font-weight:800;">${itemData.nome}</h2>
                    <small style="color:#64748b; font-weight:700; text-transform:uppercase;">Custódia Direta: ${currentUserData.unidade_sigla || 'N/D'}</small>
                </div>
                ${!ehMulti ? `
                    <button onclick="verHistoricoVidaAlmox('${docId}','${minhaUnidadeId}')" class="sigma-v3-tab" style="background:#800020; color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; font-weight:bold; transition: 0.3s;">
                        <i class="fas fa-history"></i> PRONTUÁRIO GERAL DO ITEM
                    </button>` : ''}
            </div>`;
        const oldHeader = document.getElementById('header-detalhe-item');
        if (oldHeader) oldHeader.remove();
        palcoRastreio.prepend(new DOMParser().parseFromString(headerHtml, 'text/html').body.firstChild);

        theadRastreio.innerHTML = `
            <tr style="background: #f1f5f9;">
                <th style="width: 25%;">IDENTIFICAÇÃO</th>
                <th style="width: 10%; text-align:center;">QTD</th>
                <th style="width: 15%; text-align:center;">STATUS</th>
                <th style="width: 20%;">SETOR / POSIÇÃO</th>
                <th style="width: 20%;">OBSERVAÇÕES / HISTÓRICO</th>
                <th style="width: 10%; text-align:right;">AÇÃO</th>
            </tr>`;

        const getObsHtml = (v, st) => {
            const dataAlt = v.atualizado_em || v.data_movimentacao || (v.cautela ? v.cautela.data : 'N/D');
            const responsavel = v.atualizado_por || 'N/D';

            if (st === 'PENDENTE') {
                return `<div style="color:#b91c1c; font-size:11px; line-height:1.4;">
                            <i class="fas fa-comment-dots"></i> <b>${v.motivo_pendencia || 'Avaria'}</b><br>
                            <i class="fas fa-user-edit"></i> ${responsavel}<br>
                            <i class="fas fa-calendar-alt"></i> ${dataAlt}
                        </div>`;
            } else if (st === 'CAUTELADO') {
                const idTrug = v.uid_cautela || (v.cautela ? v.cautela.id : 'VER TRUG');
                const recebedor = trugNamesCache[idTrug] || v.destinatario || (v.cautela ? v.cautela.destinatario : "Militar Identificado");
                return `<div style="color:#854d0e; font-size:11px; line-height:1.4;">
                            <i class="fas fa-file-signature"></i> <b onclick="showCautelaDetails('${idTrug}')" style="color:#800020; text-decoration:underline; cursor:pointer;">${idTrug}</b><br>
                            <i class="fas fa-user-tag" style="color:#b45309;"></i> <b>${recebedor}</b><br>
                            <i class="fas fa-calendar-check"></i> ${dataAlt}
                        </div>`;
            }
            return `<div style="color:#64748b; font-size:10px; line-height:1.3;">
                        <i class="fas fa-check-circle"></i> Operacional
                    </div>`;
        };

        const dataset = snapTombamentos.docs.map(d => d.data());
        const grupos = {};
        dataset.forEach(item => {
            const locID = item.viatura_id || "ALMOXARIFADO";
            if (!grupos[locID]) grupos[locID] = [];
            grupos[locID].push(item);
        });

        const localIDsOrdenados = Object.keys(grupos).sort((a, b) => {
            if (a === "ALMOXARIFADO") return -1;
            if (b === "ALMOXARIFADO") return 1;
            return a.localeCompare(b);
        });

        let htmlFinal = '';
        const btnStyle = "width:32px; height:32px; display:inline-flex; align-items:center; justify-content:center; border-radius:8px; border:none; cursor:pointer; color:white;";

        localIDsOrdenados.forEach(locID => {
            const itensDoGrupo = grupos[locID];
            const nomeLocal = locID === "ALMOXARIFADO" ? "📦 ALMOXARIFADO CENTRAL" : `🚒 ${mapaNomesListas[locID] || "VIATURA"}`;
            
            htmlFinal += `
                <tr style="background: #f8fafc; border-top: 3px solid #800020;">
                    <td colspan="6" style="padding: 12px 15px;">
                        <b style="color:#800020; font-size:0.9em; text-transform:uppercase; letter-spacing:1px;">${nomeLocal}</b>
                        <span style="margin-left:10px; background:#e2e8f0; color:#475569; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:800;">${itensDoGrupo.length} UNIDADES</span>
                    </td>
                </tr>`;

            itensDoGrupo.forEach(t => {
                const st = (t.situacao_atual || "DISPONÍVEL").toUpperCase();
                const corBadge = st === 'CAUTELADO' ? 'background:#fef9c3; color:#854d0e;' : 
                                 st === 'PENDENTE' ? 'background:#ffe4e6; color:#be123c;' :
                                 st === 'EM CARGA' ? 'background:#e0f2fe; color:#0369a1;' : 'background:#dcfce7; color:#15803d;';

                const identificacao = (t.tipo_rastreio === 'patrimonio' || ehMulti) ? 
                                      `<b>${t.tomb}</b>` : 
                                      `<b style="color:#94a3b8; font-size:0.85em; letter-spacing:0.5px;">ITEM DE CONSUMO</b>`;

                let botoesAcaoHtml = "";
                
                // ✅ CORREÇÃO: O Histórico individual SÓ aparece se for item patrimoniado (Multi)
                if (ehMulti) {
                    botoesAcaoHtml += `<button onclick="verHistoricoVidaIndiv('${docId}','${t.tomb}')" style="${btnStyle} background:#64748b; margin-right:4px;" title="Histórico Individual"><i class="fas fa-history"></i></button>`;
                }

                if (st !== 'CAUTELADO') {
                    if (st === 'PENDENTE') {
                        botoesAcaoHtml += `<button onclick='abrirGestaoPendencia(${JSON.stringify({docId: t.viatura_id || "ALMOX", virtualId: t.tomb, item: { id: docId, nome: itemData.nome }})})' style="${btnStyle} background:#800020;" title="Resolver"><i class="fas fa-gavel"></i></button>`;
                    } else if (st === 'EM CARGA') {
                        botoesAcaoHtml += `<button onclick="prepararMovimentacao('${docId}','RECOLHIMENTO','${ehMulti ? t.tomb : ''}','${t.viatura_id}')" style="${btnStyle} background:#f59e0b;" title="Recolher"><i class="fas fa-arrow-down"></i></button>`;
                    } else {
                        botoesAcaoHtml += `<button onclick="prepararMovimentacao('${docId}','ENVIO')" style="${btnStyle} background:#1b8a3e;" title="Enviar"><i class="fas fa-paper-plane"></i></button>`;
                    }
                }

                htmlFinal += `
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding-left:30px;">${identificacao}</td>
                        <td style="text-align:center; font-weight:800;">1</td>
                        <td style="text-align:center;">
                            <span style="padding:4px 10px; border-radius:4px; font-size:10px; font-weight:800; ${corBadge} display:inline-block; min-width:90px;">${st}</span>
                        </td>
                        <td style="color:#64748b; font-size:11px;">${t.sub_local || 'GERAL'}</td>
                        <td style="font-size:11px; padding: 8px 5px;">${getObsHtml(t, st)}</td>
                        <td style="text-align:right; white-space:nowrap; padding-right:15px;">${botoesAcaoHtml}</td>
                    </tr>`;
            });
        });

        tbodyRastreio.innerHTML = htmlFinal || `<tr><td colspan="6" style="text-align:center; padding:60px;">Nenhum item localizado.</td></tr>`;

    } catch (e) {
        console.error(e);
        tbodyRastreio.innerHTML = '<tr><td colspan="6" style="color:red; text-align:center; padding:40px;">Erro ao carregar mapeamento.</td></tr>';
    }
}

// ✅ FUNÇÃO COMPLEMENTAR PARA HISTÓRICO DE CONSUMO (SINGLE) NO ALMOX
async function verHistoricoVidaAlmox(docId, unidadeId) {
    Swal.fire({
        title: 'Mapeando Fluxo de Carga...',
        html: '<i class="fas fa-sync fa-spin fa-2x" style="color:#2c7399;"></i>',
        showConfirmButton: false,
        allowOutsideClick: false
    });

    try {
        // Busca na subcoleção de saldos da unidade (Padronizado V3)
        const snapHist = await db.collection('inventario')
            .doc(docId)
            .collection('saldos_unidades')
            .doc(unidadeId)
            .collection('historico_vida')
            .orderBy('data', 'desc')
            .get();

        if (snapHist.empty) {
            Swal.fire('Sem Registros', 'Nenhuma movimentação de carga registrada para esta unidade.', 'info');
            return;
        }

        // Armazena os dados globalmente para o motor de filtros
        dadosHistoricoTemp = snapHist.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Obtém o nome do item para o título (opcional, se tiver a variável global itemSendoVisualizado)
        const tituloDoc = itemSendoVisualizado ? itemSendoVisualizado.nome : "Material de Consumo";

        // Chama o renderizador profissional (Passando isSingle = true)
        renderizarModalHistoricoCompleto(tituloDoc, true);

    } catch (e) {
        console.error("Erro ao carregar histórico de almoxarifado:", e);
        Swal.fire('Erro', 'Falha ao processar linha do tempo de carga.', 'error');
    }
} 

//=== Consulta e exibe a linha do tempo (timeline) de eventos de um patrimônio específico através de um modal informativo ===//
async function verHistoricoVidaIndiv(docId, tombamentoId, isSingle = false, unidadeId = null) {
    Swal.fire({
        title: 'Mapeando Linha do Tempo...',
        html: '<div class="sigma-v3-loader"></div>',
        showConfirmButton: false,
        allowOutsideClick: false
    });

    try {
        let query;
        if (isSingle) {
            // Caminho para Item de Consumo
            query = db.collection('inventario').doc(docId)
                .collection('saldos_unidades').doc(unidadeId)
                .collection('historico_vida');
        } else {
            // Caminho para Patrimônio (Multi)
            query = db.collection('inventario').doc(docId)
                .collection('tombamentos').doc(tombamentoId)
                .collection('historico_vida');
        }

        const snapHist = await query.orderBy('data', 'desc').get();

        if (snapHist.empty) {
            Swal.fire('Sem Registros', 'Ainda não existem movimentações registradas para este item.', 'info');
            return;
        }

        // Armazena para os filtros
        dadosHistoricoTemp = snapHist.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        renderizarModalHistoricoCompleto(tombamentoId, isSingle);

    } catch (e) {
        console.error(e);
        Swal.fire('Erro', 'Falha ao processar rastreabilidade.', 'error');
    }
}

function renderizarModalHistoricoCompleto(titulo, isSingle) {
    const tiposEventos = [...new Set(dadosHistoricoTemp.map(d => d.evento))];
    
    let htmlFiltros = `
        <div style="background: #f1f5f9; padding: 15px; border-radius: 12px; margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
                <label style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 5px;">Filtrar por Tipo</label>
                <select id="filter-hist-tipo" onchange="aplicarFiltrosTimeline()" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 12px; font-weight: 600; color: #1e293b;">
                    <option value="TODOS">Todos os Eventos</option>
                    ${tiposEventos.map(t => `<option value="${t}">${t}</option>`).join('')}
                </select>
            </div>
            <div>
                <label style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 5px;">Período (Busca Rápida)</label>
                <input type="text" id="filter-hist-texto" oninput="aplicarFiltrosTimeline()" placeholder="Mês, ano ou palavra-chave..." style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 12px;">
            </div>
        </div>
        <div id="timeline-container-v3" style="max-height: 400px; overflow-y: auto; padding-right: 10px;">
            ${gerarHtmlTimeline(dadosHistoricoTemp, isSingle)}
        </div>
    `;

    Swal.fire({
        title: `<div style="text-align:left; line-height:1.2;">
                    <span style="font-size: 0.5em; color: #64748b; text-transform:uppercase; letter-spacing:1px;">Rastreabilidade de ${isSingle ? 'Carga' : 'Patrimônio'}</span><br>
                    <b style="color:#1e293b; font-size: 0.9em;">${titulo}</b>
                </div>`,
        html: htmlFiltros,
        width: '650px',
        showConfirmButton: true,
        confirmButtonText: 'FECHAR',
        confirmButtonColor: '#1e293b',
        customClass: { popup: 'sigma-v3-modal-rastreio' }
    });
}

function gerarHtmlTimeline(dados, isSingle) {
    if (dados.length === 0) return `<div style="text-align:center; padding:40px; color:#94a3b8;">Nenhum evento corresponde ao filtro.</div>`;

    const corEixo = isSingle ? '#2c7399' : '#800020';

    return `
        <div style="border-left: 3px solid #e2e8f0; margin-left: 15px; padding-left: 30px; position: relative; padding-top: 10px;">
            ${dados.map(h => {
                // Inteligência de Cores por Evento
                let corDestaque = corEixo;
                if(h.evento.includes("ESTORNO") || h.evento.includes("REMOVIDO")) corDestaque = "#e11d48"; // Vermelho
                if(h.evento.includes("APORTE") || h.evento.includes("ENTRADA")) corDestaque = "#10b981";  // Verde
                if(h.evento.includes("ALOCACAO") || h.evento.includes("ENVIO")) corDestaque = "#2c7399";   // Azul

                return `
                <div style="margin-bottom: 30px; position: relative;">
                    <div style="position: absolute; left: -38px; top: 2px; width: 14px; height: 14px; border-radius: 50%; background: ${corDestaque}; border: 3px solid #fff; box-shadow: 0 0 0 2px #e2e8f0;"></div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 11px; font-weight: 900; color: ${corDestaque}; text-transform: uppercase; letter-spacing: 0.5px;">${h.evento}</span>
                        <span style="font-size: 10px; color: #94a3b8; font-weight: 700; background: #f8fafc; padding: 2px 8px; border-radius: 6px; border: 1px solid #f1f5f9;">${h.data}</span>
                    </div>

                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
                        <p style="margin: 0; font-size: 13px; color: #334155; line-height: 1.6; font-weight: 500; white-space: pre-line;">${h.detalhes}</p>
                        
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 12px; padding-top: 10px; border-top: 1px dashed #f1f5f9;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="width: 26px; height: 26px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #64748b; border: 1px solid #e2e8f0;">
                                    <i class="fas fa-user-shield"></i>
                                </div>
                                <span style="font-size: 11px; color: #475569; font-weight: 700;">${h.quem || 'SISTEMA'}</span>
                            </div>
                            <span style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">${h.unidade || ''}</span>
                        </div>
                    </div>
                </div>`;
            }).join('')}
        </div>`;
}

// Função de Filtro (Executa no lado do cliente)
function aplicarFiltrosTimeline() {
    const tipo = document.getElementById('filter-hist-tipo').value;
    const busca = document.getElementById('filter-hist-texto').value.toUpperCase();
    const container = document.getElementById('timeline-container-v3');

    const filtrados = dadosHistoricoTemp.filter(d => {
        const matchesTipo = tipo === "TODOS" || d.evento === tipo;
        const matchesBusca = d.detalhes.toUpperCase().includes(busca) || 
                             d.data.toUpperCase().includes(busca) ||
                             d.quem.toUpperCase().includes(busca);
        return matchesTipo && matchesBusca;
    });

    container.innerHTML = gerarHtmlTimeline(filtrados, false); // isSingle aqui é visual
}

async function abrirConsultaGlobalEstoque(docId, tipo) {
    Swal.fire({
        title: 'Sincronizando Rede Estadual...',
        html: '<i class="fas fa-globe-americas fa-spin fa-2x" style="color:#2c7399;"></i>',
        showConfirmButton: false,
        width: '850px',
        allowOutsideClick: false
    });

    try {
        const uData = window.currentUserData || {};
        const minhaUnidadeId = String(uData.unidade_id || "").trim();
        const minhaSiglaLogada = String(uData.unidade_sigla || uData.sigla || "").trim().toUpperCase();

        const docSnap = await db.collection('inventario').doc(docId).get();
        if (!docSnap.exists) throw new Error("Item inexistente.");

        const cacheSaldos = docSnap.data().unidades_cache || {};
        const nomeMaterial = docSnap.data().nome;

        let tabelaHtml = `
            <div style="max-height: 450px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 12px;">
                <table style="width:100%; border-collapse: collapse; font-size: 0.9em; background:#fff;">
                    <thead style="position: sticky; top: 0; z-index: 10;">
                        <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1;">
                            <th style="text-align:left; padding:15px; color:#475569; font-size:0.75em; text-transform:uppercase;">Unidade / Diretoria</th>
                            <th style="text-align:center; padding:15px; color:#475569; font-size:0.75em; text-transform:uppercase;">Saldo Total</th>
                            <th style="text-align:center; padding:15px; color:#475569; font-size:0.75em; text-transform:uppercase;">Distribuição / Status</th>
                        </tr>
                    </thead>
                    <tbody>`;

        let encontrouExterno = false;

        Object.keys(cacheSaldos).sort().forEach(chaveId => {
            const s = cacheSaldos[chaveId];
            const siglaNoMapa = String(s.sigla || "").trim().toUpperCase();
            const totalUnidade = s.total || 0;

            if (siglaNoMapa === "CCI" || siglaNoMapa === minhaSiglaLogada || chaveId === minhaUnidadeId) return;
            if (totalUnidade <= 0) return;

            encontrouExterno = true;
            let statusHtml = "";

            if (s.disp === totalUnidade) {
                statusHtml = `<span style="background:#dcfce7; color:#15803d; padding:4px 10px; border-radius:12px; font-weight:800; font-size:0.8em;">DISPONÍVEL</span>`;
            } else {
                let partes = [];
                if (s.disp > 0) partes.push(`<b style="color:#10b981;">${s.disp}D</b>`);
                if (s.uso > 0) partes.push(`<b style="color:#475569;">${s.uso}VTR</b>`);
                if (s.uso_caut > 0) partes.push(`<b style="color:#f57c00;">${s.uso_caut}C</b>`);
                const pend = (s.pend || 0) + (s.uso_pend || 0);
                if (pend > 0) partes.push(`<b style="color:#e11d48;">${pend}P</b>`);
                statusHtml = partes.join(' <span style="color:#cbd5e1;">|</span> ');
            }

            // Se for multi, permite o clique para detalhar
            const acaoClick = tipo === 'multi' ? `onclick="detalharTombamentosUnidade('${docId}', '${chaveId}', '${siglaNoMapa}')" style="cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'"` : '';

            tabelaHtml += `
                <tr ${acaoClick}>
                    <td style="text-align:left; padding:15px; border-bottom:1px solid #f1f5f9;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <i class="fas fa-map-marker-alt" style="color:#cbd5e1;"></i>
                            <b style="color:#1e293b; font-size:1.05em;">${siglaNoMapa}</b>
                            ${tipo === 'multi' ? '<i class="fas fa-search-plus" style="font-size:0.7em; color:#2c7399; opacity:0.5;"></i>' : ''}
                        </div>
                    </td>
                    <td style="text-align:center; font-weight:900; color:#1e293b; border-bottom:1px solid #f1f5f9;">${totalUnidade} <small style="font-weight:600; color:#94a3b8;">un</small></td>
                    <td style="text-align:center; border-bottom:1px solid #f1f5f9;">${statusHtml}</td>
                </tr>`;
        });

        if (!encontrouExterno) {
            tabelaHtml += `<tr><td colspan="3" style="text-align:center; padding:80px; color:#94a3b8; background:#f8fafc;">
                <i class="fas fa-box-open" style="display:block; font-size:3em; margin-bottom:15px; opacity:0.2;"></i>
                <b style="display:block;">Nenhum saldo externo disponível.</b>
                <span style="font-size:0.85em;">Este material está concentrado apenas na sua unidade ou no CCI.</span>
            </td></tr>`;
        }

        tabelaHtml += '</tbody></table></div>';

        Swal.fire({
            title: `<div style="text-align:left; line-height:1.2;"><span style="font-size:0.6em; color:#64748b; text-transform:uppercase;">Mapa de Distribuição</span><br><b style="color:#800020;">${nomeMaterial}</b></div>`,
            html: tabelaHtml,
            width: '850px',
            confirmButtonText: 'FECHAR CONSULTA',
            confirmButtonColor: '#475569',
            customClass: { popup: 'sigma-v3-swal-border' }
        });

    } catch (e) {
        console.error("Erro no Mapa Global:", e);
        Swal.fire('Erro', 'Não foi possível mapear o estoque estadual.', 'error');
    }
}

async function detalharTombamentosUnidade(docId, unidadeId, siglaUnidade) {
    Swal.fire({
        title: `Acessando ${siglaUnidade}...`,
        didOpen: () => Swal.showLoading(),
        allowOutsideClick: false
    });

    try {
        const snap = await db.collection('inventario').doc(docId)
            .collection('tombamentos').where('local_id', '==', unidadeId).get();

        if (snap.empty) {
            Swal.fire('Info', 'Detalhes individuais não disponíveis para esta unidade.', 'info')
                .then(() => abrirConsultaGlobalEstoque(docId, 'multi'));
            return;
        }

        let listaHtml = `
            <div style="background:#f8fafc; padding:15px; border-radius:12px; border:1px solid #e2e8f0; max-height:400px; overflow-y:auto;">
            <ul style="text-align:left; font-family:'Courier New', monospace; columns: 2; column-gap: 30px; list-style:none; padding:0; margin:0;">`;

        snap.forEach(doc => {
            const t = doc.data();
            let corStatus = '#10b981';
            let textoStatus = 'DISP';

            if (t.situacao_atual === 'PENDENTE' || (t.pendencias_ids && t.pendencias_ids.length > 0)) {
                corStatus = '#b91c1c'; textoStatus = 'PEND';
            } else if (t.situacao_atual === 'CAUTELADO') {
                corStatus = '#f59e0b'; textoStatus = 'CAUT';
            } else if (t.situacao_atual === 'EM USO') {
                corStatus = '#475569'; textoStatus = 'VTR';
            }

            listaHtml += `
                <li style="margin-bottom:8px; border-bottom:1px solid #e2e8f0; padding-bottom:4px; break-inside: avoid; display:flex; justify-content:space-between; align-items:center;">
                    <span><i class="fas fa-tag" style="color:#cbd5e1; font-size:0.8em; margin-right:5px;"></i><b>${t.tomb}</b></span>
                    <span style="color:${corStatus}; font-weight:900; font-size:0.75em; background:${corStatus}10; padding:2px 6px; border-radius:4px;">${textoStatus}</span>
                </li>`;
        });
        listaHtml += `</ul></div>`;

        Swal.fire({
            title: `<div style="text-align:left;"><span style="font-size:0.6em; color:#64748b; text-transform:uppercase;">Patrimônios em</span><br><b style="color:#1e293b;">${siglaUnidade}</b></div>`,
            html: listaHtml,
            width: '700px',
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-arrow-left"></i> VOLTAR',
            cancelButtonText: 'FECHAR TUDO',
            confirmButtonColor: '#2c7399',
            reverseButtons: true
        }).then((result) => {
            if (result.isConfirmed) {
                abrirConsultaGlobalEstoque(docId, 'multi');
            }
        });

    } catch (e) {
        console.error("Erro no Drill-down:", e);
        Swal.fire('Erro', 'Falha ao detalhar unidade.', 'error');
    }
}

//=== Algoritmo Central de Inteligência de Estoque: Converte dados brutos do Firestore na Matriz de 7 Estados Operacionais ===//
function calcularMatrizEstoque(dadosBrutos, tipo = 'single') {
    // Objeto de retorno: A Matriz de 7 Estados (Essencial para os cards e tabelas)
    const matriz = {
        almox: { disp: 0, pend: 0, caut: 0 },
        vtr: { ok: 0, pend: 0, caut: 0, tot: 0 },
        totalGeral: 0
    };

    if (!dadosBrutos) return matriz;

    if (tipo === 'single') {
        const s = dadosBrutos;

        // 1. Definição de Totais (Âncoras de cálculo)
        matriz.totalGeral = Number(s.qtd_total || 0);
        const totalEmVtr = Number(s.qtd_em_carga || 0); // O que está assinado para viaturas
        const totalNoAlmox = matriz.totalGeral - totalEmVtr;

        // 2. Processamento da Viatura
        matriz.vtr.tot = totalEmVtr;
        matriz.vtr.pend = Number(s.qtd_pend_vtr || s.qtd_pend || 0); // Pendências físicas na VTR
        matriz.vtr.caut = Number(s.qtd_caut_vtr || 0); // Itens que saíram da VTR para alguém
        matriz.vtr.ok = Math.max(0, matriz.vtr.tot - matriz.vtr.pend - matriz.vtr.caut);

        // 3. Processamento do Almoxarifado (Físico na prateleira)
        matriz.almox.caut = Number(s.qtd_caut_almox || s.qtd_caut || 0); // Cautelas diretas do balcão
        matriz.almox.pend = Number(s.qtd_pend_almox || 0); // Itens avariados no estoque
        // O disponível real é o que sobrou no almoxarifado tirando cautelas e pendências
        matriz.almox.disp = Math.max(0, totalNoAlmox - matriz.almox.caut - matriz.almox.pend);

        // Ajuste de fallback: Se o campo qtd_disp vier pronto do banco, usamos ele
        if (s.qtd_disp !== undefined) matriz.almox.disp = Number(s.qtd_disp);
    }

    else if (tipo === 'multi') {
        // Para itens patrimoniados (Array de documentos de tombamento)
        const listaTombamentos = Array.isArray(dadosBrutos) ? dadosBrutos : [];

        listaTombamentos.forEach(t => {
            matriz.totalGeral++;

            // Flags de estado
            const ehAvariado = (t.pendencias_ids && t.pendencias_ids.length > 0) || t.situacao_atual === 'AVARIADO' || t.situacao_atual === 'PENDENTE';
            const ehCautelado = !!t.cautela_id || !!t.cautela || t.situacao_atual === 'CAUTELADO';
            const estaEmVtr = !!t.viatura_id || !!t.viatura_nome || t.situacao_atual === 'EM USO';

            if (estaEmVtr) {
                matriz.vtr.tot++;
                if (ehAvariado) matriz.vtr.pend++;
                else if (ehCautelado) matriz.vtr.caut++;
                else matriz.vtr.ok++;
            } else {
                // Fluxo Almoxarifado
                if (ehAvariado) matriz.almox.pend++;
                else if (ehCautelado) matriz.almox.caut++;
                else matriz.almox.disp++;
            }
        });
    }

    return matriz;
}

//=== Orquestrador de Interface para Fluxos de Movimentação: Prepara e valida a saída ou o retorno de materiais (Almox ↔ Viatura ou Unidade) ===//
async function prepararMovimentacao(docId, operacao, tombamento = null, viaturaId = null) {
    // 1. Metadados do Inventário Global
    const docAlvo = await db.collection('inventario').doc(docId).get();
    if (!docAlvo.exists) return Swal.fire("Erro", "Material não localizado.", "error");

    const itemData = docAlvo.data();
    const ehMulti = itemData.tipo === 'multi';
    const role = currentUserData.role;
    const souAdmin = (role === 'admin' || role === 'gestor_geral');

    // ✅ INTERCEPTAÇÃO DE ENVIO
    if (operacao === 'ENVIO' && itemData.is_anfitriao && !souAdmin) {
        return abrirModalAcoplamentoAnfitriao(docId, itemData, tombamento);
    }

    const config = {
        ENVIO: { titulo: "Enviar para Viatura", cor: "#2c7399", icone: "fa-paper-plane", btnTexto: "CONFIRMAR ENVIO" },
        RECOLHIMENTO: { titulo: "Recolher para Almoxarifado", cor: "#f57c00", icone: "fa-arrow-down", btnTexto: "CONFIRMAR RECOLHIMENTO" }
    }[operacao];

    let htmlAreaKit = "";
    if (operacao === 'RECOLHIMENTO' && itemData.is_anfitriao) {
        htmlAreaKit = `
            <div id="area-recolhimento-kit" style="margin-bottom: 15px; background: #fff5f5; border: 1px solid #feb2b2; padding: 12px; border-radius: 8px;">
                <div style="font-size: 0.8em; color: #c53030; font-weight: 800; margin-bottom: 8px; text-transform: uppercase;">
                    <i class="fas fa-boxes"></i> Composição do Conjunto
                </div>
                <div id="lista-acessorios-recolhimento" style="display: grid; gap: 4px;">
                    <span style="font-size:0.75em; color:#94a3b8;">Mapeando componentes internos...</span>
                </div>
            </div>`;
    }

    Swal.fire({
        title: `<i class="fas ${config.icone}"></i> ${config.titulo}`,
        width: '600px',
        html: `
            <div style="text-align: left; padding: 5px;">
                ${htmlAreaKit}
                <div class="summary-item-modal" style="background:#f8fafc; padding:10px; border-radius:8px; margin-bottom:15px; border-left:4px solid ${config.cor};">
                    <small style="color:#64748b; font-weight:700; text-transform:uppercase; font-size:0.7em;">Material Selecionado</small>
                    <div style="font-weight:800; color:#1e293b; font-size:1.1em;">${itemData.nome}</div>
                    <small style="color:${config.cor}; font-weight:800; text-transform:uppercase;">${itemData.tipo}</small>
                </div>
                <div class="form-group">
                    <label style="font-size: 0.85em; font-weight:bold; color:#800020;">DESTINO:</label>
                    <select id="swal-mov-destino" class="swal2-select" style="width: 100%; margin: 10px 0;"></select>
                </div>
                <div class="form-group" style="margin-top:15px;">
                    <label style="font-size: 0.85em; font-weight:bold; color:#800020;">IDENTIFICAÇÃO / QTD EM CARGA:</label>
                    <div id="container-mov-dinamico" style="margin-top:10px; min-height:40px;"></div>
                </div>
                <div class="form-group" style="margin-top:15px;">
                    <label style="font-size: 0.85em; font-weight:bold; color:#800020;">JUSTIFICATIVA:</label>
                    <textarea id="swal-mov-obs" class="swal2-textarea" style="width: 100%; margin: 10px 0; height: 70px;" placeholder="Obrigatório..."></textarea>
                </div>
            </div>`,
        showCancelButton: true,
        confirmButtonText: config.btnTexto,
        confirmButtonColor: config.cor,
        didOpen: async () => {
            const container = document.getElementById('container-mov-dinamico');
            const listaFilhosUI = document.getElementById('lista-acessorios-recolhimento');
            await popularDestinosMovimentacao(souAdmin, operacao, viaturaId);

            // ✅ 1. ACESSO À LISTA FÍSICA
            const vtrSnap = await db.collection('listas_conferencia').doc(viaturaId).get();
            if (!vtrSnap.exists) return container.innerHTML = "Erro ao carregar viatura.";
            
            const vtrData = vtrSnap.data();
            let itemNaLista = null;

            // Busca o item em qualquer setor
            vtrData.list.forEach(setor => {
                const achou = setor.itens.find(it => (it.uid_global || it.id) === docId);
                if (achou) itemNaLista = achou;
            });

            if (!itemNaLista) return container.innerHTML = "Material não encontrado na carga.";

            // ✅ 2. FUNÇÃO DE RENDERIZAÇÃO DE ACESSÓRIOS (LEITURA INTERNA)
            const exibirAcessoriosAninhados = (objItem) => {
    if (!listaFilhosUI) return;
    const filhos = objItem.acessorios_vinculados || [];

    if (filhos.length === 0) {
        listaFilhosUI.innerHTML = `<div style="padding:10px; color:#94a3b8; font-size:0.75em; text-align:center;">Nenhum componente vinculado.</div>`;
    } else {
        let html = `
            <label style="font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom:5px; display:block;">
                Componentes Internos do Kit:
            </label>`;
        
        filhos.forEach(f => {
            html += `
                <div style="display:flex; align-items:center; justify-content:space-between; background:#fff; padding:6px 10px; border-radius:6px; border:1px solid #e2e8f0; font-size:0.8em; margin-top:2px;">
                    <span><i class="fas fa-microchip" style="color:#2c7399; font-size:0.7em;"></i> <b>${f.nome}</b></span>
                    <b style="color:#1e293b;">${f.quantidade} un</b>
                </div>`;
        });

        // ✅ INSERÇÃO DO INFORMATIVO DE DESMEMBRAMENTO
        html += `
            <div style="margin-top: 12px; padding: 10px; background: #ebf8ff; border: 1px solid #bee3f8; border-radius: 8px; display: flex; gap: 10px; align-items: center;">
                <i class="fas fa-info-circle" style="color: #2b6cb0; font-size: 1.2em;"></i>
                <div style="font-size: 0.75em; color: #2c5282; line-height: 1.3;">
                    <b>AVISO:</b> Por se tratar de um item anfitrião de um kit, o recolhimento <b>obrigatoriamente</b> irá retornar ao Almoxarifado os acessórios acima listados.
                </div>
            </div>`;

        listaFilhosUI.innerHTML = html;
    }
};

            // ✅ 3. LÓGICA POR TIPO DE CONTROLE
            if (ehMulti) {
                let htmlTombs = "";
                itemNaLista.tombamentos.forEach(t => {
                    htmlTombs += `
                        <div style="margin-bottom:6px; display:flex; align-items:center; background:#f1f5f9; padding:8px; border-radius:6px;">
                            <input type="checkbox" class="swal-tomb-check" value="${t.tomb}" checked style="width:18px; height:18px;">
                            <label style="margin-left:10px; font-weight:800; color:#1e293b; flex:1;">${t.tomb}</label>
                        </div>`;
                });
                container.innerHTML = htmlTombs;
                if (itemData.is_anfitriao) exibirAcessoriosAninhados(itemNaLista);
            } else {
                const saldo = Number(itemNaLista.quantidadeEsperada || 0);
                container.innerHTML = `
                    <div style="display:flex; align-items:center; gap:15px; background:white; padding:12px; border-radius:10px; border:1px solid #e2e8f0;">
                        <input type="number" id="swal-mov-qtd" class="swal2-input" value="1" min="1" max="${saldo}" style="width:80px; margin:0; text-align:center; font-weight:900; border:2px solid ${config.cor};">
                        <span style="font-size:0.9rem; font-weight:800; color:${config.cor};">${saldo} un. em carga</span>
                    </div>`;
                if (itemData.is_anfitriao) exibirAcessoriosAninhados(itemNaLista);
            }
        },
        preConfirm: () => {
            const destino = document.getElementById('swal-mov-destino').value;
            const obs = document.getElementById('swal-mov-obs').value.trim();
            if (!destino || !obs) return Swal.showValidationMessage('Preencha destino e observação');

            let movData = { destinoId: destino, observacao: obs, origemVtrId: viaturaId, isAnfitriao: itemData.is_anfitriao || false };

            if (ehMulti) {
                const checks = document.querySelectorAll('.swal-tomb-check:checked');
                if (checks.length === 0) return Swal.showValidationMessage('Selecione o item');
                movData.tombamentos = Array.from(checks).map(cb => cb.value);
                movData.quantidade = checks.length;
            } else {
                movData.quantidade = parseInt(document.getElementById('swal-mov-qtd').value);
            }
            return movData;
        }
    }).then((result) => {
        if (result.isConfirmed) executarMovimentacaoReal(docId, operacao, result.value);
    });
}

//=== Orquestrador de Montagem de Kits: Gerencia a vinculação dinâmica de acessórios a um item principal (Anfitrião) antes da movimentação ===//
async function abrirModalAcoplamentoAnfitriao(docId, itemData, tombamentoAlvo = null, setorDestinoIdx = null) {
    const minhaUnidadeId = currentUserData.unidade_id;
    const elEditor = document.getElementById('view-editor-arquitetura');
    const isNoEditor = elEditor && elEditor.style.display === 'block';
    
    // --- MAPEAMENTO DE RASCUNHOS (SIMETRIA V3) ---
    const mapaRascunhos = {};
    if (isNoEditor) {
        arquiteturaAtiva.forEach(s => (s.itens || []).forEach(it => {
            if (it.isNovoRascunho) {
                const uid = it.uid_global;
                const qtd = Number(it.quantidadeEsperada) || 0;
                mapaRascunhos[uid] = (mapaRascunhos[uid] || 0) + qtd;
                
                const accs = it.acessorios_vinculados || it.acessorios_acoplados || [];
                accs.forEach(ac => {
                    const uidF = ac.uid_global || ac.id;
                    mapaRascunhos[uidF] = (mapaRascunhos[uidF] || 0) + (Number(ac.quantidade) * qtd);
                });
            }
        }));
    }

    const isSingle = itemData.tipo !== 'multi';

    Swal.fire({
        title: 'Montagem de Kit / Acoplamento',
        width: '650px',
        html: `
            <div style="text-align: left; padding: 5px;">
                <div style="background: #fff8e1; padding: 15px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #ffe0b2;">
                    <small style="color: #e65100; font-weight: 800; text-transform: uppercase; font-size: 0.7em;">Item Anfitrião Identificado</small>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-weight: 800; color: #333; font-size: 1.2em;">
                            <i class="fas fa-box-open" style="margin-right:8px; color:#e65100;"></i>
                            ${itemData.nome} ${tombamentoAlvo ? `<span style="color:#800020;">[${tombamentoAlvo}]</span>` : ''}
                        </div>
                        ${isSingle ? `
                            <div style="text-align:right;">
                                <label style="display:block; font-size:0.65em; font-weight:800; color:#e65100;">QTD KITS</label>
                                <input type="number" id="qtd-anfitriao-kit" value="1" min="1" 
                                    style="width: 70px; height: 35px; text-align: center; font-weight: 800; border: 2px solid #e65100; border-radius: 6px;">
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div id="container-acoplamento-dinamico" style="min-height: 100px;">
                    <div style="text-align:center; padding:20px;">
                        <i class="fas fa-circle-notch fa-spin fa-2x" style="color:#2c7399;"></i>
                        <p style="margin-top:10px; font-weight:600; color:#64748b;">Mapeando acessórios disponíveis em estoque...</p>
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'CONFIRMAR COMPOSIÇÃO',
        confirmButtonColor: '#1b8a3e',
        cancelButtonText: 'CANCELAR',
        didOpen: async () => {
            const container = document.getElementById('container-acoplamento-dinamico');
            const regras = itemData.componentes_regra || [];
            let htmlComponentes = "";

            if (regras.length === 0) {
                container.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:20px;">Nenhuma regra definida para este Kit.</div>`;
                return;
            }

            for (const regra of regras) {
                // ✅ CORREÇÃO DO UNDEFINED: Fallback para múltiplos nomes de campo e proteção contra nulos
                const familiaNomeRaw = regra.nome_familia || regra.nome || regra.familia || "";
                const familiaNome = familiaNomeRaw.toString().trim();
                
                if (!familiaNome) {
                    console.warn("⚠️ Regra de kit com nome ausente ignorada:", regra);
                    continue; 
                }

                // ✅ BUSCA V3: Localiza itens da linhagem dentro da coleção única 'inventario'
                const snapEstoque = await db.collection('inventario')
                    .where('familia_nome', '==', familiaNome)
                    .get();

                let optionsItens = `<option value="">Não acoplar ${familiaNome}</option>`;
                let temDisponivel = false;

                for (const docIt of snapEstoque.docs) {
                    const itGlobal = docIt.data();
                    const saldoDoc = await docIt.ref.collection('saldos_unidades').doc(minhaUnidadeId).get();

                    if (saldoDoc.exists) {
                        const s = saldoDoc.data();
                        const disponivelNoBanco = Number(s.disp || 0); 
                        const rascunhado = mapaRascunhos[docIt.id] || 0;
                        const saldoReal = disponivelNoBanco - rascunhado;

                        if (saldoReal > 0) {
                            temDisponivel = true;
                            optionsItens += `<option value="${docIt.id}" data-nome="${itGlobal.nome}">${itGlobal.nome} (Disp: ${saldoReal})</option>`;
                        }
                    }
                }

                htmlComponentes += `
                    <div class="linha-acoplamento" style="margin-bottom: 12px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
                        <label style="display:block; font-weight:800; font-size:0.75em; color:#475569; text-transform:uppercase; margin-bottom:8px;">
                            <i class="fas fa-link"></i> ACESSÓRIO: ${familiaNome}
                        </label>
                        <div style="display:flex; gap:10px;">
                            <select class="swal2-select select-item-acoplar" style="flex:3; margin:0; font-size:0.9em; height: 42px; border-radius:6px;">
                                ${temDisponivel ? optionsItens : `<option value="">⚠️ Sem saldo real em prateleira</option>`}
                            </select>
                            <input type="number" class="swal2-input input-qtd-acoplar" 
                                value="${temDisponivel ? (regra.qtd_sugerida || 1) : 0}" min="1" 
                                style="flex:1; margin:0; height:42px; font-size:0.9em; text-align:center; border-radius:6px;" ${!temDisponivel ? 'disabled' : ''}>
                        </div>
                    </div>`;
            }
            container.innerHTML = htmlComponentes || `<div style="text-align:center; padding:20px;">Linhagens não identificadas no cadastro do kit.</div>`;
        },
        preConfirm: () => {
            const acoplados = [];
            const linhas = document.querySelectorAll('.linha-acoplamento');
            const elQtdKits = document.getElementById('qtd-anfitriao-kit');
            const qtdKits = elQtdKits ? (parseInt(elQtdKits.value) || 1) : 1;

            linhas.forEach(linha => {
                const select = linha.querySelector('.select-item-acoplar');
                const input = linha.querySelector('.input-qtd-acoplar');
                if (select && select.value) {
                    const optionSelecionada = select.options[select.selectedIndex];
                    acoplados.push({
                        uid_global: select.value,
                        nome: optionSelecionada.getAttribute('data-nome'),
                        quantidade: parseInt(input.value) || 0,
                        tipo_controle: 'single'
                    });
                }
            });
            return { acoplados, qtdKits };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const { acoplados, qtdKits } = result.value;

            if (isNoEditor) {
                itemSelecionadoTemp = {
                    ...itemData,
                    id_almox: docId,
                    tombamentoExibicao: tombamentoAlvo,
                    quantidadeEsperada: qtdKits,
                    acessorios_vinculados: acoplados,
                    acessorios_ja_montados: true
                };

                exibirDraftCard(`${qtdKits}x ${itemData.nome} (+${acoplados.length} comp.)`);

                if (setorDestinoIdx !== null) {
                    executarInsercaoNoSetor(setorDestinoIdx);
                }
            } else {
                executarMovimentacaoAnfitriao(docId, 'ENVIO', {
                    tombamento: tombamentoAlvo,
                    acessorios: acoplados,
                    quantidade: qtdKits
                });
            }
        }
    });
}

//=== Finaliza a montagem do item e o insere fisicamente na arquitetura de carga da viatura no Editor ===//
function executarInsercaoNoSetor(setorIdx) {
    // 0. TRAVA DE SEGURANÇA
    if (!itemSelecionadoTemp) return;

    // 1. IDENTIDADE ÚNICA E NORMALIZAÇÃO V3
    const uidBase = itemSelecionadoTemp.uid_global || itemSelecionadoTemp.id;
    const tombamento = itemSelecionadoTemp.tombamentoExibicao || "";
    const tipoItem = String(itemSelecionadoTemp.tipo || '').toLowerCase();
    
    // ✅ PADRÃO V3: Garantimos que 'consumo' seja tratado como 'single' sistematicamente
    const isSingle = (tipoItem === 'single' || tipoItem === 'consumo');

    // AJUSTE PARA MESCLAGEM: Kits precisam de prefixo único para não mesclarem com itens soltos
    const prefixo = itemSelecionadoTemp.is_anfitriao ? "KIT_" : "TEMP_";
    
    // UID de Instância: O que diferencia uma linha da outra no editor
    const uidInstancia = (!isSingle) 
        ? `${uidBase}-${tombamento}` 
        : `${prefixo}${uidBase}`;

    // Captura a quantidade exata definida no Popover ou Modal
    const qtdInserida = isSingle ? Number(
        itemSelecionadoTemp.quantidadeChosen || 
        itemSelecionadoTemp.quantidadeEsperada || 
        1
    ) : 1;

    // Criamos o objeto que entrará no array 'arquiteturaAtiva'
    const novoItem = {
        id: uidBase,
        uid_global: uidBase,
        uid_instancia: uidInstancia,
        nome: itemSelecionadoTemp.nome,
        tipo: isSingle ? 'single' : 'multi', // Normaliza tipo para o banco
        categoria: itemSelecionadoTemp.categoria || "DIVERSOS",
        is_anfitriao: itemSelecionadoTemp.is_anfitriao || false,
        isNovoRascunho: true, // Flag vital para a transição de saldo no futuro
        quantidadeEsperada: qtdInserida,
        // ✅ CONTROLE DE ALMOXARIFADO: 
        // Esta variável diz: "Quando salvar, tire exatamente ISSO do estoque"
        quantidadeNoRascunho: isSingle ? qtdInserida : 0 
    };

    // 2. PADRONIZAÇÃO DE ACESSÓRIOS (DNA do Kit)
    const acessoriosOrigem = itemSelecionadoTemp.acessorios_vinculados ||
                             itemSelecionadoTemp.acessorios_acoplados ||
                             itemSelecionadoTemp.componentes_regra;

    if (novoItem.is_anfitriao && acessoriosOrigem) {
        novoItem.acessorios_vinculados = JSON.parse(JSON.stringify(acessoriosOrigem)).map(ac => ({
            ...ac,
            uid_global: ac.uid_global || ac.id || ac.familia_uid,
            nome: ac.nome || ac.nome_familia,
            quantidade: Number(ac.quantidade || ac.qtd_sugerida || 1),
            vinculo_pai: uidInstancia // Amarra o filho ao pai
        }));
    }

    // 3. DEFINE DADOS DE PATRIMÔNIO (MULTI)
    if (!isSingle) {
        novoItem.tombamentos = [{
            tomb: tombamento,
            situacao_atual: "EM CARGA", // Padrão V3
            uid_global: uidBase,
            data_entrada: new Date().toLocaleString('pt-BR')
        }];
        novoItem.quantidadeNoRascunho = 0; // Multi não usa contador de rascunho, usa o array de tombamentos
    }

    // 4. VALIDAÇÃO DE DESTINO
    if (!arquiteturaAtiva[setorIdx]) {
        console.error("❌ Setor de destino inválido.");
        return;
    }
    
    if (!arquiteturaAtiva[setorIdx].itens) arquiteturaAtiva[setorIdx].itens = [];

    // Verificação de duplicidade física (Patrimônios)
    const jaExiste = arquiteturaAtiva[setorIdx].itens.some(it => it.uid_instancia === uidInstancia);
    if (jaExiste && !isSingle) {
        Swal.fire('Atenção', `O patrimônio [${tombamento}] já consta neste setor.`, 'warning');
        return;
    }

    // 5. INSERÇÃO E CONSOLIDAÇÃO
    arquiteturaAtiva[setorIdx].itens.push(novoItem);
    
    // A mágica acontece aqui: se for single, ele soma as quantidades na mesma linha
    if (typeof processarMesclagemAutomatica === 'function') {
        processarMesclagemAutomatica(setorIdx);
    }

    // 6. RENDERIZAÇÃO E FEEDBACK
    if (typeof marcarAlteracao === 'function') marcarAlteracao(); 
    renderizarArquiteturaEditor();

    // 7. LIMPEZA DE ESTADO (UI Cleanup)
    cancelarRascunho(); 

    // Fecha elementos flutuantes
    const popover = document.getElementById('popover-qtd-editor');
    if (popover) popover.style.display = 'none';
}

//=== Orquestrador Atômico de Movimentação de Kits: Sincroniza o Item Anfitrião e todos os seus Acessórios em uma única transação ===//
async function executarMovimentacaoAnfitriao(uidAnfitriao, operacao, dadosKit) {
    const { tombamento, acessorios, quantidade } = dadosKit;
    const qtdLote = Number(quantidade) || 1;
    
    const minhaUnidadeId = currentUserData.unidade_id;
    const minhaUnidadeSigla = currentUserData.unidade_sigla || "UNID";
    const dataReg = new Date().toLocaleString('pt-BR');
    const autor = currentUserData.nome_militar_completo;

    // 1. Definição de Destino via UI
    const { value: formValues } = await Swal.fire({
        title: '<span style="color: #1e293b;">Destino do Conjunto</span>',
        width: '500px',
        html: `
        <div style="text-align: left; margin-top: 15px;">
            <label style="font-size: 0.75em; font-weight: 800; color: #64748b; text-transform: uppercase;">1. Viatura / Destino Alvo:</label>
            <select id="swal-destino-kit" class="swal2-select" style="width: 100%; height: 45px; margin: 8px 0 20px 0;"></select>
            <label style="font-size: 0.75em; font-weight: 800; color: #64748b; text-transform: uppercase;">2. Setor de Carga Disponível:</label>
            <select id="swal-setor-kit" class="swal2-select" style="width: 100%; height: 45px; margin: 8px 0 5px 0;" disabled>
                <option value="">Selecione a viatura primeiro...</option>
            </select>
        </div>`,
        didOpen: () => {
            const selectVtr = document.getElementById('swal-destino-kit');
            const selectSetor = document.getElementById('swal-setor-kit');
            popularDestinosMovimentacao(false, 'ENVIO');

            selectVtr.addEventListener('change', async (e) => {
                const vtrId = e.target.value;
                if (!vtrId) return;
                const docVtr = await db.collection('listas_conferencia').doc(vtrId).get();
                if (docVtr.exists) {
                    const setores = docVtr.data().list || [];
                    selectSetor.innerHTML = setores.map(s => `<option value="${s.nome}">${s.nome}</option>`).join('');
                    selectSetor.disabled = false;
                }
            });
        },
        preConfirm: () => {
            const d = document.getElementById('swal-destino-kit').value;
            const s = document.getElementById('swal-setor-kit').value;
            if (!d || !s) return Swal.showValidationMessage('Selecione viatura e setor!');
            return { destinoId: d, setorId: s };
        }
    });

    if (!formValues) return;

    Swal.fire({ title: 'Preparando Kit...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        // --- BLOCO PRE-TRANSACTION (QUERIES) ---
        // Firestore não permite .where() dentro de transaction. Temos que buscar os UIDs antes.
        
        const anfitriaoRef = db.collection('inventario').doc(uidAnfitriao);
        let uidsAnfitriaoProcessar = [];

        // Se o anfitrião for SINGLE, buscamos os V-UIDs disponíveis
        if (!tombamento) {
            const snapAnf = await anfitriaoRef.collection('tombamentos')
                .where('unidade_id', '==', minhaUnidadeId)
                .where('situacao_atual', '==', 'DISPONÍVEL')
                .limit(qtdLote).get();
            if (snapAnf.size < qtdLote) throw new Error("Saldo de Anfitriões insuficiente no rastreio físico.");
            uidsAnfitriaoProcessar = snapAnf.docs.map(d => d.id);
        } else {
            uidsAnfitriaoProcessar = [tombamento];
        }

        const dadosAcessoriosFinal = [];
        for (const ac of acessorios) {
            const necessita = (Number(ac.quantidade) || 1) * qtdLote;
            const acRef = db.collection('inventario').doc(ac.uid_global);
            
            const snapAc = await acRef.collection('tombamentos')
                .where('unidade_id', '==', minhaUnidadeId)
                .where('situacao_atual', '==', 'DISPONÍVEL')
                .limit(necessita).get();

            if (snapAc.size < necessita) throw new Error(`Saldo insuficiente para o acessório: ${ac.nome}`);
            
            dadosAcessoriosFinal.push({
                uid_global: ac.uid_global,
                nome: ac.nome,
                quantidadeUnitária: Number(ac.quantidade),
                uidsFisicos: snapAc.docs.map(d => d.id)
            });
        }

        // --- INÍCIO DA TRANSAÇÃO ATÔMICA ---
        await db.runTransaction(async (transaction) => {
            const vtrRef = db.collection('listas_conferencia').doc(formValues.destinoId);
            const vtrSnap = await transaction.get(vtrRef);
            const vtrData = vtrSnap.data();

            // 1. Atualizar Documentos Físicos do Anfitrião
            uidsAnfitriaoProcessar.forEach((uId, index) => {
                const refTomb = anfitriaoRef.collection('tombamentos').doc(uId);
                const idVinculoUnico = uId; // Este ID será o 'pai' dos acessórios deste kit específico

                transaction.update(refTomb, {
                    situacao_atual: "EM CARGA",
                    local_id: "VIATURA",
                    viatura_id: formValues.destinoId,
                    setor_id: formValues.setorId,
                    data_movimentacao: dataReg,
                    atualizado_por: autor
                });

                // 2. Distribuir acessórios para este Anfitrião específico (Lógica de Split)
                dadosAcessoriosFinal.forEach(acGroup => {
                    // Pega a fatia de acessórios destinada a este pai específico
                    const inicio = index * acGroup.quantidadeUnitária;
                    const fim = inicio + acGroup.quantidadeUnitária;
                    const meusFilhos = acGroup.uidsFisicos.slice(inicio, fim);

                    meusFilhos.forEach(fUid => {
                        const fRef = db.collection('inventario').doc(acGroup.uid_global).collection('tombamentos').doc(fUid);
                        transaction.update(fRef, {
                            situacao_atual: "EM CARGA",
                            local_id: "VIATURA",
                            viatura_id: formValues.destinoId,
                            vinculo_pai_tomb: idVinculoUnico, // ✅ O CARIMBO PARA O RECOLHIMENTO FUNCIONAR
                            data_movimentacao: dataReg
                        });
                    });
                });
            });

            // 3. Atualizar Saldos e Cache (Anfitrião)
            const anfitriaoSaldoRef = anfitriaoRef.collection('saldos_unidades').doc(minhaUnidadeId);
            transaction.update(anfitriaoSaldoRef, {
                disp: firebase.firestore.FieldValue.increment(-qtdLote),
                uso: firebase.firestore.FieldValue.increment(qtdLote),
                last_update: dataReg
            });
            transaction.update(anfitriaoRef, {
                [`unidades_cache.${minhaUnidadeId}.disp`]: firebase.firestore.FieldValue.increment(-qtdLote),
                [`unidades_cache.${minhaUnidadeId}.uso`]: firebase.firestore.FieldValue.increment(qtdLote)
            });

            // 4. Atualizar Saldos e Cache (Acessórios)
            for (const ac of dadosAcessoriosFinal) {
                const totalSair = ac.uidsFisicos.length;
                const itemAcRef = db.collection('inventario').doc(ac.uid_global);
                const saldoAcRef = itemAcRef.collection('saldos_unidades').doc(minhaUnidadeId);

                transaction.update(saldoAcRef, {
                    disp: firebase.firestore.FieldValue.increment(-totalSair),
                    uso: firebase.firestore.FieldValue.increment(totalSair),
                    last_update: dataReg
                });
                transaction.update(itemAcRef, {
                    [`unidades_cache.${minhaUnidadeId}.disp`]: firebase.firestore.FieldValue.increment(-totalSair),
                    [`unidades_cache.${minhaUnidadeId}.uso`]: firebase.firestore.FieldValue.increment(totalSair)
                });
            }

            // 5. Atualizar Arquitetura da Viatura
            let novaListaVtr = JSON.parse(JSON.stringify(vtrData.list));
            let setorObj = novaListaVtr.find(s => s.nome === formValues.setorId);
            
            setorObj.itens.push({
                uid_global: uidAnfitriao,
                nome: (await transaction.get(anfitriaoRef)).data().nome,
                quantidadeEsperada: qtdLote,
                quantidade: qtdLote,
                tipo: tombamento ? 'multi' : 'single',
                acessorios_vinculados: acessorios, // Mantém para visualização no modal
                data_alocacao: dataReg,
                is_anfitriao: true
            });

            transaction.update(vtrRef, { list: novaListaVtr });
        });

        Swal.fire({ icon: 'success', title: 'Kit Enviado!', text: 'Anfitrião e acessórios vinculados com sucesso.', timer: 2000, showConfirmButton: false });
        if (typeof carregarAlmoxarifadoUI === 'function') carregarAlmoxarifadoUI();

    } catch (e) {
        console.error("🚨 ERRO NO ENVIO DE KIT:", e);
        Swal.fire('Falha na Operação', e.message, 'error');
    }
}

//=== Alimentador Dinâmico de Destinos: Gerencia a bifurcação logística entre Transferências Estaduais e Movimentações Locais ===//
async function popularDestinosMovimentacao(souAdmin, operacao, viaturaIdPreSeleccionada = null) {
    const selectDestino = document.getElementById('swal-mov-destino') || document.getElementById('swal-destino-kit');

    if (!selectDestino) {
        console.warn("⚠️ [DEBUG] Select de destino não encontrado no DOM.");
        return;
    }

    // ✅ TRATAMENTO DE SIGLA: Garante que "CCI" ou similar apareça em vez de undefined
    const minhaSigla = currentUserData.unidade_sigla || currentUserData.unidade || currentUserData.sigla || "UNIDADE";
    const meuId = currentUserData.unidade_id || "";

    try {
        let htmlOptions = `<option value="" disabled selected>Selecione o destino...</option>`;

        if (souAdmin) {
            // FLUXO ADMIN: Transferência entre Unidades Físicas
            const snapUnidades = await db.collection('unidades_estruturadas')
                .where('ativo', '==', true)
                .get();

            const unidades = snapUnidades.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(u => u.id !== meuId)
                .sort((a, b) => (a.sigla || "").localeCompare(b.sigla || ""));

            unidades.forEach(u => {
                htmlOptions += `<option value="${u.id}">${u.sigla} - ${u.nome_completo}</option>`;
            });

        } else {
            // FLUXO GESTOR LOCAL: Movimentação para Viaturas ou Almoxarifado
            if (operacao === 'RECOLHIMENTO') {
                // ✅ CORREÇÃO: Fallback seguro para evitar undefined na string
                htmlOptions = `<option value="${meuId}" selected>ALMOXARIFADO - ${minhaSigla.toUpperCase()}</option>`;
                selectDestino.innerHTML = htmlOptions;
                selectDestino.disabled = true;
                selectDestino.style.backgroundColor = "#f1f5f9";
                return;
            }

            // Busca as listas de conferência (Viaturas) ativas na unidade
            const snapVtrs = await db.collection('listas_conferencia')
                .where('unidade_id', '==', meuId)
                .where('ativo', '==', true)
                .get();

            if (snapVtrs.empty) {
                htmlOptions = `<option value="">Nenhuma viatura disponível na unidade</option>`;
            } else {
                const vtrs = snapVtrs.docs.map(d => ({ id: d.id, ...d.data() }))
                    .sort((a, b) => (a.ativo_nome || "").localeCompare(b.ativo_nome || ""));

                vtrs.forEach(v => {
                    const isSelected = (viaturaIdPreSeleccionada === v.id) ? 'selected' : '';
                    const labelPosto = v.posto_nome ? `[${v.posto_nome}]` : '[GERAL]';
                    htmlOptions += `<option value="${v.id}" ${isSelected}>${v.ativo_nome} ${labelPosto}</option>`;
                });
            }
        }

        selectDestino.innerHTML = htmlOptions;

        if (viaturaIdPreSeleccionada) {
            selectDestino.dispatchEvent(new Event('change'));
        }

    } catch (e) {
        console.error("❌ Erro ao popular destinos:", e);
        selectDestino.innerHTML = `<option value="">Erro ao carregar destinos</option>`;
    }
}

//=== Seletor de Patrimônio: Gerencia a listagem e filtragem de tombamentos (itens Multi) para Movimentação ===//
async function popularTombamentosMovimentacao(docId, operacao, tombamentoFoco, viaturaId, corTema) {
    const containerTomb = document.getElementById('lista-tomb-swal');
    if (!containerTomb) return;

    try {
        let listaTombs = [];
        const baseRef = db.collection('inventario').doc(docId).collection('tombamentos');

        if (operacao === 'ENVIO') {
            // Busca itens que estão no Almoxarifado (viatura_id null) e pertencem à unidade
            const snap = await baseRef
                .where('local_id', '==', currentUserData.unidade_id)
                .where('viatura_id', '==', null)
                .get();

            snap.forEach(d => {
                const data = d.data();
                // Se for o item que clicamos na lupa (foco), ignoramos a trava de status por precaução
                const ehItemFoco = (tombamentoFoco && data.tomb === tombamentoFoco);

                if (ehItemFoco || (data.situacao_atual !== 'AVARIADO' && data.situacao_atual !== 'EXTRAVIADO')) {
                    listaTombs.push(data);
                }
            });
        } else {
            // RECOLHIMENTO: Busca o que está especificamente na viatura de origem
            const snap = await baseRef
                .where('viatura_id', '==', viaturaId)
                .get();
            snap.forEach(d => listaTombs.push(d.data()));
        }

        if (listaTombs.length === 0) {
            containerTomb.innerHTML = `
                <div style="padding:15px; text-align:center; background:#f8fafc; border-radius:8px;">
                    <i class="fas fa-exclamation-circle" style="color:#94a3b8; margin-bottom:5px;"></i><br>
                    <span style="color:#64748b; font-size:0.85em; font-weight:600;">Nenhum patrimônio disponível para esta operação.</span>
                </div>`;
            return;
        }

        // Ordenação: Se houver um item de foco, ele vai para o topo. Caso contrário, ordem alfanumérica.
        listaTombs.sort((a, b) => {
            if (a.tomb === tombamentoFoco) return -1;
            if (b.tomb === tombamentoFoco) return 1;
            return a.tomb.localeCompare(b.tomb, undefined, { numeric: true });
        });

        let htmlChecks = "";
        listaTombs.forEach(t => {
            const isFoco = (t.tomb === tombamentoFoco);
            const statusLabel = t.situacao_atual || 'DISPONÍVEL';
            const colorStatus = statusLabel === 'DISPONÍVEL' ? '#1b8a3e' : '#2c7399';

            // Estilo dinâmico se já começar selecionado
            const bgInicial = isFoco ? `${corTema}08` : 'transparent';
            const borderInicial = isFoco ? `${corTema}40` : '#f1f5f9';

            htmlChecks += `
                <div class="tomb-row" style="margin-bottom:6px; padding:8px; display:flex; align-items:center; border-radius:6px; border:1px solid ${borderInicial}; background:${bgInicial}; transition: 0.2s;">
                    <input type="checkbox" class="swal-tomb-check" id="chk-${t.tomb}" value="${t.tomb}" ${isFoco ? 'checked' : ''} 
                        style="width:19px; height:19px; accent-color:${corTema}; cursor:pointer;">
                    
                    <label for="chk-${t.tomb}" style="margin-left:12px; font-weight:800; color:#1e293b; cursor:pointer; flex:1; display:flex; justify-content:space-between; align-items:center;">
                        <span style="${isFoco ? 'color:' + corTema : ''}">${t.tomb} ${isFoco ? '<small>(SELECIONADO)</small>' : ''}</span>
                        <span style="font-size:0.65em; padding:2px 6px; border-radius:4px; background:${colorStatus}20; color:${colorStatus}; border:1px solid ${colorStatus}40;">
                            ${statusLabel}
                        </span>
                    </label>
                </div>`;
        });

        containerTomb.innerHTML = htmlChecks;

        // Adiciona efeito visual de seleção dinâmico
        document.querySelectorAll('.swal-tomb-check').forEach(ck => {
            ck.addEventListener('change', (e) => {
                const row = e.target.closest('.tomb-row');
                row.style.background = e.target.checked ? `${corTema}08` : 'transparent';
                row.style.borderColor = e.target.checked ? `${corTema}40` : '#f1f5f9';
            });
        });

    } catch (e) {
        console.error("Erro ao carregar tombamentos:", e);
        containerTomb.innerHTML = `<div style="color:#b91c1c; font-size:0.85em;">Falha na sincronização. Tente novamente.</div>`;
    }
}

//=== Motor de Sincronização de Estoque: Processa a movimentação de itens Simples e Patrimoniados em Lote (Batch) ===//
async function executarMovimentacaoReal(docId, operacao, dados) {
    let { destinoId, setorId, quantidade, tombamentos, uidsParaMover, observacao, origemVtrId, isAnfitriao } = dados;
    const minhaUnidadeId = currentUserData.unidade_id;
    const minhaUnidadeSigla = currentUserData.unidade_sigla || "UNID";
    const dataHora = new Date().toLocaleString('pt-BR');
    const autor = `${currentUserData.posto} ${currentUserData.nome_guerra}`;

    Swal.fire({
        title: 'Sincronizando Unidades...',
        html: 'Garantindo integridade de Kit e Rastreabilidade Unitária.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const itemRef = db.collection('inventario').doc(docId);
        const itemSnap = await itemRef.get();
        if (!itemSnap.exists) throw new Error("Item pai não localizado no inventário.");

        const itemData = itemSnap.data();
        const batch = db.batch();
        
        // ✅ AJUSTE DE OURO: Normalização do Tipo
        const tipoEfetivo = String(itemData.tipo).toLowerCase();
        const ehSingle = (tipoEfetivo === 'single' || tipoEfetivo === 'consumo');

        // ✅ AUTO-SELEÇÃO DE IDS (Resolve o erro de "Nenhuma unidade selecionada")
        if (ehSingle && operacao === 'RECOLHIMENTO' && (!uidsParaMover || uidsParaMover.length === 0)) {
            const qtdNum = parseInt(quantidade) || 1;
            console.log(`🔎 Buscando ${qtdNum} IDs virtuais na VTR ${origemVtrId} para o item ${docId}...`);
            
            const snapParaRecolher = await itemRef.collection('tombamentos')
                .where('viatura_id', '==', origemVtrId)
                .limit(qtdNum)
                .get();
            
            if (snapParaRecolher.empty) {
                throw new Error("Não encontramos registros físicos deste item na viatura para recolher.");
            }
            
            uidsParaMover = snapParaRecolher.docs.map(d => d.id);
        }

        // 1. DEFINIÇÃO FINAL DA LISTA DE PROCESSAMENTO
        const listaUidsProcessar = !ehSingle ? (tombamentos || []) : (uidsParaMover || []);
        
        if (listaUidsProcessar.length === 0) {
             throw new Error("Nenhuma unidade selecionada para movimentação.");
        }

        let variacaoDisp = 0;
        let variacaoUso = 0;
        let variacaoUsoPend = 0;

        // --- BLOCO A: MOVIMENTAÇÃO UNITÁRIA ---
        for (const uid of listaUidsProcessar) {
            const docTombRef = itemRef.collection('tombamentos').doc(uid);
            const tSnap = await docTombRef.get();
            if (!tSnap.exists) continue;

            const tData = tSnap.data();
            const estaPendente = tData.situacao_atual === 'PENDENTE' || !!tData.uid_pendencia;

            if (operacao === 'ENVIO') {
                batch.update(docTombRef, {
                    situacao_atual: "EM CARGA",
                    local_id: "VIATURA",
                    viatura_id: destinoId,
                    setor_id: setorId,
                    atualizado_em: dataHora,
                    atualizado_por: autor
                });
                variacaoDisp--; variacaoUso++;
                if (estaPendente) variacaoUsoPend++;
            } else {
                // RECOLHIMENTO
                batch.update(docTombRef, {
                    situacao_atual: estaPendente ? "PENDENTE" : "DISPONÍVEL",
                    local_id: "ALMOXARIFADO",
                    viatura_id: null,
                    vinculo_pai_tomb: firebase.firestore.FieldValue.delete(), 
                    atualizado_em: dataHora,
                    atualizado_por: autor
                });
                variacaoDisp++; variacaoUso--;
                if (estaPendente) variacaoUsoPend--;

                // ✅ BLOCO B: ACESSÓRIOS (FILHOS)
                if (isAnfitriao) {
                    const snapFilhos = await db.collectionGroup('tombamentos')
                        .where('vinculo_pai_tomb', '==', uid)
                        .where('viatura_id', '==', origemVtrId).get();

                    for (const fDoc of snapFilhos.docs) {
                        const fData = fDoc.data();
                        const fItemRef = fDoc.ref.parent.parent; 
                        const fEstaPendente = fData.situacao_atual === 'PENDENTE' || !!fData.uid_pendencia;

                        batch.update(fDoc.ref, {
                            situacao_atual: fEstaPendente ? "PENDENTE" : "DISPONÍVEL",
                            local_id: "ALMOXARIFADO",
                            viatura_id: null,
                            vinculo_pai_tomb: firebase.firestore.FieldValue.delete()
                        });

                        const fLogRef = fDoc.ref.collection('historico_vida').doc();
                        batch.set(fLogRef, {
                            data: dataHora,
                            evento: "RECOLHIMENTO_KIT",
                            detalhes: `📥 Recolhido automaticamente via kit pai (${itemData.nome}). VTR: ${minhaUnidadeSigla}`,
                            quem: autor,
                            unidade: minhaUnidadeSigla
                        });

                        batch.update(fItemRef, { 
                            [`unidades_cache.${minhaUnidadeId}.disp`]: firebase.firestore.FieldValue.increment(1), 
                            [`unidades_cache.${minhaUnidadeId}.uso`]: firebase.firestore.FieldValue.increment(-1) 
                        });
                        batch.update(fItemRef.collection('saldos_unidades').doc(minhaUnidadeId), {
                            disp: firebase.firestore.FieldValue.increment(1),
                            uso: firebase.firestore.FieldValue.increment(-1)
                        });
                    }
                }
            }

            const logRef = docTombRef.collection('historico_vida').doc();
            batch.set(logRef, {
                data: dataHora,
                evento: operacao,
                detalhes: `${operacao === 'ENVIO' ? '🚀 Enviado' : '📥 Recolhido'}. Obs: ${observacao}`,
                quem: autor,
                unidade: minhaUnidadeSigla
            });
        }

        // --- BLOCO C e D: LISTA E SALDOS ---
        const vtrRef = db.collection('listas_conferencia').doc(operacao === 'ENVIO' ? destinoId : origemVtrId);
        await atualizarArquiteturaViaturaV3(vtrRef, itemData, operacao, { ...dados, quantidade: listaUidsProcessar.length });

        batch.update(itemRef.collection('saldos_unidades').doc(minhaUnidadeId), {
            disp: firebase.firestore.FieldValue.increment(variacaoDisp),
            uso: firebase.firestore.FieldValue.increment(variacaoUso),
            uso_pend: firebase.firestore.FieldValue.increment(variacaoUsoPend),
            last_update: dataHora
        });

        const updateCachePai = {};
        updateCachePai[`unidades_cache.${minhaUnidadeId}.disp`] = firebase.firestore.FieldValue.increment(variacaoDisp);
        updateCachePai[`unidades_cache.${minhaUnidadeId}.uso`] = firebase.firestore.FieldValue.increment(variacaoUso);
        updateCachePai[`unidades_cache.${minhaUnidadeId}.uso_pend`] = firebase.firestore.FieldValue.increment(variacaoUsoPend);
        batch.update(itemRef, updateCachePai);

        await batch.commit();
        Swal.fire({ icon: 'success', title: 'Concluído!', timer: 1500, showConfirmButton: false });
        
        if (typeof carregarAlmoxarifadoUI === 'function') carregarAlmoxarifadoUI();
        if (typeof verDetalhesItemAlmox === 'function') verDetalhesItemAlmox(docId);

    } catch (e) {
        console.error("🚨 ERRO CRÍTICO:", e);
        Swal.fire('Erro', e.message, 'error');
    }
}

//=== Engenheiro de Carga: Sincroniza a planta física da viatura com as movimentações do almoxarifado ===//
async function atualizarArquiteturaViaturaV3(vtrRef, itemData, operacao, dados) {
    const vtrSnap = await vtrRef.get();
    if (!vtrSnap.exists) {
        console.error("❌ Viatura não encontrada para sincronização.");
        return;
    }

    const vtrData = vtrSnap.data();
    let listaAtualizada = JSON.parse(JSON.stringify(vtrData.list || []));
    const setorAlvo = dados.setorId || 'CABINE';
    const itemUID = itemData.uid_global || itemData.id;
    const isAnfitriao = itemData.is_anfitriao || false;

    let alvoProcessado = false;

    // --- 1. VARREDURA DA ARQUITETURA ---
    for (let setor of listaAtualizada) {
        // TENTA LOCALIZAR COMO ITEM PRINCIPAL (PAI OU AVULSO)
        let itPrincipalIdx = setor.itens.findIndex(it => (it.uid_global || it.id) === itemUID);
        
        if (itPrincipalIdx !== -1 && operacao === 'RECOLHIMENTO') {
            const itPrincipal = setor.itens[itPrincipalIdx];
            
            if (isAnfitriao) {
                // ✅ REGRA MÁXIMA: Se o Pai volta, o conjunto inteiro é removido da lista física
                console.log(`📦 Removendo Anfitrião ${itPrincipal.nome} e seus acessórios da lista física...`);
                setor.itens.splice(itPrincipalIdx, 1);
            } else {
                // Se for um item principal comum, processa a baixa quantitativa
                processarBaixaItem(itPrincipal, setor, false);
            }
            alvoProcessado = true;
            break;
        }

        // TENTA LOCALIZAR COMO ACESSÓRIO DENTRO DE ALGUM KIT (FILHO SOLTEIRO)
        for (let itPai of setor.itens) {
            if (itPai.acessorios_vinculados) {
                let acIdx = itPai.acessorios_vinculados.findIndex(ac => (ac.uid_global || ac.id) === itemUID);
                if (acIdx !== -1 && operacao === 'RECOLHIMENTO') {
                    console.log(`📎 Removendo Acessório ${itPai.acessorios_vinculados[acIdx].nome} do Kit ${itPai.nome}.`);
                    processarBaixaItem(itPai.acessorios_vinculados[acIdx], itPai, true);
                    alvoProcessado = true;
                    break;
                }
            }
        }
        if (alvoProcessado) break;
    }

    // --- 2. LÓGICA PARA ENVIO (NOVA CARGA) ---
    if (operacao === 'ENVIO' && !alvoProcessado) {
        let setorDestino = listaAtualizada.find(s => s.nome === setorAlvo) || listaAtualizada[0];
        if (!setorDestino) {
             console.error("❌ Setor de destino não localizado na arquitetura.");
             return;
        }

        let novoItem = {
            uid_global: itemUID,
            uid_instancia: dados.tombamentos ? `${itemUID}-${dados.tombamentos[0]}` : `SINGLE_${itemUID}_${Date.now()}`,
            nome: itemData.nome,
            quantidadeEsperada: Number(dados.quantidade || 1),
            quantidade: Number(dados.quantidade || 1),
            tipo: itemData.tipo,
            is_anfitriao: isAnfitriao,
            data_alocacao: new Date().toLocaleString('pt-BR')
        };

        // Se for um kit sendo enviado pronto do Almoxarifado
        if (isAnfitriao && dados.acoplados) {
            novoItem.acessorios_vinculados = dados.acoplados;
        }

        setorDestino.itens.push(novoItem);
        console.log(`🚀 Item ${novoItem.nome} inserido no setor ${setorDestino.nome}.`);
    }

    // --- 3. MOTOR DE BAIXA QUANTITATIVA ---
    function processarBaixaItem(alvo, container, ehAcessorio) {
        const qtdRecolher = Number(dados.quantidade || 1);
        
        if (itemData.tipo === 'multi') {
            // Se for patrimoniado, removemos apenas os números de série específicos
            alvo.tombamentos = (alvo.tombamentos || []).filter(t => !dados.tombamentos.includes(t.tomb));
            alvo.quantidadeEsperada = alvo.tombamentos.length;
        } else {
            // Se for consumo, subtraímos a quantidade
            alvo.quantidadeEsperada = Math.max(0, (alvo.quantidadeEsperada || 0) - qtdRecolher);
        }
        
        alvo.quantidade = alvo.quantidadeEsperada;

        // Se zerou, limpa a linha da arquitetura
        if (alvo.quantidadeEsperada <= 0) {
            if (ehAcessorio) {
                container.acessorios_vinculados = container.acessorios_vinculados.filter(ac => (ac.uid_global || ac.id) !== itemUID);
            } else {
                container.itens = container.itens.filter(it => (it.uid_global || it.id) !== itemUID);
            }
        }
    }

    // --- 4. PERSISTÊNCIA NO FIRESTORE ---
    try {
        await vtrRef.update({
            list: listaAtualizada,
            ultima_atualizacao_inventario: firebase.firestore.FieldValue.serverTimestamp(),
            atualizado_por: currentUserData.nome_militar_completo
        });
        console.log(`✅ Sincronização da Lista física concluída.`);
    } catch (err) {
        console.error("❌ Erro fatal na persistência da lista:", err);
        throw new Error("Não foi possível atualizar a planta da viatura.");
    }
}

//=== Inspetor de Detalhes: A "Lente de Aumento" para Cautelas e Pendências ===//
function mostrarCarimbos(titulo, dataJson, tipo, listaId = null, nomeItemLimpo = "") {
    let dados = [];
    try {
        dados = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson;
    } catch (e) {
        console.error("Erro ao processar dados dos carimbos:", e);
    }

    const modal = document.getElementById('modal-detalhe-carimbos');
    const corpo = document.getElementById('corpo-modal-carimbo');
    const h3 = document.getElementById('titulo-modal-carimbo');

    if (!modal || !corpo) return;

    h3.textContent = titulo;

    // Ajuste dinâmico da borda do modal baseada no tipo (Cautela vs Pendência)
    const corTema = tipo === 'cautela' ? '#f57c00' : '#d90f23';
    modal.querySelector('.modal-content').style.borderTop = `6px solid ${corTema}`;

    let html = '';

    if (dados.length === 0) {
        html = `
            <div style="text-align:center; padding: 40px 20px;">
                <i class="fas fa-search" style="font-size: 3em; color: #e2e8f0; margin-bottom: 15px;"></i>
                <p style="color:#64748b; font-weight: 500;">Nenhum registro detalhado encontrado para este item.</p>
            </div>`;
    } else {
        dados.forEach(item => {
            if (tipo === 'cautela') {
                const cId = item.id || item.cautela_id;
                html += `
                    <div style="border: 1px solid #f1f5f9; padding: 14px; margin-bottom: 12px; border-radius: 10px; border-left: 5px solid #f57c00; background: #fffaf5; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                        <div style="display:flex; justify-content:space-between; align-items: flex-start;">
                            <div>
                                <div style="font-size: 0.75em; font-weight: 800; color: #f57c00; text-transform: uppercase; margin-bottom: 2px;">Detentor da Carga</div>
                                <b style="font-size: 1.1em; color: #1e293b;">${item.destinatario}</b><br>
                                <small style="color:#64748b;"><i class="far fa-calendar-alt"></i> ${item.data || 'N/D'}</small>
                            </div>
                            <span style="background:#f57c00; color:white; padding:4px 12px; border-radius:8px; font-weight:800; font-size: 0.9em;">${item.quantidade || 1} un</span>
                        </div>
                        <div style="text-align: right; margin-top: 12px; border-top: 1px solid #ffe0b2; padding-top: 10px;">
                            <button class="btn-modern-action" style="background-color: #f57c00; border: none; color: white; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8em; font-weight: 600;" 
                                    onclick="atalhoGestaoCautela('${cId}')">
                                <i class="fas fa-eye"></i> Detalhes da Cautela
                            </button>
                        </div>
                    </div>`;
            } else {
                const pId = item.id || item.pendencia_id;
                html += `
                    <div style="border: 1px solid #f1f5f9; padding: 14px; margin-bottom: 12px; border-radius: 10px; border-left: 5px solid #d90f23; background: #fff5f5; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                        <div style="display:flex; justify-content:space-between; align-items: flex-start;">
                            <div>
                                <div style="font-size: 0.75em; font-weight: 800; color: #d90f23; text-transform: uppercase; margin-bottom: 2px;">Relato de Avaria</div>
                                <b style="font-size: 1.1em; color: #1e293b;">${item.autor_nome || 'Militar'}</b><br>
                                <small style="color:#64748b;"><i class="far fa-calendar-alt"></i> ${item.data_criacao || 'Data N/D'}</small>
                            </div>
                            <span style="background:#d90f23; color:white; padding:4px 12px; border-radius:8px; font-weight:800; font-size: 0.9em;">${item.quantidade || 1} un</span>
                        </div>
                        <div style="font-size:0.9em; color: #475569; margin:10px 0; padding: 10px; background: white; border-radius: 6px; border: 1px solid #ffdada; font-style: italic;">
                            <i class="fas fa-quote-left" style="color: #d90f2340; margin-right: 5px;"></i>${item.descricao}<i class="fas fa-quote-right" style="color: #d90f2340; margin-left: 5px;"></i>
                        </div>
                        <div style="text-align: right; margin-top: 10px; border-top: 1px solid #ffdada; padding-top: 10px;">
                            <button class="btn-modern-action" style="background-color: #d90f23; border: none; color: white; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8em; font-weight: 600;" 
                                    onclick="atalhoGestaoPendencia('${listaId}', '${nomeItemLimpo}', '${pId}')">
                                <i class="fas fa-tools"></i> Resolver na Viatura
                            </button>
                        </div>
                    </div>`;
            }
        });
    }

    corpo.innerHTML = html;
    modal.style.display = 'flex';
}

//=== RECUPERA E RENDERIZA A LINHA DO TEMPO CRONOLÓGICA DE MOVIMENTAÇÕES E ALTERAÇÕES DE STATUS DE UM ITEM OU PATRIMÔNIO ESPECÍFICO ===//
async function verHistoricoVidaGlobal(uidGlobal, tombamento = null) {
    const container = document.getElementById('timeline-container');
    const modal = document.getElementById('modal-timeline-global');
    const labelNome = document.getElementById('timeline-item-nome');

    if (!container || !modal) return;

    modal.style.display = 'flex';
    container.innerHTML = `
        <div style="text-align:center; padding:50px;">
            <div class="sk-chase" style="margin: 0 auto 15px auto;"></div>
            <p style="color:#64748b; font-size:0.9em; font-weight:600;">Consultando Prontuário Digital...</p>
        </div>`;

    try {
        const docRef = db.collection('inventario').doc(uidGlobal);
        const minhaUnidadeId = currentUserData.unidade_id;
        let eventos = [];

        if (tombamento) {
            // ✅ MODO MULTI: FOCO NO INDIVÍDUO (RG DO MATERIAL)
            labelNome.innerHTML = `<i class="fas fa-fingerprint"></i> Prontuário Individual: <span style="color:#2c7399">${tombamento}</span>`;
            const histSnap = await docRef.collection('tombamentos').doc(tombamento).collection('historico_vida').get();
            eventos = histSnap.docs.map(d => ({ ...d.data(), id_evento: d.id, nivel: 'INDIVIDUAL' }));
        } else {
            // ✅ MODO SINGLE: ACESSÓRIO DE LOTE E DISTRIBUIÇÃO
            labelNome.innerHTML = `<i class="fas fa-boxes"></i> Histórico de Fluxo de Lote`;

            const [snapPai, snapLocal] = await Promise.all([
                docRef.get(),
                docRef.collection('saldos_unidades').doc(minhaUnidadeId).collection('historico_vida').get()
            ]);

            // Logs Corporativos (Saída do Almoxarifado Central)
            if (snapPai.exists && snapPai.data().historico_movimentacoes) {
                eventos = snapPai.data().historico_movimentacoes.map(e => ({ ...e, nivel: 'CORPORATIVO' }));
            }

            // Logs da Unidade Atual (Movimentações Internas)
            snapLocal.forEach(hDoc => {
                eventos.push({
                    ...hDoc.data(),
                    nivel: 'LOCAL',
                    unidade_ref: currentUserData.unidade_sigla || "UNID"
                });
            });
        }

        if (eventos.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; color:#94a3b8; padding:60px;">
                    <i class="fas fa-history" style="font-size:3em; opacity:0.1; margin-bottom:15px;"></i>
                    <p style="font-weight:500;">Este item ainda não possui registros de movimentação no prontuário.</p>
                </div>`;
            return;
        }

        // Ordenação Cronológica Segura (Mais recente no topo)
        eventos.sort((a, b) => {
            const toDate = (s) => {
                if (!s) return 0;
                // Suporta format pt-BR "DD/MM/YYYY, HH:mm:ss"
                const [d, t] = s.split(', ');
                const [day, month, year] = d.split('/');
                return new Date(`${year}-${month}-${day}T${t || '00:00:00'}`).getTime();
            };
            return toDate(b.data || b.timestamp) - toDate(a.data || a.timestamp);
        });



        // Renderização da Timeline
        container.innerHTML = eventos.map(ev => {
            let icon = 'fa-tag';
            let color = '#64748b';
            const evNome = (ev.evento || "MOVIMENTAÇÃO").toUpperCase();

            // Lógica Visual por Tipo de Evento
            if (evNome.includes('APORTE') || evNome.includes('ENTRADA') || evNome.includes('RECEBIMENTO')) { icon = 'fa-arrow-down'; color = '#1b8a3e'; }
            if (evNome.includes('ENVIO') || evNome.includes('TRANSFER')) { icon = 'fa-paper-plane'; color = '#2c7399'; }
            if (evNome.includes('CAUTELA')) { icon = 'fa-user-shield'; color = '#f57c00'; }
            if (evNome.includes('AVARIA') || evNome.includes('RECOLHIMENTO')) { icon = 'fa-undo-alt'; color = '#800020'; }

            const badgeNivel = ev.nivel === 'CORPORATIVO'
                ? `<span style="font-size:10px; background:#e2e8f0; color:#475569; padding:2px 5px; border-radius:4px; margin-right:5px;">SISTEMA</span>`
                : `<span style="font-size:10px; background:${color}15; color:${color}; padding:2px 5px; border-radius:4px; margin-right:5px;">OPERACIONAL</span>`;

            return `
            <div class="timeline-item" style="position:relative; padding-bottom: 25px; border-left: 2px solid #e2e8f0; margin-left: 10px; padding-left: 25px;">
                <div style="position:absolute; left:-11px; top:0; width:20px; height:20px; background:${color}; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow: 0 0 0 4px #fff;">
                    <i class="fas ${icon}" style="font-size:10px;"></i>
                </div>
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                    <span style="font-size: 0.75rem; font-weight: 700; color: #94a3b8;">${ev.data || 'N/D'}</span>
                    ${badgeNivel}
                </div>
                <div style="background: white; border: 1px solid #f1f5f9; padding: 12px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="font-weight: 800; color: #1e293b; font-size: 0.85rem; text-transform: uppercase; margin-bottom:6px;">
                        ${evNome.replace(/_/g, ' ')} ${ev.quantidade ? `<small style="color:${color}">(${ev.quantidade} un)</small>` : ''}
                    </div>
                    <div style="font-size: 0.85rem; color: #475569; line-height: 1.5;">
                        ${(ev.detalhes || ev.descricao || 'Nenhuma observação registrada.').replace(/[A-Z0-9]{15,}/g, '<b>ID-REF</b>')}
                    </div>
                    <div style="margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:0.7rem; color:#94a3b8;"><i class="fas fa-map-marker-alt"></i> ${ev.unidade_ref || 'QG'}</span>
                        <span style="font-size:0.7rem; font-weight:600; color:#64748b;"><i class="fas fa-user-edit"></i> ${ev.quem || ev.autor || 'Sistema'}</span>
                    </div>
                </div>
            </div>`;
        }).join('');

    } catch (e) {
        console.error("❌ Falha crítica no prontuário:", e);
        container.innerHTML = `<div style="padding:40px; text-align:center; color:#b91c1c;">Erro ao carregar prontuário.</div>`;
    }
}

//=== Portal de Impressão: Configura e Gera Relatórios PDF Personalizados ===//
async function abrirModalImpressaoAlmox() {
    const itemId = itemSendoVisualizado ? itemSendoVisualizado.id : null;
    const itemNome = itemSendoVisualizado ? itemSendoVisualizado.nome : null;
    const isFichaIndividual = itemId !== null;

    const unidadeId = currentUserData.unidade_id;

    let opcoesSetores = '<option value="TODOS">Todos os Setores</option>';
    if (!isFichaIndividual) {
        const snapSetores = await db.collection('config_setores')
            .where('unidade_id', '==', unidadeId)
            .orderBy('nome').get();
        snapSetores.forEach(doc => {
            opcoesSetores += `<option value="${doc.id}">${doc.data().nome.toUpperCase()}</option>`;
        });
    }

    Swal.fire({
        title: isFichaIndividual ? 'RELATÓRIO INDIVIDUAL' : 'RELATÓRIO DE INVENTÁRIO',
        html: `
            <div style="text-align: left; font-family: 'Inter', sans-serif;">
                
                <label style="display:block; font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; margin-bottom:8px;">1. Tipo de Relatório</label>
                <div style="display:flex; gap:10px; margin-bottom:20px;">
                    <div id="btn-layout-sintetico" onclick="selecionarLayoutPrint('SINTETICO')" style="flex:1; padding:12px; border:2px solid #800020; border-radius:10px; cursor:pointer; text-align:center; background:#fff5f5;">
                        <i class="fas fa-list-ol" style="color:#800020; margin-bottom:5px;"></i>
                        <span style="display:block; font-size:11px; font-weight:800; color:#800020;">SINTÉTICO</span>
                    </div>
                    <div id="btn-layout-analitico" onclick="selecionarLayoutPrint('ANALITICO')" style="flex:1; padding:12px; border:2px solid #e2e8f0; border-radius:10px; cursor:pointer; text-align:center; background:#fff;">
                        <i class="fas fa-file-invoice" style="color:#64748b; margin-bottom:5px;"></i>
                        <span style="display:block; font-size:11px; font-weight:800; color:#64748b;">ANALÍTICO</span>
                    </div>
                </div>
                <input type="hidden" id="swal-print-layout" value="SINTETICO">

                <hr style="border:0; border-top:1px solid #e2e8f0; margin:15px 0;">

                <label style="display:block; font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; margin-bottom:5px;">2. Filtros de Escopo</label>
                
                <div style="margin-bottom: 12px;">
                    <select id="swal-print-setor" class="swal2-input" style="width:100%; margin:0; font-size:14px; border-radius:8px;" ${isFichaIndividual ? 'disabled' : ''}>
                        ${opcoesSetores}
                    </select>
                </div>

                <div style="display:flex; gap:10px; margin-bottom:15px;">
                    <div style="flex:1;">
                        <select id="swal-print-cat" class="swal2-input" style="width:100%; margin:0; font-size:13px; border-radius:8px;" ${isFichaIndividual ? 'disabled' : ''}>
                            <option value="TODAS">Todas Categorias</option>
                            <option value="EPI">EPI</option>
                            <option value="FERRAMENTA">FERRAMENTA</option>
                            <option value="EQUIPAMENTO">EQUIPAMENTO</option>
                            <option value="OUTROS">OUTROS</option>
                        </select>
                    </div>
                    <div style="flex:1;">
                        <select id="swal-print-tipo" class="swal2-input" style="width:100%; margin:0; font-size:13px; border-radius:8px;" ${isFichaIndividual ? 'disabled' : ''}>
                            <option value="AMBOS">Todos os Itens</option>
                            <option value="CONSUMO">Apenas Consumo</option>
                            <option value="PATRIMONIADO">Apenas Patrimoniados</option>
                        </select>
                    </div>
                </div>

                <label style="display:block; font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; margin-bottom:10px;">3. Filtrar por Status</label>
                <div style="display: grid; grid-template-columns: 1fr; gap: 8px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <label style="display:flex; align-items:center; gap:10px; font-size:13px; color:#334155; cursor:pointer;">
                        <input type="checkbox" id="swal-status-disp" checked> 
                        <span>Exibir <b>Disponíveis</b> (Em estoque/Almox)</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:10px; font-size:13px; color:#334155; cursor:pointer;">
                        <input type="checkbox" id="swal-status-pend" checked> 
                        <span>Exibir <b>Pendentes</b> (Manutenção/Avariado)</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:10px; font-size:13px; color:#334155; cursor:pointer;">
                        <input type="checkbox" id="swal-status-caut" checked> 
                        <span>Exibir <b>Cautelados</b> (Em posse de militar)</span>
                    </label>
                </div>

            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-print"></i> GERAR PDF',
        cancelButtonText: 'CANCELAR',
        confirmButtonColor: '#800020',
        preConfirm: () => {
            return {
                layout: document.getElementById('swal-print-layout').value,
                setorId: document.getElementById('swal-print-setor')?.value || 'TODOS',
                categoria: document.getElementById('swal-print-cat').value,
                tipoCarga: document.getElementById('swal-print-tipo').value,
                statusFiltro: {
                    disponivel: document.getElementById('swal-status-disp').checked,
                    pendente: document.getElementById('swal-status-pend').checked,
                    cautelado: document.getElementById('swal-status-caut').checked
                },
                itemId: itemId
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            processarDadosParaImpressao(result.value);
        }
    });
}

// Função Auxiliar para Troca de Layout no Modal
function selecionarLayoutPrint(tipo) {
    const btnS = document.getElementById('btn-layout-sintetico');
    const btnA = document.getElementById('btn-layout-analitico');
    const inputLayout = document.getElementById('swal-print-layout');

    if (!inputLayout || !btnS || !btnA) return; // Proteção contra elementos nulos

    inputLayout.value = tipo;

    const ativo = { border: '#800020', bg: '#fff5f5', text: '#800020' };
    const inativo = { border: '#e2e8f0', bg: '#fff', text: '#64748b' };

    if (tipo === 'SINTETICO') {
        // Ativar Sintético
        aplicarEstiloLayout(btnS, ativo);
        // Desativar Analítico
        aplicarEstiloLayout(btnA, inativo);
    } else {
        // Ativar Analítico
        aplicarEstiloLayout(btnA, ativo);
        // Desativar Sintético
        aplicarEstiloLayout(btnS, inativo);
    }
}

// Função auxiliar para evitar repetição de código (DRY)
function aplicarEstiloLayout(btn, estilo) {
    if (!btn) return;
    btn.style.borderColor = estilo.border;
    btn.style.background = estilo.bg;

    const icone = btn.querySelector('i');
    const span = btn.querySelector('span');

    if (icone) icone.style.color = estilo.text;
    if (span) span.style.color = estilo.text;
}

//=== o "cérebro" que filtra o banco e organiza os dados antes de enviar para o motor do PDF. ===//
async function processarDadosParaImpressao(configs) {
    Swal.fire({
        title: 'Gerando Documento...',
        html: 'Aguarde enquanto filtramos os status, setores e tombamentos.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const minhaUnidadeId = currentUserData.unidade_id;
        const isAnalitico = configs.layout === 'ANALITICO';
        const f = configs.statusFiltro;
        let itensParaRelatorio = [];

        // --- 1. BUSCA DICIONÁRIO DE SETORES (PARA TRADUÇÃO DE ID -> NOME) ---
        const snapSetores = await db.collection('config_setores')
            .where('unidade_id', '==', minhaUnidadeId)
            .get();
        
        const mapaSetores = {};
        snapSetores.forEach(sDoc => {
            mapaSetores[sDoc.id] = sDoc.data().nome;
        });

        // --- 2. BUSCA ITENS DO INVENTÁRIO ---
        const snapItens = await db.collection('inventario').get();

        for (const doc of snapItens.docs) {
            const d = doc.data();
            const c = (d.unidades_cache && d.unidades_cache[minhaUnidadeId]) || { total: 0 };

            // Filtros Básicos
            const matchesSetor = configs.setorId === 'TODOS' || (c.setores_ids && c.setores_ids.includes(configs.setorId));
            const matchesCat = configs.categoria === 'TODAS' || d.categoria === configs.categoria;
            const tipoDB = String(d.tipo || '').toLowerCase();
            const isMulti = (tipoDB === 'patrimoniado' || tipoDB === 'multi');

            const matchesTipo = configs.tipoCarga === 'AMBOS' ||
                (configs.tipoCarga === 'PATRIMONIADO' && isMulti) ||
                (configs.tipoCarga === 'CONSUMO' && (tipoDB === 'consumo' || tipoDB === 'single'));

            if (matchesSetor && matchesCat && matchesTipo) {

                const temSaldoCache = (f.disponivel && c.disp > 0) ||
                    (f.pendente && (c.pend > 0 || c.uso_pend > 0)) ||
                    (f.cautelado && c.uso_caut > 0);

                if (temSaldoCache || isMulti) {

                    let detalhesTombos = [];
                    let cacheAjustado = { ...c };

                    // Tradução do Setor do Item Principal (usa o primeiro ID do array de setores)
                    const setorIdPrincipal = (c.setores_ids && c.setores_ids[0]) || '';
                    const nomeSetorPai = mapaSetores[setorIdPrincipal] || c.sigla || "GERAL";

                    // --- 3. LOGICA PARA ITENS MULTI/PATRIMONIADO ---
                    if (isMulti) {
                        const snapTombos = await db.collection('inventario').doc(doc.id)
                            .collection('tombamentos')
                            .get();

                        detalhesTombos = snapTombos.docs.map(tDoc => {
                            const t = tDoc.data();
                            const s = String(t.status || t.situacao_atual || '').toUpperCase();

                            const pertenceAUnidade = !t.unidade_id || t.unidade_id === minhaUnidadeId;
                            if (!pertenceAUnidade) return null;

                            // Filtro de Setor no Tombo
                            if (configs.setorId !== 'TODOS' && t.setor_id !== configs.setorId) return null;

                            const isDisp = s.includes('ALMOX') || s.includes('DISPONÍVEL');
                            const isPend = s.includes('MANUTENÇÃO') || s.includes('AVARIADO') || s.includes('PENDENTE');
                            const isCaut = s.includes('CAUTELA') || s.includes('CAUTELADO');

                            if ((f.disponivel && isDisp) || (f.pendente && isPend) || (f.cautelado && isCaut)) {
                                return {
                                    ...t,
                                    numero: t.tomb || t.numero || tDoc.id,
                                    status: s,
                                    setor_nome: mapaSetores[t.setor_id] || nomeSetorPai, // Tradução do Setor do Tombo
                                    tipo: 'PATRIMONIADO'
                                };
                            }
                            return null;
                        }).filter(t => t !== null);

                        if (detalhesTombos.length === 0) continue;
                        cacheAjustado.total = detalhesTombos.length;
                    }

                    // --- 4. MAPEAMENTO FINAL ---
                    const tipoParaMapear = isMulti ? 'patrimoniado' : 'consumo';
                    
                    // Injetamos o nomeSetorPai (ex: "URBANO") nos dados que vão para o PDF
                    const itemMapeado = mapearItemParaPDF(
                        doc.id, 
                        { ...d, tipo: tipoParaMapear, setor_nome: nomeSetorPai }, 
                        cacheAjustado, 
                        minhaUnidadeId, 
                        detalhesTombos
                    );

                    itensParaRelatorio.push(itemMapeado);
                }
            }
        }

        if (itensParaRelatorio.length === 0) throw new Error("Nenhum item corresponde aos filtros selecionados.");

        itensParaRelatorio.sort((a, b) => a.nome.localeCompare(b.nome));
        enviarParaPDF(itensParaRelatorio, configs);

    } catch (e) {
        console.error("Erro no Processamento:", e);
        Swal.fire('Atenção', e.message, 'warning');
    }
}

// Função Auxiliar para padronizar os dados (Centraliza a lógica do Cache Híbrido)
function mapearItemParaPDF(id, d, c, unidadeId, detalhes = []) {
    const nOkVtr = Math.max(0, (c.uso || 0) - (c.uso_pend || 0) - (c.uso_caut || 0));

    return {
        id: id,
        nome: (d.nome || "S/ NOME").toUpperCase(), // Força caixa alta para padronização militar
        tipo: d.tipo === 'multi' || d.tipo === 'patrimoniado' ? 'PATRIMONIADO' : 'CONSUMO',
        categoria: d.categoria || "OUTROS",
        setor_nome: d.setor_sigla || d.setor_id || "GERAL",
        resumo: {
            total: c.total || 0,
            almox_disp: c.disp || 0,
            almox_pend: c.pend || 0,
            vtr_ok: nOkVtr,
            vtr_pend: c.uso_pend || 0,
            vtr_caut: c.uso_caut || 0,
            vtr_tot: c.uso || 0
        },
        // Garante que se 'detalhes' vier nulo por erro de busca, o PDF receba um array vazio
        tombamentos_detalhes: Array.isArray(detalhes) ? detalhes : []
    };
}

// Função auxiliar para organizar e disparar o PDF
function enviarParaPDF(listaItens, configs) {
    // 1. Definição dinâmica do título
    let tituloDefinido = configs.itemId ? 'FICHA INDIVIDUAL DE MATERIAL' : 'RELATÓRIO DE INVENTÁRIO LOGÍSTICO';
    tituloDefinido += (configs.layout === 'ANALITICO') ? ' (DETALHADO)' : ' (SINTÉTICO)';

    // 2. Montagem da Identificação Militar (Ex: 3º SGT QPCBM JHONATH)
    const posto = currentUserData?.posto || "";
    const quadro = currentUserData?.quadro || "";
    const nomeGuerra = currentUserData?.nome_guerra || "";
    const identificacaoMilitar = `${posto} ${quadro} ${nomeGuerra}`.trim() || "MILITAR NÃO IDENTIFICADO";

    // 3. Preparação dos dados
    const dadosPDF = {
        titulo: tituloDefinido,
        emitente: identificacaoMilitar,
        unidade_sigla: currentUserData?.unidade || 'CBMRR',

        // Garante que o nome completo da unidade chegue ao motor
        unidade_nome: (typeof currentUnidadeData !== 'undefined' && currentUnidadeData?.nome_completo)
            ? currentUnidadeData.nome_completo
            : (currentUserData?.unidade_nome_completo || "COMPANHIA DE COMBATE A INCÊNDIO"),

        timestamp: { seconds: Math.floor(Date.now() / 1000) },
        itens: listaItens,
        configuracoes: configs
    };

    console.log(`[SIGMA] Iniciando motor de PDF para: ${identificacaoMilitar}`);

    // 4. Chamada do motor
    gerarPDFAlmoxarifado(dadosPDF);
}

async function gerarPDFAlmoxarifado(data) {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4');
        const MARGIN = 10, PG_W = 297, LOGO_S = 15;
        const configs = data.configuracoes || {};
        const isAnalitico = configs.layout === 'ANALITICO';
        const COR_PRIMARIA = [128, 0, 32];
        const TITULO_DOC = String(data.titulo || "RELATÓRIO DE INVENTÁRIO").toUpperCase();

        const nomeMilitar = (data.emitente || "MILITAR NÃO IDENTIFICADO").toUpperCase();
        const nomeUnidadeFull = (data.unidade_nome || "CORPO DE BOMBEIROS MILITAR DE RORAIMA").toUpperCase();

        // --- 1. CABEÇALHO (INTEGRIDADE MANTIDA) ---
        const logoDraw = (domId, x) => {
            const el = document.querySelector(`img[src*="${domId}"]`);
            if (el) {
                try {
                    const c = document.createElement('canvas');
                    c.width = el.naturalWidth; c.height = el.naturalHeight;
                    c.getContext('2d').drawImage(el, 0, 0);
                    doc.addImage(c.toDataURL('image/png'), 'PNG', x, 8, LOGO_S, LOGO_S);
                } catch (e) { console.warn(`Logo erro: ${domId}`); }
            }
        };
        logoDraw('cbmrr.png', MARGIN);
        logoDraw('logo_sigma.png', PG_W - MARGIN - LOGO_S);

        doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(51);
        doc.text('GOVERNO DE RORAIMA', PG_W / 2, 12, { align: 'center' });
        doc.setTextColor(217, 15, 35).text('CORPO DE BOMBEIROS MILITAR DE RORAIMA', PG_W / 2, 16, { align: 'center' });
        doc.setFontSize(14).setTextColor(...COR_PRIMARIA).text(TITULO_DOC, PG_W / 2, 28, { align: 'center' });

        // --- 2. BOX DE RESUMO ---
        doc.setFillColor(248, 250, 252).setDrawColor(226, 232, 240).roundedRect(MARGIN, 33, PG_W - (MARGIN * 2), 18, 1, 1, 'FD');
        doc.setFontSize(8).setTextColor(71, 85, 105).setFont('helvetica', 'bold');
        doc.text('RESPONSÁVEL:', MARGIN + 5, 39);
        doc.setFont('helvetica', 'normal').text(nomeMilitar, MARGIN + 30, 39);
        doc.setFont('helvetica', 'bold').text('UNIDADE:', PG_W / 2 - 20, 39);
        doc.setFont('helvetica', 'normal').text(nomeUnidadeFull, PG_W / 2 + 5, 39);
        doc.setFont('helvetica', 'bold').text('EMISSÃO:', MARGIN + 5, 45);
        doc.setFont('helvetica', 'normal').text(new Date().toLocaleString('pt-BR'), MARGIN + 30, 45);
        doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...COR_PRIMARIA);
        doc.text(`TOTAL DE ITENS: ${data.itens.length}`, PG_W - MARGIN - 5, 43, { align: 'right' });

        // --- 3. SEPARAÇÃO DOS DADOS (HÍBRIDO) ---
        const itensConsumo = data.itens.filter(it => it.tipo === 'CONSUMO');
        const itensPatrimonio = data.itens.filter(it => it.tipo === 'PATRIMONIADO');

        // Aumentado para 62 para não colar no Box de Resumo (Respiro)
        let finalY = 62;

        // --- TABELA A: MATERIAL DE CONSUMO / SINGLE ---
        if (itensConsumo.length > 0) {
            // Adicionado font 'bold' para destaque do título da seção
            doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...COR_PRIMARIA);
            doc.text("MATERIAIS DE CONSUMO E ITENS COLETIVOS", MARGIN, finalY - 4);

            let bodyConsumo = itensConsumo.map((it, idx) => {
                const r = it.resumo || {};
                return [
                    { content: String(idx + 1), styles: { halign: 'center' } },
                    { content: String(it.nome).toUpperCase(), styles: { fontStyle: 'bold' } },
                    { content: String(r.vtr_tot || 0), styles: { halign: 'center' } },
                    { content: String(r.vtr_caut || 0), styles: { halign: 'center' } },
                    { content: String(r.vtr_pend || 0), styles: { halign: 'center' } },
                    { content: String(r.almox_disp || 0), styles: { halign: 'center', fontStyle: 'bold' } },
                    { content: String(r.total || 0), styles: { halign: 'center', fontStyle: 'bold', fillColor: [245, 245, 245] } }
                ];
            });

            doc.autoTable({
                startY: finalY,
                head: [['ORD', 'DESCRIÇÃO DO MATERIAL', 'EM CARGA', 'CAUTELADO', 'PENDENTES', 'DISPONÍVEL', 'TOTAL']],
                body: bodyConsumo,
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
                headStyles: { fillColor: COR_PRIMARIA, textColor: 255, fontStyle: 'bold', halign: 'center' },
                columnStyles: { 
                    0: { cellWidth: 12 }, 
                    1: { cellWidth: 'auto' },
                    2: { halign: 'center' },
                    3: { halign: 'center' },
                    4: { halign: 'center' },
                    5: { halign: 'center' },
                    6: { halign: 'center' }
                }
            });
            
            // Define a posição para a próxima tabela com um espaçamento de 15mm
            finalY = doc.lastAutoTable.finalY + 15;
        }

        // --- TABELA B: MATERIAL PATRIMONIADO / MULTI ---
        if (itensPatrimonio.length > 0) {
            // Se não houver espaço na página atual para começar a nova tabela, pula página
            if (finalY > 170) { doc.addPage(); finalY = 25; }

            doc.setFontSize(10).setTextColor(...COR_PRIMARIA).text("RELAÇÃO NOMINAL DE BENS PATRIMONIADOS", MARGIN, finalY - 2);

            let bodyPatrimonio = [];
            let contadorPat = 1;

            itensPatrimonio.forEach(it => {
                const tombamentos = it.tombamentos_detalhes || [];

                tombamentos.forEach((t, i) => {
                    // Lógica de Localização/OBS sugerida
                    let observacao = "---";
                    if (t.status?.includes("CAUTELADO")) observacao = `DETENTOR: ${t.detentor_nome || 'N/I'}`;
                    else if (t.status?.includes("PENDENTE")) observacao = `MOTIVO: ${t.motivo_pendencia || 'EM MANUTENÇÃO'}`;
                    else observacao = `LOCAL: ${t.sub_local || 'ALMOXARIFADO'}`;

                    bodyPatrimonio.push([
                        { content: String(contadorPat++), styles: { halign: 'center' } },
                        { content: String(it.nome).toUpperCase(), styles: { fontStyle: i === 0 ? 'bold' : 'normal' } },
                        { content: String(t.numero || t.tomb), styles: { halign: 'center', fontStyle: 'bold' } },
                        { content: String(it.categoria || '---').toUpperCase(), styles: { fontSize: 7 } },
                        { content: String(t.setor_nome || it.setor_nome || 'GERAL').toUpperCase(), styles: { fontSize: 7 } },
                        { content: String(t.status || 'DISPONÍVEL').toUpperCase(), styles: { halign: 'center', fontSize: 7 } },
                        { content: observacao, styles: { fontSize: 6.5 } }
                    ]);
                });
            });

            doc.autoTable({
                startY: finalY,
                head: [['ORD', 'MATERIAL', 'TOMBAMENTO', 'CATEGORIA', 'SETOR', 'SITUAÇÃO', 'LOCALIZAÇÃO / OBSERVAÇÃO']],
                body: bodyPatrimonio,
                theme: 'grid',
                styles: { fontSize: 7.5, cellPadding: 2, valign: 'middle' },
                headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: 'bold', halign: 'center' }, // Cor neutra para distinguir as tabelas
                columnStyles: {
                    0: { cellWidth: 10 },
                    1: { cellWidth: 50 },
                    2: { cellWidth: 25 },
                    3: { cellWidth: 30 },
                    4: { cellWidth: 30 },
                    5: { cellWidth: 30 },
                    6: { cellWidth: 'auto' }
                }
            });
        }

        // --- RODAPÉ E PAGINAÇÃO ---
        const totalPaginas = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPaginas; i++) {
            doc.setPage(i);
            doc.setFontSize(7).setTextColor(150);
            doc.text(`SISTEMA INTEGRADO DE GESTÃO DE MATERIAL - SIGMA`, MARGIN, 205);
            doc.text(`Página ${i} de ${totalPaginas}`, PG_W - MARGIN, 205, { align: 'right' });
        }

        const pdfBlob = doc.output('blob');
        window.currentPdfBlob = pdfBlob;
        window.currentPdfUrl = URL.createObjectURL(pdfBlob);
        renderizarPdfV3(pdfBlob);
        Swal.close();

    } catch (e) {
        console.error("Erro no PDF:", e);
        Swal.fire('Erro!', 'Falha ao gerar o documento: ' + e.message, 'error');
    }
}