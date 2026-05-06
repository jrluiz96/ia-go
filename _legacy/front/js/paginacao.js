// Declarar BashPagination no escopo global
if (typeof BashPagination === 'undefined') {
  var BashPagination = class {
    constructor({
      id = "paginacao",
      pagina = 1,
      total = 0,
      limit = 10,
      onNext = () => {},
      onPrev = () => {},
      container = null,
    }) {
    this.id = id;
    this.pagina = pagina;
    this.total = total;
    this.limit = limit;
    this.onNext = onNext;
    this.onPrev = onPrev;

    this.$element = this._render();
    this._bindEvents();
    this._updateUI();

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
    $target.append(this.$element);

    return this;
  }

  _render() {
    return $(`
      <div id="${this.id}" class="flex justify-between items-center mt-2 pb-4 px-4 mr-10">
        <div>
          Quantidade de Registros: <span class="quantidade-total">0</span>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn btn-sm tooltip btn-anterior" data-tip="Anterior">
            <i class="fa-solid fa-circle-arrow-left"></i>
          </button>
          <span class="font-semibold pagina-atual">1</span>
          <button class="btn btn-sm tooltip btn-proximo" data-tip="Próximo">
            <i class="fa-solid fa-circle-arrow-right"></i>
          </button>
        </div>
      </div>
    `);
  }

  _bindEvents() {
    this.$element.find(".btn-proximo").on("click", () => {
      const totalPaginas = Math.ceil(this.total / this.limit);
      if (this.pagina < totalPaginas) {
        this.pagina++;
        this._updateUI();
        this.onNext(this.pagina);
      } else {
        avisos?.("", "Sem mais registros");
      }
    });

    this.$element.find(".btn-anterior").on("click", () => {
      if (this.pagina > 1) {
        this.pagina--;
        this._updateUI();
        this.onPrev(this.pagina);
      } else {
        avisos?.("", "Sem mais registros");
      }
    });
  }

  _updateUI() {
    this.$element.find(".pagina-atual").text(this.pagina);
    this.$element.find(".quantidade-total").text(this.total);
  }

  update(pagina = 1, total = 0) {
    this.pagina = pagina;
    this.total = total;
    this._updateUI();
  }

  getPagina() {
    return this.pagina;
  }

  getTotal() {
    return this.total;
  }

  getElement() {
    return this.$element;
  }
  };
}
