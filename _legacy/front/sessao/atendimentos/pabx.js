/*
 * Novo módulo PABX (SIP/WebSocket only)
 * - Registro SIP via JsSIP
 * - Controle de ligação e áudio
 * - Status/Pausa/Deslogar via SIP MESSAGE (Asterisk dialplan cmd-router)
 * - Autoatendimento opcional (bl_auto_att)
 * - Transferência para Pesquisa (x-bash: Pesquisa)
 * - Notificações via avisos()
 */

(function () {
    if (typeof window.bashAtendimento !== 'undefined') {
        try {
            window.bashAtendimento.destroy && window.bashAtendimento.destroy();
        } catch (e) { console.error(e); }
    }

    window.bashAtendimento = {
        // estado
        token: '',
        ramais: {},
        ramalConnect: {},
        ua: null,
        session: null,
        AudioDiv: $('#remoteAudio'),
        AudioMute: false,
        GlobStream: null,
        StreamLocal: null,
        ringbackTone: null,
        ramalStatusAtual: { status: 308, text: 'Deslogado' },
        pendingAction: null,
        LastProtocolo: null,

        // templates de botões
        buttonTemplates: {
            emCurso: `
            <div class="grid grid-cols-5 gap-3 p-2 mt-2">
                <div class="flex flex-col items-center">
                    <button id="atendimento-btn-desligar" class="btn btn-circle btn-error p-3 mb-1">
                        <i class="fa-solid fa-phone-slash rotate-[135deg] text-lg"></i>
                    </button>
                    <span class="text-xs">Desligar</span>
                </div>
                <div class="flex flex-col items-center">
                    <button id="atendimento-btn-hold" class="btn btn-circle btn-ghost p-3 mb-1" disabled>
                        <i class="fa-solid fa-pause text-lg"></i>
                    </button>
                    <span class="text-xs">Espera</span>
                </div>
                <div class="flex flex-col items-center">
                    <button id="atendimento-btn-mute" class="btn btn-ghost btn-circle p-3 mb-1">
                        <i class="fa-solid fa-microphone text-lg"></i>
                    </button>
                    <span class="text-xs">Mutar</span>
                </div>
                <div class="flex flex-col items-center">
                    <button id="atendimento-btn-numpad" class="btn btn-circle btn-ghost p-3 mb-1">
                        <i class="fa-solid fa-keyboard text-lg"></i>
                    </button>
                    <span class="text-xs">Teclado</span>
                </div>
                <div class="flex flex-col items-center">
                    <button id="atendimento-btn-more" class="btn btn-circle btn-ghost p-3 mb-1">
                        <i class="fa-solid fa-ellipsis text-lg"></i>
                    </button>
                    <span class="text-xs">Mais</span>
                </div>
            </div>`,
            chamadaEntrando: `
            <div class="grid grid-cols-2 gap-3 p-2 mt-2 justify-center">
                <div class="flex flex-col items-center">
                    <button id="atendimento-btn-atender" class="btn btn-circle btn-success p-3 mb-1">
                        <i class="fa-solid fa-phone text-lg"></i>
                    </button>
                    <span class="text-xs">Atender</span>
                </div>
                <div class="flex flex-col items-center">
                    <button id="atendimento-btn-rejeitar" class="btn btn-circle btn-error p-3 mb-1">
                        <i class="fa-solid fa-phone-slash text-lg"></i>
                    </button>
                    <span class="text-xs">Rejeitar</span>
                </div>
            </div>`,
            disponivel: `   
             <div class="grid grid-cols-2 gap-3 p-2 mt-2 justify-center">
                <div class="flex items-center gap-2 mb-2">
                    <input id="atendimento-input-numero" type="text" placeholder="Número para discar" class="input input-bordered flex-1">
                </div>
                <div class="grid grid-cols-1 gap-3 justify-center">
                    <div class="flex flex-col items-center">
                        <button id="atendimento-btn-ligar" class="btn btn-circle btn-success p-3 mb-1 w-full">
                            <i class="fa-solid fa-phone text-lg"></i>
                            <span class="ml-2">Discar</span>
                        </button>
                    </div>
                </div>
            </div>`,
        },

        init: function () {
            this.token = localStorage.getItem('token') || '';
            this.pendingAction = null;
            this.getRamailList();
            this.setupEventListenersPabx();
            this.renderElementsRamalAtendimento();
            this.renderBtnAttendimento();
            this.permissaoAudio();
            this.initRingbackTone();
        },

        // UI refs
        renderElementsRamalAtendimento: function () {
            this.ElementsRamalAtendimento = {
                status: $('#atendimento-status-select'),
                statusAtual: $('#atendimento-status-container'),
                statusBadge: $('#atendimento-status-badge'),
                statusRamal: $('#atendimento-status-ramal'),
            };
        },
        renderBtnAttendimento: function () {
            this.btnAttendimento = {
                discar: $('#ramalDiscar'),
                atender: $('#ramalAtender'),
                mute: $('#ramalMute'),
                desligar: $('#ramalDesligar'),
                ringCall: $('#ringCall'),
                historico: $('#ramalHistorico'),
            };
        },

        // Event listeners UI
        setupEventListenersPabx: function () {
            $(document).on('click', '#atendimento-btn-registrar-ramal', () => {
                const selectedRamal = $('#atendimento-pabx-ramal-list').val();
                if (selectedRamal) {
                    loadElement('atendimento-pabx-ramal-list', 1);
                    loadElement('atendimento-btn-registrar-ramal', 1);
                    this.checkSessionRamal(selectedRamal);
                }
            });
            $(document).on('click', '#atendimento-btn-desligar', () => this.endCall());
            $(document).on('click', '#atendimento-btn-li-desligar', () => this.endCall());
            $(document).on('click', '#atendimento-btn-mute', (e) => this.muteCall(e));
            $(document).on('click', '#atendimento-btn-li-mute, #atendimento-btn-li-unmute', (e) => this.muteCall(e));
            $(document).on('click', '#atendimento-btn-atender', () => this.atenderLigacao());
            $(document).on('click', '#atendimento-btn-li-atender', () => this.atenderLigacao());
            $(document).on('click', '#atendimento-btn-ligar', () => {
                const numero = $('#atendimento-input-numero').val();
                this.iniciarChamada(numero);
            });
            $(document).on('click', '.atendimento-btn-dtmf', (e) => {
                const dtmfValue = $(e.currentTarget).data('dtmf');
                this.sendDTMF('' + dtmfValue);
            });
            $(document).on('click', '#atendimento-btn-numpad', () => this.mostrarRamalDialpad());
            $(document).on('click', '#atendimento-btn-discar', () => {
                this.renderRamalCardHeader('disponivel');
                $('#atendimento-card').removeClass('hidden');
            });
            $(document).on('click', '#atendimento-btn-more', () => this.transferirPesquisa());
            $(document).on('click', '#atendimento-status-toggle', () => {
                $('#atendimento-status-dropdown').toggleClass('hidden');
            });
            $(document).on('click', '.atendimento-status-item', (e) => {
                const $el = $(e.currentTarget);
                const action = $el.data('action');
                if (!action) return;
                const motivo = $el.data('motivo') || '';
                const statusId = $el.data('statusId');
                $('#atendimento-status-dropdown').addClass('hidden');
                this.handleStatusAction(action, { motivo, pauseId: motivo, statusId });
            });
            $(document).on('click', (e) => {
                if (!$(e.target).closest('#atendimento-status-toggle, #atendimento-status-dropdown').length) {
                    $('#atendimento-status-dropdown').addClass('hidden');
                }
            });
        },

        // Ramais
        getRamailList: function () {
            req('v1/sessao/getRamal', 'POST', {}, (res) => {
                if (res.data && res.data.length) {
                    this.ramais = {};
                    res.data.forEach(el => {
                        el.pausa_list = el.pausa_list !== '' ? el.pausa_list : [];
                        this.ramais[el.id_ramal_operador] = el;
                    });
                    this.renderRamalList();
                } else {
                    // Sem ramais, esconde PABX
                    this.esconderRamalPabxContent();
                }
            }, (err) => {
                // 404 = usuário sem ramal, esconde PABX silenciosamente
                if (err?.code === 404 || err?.status === 404) {
                    this.esconderRamalPabxContent();
                } else {
                    avisos('Ramal', 'Falha ao carregar ramais', 'error');
                }
            });
        },
        renderRamalList: function () {
            const ramalSelect = document.getElementById('atendimento-pabx-ramal-list');
            if (!ramalSelect) return;
            const selectedValue = ramalSelect.value;
            while (ramalSelect.options.length > 1) { ramalSelect.remove(1); }
            const sorted = Object.values(this.ramais).sort((a, b) => parseInt(a.ramal) - parseInt(b.ramal));
            if (!sorted.length) return;
            sorted.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.id_ramal_operador;
                opt.textContent = `${r.serv_nome} - ${r.ramal}`;
                ramalSelect.appendChild(opt);
            });
            if (selectedValue && ramalSelect.querySelector(`option[value="${selectedValue}"]`)) {
                ramalSelect.value = selectedValue;
            } else {
                ramalSelect.value = sorted[0].id_ramal_operador;
            }
        },

        // Registro/UA
        checkSessionRamal: function (ramalId) {
            const ramalData = this.ramais[ramalId];
            if (!ramalData) {
                avisos('Ramal', 'Ramal inválido', 'error');
                return;
            }
            this.ramalConnect = ramalData;
            this.connectUA();
        },
        connectUA: function () {
            const socket = new JsSIP.WebSocketInterface(this.ramalConnect.wss);
            const configuration = {
                sockets: [socket],
                uri: this.ramalConnect.uri,
                password: this.ramalConnect.senha,
                traceSip: false,
                contactParams: { transport: 'wss' },
                hackIpInContact: true,
                session_timers: true,
                noAnswerTimeout: 30,
            };
            this.ua = new JsSIP.UA(configuration);
            this.bindUAEvents();
            this.ua.start();
        },
        bindUAEvents: function () {
            const self = this;
            this.ua.on('registered', () => {
                avisos('Ramal', 'Registrado com sucesso', 'success');
                // Não marcar disponível antes de receber o STATUS do Asterisk
                self.atualizarStatusRamal({ status: 101, text: 'Registrado (aguardando status)', classe: 'border-info', start: new Date(), isControlStatus: true });
                self.mostrarPabxContent();
                self.sendSipControlMessage('register');
            });
            this.ua.on('unregistered', () => {
                self.atualizarStatusRamal({ status: 308, text: 'Deslogado', classe: '', start: new Date() });
            });
            this.ua.on('registrationFailed', (e) => {
                console.error('Registro falhou', e.cause);
                avisos('Ramal', 'Falha no registro SIP', 'error');
                self.atualizarStatusRamal({ status: 308, text: 'Deslogado', classe: '', start: new Date() });
            });
            this.ua.on('newRTCSession', (data) => self.handleRTCSession(data));
            this.ua.on('newMessage', (data) => self.handleIncomingMessage(data));
            // Fallback: captura mensagens SIP mesmo que JsSIP não dispare newMessage
            this.ua.on('sipEvent', (evt) => {
                try {
                    const req = evt && evt.data && evt.data.request;
                    if (req && req.method === 'MESSAGE') {
                        self.handleIncomingMessage({ message: { body: req.body || '' } });
                    }
                } catch (e) { console.error('sipEvent MESSAGE parse error', e); }
            });
            this.ua.on('disconnected', () => {
                avisos('Ramal', 'Conexão perdida', 'error');
                self.atualizarStatusRamal({ status: 499, text: 'Reconectando', classe: 'border-dark', start: new Date() });
            });
        },

        handleIncomingMessage: function (data) {
            // Captura corpo vindo tanto do evento newMessage (data.message.body) quanto do sipEvent (data.request.body)
            const body = (
                (data && data.request && data.request.body) ||
                (data && data.message && data.message.body) ||
                ''
            ).trim();
            if (!body) return;
            this.appendSipMsgLog(`<< ${body}`);

            let parsed = null;
            try { parsed = JSON.parse(body); } catch (e) { parsed = null; }
            if (!parsed || !parsed.status || !parsed.cmd) {
                return;
            }

            const cmd = parsed.cmd;
            const statusStr = parsed.status;
            const dataObj = parsed.data || {};

            if (statusStr === 'error') {
                avisos('Ramal', `Erro (${cmd}): ${parsed.error || 'desconhecido'}`, 'error');
                return;
            }

            if (cmd === 'status' || cmd === 'statusupdate' || cmd === 'register' || cmd === 'removepausa' || cmd === 'endcall') {
                const mapped = this.mapStatusPayload({
                    statusId: dataObj.status_id,
                    statusStr: dataObj.status,
                    devstate: dataObj.devstate,
                    pausaId: dataObj.pausa_id || dataObj.pausaId || dataObj.pausa,
                });

                // Protege estado de ligação ativa: se há sessão RTC, não deixa rebaixar para disponível/pausa
                const emLigacao = this.session && this.session.session && !this.session.session.isEnded();
                if (emLigacao && mapped.status !== 226 && mapped.status !== 102) {
                    // Atualiza apenas o status list (badge) sem alterar card/UI de ligação
                    this.ramalStatusAtual = { ...this.ramalStatusAtual, devstate: mapped.devstate };
                    this.renderRamalStatusList();
                    return;
                }

                const start = (mapped.status === 307 || mapped.status === 102 || mapped.status === 226) ? new Date() : undefined;
                this.atualizarStatusRamal({ ...mapped, start, isControlStatus: true });
                return;
            }
        },

        mapStatusPayload: function ({ statusId, statusStr, devstate, pausaId }) {
            const idNum = statusId !== undefined && statusId !== null && statusId !== '' ? parseInt(statusId, 10) : null;
            const base = { statusId: idNum, pausaId: pausaId || '', devstate: devstate || '' };
            const withBase = (status, text, classe) => ({ status, text, classe, ...base });

            if (idNum === 3) return withBase(307, 'Em Pausa', 'border-warning');
            if (idNum === 5) return withBase(307, 'Pausa Solicitada', 'border-warning');
            if (idNum === 11) return withBase(307, 'Em Pausa', 'border-warning');
            if (idNum === 8) return withBase(102, 'Chamando', 'border-warning');
            if (idNum === 9) return withBase(226, 'Em Ligação', 'border-red-300');
            if (idNum === 10) return withBase(100, 'Disponível', 'border-success');

            const dev = (devstate || '').toLowerCase();
            const statusLower = (statusStr || '').toLowerCase();
            if (statusLower === 'paused') return withBase(307, 'Em Pausa', 'border-warning');
            if (statusLower === 'busy' || dev === 'inuse' || dev === 'busy') return withBase(226, 'Em Ligação', 'border-red-300');
            if (statusLower === 'offline' || statusLower === 'unavailable' || dev === 'unavailable') return withBase(308, 'Deslogado', '');
            if (statusLower === 'ringing' || dev === 'ringing') return withBase(102, 'Chamando', 'border-warning');

            return withBase(100, 'Disponível', 'border-success');
        },

        handleRTCSession: function (data) {
            const self = this;
            self.session = data;
            self.AudioMute = false;
            self.enableAudioTracks();
            self.updateMuteButtons();
            const sess = data.session;
            // Guarda o request do INVITE (data.request pode ser diferente de sess.request)
            const inviteReq = data.request || sess.request;
            self._inviteRequest = inviteReq;

            // Captura X-Bash headers do INVITE assim que a sessão é criada
            self._currentXBash = self.extractXBash(inviteReq);
            console.log('[PABX] handleRTCSession direction:', sess.direction);
            console.log('[PABX] handleRTCSession xBash:', self._currentXBash);
            const setRemoteAudio = (stream) => {
                if (stream && self.AudioDiv && self.AudioDiv[0]) {
                    self.AudioDiv[0].srcObject = stream;
                }
            };

            const toNumber = () => {
                try { return sess && sess.remote_identity && sess.remote_identity.uri && sess.remote_identity.uri.user; }
                catch (e) { return ''; }
            };

            if (sess.direction === 'incoming') {
                const num = toNumber();
                if (self.ramalConnect.bl_auto_att) {
                    self.atenderLigacao();
                } else {
                    self.atualizarStatusRamal({ status: 102, text: 'Recebendo Ligação!', classe: 'border-warning', numero: num, start: new Date() });
                }
            } else {
                // outgoing
                self.playRingbackTone();
                const target = sess.request && sess.request.ruri && sess.request.ruri.user;
                self.atualizarStatusRamal({ status: 226, text: 'Discando', classe: 'border-red-300', numero: target, ativo: true, start: new Date() });
            }

            sess.on('accepted', (e) => {
                self.stopRingbackTone();
                self.AudioMute = false;
                self.enableAudioTracks();
                if (sess.isMuted && sess.isMuted().audio) { sess.unmute(); }
                self.updateMuteButtons();
                self.sendSipControlMessage('unmute');
                const stream = e && e.stream ? e.stream : (sess.connection && sess.connection.getRemoteStreams && sess.connection.getRemoteStreams()[0]);
                setRemoteAudio(stream);
                // Usa os headers capturados do INVITE original
                const xBash = self._currentXBash || {};
                console.log('[PABX] accepted: xBash:', xBash);
                const numero = toNumber();
                self.atualizarStatusRamal({ status: 226, text: 'Em Ligação', classe: 'border-red-300', numero, protocolo: xBash['protocolo'], fila: xBash['nomefila'], tempoAtt: new Date(), xBash, start: new Date() });
            });

            sess.on('confirmed', (e) => {
                const stream = e && e.stream ? e.stream : (sess.connection && sess.connection.getRemoteStreams && sess.connection.getRemoteStreams()[0]);
                setRemoteAudio(stream);
            });

            const finishCall = () => {
                self.stopRingbackTone();
                self.AudioMute = false;
                self.enableAudioTracks();
                self.session = null;
                self.sendSipControlMessage('endcall');
                self.esconderRamalLigacaoCurso();

                if (self.pendingAction) {
                    const pa = self.pendingAction;
                    self.pendingAction = null;
                    if (pa.type === 'deslogar') {
                        self.deslogarRamal();
                    } else if (pa.type === 'pausa') {
                        self.pausarRamal(pa.motivo);
                    }
                    return;
                }

                self.atualizarStatusRamal({ status: 100, text: 'Disponível', classe: 'border-success', ramal: self.ramalConnect.ramal, start: new Date() });
            };

            sess.on('ended', finishCall);
            sess.on('failed', finishCall);
            sess.on('cancel', finishCall);
            sess.on('noanswer', finishCall);
        },

        extractXBash: function (request) {
            const res = {};
            if (!request) return res;

            // Lista de headers X-Bash conhecidos
            const knownHeaders = ['protocolo', 'nomefila', 'pesquisa'];

            // Estratégia 1: usar getHeader() do JsSIP (mais confiável)
            if (typeof request.getHeader === 'function') {
                knownHeaders.forEach(name => {
                    // Tenta várias variações de casing
                    const variations = [
                        'x-bash-' + name,
                        'X-Bash-' + name.charAt(0).toUpperCase() + name.slice(1),
                        'X-bash-' + name,
                    ];
                    for (const v of variations) {
                        const val = request.getHeader(v);
                        if (val) {
                            res[name] = val;
                            break;
                        }
                    }
                });
            }

            // Estratégia 2: iterar headers object diretamente
            const headers = request.headers || {};
            Object.keys(headers).forEach(key => {
                if (key.toLowerCase().startsWith('x-bash-')) {
                    const newKey = key.replace(/^x-bash-/i, '').toLowerCase();
                    if (!res[newKey]) {
                        try {
                            const hval = headers[key];
                            if (Array.isArray(hval) && hval.length > 0) {
                                res[newKey] = hval[0].raw || hval[0].value || hval[0];
                            } else if (typeof hval === 'string') {
                                res[newKey] = hval;
                            }
                        } catch (e) {
                            console.warn('extractXBash: falha ao ler header', key, e);
                        }
                    }
                }
            });

            console.log('[PABX] extractXBash resultado:', res, '| headers keys:', Object.keys(headers));
            return res;
        },

        // Status actions via SIP MESSAGE
        handleStatusAction: function (action, payload = {}) {
            const statusId = payload.statusId || payload.motivo || '';
            const pauseId = payload.pauseId || payload.pausaId || payload.motivo || '';
            const targetSelect = payload.targetSelect || '';
            const requiresPause = payload.requiresPause || false;
            const resolvePause = () => {
                if (pauseId) return pauseId;
                if (targetSelect) {
                    const val = $(targetSelect).val();
                    if (val) return val;
                }
                return '';
            };

            switch (action) {
                case 'pausa': {
                    const resolved = resolvePause();
                    if (!resolved) {
                        avisos('Ramal', 'Selecione um motivo de pausa', 'warning');
                        return;
                    }
                    this.pausarRamal(resolved);
                    break;
                }
                case 'retornar':
                    this.removePausaRamal();
                    break;
                case 'deslogar':
                    this.deslogarRamal();
                    break;
                case 'status':
                    this.solicitarStatus();
                    break;
                case 'statusupdate': {
                    if (!statusId) {
                        avisos('Ramal', 'Selecione um status para enviar', 'warning');
                        return;
                    }
                    const needsPause = requiresPause || ['3', '5', '11'].includes(String(statusId));
                    const pause = resolvePause();
                    if (needsPause && !pause) {
                        avisos('Ramal', 'Informe a pausa_id para este status', 'warning');
                        return;
                    }
                    this.sendStatusUpdate(statusId, pause);
                    avisos('Ramal', `Solicitando status ${statusId}${pause ? ` (pausa ${pause})` : ''}`, 'info');
                    break;
                }
                case 'register':
                    this.sendSipControlMessage('register');
                    avisos('Ramal', 'Solicitando registro de sessão', 'info');
                    break;
                case 'solicitar-pausa': {
                    const resolved = resolvePause();
                    if (!resolved) { avisos('Ramal', 'Motivo de pausa inválido', 'warning'); return; }
                    this.pendingAction = { type: 'pausa', motivo: resolved };
                    this.renderRamalStatusList();
                    avisos('Ramal', 'Pausa será aplicada ao encerrar a ligação.', 'info');
                    break;
                }
                case 'solicitar-deslogar':
                    this.pendingAction = { type: 'deslogar' };
                    this.renderRamalStatusList();
                    avisos('Ramal', 'Logout será feito ao encerrar a ligação.', 'info');
                    break;
                case 'cancelar-pendente':
                    this.pendingAction = null;
                    this.renderRamalStatusList();
                    avisos('Ramal', 'Solicitação cancelada.', 'info');
                    break;
                default:
                    console.warn('Ação de status desconhecida', action);
            }
        },
        pausarRamal: function (motivo) {
            // usa statusupdate com status_id de pausa (3) + pause_id=motivo
            const m = motivo || '1';
            this.sendStatusUpdate(3, m);
            avisos('Ramal', `Solicitando pausa (${m})`, 'info');
        },
        removePausaRamal: function () {
            this.sendSipControlMessage('removepausa');
            avisos('Ramal', 'Solicitando retorno de pausa', 'info');
        },
        solicitarStatus: function () {
            this.sendSipControlMessage('status');
            avisos('Ramal', 'Solicitando status', 'info');
        },
        deslogarRamal: function () {
            // se em ligação, agenda logout no término
            if (this.session && this.session.session && this.session.session.isEstablished && this.session.session.isEstablished()) {
                this.pendingAction = { type: 'deslogar' };
                this.renderRamalStatusList();
                avisos('Ramal', 'Logout será feito ao encerrar a ligação.', 'info');
                return;
            }
            this.pendingAction = null;
            if (this.ua && this.ua.stop) {
                this.ua.stop();
            }
            this.atualizarStatusRamal({ status: 308, text: 'Deslogado', classe: '', ramal: this.ramalConnect.ramal, start: new Date() });
        },

        // Chamadas
        iniciarChamada: function (numeroDestino) {
            if (!numeroDestino) {
                avisos('Ramal', 'Informe um número', 'warning');
                return;
            }
            if (!this.ua || !this.ua.isRegistered()) {
                avisos('Ramal', 'Ramal não registrado', 'error');
                return;
            }
            this.ua.call(numeroDestino, {
                mediaConstraints: { audio: true, video: false },
                mediaStream: this.GlobStream,
            });
            avisos('Ramal', 'Discando...', 'info');
            this.playRingbackTone();
            this.atualizarStatusRamal({ status: 226, text: 'Discando', classe: 'border-red-300', numero: numeroDestino, ativo: true, start: new Date() });
        },
        atenderLigacao: function () {
            if (this.session && this.session.session && this.session.session.direction === 'incoming') {
                this.session.session.answer(this.StreamLocal);
            } else {
                avisos('Ramal', 'Nenhuma chamada a atender', 'error');
            }
        },
        endCall: function () {
            if (this.session && this.session.session) {
                this.session.session.terminate();
                this.sendSipControlMessage('endcall');
            } else {
                avisos('Ramal', 'Sem ligação no momento', 'info');
            }
        },
        muteCall: function () {
            if (this.session && this.session.session && (this.session.session.isEstablished && this.session.session.isEstablished())) {
                this.AudioMute = !this.AudioMute;
                this.session.session[this.AudioMute ? 'mute' : 'unmute']();
                this.updateMuteButtons();
                avisos('Ramal', this.AudioMute ? 'Microfone mudo' : 'Microfone aberto', 'info');
            }
        },
        sendDTMF: function (dtmf) {
            if (this.session && this.session.session && this.session.session.isEstablished && this.session.session.isEstablished()) {
                this.session.session.sendDTMF(dtmf);
            }
        },
        transferirPesquisa: function () {
            if (!this.session || !this.session.session || !this.session.session.isEstablished || !this.session.session.isEstablished()) {
                avisos('Ramal', 'Sem ligação ativa para transferir', 'info');
                return;
            }
            const xBash = this.extractXBash(this.session.session.request || this._inviteRequest);
            const destinoPesquisa = xBash['pesquisa'];
            if (!destinoPesquisa) {
                avisos('Ramal', 'Pesquisa não informada no header', 'warning');
                return;
            }
            try {
                this.session.session.refer(destinoPesquisa);
                avisos('Ramal', 'Transferindo para pesquisa de satisfação', 'success');
            } catch (e) {
                console.error(e);
                avisos('Ramal', 'Falha ao transferir para pesquisa', 'error');
            }
        },

        // UI helpers
        renderRamalCardHeader: function (estado = 'disponivel') {
            const pacote = this.ramalStatusAtual || {};
            const header = document.getElementById('atendimento-card-header');
            if (!header) return;
            const cardHTML = `
            <div class="flex items-start gap-4 w-full">
                <div class="flex flex-col items-center">
                    <div class="w-14 h-14 bg-base-300 rounded-full flex items-center justify-center text-2xl text-base-content/70">
                        <i class="fa-solid fa-user"></i>
                    </div>
                    ${pacote.tempoAtt ? `<span id="atendimento-tempo" class="atendimento-tempo mt-2 text-xl font-mono">${this.formatTempoAtt(pacote.tempoAtt)}</span>` : ''}
                </div>
                <div class="flex-1 min-w-0">
                    <h3 class="font-bold text-lg truncate">Fila: ${pacote.fila || 'Atendimento'}</h3>
                    ${pacote.numero ? `<div class="flex items-center gap-2 mt-1"><span class="font-semibold text-sm">Telefone:</span><span class="text-sm">${pacote.numero}</span></div>` : ''}
                    ${pacote.protocolo ? `<div class="flex items-center gap-2 mt-1"><span class="font-semibold text-sm">Protocolo:</span><span class="text-sm">${pacote.protocolo}</span></div>` : ''}
                </div>
                <div class="flex flex-col items-center gap-1 self-start">
                    ${pacote.numero && pacote.fila && !pacote.ativo ? `<button id="atendimento-ramal-enviar-whatsapp" class="btn btn-ghost btn-circle btn-sm tooltip tooltip-success" title="Enviar para Whatsapp" data-tip="Enviar para Whatsapp"><i class="fab fa-whatsapp text-lg"></i></button>` : ''}
                </div>
            </div>`;
            const actions = this.buttonTemplates[estado] || '';
            header.innerHTML = cardHTML + actions;
            this.checkMuteCall();
            if (pacote.tempoAtt) this.ramalIniciarContadorTempo();
        },

        renderRamalStatusList: function () {
            const self = this;
            const container = self.ElementsRamalAtendimento.statusAtual;
            if (!container || !container.html) return;

            const emPausa = self.ramalStatusAtual.status === 307;
            const emAtendimento = self.ramalStatusAtual.status === 226;
            const tempoPausa = emPausa && self.ramalStatusAtual.start ? self.formatTempoAtt(self.ramalStatusAtual.start) : '';
            const ramalLabel = (self.ramalConnect && self.ramalConnect.ramal)
                ? `Ramal: ${self.ramalConnect.ramal}`
                : 'Ramal';
            const statusText = self.ramalStatusAtual.text || 'Status';
            const statusDot = self.getStatusDot();
            const dropdownItems = self.buildStatusDropdownItems();
            const pendingLabel = self.pendingAction
                ? `<span class="text-xs text-warning">⏳ ${self.pendingAction.type === 'pausa' ? 'Pausa' : 'Deslogue'} ao encerrar</span>`
                : '';

            const panel = `
                <div class="relative w-full">
                    <div id="atendimento-status-toggle" class="flex flex-col cursor-pointer border bg-base-200 border-base-200 rounded-lg px-4 py-2 w-full">
                        <span class="text-xs text-gray-500">${ramalLabel}</span>
                        <div class="flex items-center justify-between">
                            <span class="text-sm font-semibold">${statusText} ${statusDot}</span>
                            <i class="fa-solid fa-chevron-down text-xs text-gray-400"></i>
                        </div>
                        ${emPausa && tempoPausa ? `<span class="text-xs text-gray-500 pausa-tempo">${tempoPausa}</span>` : ''}
                        ${pendingLabel}
                    </div>
                    <div id="atendimento-status-dropdown" class="hidden absolute left-0 right-0 top-full mt-1 bg-base-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                        ${dropdownItems}
                    </div>
                </div>`;

            container.html(panel);
            if (emPausa) {
                self.ramalPausaIniciarContadorTempo();
            } else if (!emAtendimento) {
                self.ramalPausaLimparContador();
            }
        },
        getStatusDot: function () {
            switch (this.ramalStatusAtual.status) {
                case 100: return '🟢';
                case 102: return '🟡';
                case 226: return '🔴';
                case 307: return '🟠';
                case 101: return '⏳';
                case 308: return '⚫';
                default: return '⚪';
            }
        },
        buildStatusDropdownItems: function () {
            const self = this;
            const status = self.ramalStatusAtual.status;
            const pausas = (self.ramalConnect && self.ramalConnect.pausa_list) ? self.ramalConnect.pausa_list : [];
            let html = '';

            const item = (action, label, extra = '') => `<div class="atendimento-status-item px-4 py-2 hover:bg-base-300 cursor-pointer text-sm" data-action="${action}" ${extra}>${label}</div>`;
            const divider = () => `<div class="divider my-0 px-4"></div>`;

            if (status === 100) {
                html += item('status', '🔄 Checar Status');
                html += divider();
                pausas.forEach(p => {
                    html += item('pausa', `🟠 ${p.nome}`, `data-motivo="${p.id}"`);
                });
                if (!pausas.length) {
                    html += `<div class="px-4 py-2 text-xs text-gray-500">Sem pausas cadastradas</div>`;
                }
                html += divider();
                html += item('deslogar', '⚫ Deslogar');
            } else if (status === 307) {
                html += item('status', '🔄 Checar Status');
                html += divider();
                html += item('retornar', '🟢 Retornar (Disponível)');
                html += divider();
                html += item('deslogar', '⚫ Deslogar');
            } else if (status === 226) {
                html += item('status', '🔄 Checar Status');
                html += divider();
                if (self.pendingAction) {
                    const paLabel = self.pendingAction.type === 'pausa' ? '🟠 Pausa solicitada' : '⚫ Deslogue solicitado';
                    html += `<div class="px-4 py-2 text-xs text-warning">⏳ ${paLabel} (ao encerrar)</div>`;
                    html += item('cancelar-pendente', '❌ Cancelar solicitação');
                } else {
                    pausas.forEach(p => {
                        html += item('solicitar-pausa', `🟠 Solicitar: ${p.nome}`, `data-motivo="${p.id}"`);
                    });
                    if (!pausas.length) {
                        html += `<div class="px-4 py-2 text-xs text-gray-500">Sem pausas cadastradas</div>`;
                    }
                    html += divider();
                    html += item('solicitar-deslogar', '⚫ Solicitar Deslogue');
                }
            } else if (status === 102) {
                html += item('status', '🔄 Checar Status');
            } else if (status === 101) {
                html += item('status', '🔄 Checar Status');
                html += item('register', '🔗 Registrar sessão');
                html += divider();
                html += item('deslogar', '⚫ Deslogar');
            } else {
                html += item('register', '🔗 Registrar sessão');
            }

            return html;
        },

        // Status centralizado
        atualizarStatusRamal: function (pacote) {
            this.ramalStatusAtual = { ...this.ramalStatusAtual, ...pacote };

            if (this.ramalStatusAtual.status !== 226 && this.ramalStatusAtual.status !== 102) {
                this.ramalStatusAtual.numero = '';
                this.ramalStatusAtual.protocolo = '';
                this.ramalStatusAtual.fila = '';
                this.ramalStatusAtual.tempoAtt = null;
            }

            this.renderRamalStatusList();
            const controlOnly = !!pacote.isControlStatus;

            switch (pacote.status) {
                case 100:
                    this.renderRamalCardHeader('disponivel');
                    this.renderBtnDiscar(true);
                    this.esconderRamalChamandoPopupLi();
                    this.esconderRamalEmCursoPopupLi();
                    break;
                case 102:
                    if (controlOnly) { break; }
                    this.renderRamalCardHeader('chamadaEntrando');
                    this.renderRamalChamandoPopupLi();
                    break;
                case 226:
                    if (!controlOnly) {
                        this.renderRamalCardHeader('emCurso');
                        this.renderRamalEmCursoPopupLi();
                        $('#atendimento-card').removeClass('hidden');
                        if (pacote.xBash && pacote.xBash['protocolo']) {
                            this.LastProtocolo = pacote.xBash['protocolo'];
                            if (typeof flowhub === 'function') {
                                flowhub(pacote.xBash['protocolo'], pacote.numero);
                            }
                        }
                    }
                    break;
                case 307:
                    this.renderBtnDiscar(true);
                    break;
                case 308:
                    this.mostrarPabxRegister();
                    break;
                default:
                    break;
            }
        },

        // UI toggles
        renderBtnDiscar: function (b) { b ? $('#atendimento-li-discar').removeClass('hidden') : $('#atendimento-li-discar').addClass('hidden'); },
        renderRamalChamandoPopupLi: function () { $('#atendimento-li-ligacao-atender').removeClass('hidden'); $('#atendimento-li-ligacao-atender-telefone').text(this.ramalStatusAtual.numero || ''); this.renderBtnDiscar(false); },
        renderRamalEmCursoPopupLi: function () { $('#atendimento-li-ligacao-atender').addClass('hidden'); $('#atendimento-li-ligacao').removeClass('hidden'); $('#atendimento-li-ligacao-curso-telefone').text(this.ramalStatusAtual.numero || ''); this.renderBtnDiscar(false); },
        esconderRamalChamandoPopupLi: function () { $('#atendimento-li-ligacao-atender').addClass('hidden'); },
        esconderRamalEmCursoPopupLi: function () { $('#atendimento-li-ligacao').addClass('hidden'); },
        mostrarPabxContent: function () { $('#atendimento-pabx-inicial-connect').addClass('hidden'); $('#atendimento-pabx-status-connect').removeClass('hidden'); if (this.ramalStatusAtual.status === 100) { this.renderRamalCardHeader('disponivel'); this.renderBtnDiscar(true); } },
        esconderRamalPabxContent: function () { 
            // Esconde toda a seção PABX, seção de Ligações e separadores quando usuário não tem ramal
            $('#atendimento-pabx-inicial').addClass('hidden');
            $('#atendimento-pabx-inicial').next('hr').addClass('hidden');
            $('#atendimento-active-in-voice').addClass('hidden');
            $('#atendimento-active-in-voice').next('hr').addClass('hidden');
            $('#atendimento-pabx-status-connect').addClass('hidden'); 
            $('#atendimento-li-ligacao').addClass('hidden'); 
            $('#atendimento-li-ligacao-atender').addClass('hidden'); 
        },
        mostrarPabxRegister: function () { $('#atendimento-pabx-status-connect').addClass('hidden'); $('#atendimento-pabx-inicial-connect').removeClass('hidden'); loadElement('atendimento-pabx-ramal-list', 0); loadElement('atendimento-btn-registrar-ramal', 0); this.renderBtnDiscar(false); },
        mostrarRamalDialpad: function () { $('#atendimento-dynamic-content').toggleClass('hidden'); $('#atendimento-numpad').toggleClass('hidden'); },
        esconderRamalLigacaoCurso: function () { $('#atendimento-li-ligacao').addClass('hidden'); $('#atendimento-li-ligacao-atender').addClass('hidden'); $('#atendimento-card').addClass('hidden'); },

        // Timers
        formatTempoAtt: function (inicio) {
            const agora = new Date();
            const diferenca = agora - new Date(inicio);
            let segundos = Math.floor(diferenca / 1000);
            let minutos = Math.floor(segundos / 60);
            let horas = Math.floor(minutos / 60);
            segundos %= 60; minutos %= 60;
            return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
        },
        ramalIniciarContadorTempo: function () {
            if (!this.ramalStatusAtual.tempoAtt) return;
            const elements = document.getElementsByClassName('atendimento-tempo');
            if (!elements || !elements.length) return;
            const tick = () => {
                const t = this.formatTempoAtt(this.ramalStatusAtual.tempoAtt);
                Array.from(elements).forEach(el => { el.textContent = manipula(t); });
            };
            tick();
            this.intervaloContador = setInterval(tick, 1000);
        },
        ramalPausaIniciarContadorTempo: function () {
            if (!this.ramalStatusAtual.start) return;
            const elements = document.getElementsByClassName('pausa-tempo');
            if (!elements || !elements.length) return;
            const tick = () => {
                const t = this.formatTempoAtt(this.ramalStatusAtual.start);
                Array.from(elements).forEach(el => { el.textContent = manipula(t); });
            };
            tick();
            this.intervaloContador = setInterval(tick, 1000);
        },
        ramalLimparContador: function () { if (this.intervaloContador) { clearInterval(this.intervaloContador); this.intervaloContador = null; } },
        ramalPausaLimparContador: function () { if (this.intervaloContador) { clearInterval(this.intervaloContador); this.intervaloContador = null; } },

        // Áudio
        permissaoAudio: function () {
            navigator.mediaDevices.getUserMedia({ audio: true, video: false })
                .then(stream => {
                    this.GlobStream = stream;
                    this.StreamLocal = { mediaConstraints: { audio: true, video: false }, mediaStream: stream };
                })
                .catch(err => {
                    console.error('Acesso ao microfone negado', err);
                    avisos('Ramal', 'Permissão de áudio negada', 'error');
                    $('.register').hide();
                });
        },
        initRingbackTone: function () {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const destination = audioContext.createMediaStreamDestination();
            this.ringbackTone = { context: audioContext, destination, oscillator: null, gainNode: null, isPlaying: false };
        },
        playRingbackTone: function () {
            const self = this;
            if (!self.ringbackTone || self.ringbackTone.isPlaying) return;
            const ctx = self.ringbackTone.context;
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();
            osc1.frequency.value = 440; osc2.frequency.value = 480; gain.gain.value = 0;
            osc1.connect(gain); osc2.connect(gain); gain.connect(ctx.destination);
            osc1.start(); osc2.start();
            self.ringbackTone.oscillator = [osc1, osc2]; self.ringbackTone.gainNode = gain; self.ringbackTone.isPlaying = true;
            let on = true;
            const pattern = function () {
                if (!self.ringbackTone.isPlaying) return;
                const t = ctx.currentTime;
                if (on) {
                    gain.gain.setValueAtTime(0.15, t);
                    setTimeout(() => { if (self.ringbackTone.isPlaying) { gain.gain.setValueAtTime(0, ctx.currentTime); on = false; } }, 1000);
                    setTimeout(pattern, 1000);
                } else {
                    gain.gain.setValueAtTime(0, t);
                    setTimeout(() => { on = true; pattern(); }, 2000);
                }
            };
            pattern();
        },
        stopRingbackTone: function () {
            const self = this;
            if (!self.ringbackTone || !self.ringbackTone.isPlaying) return;
            self.ringbackTone.isPlaying = false;
            if (self.ringbackTone.oscillator) {
                self.ringbackTone.oscillator.forEach(o => { try { o.stop(); o.disconnect(); } catch (e) { } });
            }
            if (self.ringbackTone.gainNode) { try { self.ringbackTone.gainNode.disconnect(); } catch (e) { } }
        },

        // SIP MESSAGE util
        appendSipMsgLog: function (line) {
            const el = document.getElementById('sipmsg-log');
            if (!el) return;
            const ts = new Date().toLocaleTimeString('pt-BR');
            el.textContent = `[${ts}] ${line}\n` + el.textContent;
        },
        getSipMsgDestino: function () {
            // destino configurado no dialplan
            return '*111112026';
        },
        sendSipControlMessage: function (body) {
            if (!this.ua) {
                this.appendSipMsgLog('ERRO: UA não iniciado');
                return;
            }
            const destino = this.getSipMsgDestino();
            const payload = String(body || '').trim();
            if (!payload) return;
            try {
                this.appendSipMsgLog(`>> ${destino} | ${payload}`);
                this.ua.sendMessage(destino, payload, { contentType: 'text/plain' });
            } catch (e) {
                console.error(e);
                this.appendSipMsgLog(`ERRO ao enviar MESSAGE: ${e.message || e}`);
            }
        },

        sendStatusUpdate: function (statusId, pausaId = '') {
            const sid = statusId ? `${statusId}` : '';
            const pid = pausaId ? `${pausaId}` : '';
            if (!sid) return;
            const cmd = pid ? `statusupdate ${sid} ${pid}` : `statusupdate ${sid}`;
            this.sendSipControlMessage(cmd);
        },

        // Mute buttons state
        checkMuteCall: function () {
            if (this.session && this.session.session && this.session.session.isEstablished && this.session.session.isEstablished()) {
                if (this.AudioMute) { this.session.session.mute(); } else { this.session.session.unmute(); }
                this.updateMuteButtons();
            }
        },
        updateMuteButtons: function () {
            const muted = this.AudioMute;
            const $cardBtn = $('#atendimento-btn-mute');
            const $cardIcon = $cardBtn.find('i');
            const $cardText = $cardBtn.closest('.flex-col').find('.text-xs');
            $cardBtn.toggleClass('btn-active btn-ghost', muted);
            $cardIcon.toggleClass('fa-microphone-slash', muted).toggleClass('fa-microphone', !muted);
            $cardText.text(muted ? 'Desmutar' : 'Mutar');
            const $listBtn = $('.atendimento-btn-mute');
            const $listIcon = $listBtn.find('i');
            $listIcon.toggleClass('fa-microphone-slash', muted).toggleClass('fa-microphone', !muted);
            $listBtn.attr('data-tip', muted ? 'Desmutar' : 'Mutar');
        },
        enableAudioTracks: function () {
            if (this.GlobStream) {
                this.GlobStream.getAudioTracks().forEach(t => { t.enabled = true; });
            }
        },

        // Destroy
        destroy: function () {
            try {
                if (this.session && this.session.session) { this.session.session.terminate(); }
                if (this.ua && this.ua.stop) { this.ua.stop(); }
                if (this.AudioDiv && this.AudioDiv[0] && this.AudioDiv[0].srcObject) {
                    this.AudioDiv[0].srcObject.getTracks().forEach(t => t.stop());
                    this.AudioDiv[0].srcObject = null;
                }
                if (this.GlobStream) { this.GlobStream.getTracks().forEach(t => t.stop()); this.GlobStream = null; }
                this.ramalLimparContador();
                this.ramalPausaLimparContador();
            } catch (e) { console.error(e); }
            window.bashAtendimento = undefined;
        },
    };

    $(document).ready(function () {
        window.bashAtendimento.init();
    });
})();
