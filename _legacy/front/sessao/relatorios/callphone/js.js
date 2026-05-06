/**
 * Relatórios CallPhone - Inicialização
 * Namespace: window.relatorios.callphone
 */

if (!window.relatorios) {
  window.relatorios = {};
}

(() => {
  'use strict';

  const CANAL_ATENDIMENTO_ID = 1; // Callphone

  // Estado atual
  let state = {
    relatorioAtual: null,
    filtros: {},
    operadoresCarregados: false
  };

  // Mapeamento dos relatórios
  const relatorios = {
    geral: {
      html: '/sessao/relatorios/callphone/ligacoes/index.html',
      script: '/sessao/relatorios/callphone/ligacoes/js.js',
      init: 'initLigacoesReport',
      titulo: 'Relatório Geral de Ligações'
    },
    analitico: {
      html: '/sessao/relatorios/callphone/analitico/index.html',
      script: '/sessao/relatorios/callphone/analitico/js.js',
      init: 'initAnaliticoReport',
      titulo: 'Relatório Analítico'
    },
    discador: {
      html: '/sessao/relatorios/callphone/discador/index.html',
      script: '/sessao/relatorios/callphone/discador/js.js',
      init: 'initDiscadorReport',
      titulo: 'Relatório do Discador'
    },
    receptivo: {
      html: '/sessao/relatorios/callphone/fila/index.html',
      script: '/sessao/relatorios/callphone/fila/js.js',
      init: 'initFilaReport',
      titulo: 'Relatório Receptivo (Filas)'
    },
    operadores: {
      html: '/sessao/relatorios/callphone/operador/index.html',
      script: '/sessao/relatorios/callphone/operador/js.js',
      init: 'initOperadoresReport',
      titulo: 'Relatório de Operadores'
    }
  };

  // Carregar HTML
  const loadHTML = async (path) => {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      console.error(`Erro ao carregar ${path}:`, error);
      return `
        <div class="alert alert-error shadow-lg">
          <i class="fas fa-exclamation-triangle text-xl"></i>
          <div>
            <h3 class="font-bold">Erro ao carregar relatório</h3>
            <div class="text-xs">${error.message}</div>
          </div>
        </div>
      `;
    }
  };

  // Carregar Script dinamicamente
  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  };

  // ========== CARREGAR DADOS DOS SELECTS ==========

  // Carregar empresas
  const carregarEmpresas = () => {
    req(
      `v1/relatorios/options/empresas`,
      'GET',
      null,
      (data) => {
        const select = document.getElementById('empresa');
        if (select && data.data) {
          select.innerHTML = '<option value="">Todas as empresas</option>';
          data.data.forEach(empresa => {
            const label = empresa.nome || empresa.cnpj || `Empresa ${empresa.id}`;
            select.innerHTML += `<option value="${empresa.id}">${label}</option>`;
          });
        }
      },
      (error) => {
        console.error('Erro ao carregar empresas:', error);
      }
    );
  };

  // Carregar operadores (para filtros avançados)
  const carregarOperadores = () => {
    req(
      'v1/relatorios/options/operadores',
      'GET',
      null,
      (data) => {
        const select = document.getElementById('filtro_operador');
        if (select && data.data) {
          select.innerHTML = '<option value="">Todos</option>';
          data.data.forEach(op => {
            select.innerHTML += `<option value="${op.id}">${op.nome}</option>`;
          });
        }
      },
      (error) => {
        console.error('Erro ao carregar operadores:', error);
      }
    );
  };

  // Estado das filas selecionadas
  let filasSelecionadas = [];

  // Formatar nome da fila para exibição (CAERN-FALTA-DE-AGUA -> Caern Falta de Agua)
  const formatarNomeFila = (nome) => {
    if (!nome) return '-';
    return nome
      .split('-')
      .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase())
      .join(' ');
  };

  // Carregar filas por empresa (para filtros avançados)
  const carregarFilas = (empresaID) => {
    const filasLista = document.getElementById('filas-lista');
    const filasTexto = document.getElementById('filas-selecionadas-text');
    const btnDropdown = document.getElementById('btn-dropdown-filas');
    
    if (!filasLista) return;

    // Limpar seleção anterior
    filasSelecionadas = [];
    atualizarInputFilas();

    // Se não tem empresa selecionada
    if (!empresaID) {
      filasLista.innerHTML = '<div class="text-center text-base-content/50 py-2 text-sm">Selecione uma empresa primeiro</div>';
      filasTexto.textContent = 'Selecione uma empresa primeiro';
      btnDropdown.classList.add('opacity-50', 'pointer-events-none');
      return;
    }

    filasLista.innerHTML = '<div class="text-center py-2"><span class="loading loading-spinner loading-sm"></span></div>';
    btnDropdown.classList.remove('opacity-50', 'pointer-events-none');

    req(
      `v1/relatorios/options/filasByEmpresaID/${empresaID}`,
      'GET',
      null,
      (data) => {
        if (data.data && data.data.length > 0) {
          filasLista.innerHTML = '';
          
          // Botão selecionar/limpar todas
          const headerDiv = document.createElement('div');
          headerDiv.className = 'flex justify-between items-center pb-2 mb-2 border-b border-base-300';
          headerDiv.innerHTML = `
            <button type="button" class="btn btn-xs btn-ghost" onclick="window.relatoriosCallphone.selecionarTodasFilas()">
              <i class="fas fa-check-double mr-1"></i> Todas
            </button>
            <button type="button" class="btn btn-xs btn-ghost" onclick="window.relatoriosCallphone.limparFilas()">
              <i class="fas fa-times mr-1"></i> Limpar
            </button>
          `;
          filasLista.appendChild(headerDiv);
          
          data.data.forEach(fila => {
            const nomeFormatado = formatarNomeFila(fila.nome);
            const item = document.createElement('label');
            item.className = 'flex items-center gap-2 p-2 rounded hover:bg-base-300 cursor-pointer transition-colors';
            item.innerHTML = `
              <input type="checkbox" class="checkbox checkbox-sm checkbox-primary" value="${fila.nome}" onchange="window.relatoriosCallphone.toggleFila('${fila.nome}')">
              <span class="text-sm whitespace-nowrap" title="${fila.nome}">${nomeFormatado}</span>
            `;
            filasLista.appendChild(item);
          });
          
          filasTexto.textContent = 'Todas as filas';
        } else {
          filasLista.innerHTML = '<div class="text-center text-base-content/50 py-2 text-sm">Nenhuma fila encontrada</div>';
          filasTexto.textContent = 'Nenhuma fila';
        }
      },
      (error) => {
        console.error('Erro ao carregar filas:', error);
        filasLista.innerHTML = '<div class="text-center text-error py-2 text-sm">Erro ao carregar filas</div>';
        filasTexto.textContent = 'Erro ao carregar';
      }
    );
  };

  // Toggle seleção de fila
  const toggleFila = (nome) => {
    const index = filasSelecionadas.indexOf(nome);
    if (index > -1) {
      filasSelecionadas.splice(index, 1);
    } else {
      filasSelecionadas.push(nome);
    }
    atualizarInputFilas();
  };

  // Selecionar todas as filas
  const selecionarTodasFilas = () => {
    const checkboxes = document.querySelectorAll('#filas-lista input[type="checkbox"]');
    filasSelecionadas = [];
    checkboxes.forEach(cb => {
      cb.checked = true;
      filasSelecionadas.push(cb.value);
    });
    atualizarInputFilas();
  };

  // Limpar todas as filas
  const limparFilas = () => {
    const checkboxes = document.querySelectorAll('#filas-lista input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    filasSelecionadas = [];
    atualizarInputFilas();
  };

  // Atualizar input hidden e texto do botão
  const atualizarInputFilas = () => {
    const input = document.getElementById('filtro_fila');
    const texto = document.getElementById('filas-selecionadas-text');
    
    if (input) {
      input.value = filasSelecionadas.join(',');
    }
    
    if (texto) {
      if (filasSelecionadas.length === 0) {
        texto.textContent = 'Todas as filas';
      } else if (filasSelecionadas.length === 1) {
        texto.textContent = formatarNomeFila(filasSelecionadas[0]);
      } else {
        texto.textContent = `${filasSelecionadas.length} filas selecionadas`;
      }
    }
  };

  // ========== FILTROS ==========

  // Formatar datetime-local para timestamp do banco (substitui T por espaço)
  const formatarDateTime = (value) => {
    if (!value) return null;
    // datetime-local retorna "2026-01-28T14:30" - convertemos para "2026-01-28 14:30:00"
    return value.replace('T', ' ') + ':00';
  };

  // Definir datas padrão (hoje 00:00 até 23:59) - usando fuso horário de São Paulo
  const definirDatasDefault = () => {
    // Usar data local do navegador (que deve estar em SP)
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    const hoje = `${ano}-${mes}-${dia}`;
    
    const dataInicio = document.getElementById('data_inicio');
    const dataFim = document.getElementById('data_fim');
    
    if (dataInicio && !dataInicio.value) dataInicio.value = `${hoje}T00:00`;
    if (dataFim && !dataFim.value) dataFim.value = `${hoje}T23:59`;
  };

  // Obter filtros básicos
  const getFiltrosBasicos = () => {
    return {
      data_inicio: formatarDateTime(document.getElementById('data_inicio')?.value),
      data_fim: formatarDateTime(document.getElementById('data_fim')?.value),
      empresa_id: document.getElementById('empresa')?.value || null,
      tipo_relatorio: document.getElementById('tipo_relatorio')?.value || null
    };
  };

  // Obter filtros avançados (só para relatório geral)
  const getFiltrosAvancados = () => {
    // Pegar valores do input hidden de filas (já está no formato correto: "fila1,fila2,fila3")
    const filasInput = document.getElementById('filtro_fila');
    const filasValor = filasInput?.value || '';
    
    return {
      protocolo_interno: document.getElementById('protocolo_interno')?.value || null,
      operador_id: document.getElementById('filtro_operador')?.value || null,
      num_cliente: document.getElementById('num_cliente')?.value || null,
      nome_fila: filasValor || null,
      status: document.getElementById('filtro_status')?.value || null,
      origem_desligamento: document.getElementById('filtro_origem_desligamento')?.value || null,
      tipo: document.getElementById('filtro_tipo')?.value || null,
      inicio_fila: document.getElementById('filtro_inicio_fila')?.value || null
    };
  };

  // Obter todos os filtros
  const getFiltros = () => {
    const basicos = getFiltrosBasicos();
    
    // Se for relatório geral, inclui filtros avançados
    if (basicos.tipo_relatorio === 'geral') {
      return { ...basicos, ...getFiltrosAvancados() };
    }
    
    return basicos;
  };

  // Limpar filtros
  const limparFiltros = () => {
    // Limpar filtros básicos (exceto datas que voltam pro default)
    document.getElementById('empresa').value = '';
    document.getElementById('tipo_relatorio').value = '';
    
    // Limpar filtros avançados
    const camposAvancados = [
      'protocolo_interno', 'num_cliente',
      'filtro_operador', 'filtro_fila', 'filtro_status', 
      'filtro_origem_desligamento', 'filtro_tipo', 'filtro_inicio_fila'
    ];
    
    camposAvancados.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    // Limpar multiselect de filas
    limparFilas();
    
    // Resetar datas para hoje
    definirDatasDefault();
    
    // Esconder filtros avançados
    atualizarFiltrosAvancados();
    
    showToast('Filtros limpos', 'success');
  };

  // ========== CONTROLE DE VISIBILIDADE ==========

  // Controlar visibilidade dos filtros avançados
  const atualizarFiltrosAvancados = () => {
    const container = document.getElementById('filtros_avancados_container');
    const tipoRelatorio = document.getElementById('tipo_relatorio')?.value;
    
    if (container) {
      if (tipoRelatorio === 'geral') {
        container.classList.remove('hidden');
        // Carregar dados dos selects se ainda não carregou
        if (!state.operadoresCarregados) {
          carregarOperadores();
          state.operadoresCarregados = true;
        }
        // Carregar filas baseado na empresa selecionada
        const empresaID = document.getElementById('empresa')?.value;
        carregarFilas(empresaID);
      } else {
        container.classList.add('hidden');
      }
    }
  };

  // ========== CARREGAR RELATÓRIO ==========

  const carregarRelatorio = async () => {
    const filtros = getFiltros();
    const tipo = filtros.tipo_relatorio;

    if (!tipo || !relatorios[tipo]) {
      showToast('Selecione um tipo de relatório', 'warning');
      return;
    }

    const config = relatorios[tipo];
    const container = document.getElementById('relatorio_content');
    
    if (!container) return;

    // Loading
    container.innerHTML = `
      <div class="card-body">
        <div class="flex flex-col items-center justify-center py-12">
          <span class="loading loading-spinner loading-lg text-primary"></span>
          <p class="mt-4 text-sm opacity-70">Carregando ${config.titulo}...</p>
        </div>
      </div>
    `;

    try {
      // Carregar HTML
      const html = await loadHTML(config.html);
      container.innerHTML = `<div class="card-body">${html}</div>`;

      // Carregar e executar script
      await loadScript(config.script);
      
      // Executar função de inicialização passando os filtros
      if (typeof window[config.init] === 'function') {
        window[config.init](filtros);
      }

      state.relatorioAtual = tipo;
      state.filtros = filtros;
      
      console.log(`✅ Relatório "${config.titulo}" carregado com filtros:`, filtros);

    } catch (error) {
      console.error('Erro ao carregar relatório:', error);
      container.innerHTML = `
        <div class="card-body">
          <div class="alert alert-error">
            <i class="fas fa-exclamation-circle"></i>
            <span>Erro ao carregar relatório: ${error.message}</span>
          </div>
        </div>
      `;
    }
  };

  // ========== HELPERS ==========

  const showToast = (message, type = 'info') => {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: type,
        title: message,
        showConfirmButton: false,
        timer: 3000
      });
    } else {
      console.log(`[${type}] ${message}`);
    }
  };

  // ========== EVENTOS ==========

  const bindEvents = () => {
    // Botão buscar
    const btnAplicar = document.getElementById('btn_aplicar_filtros');
    if (btnAplicar) {
      btnAplicar.addEventListener('click', carregarRelatorio);
    }

    // Botão limpar
    const btnLimpar = document.getElementById('btn_limpar_filtros');
    if (btnLimpar) {
      btnLimpar.addEventListener('click', limparFiltros);
    }

    // Select tipo relatório - controla visibilidade dos filtros avançados
    const selectTipo = document.getElementById('tipo_relatorio');
    if (selectTipo) {
      selectTipo.addEventListener('change', atualizarFiltrosAvancados);
    }

    // Select empresa - recarrega filas quando muda
    const selectEmpresa = document.getElementById('empresa');
    if (selectEmpresa) {
      selectEmpresa.addEventListener('change', () => {
        const empresaID = selectEmpresa.value;
        carregarFilas(empresaID);
      });
    }

    // Enter nos inputs
    const inputsEnter = ['data_inicio', 'data_fim', 'protocolo_interno', 'num_cliente'];
    inputsEnter.forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') carregarRelatorio();
        });
      }
    });
  };

  // ========== INIT ==========

  const init = () => {
    definirDatasDefault();
    carregarEmpresas();
    bindEvents();
    console.log('✅ Sistema de Relatórios CallPhone inicializado');
  };

  // Inicializar quando DOM pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // API pública
  window.relatorios.callphone = {
    init,
    carregarRelatorio,
    getFiltros,
    limparFiltros,
    getState: () => state,
    refresh: carregarRelatorio
  };

  // API para multiselect de filas (usado nos onclick)
  window.relatoriosCallphone = {
    toggleFila,
    selecionarTodasFilas,
    limparFilas
  };

})();

console.log('📦 Módulo window.relatorios.callphone carregado');
