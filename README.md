<p align="center">
  <img src="frontend/public/icon.svg" width="88" alt="LocalMind logo" />
</p>

<h1 align="center">LocalMind</h1>

<p align="center">
  A private, self-hosted chat UI for <em>any</em> LLM — local or cloud — with every conversation stored on your own machine.
</p>

<p align="center">
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img alt="Go" src="https://img.shields.io/badge/backend-Go-00ADD8">
  <img alt="React" src="https://img.shields.io/badge/frontend-React%20%2B%20Vite-61DAFB">
  <img alt="Storage" src="https://img.shields.io/badge/storage-SQLite%20%7C%20MongoDB-lightgrey">
</p>

---

LocalMind gives you a ChatGPT-style experience without handing your conversations to anyone. It talks to the model server you choose — Ollama or LM Studio on your laptop, a llama.cpp or vLLM box on your network, or a cloud API when you want one — and keeps the chat history, your profile and your settings in a local database. One Go binary serves both the API and the web UI, so it also works beautifully from a phone on the same Wi-Fi.

## Highlights

**Bring any model**

- **Ollama**, **LM Studio** (native API *and* OpenAI-compatible mode), **llama.cpp server**, **vLLM**, **LocalAI**, **Jan** — anything local.
- **OpenAI**, **Anthropic**, **Google Gemini**, **OpenRouter**, **Groq**, **DeepSeek**, **Mistral**, **xAI**, **Together**, **Fireworks**, **Cerebras**, **Perplexity**, or any **custom OpenAI-compatible** endpoint.
- Configure as many providers as you like, test the connection, pick models from a live list, and switch provider/model per chat.
- Images: attach, paste or drop pictures for vision models (Ollama, LM Studio, OpenAI-compatible, Anthropic, Gemini).
- Reasoning models: thinking is streamed separately and shown in a collapsible panel. `<think>` tags are handled for you.

**A real chat app**

- Full conversation history is sent to the model (thread-aware context), with a configurable window.
- Edit **your** messages and **the assistant's** messages. Save, or save & regenerate from that point.
- Regenerate, stop generation mid-stream, copy, delete, auto-generated titles, pin, rename, search, export (Markdown/JSON).
- Live stats per reply: tokens, tokens/second, provider and model.
- Reconnects gracefully: if the server or your model host goes away, the UI tells you and recovers when it is back — no reload needed.

**Yours, and customizable**

- Persona: name and avatar for the assistant, your name, "about me" and response preferences fed into the system prompt.
- Model controls: system prompt, temperature, top-p, max tokens, context length, reasoning effort, seed, stop sequences.
- Appearance: system/dark/light theme, accent color, font size, code theme, timestamps, Enter-to-send, compact mode.
- Data: one-click backup and restore of everything (API keys excluded).
- Installable as a PWA; the system back button behaves like a native app on Android.

## Quick start

