/* =============================================================================
   Relatório Webbot – js.js
   Rota base: GET /v1/relatorios/webbot/relatorio
   ============================================================================= */

(function () {
  // ---------------------------------------------------------------------------
  // Estado global da página
  // ---------------------------------------------------------------------------
  const STATE = {
    filtros: {
      empresa_id: null,
      broker_id: null,
      operador: null,
      fila_id: null,
      status: null,
      data_inicio: null,
      data_fim: null,
    },
    paginacao: { pagina: 1, limit: 50, total: 0 },
    componentes: { tabela: null, paginacao: null },
    conversaAtual: null, // dados do relatorio selecionado para o modal
    mensagensAtual: [],  // mensagens carregadas para download
  };

  const BASE = 'v1/relatorios/webbot';

  // ---------------------------------------------------------------------------
  // API
  // ---------------------------------------------------------------------------
  const API = {
    async options(endpoint, params = {}) {
      try {
        const qs = new URLSearchParams(params).toString();
        const url = qs ? `${BASE}/options/${endpoint}?${qs}` : `${BASE}/options/${endpoint}`;
        const res = await reqAsync(url, 'GET');
        return res.data || [];
      } catch (e) {
        console.error('Erro ao buscar opções:', endpoint, e);
        return [];
      }
    },

    async listar(filtros, pagina, limit) {
      const params = new URLSearchParams({ page: pagina, limit });
      if (filtros.empresa_id) params.set('empresa_id', filtros.empresa_id);
      if (filtros.broker_id) params.set('broker_id', filtros.broker_id);
      if (filtros.operador) params.set('operador', filtros.operador);
      if (filtros.fila_id) params.set('fila_id', filtros.fila_id);
      if (filtros.status) params.set('status', filtros.status);
      if (filtros.data_inicio) params.set('data_inicio', filtros.data_inicio);
      if (filtros.data_fim) params.set('data_fim', filtros.data_fim);

      const res = await reqAsync(`${BASE}/relatorio?${params}`, 'GET');
      return res.data || {};
    },

    async exportar(filtros) {
      const params = new URLSearchParams();
      if (filtros.empresa_id) params.set('empresa_id', filtros.empresa_id);
      if (filtros.broker_id) params.set('broker_id', filtros.broker_id);
      if (filtros.operador) params.set('operador', filtros.operador);
      if (filtros.fila_id) params.set('fila_id', filtros.fila_id);
      if (filtros.status) params.set('status', filtros.status);
      if (filtros.data_inicio) params.set('data_inicio', filtros.data_inicio);
      if (filtros.data_fim) params.set('data_fim', filtros.data_fim);

      const res = await reqAsync(`${BASE}/relatorio/exportar?${params}`, 'GET');
      return res.data || [];
    },

    async conversa(atendimentoId) {
      const res = await reqAsync(`${BASE}/relatorio/${atendimentoId}/conversa`, 'GET');
      return res.data || {};
    },
  };

  // ---------------------------------------------------------------------------
  // Utilitários de formatação
  // ---------------------------------------------------------------------------
  function fmtDataHora(val) {
    if (!val) return '-';
    const s = val.replace('Z', '').replace('T', ' ').split('.')[0];
    const [d, t] = s.split(' ');
    if (!d) return val;
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y} ${t || ''}`.trim();
  }

  function fmtTempo(val) {
    if (!val) return '-';
    return typeof val === 'string' ? val.split('.')[0] : val;
  }

  function fmtTelefone(num) {
    if (!num) return '-';
    const n = num.toString();
    if (n.length === 13) return n.replace(/^(\d{2})(\d{2})(\d{5})(\d{4})$/, '+$1 ($2) $3-$4');
    if (n.length === 12) return n.replace(/^(\d{2})(\d{2})(\d{4})(\d{4})$/, '+$1 ($2) $3-$4');
    return num;
  }

  function badgeStatus(status) {
    const map = {
      finalizado: 'badge-success',
      em_atendimento: 'badge-info',
      em_fila: 'badge-warning',
      em_ura: 'badge-ghost',
      abandono: 'badge-error',
      sessao_expirada: 'badge-neutral',
    };
    const cls = map[status] || 'badge-ghost';
    const label = (status || '-').replace(/_/g, ' ');
    return `<span class="badge ${cls} badge-sm capitalize">${label}</span>`;
  }

  // ---------------------------------------------------------------------------
  // Preencher selects de opções
  // ---------------------------------------------------------------------------
  async function carregarOpcoes() {
    const [empresas, statusList] = await Promise.all([
      API.options('empresas'),
      API.options('status'),
    ]);

    preencherSelect('#wb_empresa_select', empresas, 'Todas as empresas');
    preencherSelect('#wb_status_select', statusList, 'Todos os status');

    // broker/operador/fila ficam vazios até empresa ser selecionada
    preencherSelect('#wb_broker_select', [], 'Selecione uma empresa primeiro');
    preencherSelect('#wb_operador_select', [], 'Selecione uma empresa primeiro');
    preencherSelect('#wb_fila_select', [], 'Selecione uma empresa primeiro');
    $('#wb_broker_select, #wb_operador_select, #wb_fila_select').prop('disabled', true);
  }

  async function carregarOpcoesDependentes(empresaId) {
    const $deps = $('#wb_broker_select, #wb_operador_select, #wb_fila_select');

    if (!empresaId) {
      preencherSelect('#wb_broker_select', [], 'Selecione uma empresa primeiro');
      preencherSelect('#wb_operador_select', [], 'Selecione uma empresa primeiro');
      preencherSelect('#wb_fila_select', [], 'Selecione uma empresa primeiro');
      $deps.prop('disabled', true);
      return;
    }

    $deps.html('<option value="">Carregando...</option>').prop('disabled', true);

    const params = { empresa_id: empresaId };
    const [brokers, operadores, filas] = await Promise.all([
      API.options('brokers', params),
      API.options('operadores', params),
      API.options('filas', params),
    ]);

    preencherSelect('#wb_broker_select', brokers, 'Todos os brokers');
    preencherSelect('#wb_operador_select', operadores, 'Todos os operadores');
    preencherSelect('#wb_fila_select', filas, 'Todas as filas');
    $deps.prop('disabled', false);
  }

  function preencherSelect(seletor, itens, placeholder) {
    const $sel = $(seletor);
    $sel.html(`<option value="">${placeholder}</option>`);
    (itens || []).forEach(item => {
      const value = item.value ?? item.id ?? item;
      const label = item.label ?? item.nome ?? item.name ?? value;
      $sel.append(`<option value="${value}">${label}</option>`);
    });
  }

  // ---------------------------------------------------------------------------
  // Renderizar tabela
  // ---------------------------------------------------------------------------
  function renderizarTabela(relatorios) {
    const columns = [
      { label: 'Início', value: 'inicio', format: (v, r) => fmtDataHora(v) },
      { label: 'Número', value: 'numero', format: (v) => fmtTelefone(v) },
      { label: 'Cliente', value: 'cliente', format: (v, r) => r?.dados_cliente?.nome || '-' },
      { label: 'Empresa', value: 'empresa', format: (v) => v?.nome || '-' },
      { label: 'Broker', value: 'broker', format: (v) => v?.nome || v?.appname || '-' },
      { label: 'Operador', value: 'operador', format: (v) => v || '-' },
      { label: 'SLA', value: 'sla', format: (v) => fmtTempo(v), title: 'Tempo em SLA' },
      { label: 'TU', value: 'tu', format: (v) => fmtTempo(v), title: 'Tempo em URA' },
      { label: 'TE', value: 'te', format: (v) => fmtTempo(v), title: 'Tempo de Espera' },
      { label: 'TA', value: 'ta', format: (v) => fmtTempo(v), title: 'Tempo de Atendimento' },
      { label: 'TT', value: 'tt', format: (v) => fmtTempo(v), title: 'Tempo Total' },
      { label: 'IT', value: 'atendimento_ini', format: (v) => fmtDataHora(v), title: 'Início Atendimento' },
      { label: 'FT', value: 'atendimento_fim', format: (v) => fmtDataHora(v), title: 'Fim Atendimento' },
      { label: 'Fim', value: 'fim', format: (v) => fmtDataHora(v), title: 'Fim' },
      { label: 'Status', value: 'status', format: (v) => badgeStatus(v) },
      {
        label: '',
        value: '__acoes',
        format: (_, row) => `<button
          class="btn btn-xs btn-ghost tooltip tooltip-left"
          data-tip="Ver conversa"
          onclick="window.BashWebbotRelatorio.verConversa(${row.atendimento_id || row.id}, ${JSON.stringify(row).replace(/"/g, '&quot;')})"
        ><i class="fas fa-eye"></i></button>`,
      },
    ];

    // adapta data para BashTable (necessita format nos columns ou data direta)
    if (!STATE.componentes.tabela) {
      STATE.componentes.tabela = new BashTable({
        id: 'wb-tabela-relatorio',
        columns,
        data: relatorios,
        emptyMessage: 'Nenhum registro encontrado no período',
      });
      STATE.componentes.tabela.appendToContainer('#wb_container_tabela');
    } else {
      STATE.componentes.tabela.updateData(relatorios);
    }
  }

  function renderizarPaginacao(total) {
    STATE.paginacao.total = total;
    if (!STATE.componentes.paginacao) {
      STATE.componentes.paginacao = new BashPagination({
        id: 'wb-paginacao',
        pagina: STATE.paginacao.pagina,
        total,
        limit: STATE.paginacao.limit,
        container: '#wb_container_paginacao',
        onNext: (p) => { STATE.paginacao.pagina = p; buscarRelatorios(); },
        onPrev: (p) => { STATE.paginacao.pagina = p; buscarRelatorios(); },
      });
    } else {
      STATE.componentes.paginacao.update(STATE.paginacao.pagina, total);
    }
  }

  function atualizarMetricas(relatorios) {
    const total = relatorios.length;
    const counts = {};
    let totalSegundos = 0;
    let comTT = 0;

    relatorios.forEach(r => {
      const s = r.status || 'desconhecido';
      counts[s] = (counts[s] || 0) + 1;
      if (r.tt) {
        const partes = r.tt.split(':').map(Number);
        if (partes.length >= 3) {
          totalSegundos += partes[0] * 3600 + partes[1] * 60 + Math.floor(partes[2]);
          comTT++;
        }
      }
    });

    document.getElementById('wb_metric_total').textContent = total;
    const finalizados = Object.keys(counts)
      .filter((status) => status && status.startsWith('finalizado'))
      .reduce((acc, status) => acc + (counts[status] || 0), 0);
    const abandonoExpirado = (counts['abandono'] || 0) + (counts['sessao_expirada'] || 0);

    document.getElementById('wb_metric_finalizados').textContent = finalizados;
    document.getElementById('wb_metric_abandono_expirado').textContent = abandonoExpirado;

    if (comTT > 0) {
      const media = Math.floor(totalSegundos / comTT);
      const hh = String(Math.floor(media / 3600)).padStart(2, '0');
      const mm = String(Math.floor((media % 3600) / 60)).padStart(2, '0');
      const ss = String(media % 60).padStart(2, '0');
      document.getElementById('wb_metric_tt_medio').textContent = `${hh}:${mm}:${ss}`;
    } else {
      document.getElementById('wb_metric_tt_medio').textContent = '-';
    }

    $('#wb_cards_metricas').show();
  }

  // ---------------------------------------------------------------------------
  // Buscar e renderizar relatório
  // ---------------------------------------------------------------------------
  async function buscarRelatorios() {
    try {
      $('#wb_container_tabela').html(`
        <div class="text-center py-12" id="wb_loading_tabela">
          <span class="loading loading-spinner loading-lg"></span>
          <p class="mt-2 opacity-60">Carregando...</p>
        </div>
      `);
      STATE.componentes.tabela = null;

      const dados = await API.listar(STATE.filtros, STATE.paginacao.pagina, STATE.paginacao.limit);
      const relatorios = dados.relatorios || [];
      const total = dados.total || 0;

      $('#wb_loading_tabela').remove();

      if (relatorios.length === 0) {
        $('#wb_container_tabela').html(`
          <div class="text-center py-12 opacity-40">
            <i class="fas fa-inbox text-4xl mb-3"></i>
            <p>Nenhum registro encontrado no período</p>
          </div>
        `);
        $('#wb_cards_metricas').hide();
        renderizarPaginacao(0);
        $('#wb_btn_exportar_xlsx').prop('disabled', true);
        return;
      }

      renderizarTabela(relatorios);
      renderizarPaginacao(total);
      atualizarMetricas(relatorios);
      $('#wb_btn_exportar_xlsx').prop('disabled', false);
    } catch (e) {
      console.error('Erro ao buscar relatórios:', e);
      $('#wb_container_tabela').html(`
        <div class="text-center py-12 text-error">
          <i class="fas fa-exclamation-triangle text-4xl mb-3"></i>
          <p>Erro ao carregar dados</p>
        </div>
      `);
    }
  }

  // ---------------------------------------------------------------------------
  // Exportar XLSX
  // ---------------------------------------------------------------------------
  async function exportarXLSX() {
    try {
      $('#wb_btn_exportar_xlsx').prop('disabled', true).html('<span class="loading loading-spinner loading-xs mr-2"></span>Exportando...');

      const relatorios = await API.exportar(STATE.filtros);

      if (!relatorios || relatorios.length === 0) {
        avisos('Atenção', 'Nenhum dado para exportar.', 'warning');
        return;
      }

      const linhas = relatorios.map(r => ({
        'ID': r.id,
        'Início': fmtDataHora(r.inicio),
        'Fila (entrada)': fmtDataHora(r.fila),
        'Atendimento Início': fmtDataHora(r.atendimento_ini),
        'Atendimento Fim': fmtDataHora(r.atendimento_fim),
        'Fim': fmtDataHora(r.fim),
        'Número': r.numero || '',
        'Empresa': r.empresa?.nome || '',
        'Broker': r.broker?.nome || r.broker?.appname || '',
        'Operador': r.operador || '',
        'Status': (r.status || '').replace(/_/g, ' '),
        'TU': fmtTempo(r.tu),
        'TE': fmtTempo(r.te),
        'TA': fmtTempo(r.ta),
        'TT': fmtTempo(r.tt),
        'SLA': fmtTempo(r.sla),
      }));

      const ws = XLSX.utils.json_to_sheet(linhas);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Relatório Webbot');

      const dataStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `relatorio_webbot_${dataStr}.xlsx`);

      avisos('Sucesso', 'Arquivo XLSX gerado com sucesso!', 'success');
    } catch (e) {
      console.error('Erro ao exportar XLSX:', e);
      avisos('Erro', 'Erro ao gerar o arquivo XLSX.', 'error');
    } finally {
      $('#wb_btn_exportar_xlsx').prop('disabled', false).html('<i class="fas fa-file-excel mr-2"></i>Exportar XLSX');
    }
  }

  // ---------------------------------------------------------------------------
  // Modal de conversa
  // ---------------------------------------------------------------------------
  async function verConversa(atendimentoId, rowData) {
    STATE.conversaAtual = rowData;
    STATE.mensagensAtual = [];

    // preencher info do atendimento
    document.getElementById('wb_modal_numero').textContent = fmtTelefone(rowData.numero);
    document.getElementById('wb_modal_operador').textContent = rowData.operador || '-';
    document.getElementById('wb_modal_inicio').textContent = fmtDataHora(rowData.inicio);
    document.getElementById('wb_modal_status').textContent = (rowData.status || '-').replace(/_/g, ' ');

    // limpar e mostrar loading
    $('#wb_modal_mensagens').html(`
      <div class="text-center py-8 opacity-40">
        <span class="loading loading-spinner loading-md"></span>
        <p class="mt-2">Carregando mensagens...</p>
      </div>
    `);
    $('#wb_btn_download_txt, #wb_btn_download_html, #wb_btn_download_pdf').prop('disabled', true);

    document.getElementById('wb_modal_conversa').showModal();

    try {
      if (!atendimentoId) {
        $('#wb_modal_mensagens').html(`
          <div class="text-center py-8 opacity-40">
            <i class="fas fa-unlink text-2xl mb-2"></i>
            <p>Este registro não possui atendimento vinculado.</p>
          </div>
        `);
        return;
      }

      const dados = await API.conversa(atendimentoId);
      const mensagens = dados.mensagens || [];
      STATE.mensagensAtual = mensagens;

      if (mensagens.length === 0) {
        $('#wb_modal_mensagens').html(`
          <div class="text-center py-8 opacity-40">
            <i class="fas fa-comment-slash text-2xl mb-2"></i>
            <p>Nenhuma mensagem nesta conversa.</p>
          </div>
        `);
        return;
      }

      renderizarMensagens(mensagens);
      $('#wb_btn_download_txt, #wb_btn_download_html, #wb_btn_download_pdf').prop('disabled', false);
    } catch (e) {
      console.error('Erro ao buscar conversa:', e);
      $('#wb_modal_mensagens').html(`
        <div class="text-center py-8 text-error">
          <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
          <p>Erro ao carregar a conversa.</p>
        </div>
      `);
    }
  }

  function renderizarMensagens(mensagens) {
    const html = mensagens.map(msg => {
      const autor = msg.autor || 'bot'; // "cliente" | "operador" | "bot" | "sistema"
      // is_cliente vem do backend (mensagens_tipo_id == 1); fallback pelo campo autor
      const isCliente = msg.is_cliente === true || autor === 'cliente';
      const isOperador = !isCliente && autor === 'operador';
      const isSistema = !isCliente && autor === 'sistema';

      const alinhamento = isCliente ? 'chat-start' : 'chat-end';
      const bubble = isCliente
        ? 'chat-bubble-primary'
        : isOperador ? 'chat-bubble-success'
          : isSistema ? 'chat-bubble-neutral'
            : 'chat-bubble-warning';
      const nomeLabel = isCliente ? 'Cliente'
        : isOperador ? (msg.fluxo_nome || 'Operador')
          : isSistema ? 'Sistema'
            : (msg.fluxo_nome || 'Bot');
      const hora = msg.created_at
        ? new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : '';

      let conteudo = '';
      const tipo = msg.tipo || 'texto';

      if (tipo === 'texto' && msg.texto) {
        conteudo = `<p class="whitespace-pre-wrap break-words">${escHTML(msg.texto)}</p>`;
      } else if (['imagem', 'video'].includes(tipo) && msg.midia?.url) {
        conteudo = `
          <div class="text-xs opacity-60 mb-1"><i class="fas fa-image mr-1"></i>${tipo}</div>
          <a href="${escHTML(msg.midia.url)}" target="_blank" class="link text-xs">${escHTML(msg.midia.url)}</a>
          ${msg.midia.caption ? `<p class="text-xs mt-1">${escHTML(msg.midia.caption)}</p>` : ''}
        `;
      } else if (tipo === 'audio' && msg.midia?.url) {
        conteudo = `
          <div class="text-xs opacity-60 mb-1"><i class="fas fa-microphone mr-1"></i>Áudio</div>
          <a href="${escHTML(msg.midia.url)}" target="_blank" class="link text-xs">Ouvir áudio</a>
        `;
      } else if (tipo === 'documento' && msg.midia) {
        conteudo = `
          <div class="text-xs opacity-60 mb-1"><i class="fas fa-file mr-1"></i>Documento</div>
          <a href="${escHTML(msg.midia.url || '#')}" target="_blank" class="link text-xs">${escHTML(msg.midia.filename || 'Ver arquivo')}</a>
        `;
      } else if (msg.texto) {
        conteudo = `<p class="whitespace-pre-wrap break-words">${escHTML(msg.texto)}</p>`;
      } else {
        conteudo = `<span class="opacity-40 text-xs">[${tipo}]</span>`;
      }

      return `
        <div class="chat ${alinhamento}">
          <div class="chat-header text-xs opacity-70 mb-1">
            ${escHTML(nomeLabel)}
            <time class="ml-1">${hora}</time>
          </div>
          <div class="chat-bubble ${bubble} text-sm max-w-xs">
            ${conteudo}
          </div>
        </div>
      `;
    }).join('');

    document.getElementById('wb_modal_mensagens').innerHTML = html;
  }

  function escHTML(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---------------------------------------------------------------------------
  // Download TXT da conversa
  // ---------------------------------------------------------------------------
  function downloadTXT() {
    const row = STATE.conversaAtual || {};
    const msgs = STATE.mensagensAtual || [];

    let txt = 'HISTÓRICO DA CONVERSA WEBBOT\n';
    txt += '='.repeat(50) + '\n';
    txt += `Número  : ${fmtTelefone(row.numero)}\n`;
    txt += `Operador: ${row.operador || '-'}\n`;
    txt += `Início  : ${fmtDataHora(row.inicio)}\n`;
    txt += `Status  : ${(row.status || '-').replace(/_/g, ' ')}\n`;
    txt += '='.repeat(50) + '\n\n';

    msgs.forEach(m => {
      const hora = m.created_at
        ? new Date(m.created_at).toLocaleTimeString('pt-BR')
        : '';
      const autor = (m.autor || 'bot').toUpperCase();
      const texto = m.texto || (m.midia?.url ? `[${m.tipo}: ${m.midia.url}]` : `[${m.tipo || 'desconhecido'}]`);
      txt += `[${hora}] ${autor}: ${texto}\n`;
    });

    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `conversa_${row.atendimento_id || row.id || 'webbot'}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---------------------------------------------------------------------------
  // Download HTML da conversa
  // ---------------------------------------------------------------------------
  function downloadHTML() {
    const row = STATE.conversaAtual || {};
    const msgs = STATE.mensagensAtual || [];
    const id = row.atendimento_id || row.id || 'webbot';

    const messagesHTML = msgs.length === 0
      ? `<div class="no-messages"><p style="font-size:48px;margin-bottom:10px">💬</p><p>Nenhuma mensagem nesta conversa</p></div>`
      : msgs.map(msg => {
          const isCliente = msg.is_cliente === true || msg.autor === 'cliente';
          const isOperador = !isCliente && msg.autor === 'operador';
          const isSistema = !isCliente && msg.autor === 'sistema';
          const tipo = isCliente ? 'cliente' : 'bot';
          const nomeLabel = isCliente ? 'Cliente'
            : isOperador ? (msg.fluxo_nome || 'Operador')
            : isSistema ? 'Sistema'
            : (msg.fluxo_nome || 'Bot');
          const hora = msg.created_at
            ? new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            : '';
          const texto = msg.texto || (msg.midia?.url ? `[${msg.tipo}: ${msg.midia.url}]` : `[${msg.tipo || 'desconhecido'}]`);
          return `
            <div class="message ${tipo}">
              <div class="message-header">
                <span class="message-author">${escHTML(nomeLabel)}</span>
                <span class="message-time">${hora}</span>
              </div>
              <div class="message-bubble">${escHTML(texto)}</div>
            </div>`;
        }).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conversa - ${escHTML(fmtTelefone(row.numero))}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;padding:20px}
    .container{max-width:900px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.3);overflow:hidden}
    .header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:30px;text-align:center}
    .header h1{font-size:26px;font-weight:600;margin-bottom:5px}
    .header p{font-size:14px;opacity:.95}
    .info-section{background:#f8f9fa;padding:25px 30px;border-bottom:2px solid #e9ecef}
    .info-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:20px}
    .info-item{display:flex;flex-direction:column}
    .info-label{font-size:11px;color:#6c757d;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
    .info-value{font-size:15px;color:#212529;font-weight:500}
    .messages{padding:30px;min-height:400px;background:#fafbfc}
    .message{margin-bottom:16px;display:flex;flex-direction:column}
    .message.cliente{align-items:flex-end}
    .message.bot{align-items:flex-start}
    .message-header{display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:0 4px}
    .message.cliente .message-header{flex-direction:row-reverse}
    .message-author{font-size:13px;font-weight:700;color:#495057}
    .message-time{font-size:11px;color:#868e96}
    .message-bubble{max-width:75%;padding:12px 16px;border-radius:16px;word-wrap:break-word;white-space:pre-wrap;line-height:1.6;font-size:14px;box-shadow:0 1px 2px rgba(0,0,0,.1)}
    .message.cliente .message-bubble{background:#e3f2fd;color:#0d47a1;border-bottom-right-radius:4px}
    .message.bot .message-bubble{background:#fff3e0;color:#e65100;border-bottom-left-radius:4px}
    .no-messages{text-align:center;padding:80px 20px;color:#6c757d}
    .footer{background:#f8f9fa;padding:20px;text-align:center;font-size:12px;color:#868e96;border-top:2px solid #e9ecef}
    @media print{body{background:#fff;padding:0}.container{box-shadow:none;border-radius:0}}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Histórico da Conversa</h1>
      <p>Atendimento Digital</p>
    </div>
    <div class="info-section">
      <div class="info-grid">
        <div class="info-item"><div class="info-label">Número</div><div class="info-value">${escHTML(fmtTelefone(row.numero))}</div></div>
        <div class="info-item"><div class="info-label">Operador</div><div class="info-value">${escHTML(row.operador || '-')}</div></div>
        <div class="info-item"><div class="info-label">Início</div><div class="info-value">${escHTML(fmtDataHora(row.inicio))}</div></div>
        <div class="info-item"><div class="info-label">Status</div><div class="info-value">${escHTML((row.status || '-').replace(/_/g, ' '))}</div></div>
      </div>
    </div>
    <div class="messages">${messagesHTML}</div>
    <div class="footer"><p><strong>Momentum Ativo</strong> - Atendimento Digital | Gerado em ${new Date().toLocaleString('pt-BR')}</p></div>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `conversa_${id}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---------------------------------------------------------------------------
  // Download PDF da conversa
  // ---------------------------------------------------------------------------
  function downloadPDF() {
    // Reutiliza o HTML gerado pelo downloadHTML e abre em nova janela para impressão/PDF
    const row = STATE.conversaAtual || {};
    const msgs = STATE.mensagensAtual || [];

    const messagesHTML = msgs.length === 0
      ? `<div class="no-messages"><p style="font-size:48px;margin-bottom:10px">💬</p><p>Nenhuma mensagem nesta conversa</p></div>`
      : msgs.map(msg => {
          const isCliente = msg.is_cliente === true || msg.autor === 'cliente';
          const isOperador = !isCliente && msg.autor === 'operador';
          const isSistema = !isCliente && msg.autor === 'sistema';
          const tipo = isCliente ? 'cliente' : 'bot';
          const nomeLabel = isCliente ? 'Cliente'
            : isOperador ? (msg.fluxo_nome || 'Operador')
            : isSistema ? 'Sistema'
            : (msg.fluxo_nome || 'Bot');
          const hora = msg.created_at
            ? new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            : '';
          const texto = msg.texto || (msg.midia?.url ? `[${msg.tipo}: ${msg.midia.url}]` : `[${msg.tipo || 'desconhecido'}]`);
          return `
            <div class="message ${tipo}">
              <div class="message-header">
                <span class="message-author">${escHTML(nomeLabel)}</span>
                <span class="message-time">${hora}</span>
              </div>
              <div class="message-bubble">${escHTML(texto)}</div>
            </div>`;
        }).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conversa - ${escHTML(fmtTelefone(row.numero))}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#fff;padding:20px}
    .container{max-width:900px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden}
    .header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:30px;text-align:center}
    .header h1{font-size:26px;font-weight:600;margin-bottom:5px}
    .header p{font-size:14px;opacity:.95}
    .info-section{background:#f8f9fa;padding:25px 30px;border-bottom:2px solid #e9ecef}
    .info-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:20px}
    .info-item{display:flex;flex-direction:column}
    .info-label{font-size:11px;color:#6c757d;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
    .info-value{font-size:15px;color:#212529;font-weight:500}
    .messages{padding:30px;min-height:200px;background:#fafbfc}
    .message{margin-bottom:16px;display:flex;flex-direction:column}
    .message.cliente{align-items:flex-end}
    .message.bot{align-items:flex-start}
    .message-header{display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:0 4px}
    .message.cliente .message-header{flex-direction:row-reverse}
    .message-author{font-size:13px;font-weight:700;color:#495057}
    .message-time{font-size:11px;color:#868e96}
    .message-bubble{max-width:75%;padding:12px 16px;border-radius:16px;word-wrap:break-word;white-space:pre-wrap;line-height:1.6;font-size:14px;box-shadow:0 1px 2px rgba(0,0,0,.1)}
    .message.cliente .message-bubble{background:#e3f2fd;color:#0d47a1;border-bottom-right-radius:4px}
    .message.bot .message-bubble{background:#fff3e0;color:#e65100;border-bottom-left-radius:4px}
    .no-messages{text-align:center;padding:80px 20px;color:#6c757d}
    .footer{background:#f8f9fa;padding:20px;text-align:center;font-size:12px;color:#868e96;border-top:2px solid #e9ecef}
    @media print{
      body{padding:0}
      .container{border-radius:0}
      .message{page-break-inside:avoid}
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Histórico da Conversa</h1>
      <p>Atendimento Digital</p>
    </div>
    <div class="info-section">
      <div class="info-grid">
        <div class="info-item"><div class="info-label">Número</div><div class="info-value">${escHTML(fmtTelefone(row.numero))}</div></div>
        <div class="info-item"><div class="info-label">Operador</div><div class="info-value">${escHTML(row.operador || '-')}</div></div>
        <div class="info-item"><div class="info-label">Início</div><div class="info-value">${escHTML(fmtDataHora(row.inicio))}</div></div>
        <div class="info-item"><div class="info-label">Status</div><div class="info-value">${escHTML((row.status || '-').replace(/_/g, ' '))}</div></div>
      </div>
    </div>
    <div class="messages">${messagesHTML}</div>
    <div class="footer"><p><strong>Momentum Ativo</strong> - Atendimento Digital | Gerado em ${new Date().toLocaleString('pt-BR')}</p></div>
  </div>
  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.addEventListener('afterprint', () => URL.revokeObjectURL(url));
    }
  }

  // ---------------------------------------------------------------------------
  // Inicialização e eventos
  // ---------------------------------------------------------------------------
  function coletarFiltros() {
    STATE.filtros.empresa_id = $('#wb_empresa_select').val() || null;
    STATE.filtros.broker_id = $('#wb_broker_select').val() || null;
    STATE.filtros.operador = $('#wb_operador_select').val() || null;
    STATE.filtros.fila_id = $('#wb_fila_select').val() || null;
    STATE.filtros.status = $('#wb_status_select').val() || null;
    STATE.filtros.data_inicio = $('#wb_data_inicio').val() || null;
    STATE.filtros.data_fim = $('#wb_data_fim').val() || null;
  }

  function limparFiltros() {
    $('#wb_empresa_select, #wb_broker_select, #wb_operador_select, #wb_fila_select, #wb_status_select').val('');
    $('#wb_data_inicio').val('');
    $('#wb_data_fim').val('');
    Object.keys(STATE.filtros).forEach(k => { STATE.filtros[k] = null; });
    STATE.paginacao.pagina = 1;
  }

  function init() {
    // Datas padrão: hoje
    const hoje = new Date().toISOString().split('T')[0];
    $('#wb_data_inicio').val(hoje);
    $('#wb_data_fim').val(hoje);
    STATE.filtros.data_inicio = hoje;
    STATE.filtros.data_fim = hoje;

    // Carregar opções dos selects
    carregarOpcoes();

    // Empresa → recarregar broker/operador/fila
    $('#wb_empresa_select').on('change', function () {
      const empresaId = $(this).val() || null;
      STATE.filtros.empresa_id = empresaId;
      STATE.filtros.broker_id = null;
      STATE.filtros.operador = null;
      STATE.filtros.fila_id = null;
      carregarOpcoesDependentes(empresaId);
    });

    // Eventos
    $('#wb_btn_filtrar').on('click', () => {
      coletarFiltros();
      STATE.paginacao.pagina = 1;
      buscarRelatorios();
    });

    $('#wb_btn_limpar').on('click', () => {
      limparFiltros();
      $('#wb_container_tabela').html(`
        <div class="text-center py-12 opacity-60">
          <i class="fas fa-comments text-6xl mb-4"></i>
          <p class="text-lg">Aplique os filtros e clique em "Buscar" para carregar os dados</p>
        </div>
      `);
      if (STATE.componentes.paginacao) {
        STATE.componentes.paginacao.update(1, 0);
      }
      STATE.componentes.tabela = null;
      $('#wb_cards_metricas').hide();
      $('#wb_btn_exportar_xlsx').prop('disabled', true);
    });

    $('#wb_btn_exportar_xlsx').on('click', exportarXLSX);
    $('#wb_btn_download_txt').on('click', downloadTXT);
    $('#wb_btn_download_html').on('click', downloadHTML);
    $('#wb_btn_download_pdf').on('click', downloadPDF);
  }

  // ---------------------------------------------------------------------------
  // Expor função global para botões inline da tabela
  // ---------------------------------------------------------------------------
  window.BashWebbotRelatorio = { verConversa };

  // Aguardar DOM estar pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
