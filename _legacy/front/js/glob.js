var GlobElmentos = false;
var GlobGetSession = false;
var GlobGetSessionID = false;
var PageStart = false;
var PageAtual = false;
var loaders = {};
var scripts = [];
var ProfileSession = {};
var chatIaInstance = null; // Singleton para o chat IA
var empresas = [];

function loadProgressElement(id, show) {
  const container = document.getElementById(id);
  if (!container) return;

  const progressBar = container.querySelector("progress");
  if (!progressBar) return;

  if (!loaders[id]) {
    loaders[id] = {
      progress: 0,
      animating: false,
      frameId: null,
    };
  }

  const loader = loaders[id];

  if (show) {
    loader.progress = 0;
    loader.animating = true;
    progressBar.value = loader.progress;
    container.classList.remove("hidden");

    const animate = () => {
      if (!loader.animating) return;

      if (loader.progress < 90) {
        loader.progress += 0.5;
        progressBar.value = loader.progress;
        loader.frameId = requestAnimationFrame(animate);
      } else {
        cancelAnimationFrame(loader.frameId);
      }
    };

    loader.frameId = requestAnimationFrame(animate);
  } else {
    loader.animating = false;

    const animateToEnd = () => {
      if (loader.progress < 100) {
        loader.progress += 2;
        progressBar.value = loader.progress;
        requestAnimationFrame(animateToEnd);
      } else {
        setTimeout(() => {
          container.classList.add("hidden");
          progressBar.value = 0;
          // Limpa o estado se quiser que seja resetado para próximas execuções
          delete loaders[id];
        }, 300);
      }
    };

    animateToEnd();
  }
}
function formatarMensagem(texto) {
  // chat
  if (!texto) return "";

  // Processa listas de opções (para mensagens de bot)
  if (
    texto.includes("Selecione uma opção") ||
    texto.includes("Por favor, escolha")
  ) {
    const lines = texto.split("\n");
    return lines
      .map((line) => {
        if (line.match(/^\d+\.\s/) || line.match(/^-\s/)) {
          return `<div class="py-1 pl-4 border-l-2 border-info/50">${line}</div>`;
        }
        return line + "<br>";
      })
      .join("");
  }

  // Formatação geral
  return texto
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // Negrito
    .replace(/\*(.*?)\*/g, "<em>$1</em>") // Itálico
    .replace(/\n/g, "<br>") // Quebras de linha
    .replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" class="link link-info" style="color: #000000 !important; text-decoration: underline;">$1</a>'
    ); // Links
}
function loadElement(target, bl) {
  let $element;

  // Identifica se é jQuery, HTML ou string (id)
  if (typeof target === "string") {
    $element = $(`#${target}`);
  } else if (isJqueryElement(target)) {
    $element = target;
  } else if (isHtmlElement(target)) {
    $element = $(target);
  } else {
    console.warn("Elemento inválido passado para loadElement");
    return;
  }

  if (!$element.length) return;

  const id = $element.attr("id");
  if (!id) {
    console.warn("Elemento precisa ter um ID para usar loadElement");
    return;
  }

  const spinnerId = `${id}Load`;

  if (bl) {
    // Adiciona spinner se não existir
    if (!$(`#${spinnerId}`).length) {
      $element.append(`
        <div id="${spinnerId}" class="ml-2 inline-block loading-sm loading loading-spinner text-primary"></div>
      `);
    }
    $element.prop("disabled", true);
  } else {
    $(`#${spinnerId}`).remove();
    $element.prop("disabled", false);
  }
}
function avisos(titulo, mensagem, tipo = "primary") {
  const toastContainer = document.getElementById("liveToast");

  // Mapeamento de cores com valores hexadecimais
  const colorMap = {
    primary: {
      bg: "#DBEAFE", // blue-100
      border: "#BFDBFE", // blue-200
      dot: "#3B82F6", // blue-500
    },
    success: {
      bg: "#D1FAE5", // green-100
      border: "#A7F3D0", // green-200
      dot: "#10B981", // green-500
    },
    warning: {
      bg: "#FEF3C7", // yellow-100
      border: "#FDE68A", // yellow-200
      dot: "#F59E0B", // yellow-500
    },
    error: {
      bg: "#FEE2E2", // red-100
      border: "#FECACA", // red-200
      dot: "#EF4444", // red-500
    },
    info: {
      bg: "#E0F2FE", // sky-100
      border: "#BAE6FD", // sky-200
      dot: "#0EA5E9", // sky-500
    },
  };

  // Usar tipo padrão se não for válido
  const colors = colorMap[tipo] || colorMap.primary;

  // Criar elemento toast
  const toast = document.createElement("div");
  toast.style.cssText = `
    max-width: 24rem;
    width: 100%;
    background-color: white;
    border-radius: 0.5rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    margin-bottom: 0.5rem;
    overflow: hidden;
    border: 1px solid ${colors.border};
    animation: fadeInToast 0.3s ease-in-out;
  `;

  // Conteúdo do toast
  toast.innerHTML = `
    <div style="
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 1rem;
      border-bottom: 1px solid ${colors.border};
      background-color: ${colors.bg};
    ">
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <div style="
          width: 0.75rem;
          height: 0.75rem;
          border-radius: 9999px;
          background-color: ${colors.dot};
        "></div>
        <strong style="
          color: #1F2937;
          font-size: 0.875rem;
          line-height: 1.25rem;
          font-weight: 600;
        ">${titulo}</strong>
      </div>
      <button type="button" style="
        color: #6B7280;
        background: none;
        border: none;
        cursor: pointer;
        font-size: 1.25rem;
        line-height: 1;
      " onclick="this.parentElement.parentElement.remove()">
        &times;
      </button>
    </div>
    <div style="
      padding: 0.75rem 1rem;
      color: #374151;
      font-size: 0.875rem;
      line-height: 1.25rem;
      background-color: white;
    ">${mensagem}</div>
  `;

  // Adicionar ao container
  toastContainer.appendChild(toast);

  // Remover automaticamente após 5 segundos com animação
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}
function primeiroCaracterMaiusculo(variavel) {
  variavel = manipula(variavel);
  if (variavel != " - ") {
    variavel = variavel.toLowerCase().replace(/(?:^|\s)\S/g, function (a) {
      return a.toUpperCase();
    });
  }
  return variavel;
}
function manipula(item) {
  if (
    item == null ||
    item == "undefined" ||
    item == "" ||
    item == 0 ||
    item == "NaN"
  ) {
    return " - ";
  } else {
    return item;
  }
}
function formatarData(data) {
  if (!data) return " - ";
  
  // Data já vem no fuso correto do banco, apenas formatar
  const dt = data.replace('Z', '').replace('T', ' ').split('.')[0];
  const [datePart, timePart] = dt.split(' ');
  const [year, month, day] = datePart.split('-');
  
  if (!timePart) {
    return `${day}/${month}/${year}`;
  }
  
  return `${day}/${month}/${year} ${timePart}`;
}
function formatDate(date) {
  return date.toISOString().split("T")[0]; // Retorna YYYY-MM-DD
}
function formatTimestampToDuration(timestamp) {
  if (!timestamp) return "00:00:00";

  const diff = (Date.now() - timestamp * (timestamp < 1e12 ? 1000 : 1)) / 1000;
  if (diff < 0) return "00:00:00";

  const pad = (n) => n.toString().padStart(2, "0");
  return [
    pad(Math.floor(diff / 3600)),
    pad(Math.floor((diff % 3600) / 60)),
    pad(Math.floor(diff % 60)),
  ].join(":");
}
function formatSegToDuration(segundos) {
  if (typeof segundos !== "number" || isNaN(segundos)) return "00:00:00";

  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const segundosRestantes = segundos % 60;

  const pad = (n) => String(n).padStart(2, "0");

  return `${pad(horas)}:${pad(minutos)}:${pad(segundosRestantes)}`;
}
function formatarHora(dateTimeString) {
  if (!dateTimeString) return "";
  const [datePart, timePart] = dateTimeString.split(" ");
  if (!timePart) return "";
  return timePart.substring(0, 5); // Retorna apenas HH:MM
}
function formatarTelefone(numero) {
  if (!numero) return "--";
  // Remove todos os caracteres não numéricos
  const apenasNumeros = numero.toString().replace(/\D/g, "");
  // Verifica se tem código de país (55) e remove
  let numerosFormatados = apenasNumeros;
  if (apenasNumeros.length > 11 && apenasNumeros.startsWith("55")) {
    numerosFormatados = apenasNumeros.substring(2);
  }
  // Aplica a formatação de acordo com o tamanho
  if (numerosFormatados.length === 11) {
    // Com 9º dígito: (47) 99286-9383
    return numerosFormatados.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  } else if (numerosFormatados.length === 10) {
    // Sem 9º dígito: (47) 9286-9383
    return numerosFormatados.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  } else if (numerosFormatados.length === 9) {
    // Apenas número com 9º dígito: 99286-9383
    return numerosFormatados.replace(/(\d{5})(\d{4})/, "$1-$2");
  } else if (numerosFormatados.length === 8) {
    // Apenas número sem 9º dígito: 9286-9383
    return numerosFormatados.replace(/(\d{4})(\d{4})/, "$1-$2");
  }
  // Se não se encaixar em nenhum padrão, retorna o original
  return numero;
}
function escapeHtml(unsafe) {
  if (!unsafe) return "";
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function carregarGlobais() {
  // Carrega os elementos globais
  if (GlobElmentos) return;
  GlobElmentos = {
    NomePage: $("#nomePage"),
    Conteudo: $("#conteudoPage"),
    LoadSessao: $("#loadSessao"),
    PageCarregada: $(".NloadSessao"),
    MenuPrincipal: $("#menu-principal"),
    NotificarUsuario: $("#bash-notification-icon"),
  };
}
function getUserSession() {
  if (!localStorage.getItem("usuario")) return;
  return JSON.parse(localStorage.getItem("usuario"));
}

function initChatIA() {
  // Verifica se já existe uma instância
  if (chatIaInstance) {
    return chatIaInstance;
  }
  
  // Verifica se a função existe
  if (typeof wbCreateApp !== 'function') {
    return null;
  }
  
  // Cria o chat
  const chat = wbCreateApp();
  
  if (chat) {
    chatIaInstance = chat;
    $("body").append(chat);
    return chat;
  } else {
    return null;
  }
}
var gestaoList = [];
var pagesEscondidasList = [];
function carregarMenu() {
  carregarGlobais();
  GlobElmentos.MenuPrincipal.empty();
  let html = "";
  let controleGestao = false;

  GlobGetSession.sort((a, b) => a.peso - b.peso).forEach((e) => {
    if (e.url.split("/").length == 1 && e.peso && e.peso > 0) {
      html += `<li class="menu-item">
                    <a class="" href="javascript:carregarPage('${e.url}')" id="menu-${e.url}">
                        <i class="${e.icone}"></i>
                        ${e.nome}
                    </a>
                </li>`;
    } else if (e.url.split("/").length < 4 && e.url.split("/")[0] == "gestao") {
      if (!controleGestao) {
        controleGestao = [];
      }
      controleGestao.push(e);
    }else{
      pagesEscondidasList.push(e);
    }
  });

  if (controleGestao) {
    html += '<div class="divider mt-4 mb-0"></div>';
    html += '<span class="font-semibold m-1">Gestão</span>';
    controleGestao.forEach((e) => {
      if (e.url.split("/").length == 2) {
        html += `<li class="menu-item">
                        <a class="" href="javascript:carregarPage('${
                          e.url
                        }')" id="menu-${e.url.replace("/", "-")}">
                            <i class="${e.icone}"></i>
                            ${e.nome}
                        </a>
                    </li>`;
      } else {
        splitE = e.url.split("/");
        pos = splitE[0] + "/" + splitE[1];
        if (!gestaoList[pos]) {
          gestaoList[pos] = [];
        }
        gestaoList[pos].push(e);
      }
    });
  }
  GlobElmentos.MenuPrincipal.append(html);
}
function carregarPage(page) {
  const overlay = document.getElementById("offcanvas-overlay");
  const offcanvas = document.getElementById("offcanvas-menu");
  if (page == PageAtual) return false;

    // ============ SISTEMA DE CLEANUP ============
    console.log('🔄 Iniciando troca de página:', page);
    console.log('📍 Página atual antes da troca:', PageAtual);
    
    // Destruir sessão anterior se existir
    if (typeof window.destroySessao === "function") {
        try {
            console.log('🧹 Executando cleanup da sessão anterior...');
            window.destroySessao();
            // Não deletar a função para permitir cleanup futuro
            console.log('✅ Cleanup executado com sucesso');
        } catch (e) {
            console.warn("❌ Erro ao destruir a sessão anterior:", e);
        }
    } else {
        console.log('⚠️ Função destroySessao não encontrada - sem cleanup necessário');
    }  // Cleanup adicional para sistemas específicos
  if (typeof window.bashAtendimentoOmni != "undefined") {
    try {
      window.bashAtendimentoOmni.destroy();
    } catch (e) {
      console.warn('Erro ao destruir bashAtendimentoOmni:', e);
    }
  }
  if (typeof window.bashAtendimento != "undefined") {
    try {
      window.bashAtendimento.destroy();
    } catch (e) {
      console.warn('Erro ao destruir bashAtendimento:', e);
    }
  }

  PageAtual = page;
  localStorage.setItem("PageAtual", PageAtual);

  $(`.menu-item a`).removeClass("bg-primary text-primary-content");
  $("#menu-" + page.replaceAll("/", "-")).addClass("bg-primary text-primary-content");
  GlobElmentos.Conteudo.empty();
  let pageName = false;
  GlobGetSession.forEach((e) => {
    if (e.url == page) {
      pageName = e.nome;
    }
  });
  if('suporte' == page){
      pageName = "Suporte";
  }

  if (!pageName) {
    avisos("Sessão", "Usuário não possui acesso a esta tela", "error");
    carregarPage(PageStart);
    return false;
  }

  GlobElmentos.NomePage.text(pageName);

  if (
    page == "atendimentos" &&
    localStorage.getItem("limparAtendimento") == "false" &&
    localStorage.getItem("oldPage") != "atendimentos"
  ) {
    localStorage.setItem("limparAtendimento", true);
    window.location.reload(true);
  } else {
    localStorage.setItem("limparAtendimento", false);
  }

  console.log('📄 Carregando nova página:', page);
  GlobElmentos.Conteudo.load(
    `/sessao/${page}/index.html?_=${new Date().getTime()}`
  );

  // GlobElmentos.LoadSessao.hide(500);
  // GlobElmentos.PageCarregada.show(1500);
  GlobElmentos.LoadSessao.fadeOut(1000, function () {
    GlobElmentos.PageCarregada.fadeIn(1000);
    $("body").removeClass("overflow-hidden");
    
    // Inicializa o chat IA (singleton - só cria uma vez)
    initChatIA();
  });
  offcanvas.classList.add("translate-x-full");

  overlay.classList.add("hidden");
  localStorage.setItem("oldPage", PageAtual);
}
function temaSystem(tema) {
  if (tema) {
    localStorage.setItem("tema", tema);
  } else {
    tema = localStorage.getItem("tema");
  }
  const html = document.documentElement;
  html.setAttribute("data-theme", tema);
}
function preLoadTela() {
  const objTela =
    GlobGetSession[GlobGetSession.findIndex((item) => item.url === PageAtual)]
      .ferramentas;
  return objTela;
}
function filterTable(tableId, filter) {
  let table = document.getElementById(tableId);
  let rows = table.querySelectorAll("tbody tr");
  let hasVisibleRows = false;
  if (!filter || filter.trim() === "") {
    rows.forEach((row) => {
      row.style.display = "";
    });
    return;
  }
  let filterText = filter.toLowerCase();
  rows.forEach((row) => {
    // Verifica se a linha é a linha vazia (quando não há itens)
    if (row.querySelector("td[colspan]")) {
      row.style.display = "none";
      return;
    }

    // Obtém todo o texto da linha em minúsculas
    let rowText = row.textContent.toLowerCase();

    // Mostra ou esconde a linha baseado no filtro
    if (rowText.includes(filterText)) {
      row.style.display = "";
      hasVisibleRows = true;
    } else {
      row.style.display = "none";
    }
  });
  if (!hasVisibleRows) {
    let emptyRow = document.createElement("tr");
    emptyRow.className = "border-b border-gray-800";
    emptyRow.innerHTML = `
            <td colspan="7" class="text-center py-4">
                <div class="flex flex-col items-center justify-center gap-2 text-gray-500">
                    <i class="fas fa-search fa-2x"></i>
                    <span>Nenhum item encontrado</span>
                </div>
            </td>
        `;

    // Remove a mensagem anterior se existir
    let existingEmptyRow = table.querySelector(
      "tbody tr[style*='display: none']"
    );
    if (existingEmptyRow && existingEmptyRow.querySelector("td[colspan]")) {
      existingEmptyRow.remove();
    }

    table.querySelector("tbody").appendChild(emptyRow);
  } else {
    // Remove a mensagem de "Nenhum item encontrado" se existir
    let emptyRow = table.querySelector("tbody tr td[colspan='7']");
    if (emptyRow && emptyRow.textContent.includes("Nenhum item encontrado")) {
      emptyRow.closest("tr").remove();
    }
  }
}
temaSystem();

function carregarFiltroDataHora(id_ini, id_fim, tipo) {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  let dIni, dFim;

  if (tipo == "hoje" || tipo == 1) {
    dIni = new Date(today.setHours(0, 0, 0, 0));
    dFim = new Date(today.setHours(23, 59, 0, 0));
  } else if (tipo == "semana" || tipo == 2) {
    const dayOfWeek = today.getDay();
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
    dIni = new Date(today);
    dIni.setDate(today.getDate() + diffToMonday);
    dIni.setHours(0, 0, 0, 0);
    dFim = new Date(today);
    dFim.setHours(23, 59, 0, 0);
  } else if (tipo == "mes" || tipo == 3) {
    dIni = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
    dFim = new Date(today.setHours(23, 59, 0, 0));
  } else if (tipo == "30" || tipo == 4) {
    dIni = new Date(today);
    dIni.setDate(today.getDate() - 30);
    dIni.setHours(0, 0, 0, 0);
    dFim = new Date(today.setHours(23, 59, 0, 0));
  }

  if (dIni && dFim) {
    const format = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(
        d.getMinutes()
      ).padStart(2, "0")}`;
    document.getElementById(id_ini).value = format(dIni);
    document.getElementById(id_fim).value = format(dFim);
  }
}

function carregarFiltroData(id_ini, id_fim, tipo) {
  tipo = parseInt(tipo);
  let today = new Date();
  let dIni = new Date();
  let dFim = new Date();
  switch (tipo) {
    case 1: // Hoje
      dIni = new Date(today);
      dFim = new Date(today);
      break;
    case 2: // Semana
      dIni.setDate(today.getDate() - today.getDay()); // Domingo da semana atual
      dFim = new Date(today); // Hoje
      break;
    case 3: // Mês
      dIni = new Date(today.getFullYear(), today.getMonth(), 1); // Primeiro dia do mês
      dFim = new Date(today); // Hoje
      break;
    case 4: // Últimos 30 dias
      dIni.setDate(today.getDate() - 30);
      dFim = new Date(today); // Hoje
      break;
    case 0: // Limpar
    default:
      dIni = "";
      dFim = "";
      break;
  }
  $(`#${id_ini}`).val(dIni ? formatDate(dIni) : "");
  $(`#${id_fim}`).val(dFim ? formatDate(dFim) : "");
}

function exportarPDFComMultiplasTabelas(
  htmlString,
  nomeArquivo,
  idElementLoad
) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape" });
  let y = 10;

  const container = document.getElementById("html2pdfDownload");
  container.innerHTML = htmlString;

  const elementos = container.childNodes;

  elementos.forEach((el) => {
    if (el.tagName === "H6") {
      const titulo = el.innerText || el.textContent;
      doc.setFontSize(12);
      if (y > 260) {
        doc.addPage();
        y = 10;
      }
      doc.text(titulo, 14, y);
      y += 6;
    }

    if (el.tagName === "TABLE") {
      doc.autoTable({
        html: el,
        startY: y,
        theme: "grid",
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
      });

      y = doc.lastAutoTable.finalY + 10;
    }
  });

  doc.save(nomeArquivo + ".pdf");
  loadElement(idElementLoad, 0);
}
function exportarPDFfromHtml(htmlString, nomeArquivo, idElementLoad) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 10;

  const container = document.createElement("div");
  container.innerHTML = htmlString;
  document.body.appendChild(container);

  // Processar seções principais
  const sections = container.querySelectorAll(".bg-base-200.rounded-lg");

  sections.forEach((section) => {
    // Adicionar título da seção
    const sectionTitle = section.querySelector("h3");
    if (sectionTitle) {
      if (y > 260) {
        doc.addPage();
        y = 10;
      }

      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.text(sectionTitle.textContent.trim(), 14, y);
      y += 10;
    }

    // Processar cards de cada seção
    const cards = section.querySelectorAll(".card");
    if (cards.length > 0) {
      cards.forEach((card) => {
        if (y > 260) {
          doc.addPage();
          y = 10;
        }

        // Título do card
        const cardTitle = card.querySelector(".card-title");
        if (cardTitle) {
          doc.setFontSize(12);
          doc.setTextColor(41, 128, 185);
          doc.setFont("helvetica", "bold");
          doc.text(cardTitle.textContent.trim(), 14, y);
          y += 7;
        }

        // Conteúdo do card
        const contentElements = card.querySelectorAll("div:not(.rating)");
        contentElements.forEach((el) => {
          if (el.textContent.trim() && !el.classList.contains("rating")) {
            if (y > 260) {
              doc.addPage();
              y = 10;
            }

            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            doc.setFont("helvetica", "normal");
            doc.text(el.textContent.trim(), 14, y);
            y += 5;
          }
        });

        y += 5; // Espaço entre cards
      });
    } else {
      // Se não houver cards, verifica se há mensagem de informação
      const alert = section.querySelector(".alert");
      if (alert) {
        if (y > 260) {
          doc.addPage();
          y = 10;
        }

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.setFont("helvetica", "italic");
        doc.text(alert.textContent.trim(), 14, y);
        y += 10;
      }
    }

    y += 10; // Espaço entre seções
  });

  // Remover container temporário
  document.body.removeChild(container);

  doc.save(nomeArquivo + ".pdf");
  loadElement(idElementLoad, 0);
}
function getFilter(formId) {
  const filtro = {};
  const form = document.getElementById(formId);

  form.querySelectorAll("input, select, textarea").forEach((element) => {
    const nome = element.name;
    const valor = element.value;

    if (nome) filtro[nome] = valor;
  });

  return filtro;
}

