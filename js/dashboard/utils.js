/*---SIDEBAR: FUNÇÃO DE TOGGLE PARA SUBMENUS---*/
function toggleSubMenu(id, btn) {
    const submenu = document.getElementById(id);
    const isVisible = submenu.style.display === 'block';

    // Oculta outros submenus abertos para manter a sidebar limpa
    document.querySelectorAll('.sigma-v3-submenu').forEach(s => {
        if (s.id !== id) s.style.display = 'none';
    });
    document.querySelectorAll('.sigma-v3-dropdown-btn').forEach(b => {
        if (b !== btn) b.classList.remove('open');
    });

    // Alterna o estado atual
    if (isVisible) {
        submenu.style.display = 'none';
        btn.classList.remove('open');
    } else {
        submenu.style.display = 'block';
        btn.classList.add('open');
    }
}

/*---ALTERNA A VISIBILIDADE DO MENU MOBILE---*/
function toggleMenuMobile(forceClose = false) {
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.getElementById('mobile-overlay');

    if (!sidebar) return;

    // Se forceClose for true, nós removemos a classe. 
    // Se não, fazemos o toggle normal (abre/fecha).
    if (forceClose) {
        sidebar.classList.remove('mobile-active');
    } else {
        sidebar.classList.toggle('mobile-active');
    }

    // Sincroniza o overlay com o estado real da sidebar
    if (overlay) {
        const isOpen = sidebar.classList.contains('mobile-active');
        overlay.style.display = isOpen ? 'block' : 'none';
    }
}

