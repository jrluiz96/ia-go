// Declarar BashModal no escopo global
if (typeof BashModal === 'undefined') {
  var BashModal = class {
    constructor({
      id,
      classSize = "",
      container = null,
      classList = "",
      deleteMode = false,
      titulo,
      mensagem,
      destroy = false,
      onDelete = () => {},
      onCancel = () => {},
      onClose = () => {},
    }) {
    this.id = id;
    this.classList = classList;
    this.classSize = classSize;
    this.deleteMode = deleteMode;
    this.onDelete = onDelete;
    this.onCancel = onCancel;
    this.onClose = onClose;
    this.titulo = titulo;
    this.destroyOnClose = destroy;
    this.mensagem = mensagem;
    this.$dialog = null;
    this.container = container;
    this.build();

    if (container) {
      this.appendToContainer(container);
    }
  }

  appendToContainer(container = null) {
    const targetContainer = container || this.container;

    if (!targetContainer) {
      console.warn("Nenhum container especificado para anexar o modal");
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

    // Anexar o modal ao container
    $target.append(this.$dialog);

    return this;
  }

  build() {
    // Criar estrutura usando jQuery
    const $dialog = $("<dialog>", {
      id: this.id,
      class: `modal`,
    });

    const $modalBox = $("<div>", { class: `modal-box ${this.classSize}` });
    const $form = $("<form>", { method: "dialog" });

    const $closeBtn = $("<button>", {
      type: "button",
      class:
        "btn btn-sm btn-circle btn-ghost absolute right-2 top-2 modal-close-btn",
      text: "✕",
    });

    const $title = $("<h3>", {
      id: `${this.id}-titulo`,
      class: "text-lg font-bold",
    });
    $title.text(this.titulo);

    const $message = $("<p>", {
      id: `${this.id}-mensagem`,
      class: "py-4 text-base",
    });
    $message.text(this.mensagem);

    const $action = $("<div>", {
      id: `${this.id}-action`,
      class: `modal-action gap-2 ${this.classList ? this.classList : "block"}`,
    });

    // Montar estrutura
    $form.append($closeBtn);
    $modalBox.append($form, $title, $message, $action);
    $dialog.append($modalBox);

    // Adicionar ao DOM

    // Armazenar referência
    this.$title = $title;
    this.$message = $message;
    this.$closeBtn = $closeBtn;
    this.$dialog = $dialog;

    // Configurar eventos
    this.setupEvents();

    // Se for modal de delete, adicionar os botões padrão
    if (this.deleteMode) {
      $title.text(this.titulo || "Remover");
      $message.text(this.mensagem || "Tem certeza que você quer remover?");
      this.addDeleteButtons();
    }
  }

  setupEvents() {
    // Armazenar referência das funções para poder remover depois
    this._closeHandler = (e) => {
      e.stopPropagation();
      this.close();
    };

    this._backdropHandler = (e) => {
      // Só reagir se clicou diretamente no dialog (backdrop)
      if (e.target === e.currentTarget) {
        e.stopPropagation();
        const $modalBox = this.$dialog.find(".modal-box");
        
        // Adicionar animação inline se não houver CSS
        $modalBox.css({
          animation: "shake 0.5s ease-in-out"
        });
        
        // Criar keyframes se não existir
        if (!document.querySelector('#shake-keyframes')) {
          const style = document.createElement('style');
          style.id = 'shake-keyframes';
          style.textContent = `
            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
              20%, 40%, 60%, 80% { transform: translateX(10px); }
            }
          `;
          document.head.appendChild(style);
        }
        
        // Remover animação após finalizar
        setTimeout(() => {
          $modalBox.css({ animation: "" });
        }, 500);
      }
    };

    this._keyHandler = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        this.close();
      }
    };

    // Anexar event listeners com namespace único para este modal
    this.$closeBtn.on(`click.modal-${this.id}`, this._closeHandler);
    this.$dialog.on(`click.modal-${this.id}`, this._backdropHandler);
    this.$dialog.on(`keydown.modal-${this.id}`, this._keyHandler);
    
    console.log(`Event listeners configurados para modal: ${this.id}`);
  }

  getElements() {
    return {
      dialog: this.$dialog,
      titulo: this.$title,
      mensagem: this.$message,
      action: $(`#${this.id}-action`),
    };
  }

  setTitle(text) {
    this.$title.text(text);
  }

  setMessage(text) {
    this.$message.text(text);
  }

  open() {
    const dialog = this.$dialog[0];
    if (dialog && typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      console.error("Dialog element not found or showModal not supported");
    }
  }

  close() {
    console.log("Fechando modal:", this.id);
    const dialog = this.$dialog[0];
    console.log("Fechando modal:",this.$dialog[0] );
    if (dialog && typeof dialog.close === "function") {
      if (this.onClose) {
        this.onClose();
      }
      dialog.close();
      if (this.destroyOnClose) {
        this.destroy();
      }
    }
  }

  setContent(htmlOrElement) {
    const action = this.getElements().action;
    action.empty();

    if (!Array.isArray(htmlOrElement)) {
      htmlOrElement = [htmlOrElement];
    }

    htmlOrElement.forEach((content) => {
      if (typeof content === "string") {
        action.html(content);
      } else if (content instanceof jQuery) {
        action.append(content);
      } else if (content instanceof HTMLElement) {
        action.append(content);
      } else {
        console.warn(
          "setContent: conteúdo inválido. Deve ser string, jQuery ou HTMLElement."
        );
      }
    });
  }

  reload() {
    this.destroy();
    this.build();
  }

  addDeleteButtons() {
    const action = this.getElements().action;
    action.empty();

    const cancelar = $("<button>", {
      id: `${this.id}-cancelar`,
      type: "button",
      class: "btn btn-ghost modal-close-btn",
      text: "Cancelar",
    });

    const confirmar = $("<button>", {
      id: `${this.id}-confirmar`,
      type: "button",
      class: "btn btn-error",
      text: "Remover",
    });

    // Adicionar eventos com namespace único
    const cancelHandler = (e) => {
      e.stopPropagation();
      this.onCancel();
      this.close();
    };

    const confirmHandler = (e) => {
      e.stopPropagation();
      this.onDelete();
      this.close();
    };

    cancelar.on(`click.modal-${this.id}`, cancelHandler);
    confirmar.on(`click.modal-${this.id}`, confirmHandler);

    // Armazenar referências para limpeza posterior
    this._cancelButton = cancelar;
    this._confirmButton = confirmar;

    action.append(cancelar, confirmar);
  }

  getElement() {
    return this.$dialog;
  }

  destroy() {
    // Remover event listeners específicos deste modal
    if (this.$closeBtn) {
      this.$closeBtn.off(`click.modal-${this.id}`);
    }
    if (this.$dialog) {
      this.$dialog.off(`click.modal-${this.id}`);
      this.$dialog.off(`keydown.modal-${this.id}`);
    }
    
    // Remover event listeners dos botões de delete se existirem
    if (this._cancelButton) {
      this._cancelButton.off(`click.modal-${this.id}`);
    }
    if (this._confirmButton) {
      this._confirmButton.off(`click.modal-${this.id}`);
    }
    
    if (this.$dialog) {
      this.$dialog.remove();
      this.$dialog = null;
    }
    
    console.log('Modal destruído:', this.id, 'Event listeners removidos');
  }
  };
}