// function getTokenFromUrl() {
//     const urlParams = new URLSearchParams(window.location.search);
//     let token = urlParams.get('token');
//     if (token) {
//         loadElement('logar', 1);
//         localStorage.clear();
//         localStorage.setItem('token', token);
//         setTimeout(() => {
//             loadElement('logar', 0);
//             window.location.replace('/sessao/');
//         }, 1000);
//     }
// }
// getTokenFromUrl();
function createSession() {
    loadElement('logar', 1);
    const usuario = document.getElementById('usuario').value
    const senha = document.getElementById('senha').value
    if (usuario == '' || senha == '') {
        avisos('Login', 'Preencha todos os campos!', "warning");
        loadElement('logar', 0);
        return
    } else {
        const data = {
            usuario: usuario,
            senha: senha
        }
        req('open/login', 'POST', data, (response) => {
            if (response.data == null) {
                avisos('Login', response.message, "warning");
                loadElement('logar', 0);
                return
            }
            sessionStorage.setItem('token', response.data.token);
            sessionStorage.setItem('usuario', JSON.stringify(response.data));
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('usuario', JSON.stringify(response.data));
            avisos('Login', response.message, "success");
            loadElement('logar', 0);
            window.location.replace('/sessao/');
        }, (response) => {
            if(response && response.message) {
                avisos('Login', response.message, "warning");
            }else{
                avisos('Login', "Entre em contato com a Bash", "error");
            }
            $('#senha').val("");
            loadElement('logar', 0);
        })
    }
}

$(document).ready(function () {
    $('#forgotPasswordLink').on('click', function (e) {
        e.preventDefault();
        const $loginForm = $('#loginForm');
        const $resetForm = $('#confirmPasswordForm');
        const userVal = $('#usuario').val();
        const resetUsuario = $('#resetUsuario');
        resetUsuario.val(userVal);
        $loginForm.addClass('opacity-0 translate-x-[-100%]');
        setTimeout(() => {
            $loginForm.addClass('hidden');
            $resetForm.removeClass('hidden');
            setTimeout(() => {
                $resetForm.addClass('opacity-100 translate-x-0').removeClass('opacity-0 translate-x-[100%]');
            }, 50);
        }, 300);

        $resetForm.addClass('opacity-0 translate-x-[100%]');
    });
});

function voltarLogin() {
    const $loginForm = $('#loginForm');
    const $resetForm = $('#resetPasswordForm');
    const $confirmForm = $('#confirmPasswordForm');

    $resetForm.addClass('opacity-0 translate-x-[100%]');
    setTimeout(() => {
        $resetForm.addClass('hidden');
        $loginForm.removeClass('hidden');
        setTimeout(() => {
            $loginForm.addClass('opacity-100 translate-x-0').removeClass('opacity-0 translate-x-[-100%]');
        }, 50);
    }, 300);
    $confirmForm.addClass('opacity-0 translate-x-[100%]');
    setTimeout(() => {
        $confirmForm.addClass('hidden');
        $loginForm.removeClass('hidden');
        setTimeout(() => {
            $loginForm.addClass('opacity-100 translate-x-0').removeClass('opacity-0 translate-x-[-100%]');
        }, 50);
    }, 300);
}

function checkEmail() {
    loadElement('confirmarEmail', 1);
    const usuario = $('#resetUsuario').val()
    if (usuario == '') {
        avisos('Recuperar Senha', 'Preencha todos os campos!', "yellow");
        loadElement('confirmarEmail', 0);
        return
    } else {
        const data = {
            usuario: usuario,
        }
        req('open/forgot-password', 'POST', data, (response) => {
            avisos('Recuperar Senha', response.message, "success",3000);

            // if (response.data == null) {
            //     avisos('Recuperar Senha', response.message, "error");
            //     setTimeout(() => {
            //         loadElement('confirmarEmail', 0);
            //     }, 50);
            //     return
            // }
            // $('#emailUsuario').val(response.data)

            // const $confirmForm = $('#confirmPasswordForm');
            // const $resetForm = $('#resetPasswordForm');

            // setTimeout(() => {
            //     $confirmForm.addClass('hidden');
            //     $resetForm.removeClass('hidden');
            //     setTimeout(() => {
            //         $resetForm.addClass('opacity-100 translate-x-0').removeClass('opacity-0 translate-x-[-100%]');
            //     }, 50);
            // }, 300);
            // avisos('Recuperar Senha', "Dados encontrados.", "success");
            // setTimeout(() => {
            //     loadElement('confirmarEmail', 0);
            // }, 50);
        }, (response) => {
            console.log(response);
            if (response && response.message) {
                if (response.message == 'usuario nao encontrado') {
                    avisos('Recuperar Senha', "Usuario ou E-mail não cadastrados.", "error");
                    setTimeout(() => {
                        loadElement('confirmarEmail', 0);
                    }, 50);
                    return
                } else {
                    avisos('Recuperar Senha', response.message, "error");
                    setTimeout(() => {
                        loadElement('confirmarEmail', 0);
                    }, 50);
                }
            } else {
                avisos('Recuperar Senha', "Indisponível no momento.", "error");
                setTimeout(() => {
                    loadElement('confirmarEmail', 0);
                }, 50);
            }
        })
    }
}

