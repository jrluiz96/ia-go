/**
 * BashTabs - Componente de Tabs Modular e Reutilizável
 * 
 * @example
 * const tabs = new BashTabs({
 *   containerId: 'meu-container',
 *   tabs: [
 *     { id: 'tab1', label: 'Tab 1', icon: 'fas fa-home', content: '<div>Conteúdo 1</div>' },
 *     { id: 'tab2', label: 'Tab 2', content: loadContentFunction }
 *   ],
 *   onTabChange: (tabId) => console.log('Tab alterada:', tabId),
 *   defaultTab: 'tab1'
 * });
 */

class BashTabs {
  /**
   * @param {Object} config - Configuração do componente
   * @param {string} config.containerId - ID do container onde as tabs serão renderizadas
   * @param {Array} config.tabs - Array de objetos com configuração das tabs
   * @param {Function} [config.onTabChange] - Callback chamado quando a tab muda
   * @param {string} [config.defaultTab] - ID da tab ativa por padrão
   * @param {boolean} [config.lazy] - Se true, carrega conteúdo sob demanda (default: true)
   * @param {boolean} [config.cache] - Se true, mantém conteúdo em cache (default: true)
   * @param {string} [config.theme] - Tema das tabs: 'bordered', 'lifted', 'boxed' (default: 'bordered')
   * @param {string} [config.size] - Tamanho: 'xs', 'sm', 'md', 'lg' (default: 'md')
   * @param {boolean} [config.centered] - Centralizar tabs (default: false)
   * @param {string} [config.containerClass] - Classes CSS adicionais para o container principal
   * @param {string} [config.contentClass] - Classes CSS adicionais para o container de conteúdo
   */
  constructor(config) {
    this.validateConfig(config);

    // Configuração
    this.containerId = config.containerId;
    this.tabs = config.tabs;
    this.onTabChange = config.onTabChange || null;
    this.defaultTab = config.defaultTab || this.tabs[0]?.id;
    this.lazy = config.lazy !== false;
    this.cache = config.cache !== false;
    this.theme = config.theme || 'bordered';
    this.size = config.size || 'md';
    this.centered = config.centered || false;
    this.containerClass = config.containerClass || '';
    this.contentClass = config.contentClass || '';

    // Estado
    this.activeTab = null;
    this.loadedTabs = new Set();
    this.cachedContent = new Map();
    this.elements = {
      container: null,
      tabsHeader: null,
      tabsContent: null,
      tabButtons: new Map(),
      tabPanels: new Map()
    };

    // Inicializar
    this.init();
  }

  /**
   * Valida a configuração fornecida
   */
  validateConfig(config) {
    if (!config.containerId) {
      throw new Error('BashTabs: containerId é obrigatório');
    }

    if (!config.tabs || !Array.isArray(config.tabs) || config.tabs.length === 0) {
      throw new Error('BashTabs: tabs deve ser um array não vazio');
    }

    config.tabs.forEach((tab, index) => {
      if (!tab.id) {
        throw new Error(`BashTabs: tab[${index}] deve ter um id`);
      }
      if (!tab.label) {
        throw new Error(`BashTabs: tab[${index}] deve ter um label`);
      }
    });
  }

  /**
   * Inicializa o componente
   */
  init() {
    console.log(`🎨 Inicializando BashTabs em #${this.containerId}`);

    // Capturar container
    this.elements.container = document.getElementById(this.containerId);
    
    if (!this.elements.container) {
      throw new Error(`BashTabs: Container #${this.containerId} não encontrado`);
    }

    // Renderizar estrutura
    this.render();

    // Ativar tab padrão
    if (this.defaultTab) {
      this.setActiveTab(this.defaultTab);
    }

    console.log(`✅ BashTabs inicializado com ${this.tabs.length} tabs`);
  }

