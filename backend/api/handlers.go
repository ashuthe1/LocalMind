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
	var req struct {
		Message string `json:"message"`
		ChatID  string `json:"chatId,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate input
	if req.Message == "" {
		http.Error(w, "User Prompt is required", http.StatusBadRequest)
		return
	}

	var chatID primitive.ObjectID
	var err error
	if req.ChatID == "" {
		// Create a new chat if no chatID is provided
		chat, err := h.ChatService.CreateChat("New Chat")
		if err != nil {
			http.Error(w, "Failed to create chat", http.StatusInternalServerError)
			return
		}
		chatID = chat.ID
	} else {
		chatID, err = primitive.ObjectIDFromHex(req.ChatID)
		if err != nil {
			http.Error(w, "Invalid chat ID", http.StatusBadRequest)
			return
		}
	}

	// Add user's message to chat
	userMessage := models.Message{
		ID:        primitive.NewObjectID(),
		Role:      "user",
		Content:   req.Message,
		Timestamp: time.Now(),
	}
	if err := h.ChatService.AddMessage(chatID, userMessage); err != nil {
		http.Error(w, "Failed to add user message", http.StatusInternalServerError)
		return
	}

	// Set headers for Server Sent Events (SSE)
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	// Ensure the writer supports flushing.
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported!", http.StatusInternalServerError)
		return
	}

	assistantResponse := ""

	// Define a callback function to send each chunk as an SSE event.
	sendChunk := func(chunk string) error {
		_, err := w.Write([]byte("data: " + chunk + "\n\n"))
		if err != nil {
			log.Println("Client disconnected, stopping SSE stream...")
			return err // Exit the streaming function
		}
		flusher.Flush()
		return nil
	}

	// Start a heartbeat ticker that sends an empty event every 10 seconds
	heartbeatTicker := time.NewTicker(10 * time.Second)
	// A channel to signal when streaming is done so the ticker can be stopped
	doneCh := make(chan struct{})

	go func() {
		for {
			select {
			case <-heartbeatTicker.C:
				// Send a heartbeat event (an empty data event)
				_, err := w.Write([]byte("data: \n\n"))
				if err != nil {
					// If we encounter an error, likely the client has disconnected.
					return
				}
				flusher.Flush()
			case <-doneCh:
				return
			}
		}
	}()

	// Stream response from the Ollama model.
	err = h.OllamaService.StreamResponse(req.Message, config.ModelName, sendChunk)
	// Signal the heartbeat goroutine to stop and stop the ticker.
	close(doneCh)
	heartbeatTicker.Stop()

	if err != nil {
		http.Error(w, "Failed to stream response from LLM", http.StatusInternalServerError)
		return
	}

	// After streaming is complete, add the assistant's full message to the chat.
	assistantMessage := models.Message{
		ID:        primitive.NewObjectID(),
		Role:      "assistant",
		Content:   assistantResponse,
		Timestamp: time.Now(),
	}
	if err := h.ChatService.AddMessage(chatID, assistantMessage); err != nil {
		log.Println("Some error in Adding Message Backend")
		// Log the error if needed, but the client already received the stream.
	}

	// Optionally, send a final SSE event indicating completion.
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
