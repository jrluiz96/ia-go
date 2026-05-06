function wbCreateModalOverlay() {
    return $('<div>', {
        class: 'chat-overlay hidden'
    });
}

function wbClearChat() {
    const userId = getUserSession.id;

    // Limpa as mensagens da tela
    $('.messages-container').empty();

    // Reseta a conversa no localStorage com mensagem inicial
    const defaultConversation = {
        id: 1,
        title: 'Assistente IA',
        messages: [
            {
                sender: 'assistant',
                text: 'Olá, sou o Assistente Virtual Bash, \nComo posso ajudar?',
                timestamp: new Date().toISOString(),
                status: 'read'
            }
        ],
        lastMessage: 'Olá, sou o Assistente Virtual Bash, \nComo posso ajudar?'
    };

    localStorage.setItem(`wbChatConversations_${userId}`, JSON.stringify([defaultConversation]));

    // Recarrega a mensagem inicial na tela
    $('.messages-container').append(
        $('<div>', {
            class: 'p-3 mb-2 rounded-lg max-w-[80%] bg-info text-info-content mr-auto',
            html: formatarMensagem(defaultConversation.messages[0].text)
        })
    );

    // Mostra notificação de sucesso
    if (typeof avisos === 'function') {
        avisos('Chat Limpo', 'O histórico de conversa foi limpo com sucesso', 'success');
    }
}

function wbHandleSystemChange(systemValue) {
    console.log('🔄 Sistema alterado para:', systemValue);

    // Limpa o chat
    wbClearChat();

    // Salva o sistema selecionado no localStorage
    const userId = getUserSession.id;
    localStorage.setItem(`wbChatSystem_${userId}`, systemValue);

    // Mostra notificação
    if (typeof avisos === 'function') {
        const systemNames = {
            'caern': 'CAERN',
            'multiskill': 'Multiskill',
            'copergas': 'Copergas'
        };
        avisos('Sistema Alterado', `Sistema alterado para ${systemNames[systemValue]}`, 'info');
    }
}
// function wbCreateChatContent() {
//     return $('<div>', {
//         class: 'chat-box fixed bottom-20 right-4 h-[70vh] w-[70vw] rounded-lg shadow-lg hidden flex flex-col overflow-hidden z-[49]'
//     });
// }
function wbCreateChatContent() {
    return $('<div>', {
        class: 'chat-box fixed bottom-7 right-3 h-[80vh] w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl sm:h-[70vh] md:h-[60vh] lg:h-[50vh] rounded-lg shadow-lg hidden flex flex-col'
    });
}

