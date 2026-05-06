var ResetToken=null;
$(document).ready(function () {
    const urlParams = new URLSearchParams(window.location.search);
    ResetToken = urlParams.get('token');
    if (!ResetToken) {
        // Esconder o formulário de reset
        $('#resetForm').addClass('hidden');
        $('#resetError').removeClass('hidden');
        // Mostrar aviso de erro
        avisos('Erro', 'Token ausente ou inválido. Não é possível resetar a senha.', "error");
        return; // evita continuar a execução
    }
});

function resetPassword() {
    loadElement('reset', 1);
    const senha = document.getElementById('usuario').value;
    const confirmarSenha = document.getElementById('senha').value;
    const regex = /^(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{12,}$/;
    if (!regex.test(senha)) {
        avisos('Erro', 'A senha deve conter pelo menos 1 letra maiúscula, 1 caractere especial e no mínimo 12 caracteres.', "yellow");
        return;
    }
    if (senha !== confirmarSenha) {
        avisos('Erro', 'As senhas não coincidem.', "yellow");
        return;
    } 
    const data = {
        nova_senha	: senha,
    }
    req('open/resetar-senha/'+ResetToken, 'POST', data, (response) => {
        if (response.data == null) {
            avisos('Nova Senha', response.message, "error");
            loadElement('reset', 0);
            return
        }
        showSuccessMessage();
        avisos('Nova Senha', response.message, "success");
        loadElement('reset', 0);
    }, (response) => {
        console.log(response);
        avisos('Nova Senha', response.message, "error");
        loadElement('reset', 0);
    })
}

function showSuccessMessage(){
    $('#resetCardForm').addClass('hidden');    
    $('#resetCardFormSucess').removeClass('hidden');
}