function popularSelect(selectIdOrName, dados, campoLabel, campoValue = null) {
  const select =
    document.getElementById(selectIdOrName) ||
    document.querySelector(`select[name="${selectIdOrName}"]`);

  if (!select) {
    console.warn(
      `Elemento <select> com id ou name "${selectIdOrName}" não encontrado.`
    );
    return;
  }

  // Limpa o select e adiciona opção padrão
  select.innerHTML = '<option value="" disabled selected>Selecione</option>';

  // Garante que dados seja sempre um array de objetos
  let lista = [];
  if (Array.isArray(dados)) {
    lista = dados;
  } else if (typeof dados === "object" && dados !== null) {
    lista = Object.values(dados);
  } else {
    console.warn("Dados para popularSelect não são válidos:", dados);
    return;
  }

  lista.forEach((item) => {
    // Garante que item seja um objeto
    if (typeof item !== "object" || item === null) return;
    const option = document.createElement("option");
    option.textContent = item[campoLabel];

    // Se campoValue for null, tenta usar item.id ou ignora
    option.value = campoValue
      ? item[campoValue]
      : item.id !== undefined
      ? item.id
      : item[campoLabel]; // fallback para casos simples

    select.appendChild(option);
  });
}

function carregarTela(path) {
  const page = GlobGetSession.find((el) => (el.url = path));
  GlobElmentos.NomePage.text(page.nome);
  GlobElmentos.Conteudo.load(
    `/sessao/${page.url}/index.html?_=${new Date().getTime()}`
  );
  GlobElmentos.LoadSessao.fadeOut(1000, function () {
    GlobElmentos.PageCarregada.fadeIn(1000);
    $("body").removeClass("overflow-hidden");
    
    // Inicializa o chat IA (singleton - só cria uma vez)
    initChatIA();
  });
}

