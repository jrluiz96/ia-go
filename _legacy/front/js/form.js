class BashForm {
  constructor({
    id,
    classList = "",
    md = 4,
    sm = 1,
    xl = 5,
    container = null,
    fields = [],
    validations = {},
    submit = () => {},
  }) {
    this.createForm(id, classList, md, sm, xl);
    this.id = id;
    this.fields = [];
    this.validations = validations;
    this.submit = submit;
    this.createAllFields(fields);

    if (container) {
      this.appendToContainer(container);
    }
  }

  appendToContainer(container = null) {
    const targetContainer = container || this.container;

    if (!targetContainer) {
      console.warn("Nenhum container especificado para anexar o formulário");
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

    // Anexar o formulário ao container
    $target.append(this.$form);

    return this;
  }

  createForm(id, classList, md, sm, xl) {
    this.$form = $("<form>")
      .attr("id", id)
      .submit((e) => {
        this.submit(e);
      })
      .addClass(
        classList ||
          `w-full grid grid-cols-${sm} md:grid-cols-${md} xl:grid-cols-${xl} gap-4`
      );
  }

  createAllFields(campos = []) {
    const estrutura = [];
    campos.forEach((campoConfig) => {
      const id = this.id ? this.id + "_" : "";

      campoConfig.id =
        id +
        (campoConfig.fieldName ||
          campoConfig.label.toLowerCase().replace(/\s+/g, "_"));
      // Converter propriedades para o formato esperado pelo BashField
      const fieldConfig = {
        ...campoConfig,
        fieldName: campoConfig.name,
        element: campoConfig.element || "input",
        input: {
          type: campoConfig.type || "text",
        },
        attributes: {},
      };

      // Mover propriedades específicas para attributes
      if (campoConfig.placeholder) {
        fieldConfig.attributes.placeholder = campoConfig.placeholder;
      }
      if (campoConfig.maxlength) {
        fieldConfig.attributes.maxlength = campoConfig.maxlength;
      }
      if (campoConfig.pattern) {
        fieldConfig.attributes.pattern = campoConfig.pattern;
      }
      if (campoConfig.mask) {
        fieldConfig.attributes["data-mask"] = campoConfig.mask;
      }
      if (campoConfig.rows) {
        fieldConfig.attributes.rows = campoConfig.rows;
      }
      if (campoConfig.disabled) {
        fieldConfig.attributes.disabled = campoConfig.disabled;
      }
      if (campoConfig.value) {
        fieldConfig.value = campoConfig.value;
      }
      if (campoConfig.defaultValue) {
        fieldConfig.value = campoConfig.defaultValue;
      }
      if (campoConfig.clearable) {
        fieldConfig.value = campoConfig.defaultValue;
      }
      // Tratar classList personalizada para o wrapper do campo
      if (campoConfig.classList) {
        fieldConfig.classList = campoConfig.classList;
      }

      // Para campos select
      if (campoConfig.options) {
        fieldConfig.select = {
          dados: campoConfig.options,
          label: "label",
          value: "value",
        };
      }
      const field = new BashField(fieldConfig);
      const $campo = field.create();
      this.fields.push(field);
      estrutura.push($campo);
    });
    this.$form.append(estrutura);
  }

  createField(config) {
    const field = new BashField(config);
    const $campo = field.create();
    this.fields.push(field);
    this.$form.append($campo);
  }

  removeField(identifier) {
    let selector;
    let filterCondition;

    // Determinar se é ID ou name baseado na presença do prefixo #
    if (identifier.startsWith("#")) {
      selector = identifier;
      const id = identifier.substring(1);
      filterCondition = (f) => f.id !== id;
    } else {
      selector = `[name="${identifier}"]`;
      filterCondition = (f) => f.name !== identifier;
    }

    this.$form.find(selector).each(function () {
      const $wrapper = $(this).closest("div.relative");
      if ($wrapper.length) $wrapper.remove();
      else $(this).remove();
    });

    this.fields = this.fields.filter(filterCondition);
  }

  removeForm() {
    this.$form.remove();
  }

  onFieldEvent(fieldName, eventName, callback) {
    const field = this.getFields()[fieldName];
    if (!field) {
      console.warn(`Campo "${fieldName}" não encontrado.`);
      return;
    }

    field.addEvent({
      [eventName]: (e) => {
        const value =
          field.element === "toggle" ? e.target.checked : e.target.value;

        callback({
          event: e,
          value,
          form: this,
          field,
        });
      },
    });
  }

  addSubmitButton(label = "Enviar", callback = () => {}) {
    const $button = $("<button>")
      .attr("type", "submit")
      .addClass("btn btn-primary col-span-full")
      .text(label);

    this.$form.find("button[type='submit']").remove();
    this.$form.append($button);
    this.$form.off("submit");
    this.$form.on("submit", (e) => {
      e.preventDefault();
      const isValid = this.validateForm();
      if (isValid) {
        callback(this.getValues());
      }
    });
  }

  submit() {
    e.preventDefault();
    const isValid = this.validateForm();
    if (isValid) {
      this.submit(this.getValues());
    }
  }

  validateForm() {
    let isValid = true;
    this.fields.forEach((field) => {
      if (!field.isDisabled()) {
        if (!field.isValid()) {
          isValid = false;
        }
      }
    });
    return isValid;
  }

  getElement() {
    return this.$form;
  }

  getValues() {
    const data = {};
    this.fields.forEach((field) => {
      data[field.name] = field.getValue();
    });
    return data;
  }

  getFields() {
    return this.fields.reduce((acc, field) => {
      acc[field.name] = field;
      return acc;
    }, {});
  }

  setValues(data = {}) {
    this.fields.forEach((field) => {
      if (data.hasOwnProperty(field.name)) {
        field.setValue(data[field.name]);
      }
    });
  }

  clearValues() {
    this.fields.forEach((field) => {
      if (field.element === "select") {
        const $el = field.getField();
        if ($el.length) {
          const $placeholderOption = $el.find("option[disabled]");
          if ($placeholderOption.length) {
            $placeholderOption.prop("selected", true);
            $el.trigger("change");
          }
          field.value = ""; // Manter o valor interno como vazio
        }
      }else{
        field.setValue("");
      }
    });
  }

  setValidations(map = {}) {
    this.validations = map;
    this.fields.forEach((field) => {
      const regras = this.validations[field.name];
      if (Array.isArray(regras)) {
        field.Validations = regras;
      }
    });
  }

  get Fields() {
    return this.fields.reduce((acc, field) => {
      acc[field.name] = field;
      return acc;
    }, {});
  }

  updateFieldOptions(fieldName, options = []) {
    const field = this.getFields()[fieldName];
    if (!field) {
      console.warn(`Campo "${fieldName}" não encontrado.`);
      return;
    }
    if (field.element !== "select") {
      console.warn(`Campo "${fieldName}" não é um select.`);
      return;
    }
    field.updateSelectData(options);
  }
}
