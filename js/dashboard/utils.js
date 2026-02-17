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

        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        document.getElementById('sigma-v3-pdf-frame').src = pdfUrl;
        document.getElementById('modal-pdf-viewer').style.display = 'flex';
        window.currentPdfBlob = pdfBlob;

    } catch (e) {
        console.error("Erro PDF Unificado:", e);
        alert("Erro ao gerar PDF: " + e.message);
    }
}

/* --- FUNÇÕES DE CONTROLE DO VISUALIZADOR DE PDF SIGMA V3 --- */

// 1. FECHAR: Limpa a memória e esconde o modal
function fecharVisualizadorPdf() {
    const frame = document.getElementById('sigma-v3-pdf-frame');
    if (frame) frame.src = 'about:blank'; // Evita rastro do PDF anterior
    document.getElementById('modal-pdf-viewer').style.display = 'none';
}

// 2. IMPRIMIR: Foca no documento e dispara a impressora
function imprimirPdfInterno() {
    const frame = document.getElementById('sigma-v3-pdf-frame');
    if (frame && frame.contentWindow) {
        frame.contentWindow.focus();
        frame.contentWindow.print();
    } else {
        alert("Não foi possível acionar a impressora neste navegador.");
    }
}

// 3. COMPARTILHAR: Integração nativa com Android/iOS (WhatsApp, etc)
async function compartilharPdfInterno() {
    if (!window.currentPdfBlob) return alert("Nenhum arquivo pronto para compartilhar.");

    const file = new File([window.currentPdfBlob], window.currentPdfName, { type: 'application/pdf' });

    // Verifica se o navegador suporta compartilhamento de arquivos (Mobile e Safari Desktop)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                title: 'SIGMA - Relatório',
                text: 'Segue em anexo o relatório gerado pelo sistema SIGMA.',
                files: [file]
            });
        } catch (err) {
            console.log("Compartilhamento cancelado.");
        }
    } else {
        // Fallback: Se não suportar share, ele faz o download como segurança
        const link = document.createElement('a');
        link.href = URL.createObjectURL(window.currentPdfBlob);
        link.download = window.currentPdfName;
        link.click();
        Swal.fire({ icon: 'info', title: 'Download realizado', text: 'Seu dispositivo não suporta compartilhamento direto, o arquivo foi baixado.', timer: 2000 });
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
