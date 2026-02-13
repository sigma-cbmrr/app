
closeMenuMobile();

// --- Trava do Botão Voltar (Mobile/Browser) ---
if (window.innerWidth <= 768) {
    // Adiciona um estado para interceptar o botão Voltar do navegador
    history.pushState(null, null, location.href);
}
// ----------------------------------------------

// Garante que a visão seja o dashboard ao logar
switchView('dashboard');


// --- OUTROS E FUNÇÕES GLOBAIS (UI) ---

function toggleProfileDropdown(event) {
    event.stopPropagation();
    document.getElementById('profileDropdown').classList.toggle('active');
}

// Fecha o menu se o usuário clicar fora dele
window.onclick = function (event) {
    if (!event.target.closest('.user-profile-header')) {
        const dropdown = document.getElementById('profileDropdown');
        if (dropdown && dropdown.classList.contains('active')) {
            dropdown.classList.remove('active');
        }
    }
}

// Localização: Aproximadamente linha 6445
async function getUserInfoByUid(uid) {
    if (userCache[uid]) {
        return userCache[uid];
    }

    try {
        // Tenta encontrar o documento onde o UID é o ID do documento
        const doc = await db.collection('usuarios').doc(uid).get();

        if (doc.exists) {
            userCache[uid] = { id: doc.id, ...doc.data() };
            return userCache[uid];
        }

        return null;

    } catch (e) {
        console.warn(`Falha ao buscar militar pelo UID ${uid}: ${e.message}`);
        return null;
    }
}
/**
* Tenta encontrar o UID de um militar usando seu nome militar completo (Posto Quadro Nome Guerra).
* Usado como fallback para cautelas legadas.
* @param {string} nomeCompleto - O nome completo (Ex: '2º SGT QPCBM JHONATH').
* @returns {string|null} O ID do documento (UID) se encontrado.
*/
async function findUidByName(nomeCompleto) {
    if (!nomeCompleto) return null;

    try {
        // Busca exata pelo nome de exibição
        const snap = await db.collection('usuarios')
            .where('nome_militar_completo', '==', nomeCompleto.trim())
            .get();

        if (snap.empty) {
            console.warn(`Nenhum militar encontrado com o nome exato: ${nomeCompleto}`);
            return null;
        }

        if (snap.size > 1) {
            alert(`⚠️ Atenção: Foram encontrados ${snap.size} cadastros para "${nomeCompleto}". Verifique se há nomes duplicados no banco de dados.`);
        }

        // Retorna o UID do primeiro documento encontrado
        return snap.docs[0].id;
    } catch (e) {
        console.error("Erro ao buscar UID por nome:", e);
        return null;
    }
}





/**
 * ATALHO 1: Direciona para a aba de Cautelas e abre o detalhe da cautela
 */
function atalhoGestaoCautela(cId) {
    document.getElementById('modal-detalhe-carimbos').style.display = 'none';
    switchView('cautelas');
    setTimeout(() => {
        showCautelaDetails(cId);
    }, 300);
}

/**
 * ATALHO 2: Simula o clique exato no card de pendência do Dashboard.
 */
async function atalhoGestaoPendencia(listaId, itemNomeAlvo) {
    if (!listaId) return alert("Erro: ID da lista não identificado.");

    document.getElementById('modal-detalhe-carimbos').style.display = 'none';
    switchView('dashboard');

    try {
        // 1. Busca a última conferência (O Cabeçalho)
        const snap = await db.collection(COLECAO_RESULTADOS)
            .where('lista_id', '==', listaId)
            .orderBy('timestamp', 'desc')
            .limit(1)
            .get();

        if (!snap.empty) {
            const docReal = snap.docs[0];
            const d = docReal.data();

            // 2. Prepara o objeto exatamente como a sua função mostrarTabela espera
            // Note que usamos d.timestamp.toDate().toLocaleString() para evitar o 'undefined'
            const objetoParaTabela = {
                id: docReal.id,
                lista_id: listaId,
                local: d.local || "Viatura",
                conferente: d.conferente,
                date: d.timestamp ? d.timestamp.toDate().toLocaleString('pt-BR') : 'Data N/D',
                items: [] // Vamos preencher abaixo
            };

            // 3. Busca a Lista Mestra para extrair as Pendências/Cautelas Reais
            // Esse é o segredo para não aparecer "Tudo OK"
            const docMestra = await db.collection('listas_conferencia').doc(listaId).get();
            if (docMestra.exists) {
                const dataMestra = docMestra.data().list || [];
                const pendenciasReais = [];

                for (const setor of dataMestra) {
                    for (const it of (setor.itens || [])) {
                        // Pendências Single
                        if (it.pendencias_ids) {
                            it.pendencias_ids.forEach(p => pendenciasReais.push({ ...p, itemNome: it.nome, itemId: it.id, tipoRegistro: 'PENDENCIA' }));
                        }
                        // Cautelas Single
                        if (it.cautelas) {
                            it.cautelas.forEach(c => pendenciasReais.push({ ...c, itemNome: it.nome, itemId: it.id, status_gestao: 'CAUTELADO', tipoRegistro: 'CAUTELA' }));
                        }
                        // Itens Multi (Tombamentos)
                        if (it.tipo === 'multi' && it.tombamentos) {
                            it.tombamentos.forEach(t => {
                                if (t.pendencias_ids) t.pendencias_ids.forEach(p => pendenciasReais.push({ ...p, itemNome: it.nome, tombamento: t.tomb, itemId: it.id, tipoRegistro: 'PENDENCIA' }));
                                if (t.cautela) pendenciasReais.push({ ...t.cautela, itemNome: it.nome, tombamento: t.tomb, itemId: it.id, status_gestao: 'CAUTELADO', tipoRegistro: 'CAUTELA' });
                            });
                        }
                    }
                }
                objetoParaTabela.items = pendenciasReais;
            }

            // 4. Agora sim, chama a função com os dados completos e processados
            setTimeout(() => {
                mostrarTabela(objetoParaTabela);

                // 5. Aponta o item alvo
                setTimeout(() => {
                    destacarItemNaTabela(itemNomeAlvo);
                }, 600);
            }, 300);
        }
    } catch (e) {
        console.error("Erro no atalho:", e);
    }
}
/**
 * Localiza o item na tabela, com sistema de espera (polling) 
 * para garantir que a renderização terminou.
 */
