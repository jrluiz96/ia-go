// class PaginacaoDinamica extends HTMLElement {
//   constructor() {
//     super();
//     this.attachShadow({ mode: "open" });
//     this.wrapper = document.createElement("div");
//     this.wrapper.className = "join";
//     this.shadowRoot.appendChild(this.wrapper);

//     // propriedades reativas
//     this.page = 1;
//     this.limit = 10;
//     this.quantidade = 0;
//     this.onChange = () => {};
//   }

//   connectedCallback() {
//     this.render();
//   }

//   setPage(page) {
//     const totalPages = this.getTotalPages();
//     this.page = Math.max(1, Math.min(page, totalPages));
//     this.render();
//     this.onChange(this.page);
//   }

//   setLimit(limit) {
//     this.limit = parseInt(limit) || 10;
//     this.setPage(1);
//   }

//   setQuantidade(qtd) {
//     this.quantidade = parseInt(qtd) || 0;
//     this.setPage(1);
//   }

//   nextPage() {
//     this.setPage(this.page + 1);
//   }

//   previousPage() {
//     this.setPage(this.page - 1);
//   }

//   getPage() {
//     return this.page;
//   }

//   getTotalPages() {
//     return Math.ceil(this.quantidade / this.limit) || 1;
//   }

//   setOnChange(fn) {
//     this.onChange = fn;
//   }

//   render() {w
//     this.wrapper.innerHTML = "";
//     const totalPages = this.getTotalPages();

//     const createButton = (text, page, disabled = false, isCurrent = false) => {
//       const btn = document.createElement("button");
//       btn.textContent = text;
//       btn.className = `join-item btn btn-sm ${isCurrent ? "btn-active" : ""}`;
//       btn.disabled = disabled;
//       btn.onclick = () => this.setPage(page);
//       return btn;
//     };

//     // « Previous
//     this.wrapper.appendChild(createButton("«", this.page - 1, this.page <= 1));

//     // Numbered buttons (máximo de 5 páginas visíveis)
//     const range = this.getPageRange(this.page, totalPages);
//     range.forEach((p) => {
//       this.wrapper.appendChild(createButton(p, p, false, this.page === p));
//     });

//     // » Next
//     this.wrapper.appendChild(
//       createButton("»", this.page + 1, this.page >= totalPages)
//     );
//   }

//   getPageRange(current, total) {
//     const delta = 2;
//     const start = Math.max(1, current - delta);
//     const end = Math.min(total, current + delta);
//     const range = [];
//     for (let i = start; i <= end; i++) {
//       range.push(i);
//     }
//     return range;
//   }
// }

// customElements.define("bash-pagination", PaginacaoDinamica);

class PaginacaoDinamica extends HTMLElement {
  constructor() {
    super();
    this.page = 1;
    this.limit = 10;
    this.quantidade = 0;
    this.onChange = () => {};
  }

  connectedCallback() {
    this.render();
  }

  setPage(page) {
    const totalPages = this.getTotalPages();
    this.page = Math.max(1, Math.min(page, totalPages));
    this.render();
    this.onChange(this.page);
  }

  getPage() {
    return this.page;
  }

  setLimit(limit) {
    this.limit = parseInt(limit) || 10;
    this.setPage(1);
  }

  setQuantidade(qtd) {
    this.quantidade = parseInt(qtd) || 0;
    this.setPage(1);
  }

  nextPage() {
    this.setPage(this.page + 1);
  }

  previousPage() {
    this.setPage(this.page - 1);
  }

  getTotalPages() {
    return Math.ceil(this.quantidade / this.limit) || 1;
  }

  setOnChange(fn) {
    this.onChange = fn;
  }

  render() {
    this.innerHTML = ""; // limpa conteúdo anterior
    const totalPages = this.getTotalPages();

    const wrapper = document.createElement("div");
    wrapper.className = "join";

    const createButton = (text, page, disabled = false, isCurrent = false) => {
      const btn = document.createElement("button");
      btn.textContent = text;
      btn.className = `join-item btn btn-sm ${isCurrent ? "btn-active" : ""}`;
      btn.disabled = disabled;
      btn.onclick = () => this.setPage(page);
      return btn;
    };

    // « Botão anterior
    wrapper.appendChild(createButton("«", this.page - 1, this.page <= 1));

    // Números de página (máximo de 5)
    const range = this.getPageRange(this.page, totalPages);
    range.forEach((p) => {
      wrapper.appendChild(createButton(p, p, false, this.page === p));
    });

    // » Botão próximo
    wrapper.appendChild(
      createButton("»", this.page + 1, this.page >= totalPages)
    );

    this.appendChild(wrapper);
  }

  getPageRange(current, total) {
    const delta = 2;
    const start = Math.max(1, current - delta);
    const end = Math.min(total, current + delta);
    const range = [];
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  }
}

customElements.define("bash-pagination", PaginacaoDinamica);
