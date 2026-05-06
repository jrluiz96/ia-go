class BashField {
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
    attributes = {}, // Novo parâmetro para atributos
    classList = "", // Nova propriedade para classes do wrapper
    clearable = false,
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
    this.attributes = attributes; // Armazena atributos personalizados
    this.classList = classList; // Armazena classes customizadas
    this.validator = null;
    this.clearable = clearable; 
  }

  create() {
    // Aplicar classes customizadas ao wrapper se fornecidas
    const baseClass = "relative";
    const wrapperClass = this.classList
      ? `${baseClass} ${this.classList}`
      : baseClass;
    const $wrapper = $("<div>").addClass(wrapperClass);

    let $elWrapper;

    if (this.element === "input") {
      $elWrapper = this._createInputField();
    } else if (this.element === "select") {
      $elWrapper = this._createSelectField();
      this._popularSelect($elWrapper.find("select"));
    } else if (this.element === "textarea") {
      $elWrapper = this._createTextareaField();
    } else if (this.element === "toggle") {
      $elWrapper = this._createToggleField();
    } else if (this.element === "multiselect") {
      $elWrapper = this._createMultiSelectField();
    } else if (this.element === "file") {
      $elWrapper = this._createFileField();
    }

    const $input = $elWrapper.find("input, select, textarea");

    // Aplica atributos personalizados
    this._applyAttributes($input);

    this._bindEvents($input);
    this._initValidator($input);

    this.$field = $input;

    $wrapper.append($elWrapper);
    return $wrapper;
  }

  // Método privado para aplicar atributos
  _applyAttributes($el) {
    if (!$el.length || !this.attributes) return;

    Object.entries(this.attributes).forEach(([attr, value]) => {
      if (
        attr.startsWith("data-") ||
        [
          "placeholder",
          "min",
          "max",
          "step",
          "pattern",
          "maxlength",
          "minlength",
          "rows",
          "cols",
          "disabled",
          "readonly",
          "multiple",
        ].includes(attr)
      ) {
        $el.attr(attr, value);
      }
    });
  }

  // Método para definir um atributo
  setAttribute(name, value) {
    const $el = this.getField();
    if (!$el.length) {
      console.warn(`Campo não encontrado: ${this.id}`);
      return this;
    }

    $el.attr(name, value);
    this.attributes[name] = value;
    return this;
  }

  // Método para obter um atributo
  getAttribute(name) {
    const $el = this.getField();
    if (!$el.length) {
      console.warn(`Campo não encontrado: ${this.id}`);
      return null;
    }

    return $el.attr(name);
  }

  // Método para remover um atributo
  removeAttribute(name) {
    const $el = this.getField();
    if (!$el.length) {
      console.warn(`Campo não encontrado: ${this.id}`);
      return this;
    }

    $el.removeAttr(name);
    delete this.attributes[name];
    return this;
  }

  // Método para definir múltiplos atributos
  setAttributes(attributes = {}) {
    const $el = this.getField();
    if (!$el.length) {
      console.warn(`Campo não encontrado: ${this.id}`);
      return this;
    }

    Object.entries(attributes).forEach(([name, value]) => {
      $el.attr(name, value);
      this.attributes[name] = value;
    });

    return this;
  }

  // Método para obter todos os atributos
  getAttributes() {
    const $el = this.getField();
    if (!$el.length) {
      console.warn(`Campo não encontrado: ${this.id}`);
      return {};
    }

    const attributes = {};
    $.each($el[0].attributes, function () {
      attributes[this.name] = this.value;
    });

    return attributes;
  }

  // Método melhorado para definir valor
  setValue(novoValor, triggerChange = true) {
    this.value = novoValor;
    const $el = this.getField();

    if (!$el.length) {
      console.warn(`Campo não encontrado: ${this.id}`);
      return this;
    }

    if (this.element === "toggle") {
      $el.prop("checked", Boolean(novoValor));
    } else if (this.element === "multiselect") {
      const valores = Array.isArray(novoValor) ? novoValor : [novoValor];
      $el.val(valores);
    } else {
      $el.val(novoValor);
    }
    // Atualizar botão de limpar para selects
    if (this.clearable && this.element === "select") {
      this.updateClearButton();
    }
    // Dispara evento change se solicitado
    if (triggerChange) {
      $el.trigger("change");
    }

    return this;
  }

  // Método melhorado para obter valor
  getValue() {
    const $el = this.getField();
    if (!$el.length) {
      console.warn(`Campo não encontrado: ${this.id}`);
      return null;
    }

    if (this.element === "toggle") {
      return $el.prop("checked");
    } else if (this.element === "multiselect") {
      return $el.val() || [];
    } else if (this.element === "file") {
      return $el[0].files;
    }

    return $el.val();
  }

  // Método para obter valor como texto
  getValueAsText() {
    const $el = this.getField();
    if (!$el.length) return "";

    if (this.element === "select") {
      return $el.find("option:selected").text();
    } else if (this.element === "multiselect") {
      return $el
        .find("option:selected")
        .map(function () {
          return $(this).text();
        })
        .get()
        .join(", ");
    } else if (this.element === "toggle") {
      return this.getValue() ? "Sim" : "Não";
    }

    return this.getValue() || "";
  }

  // Método para limpar o campo
  clear() {
    const $el = this.getField();
    if (!$el.length) return this;

    if (this.element === "toggle") {
      $el.prop("checked", false);
    } else if (this.element === "multiselect") {
      $el.val([]);
    } else if (this.element === "file") {
      $el.val("");
      this._updateFileDisplay([]);
    } else {
      $el.val("");
    }

    this.value =
      this.element === "toggle"
        ? false
        : this.element === "multiselect"
        ? []
        : this.element === "file"
        ? null
        : "";

    if (this.clearable && this.element === "select") {
      this.updateClearButton();
    }
    return this;
  }

  // Método para resetar para valor inicial
  reset() {
    const initialValue =
      this.element === "toggle"
        ? false
        : this.element === "multiselect"
        ? []
        : "";
    return this.setValue(initialValue);
  }

  // Método para focar no campo
  
  focus() {
    const $el = this.getField();
    if ($el.length) {
      $el.focus();
    }
    return this;
  }

  // Método para desfocar do campo
  blur() {
    const $el = this.getField();
    if ($el.length) {
      $el.blur();
    }
    return this;
  }

  // Método melhorado para buscar o campo
  getField() {
    // Se já tem referência, retorna ela
    if (this.$field && this.$field.length) {
      return this.$field;
    }

    // Se não tem referência, busca pelo ID
    const $element = $(`#${this.id}`);

    if ($element.length) {
      this.$field = $element;
      return this.$field;
    }

    // Se ainda não encontrou, busca por name
    const $elementByName = $(`[name="${this.name}"]`);

    if ($elementByName.length) {
      this.$field = $elementByName;
      return this.$field;
    }

    return $();
  }

  // Método para verificar se o campo existe no DOM
  exists() {
    return this.getField().length > 0;
  }

  isDisabled() {
    const $el = this.getField();
    if (!$el.length) {
      console.warn(`Campo não encontrado: ${this.id}`);
      return false;
    }

    return $el.prop("disabled") || $el.attr("disabled") === "disabled";
  }

  // Método para desabilitar o campo
  disable() {
    const $el = this.getField();
    if (!$el.length) {
      console.warn(`Campo não encontrado: ${this.id}`);
      return this;
    }

    $el.prop("disabled", true);
    return this;
  }

  // Método para habilitar o campo
  enable() {
    const $el = this.getField();
    if (!$el.length) {
      console.warn(`Campo não encontrado: ${this.id}`);
      return this;
    }

    $el.prop("disabled", false);
    return this;
  }

  // Método para obter informações completas do campo
  getFieldInfo() {
    return {
      id: this.id,
      name: this.name,
      label: this.label,
      element: this.element,
      value: this.getValue(),
      valueAsText: this.getValueAsText(),
      isValid: this.isValid(),
      isDisabled: this.isDisabled(),
      attributes: this.getAttributes(),
      exists: this.exists(),
    };
  }

  _createToggleField() {
    const $labelWrapper = $("<label>").addClass(
      "flex items-center cursor-pointer gap-4"
    );

    const $spanLabel = $("<span>")
      .addClass("text-sm text-gray-700")
      .text(this.label);

    const $input = $("<input>")
      .attr("type", "checkbox")
      .attr("id", this.id)
      .attr("name", this.name)
      .prop("checked", Boolean(this.value))
      .addClass("toggle toggle-primary");

    if (this.required) $input.attr("required", true);

    $labelWrapper.append($spanLabel).append($input);
    return $labelWrapper;
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

  _createFileField() {
    // Container principal
    const $container = $("<div>").addClass("relative");
    
    // Input de arquivo (escondido)
    const $input = $("<input>")
      .attr("type", "file")
      .attr("id", this.id)
      .attr("name", this.name)
      .addClass("hidden")
      .on("change", (e) => {
        this._updateFileDisplay(e.target.files);
      });

    if (this.required) $input.attr("required", true);

    // Botão customizado para selecionar arquivos
    const $button = $("<button>")
      .attr("type", "button")
      .addClass("btn btn-outline btn-primary w-full")
      .html(`<i class="fas fa-upload mr-2"></i>${this.label}`)
      .on("click", (e) => {
        e.preventDefault();
        $input.click();
      });

    // Container para mostrar arquivos selecionados
    const $fileList = $("<div>")
      .addClass("mt-2 space-y-1")
      .attr("id", `${this.id}-file-list`);

    $container
      .append($input)
      .append($button)
      .append($fileList)

    return $container;
  }

  _updateFileDisplay(files) {
    console.log(files)
    const $fileList = $(`#${this.id}-file-list`);
    $fileList.empty();

    if (!files || files.length === 0) {
      $fileList.append(
        $("<p>").addClass("text-sm text-gray-500").text("Nenhum arquivo selecionado")
      );
      return;
    }

    Array.from(files).forEach((file, index) => {
      const $fileItem = $("<div>")
        .addClass("flex items-center justify-between bg-base-200 p-2 rounded text-sm");

      const $fileInfo = $("<div>")
        .addClass("flex items-center")
        .html(`
          <i class="fas fa-file mr-2 text-primary"></i>
          <span class="font-medium">${file.name}</span>
          <span class="text-gray-500 ml-2">(${this._formatFileSize(file.size)})</span>
        `);

      const $removeBtn = $("<button>")
        .attr("type", "button")
        .addClass("btn btn-ghost btn-xs text-error")
        .html('<i class="fas fa-times"></i>')
        .on("click", (e) => {
          e.preventDefault();
          this._removeFile(index);
        });

      $fileItem.append($fileInfo).append($removeBtn);
      $fileList.append($fileItem);
    });
  }

  _removeFile(index) {
    const $input = this.getField();
    if (!$input.length) return;

    // Para remover um arquivo específico, precisamos recriar a FileList
    const dt = new DataTransfer();
    const files = Array.from($input[0].files);
    
    files.forEach((file, i) => {
      if (i !== index) {
        dt.items.add(file);
      }
    });

    $input[0].files = dt.files;
    this._updateFileDisplay($input[0].files);
  }

  _formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
        .text(`${this.attributes.placeholder || "Selecione"}`)
    );

    const $label = this._createLabel();

    const $wrapper = $("<div>").addClass("relative").append($select).append($label);

    // Adicionar botão de limpar se clearable for true
    if (this.clearable) {
      const $inputGroup = $("<div>").addClass("flex items-stretch");
  
      // Container para o select (ocupa todo o espaço disponível)
      const $selectContainer = $("<div>").addClass("flex-1 relative");
      $selectContainer.append($select).append($label);

      $inputGroup.append($selectContainer);
      this._addClearButtonToSelect($inputGroup, $select);

      $wrapper.append($inputGroup);
    }
  
    return $wrapper;
  }
  _addClearButtonToSelect($inputGroup, $select) {
    const $clearButton = $("<button>")
      .attr("type", "button")
      .addClass("btn btn-secundary btn-sm border border-gray-600 rounded-l-none px-3 text-gray-200 hover:text-gray-300 hover:bg-gray-500 clear-button")
      .html("&times;")
      .css({
        "display": "none",
        "align-items": "center",
        "justify-content": "center",
        "font-size": "1.2rem",
        "cursor": "pointer"
      })
      .on("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        $select.val("").trigger("change");
        const $placeholderOption = $select.find("option[disabled]");
        if ($placeholderOption.length) {
          $placeholderOption.prop("selected", true);
        } else {
          // Se não encontrar placeholder, selecionar a primeira opção
          $select.find("option").first().prop("selected", true);
        }
        
        $select.trigger("change");
      });
  
    // Adicionar o botão ao grupo
    $inputGroup.append($clearButton);
  
    // Função para sincronizar a altura
    const syncHeight = () => {
      const selectHeight = $select.outerHeight();
      $clearButton.css({
        "height": selectHeight + "px",
        "line-height": selectHeight + "px"
      });
    };
  
    // Sincronizar altura inicialmente e após mudanças
    syncHeight();
    $(window).on("resize", syncHeight);
    $select.on("change", syncHeight);
  
    // Função para atualizar visibilidade do botão E estilo do select
    const updateClearButtonAndSelect = () => {
      const hasValue = $select.val() !== "" && $select.val() !== null;
      
      if (hasValue) {
        // Mostrar botão e ajustar select para modo conectado
        $clearButton.css("display", "flex");
        $select.css({
          "border-radius": "0.375rem 0 0 0.375rem",
          "border-right": "none"
        });
        syncHeight(); // Re-sincronizar altura quando mostrar
      } else {
        // Esconder botão e restaurar select para modo normal
        $clearButton.css("display", "none");
        $select.css({
          "border-radius": "0.375rem",
          "border-right": "1px solid var(--fallback-bc,oklch(var(--bc)/0.2))"
        });
      }
    };
  
    // Event listeners
    $select.on("change", updateClearButtonAndSelect);
    
    // Verificar estado inicial após popular opções
    setTimeout(updateClearButtonAndSelect, 100);
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

  _createMultiSelectField() {
    const $label = $("<label>")
      .attr("for", this.id)
      .addClass("block text-sm text-gray-400 mb-1")
      .text(this.label);

    const $select = $("<select>")
      .attr("id", this.id)
      .attr("name", this.name)
      .attr("multiple", true)
      .addClass(
        "w-full rounded-md border border-gray-700 bg-base-100 text-sm text-gray-200 p-2 min-h-[100px] focus:outline-none focus:ring-2 focus:ring-primary"
      );

    if (this.required) $select.attr("required", true);

    const $wrapper = $("<div>")
      .addClass("form-control col-span-full")
      .append($label)
      .append($select);

    this._popularMultiSelect($select);

    return $wrapper;
  }

  _createLabel() {
    return $("<label>")
      .attr("for", this.id)
      .addClass("absolute left-4 top-2 text-xs text-gray-500")
      .text(this.label);
  }

  _popularSelect($select) {
    const dados = this.select.dados || [];
    const campoLabel = this.select.label || "label";
    const campoValue = this.select.value || "value";
    const $placeholder = $select.find("option[disabled][selected]");
    $select.empty();
    if ($placeholder.length) {
      $select.append($placeholder);
    } else {
      $select.append(
        $("<option>")
          .attr("disabled", true)
          .attr("selected", true)
          .text(`${this.attributes.placeholder || "Selecione"}`)
      );
    }

    dados.forEach((item) => {
      const valor = item[campoValue] || item.id || item[campoLabel];
      const texto = item[campoLabel] || item.nome || item.text;

      const $option = $("<option>").val(valor).text(texto);
      if (this.value && this.value === valor) {
        $option.attr("selected", true);
      }

      $select.append($option);
    });
  }

  _popularMultiSelect($select) {
    const dados = this.select.dados || [];
    const campoLabel = this.select.label || "label";
    const campoValue = this.select.value || "value";
    const selecionados = Array.isArray(this.value) ? this.value : [];

    dados.forEach((item) => {
      const valor = item[campoValue] ?? item.id ?? item[campoLabel];
      const texto = item[campoLabel] ?? item.nome ?? item.text;

      const $option = $("<option>").val(valor).text(texto);

      if (selecionados.includes(valor)) {
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

  addEvent(eventos = {}) {
    const el = this.getField();
    if (!el.length) return;

    Object.entries(eventos).forEach(([eventName, handler]) => {
      if (typeof eventName === "string" && typeof handler === "function") {
        el.on(eventName, handler);
        this.events[eventName] = handler;
      }
    });
  }

  updateClearButton() {
    if (!this.clearable || this.element !== "select") return;
    
    const $select = this.getField();
    const $inputGroup = $select.closest(".flex");
    const $clearButton = $inputGroup.find("button[type='button']");
    
    if ($clearButton.length) {
      const hasValue = $select.val() !== "" && $select.val() !== null;
      
      if (hasValue) {
        // Mostrar botão e ajustar select
        $clearButton.css("display", "flex");
        $select.css({
          "border-radius": "0.375rem 0 0 0.375rem",
          "border-right": "none"
        });
      } else {
        // Esconder botão e restaurar select
        $clearButton.css("display", "none");
        $select.css({
          "border-radius": "0.375rem",
          "border-right": "1px solid var(--fallback-bc,oklch(var(--bc)/0.2))"
        });
      }
    }
  }

  updateSelectData(novosDados = []) {
    if (!["select", "multiselect"].includes(this.element)) return;

    this.select.dados = novosDados;
    const el = this.getField();
    if (!el.length) return;

    const currentValue = this.getValue();

    el.empty();

    if (this.element === "select") {
      el.append(
        $("<option>")
          .attr("disabled", true)
          .attr("selected", true)
          .text(`${this.attributes.placeholder || "Selecione"}`)
      );
    }

    const popular =
      this.element === "multiselect"
        ? this._popularMultiSelect
        : this._popularSelect;
    popular.call(this, el);

    if (currentValue) {
      this.setValue(currentValue); // reatribui o valor anterior se ainda existir
    }
  }

  trigger(eventName) {
    const el = this.getField();
    if (el.length) {
      el.trigger(eventName);
    }
  }

  addValidation(rule) {
    if (!this.validator) return;

    if (typeof rule === "string") {
      if (typeof this.validator[rule] === "function") {
        this.validator[rule]();
      }
    } else if (typeof rule === "object") {
      const entries = Object.entries(rule);
      if (entries.length > 0) {
        const [fn, message] = entries[0];
        if (typeof this.validator[fn] === "function") {
          this.validator[fn](message);
        }
      }
    }
  }

  // Método para obter informações completas do campo
  getFieldInfo() {
    return {
      id: this.id,
      name: this.name,
      label: this.label,
      element: this.element,
      value: this.getValue(),
      valueAsText: this.getValueAsText(),
      isValid: this.isValid(),
      isDisabled: this.isDisabled(),
      attributes: this.getAttributes(),
      exists: this.exists(),
    };
  }
}