function popularTable(id, data, maxRows = Infinity) {
  const table = document.getElementById(id);
  if (!table) return;
  let contador = 0;
  table.innerHTML = "";

  const limit = Math.min(data.length, maxRows);

  for (let i = 0; i < limit; i++) {
    const row = document.createElement("tr");
    row.id = contador++;

    const item = data[i];
    for (const key in item) {
      const cell = document.createElement("td");
      cell.textContent = item[key];
      row.appendChild(cell);
    }

    table.appendChild(row);
  }
}

function downloadFileByUrl(downloadUrl, nomeArquivo = "arquivo") {
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(downloadUrl);
  a.remove();
}

function createAccordion(id = "", title = "") {
  const accordion = document.createElement("div");
  const accordionTitle = document.createElement("div");
  const accordionButton = document.createElement("button");
  const accordionContent = document.createElement("div");
  const icon = document.createElement("i");

  // Ícone
  icon.className = "fa-solid fa-angle-right";
  icon.setAttribute("data-icon", "");

  // Classes dos elementos
  accordion.className =
    "accordion w-full border border-base-100 bg-base-100 rounded-xl flex-col gap-2 border-b p-3 border-neutral pr-2";
  accordionTitle.className =
    "accordion-title flex flex-row justify-between items-center w-full";
  accordionButton.className =
    "p-4 flex-1 flex justify-start gap-2 items-center font-semibold py-2";
  accordionContent.className =
    "accordion-content px-4 pb-4 w-full text-base-content";
  accordionContent.style.display = "none";

  accordionButton.textContent = title;
  accordionButton.prepend(icon);

  accordionButton.addEventListener("click", () => {
    toggleAccordion(accordionButton);
  });

  accordionTitle.appendChild(accordionButton);
  accordion.appendChild(accordionTitle);
  accordion.appendChild(accordionContent);

  accordionContent.innerHTML = ``;

  return { accordion, accordionButton, accordionContent };
}

