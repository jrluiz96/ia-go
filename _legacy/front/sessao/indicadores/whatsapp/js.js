/* =============================================================================
   Dashboard WhatsApp – indicadores/whatsapp/js.js
   ============================================================================= */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Estado
  // ---------------------------------------------------------------------------
  const STATE = {
    periodo: 'hoje',       // 'hoje' | 'semana' | 'mes'
    empresaId: null,
    timer: null,
    REFRESH_MS: 30_000,    // auto-refresh a cada 30s
  };

  const BASE_REL   = 'v1/relatorios/webbot';
  const BASE_MON   = 'v1/sessao/webbot';

  // ---------------------------------------------------------------------------
  // Helpers de data
  // ---------------------------------------------------------------------------
  function datasParaPeriodo(periodo) {
    const hoje = new Date();
    const fmt  = d => d.toISOString().split('T')[0];
    if (periodo === 'hoje') return { inicio: fmt(hoje), fim: fmt(hoje) };
    if (periodo === 'semana') {
      const seg = new Date(hoje);
      seg.setDate(hoje.getDate() - hoje.getDay() + (hoje.getDay() === 0 ? -6 : 1));
      return { inicio: fmt(seg), fim: fmt(hoje) };
    }
    // mes
    const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    return { inicio: fmt(ini), fim: fmt(hoje) };
  }

  function fmtHora(val) {
    if (!val) return '—';
    try {
      return new Date(val).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch { return '—'; }
  }

  function fmtDataHora(val) {
    if (!val) return '—';
    try {
      return new Date(val).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return '—'; }
  }

  function fmtTel(num) {
    if (!num) return '—';
    const n = String(num);
    if (n.length === 13) return n.replace(/^(\d{2})(\d{2})(\d{5})(\d{4})$/, '+$1 ($2) $3-$4');
    if (n.length === 12) return n.replace(/^(\d{2})(\d{2})(\d{4})(\d{4})$/, '+$1 ($2) $3-$4');
    return num;
  }

  function esc(str) {
    if (str == null) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function badgeStatus(s) {
    s = (s || '').toLowerCase();
    if (s.includes('finaliz'))  return 'badge-success';
    if (s.includes('andamento'))return 'badge-warning';
    if (s.includes('abandon'))  return 'badge-error';
    return 'badge-ghost';
  }

  function tempoDecorrido(val) {
    if (!val) return '—';
    const diff = Math.floor((Date.now() - new Date(val)) / 1000);
    if (diff < 60)   return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff/60)}min`;
    return `${Math.floor(diff/3600)}h ${Math.floor((diff%3600)/60)}min`;
  }

  // ---------------------------------------------------------------------------
  // API
  // ---------------------------------------------------------------------------
  async function apiGet(url, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const res = await reqAsync(qs ? `${url}?${qs}` : url, 'GET');
    return res.data || {};
  }

  async function apiPost(url, body = {}) {
    const res = await reqAsync(url, 'POST', body);
    return res.data || {};
  }

  // ---------------------------------------------------------------------------
  // Carregar empresas no select
  // ---------------------------------------------------------------------------
  async function carregarEmpresas() {
    try {
      const data = await apiGet(`${BASE_REL}/options/empresas`);
      const sel = document.getElementById('wbd_empresa');
      (data || []).forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.id;
        opt.textContent = e.nome || e.cnpj || `Empresa ${e.id}`;
        sel.appendChild(opt);
      });
    } catch (e) { console.warn('Erro ao carregar empresas', e); }
  }

  // ---------------------------------------------------------------------------
  // Carregar tudo
  // ---------------------------------------------------------------------------
  async function atualizar() {
    const { inicio, fim } = datasParaPeriodo(STATE.periodo);
    const empresaId = STATE.empresaId;

    document.getElementById('wbd_ultima_atualizacao').textContent =
      'Atualizado às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const params = {
      data_inicio: inicio,
      data_fim: fim,
      ...(empresaId ? { empresa_id: empresaId } : {}),
    };

    // Paralelo: dashboard agregado + monitoramento em tempo real
    const [dadosDash, dadosAgentes] = await Promise.allSettled([
      apiGet(`${BASE_REL}/dashboard`, params),
      apiPost(`${BASE_MON}/get-atendimentos-agente`, {
        filas: [],
        paginate: { limite: 50, pagina: 1 },
      }),
    ]);

    const dash     = dadosDash.status === 'fulfilled' ? dadosDash.value : {};
    const agentesData = dadosAgentes.status === 'fulfilled' ? dadosAgentes.value : {};

    renderKPIs(dash.kpis || {});
    renderAndamento(dash.kpis || {});
    renderRecentes(dash.recentes || []);
    renderRankingOperadores(dash.operadores || []);
    renderStatusDist(dash.status || []);
    renderFilasDist(dash.filas || []);
    renderAgentes(agentesData);
  }

  // ---------------------------------------------------------------------------
  // KPIs
  // ---------------------------------------------------------------------------
  function renderKPIs(kpis) {
    const pct = kpis.total_periodo > 0
      ? Math.round(kpis.finalizadas / kpis.total_periodo * 100)
      : 0;

    setText('wbd_kpi_andamento',       kpis.em_andamento  ?? '—');
    setText('wbd_kpi_hoje',            kpis.total_hoje    ?? '—');
    setText('wbd_kpi_periodo',         kpis.total_periodo ?? '—');
    setText('wbd_kpi_finalizadas',     kpis.finalizadas   ?? '—');
    setText('wbd_kpi_finalizadas_pct', `${pct}% do total`);
    setText('wbd_kpi_bot',             kpis.so_bot        ?? '—');
    setText('wbd_kpi_agente',          kpis.com_agente    ?? '—');
  }

  // ---------------------------------------------------------------------------
  // Conversas em andamento — usa KPI do backend + lista recentes filtrada
  // ---------------------------------------------------------------------------
  function renderAndamento(kpis) {
    const el = document.getElementById('wbd_lista_andamento');
    const total = kpis.em_andamento ?? 0;
    if (total === 0) {
      el.innerHTML = `<div class="text-center py-8 opacity-40 text-sm">Nenhuma conversa em andamento</div>`;
      return;
    }
    // Mostra contagem — a lista detalhada viria do endpoint de monitoramento
    el.innerHTML = `
      <div class="flex items-center justify-center gap-3 py-6">
        <span class="w-3 h-3 rounded-full bg-warning animate-pulse"></span>
        <span class="text-2xl font-bold text-warning">${total}</span>
        <span class="text-sm opacity-60">conversas ativas agora</span>
      </div>
      <p class="text-center text-xs opacity-40">Detalhamento disponível no monitor de atendimentos</p>`;
  }

  // ---------------------------------------------------------------------------
  // Últimas conversas (recentes do período)
  // ---------------------------------------------------------------------------
  function renderRecentes(recentes) {
    const el = document.getElementById('wbd_lista_recentes');

    if (!recentes.length) {
      el.innerHTML = `<div class="text-center py-8 opacity-40 text-sm">Nenhuma conversa no período</div>`;
      return;
    }

    el.innerHTML = recentes.map(r => {
      const nome   = r.numero ? fmtTel(r.numero) : '—';
      const op     = r.operador || 'Bot';
      const status = (r.status || '').replace(/_/g,' ');
      const hora   = fmtDataHora(r.inicio);

      return `
        <div class="flex items-center justify-between gap-2 py-1.5 border-b border-base-200 last:border-0">
          <div class="min-w-0">
            <p class="text-sm font-medium truncate">${esc(nome)}</p>
            <p class="text-xs opacity-50 truncate"><i class="fas fa-user mr-1"></i>${esc(op)}</p>
          </div>
          <div class="text-right flex-shrink-0">
            <span class="badge badge-xs ${badgeStatus(status)}">${esc(status)}</span>
            <p class="text-xs opacity-50 mt-0.5">${hora}</p>
          </div>
        </div>`;
    }).join('');
  }

  // ---------------------------------------------------------------------------
  // Ranking operadores
  // ---------------------------------------------------------------------------
  function renderRankingOperadores(operadores) {
    const el = document.getElementById('wbd_ranking_operadores');

    if (!operadores.length) {
      el.innerHTML = `<div class="text-center py-8 opacity-40 text-sm">Sem dados</div>`;
      return;
    }

    const max = operadores[0].total || 1;
    const medalhas = ['🥇','🥈','🥉'];

    el.innerHTML = operadores.map((o, i) => {
      const pct = Math.round(o.total / max * 100);
      const med = medalhas[i] || `${i+1}.`;
      return `
        <div class="mb-2">
          <div class="flex justify-between text-sm mb-0.5">
            <span class="truncate">${med} ${esc(o.operador || 'Bot')}</span>
            <span class="font-bold text-xs ml-2 flex-shrink-0">${o.total}</span>
          </div>
          <div class="w-full bg-base-200 rounded-full h-1.5">
            <div class="bg-primary h-1.5 rounded-full" style="width:${pct}%"></div>
          </div>
        </div>`;
    }).join('');
  }

  // ---------------------------------------------------------------------------
  // Distribuição por status
  // ---------------------------------------------------------------------------
  function renderStatusDist(statusList) {
    const el = document.getElementById('wbd_status_dist');

    if (!statusList.length) {
      el.innerHTML = `<div class="text-center py-8 opacity-40 text-sm">Sem dados</div>`;
      return;
    }

    const total = statusList.reduce((acc, s) => acc + (s.total || 0), 0) || 1;
    const cores = ['bg-success','bg-warning','bg-error','bg-info','bg-secondary','bg-accent','bg-primary'];

    el.innerHTML = statusList.map((s, i) => {
      const st  = (s.status || 'desconhecido').replace(/_/g,' ');
      const cnt = s.total || 0;
      const pct = Math.round(cnt / total * 100);
      const cor = cores[i % cores.length];
      return `
        <div class="flex items-center justify-between text-sm mb-2 gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <span class="w-2.5 h-2.5 rounded-full ${cor} flex-shrink-0"></span>
            <span class="truncate capitalize">${esc(st)}</span>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <span class="font-bold">${cnt}</span>
            <span class="text-xs opacity-50">${pct}%</span>
          </div>
        </div>`;
    }).join('');
  }

  // ---------------------------------------------------------------------------
  // Distribuição por fila/fluxo
  // ---------------------------------------------------------------------------
  function renderFilasDist(filas) {
    const el = document.getElementById('wbd_filas_dist');

    if (!filas.length) {
      el.innerHTML = `<div class="text-center py-8 opacity-40 text-sm">Sem dados</div>`;
      return;
    }

    const max = filas[0]?.total || 1;

    el.innerHTML = filas.map(f => {
      const pct = Math.round((f.total || 0) / max * 100);
      return `
        <div class="mb-2">
          <div class="flex justify-between text-sm mb-0.5">
            <span class="truncate">${esc(f.fila || 'Sem fila')}</span>
            <span class="font-bold text-xs ml-2 flex-shrink-0">${f.total}</span>
          </div>
          <div class="w-full bg-base-200 rounded-full h-1.5">
            <div class="bg-secondary h-1.5 rounded-full" style="width:${pct}%"></div>
          </div>
        </div>`;
    }).join('');
  }

  // ---------------------------------------------------------------------------
  // Agentes online
  // ---------------------------------------------------------------------------
  function renderAgentes(data) {
    const el = document.getElementById('wbd_agentes_online');
    const agentes = data.agentes || [];
    const stats   = data.estatisticas || {};

    if (!agentes.length) {
      el.innerHTML = `<div class="text-center py-6 opacity-40 text-sm">Nenhum agente online</div>`;
      return;
    }

    const statusBadge = s => {
      s = (s||'').toLowerCase();
      if (s === 'online'  || s === 'disponivel') return 'badge-success';
      if (s === 'ocupado' || s === 'em_atendimento') return 'badge-warning';
      return 'badge-ghost';
    };

    el.innerHTML = `
      <table class="table table-sm w-full">
        <thead>
          <tr>
            <th>Agente</th>
            <th class="text-center">Status</th>
            <th class="text-center">Ativos</th>
            <th class="text-center">Finalizados</th>
            <th class="text-center">TMA</th>
            <th class="text-center">TME</th>
          </tr>
        </thead>
        <tbody>
          ${agentes.map(a => `
            <tr>
              <td class="font-medium">${esc(a.nome_agente || a.usuario)}</td>
              <td class="text-center">
                <span class="badge badge-sm ${statusBadge(a.status)}">${esc(a.status || '—')}</span>
              </td>
              <td class="text-center font-bold">${a.atendimentos_ativos ?? '—'}</td>
              <td class="text-center">${a.atendimentos_finalizados ?? '—'}</td>
              <td class="text-center font-mono text-xs">${a.tma || '—'}</td>
              <td class="text-center font-mono text-xs">${a.tme || '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      ${stats.total_agentes ? `
        <div class="flex gap-4 mt-3 text-xs opacity-60 flex-wrap">
          <span>Total: <b>${stats.total_agentes}</b></span>
          <span>Online: <b>${stats.agentes_ativos}</b></span>
          <span>Offline: <b>${stats.agentes_inativos}</b></span>
          <span>TMA geral: <b>${stats.tma || '—'}</b></span>
        </div>` : ''}`;
  }

  // ---------------------------------------------------------------------------
  // Util
  // ---------------------------------------------------------------------------
  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val ?? '—';
  }

  // ---------------------------------------------------------------------------
  // Auto-refresh
  // ---------------------------------------------------------------------------
  function iniciarRefresh() {
    // Limpa timer anterior — pode existir de uma navegação SPA anterior
    if (window._wbDashTimer) clearInterval(window._wbDashTimer);
    window._wbDashTimer = setInterval(atualizar, STATE.REFRESH_MS);
    STATE.timer = window._wbDashTimer;
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  async function init() {
    await carregarEmpresas();

    // Período padrão: hoje
    document.querySelectorAll('.wbd_periodo').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.wbd_periodo').forEach(b => {
          b.classList.remove('btn-primary');
          b.classList.add('btn-outline');
        });
        btn.classList.add('btn-primary');
        btn.classList.remove('btn-outline');
        STATE.periodo = btn.dataset.p;
        atualizar();
      });
    });

    document.getElementById('wbd_empresa').addEventListener('change', function () {
      STATE.empresaId = this.value || null;
    });

    document.getElementById('wbd_btn_buscar').addEventListener('click', atualizar);

    await atualizar();
    iniciarRefresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Cancela qualquer instância anterior antes de inicializar
    if (window._wbDashTimer) { clearInterval(window._wbDashTimer); window._wbDashTimer = null; }
    init();
  }
})();
var filtersRelatorios = {
  dataInicio: null,
  dataFim: null,
  numeroWhatsApp: null
};
var paginationRelatorios = {
  geral: { page: 1, limit: 50 },
  campanhas: { page: 1, limit: 10 }
};
var componentesRelatorios = {
  tableGeral: null,
  paginacaoGeral: null,
  paginacaoCampanhas: null,
  tableCampanhas: null,
  tableOperacao: null,
  tableReceptivo: null
};
var dadosRelatorios = {
  geral: null,
  disparador: null,
  operacao: null,
  receptivo: null
};