function resetPassword() {
    loadElement('resetarSenha', 1);
    const usuario = $('#resetUsuario').val()
    if (usuario == '') {
        avisos('Recuperar Senha', 'Preencha todos os campos!', "yellow");
        loadElement('resetarSenha', 0);
        return
    } else {
        const data = {
            usuario: usuario,
        }
        req('open/esqueceu-senha', 'POST', data, (response) => {
            if (response.data == null) {
                avisos('Recuperar Senha', response.message, "error");
                setTimeout(() => {
                    loadElement('resetarSenha', 0);
                }, 5000);
                return
            } else {
                avisos('Recuperar Senha', response.message, "success");
                setTimeout(() => {
                    loadElement('resetarSenha', 0);
                }, 5000);
                return
            }
        }, (response) => {
            console.log(response);
            if (response && response.message) {
                if (response.message == 'usuario nao encontrado') {
                    avisos('Recuperar Senha', "Usuario ou E-mail não cadastrados.", "error");
                    setTimeout(() => {
                        loadElement('resetarSenha', 0);
                    }, 5000);
                    return
                } else {
                    avisos('Recuperar Senha', response.message, "error");
                    setTimeout(() => {
                        loadElement('resetarSenha', 0);
                    }, 5000);
                }
            } else {
                avisos('Recuperar Senha', "Indisponível no momento.", "error");
                setTimeout(() => {
                    loadElement('resetarSenha', 0);
                }, 5000);
            }
        })
    }
}

function showToast(title, message, type = 'info', duration = 3000) {
    // Criar ou obter o container do toast
    let toast = document.getElementById('liveToast');
    
    // Se o toast não existir, criar dinamicamente
    if (!toast) {
        const toastHTML = `
            <div class="fixed bottom-4 right-4 z-50">
                <div id="liveToast" class="hidden max-w-sm w-full bg-white border border-gray-300 rounded-lg shadow-lg" 
                     style="transition: all 0.3s ease-in-out;">
                    <div class="flex items-center justify-between px-4 py-2 border-b border-gray-200">
                        <div class="flex items-center gap-2">
                            <div id="avisoColor" class="w-3 h-3 rounded-full"></div>
                            <strong class="text-gray-800 text-sm"></strong>
                        </div>
                        <button type="button" class="text-gray-500 hover:text-gray-700" 
                                onclick="document.getElementById('liveToast').classList.add('hidden')">
                            &times;
                        </button>
                    </div>
                    <div class="px-4 py-3 text-gray-700 text-sm toast-body"></div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', toastHTML);
        toast = document.getElementById('liveToast');
    }

    // Configurar o conteúdo e estilo
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
    };

    const colorDot = document.getElementById('avisoColor');
    const titleElement = toast.querySelector('strong');
    const messageElement = toast.querySelector('.toast-body');

    // Atualizar conteúdo
    titleElement.textContent = title;
    messageElement.textContent = message;
    colorDot.className = `w-3 h-3 rounded-full ${colors[type] || colors.info}`;

    // Mostrar toast
    toast.classList.remove('hidden');
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';

    // Limpar timeout anterior se existir
    if (toast.timeoutId) clearTimeout(toast.timeoutId);

    // Função para esconder o toast
    const hideToast = () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(100%)';
        setTimeout(() => toast.classList.add('hidden'), 300);
    };

    // Configurar novo timeout
    toast.timeoutId = setTimeout(hideToast, duration);

    // Eventos do mouse
    toast.onmouseenter = () => clearTimeout(toast.timeoutId);
    toast.onmouseleave = () => toast.timeoutId = setTimeout(hideToast, duration);
}