Prerequisites: [Go 1.22+](https://go.dev/dl/) and [Node.js 18+](https://nodejs.org/). No database to install — SQLite is built in.

```bash
git clone https://github.com/ashuthe1/LocalMind.git
cd LocalMind
./start.sh
```

That builds the UI, compiles the single binary to `bin/localmind`, starts it on <http://localhost:8080> and opens your browser. On first launch, open **Settings → Providers**, pick a preset (Ollama is pre-configured to `http://localhost:11434`), test the connection and choose a model.

Prefer Docker?

```bash
docker compose up -d          # LocalMind + an Ollama sidecar
docker compose exec ollama ollama pull llama3.2
```

or just the app, pointing at a model server you already run:

```bash
docker build -t localmind .
docker run -p 8080:8080 -v localmind:/data \
  -e DEFAULT_PROVIDER_URL=http://host.docker.internal:11434 localmind
```

### Development

```bash
./start.sh --dev     # Go backend on :8080 + Vite dev server with hot reload on :5173
make test            # Go unit tests + frontend lint
```

## Configuration

Copy `.env.example` to `.env` if you want to change defaults. Everything is optional.

| Variable | Default | Purpose |
|---|---|---|
| `SERVER_ADDRESS` | `:8080` | Listen address. Use `0.0.0.0:8080` to reach it from other devices. |
| `STORAGE` | `sqlite` | `sqlite` or `mongo`. |
| `DATA_DIR` | `./data` | SQLite database and logs live here. |
| `MONGO_URI`, `DATABASE_NAME` | — | For `STORAGE=mongo`. LocalMind 1.x data is migrated automatically. |
| `DEFAULT_PROVIDER` | `ollama` | Provider created on first run only: `ollama`, `lmstudio`, `openai`, `anthropic`, `gemini`. |
| `DEFAULT_PROVIDER_URL` | preset URL | Base URL for that provider. |
| `DEFAULT_PROVIDER_KEY` | — | API key for that provider. |
| `MODEL_NAME` | — | Default model for that provider. |
| `USER_NAME` | `friend` | Your display name (editable in Settings). |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error`. |
| `OPEN_BROWSER` | `false` | Open the UI on start (`start.sh` sets it to `true`). |
| `CORS_ORIGINS` | — | Extra allowed browser origins, comma separated. |

After the first run, providers are managed in the UI; environment defaults are not re-applied.

> **A note on exposure.** LocalMind has no login. If you bind to `0.0.0.0`, anyone on that network can read your chats and use your configured API keys. Keep it on a trusted network or put it behind a reverse proxy with authentication.

## Provider notes

| Provider | Type | Base URL | Notes |
|---|---|---|---|
| Ollama | `ollama` | `http://localhost:11434` | Native `/api/chat`; thinking via `think`; images supported. |
| LM Studio (native) | `lmstudio` | `http://localhost:1234` | Uses `/api/v1/chat` with server-side stateful chats; reasoning and model-load progress streamed. |
| LM Studio (OpenAI mode) | `openai` | `http://localhost:1234/v1` | Use if you prefer the classic endpoint. |
| llama.cpp / vLLM / LocalAI / Jan | `openai` | see presets | Any OpenAI-compatible server. |
| OpenAI, OpenRouter, Groq, DeepSeek, Mistral, xAI, Together, Fireworks, Cerebras, Perplexity | `openai` | preset | API key required. |
| Anthropic | `anthropic` | `https://api.anthropic.com` | Extended thinking when reasoning is set to low/medium/high. |
| Google Gemini | `gemini` | `https://generativelanguage.googleapis.com/v1beta` | Thinking budget mapped from the reasoning setting. |
| Azure OpenAI | `openai` | `https://<resource>.openai.azure.com/openai/deployments/<deployment>` | Set option `apiVersion`. |

Each provider accepts extra HTTP headers and a manual model list for servers that cannot list models.

## Project structure

```
LocalMind/
├── backend/                 Go server (single binary, embeds the built UI)
│   ├── cmd/server/          entry point
│   ├── api/                 HTTP handlers, routes, SSE streaming
│   ├── services/            chat orchestration, settings, provider resolution, title generation
│   ├── providers/           ollama, openai-compatible, anthropic, gemini, lmstudio
│   ├── store/               Store interface + sqlite (default) and mongo backends
│   ├── models/              shared data types
│   └── web/                 embedded frontend build (backend/web/dist)
├── frontend/                React + Vite + MUI web UI (also a PWA)
├── docs/API.md              HTTP API reference
├── start.sh, Makefile, Dockerfile, docker-compose.yml
└── .env.example
```

The API is documented in [docs/API.md](docs/API.md) — handy if you want to script LocalMind or build another client.

## Upgrading from LocalMind 1.x

- MongoDB is no longer required. Set `STORAGE=mongo` (or keep `MONGO_URI` in your `.env`) to keep using your existing database; documents are migrated in place on first start.
- `ollama run` is no longer shelled out; the backend talks to Ollama's HTTP API. Make sure `ollama serve` is running.
- `./start.sh --init` is gone: your profile and providers are set up in the app.
- `USERNAME` in `.env` became `USER_NAME`.

## Contributing

Issues and pull requests are welcome. Good places to start: new provider types (`backend/providers`), UI polish, and translations.

## License

[MIT](LICENSE)
