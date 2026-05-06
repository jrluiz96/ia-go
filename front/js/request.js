var locationVar = window.document.location;

var controller = function () {
  if (locationVar.protocol == "http:") {
    // const port = parseInt(locationVar.port) - 1;
    const port = 9223;
    const url = locationVar.origin;
    // return "https://apiv2.bashtechnology.com.br/api";
    return url.replace(locationVar.port, port) + "/api";
  } else {
    return "/api";
  }
};



function req(url, type = "POST", data, success, error) {
  let token = localStorage.getItem("token");
  if (token == null && !url.includes("open")) {
    deslogar();
  }
  let headers = {
    "Content-Type": "application/json",
    "Content-Type": "external",
  };
  if (token != null) {
    headers.Authorization = token;
  }

  $.ajax({
    data: data ? JSON.stringify(data) : "",
    type: type,
    url: controller() + "/" + url,
    headers: headers,
    success: function (res) {
      success(res);
    },
    error: function (res) {
      res = res.responseJSON;
      if (res && res.code == 401) {
        deslogar();
        return;
      }
      error(res);
    },
  });
}
function deslogar() {
  let token = localStorage.getItem("token");
  localStorage.clear();
  
  if (token) {
    // Faz o logout apenas se tiver token
    $.ajax({
      type: 'POST',
      url: controller() + "/v1/sessao/logout",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token
      },
      success: function (res) {
        window.location.replace("/login.html");
      },
      error: function () {
        window.location.replace("/login.html");
      }
    });
  } else {
    window.location.replace("/login.html");
  }
}
function reqIfError(url, type = "POST", data, success, error) {
  let token = localStorage.getItem("token");
  if (token == null && !url.includes("open")) {
    deslogar();
  }
  let headers = {
    "Content-Type": "application/json",
    "Content-Type": "external",
  };
  if (token != null) {
    headers.Authorization = token;
  }

  $.ajax({
    data: data ? JSON.stringify(data) : "",
    type: type,
    url: controller() + "/" + url,
    headers: headers,
    success: function (res) {
      success(res);
    },
    error: function (res) {
      res = res.responseJSON;
      if (res && res.code == 401) {
        deslogar();
        return;
      }
      error(res);
    },
  });
}
function reqWebbot(url, type = "POST", data, success, error) {
  let headers = {
    "Content-Type": "application/json",
    "Content-Type": "external",
    Authorization: "Token BTNDoz91G0j@kn3Qo43Wym1t4717io0TOY7Mwi_VKReXVtmYvOiy",
  };
  $.ajax({
    data: data ? JSON.stringify(data) : "",
    type: type,
    url: "https://webbot.bashtechnology.com.br/api" + "/" + url,
    // url: "http://localhost:9060/api" + "/" + url,
    headers: headers,
    success: function (res) {
      success(res);
    },
    error: function (res) {
      if (!res.responseJSON && res.statusText == "error") {
        avisos(
          "Api Indisponível",
          "Entrar em contato com a equipe da Bash.",
          "rose-700"
        );
        setTimeout(deslogar, 3000);
        return;
      }
      res = res.responseJSON;
      if (res && res.status == 401) {
        deslogar();
        return;
      }
      error(res);
    },
  });
}
function reqAjuda(url, type = "POST", data, success, error, attempts = 3) {
  let headers = {
    "Content-Type": "application/json",
  };
  const tryRequest = (remainingAttempts) => {
    $.ajax({
      data: data ? JSON.stringify(data) : "",
      type: type,
    //  url: "https://webbot.bashtechnology.com.br/gpt" + "/" + url,
      url: controller() + "/gpt/" + url,
      headers: headers,
      success: function (res) {
        success(res);
      },
      error: function (res) {
        if (remainingAttempts > 1) {
          console.warn(
            `Tentativa falhou. Restando ${remainingAttempts - 1} tentativas...`
          );
          setTimeout(() => {
            tryRequest(remainingAttempts - 1);
          }, 500);
          return;
        }
        if (!res.responseJSON && res.statusText === "error") {
          avisos(
            "API Indisponível",
            "Entrar em contato com a equipe da Bash.",
            "rose-700"
          );
          return;
        }
        res = res.responseJSON;
        if (res && res.status == 401) {
          // deslogar();
          return;
        }
        error(res);
      },
    });
  };
  tryRequest(attempts);
}
function reqAsync(url, type = "POST", data) {
  return new Promise((resolve, reject) => {
    let token = localStorage.getItem("token");
    if (token == null && !url.includes("open")) {
      deslogar();
      return;
    }
    let headers = {
      "Content-Type": "application/json",
      "Content-Type": "external",
    };
    if (token != null) {
      headers.Authorization = token;
    }

    $.ajax({
      data: data ? JSON.stringify(data) : "",
      type: type,
      url: controller() + "/" + url,
      headers: headers,
      success: function (res) {
        resolve(res);
      },
      error: function (res) {
        res = res.responseJSON;
        if (res && res.code == 401) {
          deslogar();
          return;
        }
        reject(res);
      },
    });
  });
}
function fetchAsync(url, method = "POST", body = null, options = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      let token = localStorage.getItem("token");
      if (token == null && !url.includes("open")) {
        deslogar();
        return;
      }

      // Headers padrão
      let headers = {
      };

      // Adicionar token se existir
      if (token != null) {
        headers.Authorization = token;
      }

      // Processar body e Content-Type
      let processedBody = body;

      // Se não for FormData, converter para JSON e definir Content-Type
      if (body && !(body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
        processedBody = JSON.stringify(body);
      }
      // Para FormData, deixar o browser definir o Content-Type automaticamente

      // Mesclar headers customizados
      if (options.headers) {
        headers = { ...headers, ...options.headers };
      }

      // Fazer a requisição
      const response = await fetch(controller() + "/" + url, {
        method: method,
        headers: headers,
        body: processedBody,
        ...options,
      });

      // Verificar se a resposta é JSON
      const contentType = response.headers.get("content-type");
      let result;

      if (contentType && contentType.includes("application/json")) {
        result = await response.json();
      } else {
        result = await response.text();
      }

      // Verificar status de autenticação
      if (result && result.code == 401) {
        deslogar();
        return;
      }

      // Resolver com o resultado
      if (response.ok) {
        resolve(result);
      } else {
        reject(result);
      }
    } catch (error) {
      reject(error);
    }
  });
}
function reqAsyncSuporte(url, type = "POST", data) {
  return new Promise((resolve, reject) => {
    let token = localStorage.getItem("token");
    if (token == null && !url.includes("open")) {
      deslogar();
      return;
    }
    let headers = {
      "Content-Type": "application/json",
      "Content-Type": "external",
    };
    if (token != null) {
      headers.Authorization = token;
    }

    $.ajax({
      data: data ? JSON.stringify(data) : "",
      type: type,
      // url: "https://suporte.bashtechnology.com.br/api" + "/" + url,
      url: "http://localhost:9230/api" + "/" + url,
      headers: headers,
      success: function (res) {
        resolve(res);
      },
      error: function (res) {
        res = res.responseJSON;
        if (res && res.code == 401) {
          deslogar();
          return;
        }
        reject(res);
      },
    });
  });
}