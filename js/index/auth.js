 // Variáveis temporárias para cadastro
        let tempUid = null;
        let tempEmail = null;
        let tempPhoto = null;

        // --- 1. LÓGICA DE LOGIN ---
        
        auth.onAuthStateChanged(function(user) {
            // ✅ LOG DE TESTE 1: Verifica se este arquivo foi lido
            console.log("DOMINIO: O Firebase respondeu ao observador de estado.");

            const loader = document.getElementById('app-loader');
            const authWrapper = document.getElementById('auth-content-wrapper');

            function hideLoader() {
                console.log("DOMINIO: Escondendo o loader agora..."); // ✅ LOG DE TESTE 2
                if (loader) {
                    loader.style.opacity = '0';
                    setTimeout(() => { 
                        loader.style.display = 'none'; 
                        if (authWrapper && !user) {
                            authWrapper.style.display = 'block';
                            authWrapper.style.opacity = '1';
                        }
                    }, 500);
                }
            }

            if (user) {
                console.log("DOMINIO: Usuário detectado (UID):", user.uid); // ✅ LOG DE TESTE 3
                verificarRedirecionamento(user);
            } else {
                console.log("DOMINIO: Nenhum usuário logado. Indo para tela de login."); // ✅ LOG DE TESTE 4
                hideLoader();
            }
        });
        function verificarRedirecionamento(user) {
            const uid = user.uid;
            db.collection('usuarios').doc(uid).get().then((doc) => {
                if (doc.exists) {
                    window.location.href = "sigma_dashboard.html";
                } else {
                    // Se for novo, prepara a tela de registro e aí sim remove o loader
                    iniciarCadastro(user);
                    const loader = document.getElementById('app-loader');
                    if (loader) loader.style.display = 'none';
                    document.getElementById('auth-content-wrapper').style.display = 'block';
                }
            }).catch((error) => {
                console.error("Erro na verificação:", error);
                alert("Falha na comunicação com o servidor.");
                resetBotoes();
            });
        }

        function iniciarCadastro(user) {
            tempUid = user.uid;
            tempEmail = user.email;
            tempPhoto = user.photoURL || "";

            const loginCard = document.getElementById('login-card');
            const registerCard = document.getElementById('register-card');

            loginCard.style.display = 'none';
            registerCard.style.display = 'block';
            // Aplica a animação novamente ao trocar de card
            registerCard.style.animation = 'none';
            registerCard.offsetHeight; /* trigger reflow */
            registerCard.style.animation = null;
        }

        // --- 2. LOGIC DE CADASTRO ---

        function atualizarQuadro() {
            const posto = document.getElementById('reg-posto').value;
            const quadroSelect = document.getElementById('reg-quadro');
    
            quadroSelect.innerHTML = '<option value="" disabled selected>Selecione...</option>';
            quadroSelect.disabled = false;

            const oficiais = ['CEL', 'TEN CEL', 'MAJ', 'CAP', '1º TEN', '2º TEN'];
            const pracas = ['ST', '1º SGT', '2º SGT', '3º SGT', 'CB']; 

            let opcoes = [];
            if (oficiais.includes(posto)) {
                opcoes = ['QOCBM', 'QCOBM', 'QOSBM', 'QEOBM'];
            } else if (pracas.includes(posto)) {
                opcoes = ['QPCBM', 'QPSBM', 'QEPBM'];
            } else if (posto === 'SD') {
                opcoes = ['QPCBM'];
                quadroSelect.disabled = true;
            }

            opcoes.forEach(q => quadroSelect.add(new Option(q, q)));
            if(opcoes.length === 1) quadroSelect.value = opcoes[0];
        }
        
        function salvarNovoUsuario() {
            const cpfRaw = document.getElementById('reg-cpf').value.replace(/\D/g, '');
            const matriculaRaw = document.getElementById('reg-matricula').value.replace(/\D/g, '');
            const nomeCompleto = document.getElementById('reg-nome-completo').value.trim().toUpperCase();
            const telefoneRaw = document.getElementById('reg-telefone').value.replace(/\D/g, '');
            const posto = document.getElementById('reg-posto').value;
            const quadro = document.getElementById('reg-quadro').value;
            const nomeGuerra = document.getElementById('reg-nome-guerra').value.trim().toUpperCase();

            if (cpfRaw.length !== 11 || !nomeCompleto || telefoneRaw.length !== 11 || !posto || !quadro || !nomeGuerra) {
                 return alert("Por favor, preencha todos os campos obrigatórios corretamente.");
            }

            const btn = document.getElementById('btn-register');
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> FINALIZANDO...';
            btn.disabled = true;

            const nomeMilitarCompleto = `${posto} ${quadro} ${nomeGuerra}`;

            db.collection('usuarios').doc(tempUid).set({
                uid: tempUid,
                email: tempEmail,
                foto_url: tempPhoto,
                cpf: cpfRaw,
                matricula: matriculaRaw,
                nome_completo: nomeCompleto, 
                telefone_contato: telefoneRaw,
                nome_guerra: nomeGuerra,
                posto: posto,
                quadro: quadro,
                nome_militar_completo: nomeMilitarCompleto,
                role: 'operacional', 
                unidade_id: 'NAO_ALOCADO', // Padrão V3 para novos usuários
                unidade: 'AGUARDANDO UNIDADE',
                criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
                versao_app: '3.0'
            })
            .then(() => {
                window.location.href = "sigma_dashboard.html"; 
            })
            .catch((error) => {
                alert("Erro ao salvar: " + error.message);
                btn.innerHTML = 'CONCLUIR CADASTRO';
                btn.disabled = false;
            });
        }
        // --- 3. HANDLERS DE BOTÕES ---

        function resetBotoes() {
            document.getElementById('btn-login').textContent = "ENTRAR";
            document.getElementById('btn-login').disabled = false;
            document.getElementById('btn-google').style.opacity = "1";
            document.getElementById('btn-google').disabled = false;
        }

        function loginEmail() {
            const cpfRaw = document.getElementById('cpf-login').value.replace(/\D/g, ''); 
            const password = document.getElementById('password').value;
            const btn = document.getElementById('btn-login');

            if (cpfRaw.length !== 11 || !password) return alert("Informe CPF e Senha.");

            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> AUTENTICANDO...';
            btn.disabled = true;

            const emailTecnico = `${cpfRaw}@sigma.com.br`;

            auth.signInWithEmailAndPassword(emailTecnico, password)
                .then((userCredential) => {
                    verificarRedirecionamento(userCredential.user);
                })
                .catch((error) => {
                    resetBotoes();
                    alert("Acesso negado. Verifique suas credenciais.");
                });
        }

        function resetBotoes() {
            const btn = document.getElementById('btn-login');
            btn.innerHTML = 'ENTRAR NO SISTEMA';
            btn.disabled = false;
            document.getElementById('btn-google').disabled = false;
        }

        function loginGoogle() {
            const provider = new firebase.auth.GoogleAuthProvider();
            const btnG = document.getElementById('btn-google');
    
            btnG.style.opacity = "0.7";
            document.getElementById('btn-login').disabled = true;
    
            // 1. Executar o login DIRETAMENTE
            auth.signInWithPopup(provider) // REMOVEMOS auth.setPersistence e o .then()
                .then((result) => {
                    // O processo de login foi bem-sucedido
                    verificarRedirecionamento(result.user);
                })
                .catch((error) => {
                    console.error(error);
                    alert("Erro ao entrar com Google: " + error.message);
                    resetBotoes();
                });
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

        // --- ADICIONA LISTENERS APÓS O CARREGAMENTO DO DOM ---
      document.addEventListener('DOMContentLoaded', () => {
    
    // === VÍNCULO DOS BOTÕES (O QUE ESTAVA FALTANDO) ===
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) btnLogin.addEventListener('click', loginEmail);

    const btnGoogle = document.getElementById('btn-google');
    if (btnGoogle) btnGoogle.addEventListener('click', loginGoogle);

    const btnRegister = document.getElementById('btn-register');
    if (btnRegister) btnRegister.addEventListener('click', salvarNovoUsuario);

    // === MÁSCARAS E CAMPOS ===
    
    // 1. CPF LOGIN
    const cpfLoginInput = document.getElementById('cpf-login');
    if (cpfLoginInput) {
        cpfLoginInput.addEventListener('input', () => formatarCPF(cpfLoginInput));
    }

    // 2. CPF REGISTRO
    const cpfRegInput = document.getElementById('reg-cpf');
    if (cpfRegInput) {
        cpfRegInput.addEventListener('input', () => formatarCPF(cpfRegInput));
    }

    // 3. MATRÍCULA
    const matriculaInput = document.getElementById('reg-matricula');
    if (matriculaInput) {
        matriculaInput.addEventListener('input', () => formatarMatricula(matriculaInput));
    }

    // 4. TELEFONE
    const telefoneInput = document.getElementById('reg-telefone');
    if (telefoneInput) {
        telefoneInput.addEventListener('input', () => formatarTelefone(telefoneInput));
    }

    // 5. POSTO/QUADRO
    const postoSelect = document.getElementById('reg-posto');
    if (postoSelect) {
        postoSelect.addEventListener('change', () => {
            setTimeout(atualizarQuadro, 100); 
        });
    }

    // 6. TECLA ENTER NO PASSWORD
    const passInput = document.getElementById('password');
    if (passInput) {
        passInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') loginEmail();
        });
    }
}); // <-- Fecha corretamente o addEventListener e a função anônima.

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
