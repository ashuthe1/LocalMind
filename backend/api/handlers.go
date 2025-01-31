// api/handlers.go

package api

import (
	"encoding/json"
	"net/http"

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

// SendMessageHandler handles sending a message and getting the response from the LLM.
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
		ID:      primitive.NewObjectID(),
		Role:    "user",
		Content: req.Message,
	}
	if err := h.ChatService.AddMessage(chatID, userMessage); err != nil {
		http.Error(w, "Failed to add user message", http.StatusInternalServerError)
		return
	}

	// Generate response from Ollama LLM
	response, err := h.OllamaService.GenerateResponse(req.Message, config.ModelName)
	if err != nil {
		http.Error(w, "Failed to generate response from LLM", http.StatusInternalServerError)
		return
	}

	// Add assistant's message to chat
	assistantMessage := models.Message{
		ID:      primitive.NewObjectID(),
		Role:    "assistant",
		Content: response,
	}
	if err := h.ChatService.AddMessage(chatID, assistantMessage); err != nil {
		http.Error(w, "Failed to add assistant message", http.StatusInternalServerError)
		return
	}

	// Return the updated chat
	chat, err := h.ChatService.GetChatByID(chatID)
	if err != nil {
		http.Error(w, "Failed to retrieve chat", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(chat)
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
