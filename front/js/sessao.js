$('#NloadSessao').hide();

async function getSession() {
    req('v1/sessao', 'GET', '', (response) => sessaoSuccess(response), (response) => sessaoError(response));
}

function sessaoSuccess(res) {
    let progressBarLoad = document.getElementById('progressBarLoad');
    progressBarLoad.value = 30;
    if (res == null) {
        avisos('Sessão', "Usuário valido porém sem atribuição de nível", "warning");
        deslogar();
        return;
    }
    let sessao = res.data;
    if (sessao.usuario == null) {
        avisos('Sessão', "Usuário não encontrado", "warning");
        deslogar();
        return;   
    }else{
        localStorage.setItem('bashProfile', JSON.stringify(sessao.usuario));
        sessao.usuario.permissao = sessao.permissao;
        ProfileSession = sessao.usuario;
        window.bashProfile.usuario = sessao.usuario;
        window.bashProfile.renderAll()
        // if (sessao.usuario.bl_trocar_senha) {
        //     let nofication=  {
        //         id: 1,
        //         title: "Bem-vindo ao sistema",
        //         texto: "Agora você pode acessar todos os recursos da plataforma",
        //         description: "Por segurança recomendamos que modifique sua senha o quanto antes.",
        //         action: "",
        //         actionParams: null,
        //         createdAt: new Date(Date.now() - 60000).toISOString(),
        //         read: false,
        //         type: "info",
        //         buttons: [
        //             {
        //                 text: "Atualizar",
        //                 action: "userResetPass",
        //                 class: "btn-primary"
        //             }
        //         ],
        //         icon: "smile"
        //     }
        //     window.bashNotifications.addNotification(nofication)
        // }
        localStorage.setItem('usuario', JSON.stringify(sessao.usuario));
    }
    GlobGetSession = sessao.telas;
    if (GlobGetSession == null) {
        avisos('Sessão', "Usuário não possui telas", "warning");
        deslogar();
        return;
    }
    GlobGetSessionID = sessao.session;
    
    // Salvar nivel_api da permissão do usuário logado
    if (sessao.permissao && sessao.permissao.nivel_api) {
        GlobNivelAPI = sessao.permissao.nivel_api;
        console.log('Nível API do usuário logado:', GlobNivelAPI);
    }

    PageStart = null;
    GlobGetSession.forEach(e => {
        if (e.peso == 1){
            PageStart = e.url;
        }
    });
    progressBarLoad.value = 50;
    carregarMenu();
    progressBarLoad.value = 75;
    progressBarLoad.value = 100;
    carregarPage(localStorage.getItem('PageAtual') ? localStorage.getItem('PageAtual') : PageStart);
}
function sessaoError(res) {
    console.log(res);
    if (res.status == 401) {
        avisos('Sessão', res.message, "error");
        deslogar();
        return;
    }
    avisos('Sessão', res.message, "error");
    console.log(res);
    deslogar();
    return;
}

const openBtn = document.getElementById('open-offcanvas');
const closeBtn = document.getElementById('close-offcanvas');
const overlay = document.getElementById('offcanvas-overlay');
const offcanvas = document.getElementById('offcanvas-menu');

openBtn.addEventListener('click', () => {
    offcanvas.classList.remove('translate-x-full');
    overlay.classList.remove('hidden');
});

closeBtn.addEventListener('click', () => {
    offcanvas.classList.add('translate-x-full');
    overlay.classList.add('hidden');
});

overlay.addEventListener('click', () => {
    offcanvas.classList.add('translate-x-full');
    overlay.classList.add('hidden');
});

// Example usage
getSession().then(session => {
    // Handle session data
   
}).catch(err => {
    // Handle error
});