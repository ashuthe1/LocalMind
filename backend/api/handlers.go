// api/handlers.go

package api

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/ashuthe1/localmind/config"
	"github.com/ashuthe1/localmind/models"
	"github.com/ashuthe1/localmind/services"
	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Handler struct {
	ChatService   *services.ChatService
	OllamaService *services.OllamaService
}

// NewHandler creates a new Handler instance.
func NewHandler(chatService *services.ChatService, ollamaService *services.OllamaService) *Handler {
	return &Handler{
		ChatService:   chatService,
		OllamaService: ollamaService,
	}
}

// SendMessageHandler handles sending a message and streaming the response from the LLM via SSE.
func (h *Handler) SendMessageHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("Received a new chat request.")

	var req struct {
		Message string `json:"message"`
		ChatID  string `json:"chatId,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Println("Error decoding request body:", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate input
	if req.Message == "" {
		log.Println("Error: User Prompt is empty.")
		http.Error(w, "User Prompt is required", http.StatusBadRequest)
		return
	}

	var chatID primitive.ObjectID
	var err error
	if req.ChatID == "" {
		log.Println("No chatID provided, creating a new chat.")
		chat, err := h.ChatService.CreateChat("New Chat")
		if err != nil {
			log.Println("Failed to create chat:", err)
			http.Error(w, "Failed to create chat", http.StatusInternalServerError)
			return
		}
		chatID = chat.ID
	} else {
		chatID, err = primitive.ObjectIDFromHex(req.ChatID)
		if err != nil {
			log.Println("Invalid chat ID format:", err)
			http.Error(w, "Invalid chat ID", http.StatusBadRequest)
			return
		}
	}

	// Add user's message to chat
	log.Println("Adding user message to chat:", req.Message)
	userMessage := models.Message{
		ID:        primitive.NewObjectID(),
		Role:      "user",
		Content:   req.Message,
		Timestamp: time.Now(),
	}
	if err := h.ChatService.AddMessage(chatID, userMessage); err != nil {
		log.Println("Failed to store user message:", err)
		http.Error(w, "Failed to add user message", http.StatusInternalServerError)
		return
	}

	// Set headers for SSE
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		log.Println("Error: HTTP Flusher not supported.")
		http.Error(w, "Streaming unsupported!", http.StatusInternalServerError)
		return
	}

	assistantResponse := ""

	// Callback function to send each chunk
	sendChunk := func(chunk string) error {
		log.Println("Sending SSE chunk:", chunk)
		_, err := w.Write([]byte("data: " + chunk + "\n\n"))
		if err != nil {
			log.Println("Client disconnected, stopping SSE stream:", err)
			return err
		}
		flusher.Flush()
		assistantResponse += chunk // Store response for later saving
		return nil
	}

	// Start heartbeat
	heartbeatTicker := time.NewTicker(10 * time.Second)
	doneCh := make(chan struct{})

	go func() {
		for {
			select {
			case <-heartbeatTicker.C:
				log.Println("Sending SSE heartbeat.")
				_, err := w.Write([]byte("data: \n\n"))
				if err != nil {
					log.Println("Client disconnected during heartbeat:", err)
					return
				}
				flusher.Flush()
			case <-doneCh:
				log.Println("Stopping heartbeat goroutine.")
				return
			}
		}
	}()

	// Stream response from Ollama
	log.Println("Starting LLM response streaming.")
	err = h.OllamaService.StreamResponse(req.Message, config.ModelName, sendChunk)

	// Stop heartbeat ticker
	close(doneCh)
	heartbeatTicker.Stop()

	if err != nil {
		log.Println("Error streaming response from LLM:", err)
		sendChunk("[ERROR] Failed to complete response.")
		return
	}

	// Save assistant response to chat
	if assistantResponse != "" {
		log.Println("Storing assistant response in chat.")
		assistantMessage := models.Message{
			ID:        primitive.NewObjectID(),
			Role:      "assistant",
			Content:   assistantResponse,
			Timestamp: time.Now(),
		}
		if err := h.ChatService.AddMessage(chatID, assistantMessage); err != nil {
			log.Println("Error storing assistant message:", err)
		}
	}

	// Send final SSE event
	log.Println("Streaming complete, sending 'done' event.")
	_, _ = w.Write([]byte("event: complete\ndata: done\n\n"))
	flusher.Flush()
}

// GetChatsHandler retrieves all chats.
func (h *Handler) GetChatsHandler(w http.ResponseWriter, r *http.Request) {
	chats, err := h.ChatService.GetAllChats()
	if err != nil {
		http.Error(w, "Failed to retrieve chats", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(chats)
}

// DeleteChatHandler deletes a chat by ID.
func (h *Handler) DeleteChatHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	chatIDHex := vars["id"]

	chatID, err := primitive.ObjectIDFromHex(chatIDHex)
	if err != nil {
		http.Error(w, "Invalid chat ID", http.StatusBadRequest)
		return
	}

	if err := h.ChatService.DeleteChat(chatID); err != nil {
		http.Error(w, "Failed to delete chat", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// DeleteAllChatsHandler deletes all chats.
func (h *Handler) DeleteAllChatsHandler(w http.ResponseWriter, r *http.Request) {
	if err := h.ChatService.DeleteAllChats(); err != nil {
		http.Error(w, "Failed to delete all chats", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
