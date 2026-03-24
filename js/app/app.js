/**
 * SIGMA V3 - Script de Inicialização Orquestrada
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("%c🚀 SIGMA V3: Iniciando Motores...", "color: #800020; font-weight: bold;");

    // 1. Inicia a carga de dados o mais rápido possível (sem esperar imagens)
    if (typeof carregarDadosRemotos === 'function') {
        carregarDadosRemotos().then(() => {
            console.log("✅ Dados Remotos Carregados.");
            
            // 2. Sincroniza a interface inicial (Barra Neon e Badges)
            if (typeof updateOverallStatus === 'function') {
                updateOverallStatus();
            }
        }).catch(err => {
            console.error("❌ Falha na inicialização do SIGMA:", err);
        });
    }

    // 3. Gerenciador de visibilidade (Garante que o slider não quebre ao alternar abas)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && typeof updateOverallStatus === 'function') {
            updateOverallStatus();
        }
    });
});

// Fallback de segurança para garantir o Hud Info
window.onload = () => {
    if (typeof updateHeaderInfo === 'function') updateHeaderInfo();
};