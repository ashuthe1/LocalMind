#!/usr/bin/env bash
# LocalMind — one command to build and run.
#   ./start.sh          build the UI + binary, then run it (opens your browser)
#   ./start.sh --dev    hot-reloading dev mode (Go backend on :8080, Vite UI on :5173)
#   ./start.sh --build  build only (binary at ./bin/localmind)
set -euo pipefail
cd "$(dirname "$0")"

MODE="run"
case "${1:-}" in --dev) MODE="dev" ;; --build) MODE="build" ;; esac

command -v go  >/dev/null || { echo "Go is required: https://go.dev/dl/"; exit 1; }
command -v npm >/dev/null || { echo "Node.js is required: https://nodejs.org/"; exit 1; }

build() {
  echo "▸ Building the web UI…"
  (cd frontend && { [ -d node_modules ] || npm install --no-fund --no-audit; } && npm run build --silent)
  echo "▸ Building the backend…"
  mkdir -p bin && (cd backend && go build -o ../bin/localmind ./cmd/server)
}

case "$MODE" in
  build) build; echo "✓ Built ./bin/localmind" ;;
  dev)
    trap 'kill 0' EXIT INT TERM
    (cd backend && go run ./cmd/server) &
    (cd frontend && { [ -d node_modules ] || npm install --no-fund --no-audit; } && npm run dev) &
    wait ;;
  run)
    build
    echo "▸ Starting LocalMind…"
    OPEN_BROWSER="${OPEN_BROWSER:-true}" exec ./bin/localmind ;;
esac