function toggleAccordion(button) {
  const $button = $(button);
  const $accordion = $button.closest(".accordion");
  const $content = $accordion.find(".accordion-content");
  const $icon = $button.find("[data-icon]");

  const isOpen = !$content.is(":visible");
  const $siblings = $accordion.siblings(".accordion");
  $siblings.find(".accordion-content").slideUp();
  $siblings
    .find("[data-icon]")
    .removeClass("fa-angle-down")
    .addClass("fa-angle-right");
  $siblings.removeClass("bg-base-300");

  if (isOpen) {
    $accordion.addClass("bg-base-300");
    $content.slideDown();
    $icon.removeClass("fa-angle-right").addClass("fa-angle-down");
  } else {
    $accordion.removeClass("bg-base-300");
    $content.slideUp();
    $icon.removeClass("fa-angle-down").addClass("fa-angle-right");
  }
}

function createDropdownMenu({
  id,
  icon = "",
  label = "",
  items = [],
  classBtn = "",
}) {
  const wrapper = document.createElement("div");
  wrapper.className = "relative text-left dropdown dropdown-end";

  // Botão de toggle
  const button = document.createElement("button");
  button.className = classBtn ? classBtn : "btn btn-sm btn-ghost btn-circle";
  button.onclick = function () {
    toggleDropdown(button);
  };

  if (label) {
    button.textContent = label;
  }
  if (icon) {
    const i = document.createElement("i");
    i.className = icon;
    button.appendChild(i);
  }

  // Lista UL
  const ul = document.createElement("ul");
  ul.className =
    "menu dropdown-content dropdown-start bg-base-100 shadow rounded-box w-40 z-100 hidden absolute border border-base-300 text-base-content";
  ul.id = `dropdown-${id}`;

  // Itens do dropdown
  items.forEach(({ label, onClick }) => {
    const li = document.createElement("li");
    const itemButton = document.createElement("button");
    itemButton.textContent = label;
    if (itemButton.disabled) {
      itemButton.classList.add("disabled");
      itemButton.disabled = true;
    } else {
      itemButton.onclick = onClick;
    }
    li.appendChild(itemButton);
    ul.appendChild(li);
  });

  wrapper.appendChild(button);
  wrapper.appendChild(ul);

  const dropdown = wrapper;
  return dropdown;
}

