/**
 * app.js — SPA principal do IA-GO
 * Roteamento por hash, sem frameworks.
 */

// =====================================================================
// Utilitários
// =====================================================================

function $(sel, ctx) { return (ctx || document).querySelector(sel); }
function $$(sel, ctx) { return [...(ctx || document).querySelectorAll(sel)]; }

function toast(msg, type = 'info') {
  const area = $('#toast-area');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  area.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function statusBadge(status) {
  const map = {
    draft: 'badge-draft',
    approved: 'badge-approved',
    published: 'badge-published',
    archived: 'badge-archived',
    success: 'badge-success',
    fatal_error: 'badge-error',
    retryable_error: 'badge-error',
    running: 'badge-running',
    queued: 'badge-queued',
    canceled: 'badge-draft',
  };
  const cls = map[status] || 'badge-draft';
  return `<span class="badge ${cls}">${status || '—'}</span>`;
}

function relTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'agora';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m atrás`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
  return d.toLocaleString('pt-BR');
}

function showModal(id) { document.getElementById(id).classList.remove('hidden'); }
function hideModal(id) { document.getElementById(id).classList.add('hidden'); }

// =====================================================================
// Estado global
// =====================================================================
const state = {
  currentBot: null,
  currentVersion: null,
  bots: [],
};

// =====================================================================
// Router
// =====================================================================
const views = { criar, bots, runs, ops };

function navigate(view) {
  $$('.nav-item').forEach(a => {
    a.classList.toggle('active', a.dataset.view === view);
  });
  const titles = { criar: 'Criar Bot', bots: 'Meus Bots', runs: 'Execuções', ops: 'Operacional' };
  $('#topbar-title').textContent = titles[view] || 'IA-GO';
  const fn = views[view] || views.criar;
  fn();
}

window.addEventListener('hashchange', () => {
  const hash = location.hash.replace('#', '') || 'criar';
  navigate(hash);
});

// =====================================================================
// View: Criar Bot
// =====================================================================
function criar() {
  const container = $('#view-container');
  container.innerHTML = '';
  const tpl = document.getElementById('tpl-criar');
  container.appendChild(tpl.content.cloneNode(true));

  const form = $('#form-criar');
  const pendingBox = $('#pending-box');
  const pendingList = $('#pending-list');
  const resultBox = $('#result-box');
  const spinnerGerar = $('#spinner-gerar');
  const btnLabel = $('.btn-label', form);

  // Preview — verifica campos sem chamar LLM
  $('#btn-preview').addEventListener('click', async () => {
    const data = collectForm(form);
    try {
      const res = await api.generatePreview(data);
      const pending = res.pending_questions || [];
      if (pending.length === 0) {
        pendingBox.classList.add('hidden');
        toast('Todos os campos essenciais preenchidos!', 'success');
      } else {
        showPending(pendingBox, pendingList, pending);
      }
    } catch (e) {
      toast(e.message, 'error');
    }
  });

  // Geração
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = collectForm(form);
    btnLabel.textContent = 'Gerando...';
    spinnerGerar.classList.remove('hidden');
    const btnGerar = $('#btn-gerar');
    btnGerar.disabled = true;

    try {
      const res = await api.generateBot(data);

      if (res.status === 'pending_questions') {
        showPending(pendingBox, pendingList, res.pending_questions);
      } else if (res.status === 'draft_created') {
        pendingBox.classList.add('hidden');
        showResult(resultBox, res.bot_version);
        toast('Rascunho criado com sucesso!', 'success');
      }
    } catch (e) {
      toast('Erro ao gerar bot: ' + e.message, 'error');
    } finally {
      btnLabel.textContent = 'Gerar Bot com IA';
      spinnerGerar.classList.add('hidden');
      btnGerar.disabled = false;
    }
  });

  // Ver código
  $('#btn-view-code').addEventListener('click', () => {
    const code = state.currentVersion?.code_python || '(sem código)';
    $('#code-content').textContent = code;
    showModal('modal-code');
  });

  $('#btn-close-code').addEventListener('click', () => hideModal('modal-code'));
  $('#modal-code').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) hideModal('modal-code');
  });

  // Teste imediato
  $('#btn-test-now').addEventListener('click', async () => {
    if (!state.currentVersion) return;
    showModal('modal-test');
    $('#test-loading').classList.remove('hidden');
    $('#test-result').classList.add('hidden');

    try {
      const run = await api.adHocTest(state.currentVersion.bot_id, {
        bot_version_id: state.currentVersion.id,
        timeout_sec: 120,
        params: {},
      });
      pollRun(run.run_id);
    } catch (e) {
      toast('Erro ao iniciar teste: ' + e.message, 'error');
      hideModal('modal-test');
    }
  });

  $('#btn-close-test').addEventListener('click', () => hideModal('modal-test'));
}

function collectForm(form) {
  const fd = new FormData(form);
  const data = {};
  fd.forEach((v, k) => { data[k] = v.trim(); });
  data.timeout_sec = parseInt(data.timeout_sec) || 120;
  data.max_retries = 1;
  data.screenshot_on_error = true;
  data.save_html_on_error = true;
  data.campos_saida = data.objetivo_coleta ? [data.objetivo_coleta] : [];
  data.owner_id = 'user_default';
  return data;
}

function showPending(box, list, questions) {
  list.innerHTML = questions.map(q => `<li>${q}</li>`).join('');
  box.classList.remove('hidden');
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showResult(box, version) {
  state.currentVersion = version;
  box.classList.remove('hidden');
  $('#result-bot-id').textContent = version.bot_id || '—';
  $('#result-version-num').textContent = `v${version.version}`;
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function resolveTestVersion(botID) {
  const versions = await api.listVersions(botID);
  const preferredOrder = ['published', 'approved', 'draft'];

  for (const status of preferredOrder) {
    const version = (versions || []).find((item) => item.status === status);
    if (version) return version;
  }

  return (versions || [])[0] || null;
}

async function startBotTest(bot) {
  const version = await resolveTestVersion(bot.id);
  if (!version) {
    throw new Error('Nenhuma versão disponível para teste neste bot.');
  }

  const run = await api.adHocTest(bot.id, {
    bot_version_id: version.id,
    timeout_sec: 120,
    params: {},
  });

  state.filterBotID = bot.id;
  location.hash = 'runs';
  toast(`Teste iniciado para ${bot.name} (v${version.version})`, 'success');
  return run;
}

async function pollRun(runID, attempts = 0) {
  if (attempts > 30) {
    toast('Timeout ao aguardar resultado', 'error');
    return;
  }
  try {
    const run = await api.getRun(runID);
    if (['success', 'fatal_error', 'retryable_error', 'canceled'].includes(run.status)) {
      $('#test-loading').classList.add('hidden');
      const res = $('#test-result');
      res.classList.remove('hidden');
      $('#test-run-id').textContent = runID;
      $('#test-status').innerHTML = statusBadge(run.status);

      const badge = $('#test-badge');
      if (run.status === 'success') {
        badge.className = 'result-badge success';
        badge.textContent = '✔ Teste concluído';
      } else {
        badge.className = 'result-badge error';
        badge.textContent = '✖ Teste falhou';
      }

      if (run.error_message) {
        const errorRow = $('#test-error-row');
        errorRow.style.display = '';
        $('#test-error').textContent = run.error_message;
      }
    } else {
      setTimeout(() => pollRun(runID, attempts + 1), 3000);
    }
  } catch (e) {
    setTimeout(() => pollRun(runID, attempts + 1), 4000);
  }
}

// =====================================================================
// View: Meus Bots
// =====================================================================
async function bots() {
  const container = $('#view-container');
  container.innerHTML = '';
  const tpl = document.getElementById('tpl-bots');
  container.appendChild(tpl.content.cloneNode(true));

  $('#btn-novo-bot').addEventListener('click', () => {
    location.hash = 'criar';
  });

  try {
    const list = await api.listBots();
    state.bots = list || [];
    $('#bots-loading').classList.add('hidden');

    if (state.bots.length === 0) {
      $('#bots-empty').classList.remove('hidden');
      $('#btn-criar-primeiro').addEventListener('click', () => { location.hash = 'criar'; });
      return;
    }

    const grid = $('#bots-list');
    grid.classList.remove('hidden');
    const cardTpl = document.getElementById('tpl-bot-card');

    state.bots.forEach(bot => {
      const card = cardTpl.content.cloneNode(true);
      $('.bot-name', card).textContent = bot.name;
      $('.bot-description', card).textContent = bot.description || 'Sem descrição.';
      $('.bot-status-badge', card).innerHTML = statusBadge(bot.active ? 'published' : 'archived');
      $('.bot-meta', card).textContent = relTime(bot.created_at);

      const el = card.querySelector('.bot-card');

      el.querySelector('[data-action="test"]').addEventListener('click', async (event) => {
        const button = event.currentTarget;
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = 'Testando...';

        try {
          await startBotTest(bot);
        } catch (e) {
          toast('Erro ao iniciar teste: ' + e.message, 'error');
        } finally {
          button.disabled = false;
          button.textContent = originalText;
        }
      });

      el.querySelector('[data-action="runs"]').addEventListener('click', () => {
        state.filterBotID = bot.id;
        location.hash = 'runs';
      });

      const btnVersions = el.querySelector('[data-action="versions"]');
      if (btnVersions) {
        btnVersions.addEventListener('click', () => loadVersionsModal(bot));
      }

      grid.appendChild(el);
    });
  } catch (e) {
    $('#bots-loading').classList.add('hidden');
    toast('Erro ao carregar bots: ' + e.message, 'error');
  }
}

// =====================================================================
// Modal: Versões do bot + Rollback
// =====================================================================
async function loadVersionsModal(bot) {
  let versions = [];
  try {
    versions = await api.listVersions(bot.id);
  } catch (e) {
    toast('Erro ao carregar versões: ' + e.message, 'error');
    return;
  }

  const modal = document.getElementById('modal-versions');
  if (!modal) return;

  modal.querySelector('#modal-versions-title').textContent = `Versões — ${bot.name}`;
  const tbody = modal.querySelector('#versions-tbody');
  tbody.innerHTML = '';

  if (!versions.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--color-muted)">Nenhuma versão encontrada.</td></tr>';
  }

  versions.forEach(v => {
    const tr = document.createElement('tr');
    const canRollback = v.status === 'archived' || v.status === 'approved';
    tr.innerHTML = `
      <td>v${v.version}</td>
      <td>${statusBadge(v.status)}</td>
      <td>${v.created_by || '—'}</td>
      <td>${relTime(v.created_at)}</td>
      <td>
        ${canRollback
          ? `<button class="btn btn-sm" data-vid="${v.id}" data-action="rollback">↩ Rollback</button>`
          : '—'}
      </td>`;
    tr.querySelectorAll('[data-action="rollback"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const by = prompt('Seu nome (responsável pelo rollback):');
        if (!by) return;
        try {
          await api.rollbackVersion(bot.id, v.id, by);
          toast(`Rollback para v${v.version} realizado com sucesso.`, 'success');
          hideModal('modal-versions');
          await bots();
        } catch (e) {
          toast('Erro no rollback: ' + e.message, 'error');
        }
      });
    });
    tbody.appendChild(tr);
  });

  showModal('modal-versions');

  const closeBtn = document.getElementById('btn-close-versions');
  if (closeBtn) {
    closeBtn.onclick = () => hideModal('modal-versions');
  }
  const overlay = document.getElementById('modal-versions');
  overlay.onclick = (e) => { if (e.target === overlay) hideModal('modal-versions'); };
}

// =====================================================================
// View: Execuções
// =====================================================================
async function runs() {
  const container = $('#view-container');
  container.innerHTML = '';
  const tpl = document.getElementById('tpl-runs');
  container.appendChild(tpl.content.cloneNode(true));

  $('#btn-refresh-runs').addEventListener('click', loadRuns);
  $('#btn-close-events').addEventListener('click', () => hideModal('modal-events'));
  $('#modal-events').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) hideModal('modal-events');
  });

  // Popula filtro de bots
  if (state.bots.length === 0) {
    try { state.bots = (await api.listBots()) || []; } catch {}
  }
  const filterBot = $('#filter-bot');
  state.bots.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.id; opt.textContent = b.name;
    filterBot.appendChild(opt);
  });
  if (state.filterBotID) {
    filterBot.value = state.filterBotID;
    state.filterBotID = null;
  }

  filterBot.addEventListener('change', loadRuns);
  $('#filter-status').addEventListener('change', loadRuns);

  await loadRuns();
}

async function loadRuns() {
  const botID = $('#filter-bot')?.value;
  const filterStatus = $('#filter-status')?.value;

  $('#runs-loading')?.classList.remove('hidden');
  $('#runs-empty')?.classList.add('hidden');
  $('#runs-table-wrap')?.classList.add('hidden');

  let allRuns = [];

  try {
    if (botID) {
      allRuns = await api.listRuns(botID, 100);
    } else {
      // Sem botID, busca runs de todos os bots (limitado)
      const results = await Promise.allSettled(
        (state.bots || []).slice(0, 10).map(b => api.listRuns(b.id, 20))
      );
      results.forEach(r => {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          allRuns = allRuns.concat(r.value);
        }
      });
      allRuns.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  } catch (e) {
    toast('Erro ao carregar execuções: ' + e.message, 'error');
  } finally {
    $('#runs-loading')?.classList.add('hidden');
  }

  // Aplica filtro de status
  if (filterStatus) {
    allRuns = allRuns.filter(r => r.status === filterStatus);
  }

  if (allRuns.length === 0) {
    $('#runs-empty')?.classList.remove('hidden');
    return;
  }

  const tbody = $('#runs-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  allRuns.forEach(run => {
    const bot = (state.bots || []).find(b => b.id === run.bot_id);
    const duration = run.started_at && run.finished_at
      ? `${Math.round((new Date(run.finished_at) - new Date(run.started_at)) / 1000)}s`
      : '—';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mono">${run.run_id?.slice(0, 24) || '—'}</td>
      <td>${bot?.name || run.bot_id?.slice(0, 8) || '—'}</td>
      <td><span class="badge badge-draft">${run.run_type || '—'}</span></td>
      <td>${statusBadge(run.status)}</td>
      <td>${relTime(run.created_at)}</td>
      <td>${duration}</td>
      <td><button class="btn btn-sm btn-outline btn-events" data-run="${run.run_id}">Logs</button></td>
    `;
    tbody.appendChild(tr);
  });

  $$('.btn-events').forEach(btn => {
    btn.addEventListener('click', () => openEvents(btn.dataset.run));
  });

  $('#runs-table-wrap')?.classList.remove('hidden');
}

