# LocalMind HTTP API

The backend is a single Go binary. All routes are under `/api`. Every response is JSON unless noted.
Errors are `{"error": "message"}` with an appropriate 4xx/5xx status.

LocalMind is a single-user app: there is one profile and one settings document.

## IDs

All IDs (chats, messages, providers) are 24-character hex strings.

## Health

`GET /api/health`

```json
{
  "status": "ok",
  "version": "2.0.0",
  "storage": "sqlite",
  "uptimeSeconds": 123,
  "activeProvider": { "id": "…", "name": "Ollama", "type": "ollama", "model": "llama3.2" }
}
```
`activeProvider` is `null` when no provider is configured. This endpoint never calls the LLM; use the provider test endpoint for reachability.

## Settings

`GET /api/settings` → `Settings`
`PUT /api/settings` body: partial `Settings` (any subset of top-level keys). Returns the merged `Settings`.

```jsonc
{
  "activeProviderId": "…",          // which provider to use by default
  "activeModel": "llama3.2",         // default model for that provider
  "systemPrompt": "You are a helpful assistant.",
  "assistant": { "name": "Smriti", "avatar": "✨" },
  "generation": {
    "temperature": 0.7,              // null = provider default
    "topP": null,
    "maxTokens": null,
    "contextLength": null,
    "reasoning": "auto",             // auto | off | low | medium | high | on
    "seed": null,
    "stopSequences": []
  },
  "features": {
    "autoTitle": true,               // generate chat title after first reply
    "historyLimit": 40,              // max prior messages sent to the model (0 = all)
    "sendUserProfile": true          // include About me / Preferences in the system prompt
  },
  "appearance": {                    // free-form, owned by the frontend, synced across devices
    "theme": "system",               // system | dark | light
    "accent": "#3f51b5",
    "fontSize": "medium",
    "codeTheme": "material",
    "showReasoning": true,
    "showTimestamps": true,
    "sendOnEnter": true,
    "compact": false
  },
  "providers": [ /* ProviderConfig[] (API keys masked) */ ],
  "updatedAt": "2026-10-24T10:00:00Z"
}
```

## Providers

### Catalog

`GET /api/providers/catalog`

Returns the provider *types* the backend implements and ready-made *presets* (type + base URL + hints) that the UI can show as cards.

```jsonc
{
  "types": [
    { "type": "ollama",    "label": "Ollama",                "supportsModelList": true, "supportsVision": true,  "needsApiKey": false },
    { "type": "openai",    "label": "OpenAI-compatible",     "supportsModelList": true, "supportsVision": true,  "needsApiKey": false },
    { "type": "anthropic", "label": "Anthropic",             "supportsModelList": true, "supportsVision": true,  "needsApiKey": true  },
    { "type": "gemini",    "label": "Google Gemini",         "supportsModelList": true, "supportsVision": true,  "needsApiKey": true  },
    { "type": "lmstudio",  "label": "LM Studio (native API)","supportsModelList": true, "supportsVision": true,  "needsApiKey": false }
  ],
  "presets": [
    { "id": "ollama",     "name": "Ollama",            "type": "ollama",    "baseUrl": "http://localhost:11434",       "needsApiKey": false, "local": true,  "docsUrl": "https://ollama.com" },
    { "id": "lmstudio",   "name": "LM Studio",         "type": "lmstudio",  "baseUrl": "http://localhost:1234",        "needsApiKey": false, "local": true,  "docsUrl": "…" },
    { "id": "lmstudio-openai", "name": "LM Studio (OpenAI compat)", "type": "openai", "baseUrl": "http://localhost:1234/v1", "needsApiKey": false, "local": true },
    { "id": "llamacpp",   "name": "llama.cpp server",  "type": "openai",    "baseUrl": "http://localhost:8080/v1",     "needsApiKey": false, "local": true },
    { "id": "vllm",       "name": "vLLM",              "type": "openai",    "baseUrl": "http://localhost:8000/v1",     "needsApiKey": false, "local": true },
    { "id": "localai",    "name": "LocalAI",           "type": "openai",    "baseUrl": "http://localhost:8080/v1",     "needsApiKey": false, "local": true },
    { "id": "jan",        "name": "Jan",               "type": "openai",    "baseUrl": "http://localhost:1337/v1",     "needsApiKey": false, "local": true },
    { "id": "openai",     "name": "OpenAI",            "type": "openai",    "baseUrl": "https://api.openai.com/v1",    "needsApiKey": true,  "local": false },
    { "id": "anthropic",  "name": "Anthropic",         "type": "anthropic", "baseUrl": "https://api.anthropic.com",    "needsApiKey": true,  "local": false },
    { "id": "gemini",     "name": "Google Gemini",     "type": "gemini",    "baseUrl": "https://generativelanguage.googleapis.com/v1beta", "needsApiKey": true, "local": false },
    { "id": "openrouter", "name": "OpenRouter",        "type": "openai",    "baseUrl": "https://openrouter.ai/api/v1", "needsApiKey": true,  "local": false },
    { "id": "groq",       "name": "Groq",              "type": "openai",    "baseUrl": "https://api.groq.com/openai/v1","needsApiKey": true, "local": false },
    { "id": "deepseek",   "name": "DeepSeek",          "type": "openai",    "baseUrl": "https://api.deepseek.com/v1",  "needsApiKey": true,  "local": false },
    { "id": "mistral",    "name": "Mistral",           "type": "openai",    "baseUrl": "https://api.mistral.ai/v1",    "needsApiKey": true,  "local": false },
    { "id": "xai",        "name": "xAI (Grok)",        "type": "openai",    "baseUrl": "https://api.x.ai/v1",          "needsApiKey": true,  "local": false },
    { "id": "together",   "name": "Together AI",       "type": "openai",    "baseUrl": "https://api.together.xyz/v1",  "needsApiKey": true,  "local": false },
    { "id": "fireworks",  "name": "Fireworks AI",      "type": "openai",    "baseUrl": "https://api.fireworks.ai/inference/v1", "needsApiKey": true, "local": false },
    { "id": "cerebras",   "name": "Cerebras",          "type": "openai",    "baseUrl": "https://api.cerebras.ai/v1",   "needsApiKey": true,  "local": false },
    { "id": "perplexity", "name": "Perplexity",        "type": "openai",    "baseUrl": "https://api.perplexity.ai",    "needsApiKey": true,  "local": false },
    { "id": "custom",     "name": "Custom OpenAI-compatible", "type": "openai", "baseUrl": "",                        "needsApiKey": false, "local": false }
  ]
}
```