  /**
   * Renderiza a estrutura das tabs
   */
  render() {
    const themeClass = this.getThemeClass();
    const sizeClass = this.getSizeClass();
    const centerClass = this.centered ? 'justify-center' : '';

    // Limpar container
    this.elements.container.innerHTML = '';

    // Criar estrutura
    const tabsContainer = document.createElement('div');
    tabsContainer.className = `bash-tabs-container ${this.containerClass}`.trim();
    tabsContainer.innerHTML = `
      <div role="tablist" class="tabs ${themeClass} ${sizeClass} ${centerClass}" data-bash-tabs-header></div>
      <div class="bash-tabs-content mt-4 ${this.contentClass}" data-bash-tabs-content></div>
    `;

    this.elements.container.appendChild(tabsContainer);

    // Capturar elementos
    this.elements.tabsHeader = tabsContainer.querySelector('[data-bash-tabs-header]');
    this.elements.tabsContent = tabsContainer.querySelector('[data-bash-tabs-content]');

    // Renderizar tabs
    this.renderTabs();
    this.renderPanels();
  }

  /**
   * Renderiza os botões das tabs
   */
  renderTabs() {
    this.tabs.forEach(tab => {
      const button = document.createElement('a');
      button.setAttribute('role', 'tab');
      button.className = 'tab';
      button.dataset.tabId = tab.id;
      
      // Adicionar ícone se existir
      if (tab.icon) {
        const icon = document.createElement('i');
        icon.className = tab.icon;
        button.appendChild(icon);
        button.appendChild(document.createTextNode(' '));
      }

      // Adicionar label
      button.appendChild(document.createTextNode(tab.label));

      // Badge (opcional)
      if (tab.badge) {
        const badge = document.createElement('span');
        badge.className = `badge badge-sm ${tab.badgeClass || 'badge-primary'} ml-2`;
        badge.textContent = tab.badge;
        button.appendChild(badge);
      }

      // Event listener
      button.addEventListener('click', (e) => {
        e.preventDefault();
        this.setActiveTab(tab.id);
      });

      // Adicionar ao header
      this.elements.tabsHeader.appendChild(button);
      this.elements.tabButtons.set(tab.id, button);
    });
  }

  /**
   * Renderiza os painéis de conteúdo
   */
  renderPanels() {
    this.tabs.forEach(tab => {
      const panel = document.createElement('div');
      panel.className = 'bash-tab-panel';
      panel.dataset.tabId = tab.id;
      panel.style.display = 'none';

      this.elements.tabsContent.appendChild(panel);
      this.elements.tabPanels.set(tab.id, panel);
    });
  }

  /**
   * Define a tab ativa
   * @param {string} tabId - ID da tab a ser ativada
   */
  async setActiveTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    
    if (!tab) {
      console.error(`BashTabs: Tab "${tabId}" não encontrada`);
      return;
    }

    // Verificar se já está ativa
    if (this.activeTab === tabId) {
      return;
    }

    console.log(`📑 Ativando tab: ${tabId}`);

    // Atualizar estado
    const previousTab = this.activeTab;
    this.activeTab = tabId;

    // Atualizar UI dos botões
    this.updateTabButtons(tabId);

    // Carregar e mostrar conteúdo
    await this.loadTabContent(tab);

    // Atualizar visibilidade dos painéis
    this.updatePanelsVisibility(tabId);