function toggleDropdown(button) {
  const container =
    button.closest("[data-dropdown-container]") || button.parentElement;
  const dropdown = container?.querySelector(".dropdown-content");
  const isHidden =
    dropdown?.classList.contains("hidden") ||
    dropdown?.style.display === "none";

  document.querySelectorAll(".dropdown-content").forEach((menu) => {
    menu.classList.add("hidden");
    menu.classList.remove("block", "z-50");
  });

  if (isHidden && dropdown) {
    dropdown.classList.remove("hidden");
    dropdown.classList.add("block", "z-50");

    const handleClickOutside = (event) => {
      if (!button.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.classList.add("hidden");
        dropdown.classList.remove("block", "z-50");
        document.removeEventListener("click", handleClickOutside);
      }
    };

    setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);
  }
}

function hasSubPage(subpage) {
  const path = [PageAtual, subpage.toLowerCase()].join("_");
  const page = GlobGetSession.filter((el) => el.url === path);
  return page.length > 0 ? page : false;
}

function abrirModalRemocao({
  titulo = "",
  mensagem = "Tem certeza que você quer remover ?",
  labelRemover = "Remover",
  labelCancelar = "Cancelar",
  onConfirm = () => {},
} = {}) {
  // Define conteúdos dinâmicos
  $("#modal-remove-titulo").text(titulo);
  $("#modal-remove-mensagem").text(mensagem);
  $("#modal-remove-confirmar").text(labelRemover);
  $("#modal-remove-cancelar").text(labelCancelar);

  // Garante que o botão seja vermelho (erro)
  $("#modal-remove-confirmar")
    .removeClass("btn-primary btn-success btn-info btn-warning")
    .addClass("btn-error");

  $("#modal-remove-confirmar")
    .off("click")
    .on("click", () => {
      onConfirm();
      fecharModalRemocao();
    });

  $("#modal-remove-fechar").off("click").on("click", fecharModalRemocao);
  $("#modal-remove-cancelar").off("click").on("click", fecharModalRemocao);

  document.getElementById("modal-remove").showModal();
}