function reimprimirPDF(data) {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const MARGIN = 14, PG_W = 210, LOGO_S = 15;

        const isChecklist = data.modo === 'CHECKLIST_VISTORIA';
        const isTransferencia = data.modo === 'TRANSFERENCIA_CARGA';

        const COR_PRIMARIA = isChecklist ? [44, 62, 80] : (isTransferencia ? [33, 37, 41] : [128, 0, 32]);
        const TITULO_DOC = isChecklist ? "RELATÓRIO DE VISTORIA DE VIATURA" : (isTransferencia ? "TERMO DE TRANSFERÊNCIA DE CARGA" : "RELATÓRIO DE CONFERÊNCIA");

        const logoDraw = (domId, x) => {
            const el = document.querySelector(`.header-icon[src*="${domId}"]`) || document.querySelector(`img[src*="${domId}"]`);
            if (el) {
                try {
                    const c = document.createElement('canvas');
                    c.width = 160; c.height = 160;
                    c.getContext('2d').drawImage(el, 0, 0, 160, 160);
                    doc.addImage(c.toDataURL('image/png'), 'PNG', x, 10, LOGO_S, LOGO_S);
                } catch (e) { console.warn(`Logo erro: ${domId}`); }
            }
        };

        logoDraw('cbmrr.png', MARGIN);
        logoDraw('logo_sigma.png', PG_W - MARGIN - LOGO_S);

        doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(51);
        doc.text('GOVERNO DE RORAIMA', PG_W / 2, 15, { align: 'center' });
        doc.setTextColor(217, 15, 35).text('CORPO DE BOMBEIROS MILITAR DE RORAIMA', PG_W / 2, 20, { align: 'center' });
        doc.setTextColor(51).setFont('helvetica', 'italic').text('"Amazônia: patrimônio dos brasileiros"', PG_W / 2, 25, { align: 'center' });

        doc.setFontSize(14).setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]).setFont('helvetica', 'bold').text(TITULO_DOC, PG_W / 2, 35, { align: 'center' });

        const boxHeight = (isChecklist || isTransferencia) ? 32 : 25;
        doc.setFillColor(240, 240, 240).setDrawColor(200, 200, 200).roundedRect(MARGIN, 40, PG_W - (MARGIN * 2), boxHeight, 2, 2, 'FD');

        const dataTimestamp = data.timestamp?.seconds ? new Date(data.timestamp.seconds * 1000) : new Date();

        if (isTransferencia) {
            doc.setFontSize(9).setTextColor(50).setFont('helvetica', 'bold').text('GUIA Nº:', MARGIN + 5, 46);
            doc.setFont('helvetica', 'normal').text(data.id_amigavel || data.id, MARGIN + 35, 46);
            doc.setFont('helvetica', 'bold').text('ORIGEM:', MARGIN + 5, 52);
            doc.setFont('helvetica', 'normal').text(`${data.origem_sigla} (${data.emitente})`, MARGIN + 35, 52);
            doc.setFont('helvetica', 'bold').text('DESTINO:', MARGIN + 5, 58);
            doc.setFont('helvetica', 'normal').text(`${data.destino_sigla} (${data.conferente})`, MARGIN + 35, 58);
            doc.setFont('helvetica', 'bold').text('DATA REC:', MARGIN + 5, 64);
            doc.setFont('helvetica', 'normal').text(dataTimestamp.toLocaleString('pt-BR'), MARGIN + 35, 64);
        } else {
            doc.setFontSize(9).setTextColor(50).setFont('helvetica', 'bold').text(isChecklist ? 'Viatura:' : 'Local:', MARGIN + 5, 46);
            doc.setFont('helvetica', 'normal').text(data.local || '', MARGIN + 35, 46);
            doc.setFont('helvetica', 'bold').text('Conferente:', MARGIN + 5, 52);
            doc.setFont('helvetica', 'normal').text(data.conferente || '', MARGIN + 35, 52);
            doc.setFont('helvetica', 'bold').text('Data/Hora:', MARGIN + 5, 58);
            doc.setFont('helvetica', 'normal').text(dataTimestamp.toLocaleString('pt-BR'), MARGIN + 35, 58);

            if (isChecklist) {
                doc.setFont('helvetica', 'bold').text('Odômetro:', MARGIN + 5, 64);
                doc.setFont('helvetica', 'normal').text(`${data.km_entrada || '0'} KM`, MARGIN + 35, 64);
                doc.setFont('helvetica', 'bold').text('Tanque:', MARGIN + 100, 64);
                doc.setFont('helvetica', 'normal').text(`${data.combustivel_entrada || 'N/D'}`, MARGIN + 120, 64);
            }
        }

        doc.setFont('helvetica', 'bold').setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]).text(`ITENS: ${data.totalItensConferidos || 0} | C/A: ${data.totalCaa || 0}`, PG_W - MARGIN - 5, 46, { align: 'right' });

        // --- MONTAGEM DA TABELA (ESPELHO V3 ATUALIZADO) ---
        let tableBody = [];
        const RED_FILL = [217, 15, 35], GREEN_FILL = [27, 138, 62], SECTOR_BG = (isChecklist || isTransferencia) ? COR_PRIMARIA : [60, 60, 60];
        let listaParaImprimir = data.itensRelatorio || data.itensCaa || [];

        if (listaParaImprimir.length > 0) {
            let currentSector = null;
            listaParaImprimir.forEach(item => {
                const nomeSetor = (item.setor || "").toUpperCase();
                if (isChecklist && (nomeSetor.includes("FOTO") || nomeSetor.includes("OBSERVAÇ"))) return;

                if (nomeSetor !== currentSector) {
                    tableBody.push([{ content: nomeSetor || "ITENS GERAIS", colSpan: 4, styles: { fillColor: SECTOR_BG, textColor: 255, fontStyle: 'bold', halign: 'left' } }]);
                    currentSector = nomeSetor;
                }

                // Função auxiliar para formatar observações de pendências
                const formatarPendencias = (pndArray) => {
                    if (!pndArray || pndArray.length === 0) return '-';
                    return pndArray.map(p => {
                        const dataP = p.data_criacao || "";
                        const qtdRelatada = p.quantidade > 0 ? `${p.quantidade} UN ` : "";
                        return `\u2022 Por ${p.autor_nome}${dataP ? ' em ' + dataP : ''}: ${qtdRelatada}${p.descricao}`;
                    }).join('\n');
                };

                // Linha Principal do Item (Pai)
                let bgStatusPai = (item.status === 'C/A') ? RED_FILL : GREEN_FILL;
                tableBody.push([
                    item.nomeCompleto || 'Item',
                    { content: `${item.quantidade || 1} un.`, styles: { halign: 'center' } },
                    { content: item.status || 'S/A', styles: { fillColor: bgStatusPai, textColor: 255, fontStyle: 'bold', halign: 'center' } },
                    { content: formatarPendencias(item.pendencias_ids), styles: { halign: 'left', fontSize: 7 } }
                ]);

                // ✅ DESENHO DOS FILHOS (ACESSÓRIOS DO ANFITRIÃO)
                if (item.acessorios_vinculados && item.acessorios_vinculados.length > 0) {
                    item.acessorios_vinculados.forEach(ac => {
                        let bgStatusFilho = (ac.status === 'C/A') ? RED_FILL : GREEN_FILL;

                        tableBody.push([
                            { content: `      > ${ac.nomeCompleto || ac.nome}`, styles: { textColor: [80, 80, 80], fontStyle: 'italic' } },
                            { content: `${ac.quantidade || 1} un.`, styles: { halign: 'center', textColor: [80, 80, 80] } },
                            { content: ac.status || 'S/A', styles: { fillColor: bgStatusFilho, textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 7 } },
                            { content: formatarPendencias(ac.pendencias_ids), styles: { halign: 'left', fontSize: 6.5, textColor: [80, 80, 80] } }
                        ]);
                    });
                }
            });
        }

        doc.autoTable({
            startY: 45 + boxHeight,
            head: [['Descrição do Item', 'Qtd', 'Status', 'Observações / Pendências']],
            body: tableBody,
            theme: 'striped',
            styles: { fontSize: 8, valign: 'middle', textColor: 51, cellPadding: 2 },
            columnStyles: { 0: { cellWidth: 75 }, 1: { cellWidth: 15 }, 2: { cellWidth: 15 }, 3: { cellWidth: 'auto' } },
            headStyles: { fillColor: COR_PRIMARIA, textColor: 255, fontStyle: 'bold', halign: 'center' }
        });

        let finalY = doc.lastAutoTable.finalY + 10;

        if (isChecklist && data.obs_gerais_vistoria) {
            if (finalY > 250) { doc.addPage(); finalY = 20; }
            doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
            doc.text("CONSIDERAÇÕES GERAIS DA VISTORIA:", MARGIN, finalY);
            doc.setFont('helvetica', 'normal').setTextColor(50).setFontSize(9);
            const splitObs = doc.splitTextToSize(data.obs_gerais_vistoria, PG_W - (MARGIN * 2));
            doc.text(splitObs, MARGIN, finalY + 6);
            finalY += (splitObs.length * 5) + 12;
        }

        if (isChecklist) {
            if (finalY > 230) { doc.addPage(); finalY = 20; }
            doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(COR_PRIMARIA[0], COR_PRIMARIA[1], COR_PRIMARIA[2]);
            doc.text("EVIDÊNCIAS FOTOGRÁFICAS (ANEXOS):", MARGIN, finalY);
            const boxW = 55, boxH = 40, spacing = 5;
            for (let i = 0; i < 5; i++) {
                const col = i % 3;
                const row = Math.floor(i / 3);
                const xPos = MARGIN + (col * (boxW + spacing));
                const yPos = finalY + 5 + (row * (boxH + spacing));
                doc.setDrawColor(200).setFillColor(245).rect(xPos, yPos, boxW, boxH, 'F');
                doc.setFontSize(7).setTextColor(150).text(`FOTO ${i + 1}`, xPos + boxW / 2, yPos + boxH / 2, { align: 'center' });
            }
        }

        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8).setTextColor(100).setFont('helvetica', 'normal');
            doc.text('SIGMA - Sistema Integrado de Gestão de Materiais e Vistorias', MARGIN, doc.internal.pageSize.height - 10);
            doc.text(`Pág. ${i} de ${totalPages}`, PG_W - MARGIN, doc.internal.pageSize.height - 10, { align: 'right' });
            const hashSimples = btoa(`${data.id}-${data.conferente}`).substring(0, 20).toUpperCase();
            doc.setFontSize(7).setTextColor(150).setFont('courier', 'normal');
            doc.text(`CHAVE DE AUTENTICIDADE: ${hashSimples}`, MARGIN, doc.internal.pageSize.height - 15);
        }

        // 1. GERAÇÃO DO BINÁRIO (BLOB)
        const pdfBlob = doc.output('blob');
        
        // --- ATUALIZAÇÃO DO NOME: PADRÃO [LOCAL]_[DATA] ---
        // Extrai o local (ex: BRAVO ABT-18) e limpa espaços
        const nomeLocal = (data.local || "RELATORIO").replace(/\s+/g, '_').toUpperCase();
        
        // Formata a data do relatório (ou atual) para 18.02.2026
        const dataDoc = data.timestamp?.seconds ? new Date(data.timestamp.seconds * 1000) : new Date();
        const dataFormatada = dataDoc.toLocaleDateString('pt-BR').replace(/\//g, '.');
        
        // Define o nome final: BRAVO_ABT-18_18.02.2026.pdf
        window.currentPdfName = `${nomeLocal}_${dataFormatada}.pdf`;
        // --------------------------------------------------

        // 2. ARMAZENAMENTO GLOBAL (Para as funções de Imprimir/Compartilhar)
        window.currentPdfBlob = pdfBlob;
        
        // Atualiza o nome do arquivo no topo do modal para o usuário ver
        const fileNameLabel = document.getElementById('pdf-modal-filename');
        if (fileNameLabel) fileNameLabel.textContent = window.currentPdfName;

        // 3. ACIONAMENTO DO MOTOR DE RENDERIZAÇÃO V3 (Canvas)
        renderizarPdfV3(pdfBlob);

    } catch (e) {
        console.error("Erro PDF Unificado:", e);
        Swal.fire({
            icon: 'error',
            title: 'Erro ao gerar documento',
            text: e.message
        });
    }
}

