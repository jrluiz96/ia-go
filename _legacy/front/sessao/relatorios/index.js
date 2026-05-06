var PageRelatorios = {
    tela: $("#Relatorios-divTela"),
    divMenu: $("#Relatorios-divMenu"),
    menuList: $("#Relatorios-menu-ul"),
    conteudoTela: $("#Relatorios-divConteudo"),

    posMenu: false,
};

function carregarMenuRelatorios() {
    console.log(pagesEscondidasList);
    pagesEscondidasList.forEach((e, i) => {
        if(e.url.split('/')[0] == 'relatorios'){
        PageRelatorios.menuList.append(`
                 <li class="menu-item">
                    <a class="Relatorios-menu" href="javascript:carregarRelatoriosPage('${e.url}','${i}')"
                        id="Relatorios-menu-li-${i}">
                        <i class="${e.icone}"></i>
                        ${e.nome}
                    </a>
                </li>
            `);
        }
    });
}

carregarMenuRelatorios();

function carregarRelatoriosPage(page, i) {
    if (PageRelatorios.posMenu === i) return;
    $(".Relatorios-menu").removeClass("bg-primary text-primary-content");
    $(`#Relatorios-menu-li-${i}`).addClass("bg-primary text-primary-content");
    loadElement(`Relatorios-menu-li-${i}`, 1);
    PageRelatorios.posMenu = i;
    PageRelatorios.conteudoTela.load(
        `/sessao/${page}/index.html?_=${new Date().getTime()}`
    );
    console.log(`Carregou a página: /sessao/${page}/index.html`);
    loadElement(`Relatorios-menu-li-${i}`, 0);
}
