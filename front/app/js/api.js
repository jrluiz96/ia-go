/**
 * api.js — Cliente HTTP para a API do IA-GO
 */
const API_BASE = '/api/v1';

const api = {
  async _request(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch(API_BASE + path, opts);
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = json.error || `Erro ${res.status}`;
      throw new Error(msg);
    }
    return json;
  },

  get: (path) => api._request('GET', path),
  post: (path, body) => api._request('POST', path, body),

  // Health
  health: () => fetch('/health').then(r => r.ok),

  // Bots
  listBots: () => api.get('/bots'),
  getBot: (id) => api.get(`/bots/${id}`),
  createBot: (data) => api.post('/bots', data),

  // Versões
  createVersion: (botID, data) => api.post(`/bots/${botID}/versions`, data),
  approveVersion: (botID, versionID, by) =>
    api.post(`/bots/${botID}/versions/${versionID}/approve`, { approved_by: by }),
  publishVersion: (botID, versionID, by) =>
    api.post(`/bots/${botID}/versions/${versionID}/publish`, { published_by: by }),

  // Geração por NL
  generatePreview: (data) => api.post('/generate/preview', data),
  generateBot: (data) => api.post('/generate', data),

  // Runs
  adHocTest: (botID, data) => api.post(`/bots/${botID}/ad-hoc-test`, data),
  getRun: (runID) => api.get(`/runs/${runID}`),
  listRuns: (botID, limit) => {
    const q = limit ? `?limit=${limit}` : '';
    return api.get(`/bots/${botID}/runs${q}`);
  },
  getEvents: (runID) => api.get(`/runs/${runID}/events`),
};

window.api = api;
