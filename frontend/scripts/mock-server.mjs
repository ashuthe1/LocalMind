// scripts/mock-server.mjs — in-memory mock of the LocalMind backend (docs/API.md) for UI development.
// Usage: node scripts/mock-server.mjs   (PORT=8080 by default)
import http from 'node:http';
import { randomBytes } from 'node:crypto';

const PORT = Number(process.env.MOCK_PORT || process.env.PORT || 8080);
const started = Date.now();
const id = () => randomBytes(12).toString('hex');
const now = () => new Date().toISOString();

const CATALOG = {
  types: [
    { type: 'ollama', label: 'Ollama', supportsModelList: true, supportsVision: true, needsApiKey: false },
    { type: 'openai', label: 'OpenAI-compatible', supportsModelList: true, supportsVision: true, needsApiKey: false },
    { type: 'anthropic', label: 'Anthropic', supportsModelList: true, supportsVision: true, needsApiKey: true },
    { type: 'gemini', label: 'Google Gemini', supportsModelList: true, supportsVision: true, needsApiKey: true },
    { type: 'lmstudio', label: 'LM Studio (native API)', supportsModelList: true, supportsVision: true, needsApiKey: false },
  ],
  presets: [
    { id: 'ollama', name: 'Ollama', type: 'ollama', baseUrl: 'http://localhost:11434', needsApiKey: false, local: true, docsUrl: 'https://ollama.com' },
    { id: 'lmstudio', name: 'LM Studio', type: 'lmstudio', baseUrl: 'http://localhost:1234', needsApiKey: false, local: true },
    { id: 'lmstudio-openai', name: 'LM Studio (OpenAI compat)', type: 'openai', baseUrl: 'http://localhost:1234/v1', needsApiKey: false, local: true },
    { id: 'llamacpp', name: 'llama.cpp server', type: 'openai', baseUrl: 'http://localhost:8080/v1', needsApiKey: false, local: true },
    { id: 'vllm', name: 'vLLM', type: 'openai', baseUrl: 'http://localhost:8000/v1', needsApiKey: false, local: true },
    { id: 'openai', name: 'OpenAI', type: 'openai', baseUrl: 'https://api.openai.com/v1', needsApiKey: true, local: false },
    { id: 'anthropic', name: 'Anthropic', type: 'anthropic', baseUrl: 'https://api.anthropic.com', needsApiKey: true, local: false },
    { id: 'gemini', name: 'Google Gemini', type: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', needsApiKey: true, local: false },
    { id: 'openrouter', name: 'OpenRouter', type: 'openai', baseUrl: 'https://openrouter.ai/api/v1', needsApiKey: true, local: false },
    { id: 'groq', name: 'Groq', type: 'openai', baseUrl: 'https://api.groq.com/openai/v1', needsApiKey: true, local: false },
    { id: 'custom', name: 'Custom OpenAI-compatible', type: 'openai', baseUrl: '', needsApiKey: false, local: false },
  ],
};

const MODELS = [
  { id: 'llama3.2:latest', name: 'llama3.2', vision: false, loaded: true, contextLength: 8192, family: 'llama' },
  { id: 'qwen3:8b', name: 'qwen3', vision: false, loaded: false, contextLength: 32768, family: 'qwen' },
  { id: 'gemma3:12b', name: 'gemma3', vision: true, loaded: false, contextLength: 8192, family: 'gemma' },
];

const state = {
  user: { id: id(), username: 'guest', aboutMe: '', preferences: '', createdAt: now(), updatedAt: now() },
  settings: {
    activeProviderId: '',
    activeModel: '',
    systemPrompt: 'You are a helpful assistant.',
    assistant: { name: 'Smriti', avatar: '✨' },
    generation: { temperature: 0.7, topP: null, maxTokens: null, contextLength: null, reasoning: 'auto', seed: null, stopSequences: [] },
    features: { autoTitle: true, historyLimit: 40, sendUserProfile: true },
    appearance: { theme: 'system', accent: '#4f6df5', fontSize: 'medium', showReasoning: true, showTimestamps: true, sendOnEnter: true, compact: false },
    updatedAt: now(),
  },
  providers: [],
  chats: [],
};

if (process.env.MOCK_SEED !== '0') {
  const p = { id: id(), type: 'ollama', name: 'Ollama', baseUrl: 'http://localhost:11434', apiKey: '', headers: {}, defaultModel: 'llama3.2:latest', models: [], enabled: true, options: {} };
  state.providers.push(p);
  state.settings.activeProviderId = p.id;
  state.settings.activeModel = p.defaultModel;
  const c = { id: id(), title: 'Welcome to LocalMind', pinned: true, archived: false, providerId: '', model: '', systemPrompt: '', createdAt: now(), updatedAt: now(), messages: [] };
  c.messages.push({ id: id(), role: 'user', content: 'Hello! What can you do?', reasoning: '', images: [], timestamp: now(), editedAt: null });
  c.messages.push({
    id: id(),
    role: 'assistant',
    content: 'Hi! I am **Smriti**, running fully locally.\n\n- Ask me anything\n- Attach images\n- Edit or regenerate messages\n\n```js\nconsole.log("hello from LocalMind");\n```',
    reasoning: 'The user greets me. I should introduce myself briefly.',
    images: [],
    model: 'llama3.2:latest',
    providerId: p.id,
    providerName: 'Ollama',
    timestamp: now(),
    editedAt: null,
    stats: { inputTokens: 20, outputTokens: 60, durationMs: 1200, tokensPerSecond: 50, stopped: false, error: '' },
  });
  state.chats.push(c);
}

const mask = (p) => ({ ...p, apiKey: '', apiKeySet: Boolean(p.apiKey) });
const settingsOut = () => ({ ...state.settings, providers: state.providers.map(mask) });
const summary = (c) => {
  const last = c.messages[c.messages.length - 1];
  return {
    id: c.id,
    title: c.title,
    pinned: c.pinned,
    archived: c.archived,
    providerId: c.providerId,
    model: c.model,
    messageCount: c.messages.length,
    lastMessagePreview: last ? last.content.slice(0, 80) : '',
    lastMessageAt: last ? last.timestamp : null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
};
const sortChats = (list) => list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.updatedAt) - new Date(a.updatedAt));

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(body === undefined ? '' : JSON.stringify(body));
};
const fail = (res, status, error) => json(res, status, { error });
const readBody = (req) =>
  new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LOREM =
  'Here is a thoughtful answer streamed token by token. LocalMind keeps everything on your machine, and this mock server just proves the UI plumbing works. It supports **markdown**, `inline code`, lists:\n\n1. First point\n2. Second point\n\n```python\nprint("streaming works")\n```\n\nThat is all for now!';

