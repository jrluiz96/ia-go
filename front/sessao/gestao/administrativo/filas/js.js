// Gerenciamento de Filas - Sistema Bash
(function() {
    'use strict';

    // Estado global da aplicação
    let appState = {
        activeTab: 'fila-callphone',
        currentQueueName: null,
        filaCallphone: {
            data: [], // filas com contagem de operadores
            pagina: 1,
            total: 0,
            limit: 20,
            loading: false,
            pagination: null,
            filtros: {
                q: ''
            }
        },
        queueMembers: {
            data: [], // membros da fila selecionada
            currentQueue: null,
            pagina: 1,
            total: 0,
            limit: 20,
            loading: false,
            pagination: null
        },
        filaWebbot: {
            data: [],
            pagina: 1,
            total: 0,
            limit: 20,
            loading: false,
            pagination: null,
            filtros: {
                q: '',
                status: 'ativo',
                empresa_id: ''
            }
        },
        empresas: [],
        modals: {}
    };

    // ============ INICIALIZAÇÃO ============

    function init() {
        console.log('Inicializando tela de filas...');
        setupEventListeners();
        loadEmpresas();
        loadFilas(); // Carregar filas automaticamente
    }

    function setupEventListeners() {
        // Formulários de filtros
        document.getElementById('filtros-fila-callphone').addEventListener('submit', handleCallphoneFilter);
        document.getElementById('filtros-fila-webbot').addEventListener('submit', handleWebbotFilter);
        
        // Botões de ação
        document.getElementById('btn-nova-fila-webbot').addEventListener('click', openNovaFilaWebbotModal);
        
        // Headers de ordenação - callphone
        document.querySelectorAll('#aba-fila-callphone th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const sort = th.dataset.sort;
                appState.filaCallphone.filtros.sort = sort;
                appState.filaCallphone.pagina = 1;
                loadFilas();
            });
        });

        // Filtro de texto com debounce - callphone
        let debounceTimer;
        document.getElementById('filtro-fila-callphone').addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                appState.filaCallphone.filtros.q = e.target.value;
                appState.filaCallphone.pagina = 1;
                loadFilas();
            }, 300);
        });

        // Filtro de texto com debounce - webbot
        let debounceTimerWebbot;
        document.getElementById('filtro-fila-webbot').addEventListener('input', (e) => {
            clearTimeout(debounceTimerWebbot);
            debounceTimerWebbot = setTimeout(() => {
                appState.filaWebbot.filtros.q = e.target.value;
                appState.filaWebbot.pagina = 1;
                loadFilasWebbot();
            }, 300);
        });

        // Filtro empresa webbot
        document.getElementById('filtro-empresa-webbot').addEventListener('change', (e) => {
            appState.filaWebbot.filtros.empresa_id = e.target.value;
            appState.filaWebbot.pagina = 1;
            loadFilasWebbot();
        });
    }

    // ============ CARREGAMENTO DE DADOS ============

    function loadEmpresas() {
        req('v1/admin/options/empresas', 'GET', null,
            function(response) {
                if (response && response.code === 200) {
                    appState.empresas = response.data || [];
                    populateEmpresaSelects();
                }
            },
            function() {}
        );
    }

    function populateEmpresaSelects() {
        const options = appState.empresas.map(e =>
            `<option value="${e.id}">${escapeHtml(e.nome || e.name || '')}</option>`
        ).join('');

        // Filtro
        const filtroSelect = document.getElementById('filtro-empresa-webbot');
        if (filtroSelect) {
            filtroSelect.innerHTML = '<option value="">Todas as empresas</option>' + options;
        }
    }

    function loadFilas() {
        setCallphoneLoading(true);
        appState.filaCallphone.loading = true;

        const params = new URLSearchParams({
            page: appState.filaCallphone.pagina,
            page_size: appState.filaCallphone.limit,
            q: appState.filaCallphone.filtros.q || ''
        });

        req(`v1/admin/queues?${params.toString()}`, 'GET', null,
            function(response) {
                setCallphoneLoading(false);
                appState.filaCallphone.loading = false;

                if (response && response.code === 200) {
                    // response.data é o objeto PaginatedQueueResponse
                    const paginatedData = response.data || {};
                    appState.filaCallphone.data = paginatedData.data || [];
                    appState.filaCallphone.total = paginatedData.total || 0;
                    
                    renderFilasTable();
                    updateCallphonePagination();
                } else {
                    avisos('Erro', response.message || 'Erro ao carregar filas', 'error');
                    appState.filaCallphone.data = [];
                    renderFilasTable();
                }
            },
            function(error) {
                setCallphoneLoading(false);
                appState.filaCallphone.loading = false;
                avisos('Erro', error?.message || 'Erro ao carregar filas', 'error');
                appState.filaCallphone.data = [];
                renderFilasTable();
            }
        );
    }

    function renderFilasTable() {
        const tbody = document.getElementById('permissoes-tbody');
        if (!tbody) return;

        if (appState.filaCallphone.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-8 text-base-content/70">
                        <div class="flex flex-col items-center gap-2">
                            <i class="fas fa-search text-2xl opacity-50"></i>
                            <span>Nenhuma fila encontrada</span>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = appState.filaCallphone.data.map(fila => {
            const operadoresCount = fila.operadores_count || 0;
            
            return `
                <tr>
                    <td class="font-medium">${escapeHtml(fila.name || '')}</td>
                    <td><span class="badge badge-primary">${escapeHtml(fila.sla || 'N/A')}</span></td>
                    <td><span class="badge badge-outline">${operadoresCount} operador${operadoresCount !== 1 ? 'es' : ''}</span></td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="openManageOperatorsModal('${escapeHtml(fila.name)}')">
                            <i class="fas fa-users mr-1"></i>
                            Gerenciar Operadores
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function updateCallphonePagination() {
        if (!appState.filaCallphone.pagination && appState.filaCallphone.total > appState.filaCallphone.limit) {
            const PaginationClass = BashPagination;
            appState.filaCallphone.pagination = new PaginationClass({
                id: 'callphone-pagination',
                pagina: appState.filaCallphone.pagina,
                total: appState.filaCallphone.total,
                limit: appState.filaCallphone.limit,
                container: '#permissoes-pagination-container',
                onNext: (pagina) => {
                    appState.filaCallphone.pagina = pagina;
                    loadFilas();
                },
                onPrev: (pagina) => {
                    appState.filaCallphone.pagina = pagina;
                    loadFilas();
                }
            });
        }
    }

    // ============ GERENCIAMENTO DE OPERADORES ============

    function openManageOperatorsModal(queueName) {
        appState.currentQueueName = queueName;

        if (appState.modals.manageOperators) {
            appState.modals.manageOperators.destroy();
        }

        appState.modals.manageOperators = new BashModal({
            id: 'manage-operators-modal',
            titulo: `Gerenciar Operadores - Fila: ${queueName}`,
            classSize: 'w-11/12 max-w-6xl',
            container: '#fila-callphone'
        });

        const content = createManageOperatorsContent();
        appState.modals.manageOperators.setContent(content);
        appState.modals.manageOperators.open();
        
        // Carregar operadores da fila
        loadQueueMembers();
    }

    function createManageOperatorsContent() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="space-y-4">
                <!-- Botão Adicionar Operador -->
                <div class="flex justify-between items-center">
                    <h3 class="text-lg font-semibold">Operadores da Fila</h3>
                    <button type="button" id="btn-add-operator" class="btn btn-primary btn-sm">
                        <i class="fas fa-plus mr-2"></i>
                        Adicionar Operador
                    </button>
                </div>

                <!-- Tabela de Operadores -->
                <div class="overflow-x-auto">
                    <table class="table table-zebra table-sm">
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Ramal</th>
                                <th>Status</th>
                                <th>Penalidade</th>
                                <th>Pausado</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody id="operators-tbody">
                            <tr>
                                <td colspan="6" class="text-center py-4">
                                    <span class="loading loading-spinner loading-md"></span>
                                    Carregando operadores...
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Adicionar event listener para o botão de adicionar operador
        container.querySelector('#btn-add-operator').addEventListener('click', openAddOperatorModal);

        return container;
    }

    function loadQueueMembers() {
        if (!appState.currentQueueName) return;

        req(`v1/admin/queue-members/queue/${appState.currentQueueName}`, 'GET', null,
            function(response) {
                if (response && response.code === 200) {
                    // response.data é um objeto de paginação: {data: [...], total: X, page: Y, limit: Z}
                    const paginatedData = response.data || {};
                    renderOperatorsTable(paginatedData.data || []);
                } else {
                    renderOperatorsTable([]);
                }
            },
            function(error) {
                console.error('Erro ao carregar operadores:', error);
                renderOperatorsTable([]);
            }
        );
    }

    function renderOperatorsTable(operators) {
        const tbody = document.getElementById('operators-tbody');
        if (!tbody) return;

        if (operators.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4 text-base-content/70">
                        Nenhum operador encontrado nesta fila
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = operators.map(operator => {
            const operadorNome = operator.operador || 'N/A';
            const ramal = operator.interface || 'N/A';
            const penalty = operator.penalty || 0;
            const paused = operator.paused === 1 ? 'Sim' : 'Não';
            const pausedClass = operator.paused === 1 ? 'text-warning' : 'text-success';
            
            return `
                <tr>
                    <td class="font-medium">${escapeHtml(operadorNome)}</td>
                    <td><span class="badge badge-outline">${escapeHtml(ramal)}</span></td>
                    <td><span class="badge badge-success badge-sm">Ativo</span></td>
                    <td>${penalty}</td>
                    <td><span class="${pausedClass}">${paused}</span></td>
                    <td>
                        <div class="flex gap-1">
                            <button class="btn btn-sm btn-ghost text-error" onclick="deleteOperator(${operator.id})" title="Remover">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function openAddOperatorModal() {
        // Buscar usuários disponíveis
        req('v1/admin/usuarios/com-ramal', 'GET', null,
            function(response) {
                if (response && response.code === 200) {
                    showOperatorModal('Adicionar Operador', null, response.data || []);
                } else {
                    avisos('Erro', 'Não foi possível carregar a lista de usuários', 'error');
                }
            },
            function(error) {
                avisos('Erro', 'Erro ao carregar usuários', 'error');
            }
        );
    }

    function deleteOperator(operatorId) {
        abrirModalRemocao({
            titulo: 'Remover Operador',
            mensagem: 'Tem certeza que deseja remover este operador da fila?',
            onConfirm: () => {
                req(`v1/admin/queue-members/${operatorId}`, 'DELETE', null,
                    function(response) {
                        if (response && response.code === 200) {
                            avisos('Sucesso', 'Operador removido com sucesso!', 'success');
                            loadQueueMembers(); // Recarregar lista
                        } else {
                            avisos('Erro', response.message || 'Erro ao remover operador', 'error');
                        }
                    },
                    function(error) {
                        avisos('Erro', 'Erro ao remover operador', 'error');
                    }
                );
            }
        });
    }

    function showOperatorModal(title, operator, usuarios) {
        if (appState.modals.operatorForm) {
            appState.modals.operatorForm.destroy();
        }

        appState.modals.operatorForm = new BashModal({
            id: 'operator-form-modal',
            titulo: title,
            classSize: 'w-11/12 max-w-2xl',
            container: '#fila-callphone'
        });
        const usuariosOptions = usuarios.map(user => 
            `<option value="${user.id}" data-ramal="${user.ramal}">
                ${escapeHtml(user.usuario)} - Ramal: ${user.ramal}
            </option>`
        ).join('');

        const content = document.createElement('div');
        content.innerHTML = `
            <form id="operator-form" class="space-y-4">
                <div class="form-control">
                    <label class="label">
                        <span class="label-text">Usuário *</span>
                    </label>
                    <select name="id_usuario" class="select select-bordered" required>
                        <option value="">Selecione um usuário</option>
                        ${usuariosOptions}
                    </select>
                </div>
                <div class="modal-action">
                    <button type="button" class="btn btn-ghost" onclick="appState.modals.operatorForm.close()">
                        Cancelar
                    </button>
                    <button type="submit" class="btn btn-primary">
                        Adicionar Operador
                    </button>
                </div>
            </form>
        `;

        // Event listeners
        const form = content.querySelector('#operator-form');

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            handleCreateOperator(form);
        });

        appState.modals.operatorForm.setContent(content);
        appState.modals.operatorForm.open();
    }

    function handleCreateOperator(form) {
        const formData = new FormData(form);
        const userId = parseInt(formData.get('id_usuario'));
        
        if (!userId) {
            avisos('Validação', 'Selecione um usuário válido', 'warning');
            return;
        }

        // Get selected user data from the select option
        const userSelect = form.querySelector('select[name="id_usuario"]');
        const selectedOption = userSelect.querySelector(`option[value="${userId}"]`);
        
        if (!selectedOption) {
            avisos('Validação', 'Usuário selecionado não encontrado', 'warning');
            return;
        }

        const ramal = selectedOption.getAttribute('data-ramal');
        const usuario = selectedOption.textContent.split(' - Ramal:')[0].trim();
        
        if (!ramal) {
            avisos('Validação', 'Usuário selecionado não possui ramal', 'warning');
            return;
        }

        const data = {
            queue_name: appState.currentQueueName,
            id_usuario: userId,
            interface: `PJSIP/${ramal}`,
            penalty: 0,
            paused: 0,
            operador: usuario,
            membername: usuario
        };

        req('v1/admin/queue-members', 'POST', data,
            function(response) {
                if (response && response.code === 201) {
                    avisos('Sucesso', 'Operador adicionado com sucesso!', 'success');
                    appState.modals.operatorForm.close();
                    loadQueueMembers();
                } else {
                    avisos('Erro', response.message || 'Erro ao adicionar operador', 'error');
                }
            },
            function(error) {
                avisos('Erro', 'Erro ao adicionar operador', 'error');
            }
        );
    }

    // ============ FILTROS E EVENTOS ============

    function handleCallphoneFilter(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        appState.filaCallphone.filtros = {
            q: formData.get('q') || ''
        };
        
        appState.filaCallphone.pagina = 1;
        loadFilas();
    }

    function handleWebbotFilter(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        appState.filaWebbot.filtros = {
            q: formData.get('q') || '',
            status: formData.get('status') || 'ativo',
            empresa_id: formData.get('empresa_id') || ''
        };
        
        appState.filaWebbot.pagina = 1;
        loadFilasWebbot();
    }

    // ============ WEBBOT ============

    function loadFilasWebbot() {
        setWebbotLoading(true);
        appState.filaWebbot.loading = true;

        const params = new URLSearchParams({
            page: appState.filaWebbot.pagina,
            page_size: appState.filaWebbot.limit,
            q: appState.filaWebbot.filtros.q || ''
        });

        if (appState.filaWebbot.filtros.empresa_id) {
            params.set('empresa_id', appState.filaWebbot.filtros.empresa_id);
        }

        // Assumindo que haverá um endpoint para filas webbot
        req(`v1/admin/wb-filas?${params.toString()}`, 'GET', null,
            function(response) {
                setWebbotLoading(false);
                appState.filaWebbot.loading = false;

                if (response && response.code === 200) {
                    const paginatedData = response.data || {};
                    appState.filaWebbot.data = paginatedData.data || [];
                    appState.filaWebbot.total = paginatedData.total || 0;
                    
                    renderWebbotTable();
                    renderWebbotPagination();
                } else {
                    avisos('Erro', response?.message || 'Erro ao carregar filas webbot', 'error');
                    appState.filaWebbot.data = [];
                    appState.filaWebbot.total = 0;
                    renderWebbotTable();
                }
            },
            function(error) {
                setWebbotLoading(false);
                appState.filaWebbot.loading = false;
                avisos('Erro', 'Erro ao carregar filas webbot', 'error');
                appState.filaWebbot.data = [];
                appState.filaWebbot.total = 0;
                renderWebbotTable();
            }
        );
    }

    function renderWebbotTable() {
        const tbody = document.getElementById('webbot-tbody');
        
        if (!appState.filaWebbot.data || appState.filaWebbot.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-8 text-base-content/60">
                        <i class="fas fa-inbox text-4xl mb-2 block"></i>
                        Nenhuma fila encontrada
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = appState.filaWebbot.data.map(fila => `
            <tr>
                <td>
                    <div class="font-medium">${escapeHtml(fila.nome || '')}</div>
                </td>
                <td>
                    <span class="badge badge-outline">
                        ${escapeHtml(fila.sla_time || '00:00:00')}
                    </span>
                </td>
                <td>
                    <div class="flex items-center space-x-2">
                        <span class="badge badge-primary">
                            ${fila.operadores_count || 0} operadores
                        </span>
                    </div>
                </td>
                <td>
                    <span class="text-sm">
                        ${fila.empresa_id ? (appState.empresas.find(e => e.id === fila.empresa_id)?.nome || fila.empresa_id) : '<span class="text-base-content/40">-</span>'}
                    </span>
                </td>
                <td>
                    <span class="text-sm text-base-content/70">
                        ${fila.updated_at ? (() => {
                            const dt = fila.updated_at.replace('Z', '').replace('T', ' ').split('.')[0];
                            const [datePart] = dt.split(' ');
                            const [year, month, day] = datePart.split('-');
                            return `${day}/${month}/${year}`;
                          })() : 'N/A'}
                    </span>
                </td>
                <td>
                    <div class="dropdown dropdown-end">
                        <button tabindex="0" role="button" class="btn btn-ghost btn-sm">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <ul tabindex="0" class="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow">
                            <li>
                                <button type="button" onclick="openManageWebbotOperatorsModal(${fila.id}, '${escapeHtml(fila.nome || '')}')">
                                    <i class="fas fa-users"></i>
                                    Gerenciar Operadores
                                </button>
                            </li>
                            <li>
                                <button type="button" onclick="editWebbotFila(${fila.id})">
                                    <i class="fas fa-edit"></i>
                                    Editar
                                </button>
                            </li>
                            <li>
                                <button type="button" onclick="deleteWebbotFila(${fila.id})" class="text-error">
                                    <i class="fas fa-trash"></i>
                                    Excluir
                                </button>
                            </li>
                        </ul>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    function renderWebbotPagination() {
        const container = document.getElementById('webbot-pagination-container');
        
        if (appState.filaWebbot.total <= appState.filaWebbot.limit) {
            container.innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(appState.filaWebbot.total / appState.filaWebbot.limit);
        const currentPage = appState.filaWebbot.pagina;

        container.innerHTML = `
            <div class="flex justify-between items-center">
                <div class="text-sm text-base-content/70">
                    Mostrando ${(currentPage - 1) * appState.filaWebbot.limit + 1} até 
                    ${Math.min(currentPage * appState.filaWebbot.limit, appState.filaWebbot.total)} 
                    de ${appState.filaWebbot.total} resultados
                </div>
                <div class="join">
                    <button class="join-item btn btn-sm" ${currentPage === 1 ? 'disabled' : ''} 
                            onclick="changeWebbotPage(${currentPage - 1})">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    ${Array.from({length: Math.min(5, totalPages)}, (_, i) => {
                        const page = i + Math.max(1, currentPage - 2);
                        if (page > totalPages) return '';
                        return `
                            <button class="join-item btn btn-sm ${page === currentPage ? 'btn-active' : ''}" 
                                    onclick="changeWebbotPage(${page})">
                                ${page}
                            </button>
                        `;
                    }).join('')}
                    <button class="join-item btn btn-sm" ${currentPage === totalPages ? 'disabled' : ''} 
                            onclick="changeWebbotPage(${currentPage + 1})">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
    }

    function changeWebbotPage(page) {
        appState.filaWebbot.pagina = page;
        loadFilasWebbot();
    }

    function openNovaFilaWebbotModal() {
        if (appState.modals.webbotFilaForm) {
            appState.modals.webbotFilaForm.destroy();
        }

        appState.modals.webbotFilaForm = new BashModal({
            id: 'webbot-fila-form-modal',
            titulo: 'Nova Fila Webbot',
            classSize: 'w-11/12 max-w-2xl',
            container: '#fila-webbot'
        });

        const empresasOptions = appState.empresas.map(e =>
            `<option value="${e.id}">${escapeHtml(e.nome || e.name || '')}</option>`
        ).join('');

        const content = document.createElement('div');
        content.innerHTML = `
            <form id="webbot-fila-form" class="space-y-4">
                <div class="form-control">
                    <label class="label">
                        <span class="label-text">Empresa</span>
                    </label>
                    <select name="empresa_id" class="select select-bordered">
                        <option value="">Selecione uma empresa</option>
                        ${empresasOptions}
                    </select>
                </div>

                <div class="form-control">
                    <label class="label">
                        <span class="label-text">Nome da Fila *</span>
                    </label>
                    <input type="text" name="nome" class="input input-bordered" required 
                           placeholder="Digite o nome da fila">
                </div>
                
                <div class="form-control">
                    <label class="label">
                        <span class="label-text">SLA Time *</span>
                    </label>
                    <input type="time" name="sla_time" class="input input-bordered" required 
                           step="1" value="00:00:00">
                    <label class="label">
                        <span class="label-text-alt">Formato: HH:MM:SS</span>
                    </label>
                </div>
                
                <div class="modal-action">
                    <button type="button" class="btn btn-ghost" onclick="appState.modals.webbotFilaForm.close()">
                        Cancelar
                    </button>
                    <button type="submit" class="btn btn-primary">
                        Criar Fila
                    </button>
                </div>
            </form>
        `;

        const form = content.querySelector('#webbot-fila-form');
        form.addEventListener('submit', handleCreateWebbotFila);

        appState.modals.webbotFilaForm.setContent(content);
        appState.modals.webbotFilaForm.open();
    }

    function handleCreateWebbotFila(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const data = {
            nome: formData.get('nome'),
            sla_time: formData.get('sla_time')
        };

        if (!data.nome || !data.sla_time) {
            avisos('Validação', 'Todos os campos são obrigatórios', 'warning');
            return;
        }

        req('v1/admin/wb-filas', 'POST', data,
            function(response) {
                if (response && response.code === 201) {
                    avisos('Sucesso', 'Fila criada com sucesso!', 'success');
                    appState.modals.webbotFilaForm.close();
                    loadFilasWebbot();
                } else {
                    avisos('Erro', response.message || 'Erro ao criar fila', 'error');
                }
            },
            function(error) {
                avisos('Erro', 'Erro ao criar fila', 'error');
            }
        );
    }

    function openManageWebbotOperatorsModal(filaId, filaNome) {
        setCurrentFilaId(filaId); // Set current fila ID for use in other functions
        
        if (appState.modals.webbotOperatorManagement) {
            appState.modals.webbotOperatorManagement.destroy();
        }

        appState.modals.webbotOperatorManagement = new BashModal({
            id: 'webbot-operator-management-modal',
            titulo: `Gerenciar Operadores - ${filaNome}`,
            classSize: 'w-11/12 max-w-4xl',
            container: '#fila-webbot'
        });

        const content = document.createElement('div');
        content.innerHTML = `
            <div class="space-y-4">
                <div class="flex justify-between items-center">
                    <h3 class="text-lg font-semibold">Operadores da Fila</h3>
                    <button type="button" class="btn btn-primary btn-sm" onclick="openAddWebbotOperatorModal(${filaId})">
                        <i class="fas fa-plus mr-2"></i>
                        Adicionar Operador
                    </button>
                </div>
                
                <div id="webbot-operators-loading" class="hidden p-4">
                    <progress class="progress progress-primary w-full"></progress>
                    <p class="text-center mt-2">Carregando operadores...</p>
                </div>
                
                <div class="overflow-x-auto">
                    <table class="table table-zebra">
                        <thead>
                            <tr>
                                <th>Operador</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody id="webbot-operators-tbody">
                            <!-- Operadores serão carregados aqui -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        appState.modals.webbotOperatorManagement.setContent(content);
        appState.modals.webbotOperatorManagement.open();

        // Carregar operadores da fila
        loadWebbotOperators(filaId);
    }

    function loadWebbotOperators(filaId) {
        document.getElementById('webbot-operators-loading').classList.remove('hidden');
        
        req(`v1/admin/wb-fila-membros/fila/${filaId}`, 'GET', null,
            function(response) {
                document.getElementById('webbot-operators-loading').classList.add('hidden');
                
                if (response && response.code === 200) {
                    renderWebbotOperators(response.data || []);
                } else {
                    avisos('Erro', response?.message || 'Erro ao carregar operadores', 'error');
                    renderWebbotOperators([]);
                }
            },
            function(error) {
                document.getElementById('webbot-operators-loading').classList.add('hidden');
                avisos('Erro', 'Erro ao carregar operadores', 'error');
                renderWebbotOperators([]);
            }
        );
    }

    function renderWebbotOperators(operators) {
        const tbody = document.getElementById('webbot-operators-tbody');
        
        if (!operators || operators.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center py-8 text-base-content/60">
                        <i class="fas fa-users text-4xl mb-2 block"></i>
                        Nenhum operador encontrado
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = operators.map(operator => `
            <tr>
                <td>
                    <div class="font-medium">${escapeHtml(operator.operador || '')}</div>
                </td>
                <td>
                    <span class="badge ${operator.paused ? 'badge-error' : 'badge-success'}">
                        ${operator.paused ? 'Pausado' : 'Ativo'}
                    </span>
                </td>
                <td>
                    <div class="flex space-x-2">
                        <button type="button" class="btn btn-sm btn-warning" 
                                onclick="toggleWebbotOperatorPause(${operator.id}, ${!operator.paused})">
                            <i class="fas fa-${operator.paused ? 'play' : 'pause'}"></i>
                            ${operator.paused ? 'Ativar' : 'Pausar'}
                        </button>
                        <button type="button" class="btn btn-sm btn-error" 
                                onclick="deleteWebbotOperator(${operator.id})">
                            <i class="fas fa-trash"></i>
                            Remover
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    function openAddWebbotOperatorModal(filaId) {
        // Carregar usuários que possuem canal de atendimento Webbot
        req('v1/admin/usuarios/com-webbot', 'GET', null,
            function(response) {
                if (response && response.code === 200) {
                    showWebbotOperatorModal('Adicionar Operador', null, response.data, filaId);
                } else {
                    avisos('Erro', 'Erro ao carregar usuários com canal webbot', 'error');
                }
            },
            function(error) {
                avisos('Erro', 'Erro ao carregar usuários com canal webbot', 'error');
            }
        );
    }

    function showWebbotOperatorModal(title, operator, usuarios, filaId) {
        if (appState.modals.webbotOperatorForm) {
            appState.modals.webbotOperatorForm.destroy();
        }

        appState.modals.webbotOperatorForm = new BashModal({
            id: 'webbot-operator-form-modal',
            titulo: title,
            classSize: 'w-11/12 max-w-2xl',
            container: '#fila-webbot'
        });
        
        const usuariosOptions = usuarios.map(user => 
            `<option value="${user.id}">
                ${escapeHtml(user.usuario)}
            </option>`
        ).join('');

        const content = document.createElement('div');
        content.innerHTML = `
            <form id="webbot-operator-form" class="space-y-4">
                <input type="hidden" name="fila_id" value="${filaId}">
                <div class="form-control">
                    <label class="label">
                        <span class="label-text">Usuário *</span>
                    </label>
                    <select name="usuario_id" class="select select-bordered" required>
                        <option value="">Selecione um usuário</option>
                        ${usuariosOptions}
                    </select>
                </div>
                <div class="modal-action">
                    <button type="button" class="btn btn-ghost" onclick="appState.modals.webbotOperatorForm.close()">
                        Cancelar
                    </button>
                    <button type="submit" class="btn btn-primary">
                        Adicionar Operador
                    </button>
                </div>
            </form>
        `;

        const form = content.querySelector('#webbot-operator-form');
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            handleCreateWebbotOperator(form, filaId);
        });

        appState.modals.webbotOperatorForm.setContent(content);
        appState.modals.webbotOperatorForm.open();
    }

    function handleCreateWebbotOperator(form, filaId) {
        const formData = new FormData(form);
        const usuarioId = parseInt(formData.get('usuario_id'));
        
        if (!usuarioId) {
            avisos('Validação', 'Selecione um usuário válido', 'warning');
            return;
        }

        // Get selected user data from the select option
        const userSelect = form.querySelector('select[name="usuario_id"]');
        const selectedOption = userSelect.querySelector(`option[value="${usuarioId}"]`);
        
        if (!selectedOption) {
            avisos('Validação', 'Usuário selecionado não encontrado', 'warning');
            return;
        }

        const operador = selectedOption.textContent.trim();

        const data = {
            fila_id: filaId,
            usuario_id: usuarioId,
            operador: operador,
            paused: false
        };

        req('v1/admin/wb-fila-membros', 'POST', data,
            function(response) {
                if (response && response.code === 201) {
                    avisos('Sucesso', 'Operador adicionado com sucesso!', 'success');
                    appState.modals.webbotOperatorForm.close();
                    loadWebbotOperators(filaId);
                    loadFilasWebbot(); // Refresh the main table to update operator count
                } else {
                    avisos('Erro', response.message || 'Erro ao adicionar operador', 'error');
                }
            },
            function(error) {
                avisos('Erro', 'Erro ao adicionar operador', 'error');
            }
        );
    }

    function toggleWebbotOperatorPause(operatorId, pauseStatus) {
        const data = {
            paused: pauseStatus
        };

        req(`v1/admin/wb-fila-membros/${operatorId}`, 'PUT', data,
            function(response) {
                if (response && response.code === 200) {
                    avisos('Sucesso', `Operador ${pauseStatus ? 'pausado' : 'ativado'} com sucesso!`, 'success');
                    // Reload the operators in the modal
                    const filaId = getCurrentFilaId(); // You'll need to implement this helper
                    loadWebbotOperators(filaId);
                } else {
                    avisos('Erro', response.message || 'Erro ao atualizar operador', 'error');
                }
            },
            function(error) {
                avisos('Erro', 'Erro ao atualizar operador', 'error');
            }
        );
    }

    function deleteWebbotOperator(operatorId) {
        abrirModalRemocao({
            titulo: 'Remover Operador',
            mensagem: 'Tem certeza que deseja remover este operador da fila?',
            onConfirm: () => {
                req(`v1/admin/wb-fila-membros/${operatorId}`, 'DELETE', null,
                    function(response) {
                        if (response && response.code === 200) {
                            avisos('Sucesso', 'Operador removido com sucesso!', 'success');
                            // Reload the operators in the modal
                            const filaId = getCurrentFilaId();
                            loadWebbotOperators(filaId);
                            loadFilasWebbot(); // Refresh the main table to update operator count
                        } else {
                            avisos('Erro', response.message || 'Erro ao remover operador', 'error');
                        }
                    },
                    function(error) {
                        avisos('Erro', 'Erro ao remover operador', 'error');
                    }
                );
            }
        });
    }

    function editWebbotFila(filaId) {
        // Buscar dados da fila
        req(`v1/admin/wb-filas/${filaId}`, 'GET', null,
            function(response) {
                if (response && response.code === 200) {
                    showEditWebbotFilaModal(response.data);
                } else {
                    avisos('Erro', 'Erro ao carregar dados da fila', 'error');
                }
            },
            function(error) {
                avisos('Erro', 'Erro ao carregar dados da fila', 'error');
            }
        );
    }

    function showEditWebbotFilaModal(fila) {
        if (appState.modals.webbotFilaEditForm) {
            appState.modals.webbotFilaEditForm.destroy();
        }

        appState.modals.webbotFilaEditForm = new BashModal({
            id: 'webbot-fila-edit-modal',
            titulo: 'Editar Fila Webbot',
            classSize: 'w-11/12 max-w-2xl',
            container: '#fila-webbot'
        });

        const empresasOptions = appState.empresas.map(e =>
            `<option value="${e.id}" ${fila.empresa_id === e.id ? 'selected' : ''}>${escapeHtml(e.nome || e.name || '')}</option>`
        ).join('');

        const content = document.createElement('div');
        content.innerHTML = `
            <form id="webbot-fila-edit-form" class="space-y-4">
                <input type="hidden" name="id" value="${fila.id}">
                
                <div class="form-control">
                    <label class="label">
                        <span class="label-text">Empresa</span>
                    </label>
                    <select name="empresa_id" class="select select-bordered">
                        <option value="">Selecione uma empresa</option>
                        ${empresasOptions}
                    </select>
                </div>

                <div class="form-control">
                    <label class="label">
                        <span class="label-text">Nome da Fila *</span>
                    </label>
                    <input type="text" name="nome" class="input input-bordered" required 
                           placeholder="Digite o nome da fila" value="${escapeHtml(fila.nome || '')}">
                </div>
                
                <div class="form-control">
                    <label class="label">
                        <span class="label-text">SLA Time *</span>
                    </label>
                    <input type="time" name="sla_time" class="input input-bordered" required 
                           step="1" value="${fila.sla_time || '00:00:00'}">
                    <label class="label">
                        <span class="label-text-alt">Formato: HH:MM:SS</span>
                    </label>
                </div>
                
                <div class="modal-action">
                    <button type="button" class="btn btn-ghost" onclick="appState.modals.webbotFilaEditForm.close()">
                        Cancelar
                    </button>
                    <button type="submit" class="btn btn-primary">
                        Salvar Alterações
                    </button>
                </div>
            </form>
        `;

        const form = content.querySelector('#webbot-fila-edit-form');
        form.addEventListener('submit', handleUpdateWebbotFila);

        appState.modals.webbotFilaEditForm.setContent(content);
        appState.modals.webbotFilaEditForm.open();
    }

    function handleUpdateWebbotFila(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const filaId = parseInt(formData.get('id'));
        const data = {
            nome: formData.get('nome'),
            sla_time: formData.get('sla_time'),
            empresa_id: formData.get('empresa_id') ? parseInt(formData.get('empresa_id')) : null
        };

        if (!data.nome || !data.sla_time) {
            avisos('Validação', 'Todos os campos são obrigatórios', 'warning');
            return;
        }

        req(`v1/admin/wb-filas/${filaId}`, 'PUT', data,
            function(response) {
                if (response && response.code === 200) {
                    avisos('Sucesso', 'Fila atualizada com sucesso!', 'success');
                    appState.modals.webbotFilaEditForm.close();
                    loadFilasWebbot();
                } else {
                    avisos('Erro', response.message || 'Erro ao atualizar fila', 'error');
                }
            },
            function(error) {
                avisos('Erro', 'Erro ao atualizar fila', 'error');
            }
        );
    }

    function deleteWebbotFila(filaId) {
        abrirModalRemocao({
            titulo: 'Excluir Fila Webbot',
            mensagem: 'Tem certeza que deseja excluir esta fila? Esta ação não pode ser desfeita.',
            onConfirm: () => {
                req(`v1/admin/wb-filas/${filaId}`, 'DELETE', null,
                    function(response) {
                        if (response && response.code === 200) {
                            avisos('Sucesso', 'Fila excluída com sucesso!', 'success');
                            loadFilasWebbot();
                        } else {
                            avisos('Erro', response.message || 'Erro ao excluir fila', 'error');
                        }
                    },
                    function(error) {
                        avisos('Erro', 'Erro ao excluir fila', 'error');
                    }
                );
            }
        });
    }

    function switchTab(tabName) {
        // Remover classe ativa de todas as abas
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('tab-active'));
        document.querySelectorAll('[id^="aba-"]').forEach(aba => aba.classList.add('hidden'));
        
        // Ativar aba selecionada
        document.getElementById(`tab-${tabName}`).classList.add('tab-active');
        document.getElementById(`aba-${tabName}`).classList.remove('hidden');
        
        appState.activeTab = tabName;
        
        // Carregar dados se necessário
        if (tabName === 'fila-callphone' && appState.filaCallphone.data.length === 0) {
            loadFilas();
        } else if (tabName === 'fila-webbot' && appState.filaWebbot.data.length === 0) {
            loadFilasWebbot();
        }
    }

    // ============ UTILITÁRIOS ============

    function setCallphoneLoading(loading) {
        appState.filaCallphone.loading = loading;
        const loadingEl = document.getElementById('permissoes-loading');
        const tableEl = document.getElementById('permissoes-data-container');
        
        if (loading) {
            loadingEl.classList.remove('hidden');
            tableEl.style.opacity = '0.5';
        } else {
            loadingEl.classList.add('hidden');
            tableEl.style.opacity = '1';
        }
    }

    function setWebbotLoading(loading) {
        appState.filaWebbot.loading = loading;
        const loadingEl = document.getElementById('webbot-loading');
        const tableEl = document.getElementById('webbot-data-container');
        
        if (loading) {
            loadingEl.classList.remove('hidden');
            tableEl.style.opacity = '0.5';
        } else {
            loadingEl.classList.add('hidden');
            tableEl.style.opacity = '1';
        }
    }

    let currentFilaId = null; // Helper para manter o ID da fila atual no modal

    function getCurrentFilaId() {
        return currentFilaId;
    }

    function setCurrentFilaId(filaId) {
        currentFilaId = filaId;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    // Expor funções globalmente para uso nos botões
    window.openManageOperatorsModal = openManageOperatorsModal;
    window.openAddOperatorModal = openAddOperatorModal;
    window.deleteOperator = deleteOperator;
    window.switchTab = switchTab;
    
    // Webbot functions
    window.openManageWebbotOperatorsModal = openManageWebbotOperatorsModal;
    window.openAddWebbotOperatorModal = openAddWebbotOperatorModal;
    window.deleteWebbotOperator = deleteWebbotOperator;
    window.toggleWebbotOperatorPause = toggleWebbotOperatorPause;
    window.editWebbotFila = editWebbotFila;
    window.deleteWebbotFila = deleteWebbotFila;
    window.changeWebbotPage = changeWebbotPage;

    // Auto-inicializar quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();