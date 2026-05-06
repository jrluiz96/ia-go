class BashMultiSelect extends HTMLElement {
  constructor() {
    super();
    this._label = this.getAttribute("label") || "Selecionar";
    this._name = this.getAttribute("name") || "multiselect";
    this._options = [];
    this._selected = new Set();
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.innerHTML = `
      <div class="form-control w-full">
        <label class="label">
          <span class="label-text">${this._label}</span>
        </label>
        <div class="dropdown dropdown-bottom w-full">
          <label tabindex="0" class="input input-bordered flex items-center justify-between cursor-pointer w-full">
            <span class="selected-text">${this.getSelectedText()}</span>
            <i class="fa-solid fa-chevron-down"></i>
          </label>
          <ul tabindex="0" class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-full max-h-64 overflow-auto z-50">
            ${this._options
              .map(
                (opt) => `
              <li>
                <label class="cursor-pointer label justify-start gap-2">
                  <input type="checkbox" class="checkbox checkbox-sm" value="${
                    opt.value
                  }" ${this._selected.has(opt.value) ? "checked" : ""}/>
                  <span class="label-text">${opt.label}</span>
                </label>
              </li>`
              )
              .join("")}
          </ul>
        </div>
      </div>
    `;

    this.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
      checkbox.addEventListener("change", (e) => {
        const val = e.target.value;
        if (e.target.checked) {
          this._selected.add(val);
        } else {
          this._selected.delete(val);
        }
        this.updateSelectedText();
      });
    });
  }

  getSelectedText() {
    if (this._selected.size === 0) return "Selecione...";
    const labels = [...this._selected].map((val) => {
      const opt = this._options.find((o) => o.value === val);
      return opt ? opt.label : val;
    });
    return labels.join(", ");
  }

  updateSelectedText() {
    this.querySelector(".selected-text").textContent = this.getSelectedText();
  }

  // Métodos públicos
  setOptions(lista, campoLabel = "label", campoValue = "value") {
    this._options = lista.map((item) => ({
      label: item[campoLabel],
      value: item[campoValue],
    }));
    this.render();
  }

  getValue() {
    return [...this._selected];
  }

  getVariable() {
    return this._name:[...this._selected];
  }

  setValue(valores = []) {
    this._selected = new Set(valores);
    this.render();
  }

  clear() {
    this._selected.clear();
    this.render();
  }
}

customElements.define("bash-multiselect", BashMultiSelect);
