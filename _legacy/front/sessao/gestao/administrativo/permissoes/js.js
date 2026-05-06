
// ============ GERENCIAMENTO DE PERMISSÕES E TELAS ============

(function() {
    'use strict';

    // Estado global da aplicação
    let appState = {
        activeTab: 'permissoes',
        permissoes: {
            data: [],
            pagina: 1,
            total: 0,
            limit: 20,
            loading: false,
            pagination: null,
            filtros: {
                q: '',
                status: 'ativo'
            }
        },
        telas: {
            data: [],
            pagina: 1,
            total: 0,
            limit: 20,
            loading: false,
            pagination: null,
            filtros: {
                q: '',
                canal_id: '',
                status: 'ativo'
            }
        },
        options: {
            canais: []
        },
        modals: {}
    };

    // ============ INICIALIZAÇÃO ============

    function init() {
        console.log('Inicializando tela de permissões...');
        loadElement(`ga-menu-li-${PageGA.posMenu}`, 0);
        
        setupEventListeners();
        loadCanaisOptions();
        loadPermissoes();
    }

    function setupEventListeners() {
        // Formulários de filtros
        document.getElementById('filtros-permissoes').addEventListener('submit', handlePermissoesFilter);
        document.getElementById('filtros-telas').addEventListener('submit', handleTelasFilter);
        
        // Botões de nova permissão/tela
        document.getElementById('btn-nova-permissao').addEventListener('click', openCreatePermissaoModal);
        document.getElementById('btn-nova-tela').addEventListener('click', openCreateTelaModal);
        
        // Headers de ordenação - permissões
        document.querySelectorAll('#aba-permissoes th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const sort = th.dataset.sort;
                appState.permissoes.filtros.sort = sort;
                appState.permissoes.pagina = 1;
                loadPermissoes();
            });
        });
        
        // Headers de ordenação - telas
        document.querySelectorAll('#aba-telas th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const sort = th.dataset.sort;
                appState.telas.filtros.sort = sort;
                appState.telas.pagina = 1;
                loadTelas();
            });
        });
    }

    // ============ CONTROLE DE ABAS ============

    function switchTab(tab) {
        appState.activeTab = tab;
        
        // Atualizar UI das abas
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('tab-active'));
        document.getElementById(`tab-${tab}`).classList.add('tab-active');
        
        // Mostrar/ocultar conteúdo
        document.getElementById('aba-permissoes').classList.toggle('hidden', tab !== 'permissoes');
        document.getElementById('aba-telas').classList.toggle('hidden', tab !== 'telas');
        
        // Carregar dados se necessário
        if (tab === 'permissoes' && appState.permissoes.data.length === 0) {
            loadPermissoes();
        } else if (tab === 'telas' && appState.telas.data.length === 0) {
            loadTelas();
        }
    }

    // ============ CARREGAMENTO DE DADOS ============

    function loadCanaisOptions() {
        req('v1/admin/options/canais-atendimentos', 'GET', null, 
            function(response) {
                // Novo padrão: verificar code ao invés de success
                if (response.code === 200 && response.data) {
                    appState.options.canais = response.data;
                    populateCanaisSelect();
                } else {
                    console.error('Erro ao carregar canais:', response.message || 'Erro desconhecido');
                }
            },
            function(error) {
                console.error('Erro ao carregar canais:', error);
            }
        );
    }

    function populateCanaisSelect() {
        const select = document.getElementById('filtro-telas-canal');
        if (!select) return;
        
        const currentValue = select.value;
        select.innerHTML = '<option value="">Todos os canais</option>';
        
        appState.options.canais.forEach(canal => {
            const option = document.createElement('option');
            option.value = canal.id;
            option.textContent = canal.nome;
            if (canal.id.toString() === currentValue) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    }

    function loadPermissoes() {
        setPermissoesLoading(true);
        
        const params = new URLSearchParams({
            page: appState.permissoes.pagina,
            page_size: appState.permissoes.limit
        });

        // Adicionar filtros
        Object.keys(appState.permissoes.filtros).forEach(key => {
            if (appState.permissoes.filtros[key] && key !== 'status') {
                params.append(key, appState.permissoes.filtros[key]);
            }
        });

        // Tratar filtro de status
        if (appState.permissoes.filtros.status === 'deletado') {
            params.append('only_deleted', 'true');
        } else if (appState.permissoes.filtros.status === 'todos') {
            params.append('with_deleted', 'true');
        }

        const url = `v1/admin/permissoes?${params.toString()}`;
        
        req(url, 'GET', null,
            function(response) {
                setPermissoesLoading(false);
                // Novo padrão: verificar code ao invés de success
                if (response.code === 200 && response.data) {
                    appState.permissoes.data = response.data.data || [];
                    appState.permissoes.total = response.data.total || 0;
                    
                    renderPermissoesTable();
                    setupPermissoesPagination();
                } else {
                    avisos('Erro', response.message || 'Formato de resposta inválido', 'error');
                }
            },
            function(error) {
                setPermissoesLoading(false);
                console.error('Erro ao carregar permissões:', error);
                avisos('Erro', error?.message || 'Erro ao carregar permissões', 'error');
                renderPermissoesTable();
            }
        );
    }

    function loadTelas() {
        setTelasLoading(true);
        
        const params = new URLSearchParams({
            page: appState.telas.pagina,
            page_size: appState.telas.limit
        });

        // Adicionar filtros
        Object.keys(appState.telas.filtros).forEach(key => {
            if (appState.telas.filtros[key] && key !== 'status') {
                params.append(key, appState.telas.filtros[key]);
            }
        });

        // Tratar filtro de status
        if (appState.telas.filtros.status === 'deletado') {
            params.append('only_deleted', 'true');
        } else if (appState.telas.filtros.status === 'todos') {
            params.append('with_deleted', 'true');
        }

        const url = `v1/admin/telas?${params.toString()}`;
        
        req(url, 'GET', null,
            function(response) {
                setTelasLoading(false);
                // Novo padrão: verificar code ao invés de success
                if (response.code === 200 && response.data) {
                    appState.telas.data = response.data.data || [];
                    appState.telas.total = response.data.total || 0;
                    
                    renderTelasTable();
                    setupTelasPagination();
                } else {
                    avisos('Erro', response.message || 'Formato de resposta inválido', 'error');
                }
            },
            function(error) {
                setTelasLoading(false);
                console.error('Erro ao carregar telas:', error);
                avisos('Erro', error?.message || 'Erro ao carregar telas', 'error');
                renderTelasTable();
            }
        );
    }

    // ============ FILTROS ============

    function handlePermissoesFilter(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        appState.permissoes.filtros = {
            q: formData.get('q') || '',
            status: formData.get('status') || 'ativo'
        };
        appState.permissoes.pagina = 1;
        
        loadPermissoes();
    }

    function handleTelasFilter(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        appState.telas.filtros = {
            q: formData.get('q') || '',
            canal_id: formData.get('canal_id') || '',
            status: formData.get('status') || 'ativo'
        };
        appState.telas.pagina = 1;
        
        loadTelas();
    }

    // ============ RENDERIZAÇÃO ============

    function renderPermissoesTable() {
        const tbody = document.getElementById('permissoes-tbody');
        tbody.innerHTML = '';
        
        if (!appState.permissoes.data || appState.permissoes.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-12">
                        <div class="flex flex-col items-center gap-2">
                            <i class="fas fa-user-shield text-4xl text-base-300"></i>
                            <span class="text-base-content/50">Nenhuma permissão encontrada</span>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        appState.permissoes.data.forEach(permissao => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="font-medium">${escapeHtml(permissao.nome || '-')}</td>
                <td class="text-sm">${formatDate(permissao.created_at)}</td>
                <td class="text-sm">${formatDate(permissao.updated_at)}</td>
                <td>
                    ${permissao.deleted_at ? 
                        '<span class="badge badge-error">Deletado</span>' : 
                        '<span class="badge badge-success">Ativo</span>'
                    }
                </td>
                <td>
                    <div class="dropdown dropdown-end">
                        <label tabindex="0" class="btn btn-sm btn-ghost">
                            <i class="fas fa-ellipsis-v"></i>
                        </label>
                        <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                            <li><a onclick="permissoes.editPermissao(${permissao.id})"><i class="fas fa-edit mr-2"></i>Editar</a></li>
                            <li><a onclick="permissoes.managePermissaoTelas(${permissao.id})"><i class="fas fa-desktop mr-2"></i>Gerenciar Telas</a></li>
                            ${permissao.deleted_at ? 
                                `<li><a onclick="permissoes.restorePermissao(${permissao.id})"><i class="fas fa-undo mr-2"></i>Restaurar</a></li>` :
                                `<li><a onclick="permissoes.deletePermissao(${permissao.id})" class="text-error"><i class="fas fa-trash mr-2"></i>Excluir</a></li>`
                            }
                        </ul>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderTelasTable() {
        const tbody = document.getElementById('telas-tbody');
        tbody.innerHTML = '';
        
        if (!appState.telas.data || appState.telas.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-12">
                        <div class="flex flex-col items-center gap-2">
                            <i class="fas fa-desktop text-4xl text-base-300"></i>
                            <span class="text-base-content/50">Nenhuma tela encontrada</span>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        appState.telas.data.forEach(tela => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="font-medium">${escapeHtml(tela.nome || '-')}</td>
                <td class="font-mono text-sm">${escapeHtml(tela.url || '-')}</td>
                <td><i class="fas fa-${tela.icone || 'question'} text-primary"></i></td>
                <td><span class="badge badge-outline">${tela.peso || 0}</span></td>
                <td>
                    <div class="flex flex-wrap gap-1">
                        ${renderCanaisTela(tela.canais_atendimentos)}
                    </div>
                </td>
                <td class="text-sm">${formatDate(tela.created_at)}</td>
                <td>
                    ${tela.deleted_at ? 
                        '<span class="badge badge-error">Deletado</span>' : 
                        '<span class="badge badge-success">Ativo</span>'
                    }
                </td>
                <td>
                    <div class="dropdown dropdown-end">
                        <label tabindex="0" class="btn btn-sm btn-ghost">
                            <i class="fas fa-ellipsis-v"></i>
                        </label>
                        <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                            <li><a onclick="permissoes.editTela(${tela.id})"><i class="fas fa-edit mr-2"></i>Editar</a></li>
                            ${tela.deleted_at ? 
                                `<li><a onclick="permissoes.restoreTela(${tela.id})"><i class="fas fa-undo mr-2"></i>Restaurar</a></li>` :
                                `<li><a onclick="permissoes.deleteTela(${tela.id})" class="text-error"><i class="fas fa-trash mr-2"></i>Excluir</a></li>`
                            }
                        </ul>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // ============ HELPERS ============

    function renderCanaisTela(canais) {
        if (!canais || canais.length === 0) {
            return '<span class="text-base-content/50">-</span>';
        }
        
        return canais.map(canal => 
            `<span class="badge badge-primary badge-sm">${escapeHtml(canal.nome)}</span>`
        ).join('');
    }

    function formatDate(dateString) {
        if (!dateString) return '-';
        try {
            if (!dateString) return '-';
            const dt = dateString.replace('Z', '').replace('T', ' ').split('.')[0];
            const [datePart, timePart] = dt.split(' ');
            const [year, month, day] = datePart.split('-');
            if (!timePart) {
                return `${day}/${month}/${year}`;
            }
            const [hour, minute] = timePart.split(':');
            return `${day}/${month}/${year} ${hour}:${minute}`;
        } catch (e) {
            return '-';
        }
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
        return text.toString().replace(/[&<>"']/g, m => map[m]);
    }

    // ============ LOADING STATES ============

    function setPermissoesLoading(loading) {
        appState.permissoes.loading = loading;
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

    function setTelasLoading(loading) {
        appState.telas.loading = loading;
        const loadingEl = document.getElementById('telas-loading');
        const tableEl = document.getElementById('telas-data-container');
        
        if (loading) {
            loadingEl.classList.remove('hidden');
            tableEl.style.opacity = '0.5';
        } else {
            loadingEl.classList.add('hidden');
            tableEl.style.opacity = '1';
        }
    }

    // ============ PAGINAÇÃO ============

    function setupPermissoesPagination() {
        if (appState.permissoes.pagination) {
            appState.permissoes.pagination.update(appState.permissoes.pagina, appState.permissoes.total);
        } else {
            appState.permissoes.pagination = new window.BashPagination({
                id: 'permissoes-pagination',
                pagina: appState.permissoes.pagina,
                total: appState.permissoes.total,
                limit: appState.permissoes.limit,
                container: '#permissoes-pagination-container',
                onNext: (pagina) => {
                    appState.permissoes.pagina = pagina;
                    loadPermissoes();
                },
                onPrev: (pagina) => {
                    appState.permissoes.pagina = pagina;
                    loadPermissoes();
                }
            });
        }
    }

    function setupTelasPagination() {
        if (appState.telas.pagination) {
            appState.telas.pagination.update(appState.telas.pagina, appState.telas.total);
        } else {
            appState.telas.pagination = new window.BashPagination({
                id: 'telas-pagination',
                pagina: appState.telas.pagina,
                total: appState.telas.total,
                limit: appState.telas.limit,
                container: '#telas-pagination-container',
                onNext: (pagina) => {
                    appState.telas.pagina = pagina;
                    loadTelas();
                },
                onPrev: (pagina) => {
                    appState.telas.pagina = pagina;
                    loadTelas();
                }
            });
        }
    }

    // ============ CRUD PERMISSÕES ============

    function openCreatePermissaoModal() {
        if (appState.modals.createPermissao) {
            appState.modals.createPermissao.destroy();
        }

        appState.modals.createPermissao = new window.BashModal({
            id: 'permissoes-modal-create',
            titulo: 'Nova Permissão',
            classSize: 'w-11/12 max-w-lg',
            container: '#permissao-modal-container'
        });

        const form = createPermissaoForm();
        appState.modals.createPermissao.setContent(form);
        appState.modals.createPermissao.open();
    }

    function createPermissaoForm(permissao = null) {
        const isEdit = !!permissao;
        return `
            <form onsubmit="return permissoes.${isEdit ? 'updatePermissao' : 'createPermissao'}(event${isEdit ? ', ' + permissao.id : ''})">
                <div class="form-control w-full">
                    <label class="label">
                        <span class="label-text">Nome *</span>
                    </label>
                    <input type="text" name="nome" value="${isEdit ? escapeHtml(permissao.nome || '') : ''}" 
                           placeholder="Digite o nome da permissão" 
                           class="input input-bordered w-full" required maxlength="120" />
                </div>
                
                <div class="modal-action">
                    <button type="button" class="btn btn-ghost" 
                            onclick="permissoes.${isEdit ? 'closeEditPermissaoModal' : 'closeCreatePermissaoModal'}()">
                        Cancelar
                    </button>
                    <button type="submit" class="btn btn-primary">
                        <span class="loading loading-spinner loading-xs hidden" id="permissao-loading-save"></span>
                        ${isEdit ? 'Atualizar' : 'Criar'} Permissão
                    </button>
                </div>
            </form>
        `;
    }

    function createPermissao(event) {
        event.preventDefault();
        
        const form = event.target;
        const formData = new FormData(form);
        const data = { nome: formData.get('nome').trim() };
        
        const submitBtn = form.querySelector('button[type="submit"]');
        const loading = form.querySelector('#permissao-loading-save');
        
        submitBtn.disabled = true;
        loading.classList.remove('hidden');
        
        req('v1/admin/permissoes', 'POST', data,
            function(response) {
                submitBtn.disabled = false;
                loading.classList.add('hidden');
                
                // Novo padrão: verificar code ao invés de success
                if (response.code === 201) {
                    avisos('Sucesso', response.message || 'Permissão criada com sucesso', 'success');
                    closeCreatePermissaoModal();
                    loadPermissoes();
                } else {
                    avisos('Erro', response.message || 'Erro ao criar permissão', 'error');
                }
            },
            function(error) {
                submitBtn.disabled = false;
                loading.classList.add('hidden');
                avisos('Erro', error?.message || 'Erro ao criar permissão', 'error');
            }
        );
        
        return false;
    }

    function editPermissao(id) {
        loadElement('btn-nova-permissao', true);

        req(`v1/admin/permissoes/${id}`, 'GET', null,
            function(response) {
                loadElement('btn-nova-permissao', false);
                
                // Novo padrão: verificar code ao invés de success
                if (response.code === 200 && response.data) {
                    if (appState.modals.editPermissao) {
                        appState.modals.editPermissao.destroy();
                    }

                    appState.modals.editPermissao = new window.BashModal({
                        id: 'permissoes-modal-edit',
                        titulo: 'Editar Permissão',
                        classSize: 'w-11/12 max-w-lg',
                        container: '#permissao-modal-container'
                    });

                    const form = createPermissaoForm(response.data);
                    appState.modals.editPermissao.setContent(form);
                    appState.modals.editPermissao.open();
                } else {
                    avisos('Erro', response.message || 'Erro ao carregar dados da permissão', 'error');
                }
            },
            function(error) {
                loadElement('btn-nova-permissao', false);
                avisos('Erro', error?.message || 'Erro ao carregar permissão', 'error');
            }
        );
    }

    function updatePermissao(event, id) {
        event.preventDefault();
        
        const form = event.target;
        const formData = new FormData(form);
        const data = { nome: formData.get('nome').trim() };
        
        const submitBtn = form.querySelector('button[type="submit"]');
        const loading = form.querySelector('#permissao-loading-save');
        
        submitBtn.disabled = true;
        loading.classList.remove('hidden');
        
        req(`v1/admin/permissoes/${id}`, 'PUT', data,
            function(response) {
                submitBtn.disabled = false;
                loading.classList.add('hidden');
                
                // Novo padrão: verificar code ao invés de success
                if (response.code === 200) {
                    avisos('Sucesso', response.message || 'Permissão atualizada com sucesso', 'success');
                    closeEditPermissaoModal();
                    loadPermissoes();
                } else {
                    avisos('Erro', response.message || 'Erro ao atualizar permissão', 'error');
                }
            },
            function(error) {
                submitBtn.disabled = false;
                loading.classList.add('hidden');
                avisos('Erro', error?.message || 'Erro ao atualizar permissão', 'error');
            }
        );
        
        return false;
    }

    function deletePermissao(id) {
        // Buscar dados da permissão para exibir no modal
        const permissao = appState.permissoes.data.find(p => p.id === id);
        const nomePermissao = permissao ? permissao.nome : `ID ${id}`;
        
        abrirModalRemocao({
            titulo: 'Excluir Permissão',
            mensagem: `Tem certeza que deseja excluir a permissão "${nomePermissao}"?`,
            labelRemover: 'Excluir',
            onConfirm: () => {
                req(`v1/admin/permissoes/${id}`, 'DELETE', null,
                    function(response) {
                        // Novo padrão: verificar code ao invés de success
                        if (response.code === 200) {
                            avisos('Sucesso', response.message || 'Permissão excluída com sucesso', 'success');
                            loadPermissoes();
                        } else {
                            avisos('Erro', response.message || 'Erro ao excluir permissão', 'error');
                        }
                    },
                    function(error) {
                        avisos('Erro', error?.message || 'Erro ao excluir permissão', 'error');
                    }
                );
            }
        });
    }

    function restorePermissao(id) {
        // Buscar dados da permissão para exibir no modal
        const permissao = appState.permissoes.data.find(p => p.id === id);
        const nomePermissao = permissao ? permissao.nome : `ID ${id}`;
        
        abrirModalRemocao({
            titulo: 'Restaurar Permissão',
            mensagem: `Tem certeza que deseja restaurar a permissão "${nomePermissao}"?`,
            labelRemover: 'Restaurar',
            onConfirm: () => {
                req(`v1/admin/permissoes/${id}/restore`, 'POST', null,
                    function(response) {
                        // Novo padrão: verificar code ao invés de success
                        if (response.code === 200) {
                            avisos('Sucesso', response.message || 'Permissão restaurada com sucesso', 'success');
                            loadPermissoes();
                        } else {
                            avisos('Erro', response.message || 'Erro ao restaurar permissão', 'error');
                        }
                    },
                    function(error) {
                        avisos('Erro', error?.message || 'Erro ao restaurar permissão', 'error');
                    }
                );
            }
        });
    }

    function managePermissaoTelas(id) {
        loadElement('btn-nova-permissao', true);

        // Carregar dados da permissão primeiro
        req(`v1/admin/permissoes/${id}`, 'GET', null,
            function(response) {
                loadElement('btn-nova-permissao', false);
                
                if (response.code === 200 && response.data) {
                    // Carregar telas disponíveis e vínculos
                    loadPermissaoVinculosData(response.data);
                } else {
                    avisos('Erro', response.message || 'Erro ao carregar dados da permissão', 'error');
                }
            },
            function(error) {
                loadElement('btn-nova-permissao', false);
                avisos('Erro', error?.message || 'Erro ao carregar permissão', 'error');
            }
        );
    }

    function loadPermissaoVinculosData(permissao) {
        // Carregar telas disponíveis e vínculos em paralelo
        let telasDisponiveis = [];
        let telasVinculadas = [];
        let completed = 0;

        function checkCompletion() {
            completed++;
            if (completed === 2) {
                showManagePermissaoTelasModal(permissao, telasVinculadas, telasDisponiveis);
            }
        }

        // Carregar telas disponíveis
        req(`v1/admin/vinculos/permissao/${permissao.id}/disponiveis`, 'GET', null,
            function(response) {
                if (response.code === 200 && response.data) {
                    telasDisponiveis = response.data;
                }
                checkCompletion();
            },
            function(error) {
                console.error('Erro ao carregar telas disponíveis:', error);
                checkCompletion();
            }
        );

        // Carregar telas já vinculadas
        req(`v1/admin/vinculos/permissao/${permissao.id}/telas`, 'GET', null,
            function(response) {
                if (response.code === 200 && response.data) {
                    telasVinculadas = response.data;
                }
                checkCompletion();
            },
            function(error) {
                console.error('Erro ao carregar telas vinculadas:', error);
                checkCompletion();
            }
        );
    }

    function showManagePermissaoTelasModal(permissao, telasVinculadas, telasDisponiveis) {
        if (appState.modals.manageVinculos) {
            appState.modals.manageVinculos.destroy();
        }

        appState.modals.manageVinculos = new window.BashModal({
            id: 'vinculos-modal-manage',
            titulo: `Gerenciar Telas - ${permissao.nome}`,
            classSize: 'w-11/12 max-w-7xl flex flex-col h-[90vh]',
            container: '#permissao-modal-container',
            classList: 'flex-1 flex-col min-h-0 overflow-auto',
        });

        const content = createVinculosManagementForm(permissao, telasVinculadas, telasDisponiveis);
        appState.modals.manageVinculos.setContent(content);
        appState.modals.manageVinculos.open();
    }

    function createVinculosManagementForm(permissao, telasVinculadas, telasDisponiveis) {
        // Criar lista de telas vinculadas
        const vinculadasHtml = telasVinculadas.length > 0 ? 
            telasVinculadas.map(vinculo => `
                <div class="flex items-center justify-between p-3 bg-success/10 border border-success/20 rounded-lg">
                    <div class="flex items-center gap-3">
                        <i class="fas fa-${vinculo.tela_icone || 'desktop'} text-success"></i>
                        <div>
                            <div class="font-medium">${escapeHtml(vinculo.tela_nome)}</div>
                            <div class="text-sm text-base-content/70">${escapeHtml(vinculo.tela_url)}</div>
                        </div>
                    </div>
                    <button type="button" class="btn btn-sm btn-error" 
                            onclick="permissoes.unlinkPermissaoTela(${permissao.id}, ${vinculo.tela_id})">
                        <i class="fas fa-unlink mr-1"></i>
                        Desvincular
                    </button>
                </div>
            `).join('') :
            '<div class="text-center py-8 text-base-content/50">Nenhuma tela vinculada</div>';

        // Criar lista de telas disponíveis
        const disponiveisHtml = telasDisponiveis.length > 0 ?
            telasDisponiveis.map(tela => `
                <div class="flex items-center justify-between p-3 bg-base-200 border border-base-300 rounded-lg">
                    <div class="flex items-center gap-3">
                        <i class="fas fa-${tela.icone || 'desktop'} text-primary"></i>
                        <div>
                            <div class="font-medium">${escapeHtml(tela.nome)}</div>
                            <div class="text-sm text-base-content/70">${escapeHtml(tela.url)}</div>
                        </div>
                    </div>
                    <button type="button" class="btn btn-sm btn-success" 
                            onclick="permissoes.linkPermissaoTela(${permissao.id}, ${tela.id})">
                        <i class="fas fa-link mr-1"></i>
                        Vincular
                    </button>
                </div>
            `).join('') :
            '<div class="text-center py-8 text-base-content/50">Todas as telas já estão vinculadas</div>';

        return `
            <div class="flex flex-col h-full" style="max-height: calc(90vh - 200px);">
                <!-- Container das duas colunas -->
                <div class="flex gap-4 flex-1 overflow-hidden">
                    <!-- Telas Vinculadas -->
                    <div class="flex-1 flex flex-col min-w-0">
                        <h3 class="text-lg font-semibold mb-3 flex items-center gap-2 flex-shrink-0">
                            <i class="fas fa-link text-success"></i>
                            Telas Vinculadas (${telasVinculadas.length})
                        </h3>
                        <div class="space-y-2 overflow-y-auto flex-1 pr-2" style="max-height: 100%;">
                            ${vinculadasHtml}
                        </div>
                    </div>

                    <!-- Divisor vertical -->
                    <div class="w-px bg-base-300 flex-shrink-0"></div>

                    <!-- Telas Disponíveis -->
                    <div class="flex-1 flex flex-col min-w-0">
                        <h3 class="text-lg font-semibold mb-3 flex items-center gap-2 flex-shrink-0">
                            <i class="fas fa-plus text-primary"></i>
                            Telas Disponíveis (${telasDisponiveis.length})
                        </h3>
                        <div class="space-y-2 overflow-y-auto flex-1 pr-2" style="max-height: 100%;">
                            ${disponiveisHtml}
                        </div>
                    </div>
                </div>

                <!-- Loading indicator -->
                <div id="vinculos-loading" class="hidden text-center py-4">
                    <span class="loading loading-spinner loading-md"></span>
                    <span class="ml-2">Processando...</span>
                </div>

                <!-- Botões de ação -->
                <div class="flex justify-end gap-2 pt-4 mt-4 border-t flex-shrink-0">
                    <button type="button" class="btn btn-ghost" onclick="permissoes.closeManageVinculosModal()">
                        Fechar
                    </button>
                </div>
            </div>
        `;
    }

    // ============ CRUD TELAS ============

    function openCreateTelaModal() {
        if (appState.modals.createTela) {
            appState.modals.createTela.destroy();
        }

        appState.modals.createTela = new window.BashModal({
            id: 'telas-modal-create',
            titulo: 'Nova Tela',
            classSize: 'w-11/12 max-w-2xl',
            container: '#tela-modal-container'
        });

        const form = createTelaForm();
        appState.modals.createTela.setContent(form);
        appState.modals.createTela.open();
    }

    function createTelaForm(tela = null) {
        const isEdit = !!tela;
        const canaisOptions = appState.options.canais.map(canal => {
            const isSelected = isEdit && tela.canais_atendimentos && 
                              tela.canais_atendimentos.some(c => c.id === canal.id);
            return `<option value="${canal.id}" ${isSelected ? 'selected' : ''}>${escapeHtml(canal.nome)}</option>`;
        }).join('');
        
        return `
            <form onsubmit="return permissoes.${isEdit ? 'updateTela' : 'createTela'}(event${isEdit ? ', ' + tela.id : ''})">
                <div class="space-y-4">
                    <div class="form-control w-full">
                        <label class="label">
                            <span class="label-text">Nome *</span>
                        </label>
                        <input type="text" name="nome" value="${isEdit ? escapeHtml(tela.nome || '') : ''}" 
                               placeholder="Digite o nome da tela" 
                               class="input input-bordered w-full" required maxlength="120" />
                    </div>
                    
                    <div class="form-control w-full">
                        <label class="label">
                            <span class="label-text">URL *</span>
                        </label>
                        <input type="text" name="url" value="${isEdit ? escapeHtml(tela.url || '') : ''}" 
                               placeholder="/caminho/para/tela" 
                               class="input input-bordered w-full" required maxlength="255" />
                    </div>
                    
                    <div class="form-control w-full">
                        <label class="label">
                            <span class="label-text">Ícone</span>
                        </label>
                        <input type="text" name="icone" value="${isEdit ? escapeHtml(tela.icone || '') : ''}" 
                               placeholder="fa-desktop" 
                               class="input input-bordered w-full" maxlength="50" />
                    </div>
                    
                    <div class="form-control w-full">
                        <label class="label">
                            <span class="label-text">Peso *</span>
                        </label>
                        <input type="number" name="peso" value="${isEdit ? (tela.peso || 1) : 1}" min="1" 
                               class="input input-bordered w-full" required />
                    </div>
                    
                    <div class="form-control w-full">
                        <label class="label">
                            <span class="label-text">Canais de Atendimento</span>
                        </label>
                        <select name="canais_atendimentos_ids" multiple 
                                class="select select-bordered w-full h-32">
                            ${canaisOptions}
                        </select>
                        <label class="label">
                            <span class="label-text-alt">Segure Ctrl/Cmd para selecionar múltiplos</span>
                        </label>
                    </div>
                </div>
                
                <div class="modal-action">
                    <button type="button" class="btn btn-ghost" 
                            onclick="permissoes.${isEdit ? 'closeEditTelaModal' : 'closeCreateTelaModal'}()">
                        Cancelar
                    </button>
                    <button type="submit" class="btn btn-primary">
                        <span class="loading loading-spinner loading-xs hidden" id="tela-loading-save"></span>
                        ${isEdit ? 'Atualizar' : 'Criar'} Tela
                    </button>
                </div>
            </form>
        `;
    }

    function createTela(event) {
        event.preventDefault();
        
        const form = event.target;
        const formData = new FormData(form);
        
        // Coletar canais selecionados
        const select = form.querySelector('select[name="canais_atendimentos_ids"]');
        const canaisIds = Array.from(select.selectedOptions).map(option => parseInt(option.value));
        
        const data = {
            nome: formData.get('nome').trim(),
            url: formData.get('url').trim(),
            icone: formData.get('icone').trim(),
            peso: parseInt(formData.get('peso')),
            canais_atendimentos_ids: canaisIds
        };
        
        const submitBtn = form.querySelector('button[type="submit"]');
        const loading = form.querySelector('#tela-loading-save');
        
        submitBtn.disabled = true;
        loading.classList.remove('hidden');
        
        req('v1/admin/telas', 'POST', data,
            function(response) {
                submitBtn.disabled = false;
                loading.classList.add('hidden');
                
                // Novo padrão: verificar code ao invés de success
                if (response.code === 201) {
                    avisos('Sucesso', response.message || 'Tela criada com sucesso', 'success');
                    closeCreateTelaModal();
                    loadTelas();
                } else {
                    avisos('Erro', response.message || 'Erro ao criar tela', 'error');
                }
            },
            function(error) {
                submitBtn.disabled = false;
                loading.classList.add('hidden');
                avisos('Erro', error?.message || 'Erro ao criar tela', 'error');
            }
        );
        
        return false;
    }

    function editTela(id) {
        loadElement('btn-nova-tela', true);

        req(`v1/admin/telas/${id}`, 'GET', null,
            function(response) {
                loadElement('btn-nova-tela', false);
                
                // Novo padrão: verificar code ao invés de success
                if (response.code === 200 && response.data) {
                    // Carregar opções de canais se necessário
                    if (appState.options.canais.length === 0) {
                        loadCanaisOptions(() => showEditTelaModal(response.data));
                    } else {
                        showEditTelaModal(response.data);
                    }
                } else {
                    avisos('Erro', response.message || 'Erro ao carregar dados da tela', 'error');
                }
            },
            function(error) {
                loadElement('btn-nova-tela', false);
                avisos('Erro', error?.message || 'Erro ao carregar tela', 'error');
            }
        );
    }

    function showEditTelaModal(tela) {
        if (appState.modals.editTela) {
            appState.modals.editTela.destroy();
        }

        appState.modals.editTela = new window.BashModal({
            id: 'telas-modal-edit',
            titulo: 'Editar Tela',
            classSize: 'w-11/12 max-w-2xl',
            container: '#tela-modal-container'
        });

        const form = createTelaForm(tela);
        appState.modals.editTela.setContent(form);
        appState.modals.editTela.open();
    }

    function updateTela(event, id) {
        event.preventDefault();
        
        const form = event.target;
        const formData = new FormData(form);
        
        // Coletar canais selecionados
        const select = form.querySelector('select[name="canais_atendimentos_ids"]');
        const canaisIds = Array.from(select.selectedOptions).map(option => parseInt(option.value));
        
        const data = {
            nome: formData.get('nome').trim(),
            url: formData.get('url').trim(),
            icone: formData.get('icone').trim(),
            peso: parseInt(formData.get('peso')),
            canais_atendimentos_ids: canaisIds
        };
        
        const submitBtn = form.querySelector('button[type="submit"]');
        const loading = form.querySelector('#tela-loading-save');
        
        submitBtn.disabled = true;
        loading.classList.remove('hidden');
        
        req(`v1/admin/telas/${id}`, 'PUT', data,
            function(response) {
                submitBtn.disabled = false;
                loading.classList.add('hidden');
                
                // Novo padrão: verificar code ao invés de success
                if (response.code === 200) {
                    avisos('Sucesso', response.message || 'Tela atualizada com sucesso', 'success');
                    closeEditTelaModal();
                    loadTelas();
                } else {
                    avisos('Erro', response.message || 'Erro ao atualizar tela', 'error');
                }
            },
            function(error) {
                submitBtn.disabled = false;
                loading.classList.add('hidden');
                avisos('Erro', error?.message || 'Erro ao atualizar tela', 'error');
            }
        );
        
        return false;
    }

    function deleteTela(id) {
        // Buscar dados da tela para exibir no modal
        const tela = appState.telas.data.find(t => t.id === id);
        const nomeTela = tela ? tela.nome : `ID ${id}`;
        
        abrirModalRemocao({
            titulo: 'Excluir Tela',
            mensagem: `Tem certeza que deseja excluir a tela "${nomeTela}"?`,
            labelRemover: 'Excluir',
            onConfirm: () => {
                req(`v1/admin/telas/${id}`, 'DELETE', null,
                    function(response) {
                        // Novo padrão: verificar code ao invés de success
                        if (response.code === 200) {
                            avisos('Sucesso', response.message || 'Tela excluída com sucesso', 'success');
                            loadTelas();
                        } else {
                            avisos('Erro', response.message || 'Erro ao excluir tela', 'error');
                        }
                    },
                    function(error) {
                        avisos('Erro', error?.message || 'Erro ao excluir tela', 'error');
                    }
                );
            }
        });
    }

    function restoreTela(id) {
        // Buscar dados da tela para exibir no modal
        const tela = appState.telas.data.find(t => t.id === id);
        const nomeTela = tela ? tela.nome : `ID ${id}`;
        
        abrirModalRemocao({
            titulo: 'Restaurar Tela',
            mensagem: `Tem certeza que deseja restaurar a tela "${nomeTela}"?`,
            labelRemover: 'Restaurar',
            onConfirm: () => {
                req(`v1/admin/telas/${id}/restore`, 'POST', null,
                    function(response) {
                        // Novo padrão: verificar code ao invés de success
                        if (response.code === 200) {
                            avisos('Sucesso', response.message || 'Tela restaurada com sucesso', 'success');
                            loadTelas();
                        } else {
                            avisos('Erro', response.message || 'Erro ao restaurar tela', 'error');
                        }
                    },
                    function(error) {
                        avisos('Erro', error?.message || 'Erro ao restaurar tela', 'error');
                    }
                );
            }
        });
    }

    // ============ MODAL HELPERS ============

    function closeCreatePermissaoModal() {
        if (appState.modals.createPermissao) {
            appState.modals.createPermissao.destroy();
            appState.modals.createPermissao = null;
        }
    }

    function closeEditPermissaoModal() {
        if (appState.modals.editPermissao) {
            appState.modals.editPermissao.destroy();
            appState.modals.editPermissao = null;
        }
    }

    function closeCreateTelaModal() {
        if (appState.modals.createTela) {
            appState.modals.createTela.destroy();
            appState.modals.createTela = null;
        }
    }

    function closeEditTelaModal() {
        if (appState.modals.editTela) {
            appState.modals.editTela.destroy();
            appState.modals.editTela = null;
        }
    }

    function closeManageVinculosModal() {
        if (appState.modals.manageVinculos) {
            appState.modals.manageVinculos.destroy();
            appState.modals.manageVinculos = null;
        }
    }

    // ============ VÍNCULOS PERMISSÃO-TELA ============

    function linkPermissaoTela(permissaoId, telaId) {
        const loading = document.getElementById('vinculos-loading');
        if (loading) loading.classList.remove('hidden');

        req(`v1/admin/vinculos/permissao/${permissaoId}/tela/${telaId}`, 'POST', null,
            function(response) {
                if (loading) loading.classList.add('hidden');
                
                if (response.code === 200 || response.code === 201) {
                    avisos('Sucesso', response.message || 'Tela vinculada com sucesso', 'success');
                    // Recarregar dados do modal
                    managePermissaoTelas(permissaoId);
                } else {
                    avisos('Erro', response.message || 'Erro ao vincular tela', 'error');
                }
            },
            function(error) {
                if (loading) loading.classList.add('hidden');
                avisos('Erro', error?.message || 'Erro ao vincular tela', 'error');
            }
        );
    }

    function unlinkPermissaoTela(permissaoId, telaId) {
        const loading = document.getElementById('vinculos-loading');
        if (loading) loading.classList.remove('hidden');

        req(`v1/admin/vinculos/permissao/${permissaoId}/tela/${telaId}`, 'DELETE', null,
            function(response) {
                if (loading) loading.classList.add('hidden');
                
                if (response.code === 200) {
                    avisos('Sucesso', response.message || 'Tela desvinculada com sucesso', 'success');
                    // Recarregar dados do modal
                    managePermissaoTelas(permissaoId);
                } else {
                    avisos('Erro', response.message || 'Erro ao desvincular tela', 'error');
                }
            },
            function(error) {
                if (loading) loading.classList.add('hidden');
                avisos('Erro', error?.message || 'Erro ao desvincular tela', 'error');
            }
        );
    }

    // ============ DESTRUIÇÃO ============

    function destroy() {
        console.log('Destruindo aplicação de permissões...');
        
        // Destruir modais
        Object.keys(appState.modals).forEach(key => {
            if (appState.modals[key]) {
                appState.modals[key].destroy();
                appState.modals[key] = null;
            }
        });
        
        // Destruir paginações
        if (appState.permissoes.pagination) {
            appState.permissoes.pagination = null;
        }
        if (appState.telas.pagination) {
            appState.telas.pagination = null;
        }
        
        // Limpar estado
        appState.permissoes.data = [];
        appState.telas.data = [];
        appState.options.canais = [];
    }

    // ============ API PÚBLICA ============

    // Configurar função de destruição para limpeza quando sair da página
    window.destroySessao = destroy;

    // Disponibilizar funções globalmente para uso nos templates
    window.permissoes = {
        switchTab,
        createPermissao,
        editPermissao,
        updatePermissao,
        deletePermissao,
        restorePermissao,
        managePermissaoTelas,
        linkPermissaoTela,
        unlinkPermissaoTela,
        createTela,
        editTela,
        updateTela,
        deleteTela,
        restoreTela,
        closeCreatePermissaoModal,
        closeEditPermissaoModal,
        closeCreateTelaModal,
        closeEditTelaModal,
        closeManageVinculosModal
    };

    // Disponibilizar switchTab globalmente para os tabs
    window.switchTab = switchTab;

    // ============ INICIALIZAÇÃO ============

    // Inicializar quando carregado
    init();

})();
