var PageMonitoramento = {
    tela: $("#Monitoramento-divTela"),
    divMenu: $("#Monitoramento-divMenu"),
    menuList: $("#Monitoramento-menu-ul"),
    conteudoTela: $("#Monitoramento-divConteudo"),

    posMenu: false,
};

function carregarMenuMonitoramento() {
    console.log(pagesEscondidasList);
    pagesEscondidasList.forEach((e, i) => {
        if(e.url.split('/')[0] == 'monitoramentos'){
        PageMonitoramento.menuList.append(`
                 <li class="menu-item">
                    <a class="Monitoramento-menu" href="javascript:carregarMonitoramentoPage('${e.url}','${i}')"
                        id="Monitoramento-menu-li-${i}">
                        <i class="${e.icone}"></i>
                        ${e.nome}
                    </a>
                </li>
            `);
        }
    });
}

carregarMenuMonitoramento();

function carregarMonitoramentoPage(page, i) {
    if (PageMonitoramento.posMenu === i) return;
    $(".Monitoramento-menu").removeClass("bg-primary text-primary-content");
    $(`#Monitoramento-menu-li-${i}`).addClass("bg-primary text-primary-content");
    loadElement(`Monitoramento-menu-li-${i}`, 1);
    PageMonitoramento.posMenu = i;
    PageMonitoramento.conteudoTela.load(
        `/sessao/${page}/index.html?_=${new Date().getTime()}`
    );
    console.log(`Carregou a página: /sessao/${page}/index.html`);
    loadElement(`Monitoramento-menu-li-${i}`, 0);
}