function abrirModalConfirmacao({
  titulo = "",
  mensagem = "",
  labelConfirmar = "Confirmar",
  labelCancelar = "Cancelar",
  tipo = "primary", // primary (azul), success (verde), warning (amarelo), error (vermelho)
  onConfirm = () => {},
} = {}) {
  // Define conteúdos dinâmicos
  $("#modal-remove-titulo").text(titulo);
  $("#modal-remove-mensagem").text(mensagem);
  $("#modal-remove-confirmar").text(labelConfirmar);
  $("#modal-remove-cancelar").text(labelCancelar);

  // Define a cor do botão baseado no tipo
  const btnClass = `btn-${tipo}`;
  $("#modal-remove-confirmar")
    .removeClass("btn-error btn-primary btn-success btn-info btn-warning")
    .addClass(btnClass);

  $("#modal-remove-confirmar")
    .off("click")
    .on("click", () => {
      onConfirm();
      fecharModalRemocao();
    });

  $(".modal-close-btn").off("click").on("click", fecharModalRemocao);

  document.getElementById("modal-remove").showModal();
}

function fecharModalRemocao() {
  document.getElementById("modal-remove").close();
}

//chamados
function wrapIfValid(valor) {
  return valor && valor !== "Selecione" ? [valor] : undefined;
}
function formatOptionData(data) {
  if (data == null) return [];
  return data.map((elemento) => ({
    label: elemento.nome,
    value: elemento.id,
  }));
}

