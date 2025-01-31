// services/chat_service.go

package services

import (
	"github.com/ashuthe1/localmind/models"
	"github.com/ashuthe1/localmind/repository"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type ChatService struct {
	ChatRepo *repository.ChatRepository
}

func NewChatService(chatRepo *repository.ChatRepository) *ChatService {
	return &ChatService{
		ChatRepo: chatRepo,
	}
}

func (s *ChatService) CreateChat(title string) (*models.Chat, error) {
	chat := &models.Chat{
		ID:       primitive.NewObjectID(),
		Title:    title,
		Messages: []models.Message{},
	}

	err := s.ChatRepo.CreateChat(chat)
	if err != nil {
		return nil, err
	}
	return chat, nil
}

func (s *ChatService) GetChatByID(id primitive.ObjectID) (*models.Chat, error) {
	return s.ChatRepo.GetChatByID(id)
}

func (s *ChatService) GetAllChats() ([]models.Chat, error) {
	return s.ChatRepo.GetAllChats()
}

func (s *ChatService) AddMessage(chatID primitive.ObjectID, message models.Message) error {
	chat, err := s.ChatRepo.GetChatByID(chatID)
	if err != nil {
		return err
	}

	chat.Messages = append(chat.Messages, message)
	return s.ChatRepo.UpdateChat(chat)
}

func (s *ChatService) DeleteChat(id primitive.ObjectID) error {
	return s.ChatRepo.DeleteChat(id)
}

func (s *ChatService) DeleteAllChats() error {
	return s.ChatRepo.DeleteAllChats()
}