function wbCreateApp() {
    try {
        // Valida se getUserSession existe e retorna dados
        if (typeof getUserSession !== 'function') {
            return null;
        }

        const userSession = getUserSession();

        if (!userSession || !userSession.id) {
            return null;
        }

        let userId = userSession.id;

        const wbChatApp = $('<div>', {
            class: 'chat-ia-container chatIa fixed rounded-lg bottom-4 right-4 z-[49]'
        });

        const wbChatContent = wbCreateChatContent();

        localStorage.setItem('wbChatUser', userId);


        initConversations(userId);
        const wbChatLoader = $('<div>', {
            id: 'loaderMsg',
            class: 'spinner-grow text-info w-full text-center hidden animate-pulse'
        }).append($('<div>', {
            id: 'loading-dots',
            text: "..."
        }));

        wbChatContent.append(wbCreateChatHeader());

        // Restaurar sistema selecionado do localStorage
        const savedSystem = localStorage.getItem(`wbChatSystem_${userId}`) || 'caern';
        setTimeout(() => {
            $('#chat-ia-select-system').val(savedSystem);
        }, 100);

        // Cria o chat body em largura total
        let chatBody = wbCreateChatBody();

        let mainContent = $('<div>', {
            class: 'flex flex-1 h-[calc(90%-50px)] bg-base-200'
        }).append(
            chatBody
        );
        wbChatContent.append(mainContent);

        wbChatContent.append(wbChatLoader);

        wbChatContent.append(wbCreateChatFooter());

        wbChatContent.append(wbCreateModalOverlay());

        wbChatApp.append(wbChatContent);
        const wbChatToggler = $('<button>', {
            id: 'wbChatToggler',
            html: '<i class="fas fa-comment"></i>',
            class: 'wb-chat-toggler w-14 h-14 rounded-full bg-primary text-white text-2xl text-center leading-[56px] shadow-md cursor-pointer flex items-center justify-center hover:bg-primary-dark',
            click: function () {
                $('.chat-box').toggle();
            }
        });

        wbChatApp.append(wbChatToggler);
 
        return wbChatApp;

    } catch (error) {
        return null;
    }
}
function getAssistantResponse(message, conversation, conversations) {
    let userId = getUserSession.id

    // Obtém o sistema selecionado do localStorage ou usa 'caern' como padrão
    const selectedSystem = parseInt(localStorage.getItem(`wbChatSystem_${userId}`), 10);

    const lowerMsg = message.toLowerCase();
    const data = {
        message: message,
        system: selectedSystem
    };
    reqAjuda(`ajuda`, 'POST', data, (response) => {
        if (response.data) {
            $('.messages-container').append(
                $('<div>', {
                    class: 'p-3 mb-2 rounded-lg max-w-[80%] bg-info text-info-content mr-auto',
                    html: formatarMensagem(response.data.resposta)
                })
            );
            conversations.forEach(c => {
                if (c.id === conversation.id) {
                    c.messages.push({
                        sender: 'assistant',
                        text: response.data.resposta,
                        timestamp: new Date().toISOString()
                    });
                }
            });
            localStorage.setItem(`wbChatConversations_${userId}`, JSON.stringify(conversations));
            setTimeout(() => {
                let container = $('.messages-container');
                container.scrollTop(container[0].scrollHeight);
            }, 50);
        } else {
            avisos('Assistente Ajuda', response.message || 'Falha na comunicação com o assistente', 'error');
        }
    }, (error) => {
        avisos('Assistente Ajuda', 'Falha na comunicação com o servidor', 'error');
        console.error(error);
    });
}
function sendMessage(userId) {
    const messageInput = $('.message-input');
    const messageText = messageInput.val().trim();

    if (messageText) {
        // Verifica se está no assistente ou em uma conversa
        const conversationTitle = $('.chat-header span').text();
        const conversations = JSON.parse(localStorage.getItem(`wbChatConversations_${userId}`)) || [];
        const conversation = conversations.find(c => c.title === conversationTitle || ('Conversa ' + c.id) === conversationTitle);

        if ($('.chat-header span').text() === 'Assistente IA') {
            $('.chat-body .messages-container').append(
                $('<div>', {
                    class: 'user-message p-3 mb-2 bg-primary text-white rounded-lg ml-auto max-w-[80%]',
                    text: messageText
                })
            );
            if (conversation) {
                conversations.forEach(c => {
                    if (c.id === conversation.id) {
                        c.messages.push({
                            sender: 'user',
                            text: messageText,
                            timestamp: new Date().toISOString()
                        });
                    }
                });
                localStorage.setItem(`wbChatConversations_${userId}`, JSON.stringify(conversations));
            }
            getAssistantResponse(messageText, conversation, conversations)
            let container = $('.messages-container');
            container.scrollTop(container[0].scrollHeight);
        } else {
            if (conversation) {
                conversations.forEach(c => {
                    if (c.id === conversation.id) {
                        c.messages.push({
                            sender: 'user',
                            text: messageText,
                            timestamp: new Date().toISOString()
                        });
                    }
                });
                localStorage.setItem(`wbChatConversations_${userId}`, JSON.stringify(conversations));

                // Atualiza a UI
                $('.chat-body').append(
                    $('<div>', {
                        class: 'user-message p-3 mb-2 bg-primary text-white rounded-lg ml-auto max-w-[80%]',
                        text: messageText
                    })
                );

                // Rola para baixo
                let container = $('.messages-container');
                container.scrollTop(container[0].scrollHeight);
            }
        }

        // Limpa o campo de entrada
        messageInput.val('');
    }
}
function openConversation(userId, conversationId) {
    const conversations = JSON.parse(localStorage.getItem(`wbChatConversations_${userId}`)) || [];
    const conversation = conversations.find(c => c.id === conversationId);

    if (conversation) {
        // Atualiza o cabeçalho
        $('.chat-header span').text(conversation.title || 'Conversa ' + conversation.id);

        // Limpa o container de mensagens
        const messagesContainer = $('.messages-container');
        messagesContainer.empty();

        // Carrega as mensagens da conversa
        conversation.messages.forEach(msg => {
            const isUser = msg.sender === 'user';
            const messageEl = $('<div>', {
                class: `p-3 mb-2 rounded-lg max-w-[80%] ${isUser ? 'bg-primary text-primary-content ml-auto' : 'bg-info text-info-content mr-auto'}`,
                text: msg.text
            });
            messagesContainer.append(messageEl);
        });

        // Rola para baixo
        messagesContainer.scrollTop(messagesContainer[0].scrollHeight);
    }

    buscarNumeros();
}
function loadConversation(conversationId) {
    let messagesContainer = $('.messages-container');
    messagesContainer.empty();

    // Simulação de carregamento de mensagens
    let messages = [
        { sender: 'them', text: 'Olá! Como posso ajudar?' },
        { sender: 'me', text: 'Preciso de informação sobre meu pedido' },
        { sender: 'them', text: 'Claro! Qual é o número do seu pedido?' }
    ];

    messages.forEach(msg => {
        messagesContainer.append(
            $('<div>', {
                class: `message ${msg.sender === 'me' ? 'my-message' : 'their-message'} mb-2 p-2 rounded max-w-[80%]`,
                text: msg.text
            })
        );
    });

    // Rolagem para baixo
    messagesContainer.scrollTop(messagesContainer[0].scrollHeight);
}