    // Callback
    if (this.onTabChange) {
      this.onTabChange(tabId, previousTab);
    }
  }

  /**
   * Atualiza a aparência dos botões das tabs
   */
  updateTabButtons(activeTabId) {
    this.elements.tabButtons.forEach((button, tabId) => {
      button.classList.toggle('tab-active', tabId === activeTabId);
    });
  }

  /**
   * Carrega o conteúdo de uma tab
   */
  async loadTabContent(tab) {
    const panel = this.elements.tabPanels.get(tab.id);
    
    if (!panel) return;

    // Verificar se já foi carregado (lazy loading)
    if (this.lazy && this.loadedTabs.has(tab.id)) {
      console.log(`📦 Usando conteúdo em cache: ${tab.id}`);
      return;
    }

    // Verificar cache
    if (this.cache && this.cachedContent.has(tab.id)) {
      console.log(`💾 Restaurando conteúdo do cache: ${tab.id}`);
      panel.innerHTML = this.cachedContent.get(tab.id);
      this.loadedTabs.add(tab.id);
      return;
    }

    // Mostrar loading
    panel.innerHTML = this.getLoadingHTML();

    try {
      let content = '';

      // Conteúdo pode ser string, função ou Promise
      if (typeof tab.content === 'function') {
        content = await tab.content(tab.id);
      } else if (tab.content instanceof Promise) {
        content = await tab.content;
      } else {
        content = tab.content || '';
      }

      // Renderizar conteúdo
      panel.innerHTML = content;

      // Armazenar em cache
      if (this.cache) {
        this.cachedContent.set(tab.id, content);
      }

      // Marcar como carregado
      this.loadedTabs.add(tab.id);

      console.log(`✅ Conteúdo carregado: ${tab.id}`);

      // Executar script se existir
      if (tab.script) {
        await this.loadTabScript(tab);
      }

    } catch (error) {
      console.error(`❌ Erro ao carregar tab ${tab.id}:`, error);
      panel.innerHTML = this.getErrorHTML(error.message);
    }
  }

  /**
   * Carrega o script de uma tab
   */
  async loadTabScript(tab) {
    if (typeof tab.script === 'function') {
      await tab.script(tab.id);
    } else if (typeof tab.script === 'string') {
      // Carregar script externo
      await this.loadExternalScript(tab.script, `tab-script-${tab.id}`);
    }
  }

  /**
   * Carrega um script externo
   */
  loadExternalScript(src, id) {
    return new Promise((resolve, reject) => {
      // Verificar se já existe
      if (document.getElementById(id)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.id = id;
      script.src = `${src}?_=${new Date().getTime()}`;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Falha ao carregar script: ${src}`));
      document.body.appendChild(script);
    });
  }

  /**
   * Atualiza a visibilidade dos painéis
   */
  updatePanelsVisibility(activeTabId) {
    this.elements.tabPanels.forEach((panel, tabId) => {
      panel.style.display = tabId === activeTabId ? 'block' : 'none';
    });
  }

  /**
   * Retorna a classe do tema
   */
  getThemeClass() {
    const themes = {
      'bordered': 'tabs-bordered',
      'lifted': 'tabs-lifted',
      'boxed': 'tabs-boxed'
    };
    return themes[this.theme] || themes.bordered;
  }

  /**
   * Retorna a classe de tamanho
   */
  getSizeClass() {
    const sizes = {
      'xs': 'tabs-xs',
      'sm': 'tabs-sm',
      'md': 'tabs-md',
      'lg': 'tabs-lg'
    };
    return sizes[this.size] || '';
  }

  /**
   * HTML de loading
   */
  getLoadingHTML() {
    return `
      <div class="flex justify-center items-center py-16">
        <span class="loading loading-spinner loading-lg"></span>
        <span class="ml-4 text-base-content/70">Carregando...</span>
      </div>
    `;
  }

  /**
   * HTML de erro
   */
  getErrorHTML(message) {
    return `
      <div class="alert alert-error">
        <i class="fas fa-exclamation-circle"></i>
        <div>
          <h3 class="font-bold">Erro ao carregar conteúdo</h3>
          <div class="text-sm">${message}</div>
        </div>
      </div>
    `;
  }

  // ============================================================================
  // MÉTODOS PÚBLICOS
  // ============================================================================

  /**
   * Obtém a tab ativa
   * @returns {string} ID da tab ativa
   */
  getActiveTab() {
    return this.activeTab;
  }

  /**
   * Adiciona uma nova tab
   * @param {Object} tab - Configuração da tab
   * @param {number} [index] - Posição onde inserir (opcional)
   */
  addTab(tab, index) {
    if (!tab.id || !tab.label) {
      throw new Error('BashTabs.addTab: tab deve ter id e label');
    }

    // Verificar se já existe
    if (this.tabs.find(t => t.id === tab.id)) {
      console.warn(`BashTabs: Tab "${tab.id}" já existe`);
      return;
    }

    // Adicionar ao array
    if (index !== undefined && index >= 0 && index < this.tabs.length) {
      this.tabs.splice(index, 0, tab);
    } else {
      this.tabs.push(tab);
    }

    // Re-renderizar
    this.render();

    console.log(`➕ Tab adicionada: ${tab.id}`);
  }

  /**
   * Remove uma tab
   * @param {string} tabId - ID da tab a ser removida
   */
  removeTab(tabId) {
    const index = this.tabs.findIndex(t => t.id === tabId);
    
    if (index === -1) {
      console.warn(`BashTabs: Tab "${tabId}" não encontrada`);
      return;
    }

    // Remover do array
    this.tabs.splice(index, 1);

    // Se era a tab ativa, ativar outra
    if (this.activeTab === tabId) {
      const newActiveTab = this.tabs[Math.max(0, index - 1)]?.id;
      if (newActiveTab) {
        this.setActiveTab(newActiveTab);
      }
    }

    // Limpar cache
    this.cachedContent.delete(tabId);
    this.loadedTabs.delete(tabId);

    // Re-renderizar
    this.render();

    console.log(`➖ Tab removida: ${tabId}`);
  }

  /**
   * Atualiza o conteúdo de uma tab
   * @param {string} tabId - ID da tab
   * @param {string|Function} content - Novo conteúdo
   */
  updateTabContent(tabId, content) {
    const tab = this.tabs.find(t => t.id === tabId);
    
    if (!tab) {
      console.warn(`BashTabs: Tab "${tabId}" não encontrada`);
      return;
    }

    tab.content = content;

    // Limpar cache
    this.cachedContent.delete(tabId);
    this.loadedTabs.delete(tabId);

    // Se for a tab ativa, recarregar
    if (this.activeTab === tabId) {
      this.loadTabContent(tab);
    }

    console.log(`🔄 Conteúdo atualizado: ${tabId}`);
  }

  /**
   * Atualiza o badge de uma tab
   * @param {string} tabId - ID da tab
   * @param {string|number} badge - Valor do badge (null para remover)
   */
  updateBadge(tabId, badge) {
    const tab = this.tabs.find(t => t.id === tabId);
    
    if (!tab) return;

    tab.badge = badge;

    // Re-renderizar apenas o botão
    const button = this.elements.tabButtons.get(tabId);
    if (button) {
      const existingBadge = button.querySelector('.badge');
      
      if (badge) {
        if (existingBadge) {
          existingBadge.textContent = badge;
        } else {
          const badgeEl = document.createElement('span');
          badgeEl.className = `badge badge-sm ${tab.badgeClass || 'badge-primary'} ml-2`;
          badgeEl.textContent = badge;
          button.appendChild(badgeEl);
        }
      } else if (existingBadge) {
        existingBadge.remove();
      }
    }
  }

  /**
   * Limpa o cache de uma ou todas as tabs
   * @param {string} [tabId] - ID da tab (opcional, se não fornecido limpa tudo)
   */
  clearCache(tabId) {
    if (tabId) {
      this.cachedContent.delete(tabId);
      this.loadedTabs.delete(tabId);
      console.log(`🗑️ Cache limpo: ${tabId}`);
    } else {
      this.cachedContent.clear();
      this.loadedTabs.clear();
      console.log('🗑️ Todo cache limpo');
    }
  }

  /**
   * Recarrega o conteúdo da tab ativa
   */
  async reloadActiveTab() {
    if (!this.activeTab) return;

    const tab = this.tabs.find(t => t.id === this.activeTab);
    if (!tab) return;

    // Limpar cache
    this.clearCache(this.activeTab);

    // Recarregar
    await this.loadTabContent(tab);
    
    console.log(`🔄 Tab recarregada: ${this.activeTab}`);
  }

  /**
   * Habilita ou desabilita uma tab
   * @param {string} tabId - ID da tab
   * @param {boolean} disabled - Se deve desabilitar
   */
  setTabDisabled(tabId, disabled) {
    const button = this.elements.tabButtons.get(tabId);
    
    if (!button) return;

    if (disabled) {
      button.classList.add('tab-disabled', 'opacity-50', 'pointer-events-none');
    } else {
      button.classList.remove('tab-disabled', 'opacity-50', 'pointer-events-none');
    }
  }

  /**
   * Destrói o componente
   */
  destroy() {
    // Limpar event listeners
    this.elements.tabButtons.forEach(button => {
      button.replaceWith(button.cloneNode(true));
    });

    // Limpar container
    if (this.elements.container) {
      this.elements.container.innerHTML = '';
    }

    // Limpar referências
    this.elements = {};
    this.cachedContent.clear();
    this.loadedTabs.clear();

    console.log(`🗑️ BashTabs destruído: #${this.containerId}`);
  }

  /**
   * Obtém informações sobre o componente
   */
  getInfo() {
    return {
      containerId: this.containerId,
      activeTab: this.activeTab,
      totalTabs: this.tabs.length,
      loadedTabs: Array.from(this.loadedTabs),
      cachedTabs: Array.from(this.cachedContent.keys()),
      theme: this.theme,
      size: this.size
    };
  }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.BashTabs = BashTabs;
}
