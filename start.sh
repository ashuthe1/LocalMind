#!/bin/bash

echo "🚀 Starting backend and frontend..."

# Start Frontend (React + Vite)
start_frontend() {
  echo "🔄 Setting up frontend..."
  cd frontend || { echo "❌ Frontend directory not found!"; exit 1; }

  if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies (npm install)..."
    npm install
  fi

  echo "🚀 Starting React frontend server..."
  npm run dev &

  cd ..
}

# Start Backend (Go Server)
start_backend() {
  echo "🔄 Setting up backend..."
  cd backend || { echo "❌ Backend directory not found!"; exit 1; }

  echo "📦 Running 'go mod tidy'..."
  go mod tidy

  echo "🚀 Starting Go backend server..."
  go run cmd/server/main.go &

  cd ..
}

start_frontend
start_backend

wait
