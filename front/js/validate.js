class BashValidate {
  constructor(inputRef) {
    if (!inputRef) throw new Error("Elemento de entrada é obrigatório");

    let $el;
    if (typeof inputRef === "string") {
      $el = inputRef.startsWith("#") ? $(inputRef) : $(`#${inputRef}`);
    } else if (inputRef instanceof HTMLElement) {
      $el = $(inputRef);
    } else if (inputRef instanceof jQuery) {
      $el = inputRef;
    } else {
      throw new Error("Formato de entrada inválido");
    }

    if ($el.is("input, select, textarea")) {
      this.$input = $el;
    } else {
      this.$input = $el.find("input, select, textarea").first();
      if (!this.$input.length) {
        throw new Error("Elemento de entrada não contém um input válido");
      }
    }

    this.validations = [];
  }

  get valor() {
    return this.$input.val();
  }

  get el() {
    return this.$input[0];
  }

  addValidation(fn, message) {
    this.validations.push({ fn, message });
  }

  required(mensagem = "Campo obrigatório") {
    this.addValidation((valor) => {
      if (valor === null || valor === undefined) return false;
      return String(valor).trim() !== "";
    }, mensagem);
    return this;
  }

  cpf(mensagem = "CPF inválido") {
    this.addValidation((valor) => BashValidate.validCPF(valor), mensagem);
    return this;
  }

  email(mensagem = "E-mail inválido") {
    this.addValidation(
      (valor) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor),
      mensagem
    );
    return this;
  }

  telefone(mensagem = "Telefone inválido") {
    const regexTelefone = /^(\(?\d{2}\)?\s?)?(\d{4,5})-?(\d{4})$/;
    this.addValidation((valor) => regexTelefone.test(String(valor)), mensagem);
    return this;
  }

  min(tamanho, mensagem = null) {
    this.addValidation((valor) => {
      const strValue = String(valor);
      const numValue = Number(valor);

      if (!isNaN(numValue) && isFinite(numValue)) {
        return numValue >= tamanho;
      }
      return strValue.length >= tamanho;
    }, mensagem ?? `Valor mínimo: ${tamanho}`);
    return this;
  }

  max(tamanho, mensagem = null) {
    this.addValidation((valor) => {
      const strValue = String(valor);
      const numValue = Number(valor);

      if (!isNaN(numValue) && isFinite(numValue)) {
        return numValue <= tamanho;
      }
      return strValue.length <= tamanho;
    }, mensagem ?? `Valor máximo: ${tamanho}`);
    return this;
  }

  number(mensagem = "O valor deve ser um número") {
    this.addValidation((valor) => {
      if (valor === "" || valor === null || valor === undefined) return false;
      const num = Number(valor);
      return !isNaN(num) && isFinite(num);
    }, mensagem);
    return this;
  }

  string(mensagem = "O valor deve ser uma string") {
    this.addValidation(
      (valor) => typeof valor === "string" || valor instanceof String,
      mensagem
    );
    return this;
  }

  boolean(mensagem = "O valor deve ser verdadeiro ou falso") {
    this.addValidation((valor) => typeof valor === "boolean", mensagem);
    return this;
  }

  array(mensagem = "O valor deve ser uma lista (array)") {
    this.addValidation((valor) => Array.isArray(valor), mensagem);
    return this;
  }

  date(mensagem = "Data inválida") {
    this.addValidation((valor) => {
      if (Object.prototype.toString.call(valor) === "[object Date]") {
        return !isNaN(valor.getTime());
      }
      if (typeof valor === "string") {
        const data = new Date(valor);
        return !isNaN(data.getTime());
      }
      return false;
    }, mensagem);
    return this;
  }

  object(mensagem = "Deve ser um objeto válido") {
    this.addValidation(
      (valor) =>
        typeof valor === "object" && valor !== null && !Array.isArray(valor),
      mensagem
    );
    return this;
  }

  execute() {
    // CORREÇÃO: this.validacoes -> this.validations
    for (const { fn, message } of this.validations) {
      this.$input.off("input change").on("input change", () => {
        this.el.setCustomValidity("");
      });
      if (!fn(this.valor)) {
        this.el.setCustomValidity(message);
        this.el.reportValidity();
        this.el.classList.add("input-error");
        return false;
      }
    }

    this.el.setCustomValidity("");
    this.el.classList.remove("input-error");
    return true;
  }

  isValid() {
    return this.execute();
  }

  static validCPF(cpf) {
    cpf = String(cpf).replace(/[^\d]+/g, "");
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

    let soma = 0;
    for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
    let resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf[9])) return false;

    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    return resto === parseInt(cpf[10]);
  }

  senha(message = "Senha fraca") {
    const value = this.el.val();
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/;

    if (!regex.test(value)) {
      this.el[0].setCustomValidity(message);
      return false;
    }

    this.el[0].setCustomValidity("");
    return true;
  }
}
