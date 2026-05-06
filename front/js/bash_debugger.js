if (typeof window.bashDebugger === 'undefined') {
    window.bashDebugger = {
        usuario: {},
        lastUpdate: null,
        init: function() {
            this.loadFromStorage();
            if (Object.keys(this.usuario).length === 0) {
                // this.usuario = this.getMockUsuario();
                this.saveToStorage();
            }
            this.setupEventListeners();
            this.renderAll();
        },
        loadFromStorage: function () {
            const stored = localStorage.getItem('bashDebugger');
            if (stored) {
                const data = JSON.parse(stored);
                this.usuario = data.usuario || {};
                this.lastUpdate = data.lastUpdate ? new Date(data.lastUpdate) : null;
            }
        },
        saveToStorage: function () {
            const data = {
                usuario: this.usuario,
                lastUpdate: new Date().toISOString()
            };
            localStorage.setItem('bashDebugger', JSON.stringify(data));
        },
        setupEventListeners: function () {
            const self = this;            
            // Botão para modificar senha
            $(document).on('click', '.profile-modificar-senha', function () {
                self.mostrarResetSenha();
            });            
            // Botão para voltar ao perfil
            $(document).on('click', '.voltar-ao-perfil', function () {
                self.mostrarPerfil();
            });            
            // Botão para editar foto
            $(document).on('click', '.profile-editar-foto', function () {
                // Implemente a lógica para editar foto aqui
            });
            $(document).on('submit', '#form-reset-senha', function(e) {
                e.preventDefault();
                window.bashDebugger.resetarSenha();
            });
        },
        renderAll: function () {
            this.renderCardFoto();
            this.renderContato();
            this.renderSobre();
            this.renderExperiencia();
            this.renderEducacao();
            this.renderHabilidades();
        },
        renderCardFoto: function() {
            const usuario = this.usuario;
            
            let html = `
                <div class="avatar">
                    <div class="w-24 h-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2 bg-neutral text-neutral-content flex items-center justify-center">
                        <i class="fas fa-user text-4xl mt-5 leading-none"></i>
                    </div>
                </div>
                <h2 class="card-title mt-4">${usuario.nome || 'Nome não informado'}</h2>
                <p>${usuario.cargo || 'Cargo não informado'}</p>
                <div class="mt-2 flex flex-col gap-2">
                    <button class="btn btn-sm btn-primary profile-editar-foto">
                        <i class="fas fa-camera mr-2"></i> Editar Foto
                    </button>
                    <button class="btn btn-sm btn-outline profile-modificar-senha">
                        <i class="fas fa-key mr-2"></i> Alterar Senha
                    </button>
                </div>
            `;
            
            $('.card-foto .card-body').html(html);
        },
        renderContato: function() {
            const usuario = this.usuario;
            let html = `
                <h2 class="card-title">Contato</h2>
                <div class="space-y-2">
                    <div class="flex items-center gap-2 min-w-0">
                        <i class="fas fa-envelope flex-shrink-0"></i>
                        <span class="truncate" title="${usuario.email || 'E-mail não informado'}">
                            ${usuario.email || 'E-mail não informado'}
                        </span>
                    </div>
                    ${usuario.number ? `
                    <div class="flex items-center gap-2 min-w-0">
                        <i class="fas fa-phone flex-shrink-0"></i>
                        <span class="truncate" title="${usuario.number_visible ? usuario.number : 'Telefone oculto'}">
                            ${usuario.number_visible ? usuario.number : 'Telefone oculto'}
                        </span>
                    </div>
                    ` : ''}
                    ${usuario.local ? `
                    <div class="flex items-center gap-2 min-w-0">
                        <i class="fas fa-map-marker-alt flex-shrink-0"></i>
                        <span class="truncate" title="${usuario.local}">
                            ${usuario.local}
                        </span>
                    </div>
                    ` : ''}
                </div>
            `;
            $('.card-contato .card-body').html(html);
        },
        renderSobre: function() {
            const usuario = this.usuario;
            
            let html = `
                <h2 class="card-title">
                    <i class="fas fa-user mr-2"></i> Sobre
                </h2>
                <p>${usuario.sobre || 'Nenhuma informação sobre o usuário foi adicionada.'}</p>
            `;
            
            $('.card-sobre .card-body').html(html);
        },
        renderExperiencia: function() {
            const experiencias = this.usuario.experiencia || [];
            
            let html = `
                <h2 class="card-title">
                    <i class="fas fa-briefcase mr-2"></i> Experiência
                </h2>
                <div class="space-y-4">
            `;
            
            if (experiencias.length === 0) {
                html += `<p>Nenhuma experiência profissional cadastrada.</p>`;
            } else {
                experiencias.forEach(exp => {
                    html += `
                        <div class="flex gap-4">
                            <div class="flex-shrink-0">
                                <div class="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white">
                                    <i class="fas fa-building"></i>
                                </div>
                            </div>
                            <div>
                                <h3 class="font-bold">${exp.empresa || 'Empresa não informada'}</h3>
                                <p class="text-sm opacity-70">${exp.cargo || 'Cargo não informado'} • ${exp.periodo || 'Período não informado'}</p>
                                <p class="mt-1">${exp.descricao || 'Descrição não fornecida'}</p>
                            </div>
                        </div>
                    `;
                });
            }
            
            html += `</div>`;
            $('.card-experiencia .card-body').html(html);
        },
        renderEducacao: function() {
            const educacoes = this.usuario.educacao || [];
            
            let html = `
                <h2 class="card-title">
                    <i class="fas fa-graduation-cap mr-2"></i> Educação
                </h2>
                <div class="space-y-4">
            `;
            
            if (educacoes.length === 0) {
                html += `<p>Nenhuma formação acadêmica cadastrada.</p>`;
            } else {
                educacoes.forEach(edu => {
                    html += `
                        <div class="flex gap-4">
                            <div class="flex-shrink-0">
                                <div class="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white">
                                    <i class="fas fa-university"></i>
                                </div>
                            </div>
                            <div>
                                <h3 class="font-bold">${edu.instituicao || 'Instituição não informada'}</h3>
                                <p class="text-sm opacity-70">${edu.curso || 'Curso não informado'} • ${edu.periodo || 'Período não informado'}</p>
                                <p class="mt-1">${edu.descricao || 'Descrição não fornecida'}</p>
                            </div>
                        </div>
                    `;
                });
            }
            
            html += `</div>`;
            $('.card-educacao .card-body').html(html);
        },
        renderHabilidades: function() {
            const habilidades = this.usuario.habilidades || [];
            
            let html = `
                <h2 class="card-title">
                    <i class="fas fa-code mr-2"></i> Habilidades
                </h2>
                <div class="flex flex-wrap gap-2">
            `;
            
            if (habilidades.length === 0) {
                html += `<p>Nenhuma habilidade cadastrada.</p>`;
            } else {
                habilidades.forEach(habilidade => {
                    html += `
                        <span class="badge badge-primary gap-2">
                            <i class="fas fa-check"></i> ${habilidade}
                        </span>
                    `;
                });
            }
            
            html += `</div>`;
            $('.card-habilidades .card-body').html(html);
        },
        renderResetSenhaForm: function() {
            return `
                <div class="card bg-base-200">
                    <div class="card-body">
                        <h2 class="card-title">
                            <i class="fas fa-key mr-2"></i> Alterar Senha
                        </h2>
                        
                        <form id="form-reset-senha" class="space-y-4">
                            <div class="form-control">
                                <label class="label">
                                    <span class="label-text">Senha Atual</span>
                                </label>
                                <input type="password" placeholder="Digite sua senha atual" 
                                       class="input input-bordered" required id="senha-atual">
                            </div>
                            
                            <div class="form-control">
                                <label class="label">
                                    <span class="label-text">Nova Senha</span>
                                </label>
                                <input type="password" placeholder="Digite a nova senha" 
                                       class="input input-bordered" required id="nova-senha">
                            </div>
                            
                            <div class="form-control">
                                <label class="label">
                                    <span class="label-text">Confirme a Nova Senha</span>
                                </label>
                                <input type="password" placeholder="Confirme a nova senha" 
                                       class="input input-bordered" required id="confirma-senha">
                            </div>
                            
                            <div class="" id="result-reset-password"></div>

                            <div class="flex justify-end gap-2 mt-6">
                                <button type="button" class="btn btn-ghost voltar-ao-perfil">
                                    <i class="fas fa-times mr-2"></i> Cancelar
                                </button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="fas fa-save mr-2"></i> Salvar Nova Senha
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
        },
        salvarAlteracoes: function() {
            // Aqui você pode implementar a lógica para salvar as alterações
            // Por enquanto, vamos apenas atualizar o localStorage
            this.saveToStorage();
            
            // Mostrar feedback para o usuário
            window.bashNotifications.notification({
                title: 'Perfil atualizado',
                message: 'Suas alterações foram salvas com sucesso!',
                type: 'success'
            });
        },
        mostrarResetSenha: function() {
            // Esconde a view de detalhes do perfil
            $('#perfil_detalhes').addClass('hidden');
            
            // Mostra a view de reset de senha e renderiza o formulário
            $('#perfil_reset_password').removeClass('hidden').html(this.renderResetSenhaForm());
        },
        mostrarPerfil: function() {
            // Esconde a view de reset de senha
            $('#perfil_reset_password').addClass('hidden');
            
            // Mostra a view de detalhes do perfil
            $('#perfil_detalhes').removeClass('hidden');
        },
        resetarSenha: function() {
            const self = this;
            const $form = $('#form-reset-senha');
            const $senhaAtual = $('#senha-atual');
            const $novaSenha = $('#nova-senha');
            const $confirmaSenha = $('#confirma-senha');
            
            // Resetar estados de erro
            $form.find('.form-control').removeClass('has-error');
            $form.find('.error-message').remove();
            
            // Validações básicas
            let isValid = true;
            
            if ($senhaAtual.val().trim() === '') {
                self.mostrarErroCampo($senhaAtual, 'Por favor, informe sua senha atual');
                isValid = false;
            }
            
            if ($novaSenha.val().length < 6) {
                self.mostrarErroCampo($novaSenha, 'A senha deve ter pelo menos 8 caracteres');
                isValid = false;
            }
            
            if ($novaSenha.val() !== $confirmaSenha.val()) {
                self.mostrarErroCampo($confirmaSenha, 'As senhas não coincidem');
                isValid = false;
            }
            
            if (!isValid) {
                return;
            }
            
            const data = {
                id: self.usuario.id,
                senha_atual: $senhaAtual.val(),
                senha_nova: $novaSenha.val()
            };
            $form.addClass('loading');
            $form.find('button[type="submit"]').prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-2"></i> Salvando...');
    
            req(`open/atualizar-senha`, 'PUT', data,
                function(res) {
                    // Feedback visual de sucesso
                    $form.removeClass('loading').addClass('success');
                    $form.find('button[type="submit"]').html('<i class="fas fa-check mr-2"></i> Senha alterada!');
                    
                    // Notificação Toast
                    self.mostrarNotificacaoFormulario('Senha alterada com sucesso!', 'success');
                    $form[0].reset();
                    setTimeout(() => {
                        $form.removeClass('success');
                        $form.find('button[type="submit"]').prop('disabled', false).html('<i class="fas fa-save mr-2"></i> Salvar Nova Senha');
                        window.bashDebugger.mostrarPerfil();
                    }, 8000);
                },
                function(error) {
                    console.error('Erro ao modificar a senha.', error);
                    $form.removeClass('loading');
                    $form.find('button[type="submit"]').prop('disabled', false).html('<i class="fas fa-save mr-2"></i> Salvar Nova Senha');
                    
                    // Tratar diferentes tipos de erro
                    if (error && error.responseJSON && error.responseJSON.message) {
                        if (error.responseJSON.message.includes('senha atual')) {
                            self.mostrarErroCampo($senhaAtual, error.responseJSON.message);
                        } else {
                            self.mostrarNotificacaoFormulario(error.responseJSON.message, 'error');
                        }
                    } else {
                        self.mostrarNotificacaoFormulario('Erro ao modificar a senha. Tente novamente.', 'error');
                    }
                }
            );
        },
        mostrarErroCampo: function($campo, mensagem) {
            const $formControl = $campo.closest('.form-control');
            $formControl.addClass('has-error');
            
            if ($formControl.find('.error-message').length === 0) {
                $campo.after(`<div class="error-message text-error text-xs mt-1">${mensagem}</div>`);
            } else {
                $formControl.find('.error-message').text(mensagem);
            }
        },
        mostrarNotificacaoFormulario: function(mensagem, tipo) {
            // Remove notificações anteriores
            $('#perfil_reset_password .form-notification').remove();
            
            const classes = {
                success: 'alert-success',
                error: 'alert-error',
                info: 'alert-info'
            };
            
            const icon = {
                success: 'fa-check-circle',
                error: 'fa-exclamation-circle',
                info: 'fa-info-circle'
            };
            
            const $notification = $(`
                <div class="form-notification alert ${classes[tipo]} mb-4">
                    <i class="fas ${icon[tipo]} mr-2"></i>
                    <span>${mensagem}</span>
                </div>
            `);
            
            $('#result-reset-password').prepend($notification);
        },
        getMockUsuario: function () {
            return {
                id: "1e19da8c-5e4d-4f63-a1b8-fc99aa441c53",
                usuario: "rafael.tulio",
                nome: "RAFAEL TULIO",
                email: "rafael.tulio@accesscontact.com.br",
                cargo: "Desenvolvedor FullStack",
                local: "Joinville, SC",
                number: "(47) 99286-9383",
                number_visible: true,
                bl_trocar_senha: false,
                img: "",
                sobre: "Desenvolvedor web com experiência em JavaScript, React e Tailwind CSS. Apaixonado por criar interfaces de usuário intuitivas e responsivas.",
                experiencia: [
                    {
                        empresa: "Access Contact",
                        cargo: "Desenvolvedor Fullstack",
                        periodo: "2020 - Presente",
                        descricao: "Desenvolvimento de interfaces web com HTML/React e integração com APIs REST."
                    },
                    {
                        empresa: "Tech Solutions",
                        cargo: "Estagiário em Desenvolvimento",
                        periodo: "2018 - 2020",
                        descricao: "Auxílio no desenvolvimento de aplicações web e manutenção de sistemas legados."
                    }
                ],
                educacao: [
                    {
                        instituicao: "Universidade de São Paulo",
                        curso: "Bacharelado em Ciência da Computação",
                        periodo: "2014 - 2018",
                        descricao: "Formação com ênfase em Engenharia de Software e Inteligência Artificial."
                    }
                ],
                habilidades: ["HTML", "CSS", "JavaScript", "React", "Tailwind", "DaisyUI", "Node.js"]
            };
        }
    };
}

$(document).ready(function () {
    window.bashDebugger.init();
});