/* --- FUNÇÕES DE CONTROLE DO VISUALIZADOR DE PDF SIGMA V3 --- */

// 1. Renderiza o PDF no Canvas para garantir 100% de compatibilidade mobile.
async function renderizarPdfV3(pdfBlob) {
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

    try {
        const arrayBuffer = await pdfBlob.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        // Seleciona a primeira página
        const page = await pdf.getPage(1);

        const canvas = document.getElementById('pdf-render-canvas');
        const context = canvas.getContext('2d');

        // Limpa o canvas anterior para nova renderização
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Escala 1.5 para alta definição (Retina/Mobile)
        const viewport = page.getViewport({ scale: 1.5 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };

        await page.render(renderContext).promise;
        
        // Exibe o modal
        document.getElementById('modal-pdf-viewer').style.display = 'flex';
        console.log("✅ [SIGMA V3] PDF renderizado via Canvas.");

    } catch (error) {
        console.error("Erro na renderização técnica:", error);
        Swal.fire('Erro Visual', 'Falha ao desenhar o PDF no sistema.', 'error');
    }
}

// 2. FECHAR: Limpa a memória e esconde o modal
function fecharVisualizadorPdf() {
    const canvas = document.getElementById('pdf-render-canvas');
    if (canvas) {
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0; 
        canvas.height = 0;
    }
    
    // Esconde o overlay
    document.getElementById('modal-pdf-viewer').style.display = 'none';
    
    // Opcional: Liberar URL do blob se existir
    if (window.currentPdfUrl) {
        URL.revokeObjectURL(window.currentPdfUrl);
        window.currentPdfUrl = null;
    }
}

// 3. IMPRIMIR: Foca no documento e dispara a impressora
function imprimirPdfInterno() {
    if (!window.currentPdfBlob) {
        return Swal.fire('Erro', 'Documento não encontrado.', 'error');
    }

    // Criamos a URL do Blob
    const fileURL = URL.createObjectURL(window.currentPdfBlob);
    
    // Criamos um frame temporário com ID único
    const frameId = 'print-frame-' + Date.now();
    const printFrame = document.createElement('iframe');
    
    printFrame.id = frameId;
    printFrame.style.position = 'fixed';
    printFrame.style.bottom = '0';
    printFrame.style.right = '0';
    printFrame.style.width = '1px';
    printFrame.style.height = '1px';
    printFrame.style.border = 'none';
    printFrame.style.visibility = 'hidden'; // Esconde mas mantém no DOM
    
    printFrame.src = fileURL;

    document.body.appendChild(printFrame);

    printFrame.onload = function() {
        try {
            // Focamos no frame carregado
            printFrame.contentWindow.focus();
            
            // Disparamos a impressão
            const printed = printFrame.contentWindow.print();

            // O SEGREDO: Só removemos o frame quando o foco voltar para a janela principal
            // ou após um tempo longo o suficiente para o spooler de impressão receber os dados.
            window.addEventListener('focus', function handler() {
                setTimeout(() => {
                    if (document.getElementById(frameId)) {
                        document.body.removeChild(printFrame);
                        URL.revokeObjectURL(fileURL);
                    }
                }, 1000);
                window.removeEventListener('focus', handler);
            }, { once: true });

        } catch (e) {
            console.warn("Erro no print direto, abrindo fallback...", e);
            window.open(fileURL, '_blank');
        }
    };
}

// 4. COMPARTILHAR: Integração nativa com Android/iOS (WhatsApp, etc)
async function compartilharPdfInterno() {
    if (!window.currentPdfBlob) {
        return Swal.fire('Atenção', 'Nenhum arquivo pronto para compartilhar.', 'warning');
    }

    const fileName = window.currentPdfName || "relatorio_sigma.pdf";
    const file = new File([window.currentPdfBlob], fileName, { type: 'application/pdf' });

    // Verifica suporte nativo (Android/iOS)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                title: 'SIGMA - Relatório',
                text: 'Segue em anexo o relatório de conferência.',
                files: [file]
            });
        } catch (err) {
            console.log("Compartilhamento cancelado ou falhou silenciosamente.");
        }
    } else {
        // Fallback para PC ou Navegadores sem suporte a Share API: DOWNLOAD
        const link = document.createElement('a');
        link.href = URL.createObjectURL(window.currentPdfBlob);
        link.download = fileName;
        link.click();
        
        Swal.fire({ 
            icon: 'info', 
            title: 'Download Realizado', 
            text: 'Seu navegador não suporta compartilhamento direto. O arquivo foi baixado para sua pasta de downloads.',
            timer: 3000 
        });
    }
}

// Força o fechamento do menu e do fundo escurecido (overlay)
function closeMenuMobile() {
    const s = document.getElementById('main-sidebar');
    const overlay = document.getElementById('mobile-overlay');

    if (s) s.classList.remove('mobile-active');
    if (overlay) overlay.style.display = 'none';
}

//=== Gera o formato de log usado no "Histórico de Vida" dos itens ===/
function gerarLogMovimentacao(itemObj, evento, detalhes) {
    if (!itemObj.historico_vida) itemObj.historico_vida = [];

    itemObj.historico_vida.push({
        data: new Date().toLocaleString('pt-BR'),
        evento: evento,
        autor: `${userInfo.postoGraduacao} ${userInfo.nomeGuerra}`,
        detalhes: detalhes,
        timestamp: Date.now()
    });

    return itemObj.historico_vida;
}