//webbot
function generateMongoId() {
  const timestamp = Math.floor(new Date().getTime() / 1000).toString(16);
  const machineId = Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, "0");
  const processId = Math.floor(Math.random() * 65535)
    .toString(16)
    .padStart(4, "0");
  const counter = Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, "0");

  return timestamp + machineId + processId + counter;
}

function getImageTypeFromBase64(base64) {
  if (base64.startsWith("/9j") || base64.startsWith("iVBORw0KGgo")) {
    return "jpeg"; // Ou "png" para exemplos reais
  }
  return "png"; // Padrão
}

function carregarScript(src) {
  if (scriptJaFoiCarregado(src)) {
    console.log(`✅ Script ja foi carregado: ${src}`);
    return;
  }
  scripts.push(src);
  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  script.onload = () => {
    console.log(`✅ Script carregado: ${src}`);
  };
  script.onerror = () => {
    console.error(`❌ Erro ao carregar script: ${src}`);
  };
  document.head.appendChild(script);
}

function scriptJaFoiCarregado(src) {
  return Array.from(document.scripts).some((script) =>
    script.src.includes(src)
  );
}

function carregarPageOnId(id, route) {
  $(`#${id}`).load(`/sessao/${route}/index.html?_=${new Date().getTime()}`);
}

function criarTabelaCustom(title, colunas, rows, rowsPorPagina = 10) {
  const container = document.createElement("div");

  const divTitle = document.createElement("h1");
  divTitle.textContent = title;
  divTitle.className = "text-xl font-bold mb-4";

  if (!Array.isArray(colunas) || !Array.isArray(rows) || colunas.length === 0) {
    container.appendChild(divTitle);
    container.innerHTML = `<p class="text-center text-gray-500">Nenhum dado disponível</p>`;
    return container;
  }

  let paginaAtual = 1;
  const totalPaginas = Math.ceil(rows.length / rowsPorPagina);

  const tabela = document.createElement("table");
  tabela.className =
    "table w-full table-zebra border border-base-300 bg-base-100 text-base-content rounded shadow";

  const thead = document.createElement("thead");
  const trHead = document.createElement("tr");
  colunas.forEach((col) => {
    const th = document.createElement("th");
    th.className =
      "bg-base-200 text-base-content font-semibold px-4 py-2 border-b border-base-300";
    th.textContent = col.label;
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);

  const tbody = document.createElement("tbody");

  const wrapper = document.createElement("div");
  wrapper.className = "overflow-x-auto";
  tabela.appendChild(thead);
  tabela.appendChild(tbody);
  wrapper.appendChild(tabela);

  const pagination = document.createElement("div");
  pagination.className = "flex justify-end mt-4";
  const join = document.createElement("div");
  join.className = "join";
  pagination.appendChild(join);

  const renderTabela = () => {
    tbody.innerHTML = "";
    const start = (paginaAtual - 1) * rowsPorPagina;
    const end = Math.min(start + rowsPorPagina, rows.length);

    for (let i = start; i < end; i++) {
      const tr = document.createElement("tr");
      colunas.forEach((col) => {
        const td = document.createElement("td");
        td.textContent = rows[i][col.value] ?? "-";
        td.className = "border-b border-base-200 px-4 py-2";
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
  };

  const atualizarPaginacao = () => {
    join.innerHTML = "";

    const createPageBtn = (
      page,
      label = null,
      active = false,
      disabled = false
    ) => {
      const btn = document.createElement("button");
      btn.className = `join-item btn btn-xs${active ? " btn-active" : ""}`;
      btn.textContent = label || page;
      btn.disabled = disabled;
      btn.onclick = () => {
        paginaAtual = page;
        renderTabela();
        atualizarPaginacao();
      };
      return btn;
    };

    // Botão « anterior
    join.appendChild(
      createPageBtn(paginaAtual - 1, "«", false, paginaAtual === 1)
    );

    // Páginas visíveis
    let start = Math.max(1, paginaAtual - 2);
    let end = Math.min(totalPaginas, paginaAtual + 2);

    if (paginaAtual <= 3) end = Math.min(5, totalPaginas);
    if (paginaAtual >= totalPaginas - 2) start = Math.max(1, totalPaginas - 4);

    for (let i = start; i <= end; i++) {
      join.appendChild(createPageBtn(i, null, i === paginaAtual));
    }

    // Botão » próximo
    join.appendChild(
      createPageBtn(paginaAtual + 1, "»", false, paginaAtual === totalPaginas)
    );
  };

  renderTabela();
  if (totalPaginas > 1) atualizarPaginacao();

  container.appendChild(divTitle);
  container.appendChild(wrapper);
  if (totalPaginas > 1) container.appendChild(pagination);

  return container;
}

function isJqueryElement(el) {
  return el instanceof jQuery;
}

function isHtmlElement(el) {
  return el instanceof HTMLElement;
}

function sliceFile(file, chunkSize) {
  const chunks = [];
  let start = 0;
  let fileSize = file.size;

  while (start < fileSize) {
    const end = Math.min(start + chunkSize, fileSize);
    chunks.push({ blob: file.slice(start, end), index: start / chunkSize });
    start = end;
  }

  return chunks;
}

async function convertFilesToBase64(files) {
  const filesArray = Array.from(files);
  console.log(`📁 Iniciando conversão de ${filesArray.length} arquivo(s)...`);

  // Validar total de arquivos
  if (filesArray.length > 5) {
    throw new Error("Máximo de 5 arquivos permitidos");
  }

  // Validar tamanho total
  const totalSize = filesArray.reduce((acc, file) => acc + file.size, 0);
  const maxTotalSize = 50 * 1024 * 1024; // 50MB total
  if (totalSize > maxTotalSize) {
    throw new Error(
      `Tamanho total dos arquivos excede o limite de 50MB. Total atual: ${formatFileSize(
        totalSize
      )}`
    );
  }

  const promises = filesArray.map((file, index) => {
    console.log(
      `📄 Processando arquivo ${index + 1}/${filesArray.length}: ${file.name}`
    );
    return fileToBase64(file);
  });

  try {
    const base64Files = await Promise.all(promises);
    console.log("✅ Arquivos convertidos para base64:", base64Files.length);

    // Log do tamanho final dos dados
    const totalBase64Size = base64Files.reduce(
      (acc, file) => acc + file.url.length,
      0
    );
    console.log(
      `📊 Tamanho total em base64: ${formatFileSize(
        totalBase64Size * 0.75
      )}`
    ); // Aproximação do tamanho real
    
    return base64Files;
  } catch (error) {
    console.error("❌ Erro ao converter arquivos:", error);
    throw error;
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    // Validar tamanho do arquivo (máximo 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB em bytes
    if (file.size > maxSize) {
      reject(
        new Error(
          `Arquivo "${file.name}" é muito grande. Máximo permitido: 10MB`
        )
      );
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      // Remove o prefixo "data:tipo/mime;base64," para obter apenas o base64
      const base64 = reader.result.split(",")[1];

      resolve({
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
        url: base64,
      });
    };

    reader.onerror = () => {
      reject(new Error(`Erro ao ler arquivo: ${file.name}`));
    };

    reader.readAsDataURL(file);
  });
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function downloadFileFromBase64(base64Data, fileName, mimeType) {
  try {
    // Remove o prefixo "data:mime/type;base64," se existir
    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
    
    // Converte base64 para bytes
    const byteCharacters = atob(cleanBase64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType || 'application/octet-stream' });
    
    // Cria URL temporária e baixa o arquivo
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    
    document.body.appendChild(link);
    link.click();
    
    // Limpa recursos
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    console.log(`✅ Arquivo baixado: ${fileName}`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao baixar arquivo:', error);
    avisos('Erro', 'Erro ao fazer download do arquivo', 'error');
    return false;
  }
}

function copyToClipboard(text) {
  if (!navigator.clipboard) {
    console.warn('API de Clipboard não suportada');
    return;
  }
  
  navigator.clipboard.writeText(text).then(() => {
    console.log('✅ Texto copiado para a área de transferência');
    avisos('Sucesso', 'Texto copiado para a área de transferência', 'success');
  }).catch(err => {
    console.error('❌ Erro ao copiar texto: ', err);
    avisos('Erro', 'Não foi possível copiar o texto', 'error');
  });
}

const GlobalLoading = {
  show(message) {
    const $loading = $("#global-loading");
    const $message = $("#global-loading-message");

    $loading.fadeIn(200);
    $message.text(message);
    // Previne scroll da página
    $("body").addClass("overflow-hidden");
  },

  hide() {
    const $loading = $("#global-loading");

    $loading.fadeOut(200, () => {
      // Restaura scroll da página
      $("body").removeClass("overflow-hidden");
    });
  },

  isVisible() {
    return $("#global-loading").is(":visible");
  },

  updateMessage(message) {
    $("#global-loading-message").text(message);
  },
};

function GlobObservar(elementID, existeNaTela, naoExisteNaTela) {
  const element = document.getElementById(elementID);
  if (!element) {
    console.warn(`Elemento com ID "${elementID}" não encontrado`);
    return () => {}; // Retorna função vazia se elemento não existe
  }
  
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        existeNaTela();
      } else {
        naoExisteNaTela();
      }
    });
  });
  observer.observe(element);
  
  // Retorna função de cleanup para destruir o observer
  return () => {
    observer.disconnect();
  };
}

