class BashAccordion extends HTMLElement {
  constructor() {
    super();
    this._id = this.getAttribute("id") || "";
    this._title = this.getAttribute("title") || "Título";
    this._open = false;
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.innerHTML = `
      <div class="accordion border border-base-100 bg-base-100 rounded-xl border-neutral" data-id="${this._id}">
        <div class="accordion-title flex justify-between items-center cursor-pointer p-4">
          <button class="flex items-center gap-2 w-full text-left" type="button">
            <i class="fa-solid fa-angle-right transition-transform" data-icon></i>
            <span class="font-semibold">${this._title}</span>
          </button>
          <slot name="title"></slot>
        </div>
        <div class="accordion-content px-4 pb-4 hidden">
          <slot></slot>
        </div>
      </div>
    `;

    this.setupListeners();
  }

  setupListeners() {
    const $accordion = this.querySelector(".accordion");
    const $button = this.querySelector("button");
    const $content = this.querySelector(".accordion-content");
    const $icon = this.querySelector("[data-icon]");

    $button.onclick = () => {
      this._open = !this._open;

      if (this._open) {
        this.closeSiblingAccordions();
        $content.classList.remove("hidden");
        $accordion.classList.add("bg-base-300");
        $icon.classList.remove("fa-angle-right");
        $icon.classList.add("fa-angle-down");
      } else {
        $content.classList.add("hidden");
        $accordion.classList.remove("bg-base-300");
        $icon.classList.remove("fa-angle-down");
        $icon.classList.add("fa-angle-right");
      }
    };
  }

  closeSiblingAccordions() {
    const all = document.querySelectorAll("bash-accordion");
    all.forEach((el) => {
      if (el !== this) {
        el._open = false;
        const $accordion = el.querySelector(".accordion");
        const $content = el.querySelector(".accordion-content");
        const $icon = el.querySelector("[data-icon]");

        $content.classList.add("hidden");
        $accordion.classList.remove("bg-base-300");
        $icon.classList.remove("fa-angle-down");
        $icon.classList.add("fa-angle-right");
      }
    });
  }

  setTitle(novoTitulo) {
    this._title = novoTitulo;
    this.render();
  }

  setContent(content) {
    const $content = this.querySelector(".accordion-content");

    $content.innerHTML = "";

    if (typeof content === "string") {
      $content.innerHTML = content;
    } else if (content instanceof Node) {
      $content.appendChild(content);
    } else if (Array.isArray(content)) {
      content.forEach((item) => {
        if (typeof item === "string") {
          $content.insertAdjacentHTML("beforeend", item);
        } else if (item instanceof Node) {
          $content.appendChild(item);
        }
      });
    } else {
      console.warn("Conteúdo inválido para accordion:", content);
    }
  }

  open() {
    this._open = true;
    this.render();
  }

  close() {
    this._open = false;
    this.render();
  }

  toggle() {
    this._open = !this._open;
    this.render();
  }

  getId() {
    return this._id;
  }
}

customElements.define("bash-accordion", BashAccordion);