async function openEvents(runID) {
  $('#events-run-id').textContent = runID;
  $('#events-list').innerHTML = '<div class="spinner-lg" style="margin:auto"></div>';
  $('#events-output').classList.add('hidden');
  $('#events-output-json').textContent = '';
  showModal('modal-events');

  try {
    const [events, run] = await Promise.all([
      api.getEvents(runID),
      api.getRun(runID),
    ]);

    // Exibe saída coletada (output_json.result)
    const result = run?.output_json?.result;
    if (result && Object.keys(result).length > 0) {
      $('#events-output-json').textContent = JSON.stringify(result, null, 2);
      $('#events-output').classList.remove('hidden');
    }

    const list = $('#events-list');
    if (!events || events.length === 0) {
      list.innerHTML = '<p style="color:var(--text-muted);text-align:center">Sem eventos registrados.</p>';
      return;
    }
    list.innerHTML = events.map(e => `
      <div class="event-row">
        <span class="event-ts">${new Date(e.ts).toLocaleTimeString('pt-BR')}</span>
        <span class="event-level ${e.level}">${e.level.toUpperCase()}</span>
        <span class="event-msg">${e.message}</span>
      </div>
    `).join('');
  } catch (err) {
    $('#events-list').innerHTML = `<p style="color:var(--error)">${err.message}</p>`;
  }
}