### ProviderConfig

```jsonc
{
  "id": "…",
  "type": "openai",                  // one of the catalog types
  "name": "My Groq",                 // user-facing label
  "baseUrl": "https://api.groq.com/openai/v1",
  "apiKey": "",                      // never returned; see apiKeySet
  "apiKeySet": true,                 // read-only
  "headers": { "X-Custom": "value" },// extra HTTP headers
  "defaultModel": "llama-3.3-70b",
  "models": ["…"],                   // optional manual model list (used when listing is unsupported or fails)
  "enabled": true,
  "options": {}                      // type-specific knobs (e.g. {"apiVersion": "2023-06-01"} for anthropic, {"keepAlive": "5m"} for ollama)
}
```

Writing rules: on `PUT`, an empty `apiKey` keeps the stored key; send `"clearApiKey": true` to remove it.

`GET    /api/providers`                 → `ProviderConfig[]`
`POST   /api/providers`                 → create; body `ProviderConfig` without `id`. Returns created config. If it is the first provider it becomes active.
`PUT    /api/providers/{id}`            → update; returns config.
`DELETE /api/providers/{id}`            → 204. If it was active, `activeProviderId` moves to another enabled provider or becomes "".
`GET    /api/providers/{id}/models`     → `ModelInfo[]`
`POST   /api/providers/{id}/test`       → `TestResult`
`POST   /api/providers/test`            → test an **unsaved** config (body `ProviderConfig`; `apiKey` may be empty and `id` may be set to reuse the stored key) → `TestResult`

```jsonc
// ModelInfo
{ "id": "llama3.2:latest", "name": "llama3.2", "vision": true, "loaded": true, "contextLength": 8192, "family": "llama", "sizeBytes": 2019393189 }
// TestResult
{ "ok": true, "latencyMs": 42, "modelCount": 7, "message": "Connected", "error": "", "models": [ /* ModelInfo[], present on success */ ] }
```

## Profile

`GET /api/user` → `{ "id", "username", "aboutMe", "preferences", "createdAt", "updatedAt" }`
`PUT /api/user` body: any subset of `username`, `aboutMe`, `preferences`.

## Chats

