class BashField extends HTMLElement {
  constructor() {
    super();
    this._type = this.getAttribute("type") || "text"; // text, select
    this._name = this.getAttribute("name") || "";
    this._label = this.getAttribute("label") || "";
    this._id = this.getAttribute("id") || "";
    this._valueOption = this.getAttribute("valueOption");
    this._labelOption = this.getAttribute("labelOption");
    this._options = []; // para select
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const isSelect = this._type === "select";
    const inputElement = isSelect
      ? `<select class="select select-bordered w-full pt-4" ${
          this._id ? `id="${this._id}"` : ""
        } ${this._name ? `name="${this._name}"` : ""}>
            ${this._options
              .map(
                (opt) => `<option value="${opt.value}">${opt.label}</option>`
              )
              .join("")}
         </select>`
      : `<input type="${this._type}" class="input input-bordered w-full pt-4" ${
          this._id ? `id="${this._id}"` : ""
        } ${this._name ? `name="${this._name}"` : ""}/>`;

    this.innerHTML = `
      <div class="relative w-full">
        ${inputElement}
        <label class="absolute left-4 top-2 text-xs text-gray-500">${this._label}</label>
      </div>
    `;
  }

  getInput() {
    return this.querySelector("input, select");
  }

  getValue() {
    return this.getInput()?.value || "";
  }

  setValue(value) {
    const el = this.getInput();
    if (el) el.value = value;
  }

  setOptions(dados, campoLabel, campoValue) {
    if (this._type !== "select") return;

    let lista = [];
    if (Array.isArray(dados)) {
      lista = dados;
    } else if (typeof dados === "object" && dados !== null) {
      lista = Object.values(dados);
    } else {
      console.warn("Dados para setOptions não são válidos:", dados);
      return;
    }

    this._options = lista.map((item) => ({
      label: item[campoLabel],
      value: campoValue ? item[campoValue] : item,
    }));

    this.render();
  }

  getVariable() {
    return this._name:[...this._selected];
  }


  /** Eventos */
  onChange(fn) {
    const el = this.getInput();
    if (el) el.onchange = fn;
  }

  onClick(fn) {
    const el = this.getInput();
    if (el) el.onclick = fn;
  }

  onKeyUp(fn) {
    const el = this.getInput();
    if (el) el.onkeyup = fn;
  }
}

customElements.define("bash-field", BashField);