// =====================================================================
// View: Operacional
// =====================================================================
async function ops() {
  const container = $('#view-container');
  container.innerHTML = '';
  const tpl = document.getElementById('tpl-ops');
  container.appendChild(tpl.content.cloneNode(true));

  $('#btn-refresh-ops').addEventListener('click', loadOps);
  await loadOps();
}

async function loadOps() {
  $('#ops-loading')?.classList.remove('hidden');
  $('#ops-content')?.classList.add('hidden');
  $('#ops-error')?.classList.add('hidden');

  try {
    const summary = await api.opsSummary();
    $('#ops-loading')?.classList.add('hidden');
    $('#ops-content')?.classList.remove('hidden');

    // Cards de status
    const statusOrder = ['queued', 'running', 'success', 'fatal_error', 'retryable_error', 'canceled'];
    const counts = summary.status_counts || {};
    const grid = $('#ops-status-grid');
    grid.innerHTML = '';

    statusOrder.forEach(s => {
      const count = counts[s] || 0;
      const div = document.createElement('div');
      div.className = `ops-stat-card ops-stat-${s.replace('_', '-')}`;
      div.innerHTML = `
        <div class="ops-stat-value">${count}</div>
        <div class="ops-stat-label">${statusBadge(s)}</div>
      `;
      grid.appendChild(div);
    });

    // Runs travadas
    const stuckCount = summary.stuck_count || 0;
    const stuckIDs = summary.stuck_runs || [];

    const stuckSection = $('#ops-stuck-section');
    if (stuckCount === 0) {
      stuckSection.innerHTML = '<p class="ops-ok">✔ Nenhuma run travada detectada.</p>';
    } else {
      const badge = `<span class="badge badge-error">${stuckCount} travada${stuckCount > 1 ? 's' : ''}</span>`;
      const list = stuckIDs.map(id => `<div class="ops-stuck-id mono">${id}</div>`).join('');
      stuckSection.innerHTML = `
        <div class="ops-stuck-header">${badge}</div>
        <div class="ops-stuck-list">${list}</div>
      `;
    }
  } catch (e) {
    $('#ops-loading')?.classList.add('hidden');
    $('#ops-error')?.classList.remove('hidden');
    $('#ops-error-msg').textContent = e.message;
  }
}

// =====================================================================
// Inicialização
// =====================================================================
document.addEventListener('DOMContentLoaded', async () => {
  // Verifica status da API
  try {
    const ok = await api.health();
    $('#api-status').className = ok ? 'status-dot healthy' : 'status-dot error';
  } catch {
    $('#api-status').className = 'status-dot error';
  }

  // Navegação por hash
  $$('.nav-item').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const view = a.dataset.view;
      location.hash = view;
    });
  });

  const hash = location.hash.replace('#', '') || 'criar';
  navigate(hash);
});
