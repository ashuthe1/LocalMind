// repository/chat_repository.go

package repository

import (
	"context"
	"time"

	"github.com/ashuthe1/localmind/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type ChatRepository struct {
	collection *mongo.Collection
}

func NewChatRepository(db *mongo.Database) *ChatRepository {
	return &ChatRepository{
		collection: db.Collection("chats"),
	}
}

// CreateChat inserts a new chat into the database.
func (r *ChatRepository) CreateChat(chat *models.Chat) error {
	chat.ID = primitive.NewObjectID()
	chat.CreatedAt = time.Now()
	chat.UpdatedAt = time.Now()

	_, err := r.collection.InsertOne(context.Background(), chat)
	return err
}

// GetChatByID retrieves a chat by its ID.
func (r *ChatRepository) GetChatByID(id primitive.ObjectID) (*models.Chat, error) {
	var chat models.Chat
	err := r.collection.FindOne(context.Background(), bson.M{"_id": id}).Decode(&chat)
	if err != nil {
		return nil, err
	}
	return &chat, nil
}

// GetAllChats retrieves all chats from the database.
func (r *ChatRepository) GetAllChats() ([]models.Chat, error) {
	var chats []models.Chat
	cursor, err := r.collection.Find(context.Background(), bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(context.Background())

	for cursor.Next(context.Background()) {
		var chat models.Chat
		if err := cursor.Decode(&chat); err != nil {
			return nil, err
		}
		chats = append(chats, chat)
	}
	if err := cursor.Err(); err != nil {
		return nil, err
	}
	return chats, nil
}

// UpdateChat updates an existing chat.
func (r *ChatRepository) UpdateChat(chat *models.Chat) error {
	chat.UpdatedAt = time.Now()
	filter := bson.M{"_id": chat.ID}
	update := bson.M{
		"$set": bson.M{
			"title":     chat.Title,
			"messages":  chat.Messages,
			"updatedAt": chat.UpdatedAt,
		},
	}
	_, err := r.collection.UpdateOne(context.Background(), filter, update)
	return err
}

// DeleteChat deletes a chat by its ID.
func (r *ChatRepository) DeleteChat(id primitive.ObjectID) error {
	_, err := r.collection.DeleteOne(context.Background(), bson.M{"_id": id})
	return err
}

// DeleteAllChats deletes all chats from the database.
func (r *ChatRepository) DeleteAllChats() error {
	_, err := r.collection.DeleteMany(context.Background(), bson.M{})
	return err
}