(function () {
  const API = {
    baseUrl: "v1/relatorios",

    async buscarNumerosWhatsApp() {
      try {
        console.debug("🔍 Buscando números WhatsApp...");
        const url = "v1/relatorios/options/empresas";
        const response = await reqAsync(url, "GET");
        console.debug("✅ Números carregados:", response.data);
        return { data: response.data, error: null };
      } catch (error) {
        console.error("❌ Erro ao buscar números:", error);
        return {
          data: null,
          error: error?.message || "Erro ao carregar números",
        };
      }
    },

    async buscarConversasGeral(filters) {
      try {
        console.debug("🔍 Buscando conversas gerais...", filters);
        const params = new URLSearchParams({
          data_inicio: filters.dataInicio,
          data_fim: filters.dataFim,
          ...(filters.numeroWhatsApp && { canal_id: filters.numeroWhatsApp }),
          ...(filters.page && { page: filters.page }),
          ...(filters.limit && { limit: filters.limit })
        });
        const url = `${this.baseUrl}/conversas?${params}`;
        const response = await reqAsync(url, "GET");
        console.debug("✅ Conversas gerais carregadas:", response.data);
        return { data: response.data, error: null };
      } catch (error) {
        console.error("❌ Erro ao buscar conversas gerais:", error);
        return {
          data: null,
          error: error?.message || "Erro ao carregar conversas",
        };
      }
    },

    async buscarConversasExportar(filters) {
      try {
        console.debug("🔍 Buscando todas as conversas para exportação...", filters);
        const params = new URLSearchParams({
          data_inicio: filters.dataInicio,
          data_fim: filters.dataFim,
          ...(filters.numeroWhatsApp && { canal_id: filters.numeroWhatsApp })
        });
        const url = `${this.baseUrl}/conversas/exportar?${params}`;
        const response = await reqAsync(url, "GET");
        console.debug("✅ Conversas para exportação carregadas:", response.data);
        return { data: response.data, error: null };
      } catch (error) {
        console.error("❌ Erro ao buscar conversas para exportação:", error);
        return {
          data: null,
          error: error?.message || "Erro ao carregar dados para exportação",
        };
      }
    },

    async buscarCampanhas(filters) {
      try {
        console.debug("🔍 Buscando campanhas...", filters);
        const params = new URLSearchParams({
          data_inicio: filters.dataInicio,
          data_fim: filters.dataFim,
          ...(filters.page && { page: filters.page }),
          ...(filters.limit && { limit: filters.limit })
        });
        const url = `${this.baseUrl}/campanhas?${params}`;
        const response = await reqAsync(url, "GET");
        console.debug("✅ Campanhas carregadas:", response.data);
        return { data: response.data, error: null };
      } catch (error) {
        console.error("❌ Erro ao buscar campanhas:", error);
        return {
          data: null,
          error: error?.message || "Erro ao carregar campanhas",
        };
      }
    },

    async buscarDetalhesCampanha(campanhaId) {
      try {
        console.debug("🔍 Buscando detalhes da campanha...", { campanhaId });
        const url = `${this.baseUrl}/campanhas/${campanhaId}`;
        const response = await reqAsync(url, "GET");
        console.debug("✅ Detalhes da campanha carregados:", response.data);
        return { data: response.data, error: null };
      } catch (error) {
        console.error("❌ Erro ao buscar detalhes da campanha:", error);
        return {
          data: null,
          error: error?.message || "Erro ao carregar detalhes da campanha",
        };
      }
    },

    async buscarOperadores(filters) {
      try {
        console.debug("🔍 Buscando operadores...", filters);
        const params = new URLSearchParams({
          data_inicio: filters.dataInicio,
          data_fim: filters.dataFim
        });
        const url = `${this.baseUrl}/operadores?${params}`;
        const response = await reqAsync(url, "GET");
        console.debug("✅ Operadores carregados:", response.data);
        return { data: response.data, error: null };
      } catch (error) {
        console.error("❌ Erro ao buscar operadores:", error);
        return {
          data: null,
          error: error?.message || "Erro ao carregar operadores",
        };
      }
    },

    async buscarFilas(filters) {
      try {
        console.debug("🔍 Buscando filas...", filters);
        const params = new URLSearchParams({
          data_inicio: filters.dataInicio,
          data_fim: filters.dataFim,
          ...(filters.numeroWhatsApp && { canal_id: filters.numeroWhatsApp })
        });
        const url = `${this.baseUrl}/filas?${params}`;
        const response = await reqAsync(url, "GET");
        console.debug("✅ Filas carregadas:", response.data);
        return { data: response.data, error: null };
      } catch (error) {
        console.error("❌ Erro ao buscar filas:", error);
        return {
          data: null,
          error: error?.message || "Erro ao carregar filas",
        };
      }
    },

    async buscarDetalhesFila(filaId, filters) {
      try {
        console.debug("🔍 Buscando detalhes da fila...", { filaId, filters });
        const params = new URLSearchParams({
          data_inicio: filters.dataInicio,
          data_fim: filters.dataFim
        });
        const url = `${this.baseUrl}/filas/${filaId}?${params}`;
        const response = await reqAsync(url, "GET");
        console.debug("✅ Detalhes da fila carregados:", response.data);
        return { data: response.data, error: null };
      } catch (error) {
        console.error("❌ Erro ao buscar detalhes da fila:", error);
        return {
          data: null,
          error: error?.message || "Erro ao carregar detalhes da fila",
        };
      }
    },

    async buscarConversa(conversaId) {
      try {
        console.debug("🔍 Buscando conversa...", { conversaId });
        const url = `${this.baseUrl}/conversas/${conversaId}`;
        const response = await reqAsync(url, "GET");
        console.debug("✅ Conversa carregada:", response.data);
        return { data: response.data, error: null };
      } catch (error) {
        console.error("❌ Erro ao buscar conversa:", error);
        return {
          data: null,
          error: error?.message || "Erro ao carregar conversa",
        };
      }
    },
  };

  const STATE = {
    get currentTab() { return currentTabRelatorios; },
    set currentTab(val) { currentTabRelatorios = val; },
    get filters() { return filtersRelatorios; },
    set filters(val) { filtersRelatorios = val; },
    get pagination() { return paginationRelatorios; },
    set pagination(val) { paginationRelatorios = val; }
  };

  const UI = {
    init() {
      console.debug("🎨 Inicializando UI...");
      const hoje = new Date().toISOString().split('T')[0];
      $('#data_inicio').val(hoje);
      $('#data_fim').val(hoje);
      filtersRelatorios.dataInicio = hoje;
      filtersRelatorios.dataFim = hoje;
      
      // Configurar eventos
      this.setupEvents();
      console.debug("✅ UI inicializada");
    },

    setupEvents() {
      // Evento do botão Aplicar Filtros
      $('#btn_aplicar_filtros').on('click', function() {
        EVENTS.aplicarFiltros();
      });

      // Evento das abas
      $('[data-tab]').on('click', function() {
        const tab = $(this).data('tab');
        EVENTS.changeTab(tab);
      });

      // Eventos de exportação
      $('.btn-export-geral').on('click', function() {
        EVENTS.exportarGeral();
      });
      $('.btn-export-disparador').on('click', function() {
        EVENTS.exportarDisparador();
      });
      $('.btn-export-operacao').on('click', function() {
        EVENTS.exportarOperacao();
      });
      $('.btn-export-receptivo').on('click', function() {
        EVENTS.exportarReceptivo();
      });

      // Eventos de paginação
      $('.btn-pagina-anterior-geral').on('click', function() {
        if (paginationRelatorios.geral.page > 1) {
          paginationRelatorios.geral.page--;
          EVENTS.carregarGeralConversas();
        }
      });
      $('.btn-proxima-pagina-geral').on('click', function() {
        paginationRelatorios.geral.page++;
        EVENTS.carregarGeralConversas();
      });
    },

    formatarDataHora(data) {
      if (!data) return '-';
      // Data já vem no fuso correto do banco, apenas formatar
      const dt = data.replace('Z', '').replace('T', ' ').split('.')[0];
      const [datePart, timePart] = dt.split(' ');
      const [year, month, day] = datePart.split('-');
      return `${day}/${month}/${year} ${timePart}`;
    },

    formatarTelefone(numero) {
      if (!numero) return '-';
      const num = numero.toString();
      if (num.length === 13) {
        return num.replace(/^(\d{2})(\d{2})(\d{5})(\d{4})$/, '+$1 ($2) $3-$4');
      }
      return numero;
    },

    formatarTempo(tempo) {
      if (!tempo) return '-';
      
      // Remove milissegundos se existirem (formato: HH:MM:SS.MS -> HH:MM:SS)
      if (typeof tempo === 'string' && tempo.includes('.')) {
        return tempo.split('.')[0];
      }
      
      return tempo;
    },

    tempoParaSegundos(tempo) {
      if (!tempo || tempo === '-') return 0;
      
      // Formato esperado: HH:MM:SS ou HH:MM:SS.MS
      const partes = tempo.split(':');
      if (partes.length !== 3) return 0;
      
      const horas = parseInt(partes[0]) || 0;
      const minutos = parseInt(partes[1]) || 0;
      const segundos = parseFloat(partes[2]) || 0;
      
      return Math.floor(horas * 3600 + minutos * 60 + segundos);
    },

    sanitizarTexto(texto) {
      if (!texto) return '';
      
      // Mapa de substituição de caracteres acentuados
      const mapaAcentos = {
        'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'ä': 'a',
        'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
        'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
        'ó': 'o', 'ò': 'o', 'õ': 'o', 'ô': 'o', 'ö': 'o',
        'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
        'ç': 'c',
        'ñ': 'n',
        'Á': 'A', 'À': 'A', 'Ã': 'A', 'Â': 'A', 'Ä': 'A',
        'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
        'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I',
        'Ó': 'O', 'Ò': 'O', 'Õ': 'O', 'Ô': 'O', 'Ö': 'O',
        'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U',
        'Ç': 'C',
        'Ñ': 'N'
      };
      
      // Primeiro substitui acentos
      let resultado = texto.split('').map(char => mapaAcentos[char] || char).join('');
      
      // Remove emojis e caracteres especiais Unicode, mantendo apenas ASCII imprimível
      // Mantém letras, números, espaços e pontuação básica
      resultado = resultado.replace(/[^\x20-\x7E]/g, '');
      
      // Remove múltiplos espaços consecutivos
      resultado = resultado.replace(/\s+/g, ' ');
      
      return resultado.trim();
    },

    renderizarStatus(conversa) {
      if (!conversa) return '<span class="badge badge-ghost">-</span>';
      if (conversa.bl_em_atendimento) return '<span class="badge badge-info badge-sm">Em Atendimento</span>';
      if (conversa.bl_em_fila) return '<span class="badge badge-warning badge-sm">Na Fila</span>';
      if (conversa.bl_ativo) return '<span class="badge badge-success badge-sm">Bot</span>';
      return '<span class="badge badge-ghost badge-sm">Encerrado</span>';
    },

    mostrarLoading(containerId) {
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = `
          <tr>
            <td colspan="20" class="text-center py-8">
              <span class="loading loading-spinner loading-lg"></span>
              <p class="mt-2">Carregando dados...</p>
            </td>
          </tr>
        `;
      }
    },

    mostrarErro(mensagem) {
      avisos("Erro", mensagem, "error");
    },

    mostrarSucesso(mensagem) {
      avisos("Sucesso", mensagem, "success");
    },

    mostrarInfo(mensagem) {
      avisos("Informação", mensagem, "info");
    }
  };


  const RENDER = {
    geralConversas(result) {
      const conversas = result.data?.conversas || [];
      
      // Parse eventos para cada conversa
      const conversasProcessadas = conversas.map(conv => {
        let eventos = conv.eventos;
        if (typeof eventos === 'string') {
          try {
            eventos = JSON.parse(eventos);
          } catch (e) {
            eventos = {};
          }
        }
        return { ...conv, eventos };
      });

      // Criar ou atualizar tabela
      if (!componentesRelatorios.tableGeral) {
        const columns = [
          { label: 'Data/Hora', value: 'dt_criado', format: (val) => UI.formatarDataHora(val) },
          { label: 'Cliente', value: 'cliente', format: (val, row) => `<div class="font-medium">${row.cliente || row.cliente_numero}</div><div class="text-xs opacity-60">${UI.formatarTelefone(row.cliente_numero)}</div>` },
          { label: 'Fila', value: 'fila_nome', format: (val) => val || '-' },
          { label: 'Atendente', value: 'usuario_nome', format: (val) => val || '-' },
          { label: 'Status', value: 'status', format: (val) => val || 'Finalizado pelo operador' },
          { label: 'TT', value: 'eventos', title: 'Tempo Total', format: (val) => val?.TT || '-' },
          { label: 'TU', value: 'eventos', title: 'Tempo de URA', format: (val) => val?.TU || '-' },
          { label: 'TE', value: 'eventos', title: 'Tempo de Espera', format: (val) => val?.TE || '-' },
          { label: 'TA', value: 'eventos', title: 'Tempo de Atendimento', format: (val) => val?.TA || '-' },
          { label: 'Ações', value: 'id', format: (val) => `<button onclick="window.BashRelatoriosWhatsApp.EVENTS.visualizarConversa(${val})" class="btn btn-xs btn-ghost"><i class="fas fa-eye"></i></button>` }
        ];

        componentesRelatorios.tableGeral = new BashTable({
          id: 'tabela-relatorio-geral',
          columns,
          data: conversasProcessadas,
          emptyMessage: 'Nenhuma conversa encontrada no período'
        });

        componentesRelatorios.tableGeral.appendToContainer('#container-tabela-geral');
      } else {
        componentesRelatorios.tableGeral.updateData(conversasProcessadas);
      }

      // Atualizar ou criar paginação
      const pagination = result.data?.pagination || {};
      const total = pagination.total || 0;
      
      if (!componentesRelatorios.paginacaoGeral) {
        componentesRelatorios.paginacaoGeral = new BashPagination({
          id: 'paginacao-geral',
          pagina: paginationRelatorios.geral.page,
          total: total,
          limit: paginationRelatorios.geral.limit,
          onNext: (pagina) => {
            paginationRelatorios.geral.page = pagina;
            EVENTS.carregarGeralConversas();
          },
          onPrev: (pagina) => {
            paginationRelatorios.geral.page = pagina;
            EVENTS.carregarGeralConversas();
          }
        });
        componentesRelatorios.paginacaoGeral.appendToContainer('#container-paginacao-geral');
      } else {
        componentesRelatorios.paginacaoGeral.update(paginationRelatorios.geral.page, total);
      }

      if (result.data?.metricas) {
        this.atualizarMetricasGerais(result.data.metricas);
      }
    },

    atualizarMetricasGerais(metricas) {
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      set('total_conversas', metricas.total || 0);
      set('foram_para_fila', metricas.foram_para_fila || 0);
      set('abandonados',     metricas.abandonados || 0);
      set('tmt_geral',       UI.formatarTempo(metricas.tmt) || '00:00:00');

      const total = metricas.total || 0;
      const percFila       = total > 0 ? ((metricas.foram_para_fila || 0) / total * 100).toFixed(1) : '0';
      const percAbandonados = total > 0 ? ((metricas.abandonados || 0) / total * 100).toFixed(1) : '0';
      set('perc_fila',        `${percFila}% do total`);
      set('perc_abandonados', `${percAbandonados}% do total`);
    },

    campanhas(result) {
      const container = document.getElementById('lista_campanhas');
      let campanhas;
      let pagination;
      
      // Verifica se result.data tem a estrutura de paginação ou é uma lista simples
      if (result.data && typeof result.data === 'object' && result.data.campanhas) {
        campanhas = result.data.campanhas || [];
        pagination = result.data.pagination || {};
      } else {
        campanhas = result.data || [];
        pagination = {};
      }
      
      if (!campanhas || campanhas.length === 0) {
        container.innerHTML = '<div class="text-center opacity-60 py-8"><i class="fas fa-paper-plane text-4xl mb-3"></i><p>Nenhuma campanha encontrada no período</p></div>';
        
        // Limpar paginação se não há dados
        const containerPaginacao = document.getElementById('container-paginacao-campanhas');
        if (containerPaginacao) {
          containerPaginacao.innerHTML = '';
        }
        return;
      }

      container.innerHTML = campanhas.map(camp => `
        <div class="card bg-base-200 shadow-sm">
          <div class="card-body">
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <h3 class="card-title">${camp.nome || 'Sem nome'}</h3>
              </div>
              <div class="flex gap-2">
                <button onclick="window.BashRelatoriosWhatsApp.EVENTS.abrirRelatorioAnalitico(${camp.id})" class="btn btn-sm btn-secondary">
                  <i class="fas fa-chart-line mr-2"></i>Relatório Analítico
                </button>
                <button onclick="window.BashRelatoriosWhatsApp.EVENTS.visualizarRelatorioMailing(${JSON.stringify(camp).replace(/"/g, '&quot;')})" class="btn btn-sm btn-primary">
                  <i class="fas fa-chart-bar mr-2"></i>Relatório Sintético
                </button>
              </div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4">
              <div class="stat bg-base-100 rounded p-2">
                <div class="stat-title text-xs">Clientes</div>
                <div class="stat-value text-lg">${camp.quantidade_clientes || camp.total_clientes || 0}</div>
              </div>
              <div class="stat bg-base-100 rounded p-2">
                <div class="stat-title text-xs">Acionamentos</div>
                <div class="stat-value text-lg">${camp.acionamentos || camp.acionados || 0}</div>
              </div>
              <div class="stat bg-base-100 rounded p-2">
                <div class="stat-title text-xs">Status</div>
                <div class="stat-value text-sm">${camp.status_nome || 'Não definido'}</div>
              </div>
              <div class="stat bg-base-100 rounded p-2">
                <div class="stat-title text-xs">Agendamento</div>
                <div class="stat-value text-sm">${camp.agendamento ? UI.formatarDataHora(camp.agendamento) : 'Não agendado'}</div>
              </div>
              <div class="stat bg-base-100 rounded p-2">
                <div class="stat-title text-xs">Data Início</div>
                <div class="stat-value text-sm">${camp.created_at ? UI.formatarDataHora(camp.created_at) : 'Não definido'}</div>
              </div>
            </div>
            ${camp.resultado && camp.resultado.length > 0 ? `
              <div class="mt-4">
                <div class="text-sm font-medium mb-3">Resultados:</div>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-2">
                  ${camp.resultado.map(res => `
                    <div class="stat bg-base-100 rounded p-2">
                      <div class="stat-title text-xs">${res.nome || 'Resultado'}</div>
                      <div class="stat-value text-lg">${res.total || 0}</div>
                      <div class="stat-desc text-xs">
                        <div class="flex justify-start gap-2">
                          <span>Receberam: ${res.receberam || 0}</span>
                          <span>Leram: ${res.leram || 0}</span>
                        </div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `).join('');

      // Gerenciar paginação apenas se houver dados de paginação
      if (pagination.total !== undefined) {
        const total = pagination.total || 0;
        
        if (!componentesRelatorios.paginacaoCampanhas) {
          componentesRelatorios.paginacaoCampanhas = new BashPagination({
            id: 'paginacao-campanhas',
            pagina: paginationRelatorios.campanhas.page,
            total: total,
            limit: paginationRelatorios.campanhas.limit,
            onNext: (pagina) => {
              paginationRelatorios.campanhas.page = pagina;
              EVENTS.carregarDisparador();
            },
            onPrev: (pagina) => {
              paginationRelatorios.campanhas.page = pagina;
              EVENTS.carregarDisparador();
            }
          });
          
          // Verificar se container existe, senão criar
          let containerPaginacao = document.getElementById('container-paginacao-campanhas');
          if (!containerPaginacao) {
            containerPaginacao = document.createElement('div');
            containerPaginacao.id = 'container-paginacao-campanhas';
            containerPaginacao.className = 'mt-6';
            container.parentNode.appendChild(containerPaginacao);
          }
          
          componentesRelatorios.paginacaoCampanhas.appendToContainer('#container-paginacao-campanhas');
        } else {
          componentesRelatorios.paginacaoCampanhas.update(paginationRelatorios.campanhas.page, total);
        }
      }
    },

    operadores(result) {
      const tbody = document.getElementById('tabela_operacao');
      const operadores = result.data || [];
      
      if (!operadores || operadores.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center opacity-60 py-8"><i class="fas fa-user-slash text-4xl mb-3"></i><p>Nenhuma sessão encontrada no período</p></td></tr>';
        return;
      }

      tbody.innerHTML = operadores.map(op => `
        <tr>
          <td>${op.nome || '-'}</td>
          <td>${UI.formatarTempo(op.tempo_sessao)}</td>
          <td>${UI.formatarTempo(op.tempo_logado)}</td>
          <td>${UI.formatarTempo(op.tempo_pausa)}</td>
          <td>${op.total_atendimentos || 0}</td>
          <td>${UI.formatarTempo(op.tma)}</td>
          <td><button onclick="window.BashRelatoriosWhatsApp.EVENTS.visualizarDetalhesOperador(${op.id})" class="btn btn-xs btn-ghost"><i class="fas fa-eye"></i></button></td>
        </tr>
      `).join('');
    },

    filas(result) {
      const tbody = document.getElementById('tabela_receptivo');
      const filas = result.data || [];
      
      if (!filas || filas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center opacity-60 py-8"><i class="fas fa-inbox text-4xl mb-3"></i><p>Nenhuma fila com dados no período</p></td></tr>';
        return;
      }

      tbody.innerHTML = filas.map(fila => {
        const slaClass = fila.sla_percentual >= 80 ? 'text-success' : fila.sla_percentual >= 50 ? 'text-warning' : 'text-error';
        return `
          <tr>
            <td>${fila.nome || '-'}</td>
            <td>${fila.sla || '-'}</td>
            <td>${fila.total_acionamentos || 0}</td>
            <td>${UI.formatarTempo(fila.tma)}</td>
            <td>${UI.formatarTempo(fila.tme)}</td>
            <td>${UI.formatarTempo(fila.tmt)}</td>
            <td>${UI.formatarTempo(fila.tmu)}</td>
            <td class="${slaClass} font-bold">${fila.sla_percentual || 0}%</td>
            <td><button onclick="window.BashRelatoriosWhatsApp.EVENTS.visualizarDetalhesFila(${fila.id})" class="btn btn-xs btn-ghost"><i class="fas fa-chart-bar"></i></button></td>
          </tr>
        `;
      }).join('');
    }
  };


  const EVENTS = {
    init() {
      console.debug("⚡ Inicializando eventos...");
    },

    changeTab(tab) {
      currentTabRelatorios = tab;
      $('[data-tab]').removeClass('tab-active');
      $(`[data-tab="${tab}"]`).addClass('tab-active');
      $('.tab-content').hide();
      $(`#tab_${tab}`).show();
      this.carregarDadosAba(tab);
    },

    aplicarFiltros() {
      filtersRelatorios.dataInicio = $('#data_inicio').val();
      filtersRelatorios.dataFim = $('#data_fim').val();
      filtersRelatorios.numeroWhatsApp = $('#whatsapp_number').val() || null;
      this.carregarDadosAba(currentTabRelatorios);
    },

    async carregarDadosAba(tab) {
      switch(tab) {
        case 'geral': await this.carregarGeralConversas(); break;
        case 'disparador': await this.carregarDisparador(); break;
        case 'operacao': await this.carregarOperacao(); break;
        case 'receptivo': await this.carregarReceptivo(); break;
      }
    },

    async carregarGeralConversas() {
      try {
        // Mostrar loading na tabela se já existir
        if (componentesRelatorios.tableGeral) {
          componentesRelatorios.tableGeral.showLoading('Carregando conversas...');
        }
        
        const filters = { ...filtersRelatorios, ...paginationRelatorios.geral };
        const { data, error } = await API.buscarConversasGeral(filters);
        
        if (error) { 
          UI.mostrarErro(error);
          if (componentesRelatorios.tableGeral) {
            componentesRelatorios.tableGeral.showError(error);
          }
          return;
        }
        
        dadosRelatorios.geral = data; // Armazenar dados
        RENDER.geralConversas({ data });
      } catch (error) {
        console.error('Erro ao carregar conversas:', error);
        UI.mostrarErro("Erro ao carregar dados gerais");
        if (componentesRelatorios.tableGeral) {
          componentesRelatorios.tableGeral.showError("Erro ao carregar dados gerais");
        }
      }
    },

    async carregarDisparador() {
      try {
        UI.mostrarLoading('lista_campanhas');
        const filters = { ...filtersRelatorios, ...paginationRelatorios.campanhas };
        const { data, error } = await API.buscarCampanhas(filters);
        if (error) { UI.mostrarErro(error); return; }
        dadosRelatorios.disparador = data; // Armazenar dados completos
        RENDER.campanhas({ data });
      } catch (error) {
        UI.mostrarErro("Erro ao carregar campanhas");
      }
    },

    async carregarOperacao() {
      try {
        UI.mostrarLoading('tabela_operacao');
        const { data, error } = await API.buscarOperadores(filtersRelatorios);
        if (error) { UI.mostrarErro(error); return; }
        dadosRelatorios.operacao = data; // Armazenar dados
        RENDER.operadores({ data });
      } catch (error) {
        UI.mostrarErro("Erro ao carregar dados de operação");
      }
    },

    async carregarReceptivo() {
      try {
        UI.mostrarLoading('tabela_receptivo');
        const { data, error } = await API.buscarFilas(filtersRelatorios);
        if (error) { UI.mostrarErro(error); return; }
        dadosRelatorios.receptivo = data; // Armazenar dados
        RENDER.filas({ data });
      } catch (error) {
        UI.mostrarErro("Erro ao carregar dados receptivo");
      }
    },

    async visualizarConversa(conversaId) {
      try {
        console.log("Visualizar conversa:", conversaId);
        
        // Abrir modal e mostrar loading
        const modal = document.getElementById('modal_visualizar_conversa');
        modal.showModal();
        
        // Buscar dados da conversa
        const { data, error } = await API.buscarConversa(conversaId);
        if (error || !data) {
          document.getElementById('container_mensagens').innerHTML = `
            <div class="text-center opacity-60 py-8 text-error">
              <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
              <p>Erro ao carregar conversa</p>
            </div>
          `;
          return;
        }
        
        // Preencher informações do atendimento
        document.getElementById('modal_conversa_cliente').textContent = data.cliente_nome || '-';
        document.getElementById('modal_conversa_telefone').textContent = UI.formatarTelefone(data.cliente_numero);
        document.getElementById('modal_conversa_atendente').textContent = data.usuario_nome || 'Sem atendente';
        document.getElementById('modal_conversa_data').textContent = UI.formatarDataHora(data.dt_criado);
        
        // Renderizar mensagens
        const container = document.getElementById('container_mensagens');
        if (!data.mensagens || data.mensagens.length === 0) {
          container.innerHTML = `
            <div class="text-center opacity-60 py-8">
              <i class="fas fa-comment-slash text-2xl mb-2"></i>
              <p>Nenhuma mensagem nesta conversa</p>
            </div>
          `;
          return;
        }
        
        container.innerHTML = data.mensagens.map(msg => {
          // Cliente: usuario_nome é "Cliente" ou igual ao nome do cliente
          // Bot/Sistema: usuario_nome contém "Bot", "Sistema", "Caren", etc
          const nomeUsuario = (msg.usuario_nome || '').toLowerCase();
          const isCliente = nomeUsuario === 'cliente' || msg.usuario_nome === data.cliente_nome;
          const hora = msg.created_at ? new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
          
          return `
            <div class="chat ${isCliente ? 'chat-end' : 'chat-start'} mb-2">
              <div class="chat-header">
                ${msg.usuario_nome || 'Sistema'}
                <time class="text-xs opacity-50 ml-1">${hora}</time>
              </div>
              <div class="chat-bubble ${isCliente ? 'chat-bubble-primary' : 'chat-bubble-warning'}">
                ${msg.file ? `
                  <div class="mb-2">
                    <i class="fas fa-paperclip mr-1"></i>
                    <a href="${msg.file}" target="_blank" class="link">${msg.mime_type || 'Arquivo'}</a>
                  </div>
                ` : ''}
                ${msg.mensagem || ''}
              </div>
            </div>
          `;
        }).join('');
        
        // Configurar botões de download
        document.getElementById('btn_download_txt').onclick = () => this.downloadConversaTXT(data);
        document.getElementById('btn_download_html').onclick = () => this.downloadConversaHTML(data);
        document.getElementById('btn_download_pdf').onclick = () => this.downloadConversaPDF(data);
        
      } catch (error) {
        console.error("Erro ao visualizar conversa:", error);
        UI.mostrarErro("Erro ao carregar conversa");
      }
    },
    
    downloadConversaTXT(data) {
      let texto = `HISTÓRICO DA CONVERSA\n`;
      texto += `${'='.repeat(60)}\n\n`;
      texto += `Cliente: ${data.cliente_nome}\n`;
      texto += `Telefone: ${data.cliente_numero}\n`;
      texto += `Atendente: ${data.usuario_nome || 'Sem atendente'}\n`;
      texto += `Data/Hora: ${UI.formatarDataHora(data.dt_criado)}\n`;
      texto += `\n${'='.repeat(60)}\n\n`;
      
      if (data.mensagens && data.mensagens.length > 0) {
        data.mensagens.forEach(msg => {
          const hora = msg.created_at ? new Date(msg.created_at).toLocaleTimeString('pt-BR') : '';
          
          texto += `[${hora}] ${msg.usuario_nome || 'Sistema'}:\n`;
          if (msg.file) {
            texto += `  📎 Arquivo: ${msg.file}\n`;
          }
          texto += `  ${msg.mensagem || ''}\n\n`;
        });
      } else {
        texto += `Nenhuma mensagem nesta conversa.\n`;
      }
      
      // Criar e baixar arquivo
      const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `conversa_${data.id}_${data.cliente_numero}.txt`;
      link.click();
      URL.revokeObjectURL(link.href);
      
      UI.mostrarSucesso('Arquivo TXT baixado com sucesso!');
    },
    
    downloadConversaHTML(data) {
      const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Conversa - ${data.cliente_nome || data.cliente_numero}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .logo {
            width: 150px;
            height: auto;
            margin-bottom: 15px;
            filter: brightness(0) invert(1);
        }
        
        .header h1 {
            font-size: 26px;
            font-weight: 600;
            margin-bottom: 5px;
        }
        
        .header p {
            font-size: 14px;
            opacity: 0.95;
        }
        
        .info-section {
            background: #f8f9fa;
            padding: 25px 30px;
            border-bottom: 2px solid #e9ecef;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
        }
        
        .info-item {
            display: flex;
            flex-direction: column;
        }
        
        .info-label {
            font-size: 11px;
            color: #6c757d;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
        }
        
        .info-value {
            font-size: 15px;
            color: #212529;
            font-weight: 500;
        }
        
        .messages {
            padding: 30px;
            min-height: 400px;
            background: #fafbfc;
        }
        
        .message {
            margin-bottom: 16px;
            display: flex;
            flex-direction: column;
            animation: fadeIn 0.3s ease-in;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .message.cliente {
            align-items: flex-end;
        }
        
        .message.sistema, .message.bot {
            align-items: flex-start;
        }
        
        .message-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 6px;
            padding: 0 4px;
        }
        
        .message.cliente .message-header {
            flex-direction: row-reverse;
        }
        
        .message.sistema .message-header, .message.bot .message-header {
            flex-direction: row;
        }
        
        .message-author {
            font-size: 13px;
            font-weight: 700;
            color: #495057;
        }
        
        .message-time {
            font-size: 11px;
            color: #868e96;
        }
        
        .message-bubble {
            max-width: 75%;
            padding: 12px 16px;
            border-radius: 16px;
            word-wrap: break-word;
            white-space: pre-wrap;
            line-height: 1.6;
            font-size: 14px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        
        .message.cliente .message-bubble {
            background: #e3f2fd;
            color: #0d47a1;
            border-bottom-right-radius: 4px;
        }
        
        .message.sistema .message-bubble, .message.bot .message-bubble {
            background: #fff3e0;
            color: #e65100;
            border-bottom-left-radius: 4px;
        }
            color: #4a148c;
            border-bottom-right-radius: 4px;
        }
        
        .message-attachment {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: rgba(0,0,0,0.08);
            border-radius: 8px;
            margin-bottom: 8px;
            font-size: 12px;
            font-weight: 500;
        }
        
        .message-attachment::before {
            content: "📎";
            font-size: 14px;
        }
        
        .no-messages {
            text-align: center;
            padding: 80px 20px;
            color: #6c757d;
        }
        
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #868e96;
            border-top: 2px solid #e9ecef;
        }
        
        @media print {
            body {
                background: white;
                padding: 0;
            }
            .container {
                box-shadow: none;
                border-radius: 0;
            }
        }
        
        @media (max-width: 600px) {
            .info-grid {
                grid-template-columns: 1fr;
            }
            .message-bubble {
                max-width: 85%;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="https://bashsistemas.com.br/wp-content/uploads/2023/06/bash-technology-logo-branco.png" alt="Bash Technology" class="logo" onerror="this.style.display='none'">
            <h1>Histórico da Conversa</h1>
            <p>Atendimento Digital</p>
        </div>
        
        <div class="info-section">
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">Cliente</div>
                    <div class="info-value">${data.cliente_nome || '-'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Telefone</div>
                    <div class="info-value">${UI.formatarTelefone(data.cliente_numero)}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Atendente</div>
                    <div class="info-value">${data.usuario_nome || 'Sem atendente'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Data/Hora</div>
                    <div class="info-value">${UI.formatarDataHora(data.dt_criado)}</div>
                </div>
            </div>
        </div>
        
        <div class="messages">
            ${!data.mensagens || data.mensagens.length === 0 ? `
                <div class="no-messages">
                    <p style="font-size: 48px; margin-bottom: 10px;">💬</p>
                    <p>Nenhuma mensagem nesta conversa</p>
                </div>
            ` : data.mensagens.map(msg => {
                const nomeUsuario = (msg.usuario_nome || '').toLowerCase();
                const isCliente = nomeUsuario === 'cliente' || msg.usuario_nome === data.cliente_nome;
                const hora = msg.created_at ? new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
                const tipo = isCliente ? 'cliente' : 'bot';
                
                return `
                    <div class="message ${tipo}">
                        <div class="message-header">
                            <span class="message-author">${msg.usuario_nome || 'Sistema'}</span>
                            <span class="message-time">${hora}</span>
                        </div>
                        <div class="message-bubble">
                            ${msg.file ? `<div class="message-attachment">${msg.mime_type || 'Arquivo anexo'}</div>` : ''}
                            ${msg.mensagem || ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
        
        <div class="footer">
            <p><strong>Bash Technology</strong> - Atendimento Digital | Gerado em ${new Date().toLocaleString('pt-BR')}</p>
        </div>
    </div>
</body>
</html>`;
      
      // Criar e baixar arquivo
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `conversa_${data.id}_${data.cliente_numero}.html`;
      link.click();
      URL.revokeObjectURL(link.href);
      
      UI.mostrarSucesso('Arquivo HTML baixado com sucesso!');
    },
    
    downloadConversaPDF(data) {
      try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Define codificação UTF-8 para caracteres especiais
        doc.setLanguage("pt-BR");
        
        let y = 20;
        const lineHeight = 7;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 20;
        
        // Título
        doc.setFontSize(16);
        doc.setFont("helvetica", 'bold');
        doc.text('HISTORICO DA CONVERSA', 105, y, { align: 'center' });
        y += lineHeight * 2;
        
        // Linha separadora
        doc.setLineWidth(0.5);
        doc.line(margin, y, 190, y);
        y += lineHeight;
        
        // Informações do atendimento
        doc.setFontSize(10);
        doc.setFont("helvetica", 'normal');
        const clienteNome = UI.sanitizarTexto(data.cliente_nome || '-');
        const clienteNumero = UI.sanitizarTexto(data.cliente_numero || '-');
        const usuarioNome = UI.sanitizarTexto(data.usuario_nome || 'Sem atendente');
        const dataHora = UI.sanitizarTexto(UI.formatarDataHora(data.dt_criado));
        
        doc.text(`Cliente: ${clienteNome}`, margin, y);
        y += lineHeight;
        doc.text(`Telefone: ${clienteNumero}`, margin, y);
        y += lineHeight;
        doc.text(`Atendente: ${usuarioNome}`, margin, y);
        y += lineHeight;
        doc.text(`Data/Hora: ${dataHora}`, margin, y);
        y += lineHeight * 1.5;
        
        // Linha separadora
        doc.line(margin, y, 190, y);
        y += lineHeight;
        
        // Mensagens
        doc.setFontSize(12);
        doc.setFont("helvetica", 'bold');
        doc.text('Mensagens:', margin, y);
        y += lineHeight;
        
        if (!data.mensagens || data.mensagens.length === 0) {
          doc.setFont("helvetica", 'italic');
          doc.setFontSize(10);
          doc.text('Nenhuma mensagem nesta conversa.', margin, y);
        } else {
          doc.setFontSize(9);
          
          data.mensagens.forEach((msg, index) => {
            const hora = msg.created_at ? new Date(msg.created_at).toLocaleTimeString('pt-BR') : '';
            
            // Verificar se precisa de nova página
            if (y > pageHeight - 40) {
              doc.addPage();
              y = margin;
            }
            
            // Cabeçalho da mensagem
            doc.setFont("helvetica", 'bold');
            const usuarioMsg = UI.sanitizarTexto(msg.usuario_nome || 'Sistema');
            doc.text(`[${hora}] ${usuarioMsg}:`, margin, y);
            y += lineHeight;
            
            // Arquivo anexo
            if (msg.file) {
              doc.setFont("helvetica", 'italic');
              const mimeType = UI.sanitizarTexto(msg.mime_type || 'Arquivo');
              doc.text(`  Anexo: ${mimeType}`, margin, y);
              y += lineHeight;
            }
            
            // Mensagem
            if (msg.mensagem) {
              doc.setFont("helvetica", 'normal');
              const mensagemLimpa = UI.sanitizarTexto(msg.mensagem);
              const lines = doc.splitTextToSize(`  ${mensagemLimpa}`, 170);
              lines.forEach(line => {
                if (y > pageHeight - 40) {
                  doc.addPage();
                  y = margin;
                }
                doc.text(line, margin, y);
                y += lineHeight;
              });
            }
            
            y += lineHeight * 0.5; // Espaço entre mensagens
          });
        }
        
        // Salvar PDF
        doc.save(`conversa_${data.id}_${data.cliente_numero}.pdf`);
        UI.mostrarSucesso('Arquivo PDF baixado com sucesso!');
        
      } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        UI.mostrarErro('Erro ao gerar PDF. Tente usar o formato TXT.');
      }
    },

    mostrarModalCampanha(campanha) {
      document.getElementById('modal_campanha_nome').textContent = campanha.nome || 'Sem nome';
      document.getElementById('modal_total_clientes').textContent = campanha.quantidade_clientes || campanha.total_clientes || 0;
      document.getElementById('modal_acionados').textContent = campanha.acionamentos || campanha.acionados || 0;
      document.getElementById('modal_receberam').textContent = campanha.receberam || (campanha.resultado && campanha.resultado[0] ? campanha.resultado[0].receberam : 0) || 0;
      document.getElementById('modal_interagiram').textContent = campanha.leram || (campanha.resultado && campanha.resultado[0] ? campanha.resultado[0].leram : 0) || campanha.interagiram || 0;
      document.getElementById('modal_erros').textContent = campanha.erros || 0;
      document.getElementById('modal_nao_acionados').textContent = campanha.nao_acionados || 0;
      document.getElementById('modal_tempo_execucao').textContent = campanha.tempo_execucao || '--';

      // Exibir informações adicionais se disponíveis
      const infoAdicional = document.getElementById('modal_info_adicional');
      if (infoAdicional) {
        let infoHTML = '';
        if (campanha.campanha_id || campanha.id) {
          infoHTML += `<p><strong>ID da Campanha:</strong> ${campanha.campanha_id || campanha.id}</p>`;
        }
        if (campanha.status_nome) {
          infoHTML += `<p><strong>Status:</strong> <span class="badge badge-outline">${campanha.status_nome}</span></p>`;
        }
        if (campanha.agendamento) {
          infoHTML += `<p><strong>Agendamento:</strong> ${UI.formatarDataHora(campanha.agendamento)}</p>`;
        }
        infoAdicional.innerHTML = infoHTML;
      }

      const tbody = document.getElementById('modal_mailings_list');
      if (campanha.resultado && campanha.resultado.length > 0) {
        tbody.innerHTML = campanha.resultado.map(res => `
          <tr>
            <td>${res.nome || '-'}</td>
            <td>${res.total || 0}</td>
            <td>${res.total || 0}</td>
            <td>${res.receberam || 0}</td>
            <td>${res.leram || 0}</td>
            <td>0</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
          </tr>
        `).join('');
      } else if (campanha.mailings && campanha.mailings.length > 0) {
        tbody.innerHTML = campanha.mailings.map(mail => `
          <tr>
            <td>${mail.nome || '-'}</td>
            <td>${mail.total || 0}</td>
            <td>${mail.acionados || 0}</td>
            <td>${mail.receberam || 0}</td>
            <td>${mail.interagiram || 0}</td>
            <td>${mail.erros || 0}</td>
            <td>${UI.formatarTempo(mail.tm_interacao)}</td>
            <td>${UI.formatarTempo(mail.tma)}</td>
            <td>${UI.formatarTempo(mail.tme)}</td>
          </tr>
        `).join('');
      } else {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4">Nenhum resultado detalhado</td></tr>';
      }

      document.getElementById('modal_detalhes_campanha').showModal();
    },

    async visualizarDetalhesOperador(operadorId) {
      console.log("Visualizar operador:", operadorId);
      UI.mostrarSucesso("Modal de detalhes do operador será implementado");
    },

    async visualizarDetalhesFila(filaId) {
      try {
        const { data, error } = await API.buscarDetalhesFila(filaId, filtersRelatorios);
        if (error || !data) { UI.mostrarErro("Não foi possível carregar detalhes da fila"); return; }
        this.mostrarModalFila(data);
      } catch (error) {
        UI.mostrarErro("Erro ao carregar detalhes da fila");
      }
    },

    mostrarModalFila(fila) {
      document.getElementById('modal_fila_nome').textContent = fila.nome || 'Sem nome';
      
      const tbody = document.getElementById('modal_fila_atendimentos');
      if (fila.atendimentos && fila.atendimentos.length > 0) {
        tbody.innerHTML = fila.atendimentos.map(at => {
          const ttSegundos = at.tt ? UI.tempoParaSegundos(at.tt) : 0;
          const teSegundos = at.te ? UI.tempoParaSegundos(at.te) : 0;
          const taSegundos = at.ta ? UI.tempoParaSegundos(at.ta) : 0;
          
          return `
            <tr>
              <td>${UI.formatarTelefone(at.cliente_numero)}</td>
              <td>${at.atendente || '-'}</td>
              <td class="text-sm">${UI.formatarDataHora(at.dt_criado)}</td>
              <td>
                <div class="tooltip" data-tip="${ttSegundos} segundos">
                  ${UI.formatarTempo(at.tt)}
                </div>
              </td>
              <td>
                <div class="tooltip" data-tip="${teSegundos} segundos">
                  ${UI.formatarTempo(at.te)}
                </div>
              </td>
              <td>
                <div class="tooltip" data-tip="${taSegundos} segundos">
                  ${UI.formatarTempo(at.ta)}
                </div>
              </td>
              <td><span class="badge badge-ghost badge-sm">${at.status || '-'}</span></td>
            </tr>
          `;
        }).join('');
      } else {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4">Nenhum atendimento</td></tr>';
      }

      document.getElementById('modal_detalhes_fila').showModal();
    },

    exportarGeral() {
      UI.mostrarInfo("Carregando todos os dados para exportação...");
      
      // Buscar todos os dados sem paginação
      const filters = { 
        dataInicio: filtersRelatorios.dataInicio,
        dataFim: filtersRelatorios.dataFim,
        numeroWhatsApp: filtersRelatorios.numeroWhatsApp
      };
      
      API.buscarConversasExportar(filters).then(({ data, error }) => {
        if (error || !data || !data.conversas || data.conversas.length === 0) {
          UI.mostrarErro("Nenhum dado disponível para exportar");
          return;
        }

        const conversas = data.conversas;
        
        // Verificar se a biblioteca XLSX está disponível
        if (typeof XLSX === 'undefined') {
          UI.mostrarErro("Biblioteca de exportação não carregada");
          return;
        }
        
        // Preparar dados para o Excel
        const worksheetData = [
          ['ID', 'Cliente', 'Telefone', 'Fila', 'Atendente', 'Classificação', 'Resposta Classificação', 'Data Criação', 'Data Atualização', 'Status', 'Tempo Total (seg)', 'Tempo Atendimento (seg)', 'Tempo Espera (seg)', 'Tempo URA/Fluxo (seg)']
        ];
        
        conversas.forEach(conv => {
          // Processar resposta de classificação (pode ser string ou objeto)
          let respostaClassificacao = '-';
          if (conv.classificacao_resposta) {
            try {
              const resposta = typeof conv.classificacao_resposta === 'string' 
                ? JSON.parse(conv.classificacao_resposta) 
                : conv.classificacao_resposta;
              
              if (Array.isArray(resposta)) {
                // Se for array de objetos com tipo, pergunta, resposta
                respostaClassificacao = resposta.map(r => `${r.pergunta}: ${r.resposta}`).join(' | ');
              } else if (typeof resposta === 'string') {
                respostaClassificacao = resposta;
              } else if (typeof resposta === 'object') {
                respostaClassificacao = JSON.stringify(resposta);
              }
            } catch (e) {
              respostaClassificacao = conv.classificacao_resposta;
            }
          }
          
          worksheetData.push([
            conv.id || '',
            conv.cliente_nome || '-',
            UI.formatarTelefone(conv.cliente_numero || ''),
            conv.fila_nome || '-',
            conv.usuario_nome || 'Sem atendente',
            conv.classificacao_nome || 'Sem classificação',
            respostaClassificacao,
            UI.formatarDataHora(conv.dt_criado),
            conv.dt_update ? UI.formatarDataHora(conv.dt_update) : '-',
            conv.status || 'Encerrado',
            conv.tt || 0,
            conv.ta || 0,
            conv.te || 0,
            conv.tu || 0
          ]);
        });
        
        // Criar workbook e worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(worksheetData);
        
        // Ajustar largura das colunas
        ws['!cols'] = [
          { wch: 8 },  // ID
          { wch: 25 }, // Cliente
          { wch: 18 }, // Telefone
          { wch: 20 }, // Fila
          { wch: 20 }, // Atendente
          { wch: 20 }, // Classificação
          { wch: 50 }, // Resposta Classificação
          { wch: 20 }, // Data Criação
          { wch: 20 }, // Data Atualização
          { wch: 30 }, // Status
          { wch: 18 }, // TT
          { wch: 22 }, // TA
          { wch: 20 }, // TE
          { wch: 20 }  // TU
        ];
        
        XLSX.utils.book_append_sheet(wb, ws, 'Conversas');
        XLSX.writeFile(wb, `relatorio_conversas_completo_${filtersRelatorios.dataInicio}_${filtersRelatorios.dataFim}.xlsx`);
        
        UI.mostrarSucesso(`Relatório exportado com sucesso! ${conversas.length} conversas`);
      }).catch(error => {
        console.error("Erro ao exportar:", error);
        UI.mostrarErro("Erro ao exportar dados");
      });
    },

    exportarDisparador() {
      UI.mostrarInfo("Carregando todos os dados para exportação...");
      
      // Buscar todas as campanhas sem paginação para exportação
      const filtersExport = {
        dataInicio: filtersRelatorios.dataInicio,
        dataFim: filtersRelatorios.dataFim
      };
      
      API.buscarCampanhas(filtersExport).then(({ data, error }) => {
        if (error) {
          UI.mostrarErro("Erro ao buscar dados para exportação");
          return;
        }

        let campanhas;
        // Verifica se data tem a estrutura de paginação ou é uma lista simples
        if (data && typeof data === 'object' && data.campanhas) {
          campanhas = data.campanhas || [];
        } else {
          campanhas = data || [];
        }

        if (campanhas.length === 0) {
          UI.mostrarErro("Nenhum dado disponível para exportar");
          return;
        }

        let csv = 'ID,Nome,Agendamento,Status,Quantidade Clientes,Acionamentos,Data Criação,Data Atualização,Resultados\n';
        
        campanhas.forEach(camp => {
          const id = camp.id || '';
          const nome = (camp.nome || '-').replace(/,/g, ';');
          const agendamento = camp.agendamento ? UI.formatarDataHora(camp.agendamento) : '-';
          const status = (camp.status_nome || '-').replace(/,/g, ';');
          const quantidadeClientes = camp.quantidade_clientes || 0;
          const acionamentos = camp.acionamentos || 0;
          const dataCriacao = camp.created_at ? UI.formatarDataHora(camp.created_at) : '-';
          const dataAtualizacao = camp.dt_update ? UI.formatarDataHora(camp.dt_update) : '-';
          
          // Processar resultados se existirem
          let resultados = '-';
          if (camp.resultado) {
            try {
              const resultadoObj = typeof camp.resultado === 'string' ? JSON.parse(camp.resultado) : camp.resultado;
              if (Array.isArray(resultadoObj) && resultadoObj.length > 0) {
                resultados = resultadoObj.map(r => `${r.nome || 'Status'}: ${r.total || 0} total, ${r.receberam || 0} receberam, ${r.leram || 0} leram`).join(' | ');
              }
            } catch (e) {
              resultados = camp.resultado ? 'Dados de resultado disponíveis' : '-';
            }
          }
          
          csv += `${id},"${nome}","${agendamento}","${status}",${quantidadeClientes},${acionamentos},"${dataCriacao}","${dataAtualizacao}","${resultados.replace(/,/g, ';')}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `relatorio_campanhas_${filtersRelatorios.dataInicio}_${filtersRelatorios.dataFim}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        
        UI.mostrarSucesso(`Relatório exportado com sucesso! ${campanhas.length} campanhas`);
      }).catch(error => {
        console.error("Erro ao exportar:", error);
        UI.mostrarErro("Erro ao exportar dados");
      });
    },

    exportarOperacao() {
      UI.mostrarInfo("Carregando todos os dados para exportação...");
      
      API.buscarOperadores(filtersRelatorios).then(({ data, error }) => {
        if (error || !data || data.length === 0) {
          UI.mostrarErro("Nenhum dado disponível para exportar");
          return;
        }

        const operadores = data;
        let csv = 'Operador,Tempo Sessão,Tempo Logado,Tempo Pausa,Atendimentos,TMA\n';
        
        operadores.forEach(op => {
          const nome = (op.nome || '-').replace(/,/g, ';');
          const tempoSessao = UI.formatarTempo(op.tempo_sessao || '0');
          const tempoLogado = UI.formatarTempo(op.tempo_logado || '0');
          const tempoPausa = UI.formatarTempo(op.tempo_pausa || '0');
          const atendimentos = op.atendimentos || 0;
          const tma = UI.formatarTempo(op.tma || '0');
          
          csv += `"${nome}","${tempoSessao}","${tempoLogado}","${tempoPausa}",${atendimentos},"${tma}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `relatorio_operacao_${filtersRelatorios.dataInicio}_${filtersRelatorios.dataFim}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        
        UI.mostrarSucesso(`Relatório exportado com sucesso! ${operadores.length} operadores`);
      }).catch(error => {
        console.error("Erro ao exportar:", error);
        UI.mostrarErro("Erro ao exportar dados");
      });
    },

    exportarReceptivo() {
      UI.mostrarInfo("Carregando todos os dados para exportação...");
      
      API.buscarFilas(filtersRelatorios).then(({ data, error }) => {
        if (error || !data || data.length === 0) {
          UI.mostrarErro("Nenhum dado disponível para exportar");
          return;
        }

        const filas = data;
        let csv = 'Fila,Total Acionamentos,TMA,TME,TMT,TMU,SLA %\n';
        
        filas.forEach(fila => {
          const nome = (fila.nome || '-').replace(/,/g, ';');
          const total = fila.total_acionamentos || 0;
          const tma = UI.formatarTempo(fila.tma || '0');
          const tme = UI.formatarTempo(fila.tme || '0');
          const tmt = UI.formatarTempo(fila.tmt || '0');
          const tmu = UI.formatarTempo(fila.tmu || '0');
          const sla = fila.sla_percent ? `${fila.sla_percent}%` : '0%';
          
          csv += `"${nome}",${total},"${tma}","${tme}","${tmt}","${tmu}","${sla}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `relatorio_receptivo_${filtersRelatorios.dataInicio}_${filtersRelatorios.dataFim}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        
        UI.mostrarSucesso(`Relatório exportado com sucesso! ${filas.length} filas`);
      }).catch(error => {
        console.error("Erro ao exportar:", error);
        UI.mostrarErro("Erro ao exportar dados");
      });
    },

    async visualizarRelatorioMailing(mailing) {

      console.log('Visualizando relatório de mailing:', mailing);
      
      const { data, error } = await API.buscarDetalhesCampanha(mailing.id);

      if(error || !data) {
        avisos("Erro", "Erro ao carregar detalhes do mailing", "error");
        return;
      }

      // Se não há resultados, mostrar modal simples
      if (!mailing.resultado || !Array.isArray(mailing.resultado) || mailing.resultado.length === 0) {
        UI.mostrarInfo('Não há dados de resultado disponíveis para este mailing.');
        return;
      }

      // Calcular totais
      const totais = mailing.resultado.reduce((acc, item) => {
        return {
          total: acc.total + (item.total || 0),
          receberam: acc.receberam + (item.receberam || 0),
          leram: acc.leram + (item.leram || 0)
        };
      }, { total: 0, receberam: 0, leram: 0 });

      // Criar modal usando a estrutura HTML existente
      const modalId = 'modal_relatorio_mailing';
      let modal = document.getElementById(modalId);
      
      if (!modal) {
        // Criar modal se não existir
        modal = document.createElement('dialog');
        modal.id = modalId;
        modal.className = 'modal';
        document.body.appendChild(modal);
      }
      modal.innerHTML = `
        <div class="modal-box w-11/12 max-w-5xl">
          <form method="dialog">
            <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
          </form>
          
          <h3 class="font-bold text-lg mb-4">
            <i class="fas fa-chart-line mr-2"></i>
            Relatório de Mailing - ${mailing.nome || 'Sem nome'}
          </h3>

          <!-- Informações do Mailing -->
          <div class="card bg-base-100 border border-base-300 shadow-md mb-4">
            <div class="card-body">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="space-y-2">
                  <div class="flex justify-between">
                    <span class="font-semibold">Nome:</span>
                    <span>${mailing.nome || 'N/A'}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="font-semibold">Status:</span>
                    <span class="badge badge-outline">${mailing.status_nome || 'N/A'}</span>
                  </div>
                </div>
                <div class="space-y-2">
                  <div class="flex justify-between">
                    <span class="font-semibold">Total Clientes:</span>
                    <span class="font-bold">${mailing.quantidade_clientes || mailing.total_clientes || 0}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="font-semibold">Acionamentos:</span>
                    <span class="font-bold">${mailing.acionamentos || mailing.acionados || 0}</span>
                  </div>
                </div>
                <div class="stats stats-vertical shadow bg-base-100">
                  <div class="stat">
                    <div class="stat-title text-xs">Taxa de Entrega</div>
                    <div class="stat-value text-lg text-success">
                      ${totais.total > 0 ? Math.round((totais.receberam / totais.total) * 100) : 0}%
                    </div>
                  </div>
                  <div class="stat">
                    <div class="stat-title text-xs">Taxa de Leitura</div>
                    <div class="stat-value text-lg text-info">
                      ${totais.total > 0 ? Math.round((totais.leram / totais.total) * 100) : 0}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Tabela de Resultados -->
          <div class="card bg-base-100 shadow-xl">
            <div class="card-body">
              <div class="flex justify-between items-center mb-4">
                <h4 class="card-title">
                  <i class="fas fa-table mr-2"></i>
                  Detalhamento por Status
                </h4>
                <div>
                  <button class="btn btn-info btn-sm" onclick="window.BashRelatoriosWhatsApp.EVENTS.downloadRelatorioAnalitico(${JSON.stringify(data).replace(/"/g, '&quot;')}, ${mailing.id})">
                  <i class="fas fa-download mr-2"></i>
                  Download Relatório Analítico
                  </button>
                  <button class="btn btn-success btn-sm" onclick="window.BashRelatoriosWhatsApp.EVENTS.downloadExcelMailing('${mailing.nome || 'mailing'}', ${JSON.stringify(mailing.resultado).replace(/"/g, '&quot;')})">
                  <i class="fas fa-download mr-2"></i>
                  Download Excel
                  </button>
                </div>
              </div>
              
              <div class="overflow-x-auto">
                <table class="table table-zebra w-full">
                  <thead>
                    <tr class="bg-base-200">
                      <th>Status</th>
                      <th class="text-center">Total</th>
                      <th class="text-center">Receberam</th>
                      <th class="text-center">Leram</th>
                      <th class="text-center">% Entrega</th>
                      <th class="text-center">% Leitura</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${mailing.resultado.map(item => {
                      const percEntrega = item.total > 0 ? Math.round((item.receberam / item.total) * 100) : 0;
                      const percLeitura = item.receberam > 0 ? Math.round((item.leram / item.receberam) * 100) : 0;
                      
                      return `
                        <tr>
                          <td class="font-medium">
                            <div class="flex items-center gap-2">
                              <div class="badge badge-outline badge-sm"></div>
                              ${item.nome || 'N/A'}
                            </div>
                          </td>
                          <td class="text-center font-mono">${item.total || 0}</td>
                          <td class="text-center font-mono">${item.receberam || 0}</td>
                          <td class="text-center font-mono">${item.leram || 0}</td>
                          <td class="text-center">
                            <div class="badge ${percEntrega > 80 ? 'badge-success' : percEntrega > 50 ? 'badge-warning' : 'badge-error'}">
                              ${percEntrega}%
                            </div>
                          </td>
                          <td class="text-center">
                            <div class="badge ${percLeitura > 80 ? 'badge-success' : percLeitura > 50 ? 'badge-warning' : 'badge-error'}">
                              ${percLeitura}%
                            </div>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                  <tfoot>
                    <tr class="bg-primary text-primary-content font-bold">
                      <td>TOTAL GERAL</td>
                      <td class="text-center">${totais.total}</td>
                      <td class="text-center">${totais.receberam}</td>
                      <td class="text-center">${totais.leram}</td>
                      <td class="text-center">
                        ${totais.total > 0 ? Math.round((totais.receberam / totais.total) * 100) : 0}%
                      </td>
                      <td class="text-center">
                        ${totais.total > 0 ? Math.round((totais.leram / totais.total) * 100) : 0}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      `;

      modal.showModal();
    },

    async abrirRelatorioAnalitico(campanhaId) {
      try {
        console.log("Abrindo relatório analítico para campanha:", campanhaId);
        
        // Buscar dados analíticos da campanha
        const { data, error } = await API.buscarDetalhesCampanha(campanhaId);

        if(error || !data) {
          avisos("Erro ao carregar detalhes do mailing");
        }

        // Criar/atualizar modal
        this.criarModalAnalitico(data, campanhaId);
        
      } catch (error) {
        console.error("Erro ao abrir relatório analítico:", error);
        UI.mostrarErro("Erro inesperado ao carregar relatório analítico");
      }
    },

    criarModalAnalitico(dados, campanhaId) {
      const modalId = 'modal_relatorio_analitico';
      let modal = document.getElementById(modalId);
      
      if (!modal) {
        modal = document.createElement('dialog');
        modal.id = modalId;
        modal.className = 'modal';
        document.body.appendChild(modal);
      }

      modal.innerHTML = `
        <div class="modal-box w-11/12 max-w-7xl">
          <form method="dialog">
            <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
          </form>
          
          <h3 class="font-bold text-lg mb-4">
            <i class="fas fa-chart-area mr-2"></i>
            Relatório Analítico - Campanha ${campanhaId}
          </h3>

          <div class="flex justify-end mb-4">
            <button class="btn btn-success" onclick="window.BashRelatoriosWhatsApp.EVENTS.downloadRelatorioAnalitico(${JSON.stringify(dados).replace(/"/g, '&quot;')}, ${campanhaId})">
              <i class="fas fa-download mr-2"></i>
              Download Excel
            </button>
          </div>

          <!-- Tabela de dados analíticos -->
          <div class="card bg-base-100 shadow-xl">
            <div class="card-body">
              <div class="overflow-x-auto">
                <table class="table table-zebra w-full">
                  <thead>
                    <tr class="bg-base-200">
                      <th>CPF</th>
                      <th>Telefone</th>
                      <th>Status</th>
                      <th>Data Leitura</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${Array.isArray(dados) ? dados.map(item => `
                      <tr>
                        <td class="font-mono">${item.cpf || '-'}</td>
                        <td class="font-mono">${UI.formatarTelefone(item.telefone) || '-'}</td>
                        <td>
                          <span class="badge badge-outline">
                            ${item.status_nome || 'Não definido'}
                          </span>
                        </td>
                        <td class="text-sm">
                          ${item.leitura_at ? UI.formatarDataHora(item.leitura_at) : '-'}
                        </td>
                      </tr>
                    `).join('') : '<tr><td colspan="5" class="text-center py-4">Nenhum dado encontrado</td></tr>'}
                  </tbody>
                  <tfoot>
                    <tr class="bg-primary text-primary-content font-bold">
                      <td colspan="5" class="text-center">
                        Total de registros: ${Array.isArray(dados) ? dados.length : 0}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      `;

      modal.showModal();
    },

    downloadRelatorioAnalitico(dados, campanhaId) {
      try {
        // Verificar se existe biblioteca XLSX
        if (typeof XLSX === 'undefined') {
          UI.mostrarErro('Biblioteca XLSX não encontrada. Verifique se a biblioteca está carregada.');
          return;
        }

        // Criar dados para a planilha
        const dadosRelatorio = [
          [`Relatório Analítico - Campanha ${campanhaId}`],
          [''],
          ['CPF', 'Telefone', 'Status', 'Data Leitura']
        ];

        // Adicionar dados
        if (Array.isArray(dados)) {
          dados.forEach(item => {
            dadosRelatorio.push([
              item.cpf || '',
              item.telefone || '',
              item.status_nome || '',
              item.leitura_at ? UI.formatarDataHora(item.leitura_at) : ''
            ]);
          });
        }

        // Adicionar totais
        dadosRelatorio.push(['']);
        dadosRelatorio.push([
          `Total de registros: ${Array.isArray(dados) ? dados.length : 0}`,
          '', '', '', ''
        ]);

        // Criar worksheet
        const ws = XLSX.utils.aoa_to_sheet(dadosRelatorio);
        ws['!cols'] = [
          { wch: 20 }, // CPF
          { wch: 18 }, // Telefone
          { wch: 25 }, // Status
          { wch: 20 }  // Data Leitura
        ];

        // Criar workbook e fazer download
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Relatório Analítico');
        
        const arquivo = `relatorio_analitico_campanha_${campanhaId}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, arquivo);

        UI.mostrarSucesso('Relatório analítico Excel gerado com sucesso!');
      } catch (error) {
        console.error('Erro ao gerar Excel analítico:', error);
        UI.mostrarErro('Erro ao gerar arquivo Excel.');
      }
    },

    downloadExcelMailing(nomeArquivo, resultados) {
      try {
        // Verificar se existe biblioteca XLSX
        if (typeof XLSX === 'undefined') {
          UI.mostrarErro('Biblioteca XLSX não encontrada. Verifique se a biblioteca está carregada.');
          return;
        }

        // Criar dados para a planilha
        const dadosRelatorio = [
          ['Relatório de Mailing'],
          [''],
          ['Status', 'Total', 'Receberam', 'Leram', '% Entrega', '% Leitura']
        ];

        // Adicionar dados de resultado
        resultados.forEach(item => {
          const percEntrega = item.total > 0 ? Math.round((item.receberam / item.total) * 100) : 0;
          const percLeitura = item.receberam > 0 ? Math.round((item.leram / item.receberam) * 100) : 0;
          
          dadosRelatorio.push([
            item.nome || 'N/A',
            item.total || 0,
            item.receberam || 0,
            item.leram || 0,
            percEntrega + '%',
            percLeitura + '%'
          ]);
        });

        // Adicionar totais
        const totais = resultados.reduce((acc, item) => ({
          total: acc.total + (item.total || 0),
          receberam: acc.receberam + (item.receberam || 0),
          leram: acc.leram + (item.leram || 0)
        }), { total: 0, receberam: 0, leram: 0 });

        dadosRelatorio.push(['']);
        dadosRelatorio.push([
          'TOTAL GERAL',
          totais.total,
          totais.receberam,
          totais.leram,
          totais.total > 0 ? Math.round((totais.receberam / totais.total) * 100) + '%' : '0%',
          totais.total > 0 ? Math.round((totais.leram / totais.total) * 100) + '%' : '0%'
        ]);

        // Criar worksheet
        const ws = XLSX.utils.aoa_to_sheet(dadosRelatorio);
        ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];

        // Criar workbook e fazer download
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
        
        const arquivo = `relatorio_${nomeArquivo}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, arquivo);

        UI.mostrarSucesso('Relatório Excel gerado com sucesso!');
      } catch (error) {
        console.error('Erro ao gerar Excel:', error);
        UI.mostrarErro('Erro ao gerar arquivo Excel.');
      }
    },

    gerarRelatorioXLSX(mailing) {
        if (!mailing.resultado || !Array.isArray(mailing.resultado)) {
            avisos('Aviso', 'Não há dados de resultado para gerar o relatório', 'warning');
            return;
        }

        // Criar workbook e worksheet
        const wb = XLSX.utils.book_new();
        
        // Criar dados para a planilha
        const dadosRelatorio = [
            ['Relatório de Mailing'],
            [''],
            ['Nome do Mailing:', mailing.nome || 'N/A'],
            ['Data de Atualização:', formatarData(mailing.dt_update)],
            ['Total de Acionamentos:', mailing.acionamentos || 0],
            [''],
            ['Status', 'Total', 'Receberam', 'Leram']
        ];

        // Adicionar dados de resultado
        mailing.resultado.forEach(item => {
            dadosRelatorio.push([
                item.nome || 'N/A',
                item.total || 0,
                item.receberam || 0,
                item.leram || 0
            ]);
        });

        // Adicionar linha de totais
        const totais = mailing.resultado.reduce((acc, item) => {
            return {
                total: acc.total + (item.total || 0),
                receberam: acc.receberam + (item.receberam || 0),
                leram: acc.leram + (item.leram || 0)
            };
        }, { total: 0, receberam: 0, leram: 0 });

        dadosRelatorio.push(['']);
        dadosRelatorio.push([
            'TOTAL GERAL',
            totais.total,
            totais.receberam,
            totais.leram
        ]);

        // Criar worksheet
        const ws = XLSX.utils.aoa_to_sheet(dadosRelatorio);

        // Definir largura das colunas
        ws['!cols'] = [
            { wch: 30 }, // Status
            { wch: 15 }, // Total
            { wch: 15 }, // Receberam
            { wch: 15 }  // Leram
        ];

        // Adicionar worksheet ao workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Relatório');

        // Gerar nome do arquivo
        const nomeArquivo = `relatorio_mailing_${mailing.id}_${new Date().toISOString().split('T')[0]}.xlsx`;

        // Fazer download do arquivo
        XLSX.writeFile(wb, nomeArquivo);

        avisos('Sucesso', 'Relatório gerado com sucesso!', 'success');
    },

     getStatusBadgeColor(status) {
        const colorMap = {
            'STATUS_OK': 'badge-success',
            'STATUS_AGUARDANDO': 'badge-warning', 
            'STATUS_DESCARTE': 'badge-error',
            'STATUS_DESCONSIDERADOS': 'badge-neutral',
            'STATUS_ENVIADO': 'badge-info',
            'STATUS_ENTREGUE': 'badge-success',
            'STATUS_LIDO': 'badge-success',
            'STATUS_ERRO': 'badge-error',
            'STATUS_PENDENTE': 'badge-warning'
        };
        return colorMap[status] || 'badge-neutral';
    }
  };


  const CORE = {
    async init() {
      console.debug("🚀 Inicializando Relatórios WhatsApp...");
      UI.init();
      EVENTS.init();
      await this.carregarNumeros();
      
      // Definir data padrão (hoje)
      const hoje = new Date().toISOString().split('T')[0];
      $('#data_inicio').val(hoje);
      $('#data_fim').val(hoje);
      filtersRelatorios.dataInicio = hoje;
      filtersRelatorios.dataFim = hoje;
      
      // Carregar dados iniciais
      await EVENTS.carregarGeralConversas();
      console.debug("✅ Relatórios WhatsApp inicializados");
    },

    async carregarNumeros() {
      try {
        const { data, error } = await API.buscarNumerosWhatsApp();
        if (error || !data) { console.warn("Não foi possível carregar números WhatsApp"); return; }
        
        const $select = $('#whatsapp_number');
        $select.html('<option value="">Todos os números</option>');
        
        data.forEach(numero => {
          const option = $('<option></option>')
            .val(numero.id)
            .text(numero.nome || numero.numero || `Número ${numero.id}`);
          $select.append(option);
        });
      } catch (error) {
        console.error("❌ Erro ao carregar números:", error);
      }
    }
  };

  window.BashRelatoriosWhatsApp = { API, STATE, UI, RENDER, EVENTS, CORE };
  
  $(document).ready(function() {
    if (!document.getElementById('data_inicio')) return; // só roda na página de relatórios
    CORE.init();
  });
})();