function destacarItemNaTabela(nomeItem, pendenciaId) {
    let tentativas = 0;
    const alvoNome = nomeItem ? nomeItem.trim().toUpperCase() : null;

    const intervalBusca = setInterval(() => {
        const rows = document.querySelectorAll('#ca-list-body tr');
        let linhaEncontrada = null;

        rows.forEach(row => {
            if (linhaEncontrada) return; // Se já achou, ignora o resto

            // 1. PRIORIDADE MÁXIMA: Busca pelo ID da Pendência em qualquer lugar da linha
            if (pendenciaId) {
                // Procura o ID no HTML da linha toda (botões, inputs hidden, textos)
                if (row.innerHTML.includes(pendenciaId)) {
                    linhaEncontrada = row;
                }
            }

            // 2. SEGUNDA PRIORIDADE: Busca por Nome + Texto "PENDENTE" 
            // Isso evita focar no item "CAUTELADO" se o objetivo é resolver pendência
            if (!linhaEncontrada && alvoNome) {
                const textoLinha = row.innerText.toUpperCase();
                // Verifica se na mesma linha tem o Nome do Item E a palavra PENDENTE
                if (textoLinha.includes(alvoNome) && textoLinha.includes("PENDENTE")) {
                    linhaEncontrada = row;
                }
            }
        });

        if (linhaEncontrada) {
            clearInterval(intervalBusca);

            // Centraliza e destaca
            linhaEncontrada.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Estilo visual de impacto
            linhaEncontrada.style.backgroundColor = "#fff3cd";
            linhaEncontrada.style.outline = "3px solid #d90f23"; // Vermelho para pendência

            linhaEncontrada.animate([
                { transform: 'scale(1)', boxShadow: 'none' },
                { transform: 'scale(1.01)', boxShadow: '0 0 20px #d90f23' },
                { transform: 'scale(1)', boxShadow: 'none' }
            ], { duration: 400, iterations: 5 });

            setTimeout(() => {
                linhaEncontrada.style.backgroundColor = "";
                linhaEncontrada.style.outline = "none";
            }, 6000);

        } else if (tentativas >= 25) {
            clearInterval(intervalBusca);
            console.warn("Destaque: Falha ao localizar o item alvo.");
        }

        tentativas++;
    }, 200);
}


// MENU LISTAS




// Fecha as caixas de busca e popover ao clicar fora delas
document.addEventListener('keydown', function (event) {
    // 1. Tratamento da tecla ESC
    if (event.key === 'Escape') {
        fecharBuscaELimpar();
    }
});

document.addEventListener('mousedown', function (event) {
    const buscaBox = document.getElementById('sugestoes-estoque-editor');
    const inputBusca = document.getElementById('input-busca-estoque');
    const popoverQtd = document.getElementById('popover-qtd-editor');

    // 2. Se a caixa de sugestões estiver aberta e o clique for fora dela e do input
    if (buscaBox && !buscaBox.contains(event.target) && event.target !== inputBusca) {
        if (buscaBox.style.display === 'block') {
            fecharBuscaELimpar();
        }
    }

    // 3. Se o popover de quantidade estiver aberto e o clique for fora dele
    if (popoverQtd && !popoverQtd.contains(event.target) && event.target !== inputBusca) {
        if (popoverQtd.style.display === 'block') {
            popoverQtd.style.display = 'none';
            itemSelecionadoTemp = null;
            if (inputBusca) inputBusca.value = ''; // Limpa ao cancelar a quantidade também
        }
    }
});

/**
 * Função auxiliar para evitar repetição de código
 */
function fecharBuscaELimpar() {
    const buscaBox = document.getElementById('sugestoes-estoque-editor');
    const inputBusca = document.getElementById('input-busca-estoque');

    if (buscaBox) buscaBox.style.display = 'none';
    if (inputBusca) {
        inputBusca.value = '';
        inputBusca.blur(); // Remove o cursor do campo
    }
}
// INSIRA ESTE BLOCO PARA DAR VIDA AO SELECT
document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'select-setor-destino') {
        const setorIdx = e.target.value;

        // Se existe um item "carimbado" aguardando destino e um setor válido foi escolhido
        if (itemSelecionadoTemp && setorIdx !== "") {

            // Se for multi, já adiciona direto. 
            // Se for single, verifica se a quantidade já foi escolhida no popover
            if (itemSelecionadoTemp.tipo === 'multi' || (itemSelecionadoTemp.tipo === 'single' && itemSelecionadoTemp.quantidadeEscolhida > 0)) {
                adicionarItemRapido();
            }
        }
    }
});
