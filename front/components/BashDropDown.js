class GDropdown extends HTMLElement {
  constructor() {
    super();
    this._id = this.getAttribute("id") || `dropdown-${Date.now()}`;
    this._icon = this.getAttribute("icon") || "";
    this._label = this.getAttribute("label") || "";
    this._items = [];
  }

  connectedCallback() {
    this.setAttribute("data-dropdown-container", "");
    this.render();
  }

  render() {
    this.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "relative text-left dropdown dropdown-end";

    // Botão
    const button = document.createElement("button");
    button.className = "btn btn-sm btn-ghost btn-circle";
    button.onclick = () => this.toggleDropdown();

    if (this._icon) {
      const icon = document.createElement("i");
      icon.className = this._icon;
      button.appendChild(icon);
    } else if (this._label) {
      button.textContent = this._label;
    }

    // Dropdown (ul)
    const ul = document.createElement("ul");
    ul.className =
      "menu dropdown-content dropdown-start bg-base-100 shadow rounded-box w-40 z-100 hidden absolute border border-base-300";
    ul.id = this._id;

    this._items.forEach(({ label, onClick }) => {
      const li = document.createElement("li");
      const itemBtn = document.createElement("button");
      itemBtn.textContent = label;
      itemBtn.onclick = onClick;
      li.appendChild(itemBtn);
      ul.appendChild(li);
    });

    wrapper.appendChild(button);
    wrapper.appendChild(ul);
    this.appendChild(wrapper);

    this._dropdown = ul;
    this._button = button;
  }

  toggleDropdown() {
    const isHidden =
      this._dropdown.classList.contains("hidden") ||
      this._dropdown.style.display === "none";

    // Fecha todos os outros
    document.querySelectorAll(".dropdown-content").forEach((menu) => {
      menu.classList.add("hidden");
      menu.classList.remove("block", "z-50");
    });

    // Abre este dropdown
    if (isHidden) {
      this._dropdown.classList.remove("hidden");
      this._dropdown.classList.add("block", "z-50");

      const closeOnClickOutside = (event) => {
        if (
          !this._button.contains(event.target) &&
          !this._dropdown.contains(event.target)
        ) {
          this._dropdown.classList.add("hidden");
          this._dropdown.classList.remove("block", "z-50");
          document.removeEventListener("click", closeOnClickOutside);
        }
      };

      setTimeout(() => {
        document.addEventListener("click", closeOnClickOutside);
      }, 0);
    }
  }

  setItems(items = []) {
    this._items = items;
    this.render();
  }
}

customElements.define("g-dropdown", GDropdown);
