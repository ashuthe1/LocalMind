# LocalMind Chat Application

Secure app that connects with Deepseek:r1 or other Ollama models, featuring real-time updates and memory-like chatgpt with no external dependencies.

In today's digital landscape, many users are increasingly concerned about the data they share with third-party applications such as OpenAI or DeepSeek. LocalMind addresses these concerns by offering an intuitive and sleek user interface similar to leading platforms like ChatGPT, Claude, or Perplexity—while ensuring that **all data is stored locally** in a database provided by the user for persistent reference and privacy.

The backend uses MongoDB to store chat messages and user information, while integrating with locally hosted OLLAMA models (such as `deepseek-r1:8b`) to generate AI responses. This project is designed to be entirely self-contained with no external dependencies.

---

## Purpose

Since many of us are worried about our data being shared with third-party apps like OpenAI or DeepSeek for various reasons, this app was built to let users experience the same features offered by major platforms—featuring an intuitive and sleek user interface. LocalMind provides the comprehensive chat experience seen in applications like ChatGPT, Claude, or Perplexity while ensuring **all data is stored in a local database** provided by the user, guaranteeing privacy and persistence for future reference.

---

## Table of Contents

- [Features](#features)
- [Future Scope](#future-scope)
- [Project Structure](#project-structure)
- [Setup and Installation](#setup-and-installation)
- [Usage](#usage)
- [Backend Overview](#backend-overview)
- [Frontend Overview](#frontend-overview)
- [License](#license)

---

## Features

- [x] **Full-Stack Integration:** Seamless communication between React+Vite frontend and Golang backend.
- [x] **Real-Time Chat Updates:** Utilizes Server-Sent Events (SSE) to stream chat updates in real-time.
- [x] **MongoDB Storage:** Chat messages and user data are persistently stored using MongoDB.
- [x] **Local OLLAMA Model Integration:** Interact with local AI models like `deepseek-r1:8b` (or any other model you choose).
- [x] **User Management:** Create and update user settings (e.g., username, about me, preferences).
- [x] **Chat Operations:** Create new chats, send messages, list chats, and delete chats.
- [x] **Initialization Script:** Automates starting both frontend and backend, and initializes a default chat message.

---

## Future Scope

- [ ] **Thread-Aware Context Chatbot:** Enhance conversations with thread-aware contextual responses.
- [ ] **Semantic Search Implementation:** Integrate semantic search capabilities to improve chat message retrieval.
- [ ] **Pin Chats:** Allow users to pin important chats for quick access.
- [ ] **Enhanced User Preferences:** Expand customization options for user settings.

---

## Project Structure

```
LocalMind/
├── backend/                 # Golang backend server
│   ├── cmd/server/main.go   # Server entry point
│   ├── api/                 # API route handlers
│   ├── models/              # Data models (User, Chat, Message, etc.)
│   ├── services/            # Business logic (Chat, OLLAMA, User services)
│   └── ...                  # Additional backend files
├── frontend/                # React + Vite frontend
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── services/        # API services (e.g., api.js for handling SSE and REST calls)
│   │   └── ...              # Additional frontend files
├── .env                     # Environment variables file
└── start.sh                 # Startup script for local development
```

---

## Setup and Installation

1. **Configure Environment Variables:**
   - Copy the `.env.example` file in the root directory, rename it to `.env`, and update the variables as per your requirements.

2. **Make the Startup Script Executable:**

   ```bash
   chmod +x start.sh
   ```

3. **Run the Project:**
   - **First Time Usage:** Initialize the model and create a user by running:
     
     ```bash
     ./start.sh --init
     ```
     
   - **Subsequent Runs:** Simply execute:
     
     ```bash
     ./start.sh
     ```

---

## Usage

- **Frontend:** The React+Vite frontend runs on [http://localhost:5173](http://localhost:5173) and communicates with the backend via REST and SSE (Server-Sent Events) for real-time updates.
- **Backend:** The Golang server listens on port `8080` and exposes various endpoints for chat operations, user management, and AI model interactions.
- **Real-Time Chat:** When a message is sent from the frontend, the backend streams the response using SSE, ensuring a smooth, real-time chat experience.

---

## Backend Overview

The backend is implemented in Golang and includes:

- **API Handlers:** Located in `backend/api/handlers.go`, these endpoints handle creating chats, sending messages (with SSE streaming), deleting chats, and managing users.
- **Services:** Business logic is modularized into services for handling chats, user management, and interaction with local OLLAMA models.
- **MongoDB Integration:** Chat messages and user information are stored in MongoDB for persistence.
- **Local AI Model Interaction:** The server interacts with local OLLAMA models to generate responses. This can be configured to use any compatible model.

---

## Frontend Overview

The frontend is built using React and Vite, featuring:

- **Service Integration:** API calls are managed through `src/services/api.js`, which includes methods for sending messages (with SSE support), retrieving chats, and updating user settings.
- **Real-Time Updates:** Utilizes Server-Sent Events (SSE) to stream real-time updates to the chat interface.
- **Modern UI:** Provides a responsive and intuitive interface for chatting with the local AI assistant.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

Happy coding and enjoy building with LocalMind! If you have any questions or suggestions, please feel free to contribute or open an issue.