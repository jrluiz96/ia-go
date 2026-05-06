class BashTable {
  constructor({
    id = "bash-table",
    columns = [],
    data = [],
    classList = "table table-sm table-zebra w-full",
    emptyMessage = "Nenhum registro encontrado.",
    container = null,
  }) {
    this.id = id;
    this.columns = columns;
    this.data = data;
    this.classList = classList;
    this.emptyMessage = emptyMessage;

    this.$table = this._renderTable();

    if (container) {
      this.appendToContainer(container);
    }
  }

  appendToContainer(container = null) {
    const targetContainer = container || this.container;

    if (!targetContainer) {
      console.warn("Nenhum container especificado para anexar a tabela");
      return this;
    }

    let $target;

    // Verificar se é string (seletor), elemento DOM ou objeto jQuery
    if (typeof targetContainer === "string") {
      $target = $(targetContainer);
    } else if (targetContainer instanceof jQuery) {
      $target = targetContainer;
    } else if (targetContainer instanceof HTMLElement) {
      $target = $(targetContainer);
    } else {
      console.error("Tipo de container inválido:", targetContainer);
      return this;
    }

    if ($target.length === 0) {
      console.error("Container não encontrado:", targetContainer);
      return this;
    }

    // Anexar a tabela ao container
    $target.append(this.$table);

    return this;
  }

  _renderTable() {
    const $table = $("<table>").addClass(this.classList).attr("id", this.id);

    const $thead = $("<thead>");
    const $headerRow = $("<tr>");
    this.columns.forEach((col) => {
      const $th = $("<th>");
      if (col.title) {
        const $span = $("<span>")
          .addClass('tooltip tooltip-bottom cursor-help')
          .attr('data-tip', col.title)
          .text(col.label || col.name);
        $th.append($span);
      } else {
        $th.text(col.label || col.name);
      }
      $headerRow.append($th);
    });
    $thead.append($headerRow);

    const $tbody = this._renderBody();

    $table.append($thead).append($tbody);
    return $table;
  }

  _renderBody() {
    const $tbody = $("<tbody>");

    if (!this.data || this.data.length === 0) {
      const $emptyRow = $("<tr>");
      const $td = $("<td>")
        .attr("colspan", this.columns.length)
        .addClass("text-center italic text-gray-400 py-2")
        .text(this.emptyMessage);

      $emptyRow.append($td);
      $tbody.append($emptyRow);
      return $tbody;
    }

    this.data.forEach((item) => {
      const $row = $("<tr>");
      this.columns.forEach((col) => {
        const rawValue = item[col.value];

        const value =
          typeof col.format === "function"
            ? col.format(rawValue, item)
            : rawValue;

        $row.append($("<td>").html(value));
      });
      $tbody.append($row);
    });

    return $tbody;
  }

  getElement() {
    return this.$table;
  }

  updateData(novosDados = []) {
    this.data = novosDados;
    this.$table.find("tbody").replaceWith(this._renderBody());
  }

  updateColumns(novasColunas = []) {
    this.columns = novasColunas;
    this.$table.remove();
    this.$table = this._renderTable();
  }

  addColumn(novaColuna) {
    if (!novaColuna || typeof novaColuna !== "object") return;

    this.columns.push(novaColuna);

    // Recria a tabela completa com as colunas + dados atuais
    const $novaTabela = this._renderTable();

    this.$table.replaceWith($novaTabela);
    this.$table = $novaTabela;
  }

  showLoading(message = "Carregando...") {
    const $tbody = this.$table.find("tbody");
    const $loadingRow = $("<tr>");
    const $td = $("<td>")
      .attr("colspan", this.columns.length)
      .addClass("text-center py-8")
      .html(`
        <div class="flex items-center justify-center space-x-2">
          <div class="loading loading-spinner loading-sm"></div>
          <span class="text-gray-500">${message}</span>
        </div>
      `);

    $loadingRow.append($td);
    $tbody.empty().append($loadingRow);

    return this;
  }

  hideLoading() {
    // Remove o estado de loading e restaura os dados
    this.$table.find("tbody").replaceWith(this._renderBody());
    return this;
  }

  isLoading() {
    // Verifica se a tabela está em estado de loading
    return this.$table.find("tbody .loading").length > 0;
  }

  async loadData(dataPromise, loadingMessage = "Carregando dados...") {
    try {
      this.showLoading(loadingMessage);

      const novosDados = await dataPromise;
      this.updateData(novosDados);

      return novosDados;
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      this.showError("Erro ao carregar dados");
      throw error;
    }
  }

  showError(message = "Erro ao carregar dados") {
    const $tbody = this.$table.find("tbody");
    const $errorRow = $("<tr>");
    const $td = $("<td>")
      .attr("colspan", this.columns.length)
      .addClass("text-center py-8 text-error")
      .html(`
        <div class="flex items-center justify-center space-x-2">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
          </svg>
          <span>${message}</span>
        </div>
      `);

    $errorRow.append($td);
    $tbody.empty().append($errorRow);

    return this;
  }
}
