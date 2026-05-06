class BashButton extends HTMLElement {
  constructor() {
    super();

    // atributos
    this._label = this.getAttribute("label") || "";
    this._cor = this.getAttribute("cor") || "primary";
    this._icone = this.getAttribute("icone") || "";
    this._class = this.getAttribute("class") || "";
    this._disabled = this.getAttribute("disabled") || true;
    this._callback = this.getAttribute("onClick"); // será atribuído via setOnClick()
  }

  connectedCallback() {
    this.render();
  }

  render() {
    // cria o botão internamente
    this.innerHTML = `
      <button class="btn btn-${this._cor} gap-2 ${this._class}" >
        ${this._icone ? `<i class="${this._icone}"></i>` : ""}
        <span>${this._label} <slot></slot></span>
      </button>
    `;

    // adiciona evento onclick, se houver
    this.querySelector("button").onclick = () => {
      if (typeof this._callback === "function") {
        this._callback();
      }
    };
  }

  // Métodos públicos
  setLabel(novoTexto) {
    this._label = novoTexto;
    this.render();
  }

  getLabel() {
    return this._label;
  }

  toggleDisabled(toggle) {
    this._disabled = toogle !== undefined ? toggle : !this._disabled;
    this.render();
  }

  setCor(novaCor) {
    this._cor = novaCor;
    this.render();
  }

  setOnClick(funcao) {
    this._callback = funcao;
    this.render();
  }

  getButtonElement() {
    return this.querySelector("button");
  }
}

customElements.define("bash-button", BashButton);
