if (typeof window.bashNotifications === 'undefined') {
    window.bashNotifications = {
        notifications: [],
        lastUpdate: null,
        init: function() {
            this.loadFromStorage();
            if (this.notifications.length === 0) {
                this.notifications = this.getMockNotifications();
                this.saveToStorage();
            }
            this.setupEventListeners();
            this.renderAll();
            this.checkPendingReports();
        },
        loadFromStorage: function () {
            const stored = localStorage.getItem('bashNotifications');
            if (stored) {
                const data = JSON.parse(stored);
                this.notifications = data.notifications || [];
                this.lastUpdate = data.lastUpdate ? new Date(data.lastUpdate) : null;
            }
        },
        saveToStorage: function () {
            const data = {
                notifications: this.notifications,
                lastUpdate: new Date().toISOString()
            };
            localStorage.setItem('bashNotifications', JSON.stringify(data));
        },
        clearAll: function () {
            this.notifications = [];
            this.saveToStorage();
            updateNotificationBell();
            this.renderAll();
            $(document).trigger('notificationsCleared');
        },
        markAsRead: function (id) {
            const notification = this.notifications.find(n => n.id === id);
            if (notification) {
                notification.read = true;
                this.saveToStorage();
                this.renderAll();
                updateNotificationBell();
            }
        },
        markAllAsRead: function () {
            this.notifications.forEach(n => n.read = true);
            this.saveToStorage();
            this.renderAll();
            updateNotificationBell();
        },
        addNotification: function (notificationData) {
            const notificationExists = this.notifications.some(
                notification => notification.id === notificationData.id
            );        
            if (notificationExists && notificationData.id !== undefined) {
                return null; // ou você pode retornar a notificação existente se preferir
            }
            const newNotification = {
                id: notificationData.id || Date.now(), // ID único baseado no timestamp
                title:  notificationData.title || "Nova Notificação",
                description:  manipula(notificationData.description),
                message: manipula(notificationData.message),
                action: notificationData.action,
                actionParams: notificationData.actionParams,
                relatorio_id: notificationData.relatorio_id,
                filtros:notificationData.filtros,
                texto: manipula(notificationData.texto),
                createdAt: new Date().toISOString(),
                html: manipula(notificationData.html) || "",
                read: false,
                type: notificationData.type || "info",
                modelo: notificationData.modelo || "single",
                buttons: notificationData.buttons || [],
                listaChamados: notificationData.listaChamados || [],
                icon: notificationData.icon || this.getIconByType(notificationData.type)
            };
            this.notifications.unshift(newNotification);
            this.saveToStorage();
            if (newNotification.action){
                if (typeof window.bashNotifications[newNotification.action] === 'function') {
                    window.bashNotifications[newNotification.action](newNotification.actionParams);
                }
            }
            updateNotificationBell();
            triggerVisualEffect();
            this.renderAll();
            $(document).trigger('notificationAdded', [newNotification]);
            return newNotification;
        },
        updateNotification: function (notificationData) {
            // Encontra o índice da notificação no array
            const index = this.notifications.findIndex(n => n.id === notificationData.id);
            
            if (index !== -1) {
                const newNotification = {
                    id: notificationData.id || Date.now(),
                    title: notificationData.title || "Nova Notificação",
                    description: manipula(notificationData.description),
                    message: manipula(notificationData.message),
                    action: notificationData.action,
                    actionParams: notificationData.actionParams,
                    relatorio_id: notificationData.relatorio_id,
                    filtros: notificationData.filtros,
                    texto: manipula(notificationData.texto),
                    createdAt: new Date().toISOString(),
                    html: manipula(notificationData.html) || "",
                    read: false,
                    type: notificationData.type || "info",
                    modelo: notificationData.modelo || "single",
                    buttons: notificationData.buttons || [],
                    listaChamados: notificationData.listaChamados || [],
                    icon: notificationData.icon || this.getIconByType(notificationData.type)
                };
                
                // Atualiza o array diretamente usando o índice
                this.notifications[index] = newNotification;
                
                this.saveToStorage();
                this.renderAll();
                updateNotificationBell();
            }
        },
        getIconByType: function (type) {
            const icons = {
                'info': 'info-circle',
                'warning': 'exclamation-triangle',
                'error': 'times-circle',
                'success': 'check-circle'
            };
            return icons[type] || 'bell';
        },
        setupEventListeners: function () {
            // Evento para marcar como lida ao clicar
            $(document).on('click', '.notification-item', function () {
                const notificationId = $(this).data('notification-id');
                window.bashNotifications.markAsRead(notificationId);
            });

            // Evento para ações de botões
            $(document).on('click', '.notification-action-btn', function (e) {
                e.stopPropagation();
                const notificationId = $(this).data('notification-id');
                const action = $(this).data('action');

                const notification = window.bashNotifications.notifications.find(n => n.id == notificationId);
                if (notification && action) {
                    if (typeof window.bashNotifications[action] === 'function') {
                        window.bashNotifications[action](notification.actionParams);
                    }
                    window.bashNotifications.markAsRead(notificationId);
                }
            });

            $(document).on('click', '.notification-action-btn[data-action="removeNotification"]', function(e) {
                e.stopPropagation();
                const notificationId = $(this).closest('.notification-item').data('notification-id');
                window.bashNotifications.removeNotification(notificationId);
            });

            // Botão para marcar todas como lidas
            $(document).on('click', '#mark-all-read', function () {
                window.bashNotifications.markAllAsRead();
            });

            // Botão para limpar todas
            $(document).on('click', '#clear-all-notifications', function () {
                window.bashNotifications.clearAll();
            });
        },
        verChamado: function (protocolo) {
            this.hideDrawer();
            localStorage.setItem("ticketAtendimento", JSON.stringify({
                protocolo:protocolo
            }));
            carregarTela("chamados/visualizar");
        },
        renderAll: function () {
            this.renderDropdown();
            this.renderDrawer();
        },
        renderDropdown: function () {
            const $dropdown = $('#bash-notification-popup-list');
            if (!$dropdown.length) return;

            $dropdown.empty();

            const unread = this.notifications.filter(n => !n.read).slice(0, 5); // Limita a 5 notificações no dropdown

            if (unread.length === 0) {
                $dropdown.append('<div class="text-center py-4 text-gray-500">Nenhuma notificação recente</div>');
                return;
            }

            unread.forEach(notif => {
                $dropdown.append(this.renderNotificationItem(notif, false));
            });
        },
        renderDrawer: function () {
            const $drawer = $('#bash-notification-list');
            if (!$drawer.length) return;

            $drawer.empty();

            if (this.notifications.length === 0) {
                $drawer.append(`
                    <div class="text-center py-8">
                        <i class="fas fa-bell-slash text-3xl text-gray-400 mb-2"></i>
                        <p class="text-gray-500">Nenhuma notificação</p>
                    </div>
                `);
                return;
            }

            this.notifications.forEach(notif => {
                $drawer.append(this.renderNotificationItem(notif, true));
            });
        },
        renderNotificationItem: function(notif, isDrawer = false) {
            const notificationClass = notif.read ? 'border-b border-r border-neutral' : 'border-primary bg-opacity-10 border border-base-200';
            const timeAgo = this.formatTimeAgo(notif.createdAt);
            const iconColor = this.getIconColor(notif.type);
            
            // Ícone animado para processamento
            const icon = notif.icon === 'spinner' ? 
                `<i class="fas fa-${notif.icon} text-${iconColor} fa-spin"></i>` : 
                `<i class="fas fa-${notif.icon} text-${iconColor}"></i>`;
        
            return `
                <div class="notification-item ${notificationClass} flex flex-col gap-2 p-3 rounded-lg cursor-pointer" data-notification-id="${notif.id}">
                    <div class="flex justify-between items-start">
                        <div class="flex items-center gap-2">
                            ${icon}
                            <span class="font-bold text-lg">${notif.title}</span>
                        </div>
                        <span class="text-sm opacity-70">${timeAgo}</span>
                    </div>
                    <p class="text-base">${manipula(notif.texto)} ${notif.filtros ? `<small>Periodo ${notif.filtros.data_inicio} a ${notif.filtros.data_fim}</small>` : ''}</p>
                    <p class="text-base">${notif.description}</p>
                    
                    ${isDrawer && notif.listaChamados && notif.listaChamados.length > 0 ? `
                        <ul class="max-h-40 overflow-y-auto mt-2">
                            ${notif.listaChamados.slice(0, 10).map(item => `
                                <li class="flex items-center justify-between py-2 px-3 border-b border-gray-200 hover:bg-gray-50">
                                    <span class="truncate flex-1 mr-2">${item || 'Sem texto'}</span>
                                    <button class="btn btn-xs btn-outline btn-neutral notification-action-btn whitespace-nowrap"
                                        onclick="window.bashNotifications.verChamado('${item}')">
                                        Ver
                                    </button>
                                </li>
                            `).join('')}
                        </ul>
                    ` : ''}
                    ${notif.progress ? `
                    <div class="w-full bg-gray-200 rounded-full h-2.5">
                        <div class="bg-${iconColor} h-2.5 rounded-full" style="width: ${notif.progressValue || 0}%"></div>
                    </div>
                    ` : ''}
                    ${notif.buttons.length > 0 ? `
                    <div class="flex gap-2 mt-2">
                        ${notif.buttons.map(btn => `
                            <button class="btn btn-xs ${btn.class} notification-action-btn"
                                    data-notification-id="${notif.id}" 
                                    data-action="${btn.action}"
                                    data-relatorio-id="${btn.relatorio_id || ''}">
                                ${btn.text}
                            </button>
                        `).join('')}
                    </div>` : ''}
                    
                    ${isDrawer ? `
                    <div class="flex justify-end mt-2">
                        <button class="btn btn-xs btn-ghost notification-action-btn"
                                data-notification-id="${notif.id}" 
                                data-action="removeNotification">
                            <i class="fas fa-trash"></i> Remover
                        </button>
                    </div>
                    ` : ''}
                </div>
            `;
        },
        checkPendingReports: function() {
            this.notifications.forEach(notif => {
                if (notif.progressValue != 100) {
                    if (notif.relatorio_id) {
                        this.monitorarRelatorio(notif.tipo_relatorio,notif.relatorio_id, notif.id);
                    }
                }
            });
        },
        getIconColor: function (type) {
            const colors = {
                'info': 'info',
                'warning': 'warning',
                'error': 'error',
                'success': 'success'
            };
            return colors[type] || 'primary';
        },
        formatTimeAgo: function (isoString) {
            const date = new Date(isoString);
            const now = new Date();
            const seconds = Math.floor((now - date) / 1000);

            if (seconds < 60) return 'Agora mesmo';
            if (seconds < 3600) return `${Math.floor(seconds / 60)} min atrás`;
            if (seconds < 86400) return `${Math.floor(seconds / 3600)} h atrás`;
            if (seconds < 604800) return `${Math.floor(seconds / 86400)} dias atrás`;

            return date.toLocaleDateString('pt-BR');
        },
        removeNotification: function(id) {
            const notificationId = parseInt(id);
            this.notifications = this.notifications.filter(n => n.id !== notificationId);
            this.saveToStorage();
            this.renderAll();
            updateNotificationBell();
            $(document).trigger('notificationRemoved', [notificationId]);
        },
        getMockNotifications: function () {
            return [
                // {
                //     id: 1,
                //     title: "Bem-vindo ao sistema",
                //     texto: "Agora você pode acessar todos os recursos da plataforma",
                //     description: "Por segurança recomendamos que modifique sua senha o quanto antes.",
                //     action: "showWelcomeTour",
                //     actionParams: null,
                //     createdAt: new Date(Date.now() - 60000).toISOString(),
                //     read: false,
                //     type: "info",
                //     buttons: [
                //         {
                //             text: "Atualizar",
                //             action: "userResetPass",
                //             class: "btn-primary"
                //         }
                //     ],
                //     icon: "smile"
                // },
                // {
                //     id: 2,
                //     title: "Atualização disponível",
                //     description: "Nova versão 2.0 do sistema",
                //     message: "Melhorias de desempenho e novos recursos",
                //     action: "showUpdateModal",
                //     actionParams: { version: "2.0" },
                //     createdAt: new Date(Date.now() - 3600000).toISOString(),
                //     read: false,
                //     type: "warning",
                //     buttons: [
                //         {
                //             text: "Atualizar",
                //             action: "installUpdate",
                //             class: "btn-primary"
                //         },
                //         {
                //             text: "Mais tarde",
                //             action: "remindLater",
                //             class: "btn-ghost"
                //         }
                //     ],
                //     icon: "download"
                // },
                // {
                //     id: 3,
                //     title: "Mensagem recebida",
                //     description: "Você tem uma nova mensagem",
                //     message: "João enviou: 'Olá, como vai?'",
                //     action: "openChat",
                //     actionParams: { userId: 123 },
                //     createdAt: new Date(Date.now() - 86400000).toISOString(),
                //     read: true,
                //     type: "success",
                //     buttons: [
                //         {
                //             text: "Responder",
                //             action: "replyMessage",
                //             class: "btn-success"
                //         }
                //     ],
                //     icon: "envelope"
                // }
            ];
        },
        monitoreDownloadRelatorioByID: function(dados) {            
            // Cria uma notificação de processamento
            const notification = this.addNotification({
                title: "Relatório em processamento",
                description: "Seu relatório está sendo gerado...",
                type: "info",
                buttons: [],
                icon: "spinner",
                progress: true,
                relatorio_id: dados.relatorio_id,
                filtros:dados.filtros,
                texto:dados.texto
            });
            this.saveToStorage();
            this.renderAll();
            this.monitorarRelatorio(dados.tipo_relatorio,dados.relatorio_id, notification.id);
        },
        baixarRelatorio: function(dados) {
            const relatorioId = dados.relatorio_id;
            const data = { id_relatorio: relatorioId };
            req(`v1/app/${dados.tipo_relatorio}/relatorio/download-file`, 'POST', data,
                function(res) {
                    if (res.data) {
                        const url = res.data;
                        const link = document.createElement('a');
                        link.href = url;
                        const nomeExtraido = url.substring(url.lastIndexOf('/') + 1);
                        link.download = nomeExtraido || 'download';
                        link.target = '_blank';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }
                },
                function(error) {
                    avisos('Relatório', error && error.message ? error.message : 'Erro ao baixar relatório', 'error');
                }
            );
        },
        monitorarRelatorio: function(tipo_relatorio ,relatorioId, notificationId, intervalo = 3000, tentativasMaximas = 20) {
            // Verifica se já existe um monitoramento em andamento para esta notificação
            const existingNotification = this.notifications.find(n => n.id === notificationId);
            if (!existingNotification || existingNotification.progress === false) {
                return;
            }        
            let tentativas = 0;
            const self = this;        
            const verificar = () => {
                // Verifica novamente se a notificação ainda existe
                const currentNotification = self.notifications.find(n => n.id === notificationId);
                if (!currentNotification) return;        
                const data = { id_relatorio: relatorioId };                
                req(`v1/app/${tipo_relatorio}/relatorio/get-status`, 'POST', data,
                    function(res) {
                        const notification = self.notifications.find(n => n.id === notificationId);
                        if (!notification) return;
                        console.log(notification)
                        if (res.data.status == 'Completo') {
                            // Atualiza a notificação para concluída
                            notification.title = "Relatório pronto";
                            notification.description = "Seu relatório foi gerado com sucesso";
                            notification.type = "success";
                            notification.action = "baixarRelatorio";
                            notification.actionParams = {tipo_relatorio:tipo_relatorio, relatorio_id: relatorioId};
                            notification.relatorio_id = relatorioId
                            notification.tipo_relatorio = tipo_relatorio
                            notification.icon = "check-circle";
                            notification.progress = false;
                            notification.progressValue = 100;
                            notification.buttons = [{
                                text: "Download",
                                action: "baixarRelatorio",
                                class: "btn-success",
                                relatorio_id: relatorioId
                            }];
                            
                            self.saveToStorage();
                            self.renderAll();
                        } else if (tentativas < tentativasMaximas) {
                            // Atualiza o progresso
                            const progresso = Math.min(95, (tentativas / tentativasMaximas) * 100);
                            notification.progressValue = progresso;
                            notification.description = `Processando... (${Math.round(progresso)}%)`;
                            notification.relatorio_id = relatorioId
                            notification.tipo_relatorio = tipo_relatorio
                            notification.actionParams = {tipo_relatorio:tipo_relatorio, relatorio_id: relatorioId};
                            notification.progress = true;

                            tentativas++;
                            setTimeout(verificar, intervalo);
                            
                            self.saveToStorage();
                            self.renderAll();
                        } else {
                            // Tempo esgotado
                            notification.title = "Falha no processamento";
                            notification.description = "O relatório não foi gerado no tempo esperado";
                            notification.type = "error";
                            notification.icon = "times-circle";
                            notification.progress = false;
                            notification.relatorio_id = relatorioId
                            notification.tipo_relatorio = tipo_relatorio
                            notification.actionParams = {tipo_relatorio:tipo_relatorio, relatorio_id: relatorioId};

                            self.saveToStorage();
                            self.renderAll();
                        }
                    },
                    function(error) {
                        const notification = self.notifications.find(n => n.id === notificationId);
                        if (notification) {
                            notification.title = "Erro no processamento";
                            notification.description = error && error.message ? error.message : 'Erro ao gerar relatório';
                            notification.type = "error";
                            notification.icon = "times-circle";
                            notification.progress = false;
                            notification.relatorio_id = relatorioId
                            notification.actionParams = {relatorio_id: relatorioId};

                            self.saveToStorage();
                            self.renderAll();
                        }
                    }
                );
            };
        
            verificar();
        },
        userResetPass:  function(dados) {
            perfil_modal.showModal()
            window.bashProfile.mostrarResetSenha();
        },
        showDrawer: function() {
            $('#notifications-drawer').prop('checked', true);
        },
        hideDrawer: function() {
            $('#notifications-drawer').prop('checked', false);
        }
    };
    window.bashNotifications.init();
}
$(document).ready(function () {
    // Inicialização
    updateNotificationBell();

    // Atualizações periódicas
    setInterval(fetchNotifications, 360000);
    // $(window).on('focus', fetchNotifications);
});
function updateNotificationBell() {
    if (!window.bashNotifications || !window.bashNotifications.notifications) {
        console.error('bashNotifications não está definido corretamente');
        return;
    }

    const $icon = $('#bash-notification-icon');
    const $badge = $('#bash-notification-count');
    const unreadCount = window.bashNotifications.notifications.filter(n => !n.read).length;

    if (unreadCount > 0) {
        $icon.addClass('animate-bounce');
        $badge.text(unreadCount).removeClass('hidden');

        const currentCount = parseInt($badge.text() || 0);
        if (unreadCount > currentCount) {
            triggerNewNotificationEffect();
        }
    } else {
        $icon.removeClass('animate-bounce');
        $badge.addClass('hidden');
    }
}
function triggerVisualEffect() {
    $('#bash-notification-icon').addClass('animate-pulse text-error');
    setTimeout(() => {
        $('#bash-notification-icon').removeClass('animate-pulse text-error');
    }, 2000);
}
function triggerNewNotificationEffect() {
    $('#bash-notification-icon').addClass('animate-pulse text-primary');
    setTimeout(() => {
        $('#bash-notification-icon').removeClass('animate-pulse text-primary');
    }, 3000);
}
function fetchNotifications() {
    // return     
    reqIfError(`v1/sessao/notificacoes`, 'GET', {},
        function (res) {
            if (res && res.data) {
                const oldCount = window.bashNotifications.notifications.filter(n => !n.read).length;
                // Adiciona novas notificações
                res.data.forEach(newNotif => {
                    const exists = window.bashNotifications.notifications.some(n => n.id === newNotif.id || n.id === "chamados");
                    if (!exists) {
                        const notification = {
                            id: "chamados",
                            title: "Chamados Pendentes",
                            description: "Verifique assim que possivel!",
                            type: "info",
                            buttons: [
                                {
                                    text: "Ver",
                                    action: "showDrawer",
                                    class: "btn-primary"
                                }
                            ],
                            listaChamados:res.data,
                            icon: "list-check",
                            texto: `Identificamos ${res.data.length} chamados pendentes para seu setor...`,
                        };
                        window.bashNotifications.addNotification(notification);
                    }else{
                        notfic= window.bashNotifications.notifications.find(n => n.id === newNotif.id || n.id === "chamados")
                        if (notfic.listaChamados.length != res.data.length) {
                            const notification = {
                                id: "chamados",
                                title: "Chamados Pendentes",
                                description: "Verifique assim que possivel!",
                                type: "info",
                                buttons: [
                                    {
                                        text: "Ver",
                                        action: "showDrawer",
                                        class: "btn-primary"
                                    }
                                ],
                                listaChamados:res.data,
                                icon: "list-check",
                                texto: `Identificamos ${res.data.length} chamados pendentes para seu setor...`,
                            };
                            window.bashNotifications.updateNotification(notification)
                        }
                    }
                });
                // Verifica se há novas não lidas
                const newUnread = window.bashNotifications.notifications.filter(n => !n.read).length;
                if (newUnread > oldCount) {
                    if (typeof showNewNotificationsAlert === 'function') {
                        showNewNotificationsAlert(newUnread - oldCount);
                    }
                }
            }
        },
        function (error) {
            // avisos('Relatório', error && error.message ? error.message : 'Erro ao buscar relatório', 'error');
            console.error('Erro ao buscar notificações');
        }
    );
}
function bashNotificationClearList() {
    window.bashNotifications.markAllAsRead();
}
function removeNotification(id) {
    window.bashNotifications.removeNotification(id);
}