function wbCreateChatFooter(userId) {
    const footer = $('<div>', {
        class: 'chat-footer bg-base-200 rounded-b-lg border-t p-2'
    });

    const inputGroup = $('<div>', {
        class: 'flex gap-2'
    });

    const messageInput = $('<input>', {
        type: 'text',
        placeholder: 'Digite sua mensagem...',
        class: 'message-input flex-1 p-2 input input-bordered rounded focus:outline-none focus:ring-1 focus:ring-primary',
        keypress: function (e) {
            if (e.which === 13) {
                sendMessage(userId);
            }
        }
    });

    const sendButton = $('<button>', {
        html: '<i class="fas fa-paper-plane"></i>',
        class: 'send-btn btn btn-primary hover:bg-primary-dark',
        click: function () {
            sendMessage(userId);
        }
    });

    // <div class="border-t border-base-300 pt-4 flex-none">
    //         <div class="flex gap-2">
    //             <input type="text" placeholder="Digite sua mensagem..." class="input input-bordered w-full" disabled="">
    //             <button class="btn btn-primary" disabled="">Enviar</button>
    //         </div>
    //     </div>

    inputGroup.append(messageInput, sendButton);
    footer.append(inputGroup);

    return footer;
}
function wbCreateChatBody() {
    return $('<div>', {
        class: 'chat-body flex-1 flex flex-col h-full overflow-hidden'
    }).append(
        $('<div>', {
            class: 'messages-container flex-1 overflow-y-auto p-4'
        })
    );
}

function buscarNumeros() {
    console.debug("🔍 Buscando números WhatsApp...");
    const url = `v1/relatorios/options/empresas`;
    const response = req(url, "GET", null, (response)=>{
        console.log(response)
        popularSelect("chat-ia-select-system", response.data, "nome", "id")
    }, (error)=>{
        console.error("❌ Erro ao buscar números:", error);
    });
}


function wbCreateChatHeader(numbers) {
    return $('<div>', {
        class: 'chat-header rounded-t-lg bg-primary text-primary-content px-4 py-3 flex justify-between items-center'
    }).append(
        $('<div>', {
            class: 'flex items-center space-x-2'
        }).append(
            $('<i>', {
                class: 'fas fa-robot mr-2'
            }),
            $('<span>', {
                text: 'Assistente Virtual',
                class: 'font-semibold'
            })
        ),
        $('<div>', {
            class: 'flex items-center gap-2'
        }).append(
            $('<select>', {
                id: 'chat-ia-select-system',
                class: 'select select-sm bg-primary-focus text-base-content border-primary-focus',
                html: `
                `,
                change: function () {
                    wbHandleSystemChange($(this).val());
                }
            }),
            $('<button>', {
                html: '<i class="fas fa-trash-alt"></i>',
                class: 'clear-chat btn btn-sm btn-ghost text-white hover:bg-primary-focus',
                title: 'Limpar conversa',
                click: function () {
                    abrirModalRemocao({
                        titulo: 'Limpar Conversa',
                        mensagem: 'Tem certeza que deseja limpar todo o histórico da conversa?',
                        labelRemover: 'Limpar',
                        labelCancelar: 'Cancelar',
                        onConfirm: () => {
                            wbClearChat();
                        }
                    });
                }
            }),
            $('<button>', {
                html: '×',
                class: 'close-chat text-white text-2xl cursor-pointer hover:text-gray-200',
                click: function () {
                    $('.chat-box').hide();
                    $('#wbChatToggler').removeClass('active');
                }
            })
        )
    );
}
function initConversations(userId) {
    console.log('🔄 [INIT] Inicializando conversas para userId:', userId);

    let existing = localStorage.getItem(`wbChatConversations_${userId}`);
    console.log('💾 [INIT] Conversas existentes no localStorage:', existing ? 'SIM' : 'NÃO');

    if (!existing) {
        console.log('📝 [INIT] Criando conversa padrão...');
        const defaultConversation = {
            id: 1,
            title: 'Assistente IA',
            messages: [
                {
                    sender: 'assistant',
                    text: 'Olá, sou o Assistente Virtual Bash, \nComo posso ajudar?',
                    timestamp: new Date().toISOString(),
                    status: 'read'
                }
            ],
            lastMessage: 'Olá, sou o Assistente Virtual Bash, \nComo posso ajudar?'
        };
        localStorage.setItem(`wbChatConversations_${userId}`, JSON.stringify([defaultConversation]));
        console.log('✅ [INIT] Conversa padrão salva no localStorage');
    }
    // Carrega automaticamente a conversa única
    const conversations = JSON.parse(localStorage.getItem(`wbChatConversations_${userId}`));
    console.log('📋 [INIT] Conversas carregadas:', conversations);

    if (conversations && conversations.length > 0) {
        console.log('⏰ [INIT] Agendando abertura da conversa em 100ms...');
        setTimeout(() => {
            console.log('📂 [INIT] Abrindo conversa:', conversations[0].id);
            openConversation(userId, conversations[0].id);
        }, 100);
    } else {
        console.warn('⚠️ [INIT] Nenhuma conversa encontrada para carregar');
    }
}


