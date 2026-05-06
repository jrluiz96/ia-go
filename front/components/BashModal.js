class BashModal extends HTMLElement {
  constructor() {
    super();
    this._id = this.getAttribute("id");
    this._titulo = this.getAttribute("titulo") || "Título";
    this._mensagem = this.getAttribute("mensagem") || "Mensagem do modal.";
    this._labelConfirmar = this.getAttribute("label-confirmar") || "Confirmar";
    this._labelCancelar = this.getAttribute("label-cancelar") || "Cancelar";
    this._onConfirm = () => {};
    this._onCancel = () => {};
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.innerHTML = `
      <dialog class="modal" id="modal-confirm">
        <div class="modal-box">
          <form method="dialog">
            <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 modal-close">✕</button>
          </form>

          <h3 class="text-lg font-bold" id="modal-title">${this._titulo}</h3>
          ${
            this.message
              ? `<p class="py-4" id="modal-message">${this._mensagem}</p>`
              : "<slot></slot>"
          }

          

          <div class="modal-action">
            <button class="btn btn-ghost modal-close">${
              this._labelCancelar
            }</button>
            <button class="btn btn-primary" id="modal-confirm-btn">${
              this._labelConfirmar
            }</button>
          </div>
        </div>
      </dialog>
    `;

    this.querySelectorAll(".modal-close").forEach((btn) => {
      btn.addEventListener("click", () => {
        this._onCancel();
        this.fechar();
      });
    });

    this.querySelector("#modal-confirm-btn").addEventListener("click", () => {
      this._onConfirm();
      this.fechar();
    });
  }

  abrir({
    titulo = this._titulo,
    mensagem = this._mensagem,
    confirmar = this._labelConfirmar,
    cancelar = this._labelCancelar,
    onConfirm = () => {},
    onCancel = () => {},
  } = {}) {
    this._titulo = titulo;
    this._mensagem = mensagem;
    this._labelConfirmar = confirmar;
    this._labelCancelar = cancelar;
    this._onConfirm = onConfirm;
    this._onCancel = onCancel;
    this.render();
    this.querySelector("dialog").showModal();
  }

  fechar() {
    this.querySelector("dialog").close();
  }
}

customElements.define("bash-modal", BashModal);
