// Gerenciamento de Fluxos - Sistema Bash
(function () {
    'use strict';

    // ============ API ============

    const API = {
        baseUrl: 'v1/admin/fluxos',

        async buscar(pagina = 1, filtros = {}) {
            try {
                const params = new URLSearchParams({
                    page: pagina,
                    page_size: STATE.fluxos.limit,
                    q: filtros.q || '',
                    status: filtros.status || ''
                });

                if (filtros.empresa_id) {
                    params.set('empresa_id', filtros.empresa_id);
                }

                if (filtros.deleted_at !== null) {
                    params.set('deleted_at', filtros.deleted_at);
                }

                for (let [key, value] of [...params.entries()]) {
                    if (!value) params.delete(key);
                }

                const response = await reqAsync(`${this.baseUrl}?${params.toString()}`, 'GET');
                return { data: response.data, error: null };
            } catch (error) {
                console.error('❌ Erro ao buscar fluxos:', error);
                return { data: null, error: error?.message || 'Erro ao carregar fluxos' };
            }
        },

        async criar(payload) {
            try {
                const response = await reqAsync(this.baseUrl, 'POST', payload);
                return { data: response.data, error: null };
            } catch (error) {
                console.error('❌ Erro ao criar fluxo:', error);
                return { data: null, error: error?.message || 'Erro ao criar fluxo' };
            }
        },

        async atualizar(id, payload) {
            try {
                const response = await reqAsync(`${this.baseUrl}/${id}`, 'PUT', payload);
                return { data: response.data, error: null };
            } catch (error) {
                console.error('❌ Erro ao atualizar fluxo:', error);
                return { data: null, error: error?.message || 'Erro ao atualizar fluxo' };
            }
        },

        async deletar(id) {
            try {
                const response = await reqAsync(`${this.baseUrl}/${id}`, 'DELETE');
                return { data: response.data, error: null };
            } catch (error) {
                console.error('❌ Erro ao deletar fluxo:', error);
                return { data: null, error: error?.message || 'Erro ao deletar fluxo' };
            }
        },

        async restaurar(id) {
            try {
                const response = await reqAsync(`${this.baseUrl}/${id}/restore`, 'POST');
                return { data: response.data, error: null };
            } catch (error) {
                console.error('❌ Erro ao restaurar fluxo:', error);
                return { data: null, error: error?.message || 'Erro ao restaurar fluxo' };
            }
        }
    };

    // ============ STATE ============

    const STATE = {
        fluxos: {
            fluxoEmpresaSelected: null,
            data: [],
            pagina: 1,
            total: 0,
            limit: 20,
            loading: false,
            pagination: null,
            modoRestaurar: false,
            filtros: {
                q: '',
                status: '',
                empresa_id: '',
                deleted_at: null
            }
        },
        modals: {},
        empresas: [],
        fluxosDisponiveis: [],
        variaveisDisponiveis: [],
        funcoesDisponiveis: []
    };

    // ============ UI ============

    const UI = {
        init() {
            console.log('Inicializando interface de fluxos...');
            this.setupEventListeners();
            this.loadFluxos();
        },

        setupEventListeners() {
            // Formulário de filtros
            document.getElementById('filtros-fluxos')?.addEventListener('submit', (e) => EVENTS.handleFluxoFilter(e));

            // Botões de ação
            document.getElementById('fluxos-btn-novo')?.addEventListener('click', () => EVENTS.openNovoFluxoModal());
            document.getElementById('fluxos-btn-restaurar')?.addEventListener('click', () => EVENTS.openRestaurarModal());
            document.getElementById('fluxos-btn-limpar')?.addEventListener('click', () => EVENTS.limparFiltros());

            // Headers de ordenação
            document.querySelectorAll('th[data-sort]').forEach(th => {
                th.addEventListener('click', () => {
                    const sort = th.dataset.sort;
                    STATE.fluxos.filtros.sort = sort;
                    STATE.fluxos.pagina = 1;
                    this.loadFluxos();
                });
            });

            // Filtro de texto com debounce
            let debounceTimer;
            document.getElementById('filtro-fluxo-nome')?.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    STATE.fluxos.filtros.q = e.target.value;
                    STATE.fluxos.pagina = 1;
                    this.loadFluxos();
                }, 500);
            });

            // Event listeners para formulários (delegados)
            document.addEventListener('submit', (e) => {
                if (e.target.id === 'fluxos-form-create') {
                    e.preventDefault();
                    EVENTS.handleCreateFluxo(e.target);
                } else if (e.target.id === 'fluxos-form-edit') {
                    e.preventDefault();
                    EVENTS.handleEditFluxo(e.target);
                }
            });
        },

        async loadFluxos() {
            this.setFluxosLoading(true);
            STATE.fluxos.loading = true;

            const { data, error } = await API.buscar(STATE.fluxos.pagina, STATE.fluxos.filtros);

            this.setFluxosLoading(false);
            STATE.fluxos.loading = false;

            if (error) {
                avisos('Erro', error, 'error');
                STATE.fluxos.data = [];
                this.renderFluxosTable();
                return;
            }

            const paginatedData = data || {};
            STATE.fluxos.data = paginatedData.data || [];
            STATE.fluxos.total = paginatedData.total || 0;

            this.renderFluxosTable();
            this.updateFluxosPagination();
        },

        renderFluxosTable() {
            const tbody = document.getElementById('fluxos-tbody');
            if (!tbody) return;

            if (STATE.fluxos.data.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-center py-8 text-base-content/70">
                            <div class="flex flex-col items-center gap-2">
                                <i class="fas fa-search text-2xl opacity-50"></i>
                                <span>Nenhum fluxo encontrado</span>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = STATE.fluxos.data.map(fluxo => {
                const isAtivo = fluxo.status === 'ativo';
                const statusClass = isAtivo ? 'badge-success' : 'badge-error';
                const statusText = isAtivo ? 'Ativo' : 'Deletado';

                const empresaNome = fluxo.empresa_id
                    ? (STATE.empresas.find(e => e.id === fluxo.empresa_id)?.nome || fluxo.empresa_id)
                    : '<span class="text-base-content/40">-</span>';

                const dataFormatada = fluxo.updated_at
                    ? (() => {
                        const dt = fluxo.updated_at.replace('Z', '').replace('T', ' ').split('.')[0];
                        const [datePart, timePart] = dt.split(' ');
                        const [year, month, day] = datePart.split('-');
                        const [hour, minute] = timePart.split(':');
                        return `${day}/${month}/${year} ${hour}:${minute}`;
                      })()
                    : 'N/A';

                return `
                    <tr>
                        <td class="font-medium">${this.escapeHtml(fluxo.nome || '')}</td>
                        <td>${empresaNome}</td>
                        <td>
                            <span class="badge ${statusClass} badge-sm">${statusText}</span>
                            ${fluxo.pesquisa_satisfacao ? '<span class="badge badge-info badge-sm ml-1">Pesquisa</span>' : ''}
                        </td>
                        <td class="text-sm text-base-content/70">${dataFormatada}</td>
                        <td>
                            <div class="dropdown dropdown-end">
                                <button tabindex="0" role="button" class="btn btn-ghost btn-sm">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                                <ul tabindex="0" class="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow">
                                    ${STATE.fluxos.modoRestaurar ? `
                                        <li>
                                            <button type="button" onclick="window.BashFluxos.restoreFluxo(${fluxo.id})" class="text-success">
                                                <i class="fas fa-undo"></i>
                                                Restaurar
                                            </button>
                                        </li>
                                    ` : `
                                        <li>
                                            <button type="button" onclick="window.BashFluxos.viewFluxo(${fluxo.id}, ${fluxo.empresa_id})">
                                                <i class="fas fa-eye"></i>
                                                Fluxo
                                            </button>
                                        </li>
                                        <li>
                                            <button type="button" onclick="window.BashFluxos.editFluxo(${fluxo.id})">
                                                <i class="fas fa-edit"></i>
                                                Editar
                                            </button>
                                        </li>
                                        <li>
                                            <button type="button" onclick="window.BashFluxos.deleteFluxo(${fluxo.id})" class="text-error">
                                                <i class="fas fa-trash"></i>
                                                Excluir
                                            </button>
                                        </li>
                                    `}
                                </ul>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        },

        updateFluxosPagination() {
            const container = document.getElementById('fluxos-pagination-container');
            if (!container) return;

            if (STATE.fluxos.total <= STATE.fluxos.limit) {
                container.innerHTML = '';
                return;
            }

            const totalPages = Math.ceil(STATE.fluxos.total / STATE.fluxos.limit);
            const currentPage = STATE.fluxos.pagina;

            container.innerHTML = `
                <div class="flex justify-between items-center">
                    <div class="text-sm text-base-content/70">
                        Mostrando ${(currentPage - 1) * STATE.fluxos.limit + 1} até 
                        ${Math.min(currentPage * STATE.fluxos.limit, STATE.fluxos.total)} 
                        de ${STATE.fluxos.total} resultados
                    </div>
                    <div class="join">
                        <button class="join-item btn btn-sm" ${currentPage === 1 ? 'disabled' : ''} 
                                onclick="window.BashFluxos.changeFluxoPage(${currentPage - 1})">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        ${Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = i + Math.max(1, currentPage - 2);
                if (page > totalPages) return '';
                return `
                                <button class="join-item btn btn-sm ${page === currentPage ? 'btn-active' : ''}" 
                                        onclick="window.BashFluxos.changeFluxoPage(${page})">
                                    ${page}
                                </button>
                            `;
            }).join('')}
                        <button class="join-item btn btn-sm" ${currentPage === totalPages ? 'disabled' : ''} 
                                onclick="window.BashFluxos.changeFluxoPage(${currentPage + 1})">
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            `;
        },

        changeFluxoPage(page) {
            STATE.fluxos.pagina = page;
            this.loadFluxos();
        },

        setFluxosLoading(loading) {
            STATE.fluxos.loading = loading;
            const loadingEl = document.getElementById('fluxos-loading');
            const tableEl = document.getElementById('fluxos-data-container');

            if (loading) {
                loadingEl?.classList.remove('hidden');
                if (tableEl) tableEl.style.opacity = '0.5';
            } else {
                loadingEl?.classList.add('hidden');
                if (tableEl) tableEl.style.opacity = '1';
            }
        },

        updateInterfaceForRestoreMode(isRestoreMode) {
            const btnRestaurar = document.getElementById('fluxos-btn-restaurar');
            const btnNovo = document.getElementById('fluxos-btn-novo');
            const pageTitle = document.querySelector('h1, .page-title, .card-title') ||
                document.querySelector('[class*="title"]');

            if (isRestoreMode) {
                if (btnRestaurar) {
                    btnRestaurar.innerHTML = '<i class="fas fa-arrow-left"></i> Voltar';
                    btnRestaurar.classList.add('btn-outline');
                }

                if (btnNovo) btnNovo.style.display = 'none';

                if (pageTitle) {
                    pageTitle.textContent = pageTitle.textContent.includes('Restaurar')
                        ? pageTitle.textContent
                        : 'Restaurar Fluxos - ' + pageTitle.textContent;
                }
            } else {
                if (btnRestaurar) {
                    btnRestaurar.innerHTML = '<i class="fas fa-history"></i> Restaurar';
                    btnRestaurar.classList.remove('btn-outline');
                }

                if (btnNovo) btnNovo.style.display = '';

                if (pageTitle && pageTitle.textContent.includes('Restaurar')) {
                    pageTitle.textContent = pageTitle.textContent.replace('Restaurar Fluxos - ', '');
                }
            }
        },

        escapeHtml(text) {
            if (!text) return '';
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return text.replace(/[&<>"']/g, m => map[m]);
        },

        loadEmpresas() {
            req('v1/admin/options/empresas', 'GET', null,
                function(response) {
                    if (response && response.code === 200) {
                        STATE.empresas = response.data || [];
                        UI.populateEmpresaSelects();
                    }
                },
                function() {}
            );
        },

        populateEmpresaSelects() {
            const options = STATE.empresas.map(e =>
                `<option value="${e.id}">${UI.escapeHtml(e.nome || e.name || '')}</option>`
            ).join('');
            const filtroSelect = document.getElementById('filtro-fluxo-empresa');
            if (filtroSelect) {
                filtroSelect.innerHTML = '<option value="">Todas as empresas</option>' + options;
            }
        }
    };

    // ============ MODALS ============

    const MODALS = {
        createNovoFluxoForm() {
            const empresaOptions = STATE.empresas.map(e =>
                `<option value="${e.id}">${UI.escapeHtml(e.nome || e.name || '')}</option>`
            ).join('');

            return `
                <form id="fluxos-form-create" class="space-y-4">
                    <div class="form-control">
                        <label class="label">
                            <span class="label-text font-medium">Empresa</span>
                        </label>
                        <select name="empresa_id" class="select select-bordered w-full">
                            <option value="">Selecione uma empresa</option>
                            ${empresaOptions}
                        </select>
                    </div>

                    <div class="form-control">
                        <label class="label">
                            <span class="label-text font-medium">Nome do Fluxo *</span>
                        </label>
                        <input type="text" name="nome" 
                               class="input input-bordered w-full" 
                               placeholder="Digite o nome do fluxo" 
                               required
                               autofocus>
                    </div>

                    <div class="form-control">
                        <label class="label cursor-pointer justify-start gap-3">
                            <input type="checkbox" name="pesquisa_satisfacao" class="checkbox checkbox-primary" value="true">
                            <span class="label-text font-medium">Pesquisa de Satisfação</span>
                        </label>
                    </div>

                    <div class="modal-action">
                        <button type="button" class="btn btn-ghost" onclick="window.BashFluxos.closeModal('createFluxo')">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                        <button type="submit" class="btn btn-primary">
                            <span id="fluxos-loading-save" class="loading loading-spinner loading-sm hidden"></span>
                            <i class="fas fa-plus"></i> Criar Fluxo
                        </button>
                    </div>
                </form>
            `;
        },

        createEditFluxoForm(fluxo) {
            const empresaOptions = STATE.empresas.map(e =>
                `<option value="${e.id}" ${fluxo.empresa_id === e.id ? 'selected' : ''}>${UI.escapeHtml(e.nome || e.name || '')}</option>`
            ).join('');

            return `
                <form id="fluxos-form-edit" class="space-y-4">
                    <input type="hidden" name="fluxo_id" value="${fluxo.id}">
                    
                    <div class="form-control">
                        <label class="label">
                            <span class="label-text font-medium">Empresa</span>
                        </label>
                        <select name="empresa_id" class="select select-bordered w-full">
                            <option value="">Selecione uma empresa</option>
                            ${empresaOptions}
                        </select>
                    </div>

                    <div class="form-control">
                        <label class="label">
                            <span class="label-text">Nome do Fluxo <span class="text-error">*</span></span>
                        </label>
                        <input type="text" name="nome" class="input input-bordered" 
                               placeholder="Digite o nome do fluxo" 
                               value="${UI.escapeHtml(fluxo.nome || '')}" required>
                    </div>

                    <div class="form-control">
                        <label class="label cursor-pointer justify-start gap-3">
                            <input type="checkbox" name="pesquisa_satisfacao" class="checkbox checkbox-primary" value="true" ${fluxo.pesquisa_satisfacao ? 'checked' : ''}>
                            <span class="label-text font-medium">Pesquisa de Satisfação</span>
                        </label>
                    </div>

                    <div class="flex gap-2 pt-4">
                        <button type="button" class="btn btn-ghost flex-1" onclick="window.BashFluxos.closeModal('editFluxo')">
                            Cancelar
                        </button>
                        <button type="submit" class="btn btn-primary flex-1">
                            <span id="fluxos-loading-edit" class="loading loading-spinner loading-sm hidden"></span>
                            Salvar Alterações
                        </button>
                    </div>
                </form>
            `;
        }
    };

    // ============ EVENTS ============

    const EVENTS = {
        handleFluxoFilter(e) {
            e.preventDefault();
            const formData = new FormData(e.target);

            const currentDeletedAt = STATE.fluxos.filtros.deleted_at;

            STATE.fluxos.filtros = {
                q: formData.get('q') || '',
                status: formData.get('status') || '',
                empresa_id: formData.get('empresa_id') || '',
                deleted_at: currentDeletedAt
            };

            STATE.fluxos.pagina = 1;
            UI.loadFluxos();
        },

        limparFiltros() {
            const nomeInput = document.getElementById('filtro-fluxo-nome');
            const statusInput = document.getElementById('filtro-fluxo-status');
            const empresaInput = document.getElementById('filtro-fluxo-empresa');

            if (nomeInput) nomeInput.value = '';
            if (statusInput) statusInput.value = '';
            if (empresaInput) empresaInput.value = '';

            STATE.fluxos.filtros = {
                q: '',
                status: '',
                empresa_id: '',
                deleted_at: STATE.fluxos.modoRestaurar ? true : null
            };

            STATE.fluxos.pagina = 1;
            UI.loadFluxos();
        },

        openNovoFluxoModal() {
            console.log('openNovoFluxoModal chamado');
            
            if (STATE.modals.createFluxo) {
                STATE.modals.createFluxo.destroy();
            }

            if (typeof BashModal === 'undefined') {
                console.error('BashModal não está disponível!');
                alert('Erro: Sistema de modais não carregado. Recarregue a página.');
                return;
            }

            console.log('Criando novo modal...');
            STATE.modals.createFluxo = new BashModal({
                id: 'boteria-modal-create',
                titulo: 'Novo Fluxo',
                classSize: 'w-11/12 max-w-lg',
                container: 'body'
            });

            const form = MODALS.createNovoFluxoForm();
            console.log('Formulário criado:', form.substring(0, 100));
            STATE.modals.createFluxo.setContent(form);
            console.log('Abrindo modal...');
            STATE.modals.createFluxo.open();
        },

        async handleCreateFluxo(form) {
            const formData = new FormData(form);
            const nome = formData.get('nome')?.trim();

            if (!nome) {
                avisos('Atenção', 'O nome do fluxo é obrigatório', 'warning');
                return;
            }

            const empresaId = formData.get('empresa_id') ? parseInt(formData.get('empresa_id')) : null;
            const pesquisaSatisfacao = formData.get('pesquisa_satisfacao') === 'true';

            const dadosFluxo = {
                nome,
                empresa_id: empresaId,
                pesquisa_satisfacao: pesquisaSatisfacao
            };

            const loadingBtn = document.getElementById('fluxos-loading-save');
            if (loadingBtn) loadingBtn.classList.remove('hidden');

            const { data, error } = await API.criar(dadosFluxo);
            
            if (loadingBtn) loadingBtn.classList.add('hidden');
            
            if (error) {
                avisos('Erro', error, 'error');
                return;
            }

            avisos('Sucesso', 'Fluxo criado com sucesso!', 'success');
            STATE.modals.createFluxo.close();
            UI.loadFluxos();
        },

        openRestaurarModal() {
            STATE.fluxos.modoRestaurar = !STATE.fluxos.modoRestaurar;

            if (STATE.fluxos.modoRestaurar) {
                this.limparFiltros();
                STATE.fluxos.filtros.deleted_at = true;
                UI.updateInterfaceForRestoreMode(true);
            } else {
                this.limparFiltros();
                STATE.fluxos.filtros.deleted_at = null;
                UI.updateInterfaceForRestoreMode(false);
            }

            UI.loadFluxos();
        },

        viewFluxo(fluxoId,empresaId) {
            const _container = document.querySelector('#fluxos-modal-container')
            if (_container) _container.innerHTML = ''
            
            
            STATE.fluxos.fluxoEmpresaSelected = empresaId;
            if (!fluxoId) {
                avisos('Erro', 'ID do fluxo não fornecido', 'error');
                return;
            }

            localStorage.setItem('boteria_id', fluxoId);

            document.getElementById('boteria-container')?.classList.add('hidden');
            document.getElementById('ura-fluxograma')?.classList.remove('hidden');
            
            const conteudoFluxograma = $('#conteudo-fluxograma');
            if (conteudoFluxograma.length) {
                conteudoFluxograma.load(
                    `/sessao/gestao/administrativo/construtor/fluxo.html?_=${new Date().getTime()}`
                );
            }
            
            console.log(`Visualizando fluxo ID: ${fluxoId}`);
        },

        editFluxo(fluxoId) {
            const fluxo = STATE.fluxos.data.find(f => f.id === fluxoId);
            if (!fluxo) {
                avisos('Erro', 'Fluxo não encontrado', 'error');
                return;
            }

            if (STATE.modals.editFluxo) {
                STATE.modals.editFluxo.destroy();
            }

            STATE.modals.editFluxo = new BashModal({
                id: 'fluxos-modal-edit',
                titulo: 'Editar Fluxo',
                classSize: 'w-11/12 max-w-md',
                container: 'body'
            });

            const form = MODALS.createEditFluxoForm(fluxo);
            STATE.modals.editFluxo.setContent(form);
            STATE.modals.editFluxo.open();
        },

        async handleEditFluxo(form) {
            const formData = new FormData(form);
            const fluxoId = parseInt(formData.get('fluxo_id'));

            const data = {
                nome: formData.get('nome'),
                empresa_id: formData.get('empresa_id') ? parseInt(formData.get('empresa_id')) : null,
                pesquisa_satisfacao: formData.get('pesquisa_satisfacao') === 'true'
            };

            if (!data.nome || data.nome.trim() === '') {
                avisos('Atenção', 'O nome do fluxo é obrigatório', 'warning');
                return;
            }

            const loadingBtn = document.getElementById('fluxos-loading-edit');
            if (loadingBtn) loadingBtn.classList.remove('hidden');

            const { error } = await API.atualizar(fluxoId, data);
            
            if (loadingBtn) loadingBtn.classList.add('hidden');
            
            if (error) {
                avisos('Erro', error, 'error');
                return;
            }

            avisos('Sucesso', 'Fluxo atualizado com sucesso!', 'success');
            STATE.modals.editFluxo.close();
            UI.loadFluxos();
        },

        deleteFluxo(fluxoId) {
            abrirModalRemocao({
                titulo: 'Excluir Fluxo',
                mensagem: 'Tem certeza que deseja excluir este fluxo? Esta ação não pode ser desfeita.',
                onConfirm: async () => {
                    const { error } = await API.deletar(fluxoId);
                    
                    if (error) {
                        avisos('Erro', error, 'error');
                        return;
                    }

                    avisos('Sucesso', 'Fluxo excluído com sucesso!', 'success');
                    UI.loadFluxos();
                }
            });
        },

        restoreFluxo(fluxoId) {
            const fluxo = STATE.fluxos.data.find(f => f.id === fluxoId);
            if (!fluxo) return;

            abrirModalRemocao({
                titulo: 'Restaurar Fluxo',
                mensagem: `Tem certeza que deseja restaurar o fluxo "${fluxo.nome}"?`,
                labelRemover: 'Restaurar',
                onConfirm: async () => {
                    const { error } = await API.restaurar(fluxoId);
                    
                    if (error) {
                        avisos('Erro', error, 'error');
                        return;
                    }

                    avisos('Sucesso', 'Fluxo restaurado com sucesso!', 'success');
                    UI.loadFluxos();
                }
            });
        },

        closeModal(modalName) {
            if (STATE.modals[modalName]) {
                STATE.modals[modalName].close();
            }
        }
    };

    // ============ CORE ============

    const CORE = {
        init() {
            console.log('Inicializando tela de fluxos...');
            UI.loadEmpresas();
            UI.init();
        }
    };

    // Expor apenas namespace global
    window.BashFluxos = {
        API,
        UI,
        STATE,
        EVENTS,
        MODALS,
        CORE,
        // Métodos públicos para uso inline
        changeFluxoPage: (page) => UI.changeFluxoPage(page),
        viewFluxo: (id, empresaId) => EVENTS.viewFluxo(id, empresaId),
        editFluxo: (id) => EVENTS.editFluxo(id),
        toggleFluxoStatus: (id, status) => EVENTS.toggleFluxoStatus(id, status),
        deleteFluxo: (id) => EVENTS.deleteFluxo(id),
        restoreFluxo: (id) => EVENTS.restoreFluxo(id),
        closeModal: (name) => EVENTS.closeModal(name)
    };

    // Auto-inicializar quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => CORE.init());
    } else {
        CORE.init();
    }

})();
