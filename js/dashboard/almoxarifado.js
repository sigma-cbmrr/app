function abrirModalCadastroGlobal() {
    const modal = document.getElementById('modal-cadastro-global');
    if (!modal) return;

    // Reseta o formulário para garantir que abra limpo
    document.getElementById('form-cadastro-global').reset();

    // Oculta área de kit por padrão
    document.getElementById('area-selecao-componentes').style.display = 'none';

    // Inicia na aba de identificação
    switchTabCadastro('identificacao');

    modal.style.display = 'flex';
}

/**
 * Fecha o modal
 */
function fecharModalCadastroGlobal() {
    const modal = document.getElementById('modal-cadastro-global');
    if (modal) modal.style.display = 'none';
}

/**
 * Alterna entre as abas usando Namespacing para segurança
 */
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

/**
 * Listener para o Checkbox de Kit (Exibição Dinâmica)
 * Usamos a delegação de eventos para garantir que funcione mesmo após renderizações
 */
document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'cat-is-kit') {
        const areaKit = document.getElementById('area-selecao-componentes');
        if (areaKit) {
            areaKit.style.display = e.target.checked ? 'block' : 'none';
        }
    }
});
/**
* 1. AUTOCOMPLETE: Busca em tempo real no Catálogo Global
* Acoplado ao campo 'cat-nome-tecnico' do modal
*/
async function buscarInteligenteFamilia(termo, contexto = 'principal') {
    // Contexto pode ser 'principal' (campo do topo) ou 'componente' (aba de composição)
    const listUI = contexto === 'principal' ?
        document.getElementById('list-suggestions-familia') :
        document.getElementById('list-suggestions-componentes'); // Criaremos este ID no JS da aba

    const boxUI = contexto === 'principal' ?
        document.getElementById('suggestions-familia') :
        document.getElementById('suggestions-componentes');

    const uidPaiInput = document.getElementById('cat-uid-pai');

    if (termo.length < 2) {
        if (boxUI) boxUI.style.display = 'none';
        return;
    }

    try {
        const termoUpper = termo.toUpperCase();
        const snap = await db.collection('catalogo_familias')
            .where('tags_busca', 'array-contains', termoUpper)
            .limit(5).get();

        if (snap.empty) {
            if (boxUI) boxUI.style.display = 'none';
            if (contexto === 'principal') uidPaiInput.value = '';
            return;
        }

        let html = '';
        snap.forEach(doc => {
            const fam = doc.data();
            // ✅ Mudança cirúrgica na chamada do onclick baseada no contexto
            const funcChamada = contexto === 'principal' ?
                `selecionarFamilia('${doc.id}', '${fam.nome_pai}')` :
                `adicionarLinhaComponenteRegra('${doc.id}', '${fam.nome_pai}')`;

            html += `<li onclick="${funcChamada}" style="padding:10px; cursor:pointer; border-bottom:1px solid #eee;">
                        <i class="fas fa-folder"></i> Família: <b>${fam.nome_pai}</b>
                     </li>`;
        });

        if (listUI) listUI.innerHTML = html;
        if (boxUI) boxUI.style.display = 'block';
    } catch (e) {
        console.error("Erro na busca de família:", e);
    }
}

function selecionarFamilia(uid, nome) {
    document.getElementById('cat-nome-pai').value = nome;
    document.getElementById('cat-uid-pai').value = uid;
    document.getElementById('suggestions-familia').style.display = 'none';
    document.getElementById('cat-nome-pai').style.borderColor = '#1b8a3e';
}

/*função auxiliar de "selecionarfamilia" */
function adicionarLinhaComponenteRegra(uid, nome) {
    const container = document.getElementById('lista-componentes-selecionados');
    if (!container) return;

    // Evita adicionar a mesma família duas vezes no mesmo kit
    if (container.querySelector(`[data-familia-uid="${uid}"]`)) {
        return Swal.fire('Aviso', 'Esta família já foi adicionada à composição.', 'info');
    }

    const div = document.createElement('div');
    div.className = 'componente-selecionado-regra'; // Classe que o seu salvamento procura
    div.dataset.familiaUid = uid;
    div.dataset.nomeFamilia = nome;
    div.style.cssText = "display: flex; align-items: center; justify-content: space-between; background: #fff; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);";

    div.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-link" style="color: #2c7399; font-size: 0.8em;"></i>
            <b style="font-size: 0.9em; color: #1e293b;">${nome}</b>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
            <label style="font-size: 0.7em; font-weight: 800; color: #64748b; margin: 0;">QTD SUGERIDA:</label>
            <input type="number" class="input-qtd-regra" value="1" min="1" 
                   style="width: 50px; padding: 4px; border: 1px solid #cbd5e1; border-radius: 4px; text-align: center; font-weight: bold;">
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 5px;">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    container.appendChild(div);

    // Limpa a busca de componentes após adicionar
    const inputBusca = document.getElementById('input-busca-componente-kit'); // Precisamos criar esse input no HTML da aba
    if (inputBusca) inputBusca.value = '';
    document.getElementById('suggestions-componentes').style.display = 'none';
}

/**
 * 3. SALVAMENTO: Cria o DNA (Global) e o Saldo (Local)
 */
