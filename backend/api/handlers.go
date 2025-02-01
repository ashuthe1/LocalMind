// api/handlers.go

package api

import (
	"encoding/json"
	"fmt"
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

	if req.Message == "" {
		http.Error(w, "User Prompt is required", http.StatusBadRequest)
		return
	}

	var chatID primitive.ObjectID
	var err error
	if req.ChatID == "" {
		chat, err := h.ChatService.CreateChat("New Chat")
		if err != nil {
			log.Println("Error creating new chat:", err)
			http.Error(w, "Failed to create chat", http.StatusInternalServerError)
			return
		}
		chatID = chat.ID
	} else {
		chatID, err = primitive.ObjectIDFromHex(req.ChatID)
		if err != nil {
			log.Println("Invalid chat ID:", err)
			http.Error(w, "Invalid chat ID", http.StatusBadRequest)
			return
		}
	}

	// Store the user message
	userMessage := models.Message{
		ID:        primitive.NewObjectID(),
		Role:      "user",
		Content:   req.Message,
		Timestamp: time.Now(),
	}
	if err := h.ChatService.AddMessage(chatID, userMessage); err != nil {
		log.Println("Error adding user message:", err)
		http.Error(w, "Failed to add user message", http.StatusInternalServerError)
		return
	}

	// Setup SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Keep-Alive", "timeout=600, max=100")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported!", http.StatusInternalServerError)
		return
	}

	ctx := r.Context()
	doneCh := make(chan struct{})

	// Goroutine to detect client disconnection
	go func() {
		<-ctx.Done()
		log.Println("Client disconnected, stopping SSE stream...")
		close(doneCh)
	}()

	// Start heartbeat to keep connection alive
	heartbeatTicker := time.NewTicker(10 * time.Second)
	go func() {
		for {
			select {
			case <-heartbeatTicker.C:
				if _, err := w.Write([]byte("data: \n\n")); err != nil {
					log.Println("Error sending heartbeat:", err)
					return
				}
				flusher.Flush()
			case <-doneCh:
				log.Println("Stopping heartbeat goroutine")
				return
			}
		}
	}()

	assistantResponse := ""

	// Callback function to send streamed data
	sendChunk := func(chunk string) error {
		select {
		case <-doneCh:
			return fmt.Errorf("client disconnected")
		default:
			_, err := w.Write([]byte("data: " + chunk + "\n\n"))
			if err != nil {
				log.Println("Error sending chunk:", err)
				return err
			}
			flusher.Flush()
			log.Println("Sent SSE chunk:", chunk)
			assistantResponse += chunk
			return nil
		}
	}

	// Stream response from Ollama
	err = h.OllamaService.StreamResponse(req.Message, config.ModelName, sendChunk)
	close(doneCh)
	heartbeatTicker.Stop()

	if err != nil {
		log.Println("Error streaming response from LLM:", err)
		sendChunk("[ERROR] Failed to complete response.")
		return
	}

	// Save assistant's response
	assistantMessage := models.Message{
		ID:        primitive.NewObjectID(),
		Role:      "assistant",
		Content:   assistantResponse,
		Timestamp: time.Now(),
	}
	if err := h.ChatService.AddMessage(chatID, assistantMessage); err != nil {
		log.Println("Error adding assistant message:", err)
	}

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
