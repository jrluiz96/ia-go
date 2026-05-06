(function () {
  const API = {
    baseUrl: "v1/admin/ia-prompt-regras",

    async buscar(pagina = 1, filter = {}) {
      try {
        console.debug("🔍 Buscando regras de prompt...", { pagina, filter });
        const url = `${this.baseUrl}?page=${pagina}&${new URLSearchParams(
          filter
        ).toString()}`;
        const response = await reqAsync(url, "GET");
        console.debug("✅ Regras carregadas:", response.data);
        return { data: response.data, error: null };
      } catch (error) {
        console.error("❌ Erro ao buscar regras:", error);
        return {
          data: null,
          error: error?.message || "Erro ao carregar regras",
        };
      }
    },

    async buscarDeletados(pagina = 1, filter = {}) {
      try {
        console.debug("🔍 Buscando regras deletadas...", { pagina, filter });
        const params = new URLSearchParams({ page: pagina, ...filter }).toString();
        const url = `${this.baseUrl}/deletados?${params}`;
        const response = await reqAsync(url, "GET");
        console.debug("✅ Regras deletadas carregadas:", response.data);
        return { data: response.data, error: null };
      } catch (error) {
        console.error("❌ Erro ao buscar regras deletadas:", error);
        return {
          data: null,
          error: error?.message || "Erro ao carregar regras deletadas",
        };
      }
    },

    async criar(payload) {
      try {
        console.debug("➕ Criando regra...", payload);
        const url = `${this.baseUrl}`;
        const response = await reqAsync(url, "POST", payload);
        console.debug("✅ Regra criada:", response.data);
        return { data: response.data, error: null };
      } catch (error) {
        console.error("❌ Erro ao criar regra:", error);
        return { data: null, error: error?.message || "Erro ao criar regra" };
      }
    },

    async atualizar(id, payload) {
      try {
        console.debug("✏️ Atualizando regra...", { id, payload });
        const url = `${this.baseUrl}/${id}`;
        const response = await reqAsync(url, "PUT", payload);
        console.debug("✅ Regra atualizada:", response.data);
        return { data: response.data, error: null };
      } catch (error) {
        console.error("❌ Erro ao atualizar regra:", error);
        return { data: null, error: error?.message || "Erro ao atualizar regra" };
      }
    },

    async deletar(id) {
      try {
        console.debug("🗑️ Deletando regra...", { id });
        const url = `${this.baseUrl}/${id}`;
        const response = await reqAsync(url, "DELETE");
        console.debug("✅ Regra deletada:", response.data);
        return { data: response.data, error: null };
      } catch (error) {
        console.error("❌ Erro ao deletar regra:", error);
        return {
          data: null,
          error: error?.message || "Erro ao deletar regra",
        };
      }
    },

    async restaurar(id) {
      try {
        console.debug("🔄 Restaurando regra...", { id });
        const url = `${this.baseUrl}/recuperar/${id}`;
        const response = await reqAsync(url, "PATCH");
        console.debug("✅ Regra restaurada:", response.data);
        return { data: response.data, error: null };
      } catch (error) {
        console.error("❌ Erro ao restaurar regra:", error);
        return {
          data: null,
          error: error?.message || "Erro ao restaurar regra",
        };
      }
    },

    async reordenar(regras) {
      try {
        console.debug("🔀 Reordenando regras...", regras);
        const url = `${this.baseUrl}/reordenar`;
        const response = await reqAsync(url, "PUT", { regras });
        console.debug("✅ Regras reordenadas:", response.data);
        return { data: response.data, error: null };
      } catch (error) {
        console.error("❌ Erro ao reordenar regras:", error);
        return {
          data: null,
          error: error?.message || "Erro ao reordenar regras",
        };
      }
    },
  };

  const STATE = {
    componentes: {
      tabela: null,
      paginacao: null,
      modalCriar: null,
      modalEditar: null,
      formCriar: null,
      formEditar: null,
      formFilters: null,
      modalDeletados: null,
      tableDeletados: null,
      paginacaoDeletados: null,
    },
    regras: [],
    regrasDeletadas: [],
    empresas: [],
    paginacao: {
      pagina: 1,
      limit: 10,
      total: 0,
      totalPaginas: 0,
    },
    paginacaoDeletados: {
      pagina: 1,
      limit: 10,
      total: 0,
      totalPaginas: 0,
    },
  };

  const UI = {
    init() {
      this.buildFormFilter();
      this.buildTable();
      this.buildPagination();
      this.buildModalCriar();
      this.buildModalEditar();
      this.buildModalDeletados();
    },

    buildFormFilter() {
      const html = `
        <form id="form-ia-prompt-regras-filtros" class="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div class="col-span-full md:col-span-6">
            <label class="label"><span class="label-text font-medium">Texto da Regra</span></label>
            <input name="regra_texto" type="text" class="input input-bordered w-full" placeholder="Buscar por texto...">
          </div>

          <div class="col-span-full md:col-span-3">
            <label class="label"><span class="label-text font-medium">Empresa</span></label>
            <select name="empresa_id" id="ia-prompt-regras-filtro-empresa" class="select select-bordered w-full">
              <option value="">Todas</option>
            </select>
          </div>

          <div class="col-span-full md:col-span-3">
            <label class="label"><span class="label-text font-medium">Status</span></label>
            <select name="ativo" class="select select-bordered w-full">
              <option value="">Todos</option>
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </select>
          </div>

          <div class="col-span-full md:col-span-3">
            <label class="label"><span class="label-text font-medium">Editável</span></label>
            <select name="editavel" class="select select-bordered w-full">
              <option value="">Todos</option>
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          </div>

          <div class="col-span-full flex justify-end gap-2">
            <button type="button" id="btn-limpar-filtros" class="btn btn-ghost">
              <i class="fa-solid fa-eraser"></i> Limpar
            </button>
            <button type="submit" class="btn btn-primary">
              <i class="fa-solid fa-filter"></i> Filtrar
            </button>
          </div>
        </form>
      `;

      $("#ia-prompt-regras-filtros").html(html);

      // Submit event
      $("#form-ia-prompt-regras-filtros").on("submit", (e) => {
        e.preventDefault();
        UI.loadData(1);
      });

      // Reset event
      $("#btn-limpar-filtros").on("click", function () {
        $("#form-ia-prompt-regras-filtros").trigger("reset");
        UI.loadData(1);
      });
    },

    buildTable() {
      const colunas = [
        {
          label: "Ordem",
          value: "ordem",
          format: (value) => `
            <div class="flex items-center gap-2">
              <span class="badge badge-primary">${value}</span>
              <div class="flex flex-col gap-1">
                <button class="btn btn-xs btn-ghost" onclick="window.BashIAPromptRegras.EVENTS.moverRegra(${value}, 'up')">
                  <i class="fa-solid fa-arrow-up"></i>
                </button>
                <button class="btn btn-xs btn-ghost" onclick="window.BashIAPromptRegras.EVENTS.moverRegra(${value}, 'down')">
                  <i class="fa-solid fa-arrow-down"></i>
                </button>
              </div>
            </div>
          `,
        },
        {
          label: "Regra",
          value: "regra_texto",
          format: (value) => {
            const truncated = value.length > 100 ? value.substring(0, 100) + "..." : value;
            return `<div class="tooltip" data-tip="${value.replace(/"/g, '&quot;')}">${truncated}</div>`;
          },
        },
        {
          label: "Empresa",
          value: "empresa_id",
          format: (value) => {
            if (!value) return '<span class="text-base-content/40">-</span>';
            const emp = STATE.empresas.find(e => e.id === value);
            return emp ? emp.nome : `#${value}`;
          },
        },
        {
          label: "Editável",
          value: "editavel",
          format: (value) => {
            const badge = value
              ? '<span class="badge badge-success">Sim</span>'
              : '<span class="badge badge-ghost">Não</span>';
            return badge;
          },
        },
        {
          label: "Status",
          value: "ativo",
          format: (value) => {
            const badge = value
              ? '<span class="badge badge-success">Ativo</span>'
              : '<span class="badge badge-error">Inativo</span>';
            return badge;
          },
        },
        {
          label: "Criado em",
          value: "created_at",
          format: (value) => formatarData(value),
        },
        {
          label: "Ações",
          value: "id",
          format: (value, row) => {
            const editBtn = row.editavel
              ? `<button class="btn btn-info btn-xs tooltip" data-tip="Editar" onclick="window.BashIAPromptRegras.EVENTS.editarRegra(${value})"><i class='fas fa-edit'></i></button>`
              : '';
            const toggleBtn = `<button class="btn ${row.ativo ? 'btn-warning' : 'btn-success'} btn-xs tooltip" data-tip="${row.ativo ? 'Desativar' : 'Ativar'}" onclick="window.BashIAPromptRegras.EVENTS.toggleRegra(${value}, ${!row.ativo})"><i class='fas fa-${row.ativo ? 'eye-slash' : 'eye'}'></i></button>`;
            const deleteBtn = row.editavel
              ? `<button class="btn btn-error btn-xs tooltip" data-tip="Remover" onclick="window.BashIAPromptRegras.EVENTS.deletarRegra(${value})"><i class='fas fa-trash'></i></button>`
              : '';
            return `<div class="flex gap-1">${editBtn} ${toggleBtn} ${deleteBtn}</div>`;
          },
        },
      ];

      const tabela = new BashTable({
        id: "tabela-ia-prompt-regras",
        columns: colunas,
        data: STATE.regras,
        classList: "table table-sm table-zebra w-full",
        emptyMessage: "Nenhuma regra encontrada.",
        container: "#ia-prompt-regras-tabela-container",
      });

      STATE.componentes.tabela = tabela;
      console.debug("✅ Tabela de regras criada");
    },

    buildPagination() {
      const paginacao = new BashPagination({
        id: "ia-prompt-regras-pagination",
        pagina: STATE.paginacao.pagina,
        total: STATE.paginacao.total,
        limit: STATE.paginacao.limit,
        container: "#ia-prompt-regras-pagination-container",
        onNext: (novaPagina) => {
          console.debug("📄 Próxima página:", novaPagina);
          this.nextPage(novaPagina);
        },
        onPrev: (novaPagina) => {
          console.debug("📄 Página anterior:", novaPagina);
          this.nextPage(novaPagina);
        },
      });

      STATE.componentes.paginacao = paginacao;
      console.debug("✅ Paginação criada");
    },

    nextPage(pagina) {
      STATE.paginacao.pagina = pagina;
      UI.loadData(pagina);
    },

    buildModalCriar() {
      const modalHtml = `
        <dialog id="ia-prompt-regras-modal-criar" class="modal">
          <div class="modal-box max-w-3xl">
            <form method="dialog">
              <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
            </form>
            <h3 class="font-bold text-lg mb-4">Nova Regra de Prompt</h3>
            
            <form id="form-criar-regra" class="grid grid-cols-12 gap-4">
              <div class="col-span-4">
                <label class="label"><span class="label-text font-medium">Ordem *</span></label>
                <input name="ordem" type="number" class="input input-bordered w-full" placeholder="0" required>
                <p class="text-xs mt-1 text-base-content/60">Ordem de execução (menor = maior prioridade)</p>
              </div>

              <div class="col-span-4">
                <label class="label"><span class="label-text font-medium">Ativo</span></label>
                <input name="ativo" type="checkbox" class="toggle toggle-success" checked>
              </div>

              <div class="col-span-4">
                <label class="label"><span class="label-text font-medium">Editável</span></label>
                <input name="editavel" type="checkbox" class="toggle toggle-info" checked>
              </div>

              <div class="col-span-6">
                <label class="label"><span class="label-text font-medium">Empresa</span></label>
                <select name="empresa_id" id="ia-prompt-criar-empresa" class="select select-bordered w-full">
                  <option value="">Selecione...</option>
                </select>
              </div>

              <div class="col-span-12">
                <label class="label"><span class="label-text font-medium">Texto da Regra *</span></label>
                <textarea name="regra_texto" class="textarea textarea-bordered w-full" rows="8" placeholder="Digite a regra que a IA deve seguir..." required></textarea>
                <p class="text-xs mt-1 text-base-content/60">Instruções claras e objetivas que orientam o comportamento da IA</p>
              </div>

              <div class="col-span-12 flex justify-end gap-2 mt-4">
                <button type="button" class="btn btn-ghost" onclick="document.getElementById('ia-prompt-regras-modal-criar').close()">Cancelar</button>
                <button type="submit" class="btn btn-primary">
                  <i class="fa-solid fa-save"></i> Criar Regra
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" class="modal-backdrop">
            <button>close</button>
          </form>
        </dialog>
      `;

      $("#ia-prompt-regras-modal-container").append(modalHtml);

      // Event listener para submit
      $("#form-criar-regra").on("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
          ordem: parseInt(formData.get("ordem")),
          regra_texto: formData.get("regra_texto"),
          ativo: formData.get("ativo") ? true : false,
          editavel: formData.get("editavel") ? true : false,
          empresa_id: formData.get("empresa_id") ? parseInt(formData.get("empresa_id")) : null,
        };

        console.debug("📝 Criando regra:", data);
        const { data: response, error } = await API.criar(data);

        if (error) {
          avisos(error, "", "error");
          return;
        }

        avisos("Regra criada com sucesso!", "", "success");
        document.getElementById("ia-prompt-regras-modal-criar").close();
        e.target.reset();
        await UI.loadData(STATE.paginacao.pagina);
      });
    },

    buildModalEditar() {
      const modalHtml = `
        <dialog id="ia-prompt-regras-modal-editar" class="modal">
          <div class="modal-box max-w-3xl">
            <form method="dialog">
              <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
            </form>
            <h3 class="font-bold text-lg mb-4">Editar Regra de Prompt</h3>
            
            <form id="form-editar-regra" class="grid grid-cols-12 gap-4">
              <input type="hidden" name="id">
              
              <div class="col-span-4">
                <label class="label"><span class="label-text font-medium">Ordem *</span></label>
                <input name="ordem" type="number" class="input input-bordered w-full" placeholder="0" required>
                <p class="text-xs mt-1 text-base-content/60">Ordem de execução</p>
              </div>

              <div class="col-span-4">
                <label class="label"><span class="label-text font-medium">Ativo</span></label>
                <input name="ativo" type="checkbox" class="toggle toggle-success">
              </div>

              <div class="col-span-4">
                <label class="label"><span class="label-text font-medium">Editável</span></label>
                <input name="editavel" type="checkbox" class="toggle toggle-info">
              </div>

              <div class="col-span-6">
                <label class="label"><span class="label-text font-medium">Empresa</span></label>
                <select name="empresa_id" id="ia-prompt-editar-empresa" class="select select-bordered w-full">
                  <option value="">Selecione...</option>
                </select>
              </div>

              <div class="col-span-12">
                <label class="label"><span class="label-text font-medium">Texto da Regra *</span></label>
                <textarea name="regra_texto" class="textarea textarea-bordered w-full" rows="8" placeholder="Digite a regra..." required></textarea>
              </div>

              <div class="col-span-12 flex justify-end gap-2 mt-4">
                <button type="button" class="btn btn-ghost" onclick="document.getElementById('ia-prompt-regras-modal-editar').close()">Cancelar</button>
                <button type="submit" class="btn btn-primary">
                  <i class="fa-solid fa-save"></i> Salvar Alterações
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" class="modal-backdrop">
            <button>close</button>
          </form>
        </dialog>
      `;

      $("#ia-prompt-regras-modal-container").append(modalHtml);

      // Event listener para submit
      $("#form-editar-regra").on("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const regraId = formData.get("id");
        const data = {
          ordem: parseInt(formData.get("ordem")),
          regra_texto: formData.get("regra_texto"),
          ativo: formData.get("ativo") ? true : false,
          editavel: formData.get("editavel") ? true : false,
          empresa_id: formData.get("empresa_id") ? parseInt(formData.get("empresa_id")) : null,
        };

        console.debug("✏️ Atualizando regra:", { id: regraId, data });

        const { data: response, error } = await API.atualizar(regraId, data);

        if (error) {
          avisos(error, "", "error");
          return;
        }

        avisos("Regra atualizada com sucesso!", "", "success");
        document.getElementById("ia-prompt-regras-modal-editar").close();
        await UI.loadData(STATE.paginacao.pagina);
      });
    },

    buildModalDeletados() {
      const modalHtml = `
        <dialog id="ia-prompt-regras-modal-deletados" class="modal">
          <div class="modal-box max-w-5xl">
            <form method="dialog">
              <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
            </form>
            <h3 class="font-bold text-lg mb-4">Regras Deletadas</h3>
            
            <div id="ia-prompt-regras-deletados-table-container"></div>
            <div id="ia-prompt-regras-deletados-pagination-container"></div>
          </div>
          <form method="dialog" class="modal-backdrop">
            <button>close</button>
          </form>
        </dialog>
      `;

      $("#ia-prompt-regras-modal-container").append(modalHtml);

      // Criar tabela
      const colunas = [
        {
          label: "Ordem",
          value: "ordem",
          format: (value) => `<span class="badge badge-ghost">${value}</span>`,
        },
        {
          label: "Regra",
          value: "regra_texto",
          format: (value) => {
            const truncated = value.length > 80 ? value.substring(0, 80) + "..." : value;
            return truncated;
          },
        },
        {
          label: "Deletado em",
          value: "deleted_at",
          format: (value) => formatarData(value),
        },
        {
          label: "Ações",
          value: "id",
          format: (value) => {
            return `<button class="btn btn-warning btn-xs tooltip" data-tip="Restaurar" onclick="window.BashIAPromptRegras.EVENTS.restaurarRegra(${value})"><i class='fas fa-undo'></i> Restaurar</button>`;
          },
        },
      ];

      const table = new BashTable({
        id: "tabela-regras-deletadas",
        columns: colunas,
        data: [],
        emptyMessage: "Nenhuma regra deletada encontrada.",
        container: "#ia-prompt-regras-deletados-table-container",
      });

      const paginacao = new BashPagination({
        id: "ia-prompt-regras-deletados-pagination",
        container: "#ia-prompt-regras-deletados-pagination-container",
        total: 0,
        limit: 10,
        onNext: (novaPagina) => {
          UI.loadDeletados(novaPagina);
        },
        onPrev: (novaPagina) => {
          UI.loadDeletados(novaPagina);
        },
      });

      STATE.componentes.tableDeletados = table;
      STATE.componentes.paginacaoDeletados = paginacao;
    },

    async loadData(pagina = 1) {
      console.debug(`🌐 Carregando dados da página ${pagina}...`);

      this.showLoading("Carregando regras...");

      let $form = $("#form-ia-prompt-regras-filtros");
      const filter = {
        regra_texto: $form.find('[name="regra_texto"]').val().trim() || "",
        ativo: $form.find('[name="ativo"]').val() || "",
        editavel: $form.find('[name="editavel"]').val() || "",
        empresa_id: $form.find('[name="empresa_id"]').val() || "",
      };

      const { data, error } = await API.buscar(pagina, filter);

      if (error) {
        console.error(`Erro ao carregar regras: ${error}`);
        table.hideLoading();
        avisos(error, "", "error");
        return;
      }

      STATE.regras = data.data || [];
      STATE.paginacao.total = data.total || 0;
      STATE.paginacao.pagina = pagina;
      STATE.paginacao.totalPaginas = Math.ceil(
        data.total / STATE.paginacao.limit
      );

      this.renderTable();
      this.updatePagination();
      this.hideLoading();

      console.debug(`✅ Dados carregados: ${STATE.regras.length} regras`);
    },

    async loadDeletados(pagina = 1) {
      const table = STATE.componentes.tableDeletados;
      const pagination = STATE.componentes.paginacaoDeletados;

      table.showLoading("Carregando regras deletadas...");

      const empresaId = $("#form-ia-prompt-regras-filtros").find('[name="empresa_id"]').val();
      const filter = empresaId ? { empresa_id: empresaId } : {};

      const { data, error } = await API.buscarDeletados(pagina, filter);

      if (error) {
        console.error(`Erro ao carregar regras deletadas: ${error}`);
        table.hideLoading();
        avisos(error, "", "error");
        return;
      }

      console.debug("📊 Dados deletados recebidos:", data);

      STATE.regrasDeletadas = data.data || [];
      STATE.paginacaoDeletados.total = data.total || 0;
      STATE.paginacaoDeletados.pagina = pagina;
      STATE.paginacaoDeletados.totalPaginas = Math.ceil(
        data.total / STATE.paginacaoDeletados.limit
      );

      console.debug("📊 STATE deletados atualizado:", {
        total: STATE.paginacaoDeletados.total,
        pagina: STATE.paginacaoDeletados.pagina,
        registros: STATE.regrasDeletadas.length,
      });

      table.updateData(STATE.regrasDeletadas);
      pagination.update(
        data.total,
        STATE.paginacaoDeletados.limit,
        pagina
      );

      table.hideLoading();
    },

    renderTable() {
      if (STATE.componentes.tabela) {
        STATE.componentes.tabela.updateData(STATE.regras);
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

    showLoading(message = "Carregando...") {
      if (STATE.componentes.tabela) {
        STATE.componentes.tabela.showLoading(message);
      }
    },

    hideLoading() {
      if (STATE.componentes.tabela) {
        STATE.componentes.tabela.hideLoading();
      }
    },
  };

  const EVENTS = {
    async editarRegra(id) {
      const regra = STATE.regras.find((r) => r.id === id);
      if (!regra) {
        avisos("Regra não encontrada", "", "error");
        return;
      }

      if (!regra.editavel) {
        avisos("Esta regra não pode ser editada", "", "warning");
        return;
      }

      // Preencher formulário
      const $form = $("#form-editar-regra");
      $form.find('[name="id"]').val(regra.id);
      $form.find('[name="ordem"]').val(regra.ordem);
      $form.find('[name="regra_texto"]').val(regra.regra_texto);
      $form.find('[name="ativo"]').prop("checked", regra.ativo);
      $form.find('[name="editavel"]').prop("checked", regra.editavel);
      $form.find('[name="empresa_id"]').val(regra.empresa_id || '');

      document.getElementById("ia-prompt-regras-modal-editar").showModal();
    },

    deletarRegra(id) {
      const regra = STATE.regras.find((r) => r.id === id);
      if (!regra) {
        avisos("Regra não encontrada", "", "error");
        return;
      }

      if (!regra.editavel) {
        avisos("Esta regra não pode ser deletada", "", "warning");
        return;
      }

      abrirModalConfirmacao({
        titulo: "Confirmar exclusão",
        mensagem: "Tem certeza que deseja deletar esta regra? Esta ação pode ser desfeita através do menu 'Regras Deletadas'.",
        labelConfirmar: "Deletar",
        labelCancelar: "Cancelar",
        tipo: "error",
        onConfirm: async () => {
          const { data, error } = await API.deletar(id);

          if (error) {
            avisos(error, "", "error");
            return;
          }

          avisos("Regra deletada com sucesso!", "", "success");
          await UI.loadData(STATE.paginacao.pagina);
        },
      });
    },

    async toggleRegra(id, novoStatus) {
      const regra = STATE.regras.find((r) => r.id === id);
      if (!regra) {
        avisos("Regra não encontrada", "", "error");
        return;
      }

      const { data, error } = await API.atualizar(id, {
        ...regra,
        ativo: novoStatus,
      });

      if (error) {
        avisos(error, "", "error");
        return;
      }

      avisos(
        `Regra ${novoStatus ? "ativada" : "desativada"} com sucesso!`,
        "",
        "success"
      );
      await UI.loadData(STATE.paginacao.pagina);
    },

    restaurarRegra(id) {
      abrirModalConfirmacao({
        titulo: "Confirmar restauração",
        mensagem: "Deseja restaurar esta regra?",
        labelConfirmar: "Restaurar",
        labelCancelar: "Cancelar",
        tipo: "success",
        onConfirm: async () => {
          const { data, error } = await API.restaurar(id);

          if (error) {
            avisos(error, "", "error");
            return;
          }

          avisos("Regra restaurada com sucesso!", "", "success");
          
          // Recarrega a lista de deletados
          await UI.loadDeletados(STATE.paginacaoDeletados.pagina);
          
          // Recarrega a lista principal
          await UI.loadData(STATE.paginacao.pagina);
          
          // Fecha o modal se não houver mais regras deletadas
          if (STATE.regrasDeletadas.length === 0) {
            document.getElementById("ia-prompt-regras-modal-deletados").close();
          }
        },
      });
    },

    async moverRegra(ordem, direcao) {
      const index = STATE.regras.findIndex((r) => r.ordem === ordem);
      if (index === -1) {
        avisos("Regra não encontrada", "", "error");
        return;
      }

      const novaOrdem = direcao === "up" ? ordem - 1 : ordem + 1;
      
      if (novaOrdem < 0 || novaOrdem >= STATE.regras.length) {
        avisos("Não é possível mover a regra nesta direção", "", "warning");
        return;
      }

      // Encontrar a regra que está na posição de destino
      const regraDestino = STATE.regras.find((r) => r.ordem === novaOrdem);
      const regraOrigem = STATE.regras[index];

      if (!regraDestino) {
        avisos("Posição de destino não encontrada", "", "error");
        return;
      }

      // Preparar array de reordenação
      const regrasReordenadas = [
        { id: regraOrigem.id, ordem: novaOrdem },
        { id: regraDestino.id, ordem: ordem },
      ];

      const { error } = await API.reordenar(regrasReordenadas);

      if (error) {
        avisos(error, "", "error");
        return;
      }

      avisos("Regras reordenadas com sucesso!", "", "success");
      await UI.loadData(STATE.paginacao.pagina);
    },

    abrirModalCriar() {
      // Buscar a próxima ordem disponível
      const proximaOrdem = STATE.regras.length > 0 
        ? Math.max(...STATE.regras.map(r => r.ordem)) + 1 
        : 0;
      
      const $form = $("#form-criar-regra");
      $form[0].reset();
      $form.find('[name="ordem"]').val(proximaOrdem);
      $form.find('[name="ativo"]').prop("checked", true);
      $form.find('[name="editavel"]').prop("checked", true);

      document.getElementById("ia-prompt-regras-modal-criar").showModal();
    },

    abrirModalDeletados() {
      UI.loadDeletados(1);
      document.getElementById("ia-prompt-regras-modal-deletados").showModal();
    },
  };

  function init() {
    console.debug("🚀 Inicializando módulo de Regras de Prompt da IA...");
    UI.init();
    UI.loadData(1);
    loadEmpresas();
    setupEventListeners();
    console.debug('✅ Módulo de Regras de Prompt da IA inicializado');
  }

  function loadEmpresas() {
    req('v1/admin/options/empresas', 'GET', null,
      function(response) {
        if (response && response.code === 200 && response.data) {
          STATE.empresas = response.data || [];
          const options = '<option value="">Todas</option>' +
            STATE.empresas.map(e => `<option value="${e.id}">${e.nome}</option>`).join('');
          const modalOpts = '<option value="">Selecione...</option>' +
            STATE.empresas.map(e => `<option value="${e.id}">${e.nome}</option>`).join('');
          $('#ia-prompt-regras-filtro-empresa').html(options);
          $('#ia-prompt-criar-empresa').html(modalOpts);
          $('#ia-prompt-editar-empresa').html(modalOpts);
        }
      },
      function(error) { console.error('Erro ao carregar empresas:', error); }
    );
  }

  function setupEventListeners() {
    $("#ia-prompt-regras-btn-novo").on("click", () => EVENTS.abrirModalCriar());
    $("#ia-prompt-regras-btn-deletados").on("click", () =>
      EVENTS.abrirModalDeletados()
    );
  }

  // Exportar para uso global
  window.BashIAPromptRegras = {
    init,
    API,
    UI,
    EVENTS,
    STATE,
  };

  // Auto-inicializar quando o DOM estiver pronto
  $(document).ready(() => {
    init();
  });
})();
