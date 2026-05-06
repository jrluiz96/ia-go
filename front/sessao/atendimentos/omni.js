// ================================================================
// SISTEMA OMNICHANNEL - MÓDULO PRINCIPAL
// ================================================================
// Este arquivo gerencia todo o sistema de atendimento multicanal
// (WhatsApp, Chat, Email, etc.) via WebSocket
// ================================================================

if (typeof window.bashAtendimentoOmni === 'undefined') {
    window.bashAtendimentoOmni = {

        // ===============================
        // CONFIGURAÇÕES E TOKENS
        // ===============================
        token: '',                    // Token de autenticação do usuário
        Notification: false,          // Flag para permissão de notificações browser

        // ===============================
        // WEBSOCKET E CONEXÃO
        // ===============================
        omniWs: {},                   // Objeto WebSocket para comunicação em tempo real
        omniStatusAtual: { nome: 'Desconectado' },  // Status atual da conexão
        omniWsConfig: {
            wssUrl: `wss://${window.location.hostname}/wss/client/webbot/`,
            // wssUrl: `ws://${window.location.hostname}:9225/wss/client/webbot/`,

            maxRetries: 6,
            retryDelay: 5000
        },
        retryCount: 0,               // Contador atual de tentativas
        wsConnId: null,              // ID da conexão WebSocket (recebido do servidor)

        // ===============================
        // DADOS DO USUÁRIO/ATENDENTE
        // ===============================
        omniUsuario: {
            info: {},                // Informações básicas do atendente (id, nome, usuario)
            empresas: [],            // Lista de empresas que o atendente pode atender
            atalhos: [],             // Atalhos de mensagens pré-definidas
            pausas: [],              // Tipos de pausa disponíveis
            deslogue: {},            // Dados de deslogue agendado
            status_pausa: false,     // Se está atualmente em pausa
            pausa: {},               // Dados da pausa atual
            session: {},             // Dados da sessão
            atendimentos: [],        // Lista de conversas/atendimentos ativos
        },
        atendimentoAtual: {},        // Conversa atualmente aberta na interface

        // ===============================
        // LISTAS E CACHE LOCAL
        // ===============================
        omniListAtendimento: [],     // Cache de atendimentos
        omniListPausas: [],          // Cache de pausas
        omniListAtalhos: [],         // Cache de atalhos

        // ===============================
        // ELEMENTOS DOM MAPEADOS
        // ===============================
        ElementsOmniAtendimento: {}, // Referências aos elementos HTML da interface

        // ===============================
        // CONTROLE DE SINCRONIZAÇÃO
        // ===============================
        lastUpdate: null,            // Timestamp da última atualização
        // ========================================
        // FUNÇÃO DE INICIALIZAÇÃO PRINCIPAL
        // ========================================
        // Chamada quando a página carrega para configurar o sistema omnichannel
        init: function () {
            let self = window.bashAtendimentoOmni;
            self.token = localStorage.getItem('token');  // Carrega token do localStorage
            self.renderOmniAll()                         // Renderiza todos os elementos da interface
            window.bashAtendimentoOmni.timerManager.init(); // Inicia o gerenciador de timers
        },
        // ========================================
        // GERENCIAMENTO DE PERMISSÕES DO BROWSER
        // ========================================
        // Solicita permissão para notificações desktop quando necessário
        checkPemissionPopup: function () {
            let self = window.bashAtendimentoOmni;

            // Verifica se o navegador suporta notificações
            if (!("Notification" in window)) {
                console.warn("Este navegador não suporta notificações de desktop");
                return;
            }

            // Se ainda não foi concedida permissão, solicita ao usuário
            if (Notification.permission !== "granted") {
                Notification.requestPermission();
            }

            self.Notification = true  // Marca que as notificações foram configuradas
        },
        // ========================================
        // CARREGAMENTO DE DADOS DO LOCALSTORAGE
        // ========================================
        // Recupera dados salvos localmente para manter estado entre sessões
        loadFromStorage: function () {
            let self = window.bashAtendimentoOmni;

            const stored = localStorage.getItem('bashAtendimentoOmni');
            if (stored) {
                const data = JSON.parse(stored);
                // Restaura listas de cache local
                self.omniListAtendimento = data.omniListAtendimento || [];
                self.omniListPausas = data.omniListPausas || [];
                self.omniListAtalhos = data.omniListAtalhos || [];
                // Restaura timestamp da última atualização
                self.lastUpdate = data.lastUpdate ? new Date(data.lastUpdate) : null;
            }
        },
        // ========================================
        // SALVAMENTO NO LOCALSTORAGE
        // ========================================
        // Salva dados importantes localmente para persistência
        saveToStorage: function () {
            let self = window.bashAtendimentoOmni;

            const data = {
                // NOTA: Parece haver um bug aqui - deveria usar as propriedades corretas
                omniListAtendimento: self.ramais,      // BUG: deveria ser self.omniListAtendimento
                omniListPausas: self.pabx,             // BUG: deveria ser self.omniListPausas  
                omniListAtalhos: self.omni,            // BUG: deveria ser self.omniListAtalhos
                lastUpdate: new Date().toISOString()   // Timestamp atual
            };
            localStorage.setItem('bashAtendimentoOmni', JSON.stringify(data));
        },
        // ========================================
        // CONFIGURAÇÃO DE EVENT LISTENERS
        // ========================================
        // Vincula eventos da interface aos métodos do sistema
        setupEventListenersOmni: function () {
            let self = window.bashAtendimentoOmni;

            // Evento: Mudança de status (Disponível/Pausa/etc.)
            $(document).on('change', '#atendimento-aw-registro', function () {
                const newStatus = $(this).val();
                self.handleStatusChange(newStatus);
            });

            // Evento: Botão conectar multicanais
            $(document).on('click', '#atendimento-omni-btn-connect', function () {
                window.bashAtendimentoOmni.omniWsConnect();
                self.checkPemissionPopup();
            });

            // Evento: Enter no campo de mensagem (enviar mensagem)
            $(document).on('keypress', '#omni-input-mensagem', function (e) {
                if (e.which === 13) { // 13 é o código da tecla Enter
                    e.preventDefault(); // Previne comportamento padrão (quebra de linha)
                    window.bashAtendimentoOmni.enviarMensagem();
                }
            });

            // Evento: Enter no campo de arquivo (enviar arquivo)
            $(document).on('keypress', '#omni-mensagem-arquivo', function (e) {
                if (e.which === 13 && !e.shiftKey) { // Enter sem Shift
                    e.preventDefault();
                    window.bashAtendimentoOmni.enviarArquivo();
                }
            });

            // Evento: Clique no botão enviar
            $(document).on('click', '#omni-btn-enviar', function () {
                window.bashAtendimentoOmni.enviarMensagem();
            });

            // Evento: Enter em campos de mensagem ou arquivo (handler genérico)
            $(document).on('keypress', '#omni-input-mensagem, #omni-mensagem-arquivo', function (e) {
                self = window.bashAtendimentoOmni;

                if (e.which === 13 && !e.shiftKey) {
                    e.preventDefault();
                    // Identifica qual campo e chama função apropriada
                    if ($(this).attr('id') === 'omni-input-mensagem') {
                        window.bashAtendimentoOmni.enviarMensagem();
                    } else {
                        window.bashAtendimentoOmni.enviarArquivo();
                    }
                }
            });

            $(document).on('click', '#af-bt-historico', function () {
                let self = window.bashAtendimentoOmni;

                if (!self.atendimentoAtual.id) {
                    avisos('Erro', 'Nenhuma conversa ativa', 'error');
                    return;
                }

                window.bashAtendimentoOmni.mostrarHistoricoCliente();
                if (!self.ElementsOmniAtendimento.afTabDefault.hasClass('hidden')) {
                    self.ElementsOmniAtendimento.afTabDefault.addClass('hidden');
                }

                if (!self.ElementsOmniAtendimento.afTabClassificacao.hasClass('hidden')) {
                    self.ElementsOmniAtendimento.afTabClassificacao.addClass('hidden');
                }
                if (self.ElementsOmniAtendimento.afTabHistoricoCliente.hasClass('hidden')) {
                    self.ElementsOmniAtendimento.afTabHistoricoCliente.removeClass('hidden');
                }
            });

            $(document).on('click', '#af-bt-classificacao', function () {
                let self = window.bashAtendimentoOmni;

                if (!self.atendimentoAtual.id) {
                    avisos('Erro', 'Nenhuma conversa ativa', 'error');
                    return;
                }

                window.bashAtendimentoOmni.mostrarClassificacao();

                if (!self.ElementsOmniAtendimento.afTabDefault.hasClass('hidden')) {
                    self.ElementsOmniAtendimento.afTabDefault.addClass('hidden');
                }

                if (self.ElementsOmniAtendimento.afTabClassificacao.hasClass('hidden')) {
                    self.ElementsOmniAtendimento.afTabClassificacao.removeClass('hidden');
                }
                if (!self.ElementsOmniAtendimento.afTabHistoricoCliente.hasClass('hidden')) {
                    self.ElementsOmniAtendimento.afTabHistoricoCliente.addClass('hidden');
                }
            });
        },
        // ========================================
        // FUNÇÕES DE FORMATAÇÃO DE TEMPO
        // ========================================

        // Converte timestamp ISO para formato "X tempo atrás"
        formatTimeAgo: function (isoString) {
            const date = new Date(isoString);
            const now = new Date();
            const seconds = Math.floor((now - date) / 1000);

            // Diferentes formatos baseados no tempo decorrido
            if (seconds < 60) return 'Agora mesmo';
            if (seconds < 3600) return `${Math.floor(seconds / 60)} min atrás`;
            if (seconds < 86400) return `${Math.floor(seconds / 3600)} h atrás`;
            if (seconds < 604800) return `${Math.floor(seconds / 86400)} dias atrás`;

            // Para períodos muito antigos, mostra data completa
            return date.toLocaleDateString('pt-BR');
        },
        // Formatar tempo de atendimento em formato HH:MM:SS
        formatTempoAtt: function (tempoInicial) {
            let agora = new Date();
            let diferenca = agora - new Date(tempoInicial);
            let segundos = Math.floor(diferenca / 1000);
            let minutos = Math.floor(segundos / 60);
            let horas = Math.floor(minutos / 60);

            // Calcula o resto para cada unidade
            segundos = segundos % 60;
            minutos = minutos % 60;

            // Retorna no formato cronômetro (00:00:00)
            return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
        },
        // Calcula diferença entre horário de saída e agora (para pausas/deslogues)
        calcularDiferencaHoras: function (horarioSaida) {
            // Remove milissegundos e substitui T por espaço para parsing
            let horarioFormatado = horarioSaida.split(".")[0].replace("T", " ");
            let dataRecebidaObj = new Date(horarioFormatado);
            let dataAtual = new Date();

            // Calcula diferença em milissegundos
            let diferenca = dataAtual - dataRecebidaObj;

            // Converte para horas, minutos e segundos
            let diferencaHoras = Math.floor(diferenca / (1000 * 60 * 60));
            let diferencaMinutos = Math.floor((diferenca % (1000 * 60 * 60)) / (1000 * 60));
            let diferencaSegundos = Math.floor((diferenca % (1000 * 60)) / 1000);

            // Formata como string HH:MM:SS
            let diferencaFormatada = [
                diferencaHoras.toString().padStart(2, '0'),
                diferencaMinutos.toString().padStart(2, '0'),
                diferencaSegundos.toString().padStart(2, '0'),
            ].join(':');

            return { horas: diferencaHoras, formatada: diferencaFormatada };
        },
        // --------- Update ---------

        // ========================================
        // FUNÇÕES DE RENDERIZAÇÃO DA INTERFACE
        // ========================================

        // Função principal que inicializa toda a interface omnichannel
        renderOmniAll: function () {
            let self = window.bashAtendimentoOmni;
            self.renderElementsOmniAtendimento();  // Mapeia elementos DOM
            self.mostrarOmniConnect();             // Exibe tela de conexão
            self.setupEventListenersOmni();        // Configura eventos
        },
        // Função de destruição/limpeza (para logout ou fechamento)
        destroy: function () {
            let self = window.bashAtendimentoOmni;

            // Fecha conexão WebSocket se estiver aberta
            if (self.omniWs && self.omniWs.readyState === WebSocket.OPEN) {
                self.omniWs.close();
            }

            // Remove completamente o objeto da memória
            window.bashAtendimentoOmni = undefined;
        },
        renderElementsOmniAtendimento: function () {
            let self = window.bashAtendimentoOmni;
            self.ElementsOmniAtendimento = {
                'inicialConnect': $('#atendimento-omni-inicial-connect'),
                'contentConnected': $('#atendimento-omni-content-connect'),
                'statusAtual': $('#atendimento-omni-status-container'),
                'statusAtualBadge': $('#atendimento-omni-status-badge'),
                'statusAtualUser': $('#atendimento-status-user'),
                'atendimentoListContainer': $('#atendimento-active-in-omni'),
                'atendimentoList': $('#atendimento-active-in-omni'),
                'atendimentoUl': $('.atendimento-list-omni'),
                'atendimentoConversaAberta': $('#omni-atendimento-card'),
                'afTabDefault': $('#af-tab-default'),
                'afTabClassificacao': $('#af-div-classificacao'),
                'afTabHistoricoCliente': $('#af-div-historico-cliente'),
            }
        },
        mostrarOmniConnect: function () {
            let self = window.bashAtendimentoOmni;
            loadElement('atendimento-aw-registro', 0);
            $('#atendimento-aw-registro').prop('disabled', true);
            loadElement('atendimento-omni-btn-connect', 0);
            self.ElementsOmniAtendimento.inicialConnect.removeClass('hidden');
            self.ElementsOmniAtendimento.contentConnected.addClass('hidden');
        },
        mostrarOmniContent: function () {
            let self = window.bashAtendimentoOmni;
            self.ElementsOmniAtendimento.inicialConnect.addClass('hidden');
            self.ElementsOmniAtendimento.contentConnected.removeClass('hidden');
            self.ElementsOmniAtendimento.atendimentoListContainer.removeClass('hidden');
        },
        mostrarConversaAberta: function () {
            let self = window.bashAtendimentoOmni;
            self.ElementsOmniAtendimento.atendimentoConversaAberta.removeClass('hidden');
        },
        mostrarPainelLateralPadrao: function (conversa = null) {
            let self = window.bashAtendimentoOmni;
            if (!self.ElementsOmniAtendimento.afTabDefault) {
                return;
            }

            const nomeCliente = conversa?.clientes?.nome || 'Cliente não identificado';
            const protocolo = conversa?.dados_atendimento?.protocolo_integracao || conversa?.id || '-';

            self.ElementsOmniAtendimento.afTabDefault.html(`
                <div class="h-full flex flex-col items-center justify-center text-center text-base-content/70 p-4">
                    <i class="fas fa-address-card text-3xl mb-3 text-primary"></i>
                    <p class="font-semibold text-base-content mb-1">${nomeCliente}</p>
                    <p class="text-sm mb-4">Protocolo: ${protocolo}</p>
                    <p class="text-sm">Escolha uma aba para continuar:</p>
                    <div class="mt-3 flex flex-wrap items-center justify-center gap-2">
                        <span class="badge badge-outline">Histórico do cliente</span>
                        <span class="badge badge-outline">Classificação dinâmica</span>
                    </div>
                </div>
            `);

            self.ElementsOmniAtendimento.afTabDefault.removeClass('hidden');
            self.ElementsOmniAtendimento.afTabClassificacao.addClass('hidden');
            self.ElementsOmniAtendimento.afTabHistoricoCliente.addClass('hidden');
        },
        // ========================================
        // FUNÇÕES DE WEBSOCKET
        // ========================================

        // Inicia conexão WebSocket com o servidor omnichannel
        omniWsConnect: function () {
            let self = window.bashAtendimentoOmni;

            // Mostra loading nos elementos da interface
            loadElement('atendimento-aw-registro', 1);
            loadElement('atendimento-omni-btn-connect', 1);

            // Define status como conectando
            self.setStatus('Conectando');

            try {
                // Cria nova conexão WebSocket
                self.omniWs = new WebSocket(self.omniWsConfig.wssUrl);

                // Evento: Conexão estabelecida com sucesso
                self.omniWs.onopen = (event) => {
                    self.setStatus('Conectando');
                    self.retryCount = 0;              // Reseta contador de tentativas
                    self.setupSocketListeners();      // Configura listeners de mensagens
                    self.omniWsStartPing();           // Inicia sistema de ping/pong
                };

                // Evento: Erro na conexão
                self.omniWs.onerror = (error) => {
                    self.wsConnId = null;
                    clearInterval(self.pingInterval)  // Para o ping
                    self.handleConnectionError(error);
                };

                // Evento: Conexão fechada
                self.omniWs.onclose = (event) => {
                    self.wsConnId = null;
                    clearInterval(self.pingInterval)  // Para o ping

                    if (event.wasClean) {
                        // Fechamento normal
                        avisos('Conversa', 'Conexão encerrada', "info");
                    } else if (self.retryCount < self.omniWsConfig.maxRetries) {
                        // Tenta reconectar se ainda há tentativas
                        self.handleConnectionError("onclose error");
                    } else {
                        // Esgotou tentativas de reconexão
                        avisos('Conversa', 'Falha na conexão. Recarregue a página.', "error");
                        self.omniWsResetConnection();
                    }
                    self.renderOmniStatusList();
                };
            } catch (error) {
                console.log('Erro ao conectar: ' + error.message, 'error');
                self.omniWsResetConnection();
            }
        },
        // Sistema de ping/pong para manter conexão viva
        omniWsStartPing: function () {
            let self = window.bashAtendimentoOmni;

            // Limpa ping anterior se existir
            if (self.pingInterval) clearInterval(self.pingInterval);

            // Envia ping a cada 15 segundos para manter conexão
            self.pingInterval = setInterval(() => {
                if (self.omniWs && self.omniWs.readyState === WebSocket.OPEN) {
                    self.omniWs.send(JSON.stringify({ Funcao: 'ping' }));
                }
            }, 15000); // A cada 15 segundos
        },
        // Configura listener para mensagens recebidas via WebSocket
        setupSocketListeners: function () {
            let self = window.bashAtendimentoOmni;

            self.omniWs.onmessage = (event) => {
                // Parseia mensagem JSON recebida
                let message = JSON.parse(event.data);

                // Primeira mensagem: servidor envia ID da conexão
                if (message && !self.wsConnId) {
                    self.wsConnId = message;  // Armazena ID da conexão

                    // Envia dados de autenticação para inicializar cliente
                    let startMsg = {
                        Funcao: "startClient",
                        AuthID: getUserSession().id.toString(),      // ID do usuário logado
                        WsConn: self.wsConnId,                       // ID da conexão WebSocket
                        SessionID: GlobGetSessionID.id.toString(),   // ID da sessão
                    };
                    self.omniWs.send(JSON.stringify(startMsg));
                } else {
                    // Demais mensagens: processa conforme tipo
                    self.handleSocketMessage(message);
                }
            };
        },
        omniWsResetConnection: function () {
            let self = window.bashAtendimentoOmni;
            if (self.omniWs) {
                self.wsConnId = null;
                self.omniWs.onopen = null;
                self.omniWs.onmessage = null;
                self.omniWs.onerror = null;
                self.omniWs.onclose = null;
                self.retryCount = 0;
                self.setStatus('Desconectado');
                if (self.omniWs.readyState === WebSocket.OPEN) {
                    self.omniWs.close();
                }
                self.omniWs = null;
            }
            self.stopTimer();
            self.renderOmniStatusList();
            setTimeout(() => {
                self.mostrarOmniConnect();
            }, 1000);
            avisos('Multicanais', 'Desconectado', "success");
        },
        // ========================================
        // FUNÇÕES DE ENVIO DE MENSAGENS
        // ========================================

        // Envia mensagem de texto para o cliente via WebSocket
        enviarMensagem: function () {
            let self = window.bashAtendimentoOmni;
            const input = $('#omni-input-mensagem');
            const mensagem = input.val().trim();

            if (!self.atendimentoAtual || !self.atendimentoAtual.id) {
                avisos('Multicanais', 'Nenhuma conversa ativa', 'warning');
                return;
            }

            if (self.atendimentoAtual.finalizada || self.atendimentoAtual.status === 'finalizado') {
                avisos('Multicanais', 'Este atendimento já foi finalizado', 'warning');
                self.disableInputs();
                return;
            }

            // Validações básicas
            if (!mensagem) {
                return; // Não faz nada se mensagem estiver vazia
            }
            if (!self.omniWs || self.omniWs.readyState !== WebSocket.OPEN) {
                avisos('Multicanais', 'Conexão não está ativa', "warning");
                return;
            }

            // Monta objeto de mensagem para envio
            const msgData = {
                Mensage: {
                    From: {
                        Type: "Atendente",                           // Tipo: Atendente
                        Nome: self.omniUsuario.info.usuario,        // Nome do atendente
                        ID: self.omniUsuario.info.id.toString()     // ID do atendente
                    },
                    Data: {
                        Type: "text",                                // Tipo: texto
                        Texto: mensagem                              // Conteúdo da mensagem
                    },
                    Timestamp: Date.now()                           // Timestamp atual
                },
                Funcao: "sendMsg",                                   // Função: enviar mensagem
                ConversasId: self.atendimentoAtual.id.toString(),    // ID da conversa ativa
                WsConn: self.wsConnId,                               // ID da conexão WebSocket
                Number: self.atendimentoAtual.clientes.numero || self.atendimentoAtual.clientes.telefone01 || "", // Número do cliente
                Timestamp: Date.now()                                // Timestamp do envio
            };

            // Envia via WebSocket
            try {
                self.omniWs.send(JSON.stringify(msgData));
                input.val(''); // Limpa campo de input
                return true;
            } catch (error) {
                console.error('Erro ao enviar mensagem:', error);
            }
        },
        enviarArquivo: function () {
            let self = window.bashAtendimentoOmni;

            if (!self.atendimentoAtual || self.atendimentoAtual.finalizada || self.atendimentoAtual.status === 'finalizado') {
                avisos('Envio de Arquivo', 'Este atendimento já foi finalizado', 'warning');
                self.disableInputs();
                return;
            }

            // Obter elementos do DOM
            const fileInput = document.getElementById('omni-input-arquivo');
            const mensagemInput = document.getElementById('omni-mensagem-arquivo');

            // Verificar se há arquivo selecionado
            if (!fileInput.files || fileInput.files.length === 0) {
                avisos('Envio de Arquivo', 'Selecione um arquivo para enviar', 'warning');
                return;
            }

            const file = fileInput.files[0];
            const mensagemAcompanhamento = mensagemInput.value.trim();

            // Verificar conexão WebSocket
            if (!self.omniWs || self.omniWs.readyState !== WebSocket.OPEN) {
                avisos('Envio de Arquivo', 'Conexão não está ativa', 'warning');
                return;
            }

            // Verificar se há conversa ativa
            if (!self.atendimentoAtual) {
                avisos('Envio de Arquivo', 'Nenhuma conversa ativa', 'warning');
                return;
            }

            // Ler o arquivo como Base64
            const reader = new FileReader();
            reader.onload = function (event) {
                const base64Data = event.target.result.split(',')[1];
                const msgData = {
                    Mensage: {
                        From: {
                            Type: "Atendente",
                            Nome: self.omniUsuario.info.usuario,
                            ID: self.omniUsuario.info.id.toString()
                        },
                        Data: {
                            Type: self.getFileType(file.type),
                            Texto: mensagemAcompanhamento,
                            Media: {
                                Base64: base64Data,
                                MimeType: file.type,
                                FileName: file.name
                            }
                        },
                        Timestamp: Date.now()
                    },
                    Funcao: "sendMsg",
                    ConversasId: self.atendimentoAtual.id.toString(),
                    // EmpresasId: self.atendimentoAtual.empresa.id,
                    WsConn: self.wsConnId,
                    Number: self.atendimentoAtual.clientes.numero || self.atendimentoAtual.clientes.telefone01 || "",
                    Timestamp: Date.now()
                };

                // Enviar via WebSocket
                try {
                    self.omniWs.send(JSON.stringify(msgData));
                    avisos('Envio de Arquivo', 'Arquivo enviado ao servidor', 'info');

                    // Limpar os inputs e fechar o modal
                    fileInput.value = '';
                    mensagemInput.value = '';
                    self.fecharModalArquivo();

                    // Atualizar a conversa após um pequeno delay
                    setTimeout(() => {
                        if (self.atendimentoAtual) {
                            self.renderOmniShowConversa(self.atendimentoAtual);
                        }
                    }, 500);

                } catch (error) {
                    console.error('Erro ao enviar arquivo:', error);
                    avisos('Erro', 'Falha ao enviar arquivo', 'error');
                }
            };

            reader.onerror = function (error) {
                console.error('Erro ao ler arquivo:', error);
                avisos('Erro', 'Falha ao ler o arquivo', 'error');
            };

            // Iniciar a leitura do arquivo
            reader.readAsDataURL(file);
        },
        getFileType: function (mimeType) {
            if (mimeType.startsWith('image/')) {
                return "image";
            }

            if (mimeType.startsWith('text/') ||
                mimeType === 'application/csv' ||
                mimeType === 'text/csv' ||
                mimeType === 'application/json') {
                return "text";
            }

            return "application";
        },
        setStatus: function (status) {
            let self = window.bashAtendimentoOmni;

            self.omniStatusAtual.nome = status;
            self.omniStatusAtual.dataInicio = new Date();

            self.stopTimer();
            self.startTimer();
            if (status === 'Disponivel') {
                window.bashAtendimentoOmni.mostrarOmniContent();
            }
            self.renderOmniStatusList();
        },
        processStartClientResponse: function (data) {
            let self = window.bashAtendimentoOmni;
            console.log(data)

            // Protege contra payloads inesperados vindos do socket
            if (!data || !data.usuario) {
                console.error('startClient sem dados de usuario', data);
                avisos('Multicanais', 'Resposta incompleta do servidor (startClient)', 'error');
                self.setStatus('Desconectado');
                return;
            }

            self.omniUsuario.info = {
                id: data.usuario.id,
                nome: data.usuario.nome,
                usuario: data.usuario.usuario,
                auth_id: data.usuario.id
            };
            self.omniUsuario.pausas = data.pausas;


            // self.omniUsuario.empresas = data.usuario.empresas;
            self.omniUsuario.deslogue = data.deslogue;
            self.omniUsuario.status_pausa = data.pausa.status_pausa;
            self.omniUsuario.atendimentos = data.atendimentos;
            // self.omniUsuario.session = data.session;
            self.renderOmniAtendimentos();
            self.renderOmniAtalhos();

            // Verificação robusta da pausa
            if (data.pausa.status_pausa) {
                self.omniUsuario.pausa = data.pausa.dados_pausa || {};

                // Validação do horário de início
                const horaInicioValida = this.isValidDateTime(data.pausa.dados_pausa?.hora_inicio);
                const isPausa = horaInicioValida &&
                    new Date(data.pausa.dados_pausa.hora_inicio) < new Date();
                if (isPausa) {
                    self.setStatus("Pausa");
                } else if (!horaInicioValida) {
                    self.setStatus("Pausa agendada");
                } else {
                    // Caso de fallback se houver status_pausa mas dados inválidos
                    self.setStatus("Pausa agendada");
                }

                self.mostrarOmniContent();
                return
            }

            if (self.omniUsuario.deslogue.status_deslogue) {
                const horaSolicitouValida = this.isValidDateTime(self.omniUsuario.deslogue.hora_solicitou);
                const isDeslogue = horaSolicitouValida &&
                    new Date(self.omniUsuario.deslogue.hora_solicitou) < new Date();
                if (isDeslogue) {
                    self.setStatus("Deslogue agendado");

                }
                self.mostrarOmniContent();
                return;
            }

            self.setStatus("Disponivel");
        },
        isValidDateTime: function (dateString) {
            if (!dateString) return false;

            // Verifica datas padrão "vazias" ou inválidas
            const invalidDates = [
                '0001-01-01T00:00:00Z',
                '0000-00-00T00:00:00Z',
                '1970-01-01T00:00:00Z'
            ];

            if (invalidDates.includes(dateString)) {
                return false;
            }

            const date = new Date(dateString);
            return !isNaN(date.getTime()) && date.toString() !== 'Invalid Date';
        },
        processMessage: function (data) {
            let self = window.bashAtendimentoOmni;
            if (data.Funcao === 'startClient') {
                self.processStartClientResponse(data);
            }
            self.renderOmniStatusList();
        },
        //
        renderOmniAtalhos: function () {
            let self = window.bashAtendimentoOmni;
            const $container = $('#atendimento-omni-atalhos-container');
            $container.empty();
            self.omniUsuario.atalhos.forEach(atalho => {
                $container.append(`
                    <div class="tooltip" data-tip="${atalho.text}">
                        <button class="btn btn-sm btn-outline" onclick="window.bashAtendimentoOmni.usarAtalho('${atalho.key}')">
                            ${atalho.key}
                        </button>
                    </div>
                `);
            });
        },
        renderOmniPausas: function () {
            let self = window.bashAtendimentoOmni;
            const $select = $('#atendimento-omni-pausas-select');
            $select.empty();
            self.omniUsuario.pausas.forEach(pausa => {
                $select.append(`
                    <option value="${pausa.id}">${pausa.nome} (${pausa.duracao})</option>
                `);
            });
        },
        formatTelefoneId: function (tel) {
            const lastTelIndex = tel.lastIndexOf('tel');
            if (lastTelIndex === -1) return tel;
            const phoneNumber = tel.slice(lastTelIndex + 3).replace(/\D/g, '');
            return phoneNumber;
        },
        renderOmniShowConversa: async function (conversa) {
            validateSigilo = false
            // validateSigilo=conversa.dados_conversa.dados_atendimento?.reclame == "sim" ?true:false || false

            if (window.bashAtendimento?.esconderRamalPabxContent) {
                window.bashAtendimento.esconderRamalPabxContent();
            }
            let self = window.bashAtendimentoOmni;
            self.marcarConversaComoLida(conversa.id);
            
            // Se é a mesma conversa, apenas atualiza as mensagens sem recriar o container
            if (self.atendimentoAtual && self.atendimentoAtual.id === conversa.id) {
                self.mostrarConversaAberta();
                // Buscar mensagens atualizadas se não tiver ou se houver mensagens pendentes
                if (!conversa.dados_conversa || conversa.dados_conversa.length === 0 || (conversa.countMsg && conversa.countMsg > 0)) {
                    await self.carregarMensagensConversa(conversa.id);
                } else {
                    self.atualizarMensagensConversa(conversa.dados_conversa || [], conversa.finalizada);
                }
                return;
            }
            
            // Atualiza a conversa atual
            self.atendimentoAtual = conversa;
            self.mostrarPainelLateralPadrao(conversa);
            
            // Remove o container anterior se existir ANTES de criar o novo
            const containerExistente = document.getElementById('omni-conversa-container');
            if (containerExistente) {
                containerExistente.remove();
            }
            
            self.ElementsOmniAtendimento.atendimentoConversaAberta.removeClass('hidden');

            console.log('Renderizando conversa:', conversa);
            // Determinar ícone baseado na plataforma
            let platformIcon = conversa.canal_atendimento.nome.toLowerCase().includes('whatsapp')
                ? 'fa-brands fa-whatsapp'
                : 'fa-solid fa-comment-dots';

            // Criar o HTML base da conversa
            let conversaHTML = `
                <div id="omni-conversa-container" class="flex flex-col h-full">
                    <div class="bg-base-200 rounded-box p-4 shadow-lg mb-2">
                        <div class="flex items-start gap-4 w-full">
                            <!-- Ícone da plataforma -->
                            <div class="flex flex-col items-center">
                                <div class="w-16 h-16 bg-base-300 rounded-full flex items-center justify-center text-3xl 
                                    ${conversa.canal_atendimento.nome.toLowerCase().includes('whatsapp') ? 'text-green-500' : 'text-primary'}">
                                    <i class="${platformIcon}"></i>
                                </div>
                                <span class="atendimento-omni-tempo mt-2 text-sm font-mono" 
                                      data-timer="${conversa.dt_inicio_atendimento}"></span>
                            </div>
                            
                            <!-- Informações do cliente -->
                            <div class="flex-1 min-w-0">
                                <div class="flex justify-between items-start gap-4">
                                    <!-- Informações principais (lado esquerdo com prioridade) -->
                                    <div class="flex-1 min-w-0">
                                        <h3 class="font-bold text-lg truncate">${conversa.clientes.nome}</h3>
                                        <div class="flex items-center gap-2 mt-1">
                                            <span class="font-semibold text-sm">Protocolo:</span>
                                            <span class="text-sm">${conversa.dados_atendimento?.protocolo_integracao || conversa.id}</span>
                                        </div>
                                        ${conversa.clientes.telefone01 ? `
                                        <div class="flex items-center gap-2 mt-1">
                                            <span class="font-semibold text-sm">Telefone:</span>
                                            <span class="text-sm">${validateSigilo ? '*********' : self.formatTelefoneId(conversa.clientes.telefone01)}</span>
                                        </div>` : ''}
                                    </div>
                                    
                                    <!-- Botões de ação (lado direito) -->
                                    <div class="flex items-center gap-2 flex-shrink-0">
                                        ${conversa.integracao ? `
                                            <button class="btn btn-sm btn-outline btn-success gap-1" 
                                                    onclick="window.bashAtendimentoOmni.downloadIntegracao('${conversa.integracao}')">
                                                <i class="fa-solid fa-code-merge"></i>
                                                <span class="hidden sm:inline">Integração</span>
                                            </button>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                            
                           <!-- Coluna de ações -->
                           <!--  <div class="flex flex-col items-end gap-2">
                                <div class="flex gap-2">
                                    <button class="btn btn-sm btn-outline btn-info gap-1" 
                                            onclick="window.bashAtendimentoOmni.abrirModalHistorico('${conversa.id}')">
                                        <i class="fa-solid fa-history"></i>
                                        <span class="hidden sm:inline">Histórico</span>
                                    </button>
                                    <button class="btn btn-sm btn-outline btn-error gap-1" 
                                            onclick="window.bashAtendimentoOmni.abrirClassificador('${conversa.id}')">
                                        <i class="fa-solid fa-flag-checkered"></i>
                                        <span class="hidden sm:inline">Finalizar</span>
                                    </button>
                                </div>
                                
                                ${conversa.clientes.numero && !validateSigilo ? (() => {
                    const isWhatsapp = conversa.canal_atendimento.nome.toLowerCase().includes('whatsapp');
                    const isTelNumber = conversa.clientes.telefone01.includes('tel');

                    let buttons = [];

                    if (!isWhatsapp) {
                        if (isTelNumber && !isWhatsapp) {
                            buttons.push(`
                                                <button class="btn btn-sm btn-success btn-circle" 
                                                        onclick="window.bashAtendimentoOmni.clickToWhats('${conversa.clientes.telefone01}')"
                                                        data-tip="WhatsApp">
                                                    <i class="fab fa-whatsapp"></i>
                                                </button>
                                            `);
                        }
                    }
                    if (isTelNumber && !isWhatsapp || isWhatsapp) {
                        buttons.push(`
                                            <button class="btn btn-sm btn-primary btn-circle" 
                                                    onclick="window.bashAtendimentoOmni.ligarParaCliente('${conversa.clientes.telefone01}')"
                                                    data-tip="Ligar">
                                                <i class="fa-solid fa-phone"></i>
                                            </button>
                                        `);
                    }

                    return buttons.length > 0 ? `
                                        <div class="flex gap-2">
                                            ${buttons.join('')}
                                        </div>
                                    ` : '';
                })() : ''}
                            </div>-->
                        </div>
                    </div>
                    
                    <!-- Área de mensagens (vazia inicialmente) -->
                    <div class="bg-base-100 rounded-box p-4 shadow-lg mb-4 flex-1 overflow-y-auto" id="omni-conversa-mensagens"></div>
        
                    <!-- Área de envio de mensagem -->
                    <div class="flex gap-2 relative">
                        <button id="omni-btn-show-classificar" ${conversa.finalizado ? 'disabled' : ''} class="btn btn-ghost btn-circle" onclick="window.bashAtendimentoOmni.abrirModalArquivo()">
                            <i class="fa-solid fa-paperclip text-lg"></i>
                        </button>
                        
                        <div class="flex-1 relative">
                            <input  type="text" placeholder="Digite sua mensagem..." 
                                class="input input-bordered w-full" id="omni-input-mensagem" ${conversa.finalizado ? 'disabled' : ''}>
                            
                            <div id="omni-atalhos-container" class="hidden absolute bottom-full left-0 right-0 mb-1 max-h-60 overflow-y-auto bg-white shadow-lg rounded-lg border border-gray-200 z-50">
                                <ul id="omni-atalhos-list" class="py-1">
                                    <!-- Itens serão inseridos dinamicamente aqui -->
                                </ul>
                            </div>
                        </div>
                        
                        <button class="btn btn-primary" id="omni-btn-enviar" ${conversa.finalizado ? 'disabled' : ''}>
                            Enviar
                        </button>
                    </div>
                </div>
                
                <!-- Modal para envio de arquivo -->
                <dialog id="omniModalArquivo" class="modal">
                    <div class="modal-box">
                        <h3 class="font-bold text-lg">Enviar Arquivo</h3>
                        <div class="py-4">
                            <input type="file" id="omni-input-arquivo" class="file-input file-input-bordered w-full">
                            <div class="mt-4">
                                <label class="label">
                                    <span class="label-text">Mensagem acompanhando o arquivo (opcional)</span>
                                </label>
                                <textarea id="omni-mensagem-arquivo" class="textarea textarea-bordered w-full" 
                                        placeholder="Digite uma mensagem..."></textarea>
                            </div>
                        </div>
                        <div class="modal-action">
                            <button class="btn" onclick="window.bashAtendimentoOmni.fecharModalArquivo()">Cancelar</button>
                            <button class="btn btn-primary" onclick="window.bashAtendimentoOmni.enviarArquivo()">Enviar</button>
                        </div>
                    </div>
                    <form method="dialog" class="modal-backdrop">
                        <button>close</button>
                    </form>
                </dialog>

                <!-- Modal para histórico do cliente -->
                <dialog id="omniModalHistorico" class="modal">
                    <div class="modal-box max-w-4xl">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="font-bold text-lg">Histórico de Atendimentos</h3>
                            <button class="btn btn-sm btn-circle btn-ghost" onclick="window.bashAtendimentoOmni.fecharModalHistorico()">✕</button>
                        </div>
                        
                        <div id="omni-historico-loading" class="flex justify-center py-8">
                            <span class="loading loading-spinner loading-lg"></span>
                        </div>
                        
                        <div id="omni-historico-content" class="hidden">
                            <div class="mb-4 p-4 bg-base-200 rounded-lg">
                                <h4 class="font-semibold mb-2">Informações do Cliente</h4>
                                <div id="omni-historico-cliente-info" class="grid grid-cols-2 gap-4 text-sm">
                                    <!-- Dados do cliente serão inseridos aqui -->
                                </div>
                            </div>
                            
                            <div class="divider">Histórico de Atendimentos</div>
                            
                            <div id="omni-historico-lista" class="space-y-4 max-h-96 overflow-y-auto">
                                <!-- Lista de atendimentos será inserida aqui -->
                            </div>
                        </div>
                        
                        <div id="omni-historico-erro" class="hidden text-center py-8">
                            <p class="text-error">Erro ao carregar histórico</p>
                        </div>
                    </div>
                    <form method="dialog" class="modal-backdrop">
                        <button>close</button>
                    </form>
                </dialog>
            `;

            // Injetar o HTML no elemento
            self.ElementsOmniAtendimento.atendimentoConversaAberta.html(conversaHTML);

            // Adicionar eventos
            self.configurarEventosConversa();
            
            // Carregar mensagens via API se não vieram com a conversa
            // ou se existirem notificações pendentes de novas mensagens.
            if (!conversa.dados_conversa || conversa.dados_conversa.length === 0 || (conversa.countMsg && conversa.countMsg > 0)) {
                await self.carregarMensagensConversa(conversa.id);
            } else {
                self.atualizarMensagensConversa(conversa.dados_conversa, conversa.finalizada);
            }

            // Esconder o PABX se necessário
            window.bashAtendimentoOmni.iniciarAtalhos();

            // Inicializar o timer para esta conversa
            self.timerManager.scanAndInitTimers();
        },
        // Carrega mensagens de uma conversa via API
        carregarMensagensConversa: async function (atendimentoId) {
            let self = window.bashAtendimentoOmni;
            const container = document.getElementById('omni-conversa-mensagens');
            
            if (container) {
                container.innerHTML = '<div class="flex justify-center items-center py-8"><span class="loading loading-spinner loading-lg"></span></div>';
            }
            
            try {
                const response = await reqAsync(
                    `v1/sessao/webbot/atendimento/${atendimentoId}/mensagens`,
                    'GET'
                );
                
                if (response.code === 200 && response.data) {
                    // Atualizar dados_conversa no atendimento
                    if (self.atendimentoAtual && self.atendimentoAtual.id === atendimentoId) {
                        self.atendimentoAtual.dados_conversa = response.data;
                        self.atualizarMensagensConversa(response.data, self.atendimentoAtual.finalizada);
                    }
                    // Atualizar também na lista de atendimentos
                    const atendimento = self.omniUsuario.atendimentos.find(a => a.id === atendimentoId);
                    if (atendimento) {
                        atendimento.dados_conversa = response.data;
                    }
                } else {
                    throw new Error(response.message || 'Erro ao carregar mensagens');
                }
            } catch (error) {
                console.error('❌ Erro ao carregar mensagens:', error);
                if (container) {
                    container.innerHTML = `
                        <div class="text-center py-8 text-error">
                            <i class="fas fa-exclamation-triangle text-3xl mb-2"></i>
                            <p>Erro ao carregar mensagens</p>
                            <button class="btn btn-sm btn-outline mt-2" onclick="window.bashAtendimentoOmni.carregarMensagensConversa(${atendimentoId})">
                                <i class="fas fa-refresh mr-1"></i> Tentar novamente
                            </button>
                        </div>
                    `;
                }
            }
        },
        renderOmniAtendimentos: function () {
            let self = window.bashAtendimentoOmni;
            const $container = window.bashAtendimentoOmni.ElementsOmniAtendimento.atendimentoUl;

            $container.empty();

            // Filtra atendimentos removendo duplicatas por conversas_id
            const atendimentosUnicos = [];
            const conversasIds = new Set();

            // Primeiro ordenamos os atendimentos
            const atendimentosOrdenados = [...self.omniUsuario.atendimentos].sort((a, b) =>
                new Date(a.hora_inicio_atendimento) - new Date(b.hora_inicio_atendimento)
            );

            // Depois filtramos para manter apenas o primeiro de cada conversas_id
            atendimentosOrdenados.forEach(atendimento => {
                if (!conversasIds.has(atendimento.id)) {
                    conversasIds.add(atendimento.id);
                    atendimentosUnicos.push(atendimento);
                }
            });

            // Agora usamos os atendimentosUnicos para renderizar
            atendimentosUnicos.forEach(atendimento => {
                let platformIcon = atendimento.canal_atendimento.nome.toLowerCase().includes('whatsapp')
                    ? 'fa-brands fa-whatsapp'
                    : 'fa-solid fa-comment-dots';
                // Verificar se é uma conversa nova (não lida)
                const isNovaConversa = !atendimento.lida && atendimento.id !== self.atendimentoAtual?.id;
                let $li = $('<li>', {
                    class: `flex flex-row items-center p-1 gap-2 ${isNovaConversa ? 'bg-info/10' : ''}`,
                    'data-conversa-id': atendimento.id
                });
                let $button = $('<button>', {
                    class: `btn  ${atendimento.id == self.atendimentoAtual?.id ? 'btn-outline' : 'btn-neutral'} flex-1 ${atendimento.finalizada ? 'text-error' : ''}`,
                    click: function () {
                        atendimento.lida = true;
                        atendimento.countMsg = 0;
                        window.bashAtendimentoOmni.renderOmniShowConversa(atendimento);
                        self.renderOmniAtendimentos();
                    }
                });

                $button.append($('<i>', {
                    class: platformIcon + ' text-xl'
                }));

                let $infoDiv = $('<div>', {
                    class: 'flex flex-col flex-1 items-start justify-start gap-1 ml-1 truncate'
                }).append(
                    $('<span>').text(atendimento.clientes.nome),
                    // Elemento para o timer com data-timer
                    $('<span>', {
                        'class': 'tempo-atendimento',
                        'data-timer': atendimento.dt_inicio_atendimento
                    })
                );

                if (isNovaConversa) {
                    $button.prepend($('<span>', {
                        class: 'absolute left-0 top-0 w-2 h-full bg-primary rounded-l-lg'
                    }));
                }

                $button.append($infoDiv);

                let $indicator = $('<div>', {
                    class: 'indicator'
                }).append(
                    $('<i>', { class: 'fa-solid fa-message text-xl' })
                );

                if (isNovaConversa) {
                    $indicator.append(
                        $('<span>', {
                            class: 'notificacao-badge badge badge-primary badge-sm indicator-item'
                        }).text('NOVO')
                    );
                }
                $button.append($indicator);
                $li.append($button);
                $container.append($li);
            });

            if (atendimentosUnicos.length == 0 && self.omniWs) {
                let $li = $('<li>', {
                    class: 'flex flex-col items-center justify-center p-4 text-center'
                }).append(
                    $('<div>', {
                        class: 'flex flex-col items-center justify-center py-8'
                    }).append(
                        $('<i>', {
                            class: 'fas fa-comment-slash text-4xl text-gray-300 mb-3'
                        }),
                        $('<p>', {
                            class: 'text-gray-500 font-medium mb-1',
                            text: 'Nenhum atendimento no momento'
                        }),
                        $('<p>', {
                            class: 'text-gray-400 text-sm',
                            text: 'Quando novos atendimentos chegarem, eles aparecerão aqui.'
                        })
                    )
                );
                $container.append($li);
            }
            // Inicializa os timers após renderizar a lista
            self.timerManager.scanAndInitTimers();
        },
        marcarConversaComoLida: function (conversaId) {
            let self = window.bashAtendimentoOmni;

            const conversa = self.omniUsuario.atendimentos.find(a => a.id === conversaId);
            if (conversa) {
                conversa.lida = true;
                conversa.countMsg = 0;
            }

            // Atualizar a UI
            self.renderOmniAtendimentos();
        },
        ligarParaCliente: function (numero) {
            let self = window.bashAtendimentoOmni;
            let getNum = self.formatTelefoneId(numero)
            window.bashAtendimento.iniciarChamada(getNum);
        },
        atualizarMensagensConversa: function (mensagens, finalizada) {
            let self = window.bashAtendimentoOmni;
            const container = document.getElementById('omni-conversa-mensagens');

            if (!container || !this.atendimentoAtual) return;

            // SEMPRE limpar todo o container antes de renderizar
            container.innerHTML = '';

            // Criar um fragmento de documento para adicionar todas as mensagens de uma vez
            const fragment = document.createDocumentFragment();

            mensagens.forEach(msg => {
                const msgElement = document.createElement('div');
                msgElement.dataset.msgId = msg.id;

                // Pegar tipo da mensagem - compatível com ambos formatos
                const tipoId = msg.mensagem_tipo?.id || msg.clientes_atendimentos_mensagens_tipo_id;

                if (tipoId === 1) { // Cliente
                    self.adicionarMsgCliente(msg, msgElement);
                } else if (tipoId === 2) { // Bot
                    self.adicionarMsgBot(msg, msgElement);
                } else if (tipoId === 3) { // Atendente
                    self.adicionarMsgAtendente(msg, msgElement);
                }

                fragment.appendChild(msgElement);
            });

            // Adicionar todas as mensagens ao DOM de uma só vez
            container.appendChild(fragment);
            
            if (finalizada) {
                self.appendMsgFinalizado();
            }
            
            // Scroll para o final
            setTimeout(() => {
                container.scrollTop = container.scrollHeight;
            }, 50);
        },
        configurarEventosConversa: function () {
            self = window.bashAtendimentoOmni;

            // Evento de enviar mensagem ao pressionar Enter
            $('#omni-input-mensagem').on('keypress', (e) => {
                if (e.which === 13) {
                    e.preventDefault();
                    self.enviarMensagem();
                }
            });

            // Evento de click no botão enviar
            $('#omni-btn-enviar').on('click', () => self.enviarMensagem());
        },
        adicionarMsgCliente: function (msg, element) {
            element.className = 'chat chat-start';
            let self = window.bashAtendimentoOmni;

            let content = self.formatarConteudoMsg(msg);
            
            // Nome do cliente vem do atendimento atual
            const nomeCliente = self.atendimentoAtual?.clientes?.nome || 'Cliente';

            element.innerHTML = `
                <div class="chat-image avatar">
                    <div class="w-10 rounded-full bg-neutral text-neutral-content  px-3 py-1">
                        <span class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">${nomeCliente.charAt(0).toUpperCase()}</span>
                    </div>
                </div>
                <div class="chat-bubble bg-base-200">${content}</div>
                <div class="chat-footer opacity-50 text-xs">
                    ${nomeCliente} •  ${(() => {
                        const dt = msg.created_at.replace('Z', '').replace('T', ' ').split('.')[0];
                        const [, timePart] = dt.split(' ');
                        const [hour, minute] = timePart.split(':');
                        return `${hour}:${minute}`;
                    })()}
                </div>
            `;
        },
        adicionarMsgAtendente: function (msg, element) {
            element.className = 'chat chat-end';
            let self = window.bashAtendimentoOmni;

            let content = self.formatarConteudoMsg(msg);
            
            // Nome do atendente
            const nomeAtendente = self.omniUsuario?.info?.nome || 'Atendente';

            element.innerHTML = `
                <div class="chat-image avatar">
                    <div class="w-10 rounded-full bg-primary text-primary-content  px-3 py-1">
                        <span class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">${nomeAtendente.charAt(0).toUpperCase()}</span>
                    </div>
                </div>
                <div class="chat-bubble bg-primary bg-primary/50 text-primary-content">${content}</div>
                <div class="chat-footer opacity-50 text-xs">
                    ${(() => {
                        const dt = msg.created_at.replace('Z', '').replace('T', ' ').split('.')[0];
                        const [, timePart] = dt.split(' ');
                        const [hour, minute] = timePart.split(':');
                        return `${hour}:${minute}`;
                    })()} • Você
                </div>
            `;
        },
        adicionarMsgBot: function (msg, element) {
            let self = window.bashAtendimentoOmni;
            element.className = 'chat chat-end';
            let content = self.formatarConteudoMsg(msg);
            
            // Nome do fluxo se disponível
            const nomeBot = msg.construtor_fluxo?.nome || 'Bot';

            element.innerHTML = `
                <div class="chat-image avatar">
                    <div class="w-10 rounded-full bg-info text-info-content px-2 py-1">
                        <i class="fa-solid fa-robot absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></i>
                    </div>
                </div>
                <div class="chat-bubble bg-info/10">${content}</div>
                <div class="chat-footer opacity-50 text-xs">
                    ${(() => {
                        const dt = msg.created_at.replace('Z', '').replace('T', ' ').split('.')[0];
                        const [, timePart] = dt.split(' ');
                        const [hour, minute] = timePart.split(':');
                        return `${hour}:${minute}`;
                    })()} • ${nomeBot}
                </div>
            `;
        },
        formatarConteudoMsg: function (msg) {
            let self = window.bashAtendimentoOmni;

            const normalizeMediaSrc = (rawValue, mimeType) => {
                if (!rawValue) return null;
                const value = String(rawValue).trim();
                if (!value) return null;

                // Já é uma URL/data URI válida
                if (
                    value.startsWith('http://') ||
                    value.startsWith('https://') ||
                    value.startsWith('data:') ||
                    value.startsWith('blob:') ||
                    value.startsWith('/')
                ) {
                    return value;
                }

                // Fallback: tratar como base64 bruto
                const mt = mimeType || 'application/octet-stream';
                return `data:${mt};base64,${value}`;
            };
            
            // Extrair texto da mensagem - mensagem pode ser JSON string ou texto direto
            let textoMensagem = '';
            let msgParsedData = null; // dados do JSON interno da mensagem
            if (msg.mensagem) {
                try {
                    const msgParsed = typeof msg.mensagem === 'string' ? JSON.parse(msg.mensagem) : msg.mensagem;
                    msgParsedData = msgParsed;
                    textoMensagem = msgParsed.texto || msgParsed.text || msg.mensagem;
                } catch (e) {
                    // Se não for JSON válido, usa o valor direto
                    textoMensagem = msg.mensagem;
                }
            }

            // Tipo de conteudo da mensagem (nao confundir com tipo de autor: cliente/bot/atendente).
            // Em alguns payloads, msg.tipo_mensagem representa o autor (ex.: 3=Atendente),
            // entao aqui partimos de texto e inferimos midia pelo JSON interno ou mime_type.
            let tipoMensagem = 1;
            let midiaUrl = null;
            let midiaMimeType = null;
            let midiaBase64 = null;

            if (msgParsedData && msgParsedData.tipo && msgParsedData.midia) {
                const midia = msgParsedData.midia;
                midiaUrl = midia.url || midia.id || null;
                midiaMimeType = midia.mime_type || '';
                midiaBase64 = midia.base64 || null;

                switch (msgParsedData.tipo) {
                    case 'imagem':
                    case 'image':
                    case 'sticker':
                        tipoMensagem = 3;
                        textoMensagem = midia.caption || '';
                        break;
                    case 'documento':
                    case 'document':
                        tipoMensagem = 4;
                        textoMensagem = midia.filename || midia.caption || '';
                        break;
                    case 'audio':
                    case 'voice':
                        tipoMensagem = 5;
                        textoMensagem = '';
                        break;
                    case 'video':
                        tipoMensagem = 3; // renderiza como imagem/mídia
                        textoMensagem = midia.caption || '';
                        break;
                    default:
                        break;
                }
            } else if (msg.mime_type) {
                const mime = String(msg.mime_type).toLowerCase();
                if (mime.startsWith('image/') || mime.startsWith('video/')) {
                    tipoMensagem = 3;
                } else if (mime.startsWith('audio/')) {
                    tipoMensagem = 5;
                } else {
                    tipoMensagem = 4;
                }
            }

            // Cria um elemento div seguro para conter o texto (prevenção XSS)
            const createSafeText = (text) => {
                if (!text) return '';

                // Escapa HTML
                const esc = document.createElement('div');
                esc.textContent = text.trim();
                const raw = esc.innerHTML.replace(/\r/g, '');

                const lines = raw
                    .split('\n')
                    .map(l => l.trim())
                    .filter(Boolean);

                // 1ª linha = header em *...*
                const rawHeader = lines[0] || '';
                const header = rawHeader.replace(/^\*(.*?)\*$/, '$1');

                // Encontra bloco de opções (linha que começa com 📋)
                const optionsIndex = lines.findIndex(l => l.startsWith('📋'));
                let bodyLines = optionsIndex === -1 ? lines.slice(1) : lines.slice(1, optionsIndex);
                const optionLines = optionsIndex === -1 ? [] : lines.slice(optionsIndex + 1);

                // Formatação inline básica: *negrito*, **negrito**, _itálico_
                const formatInline = (txt) => {
                    return txt
                        .replace(/\*\*(.*?)\*\*/g, '<span class="font-semibold">$1</span>') // **bold**
                        .replace(/\*(.*?)\*/g, '<span class="font-semibold">$1</span>')     // *bold*
                        .replace(/_(.*?)_/g, '<span class="italic">$1</span>');             // _itálico_
                };

                // --- Footer question: última linha em itálico isolada antes das opções ---
                let footerQuestion = '';
                for (let i = bodyLines.length - 1; i >= 0; i--) {
                    const m = bodyLines[i].match(/^_(.+)_$/);
                    if (m) {
                        footerQuestion = m[1];              // texto sem os underlines
                        bodyLines = bodyLines.slice(0, i);   // body = tudo antes da pergunta
                        break;
                    }
                }

                // Body em parágrafos
                const bodyHtml = bodyLines
                    .map(l => `<p class="text-sm text-base-content/90">${formatInline(l)}</p>`)
                    .join('');

                // Opções: "1. texto"
                const optionsHtml = optionLines
                    .map(l => {
                        const match = l.match(/^(\d+)\.\s*(.*)$/);
                        if (!match) return '';
                        const num = match[1];
                        const label = formatInline(match[2]);
                        return `
                            <li class="flex items-center gap-2 text-sm text-base-content/90">
                                <span class="badge badge-sm badge-primary rounded-full min-w-6 justify-center">
                                    ${num}
                                </span>
                                <span>${label}</span>
                            </li>
                        `;
                    })
                    .join('');

                return `
                    <div class="max-w-xl">
                        <!-- Header -->
                        <div class="mb-3 flex items-center gap-2">
                            <span class="text-sm font-semibold text-primary">
                                ${formatInline(header)}
                            </span>
                        </div>

                        <!-- Body -->
                        <div class="space-y-2">
                            ${bodyHtml}
                        </div>

                        ${
                            footerQuestion || optionsHtml
                                ? `
                                <!-- Footer (pergunta + opções) -->
                                <div class="mt-4 border-t border-base-300/70 pt-3 space-y-2">
                                    ${
                                        footerQuestion
                                            ? `<p class="text-sm text-base-content/80 italic">
                                                ${footerQuestion}
                                            </p>`
                                            : ''
                                    }
                                    ${
                                        optionsHtml
                                            ? `
                                            <div>
                                                <div class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                                                    <i class="fa-solid fa-list-ul text-xs"></i>
                                                    <span>Opções</span>
                                                </div>
                                                <ul class="space-y-1">
                                                    ${optionsHtml}
                                                </ul>
                                            </div>
                                            `
                                            : ''
                                    }
                                </div>
                                `
                                : ''
                        }
                    </div>
                `;
            };

            const textoFormatado = `<div class="mt-2">${createSafeText(textoMensagem)}</div>`;
            
            // tipo_mensagem: 1=texto, 2=localização, 3=imagem, 4=documento/application, 5=áudio, 6=contato, 7=enquete, 8=evento, 9=pix
            // Se não tiver tipo_mensagem definido, assume texto (1)
            switch (tipoMensagem) {
                case 3: // Imagem / Vídeo
                    // Se tem mídia (base64 tem prioridade sobre URL externa)
                    if ((midiaBase64 || midiaUrl) && !msg.file) {
                        const mediaSrc = midiaBase64
                            ? `data:${midiaMimeType};base64,${midiaBase64}`
                            : midiaUrl;
                        const isVideo = midiaMimeType && midiaMimeType.startsWith('video/');
                        if (isVideo) {
                            return `<div class="message-content text-base-content">
                                      <video controls class="max-w-xs rounded-lg">
                                          <source src="${mediaSrc}" type="${midiaMimeType}">
                                      </video>
                                      ${textoFormatado}
                                    </div>`;
                        }
                        return `<div class="message-content text-base-content">
                                  <img src="${mediaSrc}"
                                       class="max-w-xs rounded-lg cursor-pointer"
                                       onclick="window.bashAtendimentoOmni.abrirImagemModal(this)">
                                  ${textoFormatado}
                                </div>`;
                    }
                    if (!msg.file) {
                        return `<div class="message-content text-base-content">
                                  <div class="flex items-center gap-2 p-2 bg-yellow-100 rounded-lg">
                                      <i class="fas fa-exclamation-triangle text-yellow-600"></i>
                                      <span class="text-sm">Imagem não disponível</span>
                                  </div>
                                  ${textoFormatado}
                                </div>`;
                    }

                                        const mediaSrcFromFile = normalizeMediaSrc(msg.file, msg.mime_type);
                                        if (!mediaSrcFromFile) {
                                                return `<div class="message-content text-base-content">
                                                                    <div class="flex items-center gap-2 p-2 bg-yellow-100 rounded-lg">
                                                                            <i class="fas fa-exclamation-triangle text-yellow-600"></i>
                                                                            <span class="text-sm">Imagem não disponível</span>
                                                                    </div>
                                                                    ${textoFormatado}
                                                                </div>`;
                                        }

                                        const fileMime = (msg.mime_type || '').toLowerCase();
                                        const isVideoFromFile = fileMime.startsWith('video/');
                                        if (isVideoFromFile) {
                                                return `<div class="message-content text-base-content">
                                                                    <video controls class="max-w-xs rounded-lg">
                                                                            <source src="${mediaSrcFromFile}" type="${msg.mime_type || 'video/mp4'}">
                                                                    </video>
                                                                    ${textoFormatado}
                                                                </div>`;
                                        }

                    return `<div class="message-content text-base-content">
                                                            <img src="${mediaSrcFromFile}" 
                                   class="max-w-xs rounded-lg cursor-pointer" 
                                   onclick="window.bashAtendimentoOmni.abrirImagemModal(this)">
                              ${textoFormatado}
                            </div>`;

                case 4: { // Documento/Application (PDF, DOCX, etc)
                    const mimeTypeDoc = midiaMimeType || msg.mime_type || '';
                    const iconClass = self.getFileIcon(mimeTypeDoc, textoMensagem || 'Documento');
                    // Tentar extrair nome do arquivo da URL se não tiver filename
                    const fileNameFromUrl = midiaUrl
                        ? midiaUrl.split('/').pop().replace(/^\d+_\d+/, '').replace(/^_/, '') || midiaUrl.split('/').pop()
                        : '';
                    const fileName = textoMensagem || fileNameFromUrl || msg.file_name || 'Documento';

                    // Se tem mídia (base64 tem prioridade sobre URL externa)
                    if ((midiaBase64 || midiaUrl) && !msg.file) {
                        const downloadHref = midiaBase64
                            ? `data:${mimeTypeDoc};base64,${midiaBase64}`
                            : midiaUrl;
                        const isDataHref = typeof downloadHref === 'string' && downloadHref.startsWith('data:');
                        const downloadAttr = (midiaBase64 || isDataHref)
                            ? `download="${fileName}"` : `target="_blank" rel="noopener noreferrer"`;
                        return `<div class="message-content text-base-content">
                                  <div class="flex items-center gap-2 p-3 bg-base-200 rounded-lg hover:bg-base-300 transition-colors">
                                      <i class="${iconClass} text-2xl text-primary"></i>
                                      <div class="flex-1 min-w-0">
                                          <div class="font-medium truncate">${fileName}</div>
                                          <div class="text-xs text-base-content/70">${mimeTypeDoc}</div>
                                      </div>
                                      <a href="${downloadHref}" ${downloadAttr}
                                         class="btn btn-sm btn-primary">
                                          <i class="fas fa-download"></i> Baixar
                                      </a>
                                  </div>
                                </div>`;
                    }

                    if (!msg.file) {
                        return `<div class="message-content text-base-content">
                                  <div class="flex items-center gap-2 p-2 bg-yellow-100 rounded-lg">
                                      <i class="${iconClass} text-yellow-600"></i>
                                      <span class="font-medium">${fileName}</span>
                                      <span class="ml-auto text-xs text-yellow-700">Arquivo não disponível</span>
                                  </div>
                                  ${textoFormatado}
                                </div>`;
                    }

                    return `<div class="message-content text-base-content">
                              <div class="flex items-center gap-2 p-3 bg-base-200 rounded-lg hover:bg-base-300 transition-colors">
                                  <i class="${iconClass} text-2xl text-primary"></i>
                                  <div class="flex-1 min-w-0">
                                      <div class="font-medium truncate">${fileName}</div>
                                      <div class="text-xs text-base-content/70">${mimeTypeDoc}</div>
                                  </div>
                                  <button onclick="window.bashAtendimentoOmni.downloadFile('${msg.file}', '${fileName}', '${mimeTypeDoc}')" 
                                          class="btn btn-sm btn-primary">
                                      <i class="fas fa-download"></i> Baixar
                                  </button>
                              </div>
                            </div>`;
                }

                case 5: // Áudio
                    // Se tem mídia (base64 tem prioridade sobre URL externa)
                    if ((midiaBase64 || midiaUrl) && !msg.file) {
                        const mimeTypeAudio = midiaMimeType || 'audio/ogg';
                        const audioSrc = midiaBase64
                            ? `data:${mimeTypeAudio};base64,${midiaBase64}`
                            : midiaUrl;
                                                return `<div class="message-content text-base-content" style="min-width: 240px; max-width: 360px; width: 100%;">
                                                                    <audio controls preload="metadata" style="display:block; width:100%; min-width:240px; max-width:360px; height:40px;">
                                      <source src="${audioSrc}" type="${mimeTypeAudio}">
                                      Seu navegador não suporta o elemento de áudio.
                                  </audio>
                                  ${textoFormatado}
                                </div>`;
                    }
                    if (!msg.file) {
                        return `<div class="message-content text-base-content">
                                  <div class="flex items-center gap-2 p-2 bg-yellow-100 rounded-lg">
                                      <i class="fas fa-exclamation-triangle text-yellow-600"></i>
                                      <span class="text-sm">Áudio não disponível</span>
                                  </div>
                                  ${textoFormatado}
                                </div>`;
                    }

                                        const audioSrcFromFile = normalizeMediaSrc(msg.file, msg.mime_type || 'audio/ogg');
                                        if (!audioSrcFromFile) {
                                                return `<div class="message-content text-base-content">
                                                                    <div class="flex items-center gap-2 p-2 bg-yellow-100 rounded-lg">
                                                                            <i class="fas fa-exclamation-triangle text-yellow-600"></i>
                                                                            <span class="text-sm">Áudio não disponível</span>
                                                                    </div>
                                                                    ${textoFormatado}
                                                                </div>`;
                                        }

                                        return `<div class="message-content text-base-content" style="min-width: 240px; max-width: 360px; width: 100%;">
                                                            <audio controls preload="metadata" style="display:block; width:100%; min-width:240px; max-width:360px; height:40px;">
                                                                    <source src="${audioSrcFromFile}" type="${msg.mime_type || 'audio/ogg'}">
                                  Seu navegador não suporta o elemento de áudio.
                              </audio>
                              ${textoFormatado}
                            </div>`;

                case 1: // Texto simples (default)
                default:
                    return `<div class="message-content text-base-content">${textoFormatado}</div>`;
            }
        },
        iniciarAtalhos: function () {
            const inputMsg = document.getElementById('omni-input-mensagem');
            const container = document.getElementById('omni-atalhos-container');
            const lista = document.getElementById('omni-atalhos-list');
            self = window.bashAtendimentoOmni;

            inputMsg.addEventListener('input', (e) => {
                const value = e.target.value;

                // Verifica se o usuário digitou "/"
                if (value.startsWith('/')) {
                    const searchTerm = value.substring(1).toLowerCase();
                    self.exibirAtalhos(searchTerm);
                } else {
                    container.classList.add('hidden');
                }
            });

            // Fechar a lista ao clicar fora
            document.addEventListener('click', (e) => {
                if (!container.contains(e.target) && e.target !== inputMsg) {
                    container.classList.add('hidden');
                }
            });
        },
        exibirAtalhos: function (searchTerm) {
            const self = window.bashAtendimentoOmni;
            const container = document.getElementById('omni-atalhos-container');
            const lista = document.getElementById('omni-atalhos-list');

            // Verificar se há conversa ativa e empresa definida
            if (!self.atendimentoAtual || !self.atendimentoAtual.empresa) {
                container.classList.add('hidden');
                return;
            }

            // Encontrar a empresa correspondente
            const empresa = self.omniUsuario.empresas.find(
                emp => emp.id === self.atendimentoAtual.empresa.id
            );

            if (!empresa || !empresa.atalhos || empresa.atalhos.length === 0) {
                container.classList.add('hidden');
                return;
            }

            // Filtrar atalhos pelo termo de busca (se houver)
            const atalhosFiltrados = empresa.atalhos.filter(atalho =>
                atalho.key.toLowerCase().includes(searchTerm) ||
                atalho.text.toLowerCase().includes(searchTerm)
            );

            // Limpar lista anterior
            lista.innerHTML = '';

            if (atalhosFiltrados.length === 0) {
                const item = document.createElement('li');
                item.className = 'px-4 py-2 text-gray-500';
                item.textContent = 'Nenhum atalho encontrado';
                lista.appendChild(item);
            } else {
                atalhosFiltrados.forEach(atalho => {
                    const item = document.createElement('li');
                    item.className = 'px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between';
                    item.innerHTML = `
                        <span class="font-medium">/${atalho.key}</span>
                        <span class="text-gray-600 truncate ml-2">${atalho.text}</span>
                    `;

                    item.addEventListener('click', () => {
                        self.selecionarAtalho(atalho);
                    });

                    lista.appendChild(item);
                });
            }

            // Removemos o cálculo de width pois agora está com left-0 right-0
            container.classList.remove('hidden');
        },
        mostrarNotificacao: function (titulo = "Nova mensagem", corpo = "Você tem uma nova notificação!") {
            self = window.bashAtendimentoOmni
            if (!self.Notification) return;
            if (document.visibilityState === 'hidden') {
                new Notification(titulo, {
                    body: corpo,
                    icon: '/favicon.ico' // Opcional
                });
            }
        },
        // Função para selecionar um atalho
        selecionarAtalho: function (atalho) {
            const inputMsg = document.getElementById('omni-input-mensagem');
            inputMsg.value = atalho.text;
            inputMsg.focus();

            document.getElementById('omni-atalhos-container').classList.add('hidden');

            // Disparar evento de input para qualquer listener adicional
            const event = new Event('input', { bubbles: true });
            inputMsg.dispatchEvent(event);
        },
        getFileIcon: function (mimeType, fileName) {
            const extension = fileName ? fileName.split('.').pop().toLowerCase() : '';

            if (mimeType.includes('pdf')) return 'fas fa-file-pdf';
            if (mimeType.includes('word') || mimeType.includes('document') ||
                ['doc', 'docx'].includes(extension)) return 'fas fa-file-word';
            if (mimeType.includes('excel') || ['xls', 'xlsx'].includes(extension)) return 'fas fa-file-excel';
            if (mimeType.includes('powerpoint') || ['ppt', 'pptx'].includes(extension)) return 'fas fa-file-powerpoint';
            if (mimeType.includes('zip') || mimeType.includes('compressed') ||
                ['zip', 'rar', '7z'].includes(extension)) return 'fas fa-file-archive';

            return 'fas fa-file';
        },
        downloadFile: function (base64, fileName, mimeType) {
            const link = document.createElement('a');
            link.href = `data:${mimeType};base64,${base64}`;
            link.download = fileName || 'download';
            link.click();
        },
        abrirImagemModal: function (imgElement) {
            // Criar o modal
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black/75 flex items-center justify-center z-50';

            // Obter o src da imagem clicada
            const imgSrc = imgElement.src;

            modal.innerHTML = `
                <div class="relative flex flex-col items-center">
                    <div class="relative max-h-[90vh] max-w-[90vw]">
                        <img src="${imgSrc}" class="max-h-[80vh] max-w-[80vw] object-contain">
                    </div>
                    
                    <!-- Botão de fechar -->
                    <button class="btn btn-circle btn-ghost absolute top-4 right-4 text-white"
                            onclick="this.closest('div[class*=\\'fixed\\']').remove()">
                        ✕
                    </button>
                    
                    <!-- Botão de download -->
                    <button class="btn btn-primary mt-4" 
                            onclick="window.bashAtendimentoOmni.downloadImage('${imgSrc}')">
                        <i class="fa-solid fa-download mr-2"></i> Baixar Imagem
                    </button>
                </div>
            `;

            document.body.appendChild(modal);

            // Fechar ao clicar fora
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });

            // Prevenir que o clique na imagem feche o modal
            modal.querySelector('img').addEventListener('click', (e) => {
                e.stopPropagation();
            });
        },
        downloadImage: function (imgSrc) {
            // Extrair o nome do arquivo (se disponível) ou criar um padrão
            const fileName = `imagem-${new Date().toISOString().slice(0, 10)}.${imgSrc.split(';')[0].split('/')[1] || 'png'}`;

            // Criar link temporário para download
            const link = document.createElement('a');
            link.href = imgSrc;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Fechar o modal após o download
            const modal = document.querySelector('div[class*="fixed inset-0 bg-black/75"]');
            if (modal) modal.remove();
        },
        downloadIntegracao: function (linkIntegracao) {
            // Validar se o link existe
            if (!linkIntegracao) {
                avisos('Erro', 'Link de integração não encontrado', 'error');
                return;
            }

            try {
                // Extrair nome do arquivo do link ou criar um padrão
                const url = new URL(linkIntegracao);
                const pathParts = url.pathname.split('/');
                const fileName = pathParts[pathParts.length - 1] || `integracao-${Date.now()}`;
                
                // Criar link temporário para download
                const link = document.createElement('a');
                link.href = linkIntegracao;
                link.download = fileName;
                link.target = '_blank'; // Abrir em nova aba como fallback
                
                // Adicionar ao DOM, clicar e remover
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                avisos('Download', 'Download da integração iniciado', 'info');
                
            } catch (error) {
                console.error('Erro ao fazer download da integração:', error);
                
                // Fallback: tentar abrir em nova aba
                try {
                    window.open(linkIntegracao, '_blank');
                    avisos('Download', 'Arquivo aberto em nova aba', 'info');
                } catch (fallbackError) {
                    avisos('Erro', 'Não foi possível fazer o download do arquivo', 'error');
                }
            }
        },
        //
        handleStatusChange: function (newStatus) {
            let self = window.bashAtendimentoOmni;

            if (!self.omniWs || self.omniWs.readyState !== WebSocket.OPEN) {
                avisos('Multicanais', 'Você precisa estar conectado para mudar o status.', "warning");
                return;
            }

            const data = {
                Funcao: '',
                AuthID: getUserSession().id.toString(),
                WsConn: self.wsConnId,
                SessionID: GlobGetSessionID.id.toString()
            };

            // Verifica se é um ID de pausa (começa com números)
            if (/^\d/.test(newStatus)) {
                // Encontra a pausa selecionada
                const pausaSelecionada = self.omniUsuario.pausas.find(p => p.id == newStatus);
                if (!pausaSelecionada) {
                    avisos('Erro', 'Tipo de pausa não encontrado', "error");
                    return;
                }

                data.Funcao = 'startPause';
                data.TipoPausas = {
                    id: pausaSelecionada.id.toString(),
                    nome: pausaSelecionada.nome,
                    duracao: pausaSelecionada.duracao
                };

                // Define status temporário enquanto aguarda confirmação
                self.setStatus("Pausa agendada");
                avisos('Pausa', 'Solicitando pausa...', "info");
            }
            // Se for para sair da pausa
            else if (newStatus === 'Disponivel' && self.omniUsuario.status_pausa) {
                data.Funcao = 'stopPause';
                data.Key = self.omniUsuario.pausa.id.toString(); // Adiciona a chave da pausa atual

                avisos('Pausa', 'Finalizando pausa...', "info");
            }
            // Outros status
            else if (newStatus === 'Desconectar') {
                data.Funcao = 'closeClient';
                avisos('Deslogue', 'Solicitando deslogue...', "info");
            }

            self.omniWs.send(JSON.stringify(data));
        },
        handleSocketMessage: function (message) {
            let self = window.bashAtendimentoOmni;

            // Mensagens de ping/pong
            if (message.Funcao === 'pong') {
                return;
            }

            // Inicialização do cliente
            if (message.Funcao === 'startClient') {
                const payload = message?.data?.Data || message?.data || null;
                if (!payload) {
                    console.error('startClient sem payload válido', message);
                    avisos('Multicanais', 'Resposta incompleta do servidor (startClient)', 'error');
                    self.setStatus('Desconectado');
                    return;
                }
                self.processStartClientResponse(payload);
                return;
            }

            // Tratamento das mensagens baseado no tipo
            switch (message.Funcao) {
                case 'sendWhatsResult': // Confirmação de envio
                    self.handleConfirmationMessage(message);
                    break;
                case 'updateMensagemAtendente': // Atualização de mensagem enviada
                    self.handleUpdateMessage(message);
                    break;
                case 'reciveMsg': // Mensagem recebida do cliente
                    self.handleIncomingMessage(message);
                    break;
                case 'startTask': // Nova conversa recebida
                    self.handleNewConversation(message);
                    break;
                case 'addTask': // Nova conversa transferida para este operador
                    self.handleNewConversation(message);
                    break;
                case 'closeTask': // Resposta ao encerrar conversa
                    self.handleCloseTaskResponse(message);
                    break;
                case 'removeTask': // Remoção de conversa
                    self.handleRemoveTask(message);
                    break;
                case 'removeTransfereedTask': // Conversa transferida
                    self.handleTransferredConversation(message);
                    break;

                case 'startPause': // Resposta à solicitação de pausa
                    if (message.code === 200) {
                        avisos('Pausa', 'Pausa agendada com sucesso!', "success");
                        // O status será atualizado para "Em pausa" quando recebermos initPause
                    } else {
                        avisos('Erro', 'Falha ao agendar pausa: ' + message.message, "error");
                        self.setStatus("Disponivel");
                    }
                    break;

                case 'initPause': // Confirmação de que a pausa foi iniciada
                    if (message.code === 200) {
                        self.omniUsuario.status_pausa = true;
                        self.omniUsuario.pausa = message.data;
                        avisos('Pausa', 'Pausa iniciada com sucesso', "success");
                        self.setStatus("Pausa");
                    }
                    break;

                case 'stopPause': // Resposta ao sair da pausa
                    if (message.code === 200) {
                        self.omniUsuario.status_pausa = false;
                        self.omniUsuario.pausa = {};
                        avisos('Pausa', 'Pausa finalizada com sucesso', "success");
                        self.setStatus("Disponivel");
                    } else {
                        avisos('Erro', 'Falha ao sair da pausa: ' + message.message, "error");
                    }
                    break;
                case 'closeClient': // Resposta à solicitação de deslogue
                    if (message.code === 200) {
                        self.omniUsuario.deslogue = {
                            status_deslogue: true,
                            hora_solicitou: message.data.Data.hora_solicitou
                        };
                        avisos('Deslogue', 'Deslogue agendado com sucesso!', "success");
                        self.setStatus("Deslogue agendado");
                    } else {
                        avisos('Erro', 'Falha ao agendar deslogue: ' + message.message, "error");
                    }
                    break;

                case 'confirmCloseClient': // Confirmação de deslogue efetivo
                    if (message.code === 200) {
                        avisos('Deslogue', 'Você foi deslogado com sucesso', "success");
                        self.omniWsResetConnection(); // Chama a função de desconexão existente
                        self.setStatus("Desconectado");
                    }
                    break;

                default:
                    console.log('Mensagem não tratada:', message);
            }
        },
        handleConfirmationMessage: function (message) {
            let self = window.bashAtendimentoOmni;

            if (message.code === 0) {
                // Verificar se é um arquivo (pela presença de Media)
                const isArquivo = message.data.Mensage.Data.Media;

                if (isArquivo) {
                    // avisos('Arquivo', 'Arquivo recebido pelo servidor', 'success');
                } else {
                    // avisos('Mensagem', 'Mensagem enviada ao servidor', 'success');
                }

                // Atualizar a conversa se estiver aberta
                if (self.atendimentoAtual &&
                    self.atendimentoAtual.conversas_id === message.data.ConversasId) {
                    setTimeout(() => {
                        self.renderOmniShowConversa(self.atendimentoAtual);
                    }, 300);
                }
            } else {
                avisos('Erro', 'Erro ao enviar: ' + message.message, 'error');
            }
        },
        handleUpdateMessage: function (message) {
            let self = window.bashAtendimentoOmni;

            if (message.code === 200) {
                // Verificar se a mensagem pertence à conversa atual
                const conversaId = parseInt(message.data.ConversasId);
                if (!self.atendimentoAtual || self.atendimentoAtual.id !== conversaId) {
                    console.log('Mensagem não pertence à conversa atual, ignorando update visual');
                    return;
                }
                
                // Adicionar mensagem_tipo para renderização correta (tipo 3 = Atendente)
                const mensagem = {
                    ...message.data.Mensage,
                    mensagem_tipo: { id: 3, nome: 'Atendente' }
                };
                
                // Atualiza a mensagem na conversa atual
                self.atualizarMensagemNaConversa(mensagem);
            }
        },
        handleIncomingMessage: function (message) {
            let self = window.bashAtendimentoOmni;

            if (message.code === 200) {
                // Adicionar mensagem_tipo para renderização correta (tipo 1 = Cliente)
                const mensagem = {
                    ...message.data.Mensage,
                    mensagem_tipo: { id: 1, nome: 'Cliente' }
                };
                const conversaId = parseInt(message.data.ConversasId);
                // Verifica se a mensagem pertence à conversa aberta
                console.log('Mensagem recebida:', conversaId);
                console.log('Mensagem aberta:', self.atendimentoAtual?.id);
                if (self.atendimentoAtual && self.atendimentoAtual.id === conversaId) {
                    self.adicionarMensagemNaConversa(mensagem);
                    avisos('Conversa', 'Nova mensagem recebida.', "info");
                } else {
                    // Adiciona notificação visual na lista de conversas
                    self.adicionarNotificacaoConversa(conversaId);
                    // Adiciona a mensagem ao histórico (se necessário)
                    self.adicionarMensagemAoHistorico(conversaId, mensagem);
                }
            }
        },
        limparEstadoInicial: function () {
            let self = window.bashAtendimentoOmni;
            
            console.log('🧹 Limpando para estado inicial...');
            
            // Limpar atendimento atual
            self.atendimentoAtual = null;
            
            // Esconder div principal do card de atendimento
            if (self.ElementsOmniAtendimento.atendimentoConversaAberta) {
                self.ElementsOmniAtendimento.atendimentoConversaAberta.addClass('hidden');
                self.ElementsOmniAtendimento.atendimentoConversaAberta.empty();
            }
            
            // Limpar e esconder div de classificação
            if (self.ElementsOmniAtendimento.afTabClassificacao) {
                self.ElementsOmniAtendimento.afTabClassificacao.empty();
                self.ElementsOmniAtendimento.afTabClassificacao.addClass('hidden');
            }
            
            // Limpar e esconder div de histórico
            if (self.ElementsOmniAtendimento.afTabHistoricoCliente) {
                self.ElementsOmniAtendimento.afTabHistoricoCliente.empty();
                self.ElementsOmniAtendimento.afTabHistoricoCliente.addClass('hidden');
            }

            if (self.ElementsOmniAtendimento.afTabDefault) {
                self.mostrarPainelLateralPadrao(null);
            }
            
            // Limpar container de mensagens
            const containerMensagens = document.getElementById('omni-conversa-mensagens');
            if (containerMensagens) {
                containerMensagens.innerHTML = '';
            }
            
            // Remover container de conversa se existir
            const containerConversa = document.getElementById('omni-conversa-container');
            if (containerConversa) {
                containerConversa.remove();
            }
            
            // Limpar inputs
            const inputMensagem = document.getElementById('omni-input-mensagem');
            if (inputMensagem) {
                inputMensagem.value = '';
            }
            
            // Fechar modais
            const modalArquivo = document.getElementById('omniModalArquivo');
            if (modalArquivo && typeof modalArquivo.close === 'function') {
                modalArquivo.close();
            }
            
            const modalHistorico = document.getElementById('omniModalHistorico');
            if (modalHistorico && typeof modalHistorico.close === 'function') {
                modalHistorico.close();
            }
            
            const modalClassificador = document.getElementById('classificadorModal');
            if (modalClassificador) {
                if (typeof modalClassificador.close === 'function') {
                    modalClassificador.close();
                }
                modalClassificador.remove();
            }
            
            console.log('✅ Estado inicial restaurado');
        },
        
        handleCloseTaskResponse: function (message) {
            let self = window.bashAtendimentoOmni;
            if (message.code === 200) {
                avisos('Sucesso', 'Atendimento encerrado com sucesso', 'success');

                const payload = message?.data?.Data || message?.data || {};
                const conversaId = payload.ConversasId || payload.ConversasID || payload.conversas_id ||
                    message?.ConversasId || message?.ConversasID || message?.conversas_id ||
                    self.atendimentoAtual?.id || self.atendimentoAtual?.conversas_id;

                const conversaIdStr = String(conversaId || '');

                if (self.atendimentoAtual &&
                    (String(self.atendimentoAtual.id) === conversaIdStr ||
                     String(self.atendimentoAtual.conversas_id) === conversaIdStr)) {
                    self.atendimentoAtual.finalizada = true;
                    self.atendimentoAtual.status = 'finalizado';
                    self.disableInputs();
                }

                self.omniUsuario.atendimentos = self.omniUsuario.atendimentos.filter(a =>
                    String(a.id) !== conversaIdStr && String(a.conversas_id) !== conversaIdStr
                );

                // Atualizar a UI
                self.renderOmniAtendimentos();

                // Fechar a conversa se estiver aberta
                if (self.atendimentoAtual &&
                    (String(self.atendimentoAtual.id) === conversaIdStr ||
                     String(self.atendimentoAtual.conversas_id) === conversaIdStr)) {
                    self.limparEstadoInicial();
                    self.disableInputs();
                }
            } else {
                // Resetar flag de encerramento para permitir nova tentativa
                if (self.atendimentoAtual) {
                    self.atendimentoAtual._encerrando = false;
                }
                avisos('Erro', 'Falha ao encerrar atendimento: ' + message.message, 'error');
            }
        },
        handleTransferredConversation: function (message) {
            let self = window.bashAtendimentoOmni;
            if (message.code === 200) {
                const conversationId = message.data.conversas_id;
                const transferredBy = message.data.by.nome || 'Sistema';
                self.omniUsuario.atendimentos = self.omniUsuario.atendimentos.filter(
                    a => a.conversas_id !== conversationId
                );
                self.renderOmniAtendimentos();

                if (self.atendimentoAtual && self.atendimentoAtual.conversas_id === conversationId) {
                    self.limparEstadoInicial();
                }
                avisos('Conversa Transferida',
                    `Conversa transferida por ${transferredBy}.`,
                    "info");
            } else {
                avisos('Erro', 'Falha ao transferir conversa: ' + (message.message || 'Erro desconhecido'), "error");
            }
        },
        handleRemoveTask: function (message) {
            let self = window.bashAtendimentoOmni;
            if (message.code === 200) {
                const data = message.data || {};
                // O campo pode vir como conversas_id (RemoveTask struct json tag) ou ConversasId
                const conversationId = String(data.conversas_id || data.ConversasId || data.ConversasID || '');
                
                console.log('🗑️ Removendo conversa:', conversationId, 'Atual:', self.atendimentoAtual?.id);
                
                // Encontra a conversa pelo ID (pode ser string ou número)
                const conversa = self.omniUsuario.atendimentos.find(a => 
                    String(a.id) === String(conversationId) || 
                    String(a.conversas_id) === String(conversationId)
                );
                
                if (conversa) {
                    // Se essa conversa está aberta, limpa PRIMEIRO
                    if (self.atendimentoAtual && 
                        (String(self.atendimentoAtual.id) === String(conversationId) || 
                         String(self.atendimentoAtual.conversas_id) === String(conversationId))) {
                        
                        console.log('🧹 Limpando conversa aberta');
                        self.limparEstadoInicial();
                        self.disableInputs();
                    }

                    // Remove a conversa da lista de atendimentos
                    const index = self.omniUsuario.atendimentos.findIndex(a => 
                        String(a.id) === String(conversationId) || 
                        String(a.conversas_id) === String(conversationId)
                    );
                    
                    if (index !== -1) {
                        self.omniUsuario.atendimentos.splice(index, 1);
                        console.log('✅ Conversa removida da lista');
                    }

                    // Re-renderiza a lista de atendimentos (agora sem essa conversa)
                    self.renderOmniAtendimentos();
                    
                    avisos('Conversa', 'Conversa finalizada e removida com sucesso', "success");
                } else {
                    console.warn('⚠️ Conversa não encontrada na lista:', conversationId);
                }
            } else {
                // Mostra notificação de erro
                avisos('Conversa', 'Falha ao remover conversa: ' + (message.message || 'Erro desconhecido'), "error");
            }
        },
        appendMsgFinalizado: function (conversa) {
            let finalizacaoContainer = document.createElement('div');
            finalizacaoContainer.classList.add('flex', 'flex-col', 'items-center', 'my-6', 'w-full');

            // Divisor com estilo sutil
            let divisor = document.createElement('div');
            divisor.classList.add('divider', 'w-full', 'before:bg-error/50', 'after:bg-error/50', 'my-2');

            // Texto de finalização com estilo error
            let textoFinalizacao = document.createElement('span');
            textoFinalizacao.classList.add(
                'text-error',
                'font-medium',
                'text-sm',
                'bg-error-content/10',
                'px-3',
                'py-1',
                'rounded-full'
            );
            textoFinalizacao.textContent = 'Atendimento finalizado';
            // Montagem dos elementos
            finalizacaoContainer.appendChild(divisor);
            finalizacaoContainer.appendChild(textoFinalizacao);
            // Adicionar ao container de mensagens
            let mensagensContainer = document.getElementById('omni-conversa-mensagens');
            if (mensagensContainer) {
                mensagensContainer.appendChild(finalizacaoContainer);
            }
        },
        handleNewConversation: function (message) {
            let self = window.bashAtendimentoOmni;
            
            console.log('📥 handleNewConversation - Mensagem completa:', message);
            console.log('📥 message.data:', message.data);
            console.log('📥 message.data.Conversa:', message.data.Conversa);
            
            if (message.code !== 200) {
                console.error('Erro ao receber nova conversa:', message.message);
                return;
            }
            // Extrair os dados da nova conversa
            // Para startTask e addTask, os dados vêm em message.data (objeto direto)
            const novaConversa = message.data.Conversa;
            
            if (!novaConversa) {
                console.error('Conversa não encontrada na mensagem:', message);
                return;
            }
            
            // Não adicionar conversas finalizadas
            if (novaConversa.status === 'finalizado') {
                console.log('⏭️ Conversa finalizada ignorada:', novaConversa.id);
                return;
            }
            
            console.log('✅ Nova conversa recebida:', novaConversa);
            
            // Adicionar a nova conversa à lista de atendimentos
            self.omniUsuario.atendimentos.unshift(novaConversa);
            // Atualizar a lista de atendimentos na UI
            self.renderOmniAtendimentos();
            // Mostrar notificação
            avisos('Nova Conversa', `Nova conversa recebida de ${novaConversa.clientes.nome}`, "info");
            self.mostrarNotificacao('Nova Conversa', "Nova conversa recebida")
            // Se não houver conversa aberta, abrir automaticamente a nova conversa
            if (!self.atendimentoAtual) {
                self.renderOmniShowConversa(novaConversa);
            } else {
                // Adicionar notificação visual na lista
                self.adicionarNotificacaoConversa(novaConversa.id);
            }
        },
        handleConnectionError: function (error) {
            let self = window.bashAtendimentoOmni;
            console.error('Erro na conexão WebSocket:', error);
            if (self.retryCount < self.omniWsConfig.maxRetries) {
                self.retryCount++;
                avisos('Multicanais', `Erro de conexão. Tentando novamente (${self.retryCount}/${self.omniWsConfig.maxRetries})`, "warning");
                setTimeout(() => self.omniWsConnect(), self.omniWsConfig.retryDelay);
            } else {
                avisos('Multicanais', 'Erro de conexão. Não foi possivel se connectar com o servidor. Recarregue a página', "error");
                self.omniWsResetConnection();
            }
        },
        renderOmniStatusList: function () {
            let self = window.bashAtendimentoOmni;
            // Calcula o tempo de pausa se estiver em pausa
            let tempoPausa = '';
            if ((self.omniStatusAtual.nome === 'Pausa' || self.omniStatusAtual.nome === 'Pausa agendada') &&
                self.omniUsuario.pausa?.hora_inicio) {
                tempoPausa = this.formatTempoPausa(self.omniUsuario.pausa.hora_inicio);
            }
            // Calcula o tempo até o deslogue se estiver agendado
            let tempoDeslogue = '';
            if (self.omniStatusAtual.nome === 'Deslogue agendado' &&
                self.omniUsuario.deslogue?.hora_solicitou) {
                tempoDeslogue = this.formatTempoDeslogue(self.omniUsuario.deslogue.hora_solicitou);
            }
            const dropdownHTML = `
                <div class="dropdown dropdown-end w-full">
                    <!-- Label flutuante como no select -->
                    <div class="relative">
                        <div tabindex="0" role="button" class="select select-bordered w-full h-auto min-h-0 px-4 py-2 text-left normal-case font-normal flex items-center justify-between">
                            <div class="flex flex-col w-full">
                                <span class="text-xs absolute top-0 left-3 px-1 text-gray-500">Status</span>
                                <div class="flex items-center gap-2 truncate pt-1">
                                    <span class="truncate">${self.omniStatusAtual.nome}</span>
                                    <span class="badge ${self.getStatusBadgeClass()} badge-xs"></span>
                                    ${tempoPausa ? `<span class="text-xs text-gray-500 ml-auto mr-5 tempo-pausa-omni" data-timer="${self.omniUsuario.pausa.hora_inicio}">${tempoPausa}</span>` : ''} 
                                </div>
                            </div>
                        </div>
                    </div>
                    <ul tabindex="0" class="dropdown-content z-[1] menu shadow bg-base-100 rounded-box w-full border border-base-300 mt-1 py-0">
                        ${self.generateStatusOptions()}
                    </ul>
                </div>
            `;
            self.ElementsOmniAtendimento.statusAtual.html(dropdownHTML);
            self.renderOmniAtendimentos();
        },
        formatTempoPausa: function (horaInicio) {
            const inicio = new Date(horaInicio);
            const agora = new Date();
            const diff = Math.floor((agora - inicio) / 1000); // diferença em segundos
            const horas = Math.floor(diff / 3600);
            const minutos = Math.floor((diff % 3600) / 60);
            return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
        },
        formatTempoDeslogue: function (horaInicio) {
            const inicio = new Date(horaInicio);
            const agora = new Date();
            const diff = Math.floor((agora - inicio) / 1000); // diferença em segundos            
            const horas = Math.floor(diff / 3600);
            const minutos = Math.floor((diff % 3600) / 60);
            return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
        },
        getStatusBadgeClass: function () {
            switch (this.omniStatusAtual.nome) {
                case 'Disponivel': return 'badge-success';
                case 'Pausa':
                case 'Pausa agendada': return 'badge-warning';
                case 'Desconectado':
                case 'Deslogue agendado': return 'badge-error';
                default: return 'badge-info';
            }
        },
        getStatusIcon: function () {
            switch (this.omniStatusAtual.nome) {
                case 'Disponivel': return 'fa fa-check-circle';
                case 'Pausa':
                case 'Pausa agendada': return 'fa fa-pause-circle';
                case 'Desconectado': return 'fa fa-times-circle';
                default: return 'fa fa-info-circle';
            }
        },
        generateStatusOptions: function (tempoPausa, tempoDeslogue) {
            let self = this;
            let optionsHTML = '';

            // Se estiver em estado de Deslogue agendado
            if (self.omniStatusAtual.nome === 'Deslogue agendado') {
                optionsHTML += `
                    <li class="px-2 pt-2">
                        <div class="flex justify-between items-center text-sm px-2">
                            <div class="flex items-center gap-2 text-gray-500">
                                <i class="fa fa-clock"></i>
                                <span>Finalize os atendimento para completar o deslogue</span>
                            </div>
                        </div>
                    </li>
                `;
            }
            // Se estiver em Pausa ou Pausa agendada
            else if (self.omniStatusAtual.nome === 'Pausa' || self.omniStatusAtual.nome === 'Pausa agendada') {
                optionsHTML += `
                    <li class="px-2 pb-1">
                        <a onclick="window.bashAtendimentoOmni.handleStatusChange('Disponivel')" 
                           class="text-sm hover:bg-success/10 active:bg-success/20">
                            <div class="flex items-center gap-2">
                                <i class="fa fa-play-circle text-success"></i>
                                <span class="text-success">Retomar Atendimento</span>
                            </div>
                        </a>
                    </li>
                `;
            }
            // Se estiver Disponível
            else if (self.omniStatusAtual.nome === 'Disponivel') {
                // Seção de Pausas
                optionsHTML += `
                    <li class="px-2 pt-1">
                        <div class="flex items-center gap-2 text-xs text-gray-500 px-2 py-1">
                            <i class="fa fa-pause"></i>
                            <span>Tipos de Pausa</span>
                        </div>
                    </li>
                    ${self.omniUsuario.pausas.map(pausa => `
                        <li class="px-2">
                            <a onclick="window.bashAtendimentoOmni.handleStatusChange('${pausa.id}')" 
                               class="text-sm hover:bg-warning/10 active:bg-warning/20">
                                <div class="flex items-center justify-between gap-2">
                                    <div class="flex items-center gap-2">
                                        <i class="fa fa-clock-o text-warning"></i>
                                        <span>${pausa.nome}</span>
                                    </div>
                                    <span class="text-xs text-gray-500">${pausa.duracao}</span>
                                </div>
                            </a>
                        </li>
                    `).join('')}
                    
                    <li><hr class="mx-2 mt-1 py-0 border-t border-base-200"></li>
                    <li class="px-2 pb-1">
                        <a onclick="window.bashAtendimentoOmni.handleStatusChange('Desconectar')" 
                           class="text-sm hover:bg-error/10 active:bg-error/20">
                            <div class="flex items-center gap-2">
                                <i class="fa fa-sign-out text-error"></i>
                                <span class="text-error">Desconectar</span>
                            </div>
                        </a>
                    </li>
                `;
            }
            // Se estiver Desconectado
            else if (self.omniStatusAtual.nome === 'Desconectado') {
                optionsHTML += `
                    <li class="px-2 pt-2 pb-1">
                        <a onclick="window.bashAtendimentoOmni.omniWsConnect()" 
                           class="text-sm hover:bg-success/10 active:bg-success/20">
                            <div class="flex items-center gap-2">
                                <i class="fa fa-plug text-success"></i>
                                <span class="text-success">Conectar</span>
                            </div>
                        </a>
                    </li>
                `;
            }

            return optionsHTML;
        },
        atualizarMensagemNaConversa: function (mensagem) {
            let self = window.bashAtendimentoOmni;
            if (!self.atendimentoAtual) return;
            
            // Inicializar dados_conversa se não existir
            if (!self.atendimentoAtual.dados_conversa) {
                self.atendimentoAtual.dados_conversa = [];
            }
            
            // Encontra e atualiza a mensagem na conversa atual
            const conversa = self.atendimentoAtual.dados_conversa;
            const index = conversa.findIndex(m => m.id === mensagem.id);
            if (index !== -1) {
                // Atualiza a mensagem existente
                conversa[index] = mensagem;
            } else {
                // Adiciona como nova mensagem se não encontrada
                conversa.push(mensagem);
            }
            
            // Re-renderiza apenas as mensagens, não a conversa inteira
            self.atualizarMensagensConversa(self.atendimentoAtual.dados_conversa, self.atendimentoAtual.finalizada);
            self.rolarParaUltimaMensagem();
        },
        adicionarNotificacaoConversa: function (conversaId) {
            self = window.bashAtendimentoOmni;
            let conversa = self.omniUsuario.atendimentos.find(a =>
                String(a.id) === String(conversaId) || String(a.conversas_id) === String(conversaId)
            );

            if (!conversa) {
                return;
            }

            // Encontra o elemento da conversa na lista
            const $lista = self.ElementsOmniAtendimento.atendimentoUl;
            const $item = $lista.find(`li[data-conversa-id="${conversaId}"]`);

            if ($item.length) {
                let $badge = $item.find('.notificacao-badge');
                let currentCount = 0;
                if ($badge.length === 0) {
                    $badge = $('<span>', {
                        class: 'notificacao-badge badge badge-primary badge-sm indicator-item'
                    });
                }
                let $badgeCount = $item.find('.notificacao-badge-count');
                if ($badgeCount.length === 0) {
                    $badgeCount = $('<span>', {
                        class: 'notificacao-badge-count badge badge-primary badge-sm indicator-item notificacao-badge-count'
                    });
                    const $indicator = $item.find('.indicator');
                    if ($indicator.length) {
                        $indicator.append($badgeCount);
                    }
                } else {
                    // Se já existe, pega o valor atual
                    currentCount = parseInt($badgeCount.text()) || 0;
                }


                const newCount = currentCount + 1;
                conversa.countMsg = newCount;
                $badgeCount.text(newCount);

                $item.addClass('bg-info/10 animate-pulse');
                setTimeout(() => {
                    $item.removeClass('animate-pulse');
                }, 5000);
            }
        },
        adicionarMensagemAoHistorico: function (conversaId, mensagem) {
            // Encontra a conversa no histórico e adiciona a mensagem
            const conversa = this.omniUsuario.atendimentos.find(a =>
                String(a.id) === String(conversaId) || String(a.conversas_id) === String(conversaId)
            );
            if (conversa) {
                if (!Array.isArray(conversa.dados_conversa)) {
                    conversa.dados_conversa = [];
                }
                conversa.dados_conversa.push(mensagem);
            }
        },
        adicionarMensagemNaConversa: function (mensagem) {
            if (!this.atendimentoAtual) return;

            // Inicializa dados_conversa se não existir
            if (!Array.isArray(this.atendimentoAtual.dados_conversa)) {
                this.atendimentoAtual.dados_conversa = [];
            }

            // Adiciona a nova mensagem ao array correto
            this.atendimentoAtual.dados_conversa.push(mensagem);

            // Re-renderiza apenas as mensagens e rola para a última
            this.atualizarMensagensConversa(this.atendimentoAtual.dados_conversa, this.atendimentoAtual.finalizada);
            this.rolarParaUltimaMensagem();
        },
        rolarParaUltimaMensagem: function () {
            setTimeout(() => {
                const container = document.getElementById('omni-conversa-mensagens');
                if (container) {
                    container.scrollTop = container.scrollHeight;
                }
            }, 100);
        },
        disableInputs: function () {
            $("#omni-input-mensagem").prop('disabled', true);
            $("#omni-btn-enviar").prop('disabled', true);
            $("#omni-btn-show-classificar").prop('disabled', true);
        },
        activeInputs: function () {
            $("#omni-input-mensagem").prop('disabled', false);
            $("#omni-btn-enviar").prop('disabled', false);
            $("#omni-btn-show-classificar").prop('disabled', false);
        },
        esconderAtendimentoOmni: function () {
            let self = window.bashAtendimentoOmni;
            self.ElementsOmniAtendimento.atendimentoConversaAberta.addClass('hidden');
        },
        fecharModalArquivo: function () {
            document.getElementById('omniModalArquivo').close();
        },
        abrirModalArquivo: function () {
            document.getElementById('omniModalArquivo').showModal();
            document.getElementById('omni-input-arquivo').value = ''; // Limpa seleção anterior
            document.getElementById('omni-mensagem-arquivo').value = ''; // Limpa mensagem anterior
        },
        abrirModalHistorico: function (conversaId) {
            let self = window.bashAtendimentoOmni;

            // Verificar se há atendimento atual
            if (!self.atendimentoAtual || !self.atendimentoAtual.historico_atendimento) {
                avisos('Erro', 'Nenhum histórico disponível para este atendimento', 'error');
                return;
            }

            // Abrir o modal
            document.getElementById('omniModalHistorico').showModal();

            // Resetar estados
            document.getElementById('omni-historico-loading').classList.remove('hidden');
            document.getElementById('omni-historico-content').classList.add('hidden');
            document.getElementById('omni-historico-erro').classList.add('hidden');

            // Buscar histórico do atendimento atual
            self.renderizarHistorico(self.atendimentoAtual.historico_atendimento);
        },
        fecharModalHistorico: function () {
            document.getElementById('omniModalHistorico').close();
        },
        abrirModalConversaHistorico: async function (atendimentoId) {
            let self = window.bashAtendimentoOmni;
            
            console.log('📖 Abrindo conversa histórica:', atendimentoId);
            
            // Criar modal se não existir
            if (!document.getElementById('omniModalConversaHistorico')) {
                const modalHTML = `
                    <dialog id="omniModalConversaHistorico" class="modal">
                        <div class="modal-box w-11/12 max-w-4xl max-h-[90vh]">
                            <form method="dialog">
                                <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
                            </form>
                            <h3 class="font-bold text-lg mb-4">
                                <i class="fas fa-history mr-2"></i>
                                Conversa Antiga - Protocolo: <span id="conversa-historico-protocolo"></span>
                            </h3>
                            
                            <div id="conversa-historico-loading" class="flex justify-center py-8">
                                <span class="loading loading-spinner loading-lg text-primary"></span>
                            </div>
                            
                            <div id="conversa-historico-content" class="hidden">
                                <div id="conversa-historico-mensagens" class="space-y-2 max-h-[60vh] overflow-y-auto p-4 bg-base-200 rounded-lg">
                                    <!-- Mensagens serão inseridas aqui -->
                                </div>
                            </div>
                            
                            <div id="conversa-historico-erro" class="hidden alert alert-error">
                                <i class="fas fa-exclamation-triangle"></i>
                                <span id="conversa-historico-erro-msg"></span>
                            </div>
                        </div>
                        <form method="dialog" class="modal-backdrop">
                            <button>close</button>
                        </form>
                    </dialog>
                `;
                $('body').append(modalHTML);
            }
            
            // Abrir modal
            document.getElementById('omniModalConversaHistorico').showModal();
            
            // Resetar estados
            document.getElementById('conversa-historico-loading').classList.remove('hidden');
            document.getElementById('conversa-historico-content').classList.add('hidden');
            document.getElementById('conversa-historico-erro').classList.add('hidden');
            document.getElementById('conversa-historico-protocolo').textContent = atendimentoId;
            
            try {
                // Buscar mensagens do atendimento
                console.log('🔍 Buscando mensagens do atendimento:', atendimentoId);
                const response = await reqAsync(
                    `v1/sessao/webbot/atendimento/${atendimentoId}/mensagens`,
                    'GET'
                );
                
                console.log('✅ Mensagens recebidas:', response);
                
                if (response.code === 200 && response.data) {
                    self.renderizarConversaHistorico(response.data);
                } else {
                    throw new Error(response.message || 'Erro ao carregar conversa');
                }
            } catch (error) {
                console.error('❌ Erro ao carregar conversa histórica:', error);
                document.getElementById('conversa-historico-loading').classList.add('hidden');
                document.getElementById('conversa-historico-erro').classList.remove('hidden');
                document.getElementById('conversa-historico-erro-msg').textContent = 
                    error.message || 'Não foi possível carregar a conversa';
            }
        },
        renderizarConversaHistorico: function (mensagens) {
            let self = window.bashAtendimentoOmni;
            
            document.getElementById('conversa-historico-loading').classList.add('hidden');
            document.getElementById('conversa-historico-content').classList.remove('hidden');
            
            const container = document.getElementById('conversa-historico-mensagens');
            
            if (!mensagens || mensagens.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-8 text-base-content/60">
                        <i class="fas fa-inbox text-4xl mb-2"></i>
                        <p>Nenhuma mensagem encontrada nesta conversa</p>
                    </div>
                `;
                return;
            }
            
            // Ordenar mensagens por data
            const mensagensOrdenadas = [...mensagens].sort((a, b) => 
                new Date(a.created_at) - new Date(b.created_at)
            );
            
            container.innerHTML = mensagensOrdenadas.map(msg => {
                const timestamp = msg.created_at ? (() => {
                    const dt = msg.created_at.replace('Z', '').replace('T', ' ').split('.')[0];
                    const [datePart, timePart] = dt.split(' ');
                    const [year, month, day] = datePart.split('-');
                    const [hour, minute] = timePart.split(':');
                    return `${day}/${month}/${year} ${hour}:${minute}`;
                })() : '';

                const tipoMensagemIdRaw = msg.clientes_atendimentos_mensagens_tipo_id ?? msg.tipo_mensagem ?? msg?.mensagem_tipo?.id;
                // null/undefined/0 = sem tipo definido no banco → usar fallback pelo Autor
                const tipoMensagemId = (tipoMensagemIdRaw !== null && tipoMensagemIdRaw !== undefined && Number(tipoMensagemIdRaw) > 0)
                    ? Number(tipoMensagemIdRaw)
                    : null;
                const autor = (msg.usuario_nome || '').toString().trim();
                const autorLower = autor.toLowerCase();
                const semTipo = tipoMensagemId === null;

                const isCliente  = tipoMensagemId === 1 || (semTipo && autor !== '' && autorLower !== 'bot' && autorLower !== 'sistema' && autorLower !== 'ia');
                const isBot      = tipoMensagemId === 2 || (semTipo && (autorLower === 'bot' || autorLower === 'ia'));
                const isOperador = tipoMensagemId === 3;
                const isSistema  = tipoMensagemId === 4 || (semTipo && autorLower === 'sistema');

                let chatClass = 'chat-end';
                let bubbleClass = 'chat-bubble-accent';
                let nome = autor || 'Bot';

                if (isCliente) {
                    chatClass = 'chat-start';
                    bubbleClass = 'chat-bubble-primary';
                    nome = 'Cliente';
                } else if (isOperador) {
                    chatClass = 'chat-end';
                    bubbleClass = 'chat-bubble-secondary';
                    nome = msg.usuario_nome || 'Operador';
                } else if (isSistema) {
                    chatClass = 'chat-end';
                    bubbleClass = 'chat-bubble-warning';
                    nome = 'Sistema';
                } else if (isBot) {
                    chatClass = 'chat-end';
                    bubbleClass = 'chat-bubble-info';
                    nome = 'Bot';
                }
                
                return `
                    <div class="chat ${chatClass}">
                        <div class="chat-header text-xs opacity-70 mb-1">
                            ${nome}
                            <time class="text-xs opacity-50 ml-1">${timestamp}</time>
                        </div>
                        <div class="chat-bubble ${bubbleClass} text-sm">
                            ${self.formatarMensagem(msg)}
                        </div>
                    </div>
                `;
            }).join('');
            
            // Scroll para o fim
            container.scrollTop = container.scrollHeight;
        },
        formatarMensagem: function (msg) {
            if (!msg) return '';

            const escapeHtml = (value) => {
                const el = document.createElement('div');
                el.textContent = value == null ? '' : String(value);
                return el.innerHTML;
            };

            const formatInline = (value) => {
                const safe = escapeHtml(value || '');
                return safe
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
                    .replace(/_(.*?)_/g, '<em>$1</em>');
            };

            let texto = '';
            let payload = null;
            const mensagemRaw = msg.mensagem || '';

            if (typeof mensagemRaw === 'string') {
                try {
                    payload = JSON.parse(mensagemRaw);
                } catch (e) {
                    payload = null;
                }
            } else if (typeof mensagemRaw === 'object') {
                payload = mensagemRaw;
            }

            if (payload && typeof payload === 'object') {
                if (payload.texto) {
                    texto = payload.texto;
                } else if (payload.body) {
                    texto = payload.body;
                } else if (payload.text) {
                    texto = payload.text;
                } else if (payload.message) {
                    texto = payload.message;
                }

                if (payload.header && payload.header.text) {
                    texto = `*${payload.header.text}*\n\n${texto}`.trim();
                }
                if (payload.footer) {
                    texto = `${texto}\n\n_${payload.footer}_`;
                }
            }

            if (!texto) {
                texto = typeof mensagemRaw === 'string' ? mensagemRaw : JSON.stringify(mensagemRaw);
            }

            return formatInline(texto).replace(/\n/g, '<br>');
        },
        renderizarHistorico: function (data) {
            document.getElementById('omni-historico-loading').classList.add('hidden');
            document.getElementById('omni-historico-content').classList.remove('hidden');

            // data é um array de objetos histórico
            const historico = Array.isArray(data) ? data : [];

            // Renderizar informações do cliente (pegar do primeiro item se existir)
            const clienteInfo = document.getElementById('omni-historico-cliente-info');
            const cliente = historico.length > 0 ? historico[0].cliente : {};

            clienteInfo.innerHTML = `
                <div>
                    <span class="font-semibold">Nome:</span>
                    <span>${cliente.nome || 'N/A'}</span>
                </div>
                <div>
                    <span class="font-semibold">Email:</span>
                    <span>${cliente.email || 'N/A'}</span>
                </div>
                <div>
                    <span class="font-semibold">Telefone 1:</span>
                    <span>${cliente.telefone01 || 'N/A'}</span>
                </div>
                <div>
                    <span class="font-semibold">Telefone 2:</span>
                    <span>${cliente.telefone02 || 'N/A'}</span>
                </div>
                <div>
                    <span class="font-semibold">Data Cadastro:</span>
                    <span>${cliente.dt_criado ? (() => {
                        const dt = cliente.dt_criado.replace('Z', '').replace('T', ' ').split('.')[0];
                        const [datePart] = dt.split(' ');
                        const [year, month, day] = datePart.split('-');
                        return `${day}/${month}/${year}`;
                    })() : 'N/A'}</span>
                </div>
                <div>
                    <span class="font-semibold">Último Contato:</span>
                    <span>${cliente.dt_ultimo_contato ? (() => {
                        const dt = cliente.dt_ultimo_contato.replace('Z', '').replace('T', ' ').split('.')[0];
                        const [datePart] = dt.split(' ');
                        const [year, month, day] = datePart.split('-');
                        return `${day}/${month}/${year}`;
                    })() : 'N/A'}</span>
                </div>
            `;

            // Renderizar lista de atendimentos
            const historicoLista = document.getElementById('omni-historico-lista');

            if (historico.length === 0) {
                historicoLista.innerHTML = `
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-inbox text-4xl mb-2"></i>
                        <p>Nenhum atendimento anterior encontrado</p>
                    </div>
                `;
                return;
            }

            historicoLista.innerHTML = historico.map(item => {
                console.log('📋 Renderizando item do histórico:', item.id);
                const dataInicio = item.data_inicio ? (() => {
                    const dt = item.data_inicio.replace('Z', '').replace('T', ' ').split('.')[0];
                    const [datePart, timePart] = dt.split(' ');
                    const [year, month, day] = datePart.split('-');
                    const [hour, minute] = timePart.split(':');
                    return `${day}/${month}/${year} ${hour}:${minute}`;
                })() : 'N/A';
                const dataFim = item.data_fim ? (() => {
                    const dt = item.data_fim.replace('Z', '').replace('T', ' ').split('.')[0];
                    const [datePart, timePart] = dt.split(' ');
                    const [year, month, day] = datePart.split('-');
                    const [hour, minute] = timePart.split(':');
                    return `${day}/${month}/${year} ${hour}:${minute}`;
                })() : 'Em andamento';

                return `
                    <div class="card bg-base-100 shadow-sm ">
                        <div class="card-body p-4">
                            <div class="flex justify-between items-start mb-2">
                                <h5 class="font-semibold">Protocolo: ${item.id}</h5>
                                <span class="badge badge-outline">${item.canal_atendimento?.nome || 'N/A'}</span>
                            </div>
                            
                            <div class="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span class="font-medium">Data Início:</span>
                                    <span>${dataInicio}</span>
                                </div>
                                <div>
                                    <span class="font-medium">Data Fim:</span>
                                    <span>${dataFim}</span>
                                </div>
                                <div>
                                    <span class="font-medium">Atendente:</span>
                                    <span>${item.usuario?.nome || 'N/A'}</span>
                                </div>
                                <div>
                                    <span class="font-medium">Número Entrada:</span>
                                    <span>${item.numero_entrada || 'N/A'}</span>
                                </div>
                            </div>
                            
                            <div class="card-actions justify-end mt-3">
                                <button 
                                    class="btn btn-sm btn-primary gap-2"
                                    onclick="window.bashAtendimentoOmni.abrirModalConversaHistorico(${item.id})">
                                    <i class="fas fa-comments"></i>
                                    Ver Conversa
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        },
        mostrarHistoricoCliente: function () {
            let self = window.bashAtendimentoOmni;

            if (!self.atendimentoAtual) {
                avisos('Erro', 'Nenhuma conversa ativa', 'error');
                return;
            }

            const data = self.atendimentoAtual.historico_atendimento;
            const historico = Array.isArray(data) ? data : [];
            const atendimentoAtualId = Number(self.atendimentoAtual.id);
            const historicoFiltrado = historico.filter(item => Number(item.id) !== atendimentoAtualId);
            const cliente = historico.length > 0 ? historico[0].cliente : {};

            // Container principal com scroll
            const containerHTML = `
                <div class="h-full flex flex-col bg-base-50">
                    <!-- Header com informações do cliente -->
                    <div class="bg-gradient-to-r from-primary/10 to-secondary/10 p-4 border-b border-base-300">
                        <div class="flex items-center gap-3 mb-3">
                            <div class="avatar placeholder">
                                <div class="bg-primary text-primary-content rounded-full w-12 h-12">
                                    <span class="text-lg font-bold">${(cliente.nome || 'C').charAt(0).toUpperCase()}</span>
                                </div>
                            </div>
                            <div>
                                <h3 class="text-lg font-bold text-base-content">${cliente.nome || 'Cliente não identificado'}</h3>
                                <p class="text-sm text-base-content/70">Informações do cliente</p>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div class="flex items-center gap-2">
                                <i class="fas fa-envelope text-primary"></i>
                                <span class="text-base-content/80">Email:</span>
                                <span class="font-medium">${cliente.email || 'Não informado'}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <i class="fas fa-phone text-primary"></i>
                                <span class="text-base-content/80">Telefone:</span>
                                <span class="font-medium">${cliente.telefone01 || 'Não informado'}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <i class="fas fa-calendar-alt text-primary"></i>
                                <span class="text-base-content/80">Cadastro:</span>
                                <span class="font-medium">${cliente.dt_criado ? (() => {
                                    const dt = cliente.dt_criado.replace('Z', '').replace('T', ' ').split('.')[0];
                                    const [datePart] = dt.split(' ');
                                    const [year, month, day] = datePart.split('-');
                                    return `${day}/${month}/${year}`;
                                })() : 'N/A'}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <i class="fas fa-clock text-primary"></i>
                                <span class="text-base-content/80">Último contato:</span>
                                <span class="font-medium">${cliente.dt_ultimo_contato ? (() => {
                                    const dt = cliente.dt_ultimo_contato.replace('Z', '').replace('T', ' ').split('.')[0];
                                    const [datePart] = dt.split(' ');
                                    const [year, month, day] = datePart.split('-');
                                    return `${day}/${month}/${year}`;
                                })() : 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Lista de atendimentos -->
                    <div class="flex-1 overflow-y-auto p-4">
                        <div class="flex items-center gap-2 mb-4">
                            <i class="fas fa-history text-primary"></i>
                            <h4 class="font-semibold text-base-content">Histórico de Atendimentos</h4>
                            <span class="badge badge-primary badge-sm">${historicoFiltrado.length}</span>
                        </div>
                        
                        <div id="omni-historico-lista-content" class="space-y-3">
                            ${this.renderHistoricoItems(historicoFiltrado)}
                        </div>
                    </div>
                </div>
            `;

            // Limpa e adiciona o novo conteúdo
            self.ElementsOmniAtendimento.afTabHistoricoCliente.html(containerHTML);
        },

        renderHistoricoItems: function(historico) {
            if (historico.length === 0) {
                return `
                    <div class="flex flex-col items-center justify-center py-12 text-base-content/60">
                        <i class="fas fa-inbox text-4xl mb-3 text-base-content/40"></i>
                        <h5 class="font-medium text-lg mb-1">Nenhum histórico encontrado</h5>
                        <p class="text-sm">Este cliente ainda não possui atendimentos anteriores</p>
                    </div>
                `;
            }

            return historico.map((item, index) => {
                const dataInicio = item.data_inicio ? (() => {
                    const dt = item.data_inicio.replace('Z', '').replace('T', ' ').split('.')[0];
                    const [datePart, timePart] = dt.split(' ');
                    const [year, month, day] = datePart.split('-');
                    const [hour, minute] = timePart.split(':');
                    return `${day}/${month}/${year} às ${hour}:${minute}`;
                })() : 'N/A';
                
                const dataFim = item.data_fim ? (() => {
                    const dt = item.data_fim.replace('Z', '').replace('T', ' ').split('.')[0];
                    const [datePart, timePart] = dt.split(' ');
                    const [year, month, day] = datePart.split('-');
                    const [hour, minute] = timePart.split(':');
                    return `${day}/${month}/${year} às ${hour}:${minute}`;
                })() : 'Em andamento';

                const isActive = !item.data_fim;
                const cardClass = isActive ? 'border-success bg-success/5' : 'border-base-300 bg-base-100';
                const statusIcon = isActive ? 'fa-circle text-success' : 'fa-check-circle text-base-content/60';
                const statusText = isActive ? 'Em andamento' : 'Finalizado';

                return `
                    <div class="card ${cardClass} border shadow-sm hover:shadow-md transition-shadow">
                        <div class="card-body p-4">
                            <!-- Header do card -->
                            <div class="flex justify-between items-start mb-3">
                                <div class="flex items-center gap-2">
                                    <i class="fas ${statusIcon} text-sm"></i>
                                    <h5 class="font-semibold text-base-content">Protocolo #${item.id}</h5>
                                </div>
                                <div class="flex flex-col items-end gap-1">
                                    <span class="badge ${isActive ? 'badge-success' : 'badge-outline'} badge-sm">
                                        ${statusText}
                                    </span>
                                    <span class="text-xs text-base-content/60">
                                        ${item.canal_atendimento?.nome || 'Canal não especificado'}
                                    </span>
                                </div>
                            </div>
                            
                            <!-- Informações do atendimento -->
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                <div class="flex items-start gap-2">
                                    <i class="fas fa-play text-success text-xs mt-1"></i>
                                    <div>
                                        <span class="text-base-content/70 block">Iniciado em:</span>
                                        <span class="font-medium text-base-content">${dataInicio}</span>
                                    </div>
                                </div>
                                
                                <div class="flex items-start gap-2">
                                    <i class="fas ${isActive ? 'fa-hourglass-half text-warning' : 'fa-stop text-base-content/60'} text-xs mt-1"></i>
                                    <div>
                                        <span class="text-base-content/70 block">${isActive ? 'Status:' : 'Finalizado em:'}</span>
                                        <span class="font-medium text-base-content">${dataFim}</span>
                                    </div>
                                </div>
                                
                                <div class="flex items-start gap-2">
                                    <i class="fas fa-user text-primary text-xs mt-1"></i>
                                    <div>
                                        <span class="text-base-content/70 block">Atendente:</span>
                                        <span class="font-medium text-base-content">${item.usuario?.nome || 'Sistema'}</span>
                                    </div>
                                </div>
                                
                                <div class="flex items-start gap-2">
                                    <i class="fas fa-hashtag text-info text-xs mt-1"></i>
                                    <div>
                                        <span class="text-base-content/70 block">Número de entrada:</span>
                                        <span class="font-medium text-base-content">${item.numero_entrada || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Botão Ver Conversa -->
                            <div class="card-actions justify-end mt-3 pt-3 border-t border-base-300">
                                <button 
                                    class="btn btn-sm btn-primary gap-2"
                                    onclick="window.bashAtendimentoOmni.abrirModalConversaHistorico(${item.id})">
                                    <i class="fas fa-comments"></i>
                                    Ver Conversa
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        },
        mostrarClassificacao: function () {
            let self = window.bashAtendimentoOmni;

            if (!self.atendimentoAtual) {
                avisos('Erro', 'Nenhuma conversa ativa', 'error');
                return;
            }

            // Se não tem classificação configurada, mostrar apenas botão de finalizar
            if (!self.atendimentoAtual.classificacao || !self.atendimentoAtual.classificacao.classificador) {
                const simplesHTML = `
                    <div class="h-full flex flex-col bg-gradient-to-br from-base-100 to-base-200 min-h-[76vh] max-h-[76vh]">
                        <!-- Header elegante -->
                        <div class="bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/10 p-6 border-b border-base-300 flex-shrink-0">
                            <div class="flex items-center gap-3 mb-2">
                                <div class="bg-primary/20 p-3 rounded-full">
                                    <i class="fas fa-flag-checkered text-primary text-xl"></i>
                                </div>
                                <div>
                                    <h3 class="font-bold text-xl text-base-content">Classificação do Atendimento</h3>
                                    <p class="text-sm text-base-content/70 mt-1">Confirme a finalização do atendimento</p>
                                </div>
                            </div>
                            
                            <!-- Info do cliente atual -->
                            <div class="flex items-center gap-2 mt-3 text-sm">
                                <i class="fas fa-user text-info"></i>
                                <span class="text-base-content/80">Cliente:</span>
                                <span class="font-medium text-base-content">${self.atendimentoAtual.clientes?.nome || 'Cliente não identificado'}</span>
                                <div class="badge badge-info badge-sm ml-2"># ${self.atendimentoAtual.id}</div>
                            </div>
                        </div>
                        
                        <!-- Conteúdo central -->
                        <div class="flex-1 flex flex-col items-center justify-center px-6 py-8">
                            <div class="text-center mb-8">
                                <i class="fas fa-check-circle text-6xl text-success mb-4"></i>
                                <p class="text-lg text-base-content/80">Deseja finalizar este atendimento?</p>
                            </div>
                        </div>
                        
                        <!-- Footer com ação -->
                        <div class="bg-base-100 border-t border-base-300 p-6 flex-shrink-0">
                            <button class="btn btn-primary btn-lg w-full group hover:scale-105 transition-all duration-200 shadow-lg" 
                                    onclick="window.bashAtendimentoOmni.enviarClassificacao()">
                                <i class="fa-solid fa-flag-checkered mr-2 group-hover:animate-bounce"></i>
                                <span>Enviar Classificação</span>
                            </button>
                        </div>
                    </div>
                `;
                self.ElementsOmniAtendimento.afTabClassificacao.html(simplesHTML);
                self.ElementsOmniAtendimento.afTabClassificacao.removeClass('hidden');
                return;
            }

            // Criar HTML do formulário de classificação para a div com design moderno
            const classificacaoHTML = `
                <div class="h-full flex flex-col bg-gradient-to-br from-base-100 to-base-200 min-h-[76vh] max-h-[76vh]">
                    <!-- Header elegante -->
                    <div class="bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/10 p-6 border-b border-base-300 flex-shrink-0">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="bg-primary/20 p-3 rounded-full">
                                <i class="fas fa-clipboard-check text-primary text-xl"></i>
                            </div>
                            <div>
                                <h3 class="font-bold text-xl text-base-content">Classificação do Atendimento</h3>
                                <p class="text-sm text-base-content/70 mt-1">Complete as informações abaixo para finalizar o atendimento</p>
                            </div>
                        </div>
                        
                        <!-- Info do cliente atual -->
                        <div class="flex items-center gap-2 mt-3 text-sm">
                            <i class="fas fa-user text-info"></i>
                            <span class="text-base-content/80">Cliente:</span>
                            <span class="font-medium text-base-content">${self.atendimentoAtual.clientes?.nome || 'Cliente não identificado'}</span>
                            <div class="badge badge-info badge-sm ml-2"># ${self.atendimentoAtual.id}</div>
                        </div>
                    </div>
                    
                    <!-- Container de formulário com scroll -->
                    <div class="flex-1 overflow-y-auto px-6 py-4">
                        <div id="classificador-opcoes" class="space-y-6">
                            <!-- Opções serão preenchidas dinamicamente -->
                        </div>
                    </div>
                    
                    <!-- Footer com ações -->
                    <div class="bg-base-100 border-t border-base-300 p-6 flex-shrink-0">
                        <div class="flex flex-col sm:flex-row gap-3">
                            <button class="btn btn-outline btn-lg flex-1 group hover:scale-105 transition-all duration-200" 
                                    onclick="window.bashAtendimentoOmni.limparClassificacao()">
                                <i class="fa-solid fa-eraser mr-2 group-hover:animate-pulse"></i>
                                <span>Limpar Formulário</span>
                            </button>
                            <button class="btn btn-primary btn-lg flex-1 group hover:scale-105 transition-all duration-200 shadow-lg" 
                                    onclick="window.bashAtendimentoOmni.enviarClassificacao()">
                                <i class="fa-solid fa-flag-checkered mr-2 group-hover:animate-bounce"></i>
                                <span>Enviar Classificação</span>
                            </button>
                        </div>
                        
                        <!-- Nota informativa -->
                        <div class="mt-4 text-center">
                            <p class="text-xs text-base-content/60">
                                <i class="fas fa-info-circle mr-1"></i>
                                Certifique-se de preencher todos os campos obrigatórios antes de finalizar
                            </p>
                        </div>
                    </div>
                </div>
            `;

            // Inserir HTML na div de classificação
            self.ElementsOmniAtendimento.afTabClassificacao.html(classificacaoHTML);

            // Preencher as opções de classificação
            const $opcoesContainer = $('#classificador-opcoes');
            $opcoesContainer.empty();

            const classificacao = self.atendimentoAtual.classificacao;
            const classificador = parseJSONString(classificacao.classificador);

            if (!classificador || classificador.length === 0) {
                // Fallback caso o classificador seja inválido
                $opcoesContainer.html('<div class="text-center text-base-content/60 py-8"><i class="fas fa-info-circle mr-2"></i>Nenhuma pergunta de classificação configurada</div>');
                return;
            }

            // Itera sobre as perguntas do classificador com visual aprimorado
            classificador.forEach((pergunta, indexPergunta) => {
                // Cria um container elegante para cada pergunta
                const perguntaContainer = $(`
                    <div class="pergunta-classificacao bg-base-100 rounded-xl p-6 shadow-sm border border-base-300 hover:shadow-md transition-shadow duration-300">
                        <div class="flex items-start gap-3 mb-4">
                            <div class="bg-primary/10 p-2 rounded-lg flex-shrink-0">
                                <i class="fas fa-question-circle text-primary"></i>
                            </div>
                            <div class="flex-1">
                                <h4 class="font-semibold text-base-content text-lg leading-tight">${pergunta.pergunta}</h4>
                                ${pergunta.obrigatorio ? 
                                    '<div class="flex items-center gap-2 mt-1"><span class="badge badge-error badge-xs">Obrigatório</span></div>' : 
                                    '<div class="flex items-center gap-2 mt-1"><span class="badge badge-outline badge-xs">Opcional</span></div>'
                                }
                            </div>
                        </div>
                        <div class="opcoes-pergunta-${indexPergunta} space-y-3"></div>
                    </div>
                `);

                const opcoesContainer = perguntaContainer.find(`.opcoes-pergunta-${indexPergunta}`);

                // Verifica o tipo da pergunta e aplica estilos modernos
                if (pergunta.tipo === 'selecao' && pergunta.opcoes) {
                    // Para tipo seleção (radio buttons) com cards
                    pergunta.opcoes.forEach((opcao, indexOpcao) => {
                        opcoesContainer.append(`
                            <label class="cursor-pointer block group">
                                <div class="flex items-center gap-3 p-4 rounded-lg border border-base-300 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 group-hover:shadow-sm">
                                    <input type="radio" 
                                           name="classificador-pergunta-${indexPergunta}" 
                                           value="${opcao.valor}" 
                                           data-pergunta="${pergunta.pergunta}"
                                           data-tipo="${pergunta.tipo}"
                                           class="radio radio-primary radio-sm opcao-classificacao">
                                    <div class="flex-1">
                                        <span class="text-base-content font-medium group-hover:text-primary transition-colors duration-200">${opcao.text}</span>
                                    </div>
                                    <i class="fas fa-chevron-right text-base-content/30 group-hover:text-primary/70 transition-colors duration-200"></i>
                                </div>
                            </label>
                        `);
                    });
                } else if (pergunta.tipo === 'textarea') {
                    // Para tipo textarea com design aprimorado
                    opcoesContainer.append(`
                        <div class="form-control">
                            <textarea 
                                name="classificador-pergunta-${indexPergunta}"
                                data-pergunta="${pergunta.pergunta}"
                                data-tipo="${pergunta.tipo}"
                                placeholder="${pergunta.textoArea || 'Digite sua resposta detalhada aqui...'}"
                                class="textarea textarea-bordered textarea-lg w-full h-32 opcao-classificacao-textarea resize-none focus:textarea-primary transition-all duration-200"
                                ${pergunta.obrigatorio ? 'required' : ''}
                            ></textarea>
                            <div class="label">
                                <span class="label-text-alt text-base-content/60">
                                    <i class="fas fa-edit mr-1"></i>
                                    Use este espaço para fornecer informações detalhadas
                                </span>
                            </div>
                        </div>
                    `);
                }

                $opcoesContainer.append(perguntaContainer);
            });
        },
        abrirClassificador: function (conversaId) {
            let self = window.bashAtendimentoOmni;

            // Encontrar a conversa atual
            self.atendimentoAtual = self.omniUsuario.atendimentos.find(a => a.id == conversaId);
            if (!self.atendimentoAtual) {
                avisos('Erro', 'Conversa não encontrada', 'error');
                return;
            }

            // Criar o modal
            const modalHTML = `
                <dialog id="classificadorModal" class="modal modal-bottom sm:modal-middle">
                    <div class="modal-box max-w-2xl">
                        <h3 class="font-bold text-lg">Classificação do Atendimento</h3>
                        <div class="py-4">
                            <div class="form-control">
                                <label class="label">
                                    <span class="label-text">Classificação do Atendimento</span>
                                </label>
                                <div id="classificador-opcoes" class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                    <!-- Opções serão preenchidas dinamicamente -->
                                </div>
                            </div>
                        </div>
                        <div class="modal-action">
                            <button class="btn" onclick="window.bashAtendimentoOmni.fecharClassificador()">Cancelar</button>
                            <button class="btn btn-primary" onclick="window.bashAtendimentoOmni.enviarClassificacao()">Enviar Classificação</button>
                        </div>
                    </div>
                    <form method="dialog" class="modal-backdrop">
                        <button>close</button>
                    </form>
                </dialog>
            `;

            // Adicionar ao DOM
            if ($('#classificadorModal').length) {
                $('#classificadorModal').remove();
            }
            $('body').append(modalHTML);

            // Preencher as opções de classificação
            const $opcoesContainer = $('#classificador-opcoes');
            $opcoesContainer.empty();
            //!self.atendimentoAtual.classificacao || self.atendimentoAtual.classificacao.length === 0 && 
            if (false) {
                avisos('Erro', 'Nenhuma opção de classificação disponível', 'error');
            } else {
                // Pega o primeiro item da array de classificação (se houver múltiplas)
                // const classificacao = self.atendimentoAtual.classificacao[0];

                const classificacao = self.omniUsuario.classificacao[0];


                if (!classificacao.classificador || classificacao.classificador.length === 0) {
                    avisos('Erro', 'Nenhuma pergunta de classificação disponível', 'error');
                    return;
                }

                // Itera sobre as perguntas do classificador
                classificacao.classificador.forEach((pergunta, indexPergunta) => {
                    // Cria um container para cada pergunta
                    const perguntaContainer = $(`
                        <div class="pergunta-classificacao mb-4 p-4">
                            <h3 class="font-semibold mb-2">${pergunta.pergunta}</h3>
                            <div class="opcoes-pergunta-${indexPergunta}"></div>
                        </div>
                    `);

                    // Adiciona indicação de obrigatório
                    if (pergunta.obrigatorio) {
                        perguntaContainer.find('h3').append('<span class="text-red-500 ml-1">*</span>');
                    }

                    const opcoesContainer = perguntaContainer.find(`.opcoes-pergunta-${indexPergunta}`);

                    // Verifica o tipo da pergunta
                    if (pergunta.tipo === 'selecao' && pergunta.opcoes) {
                        // Para tipo seleção (radio buttons)
                        pergunta.opcoes.forEach((opcao, indexOpcao) => {
                            opcoesContainer.append(`
                                <label class="cursor-pointer label justify-start gap-2 mb-2">
                                    <input type="radio" 
                                           name="classificador-pergunta-${indexPergunta}" 
                                           value="${opcao.valor}" 
                                           data-pergunta="${pergunta.pergunta}"
                                           data-tipo="${pergunta.tipo}"
                                           class="radio radio-primary opcao-classificacao">
                                    <span class="label-text">${opcao.text}</span>
                                </label>
                            `);
                        });
                    } else if (pergunta.tipo === 'textarea') {
                        // Para tipo textarea
                        opcoesContainer.append(`
                            <textarea 
                                name="classificador-pergunta-${indexPergunta}"
                                data-pergunta="${pergunta.pergunta}"
                                data-tipo="${pergunta.tipo}"
                                placeholder="${pergunta.textoArea || 'Digite sua resposta...'}"
                                class="textarea textarea-bordered w-full h-24 opcao-classificacao-textarea"
                                ${pergunta.obrigatorio ? 'required' : ''}
                            ></textarea>
                        `);
                    }

                    $opcoesContainer.append(perguntaContainer);
                });
            }
            // Mostrar o modal
            document.getElementById('classificadorModal').showModal();
        },
        fecharClassificador: function () {
            const modal = document.getElementById('classificadorModal');
            if (modal) {
                modal.close();
                modal.remove();
            }
        },
        limparClassificacao: function () {
            let self = window.bashAtendimentoOmni;

            // Adicionar feedback visual antes de limpar
            const perguntas = document.querySelectorAll('.pergunta-classificacao');
            
            // Animação visual de limpeza
            perguntas.forEach((pergunta, index) => {
                setTimeout(() => {
                    pergunta.style.transform = 'scale(0.98)';
                    pergunta.style.opacity = '0.7';
                    
                    setTimeout(() => {
                        // Limpa radio buttons
                        const radios = pergunta.querySelectorAll('input[type="radio"]');
                        radios.forEach(radio => {
                            if (radio.checked) {
                                radio.closest('label').querySelector('div').classList.add('animate-pulse');
                            }
                            radio.checked = false;
                        });

                        // Limpa textareas
                        const textareas = pergunta.querySelectorAll('textarea');
                        textareas.forEach(textarea => {
                            if (textarea.value) {
                                textarea.classList.add('animate-pulse');
                            }
                            textarea.value = '';
                        });

                        // Restaura visual normal
                        setTimeout(() => {
                            pergunta.style.transform = '';
                            pergunta.style.opacity = '';
                            
                            // Remove animações
                            pergunta.querySelectorAll('.animate-pulse').forEach(el => {
                                el.classList.remove('animate-pulse');
                            });
                        }, 200);
                    }, 100);
                }, index * 50); // Animação em cascata
            });

            // Feedback para o usuário
            avisos('Formulário', 'Todas as respostas foram removidas', 'info');
            console.log('🧹 Formulário de classificação limpo com feedback visual');
        },

        enviarClassificacao: function () {
            let self = window.bashAtendimentoOmni;

            // Coletar e validar todas as respostas
            const { valido, respostas, mensagemErro } = this.coletarEValidarRespostas();

            if (!valido) {
                avisos('Atenção', mensagemErro, 'warning');
                return;
            }

            // Obter os dados necessários
            const conversaId = self.atendimentoAtual.id;
            // Criar o objeto para enviar - ajuste conforme a estrutura que seu backend espera

            let eventos = parseJSONString(self.atendimentoAtual.eventos);
            console.log("eventos", eventos);

            eventos.classificacao = respostas;
            eventos.tipo_conversa = "Ativo";
            eventos.data_fim = new Date().toISOString();

            const msgData = {
                Funcao: 'closeTask',
                WsConn: self.wsConnId,
                AuthID: getUserSession().id.toString(),
                ConversasId: conversaId.toString(),
                ClassificacaoRespostas: respostas,
                Eventos: eventos,
                TipoAtendimentos: respostas.length > 0
                    ? respostas.map(resp => ({
                        descricao: resp.textoResposta || resp.resposta,
                        id: resp.resposta,
                        texto: resp.textoResposta || resp.resposta,
                        pergunta: resp.pergunta
                    }))
                    : []
            };

            // Verificar conexão WebSocket
            if (!self.omniWs || self.omniWs.readyState !== WebSocket.OPEN) {
                avisos('Erro', 'Conexão não está ativa', 'error');
                return;
            }

            // Prevenir dupla finalização
            if (self.atendimentoAtual && self.atendimentoAtual._encerrando) {
                avisos('Aguarde', 'Encerramento já em andamento...', 'warning');
                return;
            }
            if (self.atendimentoAtual) {
                self.atendimentoAtual._encerrando = true;
            }

            // Enviar via WebSocket
            try {
                self.omniWs.send(JSON.stringify(msgData));
                avisos('Aguarde', 'Encerrando atendimento...', 'info');

                // Limpar a div após envio
                self.ElementsOmniAtendimento.afTabClassificacao.html(`
                    <div class="p-4 text-center">
                        <div class="alert alert-success">
                            <i class="fa-solid fa-check-circle"></i>
                            <span>Classificação enviada com sucesso!</span>
                        </div>
                    </div>
                `);
                setTimeout(() => {
                    self.ElementsOmniAtendimento.afTabClassificacao.empty();
                }, 1500);
            } catch (error) {
                console.error('Erro ao enviar classificação:', error);
                avisos('Erro', 'Falha ao enviar classificação', 'error');
            }
        },
        
        // Nova função para coletar e validar respostas
        coletarEValidarRespostas: function () {
            const respostas = [];
            let primeiraPerguntaObrigatoriaNaoRespondida = null;

            // Encontra todas as perguntas
            const perguntas = $('.pergunta-classificacao');

            perguntas.each(function () {
                const perguntaText = $(this).find('h4').text().trim();
                const perguntaElement = $(this).find('[data-pergunta]').first();
                const tipo = perguntaElement.data('tipo');
                const obrigatorio = $(this).find('.badge-error').length > 0;

                let resposta = null;
                let respondido = false;

                if (tipo === 'selecao') {
                    const opcaoSelecionada = $(this).find('input[type="radio"]:checked');
                    if (opcaoSelecionada.length > 0) {
                        respondido = true;
                        resposta = {
                            pergunta: perguntaText,
                            tipo: tipo,
                            resposta: opcaoSelecionada.val(),
                            textoResposta: opcaoSelecionada.siblings('.label-text').length > 0 
                                ? opcaoSelecionada.siblings('.label-text').text() 
                                : opcaoSelecionada.closest('label').find('span').first().text()
                        };
                    }
                } else if (tipo === 'textarea') {
                    const textarea = $(this).find('textarea');
                    const valor = textarea.val().trim();
                    if (valor) {
                        respondido = true;
                        resposta = {
                            pergunta: perguntaText,
                            tipo: tipo,
                            resposta: valor
                        };
                    }
                }

                // Validação de campo obrigatório
                if (obrigatorio && !respondido) {
                    if (!primeiraPerguntaObrigatoriaNaoRespondida) {
                        primeiraPerguntaObrigatoriaNaoRespondida = perguntaText;
                    }
                }

                if (resposta) {
                    respostas.push(resposta);
                }
            });

            // Retorna o resultado da validação
            if (primeiraPerguntaObrigatoriaNaoRespondida) {
                return {
                    valido: false,
                    respostas: [],
                    mensagemErro: `A pergunta "${primeiraPerguntaObrigatoriaNaoRespondida}" é obrigatória`
                };
            }

            return {
                valido: true,
                respostas: respostas,
                mensagemErro: null
            };
        },
        // --------- timers ---------
        omniIniciarContadorTempo: function () {
            if (!window.bashAtendimento.ramalStatusAtual.tempoAtt) return;

            // Seleciona todos os elementos com a classe desejada
            const elementosContador = document.getElementsByClassName('atendimento-omni-tempo');
            if (!elementosContador || elementosContador.length === 0) return;

            // Função para atualizar todos os contadores
            const atualizarContadores = () => {
                const tempoFormatado = this.formatTempoAtt(window.bashAtendimento.ramalStatusAtual.tempoAtt);
                // Atualiza todos os elementos com a classe
                Array.from(elementosContador).forEach(elemento => {
                    elemento.textContent = manipula(tempoFormatado);
                });
            };

            // Atualiza imediatamente
            atualizarContadores();

            // Configura a atualização a cada segundo
            this.intervaloContador = setInterval(atualizarContadores, 1000);
        },
        omniLimparContador: function () {
            if (this.intervaloContador) {
                clearInterval(this.intervaloContador);
                this.intervaloContador = null;
            }
        },
        timerManager: {
            timerElements: [],
            interval: null,

            init: function () {
                this.stop();
                this.interval = setInterval(() => this.updateAllTimers(), 1000);
                this.scanAndInitTimers();
            },

            stop: function () {
                if (this.interval) {
                    clearInterval(this.interval);
                    this.interval = null;
                }
            },

            scanAndInitTimers: function () {
                this.timerElements = [];
                const elements = document.querySelectorAll('[data-timer]');

                elements.forEach(element => {
                    const startTime = element.getAttribute('data-timer');
                    if (startTime) {
                        const startDate = new Date(startTime);

                        if (!isNaN(startDate.getTime())) {
                            this.timerElements.push({
                                element: element,
                                start: startDate
                            });
                            this.updateTimer(element, startDate);
                        }
                    }
                });
            },

            updateAllTimers: function () {
                const now = new Date();
                this.timerElements.forEach(timer => {
                    this.updateTimer(timer.element, timer.start, now);
                });
            },
            updateTimer: function (element, startDate, currentDate = new Date()) {
                const diff = Math.floor((currentDate - startDate) / 1000);
                const hours = Math.floor(diff / 3600);
                const minutes = Math.floor((diff % 3600) / 60);
                const seconds = diff % 60;
                let timeString;
                if (!element.classList.contains('atendimento-omni-tempo') && !element.classList.contains('tempo-pausa-omni')) {
                    timeString = `TA: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                } else {
                    timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }
                element.textContent = timeString;
                element.setAttribute('data-hours', hours);
                element.setAttribute('data-minutes', minutes);
                element.setAttribute('data-seconds', seconds);
            }
        },
        startTimer: function () {
            window.bashAtendimentoOmni.timerManager.init();
        },
        stopTimer: function () {
            const tm = window.bashAtendimentoOmni.timerManager;
            if (tm.interval) {
                clearInterval(tm.interval);
                tm.interval = null;
            }
            tm.timerElements = [];
        },
        
        // ================================================================
        // FINALIZAR CONVERSA
        // ================================================================
        finalizarConversa: function(conversaId, clienteId) {
            const self = window.bashAtendimentoOmni;
            
            // Modal de confirmação
            abrirModalConfirmacao({
                titulo: 'Finalizar Conversa',
                mensagem: 'Deseja realmente finalizar esta conversa?',
                labelConfirmar: 'Finalizar',
                labelCancelar: 'Cancelar',
                tipo: 'error',
                onConfirm: async () => {
                    const payload = {
                        conversa_id: parseInt(conversaId),
                        cliente_id: parseInt(clienteId),
                        motivo: "Finalizado pelo operador"
                    };
                    
                    try {
                        const data = await fetchAsync('open/integracao/conversa/atendimento/finalizar', 'POST', payload);
                        
                        if (data.code === 200) {
                            avisos('Sucesso', 'Conversa finalizada com sucesso', 'success');
                            
                            // Remover do array de atendimentos
                            self.omniUsuario.atendimentos = self.omniUsuario.atendimentos.filter(
                                atendimento => atendimento.id != conversaId
                            );
                            
                            // Limpar atendimento atual se for o mesmo
                            if (self.atendimentoAtual && self.atendimentoAtual.id == conversaId) {
                                self.limparEstadoInicial();
                            }
                            
                            // Re-renderizar a lista de atendimentos
                            self.renderOmniAtendimentos();
                        } else {
                            avisos('Erro', data.message || 'Erro ao finalizar conversa', 'error');
                        }
                    } catch (error) {
                        console.error('Erro ao finalizar conversa:', error);
                        avisos('Erro', error.message || 'Erro ao finalizar conversa', 'error');
                    }
                }
            });
        }
    }
}

// ================================================================
// INICIALIZAÇÃO AUTOMÁTICA
// ================================================================
// Quando a página termina de carregar, inicializa o sistema omnichannel
$(document).ready(function () {
    window.bashAtendimentoOmni.init();
});

/* ================================================================
 * RESUMO DA ARQUITETURA DO OMNI.JS
 * ================================================================
 * 
 * Este arquivo implementa um sistema completo de atendimento omnichannel
 * que gerencia comunicação em tempo real via WebSocket com múltiplos canais:
 * 
 * PRINCIPAIS COMPONENTES:
 * 
 * 1. GERENCIAMENTO DE CONEXÃO WEBSOCKET
 *    - Conexão automática com retry
 *    - Sistema de ping/pong para manter conexão viva
 *    - Tratamento de reconexões e erros
 * 
 * 2. INTERFACE DE ATENDIMENTO  
 *    - Lista de conversas ativas (WhatsApp, Chat, Email)
 *    - Interface de chat em tempo real
 *    - Sistema de notificações browser
 * 
 * 3. SISTEMA DE STATUS
 *    - Disponível/Pausa/Deslogue
 *    - Timers em tempo real
 *    - Gerenciamento de pausas programadas
 * 
 * 4. ENVIO DE MENSAGENS
 *    - Mensagens de texto
 *    - Envio de arquivos (Base64)
 *    - Atalhos de mensagens rápidas
 * 
 * 5. INTEGRAÇÃO COM OUTROS SISTEMAS
 *    - Sistema telefônico (PABX)
 *    - Sistema de tickets (FlowHub)
 *    - Autenticação e sessões
 * 
 * FLUXO PRINCIPAL:
 * 1. init() -> Inicializa interface
 * 2. omniWsConnect() -> Conecta WebSocket
 * 3. Usuario recebe conversas via WebSocket
 * 4. renderOmniShowConversa() -> Abre conversa específica
 * 5. enviarMensagem() -> Envia respostas ao cliente
 * 6. Sistema mantém sincronização em tempo real
 * 
 * ================================================================ */