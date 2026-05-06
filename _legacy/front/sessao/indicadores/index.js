var PageIndicadores = {
    tela: $("#Indicadores-divTela"),
    divMenu: $("#Indicadores-divMenu"),
    menuList: $("#Indicadores-menu-ul"),
    conteudoTela: $("#Indicadores-divConteudo"),

    posMenu: false,
};

function carregarMenuIndicadores() {
    console.log(pagesEscondidasList);
    pagesEscondidasList.forEach((e, i) => {
        if(e.url.split('/')[0] == 'indicadores'){
        PageIndicadores.menuList.append(`
                 <li class="menu-item">
                    <a class="Indicadores-menu" href="javascript:carregarIndicadoresPage('${e.url}','${i}')"
                        id="Indicadores-menu-li-${i}">
                        <i class="${e.icone}"></i>
                        ${e.nome}
                    </a>
                </li>
            `);
        }
    });
}

carregarMenuIndicadores();

function carregarIndicadoresPage(page, i) {
    if (PageIndicadores.posMenu === i) return;
    $(".Indicadores-menu").removeClass("bg-primary text-primary-content");
    $(`#Indicadores-menu-li-${i}`).addClass("bg-primary text-primary-content");
    loadElement(`Indicadores-menu-li-${i}`, 1);
    PageIndicadores.posMenu = i;
    PageIndicadores.conteudoTela.load(
        `/sessao/${page}/index.html?_=${new Date().getTime()}`
    );
    console.log(`Carregou a página: /sessao/${page}/index.html`);
    loadElement(`Indicadores-menu-li-${i}`, 0);
}

window.Indicadores = {
    callphone: null,
    webbot: null,
}