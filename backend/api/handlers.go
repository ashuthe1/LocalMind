// api/handlers.go

package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/ashuthe1/localmind/config"
	"github.com/ashuthe1/localmind/logger"
	"github.com/ashuthe1/localmind/models"
	"github.com/ashuthe1/localmind/services"
	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

var totalThreads = 0

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

func (h *Handler) CreateDefaultMessage(w http.ResponseWriter, r *http.Request) {
	chat, err := h.ChatService.CreateChat("Greet User")
	if err != nil {
		log.Println("Error creating new chat:", err)
		http.Error(w, "Failed to create chat", http.StatusInternalServerError)
		return
	}
	chatID := chat.ID
	userMessage := models.Message{
		ID:        primitive.NewObjectID(),
		Role:      "assistant",
		Content:   "Hi, I'm LocalMind, AI ChatBot running completly locally on your system, with no external dependencies.",
		Timestamp: time.Now(),
	}

	if err := h.ChatService.AddMessage(chatID, userMessage); err != nil {
		log.Println("Error adding default message:", err)
		http.Error(w, "Failed to add default message", http.StatusInternalServerError)
		return
	}
}

func (h *Handler) SendMessageHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Message string `json:"message"`
		ChatID  string `json:"chatId,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Log.Errorf("Invalid request payload: %v", err)
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	if req.Message == "" {
		logger.Log.Errorf("User Prompt is required")
		http.Error(w, "User Prompt is required", http.StatusBadRequest)
		return
	}

	var chatID primitive.ObjectID
	var err error
	if req.ChatID == "" {
		chat, err := h.ChatService.CreateChat("New Chat")
		if err != nil {
			logger.Log.Errorf("Error creating new chat: %v", err)
			http.Error(w, "Failed to create chat", http.StatusInternalServerError)
			return
		}
		chatID = chat.ID
	} else {
		chatID, err = primitive.ObjectIDFromHex(req.ChatID)
		if err != nil {
			logger.Log.Errorf("Invalid chat ID: %v", err)
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
		logger.Log.Errorf("Error adding user message: %v", err)
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
		logger.Log.Error("Streaming unsupported")
		http.Error(w, "Streaming unsupported!", http.StatusInternalServerError)
		return
	}

	ctx := r.Context()
	doneCh := make(chan struct{})
	var once sync.Once // Ensure doneCh is only closed once

	// Goroutine to detect client disconnection
	go func() {
		<-ctx.Done()
		once.Do(func() {
			log.Println("Client disconnected, stopping SSE stream...")
			close(doneCh)
		})
	}()

	// Start heartbeat to keep connection alive
	heartbeatTicker := time.NewTicker(1 * time.Second) // More frequent heartbeats
	defer heartbeatTicker.Stop()

	assistantResponse := ""

	// Goroutine to send heartbeats
	go func() {
		for {
			select {
			case <-heartbeatTicker.C:
				if _, err := w.Write([]byte("data: \n\n")); err != nil {
					log.Println("Error sending heartbeat:", err)
					once.Do(func() { close(doneCh) }) // Ensure doneCh is closed only once
					return
				}
				flusher.Flush()
			case <-doneCh:
				log.Println("Stopping heartbeat goroutine")
				return
			}
		}
	}()

	// Callback function to send streamed data
	sendChunk := func(chunk string) error {
		select {
		case <-doneCh:
			return fmt.Errorf("client disconnected")
		default:
			_, err := w.Write([]byte("data: " + chunk + "\n\n"))
			if err != nil {
				log.Println("Error sending chunk:", err)
				once.Do(func() { close(doneCh) }) // Ensure doneCh is closed only once
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

	if err != nil {
		log.Println("Error streaming response from LLM:", err)
		sendChunk("[ERROR] Failed to complete response.")
	}

	// Save assistant's response only if streaming was successful
	if assistantResponse != "" {
		assistantMessage := models.Message{
			ID:        primitive.NewObjectID(),
			Role:      "assistant",
			Content:   assistantResponse,
			Timestamp: time.Now(),
		}
		if err := h.ChatService.AddMessage(chatID, assistantMessage); err != nil {
			log.Println("Error adding assistant message:", err)
		}
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

	totalThreads = len(chats)

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

	if totalThreads == 1 {
		h.CreateDefaultMessage(w, r)
	}

	w.WriteHeader(http.StatusNoContent)
}

// DeleteAllChatsHandler deletes all chats.
func (h *Handler) DeleteAllChatsHandler(w http.ResponseWriter, r *http.Request) {
	if err := h.ChatService.DeleteAllChats(); err != nil {
		http.Error(w, "Failed to delete all chats", http.StatusInternalServerError)
		return
	}

	h.CreateDefaultMessage(w, r)

	w.WriteHeader(http.StatusNoContent)
}
