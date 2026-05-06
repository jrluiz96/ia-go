class TabelaDinamica extends HTMLElement {
  constructor() {
    super();
    this.columns = this.getAttribute("columns") || [];
    this.rows = this.getAttribute("rows") || [];
    this.slotRender = {};
    this.attachShadow({ mode: "open" });
    this.container = document.createElement("div");
    this.container.className = "overflow-x-auto p-2";
    this.shadowRoot.appendChild(this.container);
  }

  setColumns(columns) {
    this.columns = columns;
    this.render();
  }

  setRows(rows) {
    this.rows = rows;
    this.render();
  }

  addRow(row) {
    this.rows.push(row);
    this.render();
  }

  removeRowById(id) {
    this.rows = this.rows.filter((r) => r.id != id);
    this.render();
  }

  getRowById(id) {
    return this.rows.find((r) => r.id == id);
  }

  getRowElementById(id) {
    return this.shadowRoot.querySelector(`tr[data-id="${id}"]`);
  }

  setSlot(coluna, renderFn) {
    this.slotRender[coluna] = renderFn;
  }

  render() {
    this.container.innerHTML = "";
    const table = document.createElement("table");
    table.className = "table w-full table-zebra";

    const thead = document.createElement("thead");
    const header = document.createElement("tr");
    this.columns.forEach((col) => {
      const th = document.createElement("th");
      th.textContent = col.label;
      header.appendChild(th);
    });
    thead.appendChild(header);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    this.rows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.setAttribute("data-id", row.id ?? "");

      this.columns.forEach((col) => {
        const td = document.createElement("td");
        if (this.slotRender[col.value]) {
          td.innerHTML = this.slotRender[col.value](row);
        } else {
          td.textContent = row[col.value] ?? "";
        }
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    this.container.appendChild(table);
  }
}

customElements.define("bash-table", TabelaDinamica);
