#!/usr/bin/env bash
# LocalMind launcher.
#   ./start.sh            build the UI once, then run the single Go binary (production mode)
#   ./start.sh --dev      run the Vite dev server (hot reload) + the Go backend side by side
#   ./start.sh --build    only build (frontend + backend binary at ./bin/localmind)
set -euo pipefail
cd "$(dirname "$0")"

MODE="prod"
case "${1:-}" in
  --dev)   MODE="dev" ;;
  --build) MODE="build" ;;
  --init)  echo "ℹ️  --init is no longer needed: providers and your profile are set up in the app's Settings." ;;
esac

if [ -f .env ]; then
  set -a; # shellcheck disable=SC1091
  source .env; set +a
fi

command -v go >/dev/null   || { echo "❌ Go is required (https://go.dev/dl/)"; exit 1; }
command -v npm >/dev/null  || { echo "❌ Node.js/npm is required (https://nodejs.org/)"; exit 1; }

build_frontend() {
  echo "📦 Building the web UI…"
  (cd frontend && { [ -d node_modules ] || npm install; } && npm run build)
}

build_backend() {
  echo "🔧 Building the backend…"
  mkdir -p bin
  (cd backend && go build -o ../bin/localmind ./cmd/server)
}

PIDS=()
cleanup() { for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT INT TERM

case "$MODE" in
  build)
    build_frontend; build_backend
    echo "✅ Built ./bin/localmind (UI embedded). Run it from the repo root."
    ;;
  dev)
    echo "🚀 Starting backend (go run) and Vite dev server…"
    (cd backend && go run ./cmd/server) & PIDS+=($!)
    (cd frontend && { [ -d node_modules ] || npm install; } && npm run dev) & PIDS+=($!)
    sleep 2
    echo "🌐 UI: http://localhost:5173   API: http://localhost:${SERVER_ADDRESS##*:}"
    wait
    ;;
  prod)
    build_frontend; build_backend
    echo "🚀 Starting LocalMind…"
    OPEN_BROWSER="${OPEN_BROWSER:-true}" exec ./bin/localmind
    ;;
esac
