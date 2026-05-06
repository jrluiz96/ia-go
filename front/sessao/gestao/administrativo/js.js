var PageGA = {
  tela: $("#ga-divTela"),
  divMenu: $("#ga-divMenu"),
  menuList: $("#ga-menu-ul"),
  conteudoTela: $("#ga-divConteudo"),

  posMenu: false,
};

function carregarMenuGA() {
  gestaoList[PageAtual].forEach((e, i) => {
    PageGA.menuList.append(`
                 <li class="menu-item">
                    <a class="ga-menu" href="javascript:carregarGAPage('${e.url}','${i}')"
                        id="ga-menu-li-${i}">
                        <i class="${e.icone}"></i>
                        ${e.nome}
                    </a>
                </li>
            `);
  });
}

carregarMenuGA();

function carregarGAPage(page, i) {
  if(PageGA.posMenu === i) return;
  $(".ga-menu").removeClass("bg-primary text-primary-content");
  $(`#ga-menu-li-${i}`).addClass("bg-primary text-primary-content");
  loadElement(`ga-menu-li-${i}`, 1);
  PageGA.posMenu = i;
  PageGA.conteudoTela.load(
    `/sessao/${page}/index.html?_=${new Date().getTime()}`
  );
  console.log(`Carregou a página: /sessao/${page}/index.html`);
  loadElement(`ga-menu-li-${i}`, 0);
}
