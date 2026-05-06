/**
 * Modal de Suporte Completo - Auto-suficiente
 * 
 * Este arquivo contém todo o código necessário para o modal de suporte
 * É totalmente independente e auto-suficiente.
 * 
 * Como usar:
 * 1. Inclua apenas este arquivo na sua página: <script src="/js/suporte-modal.js?v=4"></script>
 * 2. Chame window.SuporteModal.abrir() para abrir o modal
 * 3. Chame window.SuporteModal.fechar() para fechar o modal
 */

(function() {
  "use strict";

  // Estado global do modal
  const ModalState = {
    isOpen: false,
    isLoaded: false,
    modalElement: null,
    
    componentes: {
      tabela: null,
      paginacao: null,
      modalCriar: null,
      formCriar: null,
      modalVerChamado: null,
    },

    chamados: [],
    categorias: [],
    titulos: [],
    anexosTemporarios: [],
    chamadoAtual: {},

    paginacao: {
      pagina: 1,
      limit: 10,
      total: 0,
      totalPaginas: 0,
    },
  };

  // API para comunicação com backend
  const SuporteAPI = {
    baseUrl: "v1/suporte",

    getUserData() {
      const baseUrl = `${window.location.hostname}`;
      return {
        usuario: ProfileSession?.usuario || "teste",
        servidor: ProfileSession?.server || "ativo-monolito",
        url: baseUrl,
      };
    },

    async buscarChamados(pagina = 1) {
      try {
        const userData = this.getUserData();
        const params = new URLSearchParams({
          ...userData,
          page: pagina,
          limit: ModalState.paginacao.limit,
        });

        const url = `${this.baseUrl}/chamados?${params}`;
        const response = await reqAsyncSuporte(url, "GET");
        
        return { data: response.data, error: null };
      } catch (error) {
        return {
          data: null,
          error: error?.message || "Erro ao carregar chamados",
        };
      }
    },

    async buscarChamado(id) {
      try {
        const userData = this.getUserData();
        const params = new URLSearchParams({ ...userData });
        const url = `${this.baseUrl}/chamados/${id}?${params}`;
        const data = await reqAsyncSuporte(url, "GET");
        
        return { data, error: null };
      } catch (error) {
        return {
          data: null,
          error: error?.message || "Erro ao carregar chamado",
        };
      }
    },

    async buscarAtendimentos(id) {
      try {
        const userData = this.getUserData();
        const params = new URLSearchParams({ ...userData });
        const url = `${this.baseUrl}/chamados/${id}/with-atendimentos?${params}`;
        const response = await reqAsyncSuporte(url, "GET");
        
        return { data: response.data, error: null };
      } catch (error) {
        return {
          data: null,
          error: error?.message || "Erro ao carregar atendimentos",
        };
      }
    },

    async criarChamado(dados) {
      try {
        const userData = this.getUserData();
        const requestBody = { ...userData, ...dados };
        const url = `${this.baseUrl}/chamados`;
        const response = await reqAsyncSuporte(url, "POST", requestBody);
        
        return { data: response.data, error: null };
      } catch (error) {
        return {
          data: null,
          error: error?.message || "Erro ao criar chamado",
        };
      }
    },

    async salvarAtendimento(id, mensagem, arquivo) {
      try {
        const userData = this.getUserData();
        const requestBody = {
          ...userData,
          message: mensagem,
          anexos: arquivo,
        };
        const url = `${this.baseUrl}/atendimento/${id}`;
        const response = await reqAsyncSuporte(url, "POST", requestBody);
        
        return { data: response.data, error: null };
      } catch (error) {
        return {
          data: null,
          error: error?.message || "Erro ao salvar atendimento",
        };
      }
    },

    async salvarResponsavel(ticket_id) {
      try {
        const userData = this.getUserData();
        const url = `${this.baseUrl}/chamados/${ticket_id}/responsavel`;
        const response = await reqAsyncSuporte(url, "PUT", userData);
        
        return { data: response.data, error: null };
      } catch (error) {
        return {
          data: null,
          error: error?.message || "Erro ao salvar responsável",
        };
      }
    },

    async finalizarAtendimento(id) {
      try {
        const userData = this.getUserData();
        const url = `${this.baseUrl}/atendimento/${id}/finalizar`;
        const response = await reqAsyncSuporte(url, "POST", userData);
        
        return { data: response.data, error: null };
      } catch (error) {
        return {
          data: null,
          error: error?.message || "Erro ao finalizar atendimento",
        };
      }
    },

    async buscarCategorias() {
      try {
        const url = `${this.baseUrl}/categorias`;
        const response = await reqAsyncSuporte(url, "GET");
        
        return { data: response.data.categorias, error: null };
      } catch (error) {
        return {
          data: null,
          error: error?.message || "Erro ao carregar categorias",
        };
      }
    },

    async buscarTitulos() {
      try {
        const url = `${this.baseUrl}/titulos`;
        const response = await reqAsyncSuporte(url, "GET");
        
        return { data: response.data.titulos, error: null };
      } catch (error) {
        return {
          data: null,
          error: error?.message || "Erro ao carregar títulos",
        };
      }
    },
  };

  // Utilitários para UI
  const ModalUI = {
    
    // Cria o HTML completo do modal
    criarModalHTML() {
      return `
        <div id="modal-suporte" class="modal">
          <div class="modal-box w-11/12 max-w-6xl h-5/6 max-h-screen p-0 flex flex-col">
            <!-- Header do Modal -->
            <div class="flex justify-between items-center bg-base-200 p-4">
              <div class="flex items-center gap-3">
                <i class="fas fa-ticket-alt text-2xl text-primary"></i>
                <h2 class="text-xl font-bold">Chamados de Suporte</h2>
              </div>
              <button class="btn btn-sm btn-circle btn-ghost" onclick="window.SuporteModal.fechar()">
                <i class="fas fa-times"></i>
              </button>
            </div>

            <!-- Conteúdo do Modal -->
            <div class="flex-1 overflow-hidden flex flex-col p-4">
              
              <!-- Botões de Ação -->
              <div class="flex gap-2 mb-4">
                <button id="btn-criar-chamado-modal" class="btn btn-success btn-sm gap-2">
                  <i class="fas fa-plus"></i>
                  Criar Chamado
                </button>
              </div>

              <!-- Área de Conteúdo -->
              <div class="flex-1 overflow-auto">
                <div id="tabela-chamados-modal" class="mb-4"></div>
                
                <!-- Estado vazio -->
                <div id="estado-vazio-modal" class="text-center py-12 hidden">
                  <div class="text-6xl text-gray-300 mb-4">
                    <i class="fas fa-ticket-alt"></i>
                  </div>
                  <h3 class="text-lg font-medium text-gray-500 mb-2">Nenhum chamado encontrado</h3>
                  <p class="text-gray-400 mb-6">Crie seu primeiro chamado de suporte clicando no botão acima.</p>
                  <button class="btn btn-success" onclick="document.getElementById('btn-criar-chamado-modal').click()">
                    <i class="fas fa-plus"></i>
                    Criar Primeiro Chamado
                  </button>
                </div>
                
                <!-- Paginação -->
                <div id="container-paginacao-modal" class="mt-6"></div>
              </div>
            </div>
          </div>
          <div class="modal-backdrop" onclick="window.SuporteModal.fechar()"></div>
        </div>

        <!-- Modal para Criar Chamado -->
        <div id="modal-criar-chamado-suporte"></div>

        <!-- Modal para Ver Chamado -->
        <div id="modal-ver-chamado-suporte"></div>
      `;
    },

    // Inicializa todos os componentes da UI
    async inicializar() {
      if (!ModalState.modalElement) {
        // Criar e inserir o modal no DOM
        const modalHTML = this.criarModalHTML();
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        ModalState.modalElement = document.getElementById('modal-suporte');
      }
      if (ModalState.isLoaded) return;

      // Inicializar componentes
      this.criarTabela();
      this.criarPaginacao();
      await this.criarModais();
      this.vincularEventos();
      
      // Carregar dados iniciais
      await this.carregarDados(1);
      
      ModalState.isLoaded = true;
    },

    criarTabela() {
      const colunas = [
        {
          label: "Título",
          value: "titulo",
          format: (value) => value?.nome || "N/A",
        },
        {
          label: "Categoria", 
          value: "categoria",
          format: (value) => value?.nome || "N/A",
        },
        {
          label: "Status",
          value: "status", 
          format: (value) => value?.nome || "N/A",
        },
        {
          label: "Cliente",
          value: "usuario",
        },
        {
          label: "Responsável",
          value: "responsavel",
        },
        {
          label: "Criado em",
          value: "created_at",
          format: (value) => formatarData(value),
        },
        {
          label: "Ações",
          value: "id",
          format: (value) => {
            return `<button class="btn btn-primary btn-sm" onclick="window.SuporteModal.verChamado(${value})">
              <i class="fas fa-eye"></i>
              Ver
            </button>`;
          },
        },
      ];

      const tabela = new BashTable({
        id: "tabela-chamados-suporte-modal",
        columns: colunas,
        data: ModalState.chamados,
        classList: "table table-sm table-zebra w-full",
        emptyMessage: "Nenhum chamado encontrado.",
        container: "#tabela-chamados-modal",
      });

      ModalState.componentes.tabela = tabela;
    },

    criarPaginacao() {
      const paginacao = new BashPagination({
        id: "paginacao-chamados-modal",
        pagina: ModalState.paginacao.pagina,
        total: ModalState.paginacao.total,
        limit: ModalState.paginacao.limit,
        container: "#container-paginacao-modal",
        onNext: (novaPagina) => this.carregarDados(novaPagina),
        onPrev: (novaPagina) => this.carregarDados(novaPagina),
      });

      ModalState.componentes.paginacao = paginacao;
    },

    async criarModais() {
      // Modal para criar chamado
      const modalCriar = new BashModal({
        id: "modal-criar-chamado-suporte",
        classSize: "w-11/12 max-w-4xl",
        titulo: "Criar Novo Chamado",
        destroy: false,
        container: "#modal-criar-chamado-suporte",
      });

      ModalState.componentes.modalCriar = modalCriar;

      // Modal para ver chamado
      const modalVer = new BashModal({
        id: "modal-ver-chamado-suporte",
        classSize: "w-11/12 max-w-4xl", 
        titulo: "Detalhes do Chamado",
        destroy: false,
        container: "#modal-ver-chamado-suporte",
      });

      ModalState.componentes.modalVerChamado = modalVer;

      // Criar formulário
      await this.criarFormulario();
    },

    async criarFormulario() {
      // Carregar dados necessários
      await this.carregarDadosFormulario();

      const campos = [
        {
          label: "Título",
          name: "titulo_id", 
          element: "select",
          options: ModalState.titulos,
          classList: "col-span-full md:col-span-1",
          attributes: {
            required: true,
            placeholder: "Selecione o título do chamado...",
          },
        },
        {
          label: "Categoria",
          name: "categoria_id",
          element: "select", 
          options: ModalState.categorias,
          classList: "col-span-full md:col-span-1",
          attributes: {
            required: true,
          },
        },
        {
          label: "Descrição",
          name: "descricao",
          element: "textarea",
          classList: "col-span-full",
          attributes: {
            placeholder: "Descreva detalhadamente o problema ou solicitação...",
            rows: 4,
            required: true,
          },
        },
        {
          label: "Arquivos", 
          name: "arquivos",
          element: "file",
          classList: "col-span-full",
          attributes: {
            placeholder: "Selecione arquivos para anexar...",
            multiple: true,
            accept: ".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif",
          },
        },
      ];

      const form = new BashForm({
        id: "form-criar-chamado-suporte",
        classList: "grid grid-cols-1 md:grid-cols-2 gap-4 p-4",
        fields: campos,
        container: null,
      });

      form.addSubmitButton("Criar Chamado", this.handleFormSubmit.bind(this));

      ModalState.componentes.formCriar = form;

      // Adicionar formulário ao modal
      const modalElements = ModalState.componentes.modalCriar.getElements();
      modalElements.action.empty();
      modalElements.action.append(form.getElement());
    },

    async carregarDadosFormulario() {
      try {
        // Carregar categorias
        const { data: categorias } = await SuporteAPI.buscarCategorias();
        if (categorias) {
          ModalState.categorias = categorias.map((cat) => ({
            label: cat.nome,
            value: cat.id,
          }));
        }

        // Carregar títulos
        const { data: titulos } = await SuporteAPI.buscarTitulos();
        if (titulos) {
          ModalState.titulos = titulos.map((titulo) => ({
            label: titulo.nome || titulo.descricao,
            value: titulo.id,
          }));
        }
      } catch (error) {
        console.error("Erro ao carregar dados do formulário:", error);
      }
    },

    async handleFormSubmit(formData) {
      try {
        if (!formData.descricao || !formData.categoria_id || !formData.titulo_id) {
          avisos("Por favor, preencha todos os campos obrigatórios.", "", "warning");
          return;
        }

        // Processar arquivos se houver
        let arquivosArray = null;
        if (formData.arquivos && formData.arquivos.length > 0) {
          try {
            arquivosArray = await convertFilesToBase64(formData.arquivos);
          } catch (error) {
            avisos("Erro ao processar arquivos. Tente novamente.", "", "error");
            return;
          }
        }

        const dadosEnvio = {
          descricao: formData.descricao,
          categoria_id: parseInt(formData.categoria_id),
          titulo_id: parseInt(formData.titulo_id),
          arquivos: arquivosArray,
        };

        const { data, error } = await SuporteAPI.criarChamado(dadosEnvio);

        if (error) {
          avisos(`Erro ao criar chamado: ${error}`);
          return;
        }

        avisos("Chamado criado com sucesso!");
        ModalState.componentes.modalCriar.close();
        ModalState.componentes.formCriar.clearValues();
        
        // Recarregar lista
        await this.carregarDados(1);
      } catch (error) {
        console.error("Erro ao enviar formulário:", error);
        avisos("Erro inesperado ao criar chamado. Tente novamente.");
      }
    },

    vincularEventos() {
      const btnCriar = document.getElementById("btn-criar-chamado-modal");
      if (btnCriar) {
        btnCriar.addEventListener("click", () => {
          ModalState.componentes.modalCriar.open();
        });
      }
    },

    async carregarDados(pagina = 1) {
      this.mostrarCarregamento();

      const { data, error } = await SuporteAPI.buscarChamados(pagina);

      if (error) {
        console.error("Erro ao carregar chamados:", error);
        this.esconderCarregamento();
        return;
      }

      ModalState.chamados = data.tickets || [];
      ModalState.paginacao.total = data.total || 0;
      ModalState.paginacao.pagina = pagina;
      ModalState.paginacao.totalPaginas = data.total_pages;

      this.esconderCarregamento();
      this.renderizarTabela();
      this.atualizarPaginacao();
    },

    renderizarTabela() {
      if (!ModalState.componentes.tabela) return;

      const estadoVazio = document.getElementById("estado-vazio-modal");
      const containerTabela = document.getElementById("tabela-chamados-modal");

      if (ModalState.chamados.length === 0) {
        if (containerTabela) containerTabela.style.display = "none";
        if (estadoVazio) estadoVazio.classList.remove("hidden");
        return;
      }

      if (estadoVazio) estadoVazio.classList.add("hidden");
      if (containerTabela) containerTabela.style.display = "block";

      ModalState.componentes.tabela.updateData(ModalState.chamados);
    },

    atualizarPaginacao() {
      if (ModalState.componentes.paginacao) {
        ModalState.componentes.paginacao.update(
          ModalState.paginacao.pagina,
          ModalState.paginacao.total
        );
      }
    },

    mostrarCarregamento() {
      if (ModalState.componentes.tabela) {
        ModalState.componentes.tabela.showLoading("Carregando chamados...");
      }
    },

    esconderCarregamento() {
      if (ModalState.componentes.tabela) {
        ModalState.componentes.tabela.hideLoading();
      }
    },

    // Métodos para modal de visualização de chamado
    async construirModalVerChamado(chamado) {
      const modalElements = ModalState.componentes.modalVerChamado.getElements();
      modalElements.action.empty();

      const userData = SuporteAPI.getUserData();
      const usuario = userData.usuario;

      // Header com informações
      const headerHtml = `
        <div class="bg-base-200 p-4 rounded-lg mb-4">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label class="text-sm font-semibold text-base-content/70">Título</label>
              <div class="text-base font-medium">${chamado.titulo?.nome || "N/A"}</div>
            </div>
            <div>
              <label class="text-sm font-semibold text-base-content/70">Categoria</label>
              <div class="text-base font-medium">${chamado.categoria?.nome || "N/A"}</div>
            </div>
            <div>
              <label class="text-sm font-semibold text-base-content/70">Status</label>
              <div class="text-base font-medium">${chamado.status?.nome || "N/A"}</div>
            </div>
            <div>
              <label class="text-sm font-semibold text-base-content/70">Cliente</label>
              <div class="text-base font-medium">${chamado.usuario}</div>
            </div>
            <div>
              <label class="text-sm font-semibold text-base-content/70">Criado em</label>
              <div class="text-base font-medium">${formatarData(chamado.created_at)}</div>
            </div>
            <div>
              <label class="text-sm font-semibold text-base-content/70">Responsável</label>
              <div class="flex items-center gap-2">
                ${this.mostrarResponsavel(chamado)}
              </div>
            </div>
          </div>
          ${this.mostrarFinalizarAtendimento(chamado)}
        </div>
      `;

      // Chat de mensagens
      const mensagensHtml = this.construirChatMensagens(chamado);

      // Footer com input se pode escrever
      let footerHtml = "";
      if (this.podeEscreverMensagem(chamado)) {
        footerHtml = `
          <div class="pt-4">
            <div id="anexos-preview-modal" class="mb-3" style="display: none;">
              <div class="bg-base-200 p-3 rounded-lg">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-medium">Arquivos selecionados:</span>
                  <button class="btn btn-xs btn-ghost" onclick="window.SuporteModal.limparAnexos()">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
                <div id="lista-anexos-modal" class="flex flex-wrap gap-2"></div>
              </div>
            </div>
            
            <div class="flex gap-2 items-end">
              <div class="flex-shrink-0">
                <input type="file" id="file-input-anexo-modal" multiple 
                       accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                       style="display: none;" 
                       onchange="window.SuporteModal.processarAnexos(this.files)">
                <button class="btn btn-outline btn-circle" onclick="document.getElementById('file-input-anexo-modal').click()">
                  <i class="fas fa-paperclip"></i>
                </button>
              </div>
              <div class="flex-grow">
                <textarea id="mensagem-resposta-modal" 
                          class="textarea textarea-bordered w-full resize-none" 
                          rows="1"
                          placeholder="Digite sua mensagem..."></textarea>
              </div>
              <div class="flex-shrink-0">
                <button class="btn btn-primary btn-circle" onclick="window.SuporteModal.enviarMensagem()">
                  <i class="fas fa-paper-plane"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      }

      const conteudoCompleto = headerHtml + mensagensHtml + footerHtml;
      modalElements.action.append(conteudoCompleto);
      modalElements.titulo.text(`Chamado #${chamado.id} - ${chamado.titulo?.nome || "Sem título"}`);

      // Vincular Enter no textarea para enviar mensagem
      setTimeout(() => {
        const textarea = document.getElementById("mensagem-resposta-modal");
        if (textarea) {
          textarea.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              window.SuporteModal.enviarMensagem();
            }
          });
        }
      }, 0);

      // Scroll para última mensagem
      setTimeout(() => this.rolarParaUltimaMensagem(), 100);
    },

    mostrarResponsavel(chamado) {
      const userData = SuporteAPI.getUserData();
      const usuario = userData.usuario;

      if (chamado.responsavel && chamado.responsavel.trim() !== "") {
        return `<span class="text-base font-medium">${chamado.responsavel}</span>`;
      } else if (chamado.responsavel === usuario || chamado.usuario === usuario) {
        return `<span class="text-base font-medium">Não atribuído</span>`;
      } else {
        return `<button class="btn btn-xs btn-outline" onclick="window.SuporteModal.alterarResponsavel(${chamado.id})">
          <i class="fas fa-user-edit"></i>
          Responsável
        </button>`;
      }
    },

    mostrarFinalizarAtendimento(chamado) {
      // Verificar se o status já é "Finalizado"
      const statusFinalizado = chamado.status?.nome?.toLowerCase() === "finalizado";
      if (statusFinalizado) {
        return "";
      }
      
      // Só mostra o botão se tem responsável e não está finalizado
      if (chamado.responsavel && chamado.responsavel.trim() !== "") {
        return `
          <div class="mt-4">
            <button class="btn btn-warning btn-sm" onclick="window.SuporteModal.finalizarAtendimento(${chamado.id})">
              <i class="fas fa-check-circle"></i>
              Finalizar Atendimento
            </button>
          </div>
        `;
      }
      return "";
    },

    podeEscreverMensagem(chamado) {
      const userData = SuporteAPI.getUserData();
      const usuario = userData.usuario;
      
      // Verificar se o status é "Finalizado" - se for, não permite escrever
      const statusFinalizado = chamado.status?.nome?.toLowerCase() === "finalizado";
      if (statusFinalizado) {
        return false;
      }
      
      // Verificação original: usuário é responsável ou criador do chamado
      return chamado.responsavel === usuario || chamado.usuario === usuario;
    },

    construirChatMensagens(chamado) {
      const todasMensagens = [];
      
      // Mensagem inicial
      todasMensagens.push({
        id: `ticket-${chamado.id}`,
        usuario: chamado.usuario || "Usuário",
        mensagem: chamado.descricao,
        data: chamado.created_at,
        anexos: chamado.arquivos || [],
      });

      // Atendimentos
      if (chamado.atendimentos && chamado.atendimentos.length > 0) {
        chamado.atendimentos.forEach((atendimento) => {
          todasMensagens.push({
            id: `atendimento-${atendimento.id}`,
            usuario: atendimento.usuario || "Atendente",
            mensagem: atendimento.mensagem,
            data: atendimento.created_at,
            anexos: atendimento.anexos || [],
          });
        });
      }

      // Ordenar por data
      todasMensagens.sort((a, b) => new Date(a.data) - new Date(b.data));

      let chatHtml = `<div id="chat-container-modal" class="bg-base-100 border border-base-200 rounded-lg p-4 mb-4" style="min-height: 300px; max-height: 400px; overflow-y: auto;">`;

      if (todasMensagens.length === 0) {
        chatHtml += `
          <div class="text-center text-base-content/50 mt-20">
            <i class="fas fa-comments fa-2x mb-2"></i>
            <p>Nenhuma mensagem ainda</p>
          </div>
        `;
      } else {
        todasMensagens.forEach((msg) => {
          const isCriadorTicket = msg.usuario === chamado.usuario;
          const chatPosition = isCriadorTicket ? "chat-start" : "chat-end";
          const avatarColor = isCriadorTicket ? "bg-primary" : "bg-secondary";
          const avatarIcon = isCriadorTicket ? "fa-user" : "fa-headset";

          console.log(msg);

          let anexoHtml = "";
          if (msg.anexos && msg.anexos.length > 0) {
            anexoHtml += `<div class="mb-2"><div class="flex flex-wrap gap-2">`;
            msg.anexos.forEach((anexo) => {
              anexoHtml += `
                <a onclick="downloadFileFromBase64('${anexo.url}', '${anexo.file_name}', '${anexo.mime_type}')"
                   class="btn btn-xs ${isCriadorTicket ? 'btn-primary' : 'btn-secondary'} text-white hover:scale-105 transition-transform gap-1 shadow-md cursor-pointer">
                  <i class="fas fa-download"></i>
                  ${anexo.file_name || anexo.nome || 'Arquivo'}
                </a>
              `;
            });
            anexoHtml += `</div></div>`;
          }

          chatHtml += `
            <div class="chat ${chatPosition}">
              <div class="chat-image avatar">
                <div class="w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center shrink-0 relative shadow-md">
                  <i class="fas ${avatarIcon} text-white absolute" style="top: 50%; left: 50%; transform: translate(-50%, -50%);"></i>
                </div>
              </div>
              <div class="chat-header text-sm font-semibold ${isCriadorTicket ? "text-primary" : "text-secondary"} mb-1">
                ${msg.usuario}
              </div>
              <div class="chat-bubble ${isCriadorTicket ? "chat-bubble-primary" : "chat-bubble-secondary"} shadow-md">
                ${anexoHtml}
                <div class="text-sm">${msg.mensagem}</div>
              </div>
              <div class="chat-footer text-xs opacity-60 mt-1">
                <time>${formatarData(msg.data)}</time>
              </div>
            </div>
          `;
        });
      }

      chatHtml += `</div>`;
      return chatHtml;
    },

    rolarParaUltimaMensagem() {
      const chatContainer = document.getElementById("chat-container-modal");
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    },
  };

  // Interface pública do modal
  window.SuporteModal = {
    
    async abrir() {
      if (!ModalState.isLoaded) {
        // Garantir que o elemento do modal existe no DOM antes de abrir
        if (!ModalState.modalElement) {
          const modalHTML = ModalUI.criarModalHTML();
          document.body.insertAdjacentHTML('beforeend', modalHTML);
          ModalState.modalElement = document.getElementById('modal-suporte');
        }
        // Abrir imediatamente
        ModalState.modalElement.classList.add('modal-open');
        ModalState.isOpen = true;
        // Inicializar componentes e dados em background
        ModalUI.inicializar();
      } else {
        // Abrir imediatamente e atualizar dados em background
        ModalState.modalElement.classList.add('modal-open');
        ModalState.isOpen = true;
        ModalUI.carregarDados(1);
      }
    },

    fechar() {
      if (ModalState.modalElement) {
        ModalState.modalElement.classList.remove('modal-open');
        ModalState.isOpen = false;
      }
    },

    isAberto() {
      return ModalState.isOpen;
    },

    async verChamado(id) {
      const { data, error } = await SuporteAPI.buscarAtendimentos(id);
      if (error) {
        avisos(`Erro ao buscar atendimentos: ${error}`, "", "error");
        return;
      }

      ModalState.chamadoAtual = data;
      await ModalUI.construirModalVerChamado(data);
      ModalState.componentes.modalVerChamado.open();
    },

    async alterarResponsavel(chamadoId) {
      const { data, error } = await SuporteAPI.salvarResponsavel(chamadoId);

      if (error) {
        avisos(`Erro ao alterar responsável: ${error}`, "", "error");
        return;
      }

      avisos("Responsável alterado com sucesso!", "", "success");
      this.verChamado(chamadoId);
    },

    async finalizarAtendimento(id) {
      const { data, error } = await SuporteAPI.finalizarAtendimento(id);

      if (error) {
        avisos(`Erro ao finalizar atendimento: ${error}`, "", "error");
        return;
      }

      avisos("Atendimento finalizado com sucesso!", "", "success");
      
      // Fechar o modal de visualização do chamado
      ModalState.componentes.modalVerChamado.close();
      
      // Atualizar a lista de chamados
      await ModalUI.carregarDados(ModalState.paginacao.pagina);
    },

    async processarAnexos(files) {
      if (!files || files.length === 0) return;

      try {
        const anexosProcessados = await convertFilesToBase64(files);
        ModalState.anexosTemporarios = anexosProcessados;
        this.atualizarPreviewAnexos();
      } catch (error) {
        avisos("Erro ao processar arquivos", "", "error");
      }
    },

    atualizarPreviewAnexos() {
      const previewContainer = document.getElementById("anexos-preview-modal");
      const listaAnexos = document.getElementById("lista-anexos-modal");

      if (!previewContainer || !listaAnexos) return;

      if (ModalState.anexosTemporarios.length === 0) {
        previewContainer.style.display = "none";
        return;
      }

      previewContainer.style.display = "block";
      listaAnexos.innerHTML = "";

      ModalState.anexosTemporarios.forEach((anexo, index) => {
        const anexoElement = document.createElement("div");
        anexoElement.className = "bg-base-300 p-2 rounded flex items-center gap-2";
        anexoElement.innerHTML = `
          <i class="fas fa-paperclip"></i>
          <span class="text-sm">${anexo.nome}</span>
          <button class="btn btn-xs btn-ghost" onclick="window.SuporteModal.removerAnexo(${index})">
            <i class="fas fa-times"></i>
          </button>
        `;
        listaAnexos.appendChild(anexoElement);
      });
    },

    removerAnexo(index) {
      ModalState.anexosTemporarios.splice(index, 1);
      this.atualizarPreviewAnexos();
    },

    limparAnexos() {
      ModalState.anexosTemporarios = [];
      this.atualizarPreviewAnexos();
    },

    async enviarMensagem() {
      const textarea = document.getElementById("mensagem-resposta-modal");
      if (!textarea) return;

      let mensagem = textarea.value.trim();
      if (!mensagem && ModalState.anexosTemporarios.length === 0) {
        avisos("Digite uma mensagem ou anexe um arquivo", "", "warning");
        return;
      }
      if (!mensagem && ModalState.anexosTemporarios.length > 0) {
        mensagem = ".";
        textarea.value = ".";
      }

      try {
        const { data, error } = await SuporteAPI.salvarAtendimento(
          ModalState.chamadoAtual.id,
          mensagem,
          ModalState.anexosTemporarios
        );

        if (error) {
          avisos(`Erro ao enviar mensagem: ${error}`, "", "error");
          return;
        }

        avisos("Mensagem enviada com sucesso!", "", "success");
        textarea.value = "";
        this.limparAnexos();
        
        // Recarregar o chamado
        this.verChamado(ModalState.chamadoAtual.id);
      } catch (error) {
        avisos("Erro inesperado ao enviar mensagem", "", "error");
      }
    },

    // Métodos de debug
    getState() {
      return ModalState;
    },

    getAPI() {
      return SuporteAPI;
    }
  };

})();