async function streamReply(req, res, chat, { userMessageId }) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const provider = state.providers.find((p) => p.id === (chat.providerId || state.settings.activeProviderId));
  const model = chat.model || state.settings.activeModel || provider?.defaultModel || 'mock-model';
  const assistant = { id: id(), role: 'assistant', content: '', reasoning: '', images: [], model, providerId: provider?.id || '', providerName: provider?.name || 'Mock', timestamp: now(), editedAt: null, stats: {} };
  send('meta', { chatId: chat.id, userMessageId: userMessageId || '', assistantMessageId: assistant.id, model, providerId: assistant.providerId, providerName: assistant.providerName });
  let aborted = false;
  req.on('close', () => (aborted = true));
  const started = Date.now();
  send('status', { text: 'Loading model… 40%' });
  await sleep(300);
  send('status', { text: 'Loading model… 100%' });
  await sleep(200);
  res.write(': ping\n\n');
  const lastUser = [...chat.messages].reverse().find((m) => m.role === 'user');
  const reasoning = `The user said: "${(lastUser?.content || '').slice(0, 60)}". Let me compose a helpful reply with some markdown.`;
  for (const word of reasoning.split(' ')) {
    if (aborted) break;
    const t = word + ' ';
    assistant.reasoning += t;
    send('reasoning', { text: t });
    await sleep(40);
  }
  const text = lastUser?.images?.length ? `I can see ${lastUser.images.length} image(s)! ` + LOREM : LOREM;
  for (const word of text.split(' ')) {
    if (aborted) break;
    const t = word + ' ';
    assistant.content += t;
    send('content', { text: t });
    await sleep(35);
  }
  assistant.content = assistant.content.trim();
  assistant.stats = { inputTokens: 42, outputTokens: text.split(' ').length, durationMs: Date.now() - started, tokensPerSecond: (text.split(' ').length / ((Date.now() - started) / 1000)) || 0, stopped: aborted, error: '' };
  chat.messages.push(assistant);
  chat.updatedAt = now();
  if (aborted) return res.end();
  send('done', { message: assistant, chat: summary(chat) });
  if (state.settings.features.autoTitle && chat.title === 'New Chat') {
    await sleep(400);
    chat.title = (lastUser?.content || 'New chat').split(/\s+/).slice(0, 4).join(' ');
    send('title', { chatId: chat.id, title: chat.title });
  }
  res.end();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname.replace(/\/+$/, '');
  const m = (method, pattern) => {
    if (req.method !== method) return null;
    const re = new RegExp('^' + pattern.replace(/\{(\w+)\}/g, '(?<$1>[^/]+)') + '$');
    const match = re.exec(path);
    return match ? match.groups || {} : null;
  };
  if (req.method === 'OPTIONS') return json(res, 204);
  let p;
  try {
    if (m('GET', '/api/health'))
      return json(res, 200, {
        status: 'ok',
        version: 'mock-2.0.0',
        storage: 'memory',
        uptimeSeconds: Math.floor((Date.now() - started) / 1000),
        activeProvider: (() => {
          const ap = state.providers.find((x) => x.id === state.settings.activeProviderId);
          return ap ? { id: ap.id, name: ap.name, type: ap.type, model: state.settings.activeModel } : null;
        })(),
      });
    if (m('GET', '/api/settings')) return json(res, 200, settingsOut());
    if (m('PUT', '/api/settings')) {
      const body = await readBody(req);
      for (const k of ['activeProviderId', 'activeModel', 'systemPrompt']) if (k in body) state.settings[k] = body[k];
      for (const k of ['assistant', 'generation', 'features', 'appearance']) if (body[k]) state.settings[k] = { ...state.settings[k], ...body[k] };
      state.settings.updatedAt = now();
      return json(res, 200, settingsOut());
    }
    if (m('GET', '/api/providers/catalog')) return json(res, 200, CATALOG);
    if (m('GET', '/api/providers')) return json(res, 200, state.providers.map(mask));
    if (m('POST', '/api/providers/test')) {
      const body = await readBody(req);
      await sleep(400);
      const bad = /unreachable|fail/i.test(body.baseUrl || '');
      return json(res, 200, bad ? { ok: false, latencyMs: 0, modelCount: 0, message: '', error: `connection refused: ${body.baseUrl}` } : { ok: true, latencyMs: 23, modelCount: MODELS.length, message: 'Connected', error: '', models: MODELS });
    }
    if (m('POST', '/api/providers')) {
      const body = await readBody(req);
      const prov = { id: id(), type: body.type || 'openai', name: body.name || 'Provider', baseUrl: body.baseUrl || '', apiKey: body.apiKey || '', headers: body.headers || {}, defaultModel: body.defaultModel || '', models: body.models || [], enabled: body.enabled !== false, options: body.options || {} };
      state.providers.push(prov);
      if (!state.settings.activeProviderId) {
        state.settings.activeProviderId = prov.id;
        state.settings.activeModel = prov.defaultModel;
      }
      return json(res, 201, mask(prov));
    }
    if ((p = m('PUT', '/api/providers/{id}'))) {
      const prov = state.providers.find((x) => x.id === p.id);
      if (!prov) return fail(res, 404, 'provider not found');
      const body = await readBody(req);
      for (const k of ['type', 'name', 'baseUrl', 'headers', 'defaultModel', 'models', 'enabled', 'options']) if (k in body) prov[k] = body[k];
      if (body.clearApiKey) prov.apiKey = '';
      else if (body.apiKey) prov.apiKey = body.apiKey;
      return json(res, 200, mask(prov));
    }
    if ((p = m('DELETE', '/api/providers/{id}'))) {
      state.providers = state.providers.filter((x) => x.id !== p.id);
      if (state.settings.activeProviderId === p.id) {
        const next = state.providers.find((x) => x.enabled);
        state.settings.activeProviderId = next?.id || '';
        state.settings.activeModel = next?.defaultModel || '';
      }
      return json(res, 204);
    }
    if ((p = m('GET', '/api/providers/{id}/models'))) {
      const prov = state.providers.find((x) => x.id === p.id);
      if (!prov) return fail(res, 404, 'provider not found');
      await sleep(250);
      return json(res, 200, prov.type === 'ollama' ? MODELS : prov.models.map((x) => ({ id: x, name: x })));
    }
    if ((p = m('POST', '/api/providers/{id}/test'))) {
      const prov = state.providers.find((x) => x.id === p.id);
      if (!prov) return fail(res, 404, 'provider not found');
      await sleep(300);
      const bad = /unreachable|fail/i.test(prov.baseUrl || '');
      return json(res, 200, bad ? { ok: false, latencyMs: 0, modelCount: 0, message: '', error: `connection refused: ${prov.baseUrl}` } : { ok: true, latencyMs: 18, modelCount: MODELS.length, message: 'Connected', error: '' });
    }
    if (m('GET', '/api/user')) return json(res, 200, state.user);
    if (m('PUT', '/api/user')) {
      const body = await readBody(req);
      for (const k of ['username', 'aboutMe', 'preferences']) if (k in body) state.user[k] = body[k];
      state.user.updatedAt = now();
      return json(res, 200, state.user);
    }
    if (m('GET', '/api/chats')) {
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const list = state.chats.filter((c) => !q || c.title.toLowerCase().includes(q) || c.messages.some((x) => x.content.toLowerCase().includes(q)));
      return json(res, 200, sortChats(list).map(summary));
    }
    if (m('POST', '/api/chats')) {
      const body = await readBody(req);
      const c = { id: id(), title: body.title || 'New Chat', pinned: false, archived: false, providerId: body.providerId || '', model: body.model || '', systemPrompt: body.systemPrompt || '', createdAt: now(), updatedAt: now(), messages: [] };
      state.chats.push(c);
      return json(res, 201, c);
    }
    if (m('DELETE', '/api/chats')) {
      state.chats = [];
      return json(res, 204);
    }
    if (m('GET', '/api/export')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="localmind-export.json"' });
      return res.end(JSON.stringify({ version: 1, exportedAt: now(), user: state.user, settings: { ...state.settings }, chats: state.chats }, null, 2));
    }
    if (m('POST', '/api/import')) {
      const body = await readBody(req);
      let n = 0;
      for (const c of body.chats || []) {
        if (!state.chats.some((x) => x.id === c.id)) {
          state.chats.push(c);
          n++;
        }
      }
      return json(res, 200, { chatsImported: n });
    }
    if (m('POST', '/api/chat')) {
      const body = await readBody(req);
      if (!body.content && !(body.images || []).length) return fail(res, 400, 'content is required');
      let chat = body.chatId ? state.chats.find((c) => c.id === body.chatId) : null;
      if (body.chatId && !chat) return fail(res, 404, 'chat not found');
      if (!chat) {
        chat = { id: id(), title: 'New Chat', pinned: false, archived: false, providerId: body.providerId || '', model: body.model || '', systemPrompt: '', createdAt: now(), updatedAt: now(), messages: [] };
        state.chats.push(chat);
      } else if (body.providerId) {
        chat.providerId = body.providerId;
        chat.model = body.model || '';
      }
      const user = { id: id(), role: 'user', content: body.content || '', reasoning: '', images: body.images || [], timestamp: now(), editedAt: null };
      chat.messages.push(user);
      chat.updatedAt = now();
      return streamReply(req, res, chat, { userMessageId: user.id });
    }
    if ((p = m('GET', '/api/chats/{id}'))) {
      const c = state.chats.find((x) => x.id === p.id);
      return c ? json(res, 200, { ...summary(c), systemPrompt: c.systemPrompt, messages: c.messages }) : fail(res, 404, 'chat not found');
    }
    if ((p = m('PATCH', '/api/chats/{id}'))) {
      const c = state.chats.find((x) => x.id === p.id);
      if (!c) return fail(res, 404, 'chat not found');
      const body = await readBody(req);
      for (const k of ['title', 'pinned', 'archived', 'providerId', 'model', 'systemPrompt']) if (k in body) c[k] = body[k];
      c.updatedAt = now();
      return json(res, 200, { ...summary(c), systemPrompt: c.systemPrompt, messages: c.messages });
    }
    if ((p = m('DELETE', '/api/chats/{id}'))) {
      state.chats = state.chats.filter((x) => x.id !== p.id);
      return json(res, 204);
    }
    if ((p = m('GET', '/api/chats/{id}/export'))) {
      const c = state.chats.find((x) => x.id === p.id);
      if (!c) return fail(res, 404, 'chat not found');
      const format = url.searchParams.get('format') || 'markdown';
      if (format === 'json') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${c.title.replace(/[^\w-]+/g, '_')}.json"` });
        return res.end(JSON.stringify(c, null, 2));
      }
      const md = `# ${c.title}\n\n` + c.messages.map((x) => `**${x.role}** (${x.timestamp})\n\n${x.content}\n`).join('\n---\n\n');
      res.writeHead(200, { 'Content-Type': 'text/markdown', 'Content-Disposition': `attachment; filename="${c.title.replace(/[^\w-]+/g, '_')}.md"` });
      return res.end(md);
    }
    if ((p = m('POST', '/api/chats/{id}/regenerate'))) {
      const c = state.chats.find((x) => x.id === p.id);
      if (!c) return fail(res, 404, 'chat not found');
      const body = await readBody(req);
      if (body.messageId) {
        const idx = c.messages.findIndex((x) => x.id === body.messageId);
        if (idx !== -1) c.messages = c.messages.slice(0, idx);
      } else {
        while (c.messages.length && c.messages[c.messages.length - 1].role === 'assistant') c.messages.pop();
      }
      if (body.providerId) {
        c.providerId = body.providerId;
        c.model = body.model || '';
      }
      return streamReply(req, res, c, { userMessageId: '' });
    }
    if ((p = m('PUT', '/api/chats/{id}/messages/{mid}'))) {
      const c = state.chats.find((x) => x.id === p.id);
      if (!c) return fail(res, 404, 'chat not found');
      const idx = c.messages.findIndex((x) => x.id === p.mid);
      if (idx === -1) return fail(res, 404, 'message not found');
      const body = await readBody(req);
      c.messages[idx] = { ...c.messages[idx], content: body.content ?? c.messages[idx].content, editedAt: now() };
      if (body.truncateAfter) c.messages = c.messages.slice(0, idx + 1);
      c.updatedAt = now();
      return json(res, 200, { ...summary(c), systemPrompt: c.systemPrompt, messages: c.messages });
    }
    if ((p = m('DELETE', '/api/chats/{id}/messages/{mid}'))) {
      const c = state.chats.find((x) => x.id === p.id);
      if (!c) return fail(res, 404, 'chat not found');
      const idx = c.messages.findIndex((x) => x.id === p.mid);
      if (idx === -1) return fail(res, 404, 'message not found');
      c.messages = url.searchParams.get('cascade') === 'true' ? c.messages.slice(0, idx) : c.messages.filter((_, i) => i !== idx);
      c.updatedAt = now();
      return json(res, 200, { ...summary(c), systemPrompt: c.systemPrompt, messages: c.messages });
    }
    if (m('POST', '/api/create-user') || m('POST', '/api/chat-init')) return json(res, 200, { status: 'success' });
    return fail(res, 404, `no route for ${req.method} ${path}`);
  } catch (err) {
    console.error(err);
    return fail(res, 500, err.message);
  }
});

server.listen(PORT, () => console.log(`LocalMind mock API listening on http://localhost:${PORT}  (MOCK_SEED=0 for an empty state)`));
