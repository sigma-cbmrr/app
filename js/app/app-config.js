// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyCB0PH0UgghgsvH0BgPkG4AkKON6xSQ9mc",
    authDomain: "sigma-cbmrr.firebaseapp.com",
    projectId: "sigma-cbmrr",
    storageBucket: "sigma-cbmrr.firebasestorage.app",
    messagingSenderId: "378026276038",
    appId: "1:378026276038:web:620dd6ff57501b1a8313c7"
};

// --- INICIALIZAÇÃO DO FIREBASE ---
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// --- ESTADO GLOBAL DA APLICAÇÃO ---
window.infoLocal = { nome: "Sincronizando...", posto: "" };
window.userInfo = {};
window.itemStatus = {};
window.isModoChecklist = false;
let dadosConferencia = [];

// --- CAPTURA DE PARÂMETROS DA URL ---
const urlParams = new URLSearchParams(window.location.search);
const modoUrl = urlParams.get('modo');
let rawID = urlParams.get('id');

// ✅ NORMALIZAÇÃO DE ID (Vistoria vs Conferência)
if (modoUrl === 'checklist_vtr' && rawID && !rawID.startsWith('CHECKLIST_VTR_')) {
    rawID = 'CHECKLIST_VTR_' + rawID;
}

const LISTA_ID = rawID;
const CAUTELA_ID = urlParams.get('cautelaId');
const TRANSFERENCIA_ID = urlParams.get('transferenciaId');

// --- DEFINIÇÃO DINÂMICA DE COLEÇÕES E MODOS ---
window.isModoChecklist = (modoUrl === 'checklist_vtr') || (LISTA_ID && LISTA_ID.startsWith('CHECKLIST_VTR_'));

const COLECAO_LISTAS = window.isModoChecklist ? 'listas_checklist' : 'listas_conferencia';
const COLECAO_CAUTELAS = 'cautelas_abertas';

let MODO_OPERACAO = modoUrl || 'recebimento';
let DESTINATARIO_DEVOLUCAO = urlParams.get('destinatarioDevolucao');
let isCautela = !!CAUTELA_ID;

// ✅ IDENTIDADE DO MILITAR (Captura Decodificada)
window.userInfo = {
    postoGraduacao: urlParams.get('posto_grad') || "ND",
    quadro: urlParams.get('quadro') || "ND",
    nomeGuerra: urlParams.get('nome_guerra') || "ND",
    uid: urlParams.get('user_uid') || "ND",
    unidadeId: urlParams.get('unidade_id') || "",
    unidadeNome: urlParams.get('unidade_nome') || ""
};
