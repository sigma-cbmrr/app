/*---CARDS DE VISÃO OPERACIONAL---*/
function renderOperacionalCards() {
    const container = document.getElementById('operacional-cards-container');
    const masterContainer = document.getElementById('dashboard-content-by-role');

    if (!container) return;

    // ✅ BLOQUEIO DO PULO VISUAL: Garante que o container operacional apareça e o de admin suma
    container.style.setProperty('display', 'block', 'important');

    const adminContainer = document.getElementById('admin-gestor-cards-container');
    if (adminContainer) {
        adminContainer.style.setProperty('display', 'none', 'important');
    }

    // ✅ AJUSTE ESTRUTURAL: Ativa a largura total no container pai
    if (masterContainer) {
        masterContainer.classList.add('dashboard-operacional-full');
    }

    // ✅ HIERARQUIA V3: Layout de largura total (Full-Width)
    container.innerHTML = `
        <div class="sigma-v3-clean-wrapper" style="margin-top: 10px; width: 100%;">
            
            <div class="sigma-v3-title-label">
                <i class="fas fa-calendar-day" style="color: #800020;"></i>
                <span>Atividades Realizadas Hoje</span>
            </div>
            <ul id="today-list" class="history-list" style="background: white; border-radius: 15px; padding: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); margin-bottom: 40px; list-style: none; width: 100%;">
                <li style="text-align:center; color:#999; padding:20px;">
                    <i class="fas fa-sync fa-spin"></i> Carregando registros de hoje...
                </li>
            </ul>

            <div class="sigma-v3-title-label" style="border-top: 1px solid rgba(0,0,0,0.08); padding-top: 30px;">
                <i class="fas fa-chart-bar" style="color: #2c7399;"></i> 
                <span>Dashboard de Serviço</span>
            </div>

            <div class="cards-grid-v3-op">
                
                <div class="sigma-v3-summary-card sigma-v3-card-ok icon-conferencia" onclick="switchView('my-history')" style="width:100%; margin:0;">
                    <h3>Minhas Conferências</h3>
                    <div class="sigma-v3-main-stat">
                        <div class="sigma-v3-stat-circle" id="op-conf-count">0</div>
                        <div style="line-height: 1.2;">
                            <span style="font-size: 0.8em; font-weight: 800; color: #1b8a3e;">HISTÓRICO</span><br>
                            <small style="color: #64748b; font-size: 0.7em;">Registros totais</small>
                        </div>
                    </div>
                    <div class="sigma-v3-footer-info">
                        <strong><i class="fas fa-arrow-right"></i> Clique para acessar</strong>
                        <small>Histórico completo de atividades</small>
                    </div>
                </div>

                <div class="sigma-v3-summary-card sigma-v3-card-unit icon-custodia" onclick="switchView('cautelas-ativas')" style="width:100%; margin:0;">
                    <h3>TRUGs Ativos</h3>
                    <div class="sigma-v3-main-stat">
                        <div class="sigma-v3-stat-circle" id="op-my-active-cautela-count">0</div>
                        <div style="line-height: 1.2;">
                            <span style="font-size: 0.8em; font-weight: 800; color: #2c7399;">ATIVAS</span><br>
                            <small style="color: #64748b; font-size: 0.7em;">Materiais em seu nome</small>
                        </div>
                    </div>
                    <div class="sigma-v3-footer-info">
                        <strong><i class="fas fa-shield-alt"></i> Gestão de Cautela</strong>
                        <small>Itens sob sua responsabilidade</small>
                    </div>
                </div>

                <div class="sigma-v3-summary-card sigma-v3-card-posto icon-receber" onclick="switchView('cautelas-receber')" style="width:100%; margin:0;">
                    <h3>TRUGs a receber</h3>
                    <div class="sigma-v3-main-stat">
                        <div class="sigma-v3-stat-circle" id="op-cautela-receive-count">0</div>
                        <div style="line-height: 1.2;">
                            <span style="font-size: 0.8em; font-weight: 800; color: #8e44ad;">PENDENTES</span><br>
                            <small style="color: #64748b; font-size: 0.7em;">Ação necessária</small>
                        </div>
                    </div>
                    <div class="sigma-v3-footer-info">
                        <strong><i class="fas fa-box-open"></i> Aguardando Você</strong>
                        <small>Recebimento de materiais</small>
                    </div>
                </div>
                
            </div>
        </div>
    `;

    // Dispara a lógica de preenchimento dos dados
    updateOperacionalCards();
}