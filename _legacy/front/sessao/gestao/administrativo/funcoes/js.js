(function () {
  // ============================================================================
  // API
  // ============================================================================
  const API = {
    baseUrl: "v1/admin/funcoes",

    async buscar(pagina = 1, filter = {}) {
      try {
        const url = `${this.baseUrl}?page=${pagina}&${new URLSearchParams(filter).toString()}`;
        const response = await reqAsync(url, "GET");
        return { data: response.data, error: null };
      } catch (error) {
        return { data: null, error: error?.message || "Erro ao carregar funções" };
      }
    },

    async buscarDeletados(pagina = 1, filter = {}) {
      try {
        const params = new URLSearchParams({ page: pagina, ...filter }).toString();
        const url = `${this.baseUrl}/deletados?${params}`;
        const response = await reqAsync(url, "GET");
        return { data: response.data, error: null };
      } catch (error) {
        return { data: null, error: error?.message || "Erro ao carregar funções deletadas" };
      }
    },

    async criar(payload) {
      try {
        const response = await reqAsync(this.baseUrl, "POST", payload);
        return { data: response.data, error: null };
      } catch (error) {
        return { data: null, error: error?.message || "Erro ao criar função" };
      }
    },

    async atualizar(id, payload) {
      try {
        const response = await reqAsync(`${this.baseUrl}/${id}`, "PUT", payload);
        return { data: response.data, error: null };
      } catch (error) {
        return { data: null, error: error?.message || "Erro ao atualizar função" };
      }
    },

    async deletar(id) {
      try {
        const response = await reqAsync(`${this.baseUrl}/${id}`, "DELETE");
        return { data: response.data, error: null };
      } catch (error) {
        return { data: null, error: error?.message || "Erro ao deletar função" };
      }
    },

    async restaurar(id) {
      try {
        const response = await reqAsync(`${this.baseUrl}/recuperar/${id}`, "PATCH");
        return { data: response.data, error: null };
      } catch (error) {
        return { data: null, error: error?.message || "Erro ao restaurar função" };
      }
    },

    async buscarEmpresas() {
      try {
        const response = await reqAsync("v1/admin/options/empresas", "GET");
        return { data: response.data, error: null };
      } catch (error) {
        return { data: [], error: error?.message || "Erro ao carregar empresas" };
      }
    },

    async buscarTipos() {
      try {
        const response = await reqAsync("v1/admin/funcoes/tipos/options", "GET");
        return { data: response.data, error: null };
      } catch (error) {
        return { data: [], error: error?.message || "Erro ao carregar tipos" };
      }
    },
  };

  // ============================================================================
  // STATE
  // ============================================================================
  const STATE = {
    componentes: {
      tabela: null,
      paginacao: null,
      tableDeletados: null,
      paginacaoDeletados: null,
    },
    funcoes: [],
    funcoesDeletadas: [],
    empresas: [],
    tipos: [],
    paginacao: { pagina: 1, limit: 10, total: 0, totalPaginas: 0 },
    paginacaoDeletados: { pagina: 1, limit: 10, total: 0, totalPaginas: 0 },
  };

  // ============================================================================
  // HELPERS
  // ============================================================================
  function parseJsonField(str) {
    if (!str || str.trim() === "") return null;
    try {
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  }

  function prettyJson(obj) {
    if (!obj) return "";
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return String(obj);
    }
  }

  function nomeEmpresa(empresaId) {
    if (!empresaId) return '<span class="text-base-content/40">-</span>';
    const emp = STATE.empresas.find((e) => e.id == empresaId);
    return emp ? escapeHtml(emp.nome) : `<span class="text-base-content/40">#${empresaId}</span>`;
  }

  // ============================================================================
  // UI
  // ============================================================================
  const UI = {
    init() {
      this.buildFormFilter();
      this.buildTable();
      this.buildPagination();
      this.buildModalCriar();
      this.buildModalEditar();
      this.buildModalDeletados();
      this.buildModalConfiguracoes();
    },

    // --------------------------------------------------------------------------
    // Filtros
    // --------------------------------------------------------------------------
    buildFormFilter() {
      const html = `
        <form id="form-funcoes-filtros" class="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div class="col-span-full md:col-span-3">
            <label class="label"><span class="label-text font-medium">Empresa</span></label>
            <select name="empresa_id" id="funcoes-filtro-empresa" class="select select-bordered w-full">
              <option value="">Todas</option>
            </select>
          </div>

          <div class="col-span-full md:col-span-3">
            <label class="label"><span class="label-text font-medium">Nome</span></label>
            <input name="nome" type="text" class="input input-bordered w-full" placeholder="Buscar por nome...">
          </div>

          <div class="col-span-full md:col-span-3">
            <label class="label"><span class="label-text font-medium">Tipo</span></label>
            <select name="tipo_id" id="funcoes-filtro-tipo" class="select select-bordered w-full">
              <option value="">Todos</option>
            </select>
          </div>

          <div class="col-span-full md:col-span-3 flex gap-2 items-end">
            <button type="button" id="btn-limpar-filtros" class="btn btn-ghost flex-1">
              <i class="fa-solid fa-eraser"></i> Limpar
            </button>
            <button type="submit" class="btn btn-primary flex-1">
              <i class="fa-solid fa-filter"></i> Filtrar
            </button>
          </div>
        </form>
      `;

      $("#funcoes-filtros").html(html);

      $("#form-funcoes-filtros").on("submit", (e) => {
        e.preventDefault();
        UI.loadData(1);
      });

      $("#btn-limpar-filtros").on("click", function () {
        $("#form-funcoes-filtros")[0].reset();
        if (STATE.empresas.length > 0) {
          $("#funcoes-filtro-empresa").val(STATE.empresas[0].id);
        }
        $("#funcoes-filtro-tipo").val("");
        UI.loadData(1);
      });
    },

    // --------------------------------------------------------------------------
    // Tabela principal
    // --------------------------------------------------------------------------
    buildTable() {
      const colunas = [
        {
          label: "Nome / Descrição",
          value: "nome",
          format: (value, row) => `
            <div>
              <div class="font-semibold">${escapeHtml(value || "")}</div>
              <div class="text-xs text-base-content/60">${escapeHtml(row.descricao || "")}</div>
            </div>
          `,
        },
        {
          label: "Tipo",
          value: "tipo_id",
          format: (value) => {
            if (!value) return '<span class="text-base-content/40">-</span>';
            const tipo = STATE.tipos.find((t) => t.id == value);
            return tipo ? escapeHtml(tipo.nome) : `<span class="text-base-content/40">#${value}</span>`;
          },
        },
        {
          label: "Empresa",
          value: "empresa_id",
          format: (value) => nomeEmpresa(value),
        },
        {
          label: "Criado em",
          value: "created_at",
          format: (value) => {
            if (!value) return "-";
            try {
              const d = new Date(value);
              return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
            } catch (e) {
              return value;
            }
          },
        },
        {
          label: "Ações",
          value: "id",
          format: (value) => `
            <div class="flex gap-1">
              <button class="btn btn-info btn-xs tooltip" data-tip="Editar"
                onclick="window.BashFuncoes.EVENTS.editarFuncao(${value})">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-accent btn-xs tooltip" data-tip="Variáveis"
                onclick="window.BashFuncoes.EVENTS.abrirConfiguracoes(${value})">
                <i class="fas fa-layer-group"></i>
              </button>
              <button class="btn btn-error btn-xs tooltip" data-tip="Remover"
                onclick="window.BashFuncoes.EVENTS.deletarFuncao(${value})">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          `,
        },
      ];

      STATE.componentes.tabela = new BashTable({
        id: "tabela-funcoes",
        columns: colunas,
        data: STATE.funcoes,
        classList: "table table-sm table-zebra w-full",
        emptyMessage: "Nenhuma função encontrada.",
        container: "#funcoes-tabela-container",
      });
    },

    buildPagination() {
      STATE.componentes.paginacao = new BashPagination({
        id: "funcoes-pagination",
        pagina: STATE.paginacao.pagina,
        total: STATE.paginacao.total,
        limit: STATE.paginacao.limit,
        container: "#funcoes-pagination-container",
        onNext: (p) => UI.loadData(p),
        onPrev: (p) => UI.loadData(p),
      });
    },

    // --------------------------------------------------------------------------
    // Modal Criar
    // --------------------------------------------------------------------------
    buildModalCriar() {
      const modalHtml = `
        <dialog id="funcoes-modal-criar" class="modal">
          <div class="modal-box max-w-4xl">
            <form method="dialog">
              <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">?</button>
            </form>
            <h3 class="font-bold text-lg mb-4">Nova Função</h3>

            <form id="form-criar-funcao" class="grid grid-cols-12 gap-4">

              <div class="col-span-6">
                <label class="label"><span class="label-text font-medium">Empresa</span></label>
                <select name="empresa_id" id="funcao-criar-empresa" class="select select-bordered w-full">
                  <option value="">Selecione...</option>
                </select>
              </div>

              <div class="col-span-6">
                <label class="label"><span class="label-text font-medium">Nome *</span></label>
                <input name="nome" type="text" class="input input-bordered w-full"
                  placeholder="nome_da_funcao" required>
              </div>

              <div class="col-span-6">
                <label class="label"><span class="label-text font-medium">Descrição</span></label>
                <input name="descricao" type="text" class="input input-bordered w-full"
                  placeholder="Descrição breve da função">
              </div>

              <div class="col-span-6">
                <label class="label"><span class="label-text font-medium">Tipo</span></label>
                <select name="tipo_id" id="funcao-criar-tipo" class="select select-bordered w-full">
                  <option value="">Selecione um tipo...</option>
                </select>
              </div>

              <div class="col-span-12">
                <label class="label">
                  <span class="label-text font-medium">Configuração</span>
                  <span class="label-text-alt text-base-content/50">JSON: url, method, timeout_seconds, headers, auth</span>
                </label>
                <textarea name="configuracao" class="textarea textarea-bordered w-full font-mono text-sm" rows="6"
                  placeholder='{"url": "/api/endpoint", "method": "POST", "timeout_seconds": 30}'></textarea>
              </div>

              <div class="col-span-12">
                <label class="label">
                  <span class="label-text font-medium">Request Schema</span>
                  <span class="label-text-alt text-base-content/50">JSON: body, query_params</span>
                </label>
                <textarea name="request_schema" class="textarea textarea-bordered w-full font-mono text-sm" rows="6"
                  placeholder='{"body": {"campo": "valor"}, "query_params": {}}'></textarea>
              </div>

              <div class="col-span-12">
                <label class="label">
                  <span class="label-text font-medium">Response Schema</span>
                  <span class="label-text-alt text-base-content/50">JSON: extract</span>
                </label>
                <textarea name="response_schema" class="textarea textarea-bordered w-full font-mono text-sm" rows="4"
                  placeholder='{"extract": {"variavel": "caminho.no.json"}}'></textarea>
              </div>

              <div class="col-span-12 flex justify-end gap-2 mt-2">
                <button type="button" class="btn btn-ghost"
                  onclick="document.getElementById('funcoes-modal-criar').close()">Cancelar</button>
                <button type="submit" class="btn btn-primary">
                  <i class="fa-solid fa-save"></i> Criar Função
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" class="modal-backdrop"><button>close</button></form>
        </dialog>
      `;

      $("#funcoes-modal-container").append(modalHtml);

      $("#form-criar-funcao").on("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);

        const configuracao = parseJsonField(fd.get("configuracao"));
        const requestSchema = parseJsonField(fd.get("request_schema"));
        const responseSchema = parseJsonField(fd.get("response_schema"));

        if (fd.get("configuracao").trim() && configuracao === null) {
          avisos("Configuração inválida: JSON malformado", "", "error");
          return;
        }
        if (fd.get("request_schema").trim() && requestSchema === null) {
          avisos("Request Schema inválido: JSON malformado", "", "error");
          return;
        }
        if (fd.get("response_schema").trim() && responseSchema === null) {
          avisos("Response Schema inválido: JSON malformado", "", "error");
          return;
        }

        const tipoIdRaw = fd.get("tipo_id");
        const empresaIdRaw = fd.get("empresa_id");
        const payload = {
          nome: fd.get("nome"),
          descricao: fd.get("descricao") || null,
          tipo_id: tipoIdRaw ? parseInt(tipoIdRaw) : null,
          configuracao: configuracao,
          request_schema: requestSchema,
          response_schema: responseSchema,
          empresa_id: empresaIdRaw ? parseInt(empresaIdRaw) : null,
        };

        const { error } = await API.criar(payload);
        if (error) { avisos(error, "", "error"); return; }

        avisos("Função criada com sucesso!", "", "success");
        document.getElementById("funcoes-modal-criar").close();
        e.target.reset();
        await UI.loadData(STATE.paginacao.pagina);
      });
    },

    // --------------------------------------------------------------------------
    // Modal Editar
    // --------------------------------------------------------------------------
    buildModalEditar() {
      const modalHtml = `
        <dialog id="funcoes-modal-editar" class="modal">
          <div class="modal-box max-w-4xl">
            <form method="dialog">
              <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">?</button>
            </form>
            <h3 class="font-bold text-lg mb-4">Editar Função</h3>

            <form id="form-editar-funcao" class="grid grid-cols-12 gap-4">
              <input type="hidden" name="id">

              <div class="col-span-6">
                <label class="label"><span class="label-text font-medium">Empresa</span></label>
                <select name="empresa_id" id="funcao-editar-empresa" class="select select-bordered w-full">
                  <option value="">Selecione...</option>
                </select>
              </div>

              <div class="col-span-6">
                <label class="label"><span class="label-text font-medium">Nome *</span></label>
                <input name="nome" type="text" class="input input-bordered w-full"
                  placeholder="nome_da_funcao" required>
              </div>

              <div class="col-span-6">
                <label class="label"><span class="label-text font-medium">Descrição</span></label>
                <input name="descricao" type="text" class="input input-bordered w-full"
                  placeholder="Descrição breve da função">
              </div>

              <div class="col-span-6">
                <label class="label"><span class="label-text font-medium">Tipo</span></label>
                <select name="tipo_id" id="funcao-editar-tipo" class="select select-bordered w-full">
                  <option value="">Selecione um tipo...</option>
                </select>
              </div>

              <div class="col-span-12">
                <label class="label">
                  <span class="label-text font-medium">Configuração</span>
                  <span class="label-text-alt text-base-content/50">JSON: url, method, timeout_seconds, headers, auth</span>
                </label>
                <textarea name="configuracao" class="textarea textarea-bordered w-full font-mono text-sm" rows="6"></textarea>
              </div>

              <div class="col-span-12">
                <label class="label">
                  <span class="label-text font-medium">Request Schema</span>
                  <span class="label-text-alt text-base-content/50">JSON: body, query_params</span>
                </label>
                <textarea name="request_schema" class="textarea textarea-bordered w-full font-mono text-sm" rows="6"></textarea>
              </div>

              <div class="col-span-12">
                <label class="label">
                  <span class="label-text font-medium">Response Schema</span>
                  <span class="label-text-alt text-base-content/50">JSON: extract</span>
                </label>
                <textarea name="response_schema" class="textarea textarea-bordered w-full font-mono text-sm" rows="4"></textarea>
              </div>

              <div class="col-span-12 flex justify-end gap-2 mt-2">
                <button type="button" class="btn btn-ghost"
                  onclick="document.getElementById('funcoes-modal-editar').close()">Cancelar</button>
                <button type="submit" class="btn btn-primary">
                  <i class="fa-solid fa-save"></i> Salvar Alterações
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" class="modal-backdrop"><button>close</button></form>
        </dialog>
      `;

      $("#funcoes-modal-container").append(modalHtml);

      $("#form-editar-funcao").on("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const id = parseInt(fd.get("id"));

        const configuracao = parseJsonField(fd.get("configuracao"));
        const requestSchema = parseJsonField(fd.get("request_schema"));
        const responseSchema = parseJsonField(fd.get("response_schema"));

        if (fd.get("configuracao").trim() && configuracao === null) {
          avisos("Configuração inválida: JSON malformado", "", "error");
          return;
        }
        if (fd.get("request_schema").trim() && requestSchema === null) {
          avisos("Request Schema inválido: JSON malformado", "", "error");
          return;
        }
        if (fd.get("response_schema").trim() && responseSchema === null) {
          avisos("Response Schema inválido: JSON malformado", "", "error");
          return;
        }

        const tipoIdRaw = fd.get("tipo_id");
        const empresaIdRaw = fd.get("empresa_id");
        const payload = {
          nome: fd.get("nome"),
          descricao: fd.get("descricao") || null,
          tipo_id: tipoIdRaw ? parseInt(tipoIdRaw) : null,
          configuracao: configuracao,
          request_schema: requestSchema,
          response_schema: responseSchema,
          empresa_id: empresaIdRaw ? parseInt(empresaIdRaw) : null,
        };

        const { error } = await API.atualizar(id, payload);
        if (error) { avisos(error, "", "error"); return; }

        avisos("Função atualizada com sucesso!", "", "success");
        document.getElementById("funcoes-modal-editar").close();
        await UI.loadData(STATE.paginacao.pagina);
      });
    },

    // --------------------------------------------------------------------------
    // Modal Deletados
    // --------------------------------------------------------------------------
    buildModalDeletados() {
      const modalHtml = `
        <dialog id="funcoes-modal-deletados" class="modal">
          <div class="modal-box max-w-5xl">
            <form method="dialog">
              <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">X</button>
            </form>
            <h3 class="font-bold text-lg mb-4">Funções Deletadas</h3>
            <div id="funcoes-deletados-tabela-container" class="mt-4"></div>
            <div id="funcoes-deletados-pagination-container"></div>
          </div>
          <form method="dialog" class="modal-backdrop"><button>close</button></form>
        </dialog>
      `;
      $("#funcoes-modal-container").append(modalHtml);
    },

    // --------------------------------------------------------------------------
    // Modal Configurações JSON (view)
    // --------------------------------------------------------------------------
    buildModalConfiguracoes() {
      const modalHtml = `
        <dialog id="funcoes-modal-config" class="modal">
          <div class="modal-box max-w-4xl">
            <form method="dialog">
              <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">X</button>
            </form>
            <h3 class="font-bold text-lg mb-4" id="funcoes-config-titulo">Configurações da Função</h3>

            <div class="space-y-4">
              <div>
                <div class="label"><span class="label-text font-medium">Configuração</span></div>
                <pre id="funcoes-config-configuracao"
                  class="bg-base-200 rounded-lg p-4 text-sm font-mono overflow-auto max-h-48 whitespace-pre-wrap"></pre>
              </div>
              <div>
                <div class="label"><span class="label-text font-medium">Request Schema</span></div>
                <pre id="funcoes-config-request"
                  class="bg-base-200 rounded-lg p-4 text-sm font-mono overflow-auto max-h-48 whitespace-pre-wrap"></pre>
              </div>
              <div>
                <div class="label"><span class="label-text font-medium">Response Schema</span></div>
                <pre id="funcoes-config-response"
                  class="bg-base-200 rounded-lg p-4 text-sm font-mono overflow-auto max-h-48 whitespace-pre-wrap"></pre>
              </div>
            </div>

            <div class="flex justify-end mt-4">
              <button type="button" class="btn btn-ghost"
                onclick="document.getElementById('funcoes-modal-config').close()">Fechar</button>
            </div>
          </div>
          <form method="dialog" class="modal-backdrop"><button>close</button></form>
        </dialog>
      `;
      $("#funcoes-modal-container").append(modalHtml);
    },

    // --------------------------------------------------------------------------
    // Empresas
    // --------------------------------------------------------------------------
    popularSelectEmpresas(selectorId, selectedId = null) {
      const $select = $(selectorId);
      if (!$select.length) return;
      const isFilter = selectorId === "#funcoes-filtro-empresa";
      const emptyLabel = isFilter ? "Todas" : "Selecione...";
      const options = STATE.empresas
        .map((e) => `<option value="${e.id}" ${selectedId == e.id ? "selected" : ""}>${escapeHtml(e.nome)}</option>`)
        .join("");
      $select.html(`<option value="">${emptyLabel}</option>${options}`);
    },

    async carregarEmpresas() {
      const { data, error } = await API.buscarEmpresas();
      if (error || !data) return;

      STATE.empresas = data;

      this.popularSelectEmpresas("#funcoes-filtro-empresa");
      this.popularSelectEmpresas("#funcao-criar-empresa");
      this.popularSelectEmpresas("#funcao-editar-empresa");
      if (STATE.empresas.length > 0) {
        const primeiraId = STATE.empresas[0].id;
        $("#funcoes-filtro-empresa").val(primeiraId);
      }
    },

    async carregarTipos() {
      const { data, error } = await API.buscarTipos();
      if (error || !data) return;

      STATE.tipos = data;

      const options = data.map((t) => `<option value="${t.id}">${escapeHtml(t.nome)}</option>`).join("");
      const base = `<option value="">Todos</option>${options}`;
      const baseModal = `<option value="">Selecione um tipo...</option>${options}`;

      $("#funcoes-filtro-tipo").html(base);
      $("#funcao-criar-tipo").html(baseModal);
      $("#funcao-editar-tipo").html(baseModal);
    },

    // --------------------------------------------------------------------------
    // Load data
    // --------------------------------------------------------------------------
    async loadData(pagina = 1) {
      this.showLoading();

      const filter = {};
      const formData = new FormData($("#form-funcoes-filtros")[0]);
      formData.forEach((value, key) => { if (value) filter[key] = value; });

      const { data, error } = await API.buscar(pagina, filter);

      if (error) {
        avisos(error, "", "error");
        this.hideLoading();
        return;
      }

      STATE.funcoes = data.funcoes || [];
      STATE.paginacao = {
        pagina: data.page || 1,
        limit: data.limit || 10,
        total: data.total || 0,
        totalPaginas: data.total_pages || 0,
      };

      this.renderTable();
      this.updatePagination();
      this.hideLoading();
    },

    async loadDeletados(pagina = 1) {
      const empresaId = $("#funcoes-filtro-empresa").val();
      const filter = empresaId ? { empresa_id: empresaId } : {};

      const { data, error } = await API.buscarDeletados(pagina, filter);

      if (error) { avisos(error, "", "error"); return; }

      STATE.funcoesDeletadas = data.funcoes || [];
      STATE.paginacaoDeletados = {
        pagina: data.page || 1,
        limit: data.limit || 10,
        total: data.total || 0,
        totalPaginas: data.total_pages || 0,
      };

      const colunas = [
        {
          label: "Nome / Descrição",
          value: "nome",
          format: (value, row) => `
            <div>
              <div class="font-semibold">${escapeHtml(value || "")}</div>
              <div class="text-xs text-base-content/60">${escapeHtml(row.descricao || "")}</div>
            </div>
          `,
        },
        {
          label: "Empresa",
          value: "empresa_id",
          format: (value) => nomeEmpresa(value),
        },
        {
          label: "Deletado em",
          value: "deleted_at",
          format: (value) => {
            if (!value) return "-";
            try {
              const d = new Date(value);
              return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
            } catch (e) { return value; }
          },
        },
        {
          label: "Ações",
          value: "id",
          format: (value) => `
            <button class="btn btn-success btn-xs"
              onclick="window.BashFuncoes.EVENTS.restaurarFuncao(${value})">
              <i class="fas fa-undo"></i> Restaurar
            </button>
          `,
        },
      ];

      if (STATE.componentes.tableDeletados) {
        STATE.componentes.tableDeletados.updateData(STATE.funcoesDeletadas);
      } else {
        STATE.componentes.tableDeletados = new BashTable({
          id: "tabela-funcoes-deletados",
          columns: colunas,
          data: STATE.funcoesDeletadas,
          classList: "table table-sm table-zebra w-full",
          emptyMessage: "Nenhuma função deletada.",
          container: "#funcoes-deletados-tabela-container",
        });
      }

      if (STATE.componentes.paginacaoDeletados) {
        STATE.componentes.paginacaoDeletados.update(
          STATE.paginacaoDeletados.pagina,
          STATE.paginacaoDeletados.total
        );
      } else {
        STATE.componentes.paginacaoDeletados = new BashPagination({
          id: "funcoes-deletados-pagination",
          pagina: STATE.paginacaoDeletados.pagina,
          total: STATE.paginacaoDeletados.total,
          limit: STATE.paginacaoDeletados.limit,
          container: "#funcoes-deletados-pagination-container",
          onNext: (p) => UI.loadDeletados(p),
          onPrev: (p) => UI.loadDeletados(p),
        });
      }
    },

    renderTable() {
      if (STATE.componentes.tabela) {
        STATE.componentes.tabela.updateData(STATE.funcoes);
      }
    },

    updatePagination() {
      if (STATE.componentes.paginacao) {
        STATE.componentes.paginacao.update(
          STATE.paginacao.pagina,
          STATE.paginacao.total
        );
      }
    },

    showLoading() {
      if (STATE.componentes.tabela) STATE.componentes.tabela.showLoading("Carregando...");
    },

    hideLoading() {
      if (STATE.componentes.tabela) STATE.componentes.tabela.hideLoading();
    },
  };

  // ============================================================================
  // EVENTS
  // ============================================================================
  const EVENTS = {
    async editarFuncao(id) {
      const funcao = STATE.funcoes.find((f) => f.id === id);
      if (!funcao) { avisos("Função não encontrada", "", "error"); return; }

      UI.popularSelectEmpresas("#funcao-editar-empresa", funcao.empresa_id);

      const $form = $("#form-editar-funcao");
      $form.find('[name="id"]').val(funcao.id);
      $form.find('[name="nome"]').val(funcao.nome || "");
      $form.find('[name="descricao"]').val(funcao.descricao || "");
      $form.find('[name="tipo_id"]').val(funcao.tipo_id || "");
      $form.find('[name="configuracao"]').val(prettyJson(funcao.configuracao));
      $form.find('[name="request_schema"]').val(prettyJson(funcao.request_schema));
      $form.find('[name="response_schema"]').val(prettyJson(funcao.response_schema));

      document.getElementById("funcoes-modal-editar").showModal();
    },

    deletarFuncao(id) {
      const funcao = STATE.funcoes.find((f) => f.id === id);
      if (!funcao) { avisos("Função não encontrada", "", "error"); return; }

      abrirModalConfirmacao({
        titulo: "Confirmar exclusão",
        mensagem: `Deseja deletar a função "${funcao.nome}"? Pode ser restaurada depois.`,
        labelConfirmar: "Deletar",
        labelCancelar: "Cancelar",
        tipo: "error",
        onConfirm: async () => {
          const { error } = await API.deletar(id);
          if (error) { avisos(error, "", "error"); return; }
          avisos("Função deletada com sucesso!", "", "success");
          await UI.loadData(STATE.paginacao.pagina);
        },
      });
    },

    restaurarFuncao(id) {
      abrirModalConfirmacao({
        titulo: "Confirmar restauração",
        mensagem: "Deseja restaurar esta função?",
        labelConfirmar: "Restaurar",
        labelCancelar: "Cancelar",
        tipo: "success",
        onConfirm: async () => {
          const { error } = await API.restaurar(id);
          if (error) { avisos(error, "", "error"); return; }

          avisos("Função restaurada com sucesso!", "", "success");
          await UI.loadDeletados(STATE.paginacaoDeletados.pagina);
          await UI.loadData(STATE.paginacao.pagina);

          if (STATE.funcoesDeletadas.length === 0) {
            document.getElementById("funcoes-modal-deletados").close();
          }
        },
      });
    },

    abrirModalCriar() {
      const $form = $("#form-criar-funcao");
      $form[0].reset();

      if (STATE.empresas.length > 0) {
        $form.find('[name="empresa_id"]').val(STATE.empresas[0].id);
      }

      document.getElementById("funcoes-modal-criar").showModal();
    },

    abrirModalDeletados() {
      document.getElementById("funcoes-modal-deletados").showModal();
      UI.loadDeletados(1);
    },

    abrirConfiguracoes(id) {
      const funcao = STATE.funcoes.find((f) => f.id === id);
      if (!funcao) { avisos("Função não encontrada", "", "error"); return; }

      const semDados = '<span class="text-base-content/40 italic">null</span>';

      $("#funcoes-config-titulo").text(`Configurações: ${funcao.nome}`);
      $("#funcoes-config-configuracao").html(
        funcao.configuracao ? escapeHtml(prettyJson(funcao.configuracao)) : semDados
      );
      $("#funcoes-config-request").html(
        funcao.request_schema ? escapeHtml(prettyJson(funcao.request_schema)) : semDados
      );
      $("#funcoes-config-response").html(
        funcao.response_schema ? escapeHtml(prettyJson(funcao.response_schema)) : semDados
      );

      document.getElementById("funcoes-modal-config").showModal();
    },
  };

  // ============================================================================
  // INIT
  // ============================================================================
  async function init() {
    console.debug("?? Inicializando módulo de Funções...");
    UI.init();
    setupEventListeners();
    await UI.carregarEmpresas();
    await UI.carregarTipos();
    await UI.loadData(1);
    console.debug("? Módulo de Funções inicializado");
  }

  function setupEventListeners() {
    $("#funcoes-btn-novo").on("click", () => EVENTS.abrirModalCriar());
    $("#funcoes-btn-deletados").on("click", () => EVENTS.abrirModalDeletados());

    $(document).on("change", "#funcoes-filtro-empresa", () => {
      UI.loadData(1);
    });
  }

  // ============================================================================
  // EXPORT
  // ============================================================================
  window.BashFuncoes = { init, API, UI, EVENTS, STATE };

  $(document).ready(() => { init(); });
})();
