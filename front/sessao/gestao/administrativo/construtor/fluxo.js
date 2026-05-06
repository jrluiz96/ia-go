(function () {
    var opcao = [];

    // Armazena funções vindas da API (all_funcoes)
    var FUNCOES_API = [];

    // Modais do fluxograma
    let fluxoIniciadoModal = null;
    let fluxoAddMensagemModal = null;
    let fluxoEditModal = null;

    fluxoPage = {
        jquery: {
            body: $('#fluxograma-ura-body')
        },
        script: {
            body: document.getElementById('fluxograma-ura-body')
        }
    };

    // Função auxiliar para escapar HTML caso não esteja disponível globalmente
    function escapeHtml(text) {
        if (typeof window.escapeHtml === 'function') {
            return window.escapeHtml(text);
        }

        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Obtém função da API por ID ou Nome
    function getFuncaoById(funcaoId) {
        return FUNCOES_API.find(f => f.ID == funcaoId || f.Nome === funcaoId);
    }

    // Converte Parametros.mensagem_texto para formato de restrições
    function getRestricoesDaAPI(funcaoId) {
        const funcao = getFuncaoById(funcaoId);

        if (!funcao || !funcao.Parametros || !funcao.Parametros.mensagem_texto) {
            return {
                permite_header: true,
                permite_body: true,
                permite_footer: true,
                permite_botoes: true
            };
        }

        const mt = funcao.Parametros.mensagem_texto;
        return {
            permite_header: mt.header !== false,
            permite_body: mt.body !== false,
            permite_footer: mt.footer !== false,
            permite_botoes: mt.button !== false,
            permite_texto: (mt.header !== false || mt.body !== false || mt.footer !== false)
        };
    }

    // Validação genérica antes de salvar (baseada na API)
    function validarRestricoesFuncaoAntesSalvar(funcaoId, buttons, messageStructure) {
        const funcao = getFuncaoById(funcaoId);
        if (!funcao) return null;

        const restricoes = getRestricoesDaAPI(funcaoId);

        // Validar botões
        if (!restricoes.permite_botoes && buttons.length > 0) {
            return `A função "${funcao.Descricao}" não permite botões interativos`;
        }

        // Validar header
        if (!restricoes.permite_header && messageStructure.header) {
            return `A função "${funcao.Descricao}" não permite Header`;
        }

        // Validar body
        if (!restricoes.permite_body && messageStructure.body) {
            return `A função "${funcao.Descricao}" não permite Body`;
        }

        // Validar footer
        if (!restricoes.permite_footer && messageStructure.footer) {
            return `A função "${funcao.Descricao}" não permite Footer`;
        }

        // Sem erros
        return null;
    }

    // Validação de campos obrigatórios baseada nos Parametros da API
    function validarCamposObrigatorios(funcaoId, config) {
        const funcao = getFuncaoById(funcaoId);
        if (!funcao || !funcao.Parametros) {
            return null;
        }

        // Verificar campos obrigatórios baseado nos Parametros
        // Exemplo: se tem "callphone" ou "webbot" nos Parametros, validar
        const parametros = funcao.Parametros;

        // Para função de fila: validar que pelo menos uma fila foi selecionada
        if (funcao.Nome === 'queue' || funcao.Nome === 'fila') {
            if (!config.queue_webbot && !config.queue_callphone) {
                return 'Selecione uma fila (Webbot ou Callphone)';
            }
        }

        return null;
    }

    // Aplica restrições visuais baseado nos Parametros da API
    function aplicarRestricoesFuncao(funcaoId, modalPrefix = 'add') {
        // Se não tem função, remover todas as restrições
        if (!funcaoId) {
            liberarTodosCampos(modalPrefix);
            return;
        }

        const funcao = getFuncaoById(funcaoId);
        if (!funcao) {
            liberarTodosCampos(modalPrefix);
            return;
        }

        const restricoes = getRestricoesDaAPI(funcaoId);

        // 1. GERENCIAR BOTÕES
        gerenciarBotoes(restricoes.permite_botoes, modalPrefix, funcao.Descricao);

        // 2. GERENCIAR CAMPOS DE TEXTO (body e footer)
        gerenciarCamposTexto(restricoes.permite_body, restricoes.permite_footer, modalPrefix);

        // 3. GERENCIAR HEADER
        gerenciarHeader(restricoes.permite_header, modalPrefix);

        // 4. MOSTRAR ALERTAS DE RESTRIÇÃO
        mostrarAlertaRestricao(restricoes, modalPrefix, funcao.Descricao);
    }

    // Gerencia bloqueio/liberação de botões
    function gerenciarBotoes(permiteBotoes, modalPrefix, descricaoFuncao) {
        const botoesContainer = document.getElementById(`buttons_container_${modalPrefix}`);
        const buttonActions = botoesContainer ? botoesContainer.closest('.mt-6') : null;

        if (!permiteBotoes) {
            // Bloquear seção de botões
            if (buttonActions) {
                buttonActions.classList.add('opacity-50', 'pointer-events-none');
            }
            // Limpar botões e mostrar aviso
            if (botoesContainer) {
                botoesContainer.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="fas fa-info-circle"></i>
                        <span>${descricaoFuncao} - Botões não permitidos</span>
                    </div>
                `;
            }
        } else {
            // Liberar seção de botões
            if (buttonActions) {
                buttonActions.classList.remove('opacity-50', 'pointer-events-none');
            }
            // Restaurar container se estava com aviso
            if (botoesContainer && botoesContainer.querySelector('.alert-warning')) {
                botoesContainer.innerHTML = '';
            }
        }
    }

    // Gerencia bloqueio/liberação de campos de texto individuais
    function gerenciarCamposTexto(permiteBody, permiteFooter, modalPrefix) {
        // Body
        const bodyField = document.getElementById(`body_text_${modalPrefix}`);
        if (bodyField) {
            if (!permiteBody) {
                bodyField.disabled = true;
                bodyField.value = '';
                bodyField.placeholder = '🚫 Body não permitido para esta função';
                bodyField.classList.add('input-disabled', 'bg-base-200');
            } else {
                bodyField.disabled = false;
                bodyField.placeholder = 'Digite o corpo da mensagem';
                bodyField.classList.remove('input-disabled', 'bg-base-200');
            }
        }

        // Footer
        const footerField = document.getElementById(`footer_text_${modalPrefix}`);
        if (footerField) {
            if (!permiteFooter) {
                footerField.disabled = true;
                footerField.value = '';
                footerField.placeholder = '🚫 Footer não permitido para esta função';
                footerField.classList.add('input-disabled', 'bg-base-200');
            } else {
                footerField.disabled = false;
                footerField.placeholder = 'Texto do rodapé (opcional)';
                footerField.classList.remove('input-disabled', 'bg-base-200');
            }
        }
    }

    // Gerencia bloqueio/liberação de header
    function gerenciarHeader(permiteHeader, modalPrefix) {
        const headerTipoSelect = document.getElementById(`header_tipo_${modalPrefix}`);
        const headerTextInput = document.getElementById(`header_text_${modalPrefix}`);

        if (!permiteHeader) {
            // Bloquear todos os campos de header
            if (headerTipoSelect) {
                headerTipoSelect.disabled = true;
                headerTipoSelect.value = '';
            }
            if (headerTextInput) {
                headerTextInput.disabled = true;
                headerTextInput.value = '';
                headerTextInput.placeholder = '🚫 Header não permitido';
            }

            // Esconder todos os campos dinâmicos de header
            const headerFields = document.querySelectorAll(`[id^="header_"][id$="_${modalPrefix}"]`);
            headerFields.forEach(field => {
                if (field.id !== `header_tipo_${modalPrefix}`) {
                    field.classList.add('hidden');
                }
            });
        } else {
            // Liberar header
            if (headerTipoSelect) {
                headerTipoSelect.disabled = false;
            }
            if (headerTextInput) {
                headerTextInput.disabled = false;
                headerTextInput.placeholder = 'Texto do cabeçalho';
            }
        }
    }

    // Mostra alertas de restrição baseado nos Parametros da API
    function mostrarAlertaRestricao(restricoes, modalPrefix, descricaoFuncao) {
        const alertContainer = document.getElementById(`restricao-alert-${modalPrefix}`);
        if (!alertContainer) return;

        const alertas = [];

        if (!restricoes.permite_botoes) {
            alertas.push('🚫 Botões interativos desabilitados');
        }

        if (!restricoes.permite_header) {
            alertas.push('🚫 Header desabilitado');
        }

        if (!restricoes.permite_body) {
            alertas.push('🚫 Body desabilitado');
        }

        if (!restricoes.permite_footer) {
            alertas.push('🚫 Footer desabilitado');
        }

        if (alertas.length > 0) {
            alertContainer.innerHTML = `
                <div class="alert alert-warning">
                    <div>
                        <i class="fa fa-exclamation-triangle"></i>
                        <div>
                            <strong>${descricaoFuncao}</strong>
                            <ul class="list-disc list-inside mt-1 text-sm">
                                ${alertas.map(a => `<li>${a}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
            `;
        } else {
            alertContainer.innerHTML = '';
        }
    }

    // Libera todos os campos (quando não há função selecionada)
    function liberarTodosCampos(modalPrefix) {
        gerenciarBotoes(true, modalPrefix, '');
        gerenciarCamposTexto(true, true, modalPrefix);
        gerenciarHeader(true, modalPrefix);

        const alertContainer = document.getElementById(`restricao-alert-${modalPrefix}`);
        if (alertContainer) {
            alertContainer.innerHTML = '';
        }
    }


    async function findOptionsFluxo() {
        const boteriaId = localStorage.getItem('boteria_id');
        const empresaId = window.BashFluxos?.STATE?.fluxos?.fluxoEmpresaSelected;
        const optionsUrl = empresaId
            ? `v1/admin/fluxos/options?empresa_id=${empresaId}`
            : 'v1/admin/fluxos/options';
        return await new Promise((resolve) => {
            req(optionsUrl, 'GET', null,
                function (response) {
                    if (response && response.code === 200) {
                        const boterias = response.data || [];

                        const options = boterias.map(boteria => {
                            const selected = boteria.id == boteriaId ? 'selected' : '';
                            return `<option value="${boteria.id}" ${selected}>${boteria.nome}</option>`;
                        }).join('');

                        resolve(options || '<option value="">Nenhuma boteria encontrada</option>');
                    } else {
                        resolve('<option value="">Falha ao carregar opções</option>');
                    }
                },
                function (error) {
                    console.error('Erro ao buscar opções de fluxos:', error);
                    avisos('Erro', 'Erro ao carregar opções de fluxos', 'error');
                    resolve('<option value="">Erro ao carregar opções</option>');
                }
            );
        });
    }

    // ============ UTILS ============
    const UTILS = {
        getFuncaoById,
        getRestricoesDaAPI,
        aplicarRestricoesFuncao,
        validarRestricoesFuncaoAntesSalvar,
        validarCamposObrigatorios,
        gerenciarBotoes,
        gerenciarCamposTexto,
        gerenciarHeader,
        escapeHtml
    };

    function voltarParaFluxos() {
        const _container = document.querySelector('#fluxos-modal-container')
        if (_container) _container.innerHTML = ''

        if(fluxoAddMensagemModal) {
            fluxoAddMensagemModal.destroy();
            fluxoAddMensagemModal = null;
        }

        if(fluxoEditModal) {
            fluxoEditModal.destroy();
            fluxoEditModal = null;
        }

        if (fluxoIniciadoModal) {
            fluxoIniciadoModal.destroy();
            fluxoIniciadoModal = null;
        }

        // Limpar localStorage
        localStorage.removeItem('boteria_id');

        // Limpar conteúdo do fluxograma primeiro
        const conteudoFluxograma = document.getElementById('conteudo-fluxograma');
        if (conteudoFluxograma) {
            conteudoFluxograma.innerHTML = '';
        }

        // Mostrar container principal e esconder fluxograma
        document.getElementById('boteria-container').classList.remove('hidden');
        document.getElementById('ura-fluxograma').classList.add('hidden');
        // Destruir instância do GoJS se existir
        if (window.diagram) {
            window.diagram.clear();
            window.diagram = null;
        }
        console.log('Voltou para a lista de fluxos');
    }

    function init() {
        document.getElementById('btn-voltar-ura')?.addEventListener('click', voltarParaFluxos);
        console.log('Inicializando fluxograma...');

        // Event listener para o formulário de fluxo iniciado
        document.addEventListener('submit', function (e) {
            if (e.target.id === 'fluxo-iniciado-form') {
                e.preventDefault();
                handleFluxoIniciadoSubmit(e.target);
            }
        });

        // Verificar se existe boteria_id no localStorage
        const boteriaId = localStorage.getItem('boteria_id');
        if (!boteriaId) {
            avisos('Nenhum fluxo selecionado. Voltando para a lista de fluxos.', 'fluxos', 'error');
            voltarParaFluxos();
            return;
        }
        // Carregar template HTML do fluxograma primeiro
        loadFluxogramaTemplate(boteriaId);
        $('#adicionar-fluxo-btn').on('click', () => openModalAdicionarFluxo(boteriaId));
    }

    function openModalFluxoIniciado(currentStartFluxoId) {
        console.log('Abrindo modal Fluxo Iniciado');
        console.log('Start Fluxo ID atual:', currentStartFluxoId);

        const boteriaId = localStorage.getItem('boteria_id');
        if (!boteriaId) {
            avisos('Erro', 'ID da boteria não encontrado', 'error');
            return;
        }

        // Destruir modal existente se houver
        if (fluxoIniciadoModal) {
            fluxoIniciadoModal.destroy();
        }

        // Criar nova instância do modal
        fluxoIniciadoModal = new BashModal({
            id: 'fluxo-iniciado-modal',
            titulo: '🚀 Configurar Fluxo Iniciado',
            classSize: 'w-11/12 max-w-2xl',
            container: 'body',
            destroy: true
        });

        // Mostrar loading
        fluxoIniciadoModal.setContent('<div class="flex justify-center items-center p-8"><span class="loading loading-spinner loading-lg"></span></div>');
        fluxoIniciadoModal.open();

        // Buscar fluxos disponíveis da API
        const _empId = window.BashFluxos?.STATE?.fluxos?.fluxoEmpresaSelected;
        const _boteriaUrl = _empId
            ? `v1/admin/fluxos/boteria/${boteriaId}?empresa_id=${_empId}`
            : `v1/admin/fluxos/boteria/${boteriaId}`;
        req(_boteriaUrl, 'GET', null,
            function (response) {
                if (response && response.code === 200) {
                    const availableFluxos = response.data || [];
                    console.log('Fluxos disponíveis:', availableFluxos);
                    const form = createFluxoIniciadoForm(currentStartFluxoId, availableFluxos);
                    fluxoIniciadoModal.setContent(form);
                } else {
                    fluxoIniciadoModal.close();
                    avisos('Erro', response.message || 'Erro ao carregar fluxos disponíveis', 'error');
                }
            },
            function (error) {
                fluxoIniciadoModal.close();
                avisos('Erro', 'Erro ao conectar com o servidor', 'error');
                console.error('Erro ao buscar fluxos:', error);
            }
        );
    }

    function createFluxoIniciadoForm(currentStartFluxoId, availableFluxos) {
        // Criar opções do select com os fluxos disponíveis
        let optionsHtml = '<option value="">Selecione o fluxo inicial...</option>';

        if (availableFluxos && availableFluxos.length > 0) {
            availableFluxos.forEach(fluxo => {
                const selected = fluxo.id == currentStartFluxoId ? 'selected' : '';
                const fluxoName = fluxo.nome || `Fluxo ${fluxo.id}`;
                optionsHtml += `<option value="${fluxo.id}" ${selected}>${escapeHtml(fluxoName)}</option>`;
            });
        }

        return `
            <form id="fluxo-iniciado-form" class="space-y-4">
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i>
                    <span>Configure qual fluxo será executado quando o atendimento for iniciado.</span>
                </div>

                <div class="form-control">
                    <label class="label">
                        <span class="label-text font-medium">Fluxo Inicial *</span>
                    </label>
                    <select name="start_fluxo_id" class="select select-bordered w-full" required>
                        ${optionsHtml}
                    </select>
                    <label class="label">
                        <span class="label-text-alt">Este será o primeiro fluxo executado ao iniciar o atendimento</span>
                    </label>
                </div>

                <div class="modal-action">
                    <button type="button" class="btn btn-ghost" data-action="close-modal-fluxo-iniciado">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    <button type="submit" class="btn btn-primary">
                        <span id="fluxo-iniciado-loading" class="loading loading-spinner loading-sm hidden"></span>
                        <i class="fas fa-save"></i> Salvar Configuração
                    </button>
                </div>
            </form>
        `;
    }

    function handleFluxoIniciadoSubmit(form) {
        const formData = new FormData(form);
        const startFluxoId = formData.get('start_fluxo_id');
        const boteriaId = localStorage.getItem('boteria_id');

        if (!startFluxoId) {
            avisos('Atenção', 'Por favor, selecione um fluxo inicial', 'warning');
            return;
        }

        if (!boteriaId) {
            avisos('Erro', 'ID da boteria não encontrado', 'error');
            return;
        }

        const loading = document.getElementById('fluxo-iniciado-loading');
        if (loading) loading.classList.remove('hidden');

        const data = {
            start_fluxo_id: parseInt(startFluxoId)
        };

        console.log('Atualizando start_fluxo_id:', data);

        req(`v1/admin/fluxos/${boteriaId}`, 'PUT', data,
            function (response) {
                if (loading) loading.classList.add('hidden');
                if (response && response.code === 200) {
                    avisos('Sucesso', 'Fluxo inicial configurado com sucesso!', 'success');
                    fluxoIniciadoModal?.close();
                    // Recarregar o fluxograma para refletir as mudanças
                    loadFluxogramaTemplate(boteriaId);
                } else {
                    avisos('Erro', response.message || 'Erro ao configurar fluxo inicial', 'error');
                }
            },
            function (error) {
                if (loading) loading.classList.add('hidden');
                console.error('Erro ao atualizar start_fluxo_id:', error);
                avisos('Erro', error?.message || 'Erro ao configurar fluxo inicial', 'error');
            }
        );
    }

    function openModalAdicionarFluxo(boteriaId) {
        // Destruir modal existente se houver
        if (fluxoAddMensagemModal) {
            fluxoAddMensagemModal.destroy();
            fluxoAddMensagemModal = null;
        }
        
        // Criar e abrir modal com spinner imediatamente
        fluxoAddMensagemModal = new BashModal({
            id: 'fluxo-modal-add',
            titulo: 'Adicionar Fluxo',
            classSize: 'w-11/12 max-w-6xl',
            container: '#fluxos-modal-container',
            destroy: true
        });
        fluxoAddMensagemModal.setContent('<div class="flex justify-center items-center p-8"><span class="loading loading-spinner loading-lg"></span></div>');
        fluxoAddMensagemModal.open();

        const _empresaIdCompl = window.BashFluxos?.STATE?.fluxos?.fluxoEmpresaSelected;
        const _dadosComplementaresUrl = _empresaIdCompl
            ? `v1/admin/fluxos/dados-complementares/${boteriaId}?empresa_id=${_empresaIdCompl}`
            : `v1/admin/fluxos/dados-complementares/${boteriaId}`;
        req(_dadosComplementaresUrl, 'GET', null,
            async function (response) {
                console.log('Busca realizada com sucesso:', response);
                opcao = [];
                const form = await createAddFluxoForm(response.data);
                fluxoAddMensagemModal.setContent(form);

                // Pré-selecionar a boteria atual e carregar mensagens
                setTimeout(() => {
                    const boteriaAtualId = localStorage.getItem('boteria_id');
                    
                    // Campo: Próxima Mensagem
                    const selectFluxoNextBoteria = document.getElementById('fluxo_next_boteria_add');
                    if (selectFluxoNextBoteria && boteriaAtualId) {
                        selectFluxoNextBoteria.value = boteriaAtualId;
                        carregarMensagensPorBoteria(boteriaAtualId, 'fluxo_next_mensagem_add');
                    }

                    // Campo: Tratativa de Erro
                    const selectLimiteErroBoteria = document.getElementById('limite_repeticao_error_boteria_add');
                    if (selectLimiteErroBoteria && boteriaAtualId) {
                        selectLimiteErroBoteria.value = boteriaAtualId;
                        carregarMensagensPorBoteria(boteriaAtualId, 'limite_repeticao_error_mensagem_add');
                    }
                }, 100);

            },
            function (error) {
                console.error('Erro na construção da nova mensagem:', error);
                avisos('Erro', error?.message || 'Erro na construção da nova mensagem:', 'error');
            }
        );

    }


    function loadFluxogramaTemplate(boteriaId) {
        console.log('Carregando template do fluxograma para boteria_id:', boteriaId);

        // Verificar se o container principal existe
        const container = document.getElementById('fluxograma-ura-body');
        if (!container) {
            console.error('Container fluxograma-ura-body não encontrado');
            avisos('Erro', 'Container principal não encontrado', 'error');
            return;
        }

        console.log('Container principal encontrado:', container);

        // Limpar e preparar o container
        fluxoPage.jquery.body.empty();
        loadElement(fluxoPage.jquery.body, true);

        // Criar o elemento do diagrama diretamente no DOM
        const diagramDiv = document.createElement('div');
        diagramDiv.id = 'fluxograma-diagram';
        diagramDiv.style.width = '100%';
        diagramDiv.style.height = '100%';
        diagramDiv.style.minHeight = '730px';
        diagramDiv.style.border = '1px solid #ccc'; // Para debug visual

        container.appendChild(diagramDiv);

        console.log('Elemento fluxograma-diagram criado no DOM:', diagramDiv);

        // Verificar se foi realmente adicionado
        const testElement = document.getElementById('fluxograma-diagram');
        console.log('Verificação do elemento:', testElement);

        if (!testElement) {
            console.error('Falha ao criar elemento fluxograma-diagram');
            avisos('Erro', 'Falha ao criar container do diagrama', 'error');
            return;
        }

        // Fazer a requisição após confirmar que o elemento foi criado
        req(`v1/admin/fluxos/fluxograma/${boteriaId}`, 'GET', null,
            function (response) {
                console.log('Busca realizada com sucesso:', response);
                renderFluxograma(response.data);
            },
            function (error) {
                loadElement(fluxoPage.jquery.body, false);
                console.error('Erro ao carregar template do fluxograma:', error);
                avisos('Erro', error?.message || 'Erro ao carregar fluxograma', 'error');
            }
        );
    }

    function editarFluxo(fluxoId) {
        if (!fluxoId) {
            avisos('Erro', 'ID do fluxo não fornecido', 'error');
            return;
        }

        const _empId = window.BashFluxos?.STATE?.fluxos?.fluxoEmpresaSelected;

        // Buscar dados do fluxo para edição
        req(`v1/admin/fluxos/mensagem/${fluxoId}?empresa_id=${_empId}`, 'GET', null,
            function (response) {
                console.log('Dados do fluxo para edição:', response);
                if (response && response.code === 200 && response.data) {
                    openEditFluxoModal(response.data);
                } else {
                    avisos('Erro', 'Falha ao carregar dados do fluxo', 'error');
                }
            },
            function (error) {
                console.error('Erro ao buscar fluxo:', error);
                avisos('Erro', error?.message || 'Erro ao carregar fluxo', 'error');
            }
        );
    }

    async function openEditFluxoModal(data) {
        // Destruir modal existente se houver
        if (fluxoEditModal) {
            fluxoEditModal.destroy();
            fluxoEditModal = null;
        }

        // Criar e abrir modal com spinner imediatamente
        fluxoEditModal = new BashModal({
            id: 'fluxo-modal-edit',
            titulo: 'Editar Fluxo',
            classSize: 'w-11/12 max-w-6xl',
            container: '#fluxos-modal-container',
            destroy: true
        });
        fluxoEditModal.setContent('<div class="flex justify-center items-center p-8"><span class="loading loading-spinner loading-lg"></span></div>');
        fluxoEditModal.open();

        const form = await createEditFluxoForm(data);
        fluxoEditModal.setContent(form);

        // Aplicar regras do fluxo complementar se já estiver marcado
        setTimeout(() => {
            const checkbox = document.querySelector('input[name="fluxo_complementar_bl"]');
            if (checkbox && checkbox.checked) {
                toggleFluxoComplementarEdit();
            }
        }, 100);
    }

    gbAllMsg = false;

    async function createAddFluxoForm(data) {
        // Para novo fluxo, usar dados vazios mas manter as listas de referência
        const fluxo = {
            ID: 'new',
            Nome: '',
            Texto: '',
            FluxoComplementarBl: false,
            FluxoNext: null,
            Funcao: '',
            LimiteRepeticao: null,
            LimiteRepeticaoErrorFluxo: null,
            VariaveisFluxos: null,
            BlSkip: false,
            FuncaoDescricao: '',
            WbFilaID: null,
            QueueID: null
        };
        const opcoes = []; // Novo fluxo começa sem opções
        const allVariaveis = data.all_variaveis || [];
        const allMensagens = data.all_mensagens || [];
        const allQueues = data.all_queues || [];
        const allWbFilas = data.all_wb_filas || [];
        const allFuncoes = data.all_funcoes || [];
        const allFluxosOptions = await findOptionsFluxo();

        // Armazenar funções globalmente para uso nas validações
        FUNCOES_API = allFuncoes;

        // // Extrair IDs únicos de funções usadas nas mensagens
        // const funcaoIdsUnicos = [...new Set(allMensagens
        //     .map(m => m.Funcao)
        //     .filter(f => f !== null && f !== undefined && f !== ''))];

        // Criar descrições amigáveis para as funções
        const getFuncaoLabel = (funcaoNome) => {
            console.log('Gerando label para função:', funcaoNome);
            const labels = {
                'stt': 'STT (Speech to Text)',
                'cpfcnpj': 'Validação CPF/CNPJ',
                'queue': 'Fila de Atendimento',
                'hangup': 'Encerrar Ligação',
                'tts': 'TTS (Text to Speech)',
                'dtmf': 'DTMF (Captura de Dígitos)',
                'record': 'Gravação de Áudio',
                'transfer': 'Transferência',
                'playback': 'Reprodução de Áudio'
            };
            if (!funcaoNome) return '';
            return labels[funcaoNome] || funcaoNome.charAt(0).toUpperCase() + funcaoNome.slice(1);
        };

        // Buscar objetos de função correspondentes aos IDs únicos
        const funcoesUnicas = allFuncoes;
        // const funcoesUnicas = funcaoIdsUnicos
        //     .map(funcaoId => allFuncoes.find(f => f.id == funcaoId))
        //     .filter(f => f); // Remover nulls/undefined

        console.log('funcoesUnicas disponíveis:', funcoesUnicas);

        // Opções de funções disponíveis
        const funcoesDisponiveis = [
            { value: '', label: 'Nenhuma' },
            ...funcoesUnicas.map(funcaoObj => {
                console.log('Processando função para opções:', funcaoObj);
                return{
                    value: funcaoObj.id,
                    label: getFuncaoLabel(funcaoObj.nome)
                }
            })
        ];

        console.log('Funções disponíveis para seleção:', funcoesDisponiveis);
        // Criar options para variáveis
        const variaveisOptions = allVariaveis.map(v =>
            `<option value="${v.ID}">${escapeHtml(v.nome)}</option>`
        ).join('');

        // Armazenar a lista de boterias globalmente para usar no carregamento dinâmico
        const ALL_BOTERIAS_OPTIONS = [];

        // Criar options para funções
        const funcoesOptions = funcoesDisponiveis.map(f =>
            `<option value="${f.value}">${f.label}</option>`
        ).join('');

        const filaAtendimentoWebbotOptions = allWbFilas.map(m =>
            `<option value="${m.ID}">${escapeHtml(m.nome)}</option>`
        ).join('');
        const filaAtendimentoCallphoneOptions = allQueues.map(m =>
            `<option value="${m.ID}">${escapeHtml(m.name)}</option>`
        ).join('');

        gbAllMsg = allMensagens;
        return `
            <form id="fluxo-add-form">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-4">
                        <h4 class="text-lg font-semibold text-primary border-b pb-2">Configurações</h4>
                        
                        <div class="form-control">
                            <label class="label">
                                <span class="label-text font-medium">Nome do Fluxo *</span>
                            </label>
                            <input type="text" name="nome_add" value="" 
                                   placeholder="Digite o nome do fluxo" 
                                   class="input input-bordered w-full" required maxlength="255" />
                        </div>
                        <div class="form-control">
                            <label class="label cursor-pointer">
                                <span class="label-text font-medium">Fluxo Complementar (Próxima Mensagem Simultânea/Encaminhada Junto)</span>
                                <input type="checkbox" name="fluxo_complementar_bl_add" 
                                        class="checkbox checkbox-primary" />
                            </label>
                        </div>
                        <div class="form-control">
                            <label class="label cursor-pointer">
                                <span class="label-text font-medium">Aceitar Entrada de DTMF durante o Áudio - Callphone</span>
                                <input type="checkbox" name="bl_skip_add" 
                                        class="checkbox checkbox-primary" />
                            </label>
                        </div>
                        
                        <div id="card_proxima_mensagem_add" class="card bg-base-200 shadow-sm">
                            <div class="card-body p-4">
                                <h5 class="card-title text-sm mb-3">Próxima Mensagem</h5>
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="form-control">
                                        <label class="label">
                                            <span class="label-text font-medium">Boteria</span>
                                        </label>
                                        <select id="fluxo_next_boteria_add" class="select select-bordered w-full" 
                                                data-load-messages="fluxo_next_mensagem_add">
                                                ${allFluxosOptions}
                                        </select>
                                    </div>
                                    <div class="form-control">
                                        <label class="label">
                                            <span class="label-text font-medium">Mensagem</span>
                                        </label>
                                        <select name="fluxo_next_add" id="fluxo_next_mensagem_add" class="select select-bordered w-full">
                                            <option value="">Selecione boteria primeiro</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <!-- Card: Tratativa de Erro -->
                        <div class="card bg-base-200 shadow-sm">
                            <div class="card-body p-4">
                                <h5 class="card-title text-sm mb-3">Tratativa de Erro</h5>
                                <div class="grid grid-cols-3 gap-4">
                                    <div class="form-control">
                                        <label class="label">
                                            <span class="label-text font-medium">Limite de Repetição</span>
                                        </label>
                                        <input type="number" name="limite_repeticao_add" 
                                                value="" 
                                                placeholder="0"
                                                class="input input-bordered w-full" min="0" max="10" />
                                    </div>
                                    <div class="form-control">
                                        <label class="label">
                                            <span class="label-text font-medium">Boteria</span>
                                        </label>
                                        <select id="limite_repeticao_error_boteria_add" class="select select-bordered w-full"
                                                data-load-messages="limite_repeticao_error_mensagem_add">
                                                ${allFluxosOptions}
                                        </select>
                                    </div>
                                    <div class="form-control">
                                        <label class="label">
                                            <span class="label-text font-medium">Mensagem</span>
                                        </label>
                                        <select name="limite_repeticao_error_fluxo_add" id="limite_repeticao_error_mensagem_add" class="select select-bordered w-full">
                                            <option value="">Selecione boteria primeiro</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="form-control">
                            <label class="label">
                                <span class="label-text font-medium">Função</span>
                            </label>
                            <select name="funcao_add" id="funcao_add" class="select select-bordered w-full">
                                <option value="">Nenhuma</option>
                                ${allFuncoes.map(f =>
                                    `<option value="${f.id}">${f.nome}</option>`
                                ).join('')}
                            </select>
                        </div>

                        <!-- Configurações dinâmicas da função -->
                        <div id="funcao_config_container_add" class="space-y-3 hidden">
                            <!-- Fila Config -->
                            <div id="funcao_config_fila_add" class="hidden space-y-3">
                                <div id="queue_callphone_field_add" class="form-control">
                                    <label class="label">
                                        <span class="label-text font-medium">Fila Callphone</span>
                                    </label>
                                    <select name="callphone_queue_id_add" class="select select-bordered w-full">
                                        <option value="">Selecione a fila...</option>
                                        ${filaAtendimentoCallphoneOptions}
                                    </select>
                                </div>
                                <div id="queue_webbot_field_add" class="form-control">
                                    <label class="label">
                                        <span class="label-text font-medium">Fila Webbot</span>
                                    </label>
                                    <select name="webbot_queue_id_add" class="select select-bordered w-full">
                                        <option value="">Selecione a fila...</option>
                                        ${filaAtendimentoWebbotOptions}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Estrutura da Mensagem (Meta WhatsApp) -->
                    <div class="space-y-4">
                        <h4 class="text-lg font-semibold text-primary border-b pb-2">Estrutura da Mensagem</h4>
                        
                        <!-- Cabeçalho -->
                        <div class="form-control">
                            <label class="label">
                                <span class="label-text font-medium">Cabeçalho (Header)</span>
                            </label>
                            <select name="header_tipo_add" id="header_tipo_add" class="select select-bordered w-full">
                                <option value="">Nenhum</option>
                                <option value="text">Texto</option>
                                <option value="image">Imagem</option>
                                <option value="video">Vídeo</option>
                                <option value="document">Documento</option>
                                <option value="location">Localização</option>
                            </select>
                        </div>

                        <!-- Conteúdo do Cabeçalho (condicional) -->
                        <div id="header_content_container_add" class="hidden">
                            <div class="form-control" id="header_text_field_add">
                                <label class="label">
                                    <span class="label-text font-medium">Texto do Cabeçalho</span>
                                </label>
                                <input type="text" name="header_text_add" placeholder="Texto do cabeçalho" 
                                       class="input input-bordered w-full" maxlength="60" />
                            </div>
                            <div class="form-control hidden" id="header_media_field_add">
                                <label class="label">
                                    <span class="label-text font-medium">Upload de Mídia</span>
                                </label>
                                <input type="file" name="header_media_file_add" id="header_media_file_add"
                                       class="file-input file-input-bordered w-full" 
                                       accept="image/*,video/*,.pdf,.doc,.docx" />
                                <label class="label">
                                    <span class="label-text-alt" id="header_media_info_add"></span>
                                </label>
                                <!-- Base64 payload (não expor URL) -->
                                <input type="hidden" name="header_media_b64_add" id="header_media_b64_add" />
                                <input type="hidden" name="header_media_mime_add" id="header_media_mime_add" />
                                <input type="hidden" name="header_media_name_add" id="header_media_name_add" />
                                <div id="header_media_preview_add" class="mt-2 hidden">
                                    <img id="header_media_preview_img_add" class="max-w-xs rounded" />
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-2 hidden" id="header_location_field_add">
                                <div class="form-control">
                                    <label class="label">
                                        <span class="label-text font-medium">Latitude</span>
                                    </label>
                                    <input type="text" name="header_location_lat_add" placeholder="-23.550520" 
                                           class="input input-bordered w-full" />
                                </div>
                                <div class="form-control">
                                    <label class="label">
                                        <span class="label-text font-medium">Longitude</span>
                                    </label>
                                    <input type="text" name="header_location_lng_add" placeholder="-46.633308" 
                                           class="input input-bordered w-full" />
                                </div>
                            </div>
                        </div>

                        <!-- Corpo -->
                        <div class="form-control">
                            <label class="label">
                                <span class="label-text font-medium">Corpo (Body) *</span>
                            </label>
                            <textarea name="body_text_add" rows="4" 
                                      placeholder="Digite o texto principal da mensagem"
                                      class="textarea textarea-bordered w-full" required maxlength="1024"></textarea>
                            <label class="label">
                                <span class="label-text-alt">Máximo 1024 caracteres</span>
                            </label>
                        </div>

                        <!-- Rodapé -->
                        <div class="form-control">
                            <label class="label">
                                <span class="label-text font-medium">Rodapé (Footer)</span>
                            </label>
                            <input type="text" name="footer_text_add" 
                                   placeholder="Texto do rodapé (opcional)" 
                                   class="input input-bordered w-full" maxlength="60" />
                            <label class="label">
                                <span class="label-text-alt">Máximo 60 caracteres</span>
                            </label>
                        </div>
                        <div class="divider my-4"></div>
                        <div class="form-control">
                            <label class="label">
                                <span class="label-text font-medium">Callphone - Áudio</span>
                            </label>
                            <textarea name="callphone_body_text_add" rows="4" 
                                      placeholder="Digite o texto da mensagem"
                                      class="textarea textarea-bordered w-full" maxlength="1024"></textarea>
                            <label class="label">
                                <span class="label-text-alt">Máximo 1024 caracteres</span>
                            </label>
                            <button type="button" class="btn btn-sm btn-info mt-2" data-action="audio-preview-tts">
                                <i class="fa fa-volume-up"></i> Escutar Áudio
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Seção de Botões -->
                <div class="mt-6">
                    <h4 class="text-lg font-semibold text-primary border-b pb-2 mb-4">Botões Interativos</h4>
                    <div class="alert alert-info mb-4">
                        <i class="fas fa-info-circle"></i>
                        <div>
                            <p class="font-semibold mb-2">Configure os botões do fluxo</p>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                <div>
                                    <span class="font-semibold">Botões de Opção:</span>
                                    <ul class="ml-4">
                                        <li>• Até 10 botões</li>
                                        <li>• Direcionam para fluxos específicos</li>
                                        <li>• Texto separado para URA e WhatsApp</li>
                                    </ul>
                                </div>
                                <div>
                                    <span class="font-semibold">Botões de Ação (Desativado no Callphone):</span>
                                    <ul class="ml-4">
                                        <li>• Apenas 1 botão de ação permitido</li>
                                        <li>• Link de Site (URL)</li>
                                        <li>• Ligação (Telefone)</li>
                                        <li>• Código de Cópia</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div id="buttons_container_add" class="space-y-3"></div>
                    
                    <div class="flex flex-wrap gap-2 mt-4">
                        <button type="button" class="btn btn-sm btn-primary" data-action="add-button-quick-reply" data-mode="add">
                            <i class="fa fa-plus"></i> Botão de Opção
                        </button>
                        <button type="button" class="btn btn-sm btn-info" data-action="add-button-url" data-mode="add">
                            <i class="fa fa-link"></i> Link de Site
                        </button>
                        <button type="button" class="btn btn-sm btn-warning" data-action="add-button-call" data-mode="add">
                            <i class="fa fa-phone"></i> Ligação
                        </button>
                        <button type="button" class="btn btn-sm btn-secondary" data-action="add-button-copy" data-mode="add">
                            <i class="fa fa-copy"></i> Código de Cópia
                        </button>
                    </div>
                </div>
                <div class="modal-action mt-6">
                    <button type="button" class="btn btn-ghost" data-action="close-add-fluxo-modal">
                        <i class="fa fa-times"></i> Cancelar
                    </button>
                    <button type="submit" class="btn btn-success">
                        <span class="loading loading-spinner loading-xs hidden" id="fluxo-loading-create"></span>
                        <i class="fa fa-plus"></i> Criar Novo Fluxo
                    </button>
                </div>
            </form>
        `;
    }

    // Contador de botões (local ao módulo)
    let buttonCounterAdd = 0;

    function toggleHeaderContent(mode = 'add') {
        const headerTipo = document.getElementById(`header_tipo_${mode}`).value;
        const container = document.getElementById(`header_content_container_${mode}`);
        const textField = document.getElementById(`header_text_field_${mode}`);
        const mediaField = document.getElementById(`header_media_field_${mode}`);
        const locationField = document.getElementById(`header_location_field_${mode}`);

        if (!headerTipo) {
            container.classList.add('hidden');
            return;
        }

        container.classList.remove('hidden');
        textField.classList.add('hidden');
        mediaField.classList.add('hidden');
        locationField.classList.add('hidden');

        if (headerTipo === 'text') {
            textField.classList.remove('hidden');
        } else if (headerTipo === 'location') {
            locationField.classList.remove('hidden');
        } else {
            mediaField.classList.remove('hidden');
            // Atualizar o accept do input baseado no tipo
            const fileInput = document.getElementById(`header_media_file_${mode}`);
            if (headerTipo === 'image') {
                fileInput.accept = 'image/jpeg,image/png,image/jpg';
            } else if (headerTipo === 'video') {
                fileInput.accept = 'video/mp4,video/3gpp';
            } else if (headerTipo === 'document') {
                fileInput.accept = '.pdf,.doc,.docx';
            }
        }
    }

    async function handleMediaUpload(input, mode) {
        const file = input.files[0];
        if (!file) return;

        const infoSpan = document.getElementById(`header_media_info_${mode}`);
        const previewDiv = document.getElementById(`header_media_preview_${mode}`);
        const previewImg = document.getElementById(`header_media_preview_img_${mode}`);
        const b64Input = document.getElementById(`header_media_b64_${mode}`);
        const mimeInput = document.getElementById(`header_media_mime_${mode}`);
        const nameInput = document.getElementById(`header_media_name_${mode}`);

        // Validar tamanho do arquivo (16MB para vídeo, 5MB para imagem, 100MB para documento)
        const maxSize = file.type.startsWith('video/') ? 16 * 1024 * 1024 :
            file.type.startsWith('image/') ? 5 * 1024 * 1024 :
                100 * 1024 * 1024;

        if (file.size > maxSize) {
            avisos('Erro', `Arquivo muito grande. Máximo: ${maxSize / (1024 * 1024)}MB`, 'error');
            input.value = '';
            return;
        }

    infoSpan.textContent = 'Processando arquivo...';
        infoSpan.className = 'label-text-alt text-info';

        // Preview para imagens
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImg.src = e.target.result;
                previewDiv.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }

        // Converter para Base64 (Data URL) e armazenar em campos ocultos
        try {
            const arrayBuffer = await file.arrayBuffer();
            // Converter ArrayBuffer -> Base64
            let binary = '';
            const bytes = new Uint8Array(arrayBuffer);
            const chunkSize = 0x8000;
            for (let i = 0; i < bytes.length; i += chunkSize) {
                binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
            }
            const base64 = btoa(binary);

            // Preencher campos ocultos
            if (b64Input) b64Input.value = base64;
            if (mimeInput) mimeInput.value = file.type || '';
            if (nameInput) nameInput.value = file.name || '';

            infoSpan.textContent = `✓ Arquivo pronto: ${file.name}`;
            infoSpan.className = 'label-text-alt text-success';
        } catch (error) {
            console.error('Erro ao converter arquivo:', error);
            avisos('Erro', error.message || 'Erro ao processar arquivo', 'error');
            infoSpan.textContent = '✗ Erro no processamento';
            infoSpan.className = 'label-text-alt text-error';
            input.value = '';
            if (b64Input) b64Input.value = '';
            if (mimeInput) mimeInput.value = '';
            if (nameInput) nameInput.value = '';
        }
    }

    // Removidas todas as exportações window.*
    // Agora usamos event delegation

    function handleFuncaoChange(mode) {
        const funcaoId = document.getElementById(`funcao_${mode}`).value;
        const configContainer = document.getElementById(`funcao_config_container_${mode}`);

        // Esconder todos os configs
        const allConfigs = configContainer.querySelectorAll('[id^="funcao_config_"]');
        allConfigs.forEach(cfg => cfg.classList.add('hidden'));

        if (!funcaoId) {
            configContainer.classList.add('hidden');
            // Remover todas as restrições
            aplicarRestricoesFuncao(null, mode);
            // Mostrar card "Próxima Mensagem" novamente
            const cardProximaMensagem = document.getElementById(`card_proxima_mensagem_${mode}`);
            if (cardProximaMensagem) cardProximaMensagem.classList.remove('hidden');
            return;
        }

        // Buscar função na API
        const funcao = getFuncaoById(funcaoId);
        if (!funcao) {
            configContainer.classList.add('hidden');
            // Mostrar card "Próxima Mensagem" novamente
            const cardProximaMensagem = document.getElementById(`card_proxima_mensagem_${mode}`);
            if (cardProximaMensagem) cardProximaMensagem.classList.remove('hidden');
            return;
        }

        configContainer.classList.remove('hidden');

        // Mostrar config baseado no NOME da função ou RequestSchema
        const funcaoNome = funcao.Nome.toLowerCase();
        let specificConfig = null;

        // Verificar se a função requer seleção de fila (pelo nome ou RequestSchema)
        const requerFila = funcaoNome === 'queue' || 
                          funcaoNome === 'fila' || 
                          funcaoNome.includes('transferir para atendente') ||
                          funcaoNome.includes('transferir_atendente') ||
                          (funcao.RequestSchema?.body?.fila_id !== undefined) ||
                          (funcao.RequestSchema?.body?.wb_fila_id !== undefined);

        if (requerFila) {
            specificConfig = document.getElementById(`funcao_config_fila_${mode}`);
        } else if (funcaoNome === 'hangup') {
            specificConfig = document.getElementById(`funcao_config_hangup_${mode}`);
        } else if (funcaoNome === 'transfer') {
            specificConfig = document.getElementById(`funcao_config_transfer_${mode}`);
        } else if (funcaoNome === 'transferir_boteria') {
            specificConfig = document.getElementById(`funcao_config_transferir_boteria_${mode}`);
        }

        if (specificConfig) {
            specificConfig.classList.remove('hidden');
        }

        // Mostrar card "Próxima Mensagem" - mesmo para funções de fila, precisa definir o próximo fluxo
        const cardProximaMensagem = document.getElementById(`card_proxima_mensagem_${mode}`);
        if (cardProximaMensagem) {
            cardProximaMensagem.classList.remove('hidden');
        }

        // Aplicar restrições automaticamente baseado na API
        aplicarRestricoesFuncao(funcaoId, mode);
    }

    function toggleQueueType(mode) {
        const queueType = document.getElementById(`queue_type_${mode}`).value;
        const callphoneField = document.getElementById(`queue_callphone_field_${mode}`);
        const webbotField = document.getElementById(`queue_webbot_field_${mode}`);

        callphoneField.classList.add('hidden');
        webbotField.classList.add('hidden');

        if (queueType === 'callphone') {
            callphoneField.classList.remove('hidden');
        } else if (queueType === 'webbot') {
            webbotField.classList.remove('hidden');
        }
    }

    function toggleFinalMessage(mode) {
        const checkbox = document.getElementById(`send_final_message_${mode}`);
        const field = document.getElementById(`final_message_field_${mode}`);

        if (checkbox.checked) {
            field.classList.remove('hidden');
        } else {
            field.classList.add('hidden');
        }
    }

    function toggleFluxoComplementar(mode) {
        const checkbox = document.querySelector(`input[name="fluxo_complementar_bl_${mode}"]`);
        const isComplementar = checkbox.checked;

        // Próximo Fluxo - torna obrigatório
        const fluxoNextSelect = document.querySelector(`select[name="fluxo_next_${mode}"]`);
        if (fluxoNextSelect) {
            if (isComplementar) {
                fluxoNextSelect.setAttribute('required', 'required');
                fluxoNextSelect.parentElement.querySelector('.label-text').innerHTML = 'Próximo Fluxo *';
            } else {
                fluxoNextSelect.removeAttribute('required');
                fluxoNextSelect.parentElement.querySelector('.label-text').innerHTML = 'Próximo Fluxo';
            }
        }

        // Callphone - Aceitar Entrada de DTMF durante o Áudio - esconder
        const blSkipField = document.querySelector(`input[name="bl_skip_${mode}"]`)?.closest('.form-control');
        if (blSkipField) {
            if (isComplementar) {
                blSkipField.classList.add('hidden');
            } else {
                blSkipField.classList.remove('hidden');
            }
        }

        // Card Tratativa de Erro - esconder (contém Limite de Repetição e Fluxo de Erro)
        const tratativaErroCard = document.querySelector(`input[name="limite_repeticao_${mode}"]`)?.closest('.card');
        if (tratativaErroCard) {
            if (isComplementar) {
                tratativaErroCard.classList.add('hidden');
            } else {
                tratativaErroCard.classList.remove('hidden');
            }
        }

        // Função - esconder
        const funcaoField = document.querySelector(`select[name="funcao_${mode}"]`)?.closest('.form-control');
        if (funcaoField) {
            if (isComplementar) {
                funcaoField.classList.add('hidden');
                // Limpar seleção de função
                document.getElementById(`funcao_${mode}`).value = '';
                handleFuncaoChange(mode);
            } else {
                funcaoField.classList.remove('hidden');
            }
        }

        // Botões - desabilitar
        const buttonsContainer = document.getElementById(`buttons_container_${mode}`);
        const addButtonsDiv = buttonsContainer?.parentElement.querySelector('.flex.gap-2');

        if (buttonsContainer && addButtonsDiv) {
            const allButtons = addButtonsDiv.querySelectorAll('button');

            if (isComplementar) {
                // Desabilitar botões de adicionar
                allButtons.forEach(btn => btn.disabled = true);

                // Desabilitar inputs dos botões existentes
                const buttonInputs = buttonsContainer.querySelectorAll('input, select, textarea');
                buttonInputs.forEach(input => input.disabled = true);

                // Desabilitar botões de remover
                const removeButtons = buttonsContainer.querySelectorAll('button');
                removeButtons.forEach(btn => btn.disabled = true);
            } else {
                // Habilitar botões de adicionar
                allButtons.forEach(btn => btn.disabled = false);

                // Habilitar inputs dos botões existentes
                const buttonInputs = buttonsContainer.querySelectorAll('input, select, textarea');
                buttonInputs.forEach(input => input.disabled = false);

                // Habilitar botões de remover
                const removeButtons = buttonsContainer.querySelectorAll('button');
                removeButtons.forEach(btn => btn.disabled = false);
            }
        }
    }

    // Função genérica para carregar mensagens por boteria
    function carregarMensagensPorBoteria(boteriaId, targetSelectId) {
        console.log('🔍 carregarMensagensPorBoteria chamada:', { boteriaId, targetSelectId });
        const selectMensagem = document.getElementById(targetSelectId);

        if (!selectMensagem) {
            console.error('❌ Select de mensagem não encontrado:', targetSelectId);
            return;
        }

        if (!boteriaId) {
            console.warn('⚠️ boteriaId não fornecido');
            selectMensagem.innerHTML = '<option value="">Selecione boteria primeiro</option>';
            return;
        }

        selectMensagem.innerHTML = '<option value="">Carregando...</option>';
        console.log('📡 Requisitando mensagens da boteria:', boteriaId);

        const _empIdMsg = window.BashFluxos?.STATE?.fluxos?.fluxoEmpresaSelected;
        const _boteriaUrlMsg = _empIdMsg
            ? `v1/admin/fluxos/boteria/${boteriaId}?empresa_id=${_empIdMsg}`
            : `v1/admin/fluxos/boteria/${boteriaId}`;
        req(_boteriaUrlMsg, 'GET', null,
            function (response) {
                console.log('✅ Resposta recebida:', response);
                if (response && response.code === 200) {
                    const mensagens = response.data || [];
                    console.log('📋 Mensagens carregadas:', mensagens.length, 'itens');
                    selectMensagem.innerHTML = '<option value="">Nenhuma</option>';

                    mensagens.forEach(msg => {
                        selectMensagem.innerHTML += `<option value="${msg.id}">${escapeHtml(msg.nome)}</option>`;
                    });
                    console.log('✅ Select atualizado com', mensagens.length, 'opções');
                }
            },
            function (error) {
                console.error('❌ Erro ao carregar mensagens:', error);
                selectMensagem.innerHTML = '<option value="">Erro ao carregar</option>';
            }
        );
    }

    // Removidas todas as exportações window.*

    async function addButtonQuickReply(mode) {
        const container = document.getElementById(`buttons_container_${mode}`);
        const currentButtons = container.querySelectorAll('[data-button-type]');

        // Limitar a 10 botões de resposta rápida
        const quickReplyButtons = Array.from(currentButtons).filter(b => b.dataset.buttonType === 'quick_reply');
        if (quickReplyButtons.length >= 10) {
            avisos('Atenção', 'Máximo de 10 botões de resposta rápida', 'warning');
            return;
        }

        buttonCounterAdd++;
        const buttonNumber = quickReplyButtons.length + 1;
        const buttonId = `btn_${mode}_${buttonCounterAdd}`;

        // Carregar opções de boteria usando a função padrão
        const optionsHtml = await findOptionsFluxo();

        const buttonHtml = `
                        <div class="card bg-base-100 shadow-sm p-4 border-2 border-primary" id="${buttonId}" data-button-type="quick_reply">
                            <div class="flex justify-between items-center mb-3">
                                <span class="badge badge-primary">Botão #${buttonNumber}</span>
                                <button type="button" class="btn btn-xs btn-error" data-action="remove-button" data-id="${buttonId}" data-mode="${mode}">
                                    <i class="fa fa-trash"></i>
                                </button>
                            </div>
                            <input type="hidden" name="button_type_${buttonId}" value="quick_reply" />
                            <!-- Texto do Botão (WhatsApp) -->
                            <div class="mb-3">
                                <label class="label">
                                    <span class="label-text font-medium">Texto do Botão (WhatsApp)</span>
                                </label>
                                <input type="text" name="button_text_${buttonId}" 
                                       placeholder="Texto do botão (máx. 25 chars)" 
                                       class="input input-sm input-bordered w-full" maxlength="25" required />
                            </div>
                            <!-- Texto da URA (Callphone) -->
                            <div class="mb-3">
                                <label class="label">
                                    <span class="label-text font-medium">Opção da Ura - Número DTMF (Callphone)</span>
                                </label>
                                <div class="join w-full">
                                    <span class="join-item btn btn-sm btn-neutral">${buttonNumber}</span>
                                    <input type="number" name="button_ura_text_${buttonId}" 
                                           class="input input-sm input-bordered join-item flex-1" min="0" max="20" value="${buttonNumber}" />
                                </div>
                            </div>
                            
                            <!-- Próximo Fluxo -->
                            <div class="card bg-base-200">
                                <div class="card-body p-3">
                                    <h6 class="font-semibold text-sm mb-2">Próximo Fluxo</h6>
                                    <div class="grid grid-cols-2 gap-2">
                                        <div class="form-control">
                                            <label class="label py-1">
                                                <span class="label-text text-xs">Boteria</span>
                                            </label>
                                            <select name="button_boteria_${buttonId}" 
                                                    class="select select-sm select-bordered w-full"
                                                    data-load-messages="button_mensagem_${buttonId}">
                                                <option value="">Selecione...</option>
                                                ${optionsHtml}
                                            </select>
                                        </div>
                                        <div class="form-control">
                                            <label class="label py-1">
                                                <span class="label-text text-xs">Mensagem</span>
                                            </label>
                                            <select name="button_mensagem_${buttonId}" 
                                                    id="button_mensagem_${buttonId}"
                                                    class="select select-sm select-bordered w-full">
                                                <option value="">Selecione boteria primeiro</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;

        container.insertAdjacentHTML('beforeend', buttonHtml);

        // Garantir ordem: primeiro botões de opção, depois botões de ação
        reorganizarBotoes(mode);
        // Renumerar após reorganizar para refletir a ordem visual
        renumerarBotoes(mode);

        // Pré-selecionar a boteria atual (se existir) e carregar mensagens usando a função padrão
        const boteriaAtualId = localStorage.getItem('boteria_id');
        const selectBoteria = document.querySelector(`select[name="button_boteria_${buttonId}"]`);
        if (selectBoteria && boteriaAtualId) {
            selectBoteria.value = boteriaAtualId;
            carregarMensagensPorBoteria(boteriaAtualId, `button_mensagem_${buttonId}`);
        }
    }

    // Função para remover botão e renumerar
    function removeButton(buttonId, mode) {
        document.getElementById(buttonId)?.remove();
        renumerarBotoes(mode);
        reorganizarBotoes(mode);
    }

    // Botões de Ação (URL, Call, Copy)
    function renumerarBotoes(mode) {
        const container = document.getElementById(`buttons_container_${mode}`);
        const buttons = container.querySelectorAll('[data-button-type="quick_reply"]');

        buttons.forEach((button, index) => {
            const numero = index + 1;
            // Atualizar badge
            const badge = button.querySelector('.badge');
            if (badge) badge.textContent = `Botão #${numero}`;

            // Atualizar número no input-group
            const inputGroupText = button.querySelector('.join-item.btn');
            if (inputGroupText) inputGroupText.textContent = numero;
        });
    }

    // Função para reorganizar botões: Botões de Opção primeiro, depois Botões de Ação
    function reorganizarBotoes(mode) {
        const container = document.getElementById(`buttons_container_${mode}`);
        const allButtons = Array.from(container.querySelectorAll('[data-button-type]'));

        // Separar botões por tipo
        const quickReplyButtons = allButtons.filter(b => b.dataset.buttonType === 'quick_reply');
        const actionButtons = allButtons.filter(b => ['url', 'call', 'copy'].includes(b.dataset.buttonType));

        // Limpar container
        container.innerHTML = '';

        // Adicionar botões de opção primeiro
        quickReplyButtons.forEach(btn => container.appendChild(btn));

        // Depois adicionar botões de ação
        actionButtons.forEach(btn => container.appendChild(btn));
    }

    // Removidas funções duplicadas: agora usamos findOptionsFluxo + carregarMensagensPorBoteria

    // Botões de Ação (URL, Call, Copy)
    function addButtonUrl(mode) {
        const container = document.getElementById(`buttons_container_${mode}`);
        const currentButtons = container.querySelectorAll('[data-button-type]');

        // Permitir apenas 1 botão de ação
        const actionButtons = Array.from(currentButtons).filter(b =>
            ['url', 'call', 'copy'].includes(b.dataset.buttonType)
        );
        if (actionButtons.length >= 1) {
            avisos('Atenção', 'Apenas 1 botão de ação é permitido (URL, Call ou Cópia)', 'warning');
            return;
        }

        buttonCounterAdd++;
        const buttonId = `btn_${mode}_${buttonCounterAdd}`;

        const buttonHtml = `
                        <div class="card bg-base-100 shadow-sm p-4 border-2 border-info" id="${buttonId}" data-button-type="url">
                            <div class="flex justify-between items-center mb-3">
                                <span class="badge badge-info">Botão de Ação: Link de Site</span>
                                <button type="button" class="btn btn-xs btn-error" data-action="remove-element" data-id="${buttonId}">
                                    <i class="fa fa-trash"></i>
                                </button>
                            </div>
                            <input type="hidden" name="button_type_${buttonId}" value="url" />
                            
                            <div class="mb-3">
                                <label class="label">
                                    <span class="label-text font-medium">Texto do Botão</span>
                                </label>
                                <input type="text" name="button_text_${buttonId}" 
                                       placeholder="Texto do botão (máx. 25 chars)" 
                                       class="input input-sm input-bordered w-full" maxlength="25" required />
                            </div>
                            
                            <div class="mb-3">
                                <label class="label">
                                    <span class="label-text font-medium">URL do Link</span>
                                </label>
                                <input type="url" name="button_url_${buttonId}" 
                                       placeholder="https://exemplo.com" 
                                       class="input input-sm input-bordered w-full" required />
                            </div>
                        </div>
                    `;

        container.insertAdjacentHTML('beforeend', buttonHtml);
        reorganizarBotoes(mode);
    }

    function addButtonCall(mode) {
        const container = document.getElementById(`buttons_container_${mode}`);
        const currentButtons = container.querySelectorAll('[data-button-type]');

        // Permitir apenas 1 botão de ação
        const actionButtons = Array.from(currentButtons).filter(b =>
            ['url', 'call', 'copy'].includes(b.dataset.buttonType)
        );
        if (actionButtons.length >= 1) {
            avisos('Atenção', 'Apenas 1 botão de ação é permitido (URL, Call ou Cópia)', 'warning');
            return;
        }

        buttonCounterAdd++;
        const buttonId = `btn_${mode}_${buttonCounterAdd}`;

        const buttonHtml = `
                        <div class="card bg-base-100 shadow-sm p-4 border-2 border-warning" id="${buttonId}" data-button-type="call">
                            <div class="flex justify-between items-center mb-3">
                                <span class="badge badge-warning">Botão de Ação: Ligação</span>
                                <button type="button" class="btn btn-xs btn-error" data-action="remove-element" data-id="${buttonId}">
                                    <i class="fa fa-trash"></i>
                                </button>
                            </div>
                            <input type="hidden" name="button_type_${buttonId}" value="call" />
                            
                            <div class="mb-3">
                                <label class="label">
                                    <span class="label-text font-medium">Texto do Botão</span>
                                </label>
                                <input type="text" name="button_text_${buttonId}" 
                                       placeholder="Texto do botão (máx. 25 chars)" 
                                       class="input input-sm input-bordered w-full" maxlength="25" required />
                            </div>
                            
                            <div class="mb-3">
                                <label class="label">
                                    <span class="label-text font-medium">Número de Telefone</span>
                                </label>
                                <input type="tel" name="button_phone_${buttonId}" 
                                       placeholder="+5511999999999" 
                                       class="input input-sm input-bordered w-full" required />
                            </div>
                        </div>
                    `;

        container.insertAdjacentHTML('beforeend', buttonHtml);
        reorganizarBotoes(mode);
    }

    function addButtonCopy(mode) {
        const container = document.getElementById(`buttons_container_${mode}`);
        const currentButtons = container.querySelectorAll('[data-button-type]');

        // Permitir apenas 1 botão de ação
        const actionButtons = Array.from(currentButtons).filter(b =>
            ['url', 'call', 'copy'].includes(b.dataset.buttonType)
        );
        if (actionButtons.length >= 1) {
            avisos('Atenção', 'Apenas 1 botão de ação é permitido (URL, Call ou Cópia)', 'warning');
            return;
        }

        buttonCounterAdd++;
        const buttonId = `btn_${mode}_${buttonCounterAdd}`;

        const buttonHtml = `
                        <div class="card bg-base-100 shadow-sm p-4 border-2 border-secondary" id="${buttonId}" data-button-type="copy">
                            <div class="flex justify-between items-center mb-3">
                                <span class="badge badge-secondary">Botão de Ação: Código de Cópia</span>
                                <button type="button" class="btn btn-xs btn-error" data-action="remove-element" data-id="${buttonId}">
                                    <i class="fa fa-trash"></i>
                                </button>
                            </div>
                            <input type="hidden" name="button_type_${buttonId}" value="copy" />
                            
                            <div class="mb-3">
                                <label class="label">
                                    <span class="label-text font-medium">Código para Copiar</span>
                                </label>
                                <input type="text" name="button_text_${buttonId}" 
                                       placeholder="Código (máx. 15 chars)" 
                                       class="input input-sm input-bordered w-full" maxlength="15" required />
                            </div>
                        </div>
                    `;

        container.insertAdjacentHTML('beforeend', buttonHtml);
        reorganizarBotoes(mode);
    }

    // Função para carregar mensagens de uma boteria
    function carregarMensagensDaBoteria(boteriaId, mode) {
        const selectFluxo = document.getElementById(`fluxo_id_transferir_${mode}`);

        if (!boteriaId) {
            selectFluxo.innerHTML = '<option value="">Primeiro selecione uma boteria</option>';
            return;
        }

        selectFluxo.innerHTML = '<option value="">Carregando...</option>';

        const _empIdDab = window.BashFluxos?.STATE?.fluxos?.fluxoEmpresaSelected;
        const _boteriaUrlDab = _empIdDab
            ? `v1/admin/fluxos/boteria/${boteriaId}?empresa_id=${_empIdDab}`
            : `v1/admin/fluxos/boteria/${boteriaId}`;
        req(_boteriaUrlDab, 'GET', null,
            function (response) {
                if (response && response.code === 200) {
                    const mensagens = response.data || [];
                    selectFluxo.innerHTML = '<option value="">Selecione o fluxo...</option>';

                    mensagens.forEach(msg => {
                        selectFluxo.innerHTML += `<option value="${msg.ID}">${msg.Nome}</option>`;
                    });
                }
            },
            function (error) {
                console.error('Erro ao carregar mensagens:', error);
                selectFluxo.innerHTML = '<option value="">Erro ao carregar fluxos</option>';
            }
        );
    }

    // Removido: carregamento duplicado de opções de boterias. Agora, use findOptionsFluxo onde necessário.

    async function createEditFluxoForm(data) {
        const fluxo = data.fluxos;
        const opcoes = data.opcoes || [];
        const allVariaveis = data.all_variaveis || [];
        const allMensagens = data.all_mensagens || [];
        const allQueues = data.all_queues || [];
        const allWbFilas = data.all_wb_filas || [];
        const allFuncoes = data.all_funcoes || [];
        const allFluxosOptions = await findOptionsFluxo();

        // Debug: verificar dados de fila
        console.log('📋 Dados do fluxo para edição:', {
            Funcao: fluxo.Funcao,
            WbFilaID: fluxo.WbFilaID,
            QueueID: fluxo.QueueID
        });

        // Armazenar funções globalmente para uso nas validações
        FUNCOES_API = allFuncoes;

        // Criar options para variáveis
        const variaveisOptions = allVariaveis.map(v =>
            `<option value="${v.ID}">${escapeHtml(v.Nome)}</option>`
        ).join('');

        // Armazenar a lista de boterias globalmente para usar no carregamento dinâmico
        const ALL_BOTERIAS_OPTIONS = [];

        const filaAtendimentoWebbotOptions = allWbFilas.map(m =>
            `<option value="${m.ID}" ${fluxo.WbFilaID == m.ID ? 'selected' : ''}>${escapeHtml(m.Nome)}</option>`
        ).join('');
        const filaAtendimentoCallphoneOptions = allQueues.map(m =>
            `<option value="${m.ID}" ${fluxo.QueueID == m.ID ? 'selected' : ''}>${escapeHtml(m.Name)}</option>`
        ).join('');

        gbAllMsg = allMensagens;

        // Extrair dados da estrutura da mensagem existente
        let mensagemStructure = null;
        if (fluxo.MensagemStructure) {
            try {
                mensagemStructure = typeof fluxo.MensagemStructure === 'string' 
                    ? JSON.parse(fluxo.MensagemStructure) 
                    : fluxo.MensagemStructure;
            } catch (e) {
                console.warn('Erro ao parsear MensagemStructure:', e);
            }
        }

        // Valores padrão da estrutura da mensagem
        const headerTipo = mensagemStructure?.header?.type || '';
        const headerText = mensagemStructure?.header?.text || '';
        // Link da mídia pode estar em header.link OU header.media.link
        const headerLink = mensagemStructure?.header?.link || mensagemStructure?.header?.media?.link || '';
        const headerLat = mensagemStructure?.header?.latitude || '';
        const headerLng = mensagemStructure?.header?.longitude || '';
        const bodyText = mensagemStructure?.body || '';
        const footerText = mensagemStructure?.footer || '';
        
        // Limpar aspas extras do link se houver (ex: '"/uploads/..."' -> /uploads/...)
        const cleanHeaderLink = headerLink.replace(/^["']|["']$/g, '');
        
        // Construir URL completa para preview (usando origin dinâmico)
        const headerLinkFull = cleanHeaderLink && !cleanHeaderLink.startsWith('http') 
            ? `${window.location.origin}${cleanHeaderLink}` 
            : cleanHeaderLink;

        return `
            <form id="fluxo-edit-form-${fluxo.ID}" data-fluxo-id="${fluxo.ID}">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-4">
                        <h4 class="text-lg font-semibold text-primary border-b pb-2">Configurações</h4>
                        
                        <div class="form-control">
                            <label class="label">
                                <span class="label-text font-medium">Nome do Fluxo *</span>
                            </label>
                            <input type="text" name="nome_edit" value="${escapeHtml(fluxo.Nome || '')}" 
                                   placeholder="Digite o nome do fluxo" 
                                   class="input input-bordered w-full" required maxlength="255" />
                        </div>
                        <div class="form-control">
                            <label class="label cursor-pointer">
                                <span class="label-text font-medium">Fluxo Complementar (Próxima Mensagem Simultânea/Encaminhada Junto)</span>
                                <input type="checkbox" name="fluxo_complementar_bl_edit" 
                                        ${fluxo.FluxoComplementarBl ? 'checked' : ''}
                                        class="checkbox checkbox-primary" />
                            </label>
                        </div>
                        <div class="form-control">
                            <label class="label cursor-pointer">
                                <span class="label-text font-medium">Aceitar Entrada de DTMF durante o Áudio - Callphone</span>
                                <input type="checkbox" name="bl_skip_edit" 
                                        ${fluxo.BlSkip ? 'checked' : ''} 
                                        class="checkbox checkbox-primary" />
                            </label>
                        </div>
                        
                        <div id="card_proxima_mensagem_edit" class="card bg-base-200 shadow-sm">
                            <div class="card-body p-4">
                                <h5 class="card-title text-sm mb-3">Próxima Mensagem</h5>
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="form-control">
                                        <label class="label">
                                            <span class="label-text font-medium">Boteria</span>
                                        </label>
                                        <select id="fluxo_next_boteria_edit" class="select select-bordered w-full"
                                                data-load-messages="fluxo_next_mensagem_edit">
                                                ${allFluxosOptions}
                                        </select>
                                    </div>
                                    <div class="form-control">
                                        <label class="label">
                                            <span class="label-text font-medium">Mensagem</span>
                                        </label>
                                        <select name="fluxo_next_mensagem_edit" id="fluxo_next_mensagem_edit" class="select select-bordered w-full">
                                            <option value="">Selecione boteria primeiro</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <!-- Card: Tratativa de Erro -->
                        <div class="card bg-base-200 shadow-sm">
                            <div class="card-body p-4">
                                <h5 class="card-title text-sm mb-3">Tratativa de Erro</h5>
                                <div class="grid grid-cols-3 gap-4">
                                    <div class="form-control">
                                        <label class="label">
                                            <span class="label-text font-medium">Limite de Repetição</span>
                                        </label>
                                        <input type="number" name="limite_repeticao_edit" 
                                                value="${fluxo.LimiteRepeticao || ''}" 
                                                placeholder="0"
                                                class="input input-bordered w-full" min="0" max="10" />
                                    </div>
                                    <div class="form-control">
                                        <label class="label">
                                            <span class="label-text font-medium">Boteria</span>
                                        </label>
                                        <select id="limite_repeticao_error_boteria_edit" class="select select-bordered w-full"
                                                data-load-messages="limite_repeticao_error_mensagem_edit">
                                                ${allFluxosOptions}
                                        </select>
                                    </div>
                                    <div class="form-control">
                                        <label class="label">
                                            <span class="label-text font-medium">Mensagem</span>
                                        </label>
                                        <select name="limite_repeticao_error_fluxo_edit" id="limite_repeticao_error_mensagem_edit" class="select select-bordered w-full">
                                            <option value="">Selecione boteria primeiro</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="form-control">
                            <label class="label">
                                <span class="label-text font-medium">Função</span>
                            </label>
                            <select name="funcao_edit" id="funcao_edit" class="select select-bordered w-full">
                                <option value="">Nenhuma</option>
                                ${allFuncoes.map(f =>
                                    `<option value="${f.ID}" ${fluxo.Funcao === f.ID ? 'selected' : ''}>${f.Descricao}</option>`
                                ).join('')}
                            </select>
                        </div>

                        <!-- Configurações dinâmicas da função -->
                        <div id="funcao_config_container_edit" class="space-y-3 hidden">
                            <!-- Fila Config -->
                            <div id="funcao_config_fila_edit" class="hidden space-y-3">
                                <div id="queue_callphone_field_edit" class="form-control">
                                    <label class="label">
                                        <span class="label-text font-medium">Fila Callphone</span>
                                    </label>
                                    <select name="callphone_queue_id_edit" class="select select-bordered w-full">
                                        <option value="">Selecione a fila...</option>
                                        ${filaAtendimentoCallphoneOptions}
                                    </select>
                                </div>
                                <div id="queue_webbot_field_edit" class="form-control">
                                    <label class="label">
                                        <span class="label-text font-medium">Fila Webbot</span>
                                    </label>
                                    <select name="webbot_queue_id_edit" class="select select-bordered w-full">
                                        <option value="">Selecione a fila...</option>
                                        ${filaAtendimentoWebbotOptions}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Estrutura da Mensagem (Meta WhatsApp) -->
                    <div class="space-y-4">
                        <h4 class="text-lg font-semibold text-primary border-b pb-2">Estrutura da Mensagem</h4>
                        
                        <!-- Cabeçalho -->
                        <div class="form-control">
                            <label class="label">
                                <span class="label-text font-medium">Cabeçalho (Header)</span>
                            </label>
                            <select name="header_tipo_edit" id="header_tipo_edit" class="select select-bordered w-full">
                                <option value="">Nenhum</option>
                                <option value="text" ${headerTipo === 'text' ? 'selected' : ''}>Texto</option>
                                <option value="image" ${headerTipo === 'image' ? 'selected' : ''}>Imagem</option>
                                <option value="video" ${headerTipo === 'video' ? 'selected' : ''}>Vídeo</option>
                                <option value="document" ${headerTipo === 'document' ? 'selected' : ''}>Documento</option>
                                <option value="location" ${headerTipo === 'location' ? 'selected' : ''}>Localização</option>
                            </select>
                        </div>

                        <!-- Conteúdo do Cabeçalho (condicional) -->
                        <div id="header_content_container_edit" class="${headerTipo ? '' : 'hidden'}">
                            <div class="form-control ${headerTipo === 'text' ? '' : 'hidden'}" id="header_text_field_edit">
                                <label class="label">
                                    <span class="label-text font-medium">Texto do Cabeçalho</span>
                                </label>
                                <input type="text" name="header_text_edit" value="${escapeHtml(headerText)}" placeholder="Texto do cabeçalho" 
                                       class="input input-bordered w-full" maxlength="60" />
                            </div>
                            <div class="form-control ${['image', 'video', 'document'].includes(headerTipo) ? '' : 'hidden'}" id="header_media_field_edit">
                                <label class="label">
                                    <span class="label-text font-medium">Upload de Mídia</span>
                                </label>
                                <input type="file" name="header_media_file_edit" id="header_media_file_edit"
                                       class="file-input file-input-bordered w-full" 
                                       accept="image/*,video/*,.pdf,.doc,.docx" />
                                <label class="label">
                                    <span class="label-text-alt" id="header_media_info_edit">${cleanHeaderLink ? '✓ Mídia atual carregada' : ''}</span>
                                </label>
                                <!-- Link da mídia existente (preservar se não houver novo upload) -->
                                <input type="hidden" name="header_media_link_edit" id="header_media_link_edit" value="${escapeHtml(cleanHeaderLink)}" />
                                <!-- Base64 payload (para novos uploads) -->
                                <input type="hidden" name="header_media_b64_edit" id="header_media_b64_edit" />
                                <input type="hidden" name="header_media_mime_edit" id="header_media_mime_edit" />
                                <input type="hidden" name="header_media_name_edit" id="header_media_name_edit" />
                                <div id="header_media_preview_edit" class="mt-2 ${headerLinkFull ? '' : 'hidden'}">
                                    ${headerTipo === 'image' ? `<img id="header_media_preview_img_edit" src="${headerLinkFull}" class="max-w-xs rounded border" onerror="this.parentElement.innerHTML='<p class=text-error>❌ Erro ao carregar imagem</p>'" />` : ''}
                                    ${headerTipo === 'video' ? `<video controls class="max-w-xs rounded border"><source src="${headerLinkFull}" /></video>` : ''}
                                    ${headerTipo === 'document' ? `<a href="${headerLinkFull}" target="_blank" class="btn btn-sm btn-outline"><i class="fa fa-file"></i> Ver documento</a>` : ''}
                                    ${cleanHeaderLink ? `<p class="text-xs text-gray-500 mt-1">📎 ${cleanHeaderLink.split('/').pop()}</p>` : ''}
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-2 ${headerTipo === 'location' ? '' : 'hidden'}" id="header_location_field_edit">
                                <div class="form-control">
                                    <label class="label">
                                        <span class="label-text font-medium">Latitude</span>
                                    </label>
                                    <input type="text" name="header_location_lat_edit" value="${escapeHtml(headerLat)}" placeholder="-23.550520" 
                                           class="input input-bordered w-full" />
                                </div>
                                <div class="form-control">
                                    <label class="label">
                                        <span class="label-text font-medium">Longitude</span>
                                    </label>
                                    <input type="text" name="header_location_lng_edit" value="${escapeHtml(headerLng)}" placeholder="-46.633308" 
                                           class="input input-bordered w-full" />
                                </div>
                            </div>
                        </div>

                        <!-- Corpo -->
                        <div class="form-control">
                            <label class="label">
                                <span class="label-text font-medium">Corpo (Body) *</span>
                            </label>
                            <textarea name="body_text_edit" rows="4" 
                                      placeholder="Digite o texto principal da mensagem"
                                      class="textarea textarea-bordered w-full" required maxlength="1024" value="${bodyText}">${escapeHtml(bodyText)}</textarea>
                            <label class="label">
                                <span class="label-text-alt">Máximo 1024 caracteres</span>
                            </label>
                        </div>

                        <!-- Rodapé -->
                        <div class="form-control">
                            <label class="label">
                                <span class="label-text font-medium">Rodapé (Footer)</span>
                            </label>
                            <input type="text" name="footer_text_edit" value="${escapeHtml(footerText)}"
                                   placeholder="Texto do rodapé (opcional)" 
                                   class="input input-bordered w-full" maxlength="60" />
                            <label class="label">
                                <span class="label-text-alt">Máximo 60 caracteres</span>
                            </label>
                        </div>
                        <div class="divider my-4"></div>
                        <div class="form-control">
                            <label class="label">
                                <span class="label-text font-medium">Callphone - Áudio</span>
                            </label>
                            <textarea name="callphone_body_text_edit" rows="4" 
                                      placeholder="Digite o texto da mensagem"
                                      class="textarea textarea-bordered w-full" maxlength="1024">${escapeHtml(bodyText)}</textarea>
                            <label class="label">
                                <span class="label-text-alt">Máximo 1024 caracteres</span>
                            </label>
                            <button type="button" class="btn btn-sm btn-info mt-2" data-action="audio-preview-tts">
                                <i class="fa fa-volume-up"></i> Escutar Áudio
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Seção de Botões -->
                <div class="mt-6">
                    <h4 class="text-lg font-semibold text-primary border-b pb-2 mb-4">Botões Interativos</h4>
                    <div class="alert alert-info mb-4">
                        <i class="fas fa-info-circle"></i>
                        <div>
                            <p class="font-semibold mb-2">Configure os botões do fluxo</p>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                <div>
                                    <span class="font-semibold">Botões de Opção:</span>
                                    <ul class="ml-4">
                                        <li>• Até 10 botões</li>
                                        <li>• Direcionam para fluxos específicos</li>
                                        <li>• Texto separado para URA e WhatsApp</li>
                                    </ul>
                                </div>
                                <div>
                                    <span class="font-semibold">Botões de Ação (Desativado no Callphone):</span>
                                    <ul class="ml-4">
                                        <li>• Apenas 1 botão de ação permitido</li>
                                        <li>• Link de Site (URL)</li>
                                        <li>• Ligação (Telefone)</li>
                                        <li>• Código de Cópia</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div id="buttons_container_edit" class="space-y-3"></div>
                    
                    <div class="flex flex-wrap gap-2 mt-4">
                        <button type="button" class="btn btn-sm btn-primary" data-action="add-button-quick-reply" data-mode="edit">
                            <i class="fa fa-plus"></i> Botão de Opção
                        </button>
                        <button type="button" class="btn btn-sm btn-info" data-action="add-button-url" data-mode="edit">
                            <i class="fa fa-link"></i> Link de Site
                        </button>
                        <button type="button" class="btn btn-sm btn-warning" data-action="add-button-call" data-mode="edit">
                            <i class="fa fa-phone"></i> Ligação
                        </button>
                        <button type="button" class="btn btn-sm btn-secondary" data-action="add-button-copy" data-mode="edit">
                            <i class="fa fa-copy"></i> Código de Cópia
                        </button>
                    </div>
                </div>
                <div class="modal-action mt-6">
                    <button type="button" class="btn btn-ghost" data-action="close-edit-fluxo-modal">
                        <i class="fa fa-times"></i> Cancelar
                    </button>
                    <button type="submit" class="btn btn-success">
                        <span class="loading loading-spinner loading-xs hidden" id="fluxo-loading-save"></span>
                        <i class="fa fa-save"></i> Salvar Atualizações
                    </button>
                </div>
            </form>
            <script>
                // Carregar botões existentes do fluxo
                (async () => {
                    try {
                        // Pré-selecionar a boteria atual
                        const boteriaAtualId = localStorage.getItem('boteria_id');
                        console.log('🔍 MODAL EDIT - boteriaAtualId:', boteriaAtualId);
                        console.log('🔍 MODAL EDIT - FluxoNext:', ${fluxo.FluxoNext || 'null'});
                        
                        const selectBoteria = document.querySelector('select[id="fluxo_next_boteria_edit"]');
                        console.log('🔍 MODAL EDIT - selectBoteria encontrado:', !!selectBoteria);
                        
                        if (selectBoteria && boteriaAtualId) {
                            selectBoteria.value = boteriaAtualId;
                            console.log('✅ Boteria selecionada:', selectBoteria.value);
                            
                            // Sempre carregar mensagens da boteria
                            console.log('📡 Chamando carregarMensagensPorBoteria...');
                            window.BashFluxograma.MODALS.carregarMensagensPorBoteria(boteriaAtualId, 'fluxo_next_mensagem_edit');
                            
                            // Se tiver FluxoNext, selecionar após carregar
                            if (${fluxo.FluxoNext || 'null'}) {
                                setTimeout(() => {
                                    const selectMensagem = document.getElementById('fluxo_next_mensagem_edit');
                                    console.log('🔍 Tentando selecionar FluxoNext:', ${fluxo.FluxoNext || 'null'});
                                    console.log('🔍 Select mensagem encontrado:', !!selectMensagem);
                                    console.log('🔍 Opções disponíveis:', selectMensagem?.options.length);
                                    if (selectMensagem) {
                                        selectMensagem.value = ${fluxo.FluxoNext || 'null'};
                                        console.log('✅ Valor selecionado:', selectMensagem.value);
                                    }
                                }, 300);
                            }
                        }

                        // Carregar e selecionar boteria/mensagem de erro
                        const selectBoteriaErro = document.querySelector('select[id="limite_repeticao_error_boteria_edit"]');
                        const errorBoteriaId = ${fluxo.LimiteRepeticaoErrorBoteriaID || 'null'} || boteriaAtualId;
                        if (selectBoteriaErro && errorBoteriaId) {
                            selectBoteriaErro.value = errorBoteriaId;
                            
                            // Sempre carregar mensagens da boteria de erro
                            window.BashFluxograma.MODALS.carregarMensagensPorBoteria(errorBoteriaId, 'limite_repeticao_error_mensagem_edit');
                            
                            // Se tiver LimiteRepeticaoErrorFluxo, selecionar após carregar
                            if (${fluxo.LimiteRepeticaoErrorFluxo || 'null'}) {
                                setTimeout(() => {
                                    const selectMensagemErro = document.getElementById('limite_repeticao_error_mensagem_edit');
                                    if (selectMensagemErro) selectMensagemErro.value = ${fluxo.LimiteRepeticaoErrorFluxo || 'null'};
                                }, 300);
                            }
                        }

                        // Carregar botões existentes se houver
                        ${opcoes.length > 0 ? `
                        console.log('📦 Carregando ${opcoes.length} botões existentes...');
                        const existingButtons = ${JSON.stringify(opcoes)};
                        
                        for (const opcao of existingButtons) {
                            const buttonType = opcao.Type || 'quick_reply';
                            console.log('  ➕ Adicionando botão:', opcao.Nome, '- Tipo:', buttonType);
                            
                            if (buttonType === 'quick_reply') {
                                // Botão de opção (quick_reply)
                                await window.BashFluxograma.BUTTONS.addButtonQuickReply('edit');
                                
                                const lastButton = document.querySelector('#buttons_container_edit > div:last-child');
                                if (lastButton) {
                                    const textInput = lastButton.querySelector('input[name^="button_text_"]');
                                    const uraInput = lastButton.querySelector('input[name^="button_ura_text_"]');
                                    
                                    if (textInput) {
                                        textInput.value = opcao.Nome || '';
                                        console.log('    📝 Texto WhatsApp:', opcao.Nome);
                                    }
                                    if (uraInput) {
                                        uraInput.value = opcao.Input || '';
                                        console.log('    🔢 Input URA:', opcao.Input);
                                    }
                                    
                                    // Se tiver NextFluxoID, carregar e selecionar
                                    if (opcao.NextFluxoID) {
                                        console.log('    🔗 NextFluxoID:', opcao.NextFluxoID);
                                        const boteriaSelect = lastButton.querySelector('select[name^="button_boteria_"]');
                                        const mensagemSelect = lastButton.querySelector('select[name^="button_mensagem_"]');
                                        
                                        if (boteriaSelect && mensagemSelect && boteriaAtualId) {
                                            boteriaSelect.value = boteriaAtualId;
                                            const mensagemSelectId = mensagemSelect.id;
                                            window.BashFluxograma.MODALS.carregarMensagensPorBoteria(boteriaAtualId, mensagemSelectId);
                                            setTimeout(() => {
                                                mensagemSelect.value = opcao.NextFluxoID;
                                            }, 300);
                                        }
                                    }
                                }
                            } else if (buttonType === 'url') {
                                // Botão de ação URL
                                await window.BashFluxograma.BUTTONS.addButtonUrl('edit');
                                
                                // Aguardar um momento para o DOM atualizar
                                await new Promise(resolve => setTimeout(resolve, 50));
                                
                                const lastButton = document.querySelector('#buttons_container_edit > div:last-child');
                                if (lastButton) {
                                    let buttonData = {};
                                    if (opcao.Whats) {
                                        try {
                                            // Whats pode vir como string JSON ou já como objeto
                                            buttonData = typeof opcao.Whats === 'string' 
                                                ? JSON.parse(opcao.Whats) 
                                                : opcao.Whats;
                                            console.log('    📦 Dados do botão URL (raw):', opcao.Whats);
                                            console.log('    📦 Dados do botão URL (parsed):', buttonData);
                                        } catch(e) {
                                            console.error('    ❌ Erro ao parsear Whats:', e);
                                        }
                                    }
                                    const textInput = lastButton.querySelector('input[name^="button_text_"]');
                                    const urlInput = lastButton.querySelector('input[name^="button_url_"]');
                                    
                                    console.log('    🔍 Text Input encontrado:', !!textInput);
                                    console.log('    🔍 URL Input encontrado:', !!urlInput);
                                    console.log('    🔍 URL do buttonData:', buttonData.url);
                                    
                                    if (textInput) {
                                        textInput.value = buttonData.text || opcao.Nome || '';
                                        console.log('    📝 Text definido:', textInput.value);
                                    }
                                    if (urlInput) {
                                        urlInput.value = buttonData.url || '';
                                        console.log('    🔗 URL definida:', urlInput.value);
                                    }
                                }
                            } else if (buttonType === 'call') {
                                // Botão de ação Call
                                await window.BashFluxograma.BUTTONS.addButtonCall('edit');
                                
                                // Aguardar um momento para o DOM atualizar
                                await new Promise(resolve => setTimeout(resolve, 50));
                                
                                const lastButton = document.querySelector('#buttons_container_edit > div:last-child');
                                if (lastButton) {
                                    let buttonData = {};
                                    if (opcao.Whats) {
                                        try {
                                            // Whats pode vir como string JSON ou já como objeto
                                            buttonData = typeof opcao.Whats === 'string' 
                                                ? JSON.parse(opcao.Whats) 
                                                : opcao.Whats;
                                            console.log('    📦 Dados do botão Call (raw):', opcao.Whats);
                                            console.log('    📦 Dados do botão Call (parsed):', buttonData);
                                        } catch(e) {
                                            console.error('    ❌ Erro ao parsear Whats:', e);
                                        }
                                    }
                                    const textInput = lastButton.querySelector('input[name^="button_text_"]');
                                    const phoneInput = lastButton.querySelector('input[name^="button_phone_"]');
                                    
                                    console.log('    🔍 Text Input encontrado:', !!textInput);
                                    console.log('    🔍 Phone Input encontrado:', !!phoneInput);
                                    console.log('    🔍 Phone Input name:', phoneInput?.name);
                                    console.log('    🔍 phone_number do buttonData:', buttonData.phone_number);
                                    
                                    if (textInput) {
                                        textInput.value = buttonData.text || opcao.Nome || '';
                                        console.log('    📝 Text definido:', textInput.value);
                                    }
                                    if (phoneInput) {
                                        phoneInput.value = buttonData.phone_number || '';
                                        console.log('    📞 Telefone definido:', phoneInput.value);
                                    }
                                }
                            } else if (buttonType === 'copy') {
                                // Botão de ação Copy
                                await window.BashFluxograma.BUTTONS.addButtonCopy('edit');
                                
                                // Aguardar um momento para o DOM atualizar
                                await new Promise(resolve => setTimeout(resolve, 50));
                                
                                const lastButton = document.querySelector('#buttons_container_edit > div:last-child');
                                if (lastButton) {
                                    let buttonData = {};
                                    if (opcao.Whats) {
                                        try {
                                            // Whats pode vir como string JSON ou já como objeto
                                            buttonData = typeof opcao.Whats === 'string' 
                                                ? JSON.parse(opcao.Whats) 
                                                : opcao.Whats;
                                            console.log('    📦 Dados do botão Copy:', buttonData);
                                        } catch(e) {
                                            console.error('    ❌ Erro ao parsear Whats:', e);
                                        }
                                    }
                                    const textInput = lastButton.querySelector('input[name^="button_text_"]');
                                    if (textInput) {
                                        textInput.value = buttonData.text || opcao.Nome || '';
                                        console.log('    📋 Código de cópia definido:', textInput.value);
                                    }
                                }
                            }
                        }
                        ` : ''}

                        // Aplicar função selecionada se houver
                        if (${fluxo.Funcao || 'null'}) {
                            window.BashFluxograma.MODALS.handleFuncaoChange('edit');
                        }

                        // Aplicar toggle de header se necessário
                        window.BashFluxograma.MODALS.toggleHeaderContent('edit');
                        
                        // Aplicar toggle de fluxo complementar se necessário
                        window.BashFluxograma.MODALS.toggleFluxoComplementar('edit');

                    } catch (e) {
                        console.error('Erro ao configurar formulário de edição:', e);
                    }
                })();
            </script>
        `;

    }

    // Funções auxiliares para processamento de dados do formulário
    function criarEstruturaMensagem(formData, mode) {
        const messageStructure = {
            header: null,
            body: formData.get(`body_text_${mode}`) || '',
            footer: formData.get(`footer_text_${mode}`) || null,
            callphone: {
                body: formData.get(`callphone_body_text_${mode}`) || ''
            }
        };

        // Processar Header
        const headerTipo = formData.get(`header_tipo_${mode}`);
        if (headerTipo) {
            messageStructure.header = {
                type: headerTipo
            };

            if (headerTipo === 'text') {
                messageStructure.header.text = formData.get(`header_text_${mode}`) || '';
            } else if (headerTipo === 'location') {
                messageStructure.header.location = {
                    latitude: formData.get(`header_location_lat_${mode}`) || '',
                    longitude: formData.get(`header_location_lng_${mode}`) || ''
                };
            } else if (['image', 'video', 'document'].includes(headerTipo)) {
                // Se houver novo upload (base64), usar ele
                const newBase64 = formData.get(`header_media_b64_${mode}`);
                const existingLink = formData.get(`header_media_link_${mode}`);
                
                if (newBase64) {
                    // Novo upload - usar base64
                    messageStructure.header.media = {
                        base64: newBase64,
                        mime: formData.get(`header_media_mime_${mode}`) || '',
                        filename: formData.get(`header_media_name_${mode}`) || ''
                    };
                } else if (existingLink) {
                    // Preservar link existente
                    messageStructure.header.link = existingLink;
                }
            }
        }

        return messageStructure;
    }

    function coletarBotoesDoFormulario(formData, mode) {
        const buttons = [];
        const buttonElements = document.querySelectorAll(`#buttons_container_${mode} [data-button-type]`);

        buttonElements.forEach(btnElement => {
            const buttonId = btnElement.id;
            const buttonType = formData.get(`button_type_${buttonId}`);
            const buttonText = formData.get(`button_text_${buttonId}`);

            if (buttonType && buttonText) {
                if (buttonType === 'quick_reply') {
                    buttons.push({
                        type: 'quick_reply',
                        text_whatsapp: buttonText,
                        text_ura: formData.get(`button_ura_text_${buttonId}`) || null,
                        next: {
                            boteria_id: parseInt(formData.get(`button_boteria_${buttonId}`)) || null,
                            fluxo_id: parseInt(formData.get(`button_mensagem_${buttonId}`)) || null
                        }
                    });
                } else if (buttonType === 'url') {
                    buttons.push({
                        type: 'url',
                        text: buttonText,
                        url: formData.get(`button_url_${buttonId}`)
                    });
                } else if (buttonType === 'call') {
                    buttons.push({
                        type: 'call',
                        text: buttonText,
                        phone_number: formData.get(`button_phone_${buttonId}`)
                    });
                } else if (buttonType === 'copy') {
                    buttons.push({
                        type: 'copy',
                        text: buttonText
                    });
                }
            }
        });

        return buttons;
    }

    function coletarConfiguracaoFuncao(formData, mode) {
        const funcaoId = formData.get(`funcao_${mode}`);
        let funcaoConfig = null;

        if (funcaoId) {
            const funcaoInfo = getFuncaoById(funcaoId);

            if (funcaoInfo) {
                const funcaoNome = funcaoInfo.Nome;

                if (funcaoNome === 'queue' || funcaoNome === 'fila') {
                    funcaoConfig = {
                        funcao_id: parseInt(funcaoId),
                        funcao_nome: funcaoNome,
                        parametros: funcaoInfo.Parametros,
                        config: {
                            queue_callphone: parseInt(formData.get(`callphone_queue_id_${mode}`)) || null,
                            queue_webbot: parseInt(formData.get(`webbot_queue_id_${mode}`)) || null,
                            execucao: funcaoInfo?.Parametros?.exe || 1
                        }
                    };
                } else if (funcaoNome === 'transferir_boteria' || funcaoNome === 'transfer') {
                    funcaoConfig = {
                        funcao_id: parseInt(funcaoId),
                        funcao_nome: funcaoNome,
                        parametros: funcaoInfo.Parametros,
                        config: {
                            boteria_id: parseInt(formData.get(`boteria_id_${mode}`)) || null,
                            fluxo_id: parseInt(formData.get(`fluxo_id_transferir_${mode}`)) || null,
                            execucao: funcaoInfo.Parametros.exe || 1
                        }
                    };
                } else if (funcaoNome === 'hangup') {
                    funcaoConfig = {
                        funcao_id: parseInt(funcaoId),
                        funcao_nome: funcaoNome,
                        parametros: funcaoInfo.Parametros,
                        config: {
                            send_final_message: formData.has(`send_final_message_${mode}`),
                            final_message: formData.get(`final_message_${mode}`) || null,
                            close_conversation: formData.has(`close_conversation_${mode}`),
                            execucao: funcaoInfo.Parametros.exe || 1
                        }
                    };
                } else {
                    funcaoConfig = {
                        funcao_id: parseInt(funcaoId),
                        funcao_nome: funcaoNome,
                        parametros: funcaoInfo.Parametros,
                        config: {}
                    };
                }
            }
        }

        return funcaoConfig;
    }

    function updateFluxo(event, fluxoId) {
        event.preventDefault();

        const formData = new FormData(event.target);
        console.log('Dados do formulário para atualização do fluxo:', Array.from(formData.entries()));
        const loadingBtn = document.getElementById('fluxo-loading-save');

        // Mostrar loading
        loadingBtn?.classList.remove('hidden');
        event.target.querySelector('button[type="submit"]').disabled = true;

        try {
            // Coletar dados da estrutura da mensagem
            const mensagemStructure = criarEstruturaMensagem(formData, 'edit');

            // Coletar botões
            const buttons = coletarBotoesDoFormulario(formData, 'edit');

            // Coletar configuração de função
            const funcaoConfig = coletarConfiguracaoFuncao(formData, 'edit');

            // Preparar dados para envio
            const fluxoNextValue = formData.get('fluxo_next_mensagem_edit');
            console.log('🔍 DEBUG fluxo_next_mensagem_edit raw:', fluxoNextValue);
            console.log('🔍 DEBUG fluxo_next_mensagem_edit parsed:', parseInt(fluxoNextValue) || null);
            
            const data = {
                boteria_id: parseInt(localStorage.getItem('boteria_id')),
                nome: formData.get('nome_edit'),
                bl_skip: formData.has('bl_skip_edit'),
                fluxo_complementar_bl: formData.has('fluxo_complementar_bl_edit'),
                fluxo_next: parseInt(fluxoNextValue) || null, // Backend espera "fluxo_next" não "fluxo_next_mensagem"
                fluxo_next_boteria_id: null, // Será definido automaticamente pelo backend
                limite_repeticao: parseInt(formData.get('limite_repeticao_edit')) || null,
                limite_repeticao_error_fluxo: parseInt(formData.get('limite_repeticao_error_fluxo_edit')) || null, // Backend espera "limite_repeticao_error_fluxo"
                limite_repeticao_error_boteria_id: null, // Será definido automaticamente pelo backend
                funcao: parseInt(formData.get('funcao_edit')) || null,
                funcao_config: funcaoConfig,
                message_structure: mensagemStructure,
                buttons: buttons.length > 0 ? buttons : null,
                wb_fila_id: parseInt(formData.get('webbot_queue_id_edit')) || null,
                queue_id: parseInt(formData.get('callphone_queue_id_edit')) || null,
            };

            console.log('Enviando dados do fluxo atualizado:', data);

            req(`v1/admin/fluxos/mensagem/${fluxoId}`, 'PUT', data,
                function (response) {
                    loadingBtn?.classList.add('hidden');
                    event.target.querySelector('button[type="submit"]').disabled = false;

                    console.log('Fluxo atualizado com sucesso:', response);
                    avisos('Sucesso', 'Fluxo atualizado com sucesso', 'success');
                    closeEditFluxoModal();

                    // Recarregar o fluxograma se necessário
                    const boteriaId = localStorage.getItem('boteria_id');
                    if (boteriaId) {
                        loadFluxogramaTemplate(boteriaId);
                    }
                },
                function (error) {
                    loadingBtn?.classList.add('hidden');
                    event.target.querySelector('button[type="submit"]').disabled = false;

                    console.error('Erro ao atualizar fluxo:', error);
                    avisos('Erro', error?.message || 'Erro ao atualizar fluxo', 'error');
                }
            );

        } catch (error) {
            loadingBtn?.classList.add('hidden');
            event.target.querySelector('button[type="submit"]').disabled = false;

            console.error('Erro ao processar dados do formulário:', error);
            avisos('Erro', 'Erro ao processar dados do formulário: ' + error.message, 'error');
        }

        return false;
    }

    function closeEditFluxoModal() {
        if (fluxoEditModal) {
            fluxoEditModal.close();
        }
    }

    function toggleFluxoComplementarEdit() {
        const checkbox = document.querySelector('input[name="fluxo_complementar_bl"]');
        const isComplementar = checkbox.checked;

        // Próximo Fluxo - torna obrigatório
        const fluxoNextSelect = document.querySelector('select[name="fluxo_next"]');
        if (fluxoNextSelect) {
            if (isComplementar) {
                fluxoNextSelect.setAttribute('required', 'required');
                fluxoNextSelect.parentElement.querySelector('.label-text').innerHTML = 'Fluxo Próximo *';
            } else {
                fluxoNextSelect.removeAttribute('required');
                fluxoNextSelect.parentElement.querySelector('.label-text').innerHTML = 'Fluxo Próximo';
            }
        }

        // Callphone - Aceitar Entrada de DTMF durante o Áudio - esconder
        const blSkipField = document.querySelector('input[name="bl_skip"]')?.closest('.form-control');
        if (blSkipField) {
            if (isComplementar) {
                blSkipField.classList.add('hidden');
            } else {
                blSkipField.classList.remove('hidden');
            }
        }

        // Card Tratativa de Erro - esconder (contém Limite de Repetição e Fluxo de Erro)
        const tratativaErroCard = document.querySelector('input[name="limite_repeticao"]')?.closest('.card');
        if (tratativaErroCard) {
            if (isComplementar) {
                tratativaErroCard.classList.add('hidden');
            } else {
                tratativaErroCard.classList.remove('hidden');
            }
        }

        // Função - esconder
        const funcaoField = document.querySelector('select[name="funcao"]')?.closest('.form-control');
        if (funcaoField) {
            if (isComplementar) {
                funcaoField.classList.add('hidden');
                // Limpar seleção de função
                document.querySelector('select[name="funcao"]').value = '';
            } else {
                funcaoField.classList.remove('hidden');
            }
        }

        // Opções do Fluxo (tabela de opções) - desabilitar
        const opcoesSection = document.querySelector('.mt-6 h4')?.closest('.mt-6');
        if (opcoesSection && opcoesSection.querySelector('h4')?.textContent.includes('Opções do Fluxo')) {
            const addOpcaoBtn = document.getElementById('add-opcao');
            const opcaoInputs = opcoesSection.querySelectorAll('input, select, button');

            if (isComplementar) {
                // Desabilitar todos os inputs e botões da seção de opções
                opcaoInputs.forEach(el => el.disabled = true);
            } else {
                // Habilitar todos os inputs e botões da seção de opções
                opcaoInputs.forEach(el => el.disabled = false);
            }
        }
    }

    function removeOpcao(opcaoId) {
        if (!opcaoId) return;
        abrirModalRemocao({
            titulo: 'Remover Opção',
            mensagem: `Tem certeza que deseja remover esta opção do fluxo? Esta ação não pode ser desfeita.`,
            onConfirm: () => {
                req(`v1/admin/fluxos/mensagem/opcoes/${opcaoId}`, 'DELETE', '',
                    function (response) {
                        avisos('Sucesso', 'Opção removida com sucesso!', 'success');
                        $(`#opcao-row-${opcaoId}`).remove();
                        const boteriaId = localStorage.getItem('boteria_id');
                        if (boteriaId) {
                            loadFluxogramaTemplate(boteriaId);
                        }
                    },
                    function (error) {
                        avisos('Erro', error?.message || 'Erro ao remover opção', 'error');
                    }
                );
            }
        });
    }

    function renderFluxograma(data) {
        console.log('Renderizando fluxograma com dados:', data);

        // Verificar se os dados estão na estrutura esperada
        if (!data || !data.grafo || !data.grafo.nodes || !data.grafo.links) {
            console.error('Dados do fluxograma inválidos:', data);
            avisos('Erro', 'Dados do fluxograma são inválidos', 'error');
            return;
        }

        const grafo = data.grafo;

        // Inicializar o diagrama do go.js
        const $ = go.GraphObject.make;

        // Limpar o container antes de criar o diagrama
        if (window.currentDiagram) {
            window.currentDiagram.div = null;
            window.currentDiagram = null;
        }

        // Verificar se o elemento DOM existe
        const diagramElement = document.getElementById('fluxograma-diagram');
        if (!diagramElement) {
            console.error('Elemento fluxograma-diagram não encontrado na renderização');
            avisos('Erro', 'Container do fluxograma não encontrado', 'error');
            return;
        }

        console.log('Elemento fluxograma-diagram encontrado para renderização:', diagramElement);

        function createDiagram() {
            const myDiagram = $(go.Diagram, "fluxograma-diagram", {
                "undoManager.isEnabled": false, // Habilita Ctrl+Z (desfazer) e Ctrl+Y (refazer) no diagrama
                initialContentAlignment: go.Spot.Center, // Centraliza o conteúdo inicial do diagrama na tela
                "toolManager.hoverDelay": 100, // Tempo em ms para mostrar tooltips ao passar o mouse (100ms)
                allowDelete: false, // Impede que usuários deletem nós ou links com tecla Delete
                allowCopy: false, // Impede que usuários copiem nós com Ctrl+C
                allowLink: false, // Desabilita completamente a criação de novos links
                "grid.visible": false, // Mostra a grade de fundo para melhor orientação visual
                "grid.gridCellSize": new go.Size(20, 30), // Define o tamanho das células da grade (20x20 pixels)

                layout: $(go.LayeredDigraphLayout, {
                    direction: 90, // 90° = de cima para baixo
                    layerSpacing: 60,
                    columnSpacing: 40,
                    setsPortSpots: false,
                    aggressiveOption: go.LayeredDigraphLayout.AggressiveLess,
                    packOption: go.LayeredDigraphLayout.PackStraighten,
                    cycleRemoveOption: go.LayeredDigraphLayout.CycleDepthFirst,
                    layeringOption: go.LayeredDigraphLayout.LayerLongestPathSource // Coloca nós sem entrada no topo
                })
            });

            // Função para determinar a cor do nó baseado no tipo ou função
            function getNodeColor(data) {
                // Nó de início tem cor especial
                if (data.key === 'start-node' || data.tipo === 'start' || (data.raw && data.raw.isStartNode)) {
                    return '#00BCD4'; // Cyan - cor especial para nó de início
                }

                // Verificar primeiro a função do raw
                if (data.raw && data.raw.funcao) {
                    switch (data.raw.funcao) {
                        case 'queue': return '#4CAF50'; // Verde para fila
                        case 'hangup': return '#f44336'; // Vermelho para encerramento
                        case 'cpfcnpj': return '#FF9800'; // Laranja para captura de dados
                        case 'stt': return '#9C27B0'; // Roxo para reconhecimento de voz
                        default: return '#FF9800'; // Laranja para outras funções
                    }
                }

                // Verificar tipo se não houver função
                switch (data.tipo) {
                    case 'queue': return '#4CAF50'; // Verde para fila
                    case 'hangup': return '#f44336'; // Vermelho para encerramento
                    case 'cpfcnpj': return '#FF9800'; // Laranja para captura
                    case 'stt': return '#9C27B0'; // Roxo para STT
                    case null:
                    case undefined: return '#2196F3'; // Azul para padrão
                    default: return '#607D8B'; // Cinza para outros tipos
                }
            }

            // Definir o template dos nós
            myDiagram.nodeTemplate = $(go.Node, "Auto",
                {
                    selectionAdorned: true,
                    resizable: true,
                    layoutConditions: go.Part.LayoutStandard & ~go.Part.LayoutNodeSized,
                    fromSpot: go.Spot.AllSides,
                    toSpot: go.Spot.AllSides,
                    doubleClick: function (e, node) {
                        // Verificar se é o nó de início
                        if (node.data.key === 'start-node' || (node.data.raw && node.data.raw.isStartNode)) {
                            const currentStartFluxoId = node.data.raw?.start_fluxo_id || null;
                            openModalFluxoIniciado(currentStartFluxoId);
                        } else {
                            editarFluxo(node.data.key);
                        }
                    }
                },
                new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
                // Shape do nó
                $(go.Shape, "RoundedRectangle",
                    {
                        name: "SHAPE",
                        fill: "#2196F3",
                        stroke: "#1976D2",
                        strokeWidth: 2,
                        portId: "",
                        cursor: "pointer",
                        fromLinkable: false, // Desabilita criação de links saindo deste nó
                        toLinkable: false, // Desabilita criação de links chegando neste nó
                        minSize: new go.Size(120, 60)
                    },
                    new go.Binding("fill", "", getNodeColor),
                    // Efeito hover
                    {
                        mouseEnter: function (e, shape) {
                            shape.stroke = "#FF5722";
                            shape.strokeWidth = 3;
                        },
                        mouseLeave: function (e, shape) {
                            shape.stroke = "#1976D2";
                            shape.strokeWidth = 2;
                        }
                    }
                ),
                // Texto do nó
                $(go.Panel, "Vertical",
                    { margin: 8 },
                    // Nome do nó
                    $(go.TextBlock,
                        {
                            font: "bold 11px Helvetica, Arial, sans-serif",
                            stroke: "white",
                            maxSize: new go.Size(100, NaN),
                            wrap: go.TextBlock.WrapFit,
                            editable: false,
                            textAlign: "center"
                        },
                        new go.Binding("text", "text")
                    ),
                    // Tipo/Função do nó
                    $(go.TextBlock,
                        {
                            font: "9px Helvetica, Arial, sans-serif",
                            stroke: "rgba(255,255,255,0.8)",
                            maxSize: new go.Size(100, NaN),
                            wrap: go.TextBlock.WrapFit,
                            margin: new go.Margin(2, 0, 0, 0),
                            textAlign: "center"
                        },
                        new go.Binding("text", "", function (data) {
                            if (data.raw && data.raw.funcao) {
                                return `[${data.raw.funcao}]`;
                            }
                            return data.tipo ? `[${data.tipo}]` : '';
                        })
                    ),
                    // ID do nó
                    $(go.TextBlock,
                        {
                            font: "8px Helvetica, Arial, sans-serif",
                            stroke: "rgba(255,255,255,0.6)",
                            margin: new go.Margin(1, 0, 0, 0),
                            textAlign: "center"
                        },
                        new go.Binding("text", "key", function (key) {
                            return `ID: ${key}`;
                        })
                    )
                ),
                // Tooltip
                {
                    toolTip: $(go.Adornment, "Auto",
                        $(go.Shape, { fill: "#FFFFCC", stroke: "#666" }),
                        $(go.TextBlock, {
                            margin: 8,
                            font: "11px sans-serif",
                            maxSize: new go.Size(300, NaN),
                            wrap: go.TextBlock.WrapFit
                        },
                            new go.Binding("text", "", function (data) {
                                let tooltip = `🆔 ID: ${data.key}\n📝 Nome: ${data.text}`;

                                if (data.raw) {
                                    if (data.raw.funcao) {
                                        tooltip += `\n⚙️ Função: ${data.raw.funcao}`;
                                        if (data.raw.funcao_descricao) {
                                            tooltip += ` (${data.raw.funcao_descricao})`;
                                        }
                                    }

                                    if (data.raw.texto) {
                                        const texto = data.raw.texto.length > 80 ?
                                            data.raw.texto.substring(0, 80) + "..." :
                                            data.raw.texto;
                                        tooltip += `\n💬 Texto: "${texto}"`;
                                    }

                                    if (data.raw.fluxo_next) {
                                        tooltip += `\n➡️ Próximo: ${data.raw.fluxo_next}`;
                                    }

                                    if (data.raw.limite_repeticao !== null && data.raw.limite_repeticao !== undefined) {
                                        tooltip += `\n🔄 Limite repetição: ${data.raw.limite_repeticao}`;
                                    }
                                }

                                if (data.tipo && data.tipo !== data.raw?.funcao) {
                                    tooltip += `\n🏷️ Tipo: ${data.tipo}`;
                                }

                                tooltip += `\n\n💡 Duplo clique para editar`;
                                return tooltip;
                            })
                        )
                    )
                }
            );

            // Definir o template dos links
            myDiagram.linkTemplate = $(go.Link,
                {
                    routing: go.Link.AvoidsNodes,
                    curve: go.Link.JumpOver,
                    corner: 5,
                    reshapable: false,
                    resegmentable: false,
                    selectionAdorned: true
                },
                $(go.Shape,
                    {
                        strokeWidth: 2,
                        stroke: "#666"
                    },
                    new go.Binding("stroke", "tipo", function (tipo) {
                        switch (tipo) {
                            case 'erro': return '#f44336'; // Vermelho para erros
                            case 'opcao': return '#2196F3'; // Azul para opções
                            case 'next': return '#4CAF50'; // Verde para próximo
                            case 'start': return '#00BCD4'; // Cyan para início
                            default: return '#666'; // Cinza padrão
                        }
                    }),
                    new go.Binding("strokeDashArray", "isCycle", function (isCycle) {
                        return isCycle ? [5, 5] : null; // Linha tracejada para ciclos
                    })
                ),
                $(go.Shape,  // Seta
                    {
                        toArrow: "standard",
                        stroke: "#666",
                        fill: "#666",
                        scale: 1.2
                    },
                    new go.Binding("stroke", "tipo", function (tipo) {
                        switch (tipo) {
                            case 'erro': return '#f44336';
                            case 'opcao': return '#2196F3';
                            case 'next': return '#4CAF50';
                            case 'start': return '#00BCD4';
                            default: return '#666';
                        }
                    }),
                    new go.Binding("fill", "tipo", function (tipo) {
                        switch (tipo) {
                            case 'erro': return '#f44336';
                            case 'opcao': return '#2196F3';
                            case 'next': return '#4CAF50';
                            case 'start': return '#00BCD4';
                            default: return '#666';
                        }
                    })
                ),
                $(go.Panel, "Auto",
                    {
                        visible: true
                    },
                    new go.Binding("visible", "label", function (label) {
                        return label && label.trim() !== '';
                    }),
                    $(go.Shape, "RoundedRectangle",
                        {
                            fill: "white",
                            stroke: "#ccc",
                            strokeWidth: 1
                        }
                    ),
                    $(go.TextBlock,
                        {
                            font: "8px Helvetica, Arial, sans-serif",
                            margin: 2,
                            maxSize: new go.Size(100, NaN),
                            wrap: go.TextBlock.WrapFit,
                            textAlign: "center"
                        },
                        new go.Binding("text", "label", function (label) {
                            if (!label) return '';
                            // Limitar o tamanho do texto no link
                            return label.length > 20 ? label.substring(0, 17) + '...' : label;
                        })
                    )
                )
            );

            // Preparar os dados para o GoJS
            const nodeDataArray = grafo.nodes.map(node => {
                // Determinar o tipo baseado na função se disponível
                let tipoFinal = node.tipo;
                if (node.raw && node.raw.funcao) {
                    tipoFinal = node.raw.funcao;
                }

                return {
                    key: node.key,
                    text: node.text || node.raw?.nome || `Nó ${node.key}`,
                    tipo: tipoFinal,
                    raw: node.raw
                };
            });

            const linkDataArray = grafo.links.map(link => {
                // Determinar o tipo do link baseado nas propriedades
                let tipo = 'next'; // padrão: próximo (verde)
                
                if (link.isError === true || link.text === 'erro') {
                    tipo = 'erro'; // vermelho para erro
                } else if (link.opcao_id) {
                    tipo = 'opcao'; // azul para opções
                } else if (link.text === 'proximo' || link.text === 'próximo') {
                    tipo = 'next'; // verde para próximo
                }
                
                return {
                    from: link.from,
                    to: link.to,
                    label: link.text || '',
                    tipo: tipo,
                    isCycle: link.isCycle || false,
                    opcao_id: link.opcao_id
                };
            });

            // Adicionar nó de início no começo do array
            // O start_fluxo_id vem dentro do grafo retornado pela função SQL
            const startFluxoId = grafo.start_fluxo_id || data.start_fluxo_id;
            console.log('Start Fluxo ID:', startFluxoId);
            
            nodeDataArray.unshift({
                key: 'start-node',
                text: '🚀 Fluxo Iniciado',
                tipo: 'start',
                raw: {
                    start_fluxo_id: startFluxoId,
                    isStartNode: true
                }
            });

            // Se existe start_fluxo_id, adicionar link do nó de início para o fluxo inicial
            if (startFluxoId) {
                linkDataArray.unshift({
                    from: 'start-node',
                    to: startFluxoId,
                    label: 'início',
                    tipo: 'start',
                    isCycle: false
                });
                console.log('Link de início criado: start-node ->', startFluxoId);
            } else {
                console.warn('start_fluxo_id não definido, nó de início ficará desconectado');
            }

            // Aplicar o modelo ao diagrama
            myDiagram.model = new go.GraphLinksModel(nodeDataArray, linkDataArray);

            // Salvar referência global para atualizações
            window.currentDiagram = myDiagram;

            // Aguardar o layout ser calculado antes de centralizar
            myDiagram.addDiagramListener("InitialLayoutCompleted", function (e) {
                // Definir o nó inicial se especificado
                if (grafo.startKey) {
                    const startNode = myDiagram.findNodeForKey(grafo.startKey);
                    if (startNode) {
                        myDiagram.select(startNode);
                        myDiagram.centerRect(startNode.actualBounds);
                    }
                } else {
                    // Se não há startKey, centralizar no primeiro nó
                    const firstNode = myDiagram.findNodeForKey(nodeDataArray[0]?.key);
                    if (firstNode) {
                        myDiagram.centerRect(firstNode.actualBounds);
                    }
                }
            });

            console.log('Fluxograma renderizado com sucesso!');
            console.log('Nós:', nodeDataArray.length);
            console.log('Links:', linkDataArray.length);
            console.log('Nó inicial:', grafo.startKey);

            // Forçar o redesenho do diagrama
            setTimeout(() => {
                myDiagram.requestUpdate();
                loadElement('fluxograma-ura-body', false);
            }, 100);
        }

        // Criar o diagrama imediatamente
        createDiagram();
    }

    function alterarOpcaoDaMensagem(opcaoId, fluxoAtualId) {
        if (!opcaoId) return;
        nextFluxoId = document.getElementById('opcao_next_fluxo_' + opcaoId).value;
        textoOpcao = document.getElementById(`opcao_next_fluxo_nome_${opcaoId}`).value;
        if (!textoOpcao || textoOpcao.trim() === '') {
            avisos('Atenção', 'O nome da opção não pode ficar vazio.', 'warning');
            return;
        }
        const data = {
            next_fluxo_id: parseInt(nextFluxoId),
            nome: textoOpcao,
            fluxo_id: parseInt(fluxoAtualId)
        };
        loadElement('opcao_next_fluxo_' + opcaoId, true);
        loadElement('remove-opcao-' + opcaoId, true);
        loadElement('opcao_next_fluxo_nome_' + opcaoId, true);

        req(`v1/admin/fluxos/mensagem/opcoes/${opcaoId}`, 'PUT', data,
            function (response) {
                loadElement('opcao_next_fluxo_' + opcaoId, false);
                loadElement('remove-opcao-' + opcaoId, false);
                loadElement('opcao_next_fluxo_nome_' + opcaoId, false);
                avisos('Sucesso', 'Opção atualizada com sucesso', 'success');

                const boteriaId = localStorage.getItem('boteria_id');
                if (boteriaId) {
                    loadFluxogramaTemplate(boteriaId);
                }
            },
            function (error) {
                loadElement('opcao_next_fluxo_' + opcaoId, false);
                loadElement('remove-opcao-' + opcaoId, false);
                loadElement('opcao_next_fluxo_nome_' + opcaoId, false);
                console.error('Erro ao atualizar opção:', error);
                avisos('Erro', error?.message || 'Erro ao atualizar opção', 'error');
            }
        );
    }

    var lineint = 66666;
    function addLine(fluxoId) {
        allMensagens = gbAllMsg;
        lineint++;
        html = `<tr id="opcao-row-new-${lineint}">
                    <td class="max-w-xs truncate">
                        <input type="text" id="opcao_next_fluxo_nome_${lineint}" name="opcao_next_fluxo_nome_${lineint}" placeholder="Opção/Palavras-chave" class="input input-bordered w-full" maxlength="255">
                    </td>
                    <td>
                        <select class="select select-bordered" name="opcao_next_fluxo_${lineint}" id="opcao_next_fluxo_${lineint}">
                            <option value="" selected>Selecione</option>
                            ${allMensagens.map(m =>
            `<option value="${m.ID}">${escapeHtml(m.Nome)}</option>`
        ).join('')}
                        </select>
                    </td>
                    <td>
                        <button type="button" class="btn btn-error"  
                                onclick="$('#opcao-row-new-${lineint}').remove()">
                            <i class="fa fa-trash"></i>
                        </button>
                        <button type="button" class="btn btn-success"  
                                onclick="addOpcao(${fluxoId}, ${lineint})">
                            <i class="fa fa-save"></i>
                        </button>
                    </td>
                </tr>`;
        $('.modal-opcoes-tbody').append(html);
    }

    function addOpcao(fluxoId, line) {
        if (!fluxoId || !line) return;

        console.log('Adicionando nova opção para o fluxo ID:', fluxoId);
        console.log('Linha temporária:', line);

        nextFluxoId = document.getElementById('opcao_next_fluxo_' + line).value;
        textoOpcao = document.getElementById(`opcao_next_fluxo_nome_${line}`).value;
        if (!textoOpcao || textoOpcao.trim() === '') {
            avisos('Atenção', 'O nome da opção não pode ficar vazio.', 'warning');
            return;
        }
        const data = {
            next_fluxo_id: parseInt(nextFluxoId),
            nome: textoOpcao,
            fluxo_id: parseInt(fluxoId)
        };
        loadElement('opcao_next_fluxo_' + line, true);
        loadElement('opcao_next_fluxo_nome_' + line, true);
        $('#remove-opcao-' + line).remove();
        req(`v1/admin/fluxos/mensagem/opcoes`, 'POST', data,
            function (response) {
                allMensagens = gbAllMsg;
                console.log('Opção adicionada com sucesso:', response);
                opcao = response.data;
                html = `
                    <tr id="opcao-row-${opcao.ID}">
                        <td class="max-w-xs truncate">
                            <input type="text" id="opcao_next_fluxo_nome_${opcao.ID}" value="${escapeHtml(opcao.Nome)}" placeholder="Opção/Palavras-chave" class="input input-bordered w-full" maxlength="255" onchange="alterarOpcaoDaMensagem(${opcao.ID}, ${fluxoId})">
                        </td>
                        <td>
                            <select class="select select-bordered" 
                                    name="opcao_next_fluxo_${opcao.ID}" id="opcao_next_fluxo_${opcao.ID}" onchange="alterarOpcaoDaMensagem(${opcao.ID}, ${fluxoId})">
                                <option value="">Nenhum</option>
                                ${allMensagens.map(m =>
                    `<option value="${m.ID}" ${opcao.NextFluxoID === m.ID ? 'selected' : ''}>${escapeHtml(m.Nome)}</option>`
                ).join('')}
                            </select>
                        </td>
                        <td>
                            <button type="button" class="btn btn-error" id="remove-opcao-${opcao.ID}" 
                                    onclick="removeOpcao(${opcao.ID})">
                                <i class="fa fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
                $('#opcao-row-new-' + line).remove();
                $('.modal-opcoes-tbody').append(html);
                avisos('Sucesso', 'Opção atualizada com sucesso', 'success');
                const boteriaId = localStorage.getItem('boteria_id');
                if (boteriaId) {
                    loadFluxogramaTemplate(boteriaId);
                }
            },
            function (error) {
                loadElement('opcao_next_fluxo_' + line, false);
                loadElement('remove-opcao-' + line, false);
                loadElement('opcao_next_fluxo_nome_' + line, false);
                console.error('Erro ao atualizar opção:', error);
                avisos('Erro', error?.message || 'Erro ao atualizar opção', 'error');
            }
        );
    }

    function addLineNew() {
        allMensagens = gbAllMsg;
        lineint++;
        html = `<tr class="opcao-row-new-${lineint}">
                    <td class="max-w-xs truncate">
                        <input type="text" placeholder="Opção/Palavras-chave" class="input input-bordered w-full opcao_next_fluxo_nome_add_${lineint}" maxlength="255">
                    </td>
                    <td>
                        <select class="select select-bordered opcao_next_fluxo_add_${lineint}" name="opcao_next_fluxo_add_${lineint}" >
                            <option value="" selected>Selecione</option>
                            ${allMensagens.map(m =>
            `<option value="${m.ID}">${escapeHtml(m.Nome)}</option>`
        ).join('')}
                        </select>
                    </td>
                    <td>
                        <button type="button" class="btn btn-error"  
                                onclick="$('.opcao-row-new-${lineint}').remove()">
                            <i class="fa fa-trash"></i>
                        </button>
                        <button type="button" class="btn btn-success"  
                                onclick="addNewOpcao(${lineint})">
                            <i class="fa fa-save"></i>
                        </button>
                    </td>
                </tr>`;
        $('.modal-opcoes-tbody-add').append(html);
    }

    function addNewOpcao(pos) {
        //opcao_next_fluxo_nome_add_10000001
        const textoOpcao = $(`[name="opcao_next_fluxo_nome_add_${pos}"]`).val() || $(`.opcao_next_fluxo_nome_add_${pos}`).val();
        const next = $(`[name="opcao_next_fluxo_add_${pos}"] option:selected`).text();
        console.log(textoOpcao, next, pos);
        if (!textoOpcao || textoOpcao.trim() === '') {
            avisos('Atenção', 'O nome da opção não pode ficar vazio.', 'warning');
            return;
        }
        opcao.push({
            "nome": textoOpcao,
            "next_fluxo_id": parseInt($(`[name="opcao_next_fluxo_add_${pos}"]`).val()),
            "fluxo_id": 0
        });
        $('.opcao-row-new-' + pos).remove();
        opI = opcao.length - 1;
        html = `
                <tr class="opcao-row-add-${pos}">
                    <td class="max-w-xs truncate">
                     ${textoOpcao}
                    </td>
                    <td>
                        ${next}
                    </td>
                    <td>
                        <button type="button" class="btn btn-error" id="remove-opcao-add-${opI}" 
                                onclick="removeOpcaoNew(${opI}, ${pos})">
                            <i class="fa fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        $('.modal-opcoes-tbody-add').append(html);
    }

    function removeOpcaoNew(pos, elemento) {
        opcao.splice(pos, 1);
        $(`.opcao-row-add-${elemento}`).remove();
    }

    init();

    function criarNovoFluxo(event) {
        event.preventDefault();

        const formData = new FormData(event.target);
        const loadingBtn = document.getElementById('fluxo-loading-create');

        // Mostrar loading
        loadingBtn?.classList.remove('hidden');
        event.target.querySelector('button[type="submit"]').disabled = true;

        // Processar estrutura da mensagem (Header, Body, Footer)
        const messageStructure = {
            header: null,
            body: formData.get('body_text_add') || '',
            footer: formData.get('footer_text_add') || null,
            callphone: {
                // Texto para TTS/áudio no Callphone (se fornecido)
                body: formData.get('callphone_body_text_add') || ''
            }
        };

        // Processar Header
        const headerTipo = formData.get('header_tipo_add');
        if (headerTipo) {
            messageStructure.header = {
                type: headerTipo
            };

            if (headerTipo === 'text') {
                messageStructure.header.text = formData.get('header_text_add') || '';
            } else if (headerTipo === 'location') {
                messageStructure.header.location = {
                    latitude: formData.get('header_location_lat_add') || '',
                    longitude: formData.get('header_location_lng_add') || ''
                };
            } else if (['image', 'video', 'document'].includes(headerTipo)) {
                messageStructure.header.media = {
                    base64: formData.get('header_media_b64_add') || '',
                    mime: formData.get('header_media_mime_add') || '',
                    filename: formData.get('header_media_name_add') || ''
                };
            }
        }

        // Processar Botões
        const buttons = [];
        const buttonElements = document.querySelectorAll('#buttons_container_add [data-button-type]');

        buttonElements.forEach(btnElement => {
            const buttonId = btnElement.id;
            const buttonType = formData.get(`button_type_${buttonId}`);
            const buttonText = formData.get(`button_text_${buttonId}`);

            if (buttonType && buttonText) {
                if (buttonType === 'quick_reply') {
                    buttons.push({
                        type: 'quick_reply',
                        text_whatsapp: buttonText,
                        text_ura: formData.get(`button_ura_text_${buttonId}`) || null,
                        next: {
                            boteria_id: parseInt(formData.get(`button_boteria_${buttonId}`)) || null,
                            fluxo_id: parseInt(formData.get(`button_mensagem_${buttonId}`)) || null
                        }
                    });
                } else if (buttonType === 'url') {
                    buttons.push({
                        type: 'url',
                        text: buttonText,
                        url: formData.get(`button_url_${buttonId}`)
                    });
                } else if (buttonType === 'call') {
                    buttons.push({
                        type: 'call',
                        text: buttonText,
                        phone_number: formData.get(`button_phone_${buttonId}`)
                    });
                } else if (buttonType === 'copy') {
                    buttons.push({
                        type: 'copy',
                        text: buttonText
                    });
                }
            }
        });

        // Processar configurações de função baseado na API
    const funcaoId = formData.get('funcao_add');
        let funcaoConfig = null;

        // Validar restrições da função usando Parametros da API
        if (funcaoId) {
            const funcaoInfo = getFuncaoById(funcaoId);

            if (funcaoInfo) {
                // Validação genérica baseada na API
                const erroValidacao = validarRestricoesFuncaoAntesSalvar(
                    funcaoId,
                    buttons,
                    messageStructure
                );

                if (erroValidacao) {
                    loadingBtn?.classList.add('hidden');
                    event.target.querySelector('button[type="submit"]').disabled = false;
                    avisos('Erro de Validação', erroValidacao, 'error');
                    return false;
                }

                // Montar config baseado no nome da função
                const funcaoNome = funcaoInfo.Nome;

                if (funcaoNome === 'queue' || funcaoNome === 'fila') {
                    // Montar config de fila
                    const configFila = {
                        queue_callphone: parseInt(formData.get('callphone_queue_id_add')) || null,
                        queue_webbot: parseInt(formData.get('webbot_queue_id_add')) || null,
                        execucao: funcaoInfo?.Parametros?.exe || 1
                    };

                    // Validar campos obrigatórios
                    const erroObrigatorios = validarCamposObrigatorios(funcaoId, configFila);
                    if (erroObrigatorios) {
                        loadingBtn?.classList.add('hidden');
                        event.target.querySelector('button[type="submit"]').disabled = false;
                        avisos('Erro de Validação', erroObrigatorios, 'error');
                        return false;
                    }
                    funcaoConfig = {
                        funcao_id: parseInt(funcaoId),
                        funcao_nome: funcaoNome,
                        parametros: funcaoInfo.Parametros,
                        config: configFila
                    };

                } else if (funcaoNome === 'transferir_boteria' || funcaoNome === 'transfer') {
                    funcaoConfig = {
                        funcao_id: parseInt(funcaoId),
                        funcao_nome: funcaoNome,
                        parametros: funcaoInfo.Parametros,
                        config: {
                            boteria_id: parseInt(formData.get('boteria_id_add')) || null,
                            fluxo_id: parseInt(formData.get('fluxo_id_transferir_add')) || null,
                            execucao: funcaoInfo.Parametros.exe || 1
                        }
                    };

                } else if (funcaoNome === 'hangup') {
                    funcaoConfig = {
                        funcao_id: parseInt(funcaoId),
                        funcao_nome: funcaoNome,
                        parametros: funcaoInfo.Parametros,
                        config: {
                            send_final_message: formData.has('send_final_message_add'),
                            final_message: formData.get('final_message_add') || null,
                            close_conversation: formData.has('close_conversation_add'),
                            execucao: funcaoInfo.Parametros.exe || 1
                        }
                    };
                } else {
                    // Função genérica
                    funcaoConfig = {
                        funcao_id: parseInt(funcaoId),
                        funcao_nome: funcaoNome,
                        parametros: funcaoInfo.Parametros,
                        config: {}
                    };
                }
            }
        }

        // Preparar dados para envio
        // IDs de boteria específicos para relacionamentos
        const fluxoNextBoteriaId = parseInt(document.getElementById('fluxo_next_boteria_add')?.value) || null;
        const limiteErroBoteriaId = parseInt(document.getElementById('limite_repeticao_error_boteria_add')?.value) || null;

        const data = {
            boteria_id: parseInt(localStorage.getItem('boteria_id')),
            bl_skip: formData.has('bl_skip_add'),
            fluxo_complementar_bl: formData.has('fluxo_complementar_bl_add'),
            fluxo_next_boteria_id: fluxoNextBoteriaId,
            fluxo_next: parseInt(formData.get('fluxo_next_add')) || null,
            funcao: parseInt(funcaoId) || null,
            limite_repeticao: parseInt(formData.get('limite_repeticao_add')) || null,
            limite_repeticao_error_boteria_id: limiteErroBoteriaId,
            limite_repeticao_error_fluxo: parseInt(formData.get('limite_repeticao_error_fluxo_add')) || null,
            nome: formData.get('nome_add'),
            texto: formData.get('body_text_add'), // Usar o body como texto principal
            variaveis_fluxos: parseInt(formData.get('variaveis_fluxos_add')) || null,
            queue_id: parseInt(formData.get('callphone_queue_id_add')) || null,
            wb_fila_id: parseInt(formData.get('webbot_queue_id_add')) || null,
            opcoes: opcao || [], // Usar as opções que foram adicionadas temporariamente

            // Nova estrutura de mensagem do Meta WhatsApp
            message_structure: messageStructure,
            buttons: buttons,

            // Configurações de função
            funcao_config: funcaoConfig
        };

        console.log('Criando novo fluxo:', data);

        req(`v1/admin/fluxos/mensagem`, 'POST', data,
            function (response) {
                loadingBtn?.classList.add('hidden');
                event.target.querySelector('button[type="submit"]').disabled = false;

                console.log('Fluxo criado com sucesso:', response);
                avisos('Sucesso', 'Novo fluxo criado com sucesso', 'success');
                closeAddFluxoModal();

                // Recarregar o fluxograma
                const boteriaId = localStorage.getItem('boteria_id');
                if (boteriaId) {
                    loadFluxogramaTemplate(boteriaId);
                }
            },
            function (error) {
                loadingBtn?.classList.add('hidden');
                event.target.querySelector('button[type="submit"]').disabled = false;

                console.error('Erro ao criar fluxo:', error);
                avisos('Erro', error?.message || 'Erro ao criar novo fluxo', 'error');
            }
        );

        return false;
    }

    function closeAddFluxoModal() {
        if (fluxoAddMensagemModal) {
            fluxoAddMensagemModal.close();
        }
        // Limpar o array de opções temporárias
        opcao = [];
    }

    // ============ MODALS ============
    const MODALS = {
        handleMediaUpload,
        toggleHeaderContent,
        handleFuncaoChange,
        toggleQueueType,
        toggleFinalMessage,
        toggleFluxoComplementar,
        carregarMensagensPorBoteria
    };

    // ============ BUTTONS ============
    const BUTTONS = {
        addButtonQuickReply,
        addButtonUrl,
        addButtonCall,
        addButtonCopy,
        removeButton,
        renumerarBotoes,
        reorganizarBotoes
    };

    // ============ NAVIGATION ============
    const NAVIGATION = {
        voltarParaFluxos,
        openModalFluxoIniciado
    };

    // ============ CRUD ============
    const CRUD = {
        editarFluxo,
        updateFluxo,
        closeEditFluxoModal,
        removeOpcao,
        alterarOpcaoDaMensagem,
        addLine,
        addOpcao,
        createAddFluxoForm,
        addLineNew,
        addNewOpcao,
        removeOpcaoNew,
        criarNovoFluxo,
        closeAddFluxoModal
    };

    // ============ EVENT DELEGATION ============
    // Sistema centralizado de eventos para substituir onclick/onchange inline
    
    // Flag para garantir que event listeners sejam adicionados apenas uma vez
    let eventDelegationInitialized = false;
    
    function setupEventDelegation() {
        // Evitar adicionar listeners duplicados
        if (eventDelegationInitialized) {
            console.log('Event delegation já inicializado, pulando...');
            return;
        }
        eventDelegationInitialized = true;
        console.log('✓ Inicializando event delegation...');
        
        // Remover todos os elementos do container
        const _containerEdit = document.querySelector('#fluxos-modal-container');
        if (_containerEdit) _containerEdit.innerHTML = '';

        // Event delegation para document (captura eventos de elementos dinâmicos)
        document.addEventListener('click', function(e) {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;
            const mode = target.dataset.mode || 'add';
            const id = target.dataset.id;

            switch (action) {
                case 'add-button-quick-reply':
                    e.preventDefault();
                    addButtonQuickReply(mode);
                    break;
                case 'add-button-url':
                    e.preventDefault();
                    addButtonUrl(mode);
                    break;
                case 'add-button-call':
                    e.preventDefault();
                    addButtonCall(mode);
                    break;
                case 'add-button-copy':
                    e.preventDefault();
                    addButtonCopy(mode);
                    break;
                case 'remove-button':
                    e.preventDefault();
                    removeButton(id, mode);
                    break;
                case 'close-modal-fluxo-iniciado':
                    e.preventDefault();
                    if (fluxoIniciadoModal) fluxoIniciadoModal.close();
                    break;
                case 'close-add-fluxo-modal':
                    e.preventDefault();
                    closeAddFluxoModal();
                    break;
                case 'close-edit-fluxo-modal':
                    e.preventDefault();
                    closeEditFluxoModal();
                    break;
                case 'audio-preview-tts':
                    e.preventDefault();
                    if (typeof AudioPreviewTextToSpeech === 'function') {
                        AudioPreviewTextToSpeech();
                    }
                    break;
                case 'remove-element':
                    e.preventDefault();
                    document.getElementById(id)?.remove();
                    break;
            }
        });

        // Event delegation para change events
        document.addEventListener('change', function(e) {
            const target = e.target;
            
            // Header tipo change
            if (target.id && target.id.startsWith('header_tipo_')) {
                const mode = target.id.replace('header_tipo_', '');
                toggleHeaderContent(mode);
            }
            
            // Função change
            else if (target.id && target.id.startsWith('funcao_')) {
                const mode = target.id.replace('funcao_', '');
                handleFuncaoChange(mode);
            }
            
            // Fluxo complementar toggle
            else if (target.name && target.name.startsWith('fluxo_complementar_bl_')) {
                const mode = target.name.replace('fluxo_complementar_bl_', '');
                toggleFluxoComplementar(mode);
            }
            
            // Carregar mensagens por boteria
            else if (target.dataset.loadMessages) {
                const targetSelectId = target.dataset.loadMessages;
                carregarMensagensPorBoteria(target.value, targetSelectId);
            }
            
            // Media upload
            else if (target.name && target.name.includes('header_media_file_')) {
                const mode = target.name.replace('header_media_file_', '');
                handleMediaUpload(target, mode);
            }
        });

        // Event delegation para submit
        document.addEventListener('submit', function(e) {
            console.log('📝 Submit event capturado:', e.target.id);
            
            // Formulário de fluxo iniciado
            if (e.target.id === 'fluxo-iniciado-form') {
                e.preventDefault();
                console.log('→ Executando handleFluxoIniciadoSubmit');
                handleFluxoIniciadoSubmit(e.target);
            }
            // Formulário de edição de fluxo
            else if (e.target.id && e.target.id.startsWith('fluxo-edit-form-')) {
                e.preventDefault();
                const fluxoId = e.target.dataset.fluxoId;
                console.log('→ Executando updateFluxo para fluxo ID:', fluxoId);
                updateFluxo(e, parseInt(fluxoId));
            }
            // Formulário de criação de fluxo
            else if (e.target.id === 'fluxo-add-form') {
                e.preventDefault();
                console.log('→ Executando criarNovoFluxo');
                criarNovoFluxo(e);
            }
        });
    }

    // ============ EXPOSIÇÃO GLOBAL (APENAS NAMESPACE) ============
    window.BashFluxograma = {
        UTILS,
        MODALS,
        BUTTONS,
        NAVIGATION,
        CRUD,
        STATE: { opcao, FUNCOES_API, fluxoPage }
    };

    // Inicializar event delegation
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupEventDelegation);
    } else {
        setupEventDelegation();
    }

    // ============ EXPOSIÇÃO TEMPORÁRIA PARA DEBUG ============
    // Remover após migrar todo HTML para data-attributes
    if (window.location.hostname === 'localhost' || window.location.hostname.includes('dev')) {
        console.warn('⚠️ BashFluxograma: Modo debug ativado - funções expostas globalmente');
        window.BashFluxograma.DEBUG = {
            handleMediaUpload,
            toggleHeaderContent,
            handleFuncaoChange,
            toggleFluxoComplementar,
            carregarMensagensPorBoteria,
            addButtonQuickReply,
            addButtonUrl,
            addButtonCall,
            addButtonCopy,
            removeButton,
            closeAddFluxoModal,
            AudioPreviewTextToSpeech: () => console.warn('AudioPreviewTextToSpeech não implementado')
        };
    }

    // Função de teste para demonstrar o modal (pode ser removida após testes)
    window.testarModalFluxo = function () {
        // Dados de exemplo baseados na estrutura da API
        const dadosExemplo = {
            "fluxos": {
                "ID": 106,
                "BoteriaID": 1,
                "Nome": "Reconhecimento de UF",
                "Texto": "Em qual estado você reside, em São Paulo ou Rio de Janeiro, fale apenas um destes dois estados.",
                "FluxoComplementarBl": false,
                "FluxoNext": null,
                "Funcao": "stt",
                "LimiteRepeticao": null,
                "LimiteRepeticaoErrorFluxo": null,
                "VariaveisFluxos": null,
                "BlSkip": false,
                "FuncaoDescricao": null
            },
            "opcoes": [
                {
                    "ID": 59,
                    "Nome": "Rj, rio, rio de Janeiro",
                    "FluxoID": 106,
                    "NextFluxoID": 105
                },
                {
                    "ID": 60,
                    "Nome": "Sp,São Paulo, Sampa",
                    "FluxoID": 106,
                    "NextFluxoID": 107
                }
            ],
            "all_variaveis": [
                {
                    "ID": 1,
                    "Nome": "cpfcnpj"
                },
                {
                    "ID": 2,
                    "Nome": "pergunta 1"
                }
            ],
            "all_mensagens": [
                {
                    "ID": 105,
                    "Nome": "Menu RJ",
                    "Texto": "Compreendi, Rio de Janeiro...",
                    "Funcao": null
                },
                {
                    "ID": 107,
                    "Nome": "Menu SP",
                    "Texto": "Ok, São Paulo...",
                    "Funcao": null
                },
                {
                    "ID": 108,
                    "Nome": "Captura CPF",
                    "Texto": "Digite seu CPF",
                    "Funcao": "cpfcnpj"
                },
                {
                    "ID": 109,
                    "Nome": "Fila Atendimento",
                    "Texto": "Aguarde um momento",
                    "Funcao": "queue"
                },
                {
                    "ID": 110,
                    "Nome": "Encerrar",
                    "Texto": "Obrigado pelo contato",
                    "Funcao": "hangup"
                },
                {
                    "ID": 111,
                    "Nome": "Reconhecimento Voz",
                    "Texto": "Fale sua opção",
                    "Funcao": "stt"
                }
            ]
        };

        openEditFluxoModal(dadosExemplo);
    };

})();