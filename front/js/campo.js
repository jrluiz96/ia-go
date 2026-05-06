class BashCampo {
  constructor({
    id = "",
    label = "",
    fieldName = "",
    required = false,
    element = "input",
    input = {},
    select = {},
    value = "",
    validate = [],
    events = {},
  }) {
    this.id = id;
    this.label = label;
    this.name = fieldName || label.toLowerCase().replace(/\s+/g, "_");
    this.required = required;
    this.element = element;
    this.input = input;
    this.select = select;
    this.value = value;
    this.validateRules = validate;
    this.events = events;

    this.validator = null;
  }

  create() {
    const $wrapper = $("<div>").addClass("relative");

    let $elWrapper;

    if (this.element === "input") {
      $elWrapper = this._createInputField();
    } else if (this.element === "select") {
      $elWrapper = this._createSelectField();
      this._popularSelect($elWrapper.find("select"));
    } else if (this.element === "textarea") {
      $elWrapper = this._createTextareaField();
    }

    const $input = $elWrapper.find("input, select, textarea");

    this._bindEvents($input);
    this._initValidator($input);

    $wrapper.append($elWrapper);
    return $wrapper;
  }

  _createInputField() {
    const $input = $("<input>")
      .attr("type", this.input.type || "text")
      .attr("id", this.id)
      .attr("name", this.name)
      .val(this.value)
      .addClass("input input-bordered w-full pt-4");

    if (this.required) $input.attr("required", true);

    const $label = this._createLabel();
    return $("<div>").addClass("relative").append($input).append($label);
  }

  _createSelectField() {
    const $select = $("<select>")
      .attr("id", this.id)
      .attr("name", this.name)
      .addClass("select select-bordered w-full pt-4");

    if (this.required) $select.attr("required", true);

    $select.append(
      $("<option>")
        .attr("disabled", true)
        .attr("selected", true)
        .text("Selecione")
    );

    const $label = this._createLabel();
    return $("<div>").addClass("relative").append($select).append($label);
  }

  _createTextareaField() {
    const $textarea = $("<textarea>")
      .attr("id", this.id)
      .attr("name", this.name)
      .val(this.value)
      .addClass("textarea textarea-bordered w-full pt-4 min-h-[100px]");

    if (this.required) $textarea.attr("required", true);

    const $label = this._createLabel();
    return $("<div>").addClass("relative").append($textarea).append($label);
  }

  _createLabel() {
    return $("<label>")
      .attr("for", this.id)
      .addClass("absolute left-4 top-2 text-xs text-gray-500")
      .text(this.label);
  }

  _popularSelect($select) {
    const dados = this.select.dados || [];
    const campoLabel = this.select.label || "";
    const campoValue = this.select.value || "";

    dados.forEach((item) => {
      const valor = campoValue ? item[campoValue] : item.id ?? item[campoLabel];
      const texto = item[campoLabel];

      const $option = $("<option>").val(valor).text(texto);
      if (this.value && this.value === valor) {
        $option.attr("selected", true);
      }

      $select.append($option);
    });
  }

  _bindEvents($el) {
    if (!this.events) return;

    const eventsArray = Array.isArray(this.events)
      ? this.events
      : Object.entries(this.events).map(([event, handler]) => ({
          event,
          handler,
        }));

    eventsArray.forEach(({ event, handler }) => {
      if (typeof event === "string" && typeof handler === "function") {
        $el.on(event, handler);
      }
    });
  }

  _initValidator($el) {
    if (!$el.length) return;

    this.validator = new BashValidate($el);

    if (this.required) {
      this.validator.required();
    }

    this.validateRules.forEach((rule) => {
      if (typeof rule === "string") {
        this.validator[rule]?.();
      } else if (typeof rule === "object") {
        const [fn, arg] = Object.entries(rule)[0];
        this.validator[fn]?.(arg);
      }
    });
  }

  isValid() {
    return this.validator?.isValid() ?? true;
  }

  addValidation(rule) {
    if (!this.validator) return;

    if (typeof rule === "string") {
      this.validator[rule]?.();
    } else if (typeof rule === "object") {
      const [fn, arg] = Object.entries(rule)[0];
      this.validator[fn]?.(arg);
    }
  }

  getEvents() {
    const el = this.getElement();
    if (!el.length) return {};

    const rawEl = el[0];
    const events = $._data(rawEl, "events") || {};
    const result = {};

    for (const [type, handlers] of Object.entries(events)) {
      result[type] = handlers.map((h) => h.handler.name || "anonymous");
    }

    return result;
  }

  removeEvent(eventName) {
    const el = this.getElement();
    if (el.length) {
      el.off(eventName);
    }
  }

  removeAllEvents() {
    const el = this.getElement();
    if (el.length) {
      el.off();
    }
  }

  debug() {
    console.log("----- BashField Debug -----");
    console.log("Label:", this.label);
    console.log("Name:", this.name);
    console.log("ID:", this.id);
    console.log("Atributos:", this.getAttributes());
    console.log("Eventos:", this.getEvents());
    console.log("----------------------------");
  }

  getField() {
    return $(`${this.element}[name="${this.name}"]`);
  }

  getValue() {
    return {this.name : this.getField().val() }
  }

  set Validations(regras = []) {
    if (!this.validator) return;

    this.validateRules = regras;

    // Limpa qualquer custom validity anterior
    this.validator.el.setCustomValidity("");

    regras.forEach((rule) => {
      if (typeof rule === "string") {
        this.validator[rule]?.();
      } else if (typeof rule === "object") {
        const [fn, arg] = Object.entries(rule)[0];
        this.validator[fn]?.(arg);
      }
    });
  }
}
