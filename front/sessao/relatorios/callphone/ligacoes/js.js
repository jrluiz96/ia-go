console.log('📦 Carregando módulo front/frontend/sessao/relatorios/callphone/ligacoes/js.js...');
// Relatório de Ligações - Sistema Bash
(function() {
    'use strict';

    // Estado global da aplicação
    let appState = {
        ligacoes: [],
        filtros: {
            dataInicio: '',
            dataFim: '',
            broker_id: '',
            protocolo_interno: '',
            protocolo_integracao: '',
            operador: '',
            num_cliente: '',
            nome_fila: '',
            statusLigacao: '',
            origem_desligamento: '',
            tipo: '',
            inicioFila: ''
        },
        pagina: 1,
        total: 0,
        limit: 20,
        loading: false,
        componentes: {
            tabela: null,
            paginacao: null
        }
    };

    // ============ INICIALIZAÇÃO ============
    
    // Filtros recebidos do sistema principal
    let filtrosExternos = null;
    
    // Resetar filtros para valores iniciais
    function resetFiltros() {
        appState.filtros = {
            dataInicio: '',
            dataFim: '',
            broker_id: '',
            protocolo_interno: '',
            protocolo_integracao: '',
            operador: '',
            num_cliente: '',
            nome_fila: '',
            statusLigacao: '',
            origem_desligamento: '',
            tipo: '',
            inicioFila: ''
        };
        appState.pagina = 1;
        appState.total = 0;
        appState.ligacoes = [];
        // Resetar componentes para serem recriados
        appState.componentes.tabela = null;
        appState.componentes.paginacao = null;
    }
    
    function init(filtros) {
        console.log('Inicializando relatório de ligações...', filtros);
        
        // Resetar filtros antes de aplicar novos
        resetFiltros();
        
        // Guardar filtros recebidos
        filtrosExternos = filtros || {};
        
        // Aplicar filtros externos ao estado
        if (filtrosExternos.data_inicio) {
            appState.filtros.dataInicio = filtrosExternos.data_inicio;
        }
        if (filtrosExternos.data_fim) {
            appState.filtros.dataFim = filtrosExternos.data_fim;
        }
        if (filtrosExternos.broker_id) {
            appState.filtros.broker_id = filtrosExternos.broker_id;
        }
        // Filtros avançados
        if (filtrosExternos.protocolo_interno) {
            appState.filtros.protocolo_interno = filtrosExternos.protocolo_interno;
        }
        if (filtrosExternos.protocolo_integracao) {
            appState.filtros.protocolo_integracao = filtrosExternos.protocolo_integracao;
        }
        if (filtrosExternos.operador_id) {
            appState.filtros.operador = filtrosExternos.operador_id;
        }
        if (filtrosExternos.num_cliente) {
            appState.filtros.num_cliente = filtrosExternos.num_cliente;
        }
        if (filtrosExternos.nome_fila) {
            appState.filtros.nome_fila = filtrosExternos.nome_fila;
        }
        if (filtrosExternos.status) {
            appState.filtros.statusLigacao = filtrosExternos.status;
        }
        if (filtrosExternos.origem_desligamento) {
            appState.filtros.origem_desligamento = filtrosExternos.origem_desligamento;
        }
        if (filtrosExternos.tipo) {
            appState.filtros.tipo = filtrosExternos.tipo;
        }
        if (filtrosExternos.inicio_fila) {
            appState.filtros.inicioFila = filtrosExternos.inicio_fila;
        }
        
        buildTabela();
        loadLigacoes();
    }

    // ============ CONSTRUÇÃO DA INTERFACE ============

    function buildTabela() {
        const container = document.getElementById('ligacoes-tabela-container');
        if (!container) return;

        // Limpar container antes de reconstruir
        container.innerHTML = '';

        const card = document.createElement('div');
        card.className = 'card bg-base-100 shadow-md';
        
        const cardBody = document.createElement('div');
        cardBody.className = 'card-body';

        // Header com título e botões de exportação
        const header = document.createElement('div');
        header.className = 'flex justify-between items-center mb-4';
        header.innerHTML = `
            <h3 class="card-title text-lg">
                <i class="fas fa-table"></i>
                Detalhes das Ligações
            </h3>
            <div class="flex gap-2">
                <button class="btn btn-sm btn-outline gap-2" onclick="relatorios.callphone.ligacoes.exportExcel()">
                    <i class="fas fa-file-excel"></i>
                    Exportar Excel
                </button>
            
            </div>
        `;

        // Wrapper para a tabela
        const tableWrapper = document.createElement('div');
        tableWrapper.id = 'ligacoes-data-container';
        tableWrapper.className = 'overflow-x-auto';

        // Criar tabela com BashTable
        const colunas = [
            {
                label: 'Protocolo',
                value: 'protocolo',
                format: (value) => value || '-'
            },
            {
                label: 'Origem',
                value: 'telefone',
                format: (value) => value || '-'
            },
            {
                label: 'Tipo',
                value: 'status',
                format: (value) => value || '-'
            },
            {
                label: 'Data/Hora',
                value: 'calldate_formated',
                format: (value) => value || '-'
            },
            {
                label: 'Duração',
                value: 'dif_data_ini_atendimento_date_final',
                format: (value) => value || '00:00:00'
            },
            {
                label: 'Atendida',
                value: 'status',
                format: (value) => {
                    const atendida = value === 'Finalizada';
                    const badgeClass = atendida ? 'badge-success' : 'badge-error';
                    const text = atendida ? 'Sim' : 'Não';
                    return `<span class="badge ${badgeClass} badge-sm">${text}</span>`;
                }
            },
            {
                label: 'Desligou',
                value: 'bl_atendente_desligou',
                format: (value, row) => {
                    if (value === true) {
                        return '<span class="badge badge-warning badge-sm">Atendente</span>';
                    } else if (row.bl_cliente_desligou === true) {
                        return '<span class="badge badge-info badge-sm">Cliente</span>';
                    }
                    return '-';
                }
            },
            {
                label: 'Fila',
                value: 'fila',
                format: (value) => value || '-'
            },
            {
                label: 'Usuário',
                value: 'usuario',
                format: (value) => value || '-'
            },
            {
                label: 'URA',
                value: 'ura',
                format: (value, row) => {
                    if (value) {
                        return `
                            <button class="btn btn-sm btn-ghost btn-outline" 
                                    onclick="relatorios.callphone.ligacoes.visualizarURA('${value}')" 
                                    title="Ver Histórico URA">
                                <i class="fas fa-eye"></i>
                            </button>
                        `;
                    }
                    return '-';
                }
            },
            {
                label: 'Tipo',
                value: 'bl_ativo',
                format: (value) => {
                    return value ? 'Ativo' : 'Receptivo'
                }
            },
            {
                label: 'Ações',
                value: 'protocolo',
                format: (value, row) => {
                    const baseUrl = 'https://app-callphone.bashtechnology.com.br';
                    let actions = '';
                    
                    if (row.gravacao) {
                        // Botão play para ouvir gravação
                        const audioUrl = `${baseUrl}/convertGsm.php?protocolo=${value}&name=${encodeURIComponent(row.gravacao)}`;
                        actions += `
                            <button class="btn btn-sm btn-primary btn-outline" 
                                    onclick="ligacoes.abrirPlayer('${value}', '${audioUrl}', '${row.fila || ''}', '${row.telefone || ''}', '${row.usuario || ''}')" 
                                    title="Ouvir Gravação">
                                <i class="fas fa-play"></i>
                            </button>
                        `;
                        
                        // Botão download
                        actions += `
                            <a class="btn btn-sm btn-ghost btn-outline" 
                               href="${audioUrl}" 
                               download="${value}.mp3"
                               title="Baixar Gravação">
                                <i class="fas fa-download"></i>
                            </a>
                        `;
                    } else {
                        actions = '<span class="text-base-content/50 text-xs">Sem gravação</span>';
                    }
                    
                    return actions;
                }
            }
        ];

        const tabela = new BashTable({
            id: 'tabela-ligacoes',
            columns: colunas,
            data: appState.ligacoes,
            classList: 'table table-sm table-zebra w-full',
            emptyMessage: 'Nenhuma ligação encontrada.'
        });

        appState.componentes.tabela = tabela;

        tableWrapper.appendChild(tabela.getElement()[0]);
        cardBody.appendChild(header);
        cardBody.appendChild(tableWrapper);
        card.appendChild(cardBody);
        container.appendChild(card);
    }

    // ============ CARREGAMENTO DE DADOS ============

    function loadLigacoes() {
        if (appState.loading) return;
        
        setLoading(true);
        
        const params = new URLSearchParams({
            page: appState.pagina,
            page_size: appState.limit
        });

        // Adicionar filtros
        Object.keys(appState.filtros).forEach(key => {
            if (appState.filtros[key]) {
                params.append(key, appState.filtros[key]);
            }
        });

        const url = `v1/relatorios/callphone/ligacoes?${params.toString()}`;
        
        req(url, 'GET', '',
            function(response) {
                setLoading(false);
                if (response && response.data) {
                    appState.ligacoes = response.data.protocolo;
                    appState.total = response.data.total;
                    renderLigacoesTable();
                    setupPagination();
                } else {
                    renderLigacoesTable([]);
                }
            },
            function(error) {
                setLoading(false);
                console.error('Erro ao carregar ligações:', error);
                avisos('Erro', error?.message || 'Não foi possível carregar as ligações', 'error');
                renderLigacoesTable([]);
            }
        );
    }

    // ============ RENDERIZAÇÃO ============

    function renderLigacoesTable() {
        if (!appState.componentes.tabela) return;
        
        // Atualizar dados da tabela usando BashTable
        appState.componentes.tabela.updateData(appState.ligacoes);
    }

    // ============ PAGINAÇÃO ============

    function setupPagination() {
        const paginacaoContainer = document.getElementById('ligacoes-paginacao');
        
        if (appState.componentes.paginacao) {
            appState.componentes.paginacao.update(appState.pagina, appState.total);
        } else {
            // Limpar container antes de criar
            if (paginacaoContainer) paginacaoContainer.innerHTML = '';
            
            appState.componentes.paginacao = new window.BashPagination({
                id: 'ligacoes-pagination',
                pagina: appState.pagina,
                total: appState.total,
                limit: appState.limit,
                container: '#ligacoes-paginacao',
                onNext: (pagina) => {
                    appState.pagina = pagina;
                    loadLigacoes();
                },
                onPrev: (pagina) => {
                    appState.pagina = pagina;
                    loadLigacoes();
                }
            });
        }
    }

    // ============ AÇÕES ============

    function visualizarLigacao(id) {
        console.log('Visualizar ligação:', id);
        // Implementar modal de visualização
        avisos('Info', 'Funcionalidade de visualização em desenvolvimento', 'info');
    }

    function visualizarURA(uraData) {
        if (!uraData) {
            avisos('Aviso', 'Nenhum histórico de URA disponível', 'warning');
            return;
        }

        // Separar os dados da URA por vírgula
        const historico = uraData.split(',').map(item => item.trim()).filter(item => item);

        if (historico.length === 0) {
            avisos('Aviso', 'Nenhum histórico de URA disponível', 'warning');
            return;
        }

        // Criar modal usando BashModal
        const modal = new BashModal({
            id: 'modal-ura-historico',
            titulo: 'Histórico URA',
            mensagem: '',
            classSize: 'max-w-2xl',
            destroy: true
        });

        // Criar conteúdo do histórico
        const content = document.createElement('div');
        content.className = 'space-y-3';

        historico.forEach((item, index) => {
            const eventDiv = document.createElement('div');
            eventDiv.className = 'flex items-start gap-3 p-3 bg-base-200 rounded-lg';
            
            const iconDiv = document.createElement('div');
            iconDiv.className = 'flex-shrink-0 w-8 h-8 flex items-center justify-center bg-primary/20 text-primary rounded-full';
            iconDiv.innerHTML = `<i class="fas fa-phone-volume text-sm"></i>`;
            
            const textDiv = document.createElement('div');
            textDiv.className = 'flex-1';
            
            const stepNumber = document.createElement('div');
            stepNumber.className = 'text-xs font-semibold text-base-content/60 mb-1';
            stepNumber.textContent = `Etapa ${index + 1}`;
            
            const stepText = document.createElement('div');
            stepText.className = 'text-sm text-base-content';
            stepText.textContent = item;
            
            textDiv.appendChild(stepNumber);
            textDiv.appendChild(stepText);
            eventDiv.appendChild(iconDiv);
            eventDiv.appendChild(textDiv);
            content.appendChild(eventDiv);
        });

        // Adicionar botão de fechar
        const closeButton = document.createElement('button');
        closeButton.className = 'btn btn-primary btn-sm mt-4';
        closeButton.innerHTML = '<i class="fas fa-times mr-2"></i>Fechar';
        closeButton.onclick = () => modal.close();

        // Adicionar conteúdo ao modal
        const wrapper = document.createElement('div');
        wrapper.appendChild(content);
        wrapper.appendChild(closeButton);
        
        modal.setContent(wrapper);
        modal.open();
    }

    // ============ EXPORTAÇÃO EXCEL ============

    async function exportExcel() {
        console.log('Exportando relatório para Excel...');
        
        // Verificar se a biblioteca SheetJS está disponível
        if (typeof XLSX === 'undefined') {
            avisos('Erro', 'Biblioteca de exportação não carregada. Recarregue a página.', 'error');
            console.error('SheetJS (XLSX) não está disponível');
            return;
        }

        // Mostrar modal de progresso
        showDownloadModal();
        updateDownloadProgress(10, 'Buscando dados para exportação...');

        // Construir parâmetros com os filtros atuais
        const params = new URLSearchParams();
        
        if (appState.filtros.dataInicio) {
            params.append('dataInicio', appState.filtros.dataInicio);
        }
        if (appState.filtros.dataFim) {
            params.append('dataFim', appState.filtros.dataFim);
        }
        if (appState.filtros.broker_id) {
            params.append('broker_id', appState.filtros.broker_id);
        }
        if (appState.filtros.protocolo_interno) {
            params.append('protocolo_interno', appState.filtros.protocolo_interno);
        }
        if (appState.filtros.operador) {
            params.append('operador', appState.filtros.operador);
        }
        if (appState.filtros.num_cliente) {
            params.append('num_cliente', appState.filtros.num_cliente);
        }
        if (appState.filtros.nome_fila) {
            params.append('nome_fila', appState.filtros.nome_fila);
        }
        if (appState.filtros.statusLigacao) {
            params.append('statusLigacao', appState.filtros.statusLigacao);
        }
        if (appState.filtros.origem_desligamento) {
            params.append('origem_desligamento', appState.filtros.origem_desligamento);
        }
        if (appState.filtros.tipo) {
            params.append('tipo', appState.filtros.tipo);
        }
        if (appState.filtros.inicioFila) {
            params.append('inicioFila', appState.filtros.inicioFila);
        }

        try {
            updateDownloadProgress(30, 'Consultando registros...');
            
            const url = `v1/relatorios/callphone/ligacoes/exportar?${params.toString()}`;
            const response = await reqAsync(url, 'GET');

            if (!response || !response.data || response.data.length === 0) {
                closeDownloadModal();
                avisos('Aviso', 'Nenhum dado encontrado para exportar', 'warning');
                return;
            }

            updateDownloadProgress(60, `Gerando arquivo com ${response.data.length} registros...`);

            // Preparar dados para o Excel (igual ao PHP)
            const dados = response.data.map(row => {
                // Tipo da ligação
                const tipoLigacao = row.bl_ativo ? 'Ativo' : 'Receptivo';
                
                // Origem desligamento
                let origemDesligamento = '';
                if (row.bl_atendente_desligou === true) {
                    origemDesligamento = 'Atendente Desligou';
                } else if (row.bl_cliente_desligou === true) {
                    origemDesligamento = 'Cliente Desligou';
                }

                // Classificação
                const classificacao = row.classificacao_call || row.tipo_classificador || '';
                
                return {
                    'Protocolo': row.protocolo || '',
                    'Fila': row.fila || '',
                    'Tipo': tipoLigacao,
                    'Usuario': row.usuario || '',
                    'Status': row.status || '',
                    'Origem': row.telefone || '',
                    'Espera': row.tme_formated || '',
                    'Iniciado': row.calldate_formated || '',
                    'Inicio Fila': row.data_inicio_sla_formated || '',
                    'Atendido': row.data_ini_atendimento_formated || '',
                    'Finalizado': row.data_final_formated || '',
                    'Duração Total': row.dif_calldate_date_final || '',
                    'Duração Atendimento': row.tma_formated || '',
                    'Categoria': classificacao,
                    'Origem desligamento': origemDesligamento,
                    'Nota do Atendimento': row.psq_satisfacao_atendente || '',
                    'Nota do Serviço': row.psq_satisfacao_servico || '',
                    'CPF Cliente': row.cpf_cliente || '',
                    'URA': row.ura || ''
                };
            });

            updateDownloadProgress(80, 'Criando arquivo Excel...');
            
            // Criar workbook e worksheet
            const ws = XLSX.utils.json_to_sheet(dados);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Ligações');
            
            // Ajustar largura das colunas (19 colunas como no PHP)
            const colWidths = [
                { wch: 15 }, // Protocolo
                { wch: 25 }, // Fila
                { wch: 10 }, // Tipo
                { wch: 20 }, // Usuario
                { wch: 12 }, // Status
                { wch: 15 }, // Origem
                { wch: 10 }, // Espera
                { wch: 18 }, // Iniciado
                { wch: 18 }, // Inicio Fila
                { wch: 18 }, // Atendido
                { wch: 18 }, // Finalizado
                { wch: 12 }, // Duração Total
                { wch: 15 }, // Duração Atendimento
                { wch: 20 }, // Categoria
                { wch: 18 }, // Origem desligamento
                { wch: 18 }, // Nota do Atendimento
                { wch: 15 }, // Nota do Serviço
                { wch: 15 }, // CPF Cliente
                { wch: 30 }  // URA
            ];
            ws['!cols'] = colWidths;

            updateDownloadProgress(95, 'Preparando download...');
            
            // Gerar nome do arquivo com data/hora atual
            const agora = new Date();
            const dataHora = agora.toISOString().slice(0, 19).replace(/:/g, '-').replace('T', '_');
            const nomeArquivo = `relatorio_ligacoes_${dataHora}.xlsx`;
            
            // Baixar arquivo
            XLSX.writeFile(wb, nomeArquivo);

            updateDownloadProgress(100, 'Download concluído!');
            
            setTimeout(() => {
                closeDownloadModal();
                avisos('Sucesso', `Arquivo Excel baixado com sucesso! (${response.data.length} registros)`, 'success');
            }, 1000);

        } catch (error) {
            console.error('Erro ao exportar:', error);
            closeDownloadModal();
            avisos('Erro', 'Erro ao gerar arquivo Excel: ' + (error.message || 'Erro desconhecido'), 'error');
        }
    }

    function showDownloadModal() {
        // Remover modal anterior se existir
        const modalAnterior = document.getElementById('modal-download-relatorio');
        if (modalAnterior) modalAnterior.remove();

        const modal = document.createElement('div');
        modal.id = 'modal-download-relatorio';
        modal.className = 'modal modal-open';
        modal.innerHTML = `
            <div class="modal-box max-w-md bg-base-200">
                <div class="text-center">
                    <div class="mb-4">
                        <span class="loading loading-spinner loading-lg text-primary"></span>
                    </div>
                    <h3 class="font-bold text-lg mb-2">Exportando Relatório</h3>
                    <p id="download-status-text" class="text-sm text-base-content/60 mb-4">Preparando exportação...</p>
                    
                    <div class="w-full bg-base-300 rounded-full h-3 mb-4">
                        <div id="download-progress-bar" class="bg-primary h-3 rounded-full transition-all duration-300" style="width: 0%"></div>
                    </div>
                    
                    <p id="download-progress-text" class="text-xs text-base-content/50">0%</p>
                </div>
            </div>
            <div class="modal-backdrop bg-black/50"></div>
        `;
        
        document.body.appendChild(modal);
    }

    function updateDownloadProgress(percent, text) {
        const progressBar = document.getElementById('download-progress-bar');
        const progressText = document.getElementById('download-progress-text');
        const statusText = document.getElementById('download-status-text');
        
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressText) progressText.textContent = `${percent}%`;
        if (statusText && text) statusText.textContent = text;
    }

    function closeDownloadModal() {
        const modal = document.getElementById('modal-download-relatorio');
        if (modal) modal.remove();
    }

    function stopDownloadMonitor() {
        // Mantido para compatibilidade
        closeDownloadModal();
    }


    function ouvirGravacao(caminhoGravacao) {
        console.log('Ouvir gravação:', caminhoGravacao);
        // Funcionalidade movida para abrirPlayer
    }

    function abrirPlayer(protocolo, audioUrl, fila, telefone, usuario) {
        // Remover modal anterior se existir
        const modalAnterior = document.getElementById('modal-audio-player');
        if (modalAnterior) modalAnterior.remove();

        // Criar modal
        const modal = document.createElement('div');
        modal.id = 'modal-audio-player';
        modal.className = 'modal modal-open';
        modal.innerHTML = `
            <div class="modal-box max-w-lg bg-base-200">
                <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onclick="document.getElementById('modal-audio-player').remove()">
                    <i class="fas fa-times"></i>
                </button>
                
                <div class="text-center mb-6">
                    <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
                        <i class="fas fa-headphones text-4xl text-primary"></i>
                    </div>
                    <h3 class="font-bold text-xl">Gravação da Ligação</h3>
                    <p class="text-sm text-base-content/60 mt-1">Protocolo: ${protocolo}</p>
                </div>
                
                <!-- Informações da ligação -->
                <div class="grid grid-cols-3 gap-4 mb-6 text-center">
                    <div class="bg-base-100 rounded-lg p-3">
                        <i class="fas fa-layer-group text-primary mb-1"></i>
                        <p class="text-xs text-base-content/60">Fila</p>
                        <p class="font-semibold text-sm truncate" title="${fila || '-'}">${fila || '-'}</p>
                    </div>
                    <div class="bg-base-100 rounded-lg p-3">
                        <i class="fas fa-phone text-success mb-1"></i>
                        <p class="text-xs text-base-content/60">Telefone</p>
                        <p class="font-semibold text-sm">${telefone || '-'}</p>
                    </div>
                    <div class="bg-base-100 rounded-lg p-3">
                        <i class="fas fa-user text-info mb-1"></i>
                        <p class="text-xs text-base-content/60">Atendente</p>
                        <p class="font-semibold text-sm truncate" title="${usuario || '-'}">${usuario || '-'}</p>
                    </div>
                </div>
                
                <!-- Player de áudio -->
                <div class="bg-base-100 rounded-xl p-4">
                    <div id="audio-loading" class="text-center py-4">
                        <span class="loading loading-spinner loading-lg text-primary"></span>
                        <p class="mt-2 text-sm text-base-content/60">Carregando áudio...</p>
                    </div>
                    
                    <div id="audio-player-container" class="hidden">
                        <!-- Controles customizados -->
                        <div class="flex items-center gap-4 mb-4">
                            <button id="btn-play-pause" class="btn btn-circle btn-primary btn-lg" onclick="ligacoes.togglePlay()">
                                <i class="fas fa-play text-xl" id="icon-play-pause"></i>
                            </button>
                            <div class="flex-1">
                                <input type="range" id="audio-progress" class="range range-primary range-sm w-full" value="0" min="0" max="100" oninput="ligacoes.seekAudio(this.value)">
                                <div class="flex justify-between text-xs text-base-content/60 mt-1">
                                    <span id="current-time">00:00</span>
                                    <span id="total-time">00:00</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Controle de volume -->
                        <div class="flex items-center gap-3">
                            <button class="btn btn-ghost btn-sm" onclick="ligacoes.toggleMute()">
                                <i class="fas fa-volume-up" id="icon-volume"></i>
                            </button>
                            <input type="range" id="audio-volume" class="range range-sm range-primary w-24" value="100" min="0" max="100" oninput="ligacoes.setVolume(this.value)">
                            <div class="flex-1"></div>
                            <button class="btn btn-ghost btn-sm" onclick="ligacoes.setPlaybackRate(0.5)" title="0.5x">0.5x</button>
                            <button class="btn btn-ghost btn-sm btn-active" id="btn-speed-1" onclick="ligacoes.setPlaybackRate(1)" title="1x">1x</button>
                            <button class="btn btn-ghost btn-sm" onclick="ligacoes.setPlaybackRate(1.5)" title="1.5x">1.5x</button>
                            <button class="btn btn-ghost btn-sm" onclick="ligacoes.setPlaybackRate(2)" title="2x">2x</button>
                        </div>
                    </div>
                    
                    <div id="audio-error" class="hidden text-center py-4">
                        <i class="fas fa-exclamation-triangle text-4xl text-error mb-2"></i>
                        <p class="text-error">Erro ao carregar áudio</p>
                        <p class="text-xs text-base-content/60 mt-1">Verifique se a gravação existe</p>
                    </div>
                    
                    <audio id="audio-element" class="hidden" preload="auto"></audio>
                </div>
                
                <!-- Ações -->
                <div class="modal-action">
                    <a href="${audioUrl}" download="${protocolo}.mp3" class="btn btn-outline gap-2">
                        <i class="fas fa-download"></i>
                        Baixar MP3
                    </a>
                    <button class="btn btn-ghost" onclick="document.getElementById('modal-audio-player').remove()">
                        Fechar
                    </button>
                </div>
            </div>
            <div class="modal-backdrop bg-black/50" onclick="document.getElementById('modal-audio-player').remove()"></div>
        `;
        
        document.body.appendChild(modal);
        
        // Inicializar áudio
        const audio = document.getElementById('audio-element');
        const loading = document.getElementById('audio-loading');
        const playerContainer = document.getElementById('audio-player-container');
        const errorDiv = document.getElementById('audio-error');
        
        audio.src = audioUrl;
        
        audio.addEventListener('canplaythrough', () => {
            loading.classList.add('hidden');
            playerContainer.classList.remove('hidden');
            document.getElementById('total-time').textContent = formatTime(audio.duration);
        });
        
        audio.addEventListener('error', () => {
            loading.classList.add('hidden');
            errorDiv.classList.remove('hidden');
        });
        
        audio.addEventListener('timeupdate', () => {
            const progress = (audio.currentTime / audio.duration) * 100;
            document.getElementById('audio-progress').value = progress;
            document.getElementById('current-time').textContent = formatTime(audio.currentTime);
        });
        
        audio.addEventListener('ended', () => {
            document.getElementById('icon-play-pause').className = 'fas fa-play text-xl';
        });
    }

    function togglePlay() {
        const audio = document.getElementById('audio-element');
        const icon = document.getElementById('icon-play-pause');
        
        if (audio.paused) {
            audio.play();
            icon.className = 'fas fa-pause text-xl';
        } else {
            audio.pause();
            icon.className = 'fas fa-play text-xl';
        }
    }

    function seekAudio(value) {
        const audio = document.getElementById('audio-element');
        audio.currentTime = (value / 100) * audio.duration;
    }

    function setVolume(value) {
        const audio = document.getElementById('audio-element');
        const icon = document.getElementById('icon-volume');
        
        audio.volume = value / 100;
        
        if (value == 0) {
            icon.className = 'fas fa-volume-mute';
        } else if (value < 50) {
            icon.className = 'fas fa-volume-down';
        } else {
            icon.className = 'fas fa-volume-up';
        }
    }

    function toggleMute() {
        const audio = document.getElementById('audio-element');
        const volumeSlider = document.getElementById('audio-volume');
        
        if (audio.volume > 0) {
            audio.dataset.previousVolume = audio.volume;
            audio.volume = 0;
            volumeSlider.value = 0;
        } else {
            audio.volume = audio.dataset.previousVolume || 1;
            volumeSlider.value = audio.volume * 100;
        }
        setVolume(audio.volume * 100);
    }

    function setPlaybackRate(rate) {
        const audio = document.getElementById('audio-element');
        audio.playbackRate = rate;
        
        // Atualizar botões de velocidade
        document.querySelectorAll('[id^="btn-speed"]').forEach(btn => btn.classList.remove('btn-active'));
        const activeBtn = document.querySelector(`[onclick="ligacoes.setPlaybackRate(${rate})"]`);
        if (activeBtn) activeBtn.classList.add('btn-active');
    }

    function formatTime(seconds) {
        if (isNaN(seconds)) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // ============ UTILITÁRIOS ============

    function setLoading(loading) {
        appState.loading = loading;
        
        if (appState.componentes.tabela) {
            if (loading) {
                appState.componentes.tabela.showLoading('Carregando ligações...');
            } else {
                appState.componentes.tabela.hideLoading();
            }
        }
    }

    // ============ API PÚBLICA ============

    window.relatorios.callphone.ligacoes = {
        init,
        visualizar: visualizarLigacao,
        visualizarURA,
        ouvirGravacao,
        abrirPlayer,
        togglePlay,
        seekAudio,
        setVolume,
        toggleMute,
        setPlaybackRate,
        exportExcel,
        stopDownloadMonitor,
    };

    // Alias global para facilitar acesso via onclick
    window.ligacoes = window.relatorios.callphone.ligacoes;

    // Inicialização quando o relatório for carregado (chamado pelo sistema principal)
    window.initLigacoesReport = function(filtros) {
        init(filtros);
    };

})();