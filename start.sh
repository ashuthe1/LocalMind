source .env

echo "🚀 Starting backend and frontend..."

INIT=false

# Check for --init flag
if [[ "$1" == "--init" ]]; then
  INIT=true
fi

if [ -z "$USERNAME" ]; then
  echo "⚠️ USERNAME not found in .env file! Using default 'guest'."
  USERNAME="guest"
fi

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

# Initialize user and generate a message
initialize() {
  echo "🔄 Initializing user and generating a message..."

  # Wait a bit to ensure the backend is running
  sleep 5  

  echo "👤 Creating user: $USERNAME"
  curl --location 'http://localhost:8080/api/create-user' \
    --header 'Content-Type: application/json' \
    --data "{
      \"username\": \"$USERNAME\",
      \"aboutMe\": \"\"
    }" > /dev/null 2>&1

  echo "💬 Sending initial message..."
  curl --location 'http://localhost:8080/api/chat-init' \
    --header 'Content-Type: application/json' \
    --data '' > /dev/null 2>&1

  echo "📦 Initialization Setup Completed, App is running on port 5173 ツ"
}

launchBrowser() {
  sleep 2
  echo "🚀 Opening \033[32mhttp://localhost:5173\033[0m in the default web browser ツ"

  # Open localhost:5173 in the default web browser
  if command -v xdg-open > /dev/null; then
    xdg-open http://localhost:5173  # Linux
  elif command -v open > /dev/null; then
    open http://localhost:5173  # macOS
  else
    echo "⚠️ Unable to open browser. Please open http://localhost:5173 manually."
  fi
}

start_frontend
start_backend

if $INIT; then
  initialize
fi

launchBrowser

wait
