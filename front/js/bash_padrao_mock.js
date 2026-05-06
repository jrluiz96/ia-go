if (typeof window.bashPadraoMock === 'undefined') {
    window.bashPadraoMock = {
        usuario: [],
        lastUpdate: null,
        init: function() {
            this.loadFromStorage();
            if (this.usuario.length === 0) {
                this.usuario = this.getMockNotifications();
                this.saveToStorage();
            }
            this.setupEventListeners();
            this.renderAll();
        },
        loadFromStorage: function () {
            const stored = localStorage.getItem('bashPadraoMock');
            if (stored) {
                const data = JSON.parse(stored);
                this.usuario = data.usuario || [];
                this.lastUpdate = data.lastUpdate ? new Date(data.lastUpdate) : null;
            }
        },
        saveToStorage: function () {
            const data = {
                usuario: this.usuario,
                lastUpdate: new Date().toISOString()
            };
            localStorage.setItem('bashPadraoMock', JSON.stringify(data));
        },
        setupEventListeners: function () {
            $(document).on('click', '.profile-modificar-senha', function () {
                
            });
            $(document).on('click', '.profile-editar-foto', function () {
                
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
        formatTimeAgo: function (isoString) {
            const date = new Date(isoString);
            const now = new Date();
            const seconds = Math.floor((now - date) / 1000);

            if (seconds < 60) return 'Agora mesmo';
            if (seconds < 3600) return `${Math.floor(seconds / 60)} min atrás`;
            if (seconds < 86400) return `${Math.floor(seconds / 3600)} h atrás`;
            if (seconds < 604800) return `${Math.floor(seconds / 86400)} dias atrás`;

            return date.toLocaleDateString('pt-BR');
        },
        getMockNotifications: function () {
            return [
                {
                    id: "1e19da8c-5e4d-4f63-a1b8-fc99aa441c53",
                    usuario: "rafael.tulio",
                    nome: "RAFAEL TULIO",
                    email: "rafael.tulio@accesscontact.com.br",
                    cargo: "",
                    local: "",
                    number: "",
                    number_visible: true,
                    bl_trocar_senha: false, //boolean para saber se o usuario ainda não trocou a senha pela primeira vez mostrar um aviso para troca da senha usando  window.bashNotifications.noficationResetPass({});
                    img: "", //foto do usuario
                    sobre: "",
                    experiencia: [],
                    educacao: [],
                    habilidades: [],
                },
            ];
        }
    }
}
$(document).ready(function () {
    // window.bashPadraoMock.init();
});