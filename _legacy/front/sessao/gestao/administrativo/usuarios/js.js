// Gerenciamento de Usuários - Sistema Bash
(function() {
    'use strict';

    // Estado global da aplicação
    let appState = {
        usuarios: [],
        permissoes: [],
        canais: [],
        empresas: [], // Empresas disponíveis para o usuário logado
        psEndpoints: [], // PS Endpoints disponíveis
        modelosCallphone: [], // Modelos de callphone
        nivelAPILogado: ProfileSession.permissao ? ProfileSession.permissao.nivel_api : 1.0, // Nível do usuário logado (vem da sessão)
        filtros: {
            q: '',
            permissao_id: '',
            canal_id: '',
            empresa_id: '',
            status: 'ativo' // Padrão: mostrar apenas ativos
        },
        pagina: 1,
        total: 0,
        limit: 20,
        loading: false,
        modals: {},
        pagination: null
    };

    // ============ INICIALIZAÇÃO ============
    
    function init() {
        console.log('Inicializando tela de usuários...');
        setupEventListeners();
        loadInitialData();
    }

    function setupEventListeners() {
        // Botões principais
        document.getElementById('usuarios-btn-novo').addEventListener('click', openCreateModal);

        // Formulário de filtros
        document.getElementById('usuarios-form-filtros').addEventListener('submit', handleFilterSubmit);
        document.getElementById('usuarios-btn-limpar').addEventListener('click', clearFilters);

        // Ordenação da tabela
        document.querySelectorAll('th[data-sort]').forEach(th => {
            th.addEventListener('click', function() {
                handleSort(this.dataset.sort);
            });
        });

        // Filtro de texto com debounce
        let searchTimeout;
        document.getElementById('filtro-q').addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                appState.filtros.q = this.value;
                appState.pagina = 1;
                loadUsuarios();
            }, 500);
        });
    }

    function loadInitialData() {
        loadEmpresas();
        loadPermissoes();
        loadCanais();
        loadUsuarios();
        loadModelosCallphone();
        loadPSEndpoints(); // Nova função para carregar PS Endpoints
        
        // Log para debug
        console.log('Nível API do usuário logado (GlobNivelAPI):', GlobNivelAPI);
    }

    // ============ CARREGAMENTO DE DADOS ============

    function loadPermissoes() {
        req('v1/admin/options/permissoes', 'GET', '', 
            function(response) {
                if (response && response.data) {
                    appState.permissoes = response.data;
                    popularSelect('filtro-permissao', appState.permissoes, 'nome', 'id');
                }
            },
            function(error) {
                console.error('Erro ao carregar permissões:', error);
                avisos('Erro', 'Não foi possível carregar as permissões', 'error');
            }
        );
    }

    function loadCanais() {
        req('v1/admin/options/canais-atendimentos', 'GET', '', 
            function(response) {
                if (response && response.data) {
                    appState.canais = response.data;
                    popularSelect('filtro-canal', appState.canais, 'nome', 'id');
                }
            },
            function(error) {
                console.error('Erro ao carregar canais:', error);
                avisos('Erro', 'Não foi possível carregar os canais', 'error');
            }
        );
    }

    function loadEmpresas() {
        req('v1/admin/options/empresas', 'GET', '', 
            function(response) {
                if (response && response.data) {
                    appState.empresas = response.data;
                    popularSelect('filtro-empresa', appState.empresas, 'nome', 'id');

                    if (appState.empresas.length === 1) {
                        document.getElementById('filtro-empresa').value = appState.empresas[0].id;
                    }

                }
            },
            function(error) {
                console.error('Erro ao carregar empresas:', error);
                avisos('Erro', 'Não foi possível carregar as empresas', 'error');
            }
        );
    }

    function loadUsuarios() {
        if (appState.loading) return;
        
        setLoading(true);
        
        // Construir query params
        const params = new URLSearchParams({
            empresa_id: appState.filtros.empresa_id,
            page: appState.pagina,
            page_size: appState.limit
        });

        // Adicionar filtros
        Object.keys(appState.filtros).forEach(key => {
            if (appState.filtros[key]) {
                params.append(key, appState.filtros[key]);
            }
        });

        // Tratar filtro de status especial
        console.log('Status atual:', appState.filtros.status); // Debug
        if (appState.filtros.status === 'ativo') {
            params.delete('status');
            console.log('Filtro ATIVO - apenas ativos'); // Debug
            // Não adiciona with_deleted, só mostra ativos
        } else if (appState.filtros.status === 'deletado') {
            params.delete('status');
            params.append('only_deleted', 'true');
            console.log('Filtro DELETADO - only_deleted=true'); // Debug
        } else if (appState.filtros.status === '' || !appState.filtros.status) {
            // Status "Todos" - incluir deletados também
            params.delete('status');
            params.append('with_deleted', 'true');
            console.log('Filtro TODOS - with_deleted=true'); // Debug
        }

        console.log('URL final:', `v1/admin/usuarios?${params.toString()}`); // Debug

        const url = `v1/admin/usuarios?${params.toString()}`;
        
        req(url, 'GET', '', 
            function(response) {
                setLoading(false);
                if (response && response.data) {
                    appState.usuarios = response.data.data || response.data.usuarios || [];
                    appState.total = response.data.total || 0;
                    
                    renderUsuariosTable();
                    setupPagination();
                } else {
                    avisos('Erro', 'Formato de resposta inválido', 'error');
                }
            },
            function(error) {
                setLoading(false);
                console.error('Erro ao carregar usuários:', error);
                avisos('Erro', error?.message || 'Não foi possível carregar os usuários', 'error');
                renderUsuariosTable([]);
            }
        );
    }

    // ============ RENDERIZAÇÃO ============

    function renderUsuariosTable() {
        const tbody = document.getElementById('usuarios-table-body');
        tbody.innerHTML = '';

        if (!appState.usuarios || appState.usuarios.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-12">
                        <div class="mx-auto w-24 h-24 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
                            <i class="fa-solid fa-users text-3xl text-blue-600 dark:text-blue-400"></i>
                        </div>
                        <p class="text-gray-500">Nenhum usuário encontrado</p>
                    </td>
                </tr>
            `;
            return;
        }

        appState.usuarios.forEach(usuario => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="font-medium">${escapeHtml(usuario.nome || '-')}</td>
                <td class="text-sm text-gray-600">${escapeHtml(usuario.usuario || '-')}</td>
                <td class="text-sm">${escapeHtml(usuario.email || '-')}</td>
                <td>
                    <span class="badge badge-outline">${escapeHtml(usuario.permissao_nome || '-')}</span>
                </td>
                <td>
                    <div class="flex flex-wrap gap-1">
                        ${renderCanaisUsuario(usuario.canais_atendimentos)}
                    </div>
                </td>
                <td class="text-sm text-base-content/70">
                    ${formatarData(usuario.created_at)}
                </td>
                <td class="text-sm text-base-content/70">
                    ${formatarData(usuario.updated_at)}
                </td>
                <td>
                    ${renderStatusUsuario(usuario.deleted_at)}
                </td>
                <td>
                    <div class="flex gap-1">
                        ${renderAcoesUsuario(usuario)}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderCanaisUsuario(canais) {
        if (!canais || canais.length === 0) {
            return '<span class="text-base-content/50">Nenhum</span>';
        }
        
        return canais.map(canal => 
            `<span class="badge badge-sm badge-primary">${escapeHtml(canal.nome)}</span>`
        ).join('');
    }

    function renderStatusUsuario(deletedAt) {
        if (deletedAt) {
            return '<span class="badge badge-error badge-sm">Excluído</span>';
        }
        return '<span class="badge badge-success badge-sm">Ativo</span>';
    }

    function renderAcoesUsuario(usuario) {
        // Verificar se o usuário tem nível maior que o logado
        const nivelUsuario = usuario.nivel_api || 1.0;
        const podeEditar = nivelUsuario <= appState.nivelAPILogado;
        
        if (usuario.deleted_at) {
            // Só pode restaurar se tiver permissão de editar
            if (!podeEditar) {
                return '<span class="text-base-content/50 text-sm">Sem permissão</span>';
            }
            return `
                <button class="btn btn-sm btn-outline btn-success" 
                        onclick="usuarios.restore(${usuario.id})" 
                        title="Restaurar">
                    <i class="fas fa-undo"></i>
                </button>
            `;
        }
        
        // Se não pode editar, mostra apenas indicador
        if (!podeEditar) {
            return '<span class="text-base-content/50 text-sm">Sem permissão</span>';
        }
        
        return `
            <button class="btn btn-sm btn-outline btn-primary" 
                    onclick="usuarios.edit(${usuario.id})" 
                    title="Editar">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-outline btn-error" 
                    onclick="usuarios.delete(${usuario.id})" 
                    title="Excluir">
                <i class="fas fa-trash"></i>
            </button>
        `;
    }

    // ============ PAGINAÇÃO ============

    function setupPagination() {
        if (appState.pagination) {
            appState.pagination.update(appState.pagina, appState.total);
        } else {
            appState.pagination = new window.BashPagination({
                id: 'usuarios-pagination',
                pagina: appState.pagina,
                total: appState.total,
                limit: appState.limit,
                container: '#usuarios-paginacao',
                onNext: (pagina) => {
                    appState.pagina = pagina;
                    loadUsuarios();
                },
                onPrev: (pagina) => {
                    appState.pagina = pagina;
                    loadUsuarios();
                }
            });
        }
    }

    // ============ MODAIS ============

    function openCreateModal() {
        // Sempre destruir o modal anterior se existir
        if (appState.modals.create) {
            appState.modals.create.destroy();
            delete appState.modals.create;
        }

        if (appState.modals.edit) {
            appState.modals.edit.destroy();
            delete appState.modals.edit;
        }

        // Criar novo modal
        appState.modals.create = new window.BashModal({
            id: 'usuarios-modal-create',
            titulo: 'Novo Usuário',
            classSize: 'w-11/12 max-w-2xl',
            container: '#usuarios-modal-container'
        });

        // Criar formulário com todos os campos e eventos
        const form = createUserForm();
        appState.modals.create.setContent(form);
        appState.modals.create.open();
        
        // Configurar eventos específicos após abrir o modal
        console.log("Abrindo modal de criação de usuário");
        setupModalEvents(false);
    }

    function openEditModal(usuarioId) {
        loadElement('usuarios-btn-novo', true);

        req(`v1/admin/usuarios/${usuarioId}`, 'GET', '',
            function(response) {
                loadElement('usuarios-btn-novo', false);
                
                if (response && response.data) {
                    console.log('Dados do usuário carregados:', response.data); // Debug
                    
                    // Sempre destruir o modal anterior se existir
                    if (appState.modals.edit) {
                        appState.modals.edit.destroy();
                        delete appState.modals.edit;
                    }

                    if (appState.modals.create) {
                        appState.modals.create.destroy();
                        delete appState.modals.create;
                    }

                    // Criar novo modal
                    appState.modals.edit = new window.BashModal({
                        id: 'usuarios-modal-edit',
                        titulo: 'Editar Usuário',
                        classSize: 'w-11/12 max-w-2xl',
                        container: '#usuarios-modal-container'
                    });

                    // Criar formulário com todos os campos e eventos
                    const form = createUserForm(response.data);
                    appState.modals.edit.setContent(form);
                    appState.modals.edit.open();
                    
                    // Configurar eventos específicos após abrir o modal
                    setupModalEvents(true, response.data);
                } else {
                    avisos('Erro', 'Usuário não encontrado', 'error');
                }
            },
            function(error) {
                loadElement('usuarios-btn-novo', false);
                avisos('Erro', error?.message || 'Erro ao carregar usuário', 'error');
            }
        );
    }

    function createUserForm(usuario = null) {
        const isEdit = !!usuario;

        const container = document.createElement('div');
        container.innerHTML = `
            <form id="usuarios-form-${isEdit ? 'edit' : 'create'}" class="space-y-4">
                <!-- Campo empresas -->
                <div class="form-control">
                    <label class="label">
                        <span class="label-text">Empresas *</span>
                    </label>
                    <div class="grid grid-cols-2 gap-2 p-3 border border-base-300 rounded-lg max-h-40 overflow-y-auto">
                        ${(appState.empresas || []).map(empresa => {
                            const isSelected = isEdit && usuario.empresas && 
                                              usuario.empresas.some(e => e.id === empresa.id);
                            return `
                                <label class="label cursor-pointer justify-start gap-2">
                                    <input type="checkbox" name="empresas_ids" 
                                           value="${empresa.id}" 
                                           class="checkbox checkbox-sm"
                                           ${isSelected ? 'checked' : ''}>
                                    <span class="label-text">${escapeHtml(empresa.nome)}</span>
                                </label>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Campo nome -->
                <div class="form-control">
                    <label class="label">
                        <span class="label-text">Nome completo *</span>
                    </label>
                    <input type="text" name="nome" 
                           class="input input-bordered" 
                           placeholder="Ex: João Silva"
                           value="${isEdit ? escapeHtml(usuario.nome || '') : ''}"
                           required>
                </div>

                <!-- Campo usuário -->
                <div class="form-control">
                    <label class="label">
                        <span class="label-text">Nome de usuário *</span>
                    </label>
                    <input type="text" name="usuario" 
                           class="input input-bordered" 
                           placeholder="Ex: joao.silva"
                           value="${isEdit ? escapeHtml(usuario.usuario || '') : ''}"
                           required>
                </div>

                <!-- Campo e-mail -->
                <div class="form-control">
                    <label class="label">
                        <span class="label-text">E-mail</span>
                    </label>
                    <input type="email" name="email" 
                           class="input input-bordered" 
                           placeholder="Ex: joao.silva@empresa.com"
                           value="${isEdit ? escapeHtml(usuario.email || '') : ''}">
                </div>

                <!-- Campo senha -->
                <div class="form-control">
                    <label class="label">
                        <span class="label-text">Senha ${isEdit ? '' : '*'}</span>
                    </label>
                    <input type="password" name="senha" 
                           class="input input-bordered" 
                           placeholder="${isEdit ? 'Deixe em branco para manter atual' : 'Mínimo 6 caracteres'}"
                           ${isEdit ? '' : 'required'}>
                    ${isEdit ? '<div class="label"><span class="label-text-alt">Deixe em branco para manter a senha atual</span></div>' : ''}
                </div>
                
                <!-- Campo permissão -->
                <div class="form-control">
                    <label class="label">
                        <span class="label-text">Permissão *</span>
                    </label>
                    <select name="permissao_id" class="select select-bordered" required>
                        <option value="">Selecione uma permissão</option>
                        ${(appState.permissoes || []).map(p => 
                            `<option value="${p.id}" ${isEdit && usuario.permissao_id === p.id ? 'selected' : ''} 
                                ${p.nivel_api > appState.nivelAPILogado ? 'disabled' : ''}>
                                ${escapeHtml(p.nome)}
                            </option>`
                        ).join('')}
                    </select>
                </div>

                <!-- Campo canais -->
                <div class="form-control">
                    <label class="label">
                        <span class="label-text">Canais de Atendimento</span>
                    </label>

                    <div class="grid grid-cols-2 gap-2 p-3 border border-base-300 rounded-lg max-h-40 overflow-y-auto">
                        ${(appState.canais || []).map(canal => {
                            const isSelected = isEdit && usuario.canais_atendimentos && 
                                              usuario.canais_atendimentos.some(c => c.id === canal.id);
                            return `
                                <label class="label cursor-pointer justify-start gap-2">
                                    <input type="checkbox" name="canais_atendimentos_ids" 
                                           value="${canal.id}" 
                                           class="checkbox checkbox-sm"
                                           ${isSelected ? 'checked' : ''}>
                                    <span class="label-text">${escapeHtml(canal.nome)}</span>
                                </label>
                            `;
                        }).join('')}
                    </div>
                </div>
                
                <!-- Campo modelo Callphone -->
                <div class="form-control ${isEdit && usuario.modelo_callphone && (usuario.canais_atendimentos || []).some(c => c.id === 3)? '':'hidden'}" id="callphone-model-select-container">
                    <label class="label">
                        <span class="label-text">Modelo Callphone</span>
                    </label>
                    <select id="callphone-model-select" name="callphone-model-select" class="select select-bordered">
                        <option value="">Selecione um modelo</option>
                        ${isEdit ? (appState.modelosCallphone || []).map(p => 
                            `<option value="${p.modelo}" ${usuario.modelo_callphone === p.modelo ? 'selected' : ''}>
                                ${escapeHtml(p.modelo)}
                            </option>`
                        ).join('') : ''}
                    </select>
                </div>

                <!-- Campo PS Endpoints -->
                <div class="form-control ${isEdit && (usuario.canais_atendimentos || []).some(c => c.id === 3)? '':'hidden'}" id="ps-endpoint-select-container">
                    <label class="label">
                        <span class="label-text">Tronco de Saida</span>
                    </label>
                    <select id="ps-endpoint-select" name="ps-endpoint-select" class="select select-bordered">
                        <option value="">Selecione um Tronco de Saida</option>
                        ${(appState.psEndpoints || []).map(p => 
                            `<option value="${p.value}" ${isEdit && (usuario.ps_endpoint === p.value || usuario.ps_endpoints === p.value) ? 'selected' : ''}>
                                ${escapeHtml(p.label)}
                            </option>`
                        ).join('')}
                    </select>
                </div>

                <!-- Campo Webbot Max Atendimentos -->
                <div class="form-control ${isEdit && (usuario.canais_atendimentos || []).some(c => [1, 2, 4].includes(c.id)) ? '' : 'hidden'}" id="webbot-max-att-container">
                    <label class="label">
                        <span class="label-text">Máximo de Atendimentos Simultâneos (Webbot)</span>
                    </label>
                    <input type="number" name="wb_max_att" 
                           id="wb-max-att-input"
                           class="input input-bordered" 
                           placeholder="Digite um valor entre 1 e 30"
                           min="1" 
                           max="30"
                           value="${isEdit && usuario.wb_max_att ? usuario.wb_max_att : ''}">
                    <div class="label">
                        <span class="label-text-alt">Valor entre 1 e 30 atendimentos simultâneos</span>
                    </div>
                </div>
                
                <!-- Botões -->
                <div class="modal-action">
                    <button type="button" class="btn btn-ghost" onclick="${isEdit ? 'usuarios.closeEditModal()' : 'usuarios.closeCreateModal()'}">
                        Cancelar
                    </button>
                    <button type="submit" class="btn btn-primary">
                        <span class="loading loading-spinner loading-sm hidden" id="usuarios-loading-save"></span>
                        ${isEdit ? 'Atualizar' : 'Criar'} Usuário
                    </button>
                </div>
            </form>
        `;

        // Event listener para o form
        const form = container.querySelector('form');
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            if (isEdit) {
                handleUpdateUser(usuario.id, form);
            } else {
                handleCreateUser(form);
            }
        });

        return container;
    }

    // Função para configurar todos os eventos do modal após sua criação
    function setupModalEvents(isEdit = false, usuario = null) {
        console.log('Configurando eventos do modal, isEdit:', isEdit);
        
        // Aguardar um pouco para garantir que o DOM está pronto
        setTimeout(() => {
            // Configurar event listeners para os checkboxes de canais
            const checkboxes = document.querySelectorAll('input[name="canais_atendimentos_ids"]');
            console.log('Checkboxes encontrados:', checkboxes.length);
            
            checkboxes.forEach((checkbox, index) => {
                console.log(`Adicionando evento ao checkbox ${index} - valor: ${checkbox.value}`);
                checkbox.addEventListener('change', function() {
                    console.log('Checkbox mudou! Valor:', this.value, 'Checked:', this.checked);
                    if (this.value === '3') {
                        handleCallphoneCheckboxChange();
                    }
                    if (['1', '2', '4'].includes(this.value)) {
                        handleWebbotCheckboxChange();
                    }
                });
            });

            // Se for modo de edição, configurar valores iniciais
            if (isEdit && usuario) {
                // Verificar se o canal Callphone está selecionado
                const callphoneCheckbox = document.querySelector('input[name="canais_atendimentos_ids"][value="3"]');
                if (callphoneCheckbox && callphoneCheckbox.checked) {
                    console.log('Canal Callphone está selecionado, mostrando campos...');
                    handleCallphoneCheckboxChange();
                    
                    // Definir PS Endpoint após popular
                    setTimeout(() => {
                        const psEndpointSelect = document.querySelector('#ps-endpoint-select');
                        if (psEndpointSelect && (usuario.ps_endpoint || usuario.ps_endpoints)) {
                            const psEndpointValue = usuario.ps_endpoint || usuario.ps_endpoints;
                            psEndpointSelect.value = psEndpointValue;
                            console.log('PS Endpoint definido no modal:', psEndpointValue);
                        }
                    }, 100);
                }

                // Verificar se algum canal Webbot está selecionado
                const webbotCanais = [1, 2, 4];
                const anyWebbotSelected = webbotCanais.some(id => {
                    const checkbox = document.querySelector(`input[name="canais_atendimentos_ids"][value="${id}"]`);
                    return checkbox && checkbox.checked;
                });
                
                if (anyWebbotSelected) {
                    console.log('Canal Webbot está selecionado, mostrando campo wb_max_att...');
                    handleWebbotCheckboxChange();
                }
            } else {
                // Modo de criação - verificar estado inicial dos campos
                console.log('Modo de criação - verificando estado inicial dos campos condicionais');
            }
        }, 50);
    }

    // ============ CRUD OPERATIONS ============

    function handleCreateUser() {
        console.log('handleCreateUser - Iniciando');
        const form = document.getElementById('usuarios-form-create');
        const formData = new FormData(form);
        
        // Capturar IDs das empresas selecionadas
        const empresasIds = Array.from(document.querySelectorAll('input[name="empresas_ids"]:checked'))
                                  .map(checkbox => parseInt(checkbox.value));
        
        // Validar que pelo menos uma empresa foi selecionada
        if (empresasIds.length === 0) {
            avisos('Validação', 'Selecione pelo menos uma empresa', 'warning');
            return;
        }
        
        // Preparar dados para envio
        const data = {
            nome: formData.get('nome'),
            usuario: formData.get('usuario'),
            email: formData.get('email') || '',
            senha: formData.get('senha'),
            permissao_id: parseInt(formData.get('permissao_id')),
            empresas_ids: empresasIds,
            canais: Array.from(document.querySelectorAll('input[name="canais_atendimentos_ids"]:checked'))
                        .map(checkbox => {
                            const canal = appState.canais.find(c => c.id === parseInt(checkbox.value));
                            return {
                                id: parseInt(checkbox.value),
                                nome: canal ? canal.nome : ''
                            };
                        }),
        };
        
        // Validação do Callphone
        const callphoneCheckbox = document.querySelector('input[name="canais_atendimentos_ids"][value="3"]');
        if (callphoneCheckbox && callphoneCheckbox.checked) { 
            if (!formData.get('callphone-model-select') || formData.get('callphone-model-select') === '') {
                avisos('Validação', 'Selecione um modelo Callphone', 'warning');
                focusCallphoneModelSelect()
                return;
            }
            data.modelo_callphone = formData.get('callphone-model-select');
            
            // Capturar PS Endpoint se selecionado
            if (formData.get('ps-endpoint-select') && formData.get('ps-endpoint-select') !== '') {
                data.ps_endpoint = formData.get('ps-endpoint-select');
            }
        }
        
        // Validação e captura do wb_max_att para canais Webbot
        const webbotCanais = [1, 2, 4];
        const webbotCheckboxes = webbotCanais.map(id => 
            document.querySelector(`input[name="canais_atendimentos_ids"][value="${id}"]`)
        );
        const anyWebbotSelected = webbotCheckboxes.some(checkbox => checkbox && checkbox.checked);
        
        if (anyWebbotSelected) {
            const wbMaxAtt = formData.get('wb_max_att');
            if (wbMaxAtt && wbMaxAtt !== '') {
                const maxAtt = parseInt(wbMaxAtt);
                if (maxAtt < 1 || maxAtt > 30) {
                    avisos('Validação', 'O máximo de atendimentos deve estar entre 1 e 30', 'warning');
                    document.getElementById('wb-max-att-input')?.focus();
                    return;
                }
                data.wb_max_att = maxAtt;
            }
        }
        
        console.log('handleCreateUser - Dados preparados:', data);

        req('v1/admin/usuarios',  'POST', data, (response) => {
            console.log('handleCreateUser - Resposta da API:', response);
            if (response.code==201) {
                avisos('Usuário criado com sucesso!', 'success');
                appState.modals.create.close();
                loadUsuarios();
            } else {
                avisos(response.message || 'Erro ao criar usuário', 'error');
            }
        }, (error) => {
            console.error('handleCreateUser - Erro na API:', error);
            avisos(error?.message || 'Erro ao criar usuário', 'error');
        });
    }   

    function handleUpdateUser(usuarioId, form) {
        const formData = new FormData(form);
        
        // Capturar IDs das empresas selecionadas
        const empresasIds = Array.from(document.querySelectorAll('input[name="empresas_ids"]:checked'))
                                  .map(checkbox => parseInt(checkbox.value));
        
        // Validar que pelo menos uma empresa foi selecionada
        if (empresasIds.length === 0) {
            avisos('Validação', 'Selecione pelo menos uma empresa', 'warning');
            return;
        }
        
        // Converter IDs dos canais para objetos {id, nome}
        const canaisIds = formData.getAll('canais_atendimentos_ids').map(id => parseInt(id));
        const canaisObjetos = canaisIds.map(id => {
            const canal = appState.canais.find(c => c.id === id);
            return canal ? { id: canal.id, nome: canal.nome } : null;
        }).filter(canal => canal !== null);
        
        const data = {
            nome: formData.get('nome').trim(),
            usuario: formData.get('usuario').trim(),
            email: formData.get('email') || '',
            permissao_id: parseInt(formData.get('permissao_id')),
            empresas_ids: empresasIds,
            canais: canaisObjetos
        };
        
        // Validação do Callphone
        const callphoneCheckbox = document.querySelector('input[name="canais_atendimentos_ids"][value="3"]');
        if (callphoneCheckbox && callphoneCheckbox.checked) { 
            if (!formData.get('callphone-model-select') || formData.get('callphone-model-select') === '') {
                avisos('Validação', 'Selecione um modelo Callphone', 'warning');
                focusCallphoneModelSelect()
                return;
            }
            data.modelo_callphone = formData.get('callphone-model-select');
            
            // Capturar PS Endpoint se selecionado
            if (formData.get('ps-endpoint-select') && formData.get('ps-endpoint-select') !== '') {
                data.ps_endpoint = formData.get('ps-endpoint-select');
            }
        }
        
        // Validação e captura do wb_max_att para canais Webbot
        const webbotCanais = [1, 2, 4];
        const webbotCheckboxes = webbotCanais.map(id => 
            document.querySelector(`input[name="canais_atendimentos_ids"][value="${id}"]`)
        );
        const anyWebbotSelected = webbotCheckboxes.some(checkbox => checkbox && checkbox.checked);
        
        if (anyWebbotSelected) {
            const wbMaxAtt = formData.get('wb_max_att');
            if (wbMaxAtt && wbMaxAtt !== '') {
                const maxAtt = parseInt(wbMaxAtt);
                if (maxAtt < 1 || maxAtt > 30) {
                    avisos('Validação', 'O máximo de atendimentos deve estar entre 1 e 30', 'warning');
                    document.getElementById('wb-max-att-input')?.focus();
                    return;
                }
                data.wb_max_att = maxAtt;
            }
        }

        const senha = formData.get('senha').trim();
        if (senha) {
            data.senha = senha;
        }

        if (!data.nome || !data.usuario || !data.permissao_id) {
            avisos('Validação', 'Preencha todos os campos obrigatórios', 'warning');
            return;
        }

        document.getElementById('usuarios-loading-save').classList.remove('hidden');

        req(`v1/admin/usuarios/${usuarioId}`, 'PUT', data,
            function(response) {
                document.getElementById('usuarios-loading-save').classList.add('hidden');
                avisos('Sucesso', 'Usuário atualizado com sucesso!', 'success');
                appState.modals.edit.close();
                loadUsuarios();
            },
            function(error) {
                document.getElementById('usuarios-loading-save').classList.add('hidden');
                avisos('Erro', error?.message || 'Erro ao atualizar usuário', 'error');
            }
        );
    }

    function handleDeleteUser(usuarioId) {
        const usuario = appState.usuarios.find(u => u.id === usuarioId);
        if (!usuario) return;

        abrirModalRemocao({
            titulo: 'Excluir Usuário',
            mensagem: `Tem certeza que deseja excluir o usuário "${usuario.usuario}"?`,
            onConfirm: () => {
                req(`v1/admin/usuarios/${usuarioId}`, 'DELETE', '',
                    function(response) {
                        avisos('Sucesso', 'Usuário excluído com sucesso!', 'success');
                        loadUsuarios();
                    },
                    function(error) {
                        avisos('Erro', error?.message || 'Erro ao excluir usuário', 'error');
                    }
                );
            }
        });
    }

    function handleRestoreUser(usuarioId) {
        const usuario = appState.usuarios.find(u => u.id === usuarioId);
        if (!usuario) return;

        abrirModalRemocao({
            titulo: 'Restaurar Usuário',
            mensagem: `Tem certeza que deseja restaurar o usuário "${usuario.usuario}"?`,
            labelRemover: 'Restaurar',
            onConfirm: () => {
                req(`v1/admin/usuarios/${usuarioId}/restore`, 'POST', '',
                    function(response) {
                        avisos('Sucesso', 'Usuário restaurado com sucesso!', 'success');
                        loadUsuarios();
                    },
                    function(error) {
                        avisos('Erro', error?.message || 'Erro ao restaurar usuário', 'error');
                    }
                );
            }
        });
    }

    // ============ FILTROS E EVENTOS ============

    function handleFilterSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const statusValue = formData.get('status') || '';
        console.log('Valor capturado do formulário - status:', statusValue); // Debug
        
        appState.filtros = {
            q: formData.get('q') || '',
            permissao_id: formData.get('permissao_id') || '',
            canal_id: formData.get('canal_id') || '',
            empresa_id: formData.get('empresa_id') || '',
            status: statusValue
        };
        
        console.log('appState.filtros depois da captura:', appState.filtros); // Debug
        
        appState.pagina = 1;
        loadUsuarios();
    }

    function clearFilters() {
        document.getElementById('usuarios-form-filtros').reset();
        appState.filtros = {
            q: '',
            permissao_id: '',
            canal_id: '',
            empresa_id: '',
            status: ''
        };
        appState.pagina = 1;
        loadUsuarios();
    }

    function handleSort(field) {
        // Por simplicidade, vamos recarregar os dados
        // Em uma implementação mais robusta, implementaríamos ordenação do lado servidor
        loadUsuarios();
    }

    // ============ UTILITÁRIOS ============

    function setLoading(loading) {
        appState.loading = loading;
        const loadingEl = document.getElementById('usuarios-loading');
        const tableEl = document.getElementById('usuarios-data-container');
        
        if (loading) {
            loadingEl.classList.remove('hidden');
            tableEl.style.opacity = '0.5';
        } else {
            loadingEl.classList.add('hidden');
            tableEl.style.opacity = '1';
        }
    }

    // Correct the validation logic for the Callphone model select visibility
    function handleCallphoneCheckboxChange() {
        const callphoneCheckbox = document.querySelector('input[name="canais_atendimentos_ids"][value="3"]');
        const callphoneModelContainer = document.getElementById('callphone-model-select-container');
        const callphoneModelSelect = document.getElementById('callphone-model-select');
        const psEndpointContainer = document.getElementById('ps-endpoint-select-container');
        const psEndpointSelect = document.getElementById('ps-endpoint-select');
        
        if (callphoneCheckbox && callphoneCheckbox.checked) {
            callphoneModelContainer?.classList.remove('hidden');
            psEndpointContainer?.classList.remove('hidden');
            
            if (callphoneModelSelect) {
                callphoneModelSelect.innerHTML = '<option value="">Selecione um modelo</option>';
                populateCallphoneModelSelect();
            }
            
            if (psEndpointSelect) {
                psEndpointSelect.innerHTML = '<option value="">Selecione um Tronco de Saida</option>';
                populatePSEndpointSelect();
            }
        } else {
            callphoneModelContainer?.classList.add('hidden');
            psEndpointContainer?.classList.add('hidden');
            
            if (callphoneModelSelect) {
                callphoneModelSelect.innerHTML = '<option value="">Selecione um modelo</option>';
            }
            
            if (psEndpointSelect) {
                psEndpointSelect.innerHTML = '<option value="">Selecione um Tronco de Saida</option>';
            }
        }        
    }

    function handleWebbotCheckboxChange() {
        // IDs dos canais Webbot: 1 (Webbot), 2 (Webbot Meta), 4 (Gupshup)
        const webbotCanais = [1, 2, 4];
        const webbotCheckboxes = webbotCanais.map(id => 
            document.querySelector(`input[name="canais_atendimentos_ids"][value="${id}"]`)
        );
        
        const webbotMaxAttContainer = document.getElementById('webbot-max-att-container');
        
        // Verifica se algum canal Webbot está selecionado
        const anyWebbotSelected = webbotCheckboxes.some(checkbox => checkbox && checkbox.checked);
        
        if (anyWebbotSelected) {
            webbotMaxAttContainer?.classList.remove('hidden');
        } else {
            webbotMaxAttContainer?.classList.add('hidden');
            const input = document.getElementById('wb-max-att-input');
            if (input) {
                input.value = '';
            }
        }
    }

    // Add a function to load Callphone models and populate the dropdown
    function loadModelosCallphone() {
        req('v1/admin/ramais/modelos', 'GET', '',
            function(response) {
                if (response && response.data) {
                    appState.modelosCallphone = response.data;
                } else {
                    console.error('Erro ao carregar modelos de Callphone: Resposta inválida');
                }
            },
            function(error) {
                console.error('Erro ao carregar modelos de Callphone:', error);
            }
        );
    }
    
    // Função para carregar PS Endpoints
    function loadPSEndpoints() {
        req('v1/admin/pabx/ps/endpoints/options', 'GET', '',
            function(response) {
                if (response && response.data) {
                    appState.psEndpoints = response.data;
                    console.log('PS Endpoints carregados:', appState.psEndpoints);
                } else {
                    console.error('Erro ao carregar PS Endpoints: Resposta inválida');
                }
            },
            function(error) {
                console.error('Erro ao carregar PS Endpoints:', error);
                avisos('Erro', 'Não foi possível carregar os PS Endpoints', 'error');
            }
        );
    }
    
    function populateCallphoneModelSelect() {
        const select = document.getElementById('callphone-model-select');
        if (!select) return;

        select.innerHTML = '<option value="">Selecione um modelo</option>';

        if (appState.modelosCallphone && Array.isArray(appState.modelosCallphone)) {
            appState.modelosCallphone.forEach(modelo => {
                const option = document.createElement('option');
                option.value = modelo.modelo;
                option.textContent = modelo.modelo;
                select.appendChild(option);
            });
        } else {
            console.error('Modelos Callphone não carregados ou inválidos.');
        }
    }

    function populatePSEndpointSelect() {
        const select = document.getElementById('ps-endpoint-select');
        if (!select) return;

        // Salvar o valor atualmente selecionado
        const currentValue = select.value;

        select.innerHTML = '<option value="">Selecione um Tronco de Saida</option>';

        if (appState.psEndpoints && Array.isArray(appState.psEndpoints)) {
            appState.psEndpoints.forEach(endpoint => {
                const option = document.createElement('option');
                option.value = endpoint.value;
                option.textContent = endpoint.label;
                // Restaurar seleção se havia um valor
                if (currentValue && currentValue === endpoint.value) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        } else {
            console.error('PS Endpoints não carregados ou inválidos.');
        }
    }

    // Garantir que o elemento esteja visível e disponível antes de aplicar o focus
    function focusCallphoneModelSelect() {
        const callphoneModelSelect = document.getElementById('callphone-model-select');
        if (callphoneModelSelect) {
            // Verificar se o elemento está visível
            const isHidden = callphoneModelSelect.offsetParent === null;
            if (!isHidden) {
                callphoneModelSelect.focus();
            } else {
                console.warn('O elemento callphone-model-select não está visível para aplicar o focus.');
            }
        } else {
            console.error('O elemento callphone-model-select não foi encontrado no DOM.');
        }
    }

    // ============ API PÚBLICA ============

    // Exposer funções globalmente para uso nos event handlers inline
    window.usuarios = {
        init,
        appState,
        edit: openEditModal,
        delete: handleDeleteUser,
        restore: handleRestoreUser,
        closeCreateModal: () => appState.modals.create?.close(),
        closeEditModal: () => appState.modals.edit?.close()
    };

    // Auto-inicializar quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();