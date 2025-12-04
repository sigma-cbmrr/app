// ===============================================
// sigma_utils.js
// FUNÇÕES DE UTILIDADE COMPARTILHADAS
// ===============================================

/**
 * Funções de autenticação e navegação global.
 */
function sairDoSistema() { 
    // Assumindo que 'auth' (Firebase Auth) está definido globalmente onde esta função é chamada.
    if (typeof auth !== 'undefined' && auth.signOut) {
        auth.signOut().then(() => { 
            sessionStorage.clear(); 
            window.location.href = 'index.html'; 
        });
    } else {
        // Fallback se o Firebase Auth não estiver carregado ou acessível.
        console.error("Firebase Auth não está disponível para logout.");
        window.location.href = 'index.html'; 
    }
}

/**
 * Função wrapper para logout (uso no Dashboard).
 */
function logout() {
    sairDoSistema();
}

/**
 * Função para gerar a chave de rascunho. 
 * Requer que as variáveis globais LISTA_ID e userInfo.nomeGuerra sejam definidas 
 * no escopo que chama esta função, ou que a função getStorageKey do app seja usada.
 */
function getStorageKey(listaId, userGuerra) {
    // Esta implementação é um HINT para a lógica, mas o app que consome precisa 
    // fornecer os parâmetros ou definir o contexto.
    const lId = listaId || 'ND';
    const uGuerra = userGuerra || 'ND';
    return `sigma_draft_${lId}_${uGuerra.toUpperCase()}`;
}
