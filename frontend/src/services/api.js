// src/services/api.js
// Thin fetch wrapper for the LocalMind backend (see docs/API.md) plus an SSE reader.

const API_BASE_URL = '/api';

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function request(path, { method = 'GET', body, signal, raw = false, headers } = {}) {
  const init = { method, signal, headers: { ...(headers || {}) } };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError('Cannot reach the LocalMind server', 0, null);
  }
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    let parsed = null;
    let text = '';
    try {
      text = await response.text();
      try {
        parsed = JSON.parse(text);
        if (parsed?.error) message = parsed.error;
      } catch {
        if (text) message = text.slice(0, 300);
      }
    } catch {
      /* ignore */
    }
    // A gateway/dev-proxy failure means the backend itself is down: report it like a network error.
    const gateway = [502, 503, 504].includes(response.status) || (response.status === 500 && /proxy error|ECONNREFUSED/i.test(text));
    if (gateway) throw new ApiError('Cannot reach the LocalMind server', 0, null);
    throw new ApiError(message, response.status, parsed);
  }
  if (raw) return response;
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text);
}

/**
 * Reads a text/event-stream body and calls onEvent({ event, data }) for each event.
 * - Handles `event:` and `data:` lines, multi-line data, CRLF, and comment heartbeats (`: ping`).
 * - `data` is JSON-parsed when possible, otherwise the raw string.
 */
export async function readSSE(response, onEvent, signal) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatch = (block) => {
    let event = 'message';
    const dataLines = [];
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue;
      const idx = line.indexOf(':');
      const field = idx === -1 ? line : line.slice(0, idx);
      let value = idx === -1 ? '' : line.slice(idx + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'event') event = value;
      else if (field === 'data') dataLines.push(value);
    }
    if (dataLines.length === 0) return;
    const rawData = dataLines.join('\n');
    let data = rawData;
    try {
      data = JSON.parse(rawData);
    } catch {
      /* keep raw */
    }
    onEvent({ event, data });
  };

  try {
    for (;;) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');
      let sep;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        dispatch(block);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) dispatch(buffer);
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
}

async function stream(path, body, onEvent, signal) {
  const response = await request(path, { method: 'POST', body, signal, raw: true });
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/event-stream')) {
    const text = await response.text();
    throw new ApiError(text || 'Server did not return a stream', response.status, null);
  }
  await readSSE(response, onEvent, signal);
}

async function downloadResponse(path, fallbackName) {
  const response = await request(path, { raw: true });
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const filename = match ? decodeURIComponent(match[1]) : fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}

export const api = {
  // Health
  getHealth: (signal) => request('/health', { signal }),

  // Settings
  getSettings: () => request('/settings'),
  updateSettings: (partial) => request('/settings', { method: 'PUT', body: partial }),

  // Providers
  getProviderCatalog: () => request('/providers/catalog'),
  getProviders: () => request('/providers'),
  createProvider: (config) => request('/providers', { method: 'POST', body: config }),
  updateProvider: (id, config) => request(`/providers/${id}`, { method: 'PUT', body: config }),
  deleteProvider: (id) => request(`/providers/${id}`, { method: 'DELETE' }),
  getProviderModels: (id, signal) => request(`/providers/${id}/models`, { signal }),
  testProvider: (id, signal) => request(`/providers/${id}/test`, { method: 'POST', signal }),
  testProviderConfig: (config, signal) => request('/providers/test', { method: 'POST', body: config, signal }),

  // Profile
  getUser: () => request('/user'),
  updateUser: (partial) => request('/user', { method: 'PUT', body: partial }),

  // Chats
  getChats: (q = '', signal) => request(`/chats${q ? `?q=${encodeURIComponent(q)}` : ''}`, { signal }),
  createChat: (body = {}) => request('/chats', { method: 'POST', body }),
  getChat: (id, signal) => request(`/chats/${id}`, { signal }),
  patchChat: (id, patch) => request(`/chats/${id}`, { method: 'PATCH', body: patch }),
  deleteChat: (id) => request(`/chats/${id}`, { method: 'DELETE' }),
  deleteAllChats: () => request('/chats', { method: 'DELETE' }),
  exportChat: (id, format = 'markdown') =>
    downloadResponse(`/chats/${id}/export?format=${format}`, `chat-${id}.${format === 'json' ? 'json' : 'md'}`),
  editMessage: (chatId, messageId, content, truncateAfter = false) =>
    request(`/chats/${chatId}/messages/${messageId}`, { method: 'PUT', body: { content, truncateAfter } }),
  deleteMessage: (chatId, messageId, cascade = false) =>
    request(`/chats/${chatId}/messages/${messageId}?cascade=${cascade ? 'true' : 'false'}`, { method: 'DELETE' }),

  // Streaming
  sendMessage: (body, onEvent, signal) => stream('/chat', body, onEvent, signal),
  regenerate: (chatId, body, onEvent, signal) => stream(`/chats/${chatId}/regenerate`, body, onEvent, signal),

  // Data
  exportAll: () => downloadResponse('/export', 'localmind-export.json'),
  importAll: (payload) => request('/import', { method: 'POST', body: payload }),
};

export default api;