function parseJSONString(jsonString, fallbackName = 'JSON') {
  if (!jsonString) {
    console.warn(`⚠️ String ${fallbackName} está vazia ou nula`);
    return null;
  }

  if (typeof jsonString !== 'string') {
    console.log(`✅ ${fallbackName} já é um objeto:`, typeof jsonString);
    return jsonString;
  }

  try {
    const parsed = JSON.parse(jsonString);
    console.log(`✅ ${fallbackName} convertido com sucesso:`, parsed);
    return parsed;
  } catch (error) {
    console.error(`❌ Erro ao converter ${fallbackName}:`, error);
    console.error('📄 String original:', jsonString);
    return null;
  }
}

function stringifyJSON(obj, fallbackName = 'JSON') {
  if (obj === undefined || obj === null) {
    console.warn(`⚠️ Objeto ${fallbackName} está vazio ou nulo`);
    return '';
  }

  if (typeof obj === 'string') {
    console.log(`✅ ${fallbackName} já é uma string:`, obj);
    return obj;
  }

  try {
    const jsonString = JSON.stringify(obj);
    console.log(`✅ ${fallbackName} convertido para string com sucesso:`, jsonString);
    return jsonString;
  } catch (error) {
    console.error(`❌ Erro ao converter ${fallbackName} para string:`, error);
    console.error('📄 Objeto original:', obj);
    return '';
  }
}