async function salvarCadastroGlobalHierarquico() {
    const nomePai = document.getElementById('cat-nome-pai').value.trim().toUpperCase();
    const marca = document.getElementById('cat-marca').value.trim().toUpperCase();
    const modelo = document.getElementById('cat-modelo').value.trim().toUpperCase();
    const categoria = document.getElementById('cat-categoria').value;
    const tipoControle = document.querySelector('input[name="cat-tipo"]:checked').value;
    let uidPai = document.getElementById('cat-uid-pai').value;

    // ✅ NOVOS CAMPOS CAPTURADOS DO HTML
    const unidadeMedida = document.getElementById('cat-unidade-medida').value;
    const exigeInspecao = document.getElementById('cat-has-inspecao').checked;
    const isAnfitriao = document.getElementById('cat-is-kit').checked;

    // ✅ CAPTURA DE COMPONENTES DA COMPOSIÇÃO (SE HOUVER)
    let listaComponentesRegra = [];
    if (isAnfitriao) {
        const itensSelecionados = document.querySelectorAll('.componente-selecionado-regra');
        itensSelecionados.forEach(el => {
            listaComponentesRegra.push({
                familia_uid: el.dataset.familiaUid,
                nome_familia: el.dataset.nomeFamilia,
                qtd_sugerida: parseInt(el.querySelector('.input-qtd-regra').value) || 1
            });
        });
    }

    if (!nomePai || !marca || !modelo) return alert("Preencha os campos obrigatórios.");

    const btn = document.querySelector('.btn-sync');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = "Processando DNA...";

    const autorNome = currentUserData.nome_militar_completo;
    const unidadeCriadorId = currentUserData.unidade_id || "ADMIN";
    const unidadeCriadorSigla = currentUserData.unidade || "ADMINISTRATIVO";
    const dataRegistro = new Date().toLocaleString('pt-BR');

    try {
        await db.runTransaction(async (transaction) => {
            const contRef = db.collection('config_geral').doc('contadores');
            const contSnap = await transaction.get(contRef);
            const contData = contSnap.data() || { ultimo_id_pai: 0, ultimo_id_modelo: 0 };

            // 1. GERENCIAR UID PAI (FAMÍLIA)
            if (!uidPai) {
                const proximoPai = (contData.ultimo_id_pai || 0) + 1;
                uidPai = `FAM-${String(proximoPai).padStart(6, '0')}`;

                transaction.set(db.collection('catalogo_familias').doc(uidPai), {
                    uid_pai: uidPai,
                    nome_pai: nomePai,
                    tags_busca: [nomePai],
                    criado_em: firebase.firestore.FieldValue.serverTimestamp()
                });
                transaction.update(contRef, { ultimo_id_pai: proximoPai });
            }

            // 2. GERENCIAR UID GLOBAL (MODELO TÉCNICO)
            const proximoMod = (contData.ultimo_id_modelo || 0) + 1;
            const uidGlobal = `${uidPai}-MOD-${proximoMod}`;
            const nomeTecnicoCompleto = `${nomePai} ${marca} ${modelo}`;

            // 3. SALVAR NO CATÁLOGO GLOBAL (DNA)
            transaction.set(db.collection('catalogo_global').doc(uidGlobal), {
                uid_global: uidGlobal,
                uid_pai: uidPai,
                nome_pai: nomePai,
                nome_tecnico: nomeTecnicoCompleto,
                marca: marca,
                modelo: modelo,
                categoria: categoria,
                tipo_controle: tipoControle,
                unidade_medida: unidadeMedida, // ✅ Adicionado
                exige_inspecao: exigeInspecao, // ✅ Adicionado
                is_anfitriao: isAnfitriao,     // ✅ Novo: Flag de Kit
                componentes_regra: listaComponentesRegra, // ✅ Novo: Lista de famílias compatíveis
                criado_por: autorNome,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 4. ATUALIZAR TAGS DA FAMÍLIA E CONTADOR
            transaction.update(db.collection('catalogo_familias').doc(uidPai), {
                tags_busca: firebase.firestore.FieldValue.arrayUnion(marca, modelo)
            });
            transaction.update(contRef, { ultimo_id_modelo: proximoMod });

            // 5. INICIALIZAR NO INVENTÁRIO COM VÍNCULO DE UNIDADE
            const invRef = db.collection('inventario').doc(uidGlobal);
            transaction.set(invRef, {
                uid_global: uidGlobal,
                nome: nomeTecnicoCompleto,
                tipo: tipoControle,
                categoria: categoria,
                is_anfitriao: isAnfitriao, // ✅ Importante para filtros no Almox
                componentes_regra: listaComponentesRegra, // ✅ Referência rápida para saída
                qtd_corporativa_total: 0,
                criado_em: dataRegistro,
                criado_por: autorNome,
                unidade_origem_id: unidadeCriadorId
            });

            // ✅ SE FOR SINGLE, JÁ CRIA O DOCUMENTO DE SALDO NA UNIDADE DO CRIADOR
            if (tipoControle === 'single') {
                const saldoRef = invRef.collection('saldos_unidades').doc(unidadeCriadorId);
                transaction.set(saldoRef, {
                    unidade_sigla: unidadeCriadorSigla,
                    qtd_total: 0,
                    qtd_disp: 0,
                    qtd_em_carga: 0,
                    qtd_pend: 0,
                    qtd_caut: 0,
                    last_update: dataRegistro
                });
            }
        });

        alert(`✅ Cadastro Global realizado!\nItem vinculado à unidade ${unidadeCriadorSigla}.`);
        fecharModalCadastroGlobal();
        if (typeof carregarAlmoxarifadoUI === 'function') carregarAlmoxarifadoUI();

    } catch (e) {
        console.error("Erro na transação:", e);
        alert("Erro ao salvar: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function prepararAporte(docId) {
    // 1. Busca os dados do item no Inventário V3
    const docAlvo = await db.collection('inventario').doc(docId).get();
    if (!docAlvo.exists) return alert("Erro ao localizar material.");

    const item = docAlvo.data();
    const ehMulti = item.tipo === 'multi';

    // 2. Lança o Modal Elegante
    Swal.fire({
        title: `<i class="fas fa-plus-circle"></i> Aporte de Material`,
        html: `
            <div style="text-align: left; padding: 5px;">
                <div style="background: #f0fdf4; padding: 12px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #bbf7d0;">
                    <small style="color: #166534; font-weight: 800; text-transform: uppercase; font-size: 0.7em;">Material Selecionado</small>
                    <div style="font-weight: 800; color: #14532d; font-size: 1.1em;">${item.nome}</div>
                    <small style="color: #166534; font-size: 0.75em;">DNA: ${item.tipo.toUpperCase()} • ${item.categoria}</small>
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
                    <div id="container-inputs-tomb" style="max-height: 200px; overflow-y: auto;">
                        </div>
                </div>

                <div class="form-group" style="margin-top:15px;">
                    <label style="font-size: 0.85em; font-weight:bold; color:#800020;">JUSTIFICATIVA / NOTA FISCAL:</label>
                    <textarea id="swal-aporte-obs" class="swal2-textarea" style="width: 100%; margin: 10px 0; height: 80px;" placeholder="Ex: NF 455 - Compra Direta..."></textarea>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-check"></i> CONFIRMAR ENTRADA',
        confirmButtonColor: '#166534',
        cancelButtonText: 'Cancelar',
        didOpen: () => {
            // Inicializa os inputs se for multi
            if (ehMulti) gerarInputsTombamentoDinamico(1, 'multi');
        },
        preConfirm: () => {
            const qtd = document.getElementById('swal-aporte-qtd').value;
            const obs = document.getElementById('swal-aporte-obs').value.trim();

            if (!qtd || qtd < 1) return Swal.showValidationMessage('Informe uma quantidade válida');
            if (!obs) return Swal.showValidationMessage('A justificativa é obrigatória');

            let tombamentos = [];
            if (ehMulti) {
                const linhas = document.querySelectorAll('.linha-tomb-input');
                for (let linha of linhas) {
                    const t = linha.querySelector('.val-tomb').value.trim().toUpperCase();
                    const s = linha.querySelector('.val-sn').value.trim().toUpperCase();
                    if (!t) return Swal.showValidationMessage('Preencha todos os tombamentos');
                    tombamentos.push({ tomb: t, serie: s });
                }
            }

            return {
                quantidade: parseInt(qtd),
                observacao: obs,
                tombamentos: ehMulti ? tombamentos : null
            };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            // Chama a função que já temos de gravar no banco, passando os novos dados
            processarAporteNoBanco(docId, result.value);
        }
    });
}
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

async function processarAporteNoBanco(uidGlobal, dados) {
    const { quantidade, observacao, tombamentos } = dados;
    const ehMulti = tombamentos !== null;

    const minhaUnidadeId = currentUserData.unidade_id || "ADMIN";
    const minhaUnidadeSigla = currentUserData.unidade || "ADMINISTRATIVO";
    const dataReg = new Date().toLocaleString('pt-BR');
    const autorNome = currentUserData.nome_militar_completo;

    Swal.fire({
        title: 'Registrando Entrada...',
        html: 'Atualizando prontuários e saldos globais.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const itemRef = db.collection('inventario').doc(uidGlobal);

        // ✅ 1. ESTA VARIÁVEL É A CHAVE: Ela vive fora da transação para ser usada no Swal depois
        let qtdFinalParaExibicao = 0;

        await db.runTransaction(async (transaction) => {
            const snapItem = await transaction.get(itemRef);
            if (!snapItem.exists) throw new Error("DNA do material não encontrado.");

            const d = snapItem.data();
            const idEvento = "EVT-APORTE-" + Date.now();

            // Variável local da transação
            let qtdEfetivaLocal = 0;

            if (ehMulti) {
                let listaTombsTxt = [];
                for (let tInfo of tombamentos) {
                    qtdEfetivaLocal++;
                    listaTombsTxt.push(tInfo.tomb);
                    const tombRef = itemRef.collection('tombamentos').doc(tInfo.tomb);

                    transaction.set(tombRef, {
                        tomb: tInfo.tomb,
                        serie: tInfo.serie || "N/A",
                        situacao_atual: "DISPONÍVEL",
                        local_id: minhaUnidadeId,
                        unidade_sigla: minhaUnidadeSigla,
                        sub_local: "ALMOXARIFADO CENTRAL",
                        data_entrada: dataReg,
                        criado_por: autorNome
                    });

                    transaction.set(tombRef.collection('historico_vida').doc(idEvento), {
                        data: dataReg,
                        evento: "APORTE_ESTOQUE",
                        quem: autorNome,
                        detalhes: `Incorporado via Aporte. Justificativa: ${observacao}`
                    });
                }

                transaction.update(itemRef, {
                    historico_movimentacoes: firebase.firestore.FieldValue.arrayUnion({
                        data: dataReg,
                        evento: "APORTE_LOTE_PATRIMONIO",
                        quem: autorNome,
                        detalhes: `Aporte de ${qtdEfetivaLocal} unidades em ${minhaUnidadeSigla}. Itens: ${listaTombsTxt.join(', ')}. Obs: ${observacao}`
                    })
                });

            } else {
                qtdEfetivaLocal = Number(quantidade);
                const saldoUnidadeRef = itemRef.collection('saldos_unidades').doc(minhaUnidadeId);
                const snapSaldo = await transaction.get(saldoUnidadeRef);
                const dSaldo = snapSaldo.exists ? snapSaldo.data() : { qtd_total: 0, qtd_disp: 0 };

                transaction.set(saldoUnidadeRef, {
                    unidade_sigla: minhaUnidadeSigla,
                    qtd_total: (dSaldo.qtd_total || 0) + qtdEfetivaLocal,
                    qtd_disp: (dSaldo.qtd_disp || 0) + qtdEfetivaLocal,
                    last_update: dataReg
                }, { merge: true });

                transaction.set(saldoUnidadeRef.collection('historico_vida').doc(idEvento), {
                    data: dataReg,
                    evento: "APORTE_ESTOQUE",
                    quem: autorNome,
                    quantidade: qtdEfetivaLocal,
                    detalhes: `Entrada física de material de consumo. Obs: ${observacao}`
                });
            }

            transaction.update(itemRef, {
                qtd_corporativa_total: (d.qtd_corporativa_total || 0) + qtdEfetivaLocal,
                ultima_movimentacao: dataReg
            });

            // ✅ 2. ATRIBUIÇÃO CRÍTICA: Salva o valor local na variável que "escapa" da transação
            qtdFinalParaExibicao = qtdEfetivaLocal;
        });

        // ✅ 3. USO CORRETO: Referenciando a variável que existe neste escopo
        await Swal.fire({
            icon: 'success',
            title: 'Aporte Concluído!',
            text: `${qtdFinalParaExibicao} unidade(s) adicionada(s) ao estoque de ${minhaUnidadeSigla}.`,
            timer: 2500,
            showConfirmButton: false
        });

        if (typeof carregarAlmoxarifadoUI === 'function') carregarAlmoxarifadoUI();

    } catch (e) {
        console.error("Erro no aporte:", e);
        Swal.fire('Erro no Processamento', e.message, 'error');
    }
}

//--- Função para sincronizar o almoxarifado recalculando os saldos---//
async function sincronizarAlmoxarifado() {
    // 1. CONFIRMAÇÃO PREMIUM
    const { isConfirmed } = await Swal.fire({
        title: 'Recalcular Saldo Global?',
        text: "O sistema fará uma varredura em todas as listas da unidade para sincronizar o inventário. Isso pode levar alguns segundos.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#2c7399',
        confirmButtonText: 'Sim, sincronizar agora',
        cancelButtonText: 'Cancelar'
    });

    if (!isConfirmed) return;

    // Feedback visual de carregamento no Almoxarifado
    const tbody = document.getElementById('almox-body');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;"><i class="fas fa-sync fa-spin"></i> Auditando viaturas da unidade...</td></tr>';

    try {
        const minhaUnidadeId = currentUserData.unidade_id;
        if (!minhaUnidadeId) throw new Error("ID da Unidade não identificado no seu perfil.");

        // ✅ NOVA BUSCA: Busca listas que pertencem à unidade diretamente, sem depender de 'rotas'
        const snapListas = await db.collection('listas_conferencia')
            .where('unidade_id', '==', minhaUnidadeId)
            .get();

        if (snapListas.empty) {
            throw new Error("Nenhuma viatura ou lista vinculada a esta unidade foi encontrada.");
        }

        const inventarioCalculado = {};

        // 2. VARREDURA DE ITENS EM TODAS AS LISTAS ENCONTRADAS
        snapListas.forEach(doc => {
            const data = doc.data().list || [];
            data.forEach(setor => {
                (setor.itens || []).forEach(item => {
                    const uidGlobal = item.uid_global; 
                    if (!uidGlobal) return;

                    if (!inventarioCalculado[uidGlobal]) {
                        inventarioCalculado[uidGlobal] = { emCarga: 0, emAlteracao: 0, tipo: item.tipo };
                    }

                    if (item.tipo === 'single') {
                        const esperado = Number(item.quantidadeEsperada || item.quantidade) || 0;
                        const cautelado = (item.cautelas || []).reduce((s, c) => s + (Number(c.quantidade) || 0), 0);
                        const pendente = (item.pendencias_ids || []).reduce((s, p) => s + (Number(p.quantidade) || 0), 0);

                        inventarioCalculado[uidGlobal].emCarga += (esperado - cautelado - pendente);
                        inventarioCalculado[uidGlobal].emAlteracao += (cautelado + pendente);
                    } else {
                        const tombamentos = item.tombamentos || [];
                        inventarioCalculado[uidGlobal].emCarga += tombamentos.filter(t => !t.cautela && (!t.pendencias_ids || t.pendencias_ids.length === 0)).length;
                        inventarioCalculado[uidGlobal].emAlteracao += tombamentos.filter(t => t.cautela || (t.pendencias_ids && t.pendencias_ids.length > 0)).length;
                    }
                });
            });
        });

        // 3. ATUALIZAÇÃO EM LOTE (BATCH) NO INVENTÁRIO
        const batch = db.batch();
        const dataReg = new Date().toLocaleString('pt-BR');

        for (const [uidGlobal, dados] of Object.entries(inventarioCalculado)) {
            const saldoRef = db.collection('inventario').doc(uidGlobal)
                               .collection('saldos_unidades').doc(minhaUnidadeId);

            if (dados.tipo === 'single') {
                batch.update(saldoRef, {
                    qtd_em_carga: dados.emCarga,
                    qtd_pend: dados.emAlteracao,
                    last_sync: dataReg
                });
            }
            // Itens Multi o status é gerido pelos documentos de tombamentos individuais
        }

        await batch.commit();

        await Swal.fire({
            icon: 'success',
            title: 'Sincronização Concluída',
            text: 'Os saldos de carga e alterações foram atualizados com sucesso.',
            confirmButtonColor: '#1b8a3e'
        });

        if (typeof carregarAlmoxarifadoUI === 'function') await carregarAlmoxarifadoUI();

    } catch (e) {
        console.error("❌ Erro na sincronização:", e);
        Swal.fire('Erro na Sincronização', e.message, 'error');
        if (typeof carregarAlmoxarifadoUI === 'function') carregarAlmoxarifadoUI();
    }
}

/**
 * RENDERIZAÇÃO DA TABELA DO ALMOXARIFADO
 * Ajustada para permitir visão global ao ADMIN e restrita ao GESTOR.
 */
async function carregarAlmoxarifadoUI() {
    const tbody = document.getElementById('almox-body');
    const palcoPrincipal = document.getElementById('container-tabela-principal');
    const wrapperRastreio = document.getElementById('almox-rastreio-wrapper');
    const filtroCard = document.getElementById('almox-filtros-container');
    const breadcrumb = document.getElementById('almox-breadcrumb');

    // Reset de UI padrão V3
    if (palcoPrincipal) palcoPrincipal.style.display = 'block';
    if (wrapperRastreio) wrapperRastreio.style.display = 'none';
    if (breadcrumb) breadcrumb.innerHTML = `Almoxarifado <i class="fas fa-chevron-right" style="font-size:0.7em; margin:0 5px;"></i> Inventário Geral`;

    if (!tbody) return;

    // Loading Padronizado V3
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:60px; color:#64748b;">
        <i class="fas fa-sync fa-spin fa-2x" style="opacity:0.3; margin-bottom:15px; display:block;"></i>
        <span style="font-weight:600;">CONSOLIDANDO INVENTÁRIO...</span>
    </td></tr>`;

    try {
        const role = currentUserData ? currentUserData.role : null;
        const isAdmin = (role === 'admin' || role === 'gestor_geral');
        const temUnidade = !!(currentUserData && currentUserData.unidade_id);

        if (!role || (!isAdmin && !temUnidade)) {
            setTimeout(carregarAlmoxarifadoUI, 1000);
            return;
        }

        const minhaUnidadeId = currentUserData.unidade_id;
        const snapItens = await db.collection('inventario').get();
        const listaFinal = [];

        for (const doc of snapItens.docs) {
            const d = doc.data();
            if (!d) continue;

            const itemConsolidado = {
                id: doc.id,
                nome: d.nome || "Item sem Nome",
                tipo: d.tipo || "single",
                categoria: d.categoria || "OUTROS",
                total: 0, disponivel: 0, emCarga: 0, emAlteracao: 0, locais: []
            };

            if (itemConsolidado.tipo === 'multi') {
                let queryTomb = doc.ref.collection('tombamentos');
                if (!isAdmin) queryTomb = queryTomb.where('local_id', '==', minhaUnidadeId);
                const snapTomb = await queryTomb.get();
                snapTomb.forEach(tDoc => {
                    const t = tDoc.data();
                    itemConsolidado.total++;
                    if (t.situacao_atual === 'DISPONÍVEL') itemConsolidado.disponivel++;
                    else if (t.situacao_atual === 'EM CARGA') itemConsolidado.emCarga++;
                    else if (['AVARIADO', 'PENDENTE', 'MANUTENÇÃO'].includes(t.situacao_atual)) itemConsolidado.emAlteracao++;
                    if (t.local_id && !itemConsolidado.locais.includes(t.local_id)) itemConsolidado.locais.push(t.local_id);
                });
            } else {
                let querySaldo = doc.ref.collection('saldos_unidades');
                if (!isAdmin) querySaldo = querySaldo.where(firebase.firestore.FieldPath.documentId(), '==', minhaUnidadeId);
                const snapSaldo = await querySaldo.get();
                snapSaldo.forEach(sDoc => {
                    const s = sDoc.data();
                    itemConsolidado.total += (Number(s.qtd_total) || 0);
                    itemConsolidado.disponivel += (Number(s.qtd_disp) || 0);
                    itemConsolidado.emCarga += (Number(s.qtd_em_carga) || 0);
                    itemConsolidado.emAlteracao += (Number(s.qtd_pend) || 0) + (Number(s.qtd_caut) || 0) + (Number(s.qtd_transito) || 0);
                    if (s.unidade_sigla && !itemConsolidado.locais.includes(s.unidade_sigla)) itemConsolidado.locais.push(s.unidade_sigla);
                });
            }
            if (itemConsolidado.total > 0 || isAdmin) listaFinal.push(itemConsolidado);
        }

        let html = '';
        listaFinal.sort((a, b) => a.nome.localeCompare(b.nome));

        if (listaFinal.length === 0) {
            html = `<tr><td colspan="6" style="text-align:center; padding:60px; color:#64748b;">
                <i class="fas fa-box-open fa-3x" style="opacity:0.2; margin-bottom:15px; display:block;"></i>
                <span style="font-weight:600;">Nenhum material localizado.</span>
            </td></tr>`;
        } else {
            listaFinal.forEach(d => {
                // Cores baseadas no design System V3
                let statusColor = (d.disponivel === 0) ? '#e11d48' : (d.disponivel < (d.total * 0.25)) ? '#f59e0b' : '#10b981';

                const labelLocais = isAdmin && d.locais.length > 0
                    ? `<div style="margin-top:4px;"><span style="font-size:10px; background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-weight:bold;"><i class="fas fa-map-marker-alt"></i> ${d.locais.join(', ')}</span></div>`
                    : '';

                html += `
                <tr data-categoria="${d.categoria.toUpperCase()}">
                    <td>
                        <div style="line-height:1.4;">
                            <span style="font-weight:700; color:#1e293b; font-size:1.1em;">${d.nome}</span>
                            ${labelLocais}
                            <div style="font-size:10px; color:#94a3b8; font-weight:700; text-transform:uppercase; margin-top:2px;">CAT: ${d.categoria} • ${d.tipo}</div>
                        </div>
                    </td>
                    <td style="text-align:center; font-weight:700; color:#475569;">${d.total}</td>
                    <td style="text-align:center; color:#64748b;">${d.emCarga}</td>
                    <td style="text-align:center; color:#e11d48; font-weight:600;">${d.emAlteracao}</td>
                    <td style="text-align:center;">
                        <span style="display:inline-block; padding:4px 12px; border-radius:8px; background:${statusColor}15; color:${statusColor}; font-weight:800; font-size:1.1em;">
                            ${d.disponivel}
                        </span>
                    </td>
                    <td>
                        <div style="display:flex; gap:8px; justify-content:center;">
                            <button class="sigma-v3-tab" title="Rastrear" onclick="verDetalhesItemAlmox('${d.id}')" style="padding:8px 12px; background:#f1f5f9;">
                                <i class="fas fa-search-location"></i>
                            </button>
                            <button class="sigma-v3-tab" title="Entrada" onclick="prepararAporte('${d.id}')" style="padding:8px 12px; background:#800020; color:white;">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
            });
        }
        tbody.innerHTML = html;
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#e11d48; padding:20px; font-weight:bold;">ERRO NA CONSOLIDAÇÃO</td></tr>';
    }
}
/**
 * Filtro de pesquisa unificado (Texto + Categoria) com feedback de lista vazia.
 */
function filtrarAlmoxarifado() {
    const searchInput = document.getElementById('almox-search');
    const catSelect = document.getElementById('almox-cat-filter');
    const searchTerm = searchInput.value.toUpperCase().trim();
    const categoryTerm = catSelect.value.toUpperCase().trim();
    const tbody = document.getElementById('almox-body');
    const rows = tbody.querySelectorAll('tr:not(.no-results-row)');

    let visibleCount = 0;

    rows.forEach(row => {
        if (!row.hasAttribute('data-categoria')) return;

        const textMaterial = row.cells[0]?.textContent.toUpperCase() || "";
        const itemCategory = row.getAttribute('data-categoria').toUpperCase().trim();

        const matchesSearch = textMaterial.includes(searchTerm);
        const matchesCategory = (categoryTerm === "" || itemCategory === categoryTerm);

        if (matchesSearch && matchesCategory) {
            row.style.display = "";
            visibleCount++;
        } else {
            row.style.display = "none";
        }
    });

    // --- LÓGICA DE MENSAGEM V3 ---
    const existingMsg = tbody.querySelector('.no-results-row');
    if (existingMsg) existingMsg.remove();

    if (visibleCount === 0) {
        const tr = document.createElement('tr');
        tr.className = 'no-results-row';
        tr.innerHTML = `
            <td colspan="6" style="text-align:center; padding:60px; color:#64748b;">
                <div style="display:flex; flex-direction:column; align-items:center; gap:12px;">
                    <i class="fas fa-box-open fa-3x" style="opacity:0.2; color:#94a3b8;"></i>
                    <span style="font-weight:600; font-size:0.95em;">Nenhum material localizado nos filtros atuais.</span>
                    <button onclick="document.getElementById('almox-search').value=''; document.getElementById('almox-cat-filter').value=''; filtrarAlmoxarifado();" 
                            style="margin-top:8px; padding:8px 16px; border-radius:8px; border:1px solid #e2e8f0; background:#fff; color:#800020; cursor:pointer; font-weight:700; font-size:0.8em; transition:0.3s; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                        <i class="fas fa-filter-circle-xmark"></i> LIMPAR BUSCA
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    }
}

async function verDetalhesItemAlmox(docId) {
    const palcoPrincipal = document.getElementById('container-tabela-principal');
    const palcoRastreio = document.getElementById('almox-rastreio-wrapper');
    const tbodyRastreio = document.getElementById('almox-rastreio-body');
    const theadRastreio = document.getElementById('almox-rastreio-thead');
    const filtroCard = document.getElementById('almox-filtros-container');
    const breadcrumb = document.getElementById('almox-breadcrumb');

    if (!docId || !palcoPrincipal || !palcoRastreio) return;

    palcoPrincipal.style.display = 'none';
    // ✅ ALTERAÇÃO CIRÚRGICA: Removida a linha que ocultava o filtroCard (display = 'none')
    // O filtro agora permanece visível para permitir buscas dentro dos detalhes do item.
    palcoRastreio.style.display = 'block';

    tbodyRastreio.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:60px; color:#64748b;">
        <i class="fas fa-radar fa-spin fa-3x" style="opacity:0.3; margin-bottom:15px; display:block;"></i>
        <span style="font-weight:600;">MAPEANDO LOGÍSTICA ESTADUAL...</span>
    </td></tr>`;

    try {
        const docAlvo = await db.collection('inventario').doc(docId).get();
        if (!docAlvo.exists) throw new Error("Item não encontrado.");

        const itemData = docAlvo.data();
        const ehMulti = itemData.tipo === 'multi';
        const uidGlobal = itemData.uid_global || docId;
        const role = currentUserData.role;
        const souAdminGeral = (role === 'admin' || role === 'gestor_geral');

        if (breadcrumb) breadcrumb.innerHTML = `Almoxarifado <i class="fas fa-chevron-right" style="font-size:0.7em; margin:0 5px;"></i> Detalhes <i class="fas fa-chevron-right" style="font-size:0.7em; margin:0 5px;"></i> <b style="color:#800020;">${itemData.nome}</b>`;

        const btnHistGlobal = !ehMulti ?
            `<button class="sigma-v3-tab" title="Ver histórico de movimentações do lote" onclick="verHistoricoVidaGlobal('${docId}')" style="background:#fef3c7; color:#92400e; border:none;"><i class="fas fa-history"></i> Lote</button>` : '';

        const headerHtml = `
            <div id="header-detalhe-item" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding:15px; background:#f8fafc; border-radius:12px;">
                <div>
                    <h2 style="margin:0; color:#1e293b; font-size:1.4em; font-weight:800;">${itemData.nome}</h2>
                    <small style="color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Rastreio em Tempo Real</small>
                </div>
                ${btnHistGlobal}
            </div>`;

        const oldHeader = document.getElementById('header-detalhe-item');
        if (oldHeader) oldHeader.remove();
        palcoRastreio.prepend(new DOMParser().parseFromString(headerHtml, 'text/html').body.firstChild);

        theadRastreio.innerHTML = `
            <tr>
                ${ehMulti ? '<th>Tombamento / Unidade</th>' : '<th>Localização / Unidade</th>'}
                <th style="text-align:center;">Saldo</th>
                <th style="text-align:center;">Status</th>
                <th style="text-align:right;">Ações</th>
            </tr>`;

        let htmlPrioridade = ''; let htmlRestante = '';
        let cDisp = 0, cUso = 0, cCaut = 0, cPend = 0;
        const pendenciasVtrMap = {};

        // --- 1. PROCESSAMENTO DE ESTOQUE (ALMOXARIFADO) ---
        if (ehMulti) {
            const snapTombs = await db.collection('inventario').doc(docId).collection('tombamentos').get();
            for (const tDoc of snapTombs.docs) {
                const t = tDoc.data();
                const ehDono = (t.local_id === currentUserData.unidade_id);
                const podeEnviar = (souAdminGeral && t.local_id === "ADMIN") || (ehDono && !souAdminGeral);
                if (!t.viatura_id) {
                    const temP = t.pendencias_ids?.length > 0;
                    if (ehDono || souAdminGeral) { if (temP) cPend++; else cDisp++; }
                    const statusTxt = temP ? 'PENDENTE' : 'DISPONÍVEL';
                    const badgeStyle = temP ? 'background:#fee2e2;color:#b91c1c;' : 'background:#dcfce7;color:#15803d;';
                    let bufferHtml = `
                        <tr style="background:${ehDono ? 'rgba(16,185,129,0.03)' : '#fff'};">
                            <td><span style="font-weight:700; color:#1e293b;">${t.tomb}</span><br><small style="color:#64748b;"><i class="fas fa-warehouse"></i> ${t.unidade_sigla || '---'}</small></td>
                            <td style="text-align:center; font-weight:800; color:#1e293b;">1 un.</td>
                            <td style="text-align:center;"><span style="padding:4px 10px; border-radius:6px; font-size:0.75em; font-weight:800; ${badgeStyle}">${statusTxt}</span></td>
                            <td style="text-align:right;">
                                <div style="display:flex; gap:5px; justify-content:flex-end;">
                                    ${podeEnviar ? `<button onclick="prepararMovimentacao('${docId}','ENVIO','${t.tomb}')" title="Enviar para outra unidade" class="sigma-v3-tab active" style="padding:6px 10px; background:#800020;"><i class="fas fa-paper-plane"></i></button>` : ''}
                                    <button onclick="verHistoricoVidaGlobal('${docId}', '${t.tomb}')" title="Ver histórico individual" class="sigma-v3-tab" style="padding:6px 10px; background:#fef3c7; color:#92400e;"><i class="fas fa-history"></i></button>
                                </div>
                            </td>
                        </tr>`;
                    if (ehDono) htmlPrioridade += bufferHtml; else htmlRestante += bufferHtml;
                }
            }
        } else {
            const snapSaldos = await db.collection('inventario').doc(docId).collection('saldos_unidades').get();
            for (const sDoc of snapSaldos.docs) {
                const s = sDoc.data();
                const ehDono = (sDoc.id === currentUserData.unidade_id);
                const podeEnviar = (souAdminGeral && sDoc.id === "ADMIN") || (ehDono && !souAdminGeral);

                const snapLogs = await sDoc.ref.collection('historico_vida').where('evento', '==', 'PENDENCIA_RELATADA').get();
                let pendenciaVazanteParaVtr = 0;

                snapLogs.forEach(logDoc => {
                    const log = logDoc.data();
                    if (log.lista_origem_id) {
                        pendenciasVtrMap[log.lista_origem_id] = (pendenciasVtrMap[log.lista_origem_id] || 0) + (log.quantidade || 0);
                        pendenciaVazanteParaVtr += (log.quantidade || 0);
                    }
                });

                const saldoDispRealAlmox = Number(s.qtd_disp) || 0;
                const saldoPendLocalAlmox = (Number(s.qtd_pend) || 0) - pendenciaVazanteParaVtr;
                const saldoFisicoNoAlmox = saldoDispRealAlmox + saldoPendLocalAlmox;

                if (ehDono || souAdminGeral) { cDisp += saldoDispRealAlmox; }

                if (saldoFisicoNoAlmox > 0) {
                    let statusHtml = '';
                    if (saldoDispRealAlmox > 0 && saldoPendLocalAlmox > 0) {
                        statusHtml = `<div><span style="font-size:0.75em; font-weight:800; color:#15803d;">${saldoDispRealAlmox} un. DISPONÍVEL</span></div>
                                      <div style="margin-top:2px;"><span style="padding:2px 8px; border-radius:4px; font-size:0.7em; font-weight:800; background:#fee2e2; color:#b91c1c;">${saldoPendLocalAlmox} un. PENDENTE</span></div>`;
                    } else if (saldoPendLocalAlmox > 0) {
                        statusHtml = `<span style="padding:4px 10px; border-radius:6px; font-size:0.75em; font-weight:800; background:#fee2e2; color:#b91c1c;">${saldoPendLocalAlmox} un. PENDENTE</span>`;
                    } else {
                        statusHtml = `<span style="padding:4px 10px; border-radius:6px; font-size:0.75em; font-weight:800; background:#dcfce7; color:#15803d;">DISPONÍVEL</span>`;
                    }

                    let bufferHtml = `
                        <tr style="background:${ehDono ? 'rgba(16,185,129,0.03)' : '#fff'};">
                            <td><i class="fas fa-warehouse" style="margin-right:8px; color:#64748b;"></i><span style="font-weight:700;">${s.unidade_sigla}</span></td>
                            <td style="text-align:center; font-weight:800; color:#1e293b;">${saldoFisicoNoAlmox} un.</td>
                            <td style="text-align:center;">${statusHtml}</td>
                            <td style="text-align:right;">
                                ${podeEnviar ? `<button onclick="prepararMovimentacao('${docId}','ENVIO')" title="Transferir saldo" class="sigma-v3-tab active" style="background:#800020;"><i class="fas fa-paper-plane"></i></button>` : ''}
                            </td>
                        </tr>`;
                    if (ehDono) htmlPrioridade += bufferHtml; else htmlRestante += bufferHtml;
                }
            }
        }

        // --- 2. BUSCA EM VIATURAS ---
        const snapListas = await db.collection('listas_conferencia').where('ativo', '==', true).get();
        snapListas.forEach(docVtr => {
            const vtrData = docVtr.data();
            const ehMinhaVtr = (vtrData.unidade_id === currentUserData.unidade_id);

            (vtrData.list || []).forEach(setor => {
                (setor.itens || []).forEach(itemPrincipal => {

                    // A. Verifica se o item principal é o alvo
                    let itemAlvo = null;
                    let infoAdicional = "";

                    if (itemPrincipal.uid_global === uidGlobal || itemPrincipal.nome === itemData.nome) {
                        itemAlvo = itemPrincipal;
                    }
                    // ✅ NOVO: B. Verifica se o alvo está "escondido" dentro de um Kit (Acessórios)
                    else if (itemPrincipal.acessorios_acoplados) {
                        const ac = itemPrincipal.acessorios_acoplados.find(a => a.uid_global === uidGlobal);
                        if (ac) {
                            itemAlvo = ac;
                            infoAdicional = ` <small style="color:#800020; font-weight:800;">[NO KIT: ${itemPrincipal.nome}]</small>`;
                        }
                    }

                    if (!itemAlvo) return;

                    if (ehMulti) {
                        // ... (Mantenha sua lógica original de Multi aqui se necessário, 
                        // mas geralmente itens Multi como Suportes Dorsais são os Pais)
                        (itemAlvo.tombamentos || []).forEach(t => {
                            const temC = !!t.cautela; const temP = t.pendencias_ids?.length > 0;
                            if (ehMinhaVtr || souAdminGeral) { if (temP) cPend++; else if (temC) cCaut++; else cUso++; }
                            const statusTxt = temP ? 'PENDENTE' : (temC ? 'CAUTELADO' : 'EM USO');
                            const badgeStyle = temP ? 'background:#fee2e2;color:#b91c1c;' : (temC ? 'background:#fff3cd;color:#856404;' : 'background:#f1f5f9;color:#475569;');
                            let bufferVtr = `<tr style="background:${ehMinhaVtr ? 'rgba(16,185,129,0.03)' : '#fff'};">
                                <td><span style="font-weight:700;">${t.tomb}</span>${infoAdicional}<br><small style="color:#64748b;"><i class="fas fa-truck-container" style="margin-right:5px;"></i> ${vtrData.ativo_nome}</small></td>
                                <td style="text-align:center; font-weight:800; color:#1e293b;">1 un.</td>
                                <td style="text-align:center;"><span style="padding:4px 10px; border-radius:6px; font-size:0.75em; font-weight:800; ${badgeStyle}">${statusTxt}</span></td>
                                <td style="text-align:right;">
                                    <div style="display:flex; gap:5px; justify-content:flex-end;">
                                        ${ehMinhaVtr || role === 'admin' ? `<button onclick="prepararMovimentacao('${docId}','RECOLHIMENTO','${t.tomb}','${docVtr.id}')" title="Retornar ao estoque" class="sigma-v3-tab" style="background:#f59e0b; color:white;"><i class="fas fa-arrow-down"></i></button>` : ''}
                                        <button onclick="verHistoricoVidaGlobal('${docId}', '${t.tomb}')" title="Ver histórico" class="sigma-v3-tab" style="padding:6px 10px; background:#fef3c7; color:#92400e;"><i class="fas fa-history"></i></button>
                                    </div>
                                </td>
                            </tr>`;
                            if (ehMinhaVtr) htmlPrioridade += bufferVtr; else htmlRestante += bufferVtr;
                        });
                    } else {
                        // Lógica para itens SINGLE (Cilindros, Máscaras, etc.)
                        const qtdFisicaVtr = Number(itemAlvo.quantidadeEsperada || itemAlvo.quantidade) || 0;
                        const qtdPendVtr = pendenciasVtrMap[docVtr.id] || 0;
                        const qtdEmUsoLimpa = qtdFisicaVtr - qtdPendVtr;

                        if (ehMinhaVtr || souAdminGeral) {
                            cUso += qtdEmUsoLimpa;
                            cPend += qtdPendVtr;
                        }

                        if (qtdFisicaVtr > 0) {
                            let statusHtml = '';
                            if (qtdEmUsoLimpa > 0 && qtdPendVtr > 0) {
                                statusHtml = `<div><span style="font-size:0.75em; font-weight:800; color:#475569;">${qtdEmUsoLimpa} un. EM USO</span></div>
                                              <div style="margin-top:2px;"><span style="padding:2px 8px; border-radius:4px; font-size:0.7em; font-weight:800; background:#fee2e2; color:#b91c1c;">${qtdPendVtr} un. PENDENTE</span></div>`;
                            } else if (qtdPendVtr > 0) {
                                statusHtml = `<span style="padding:4px 10px; border-radius:6px; font-size:0.75em; font-weight:800; background:#fee2e2; color:#b91c1c;">${qtdPendVtr} un. PENDENTE</span>`;
                            } else {
                                statusHtml = `<span style="padding:4px 10px; border-radius:6px; font-size:0.75em; font-weight:800; background:#f1f5f9; color:#475569;">EM USO</span>`;
                            }

                            let bufferVtr = `<tr style="background:${ehMinhaVtr ? 'rgba(16,185,129,0.03)' : '#fff'};">
                                <td><i class="fas fa-truck-pickup" style="margin-right:8px; color:#64748b;"></i><span style="font-weight:700;">${vtrData.ativo_nome}</span>${infoAdicional}</td>
                                <td style="text-align:center; font-weight:800; color:#1e293b;">${qtdFisicaVtr} un.</td>
                                <td style="text-align:center;">${statusHtml}</td>
                                <td style="text-align:right;">
                                    ${ehMinhaVtr || role === 'admin' ?
                                    `<button onclick="prepararMovimentacao('${docId}','RECOLHIMENTO', null,'${docVtr.id}')" title="Recolher material" class="sigma-v3-tab" style="background:#f59e0b; color:white;"><i class="fas fa-arrow-down"></i></button>` : ''}
                                </td>
                            </tr>`;
                            if (ehMinhaVtr) htmlPrioridade += bufferVtr; else htmlRestante += bufferVtr;
                        }
                    }
                });
            });
        });

        let finalHtml = "";
        if (htmlPrioridade) {
            finalHtml += `<tr class="sigma-v3-table-group-header"><td colspan="4" style="background:#f0fdf4; color:#166534; font-weight:800; font-size:0.75em; padding:10px 15px; text-transform:uppercase; letter-spacing:1px; border-left:4px solid #10b981;"><i class="fas fa-shield-alt"></i> Custódia de Minha Unidade (Estoque Local)</td></tr>`;
            finalHtml += htmlPrioridade;
        }
        if (htmlRestante) {
            finalHtml += `<tr class="sigma-v3-table-group-header"><td colspan="4" style="background:#f8fafc; color:#64748b; font-weight:800; font-size:0.75em; padding:25px 15px 10px 15px; text-transform:uppercase; letter-spacing:1px; border-left:4px solid #cbd5e1;"><i class="fas fa-globe-americas"></i> Disponibilidade em Outras Unidades (Consulta Global)</td></tr>`;
            finalHtml += htmlRestante;
        }

        const totalG = cDisp + cUso + cCaut + cPend;
        const extratoHtml = `
            <div id="almox-resumo-topo" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap:15px; margin-bottom:25px;">
                <div style="background:#dcfce7; padding:15px; border-radius:12px; text-align:center; border:1px solid #bcf0da;">
                    <small style="color:#15803d; font-weight:800; display:block; font-size:0.7em; text-transform:uppercase;">Disponível</small>
                    <b style="font-size:1.6em; color:#15803d;">${cDisp}</b>
                </div>
                <div style="background:#f1f5f9; padding:15px; border-radius:12px; text-align:center; border:1px solid #e2e8f0;">
                    <small style="color:#475569; font-weight:800; display:block; font-size:0.7em; text-transform:uppercase;">Em Uso</small>
                    <b style="font-size:1.6em; color:#475569;">${cUso}</b>
                </div>
                <div style="background:#fff3cd; padding:15px; border-radius:12px; text-align:center; border:1px solid #ffeeba;">
                    <small style="color:#856404; font-weight:800; display:block; font-size:0.7em; text-transform:uppercase;">Cautelado</small>
                    <b style="font-size:1.6em; color:#856404;">${cCaut}</b>
                </div>
                <div style="background:#fee2e2; padding:15px; border-radius:12px; text-align:center; border:1px solid #fecaca;">
                    <small style="color:#b91c1c; font-weight:800; display:block; font-size:0.7em; text-transform:uppercase;">Pendente</small>
                    <b style="font-size:1.6em; color:#b91c1c;">${cPend}</b>
                </div>
                <div style="background:#800020; padding:15px; border-radius:12px; text-align:center;">
                    <small style="color:#fff; font-weight:800; display:block; font-size:0.7em; text-transform:uppercase;">Total Geral</small>
                    <b style="font-size:1.6em; color:#fff;">${totalG}</b>
                </div>
            </div>`;

        const resOld = document.getElementById('almox-resumo-topo');
        if (resOld) resOld.remove();
        palcoRastreio.querySelector('#header-detalhe-item').insertAdjacentHTML('afterend', extratoHtml);
        tbodyRastreio.innerHTML = finalHtml || `<tr><td colspan="4" style="text-align:center; padding:60px; color:#64748b;"><i class="fas fa-box-open fa-3x" style="opacity:0.2; margin-bottom:15px; display:block;"></i>Nenhum registro localizado.</td></tr>`;

    } catch (e) {
        console.error(e);
        tbodyRastreio.innerHTML = '<tr><td colspan="4" style="color:#e11d48; text-align:center; font-weight:bold; padding:40px;">ERRO NO PROCESSAMENTO DE RASTREIO</td></tr>';
    }
}

/**
 * Função de ponte que prepara o modal de transferência com os dados clicados na lupa
 */
async function prepararMovimentacao(docId, operacao, tombamento = null, viaturaId = null) {
    // 1. Busca os dados do item no Inventário V3 antes de abrir o modal
    const docAlvo = await db.collection('inventario').doc(docId).get();
    if (!docAlvo.exists) return alert("Erro ao localizar item no inventário.");

    const itemData = docAlvo.data();
    const ehMulti = itemData.tipo === 'multi';
    const role = currentUserData.role;
    const souAdmin = (role === 'admin' || role === 'gestor_geral');

    // ✅ NOVO: INTERCEPTAÇÃO DE ANFITRIÃO (Apenas no ENVIO)
    // Se o item for um anfitrião (Kit) e estiver saindo do estoque
    if (operacao === 'ENVIO' && itemData.is_anfitriao && !souAdmin) {
        return abrirModalAcoplamentoAnfitriao(docId, itemData, tombamento);
    }

    // 2. Define Identidade Visual (Cores e Títulos)
    const config = {
        ENVIO: {
            titulo: souAdmin ? "Transferência de Unidade" : "Enviar para Viatura",
            cor: "#2c7399",
            icone: "fa-paper-plane",
            btnTexto: souAdmin ? "CONFIRMAR TRANSFERÊNCIA" : "CONFIRMAR ENVIO"
        },
        RECOLHIMENTO: {
            titulo: "Recolher para Almoxarifado",
            cor: "#f57c00",
            icone: "fa-arrow-down",
            btnTexto: "CONFIRMAR RECOLHIMENTO"
        }
    }[operacao];

    // 3. Monta o Modal SweetAlert2 Moderno
    Swal.fire({
        title: `<i class="fas ${config.icone}"></i> ${config.titulo}`,
        html: `
            <div style="text-align: left; padding: 5px;">
                <div class="summary-item-modal" style="background:#f8fafc; padding:10px; border-radius:8px; margin-bottom:15px; border-left:4px solid ${config.cor};">
                    <small style="color:#64748b; font-weight:700; text-transform:uppercase; font-size:0.7em;">Item Selecionado</small>
                    <div style="font-weight:800; color:#1e293b; font-size:1.1em;">${itemData.nome}</div>
                </div>

                <div class="form-group">
                    <label style="font-size: 0.85em; font-weight:bold; color:#800020;">
                        ${souAdmin ? '1. UNIDADE DE DESTINO:' : '1. VIATURA / LOCAL ALVO:'}
                    </label>
                    <select id="swal-mov-destino" class="swal2-select" style="width: 100%; margin: 10px 0;">
                        <option value="" disabled selected>Selecione o destino...</option>
                    </select>
                </div>

                ${!souAdmin && operacao === 'ENVIO' ? `
                <div class="form-group" style="margin-top:15px;">
                    <label style="font-size: 0.85em; font-weight:bold; color:#800020;">2. SETOR DE CARGA:</label>
                    <select id="swal-mov-setor" class="swal2-select" style="width: 100%; margin: 10px 0;">
                        <option value="CABINE">CABINE</option>
                        <option value="CARROCERIA">CARROCERIA</option>
                    </select>
                </div>` : ''}

                <div class="form-group" style="margin-top:15px;">
                    <label id="label-qtd-swal" style="font-size: 0.85em; font-weight:bold; color:#800020;">
                        ${ehMulti ? 'PATRIMÔNIO / TOMBAMENTO:' : 'QUANTIDADE PARA MOVIMENTAR:'}
                    </label>
                    
                    ${ehMulti ? `
                        <div id="lista-tomb-swal" style="max-height:150px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:6px; padding:10px; margin-top:5px; background:#fff;">
                            <i class="fas fa-spinner fa-spin"></i> Carregando materiais...
                        </div>
                    ` : `
                        <input type="number" id="swal-mov-qtd" class="swal2-input" 
                            style="width:80%; margin:10px 0;" placeholder="0" min="1" max="0"
                            oninput="if(parseInt(this.value) > parseInt(this.max)) { this.value = this.max; Swal.showValidationMessage('Saldo insuficiente! Máximo: ' + this.max); } else { Swal.resetValidationMessage(); }">
                    `}
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: config.btnTexto,
        confirmButtonColor: config.cor,
        cancelButtonText: 'Cancelar',
        didOpen: async () => {
            await popularDestinosMovimentacao(souAdmin, operacao, viaturaId);

            if (ehMulti) {
                await popularTombamentosMovimentacao(docId, operacao, tombamento, viaturaId, config.cor);
            } else {
                try {
                    const minhaUnidadeId = currentUserData.unidade_id;
                    const snapSaldo = await db.collection('inventario').doc(docId)
                        .collection('saldos_unidades').doc(minhaUnidadeId).get();

                    const saldoDisp = snapSaldo.exists ? (snapSaldo.data().qtd_disp || 0) : 0;
                    const inputQtd = document.getElementById('swal-mov-qtd');
                    const labelQtd = document.getElementById('label-qtd-swal');

                    if (inputQtd) {
                        inputQtd.max = saldoDisp;
                        if (labelQtd) {
                            labelQtd.innerHTML = `QUANTIDADE PARA MOVIMENTAR: <span style="float:right; color:#1b8a3e;">Saldo Disponível: ${saldoDisp}</span>`;
                        }
                        if (saldoDisp <= 0 && operacao === 'ENVIO') {
                            inputQtd.disabled = true;
                            Swal.showValidationMessage('Atenção: Esta unidade não possui saldo disponível para envio.');
                        }
                    }
                } catch (e) { console.error("Erro ao carregar saldo:", e); }
            }
        },
        preConfirm: () => {
            const destino = document.getElementById('swal-mov-destino').value;
            const inputQtd = document.getElementById('swal-mov-qtd');

            if (!destino) return Swal.showValidationMessage('Por favor, selecione o destino');

            if (inputQtd) {
                const qtdValor = parseInt(inputQtd.value);
                const qtdMax = parseInt(inputQtd.max);

                if (!qtdValor || qtdValor <= 0) return Swal.showValidationMessage('Informe uma quantidade válida');
                if (qtdValor > qtdMax && operacao === 'ENVIO') {
                    return Swal.showValidationMessage(`Saldo insuficiente! Você só possui ${qtdMax} unidades.`);
                }

                return {
                    destinoId: destino,
                    quantidade: qtdValor,
                    tombamentos: null,
                    setorId: document.getElementById('swal-mov-setor')?.value || 'CABINE'
                };
            }

            return {
                destinoId: destino,
                quantidade: null,
                tombamentos: ehMulti ? Array.from(document.querySelectorAll('.swal-tomb-check:checked')).map(cb => cb.value) : null,
                setorId: document.getElementById('swal-mov-setor')?.value || 'CABINE'
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            executarMovimentacaoReal(docId, operacao, result.value);
        }
    });
}

// Adicionado o parâmetro setorDestinoIdx para saber onde inserir ao confirmar
async function abrirModalAcoplamentoAnfitriao(docId, itemData, tombamentoAlvo = null, setorDestinoIdx = null) {
    const minhaUnidadeId = currentUserData.unidade_id;
    const componentesRegra = itemData.componentes_regra || [];

    const isNoEditor = (document.getElementById('view-editor-arquitetura').style.display === 'block');

    Swal.fire({
        title: 'Montagem de Kit / Acoplamento',
        width: '600px',
        html: `
            <div style="text-align: left; padding: 5px;">
                <div style="background: #fff8e1; padding: 12px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #ffe0b2;">
                    <small style="color: #e65100; font-weight: 800; text-transform: uppercase; font-size: 0.7em;">Item Anfitrião Identificado</small>
                    <div style="font-weight: 800; color: #333; font-size: 1.1em;">${itemData.nome} ${tombamentoAlvo ? `[TOMB: ${tombamentoAlvo}]` : ''}</div>
                    <p style="font-size: 0.8em; margin: 5px 0 0 0; color: #666;">
                        ${isNoEditor ? 'Selecione os acessórios que compõem este conjunto para a lista atual.' : 'Deseja acoplar acessórios a este item antes de enviar?'}
                    </p>
                </div>

                <div id="container-acoplamento-dinamico">
                    <i class="fas fa-sync fa-spin"></i> Consultando estoque...
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'CONFIRMAR COMPOSIÇÃO',
        confirmButtonColor: '#1b8a3e',
        cancelButtonText: 'CANCELAR',
        didOpen: async () => {
            const container = document.getElementById('container-acoplamento-dinamico');
            let htmlComponentes = "";

            if (componentesRegra.length === 0) {
                container.innerHTML = `<p style="font-size:0.85em; color:#94a3b8;">Nenhuma regra de montagem definida.</p>`;
                return;
            }

            for (const regra of componentesRegra) {
                const snapEstoque = await db.collection('inventario')
                    .where(firebase.firestore.FieldPath.documentId(), '>=', regra.familia_uid)
                    .where(firebase.firestore.FieldPath.documentId(), '<=', regra.familia_uid + '\uf8ff')
                    .get();

                let optionsItens = `<option value="">Não acoplar ${regra.nome_familia}</option>`;
                let temDisponivel = false;

                for (const docIt of snapEstoque.docs) {
                    const itGlobal = docIt.data();
                    const saldoDoc = await docIt.ref.collection('saldos_unidades').doc(minhaUnidadeId).get();

                    if (saldoDoc.exists) {
                        const disponivel = Number(saldoDoc.data().qtd_disp) || 0;
                        if (disponivel > 0) {
                            temDisponivel = true;
                            optionsItens += `<option value="${docIt.id}">${itGlobal.nome} (Disp: ${disponivel})</option>`;
                        }
                    }
                }

                htmlComponentes += `
                    <div class="linha-acoplamento" style="margin-bottom: 15px; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
                        <label style="display:block; font-weight:800; font-size:0.7em; color:#64748b; text-transform:uppercase; margin-bottom:8px;">${regra.nome_familia}</label>
                        <div style="display:flex; gap:10px;">
                            <select class="swal2-select select-item-acoplar" style="flex:2; margin:0; font-size:0.85em; height: 42px;">
                                ${temDisponivel ? optionsItens : `<option value="">Sem saldo em ${currentUserData.unidade}</option>`}
                            </select>
                            <input type="number" class="swal2-input input-qtd-acoplar" value="${temDisponivel ? regra.qtd_sugerida : 0}" min="1" style="flex:0.5; margin:0; height:42px; font-size:0.9em; text-align:center;" ${!temDisponivel ? 'disabled' : ''}>
                        </div>
                    </div>`;
            }
            container.innerHTML = htmlComponentes;
        },
        preConfirm: () => {
            const acoplados = [];
            const linhas = document.querySelectorAll('.linha-acoplamento');

            linhas.forEach(linha => {
                const select = linha.querySelector('.select-item-acoplar');
                const input = linha.querySelector('.input-qtd-acoplar');

                if (select && select.value) {
                    acoplados.push({
                        uid_global: select.value,
                        nome: select.options[select.selectedIndex].text.split(' (Disp:')[0],
                        quantidade: parseInt(input.value) || 0
                    });
                }
            });
            return acoplados;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const acopladosConfirmados = result.value || [];

            if (isNoEditor) {
                itemSelecionadoTemp = {
                    ...itemData,
                    id_almox: docId,
                    tombamentoExibicao: tombamentoAlvo,
                    acessorios_acoplados: acopladosConfirmados,
                    acessorios_ja_montados: true
                };

                exibirDraftCard(`${itemData.nome} [TOMB: ${tombamentoAlvo}] + ${acopladosConfirmados.length} acessórios`);

                // ✅ AJUSTE AQUI: Chama a gravação final diretamente
                if (setorDestinoIdx !== null) {
                    executarInsercaoNoSetor(setorDestinoIdx);
                } else {
                    setTimeout(() => {
                        const selectSetor = document.getElementById('select-setor-destino');
                        if (selectSetor) {
                            selectSetor.focus();
                            selectSetor.style.border = "2px solid #2c7399";
                        }
                    }, 100);
                }

            } else {
                executarMovimentacaoAnfitriao(docId, 'ENVIO', {
                    tombamento: tombamentoAlvo,
                    acessorios: acopladosConfirmados
                });
            }
        } else {
            // Se cancelar, reseta o select para o usuário não achar que o item foi adicionado
            const selectSetor = document.getElementById('select-setor-destino');
            if (selectSetor) selectSetor.value = "";
        }
    });
}

function executarInsercaoNoSetor(setorIdx) {
    const selectSetor = document.getElementById('select-setor-destino');
    const inputBusca = document.getElementById('input-busca-estoque');

    const novoItem = {
        uid_global: itemSelecionadoTemp.uid_global || itemSelecionadoTemp.id_almox,
        nome: itemSelecionadoTemp.nome,
        tipo: itemSelecionadoTemp.tipo,
        quantidadeEsperada: 0,
        is_anfitriao: itemSelecionadoTemp.is_anfitriao || false
    };

    // Recupera os acessórios (se houver)
    const acessorios = itemSelecionadoTemp.acessorios_acoplados || itemSelecionadoTemp.acessoriosEscolhidos;
    if (novoItem.is_anfitriao && acessorios) {
        novoItem.acessorios_acoplados = JSON.parse(JSON.stringify(acessorios));
    }

    // Define Saldos/Tombamentos
    if (itemSelecionadoTemp.tipo === 'single') {
        novoItem.quantidadeEsperada = itemSelecionadoTemp.quantidadeEscolhida || 1;
    } else {
        novoItem.tombamentos = [{
            tomb: itemSelecionadoTemp.tombamentoExibicao,
            situacao: "EM CARGA"
        }];
        novoItem.quantidadeEsperada = 1;
    }

    // Inserção na Arquitetura Ativa
    if (!arquiteturaAtiva[setorIdx].itens) arquiteturaAtiva[setorIdx].itens = [];
    arquiteturaAtiva[setorIdx].itens.push(novoItem);

    // LIMPEZA E FINALIZAÇÃO
    cancelarRascunho();

    if (selectSetor) {
        selectSetor.value = "";
        selectSetor.style.border = "1px solid #cbd5e1";
    }

    // Só mescla se NÃO for kit
    if (!novoItem.is_anfitriao) {
        processarMesclagemAutomatica(setorIdx);
    }

    marcarAlteracao();
    renderizarArquiteturaEditor();

    if (inputBusca) {
        inputBusca.value = '';
        inputBusca.focus();
    }
}

async function executarMovimentacaoAnfitriao(uidAnfitriao, operacao, dadosKit) {
    const { tombamento, acessorios } = dadosKit;
    const minhaUnidadeId = currentUserData.unidade_id;
    const dataReg = new Date().toLocaleString('pt-BR');
    const autor = currentUserData.nome_militar_completo;

    const { value: formValues } = await Swal.fire({
        title: '<span style="font-size: 1.2em; font-weight: 800; color: #1e293b;">Destino do Conjunto</span>',
        width: '500px',
        html: `
            <div style="text-align: left; margin-top: 15px;">
                <label style="font-size: 0.75em; font-weight: 800; color: #64748b; text-transform: uppercase;">1. Viatura / Destino Alvo:</label>
                <select id="swal-destino-kit" class="swal2-select" style="width: 100%; height: 45px; margin: 8px 0 20px 0; display: flex;"></select>
                <label style="font-size: 0.75em; font-weight: 800; color: #64748b; text-transform: uppercase;">2. Setor de Carga Disponível:</label>
                <select id="swal-setor-kit" class="swal2-select" style="width: 100%; height: 45px; margin: 8px 0 5px 0; display: flex;" disabled></select>
            </div>
        `,
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
            return { destinoId: d, setorId: s }
        }
    });

    if (!formValues) return;

    Swal.fire({ title: 'Processando Kit...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        await db.runTransaction(async (transaction) => {
            // --- 1. BLOCO DE LEITURAS (OBRIGATÓRIO NO TOPO) ---

            // Leitura Viatura
            const vtrRef = db.collection('listas_conferencia').doc(formValues.destinoId);
            const vtrSnap = await transaction.get(vtrRef);

            // Leitura Anfitrião
            const anfitriaoRef = db.collection('inventario').doc(uidAnfitriao);
            const anfitriaoSnap = await transaction.get(anfitriaoRef);

            // Leituras de Saldos dos Acessórios (Mapeamos todos antes das escritas)
            const acessoriosSaldosSnaps = [];
            for (const ac of acessorios) {
                const sRef = db.collection('inventario').doc(ac.uid_global).collection('saldos_unidades').doc(minhaUnidadeId);
                const sSnap = await transaction.get(sRef);
                acessoriosSaldosSnaps.push({ snap: sSnap, ref: sRef, info: ac });
            }

            // --- 2. VALIDAÇÕES ---
            if (!vtrSnap.exists) throw new Error("Viatura não encontrada.");
            if (!anfitriaoSnap.exists) throw new Error("Anfitrião não encontrado.");

            for (const item of acessoriosSaldosSnaps) {
                if (!item.snap.exists || item.snap.data().qtd_disp < item.info.quantidade) {
                    throw new Error(`Saldo insuficiente: ${item.info.nome}`);
                }
            }

            // --- 3. BLOCO DE ESCRITAS (APÓS TODAS AS LEITURAS) ---

            const vtrData = vtrSnap.data();
            let novaLista = [...vtrData.list];
            let setorObj = novaLista.find(s => s.nome === formValues.setorId);

            const itemAnfitriaoParaVtr = {
                uid_global: uidAnfitriao,
                nome: anfitriaoSnap.data().nome,
                tipo: 'multi',
                quantidadeEsperada: 1,
                tombamentos: [{ tomb: tombamento, situacao: "EM CARGA" }],
                acessorios_acoplados: acessorios
            };
            setorObj.itens.push(itemAnfitriaoParaVtr);

            // Escrita Anfitrião
            const tombRef = anfitriaoRef.collection('tombamentos').doc(tombamento);
            transaction.update(tombRef, {
                viatura_id: formValues.destinoId,
                situacao_atual: "EM CARGA",
                acessorios_vinculados: acessorios,
                ultima_mov: dataReg
            });

            // Escritas Acessórios
            for (const item of acessoriosSaldosSnaps) {
                transaction.update(item.ref, {
                    qtd_disp: firebase.firestore.FieldValue.increment(-item.info.quantidade),
                    qtd_em_carga: firebase.firestore.FieldValue.increment(item.info.quantidade),
                    last_update: dataReg
                });

                const histRef = item.ref.collection('historico_vida').doc();
                transaction.set(histRef, {
                    data: dataReg,
                    evento: "ACOPLAMENTO_KIT",
                    detalhes: `Acoplado ao Suporte ${tombamento} -> Destino: ${vtrData.ativo_nome}`,
                    quem: autor,
                    quantidade: item.info.quantidade
                });
            }

            transaction.update(vtrRef, { list: novaLista });
        });

        Swal.fire('Sucesso!', 'Kit montado e enviado.', 'success');
        if (typeof carregarAlmoxarifadoUI === 'function') carregarAlmoxarifadoUI();

    } catch (e) {
        console.error("Erro na Transaction:", e);
        Swal.fire('Erro de Sincronismo', e.message, 'error');
    }
}

async function popularDestinosMovimentacao(souAdmin, operacao, viaturaIdPreSeleccionada = null) {
    // ✅ CORREÇÃO: Tenta encontrar o ID do modal comum OU o ID do modal de kit
    const selectDestino = document.getElementById('swal-mov-destino') || document.getElementById('swal-destino-kit');

    if (!selectDestino) {
        console.warn("⚠️ [DEBUG] Select de destino não encontrado no DOM.");
        return;
    }

    try {
        let htmlOptions = `<option value="" disabled selected>Selecione o destino...</option>`;

        if (souAdmin) {
            const snapUnidades = await db.collection('unidades_estruturadas')
                .where('ativo', '==', true)
                .get();

            const unidades = snapUnidades.docs.map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => a.sigla.localeCompare(b.sigla));

            unidades.forEach(u => {
                htmlOptions += `<option value="${u.id}">${u.sigla} - ${u.nome_completo}</option>`;
            });
        } else {
            // GESTOR LOCAL: Busca as listas de conferência (ABT, ABS, etc)
            const snapVtrs = await db.collection('listas_conferencia')
                .where('unidade_id', '==', currentUserData.unidade_id)
                .where('ativo', '==', true)
                .get();

            if (snapVtrs.empty) {
                htmlOptions = `<option value="">Nenhuma viatura ativa na unidade</option>`;
            } else {
                snapVtrs.forEach(doc => {
                    const data = doc.data();
                    const isSelected = (viaturaIdPreSeleccionada === doc.id) ? 'selected' : '';
                    // Exibe o nome da viatura (Ex: ABT-18) e o posto (Ex: BRAVO)
                    htmlOptions += `<option value="${doc.id}" ${isSelected}>${data.ativo_nome} (${data.posto_nome || 'GERAL'})</option>`;
                });
            }

            if (operacao === 'RECOLHIMENTO' && viaturaIdPreSeleccionada) {
                selectDestino.disabled = true;
                selectDestino.style.backgroundColor = "#f1f5f9";
            }
        }

        selectDestino.innerHTML = htmlOptions;
        console.log("✅ Destinos populados com sucesso.");

    } catch (e) {
        console.error("❌ Erro ao popular destinos:", e);
        selectDestino.innerHTML = `<option value="">Erro ao carregar dados</option>`;
    }
}

async function popularTombamentosMovimentacao(docId, operacao, tombamentoFoco, viaturaId, corTema) {
    const containerTomb = document.getElementById('lista-tomb-swal');
    if (!containerTomb) return;

    try {
        let listaTombs = [];

        if (operacao === 'ENVIO') {
            // Busca tombamentos que estão no estoque central da unidade (viatura_id == null)
            const snap = await db.collection('inventario').doc(docId)
                .collection('tombamentos')
                .where('local_id', '==', currentUserData.unidade_id)
                .where('viatura_id', '==', null).get();
            snap.forEach(d => listaTombs.push(d.data()));
        } else {
            // RECOLHIMENTO: Busca tombamentos que estão especificamente naquela viatura
            const snap = await db.collection('inventario').doc(docId)
                .collection('tombamentos')
                .where('viatura_id', '==', viaturaId).get();
            snap.forEach(d => listaTombs.push(d.data()));
        }

        if (listaTombs.length === 0) {
            containerTomb.innerHTML = `<span style="color:#64748b; font-size:0.85em;">Nenhum material disponível para esta operação.</span>`;
            return;
        }

        // Gera o HTML dos checkboxes com o estilo Sigma V3
        let htmlChecks = "";
        listaTombs.forEach(t => {
            const isFoco = (t.tomb === tombamentoFoco) ? 'checked' : '';
            htmlChecks += `
                <div style="margin-bottom:8px; display:flex; align-items:center;">
                    <input type="checkbox" class="swal-tomb-check" id="chk-${t.tomb}" value="${t.tomb}" ${isFoco} style="width:18px; height:18px; accent-color:${corTema};">
                    <label for="chk-${t.tomb}" style="margin-left:10px; font-weight:700; color:#1e293b; cursor:pointer;">
                        ${t.tomb} <small style="color:#64748b; font-weight:400;">(${t.situacao_atual || 'DISPONÍVEL'})</small>
                    </label>
                </div>`;
        });

        containerTomb.innerHTML = htmlChecks;
    } catch (e) {
        containerTomb.innerHTML = "Erro ao carregar tombamentos.";
    }
}
async function executarMovimentacaoReal(docId, operacao, dados) {
    const { destinoId, quantidade, tombamentos } = dados;
    const minhaUnidadeId = currentUserData.unidade_id;
    const dataHora = new Date().toLocaleString('pt-BR');

    // Mostra o loading do Sigma V3
    Swal.fire({
        title: 'Processando Movimentação...',
        html: 'Sincronizando inventário estadual.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    const batch = db.batch();

    try {
        const itemRef = db.collection('inventario').doc(docId);
        const itemSnap = await itemRef.get();
        const itemData = itemSnap.data();
        const ehMulti = itemData.tipo === 'multi';

        // --- LÓGICA PARA ITENS MULTI (TOMBAMENTOS) ---
        if (ehMulti && tombamentos && tombamentos.length > 0) {
            for (const tomb of tombamentos) {
                const tombRef = itemRef.collection('tombamentos').doc(tomb);

                if (operacao === 'ENVIO') {
                    // SAINDO DO ALMOX -> PARA VIATURA
                    batch.update(tombRef, {
                        viatura_id: destinoId,
                        data_ultima_movimentacao: dataHora,
                        movimentado_por: currentUserData.nomeGuerra
                    });
                    // Registra no histórico do tombamento
                    const histRef = tombRef.collection('historico_vida').doc();
                    batch.set(histRef, {
                        evento: "ENVIO_PARA_VIATURA",
                        destino: destinoId,
                        data: dataHora,
                        quem: currentUserData.nomeGuerra
                    });
                } else {
                    // SAINDO DA VIATURA -> PARA ALMOX
                    batch.update(tombRef, {
                        viatura_id: null,
                        data_ultima_movimentacao: dataHora,
                        movimentado_por: currentUserData.nomeGuerra
                    });
                    // Registra no histórico do tombamento
                    const histRef = tombRef.collection('historico_vida').doc();
                    batch.set(histRef, {
                        evento: "RECOLHIMENTO_ALMOXARIFADO",
                        data: dataHora,
                        quem: currentUserData.nomeGuerra
                    });
                }
            }
        }

        // --- LÓGICA PARA ITENS SINGLE (VOLUME/LOTE) ---
        else if (!ehMulti) {
            const qtdNum = Number(quantidade);
            const saldoRef = itemRef.collection('saldos_unidades').doc(minhaUnidadeId);

            if (operacao === 'ENVIO') {
                batch.update(saldoRef, {
                    qtd_disp: firebase.firestore.FieldValue.increment(-qtdNum),
                    qtd_em_carga: firebase.firestore.FieldValue.increment(qtdNum),
                    last_update: dataHora
                });
            } else {
                batch.update(saldoRef, {
                    qtd_disp: firebase.firestore.FieldValue.increment(qtdNum),
                    qtd_em_carga: firebase.firestore.FieldValue.increment(-qtdNum),
                    last_update: dataHora
                });
            }
        }

        // --- ATUALIZAÇÃO DA LISTA DE CONFERÊNCIA (O ALVO) ---
        // Aqui o sistema entra na viatura alvo e insere/remove o item da lista física
        await atualizarArquiteturaViatura(destinoId, itemData, operacao, dados);

        await batch.commit();

        Swal.fire({
            icon: 'success',
            title: 'Movimentação Concluída!',
            text: `${itemData.nome} movimentado com sucesso.`,
            timer: 2000,
            showConfirmButton: false
        }).then(() => {
            // Recarrega a lupa/rastreio para mostrar a nova realidade
            if (typeof verDetalhesItemAlmox === 'function') verDetalhesItemAlmox(docId);
        });

    } catch (e) {
        console.error(e);
        Swal.fire('Erro Fatal', 'Não foi possível processar a movimentação no banco.', 'error');
    }
}
async function atualizarArquiteturaViatura(viaturaId, itemData, operacao, dados) {
    const vtrRef = db.collection('listas_conferencia').doc(viaturaId);
    const vtrSnap = await vtrRef.get();

    if (!vtrSnap.exists) {
        console.error("Viatura não encontrada para sincronização de arquitetura.");
        return;
    }

    const vtrData = vtrSnap.data();
    let listaAtualizada = [...vtrData.list]; // A estrutura principal 'list' que contém os setores
    const setorAlvo = dados.setorId || 'CABINE'; // Default para Cabine se não especificado
    const ehMulti = itemData.tipo === 'multi';

    // 1. Localiza o setor e o item dentro da lista da viatura
    let setorEncontrado = listaAtualizada.find(s => s.nome === setorAlvo);

    // Se o setor não existir na vtr (ex: Carroceria), nós o criamos ou usamos o primeiro disponível
    if (!setorEncontrado) setorEncontrado = listaAtualizada[0];

    let itemNaVtr = setorEncontrado.itens.find(it => it.uid_global === itemData.uid_global);

    if (operacao === 'ENVIO') {
        if (!itemNaVtr) {
            // ITEM NOVO NA VIATURA: Se não existia, adicionamos a estrutura base
            itemNaVtr = {
                uid_global: itemData.uid_global,
                nome: itemData.nome,
                quantidadeEsperada: 0,
                tombamentos: [],
                tipo: itemData.tipo
            };
            setorEncontrado.itens.push(itemNaVtr);
        }

        if (ehMulti) {
            // Adiciona apenas os tombamentos que ainda não estão lá
            dados.tombamentos.forEach(t => {
                if (!itemNaVtr.tombamentos.includes(t)) {
                    itemNaVtr.tombamentos.push(t);
                }
            });
            itemNaVtr.quantidadeEsperada = itemNaVtr.tombamentos.length;
        } else {
            // Soma a quantidade ao que já existia
            itemNaVtr.quantidadeEsperada += Number(dados.quantidade);
        }
    }
    else if (operacao === 'RECOLHIMENTO') {
        if (itemNaVtr) {
            if (ehMulti) {
                // Remove os tombamentos específicos recolhidos
                itemNaVtr.tombamentos = itemNaVtr.tombamentos.filter(t => !dados.tombamentos.includes(t));
                itemNaVtr.quantidadeEsperada = itemNaVtr.tombamentos.length;
            } else {
                // Subtrai a quantidade
                itemNaVtr.quantidadeEsperada -= Number(dados.quantidade);
            }

            // Se a quantidade zerar, removemos o item da viatura para não poluir a lista
            if (itemNaVtr.quantidadeEsperada <= 0) {
                setorEncontrado.itens = setorEncontrado.itens.filter(it => it.uid_global !== itemData.uid_global);
            }
        }
    }

    // 2. Grava a nova arquitetura de volta na viatura
    await vtrRef.update({
        list: listaAtualizada,
        ultima_atualizacao_inventario: new Date().toISOString()
    });
}
/**
 * Função que renderiza os carimbos originais do Conferencia App dentro do modal
 */
function mostrarCarimbos(titulo, dataJson, tipo, listaId = null, nomeItemLimpo = "") {
    const dados = JSON.parse(dataJson);
    const modal = document.getElementById('modal-detalhe-carimbos');
    const corpo = document.getElementById('corpo-modal-carimbo');
    const h3 = document.getElementById('titulo-modal-carimbo');

    if (!modal || !corpo) return;

    h3.textContent = titulo;
    modal.querySelector('.modal-content').style.borderTop = tipo === 'cautela' ? '5px solid #f57c00' : '5px solid #d90f23';

    let html = '';
    dados.forEach(item => {
        if (tipo === 'cautela') {
            const cId = item.id;
            html += `
                <div style="border: 1px solid #eee; padding: 12px; margin-bottom: 12px; border-radius: 8px; border-left: 5px solid #f57c00; background: #fffaf5;">
                    <div style="display:flex; justify-content:space-between; align-items: flex-start; margin-bottom:8px;">
                        <div>
                            <b style="font-size: 1.1em; color: #333;">${item.destinatario}</b><br>
                            <small style="color:#666;"><i class="far fa-calendar-alt"></i> Cautelado em: ${item.data || 'N/D'}</small>
                        </div>
                        <span class="badge-cautela" style="background:#f57c00; color:white; padding:4px 10px; border-radius:15px; font-weight:bold;">${item.quantidade || 1} un</span>
                    </div>
                    <div style="text-align: right; margin-top: 10px; border-top: 1px solid #ffe0b2; padding-top: 8px;">
                        <button class="btn-modern-action" style="font-size: 0.75em; padding: 5px 10px; background-color: #f57c00;" 
                                onclick="atalhoGestaoCautela('${cId}')">
                            <i class="fas fa-external-link-alt"></i> Ver Cautela
                        </button>
                    </div>
                </div>`;
        } else {
            // Pega o ID único da pendência para a busca cirúrgica
            const pId = item.id || item.pendencia_id;

            html += `
                <div style="border: 1px solid #eee; padding: 12px; margin-bottom: 12px; border-radius: 8px; border-left: 5px solid #d90f23; background: #fff5f5;">
                    <div style="display:flex; justify-content:space-between; align-items: flex-start; margin-bottom:8px;">
                        <div>
                            <b style="font-size: 1.1em; color: #333;">Relatado por: ${item.autor_nome}</b><br>
                            <small style="color:#666;"><i class="far fa-calendar-alt"></i> ${item.data_criacao || 'N/D'}</small>
                        </div>
                        <span class="badge-pendente" style="background:#d90f23; color:white; padding:4px 10px; border-radius:15px; font-weight:bold;">${item.quantidade || 1} un</span>
                    </div>
                    <div style="font-size:0.95em; color: #555; margin:8px 0; padding: 8px; background: white; border-radius: 4px; border: 1px solid #ffdada;">
                        <i class="fas fa-comment-dots"></i> "${item.descricao}"
                    </div>
                    <div style="text-align: right; margin-top: 10px; border-top: 1px solid #ffdada; padding-top: 8px;">
                        <button class="btn-modern-action" style="font-size: 0.75em; padding: 5px 10px; background-color: #d90f23;" 
                                onclick="atalhoGestaoPendencia('${listaId}', '${nomeItemLimpo}', '${pId}')">
                            <i class="fas fa-wrench"></i> Resolver na Viatura
                        </button>
                    </div>
                </div>`;
        }
    });

    corpo.innerHTML = html || '<p style="text-align:center; color:#999;">Nenhum registro detalhado encontrado.</p>';
    modal.style.display = 'flex';
}
async function verHistoricoVidaGlobal(uidGlobal, tombamento = null) {
    const container = document.getElementById('timeline-container');
    const modal = document.getElementById('modal-timeline-global');
    const labelNome = document.getElementById('timeline-item-nome');

    if (!container || !modal) return;

    modal.style.display = 'flex';
    container.innerHTML = '<div style="text-align:center; padding:30px;"><i class="fas fa-spinner fa-spin"></i> Acessando prontuário...</div>';

    try {
        const docRef = db.collection('inventario').doc(uidGlobal);
        let eventos = [];

        if (tombamento) {
            // ✅ MODO MULTI: ACESSO AO PRONTUÁRIO INDIVIDUAL
            labelNome.textContent = `RG Individual: Tomb. ${tombamento}`;

            const histSnap = await docRef
                .collection('tombamentos')
                .doc(tombamento)
                .collection('historico_vida')
                .get();

            eventos = histSnap.docs.map(d => ({
                ...d.data(),
                id_evento: d.id
            }));

        } else {
            // ✅ MODO SINGLE/LOTE
            labelNome.textContent = `Histórico de Lote`;

            // 1. Busca logs no Documento Principal
            const snapPai = await docRef.get();
            if (snapPai.exists && snapPai.data().historico_movimentacoes) {
                eventos = [...snapPai.data().historico_movimentacoes];
            }

            // 2. Busca logs distribuídos nas sub-coleções de saldos das unidades
            const saldosSnap = await docRef.collection('saldos_unidades').get();
            for (const docUnid of saldosSnap.docs) {
                const hSnap = await docUnid.ref.collection('historico_vida').get();
                hSnap.forEach(hDoc => {
                    eventos.push({
                        ...hDoc.data(),
                        unidade_ref: docUnid.data().unidade_sigla
                    });
                });
            }
        }

        if (eventos.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; color:#999; padding:40px;">
                    <i class="fas fa-search fa-3x" style="opacity:0.2; margin-bottom:10px;"></i>
                    <p>Nenhum registro encontrado para este nível.</p>
                </div>`;
            return;
        }

        // Ordenação Cronológica (Mais recente primeiro)
        eventos.sort((a, b) => {
            const parseDate = (str) => {
                if (!str) return new Date(0);
                const parts = str.split(', ');
                const dateParts = parts[0].split('/');
                const timeParts = parts[1] ? parts[1].split(':') : [0, 0, 0];
                return new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1], timeParts[2]);
            };
            return parseDate(b.data) - parseDate(a.data);
        });

        // ✅ MONTAGEM DA UI COM TRATAMENTO DE QUANTIDADE E GUIA AMIGÁVEL
        container.innerHTML = eventos.map(ev => {
            let icon = 'fa-history';
            let color = '#4b5563'; // Cinza escuro padrão
            const evNome = (ev.evento || "").toUpperCase();

            // Lógica de Cores e Ícones
            if (evNome.includes('APORTE')) { icon = 'fa-plus-circle'; color = '#1b8a3e'; }
            if (evNome.includes('RECEBIMENTO')) { icon = 'fa-file-import'; color = '#1b8a3e'; }
            if (evNome.includes('ENVIO') || evNome.includes('TRANSFERENCIA')) { icon = 'fa-exchange-alt'; color = '#2c7399'; }
            if (evNome.includes('AVARIA') || evNome.includes('PENDENCIA')) { icon = 'fa-exclamation-triangle'; color = '#800020'; }

            // ✅ Tratamento da Quantidade (Apenas se houver e for lote)
            const labelQtd = ev.quantidade ? `<span style="background:${color}22; color:${color}; padding:2px 6px; border-radius:4px; margin-left:8px; font-size:0.9em;">[${ev.quantidade} un.]</span>` : '';

            // ✅ Tratamento da Guia Amigável (Converte ID longo em TR-ANO/ID)
            let detalhesTexto = ev.detalhes || ev.descricao || 'Sem descrição.';
            const regexFirestoreID = /[a-zA-Z0-9]{20}/g; // Identifica IDs padrão do Firestore
            detalhesTexto = detalhesTexto.replace(regexFirestoreID, (match) => {
                return `<b>TR-2026/${match.substring(0, 5).toUpperCase()}</b>`;
            });

            return `
                <div class="timeline-event" style="border-left: 3px solid ${color}; margin-bottom: 20px; padding-left: 20px; position: relative;">
                    <div style="position: absolute; left: -9px; top: 0; background: #fff; padding: 2px;">
                        <i class="fas ${icon}" style="color: ${color}; font-size: 12px;"></i>
                    </div>
                    <span class="event-date" style="font-size: 0.8em; color: #666; font-weight: bold;">${ev.data}</span>
                    <span class="event-title" style="display: block; font-weight: 800; color: #333; font-size: 0.85em; text-transform: uppercase;">
                        ${evNome.replace(/_/g, ' ')} ${ev.unidade_ref ? `[${ev.unidade_ref}]` : ''} ${labelQtd}
                    </span>
                    <div class="event-desc" style="font-size: 0.9em; color: #444; background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #eee; margin-top: 5px; line-height: 1.4;">
                        ${detalhesTexto}
                    </div>
                    <span class="event-user" style="font-size: 0.75em; color: #999; display: block; margin-top: 5px;">
                        <i class="fas fa-user-edit"></i> Resp: ${ev.quem || 'Sistema'}
                    </span>
                </div>`;
        }).join('');

    } catch (e) {
        console.error("❌ Erro ao carregar histórico:", e);
        container.innerHTML = `<p style="color:red; text-align:center; padding:20px;">Erro: ${e.message}</p>`;
    }
}