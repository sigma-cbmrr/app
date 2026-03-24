// 1. Definição das credenciais
const firebaseConfig = {
    apiKey: "AIzaSyCB0PH0UgghgsvH0BgPkG4AkKON6xSQ9mc",
    authDomain: "sigma-cbmrr.firebaseapp.com",
    projectId: "sigma-cbmrr",
    storageBucket: "sigma-cbmrr.firebasestorage.app",
    messagingSenderId: "378026276038",
    appId: "1:378026276038:web:620dd6ff57501b1a8313c7"
};

// 2. Inicialização do App Principal
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// 3. DECLARAÇÃO DAS INSTÂNCIAS GLOBAIS
const db = firebase.firestore();
const auth = firebase.auth();

// 4. Inicialização Segura do App Secundário (Para gestão de usuários)
// Verificamos se o app 'Secondary' já existe antes de inicializar
let secondaryApp;
if (!firebase.apps.find(app => app.name === 'Secondary')) {
    secondaryApp = firebase.initializeApp(firebaseConfig, 'Secondary');
} else {
    secondaryApp = firebase.app('Secondary');
}
const secondaryAuth = secondaryApp.auth();

// 5. Configurações de Persistência e Cache
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// Limpeza de cache para evitar dados obsoletos entre sessões
db.clearPersistence().catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn("Múltiplas abas abertas, persistência não pôde ser limpa.");
    }
});