(function () {
  const API = {
    baseUrl: "v1/admin/base-conhecimento",

    async buscar(pagina = 1, filtros = {}) {
      try {
        console.debug("🔍 Buscando artigos...", { pagina, filtros });
        const params = new URLSearchParams({ page: pagina, ...filtros });
        const response = await reqAsync(`${this.baseUrl}?${params}`, "GET");
        console.debug("✅ Artigos carregados:", response.data);
        return { data: response.data, error: null };
      } catch (error) {
        console.error("❌ Erro ao buscar artigos:", error);
        return { data: null, error: error?.message || "Erro ao carregar artigos" };
      }
    },

    async buscarPorId(id) {
      try {
        console.debug("🔍 Buscando artigo...", { id });
        const response = await reqAsync(`${this.baseUrl}/${id}`, "GET");
        console.debug("📦 Response completo:", response);
        console.debug("📦 Response.data:", response.data);

        // Tenta pegar response.data.data, se não existir pega response.data
        const artigo = response.data?.data || response.data;
        console.debug("✅ Artigo final:", artigo);

        return { data: artigo, error: null };
      } catch (error) {
        console.error("❌ Erro ao buscar artigo:", error);
        return { data: null, error: error?.message || "Erro ao carregar artigo" };
      }
    },

    async criar(payload) {
      try {
        console.debug("➕ Criando artigo...", payload);
        const response = await reqAsync(this.baseUrl, "POST", payload);
        console.debug("✅ Artigo criado:", response.data);
        return { data: response.data, error: null };
      } catch (error) {
        console.error("❌ Erro ao criar artigo:", error);
        return { data: null, error: error?.message || "Erro ao criar artigo" };
      }
    },

    async atualizar(id, payload) {
      try {
        console.debug("✏️ Atualizando artigo...", { id, payload });
        const response = await reqAsync(`${this.baseUrl}/${id}`, "PUT", payload);
        console.debug("✅ Artigo atualizado:", response.data);
        return { data: response.data, error: null };
      } catch (error) {
        console.error("❌ Erro ao atualizar artigo:", error);
        return { data: null, error: error?.message || "Erro ao atualizar artigo" };
      }
    },

    async deletar(id) {
      try {
        console.debug("🗑️ Deletando artigo...", { id });
        const response = await reqAsync(`${this.baseUrl}/${id}`, "DELETE");
        console.debug("✅ Artigo deletado:", response.data);
        return { data: response.data, error: null };
      } catch (error) {
        console.error("❌ Erro ao deletar artigo:", error);
        return { data: null, error: error?.message || "Erro ao deletar artigo" };
      }
    },

    async buscarCategorias() {
      try {
        console.debug("🔍 Buscando categorias...");
        
        const url = `v1/admin/options/categorias`;
        const response = await reqAsync(url, "GET");
        console.debug("✅ Categorias carregadas:", response.data);
        return { data: response.data, error: null };
      } catch (error) {
        console.error("❌ Erro ao buscar categorias:", error);
        return { data: [], error: error?.message || "Erro ao carregar categorias" };
      }
    },

    async estatisticas() {
      try {
        console.debug("📊 Buscando estatísticas...");
        const response = await reqAsync(`${this.baseUrl}/estatisticas`, "GET");
        console.debug("✅ Estatísticas carregadas:", response.data);
        return { data: response.data, error: null };
      } catch (error) {
        console.error("❌ Erro ao buscar estatísticas:", error);
        return { data: { total: 0, ativos: 0, usos: 0, efetividade: 0 }, error: null };
      }
    },

    async buscarEmpresas() {
      try {
        console.debug("🔍 Buscando números WhatsApp...");
        
        const url = `v1/admin/options/empresas`;

        const response = await reqAsync(url, "GET");
        console.log(response);
        return { data: response.data, error: null };
      } catch (error) {
        console.error("❌ Erro ao buscar números WhatsApp:", error);
        return { data: [], error: error?.message || "Erro ao carregar números WhatsApp" };
      }
    }
  };

  // Estado global
  const Estado = {
    paginaAtual: 1,
    filtros: {},
    artigos: [],
    categorias: [],
    categoriasFlat: [], // Categorias achatadas com caminho completo
    brokers: [],
  };

  // ============================================================================
  // HELPERS DE CATEGORIAS
  // ============================================================================

  /**
   * Achata a árvore de categorias em uma lista plana com caminho completo
   * Ex: "Atendimento > Reclamações > Entrega"
   */
  function flattenCategorias(categorias, prefixo = '') {
    let resultado = [];
    
    for (const cat of categorias) {
      const nomeCompleto = prefixo ? `${prefixo} > ${cat.nome}` : cat.nome;
      
      resultado.push({
        id: cat.id,
        nome: cat.nome,
        nomeCompleto: nomeCompleto,
        parentId: cat.parent_id,
        ordem: cat.ordem
      });
      
      // Processar subcategorias recursivamente
      if (cat.subcategorias && cat.subcategorias.length > 0) {
        resultado = resultado.concat(flattenCategorias(cat.subcategorias, nomeCompleto));
      }
    }
    
    return resultado;
  }

  /**
   * Gera options HTML para select de categorias com hierarquia visual
   */
  function renderCategoriasOptions(selectedId = null) {
    return Estado.categoriasFlat.map(cat => `
      <option value="${cat.id}" ${selectedId === cat.id ? 'selected' : ''}>
        ${cat.nomeCompleto}
      </option>
    `).join('');
  }

  /**
   * Retorna o nome completo (com hierarquia) de uma categoria pelo ID
   */
  function getNomeCategoriaCompleto(categoriaId) {
    const cat = Estado.categoriasFlat.find(c => c.id === categoriaId);
    return cat ? cat.nomeCompleto : null;
  }

  // ============================================================================
  // MODAL: CRIAR/EDITAR ARTIGO
  // ============================================================================

  function abrirModalArtigo(artigo = null) {
    const isEdicao = !!artigo;
    const titulo = isEdicao ? "Editar Artigo" : "Novo Artigo";

    const modalHtml = `
      <div class="modal modal-open" id="modal-artigo">
        <div class="modal-box max-w-5xl">
          <div class="flex justify-between items-center mb-6">
            <h3 class="font-bold text-xl">${titulo}</h3>
            <button class="btn btn-sm btn-circle btn-ghost" onclick="document.getElementById('modal-artigo').remove()">✕</button>
          </div>

          <form id="form-artigo" class="space-y-4">
            <!-- Tabs -->
            <div role="tablist" class="tabs tabs-bordered">
              <a role="tab" class="tab tab-active" data-tab="conteudo">Conteúdo</a>
              <a role="tab" class="tab" data-tab="configuracoes">Configurações</a>
            </div>

            <!-- TAB: Conteúdo -->
            <div class="tab-content" data-tab-content="conteudo">
              <!-- Título -->
              <div class="form-control">
                <label class="label">
                  <span class="label-text font-semibold">Título *</span>
                  <span class="label-text-alt text-gray-500"><span id="titulo-count">0</span>/300</span>
                </label>
                <input 
                  type="text" 
                  name="titulo" 
                  class="input input-bordered w-full" 
                  placeholder="Ex: Como rastrear meu pedido?"
                  maxlength="300"
                  value="${artigo?.titulo || ''}"
                  required
                />
              </div>

              <!-- Pergunta (opcional para FAQ) -->
              <div class="form-control">
                <label class="label">
                  <span class="label-text font-semibold">Pergunta (opcional)</span>
                  <span class="label-text-alt text-gray-500">Para FAQs, escreva a pergunta do cliente</span>
                </label>
                <textarea 
                  name="pergunta" 
                  class="textarea textarea-bordered w-full h-20" 
                  placeholder="Ex: Como eu faço para rastrear o meu pedido?"
                >${artigo?.pergunta || ''}</textarea>
              </div>

              <!-- Resposta -->
              <div class="form-control">
                <label class="label">
                  <span class="label-text font-semibold">Resposta *</span>
                  <span class="label-text-alt text-gray-500">A resposta que a IA irá fornecer</span>
                </label>
                <textarea 
                  name="resposta" 
                  class="textarea textarea-bordered w-full h-40" 
                  placeholder="Digite a resposta completa que a IA deve fornecer..."
                  required
                >${artigo?.resposta || ''}</textarea>
              </div>

              <!-- Contexto de Uso -->
              <div class="form-control">
                <label class="label">
                  <span class="label-text font-semibold">Contexto de Uso</span>
                  <span class="label-text-alt text-gray-500">Quando a IA deve usar este artigo?</span>
                </label>
                <textarea 
                  name="contexto_uso" 
                  class="textarea textarea-bordered w-full h-24" 
                  placeholder="Ex: Usar quando o cliente perguntar sobre rastreamento, localização ou status de entrega do pedido"
                >${artigo?.contexto_uso || ''}</textarea>
                <label class="label">
                  <span class="label-text-alt text-info">💡 Dica: Seja específico sobre quando usar. Isso ajuda a IA a decidir melhor.</span>
                </label>
              </div>

              <!-- Palavras-chave -->
              <div class="form-control">
                <label class="label">
                  <span class="label-text font-semibold">Palavras-chave</span>
                  <span class="label-text-alt text-gray-500">Separe por vírgula</span>
                </label>
                <input 
                  type="text" 
                  name="palavras_chave" 
                  class="input input-bordered w-full" 
                  placeholder="Ex: rastreamento, pedido, entrega, correios, transportadora"
                  value="${artigo?.palavras_chave?.join(', ') || ''}"
                />
                <label class="label">
                  <span class="label-text-alt">Ajuda na busca por keywords. Exemplo: rastreamento, pedido, entrega</span>
                </label>
              </div>
            </div>

            <!-- TAB: Configurações -->
            <div class="tab-content hidden" data-tab-content="configuracoes">
              <!-- Empresa -->
              <div class="form-control">
                <label class="label">
                  <span class="label-text font-semibold">Empresa</span>
                  <span class="label-text-alt text-gray-500">Selecione a empresa</span>
                </label>
                <select name="empresa" class="select select-bordered w-full" required>
                  <option value="">Selecione uma empresa</option>
                  ${Estado.brokers.map(broker => `
                    <option value="${broker.id}" ${artigo?.broker_id === broker.id ? 'selected' : ''}>
                      ${broker.nome.charAt(0).toUpperCase() + broker.nome.slice(1)}
                    </option>
                  `).join('')}
                </select>
              </div>

              <!-- Categoria -->
              <div class="form-control">
                <label class="label">
                  <span class="label-text font-semibold">Categoria</span>
                </label>
                <select name="categoria_id" class="select select-bordered w-full">
                  <option value="">Nenhuma categoria</option>
                  ${renderCategoriasOptions(artigo?.categoria_id)}
                </select>
              </div>

              <!-- Prioridade -->
              <div class="form-control">
                <label class="label">
                  <span class="label-text font-semibold">Prioridade</span>
                  <span class="label-text-alt text-gray-500">1 (baixa) a 10 (alta)</span>
                </label>
                <div class="flex items-center gap-4">
                  <input 
                    type="range" 
                    name="prioridade" 
                    min="1" 
                    max="10" 
                    value="${artigo?.prioridade || 5}" 
                    class="range range-primary flex-1"
                    step="1"
                  />
                  <div class="badge badge-lg badge-primary" id="prioridade-value">${artigo?.prioridade || 5}</div>
                </div>
                <div class="w-full flex justify-between text-xs px-2 mt-1">
                  <span>1</span>
                  <span>5</span>
                  <span>10</span>
                </div>
              </div>

              <!-- Ativo -->
              <div class="form-control">
                <label class="label cursor-pointer justify-start gap-4">
                  <input 
                    type="checkbox" 
                    name="ativo" 
                    class="toggle toggle-success" 
                    ${artigo?.ativo !== false ? 'checked' : ''}
                  />
                  <div>
                    <span class="label-text font-semibold">Artigo Ativo</span>
                    <p class="text-xs text-gray-500">Se desativado, não será usado pela IA</p>
                  </div>
                </label>
              </div>
            </div>

            <!-- Ações -->
            <div class="modal-action">
              <button type="button" class="btn btn-ghost" onclick="document.getElementById('modal-artigo').remove()">
                Cancelar
              </button>
              <button type="submit" class="btn btn-primary">
                <i class="fa-solid fa-save"></i>
                ${isEdicao ? 'Salvar Alterações' : 'Criar Artigo'}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById("kb-modal-container").innerHTML = modalHtml;

    // Event listeners
    configurarTabs();
    configurarContadores();
    configurarRangePrioridade();
    configurarFormSubmit(artigo);
  }

  function configurarTabs() {
    const tabs = document.querySelectorAll('[role="tab"]');
    const tabContents = document.querySelectorAll('.tab-content');

    const ativarTab = (targetTab) => {
      tabs.forEach(tab => {
        const isActive = tab.dataset.tab === targetTab;
        tab.classList.toggle('tab-active', isActive);
      });

      tabContents.forEach(content => {
        const isActive = content.dataset.tabContent === targetTab;
        content.classList.toggle('hidden', !isActive);
        content.classList.toggle('block', isActive);
      });
    };

    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        ativarTab(tab.dataset.tab);
      });
    });

    const initialTab = [...tabs].find(tab => tab.classList.contains('tab-active'))?.dataset.tab
      || tabs[0]?.dataset.tab;

    if (initialTab) {
      ativarTab(initialTab);
    }
  }

  function configurarContadores() {
    const tituloInput = document.querySelector('input[name="titulo"]');
    const tituloCount = document.getElementById('titulo-count');

    if (tituloInput) {
      tituloInput.addEventListener('input', () => {
        tituloCount.textContent = tituloInput.value.length;
      });
      // Atualizar contador inicial
      tituloCount.textContent = tituloInput.value.length;
    }
  }

  function configurarRangePrioridade() {
    const rangeInput = document.querySelector('input[name="prioridade"]');
    const valueDisplay = document.getElementById('prioridade-value');

    if (rangeInput) {
      rangeInput.addEventListener('input', () => {
        valueDisplay.textContent = rangeInput.value;
      });
    }
  }

  function configurarFormSubmit(artigo) {
    const form = document.getElementById('form-artigo');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(form);

      // Processar palavras-chave
      const palavrasChaveStr = formData.get('palavras_chave');
      const palavrasChave = palavrasChaveStr
        ? palavrasChaveStr.split(',').map(p => p.trim()).filter(p => p)
        : [];

      const payload = {
        tipo: formData.get('tipo'),
        titulo: formData.get('titulo'),
        pergunta: formData.get('pergunta') || null,
        resposta: formData.get('resposta'),
        contexto_uso: formData.get('contexto_uso') || null,
        palavras_chave: palavrasChave,
        categoria_id: formData.get('categoria_id') ? parseInt(formData.get('categoria_id')) : null,
        prioridade: parseInt(formData.get('prioridade')),
        ativo: formData.get('ativo') === 'on',
        empresa: parseInt(formData.get('empresa')) || '',
      };

      console.log('📤 Enviando payload:', payload);

      let result;
      if (artigo) {
        result = await API.atualizar(artigo.id, payload);
      } else {
        result = await API.criar(payload);
      }

      if (result.error) {
        avisos('Erro', result.error, 'danger');
        return;
      }

      avisos(
        'Sucesso',
        artigo ? 'Artigo atualizado com sucesso!' : 'Artigo criado com sucesso!',
        'success'
      );

      document.getElementById('modal-artigo').remove();
      carregarArtigos();
    });
  }

  // ============================================================================
  // INICIALIZAÇÃO
  // ============================================================================

  async function carregarCategorias() {
    const { data, error } = await API.buscarCategorias();
    if (!error && data) {
      Estado.categorias = data;
      Estado.categoriasFlat = flattenCategorias(data);
    }
  }

  async function carregarEmpresas() {
    console.log("🚚 Carregando empresas...");
    const response = await API.buscarEmpresas();
    console.log("🚚 Empresas carregadas:", response);
    if (!response.error && response.data) {
      Estado.brokers = response.data;
    }
  }

  async function carregarEstatisticas() {
    const { data, error } = await API.estatisticas();
    if (!error && data) {
      document.getElementById('kb-stat-total').textContent = data.total || 0;
      document.getElementById('kb-stat-ativos').textContent = data.ativos || 0;
      document.getElementById('kb-stat-usos').textContent = data.usos || 0;
      document.getElementById('kb-stat-efetividade').textContent = `${data.efetividade || 0}%`;
    }
  }

  async function carregarArtigos() {
    const loading = document.getElementById('kb-loading');
    const container = document.getElementById('kb-tabela-container');

    loading.classList.remove('hidden');
    loading.innerHTML = '<div class="flex justify-center"><span class="loading loading-spinner loading-lg"></span></div>';

    const { data, error } = await API.buscar(Estado.paginaAtual, Estado.filtros);

    loading.classList.add('hidden');

    if (error) {
      container.innerHTML = `
        <div class="p-8 text-center">
          <p class="text-error">❌ ${error}</p>
        </div>
      `;
      return;
    }

    if (!data?.data || data.data.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center">
          <i class="fa-solid fa-inbox text-4xl text-gray-300 mb-4"></i>
          <p class="text-gray-500">Nenhum artigo encontrado</p>
          <button class="btn btn-primary btn-sm mt-4" onclick="document.getElementById('kb-btn-novo').click()">
            Criar primeiro artigo
          </button>
        </div>
      `;
      return;
    }

    Estado.artigos = data.data;

    const tabelaHtml = `
      <div class="overflow-x-auto">
        <table class="table table-zebra">
          <thead>
            <tr>
              <th>Título</th>
              <th>Empresa</th>
              <th>Categoria</th>
              <th class="text-center">Prioridade</th>
              <th class="text-center">Estatísticas</th>
              <th class="text-center">Status</th>
              <th class="text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${data.data.map(artigo => `
              <tr>
                <td>
                  <div class="max-w-md">
                    <p class="font-semibold">${artigo.titulo}</p>
                    ${artigo.pergunta ? `<p class="text-xs text-gray-500">${artigo.pergunta}</p>` : ''}
                  </div>
                </td>
                <td>
                  ${artigo.empresa_id ? `
                    <span class="badge badge-outline badge-sm ${getBadgeEmpresa(artigo.broker_id)}">${Estado.brokers.find(broker => broker.id === artigo.empresa_id)?.nome.toUpperCase() || ''}</span>
                  ` : '<span class="text-gray-400 text-xs">-</span>'}
                </td>
                <td>
                  ${artigo.categoria_id ? `
                    <span class="badge badge-outline badge-sm" title="${getNomeCategoriaCompleto(artigo.categoria_id) || artigo.categoria?.nome || ''}">
                      ${getNomeCategoriaCompleto(artigo.categoria_id) || artigo.categoria?.nome || 'Sem categoria'}
                    </span>
                  ` : '<span class="text-gray-400 text-xs">Sem categoria</span>'}
                </td>
                <td class="text-center">
                  <div class="badge ${getPrioridadeBadge(artigo.prioridade)}">${artigo.prioridade}</div>
                </td>
                <td class="text-center">
                  <div class="text-xs">
                    <div>📊 ${artigo.vezes_usado || 0} usos</div>
                    <div class="text-success">👍 ${artigo.vezes_util || 0}</div>
                    <div class="text-error">👎 ${artigo.vezes_nao_util || 0}</div>
                  </div>
                </td>
                <td class="text-center">
                  <span class="badge ${artigo.ativo ? 'badge-success' : 'badge-ghost'}">
                    ${artigo.ativo ? '✓ Ativo' : '✗ Inativo'}
                  </span>
                </td>
                <td class="text-center">
                  <div class="flex gap-1 justify-center">
                    <button 
                      class="btn btn-ghost btn-xs" 
                      onclick="window.BashBaseConhecimento.editarArtigo(${artigo.id})"
                      title="Editar"
                    >
                      <i class="fa-solid fa-edit"></i>
                    </button>
                    <button 
                      class="btn btn-ghost btn-xs text-error" 
                      onclick="window.BashBaseConhecimento.deletarArtigo(${artigo.id}, '${artigo.titulo.replace(/'/g, "\\'")}')"
                      title="Deletar"
                    >
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = tabelaHtml;

    // Renderizar paginação
    renderizarPaginacao(data);
  }

  function renderizarPaginacao(data) {
    const container = document.getElementById('kb-pagination-container');

    if (!data.total_pages || data.total_pages <= 1) {
      container.innerHTML = '';
      return;
    }

    const totalPages = data.total_pages;
    const currentPage = data.page;

    let pagesHtml = '';

    // Primeira página
    if (currentPage > 2) {
      pagesHtml += `<button class="join-item btn btn-sm" onclick="window.BashBaseConhecimento.irParaPagina(1)">1</button>`;
      if (currentPage > 3) {
        pagesHtml += `<button class="join-item btn btn-sm btn-disabled">...</button>`;
      }
    }

    // Páginas ao redor da atual
    for (let i = Math.max(1, currentPage - 1); i <= Math.min(totalPages, currentPage + 1); i++) {
      pagesHtml += `
        <button 
          class="join-item btn btn-sm ${i === currentPage ? 'btn-active' : ''}" 
          onclick="window.BashBaseConhecimento.irParaPagina(${i})"
        >
          ${i}
        </button>
      `;
    }

    // Última página
    if (currentPage < totalPages - 1) {
      if (currentPage < totalPages - 2) {
        pagesHtml += `<button class="join-item btn btn-sm btn-disabled">...</button>`;
      }
      pagesHtml += `<button class="join-item btn btn-sm" onclick="window.BashBaseConhecimento.irParaPagina(${totalPages})">${totalPages}</button>`;
    }

    container.innerHTML = `
      <div class="p-4 flex justify-between items-center border-t">
        <div class="text-sm text-gray-500">
          Mostrando ${data.data.length} de ${data.total} artigos
        </div>
        <div class="join">
          ${pagesHtml}
        </div>
      </div>
    `;
  }

  function renderizarFiltros() {
    const container = document.getElementById('kb-filtros');

    container.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <!-- Empresa -->
        <div class="form-control">
          <label class="label">
            <span class="label-text">Empresa</span>
          </label>
          <select id="filtro-empresa" class="select select-bordered w-full">
            <option value="">Todas as empresas</option>
              ${Estado.brokers.map(broker => `
                <option value="${broker.id}" ${Estado.filtros.broker === broker.id ? 'selected' : ''}>
                  ${broker.nome.charAt(0).toUpperCase() + broker.nome.slice(1)}
                </option>
              `).join('')}
          </select>
        </div>

        <!-- Busca -->
        <div class="form-control">
          <label class="label">
            <span class="label-text">Buscar por resposta</span>
          </label>
          <input 
            type="text" 
            id="filtro-busca" 
            placeholder="Buscar por resposta..." 
            class="input input-bordered w-full"
            value="${Estado.filtros.q || ''}"
          />
        </div>

        <!-- Categoria -->
        <div class="form-control">
          <label class="label">
            <span class="label-text">Categoria</span>
          </label>
          <select id="filtro-categoria" class="select select-bordered w-full">
            <option value="">Todas as categorias</option>
            ${renderCategoriasOptions(Estado.filtros.categoria_id ? parseInt(Estado.filtros.categoria_id) : null)}
          </select>
        </div>

        <!-- Status -->
        <div class="form-control">
          <label class="label">
            <span class="label-text">Status</span>
          </label>
          <select id="filtro-ativo" class="select select-bordered w-full">
            <option value="">Todos os status</option>
            <option value="true" ${Estado.filtros.ativo === 'true' ? 'selected' : ''}>✓ Apenas ativos</option>
            <option value="false" ${Estado.filtros.ativo === 'false' ? 'selected' : ''}>✗ Apenas inativos</option>
          </select>
        </div>

      </div>

      <div class="flex justify-end gap-2 mt-4">
        <button id="btn-limpar-filtros" class="btn btn-ghost btn-sm">
          <i class="fa-solid fa-times"></i> Limpar
        </button>
        <button id="btn-aplicar-filtros" class="btn btn-primary btn-sm">
          <i class="fa-solid fa-filter"></i> Aplicar Filtros
        </button>
      </div>
    `;

    // Event listeners dos filtros
    document.getElementById('btn-aplicar-filtros').addEventListener('click', aplicarFiltros);
    document.getElementById('btn-limpar-filtros').addEventListener('click', limparFiltros);

    // Aplicar filtros ao pressionar Enter na busca
    document.getElementById('filtro-busca').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') aplicarFiltros();
    });
  }

  function aplicarFiltros() {
    const busca = document.getElementById('filtro-busca').value.trim();
    const categoriaId = document.getElementById('filtro-categoria').value;
    const ativo = document.getElementById('filtro-ativo').value;
    const empresa = document.getElementById('filtro-empresa').value;

    Estado.filtros = {};
    if (busca) Estado.filtros.q = busca;
    if (categoriaId) Estado.filtros.categoria_id = categoriaId;
    if (ativo) Estado.filtros.ativo = ativo;
    if (empresa) Estado.filtros.empresa = empresa;

    Estado.paginaAtual = 1;
    carregarArtigos();
  }

  function limparFiltros() {
    Estado.filtros = {};
    Estado.paginaAtual = 1;
    renderizarFiltros();
    carregarArtigos();
  }

  // Helpers de UI
  function getPrioridadeBadge(prioridade) {
    if (prioridade >= 8) return 'badge-error';
    if (prioridade >= 5) return 'badge-warning';
    return 'badge-ghost';
  }

  function getBadgeEmpresa(empresaId) {
    const badges = {
      1: 'badge-info',       // CAERN
      2: 'badge-primary',    // Multiskill  
      3: 'badge-success',    // Copergas
      4: 'badge-warning',    // Outra empresa
      5: 'badge-accent',     // Mais uma empresa
    };
    let number = (empresaId%5) +1
    return badges[number] || 'badge-ghost';
  }

  // Funções globais para uso nos onclick
  window.BashBaseConhecimento = {
    STATE: Estado,
    irParaPagina: function (pagina) {
      Estado.paginaAtual = pagina;
      carregarArtigos();
    },
    editarArtigo: async function (id) {
      const { data, error } = await API.buscarPorId(id);
      if (!error && data) {
        abrirModalArtigo(data);
      } else {
        avisos('Erro', error || 'Não foi possível carregar o artigo', 'danger');
      }
    },

    deletarArtigo: async function (id, titulo) {
      abrirModalConfirmacao({
        titulo: 'Confirmar exclusão',
        mensagem: `Tem certeza que deseja deletar: ${titulo}?`,
        labelConfirmar: 'Sim, deletar',
        labelCancelar: 'Cancelar',
        tipo: 'error',
        onConfirm: async () => {
          const { error } = await API.deletar(id);

          if (error) {
            avisos('Erro', error, 'danger');
          } else {
            avisos('Sucesso', 'Artigo removido com sucesso', 'success');
            await Promise.all([carregarArtigos(), carregarEstatisticas()]);
          }
        }
      });
    }
  }


  async function inicializar() {
    console.log("🚀 Inicializando Base de Conhecimento...");

    // Carregar dados auxiliares
    await Promise.all([
      carregarEmpresas(),
      carregarCategorias(),
      carregarEstatisticas(),
    ]);

    // Renderizar filtros
    renderizarFiltros();

    // Carregar artigos
    await carregarArtigos();

    // Event listeners
    document.getElementById("kb-btn-novo")?.addEventListener("click", () => abrirModalArtigo());
  }

  // Auto-inicializar quando o DOM estiver pronto
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inicializar);
  } else {
    inicializar();
  }
})();