### ChatSummary (used in lists)
```jsonc
{
  "id": "…", "title": "Trip planning", "pinned": false, "archived": false,
  "providerId": "…", "model": "llama3.2",         // per-chat override, "" = use settings default
  "messageCount": 12, "lastMessagePreview": "Sure, here is…", "lastMessageAt": "…",
  "createdAt": "…", "updatedAt": "…"
}
```

### Chat (full)
`ChatSummary` + `"systemPrompt": ""` (per-chat override) + `"messages": Message[]`.

### Message
```jsonc
{
  "id": "…",
  "role": "user",                    // user | assistant | system
  "content": "Hello",
  "reasoning": "",                   // model thinking, assistant only
  "images": [ { "name": "cat.png", "mimeType": "image/png", "data": "<base64 without data: prefix>" } ],
  "model": "llama3.2", "providerId": "…", "providerName": "Ollama",   // assistant only
  "timestamp": "…",
  "editedAt": null,
  "stats": { "inputTokens": 120, "outputTokens": 300, "durationMs": 4200, "tokensPerSecond": 71.4, "stopped": false, "error": "" }
}
```

`GET    /api/chats?q=<search>`          → `ChatSummary[]` sorted pinned first, then `updatedAt` desc. `q` matches title and message content (case-insensitive).
`POST   /api/chats`                     → create empty chat. Body `{ "title"?, "providerId"?, "model"?, "systemPrompt"? }` → `Chat`.
`GET    /api/chats/{id}`                → `Chat`
`PATCH  /api/chats/{id}`                → body any subset of `title`, `pinned`, `archived`, `providerId`, `model`, `systemPrompt` → `Chat`
`DELETE /api/chats/{id}`                → 204
`DELETE /api/chats`                     → 204 (delete all)
`GET    /api/chats/{id}/export?format=markdown|json` → file download (`Content-Disposition: attachment`)
`PUT    /api/chats/{id}/messages/{mid}` → body `{ "content": "…", "truncateAfter": false }` → `Chat`. Edits any message (user or assistant). `truncateAfter: true` also deletes every message after it (use before regenerating from an edited user message).
`DELETE /api/chats/{id}/messages/{mid}?cascade=true|false` → `Chat`. `cascade` also deletes everything after it.

### Sending a message (streaming)

`POST /api/chat` — `Content-Type: application/json`, response is `text/event-stream`.

```jsonc
{
  "chatId": "",                      // "" or missing → a new chat is created
  "content": "What's in this image?",
  "images": [ { "name": "x.png", "mimeType": "image/png", "data": "<base64>" } ],
  "providerId": "", "model": ""      // optional per-request override (also saved on the chat)
}
```

### Regenerating

`POST /api/chats/{id}/regenerate` → `text/event-stream`

```jsonc
{ "messageId": "<assistant message id to replace>", "providerId": "", "model": "" }
```
If `messageId` is given, that message and everything after it are deleted first. If omitted, trailing assistant messages after the last user message are deleted. A new assistant message is then streamed.

### SSE event format (both streaming endpoints)

Each event is `event: <name>\ndata: <json>\n\n`. Comment lines (`: ping`) are heartbeats and must be ignored.

| event       | data                                                                            |
|-------------|---------------------------------------------------------------------------------|
| `meta`      | `{ "chatId", "userMessageId", "assistantMessageId", "model", "providerId", "providerName" }` (first event; `userMessageId` empty on regenerate) |
| `status`    | `{ "text": "Loading model… 65%" }` transient progress from the provider          |
| `reasoning` | `{ "text": "…" }` reasoning/thinking delta                                        |
| `content`   | `{ "text": "…" }` answer delta                                                   |
| `error`     | `{ "message": "…" }` the request failed; a `done` event still follows             |
| `done`      | `{ "message": Message, "chat": ChatSummary }` final persisted assistant message   |
| `title`     | `{ "chatId", "title" }` sent after `done` when auto-title produced a title        |

Aborting the HTTP request (client-side `AbortController`) stops generation; the partial answer is saved with `stats.stopped = true`.

The server strips `<think>…</think>` blocks from `content` and re-emits them as `reasoning` events, so the frontend never has to parse think tags.

## Data

`GET  /api/export`  → JSON file with `{ "version", "exportedAt", "user", "settings", "chats" }` (API keys excluded)
`POST /api/import`  → body: that JSON. Merges chats (by id), replaces profile/settings fields that are present. → `{ "chatsImported": n }`

## Legacy routes (kept for `start.sh --init` compatibility)

`POST /api/create-user` and `POST /api/chat-init` still exist and are idempotent.
